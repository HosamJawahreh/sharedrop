/** Local persistence for saved ShareDrop devices. */

import { sanitizeDisplayName } from '@/core/device/display-name'
import type { DeviceType, Platform } from '@/core/device'
import { SAVED_DEVICES_STORAGE_KEY, type SavedDevice } from './types'

export interface SavedDevicesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): SavedDevicesStorage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

function isDeviceType(value: unknown): value is DeviceType {
  return value === 'phone' || value === 'tablet' || value === 'desktop' || value === 'unknown'
}

function isPlatform(value: unknown): value is Platform {
  return (
    value === 'ios' ||
    value === 'android' ||
    value === 'linux' ||
    value === 'windows' ||
    value === 'macos' ||
    value === 'unknown'
  )
}

function isValidDeviceId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-zA-Z0-9_-]+$/.test(value) &&
    value.length > 0 &&
    value.length <= 128
  )
}

export function parseSavedDevice(value: unknown): SavedDevice | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>

  if (!isValidDeviceId(record.deviceId)) return null
  const name = sanitizeDisplayName(record.displayName)
  if (!name.ok) return null
  if (!isDeviceType(record.deviceType) || !isPlatform(record.platform)) return null
  if (typeof record.lastSeenAt !== 'number' || !Number.isFinite(record.lastSeenAt)) return null
  if (typeof record.lastConnectedAt !== 'number' || !Number.isFinite(record.lastConnectedAt)) {
    return null
  }

  return {
    deviceId: record.deviceId,
    displayName: name.value,
    deviceType: record.deviceType,
    platform: record.platform,
    lastSeenAt: record.lastSeenAt,
    lastConnectedAt: record.lastConnectedAt,
  }
}

/** Parse list; skips corrupted entries; returns empty on total failure. */
export function parseSavedDevicesList(raw: string | null): SavedDevice[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const byId = new Map<string, SavedDevice>()
  for (const entry of parsed) {
    const device = parseSavedDevice(entry)
    if (!device) continue
    byId.set(device.deviceId, device)
  }
  return Array.from(byId.values())
}

export function loadSavedDevices(
  storage: SavedDevicesStorage | null = defaultStorage(),
): SavedDevice[] {
  if (!storage) return []
  try {
    return parseSavedDevicesList(storage.getItem(SAVED_DEVICES_STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveSavedDevices(
  devices: readonly SavedDevice[],
  storage: SavedDevicesStorage | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(SAVED_DEVICES_STORAGE_KEY, JSON.stringify(devices))
  } catch {
    // Quota / private mode
  }
}

export function clearSavedDevices(storage: SavedDevicesStorage | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(SAVED_DEVICES_STORAGE_KEY)
  } catch {
    // ignore
  }
}
