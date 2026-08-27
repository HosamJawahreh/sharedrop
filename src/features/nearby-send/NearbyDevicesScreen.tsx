import type { ReactNode } from 'react'
import { deviceTypeLabel, getDeviceIcon } from '@/core/device'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import { DiscoveryDiagnosticsPanel } from './DiscoveryDiagnosticsPanel'
import './NearbyDevicesScreen.css'

function isSearching(state: string): boolean {
  return (
    state === 'starting' || state === 'connecting' || state === 'active' || state === 'reconnecting'
  )
}

export function NearbyDevicesScreen(): ReactNode {
  const {
    domain,
    ui,
    goHome,
    connectToDevice,
    selectSavedDevice,
    clearOfflineSelection,
    removeSavedDevice,
  } = useNearbySend()
  const { unsavedNearbyDevices, savedDevices, discoveryState } = domain
  const hasSaved = savedDevices.length > 0
  const hasNearby = unsavedNearbyDevices.length > 0
  const hasAny = hasSaved || hasNearby || domain.nearbyDevices.length > 0
  const searching = isSearching(discoveryState)

  const offlineDevice = ui.offlineSelectedDeviceId
    ? (savedDevices.find((device) => device.deviceId === ui.offlineSelectedDeviceId) ?? null)
    : null

  const statusMessage = (() => {
    if (discoveryState === 'failed') {
      return 'Could not reach the signaling service. Check your connection and try again.'
    }
    if (domain.nearbyDevices.length > 0) {
      return `${domain.nearbyDevices.length} device${domain.nearbyDevices.length === 1 ? '' : 's'} available`
    }
    if (searching && !ui.showNoDevicesHint) {
      return 'Finding available devices…'
    }
    if (ui.showNoDevicesHint) {
      return 'No available devices found yet.'
    }
    return 'Starting discovery…'
  })()

  return (
    <section className="nearby-screen" aria-labelledby="nearby-title">
      <header className="nearby-screen__header">
        <Button variant="ghost" className="nearby-screen__back" onClick={goHome}>
          Back
        </Button>
        <h1 id="nearby-title" className="nearby-screen__title">
          Nearby devices
        </h1>
        <p className="nearby-screen__status" role="status" aria-live="polite">
          {statusMessage}
        </p>
        <p className="nearby-screen__subtitle">
          Available ShareDrop devices — same network or elsewhere
        </p>
      </header>

      <div className="nearby-screen__body">
        {offlineDevice ? (
          <div className="nearby-screen__offline" role="status">
            <p className="nearby-screen__offline-title">Device went offline</p>
            <p className="nearby-screen__offline-copy">
              {offlineDevice.displayName} is saved, but it is not available right now. Keep
              ShareDrop open on that device and it will appear Online automatically.
            </p>
            <Button variant="ghost" onClick={clearOfflineSelection}>
              OK
            </Button>
          </div>
        ) : null}

        {searching && !hasAny && !ui.showNoDevicesHint ? (
          <div className="nearby-screen__loading" aria-hidden="true">
            <span className="nearby-screen__spinner" />
          </div>
        ) : null}

        {hasSaved ? (
          <section className="nearby-screen__section" aria-labelledby="saved-devices-title">
            <h2 id="saved-devices-title" className="nearby-screen__section-title">
              Your devices
            </h2>
            <ul className="nearby-screen__list" aria-label="Your devices">
              {savedDevices.map((device) => {
                const selected = ui.selectedDeviceId === device.deviceId
                const icon = getDeviceIcon(device.platform, device.deviceType)
                const type = deviceTypeLabel(device.deviceType, device.platform)
                const online = device.presence === 'online'
                return (
                  <li key={device.deviceId}>
                    <div
                      className={[
                        'nearby-screen__device',
                        'nearby-screen__device--saved',
                        selected ? 'nearby-screen__device--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <button
                        type="button"
                        className="nearby-screen__device-main"
                        onClick={() => {
                          void selectSavedDevice(device.deviceId)
                        }}
                      >
                        <span className="nearby-screen__device-row">
                          <span className="nearby-screen__device-icon" aria-hidden="true">
                            {icon}
                          </span>
                          <span className="nearby-screen__device-info">
                            <span className="nearby-screen__device-name">
                              <span aria-hidden="true">⭐ </span>
                              {device.displayName}
                              <span className="nearby-screen__saved-badge">Saved</span>
                            </span>
                            <span className="nearby-screen__device-status">
                              <span
                                className={
                                  online
                                    ? 'nearby-screen__presence nearby-screen__presence--online'
                                    : 'nearby-screen__presence nearby-screen__presence--offline'
                                }
                                aria-hidden="true"
                              >
                                {online ? '🟢' : '⚪'}
                              </span>
                              {online ? 'Online' : 'Offline'}
                              <span className="nearby-screen__device-type"> · {type}</span>
                            </span>
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="nearby-screen__forget"
                        aria-label={`Remove ${device.displayName}`}
                        onClick={() => {
                          removeSavedDevice(device.deviceId)
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {hasNearby ? (
          <section className="nearby-screen__section" aria-labelledby="nearby-devices-title">
            <h2 id="nearby-devices-title" className="nearby-screen__section-title">
              Nearby
            </h2>
            <ul className="nearby-screen__list" aria-label="Nearby devices">
              {unsavedNearbyDevices.map((device) => {
                const selected = ui.selectedDeviceId === device.deviceId
                const icon = getDeviceIcon(device.platform, device.deviceType)
                const type = deviceTypeLabel(device.deviceType, device.platform)
                return (
                  <li key={device.deviceId}>
                    <button
                      type="button"
                      className={[
                        'nearby-screen__device',
                        selected ? 'nearby-screen__device--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        void connectToDevice(device.deviceId)
                      }}
                    >
                      <span className="nearby-screen__device-row">
                        <span className="nearby-screen__device-icon" aria-hidden="true">
                          {icon}
                        </span>
                        <span className="nearby-screen__device-info">
                          <span className="nearby-screen__device-name">{device.displayName}</span>
                          <span className="nearby-screen__device-status">
                            <span
                              className="nearby-screen__presence nearby-screen__presence--online"
                              aria-hidden="true"
                            >
                              🟢
                            </span>
                            Online
                            <span className="nearby-screen__device-type"> · {type}</span>
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {!hasAny && ui.showNoDevicesHint ? (
          <div className="nearby-screen__empty">
            <p className="nearby-screen__empty-title">No available devices found</p>
            <p className="nearby-screen__empty-copy">
              Keep ShareDrop open on both devices. Devices can be on the same Wi‑Fi or different
              networks.
            </p>
          </div>
        ) : null}
      </div>

      <DiscoveryDiagnosticsPanel />
    </section>
  )
}
