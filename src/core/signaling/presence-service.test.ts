import { describe, expect, it } from 'vitest'
import type { ServerMessage } from '../../../shared/protocol'
import { createPresenceService } from '@/core/signaling/presence-service'
import type { SignalingClient } from '@/core/signaling/signaling-client'
import type { LocalDeviceInfo } from '@/core/device'

function createMockClient(): SignalingClient & {
  emit: (event: 'open' | 'close' | 'message' | 'error', payload?: unknown) => void
  sent: string[]
} {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const sent: string[] = []

  return {
    sent,
    async connect() {},
    disconnect() {},
    send(message: string) {
      sent.push(message)
    },
    getState() {
      return 'connected' as const
    },
    subscribe(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener as (payload: unknown) => void)
      return () => listeners.get(event)?.delete(listener as (payload: unknown) => void)
    },
    emit(event, payload) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload)
      }
    },
  }
}

const localDevice: LocalDeviceInfo = {
  deviceId: 'dev_local',
  sessionId: 'ses_local',
  displayName: 'Linux Laptop',
  deviceType: 'desktop',
  platform: 'linux',
  browser: 'Chrome',
}

describe('createPresenceService', () => {
  it('filters self from nearby devices', async () => {
    const client = createMockClient()
    const presence = createPresenceService({ client, localDevice })
    await presence.start()

    client.emit('message', {
      type: 'device_list',
      devices: [
        {
          deviceId: 'dev_local',
          sessionId: 'ses_local',
          displayName: 'Linux Laptop',
          deviceType: 'desktop',
          platform: 'linux',
          browser: 'Chrome',
          status: 'available',
          lastSeen: Date.now(),
        },
        {
          deviceId: 'dev_remote',
          sessionId: 'ses_remote',
          displayName: 'iPhone',
          deviceType: 'phone',
          platform: 'ios',
          browser: 'Safari',
          status: 'available',
          lastSeen: Date.now(),
        },
      ],
    } satisfies ServerMessage)

    expect(presence.getNearbyDevices()).toHaveLength(1)
    expect(presence.getNearbyDevices()[0]?.deviceId).toBe('dev_remote')
  })

  it('deduplicates device updates', async () => {
    const client = createMockClient()
    const presence = createPresenceService({ client, localDevice })
    await presence.start()

    const remote = {
      deviceId: 'dev_remote',
      sessionId: 'ses_remote',
      displayName: 'iPhone',
      deviceType: 'phone' as const,
      platform: 'ios' as const,
      browser: 'Safari',
      status: 'available' as const,
      lastSeen: Date.now(),
    }

    client.emit('message', { type: 'device_joined', device: remote })
    client.emit('message', { type: 'device_updated', device: remote })

    expect(presence.getNearbyDevices()).toHaveLength(1)
  })

  it('removes devices on device_left', async () => {
    const client = createMockClient()
    const presence = createPresenceService({ client, localDevice })
    await presence.start()

    client.emit('message', {
      type: 'device_joined',
      device: {
        deviceId: 'dev_remote',
        sessionId: 'ses_remote',
        displayName: 'iPhone',
        deviceType: 'phone',
        platform: 'ios',
        browser: 'Safari',
        status: 'available',
        lastSeen: Date.now(),
      },
    })

    client.emit('message', { type: 'device_left', deviceId: 'dev_remote' })
    expect(presence.getNearbyDevices()).toHaveLength(0)
  })
})
