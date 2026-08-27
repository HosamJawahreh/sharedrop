import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { NearbyDevice } from '@/core/device'
import type { ConnectionEngine, ConnectionState } from '@/core/connection'
import type { DiscoveryEngine, DiscoveryState } from '@/core/discovery'
import type { TransferEngine, TransferProgressView } from '@/core/transfer'
import type { TransferDiagnostics } from '@/core/transfer/diagnostics'
import { NearbySendProvider } from './NearbySendProvider'
import { NearbySendFlow } from './NearbySendFlow'
import type { NearbySendStack } from './create-nearby-send-stack'
import { createSavedDevicesService } from '@/core/saved-devices'

function createMemoryStorage(): {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
} {
  const store = new Map<string, string>()
  return {
    getItem(key) {
      return store.get(key) ?? null
    },
    setItem(key, value) {
      store.set(key, value)
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

const IDLE_TRANSFER_PROGRESS: TransferProgressView = {
  sessionState: 'idle',
  role: null,
  files: [],
  totalBytes: 0,
  transferredBytes: 0,
  overallProgress: 0,
  bytesPerSecond: 0,
  etaSeconds: null,
  incomingRequest: null,
}

function createMockTransfer(): TransferEngine {
  let progress = { ...IDLE_TRANSFER_PROGRESS }
  const listeners = new Set<(value: TransferProgressView) => void>()
  let selectedFiles: File[] = []

  const emit = (): void => {
    for (const listener of listeners) listener(progress)
  }

  return {
    getProgress: () => progress,
    getReceivedFiles: () => [],
    setSelectedFiles(files) {
      selectedFiles = [...files]
      progress = {
        ...progress,
        sessionState: files.length > 0 ? 'preparing' : 'idle',
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        files: files.map((file, index) => ({
          fileId: `file_${index}`,
          name: file.name,
          size: file.size,
          bytesTransferred: 0,
          progress: 0,
          status: 'pending',
        })),
      }
      emit()
    },
    getSelectedFiles: () => selectedFiles,
    removeSelectedFile(index) {
      selectedFiles = selectedFiles.filter((_, i) => i !== index)
      this.setSelectedFiles(selectedFiles)
    },
    async sendPrepared() {
      progress = { ...progress, sessionState: 'completed', role: 'sender' }
      emit()
    },
    async acceptIncoming() {},
    async rejectIncoming() {},
    async cancel() {
      progress = { ...progress, sessionState: 'cancelled' }
      emit()
    },
    downloadReceivedFile() {},
    downloadAllReceived() {},
    reset() {
      progress = { ...IDLE_TRANSFER_PROGRESS }
      selectedFiles = []
      emit()
    },
    getDiagnostics(): TransferDiagnostics {
      return {
        sessionState: progress.sessionState,
        role: progress.role,
        bytesSent: 0,
        bytesReceived: 0,
        bufferedAmount: 0,
        bufferedAmountLowThreshold: null,
        peakBufferedAmount: 0,
        backpressurePauseCount: 0,
        transferStartedAt: null,
        transferCompletedAt: null,
        transferDurationMs: null,
        averageThroughputBytesPerSecond: null,
      }
    },
    subscribeProgress(listener) {
      listeners.add(listener)
      listener(progress)
      return () => listeners.delete(listener)
    },
    async start() {},
    stop() {},
  }
}

function createMockStack(
  devices: NearbyDevice[] = [],
  savedDevices = createSavedDevicesService(createMemoryStorage()),
): NearbySendStack {
  let discoveryState: DiscoveryState = 'idle'
  let connectionState: ConnectionState = 'idle'
  const deviceListeners = new Set<(devices: readonly NearbyDevice[]) => void>()
  const discoveryStateListeners = new Set<(state: DiscoveryState) => void>()
  const connectionStateListeners = new Set<(state: ConnectionState) => void>()
  const localDevice = {
    deviceId: 'dev_local',
    sessionId: 'ses_local',
    displayName: 'My Linux Laptop',
    deviceType: 'desktop' as const,
    platform: 'linux' as const,
    browser: 'Chrome',
  }

  const discovery: DiscoveryEngine = {
    async start() {
      discoveryState = 'active'
      for (const listener of discoveryStateListeners) listener(discoveryState)
      for (const listener of deviceListeners) listener(devices)
    },
    async stop() {
      discoveryState = 'stopped'
      for (const listener of discoveryStateListeners) listener(discoveryState)
      for (const listener of deviceListeners) listener([])
    },
    getNearbyDevices: () => devices,
    getLocalDevice: () => localDevice,
    updateDisplayName(displayName: string) {
      localDevice.displayName = displayName
    },
    subscribeToDevices(listener) {
      deviceListeners.add(listener)
      listener(devices)
      return () => deviceListeners.delete(listener)
    },
    subscribeToDiscoveryState(listener) {
      discoveryStateListeners.add(listener)
      listener(discoveryState)
      return () => discoveryStateListeners.delete(listener)
    },
  }

  const connection: ConnectionEngine = {
    listen: () => {},
    stopListening: () => {},
    async connect(_deviceId: string) {
      connectionState = 'connected'
      for (const listener of connectionStateListeners) listener(connectionState)
    },
    async disconnect() {
      connectionState = 'disconnected'
      for (const listener of connectionStateListeners) listener(connectionState)
    },
    async cancel() {
      connectionState = 'idle'
      for (const listener of connectionStateListeners) listener(connectionState)
    },
    getState: () => connectionState,
    getRemoteDeviceId: () => devices[0]?.deviceId ?? null,
    getTransferTransport: () => null,
    whenTransferTransportReady: async () => {
      throw new Error('Not available in mock')
    },
    async send() {},
    subscribe(listener) {
      connectionStateListeners.add(listener)
      listener(connectionState)
      return () => connectionStateListeners.delete(listener)
    },
    subscribeToMessages: () => () => {},
  }

  return {
    localDevice,
    signalingUrl: 'ws://localhost:8787',
    signalingClient: {
      connect: async () => {},
      disconnect: () => {},
      send: () => {},
      getState: () => 'connected' as const,
      subscribe: () => () => {},
    },
    discovery,
    connection,
    transfer: createMockTransfer(),
    savedDevices,
  }
}

describe('NearbySendFlow', () => {
  it('shows nearby devices and connects on selection', async () => {
    const stack = createMockStack([
      {
        deviceId: 'dev_remote',
        sessionId: 'ses_remote',
        displayName: 'My iPhone',
        deviceType: 'phone',
        platform: 'ios',
        browser: 'Safari',
        status: 'available',
        lastSeen: Date.now(),
      },
    ])

    render(
      <NearbySendProvider stack={stack}>
        <NearbySendFlow />
      </NearbySendProvider>,
    )

    expect(screen.getByText('Need Faster Transfer? Download To Your Device')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Send to nearby' }))
    expect(await screen.findByText('My iPhone')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nearby' })).toBeInTheDocument()
    expect(screen.getAllByText('Online').length).toBeGreaterThan(0)
    expect(
      screen.getByText((content, node) => {
        return Boolean(
          node?.classList.contains('nearby-screen__device-type') && content.includes('iPhone'),
        )
      }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /My iPhone/i }))
    expect(await screen.findByText(/Connected to My iPhone/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Select files' })).toBeInTheDocument()
    expect(screen.getByText(/Or drag files here/i)).toBeInTheDocument()
  })

  it('prioritizes saved devices and shows online/offline state', async () => {
    const storage = createMemoryStorage()
    const saved = createSavedDevicesService(storage)
    saved.upsert({
      deviceId: 'dev_saved',
      displayName: "Ahmed's iPhone",
      deviceType: 'phone',
      platform: 'ios',
    })

    const stack = createMockStack(
      [
        {
          deviceId: 'dev_saved',
          sessionId: 'ses_saved',
          displayName: "Ahmed's iPhone",
          deviceType: 'phone',
          platform: 'ios',
          browser: 'Safari',
          status: 'available',
          lastSeen: Date.now(),
        },
        {
          deviceId: 'dev_other',
          sessionId: 'ses_other',
          displayName: 'Office Laptop',
          deviceType: 'desktop',
          platform: 'linux',
          browser: 'Chrome',
          status: 'available',
          lastSeen: Date.now(),
        },
      ],
      saved,
    )

    render(
      <NearbySendProvider stack={stack}>
        <NearbySendFlow />
      </NearbySendProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Send to nearby' }))
    expect(await screen.findByRole('heading', { name: 'Your devices' })).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nearby' })).toBeInTheDocument()
    expect(screen.getByText('Office Laptop')).toBeInTheDocument()
    expect(screen.getByText(/Linux Laptop/)).toBeInTheDocument()
  })
})
