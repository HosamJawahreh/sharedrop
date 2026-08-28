import { describe, expect, it } from 'vitest'
import { parseUserAgentForTest } from '@/core/device/local-device'
import { createLocalDeviceInfo } from '@/core/device/local-device'
import {
  clearDeviceIdentity,
  loadDeviceIdentity,
  loadOrCreateDeviceIdentity,
  resetStoredDisplayName,
  updateStoredDisplayName,
  type DeviceIdentityStorage,
} from '@/core/device/device-identity-store'
import { sanitizeDisplayName } from '@/core/device/display-name'

function memoryStorage(): DeviceIdentityStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

describe('createLocalDeviceInfo user-agent parsing', () => {
  it('detects iPhone presentation from user agent', () => {
    const parsed = parseUserAgentForTest(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    )
    expect(parsed.platform).toBe('ios')
    expect(parsed.deviceType).toBe('phone')
    expect(parsed.displayName).toBe('iPhone')
    expect(parsed.browser).toBe('Safari')
  })

  it('detects Android phone presentation from user agent', () => {
    const parsed = parseUserAgentForTest(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    )
    expect(parsed.platform).toBe('android')
    expect(parsed.deviceType).toBe('phone')
    expect(parsed.displayName).toBe('Pixel 8 Android Phone')
  })

  it('detects Linux desktop presentation from user agent', () => {
    const parsed = parseUserAgentForTest(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    )
    expect(parsed.platform).toBe('linux')
    expect(parsed.deviceType).toBe('desktop')
    expect(parsed.displayName).toBe('Linux PC')
  })
})

describe('device identity persistence', () => {
  it('generates and persists a device id across reloads', () => {
    const storage = memoryStorage()
    const first = createLocalDeviceInfo({
      storage,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })
    const second = createLocalDeviceInfo({
      storage,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })
    expect(first.deviceId).toMatch(/^dev_/)
    expect(second.deviceId).toBe(first.deviceId)
    expect(second.sessionId).not.toBe(first.sessionId)
    expect(second.displayName).toBe('iPhone')
  })

  it('persists custom names including Unicode, Arabic, and emoji', () => {
    const storage = memoryStorage()
    createLocalDeviceInfo({
      storage,
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile',
    })

    expect(updateStoredDisplayName("Hosam's iPhone 📱", storage)?.displayName).toBe(
      "Hosam's iPhone 📱",
    )
    expect(updateStoredDisplayName('جهاز أحمد', storage)?.displayName).toBe('جهاز أحمد')

    const reloaded = createLocalDeviceInfo({
      storage,
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile',
    })
    expect(reloaded.displayName).toBe('جهاز أحمد')
  })

  it('resets custom name to auto-detected presentation', () => {
    const storage = memoryStorage()
    createLocalDeviceInfo({
      storage,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15',
    })
    updateStoredDisplayName('Office Mac', storage)
    const reset = resetStoredDisplayName(storage)
    expect(reset?.displayName).toBe('Mac MacBook')
    expect(reset?.isCustomName).toBe(false)
  })

  it('recovers from corrupted storage', () => {
    const storage = memoryStorage()
    storage.setItem('sharedrop.deviceIdentity.v1', '{not-json')
    const identity = loadOrCreateDeviceIdentity(
      { deviceType: 'phone', platform: 'ios', browser: 'Safari' },
      storage,
    )
    expect(identity.deviceId).toMatch(/^dev_/)
    expect(loadDeviceIdentity(storage)?.deviceId).toBe(identity.deviceId)
  })

  it('clears identity on reset', () => {
    const storage = memoryStorage()
    createLocalDeviceInfo({ storage, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })
    clearDeviceIdentity(storage)
    expect(loadDeviceIdentity(storage)).toBeNull()
  })
})

describe('display name validation', () => {
  it('rejects empty and oversized names', () => {
    expect(sanitizeDisplayName('   ').ok).toBe(false)
    const empty = sanitizeDisplayName('')
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.reason).toBe('empty')
    const tooLong = sanitizeDisplayName('a'.repeat(65))
    expect(tooLong.ok).toBe(false)
    if (!tooLong.ok) expect(tooLong.reason).toBe('too_long')
  })

  it('accepts unicode and collapses whitespace', () => {
    const result = sanitizeDisplayName('  My   Device  ')
    expect(result).toEqual({ ok: true, value: 'My Device' })
    expect(sanitizeDisplayName('مرحبا').ok).toBe(true)
    expect(sanitizeDisplayName('Device 🎉').ok).toBe(true)
  })

  it('strips control characters', () => {
    const result = sanitizeDisplayName('Bad\u0000Name')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('BadName')
  })
})
