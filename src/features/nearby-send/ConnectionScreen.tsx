import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import { TransferPanel } from './TransferPanel'
import { DeviceRoleCard } from './DeviceRoleCard'
import { connectionSubtitle, connectionTitle, resolveConnectionUxPhase } from './connection-ux-copy'
import { AirdropWave, ConnectionPulse, type ConnectionMotionPhase } from './motion'
import { useConnectionFlowSounds } from './ux/useFlowSounds'
import './ConnectionScreen.css'
import './DeviceRoleCard.css'

function connectionMotionPhase(
  phase: ReturnType<typeof resolveConnectionUxPhase>,
): ConnectionMotionPhase {
  if (phase === 'disconnected') return 'failed'
  return phase
}

export function ConnectionScreen(): ReactNode {
  const { domain, ui, retryConnection, returnToNearby, saveCurrentPeer, savedDevicesService } =
    useNearbySend()
  const { connectionState, connectingDevice, connectionRole } = domain
  const deviceName = connectingDevice?.displayName ?? 'device'
  useConnectionFlowSounds(connectionState)
  const alreadySaved =
    connectingDevice != null ? savedDevicesService.get(connectingDevice.deviceId) !== null : false

  const phase = resolveConnectionUxPhase(connectionState)
  const isConnected = connectionState === 'connected'
  const isFailed = connectionState === 'failed'
  const isDisconnected = connectionState === 'disconnected'
  const isConnecting = !isConnected && !isFailed && !isDisconnected

  const title = connectionTitle(phase, deviceName, ui.connectionUserMessage, connectionRole)
  const subtitle = connectionSubtitle(phase, deviceName, ui.connectionUserMessage, connectionRole)

  return (
    <section className="connection-screen" aria-labelledby="connection-title">
      <div className="connection-screen__atmosphere" aria-hidden="true">
        {isConnecting ? <AirdropWave variant="ambient" /> : null}
      </div>
      <header className="connection-screen__header">
        <Button
          variant="ghost"
          className="connection-screen__back"
          onClick={() => {
            void returnToNearby()
          }}
        >
          Back to devices
        </Button>
      </header>

      <div className="connection-screen__body">
        {connectingDevice && isConnecting ? (
          <div className="device-pair-visual" aria-hidden="true">
            <DeviceRoleCard
              compact
              displayName={domain.localDisplayName}
              platform={domain.localPlatform}
              deviceType={domain.localDeviceType}
              eyebrow="This device"
            />
            <ConnectionPulse phase={connectionMotionPhase(phase)} label="Connecting to" />
            <DeviceRoleCard
              compact
              displayName={connectingDevice.displayName}
              platform={connectingDevice.platform}
              deviceType={connectingDevice.deviceType}
            />
          </div>
        ) : null}

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
          <div className="connection-screen__actions">
            <Button
              variant="ghost"
              className="connection-screen__action"
              onClick={() => {
                saveCurrentPeer()
              }}
            >
              Save device
            </Button>
          </div>
        ) : null}

        {isConnected && alreadySaved ? (
          <p className="connection-screen__saved" role="status">
            Saved device
          </p>
        ) : null}

        {isFailed ? (
          <div className="connection-screen__actions">
            <Button
              className="connection-screen__action"
              onClick={() => {
                void retryConnection()
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {isDisconnected ? (
          <div className="connection-screen__actions">
            <Button
              variant="ghost"
              className="connection-screen__action"
              onClick={() => {
                void returnToNearby()
              }}
            >
              Back to devices
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
