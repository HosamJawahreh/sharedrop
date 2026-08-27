import { describe, expect, it, vi } from 'vitest'
import {
  createPeerConnectionConfig,
  getIceServers,
  parseIceServersJson,
  resolveIceTransportPolicy,
  summarizeIceServers,
} from './ice-config'

describe('ICE server configuration', () => {
  it('parses a STUN URL', () => {
    const servers = parseIceServersJson(JSON.stringify([{ urls: 'stun:stun.example.com:19302' }]))
    expect(servers).toEqual([{ urls: 'stun:stun.example.com:19302' }])
  })

  it('parses a TURN URL with credentials', () => {
    const servers = parseIceServersJson(
      JSON.stringify([
        {
          urls: 'turn:turn.example.com:3478?transport=udp',
          username: 'user',
          credential: 'secret',
        },
      ]),
    )
    expect(servers).toEqual([
      {
        urls: 'turn:turn.example.com:3478?transport=udp',
        username: 'user',
        credential: 'secret',
      },
    ])
  })

  it('parses a TURNS URL with credentials', () => {
    const servers = parseIceServersJson(
      JSON.stringify([
        {
          urls: 'turns:turn.example.com:5349?transport=tcp',
          username: 'user',
          credential: 'secret',
        },
      ]),
    )
    expect(servers?.[0]?.urls).toBe('turns:turn.example.com:5349?transport=tcp')
  })

  it('parses multiple ICE servers (STUN + TURN + TURNS)', () => {
    const servers = parseIceServersJson(
      JSON.stringify([
        { urls: 'stun:stun.example.com:19302' },
        {
          urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
          username: 'user',
          credential: 'secret',
        },
      ]),
    )
    expect(servers).toHaveLength(2)
    expect(servers?.[1]?.username).toBe('user')
    expect(servers?.[1]?.credential).toBe('secret')
  })

  it('strips accidental credentials from STUN-only entries', () => {
    const servers = parseIceServersJson(
      JSON.stringify([
        {
          urls: 'stun:stun.example.com:19302',
          username: 'ignored',
          credential: 'ignored',
        },
      ]),
    )
    expect(servers).toEqual([{ urls: 'stun:stun.example.com:19302' }])
  })

  it('rejects malformed ICE config', () => {
    expect(parseIceServersJson('{')).toBeNull()
    expect(parseIceServersJson('[]')).toBeNull()
    expect(parseIceServersJson(JSON.stringify([{ urls: 1 }]))).toBeNull()
    expect(parseIceServersJson(JSON.stringify([{ urls: [] }]))).toBeNull()
    expect(
      parseIceServersJson(
        JSON.stringify([{ urls: 'turn:t.example', username: 'u' /* missing credential */ }]),
      ),
    ).toBeNull()
    expect(
      parseIceServersJson(
        JSON.stringify([{ urls: 'turn:t.example', username: 1, credential: 'secret' }]),
      ),
    ).toBeNull()
  })

  it('rejects non-STUN/TURN URL schemes', () => {
    expect(parseIceServersJson(JSON.stringify([{ urls: 'https://evil.example' }]))).toBeNull()
    expect(parseIceServersJson(JSON.stringify([{ urls: 'ws://signal.example' }]))).toBeNull()
    expect(parseIceServersJson(JSON.stringify([{ urls: 'stun:ok.example' }]))).not.toBeNull()
  })

  it('falls back to Google STUN when env is unset', () => {
    vi.stubEnv('VITE_ICE_SERVERS', '')
    expect(getIceServers()).toEqual([{ urls: 'stun:stun.l.google.com:19302' }])
    vi.unstubAllEnvs()
  })

  it('falls back safely when configured ICE JSON is invalid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('DEV', true)
    const servers = getIceServers('{"not":"an-array","credential":"super-secret-turn-pass"}')
    expect(servers).toEqual([{ urls: 'stun:stun.l.google.com:19302' }])
    expect(warn).toHaveBeenCalled()
    const message = String(warn.mock.calls[0]?.[0] ?? '')
    expect(message).toContain('VITE_ICE_SERVERS')
    expect(message).not.toContain('super-secret-turn-pass')
    warn.mockRestore()
    vi.unstubAllEnvs()
  })

  it('summarizes ICE config without exposing credentials', () => {
    const servers = parseIceServersJson(
      JSON.stringify([
        { urls: 'stun:stun.example.com' },
        {
          urls: ['turn:turn.example.com', 'turns:turn.example.com'],
          username: 'secret-user',
          credential: 'secret-pass',
        },
      ]),
    )!
    const summary = summarizeIceServers(servers, 'all')
    expect(summary.serverCount).toBe(2)
    expect(summary.stunCount).toBe(1)
    expect(summary.turnCount).toBe(1)
    expect(summary.turnsCount).toBe(1)
    expect(summary.hasCredentials).toBe(true)
    expect(summary.schemes).toEqual(expect.arrayContaining(['stun', 'turn', 'turns']))

    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain('secret-user')
    expect(serialized).not.toContain('secret-pass')
  })

  it('builds relay-compatible peer connection config for validation', () => {
    const config = createPeerConnectionConfig({
      iceServers: [
        {
          urls: 'turn:turn.example.com:3478',
          username: 'u',
          credential: 'p',
        },
      ],
      iceTransportPolicy: 'relay',
    })
    expect(config.iceTransportPolicy).toBe('relay')
    expect(config.iceServers).toHaveLength(1)
  })

  it('defaults iceTransportPolicy to all (natural ICE selection)', () => {
    vi.stubEnv('VITE_ICE_TRANSPORT_POLICY', '')
    expect(resolveIceTransportPolicy()).toBe('all')
    const config = createPeerConnectionConfig({
      iceServers: [{ urls: 'stun:stun.example.com' }],
    })
    expect(config.iceTransportPolicy).toBeUndefined()
    vi.unstubAllEnvs()
  })
})
