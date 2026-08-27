import type { NearbyDevice, LocalDeviceInfo } from '@/core/device'
import { DiscoveryError } from '@/core/errors'
import type {
  DevicesListener,
  DiscoveryEngine,
  DiscoveryState,
  DiscoveryStateListener,
} from './types'

/**
 * Phase 1 stub: honest empty discovery.
 * Does not invent devices or simulate network activity.
 * Phase 2 will replace this with real nearby discovery.
 */
export function createNullDiscoveryEngine(): DiscoveryEngine {
  let state: DiscoveryState = 'idle'
  const devices: NearbyDevice[] = []
  const deviceListeners = new Set<DevicesListener>()
  const stateListeners = new Set<DiscoveryStateListener>()

  const setState = (next: DiscoveryState): void => {
    state = next
    for (const listener of stateListeners) {
      listener(state)
    }
  }

  return {
    async start(): Promise<void> {
      if (state === 'active' || state === 'starting') {
        return
      }

      setState('starting')
      // Discovery transport is not implemented in Phase 1.
      setState('active')
    },

    async stop(): Promise<void> {
      if (state === 'idle' || state === 'stopped' || state === 'stopping') {
        return
      }

      setState('stopping')
      setState('stopped')
    },

    getNearbyDevices(): readonly NearbyDevice[] {
      return devices
    },

    getLocalDevice(): LocalDeviceInfo {
      return {
        deviceId: 'null_device',
        sessionId: 'null_session',
        displayName: 'Device',
        deviceType: 'unknown',
        platform: 'unknown',
        browser: 'Browser',
      }
    },

    updateDisplayName(): void {
      // Null engine has no presence registration.
    },

    subscribeToDevices(listener: DevicesListener): () => void {
      deviceListeners.add(listener)
      listener(devices)
      return () => {
        deviceListeners.delete(listener)
      }
    },

    subscribeToDiscoveryState(listener: DiscoveryStateListener): () => void {
      stateListeners.add(listener)
      listener(state)
      return () => {
        stateListeners.delete(listener)
      }
    },
  }
}

/** Explicit guard for callers that require a real discovery backend. */
export function assertDiscoveryImplemented(_engine: DiscoveryEngine): never {
  throw new DiscoveryError({
    userMessage: 'Nearby discovery is not available yet.',
    technicalMessage: 'DiscoveryEngine implementation is deferred to Phase 2.',
  })
}
