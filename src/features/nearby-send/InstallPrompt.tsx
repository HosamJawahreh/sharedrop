import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import './InstallPrompt.css'

export function InstallPrompt(): ReactNode {
  const { domain, installPwa, dismissInstallPrompt } = useNearbySend()
  const { pwa } = domain

  if (pwa.isStandalone || pwa.isInstalled) {
    return null
  }

  // Native install available
  if (pwa.canPromptInstall) {
    return (
      <aside className="install-prompt" aria-label="Install ShareDrop">
        <p className="install-prompt__message">Need Faster Transfer? Download To Your Device</p>
        <p className="install-prompt__detail">
          Install ShareDrop for faster access from your home screen.
        </p>
        <div className="install-prompt__actions">
          <Button
            className="install-prompt__cta"
            onClick={() => {
              void installPwa()
            }}
          >
            Install ShareDrop
          </Button>
          <Button variant="ghost" onClick={dismissInstallPrompt}>
            Not now
          </Button>
        </div>
      </aside>
    )
  }

  // Unsupported / no beforeinstallprompt — show honest tip if not dismissed.
  if (!pwa.showInstallHint) {
    return null
  }

  return (
    <aside className="install-prompt install-prompt--hint" aria-label="Install ShareDrop">
      <p className="install-prompt__message">Need Faster Transfer? Download To Your Device</p>
      <p className="install-prompt__detail">
        Add ShareDrop from your browser menu for faster access. Installation does not enable
        background transfers while the app is closed.
      </p>
      <div className="install-prompt__actions">
        <Button variant="ghost" onClick={dismissInstallPrompt}>
          Not now
        </Button>
      </div>
    </aside>
  )
}
