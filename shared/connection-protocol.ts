/** WebRTC connection signaling messages — separate from presence sessionId. */

export interface ConnectionRoute {
  connectionSessionId: string
  fromDeviceId: string
  toDeviceId: string
}

export interface ConnectionRequestPayload extends ConnectionRoute {
  type: 'connection_request'
}

export interface ConnectionAcceptPayload extends ConnectionRoute {
  type: 'connection_accept'
}

export interface ConnectionRejectPayload extends ConnectionRoute {
  type: 'connection_reject'
}

export interface ConnectionOfferPayload extends ConnectionRoute {
  type: 'connection_offer'
  sdp: string
}

export interface ConnectionAnswerPayload extends ConnectionRoute {
  type: 'connection_answer'
  sdp: string
}

export interface ConnectionIcePayload extends ConnectionRoute {
  type: 'connection_ice'
  candidate: string
}

export interface ConnectionCancelPayload extends ConnectionRoute {
  type: 'connection_cancel'
}

export type ConnectionClientMessage =
  | ConnectionRequestPayload
  | ConnectionAcceptPayload
  | ConnectionRejectPayload
  | ConnectionOfferPayload
  | ConnectionAnswerPayload
  | ConnectionIcePayload
  | ConnectionCancelPayload

/** Routed connection messages delivered by the signaling server. */
export type ConnectionServerMessage = ConnectionClientMessage

export const CONNECTION_PROTOCOL = {
  MAX_CONNECTION_SESSION_ID_LENGTH: 128,
  MAX_SDP_LENGTH: 16_384,
  MAX_ICE_CANDIDATE_LENGTH: 2_048,
  CONNECTION_TIMEOUT_MS: 30_000,
  SESSION_TTL_MS: 120_000,
  HANDSHAKE_TIMEOUT_MS: 10_000,
} as const

export const HANDSHAKE = {
  HELLO: 'HELLO',
  PEER_READY: 'PEER_READY',
} as const
