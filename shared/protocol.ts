/** Shared signaling protocol types used by client and server. */

import type { ConnectionClientMessage } from './connection-protocol.js'

export type DeviceType = 'phone' | 'tablet' | 'desktop' | 'unknown'

export type Platform = 'ios' | 'android' | 'linux' | 'windows' | 'macos' | 'unknown'

export type DeviceStatus = 'available' | 'busy' | 'unreachable'

/** Ephemeral device presence payload exchanged over signaling. */
export interface DevicePayload {
  deviceId: string
  sessionId: string
  displayName: string
  deviceType: DeviceType
  platform: Platform
  browser: string
  status: DeviceStatus
  lastSeen: number
}

/** Presence client → server messages */
export type PresenceClientMessage =
  | { type: 'register'; device: DevicePayload }
  | { type: 'heartbeat'; deviceId: string; sessionId: string }
  | { type: 'unregister'; deviceId: string; sessionId: string }

/** All client → server messages */
export type ClientMessage = PresenceClientMessage | ConnectionClientMessage

/** Presence server → client messages */
export type PresenceServerMessage =
  | { type: 'registered'; deviceId: string; sessionId: string }
  | { type: 'device_list'; devices: DevicePayload[] }
  | { type: 'device_joined'; device: DevicePayload }
  | { type: 'device_updated'; device: DevicePayload }
  | { type: 'device_left'; deviceId: string }
  | { type: 'error'; code: string; message: string }

/** All server → client messages (including routed connection messages). */
export type ServerMessage = PresenceServerMessage | ConnectionClientMessage

export type SignalingMessage = ClientMessage | ServerMessage

/** Protocol constants */
export const PROTOCOL = {
  MAX_PRESENCE_MESSAGE_BYTES: 4096,
  MAX_CONNECTION_MESSAGE_BYTES: 20_480,
  MAX_MESSAGE_BYTES: 20_480,
  MAX_DISPLAY_NAME_LENGTH: 64,
  MAX_DEVICE_ID_LENGTH: 128,
  MAX_SESSION_ID_LENGTH: 128,
  HEARTBEAT_INTERVAL_MS: 15_000,
  PRESENCE_TTL_MS: 45_000,
  CLEANUP_INTERVAL_MS: 10_000,
  MAX_MESSAGES_PER_SECOND: 30,
  MAX_CONNECTIONS: 1000,
} as const

export const DEVICE_TYPES: readonly DeviceType[] = ['phone', 'tablet', 'desktop', 'unknown']
export const PLATFORMS: readonly Platform[] = [
  'ios',
  'android',
  'linux',
  'windows',
  'macos',
  'unknown',
]
export const DEVICE_STATUSES: readonly DeviceStatus[] = ['available', 'busy', 'unreachable']

export function isConnectionMessage(
  message: ClientMessage | ServerMessage,
): message is ConnectionClientMessage {
  return (
    message.type === 'connection_request' ||
    message.type === 'connection_accept' ||
    message.type === 'connection_reject' ||
    message.type === 'connection_offer' ||
    message.type === 'connection_answer' ||
    message.type === 'connection_ice' ||
    message.type === 'connection_cancel'
  )
}

export function isPresenceClientMessage(message: ClientMessage): message is PresenceClientMessage {
  return !isConnectionMessage(message)
}
