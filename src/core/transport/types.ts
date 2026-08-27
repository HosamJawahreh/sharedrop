/**
 * Lowest transport boundary.
 * Production path: WebRTC DataChannel (peer-to-peer).
 * Signaling is out of band and never carries file contents.
 */

export type TransportState = 'closed' | 'opening' | 'open' | 'closing' | 'failed'

export type TransportMessage = ArrayBuffer | Uint8Array | string

export type TransportStateListener = (state: TransportState) => void
export type TransportMessageListener = (message: TransportMessage) => void

/**
 * Byte-oriented channel between two peers.
 * Implementations must not upload file contents to application servers.
 */
export interface TransportChannel {
  getState(): TransportState
  send(message: TransportMessage): Promise<void>
  close(): Promise<void>
  subscribeToState(listener: TransportStateListener): () => void
  subscribeToMessages(listener: TransportMessageListener): () => void
}

/**
 * Factory for peer transports.
 * WebRTC DataChannel implementation lands in a later phase.
 */
export interface TransportFactory {
  createChannel(remoteDeviceId: string): Promise<TransportChannel>
}
