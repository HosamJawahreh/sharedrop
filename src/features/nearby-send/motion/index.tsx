import type { CSSProperties, ReactNode } from 'react'
import './motion.css'
import './airdrop-wave.css'

export { AirdropWave } from './AirdropWave'
export type { AirdropWaveProps } from './AirdropWave'

export type ConnectionMotionPhase = 'idle' | 'waiting' | 'connecting' | 'connected' | 'failed'

export function PresenceWave(): ReactNode {
  return (
    <div className="sd-motion-presence" aria-hidden="true">
      <span className="sd-motion-presence__ring" />
      <span className="sd-motion-presence__ring" />
      <span className="sd-motion-presence__ring" />
    </div>
  )
}

export interface ConnectionPulseProps {
  phase: ConnectionMotionPhase
  label?: string
}

export function ConnectionPulse({ phase, label }: ConnectionPulseProps): ReactNode {
  const active = phase === 'waiting' || phase === 'connecting'
  const trackClass = [
    'sd-motion-connection__track',
    phase === 'connected' ? 'sd-motion-connection__track--connected' : '',
    phase === 'failed' ? 'sd-motion-connection__track--failed' : '',
    active ? 'sd-motion-connection__track--active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="sd-motion-connection" data-motion-phase={phase} aria-hidden="true">
      <div className={trackClass}>
        {active ? <span className="sd-motion-connection__pulse" /> : null}
      </div>
      {label ? <span className="sd-motion-connection__label">{label}</span> : null}
    </div>
  )
}

export type TransferFlowDirection = 'out' | 'in'

export interface TransferFlowProps {
  direction: TransferFlowDirection
  /** Actual transfer progress 0–1 from runtime state. */
  progress: number
  active: boolean
}

export function TransferFlow({ direction, progress, active }: TransferFlowProps): ReactNode {
  if (!active) {
    return null
  }

  const clamped = Math.min(1, Math.max(0, progress))
  const useProgressPosition = progress > 0

  return (
    <div
      className={[
        'sd-motion-transfer',
        `sd-motion-transfer--${direction}`,
        useProgressPosition ? 'sd-motion-transfer--progress' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-motion-direction={direction}
      data-motion-progress={clamped.toFixed(3)}
      aria-hidden="true"
      style={
        {
          '--sd-transfer-progress': String(clamped),
          '--sd-transfer-distance': '3rem',
        } as CSSProperties
      }
    >
      <div className="sd-motion-transfer__track">
        <span className="sd-motion-transfer__packet" />
      </div>
    </div>
  )
}
