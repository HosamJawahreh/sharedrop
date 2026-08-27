import { useContext } from 'react'
import { NearbySendContext } from './nearby-send-context'
import type { NearbySendController } from './types'

export function useNearbySend(): NearbySendController {
  const context = useContext(NearbySendContext)
  if (!context) {
    throw new Error('useNearbySend must be used within NearbySendProvider')
  }
  return context
}
