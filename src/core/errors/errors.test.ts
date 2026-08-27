import { describe, expect, it } from 'vitest'
import { DiscoveryError, isAppError, toUserFacingError } from '@/core/errors'

describe('error model', () => {
  it('keeps user and technical messages separate', () => {
    const error = new DiscoveryError({
      userMessage: 'Nearby discovery is not available yet.',
      technicalMessage: 'DiscoveryEngine implementation is deferred to Phase 2.',
    })

    expect(error.userMessage).toBe('Nearby discovery is not available yet.')
    expect(error.technicalMessage).toContain('Phase 2')
    expect(error.category).toBe('discovery')
    expect(isAppError(error)).toBe(true)
  })

  it('maps unknown failures without leaking raw jargon to users', () => {
    const mapped = toUserFacingError(
      'connection',
      "Couldn't connect to this device.",
      new Error('ICE negotiation failed'),
    )

    expect(mapped.category).toBe('connection')
    expect(mapped.userMessage).toBe("Couldn't connect to this device.")
    expect(mapped.technicalMessage).toBe('ICE negotiation failed')
  })
})
