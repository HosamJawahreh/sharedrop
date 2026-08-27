import { resolveSignalingUrl } from '@/core/signaling/resolve-signaling-url'
import { createLocalDeviceInfo, type LocalDeviceInfo } from '@/core/device'
import type { NearbyDevice } from '@/core/device'
import { DiscoveryError } from '@/core/errors'
import { createPresenceService } from '@/core/signaling/presence-service'
import { createSignalingClient } from '@/core/signaling/signaling-client'
import type {
  DevicesListener,
  DiagnosticsListener,
  DiscoveryDiagnostics,
  DiscoveryEngine,
  DiscoveryEngineOptions,
  DiscoveryState,
  DiscoveryStateListener,
} from './types'

function resolveDiscoverySignalingUrl(override?: string): string {
  return resolveSignalingUrl({
    override,
    configuredUrl: import.meta.env.VITE_SIGNALING_URL,
  })
}

export function createDiscoveryEngine(options: DiscoveryEngineOptions = {}): DiscoveryEngine {
  const localDevice = options.localDevice ?? createLocalDeviceInfo()
  const signalingUrl = resolveDiscoverySignalingUrl(options.signalingUrl)

  let state: DiscoveryState = 'idle'
  let reconnectAttempt = 0
  let heartbeatActive = false
  let registered = false
  let connected = false
  let ownsSignalingClient = false

  const deviceListeners = new Set<DevicesListener>()
  const stateListeners = new Set<DiscoveryStateListener>()
  const diagnosticsListeners = new Set<DiagnosticsListener>()

  const client =
    options.signalingClient ??
    (options.createSignalingClient ?? createSignalingClient)({
      url: signalingUrl,
      autoReconnect: true,
      onReconnectAttempt: (attempt) => {
        reconnectAttempt = attempt
        if (state === 'active' || state === 'connecting') {
          setState('reconnecting')
        }
        emitDiagnostics()
      },
    })

  if (!options.signalingClient) {
    ownsSignalingClient = true
  }

  const presence = createPresenceService({ client, localDevice })

  const setState = (next: DiscoveryState): void => {
    state = next
    for (const listener of stateListeners) {
      listener(state)
    }
    emitDiagnostics()
  }

  const getDiagnostics = (): DiscoveryDiagnostics => ({
    connected,
    registered,
    nearbyCount: presence.getNearbyDevices().length,
    heartbeatActive,
    localDeviceId: localDevice.deviceId,
    reconnectAttempt,
    signalingUrl,
  })

  const emitDiagnostics = (): void => {
    const diagnostics = getDiagnostics()
    for (const listener of diagnosticsListeners) {
      listener(diagnostics)
    }
  }

  const notifyDevices = (devices: readonly NearbyDevice[]): void => {
    for (const listener of deviceListeners) {
      listener(devices)
    }
    emitDiagnostics()
  }

  if (ownsSignalingClient) {
    client.subscribe('open', () => {
      connected = true
      reconnectAttempt = 0
      if (state === 'connecting' || state === 'reconnecting' || state === 'starting') {
        setState('active')
      }
      emitDiagnostics()
    })

    client.subscribe('close', () => {
      connected = false
      registered = false
      heartbeatActive = false
      emitDiagnostics()
    })
  } else {
    client.subscribe('open', () => {
      connected = true
      reconnectAttempt = 0
      emitDiagnostics()
    })

    client.subscribe('close', () => {
      connected = false
      registered = false
      heartbeatActive = false
      emitDiagnostics()
    })
  }

  presence.subscribe((devices) => {
    registered = presence.isRegistered()
    heartbeatActive = registered && connected
    notifyDevices(devices)
  })

  return {
    async start(): Promise<void> {
      if (state === 'active' || state === 'starting' || state === 'connecting') {
        return
      }

      try {
        setState('starting')
        setState('connecting')
        if (client.getState() !== 'connected') {
          await client.connect()
        }
        if (client.getState() !== 'connected') {
          await new Promise<void>((resolve, reject) => {
            if (client.getState() === 'connected') {
              resolve()
              return
            }

            const timeout = setTimeout(() => {
              unsub()
              reject(new Error('Signaling connection timed out'))
            }, 15_000)

            const unsub = client.subscribe('open', () => {
              clearTimeout(timeout)
              unsub()
              resolve()
            })
          })
        }
        connected = client.getState() === 'connected'
        await presence.start()
        registered = presence.isRegistered()
        heartbeatActive = registered && connected
        setState('active')
      } catch (error) {
        setState('failed')
        throw new DiscoveryError({
          userMessage:
            'Could not reach the signaling service. Check your connection and try again.',
          technicalMessage:
            error instanceof Error ? error.message : 'Unknown discovery start error',
          cause: error,
        })
      }
    },

    async stop(): Promise<void> {
      if (state === 'idle' || state === 'stopped' || state === 'stopping') {
        return
      }

      setState('stopping')
      await presence.stop()
      if (ownsSignalingClient) {
        client.disconnect()
      }
      connected = false
      registered = false
      heartbeatActive = false
      reconnectAttempt = 0
      notifyDevices([])
      setState('stopped')
    },

    getNearbyDevices(): readonly NearbyDevice[] {
      return presence.getNearbyDevices()
    },

    getLocalDevice(): LocalDeviceInfo {
      return localDevice
    },

    updateDisplayName(displayName: string): void {
      localDevice.displayName = displayName
      presence.updateDisplayName(displayName)
    },

    subscribeToDevices(listener: DevicesListener): () => void {
      deviceListeners.add(listener)
      listener(presence.getNearbyDevices())
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

    subscribeToDiagnostics(listener: DiagnosticsListener): () => void {
      diagnosticsListeners.add(listener)
      listener(getDiagnostics())
      return () => {
        diagnosticsListeners.delete(listener)
      }
    },
  }
}
