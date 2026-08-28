import { createLocalDeviceInfo, type LocalDeviceInfo } from '@/core/device'
import { createWebRTCConnectionEngine, type ConnectionEngine } from '@/core/connection'
import { createDiscoveryEngine, type DiscoveryEngine } from '@/core/discovery'
import {
  createSavedDevicesService,
  type SavedDevicesService,
  type SavedDevicesStorage,
} from '@/core/saved-devices'
import { createSignalingClient, type SignalingClient } from '@/core/signaling/signaling-client'
import { resolveSignalingUrl } from '@/core/signaling/resolve-signaling-url'
import { createTransferEngine, type TransferEngine } from '@/core/transfer'
import type { DeviceIdentityStorage } from '@/core/device'

export interface NearbySendStack {
  localDevice: LocalDeviceInfo
  signalingUrl: string
  signalingClient: SignalingClient
  discovery: DiscoveryEngine
  connection: ConnectionEngine
  transfer: TransferEngine
  savedDevices: SavedDevicesService
}

export interface NearbySendStackOptions {
  signalingUrl?: string
  signalingClient?: SignalingClient
  localDevice?: LocalDeviceInfo
  savedDevices?: SavedDevicesService
  identityStorage?: DeviceIdentityStorage | null
  savedDevicesStorage?: SavedDevicesStorage | null
}

function resolveStackSignalingUrl(override?: string): string {
  return resolveSignalingUrl({
    override,
    configuredUrl: import.meta.env.VITE_SIGNALING_URL,
    strictConfiguredUrl: import.meta.env.PROD,
  })
}

/** Creates shared signaling, discovery, and connection engines for the nearby-send flow. */
export function createNearbySendStack(options: NearbySendStackOptions = {}): NearbySendStack {
  const localDevice =
    options.localDevice ??
    createLocalDeviceInfo(
      options.identityStorage !== undefined ? { storage: options.identityStorage } : {},
    )
  const signalingUrl = resolveStackSignalingUrl(options.signalingUrl)
  const signalingClient =
    options.signalingClient ??
    createSignalingClient({
      url: signalingUrl,
      autoReconnect: true,
    })

  const discovery = createDiscoveryEngine({
    localDevice,
    signalingClient,
    signalingUrl,
  })

  const connection = createWebRTCConnectionEngine({
    localDevice,
    signalingClient,
  })

  const transfer = createTransferEngine({
    connection,
    localDevice,
  })

  const savedDevices =
    options.savedDevices ?? createSavedDevicesService(options.savedDevicesStorage)

  return {
    localDevice,
    signalingUrl,
    signalingClient,
    discovery,
    connection,
    transfer,
    savedDevices,
  }
}
