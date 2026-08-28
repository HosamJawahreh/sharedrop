/** Local persistence for ShareDrop device identity (localStorage). */

import { createId } from '@/utils/id'
import { buildDevicePresentation } from './device-presentation'
import { sanitizeDisplayName } from './display-name'
import type { ShareDropDeviceIdentity } from './identity-types'
import { DEVICE_IDENTITY_STORAGE_KEY } from './identity-types'
import type { DeviceType, Platform } from './types'

export interface DeviceIdentityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): DeviceIdentityStorage | null {
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
  return typeof value === 'string' && /^dev_[a-zA-Z0-9_-]+$/.test(value) && value.length <= 128
}

/** Parse stored identity; returns null if missing or corrupted. */
export function parseStoredIdentity(raw: string | null): ShareDropDeviceIdentity | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>

  if (!isValidDeviceId(record.deviceId)) return null

  const nameResult = sanitizeDisplayName(record.displayName)
  if (!nameResult.ok) return null

  if (!isDeviceType(record.deviceType) || !isPlatform(record.platform)) return null
  if (
    typeof record.browser !== 'string' ||
    record.browser.length === 0 ||
    record.browser.length > 64
  ) {
    return null
  }
  if (typeof record.isCustomName !== 'boolean') return null
  if (typeof record.createdAt !== 'number' || !Number.isFinite(record.createdAt)) return null
  if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) return null

  return {
    deviceId: record.deviceId,
    displayName: nameResult.value,
    deviceType: record.deviceType,
    platform: record.platform,
    browser: record.browser,
    isCustomName: record.isCustomName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export interface CreateIdentityInput {
  deviceType: DeviceType
  platform: Platform
  browser: string
  userAgent?: string
  displayName?: string
  isCustomName?: boolean
  now?: number
}

export function createFreshIdentity(input: CreateIdentityInput): ShareDropDeviceIdentity {
  const now = input.now ?? Date.now()
  const presentation = buildDevicePresentation({
    platform: input.platform,
    deviceType: input.deviceType,
    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
  })
  const custom = input.displayName !== undefined ? sanitizeDisplayName(input.displayName) : null
  const useCustom = Boolean(input.isCustomName && custom?.ok)

  return {
    deviceId: createId('dev'),
    displayName: useCustom && custom?.ok ? custom.value : presentation.displayName,
    deviceType: input.deviceType,
    platform: input.platform,
    browser: input.browser.slice(0, 64),
    isCustomName: useCustom,
    createdAt: now,
    updatedAt: now,
  }
}

export function loadDeviceIdentity(
  storage: DeviceIdentityStorage | null = defaultStorage(),
): ShareDropDeviceIdentity | null {
  if (!storage) return null
  try {
    return parseStoredIdentity(storage.getItem(DEVICE_IDENTITY_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveDeviceIdentity(
  identity: ShareDropDeviceIdentity,
  storage: DeviceIdentityStorage | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // Quota / private mode — identity remains in-memory for this session.
  }
}

export function clearDeviceIdentity(
  storage: DeviceIdentityStorage | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.removeItem(DEVICE_IDENTITY_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Load persisted identity or create a new one.
 * Refreshes platform/browser metadata from the current environment while keeping deviceId.
 * If the user has not set a custom name, regenerates the default "My …" name for the current UA.
 */
export function loadOrCreateDeviceIdentity(
  env: CreateIdentityInput,
  storage: DeviceIdentityStorage | null = defaultStorage(),
): ShareDropDeviceIdentity {
  const existing = loadDeviceIdentity(storage)
  const now = env.now ?? Date.now()

  if (!existing) {
    const created = createFreshIdentity(env)
    saveDeviceIdentity(created, storage)
    return created
  }

  const presentation = buildDevicePresentation({
    platform: existing.platform,
    deviceType: existing.deviceType,
    ...(env.userAgent ? { userAgent: env.userAgent } : {}),
  })
  const next: ShareDropDeviceIdentity = {
    ...existing,
    deviceType: env.deviceType,
    platform: env.platform,
    browser: env.browser.slice(0, 64),
    displayName: existing.isCustomName ? existing.displayName : presentation.displayName,
    updatedAt: now,
  }

  saveDeviceIdentity(next, storage)
  return next
}

export function updateStoredDisplayNameFromPresentation(
  displayName: string,
  storage: DeviceIdentityStorage | null = defaultStorage(),
): ShareDropDeviceIdentity | null {
  const existing = loadDeviceIdentity(storage)
  if (!existing) return null

  const sanitized = sanitizeDisplayName(displayName)
  if (!sanitized.ok) return null

  const next: ShareDropDeviceIdentity = {
    ...existing,
    displayName: sanitized.value,
    isCustomName: false,
    updatedAt: Date.now(),
  }
  saveDeviceIdentity(next, storage)
  return next
}

export function updateStoredDisplayName(
  displayName: string,
  storage: DeviceIdentityStorage | null = defaultStorage(),
): ShareDropDeviceIdentity | null {
  const existing = loadDeviceIdentity(storage)
  if (!existing) return null

  const sanitized = sanitizeDisplayName(displayName)
  if (!sanitized.ok) return null

  const next: ShareDropDeviceIdentity = {
    ...existing,
    displayName: sanitized.value,
    isCustomName: true,
    updatedAt: Date.now(),
  }
  saveDeviceIdentity(next, storage)
  return next
}

/** Reset stored name to auto-detected presentation. */
export function resetStoredDisplayName(
  storage: DeviceIdentityStorage | null = defaultStorage(),
): ShareDropDeviceIdentity | null {
  const existing = loadDeviceIdentity(storage)
  if (!existing) return null

  const navUa = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const presentation = buildDevicePresentation({
    platform: existing.platform,
    deviceType: existing.deviceType,
    ...(navUa ? { userAgent: navUa } : {}),
  })

  const next: ShareDropDeviceIdentity = {
    ...existing,
    displayName: presentation.displayName,
    isCustomName: false,
    updatedAt: Date.now(),
  }
  saveDeviceIdentity(next, storage)
  return next
}
