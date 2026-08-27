/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { createSignalingServer, type SignalingServerHandle } from './signaling-server.js'

async function waitForOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', (error) => reject(error))
  })
}

async function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.once('close', (code, reason) => {
      resolve({ code, reason: reason.toString() })
    })
  })
}

async function listenOnEphemeralPort(
  configOverrides: Partial<SignalingServerHandle['config']>,
): Promise<SignalingServerHandle> {
  const handle = createSignalingServer({
    config: {
      port: 0,
      host: '127.0.0.1',
      allowedOrigins: ['*'],
      maxConnections: 1000,
      maxMessagesPerSecond: 30,
      maxMessageBytes: 20_480,
      serverVersion: '0.11.0-test',
      isProduction: false,
      ...configOverrides,
    },
  })

  await new Promise<void>((resolve) => {
    handle.httpServer.on('listening', () => resolve())
  })

  return handle
}

function boundPort(handle: SignalingServerHandle): number {
  const address = handle.httpServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP listen address')
  }
  return address.port
}

describe('signaling abuse protection', () => {
  let handle: SignalingServerHandle | undefined

  afterEach(async () => {
    if (handle) {
      await handle.close()
      handle = undefined
    }
  })

  it('rejects WebSocket upgrades from unknown origins', async () => {
    handle = await listenOnEphemeralPort({
      allowedOrigins: ['https://sharedrop.example'],
    })
    const port = boundPort(handle)

    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      origin: 'https://evil.example',
    })
    const closed = waitForClose(ws)
    // Avoid unhandled error events from rejected handshake.
    ws.on('error', () => {})

    const result = await closed
    expect(result.code).toBe(1008)
  })

  it('allows explicit allowed origins', async () => {
    handle = await listenOnEphemeralPort({
      allowedOrigins: ['https://sharedrop.example'],
    })
    const port = boundPort(handle)

    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      origin: 'https://sharedrop.example',
    })
    ws.on('error', () => {})
    await waitForOpen(ws)
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })

  it('rejects when at max connections', async () => {
    handle = await listenOnEphemeralPort({
      maxConnections: 1,
      allowedOrigins: ['*'],
    })
    const port = boundPort(handle)

    const first = new WebSocket(`ws://127.0.0.1:${port}`)
    first.on('error', () => {})
    await waitForOpen(first)

    const second = new WebSocket(`ws://127.0.0.1:${port}`)
    second.on('error', () => {})

    const errorMessage = await new Promise<string>((resolve) => {
      second.once('message', (data) => {
        const parsed = JSON.parse(String(data)) as { type: string; code?: string }
        resolve(parsed.code ?? parsed.type)
      })
    })

    expect(errorMessage).toBe('SERVER_FULL')
    first.close()
    second.close()
  })

  it('rate-limits excessive messages without crashing', async () => {
    handle = await listenOnEphemeralPort({
      maxMessagesPerSecond: 2,
      allowedOrigins: ['*'],
    })
    const port = boundPort(handle)

    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    ws.on('error', () => {})
    await waitForOpen(ws)

    const replies: Array<{ type: string; code?: string }> = []
    ws.on('message', (data) => {
      replies.push(JSON.parse(String(data)) as { type: string; code?: string })
    })

    for (let i = 0; i < 5; i += 1) {
      ws.send(JSON.stringify({ type: 'unregister', deviceId: 'x', sessionId: 'y' }))
    }

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(replies.some((message) => message.code === 'RATE_LIMITED')).toBe(true)
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })

  it('does not rate-limit trickle ICE candidates', async () => {
    handle = await listenOnEphemeralPort({
      maxMessagesPerSecond: 1,
      allowedOrigins: ['*'],
    })
    const port = boundPort(handle)

    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    ws.on('error', () => {})
    await waitForOpen(ws)

    const replies: Array<{ type: string; code?: string }> = []
    ws.on('message', (data) => {
      replies.push(JSON.parse(String(data)) as { type: string; code?: string })
    })

    for (let i = 0; i < 8; i += 1) {
      ws.send(
        JSON.stringify({
          type: 'connection_ice',
          connectionSessionId: 'ses',
          fromDeviceId: 'a',
          toDeviceId: 'b',
          candidate: `candidate:${i}`,
        }),
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(replies.some((message) => message.code === 'RATE_LIMITED')).toBe(false)
    // Unauthorized ICE still fails cleanly — but is not dropped by the rate limiter.
    expect(replies.every((message) => message.code !== 'RATE_LIMITED')).toBe(true)
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })

  it('rejects malformed payloads safely', async () => {
    handle = await listenOnEphemeralPort({ allowedOrigins: ['*'] })
    const port = boundPort(handle)

    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    ws.on('error', () => {})
    await waitForOpen(ws)

    const reply = await new Promise<{ type: string; code?: string }>((resolve) => {
      ws.once('message', (data) => {
        resolve(JSON.parse(String(data)) as { type: string; code?: string })
      })
      ws.send('{not-json')
    })

    expect(reply.type).toBe('error')
    expect(reply.code).toBe('INVALID_MESSAGE')
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })
})
