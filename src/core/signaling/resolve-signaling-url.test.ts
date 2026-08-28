import { describe, expect, it } from 'vitest'
import {
  isProductionSignalingUrl,
  resolveSignalingUrl,
  resolveWebAppOrigin,
} from './resolve-signaling-url'

describe('resolveSignalingUrl', () => {
  it('uses override when provided', () => {
    expect(resolveSignalingUrl({ override: 'ws://example.test:9999' })).toBe(
      'ws://example.test:9999',
    )
  })

  it('uses configured env URL when provided', () => {
    expect(
      resolveSignalingUrl({
        configuredUrl: 'wss://signal.example.com',
        location: { protocol: 'https:', hostname: 'app.example.com' },
      }),
    ).toBe('wss://signal.example.com')
  })

  it('rejects non-WebSocket signaling URLs', () => {
    expect(() => resolveSignalingUrl({ configuredUrl: 'https://signal.example.com' })).toThrow(
      /wss:\/\//,
    )
  })

  it('rejects malformed signaling URLs', () => {
    expect(() => resolveSignalingUrl({ configuredUrl: 'not a url' })).toThrow(/valid ws:\/\//)
    expect(() => resolveSignalingUrl({ configuredUrl: 'ftp://signal.example' })).toThrow(/ws:\/\//)
  })

  it('flags production-ready signaling URLs', () => {
    expect(isProductionSignalingUrl('wss://signal.example.com')).toBe(true)
    expect(isProductionSignalingUrl('ws://localhost:8787')).toBe(false)
  })

  it('derives ws URL from LAN web host without hardcoding IP', () => {
    expect(
      resolveSignalingUrl({
        location: { protocol: 'http:', hostname: '192.168.1.25' },
      }),
    ).toBe('ws://192.168.1.25:8787')
  })

  it('derives ws URL for localhost development', () => {
    expect(
      resolveSignalingUrl({
        location: { protocol: 'http:', hostname: 'localhost' },
      }),
    ).toBe('ws://localhost:8787')
  })

  it('uses wss same-origin /ws path when page is served over https', () => {
    expect(
      resolveSignalingUrl({
        location: { protocol: 'https:', hostname: 'app.example.com' },
      }),
    ).toBe('wss://app.example.com/ws')
  })

  it('rejects explicit ws:// when the page is HTTPS', () => {
    expect(() =>
      resolveSignalingUrl({
        configuredUrl: 'ws://signal.example.com:8787',
        location: { protocol: 'https:', hostname: 'app.example.com' },
      }),
    ).toThrow(/wss:\/\//)
  })

  it('allows explicit ws:// on HTTP development pages', () => {
    expect(
      resolveSignalingUrl({
        configuredUrl: 'ws://192.168.1.25:8787',
        location: { protocol: 'http:', hostname: '192.168.1.25' },
      }),
    ).toBe('ws://192.168.1.25:8787')
  })

  it('ignores loopback VITE_SIGNALING_URL when the page is opened from a LAN host', () => {
    expect(
      resolveSignalingUrl({
        configuredUrl: 'ws://localhost:8787',
        location: { protocol: 'http:', hostname: '192.168.100.205' },
      }),
    ).toBe('ws://192.168.100.205:8787')
  })

  it('honors configured URL in production strict mode (no LAN loopback override)', () => {
    expect(
      resolveSignalingUrl({
        configuredUrl: 'wss://signal.example.com',
        location: { protocol: 'https:', hostname: '192.168.100.205' },
        strictConfiguredUrl: true,
      }),
    ).toBe('wss://signal.example.com')
  })

  it('falls back to localhost for SSR/tests', () => {
    expect(resolveSignalingUrl({})).toBe('ws://localhost:8787')
  })
})

describe('resolveWebAppOrigin', () => {
  it('builds origin from location', () => {
    expect(resolveWebAppOrigin({ protocol: 'http:', hostname: '192.168.1.25', port: '5173' })).toBe(
      'http://192.168.1.25:5173',
    )
  })
})
