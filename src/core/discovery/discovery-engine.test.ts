import { describe, expect, it, vi } from 'vitest'
import { createDiscoveryEngine } from '@/core/discovery/discovery-engine'
import type { SignalingClient } from '@/core/signaling/signaling-client'

function createHarness() {
  const listeners = new Map<string, Set<(payload?: unknown) => void>>()

  const client: SignalingClient = {
    async connect() {
      emit('open')
    },
    disconnect: vi.fn(),
    send: vi.fn(),
    getState: () => 'connected',
    subscribe(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener as (payload?: unknown) => void)
      return () => listeners.get(event)?.delete(listener as (payload?: unknown) => void)
    },
  }

  function emit(event: string, payload?: unknown) {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload)
    }
  }

  return { client, emit }
}

describe('createDiscoveryEngine', () => {
  it('starts and reaches active state', async () => {
    const { client } = createHarness()
    const engine = createDiscoveryEngine({
      signalingUrl: 'ws://localhost:8787',
      createSignalingClient: (_options) => client,
    })

    const states: string[] = []
    engine.subscribeToDiscoveryState((state) => states.push(state))

    await engine.start()

    expect(states).toContain('active')
  })

  it('stops cleanly', async () => {
    const { client } = createHarness()
    const engine = createDiscoveryEngine({
      signalingUrl: 'ws://localhost:8787',
      createSignalingClient: (_options) => client,
    })

    await engine.start()
    await engine.stop()

    expect(client.disconnect).toHaveBeenCalled()
    expect(engine.getNearbyDevices()).toHaveLength(0)
  })
})
