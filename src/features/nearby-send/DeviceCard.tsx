import type { ReactNode } from 'react'
import { getDeviceIcon } from '@/core/device'
import { peerCardLabels } from '@/core/device/device-presentation'
import type { DeviceType, Platform } from '@/core/device/types'
import './DeviceCard.css'

export interface DeviceCardProps {
  displayName: string
  platform: Platform
  deviceType: DeviceType
  available?: boolean
  selected?: boolean
  badge?: string
  onClick?: () => void
  className?: string
}

export function DeviceCard({
  displayName,
  platform,
  deviceType,
  available = true,
  selected = false,
  badge,
  onClick,
  className = '',
}: DeviceCardProps): ReactNode {
  const { name, typeLabel } = peerCardLabels({ displayName, platform, deviceType })
  const icon = getDeviceIcon(platform, deviceType)

  const content = (
    <>
      <span className="device-card__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="device-card__body">
        <span className="device-card__name">
          {name}
          {badge ? <span className="device-card__badge">{badge}</span> : null}
        </span>
        <span className="device-card__meta">
          <span
            className={[
              'device-card__presence',
              available ? 'device-card__presence--online' : 'device-card__presence--offline',
            ].join(' ')}
            aria-hidden="true"
          />
          {typeLabel}
          <span className="device-card__status">{available ? 'Available' : 'Offline'}</span>
        </span>
      </span>
      {onClick ? (
        <span className="device-card__chevron" aria-hidden="true">
          ›
        </span>
      ) : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={[
          'device-card',
          'sd-motion-device-select',
          selected ? 'device-card--selected' : '',
          !available ? 'device-card--offline' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={[
        'device-card',
        'device-card--static',
        !available ? 'device-card--offline' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {content}
    </div>
  )
}
