/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  ConnectionSessionStore,
  createConnectionSession,
} from '../server/connection-session-store.js'

describe('ConnectionSessionStore', () => {
  it('tracks participants and roles', () => {
    const store = new ConnectionSessionStore()
    store.create(createConnectionSession('conn_1', 'dev_a', 'dev_b'))

    expect(store.isParticipant('conn_1', 'dev_a')).toBe(true)
    expect(store.getRole('conn_1', 'dev_a')).toBe('offerer')
    expect(store.getRole('conn_1', 'dev_b')).toBe('answerer')
    expect(store.isParticipant('conn_1', 'dev_x')).toBe(false)
  })

  it('expires stale sessions', () => {
    const store = new ConnectionSessionStore()
    const session = createConnectionSession('conn_1', 'dev_a', 'dev_b')
    session.expiresAt = Date.now() - 1
    store.create(session)

    expect(store.expireStale()).toEqual(['conn_1'])
    expect(store.get('conn_1')).toBeNull()
  })
})
