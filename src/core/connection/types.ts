import type { WebRtcStatsSnapshot } from './webrtc-stats'

/**
 * Peer connection abstraction.
 * UI must never see RTCPeerConnection / ICE / signaling details.
 */

import type { LocalDeviceInfo } from '@/core/device'
import type { SignalingClient } from '@/core/signaling/signaling-client'
import type { DataChannelTransport } from '@/core/transfer/data-channel-transport'

export type ConnectionState =
  'idle' | 'requesting' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'failed'

export type ConnectionPayload = ArrayBuffer | Uint8Array | string

export type ConnectionStateListener = (state: ConnectionState) => void
export type ConnectionMessageListener = (payload: ConnectionPayload) => void

/** Dev-only connection diagnostics. */
export interface ConnectionDiagnostics {
  state: ConnectionState
  connectionSessionId: string | null
  remoteDeviceId: string | null
  iceConnectionState: string | null
  peerConnectionState: string | null
  dataChannelState: string | null
  transferChannelState: string | null
  role: 'offerer' | 'answerer' | null
  /** Populated asynchronously via getStats() in development builds. */
  webRtcStats: WebRtcStatsSnapshot | null
}

export type ConnectionDiagnosticsListener = (diagnostics: ConnectionDiagnostics) => void

export interface ConnectionEngine {
  listen(): void
  stopListening(): void
  connect(remoteDeviceId: string): Promise<void>
  disconnect(): Promise<void>
  cancel(): Promise<void>
  getState(): ConnectionState
  getRemoteDeviceId(): string | null
  getTransferTransport(): DataChannelTransport | null
  whenTransferTransportReady(): Promise<DataChannelTransport>
  send(data: ConnectionPayload): Promise<void>
  subscribe(listener: ConnectionStateListener): () => void
  subscribeToMessages(listener: ConnectionMessageListener): () => void
  subscribeToDiagnostics?(listener: ConnectionDiagnosticsListener): () => void
  /** Dev-only: current diagnostics snapshot (may include last polled WebRTC stats). */
  getDiagnostics?(): ConnectionDiagnostics
  /** Dev-only: refresh WebRTC statistics from the underlying peer connection. */
  refreshDiagnostics?(): Promise<void>
}

export interface ConnectionEngineOptions {
  signalingClient: SignalingClient
  localDevice: LocalDeviceInfo
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection
}
