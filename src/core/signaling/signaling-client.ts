import { PROTOCOL, type ServerMessage } from '../../../shared/protocol'
import { parseServerMessage } from '../../../shared/validation'

export type SignalingEventMap = {
  open: void
  close: void
  message: ServerMessage
  error: Error
}

export type SignalingEvent = keyof SignalingEventMap

export type SignalingListener<K extends SignalingEvent> = (payload: SignalingEventMap[K]) => void

export interface SignalingClient {
  connect(): Promise<void>
  disconnect(): void
  send(message: string): void
  getState(): 'disconnected' | 'connecting' | 'connected'
  subscribe<K extends SignalingEvent>(event: K, listener: SignalingListener<K>): () => void
}

export interface SignalingClientOptions {
  url: string
  /** Injectable WebSocket factory for tests. */
  createWebSocket?: (url: string) => WebSocketLike
  /** Reconnect with exponential backoff. */
  autoReconnect?: boolean
  maxReconnectDelayMs?: number
  onReconnectAttempt?: (attempt: number) => void
}

/** Minimal WebSocket interface for browser and test mocks. */
export interface WebSocketLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener(
    type: 'open' | 'close' | 'message' | 'error',
    listener: (event: Event) => void,
  ): void
  removeEventListener(
    type: 'open' | 'close' | 'message' | 'error',
    listener: (event: Event) => void,
  ): void
}

const WS_OPEN = 1

function defaultCreateWebSocket(url: string): WebSocketLike {
  return new WebSocket(url) as unknown as WebSocketLike
}

export function createSignalingClient(options: SignalingClientOptions): SignalingClient {
  const {
    url,
    createWebSocket = defaultCreateWebSocket,
    autoReconnect = true,
    maxReconnectDelayMs = 30_000,
    onReconnectAttempt,
  } = options

  let state: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
  let socket: WebSocketLike | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let intentionalClose = false

  const listeners = new Map<SignalingEvent, Set<SignalingListener<SignalingEvent>>>()

  const emit = <K extends SignalingEvent>(event: K, payload: SignalingEventMap[K]): void => {
    const eventListeners = listeners.get(event)
    if (!eventListeners) return
    for (const listener of eventListeners) {
      ;(listener as SignalingListener<K>)(payload)
    }
  }

  const clearReconnectTimer = (): void => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const scheduleReconnect = (): void => {
    if (!autoReconnect || intentionalClose) return

    clearReconnectTimer()
    reconnectAttempt += 1
    onReconnectAttempt?.(reconnectAttempt)

    const delay = Math.min(1000 * 2 ** (reconnectAttempt - 1), maxReconnectDelayMs)
    reconnectTimer = setTimeout(() => {
      void connectInternal()
    }, delay)
  }

  const attachSocketHandlers = (ws: WebSocketLike): void => {
    ws.addEventListener('open', () => {
      state = 'connected'
      reconnectAttempt = 0
      emit('open', undefined)
    })

    ws.addEventListener('close', () => {
      state = 'disconnected'
      socket = null
      emit('close', undefined)
      if (!intentionalClose) {
        scheduleReconnect()
      }
    })

    ws.addEventListener('error', () => {
      emit('error', new Error('WebSocket connection error'))
    })

    ws.addEventListener('message', (event: Event) => {
      const messageEvent = event as MessageEvent<string>
      const raw = messageEvent.data
      if (typeof raw !== 'string' || raw.length > PROTOCOL.MAX_MESSAGE_BYTES) {
        return
      }

      const parsed = parseServerMessage(raw)
      if (!parsed) return

      emit('message', parsed)
    })
  }

  const connectInternal = (): Promise<void> => {
    if (state === 'connected' || state === 'connecting') {
      return Promise.resolve()
    }

    intentionalClose = false
    state = 'connecting'

    return new Promise((resolve, reject) => {
      try {
        const ws = createWebSocket(url)
        socket = ws

        const onOpen = (): void => {
          ws.removeEventListener('open', onOpen)
          ws.removeEventListener('error', onError)
          resolve()
        }

        const onError = (): void => {
          ws.removeEventListener('open', onOpen)
          ws.removeEventListener('error', onError)
          state = 'disconnected'
          reject(new Error('Failed to connect to signaling service'))
        }

        ws.addEventListener('open', onOpen)
        ws.addEventListener('error', onError)
        attachSocketHandlers(ws)
      } catch (error) {
        state = 'disconnected'
        reject(error)
      }
    })
  }

  return {
    async connect(): Promise<void> {
      intentionalClose = false
      reconnectAttempt = 0
      clearReconnectTimer()
      await connectInternal()
    },

    disconnect(): void {
      intentionalClose = true
      clearReconnectTimer()
      reconnectAttempt = 0
      if (socket && socket.readyState === WS_OPEN) {
        socket.close(1000, 'Client disconnect')
      }
      socket = null
      state = 'disconnected'
    },

    send(message: string): void {
      if (!socket || socket.readyState !== WS_OPEN) {
        throw new Error('Signaling client is not connected')
      }
      if (message.length > PROTOCOL.MAX_MESSAGE_BYTES) {
        throw new Error('Message exceeds maximum size')
      }
      socket.send(message)
    },

    getState(): 'disconnected' | 'connecting' | 'connected' {
      return state
    },

    subscribe<K extends SignalingEvent>(event: K, listener: SignalingListener<K>): () => void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event)!.add(listener as SignalingListener<SignalingEvent>)
      return () => {
        listeners.get(event)?.delete(listener as SignalingListener<SignalingEvent>)
      }
    },
  }
}

/** Parse outbound client message safely (re-export for client use). */
export { parseClientMessage } from '../../../shared/validation'
