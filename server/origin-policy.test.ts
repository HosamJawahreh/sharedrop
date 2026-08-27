import { describe, expect, it } from 'vitest'
import { isOriginAllowed, isPrivateNetworkOrigin, resolveAllowedOrigins } from './origin-policy.js'

describe('origin-policy', () => {
  it('allows private LAN origins when configured with lan', () => {
    expect(isOriginAllowed('http://192.168.1.25:5173', ['lan'])).toBe(true)
    expect(isOriginAllowed('http://10.0.0.5:5173', ['lan'])).toBe(true)
    expect(isOriginAllowed('http://localhost:5173', ['lan'])).toBe(true)
  })

  it('rejects public origins when only lan is configured', () => {
    expect(isOriginAllowed('https://example.com', ['lan'])).toBe(false)
  })

  it('allows explicit origin matches', () => {
    expect(isOriginAllowed('http://192.168.1.25:5173', ['http://192.168.1.25:5173'])).toBe(true)
    expect(isOriginAllowed('https://sharedrop.example', ['https://sharedrop.example'])).toBe(true)
  })

  it('rejects unknown origins when an allowlist is configured', () => {
    expect(isOriginAllowed('https://evil.example', ['https://sharedrop.example'])).toBe(false)
    expect(isOriginAllowed('https://sharedrop.example', ['https://other.example'])).toBe(false)
  })

  it('allows wildcard only when configured', () => {
    expect(isOriginAllowed('https://evil.example', ['*'])).toBe(true)
    expect(isOriginAllowed(undefined, ['*'])).toBe(true)
    expect(isOriginAllowed(undefined, ['https://sharedrop.example'])).toBe(false)
  })

  it('detects private network origins for LAN development', () => {
    expect(isPrivateNetworkOrigin('http://192.168.0.10:5173')).toBe(true)
    expect(isPrivateNetworkOrigin('http://172.16.1.1:5173')).toBe(true)
    expect(isPrivateNetworkOrigin('https://example.com')).toBe(false)
  })

  it('keeps development wildcard defaults outside production', () => {
    expect(resolveAllowedOrigins(undefined, { isProduction: false })).toEqual(['*'])
    expect(resolveAllowedOrigins('lan', { isProduction: false })).toEqual(['lan'])
  })
})
