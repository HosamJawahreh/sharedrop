import type { ReactNode } from 'react'
import { getDeviceIcon } from '@/core/device'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import { DiscoveryDiagnosticsPanel } from './DiscoveryDiagnosticsPanel'
import { ConnectionDiagnosticsPanel } from './ConnectionDiagnosticsPanel'
import { TransferPanel } from './TransferPanel'
import { TransferDiagnosticsPanel } from './TransferDiagnosticsPanel'
import { connectionSubtitle, connectionTitle } from './connection-ux-copy'
import './ConnectionScreen.css'

export function ConnectionScreen(): ReactNode {
  const {
    domain,
    ui,
    retryConnection,
    returnToNearby,
    goHome,
    saveCurrentPeer,
    savedDevicesService,
  } = useNearbySend()
  const { connectionState, connectingDevice } = domain
  const deviceName = connectingDevice?.displayName ?? 'device'
  const icon =
    connectingDevice != null
      ? getDeviceIcon(connectingDevice.platform, connectingDevice.deviceType)
      : '📱'
  const alreadySaved =
    connectingDevice != null ? savedDevicesService.get(connectingDevice.deviceId) !== null : false

  const isConnecting =
    connectionState === 'requesting' ||
    connectionState === 'connecting' ||
    connectionState === 'disconnecting'
  const isConnected = connectionState === 'connected'
  const isFailed = connectionState === 'failed'
  const isDisconnected = connectionState === 'disconnected'

  const uxState = isConnected
    ? 'connected'
    : isFailed
      ? 'failed'
      : isDisconnected
        ? 'disconnected'
        : 'connecting'

  const title = connectionTitle(uxState, deviceName, ui.connectionUserMessage)
  const subtitle = connectionSubtitle(uxState, ui.connectionUserMessage)

  return (
    <section className="connection-screen" aria-labelledby="connection-title">
      <header className="connection-screen__header">
        <Button
          variant="ghost"
          className="connection-screen__back"
          onClick={() => {
            void (isConnected || isFailed || isDisconnected ? returnToNearby() : goHome())
          }}
        >
          Back
        </Button>
      </header>

      <div className="connection-screen__body">
        <span className="connection-screen__icon" aria-hidden="true">
          {icon}
        </span>
        <h1 id="connection-title" className="connection-screen__title">
          {title}
        </h1>
        {subtitle ? (
          <p className="connection-screen__subtitle" role="status" aria-live="polite">
            {subtitle}
          </p>
        ) : null}

        {isConnecting ? (
          <div className="connection-screen__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {isConnected ? <TransferPanel /> : null}

        {isConnected && !alreadySaved ? (
          <Button
            variant="ghost"
            className="connection-screen__action"
            onClick={() => {
              saveCurrentPeer()
            }}
          >
            Save device
          </Button>
        ) : null}

        {isConnected && alreadySaved ? (
          <p className="connection-screen__saved" role="status">
            Saved device
          </p>
        ) : null}

        {isFailed ? (
          <Button
            className="connection-screen__action"
            onClick={() => {
              void retryConnection()
            }}
          >
            Try again
          </Button>
        ) : null}

        {isDisconnected ? (
          <Button
            variant="ghost"
            className="connection-screen__action"
            onClick={() => {
              void returnToNearby()
            }}
          >
            Return to nearby devices
          </Button>
        ) : null}
      </div>

      <DiscoveryDiagnosticsPanel />
      <ConnectionDiagnosticsPanel />
      <TransferDiagnosticsPanel />
    </section>
  )
}
