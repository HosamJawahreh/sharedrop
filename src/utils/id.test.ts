import { describe, expect, it } from 'vitest'
import { createId } from '@/utils/id'

describe('createId', () => {
  it('returns a prefixed unique-looking identifier', () => {
    const id = createId('device')
    expect(id.startsWith('device_')).toBe(true)
    expect(id.length).toBeGreaterThan('device_'.length)
  })
})
