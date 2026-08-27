/**
 * Persistent ShareDrop device identity.
 * Random local ID + display name. Not an account, fingerprint, or hardware ID.
 */

import type { DeviceType, Platform } from './types'

export interface ShareDropDeviceIdentity {
  /** Persistent random ShareDrop device ID (`dev_…`). */
  deviceId: string
  /** User-visible name (custom or generated default). */
  displayName: string
  deviceType: DeviceType
  platform: Platform
  browser: string
  /** True when the user explicitly set displayName. */
  isCustomName: boolean
  createdAt: number
  updatedAt: number
}

export const DEVICE_IDENTITY_STORAGE_KEY = 'sharedrop.deviceIdentity.v1'
