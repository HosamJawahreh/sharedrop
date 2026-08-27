import { describe, expect, it, vi } from 'vitest'
import { createNullDiscoveryEngine } from '@/core/discovery'

describe('createNullDiscoveryEngine', () => {
  it('starts and reports active without inventing devices', async () => {
    const engine = createNullDiscoveryEngine()
    const states: string[] = []

    engine.subscribeToDiscoveryState((state) => {
      states.push(state)
    })

    await engine.start()

    expect(engine.getNearbyDevices()).toEqual([])
    expect(states).toContain('starting')
    expect(states).toContain('active')
  })

  it('notifies subscribers when discovery stops', async () => {
    const engine = createNullDiscoveryEngine()
    const listener = vi.fn()

    engine.subscribeToDiscoveryState(listener)
    await engine.start()
    await engine.stop()

    expect(listener).toHaveBeenCalledWith('stopped')
    expect(engine.getNearbyDevices()).toHaveLength(0)
  })
})
