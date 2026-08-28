import type { ReactNode } from 'react'
import './airdrop-wave.css'

export interface AirdropWaveProps {
  variant?: 'ambient' | 'transfer'
  direction?: 'out' | 'in'
}

export function AirdropWave({
  variant = 'ambient',
  direction = 'out',
}: AirdropWaveProps): ReactNode {
  const transferClass =
    variant === 'transfer'
      ? direction === 'in'
        ? 'sd-airdrop-wave--transfer sd-airdrop-wave--transfer-in'
        : 'sd-airdrop-wave--transfer'
      : ''

  return (
    <div
      className={['sd-airdrop-wave', transferClass].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <span className="sd-airdrop-wave__ring" />
      <span className="sd-airdrop-wave__ring" />
      <span className="sd-airdrop-wave__ring" />
      <span className="sd-airdrop-wave__core" />
      {variant === 'transfer' ? <span className="sd-airdrop-wave__packet" /> : null}
    </div>
  )
}
