import type { ConnectionDiagnostics, ConnectionState } from '@/core/connection'
import type { NearbyDevice } from '@/core/device'
import type { TransferDiagnostics } from '@/core/transfer/diagnostics'
import type { TransferProgressView } from '@/core/transfer'

/** Serialized received file for browser evaluate() boundaries. */
export interface E2EReceivedFileSnapshot {
  fileId: string
  name: string
  size: number
  mimeType: string
  sha256: string
  bytes: number[]
}

export interface E2EReceivedFileSummary {
  fileId: string
  name: string
  size: number
  mimeType: string
  sha256: string
}

export interface ShareDropE2EApi {
  getLocalDeviceId(): string
  getLocalDisplayName(): string
  getNearbyDevices(): readonly Pick<NearbyDevice, 'deviceId' | 'displayName'>[]
  getSavedDevices(): readonly { deviceId: string; displayName: string; presence: string }[]
  connectToDevice(deviceId: string): Promise<void>
  saveCurrentPeer(): boolean
  setDeviceName(name: string): void
  getPwaState(): { isStandalone: boolean; canPromptInstall: boolean; displayMode: string }
  getTransferProgress(): TransferProgressView
  getTransferDiagnostics(): TransferDiagnostics
  getConnectionState(): ConnectionState
  getConnectionDiagnostics(): ConnectionDiagnostics | null
  refreshConnectionDiagnostics(): Promise<void>
  getReceivedFileSnapshots(): Promise<E2EReceivedFileSnapshot[]>
  /** Integrity metadata without byte arrays — use for large-file e2e. */
  getReceivedFileSummaries(): E2EReceivedFileSummary[]
  disconnect(): Promise<void>
  stopNearby(): Promise<void>
}

declare global {
  interface Window {
    __sharedropE2E?: ShareDropE2EApi
  }
}

export async function snapshotReceivedFiles(
  api: ShareDropE2EApi,
): Promise<E2EReceivedFileSnapshot[]> {
  return api.getReceivedFileSnapshots()
}
