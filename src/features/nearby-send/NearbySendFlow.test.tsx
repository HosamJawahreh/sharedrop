import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NearbyDevice } from '@/core/device'
import type { ConnectionDiagnostics, ConnectionEngine, ConnectionState } from '@/core/connection'
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
  options?: { discoveryFails?: boolean },
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
    baseName: 'Linux PC',
    typeLabel: 'Linux PC',
  }

  const buildConnectionDiagnostics = (): ConnectionDiagnostics => ({
    state: connectionState,
    connectionSessionId: connectionState === 'connected' ? 'conn_test' : null,
    remoteDeviceId: devices[0]?.deviceId ?? null,
    iceConnectionState: null,
    peerConnectionState: null,
    dataChannelState: null,
    transferChannelState: null,
    role: connectionState === 'connected' ? 'offerer' : null,
    webRtcStats: null,
  })

  const connectionDiagnosticsListeners = new Set<(d: ConnectionDiagnostics) => void>()

  const discoveryStart = vi.fn(async () => {
    if (options?.discoveryFails) {
      discoveryState = 'failed'
      for (const listener of discoveryStateListeners) listener(discoveryState)
      throw new Error('signaling down')
    }
    discoveryState = 'active'
    for (const listener of discoveryStateListeners) listener(discoveryState)
    for (const listener of deviceListeners) listener(devices)
  })

  const connectionConnect = vi.fn(async (_deviceId: string) => {
    connectionState = 'connected'
    for (const listener of connectionStateListeners) listener(connectionState)
    for (const listener of connectionDiagnosticsListeners) listener(buildConnectionDiagnostics())
  })

  const discovery: DiscoveryEngine = {
    start: discoveryStart,
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
    connect: connectionConnect,
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
    getDiagnostics: () => buildConnectionDiagnostics(),
    subscribeToDiagnostics(listener) {
      connectionDiagnosticsListeners.add(listener)
      listener(buildConnectionDiagnostics())
      return () => connectionDiagnosticsListeners.delete(listener)
    },
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

describe('NearbySendFlow homepage discovery', () => {
  it('starts discovery immediately and shows online devices without a CTA', async () => {
    const stack = createMockStack([
      {
        deviceId: 'dev_remote',
        sessionId: 'ses_remote',
        displayName: 'Remote Device',
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

    expect(screen.getByRole('heading', { name: 'ShareDrop' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send to nearby' })).not.toBeInTheDocument()
    expect(screen.getByText('Send files. Simply.')).toBeInTheDocument()

    expect(await screen.findByText('Remote Device')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nearby devices' })).toBeInTheDocument()

    await waitFor(() => {
      expect(stack.discovery.start).toHaveBeenCalled()
    })

    await userEvent.click(screen.getByRole('button', { name: /Remote Device/i }))
    expect(await screen.findByRole('heading', { name: 'Ready to send' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Select files' })).toBeInTheDocument()
  })

  it('connects an online saved device and never requires same Wi‑Fi language', async () => {
    const storage = createMemoryStorage()
    const saved = createSavedDevicesService(storage)
    saved.upsert({
      deviceId: 'dev_saved',
      displayName: 'Travel Phone',
      deviceType: 'phone',
      platform: 'android',
    })

    const stack = createMockStack(
      [
        {
          deviceId: 'dev_saved',
          sessionId: 'ses_new_country',
          displayName: 'Travel Phone (renamed elsewhere)',
          deviceType: 'phone',
          platform: 'android',
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

    expect(await screen.findByRole('heading', { name: 'Saved devices' })).toBeInTheDocument()
    expect(screen.queryByText(/same Wi-Fi required/i)).not.toBeInTheDocument()
    const home = screen.getByRole('heading', { name: 'ShareDrop' }).closest('section')
    expect(home?.textContent?.toLowerCase()).not.toContain('signaling')
    expect(home?.textContent?.toLowerCase()).not.toMatch(/\bstun\b|\bturn\b|\bwebrtc\b/)
    expect(screen.getByText('Travel Phone (renamed elsewhere)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nearby devices' })).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /Travel Phone \(renamed elsewhere\).*Available/i }),
    )
    expect(stack.connection.connect).toHaveBeenCalledWith('dev_saved')
    expect(await screen.findByRole('heading', { name: 'Ready to send' })).toBeInTheDocument()
  })

  it('prioritizes saved devices, avoids duplicates, and keeps offline honest', async () => {
    const storage = createMemoryStorage()
    const saved = createSavedDevicesService(storage)
    saved.upsert({
      deviceId: 'dev_saved',
      displayName: "Ahmed's iPhone",
      deviceType: 'phone',
      platform: 'ios',
    })
    saved.upsert({
      deviceId: 'dev_offline',
      displayName: 'Office MacBook',
      deviceType: 'desktop',
      platform: 'macos',
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

    expect(await screen.findByRole('heading', { name: 'Saved devices' })).toBeInTheDocument()
    expect(screen.getAllByText('Saved').length).toBe(2)
    expect(screen.getByRole('heading', { name: 'Nearby devices' })).toBeInTheDocument()
    expect(screen.getByText('Office Laptop')).toBeInTheDocument()
    expect(screen.getByText("Ahmed's")).toBeInTheDocument()
    expect(screen.getByText('Office')).toBeInTheDocument()
    expect(screen.getAllByText("Ahmed's")).toHaveLength(1)

    const savedSection = screen.getByRole('heading', { name: 'Saved devices' }).closest('section')
    const nearbySection = screen.getByRole('heading', { name: 'Nearby devices' }).closest('section')
    expect(savedSection?.textContent).toContain("Ahmed's")
    expect(savedSection?.textContent).toContain('Office')
    expect(nearbySection?.textContent).toContain('Office Laptop')
    expect(nearbySection?.textContent).not.toContain("Ahmed's")

    await userEvent.click(screen.getByRole('button', { name: /Office.*Offline/i }))
    expect(await screen.findByText('This device is offline.')).toBeInTheDocument()
    expect(screen.getByText(/not available right now/i)).toBeInTheDocument()
    const offlineBanner = screen.getByText('This device is offline.').closest('div')
    expect(offlineBanner?.textContent?.toLowerCase()).not.toContain('signaling')
    expect(offlineBanner?.textContent?.toLowerCase()).not.toMatch(/\bstun\b|\bturn\b|\bwebrtc\b/)
    expect(stack.connection.connect).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Ready to send' })).not.toBeInTheDocument()
  })

  it('shows consumer-safe failure copy when discovery cannot start', async () => {
    const stack = createMockStack([], createSavedDevicesService(createMemoryStorage()), {
      discoveryFails: true,
    })

    render(
      <NearbySendProvider stack={stack}>
        <NearbySendFlow />
      </NearbySendProvider>,
    )

    expect(
      await screen.findByText("Couldn't reach ShareDrop. Check your connection and try again."),
    ).toBeInTheDocument()
    const home = screen.getByRole('heading', { name: 'ShareDrop' }).closest('section')
    expect(home?.textContent?.toLowerCase()).not.toContain('signaling')
    expect(home?.textContent?.toLowerCase()).not.toMatch(/\bstun\b|\bturn\b|\bwebrtc\b|\bice\b/)
  })
})
