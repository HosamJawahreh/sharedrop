import type { ReactNode } from 'react'
import type { DeviceType, Platform } from '@/core/device'
import { DeviceRoleCard } from './DeviceRoleCard'
import './TransferStage.css'

export interface TransferStageProps {
  localName: string
  localPlatform: Platform
  localDeviceType: DeviceType
  remoteName: string
  remotePlatform: Platform
  remoteDeviceType: DeviceType
  direction: 'out' | 'in'
  active: boolean
}

export function TransferStage({
  localName,
  localPlatform,
  localDeviceType,
  remoteName,
  remotePlatform,
  remoteDeviceType,
  direction,
  active,
}: TransferStageProps): ReactNode {
  return (
    <div
      className={[
        'transfer-stage',
        active ? 'transfer-stage--active' : '',
        `transfer-stage--${direction}`,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <DeviceRoleCard
        compact
        displayName={direction === 'out' ? localName : remoteName}
        platform={direction === 'out' ? localPlatform : remotePlatform}
        deviceType={direction === 'out' ? localDeviceType : remoteDeviceType}
      />
      <div className="transfer-stage__beam">
        <span className="transfer-stage__beam-track" />
        <span className="transfer-stage__beam-pulse" />
        <span className="transfer-stage__beam-packet">📄</span>
      </div>
      <DeviceRoleCard
        compact
        displayName={direction === 'out' ? remoteName : localName}
        platform={direction === 'out' ? remotePlatform : localPlatform}
        deviceType={direction === 'out' ? remoteDeviceType : localDeviceType}
      />
    </div>
  )
}
