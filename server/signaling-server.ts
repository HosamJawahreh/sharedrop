import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ConnectionClientMessage } from '../shared/connection-protocol.js'
import { isConnectionMessage, PROTOCOL, type ServerMessage } from '../shared/protocol.js'
import { parseClientMessage, serializeServerMessage } from '../shared/validation.js'
import { ConnectionSessionStore, createConnectionSession } from './connection-session-store.js'
import { loadConfig, type ServerConfig } from './config.js'
import { isOriginAllowed } from './origin-policy.js'
import { logOpsEvent } from './ops-log.js'
import { PresenceStore } from './presence-store.js'
import { RateLimiter } from './rate-limiter.js'
import { buildHealthPayload } from './health.js'
import { tryServeStatic } from './static-assets.js'

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(serializeServerMessage(message))
  }
}

function broadcast(wss: WebSocketServer, message: ServerMessage): void {
  const payload = serializeServerMessage(message)
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload)
    }
  }
}

function findSocketByConnectionId(
  wss: WebSocketServer,
  connectionIds: WeakMap<WebSocket, string>,
  targetConnectionId: string,
): WebSocket | null {
  for (const client of wss.clients) {
    if (connectionIds.get(client) === targetConnectionId) {
      return client
    }
  }
  return null
}

function routeToDevice(
  wss: WebSocketServer,
  store: PresenceStore,
  connectionIds: WeakMap<WebSocket, string>,
  deviceId: string,
  message: ConnectionClientMessage,
): boolean {
  const targetConnectionId = store.getConnectionId(deviceId)
  if (!targetConnectionId) return false
  const targetSocket = findSocketByConnectionId(wss, connectionIds, targetConnectionId)
  if (!targetSocket) return false
  send(targetSocket, message)
  return true
}

function handleConnectionMessage(
  ws: WebSocket,
  wss: WebSocketServer,
  store: PresenceStore,
  sessions: ConnectionSessionStore,
  connectionIds: WeakMap<WebSocket, string>,
  senderConnectionId: string,
  message: ConnectionClientMessage,
): void {
  const fromDeviceId = store.getDeviceIdByConnectionId(senderConnectionId)
  if (!fromDeviceId || fromDeviceId !== message.fromDeviceId) {
    send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Invalid sender.' })
    return
  }

  if (!store.hasDevice(message.toDeviceId) && message.type !== 'connection_cancel') {
    send(ws, { type: 'error', code: 'DEVICE_UNAVAILABLE', message: 'Target unavailable.' })
    return
  }

  switch (message.type) {
    case 'connection_request': {
      if (message.fromDeviceId !== fromDeviceId) return
      sessions.create(
        createConnectionSession(
          message.connectionSessionId,
          message.fromDeviceId,
          message.toDeviceId,
        ),
      )
      if (!routeToDevice(wss, store, connectionIds, message.toDeviceId, message)) {
        sessions.remove(message.connectionSessionId)
        send(ws, { type: 'error', code: 'DEVICE_UNAVAILABLE', message: 'Target unavailable.' })
      }
      break
    }
    case 'connection_accept':
    case 'connection_reject':
    case 'connection_offer':
    case 'connection_answer':
    case 'connection_ice':
    case 'connection_cancel': {
      const session = sessions.get(message.connectionSessionId)
      if (!session || !sessions.isParticipant(message.connectionSessionId, fromDeviceId)) {
        send(ws, { type: 'error', code: 'INVALID_SESSION', message: 'Invalid session.' })
        return
      }

      if (message.type === 'connection_accept') {
        if (fromDeviceId !== session.answererDeviceId) {
          send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Only answerer may accept.' })
          return
        }
        sessions.markAccepted(message.connectionSessionId)
      }

      if (message.type === 'connection_offer' && fromDeviceId !== session.offererDeviceId) {
        send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Only offerer may send offer.' })
        return
      }

      if (message.type === 'connection_answer' && fromDeviceId !== session.answererDeviceId) {
        send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Only answerer may send answer.' })
        return
      }

      if (message.type === 'connection_cancel') {
        sessions.remove(message.connectionSessionId)
      }

      const recipientId =
        fromDeviceId === message.fromDeviceId ? message.toDeviceId : message.fromDeviceId

      if (!routeToDevice(wss, store, connectionIds, recipientId, message)) {
        send(ws, { type: 'error', code: 'DEVICE_UNAVAILABLE', message: 'Target unavailable.' })
      }
      break
    }
  }
}

