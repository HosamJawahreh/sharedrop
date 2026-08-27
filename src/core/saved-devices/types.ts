/**
 * Saved devices are a local convenience list — not authentication.
 * Matching online presence uses deviceId from current discovery only.
 */

import type { DeviceType, Platform } from '@/core/device'

export interface SavedDevice {
  deviceId: string
  displayName: string
  deviceType: DeviceType
  platform: Platform
  lastSeenAt: number
  lastConnectedAt: number
}

export type SavedDevicePresence = 'online' | 'offline'

export interface SavedDeviceView extends SavedDevice {
  presence: SavedDevicePresence
}

export const SAVED_DEVICES_STORAGE_KEY = 'sharedrop.savedDevices.v1'

/** Extension point for future cryptographic peer identity (not implemented). */
export interface PeerIdentityExtensionPoint {
  /** Reserved for future verified peer keys. */
  verifiedPeerKeyId?: never
}
