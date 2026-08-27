import { CONNECTION_PROTOCOL } from '../shared/connection-protocol.js'

export interface StoredConnectionSession {
  connectionSessionId: string
  offererDeviceId: string
  answererDeviceId: string
  accepted: boolean
  createdAt: number
  expiresAt: number
}

export class ConnectionSessionStore {
  private readonly sessions = new Map<string, StoredConnectionSession>()

  create(session: StoredConnectionSession): StoredConnectionSession {
    this.sessions.set(session.connectionSessionId, session)
    return session
  }

  get(connectionSessionId: string): StoredConnectionSession | null {
    return this.sessions.get(connectionSessionId) ?? null
  }

  markAccepted(connectionSessionId: string): boolean {
    const session = this.sessions.get(connectionSessionId)
    if (!session) return false
    session.accepted = true
    return true
  }

  remove(connectionSessionId: string): boolean {
    return this.sessions.delete(connectionSessionId)
  }

  isParticipant(connectionSessionId: string, deviceId: string): boolean {
    const session = this.sessions.get(connectionSessionId)
    if (!session) return false
    return session.offererDeviceId === deviceId || session.answererDeviceId === deviceId
  }

  getRole(connectionSessionId: string, deviceId: string): 'offerer' | 'answerer' | null {
    const session = this.sessions.get(connectionSessionId)
    if (!session) return null
    if (session.offererDeviceId === deviceId) return 'offerer'
    if (session.answererDeviceId === deviceId) return 'answerer'
    return null
  }

  expireStale(now = Date.now()): string[] {
    const expired: string[] = []
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id)
        expired.push(id)
      }
    }
    return expired
  }
}

export function createConnectionSession(
  connectionSessionId: string,
  offererDeviceId: string,
  answererDeviceId: string,
): StoredConnectionSession {
  const now = Date.now()
  return {
    connectionSessionId,
    offererDeviceId,
    answererDeviceId,
    accepted: false,
    createdAt: now,
    expiresAt: now + CONNECTION_PROTOCOL.SESSION_TTL_MS,
  }
}
