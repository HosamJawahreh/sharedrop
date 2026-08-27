import { describe, expect, it } from 'vitest'
import { parseClientMessage, parseServerMessage } from './validation.js'

describe('parseClientMessage', () => {
  const validDevice = {
    deviceId: 'dev_abc123',
    sessionId: 'ses_xyz789',
    displayName: 'Linux Laptop',
    deviceType: 'desktop',
    platform: 'linux',
    browser: 'Chrome',
    status: 'available',
    lastSeen: Date.now(),
  }

  it('accepts valid register message', () => {
    const message = parseClientMessage(JSON.stringify({ type: 'register', device: validDevice }))
    expect(message?.type).toBe('register')
  })

  it('rejects invalid message type', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'unknown' }))).toBeNull()
  })

  it('rejects oversized payload', () => {
    expect(parseClientMessage('a'.repeat(5000))).toBeNull()
  })

  it('rejects invalid device type', () => {
    const message = parseClientMessage(
      JSON.stringify({
        type: 'register',
        device: { ...validDevice, deviceType: 'laptop' },
      }),
    )
    expect(message).toBeNull()
  })

  it('accepts valid heartbeat', () => {
    const message = parseClientMessage(
      JSON.stringify({
        type: 'heartbeat',
        deviceId: 'dev_abc123',
        sessionId: 'ses_xyz789',
      }),
    )
    expect(message?.type).toBe('heartbeat')
  })
})

describe('parseServerMessage', () => {
  const validDevice = {
    deviceId: 'dev_abc123',
    sessionId: 'ses_xyz789',
    displayName: 'Linux Laptop',
    deviceType: 'desktop',
    platform: 'linux',
    browser: 'Chrome',
    status: 'available',
    lastSeen: Date.now(),
  }

  it('accepts registered response', () => {
    const message = parseServerMessage(
      JSON.stringify({ type: 'registered', deviceId: 'dev_abc123', sessionId: 'ses_xyz789' }),
    )
    expect(message?.type).toBe('registered')
  })

  it('accepts device_list response', () => {
    const message = parseServerMessage(
      JSON.stringify({ type: 'device_list', devices: [validDevice] }),
    )
    expect(message?.type).toBe('device_list')
    if (message?.type === 'device_list') {
      expect(message.devices).toHaveLength(1)
    }
  })

  it('accepts device_joined response', () => {
    const message = parseServerMessage(
      JSON.stringify({ type: 'device_joined', device: validDevice }),
    )
    expect(message?.type).toBe('device_joined')
  })

  it('accepts error response', () => {
    const message = parseServerMessage(
      JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE', message: 'Bad payload' }),
    )
    expect(message?.type).toBe('error')
  })

  it('rejects client-only register message', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'register', device: validDevice }))).toBeNull()
  })
})
