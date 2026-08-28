import { createId } from '@/utils/id'
import {
  loadDeviceIdentity,
  loadOrCreateDeviceIdentity,
  updateStoredDisplayNameFromPresentation,
  type DeviceIdentityStorage,
} from './device-identity-store'
import { buildDevicePresentation, readClientHintsModel } from './device-presentation'
import type { DeviceType, LocalDeviceInfo, Platform } from './types'

interface ParsedUserAgent {
  deviceType: DeviceType
  platform: Platform
  browser: string
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/CriOS/i.test(ua)) return 'Chrome'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome'
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari'
  return 'Browser'
}

function detectPlatform(ua: string): Platform {
  if (/iPad/i.test(ua) || (/\bMacintosh\b/i.test(ua) && /Mobile/i.test(ua))) return 'ios'
  if (/iPhone|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'
  if (/Linux/i.test(ua)) return 'linux'
  return 'unknown'
}

function detectDeviceType(ua: string): DeviceType {
  if (/iPad/i.test(ua) || (/\bMacintosh\b/i.test(ua) && /Mobile/i.test(ua))) return 'tablet'
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'
  if (/iPhone|iPod|Android.*Mobile|Mobile/i.test(ua)) return 'phone'
  return 'desktop'
}

function parseUserAgent(ua: string): ParsedUserAgent {
  const platform = detectPlatform(ua)
  const deviceType = detectDeviceType(ua)
  const browser = detectBrowser(ua)
  return { deviceType, platform, browser }
}

const DEV_TAB_DEVICE_KEY = 'sharedrop.dev.tabDeviceId'

function isValidDeviceId(value: string): boolean {
  return /^dev_[a-zA-Z0-9_-]+$/.test(value) && value.length <= 128
}

/**
 * Dev-only: each browser tab gets its own deviceId so two local tabs can discover each other.
 * Production and tests (injected storage) keep the persistent localStorage identity.
 */
function resolveDeviceIdForSession(
  persistedDeviceId: string,
  options: CreateLocalDeviceInfoOptions,
): string {
  if (
    import.meta.env.DEV &&
    options.storage === undefined &&
    typeof sessionStorage !== 'undefined'
  ) {
    const existing = sessionStorage.getItem(DEV_TAB_DEVICE_KEY)
    if (existing && isValidDeviceId(existing)) {
      return existing
    }
    const tabDeviceId = createId('dev')
    sessionStorage.setItem(DEV_TAB_DEVICE_KEY, tabDeviceId)
    return tabDeviceId
  }
  return persistedDeviceId
}

export interface CreateLocalDeviceInfoOptions {
  /** Override storage (tests). Defaults to localStorage. */
  storage?: DeviceIdentityStorage | null
  /** Override user agent (tests). */
  userAgent?: string
}

/**
 * Create local device info for this page session.
 * - deviceId: persistent ShareDrop identity (localStorage); dev tabs use per-tab ids for local QA
 * - sessionId: ephemeral per page load (connection/session identity)
 * - displayName: user-defined or generated "My …" default
 */
export function createLocalDeviceInfo(options: CreateLocalDeviceInfoOptions = {}): LocalDeviceInfo {
  const ua = options.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const parsed = parseUserAgent(ua)

  const identity = loadOrCreateDeviceIdentity(
    {
      deviceType: parsed.deviceType,
      platform: parsed.platform,
      browser: parsed.browser,
      userAgent: ua,
    },
    options.storage === undefined ? undefined : options.storage,
  )

  const presentation = buildDevicePresentation({
    platform: identity.platform,
    deviceType: identity.deviceType,
    userAgent: ua,
  })

  return {
    deviceId: resolveDeviceIdForSession(identity.deviceId, options),
    sessionId: createId('ses'),
    displayName: identity.isCustomName ? identity.displayName : presentation.displayName,
    deviceType: identity.deviceType,
    platform: identity.platform,
    browser: identity.browser,
    baseName: presentation.baseName,
    typeLabel: presentation.typeLabel,
  }
}

/**
 * Refresh display name from client hints (async). Returns updated displayName or null.
 */
export async function refreshLocalDevicePresentation(
  local: LocalDeviceInfo,
  storage?: DeviceIdentityStorage | null,
): Promise<string | null> {
  const stored = loadDeviceIdentity(storage)
  if (stored?.isCustomName) return null

  const model = await readClientHintsModel()
  const presentation = buildDevicePresentation({
    platform: local.platform,
    deviceType: local.deviceType,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    clientHintsModel: model,
  })
  if (presentation.displayName === local.displayName) return null

  const updated = updateStoredDisplayNameFromPresentation(presentation.displayName, storage)
  return updated?.displayName ?? presentation.displayName
}

/** Exported for testing with custom user agents. */
export function parseUserAgentForTest(ua: string): ParsedUserAgent & { displayName: string } {
  const parsed = parseUserAgent(ua)
  const presentation = buildDevicePresentation({
    platform: parsed.platform,
    deviceType: parsed.deviceType,
    userAgent: ua,
  })
  return {
    ...parsed,
    displayName: presentation.displayName,
  }
}
