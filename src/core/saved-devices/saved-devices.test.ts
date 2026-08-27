import { describe, expect, it } from 'vitest'
import { createSavedDevicesService } from './saved-devices-service'
import { parseSavedDevicesList, type SavedDevicesStorage } from './saved-devices-store'
import type { NearbyDevice } from '@/core/device'

function memoryStorage(): SavedDevicesStorage {
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

const peer = {
  deviceId: 'dev_peer',
  displayName: "Ahmed's iPhone",
  deviceType: 'phone' as const,
  platform: 'ios' as const,
}

describe('saved devices service', () => {
  it('saves, updates, looks up, and removes devices', () => {
    const storage = memoryStorage()
    const service = createSavedDevicesService(storage)

    const saved = service.upsert({ ...peer, connectedAt: 1000, lastSeenAt: 1000 })
    expect(saved?.deviceId).toBe('dev_peer')
    expect(service.get('dev_peer')?.displayName).toBe("Ahmed's iPhone")

    service.rename('dev_peer', 'Office Phone')
    expect(service.get('dev_peer')?.displayName).toBe('Office Phone')

    expect(service.remove('dev_peer')).toBe(true)
    expect(service.get('dev_peer')).toBeNull()
  })

  it('persists across service reloads', () => {
    const storage = memoryStorage()
    createSavedDevicesService(storage).upsert({ ...peer })
    const reloaded = createSavedDevicesService(storage)
    expect(reloaded.list()).toHaveLength(1)
    expect(reloaded.list()[0]?.displayName).toBe("Ahmed's iPhone")
  })

  it('matches online presence by deviceId and keeps offline saved devices', () => {
    const service = createSavedDevicesService(memoryStorage())
    service.upsert({ ...peer })
    service.upsert({
      deviceId: 'dev_laptop',
      displayName: 'My Laptop',
      deviceType: 'desktop',
      platform: 'linux',
    })

    const nearby: NearbyDevice[] = [
      {
        deviceId: 'dev_peer',
        sessionId: 'ses_1',
        displayName: "Ahmed's iPhone",
        deviceType: 'phone',
        platform: 'ios',
        browser: 'Safari',
        status: 'available',
        lastSeen: Date.now(),
      },
      {
        deviceId: 'dev_unknown',
        sessionId: 'ses_2',
        displayName: 'Unknown Android',
        deviceType: 'phone',
        platform: 'android',
        browser: 'Chrome',
        status: 'available',
        lastSeen: Date.now(),
      },
    ]

    const views = service.withPresence(nearby)
    expect(views.find((d) => d.deviceId === 'dev_peer')?.presence).toBe('online')
    expect(views.find((d) => d.deviceId === 'dev_laptop')?.presence).toBe('offline')
    expect(views[0]?.deviceId).toBe('dev_peer')
    expect(views.map((d) => d.presence)).toEqual(['online', 'offline'])
    expect(service.unsavedNearby(nearby).map((d) => d.deviceId)).toEqual(['dev_unknown'])
  })

  it('prioritizes online saved devices above offline ones', () => {
    const service = createSavedDevicesService(memoryStorage())
    service.upsert({
      deviceId: 'dev_offline',
      displayName: 'Offline Phone',
      deviceType: 'phone',
      platform: 'android',
    })
    service.upsert({
      deviceId: 'dev_online',
      displayName: 'Online Phone',
      deviceType: 'phone',
      platform: 'ios',
    })

    const views = service.withPresence([
      {
        deviceId: 'dev_online',
        sessionId: 'ses_1',
        displayName: 'Online Phone',
        deviceType: 'phone',
        platform: 'ios',
        browser: 'Safari',
        status: 'available',
        lastSeen: Date.now(),
      },
    ])

    expect(views.map((device) => device.deviceId)).toEqual(['dev_online', 'dev_offline'])
  })

  it('handles duplicate upserts by deviceId', () => {
    const service = createSavedDevicesService(memoryStorage())
    service.upsert({ ...peer, connectedAt: 1 })
    service.upsert({ ...peer, displayName: 'Renamed Peer', connectedAt: 2 })
    expect(service.list()).toHaveLength(1)
    expect(service.list()[0]?.displayName).toBe('Renamed Peer')
    expect(service.list()[0]?.lastConnectedAt).toBe(2)
  })

  it('recovers from corrupted storage and rejects invalid upserts', () => {
    const storage = memoryStorage()
    storage.setItem('sharedrop.savedDevices.v1', '{bad')
    const service = createSavedDevicesService(storage)
    expect(service.list()).toEqual([])

    expect(service.upsert({ ...peer, displayName: '   ' })).toBeNull()
    expect(parseSavedDevicesList('[{"deviceId":"x"}]')).toEqual([])
    expect(parseSavedDevicesList('[{"deviceId":"<script>","displayName":"x"}]')).toEqual([])
  })

  it('forgets all saved devices', () => {
    const storage = memoryStorage()
    const service = createSavedDevicesService(storage)
    service.upsert({ ...peer })
    service.forgetAll()
    expect(service.list()).toEqual([])
    expect(createSavedDevicesService(storage).list()).toEqual([])
  })

  it('does not treat displayName alone as identity for online matching', () => {
    const service = createSavedDevicesService(memoryStorage())
    service.upsert({ ...peer })
    const nearby: NearbyDevice[] = [
      {
        deviceId: 'dev_forged',
        sessionId: 'ses_x',
        displayName: "Ahmed's iPhone",
        deviceType: 'phone',
        platform: 'ios',
        browser: 'Safari',
        status: 'available',
        lastSeen: Date.now(),
      },
    ]
    expect(service.withPresence(nearby)[0]?.presence).toBe('offline')
    expect(service.unsavedNearby(nearby)).toHaveLength(1)
  })

  it('matches saved devices by persistent deviceId across network changes', () => {
    const service = createSavedDevicesService(memoryStorage())
    service.upsert({ ...peer, connectedAt: 1, lastSeenAt: 1 })

    // Same deviceId after Wi‑Fi → cellular / different country — no IP or network fields.
    const cellularPresence: NearbyDevice[] = [
      {
        deviceId: 'dev_peer',
        sessionId: 'ses_cellular_new',
        displayName: "Ahmed's iPhone",
        deviceType: 'phone',
        platform: 'ios',
        browser: 'Safari',
        status: 'available',
        lastSeen: Date.now(),
      },
    ]

    const views = service.withPresence(cellularPresence)
    expect(views).toHaveLength(1)
    expect(views[0]?.deviceId).toBe('dev_peer')
    expect(views[0]?.presence).toBe('online')
    expect(views[0]).not.toHaveProperty('ip')
    expect(views[0]).not.toHaveProperty('network')
    expect(JSON.stringify(service.list()[0])).not.toMatch(/192\.168|10\.|172\./)
  })
})
