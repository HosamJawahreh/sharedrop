/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { PresenceStore } from '../server/presence-store.js'
import type { DevicePayload } from '../shared/protocol.js'

function createDevice(id: string): DevicePayload {
  return {
    deviceId: id,
    sessionId: `ses_${id}`,
    displayName: 'Test Device',
    deviceType: 'desktop',
    platform: 'linux',
    browser: 'Chrome',
    status: 'available',
    lastSeen: Date.now(),
  }
}

describe('PresenceStore', () => {
  it('registers and retrieves devices', () => {
    const store = new PresenceStore()
    const device = createDevice('dev_a')
    store.register('conn_a', device)
    expect(store.getAll()).toHaveLength(1)
    expect(store.get('dev_a')?.deviceId).toBe('dev_a')
  })

  it('deduplicates device updates for same device id', () => {
    const store = new PresenceStore()
    store.register('conn_a', createDevice('dev_a'))
    store.register('conn_b', createDevice('dev_a'))
    expect(store.getAll()).toHaveLength(1)
  })

  it('expires stale devices', () => {
    const store = new PresenceStore()
    const now = Date.now()
    store.register('conn_a', createDevice('dev_a'))
    const expired = store.expireStale(now + 60_000)
    expect(expired).toEqual(['dev_a'])
    expect(store.getAll()).toHaveLength(0)
  })

  it('removes device by connection id', () => {
    const store = new PresenceStore()
    store.register('conn_a', createDevice('dev_a'))
    expect(store.removeByConnection('conn_a')).toBe('dev_a')
    expect(store.getAll()).toHaveLength(0)
  })
})
