import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import './DeviceNameSettings.css'

export function DeviceNameSettings(): ReactNode {
  const { ui, domain, updateDeviceName, closeDeviceSettings, forgetAllSavedDevices } =
    useNearbySend()
  const [name, setName] = useState(domain.localDisplayName)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!ui.showDeviceSettings) return null

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault()
    const result = updateDeviceName(name)
    if (!result.ok) {
      setSaved(false)
      if (result.reason === 'empty') setError('Enter a device name.')
      else if (result.reason === 'too_long') setError('Name must be 64 characters or fewer.')
      else setError('That name is not valid.')
      return
    }
    setError(null)
    setSaved(true)
    setName(result.value)
  }

  return (
    <div className="device-settings" role="dialog" aria-labelledby="device-settings-title">
      <div className="device-settings__panel">
        <header className="device-settings__header">
          <h2 id="device-settings-title" className="device-settings__title">
            Device name
          </h2>
          <Button variant="ghost" onClick={closeDeviceSettings}>
            Close
          </Button>
        </header>

        <p className="device-settings__hint">This name is visible to nearby ShareDrop users.</p>

        <form className="device-settings__form" onSubmit={onSubmit}>
          <label className="device-settings__label" htmlFor="device-name-input">
            Device name
          </label>
          <input
            id="device-name-input"
            className="device-settings__input"
            value={name}
            maxLength={64}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value)
              setSaved(false)
              setError(null)
            }}
          />
          {error ? (
            <p className="device-settings__error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="device-settings__ok" role="status">
              Name saved.
            </p>
          ) : null}
          <Button type="submit" className="device-settings__save">
            Save name
          </Button>
        </form>

        <div className="device-settings__this">
          <span className="device-settings__this-label">This device</span>
          <span className="device-settings__this-name">{domain.localDisplayName}</span>
        </div>

        <div className="device-settings__danger">
          <Button
            variant="ghost"
            onClick={() => {
              forgetAllSavedDevices()
            }}
          >
            Forget saved devices
          </Button>
        </div>
      </div>
    </div>
  )
}
