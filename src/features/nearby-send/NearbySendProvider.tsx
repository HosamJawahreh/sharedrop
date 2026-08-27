import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sanitizeDisplayName, updateStoredDisplayName, type NearbyDevice } from '@/core/device'
import type { ConnectionDiagnostics, ConnectionState } from '@/core/connection'
import { type DiscoveryDiagnostics, type DiscoveryState } from '@/core/discovery'
import {
  dismissInstallPrompt as persistInstallDismissal,
  getPwaInstallState,
  markAppInstalled,
  wasAppInstalledMarked,
  wasInstallPromptDismissed,
} from '@/core/pwa'
import type { TransferProgressView } from '@/core/transfer'
import '@/e2e/share-drop-e2e-api'
import { createNearbySendStack, type NearbySendStack } from './create-nearby-send-stack'
import { NearbySendContext } from './nearby-send-context'
import {
  NO_DEVICES_HINT_DELAY_MS,
  type NearbySendController,
  type NearbySendDomainView,
  type NearbySendScreen,
  type NearbySendUiState,
} from './types'

export interface NearbySendProviderProps {
  children: ReactNode
  /** Injectable for tests. */
  stack?: NearbySendStack
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

interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isSearching(state: DiscoveryState): boolean {
  return (
    state === 'starting' || state === 'connecting' || state === 'active' || state === 'reconnecting'
  )
}

export function NearbySendProvider({ children, stack }: NearbySendProviderProps): ReactNode {
  const nearbyStack = useMemo(() => stack ?? createNearbySendStack(), [stack])
  const {
    discovery,
    connection,
    transfer,
    signalingClient,
    signalingUrl,
    savedDevices,
    localDevice,
  } = nearbyStack

  const [currentScreen, setCurrentScreen] = useState<NearbySendScreen>('home')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [offlineSelectedDeviceId, setOfflineSelectedDeviceId] = useState<string | null>(null)
  const [showDeviceSettings, setShowDeviceSettings] = useState(false)
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>('idle')
  const [nearbyDevices, setNearbyDevices] = useState<readonly NearbyDevice[]>([])
  const [savedDeviceList, setSavedDeviceList] = useState(() => savedDevices.list())
  const [discoveryDiagnostics, setDiscoveryDiagnostics] = useState<DiscoveryDiagnostics | null>(
    null,
  )
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [connectionUserMessage, setConnectionUserMessage] = useState<string | null>(null)
  const [connectionDiagnostics, setConnectionDiagnostics] = useState<ConnectionDiagnostics | null>(
    null,
  )
  const [transferProgress, setTransferProgress] =
    useState<TransferProgressView>(IDLE_TRANSFER_PROGRESS)
  const [noDevicesTimerReady, setNoDevicesTimerReady] = useState(false)
  const [noDevicesTimerGeneration, setNoDevicesTimerGeneration] = useState(0)
  const [localDisplayName, setLocalDisplayName] = useState(localDevice.displayName)
  const [deferredInstall, setDeferredInstall] = useState<BeforeInstallPromptEventLike | null>(null)
  const [installDismissed, setInstallDismissed] = useState(() => wasInstallPromptDismissed())
  const [appInstalled, setAppInstalled] = useState(() => wasAppInstalledMarked())
  const [installEventGeneration, setInstallEventGeneration] = useState(0)
  const canPromptInstall = deferredInstall !== null && !installDismissed && !appInstalled
  const pwaState = useMemo(
    () =>
      getPwaInstallState({
        canPromptInstall: deferredInstall !== null,
        installDismissed,
        appInstalled,
      }),
    // installEventGeneration forces refresh after appinstalled (standalone may change).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional generation bump
    [canPromptInstall, installDismissed, appInstalled, installEventGeneration],
  )

  useEffect(() => {
    return savedDevices.subscribe(setSavedDeviceList)
  }, [savedDevices])

  useEffect(() => {
    const onBeforeInstall = (event: Event): void => {
      event.preventDefault()
      setDeferredInstall(event as BeforeInstallPromptEventLike)
    }
    const onInstalled = (): void => {
      markAppInstalled()
      setAppInstalled(true)
      setDeferredInstall(null)
      setInstallEventGeneration((value) => value + 1)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    const handleConnectionState = (nextState: ConnectionState): void => {
      setConnectionState(nextState)
      if (nextState === 'requesting' || nextState === 'connecting' || nextState === 'connected') {
        setCurrentScreen((screen) => (screen === 'nearby' ? 'connecting' : screen))
        const remoteId = connection.getRemoteDeviceId()
        if (remoteId) {
          setSelectedDeviceId((current) => current ?? remoteId)
        }
      }

      if (nextState === 'connected') {
        const remoteId = connection.getRemoteDeviceId()
        if (remoteId && savedDevices.get(remoteId)) {
          const peer = discovery.getNearbyDevices().find((device) => device.deviceId === remoteId)
          if (peer) {
            // Refresh last-connected timestamp if already saved; do not auto-save unknowns.
            savedDevices.upsert({
              deviceId: peer.deviceId,
              displayName: peer.displayName,
              deviceType: peer.deviceType,
              platform: peer.platform,
              connectedAt: Date.now(),
              lastSeenAt: peer.lastSeen,
            })
          }
        }
      }
    }

    const unsubscribers = [
      discovery.subscribeToDevices(setNearbyDevices),
      discovery.subscribeToDiscoveryState(setDiscoveryState),
      discovery.subscribeToDiagnostics?.(setDiscoveryDiagnostics),
      connection.subscribe(handleConnectionState),
      connection.subscribeToDiagnostics?.(setConnectionDiagnostics),
      transfer.subscribeProgress(setTransferProgress),
    ].filter(Boolean)

    connection.listen()

    return () => {
      for (const unsub of unsubscribers) {
        unsub?.()
      }
      connection.stopListening()
      transfer.stop()
      void connection.cancel()
      void discovery.stop()
    }
  }, [discovery, connection, transfer, savedDevices])

  useEffect(() => {
    if (connectionState !== 'connected') {
      transfer.stop()
      return
    }

    void transfer.start()
  }, [connectionState, transfer])

  useEffect(() => {
    if (currentScreen !== 'nearby' || nearbyDevices.length > 0 || !isSearching(discoveryState)) {
      return
    }

    const timer = setTimeout(() => {
      setNoDevicesTimerReady(true)
    }, NO_DEVICES_HINT_DELAY_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [currentScreen, nearbyDevices.length, discoveryState, noDevicesTimerGeneration])

  const savedDeviceViews = savedDevices.withPresence(nearbyDevices)
  const unsavedNearbyDevices = savedDevices.unsavedNearby(nearbyDevices)
  // Touch savedDeviceList so React re-renders when persistence subscribers fire.
  void savedDeviceList

  const showNoDevicesHint =
    currentScreen === 'nearby' &&
    nearbyDevices.length === 0 &&
    savedDeviceViews.length === 0 &&
    (noDevicesTimerReady || !isSearching(discoveryState))

  const connectingDevice = useMemo(() => {
    if (!selectedDeviceId) return null
    const nearby = nearbyDevices.find((device) => device.deviceId === selectedDeviceId)
    if (nearby) return nearby
    const saved = savedDeviceViews.find((device) => device.deviceId === selectedDeviceId)
    if (!saved) return null
    return {
      deviceId: saved.deviceId,
      sessionId: '',
      displayName: saved.displayName,
      deviceType: saved.deviceType,
      platform: saved.platform,
      browser: '',
      status: 'unreachable' as const,
      lastSeen: saved.lastSeenAt,
    }
  }, [nearbyDevices, savedDeviceViews, selectedDeviceId])

  const goHome = useCallback(async () => {
    transfer.reset()
    await connection.cancel()
    setCurrentScreen('home')
    setSelectedDeviceId(null)
    setOfflineSelectedDeviceId(null)
    setNoDevicesTimerReady(false)
    await discovery.stop()
  }, [connection, discovery, transfer])

  const startNearbySend = useCallback(async () => {
    setSelectedDeviceId(null)
    setOfflineSelectedDeviceId(null)
    setNoDevicesTimerReady(false)
    setNoDevicesTimerGeneration((value) => value + 1)
    setCurrentScreen('nearby')
    try {
      await discovery.start()
    } catch {
      // DiscoveryEngine already transitions to `failed` with a safe user message.
      // Swallow so UI stays on nearby without unhandled rejections or leaked internals.
    }
  }, [discovery])

  const returnToNearby = useCallback(async () => {
    transfer.reset()
    await connection.cancel()
    setSelectedDeviceId(null)
    setOfflineSelectedDeviceId(null)
    setCurrentScreen('nearby')
  }, [connection, transfer])

  const connectToDevice = useCallback(
    async (deviceId: string) => {
      setOfflineSelectedDeviceId(null)
      setSelectedDeviceId(deviceId)
      setConnectionUserMessage(null)
      setCurrentScreen('connecting')
      try {
        await connection.connect(deviceId)
        setConnectionUserMessage(null)
      } catch (error) {
        // Connection state transitions to failed; capture safe copy for UX.
        const message =
          error && typeof error === 'object' && 'userMessage' in error
            ? String((error as { userMessage: unknown }).userMessage)
            : 'Unable to connect'
        setConnectionUserMessage(message)
      }
    },
    [connection],
  )

  const selectSavedDevice = useCallback(
    async (deviceId: string) => {
      const online = nearbyDevices.some((device) => device.deviceId === deviceId)
      if (!online) {
        setOfflineSelectedDeviceId(deviceId)
        setSelectedDeviceId(deviceId)
        return
      }
      await connectToDevice(deviceId)
    },
    [nearbyDevices, connectToDevice],
  )

  const clearOfflineSelection = useCallback(() => {
    setOfflineSelectedDeviceId(null)
    setSelectedDeviceId(null)
  }, [])

  const retryConnection = useCallback(async () => {
    if (!selectedDeviceId) return
    await connection.cancel()
    await connectToDevice(selectedDeviceId)
  }, [connection, connectToDevice, selectedDeviceId])

  const selectFiles = useCallback(
    (files: readonly File[]) => {
      transfer.setSelectedFiles(files)
    },
    [transfer],
  )

  const removeSelectedFile = useCallback(
    (index: number) => {
      transfer.removeSelectedFile(index)
    },
    [transfer],
  )

  const sendFiles = useCallback(async () => {
    await transfer.sendPrepared()
  }, [transfer])

  const acceptIncomingTransfer = useCallback(async () => {
    await transfer.acceptIncoming()
  }, [transfer])

  const rejectIncomingTransfer = useCallback(async () => {
    await transfer.rejectIncoming()
  }, [transfer])

  const cancelTransfer = useCallback(async () => {
    await transfer.cancel()
  }, [transfer])

  const saveReceivedFiles = useCallback(() => {
    transfer.downloadAllReceived()
  }, [transfer])

  const resetTransfer = useCallback(() => {
    transfer.reset()
  }, [transfer])

  const saveCurrentPeer = useCallback((): boolean => {
    const remoteId = connection.getRemoteDeviceId() ?? selectedDeviceId
    if (!remoteId) return false
    const peer =
      nearbyDevices.find((device) => device.deviceId === remoteId) ??
      discovery.getNearbyDevices().find((device) => device.deviceId === remoteId)
    if (!peer) return false
    const saved = savedDevices.upsert({
      deviceId: peer.deviceId,
      displayName: peer.displayName,
      deviceType: peer.deviceType,
      platform: peer.platform,
      connectedAt: Date.now(),
      lastSeenAt: peer.lastSeen,
    })
    return saved !== null
  }, [connection, selectedDeviceId, nearbyDevices, discovery, savedDevices])

  const renameSavedDevice = useCallback(
    (deviceId: string, displayName: string): boolean => {
      return savedDevices.rename(deviceId, displayName) !== null
    },
    [savedDevices],
  )

  const removeSavedDevice = useCallback(
    (deviceId: string) => {
      savedDevices.remove(deviceId)
    },
    [savedDevices],
  )

  const forgetAllSavedDevices = useCallback(() => {
    savedDevices.forgetAll()
  }, [savedDevices])

  const openDeviceSettings = useCallback(() => {
    setShowDeviceSettings(true)
  }, [])

  const closeDeviceSettings = useCallback(() => {
    setShowDeviceSettings(false)
  }, [])

  const updateDeviceName = useCallback(
    (displayName: string): { ok: true; value: string } | { ok: false; reason: string } => {
      const sanitized = sanitizeDisplayName(displayName)
      if (!sanitized.ok) {
        return { ok: false, reason: sanitized.reason }
      }
      updateStoredDisplayName(sanitized.value)
      discovery.updateDisplayName(sanitized.value)
      setLocalDisplayName(sanitized.value)
      return { ok: true, value: sanitized.value }
    },
    [discovery],
  )

  const installPwa = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredInstall) return 'unavailable'
    await deferredInstall.prompt()
    const choice = await deferredInstall.userChoice
    setDeferredInstall(null)
    return choice.outcome
  }, [deferredInstall])

  const dismissInstallPrompt = useCallback(() => {
    persistInstallDismissal()
    setInstallDismissed(true)
    setDeferredInstall(null)
  }, [])

  const ui = useMemo<NearbySendUiState>(
    () => ({
      currentScreen,
      selectedDeviceId,
      showNoDevicesHint,
      offlineSelectedDeviceId,
      showDeviceSettings,
      connectionUserMessage,
    }),
    [
      currentScreen,
      selectedDeviceId,
      showNoDevicesHint,
      offlineSelectedDeviceId,
      showDeviceSettings,
      connectionUserMessage,
    ],
  )

  const domain = useMemo<NearbySendDomainView>(
    () => ({
      discoveryState,
      nearbyDevices,
      savedDevices: savedDeviceViews,
      unsavedNearbyDevices,
      discoveryDiagnostics,
      connectionState,
      connectionDiagnostics,
      connectingDevice,
      transferProgress,
      localDisplayName,
      pwa: pwaState,
    }),
    [
      discoveryState,
      nearbyDevices,
      savedDeviceViews,
      unsavedNearbyDevices,
      discoveryDiagnostics,
      connectionState,
      connectionDiagnostics,
      connectingDevice,
      transferProgress,
      localDisplayName,
      pwaState,
    ],
  )

  const value = useMemo<NearbySendController>(
    () => ({
      ui,
      domain,
      signalingUrl,
      goHome,
      startNearbySend,
      connectToDevice,
      selectSavedDevice,
      clearOfflineSelection,
      retryConnection,
      returnToNearby,
      selectFiles,
      removeSelectedFile,
      sendFiles,
      acceptIncomingTransfer,
      rejectIncomingTransfer,
      cancelTransfer,
      saveReceivedFiles,
      resetTransfer,
      saveCurrentPeer,
      renameSavedDevice,
      removeSavedDevice,
      forgetAllSavedDevices,
      openDeviceSettings,
      closeDeviceSettings,
      updateDeviceName,
      installPwa,
      dismissInstallPrompt,
      discovery,
      connection,
      transfer,
      signalingClient,
      savedDevicesService: savedDevices,
    }),
    [
      ui,
      domain,
      signalingUrl,
      goHome,
      startNearbySend,
      connectToDevice,
      selectSavedDevice,
      clearOfflineSelection,
      retryConnection,
      returnToNearby,
      selectFiles,
      removeSelectedFile,
      sendFiles,
      acceptIncomingTransfer,
      rejectIncomingTransfer,
      cancelTransfer,
      saveReceivedFiles,
      resetTransfer,
      saveCurrentPeer,
      renameSavedDevice,
      removeSavedDevice,
      forgetAllSavedDevices,
      openDeviceSettings,
      closeDeviceSettings,
      updateDeviceName,
      installPwa,
      dismissInstallPrompt,
      discovery,
      connection,
      transfer,
      signalingClient,
      savedDevices,
    ],
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const connectPeer = connectToDevice

    window.__sharedropE2E = {
      getLocalDeviceId: () => discovery.getLocalDevice().deviceId,
      getLocalDisplayName: () => discovery.getLocalDevice().displayName,
      getNearbyDevices: () =>
        discovery.getNearbyDevices().map((device) => ({
          deviceId: device.deviceId,
          displayName: device.displayName,
        })),
      getSavedDevices: () =>
        savedDevices.withPresence(discovery.getNearbyDevices()).map((device) => ({
          deviceId: device.deviceId,
          displayName: device.displayName,
          presence: device.presence,
        })),
      async connectToDevice(deviceId: string) {
        await connectPeer(deviceId)
      },
      saveCurrentPeer: () => saveCurrentPeer(),
      async setDeviceName(name: string) {
        updateDeviceName(name)
      },
      getPwaState: () => ({
        isStandalone: pwaState.isStandalone,
        canPromptInstall: pwaState.canPromptInstall,
        displayMode: pwaState.displayMode,
      }),
      getTransferProgress: () => transfer.getProgress(),
      getTransferDiagnostics: () => transfer.getDiagnostics(),
      getConnectionState: () => connection.getState(),
      getConnectionDiagnostics: () => connection.getDiagnostics?.() ?? null,
      async refreshConnectionDiagnostics() {
        await connection.refreshDiagnostics?.()
      },
      async getReceivedFileSnapshots() {
        const files = transfer.getReceivedFiles()
        return Promise.all(
          files.map(async (file) => ({
            fileId: file.fileId,
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
            sha256: file.sha256,
            bytes: Array.from(new Uint8Array(await file.blob.arrayBuffer())),
          })),
        )
      },
      getReceivedFileSummaries() {
        return transfer.getReceivedFiles().map((file) => ({
          fileId: file.fileId,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          sha256: file.sha256,
        }))
      },
      async disconnect() {
        await connection.disconnect()
      },
      async stopNearby() {
        await goHome()
      },
    }

    return () => {
      delete window.__sharedropE2E
    }
  }, [
    connection,
    connectToDevice,
    discovery,
    goHome,
    transfer,
    savedDevices,
    saveCurrentPeer,
    updateDeviceName,
    pwaState,
  ])

  return <NearbySendContext.Provider value={value}>{children}</NearbySendContext.Provider>
}
