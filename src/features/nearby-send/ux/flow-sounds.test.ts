import { describe, expect, it, vi } from 'vitest'
import { playFlowSound, primeFlowAudio } from './flow-sounds'

describe('flow sounds', () => {
  it('does not throw when audio is unavailable', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(() => playFlowSound('connected')).not.toThrow()
    expect(() => playFlowSound('connecting')).not.toThrow()
    expect(() => playFlowSound('transfer_tick')).not.toThrow()
  })

  it('primeFlowAudio does not throw', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(() => primeFlowAudio()).not.toThrow()
  })
})
