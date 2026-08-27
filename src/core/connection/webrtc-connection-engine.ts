import {
  CONNECTION_PROTOCOL,
  type ConnectionClientMessage,
} from '../../../shared/connection-protocol'
import { isConnectionMessage, type ServerMessage } from '../../../shared/protocol'
import { ConnectionError } from '@/core/errors'
import {
  wrapRtcDataChannel,
  type DataChannelTransport,
} from '@/core/transfer/data-channel-transport'
import { createId } from '@/utils/id'
import { performAnswererHandshake, performOffererHandshake } from './handshake'
import { createPeerConnectionConfig } from './ice-config'
import { collectWebRtcStats, emptyWebRtcStats } from './webrtc-stats'
import type {
  ConnectionDiagnostics,
  ConnectionDiagnosticsListener,
  ConnectionEngine,
  ConnectionEngineOptions,
  ConnectionMessageListener,
  ConnectionPayload,
  ConnectionState,
  ConnectionStateListener,
} from './types'

const DATA_CHANNEL_LABEL = 'sharedrop-handshake'
const TRANSFER_CHANNEL_LABEL = 'sharedrop-transfer'

function defaultCreatePeerConnection(config: RTCConfiguration): RTCPeerConnection {
  return new RTCPeerConnection(config)
}

export function createWebRTCConnectionEngine(options: ConnectionEngineOptions): ConnectionEngine {
  const { signalingClient, localDevice } = options
  const createPeerConnection = options.createPeerConnection ?? defaultCreatePeerConnection

  let state: ConnectionState = 'idle'
  let remoteDeviceId: string | null = null
  let connectionSessionId: string | null = null
  let role: 'offerer' | 'answerer' | null = null
  let peerConnection: RTCPeerConnection | null = null
  let dataChannel: RTCDataChannel | null = null
  let transferTransport: DataChannelTransport | null = null
  let transferReadyPromise: Promise<DataChannelTransport> | null = null
  let resolveTransferReady: ((transport: DataChannelTransport) => void) | null = null
  let listening = false
  let connectionTimeout: ReturnType<typeof setTimeout> | null = null
  let remoteDescriptionSet = false
  const pendingCandidates: RTCIceCandidateInit[] = []

  const stateListeners = new Set<ConnectionStateListener>()
  const messageListeners = new Set<ConnectionMessageListener>()
  const diagnosticsListeners = new Set<ConnectionDiagnosticsListener>()
  const unsubscribers: Array<() => void> = []
  let cachedWebRtcStats = emptyWebRtcStats()
  let statsRefreshTimer: ReturnType<typeof setInterval> | null = null

  const setState = (next: ConnectionState): void => {
    state = next
    for (const listener of stateListeners) {
      listener(state)
    }
    emitDiagnostics()
  }

  const getDiagnostics = (): ConnectionDiagnostics => ({
    state,
    connectionSessionId,
    remoteDeviceId,
    iceConnectionState: peerConnection?.iceConnectionState ?? null,
    peerConnectionState: peerConnection?.connectionState ?? null,
    dataChannelState: dataChannel?.readyState ?? null,
    transferChannelState: transferTransport?.getState() ?? null,
    role,
    webRtcStats: peerConnection ? cachedWebRtcStats : null,
  })

  const refreshWebRtcStats = async (): Promise<void> => {
    if (!peerConnection) {
      cachedWebRtcStats = emptyWebRtcStats()
      emitDiagnostics()
      return
    }
    cachedWebRtcStats = await collectWebRtcStats(peerConnection)
    emitDiagnostics()
  }

  const startStatsPolling = (): void => {
    if (statsRefreshTimer !== null || diagnosticsListeners.size === 0) return
    void refreshWebRtcStats()
    statsRefreshTimer = setInterval(() => {
      void refreshWebRtcStats()
    }, 2000)
  }

  const stopStatsPolling = (): void => {
    if (statsRefreshTimer !== null) {
      clearInterval(statsRefreshTimer)
      statsRefreshTimer = null
    }
  }

  const emitDiagnostics = (): void => {
    const diagnostics = getDiagnostics()
    for (const listener of diagnosticsListeners) {
      listener(diagnostics)
    }
  }

  const clearConnectionTimeout = (): void => {
    if (connectionTimeout !== null) {
      clearTimeout(connectionTimeout)
      connectionTimeout = null
    }
  }

  const startConnectionTimeout = (): void => {
    clearConnectionTimeout()
    connectionTimeout = setTimeout(() => {
      void failConnection('Connection timed out.')
    }, CONNECTION_PROTOCOL.CONNECTION_TIMEOUT_MS)
  }

  const sendSignaling = (message: ConnectionClientMessage): void => {
    signalingClient.send(JSON.stringify(message))
  }

  const resetTransferTransport = (): void => {
    transferTransport?.close()
    transferTransport = null
    transferReadyPromise = null
    resolveTransferReady = null
  }

  const cleanupPeerConnection = (): void => {
    clearConnectionTimeout()
    resetTransferTransport()
    dataChannel?.close()
    dataChannel = null
    peerConnection?.close()
    peerConnection = null
    pendingCandidates.length = 0
    remoteDescriptionSet = false
  }

  const resetSession = (): void => {
    cleanupPeerConnection()
    connectionSessionId = null
    remoteDeviceId = null
    role = null
  }

  const failConnection = async (userMessage: string): Promise<void> => {
    if (connectionSessionId && remoteDeviceId && role === 'offerer') {
      try {
        sendSignaling({
          type: 'connection_cancel',
          connectionSessionId,
          fromDeviceId: localDevice.deviceId,
          toDeviceId: remoteDeviceId,
        })
      } catch {
        // Ignore signaling errors during cleanup.
      }
    }
    resetSession()
    setState('failed')
    throw new ConnectionError({
      userMessage,
      technicalMessage: userMessage,
    })
  }

  const ensureTransferReadyPromise = (): void => {
    if (!transferReadyPromise) {
      transferReadyPromise = new Promise<DataChannelTransport>((resolve) => {
        resolveTransferReady = resolve
      })
    }
  }

  const setupTransferChannel = (channel: RTCDataChannel): void => {
    if (channel.label !== TRANSFER_CHANNEL_LABEL) return
    transferTransport = wrapRtcDataChannel(channel)
    ensureTransferReadyPromise()
    if (channel.readyState === 'open') {
      resolveTransferReady?.(transferTransport)
      resolveTransferReady = null
    } else {
      transferTransport.subscribeOpen(() => {
        resolveTransferReady?.(transferTransport!)
        resolveTransferReady = null
      })
    }
    emitDiagnostics()
  }

  const openTransferChannel = (pc: RTCPeerConnection): void => {
    ensureTransferReadyPromise()
    const channel = pc.createDataChannel(TRANSFER_CHANNEL_LABEL, { ordered: true })
    setupTransferChannel(channel)
  }

  const markConnected = (): void => {
    clearConnectionTimeout()
    setState('connected')
    if (role === 'offerer' && peerConnection) {
      openTransferChannel(peerConnection)
    }
  }

  const attachPeerConnectionHandlers = (pc: RTCPeerConnection): void => {
    pc.onicecandidate = (event) => {
      if (!event.candidate || !connectionSessionId || !remoteDeviceId) return
      sendSignaling({
        type: 'connection_ice',
        connectionSessionId,
        fromDeviceId: localDevice.deviceId,
        toDeviceId: remoteDeviceId,
        candidate: JSON.stringify(event.candidate.toJSON()),
      })
    }

    pc.onconnectionstatechange = () => {
      if (!peerConnection) return
      if (peerConnection.connectionState === 'failed') {
        resetSession()
        setState('failed')
      } else if (
        peerConnection.connectionState === 'disconnected' ||
        peerConnection.connectionState === 'closed'
      ) {
        if (state === 'connected' || state === 'connecting' || state === 'requesting') {
          resetSession()
          setState('disconnected')
        }
      }
      emitDiagnostics()
    }

    pc.oniceconnectionstatechange = () => {
      emitDiagnostics()
    }
  }

  const flushPendingCandidates = async (): Promise<void> => {
    if (!peerConnection || !remoteDescriptionSet) return
    for (const candidate of pendingCandidates.splice(0)) {
      await peerConnection.addIceCandidate(candidate)
    }
  }

  const addRemoteCandidate = async (candidateJson: string): Promise<void> => {
    if (!peerConnection) return
    const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit
    if (!remoteDescriptionSet) {
      pendingCandidates.push(candidate)
      return
    }
    await peerConnection.addIceCandidate(candidate)
  }

  const setupHandshakeChannel = (channel: RTCDataChannel): void => {
    if (channel.label !== DATA_CHANNEL_LABEL) return
    dataChannel = channel
    channel.onmessage = (event) => {
      for (const listener of messageListeners) {
        listener(event.data as ConnectionPayload)
      }
    }
    channel.onclose = () => {
      emitDiagnostics()
    }
    emitDiagnostics()
  }

  const waitForHandshakeDataChannel = (): Promise<RTCDataChannel> => {
    if (dataChannel) {
      return Promise.resolve(dataChannel)
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(interval)
        reject(new Error('Handshake channel not available'))
      }, CONNECTION_PROTOCOL.CONNECTION_TIMEOUT_MS)

      const interval = setInterval(() => {
        if (dataChannel) {
          clearInterval(interval)
          clearTimeout(timeout)
          resolve(dataChannel)
        }
      }, 10)
    })
  }

  const createLocalPeerConnection = (): RTCPeerConnection => {
    const pc = createPeerConnection(createPeerConnectionConfig())
    attachPeerConnectionHandlers(pc)
    pc.ondatachannel = (event) => {
      if (event.channel.label === DATA_CHANNEL_LABEL) {
        setupHandshakeChannel(event.channel)
      } else if (event.channel.label === TRANSFER_CHANNEL_LABEL) {
        setupTransferChannel(event.channel)
      }
    }
    peerConnection = pc
    emitDiagnostics()
    return pc
  }

  const handleIncomingRequest = async (message: ConnectionClientMessage): Promise<void> => {
    if (
      message.type !== 'connection_request' ||
      state !== 'idle' ||
      !listening ||
      message.toDeviceId !== localDevice.deviceId
    ) {
      return
    }

    connectionSessionId = message.connectionSessionId
    remoteDeviceId = message.fromDeviceId
    role = 'answerer'
    setState('connecting')
    startConnectionTimeout()

    sendSignaling({
      type: 'connection_accept',
      connectionSessionId,
      fromDeviceId: localDevice.deviceId,
      toDeviceId: message.fromDeviceId,
    })
  }

  const handleConnectionSignal = async (message: ConnectionClientMessage): Promise<void> => {
    if (!connectionSessionId || message.connectionSessionId !== connectionSessionId) {
      return
    }

    switch (message.type) {
      case 'connection_accept':
        if (role !== 'offerer' || state !== 'requesting') return
        setState('connecting')
        await createOffer()
        break
      case 'connection_reject':
        resetSession()
        setState('failed')
        break
      case 'connection_offer':
        if (role !== 'answerer') return
        await handleRemoteOffer(message.sdp)
        break
      case 'connection_answer':
        if (role !== 'offerer' || !peerConnection) return
        await peerConnection.setRemoteDescription({ type: 'answer', sdp: message.sdp })
        remoteDescriptionSet = true
        await flushPendingCandidates()
        break
      case 'connection_ice':
        await addRemoteCandidate(message.candidate)
        break
      case 'connection_cancel':
        resetSession()
        setState(state === 'connected' ? 'disconnected' : 'idle')
        break
    }
  }

  const createOffer = async (): Promise<void> => {
    if (!connectionSessionId || !remoteDeviceId) return

    const pc = createLocalPeerConnection()
    const channel = pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true })
    setupHandshakeChannel(channel)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    sendSignaling({
      type: 'connection_offer',
      connectionSessionId,
      fromDeviceId: localDevice.deviceId,
      toDeviceId: remoteDeviceId,
      sdp: offer.sdp ?? '',
    })

    await performOffererHandshake(channel)
    markConnected()
  }

  const handleRemoteOffer = async (sdp: string): Promise<void> => {
    if (!connectionSessionId || !remoteDeviceId) return

    const pc = createLocalPeerConnection()

    await pc.setRemoteDescription({ type: 'offer', sdp })
    remoteDescriptionSet = true
    await flushPendingCandidates()

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    sendSignaling({
      type: 'connection_answer',
      connectionSessionId,
      fromDeviceId: localDevice.deviceId,
      toDeviceId: remoteDeviceId,
      sdp: answer.sdp ?? '',
    })

    const channel = await waitForHandshakeDataChannel()
    await performAnswererHandshake(channel)
    markConnected()
  }

  const onSignalingMessage = (message: ServerMessage): void => {
    if (!isConnectionMessage(message)) return
    if (
      message.toDeviceId !== localDevice.deviceId &&
      message.fromDeviceId !== localDevice.deviceId
    ) {
      return
    }

    void (async () => {
      try {
        if (message.type === 'connection_request') {
          await handleIncomingRequest(message)
          return
        }
        await handleConnectionSignal(message)
      } catch (error) {
        resetSession()
        setState('failed')
        emitDiagnostics()
        console.error('[connection]', error)
      }
    })()
  }

  return {
    listen(): void {
      if (listening) return
      listening = true
      unsubscribers.push(signalingClient.subscribe('message', onSignalingMessage))
    },

    stopListening(): void {
      listening = false
      for (const unsub of unsubscribers.splice(0)) {
        unsub()
      }
    },

    async connect(targetDeviceId: string): Promise<void> {
      if (state !== 'idle') {
        throw new ConnectionError({
          userMessage: 'A connection is already in progress.',
          technicalMessage: `Cannot connect while state is ${state}`,
        })
      }

      if (!listening) {
        this.listen()
      }

      remoteDeviceId = targetDeviceId
      role = 'offerer'
      connectionSessionId = createId('conn')
      setState('requesting')
      startConnectionTimeout()

      sendSignaling({
        type: 'connection_request',
        connectionSessionId,
        fromDeviceId: localDevice.deviceId,
        toDeviceId: targetDeviceId,
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubscribe()
          reject(
            new ConnectionError({
              userMessage: "Couldn't connect to this device.",
              technicalMessage: 'Timed out waiting for connection_accept',
            }),
          )
        }, CONNECTION_PROTOCOL.CONNECTION_TIMEOUT_MS)

        const unsubscribe = this.subscribe((next) => {
          if (next === 'connected') {
            clearTimeout(timeout)
            unsubscribe()
            resolve()
          } else if (next === 'failed' || next === 'disconnected') {
            clearTimeout(timeout)
            unsubscribe()
            reject(
              new ConnectionError({
                userMessage: "Couldn't connect to this device.",
                technicalMessage: `Connection ended in state ${next}`,
              }),
            )
          }
        })
      })
    },

    async disconnect(): Promise<void> {
      if (state === 'idle' || state === 'disconnecting' || state === 'disconnected') {
        return
      }

      setState('disconnecting')

      if (connectionSessionId && remoteDeviceId) {
        try {
          sendSignaling({
            type: 'connection_cancel',
            connectionSessionId,
            fromDeviceId: localDevice.deviceId,
            toDeviceId: remoteDeviceId,
          })
        } catch {
          // Ignore during cleanup.
        }
      }

      resetSession()
      setState('disconnected')
    },

    async cancel(): Promise<void> {
      await this.disconnect()
      setState('idle')
    },

    getState(): ConnectionState {
      return state
    },

    getRemoteDeviceId(): string | null {
      return remoteDeviceId
    },

    getTransferTransport(): DataChannelTransport | null {
      return transferTransport
    },

    async whenTransferTransportReady(): Promise<DataChannelTransport> {
      if (transferTransport && transferTransport.getState() === 'open') {
        return transferTransport
      }
      ensureTransferReadyPromise()
      return transferReadyPromise!
    },

    async send(data: ConnectionPayload): Promise<void> {
      if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new ConnectionError({
          userMessage: 'Connection is not ready.',
          technicalMessage: 'DataChannel is not open',
        })
      }
      dataChannel.send(data as string)
    },

    subscribe(listener: ConnectionStateListener): () => void {
      stateListeners.add(listener)
      listener(state)
      return () => {
        stateListeners.delete(listener)
      }
    },

    subscribeToMessages(listener: ConnectionMessageListener): () => void {
      messageListeners.add(listener)
      return () => {
        messageListeners.delete(listener)
      }
    },

    subscribeToDiagnostics(listener: ConnectionDiagnosticsListener): () => void {
      diagnosticsListeners.add(listener)
      listener(getDiagnostics())
      startStatsPolling()
      return () => {
        diagnosticsListeners.delete(listener)
        if (diagnosticsListeners.size === 0) {
          stopStatsPolling()
        }
      }
    },

    getDiagnostics(): ConnectionDiagnostics {
      return getDiagnostics()
    },

    async refreshDiagnostics(): Promise<void> {
      await refreshWebRtcStats()
    },
  }
}
