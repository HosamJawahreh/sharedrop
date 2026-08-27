/**
 * Ephemeral communication session between two devices.
 * No persistent identity or cloud room.
 */

export type SessionState =
  'idle' | 'discovering' | 'connecting' | 'connected' | 'closing' | 'closed' | 'failed'

export interface Session {
  sessionId: string
  localDeviceId: string
  remoteDeviceId: string
  state: SessionState
  createdAt: number
  expiresAt: number
}

export type SessionListener = (session: Session | null) => void

export interface SessionEngine {
  getSession(): Session | null
  createSession(remoteDeviceId: string): Promise<Session>
  updateState(state: SessionState): void
  closeSession(): Promise<void>
  subscribe(listener: SessionListener): () => void
}
