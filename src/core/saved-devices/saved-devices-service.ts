/**
 * Saved-device convenience service.
 * Does not authenticate peers — connection security remains unchanged.
 */

import { sanitizeDisplayName } from '@/core/device/display-name'
import type { NearbyDevice } from '@/core/device'
import {
  clearSavedDevices,
  loadSavedDevices,
  saveSavedDevices,
  type SavedDevicesStorage,
} from './saved-devices-store'
import type { SavedDevice, SavedDeviceView } from './types'

export interface UpsertSavedDeviceInput {
  deviceId: string
  displayName: string
  deviceType: SavedDevice['deviceType']
  platform: SavedDevice['platform']
  connectedAt?: number
  lastSeenAt?: number
}

export interface SavedDevicesService {
  list(): readonly SavedDevice[]
  get(deviceId: string): SavedDevice | null
  upsert(input: UpsertSavedDeviceInput): SavedDevice | null
  rename(deviceId: string, displayName: string): SavedDevice | null
  remove(deviceId: string): boolean
  forgetAll(): void
  /** Merge saved list with current nearby presence (by deviceId only). */
  withPresence(nearby: readonly NearbyDevice[]): readonly SavedDeviceView[]
  /** Nearby devices that are not already saved. */
  unsavedNearby(nearby: readonly NearbyDevice[]): readonly NearbyDevice[]
  subscribe(listener: (devices: readonly SavedDevice[]) => void): () => void
}

export function createSavedDevicesService(
  storage?: SavedDevicesStorage | null,
): SavedDevicesService {
  let devices = loadSavedDevices(storage)
  const listeners = new Set<(devices: readonly SavedDevice[]) => void>()

  const persist = (): void => {
    saveSavedDevices(devices, storage)
    const snapshot = devices.slice()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  return {
    list(): readonly SavedDevice[] {
      return devices.slice()
    },

    get(deviceId: string): SavedDevice | null {
      return devices.find((device) => device.deviceId === deviceId) ?? null
    },

    upsert(input: UpsertSavedDeviceInput): SavedDevice | null {
      const name = sanitizeDisplayName(input.displayName)
      if (!name.ok) return null
      if (!input.deviceId || input.deviceId.length > 128) return null

      const now = Date.now()
      const existing = devices.find((device) => device.deviceId === input.deviceId)
      const next: SavedDevice = {
        deviceId: input.deviceId,
        displayName: name.value,
        deviceType: input.deviceType,
        platform: input.platform,
        lastSeenAt: input.lastSeenAt ?? existing?.lastSeenAt ?? now,
        lastConnectedAt: input.connectedAt ?? existing?.lastConnectedAt ?? now,
      }

      devices = [next, ...devices.filter((device) => device.deviceId !== input.deviceId)]
      persist()
      return next
    },

    rename(deviceId: string, displayName: string): SavedDevice | null {
      const name = sanitizeDisplayName(displayName)
      if (!name.ok) return null
      const index = devices.findIndex((device) => device.deviceId === deviceId)
      if (index < 0) return null

      const updated: SavedDevice = {
        ...devices[index]!,
        displayName: name.value,
      }
      devices = devices.map((device, i) => (i === index ? updated : device))
      persist()
      return updated
    },

    remove(deviceId: string): boolean {
      const before = devices.length
      devices = devices.filter((device) => device.deviceId !== deviceId)
      if (devices.length === before) return false
      persist()
      return true
    },

    forgetAll(): void {
      devices = []
      clearSavedDevices(storage)
      for (const listener of listeners) {
        listener([])
      }
    },

    withPresence(nearby: readonly NearbyDevice[]): readonly SavedDeviceView[] {
      const onlineIds = new Set(nearby.map((device) => device.deviceId))
      const views = devices.map((device) => {
        const live = nearby.find((peer) => peer.deviceId === device.deviceId)
        return {
          ...device,
          // Prefer live presence display name when online (authoritative for this session).
          displayName: live?.displayName ?? device.displayName,
          deviceType: live?.deviceType ?? device.deviceType,
          platform: live?.platform ?? device.platform,
          lastSeenAt: live?.lastSeen ?? device.lastSeenAt,
          presence: onlineIds.has(device.deviceId) ? ('online' as const) : ('offline' as const),
        }
      })
      // Online saved devices first so reconnect stays one tap away.
      return views.sort((a, b) => {
        if (a.presence === b.presence) return 0
        return a.presence === 'online' ? -1 : 1
      })
    },

    unsavedNearby(nearby: readonly NearbyDevice[]): readonly NearbyDevice[] {
      const savedIds = new Set(devices.map((device) => device.deviceId))
      return nearby.filter((device) => !savedIds.has(device.deviceId))
    },

    subscribe(listener: (devices: readonly SavedDevice[]) => void): () => void {
      listeners.add(listener)
      listener(devices.slice())
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
