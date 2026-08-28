import { PROTOCOL, type DevicePayload, type ServerMessage } from '../../../shared/protocol'
import { nearbyDeviceToPayload } from '@/core/device/device-mapper'
import type { LocalDeviceInfo, NearbyDevice } from '@/core/device'
import { devicePayloadToNearbyDevice } from '@/core/device/device-mapper'
import type { SignalingClient } from './signaling-client'

export type PresenceListener = (devices: readonly NearbyDevice[]) => void

export interface PresenceServiceOptions {
  client: SignalingClient
  localDevice: LocalDeviceInfo
}

export interface PresenceService {
  start(): Promise<void>
  stop(): Promise<void>
  getNearbyDevices(): readonly NearbyDevice[]
  subscribe(listener: PresenceListener): () => void
  isRegistered(): boolean
  /** Update local display name and re-register if already present. */
  updateDisplayName(displayName: string): void
}

export function createPresenceService(options: PresenceServiceOptions): PresenceService {
  const { client, localDevice } = options

  const devicesById = new Map<string, NearbyDevice>()
  const listeners = new Set<PresenceListener>()
  let registered = false
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  const unsubscribers: Array<() => void> = []

  const notify = (): void => {
    const list = Array.from(devicesById.values())
    for (const listener of listeners) {
      listener(list)
    }
  }

  const upsertDevice = (payload: DevicePayload): void => {
    if (payload.deviceId === localDevice.deviceId) {
      return
    }
    devicesById.set(payload.deviceId, devicePayloadToNearbyDevice(payload))
    notify()
  }

  const removeDevice = (deviceId: string): void => {
    if (deviceId === localDevice.deviceId) {
      return
    }
    if (devicesById.delete(deviceId)) {
      notify()
    }
  }

  const sendRegister = (): void => {
    const payload = nearbyDeviceToPayload({
      ...localDevice,
      status: 'available',
      lastSeen: Date.now(),
    })
    client.send(JSON.stringify({ type: 'register', device: payload }))
  }

  const sendHeartbeat = (): void => {
    if (!registered) return
    client.send(
      JSON.stringify({
        type: 'heartbeat',
        deviceId: localDevice.deviceId,
        sessionId: localDevice.sessionId,
      }),
    )
  }

  const sendUnregister = (): void => {
    if (!registered) return
    client.send(
      JSON.stringify({
        type: 'unregister',
        deviceId: localDevice.deviceId,
        sessionId: localDevice.sessionId,
      }),
    )
  }

  const startHeartbeat = (): void => {
    stopHeartbeat()
    heartbeatTimer = setInterval(sendHeartbeat, PROTOCOL.HEARTBEAT_INTERVAL_MS)
  }

  const stopHeartbeat = (): void => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const handleServerMessage = (message: ServerMessage): void => {
    switch (message.type) {
      case 'registered':
        registered = true
        startHeartbeat()
        notify()
        break
      case 'device_list':
        devicesById.clear()
        for (const device of message.devices) {
          upsertDevice(device)
        }
        notify()
        break
      case 'device_joined':
      case 'device_updated':
        upsertDevice(message.device)
        break
      case 'device_left':
        removeDevice(message.deviceId)
        break
      case 'error':
        break
    }
  }

  const handleReconnect = (): void => {
    registered = false
    sendRegister()
  }

  return {
    async start(): Promise<void> {
      // Already subscribed — just ensure registration if connected.
      if (unsubscribers.length > 0) {
        if (client.getState() === 'connected' && !registered) {
          sendRegister()
        }
        return
      }

      unsubscribers.push(
        client.subscribe('message', handleServerMessage),
        client.subscribe('open', handleReconnect),
      )

      if (client.getState() === 'connected') {
        sendRegister()
      }
    },

    async stop(): Promise<void> {
      stopHeartbeat()
      sendUnregister()
      registered = false
      devicesById.clear()
      notify()
      for (const unsub of unsubscribers) {
        unsub()
      }
      unsubscribers.length = 0
    },

    getNearbyDevices(): readonly NearbyDevice[] {
      return Array.from(devicesById.values())
    },

    subscribe(listener: PresenceListener): () => void {
      listeners.add(listener)
      listener(Array.from(devicesById.values()))
      return () => {
        listeners.delete(listener)
      }
    },

    isRegistered(): boolean {
      return registered
    },

    updateDisplayName(displayName: string): void {
      localDevice.displayName = displayName
      if (registered) {
        sendRegister()
      }
    },
  }
}
