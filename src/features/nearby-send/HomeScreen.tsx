import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import { InstallPrompt } from './InstallPrompt'
import { DeviceCard } from './DeviceCard'
import { AirdropWave, PresenceWave } from './motion'
import './HomeScreen.css'
import './NearbyDevicesScreen.css'

function isSearching(state: string): boolean {
  return (
    state === 'starting' || state === 'connecting' || state === 'active' || state === 'reconnecting'
  )
}

export function HomeScreen(): ReactNode {
  const {
    domain,
    ui,
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
      return "Couldn't reach ShareDrop. Check your connection and try again."
    }
    if (domain.nearbyDevices.length > 0) {
      return `${domain.nearbyDevices.length} nearby`
    }
    if (searching && !ui.showNoDevicesHint) {
      return 'Looking for nearby devices…'
    }
    if (ui.showNoDevicesHint) {
      return 'No devices nearby'
    }
    return 'Starting…'
  })()

  return (
    <section className="home-screen" aria-labelledby="brand-title">
      <div className="home-screen__atmosphere" aria-hidden="true">
        <AirdropWave variant="ambient" />
      </div>
      <div className="home-screen__content">
        <header className="home-screen__hero">
          <h1 id="brand-title" className="home-screen__brand">
            ShareDrop
          </h1>
          <p className="home-screen__headline">Send files. Simply.</p>
          <p
            className={[
              'home-screen__status',
              searching && !hasAny ? 'home-screen__status--searching' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="status"
            aria-live="polite"
          >
            {searching && !hasAny && !ui.showNoDevicesHint ? (
              <span className="home-screen__status-pulse" aria-hidden="true" />
            ) : null}
            {statusMessage}
          </p>
        </header>

        <div className="home-screen__devices">
          {offlineDevice ? (
            <div className="nearby-screen__offline" role="status">
              <p className="nearby-screen__offline-title">This device is offline.</p>
              <p className="nearby-screen__offline-copy">
                {offlineDevice.displayName} is not available right now. Open ShareDrop on that
                device to connect.
              </p>
              <Button variant="ghost" onClick={clearOfflineSelection}>
                OK
              </Button>
            </div>
          ) : null}

          {hasSaved ? (
            <section className="nearby-screen__section" aria-labelledby="saved-devices-title">
              <h2 id="saved-devices-title" className="nearby-screen__section-title">
                Saved devices
              </h2>
              <ul className="nearby-screen__list" aria-label="Saved devices">
                {savedDevices.map((device, index) => {
                  const selected = ui.selectedDeviceId === device.deviceId
                  const online = device.presence === 'online'
                  return (
                    <li
                      key={device.deviceId}
                      className="sd-motion-device-enter"
                      style={{ animationDelay: `${index * 45}ms` }}
                    >
                      <div className="nearby-screen__device-row-wrap">
                        <DeviceCard
                          displayName={device.displayName}
                          platform={device.platform}
                          deviceType={device.deviceType}
                          available={online}
                          selected={selected}
                          badge="Saved"
                          onClick={() => {
                            void selectSavedDevice(device.deviceId)
                          }}
                        />
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

          <section className="nearby-screen__section" aria-labelledby="nearby-devices-title">
            <h2 id="nearby-devices-title" className="nearby-screen__section-title">
              Nearby devices
            </h2>
            {hasNearby ? (
              <ul className="nearby-screen__list" aria-label="Nearby devices">
                {unsavedNearbyDevices.map((device, index) => {
                  const selected = ui.selectedDeviceId === device.deviceId
                  return (
                    <li
                      key={device.deviceId}
                      className="sd-motion-device-enter"
                      style={{ animationDelay: `${index * 45}ms` }}
                    >
                      <DeviceCard
                        displayName={device.displayName}
                        platform={device.platform}
                        deviceType={device.deviceType}
                        selected={selected}
                        onClick={() => {
                          void connectToDevice(device.deviceId)
                        }}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {!hasAny && searching && !ui.showNoDevicesHint ? <PresenceWave /> : null}

            {!hasAny && ui.showNoDevicesHint ? (
              <div className="nearby-screen__empty">
                <p className="nearby-screen__empty-title">No devices nearby</p>
                <p className="nearby-screen__empty-copy">
                  Open ShareDrop on another device to appear here.
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <InstallPrompt />
      </div>
    </section>
  )
}
