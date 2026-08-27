import type { ReactNode } from 'react'
import { NearbySendFlow } from '@/features/nearby-send'

/**
 * Single-route shell for the core product workflow.
 * No account, settings, or marketing routes in Phase 1.
 */
export function AppRoutes(): ReactNode {
  return <NearbySendFlow />
}
