import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rate-limiter.js'

describe('RateLimiter', () => {
  it('allows messages under the per-second budget', () => {
    const limiter = new RateLimiter(3)
    const now = 1_000
    expect(limiter.allow('c1', now)).toBe(true)
    expect(limiter.allow('c1', now + 10)).toBe(true)
    expect(limiter.allow('c1', now + 20)).toBe(true)
  })

  it('rejects when the per-second budget is exceeded', () => {
    const limiter = new RateLimiter(2)
    const now = 5_000
    expect(limiter.allow('c1', now)).toBe(true)
    expect(limiter.allow('c1', now + 1)).toBe(true)
    expect(limiter.allow('c1', now + 2)).toBe(false)
  })

  it('resets the window after one second', () => {
    const limiter = new RateLimiter(1)
    expect(limiter.allow('c1', 10_000)).toBe(true)
    expect(limiter.allow('c1', 10_500)).toBe(false)
    expect(limiter.allow('c1', 11_000)).toBe(true)
  })

  it('tracks keys independently', () => {
    const limiter = new RateLimiter(1)
    const now = 20_000
    expect(limiter.allow('a', now)).toBe(true)
    expect(limiter.allow('b', now)).toBe(true)
    expect(limiter.allow('a', now + 1)).toBe(false)
    expect(limiter.allow('b', now + 1)).toBe(false)
  })

  it('forgets a key after remove', () => {
    const limiter = new RateLimiter(1)
    const now = 30_000
    expect(limiter.allow('c1', now)).toBe(true)
    expect(limiter.allow('c1', now + 1)).toBe(false)
    limiter.remove('c1')
    expect(limiter.allow('c1', now + 2)).toBe(true)
  })
})
