import { describe, expect, it } from 'vitest'
import { parseClientMessage } from './validation.js'

describe('connection signaling validation', () => {
  const route = {
    connectionSessionId: 'conn_abc',
    fromDeviceId: 'dev_a',
    toDeviceId: 'dev_b',
  }

  it('accepts connection_request', () => {
    const message = parseClientMessage(JSON.stringify({ type: 'connection_request', ...route }))
    expect(message?.type).toBe('connection_request')
  })

  it('accepts connection_offer with sdp', () => {
    const message = parseClientMessage(
      JSON.stringify({ type: 'connection_offer', ...route, sdp: 'v=0\r\n' }),
    )
    expect(message?.type).toBe('connection_offer')
  })

  it('rejects oversized sdp', () => {
    const message = parseClientMessage(
      JSON.stringify({ type: 'connection_offer', ...route, sdp: 'a'.repeat(20_000) }),
    )
    expect(message).toBeNull()
  })

  it('rejects invalid session id', () => {
    const message = parseClientMessage(
      JSON.stringify({
        type: 'connection_request',
        ...route,
        connectionSessionId: 'bad id with spaces',
      }),
    )
    expect(message).toBeNull()
  })
})
