import { describe, expect, it } from 'vitest'
import { loadConfig, isProductionEnv } from './config.js'
import { OriginPolicyError, resolveAllowedOrigins } from './origin-policy.js'
import { buildHealthPayload } from './health.js'

describe('production signaling configuration', () => {
  it('detects production from NODE_ENV or SHAREDROP_ENV', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' })).toBe(true)
    expect(isProductionEnv({ SHAREDROP_ENV: 'production' })).toBe(true)
    expect(isProductionEnv({ NODE_ENV: 'development' })).toBe(false)
  })

  it('defaults to wildcard origins only outside production', () => {
    expect(resolveAllowedOrigins(undefined, { isProduction: false })).toEqual(['*'])
    expect(resolveAllowedOrigins('*', { isProduction: false })).toEqual(['*'])
  })

  it('rejects wildcard origins in production', () => {
    expect(() => resolveAllowedOrigins('*', { isProduction: true })).toThrow(OriginPolicyError)
    expect(() => resolveAllowedOrigins(undefined, { isProduction: true })).toThrow(
      OriginPolicyError,
    )
  })

  it('parses explicit production origins', () => {
    expect(
      resolveAllowedOrigins('https://sharedrop.example, https://www.sharedrop.example', {
        isProduction: true,
      }),
    ).toEqual(['https://sharedrop.example', 'https://www.sharedrop.example'])
  })

  it('rejects lan and http origins in production', () => {
    expect(() => resolveAllowedOrigins('lan', { isProduction: true })).toThrow(OriginPolicyError)
    expect(() => resolveAllowedOrigins('http://sharedrop.example', { isProduction: true })).toThrow(
      OriginPolicyError,
    )
    expect(() =>
      resolveAllowedOrigins('https://sharedrop.example/app', { isProduction: true }),
    ).toThrow(OriginPolicyError)
  })

  it('loads tunable abuse limits from environment', () => {
    const config = loadConfig({
      env: {
        SIGNALING_PORT: '9001',
        SIGNALING_HOST: '127.0.0.1',
        SIGNALING_ALLOWED_ORIGINS: 'https://sharedrop.example',
        SIGNALING_MAX_CONNECTIONS: '42',
        SIGNALING_MAX_MESSAGES_PER_SECOND: '11',
        SIGNALING_MAX_MESSAGE_BYTES: '4096',
        SHAREDROP_VERSION: '0.11.0-test',
        NODE_ENV: 'production',
      },
    })
    expect(config.port).toBe(9001)
    expect(config.host).toBe('127.0.0.1')
    expect(config.allowedOrigins).toEqual(['https://sharedrop.example'])
    expect(config.maxConnections).toBe(42)
    expect(config.maxMessagesPerSecond).toBe(11)
    expect(config.maxMessageBytes).toBe(4096)
    expect(config.serverVersion).toBe('0.11.0-test')
    expect(config.isProduction).toBe(true)
  })

  it('uses development defaults outside production', () => {
    const config = loadConfig({
      env: {
        NODE_ENV: 'development',
      },
    })
    expect(config.port).toBe(8787)
    expect(config.host).toBe('0.0.0.0')
    expect(config.allowedOrigins).toEqual(['*'])
    expect(config.isProduction).toBe(false)
  })

  it('falls back safely on malformed numeric limits', () => {
    const config = loadConfig({
      env: {
        SIGNALING_PORT: 'nope',
        SIGNALING_MAX_CONNECTIONS: '-5',
        SIGNALING_MAX_MESSAGES_PER_SECOND: '0',
        SIGNALING_ALLOWED_ORIGINS: '*',
      },
    })
    expect(config.port).toBe(8787)
    expect(config.maxConnections).toBeGreaterThan(0)
    expect(config.maxMessagesPerSecond).toBeGreaterThan(0)
  })

  it('refuses to load production config without explicit origins', () => {
    expect(() =>
      loadConfig({
        env: {
          NODE_ENV: 'production',
        },
      }),
    ).toThrow(OriginPolicyError)
  })

  it('builds a minimal health payload', () => {
    const payload = buildHealthPayload({
      version: '0.11.0',
      startedAtMs: 1_000,
      connectionCount: 3,
      nowMs: 6_000,
    })
    expect(payload).toEqual({
      ok: true,
      service: 'sharedrop-signaling',
      version: '0.11.0',
      uptimeSeconds: 5,
      connections: 3,
    })
    expect(payload).not.toHaveProperty('devices')
    expect(payload).not.toHaveProperty('env')
    expect(payload).not.toHaveProperty('secrets')
  })
})
