import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import { InstallPrompt } from './InstallPrompt'
import { DeviceNameSettings } from './DeviceNameSettings'
import './HomeScreen.css'

export function HomeScreen(): ReactNode {
  const { startNearbySend, openDeviceSettings, domain } = useNearbySend()

  return (
    <section className="home-screen" aria-labelledby="brand-title">
      <div className="home-screen__atmosphere" aria-hidden="true" />
      <div className="home-screen__content">
        <h1 id="brand-title" className="home-screen__brand">
          ShareDrop
        </h1>
        <p className="home-screen__tagline">Send files nearby. No account. No upload.</p>
        <Button
          className="home-screen__cta"
          onClick={() => {
            void startNearbySend()
          }}
        >
          Send to nearby
        </Button>

        <InstallPrompt />

        <div className="home-screen__device">
          <span className="home-screen__device-label">This device</span>
          <button
            type="button"
            className="home-screen__device-name"
            onClick={openDeviceSettings}
            aria-label={`Rename this device, currently ${domain.localDisplayName}`}
          >
            {domain.localDisplayName}
          </button>
        </div>
      </div>
      <DeviceNameSettings />
    </section>
  )
}
