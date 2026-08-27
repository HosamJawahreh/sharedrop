import type { LocalDeviceInfo, NearbyDevice } from '@/core/device'
import type { SignalingClient, SignalingClientOptions } from '@/core/signaling/signaling-client'

/**
 * Discovery finds temporary nearby peers via signaling presence.
 */

export type DiscoveryState =
  'idle' | 'starting' | 'connecting' | 'active' | 'reconnecting' | 'stopping' | 'stopped' | 'failed'

export type DevicesListener = (devices: readonly NearbyDevice[]) => void
export type DiscoveryStateListener = (state: DiscoveryState) => void

/** Optional diagnostics exposed in development mode only. */
export interface DiscoveryDiagnostics {
  connected: boolean
  registered: boolean
  nearbyCount: number
  heartbeatActive: boolean
  localDeviceId: string | null
  reconnectAttempt: number
  signalingUrl: string
}

export type DiagnosticsListener = (diagnostics: DiscoveryDiagnostics) => void

export interface DiscoveryEngine {
  start(): Promise<void>
  stop(): Promise<void>
  getNearbyDevices(): readonly NearbyDevice[]
  getLocalDevice(): LocalDeviceInfo
  /** Update local display name and refresh presence registration when active. */
  updateDisplayName(displayName: string): void
  subscribeToDevices(listener: DevicesListener): () => void
  subscribeToDiscoveryState(listener: DiscoveryStateListener): () => void
  subscribeToDiagnostics?(listener: DiagnosticsListener): () => void
}

export interface DiscoveryEngineOptions {
  signalingUrl?: string
  localDevice?: LocalDeviceInfo
  signalingClient?: SignalingClient
  /** Injectable for tests when signalingClient is not provided. */
  createSignalingClient?: (options: SignalingClientOptions) => SignalingClient
}
