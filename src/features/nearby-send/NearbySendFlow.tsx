import type { ReactNode } from 'react'
import { HomeScreen } from './HomeScreen'
import { NearbyDevicesScreen } from './NearbyDevicesScreen'
import { ConnectionScreen } from './ConnectionScreen'
import { LanDiagnosticsPanel } from './LanDiagnosticsPanel'
import { useNearbySend } from './useNearbySend'

export function NearbySendFlow(): ReactNode {
  const { ui } = useNearbySend()

  return (
    <>
      {ui.currentScreen === 'connecting' ? (
        <ConnectionScreen />
      ) : ui.currentScreen === 'nearby' ? (
        <NearbyDevicesScreen />
      ) : (
        <HomeScreen />
      )}
      <LanDiagnosticsPanel />
    </>
  )
}
