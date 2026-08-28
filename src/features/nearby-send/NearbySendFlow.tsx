import type { ReactNode } from 'react'
import { HomeScreen } from './HomeScreen'
import { ConnectionScreen } from './ConnectionScreen'
import { useNearbySend } from './useNearbySend'

export function NearbySendFlow(): ReactNode {
  const { ui } = useNearbySend()

  return ui.currentScreen === 'connecting' ? <ConnectionScreen /> : <HomeScreen />
}
