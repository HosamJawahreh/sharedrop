import type { NearbyDevice } from '@/core/device'
import type { ConnectionDiagnostics, ConnectionEngine, ConnectionState } from '@/core/connection'
import type { DiscoveryDiagnostics, DiscoveryEngine, DiscoveryState } from '@/core/discovery'
import type { PwaInstallState } from '@/core/pwa'
import type { SavedDeviceView, SavedDevicesService } from '@/core/saved-devices'
import type { SignalingClient } from '@/core/signaling/signaling-client'
import type { TransferEngine, TransferProgressView } from '@/core/transfer'

/** UI workflow screens for the core nearby-send product path. */
export type NearbySendScreen = 'home' | 'nearby' | 'connecting'

/** UI-only state — never holds file byte contents. */
export interface NearbySendUiState {
  currentScreen: NearbySendScreen
  selectedDeviceId: string | null
  /** True after an initial discovery period with no devices found. */
  showNoDevicesHint: boolean
  /** Selected a saved device that is currently offline. */
  offlineSelectedDeviceId: string | null
  showDeviceSettings: boolean
  /** Last consumer-safe connection failure message, if any. */
  connectionUserMessage: string | null
}

export interface NearbySendDomainView {
  discoveryState: DiscoveryState
  nearbyDevices: readonly NearbyDevice[]
  savedDevices: readonly SavedDeviceView[]
  unsavedNearbyDevices: readonly NearbyDevice[]
  discoveryDiagnostics: DiscoveryDiagnostics | null
  connectionState: ConnectionState
  connectionDiagnostics: ConnectionDiagnostics | null
  connectingDevice: NearbyDevice | null
  transferProgress: TransferProgressView
  localDisplayName: string
  pwa: PwaInstallState
}

export interface NearbySendController {
  ui: NearbySendUiState
  domain: NearbySendDomainView
  signalingUrl: string
  goHome: () => Promise<void>
  startNearbySend: () => Promise<void>
  connectToDevice: (deviceId: string) => Promise<void>
  selectSavedDevice: (deviceId: string) => Promise<void>
  clearOfflineSelection: () => void
  retryConnection: () => Promise<void>
  returnToNearby: () => Promise<void>
  selectFiles: (files: readonly File[]) => void
  removeSelectedFile: (index: number) => void
  sendFiles: () => Promise<void>
  acceptIncomingTransfer: () => Promise<void>
  rejectIncomingTransfer: () => Promise<void>
  cancelTransfer: () => Promise<void>
  saveReceivedFiles: () => void
  resetTransfer: () => void
  saveCurrentPeer: () => boolean
  renameSavedDevice: (deviceId: string, displayName: string) => boolean
  removeSavedDevice: (deviceId: string) => void
  forgetAllSavedDevices: () => void
  openDeviceSettings: () => void
  closeDeviceSettings: () => void
  updateDeviceName: (
    displayName: string,
  ) => { ok: true; value: string } | { ok: false; reason: string }
  installPwa: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  dismissInstallPrompt: () => void
  discovery: DiscoveryEngine
  connection: ConnectionEngine
  transfer: TransferEngine
  signalingClient: SignalingClient
  savedDevicesService: SavedDevicesService
}

/** How long to show "Finding available devices..." before the no-devices hint. */
export const NO_DEVICES_HINT_DELAY_MS = 8_000
