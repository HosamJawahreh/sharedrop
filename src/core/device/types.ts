/**
 * Local device identity for ShareDrop presence and transfers.
 *
 * deviceId is a persistent random ShareDrop ID (local only).
 * sessionId is ephemeral per page load.
 * Not a user account — no OS account / fingerprint / hardware IDs.
 */

export type DeviceType = 'phone' | 'tablet' | 'desktop' | 'unknown'

export type Platform = 'ios' | 'android' | 'linux' | 'windows' | 'macos' | 'unknown'

export type DeviceStatus = 'available' | 'busy' | 'unreachable'

export interface NearbyDevice {
  deviceId: string
  sessionId: string
  displayName: string
  deviceType: DeviceType
  platform: Platform
  browser: string
  status: DeviceStatus
  /** Epoch milliseconds when this device was last observed. */
  lastSeen: number
}

export interface LocalDeviceInfo {
  deviceId: string
  sessionId: string
  displayName: string
  deviceType: DeviceType
  platform: Platform
  browser: string
}
