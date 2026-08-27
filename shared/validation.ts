import {
  CONNECTION_PROTOCOL,
  type ConnectionClientMessage,
  type ConnectionRoute,
} from './connection-protocol.js'
import {
  DEVICE_STATUSES,
  DEVICE_TYPES,
  isConnectionMessage,
  PLATFORMS,
  PROTOCOL,
  type ClientMessage,
  type DevicePayload,
  type DeviceStatus,
  type DeviceType,
  type Platform,
  type PresenceClientMessage,
  type ServerMessage,
} from './protocol.js'

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export function isValidId(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    ID_PATTERN.test(value)
  )
}

function validateConnectionRoute(value: Record<string, unknown>): ConnectionRoute | null {
  if (
    !isValidId(value.connectionSessionId, CONNECTION_PROTOCOL.MAX_CONNECTION_SESSION_ID_LENGTH) ||
    !isValidId(value.fromDeviceId, PROTOCOL.MAX_DEVICE_ID_LENGTH) ||
    !isValidId(value.toDeviceId, PROTOCOL.MAX_DEVICE_ID_LENGTH)
  ) {
    return null
  }

  return {
    connectionSessionId: value.connectionSessionId,
    fromDeviceId: value.fromDeviceId,
    toDeviceId: value.toDeviceId,
  }
}

function validateConnectionMessage(value: Record<string, unknown>): ConnectionClientMessage | null {
  const route = validateConnectionRoute(value)
  if (!route) return null

  switch (value.type) {
    case 'connection_request':
    case 'connection_accept':
    case 'connection_reject':
    case 'connection_cancel':
      return { type: value.type, ...route }
    case 'connection_offer':
    case 'connection_answer': {
      if (typeof value.sdp !== 'string' || value.sdp.length === 0) return null
      if (value.sdp.length > CONNECTION_PROTOCOL.MAX_SDP_LENGTH) return null
      return { type: value.type, ...route, sdp: value.sdp }
    }
    case 'connection_ice': {
      if (typeof value.candidate !== 'string' || value.candidate.length === 0) return null
      if (value.candidate.length > CONNECTION_PROTOCOL.MAX_ICE_CANDIDATE_LENGTH) return null
      return { type: value.type, ...route, candidate: value.candidate }
    }
    default:
      return null
  }
}

export function isValidDeviceType(value: unknown): value is DeviceType {
  return typeof value === 'string' && (DEVICE_TYPES as readonly string[]).includes(value)
}

export function isValidPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value)
}

export function isValidDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === 'string' && (DEVICE_STATUSES as readonly string[]).includes(value)
}

export function isValidDisplayName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= PROTOCOL.MAX_DISPLAY_NAME_LENGTH
  )
}

export function validateDevicePayload(value: unknown): DevicePayload | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const record = value as Record<string, unknown>

  if (
    !isValidId(record.deviceId, PROTOCOL.MAX_DEVICE_ID_LENGTH) ||
    !isValidId(record.sessionId, PROTOCOL.MAX_SESSION_ID_LENGTH) ||
    !isValidDisplayName(record.displayName) ||
    !isValidDeviceType(record.deviceType) ||
    !isValidPlatform(record.platform) ||
    !isValidDeviceStatus(record.status) ||
    typeof record.browser !== 'string' ||
    record.browser.length === 0 ||
    record.browser.length > 64 ||
    typeof record.lastSeen !== 'number' ||
    !Number.isFinite(record.lastSeen)
  ) {
    return null
  }

  return {
    deviceId: record.deviceId,
    sessionId: record.sessionId,
    displayName: record.displayName.trim(),
    deviceType: record.deviceType,
    platform: record.platform,
    browser: record.browser,
    status: record.status,
    lastSeen: record.lastSeen,
  }
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > PROTOCOL.MAX_MESSAGE_BYTES) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
    return null
  }

  const message = parsed as Record<string, unknown>

  if (typeof message.type === 'string' && message.type.startsWith('connection_')) {
    return validateConnectionMessage(message)
  }

  switch (message.type) {
    case 'register': {
      const device = validateDevicePayload(message.device)
      return device ? { type: 'register', device } : null
    }
    case 'heartbeat': {
      if (
        !isValidId(message.deviceId, PROTOCOL.MAX_DEVICE_ID_LENGTH) ||
        !isValidId(message.sessionId, PROTOCOL.MAX_SESSION_ID_LENGTH)
      ) {
        return null
      }
      return {
        type: 'heartbeat',
        deviceId: message.deviceId,
        sessionId: message.sessionId,
      }
    }
    case 'unregister': {
      if (
        !isValidId(message.deviceId, PROTOCOL.MAX_DEVICE_ID_LENGTH) ||
        !isValidId(message.sessionId, PROTOCOL.MAX_SESSION_ID_LENGTH)
      ) {
        return null
      }
      return {
        type: 'unregister',
        deviceId: message.deviceId,
        sessionId: message.sessionId,
      }
    }
    default:
      return null
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  if (raw.length > PROTOCOL.MAX_MESSAGE_BYTES) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
    return null
  }

  const message = parsed as Record<string, unknown>

  if (typeof message.type === 'string' && message.type.startsWith('connection_')) {
    return validateConnectionMessage(message)
  }

  switch (message.type) {
    case 'registered': {
      if (
        !isValidId(message.deviceId, PROTOCOL.MAX_DEVICE_ID_LENGTH) ||
        !isValidId(message.sessionId, PROTOCOL.MAX_SESSION_ID_LENGTH)
      ) {
        return null
      }
      return {
        type: 'registered',
        deviceId: message.deviceId,
        sessionId: message.sessionId,
      }
    }
    case 'device_list': {
      if (!Array.isArray(message.devices)) return null
      const devices: DevicePayload[] = []
      for (const device of message.devices) {
        const validated = validateDevicePayload(device)
        if (!validated) return null
        devices.push(validated)
      }
      return { type: 'device_list', devices }
    }
    case 'device_joined':
    case 'device_updated': {
      const device = validateDevicePayload(message.device)
      return device ? { type: message.type, device } : null
    }
    case 'device_left': {
      if (!isValidId(message.deviceId, PROTOCOL.MAX_DEVICE_ID_LENGTH)) {
        return null
      }
      return { type: 'device_left', deviceId: message.deviceId }
    }
    case 'error': {
      if (typeof message.code !== 'string' || typeof message.message !== 'string') {
        return null
      }
      if (message.code.length === 0 || message.message.length === 0) return null
      if (message.code.length > 64 || message.message.length > 256) return null
      return { type: 'error', code: message.code, message: message.message }
    }
    default:
      return null
  }
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message)
}

export function isPresenceClientMessage(message: ClientMessage): message is PresenceClientMessage {
  return !isConnectionMessage(message)
}
