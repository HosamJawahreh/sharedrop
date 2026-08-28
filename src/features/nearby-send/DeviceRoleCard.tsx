import type { ReactNode } from 'react'
import type { DeviceType, Platform } from '@/core/device'
import { deviceTypeLabel, getDeviceIcon } from '@/core/device'
import './DeviceRoleCard.css'

export interface DeviceRoleCardProps {
  displayName: string
  platform: Platform
  deviceType: DeviceType
  /** e.g. "This device", "Ready to receive" */
  eyebrow?: string
  status?: string
  compact?: boolean
  className?: string
}

export function DeviceRoleCard({
  displayName,
  platform,
  deviceType,
  eyebrow,
  status,
  compact = false,
  className = '',
}: DeviceRoleCardProps): ReactNode {
  const icon = getDeviceIcon(platform, deviceType)
  const typeLabel = deviceTypeLabel(deviceType, platform)

  return (
    <div
      className={['device-role-card', compact ? 'device-role-card--compact' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="device-role-card__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="device-role-card__info">
        {eyebrow ? <span className="device-role-card__eyebrow">{eyebrow}</span> : null}
        <span className="device-role-card__name">{displayName}</span>
        <span className="device-role-card__meta">
          {status ? <span className="device-role-card__status">{status}</span> : null}
          {status ? <span aria-hidden="true"> · </span> : null}
          {typeLabel}
        </span>
      </div>
    </div>
  )
}
