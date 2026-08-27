import { PROTOCOL } from '../shared/protocol.js'

export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; windowStart: number }>()
  private readonly maxPerSecond: number

  constructor(maxPerSecond: number = PROTOCOL.MAX_MESSAGES_PER_SECOND) {
    this.maxPerSecond = maxPerSecond
  }

  allow(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key)
    if (!bucket || now - bucket.windowStart >= 1000) {
      this.buckets.set(key, { count: 1, windowStart: now })
      return true
    }

    if (bucket.count >= this.maxPerSecond) {
      return false
    }

    bucket.count += 1
    return true
  }

  remove(key: string): void {
    this.buckets.delete(key)
  }
}
