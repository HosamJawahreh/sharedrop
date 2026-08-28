import type { CSSProperties, ReactNode } from 'react'

export interface TransferProgressRingProps {
  progress: number
  label: string
  /** Optional icon or glyph inside the ring */
  glyph?: string
}

export function TransferProgressRing({
  progress,
  label,
  glyph = '📄',
}: TransferProgressRingProps): ReactNode {
  const clamped = Math.min(1, Math.max(0, progress))
  const percent = Math.round(clamped * 100)

  return (
    <div
      className="transfer-ring"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={{ '--ring-progress': String(clamped) } as CSSProperties}
    >
      <div className="transfer-ring__glow" aria-hidden="true" />
      <div className="transfer-ring__outer" aria-hidden="true">
        <div className="transfer-ring__inner">
          <span className="transfer-ring__glyph" aria-hidden="true">
            {glyph}
          </span>
          <span className="transfer-ring__value">{percent}%</span>
        </div>
      </div>
    </div>
  )
}
