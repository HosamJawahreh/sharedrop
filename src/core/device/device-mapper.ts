import type { DevicePayload } from '../../../shared/protocol'
import type { LocalDeviceInfo, NearbyDevice } from './types'

export function nearbyDeviceToPayload(device: LocalDeviceInfo | NearbyDevice): DevicePayload {
  return {
    deviceId: device.deviceId,
    sessionId: device.sessionId,
    displayName: device.displayName,
    deviceType: device.deviceType,
    platform: device.platform,
    browser: device.browser,
    status: 'status' in device ? device.status : 'available',
    lastSeen: 'lastSeen' in device ? device.lastSeen : Date.now(),
  }
}

export function devicePayloadToNearbyDevice(payload: DevicePayload): NearbyDevice {
  return {
    deviceId: payload.deviceId,
    sessionId: payload.sessionId,
    displayName: payload.displayName,
    deviceType: payload.deviceType,
    platform: payload.platform,
    browser: payload.browser,
    status: payload.status,
    lastSeen: payload.lastSeen,
  }
}
