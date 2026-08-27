import type { DevicePayload } from '../shared/protocol.js'
import { PROTOCOL } from '../shared/protocol.js'

interface StoredDevice {
  device: DevicePayload
  connectionId: string
  lastHeartbeat: number
}

export class PresenceStore {
  private readonly devices = new Map<string, StoredDevice>()
  private readonly connectionToDevice = new Map<string, string>()

  register(connectionId: string, device: DevicePayload): DevicePayload {
    const existing = this.devices.get(device.deviceId)
    const normalized: DevicePayload = {
      ...device,
      lastSeen: Date.now(),
      status: 'available',
    }

    if (existing && existing.connectionId !== connectionId) {
      this.connectionToDevice.delete(existing.connectionId)
    }

    this.devices.set(device.deviceId, {
      device: normalized,
      connectionId,
      lastHeartbeat: Date.now(),
    })
    this.connectionToDevice.set(connectionId, device.deviceId)
    return normalized
  }

  heartbeat(deviceId: string, sessionId: string, connectionId: string): DevicePayload | null {
    const stored = this.devices.get(deviceId)
    if (!stored || stored.connectionId !== connectionId || stored.device.sessionId !== sessionId) {
      return null
    }

    stored.lastHeartbeat = Date.now()
    stored.device = {
      ...stored.device,
      lastSeen: Date.now(),
      status: 'available',
    }
    return stored.device
  }

  unregister(deviceId: string, sessionId: string, connectionId: string): boolean {
    const stored = this.devices.get(deviceId)
    if (!stored || stored.connectionId !== connectionId || stored.device.sessionId !== sessionId) {
      return false
    }
    this.removeByConnection(connectionId)
    return true
  }

  removeByConnection(connectionId: string): string | null {
    const deviceId = this.connectionToDevice.get(connectionId)
    if (!deviceId) return null

    this.connectionToDevice.delete(connectionId)
    this.devices.delete(deviceId)
    return deviceId
  }

  getAll(): DevicePayload[] {
    return Array.from(this.devices.values()).map((entry) => entry.device)
  }

  get(deviceId: string): DevicePayload | null {
    return this.devices.get(deviceId)?.device ?? null
  }

  getConnectionId(deviceId: string): string | null {
    return this.devices.get(deviceId)?.connectionId ?? null
  }

  getDeviceIdByConnectionId(connectionId: string): string | null {
    return this.connectionToDevice.get(connectionId) ?? null
  }

  hasDevice(deviceId: string): boolean {
    return this.devices.has(deviceId)
  }

  expireStale(now = Date.now()): string[] {
    const expired: string[] = []
    for (const [deviceId, stored] of this.devices) {
      if (now - stored.lastHeartbeat > PROTOCOL.PRESENCE_TTL_MS) {
        this.connectionToDevice.delete(stored.connectionId)
        this.devices.delete(deviceId)
        expired.push(deviceId)
      }
    }
    return expired
  }

  size(): number {
    return this.devices.size
  }
}