function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  startedAtMs: number,
  config: ServerConfig,
  connectionCount: () => number,
): void {
  const path = req.url?.split('?')[0] ?? ''
  if (req.method === 'GET' && (path === '/health' || path === '/healthz')) {
    const body = JSON.stringify(
      buildHealthPayload({
        version: config.serverVersion,
        startedAtMs,
        connectionCount: connectionCount(),
      }),
    )
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(body)
    return
  }

  if (tryServeStatic(req, res)) {
    return
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('Not found')
}

export interface SignalingServerHandle {
  httpServer: Server
  wss: WebSocketServer
  store: PresenceStore
  sessions: ConnectionSessionStore
  config: ServerConfig
  close: () => Promise<void>
}

export function createSignalingServer(options?: {
  config?: ServerConfig
  startedAtMs?: number
}): SignalingServerHandle {
  const config = options?.config ?? loadConfig()
  const startedAtMs = options?.startedAtMs ?? Date.now()
  const store = new PresenceStore()
  const sessions = new ConnectionSessionStore()
  const rateLimiter = new RateLimiter(config.maxMessagesPerSecond)
  const connectionIds = new WeakMap<WebSocket, string>()

  const httpServer = createServer((req, res) => {
    handleHttpRequest(req, res, startedAtMs, config, () => wss.clients.size)
  })

  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: config.maxMessageBytes,
  })

  wss.on('connection', (ws, request) => {
    if (wss.clients.size > config.maxConnections) {
      logOpsEvent('connection_rejected', {
        reason: 'server_full',
        connections: wss.clients.size,
      })
      send(ws, { type: 'error', code: 'SERVER_FULL', message: 'Server is at capacity.' })
      ws.close(1013, 'Server full')
      return
    }

    const origin = request.headers.origin
    if (!isOriginAllowed(origin, config.allowedOrigins)) {
      logOpsEvent('connection_rejected', {
        reason: 'origin_not_allowed',
        connections: wss.clients.size,
      })
      ws.close(1008, 'Origin not allowed')
      return
    }

    const connectionId = randomUUID()
    connectionIds.set(ws, connectionId)
    logOpsEvent('connection_accepted', { connections: wss.clients.size })

    ws.on('message', (data) => {
      const raw = typeof data === 'string' ? data : data.toString('utf8')

      const message = parseClientMessage(raw)
      if (!message) {
        if (!rateLimiter.allow(connectionId)) {
          send(ws, { type: 'error', code: 'RATE_LIMITED', message: 'Too many messages.' })
          return
        }
        send(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Invalid message.' })
        return
      }

      // Trickle ICE can burst far above presence rates (especially with TURN).
      // Dropping candidates silently breaks connectivity — do not rate-limit them.
      if (message.type !== 'connection_ice' && !rateLimiter.allow(connectionId)) {
        send(ws, { type: 'error', code: 'RATE_LIMITED', message: 'Too many messages.' })
        return
      }

      if (isConnectionMessage(message)) {
        handleConnectionMessage(ws, wss, store, sessions, connectionIds, connectionId, message)
        return
      }

      switch (message.type) {
        case 'register': {
          const device = store.register(connectionId, message.device)
          send(ws, {
            type: 'registered',
            deviceId: device.deviceId,
            sessionId: device.sessionId,
          })
          send(ws, {
            type: 'device_list',
            devices: store.getAll().filter((entry) => entry.deviceId !== device.deviceId),
          })
          broadcast(wss, {
            type: 'device_joined',
            device,
          })
          break
        }
        case 'heartbeat': {
          const updated = store.heartbeat(message.deviceId, message.sessionId, connectionId)
          if (!updated) {
            send(ws, { type: 'error', code: 'INVALID_HEARTBEAT', message: 'Invalid heartbeat.' })
            return
          }
          broadcast(wss, {
            type: 'device_updated',
            device: updated,
          })
          break
        }
        case 'unregister': {
          const removed = store.unregister(message.deviceId, message.sessionId, connectionId)
          if (removed) {
            broadcast(wss, {
              type: 'device_left',
              deviceId: message.deviceId,
            })
          }
          break
        }
      }
    })

    ws.on('close', () => {
      rateLimiter.remove(connectionId)
      const deviceId = store.removeByConnection(connectionId)
      if (deviceId) {
        broadcast(wss, { type: 'device_left', deviceId })
      }
      logOpsEvent('connection_closed', { connections: wss.clients.size })
    })
  })

  const cleanupTimer = setInterval(() => {
    const expiredDevices = store.expireStale()
    for (const deviceId of expiredDevices) {
      broadcast(wss, { type: 'device_left', deviceId })
    }
    sessions.expireStale()
  }, PROTOCOL.CLEANUP_INTERVAL_MS)

  httpServer.listen(config.port, config.host)

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      clearInterval(cleanupTimer)
      wss.close((wsError) => {
        httpServer.close((httpError) => {
          if (wsError) reject(wsError)
          else if (httpError) reject(httpError)
          else resolve()
        })
      })
    })

  return { httpServer, wss, store, sessions, config, close }
}

export function startSignalingServer(): SignalingServerHandle {
  const handle = createSignalingServer()
  const bindHost = handle.config.host === '0.0.0.0' ? 'all interfaces' : handle.config.host
  logOpsEvent('listening', {
    host: bindHost,
    port: handle.config.port,
    maxConnections: handle.config.maxConnections,
  })
  console.log(`[signaling] listening on ${bindHost}:${handle.config.port}`)
  return handle
}
