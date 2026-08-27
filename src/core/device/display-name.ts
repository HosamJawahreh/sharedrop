import { PROTOCOL } from '../../../shared/protocol'
import type { DeviceType, Platform } from './types'

/** Build a safe default display name from platform/device type (no OS account data). */
export function buildDefaultDisplayName(platform: Platform, deviceType: DeviceType): string {
  if (platform === 'ios') {
    return deviceType === 'tablet' ? 'My iPad' : 'My iPhone'
  }
  if (platform === 'android') {
    return deviceType === 'tablet' ? 'My Android Tablet' : 'My Android Phone'
  }
  if (platform === 'macos') {
    return deviceType === 'desktop' ? 'My Mac' : 'My Apple Device'
  }
  if (platform === 'windows') {
    return deviceType === 'desktop' ? 'My Windows PC' : 'My Windows Device'
  }
  if (platform === 'linux') {
    return deviceType === 'desktop' ? 'My Linux Laptop' : 'My Linux Device'
  }
  if (deviceType === 'phone') return 'My Phone'
  if (deviceType === 'tablet') return 'My Tablet'
  if (deviceType === 'desktop') return 'My Computer'
  return 'My Device'
}

/** Human-readable device type label for disambiguation (not a private identifier). */
export function deviceTypeLabel(deviceType: DeviceType, platform: Platform): string {
  if (platform === 'ios') {
    return deviceType === 'tablet' ? 'iPad' : 'iPhone'
  }
  if (platform === 'android') {
    return deviceType === 'tablet' ? 'Android Tablet' : 'Android Phone'
  }
  if (platform === 'macos') return 'Mac'
  if (platform === 'windows') return deviceType === 'desktop' ? 'Windows PC' : 'Windows Device'
  if (platform === 'linux') return deviceType === 'desktop' ? 'Linux Laptop' : 'Linux Device'
  if (deviceType === 'phone') return 'Phone'
  if (deviceType === 'tablet') return 'Tablet'
  if (deviceType === 'desktop') return 'Computer'
  return 'Device'
}

export type DisplayNameValidationResult =
  { ok: true; value: string } | { ok: false; reason: 'empty' | 'too_long' | 'invalid' }

/**
 * Validate and sanitize a user-provided device display name.
 * Allows Unicode (including Arabic) and emoji. Strips control characters.
 */
export function sanitizeDisplayName(raw: unknown): DisplayNameValidationResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'invalid' }
  }

  // Normalize Unicode; strip C0 controls and DEL (keep normal printable + Unicode).
  let cleaned = ''
  for (const char of raw.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0
    if (code < 32 || code === 127) continue
    cleaned += char
  }

  const collapsed = cleaned.replace(/\s+/g, ' ').trim()

  if (collapsed.length === 0) {
    return { ok: false, reason: 'empty' }
  }

  if (collapsed.length > PROTOCOL.MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, reason: 'too_long' }
  }

  return { ok: true, value: collapsed }
}

export function isValidCustomDisplayName(raw: unknown): raw is string {
  return sanitizeDisplayName(raw).ok
}
