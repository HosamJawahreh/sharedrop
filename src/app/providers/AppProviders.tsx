import type { ReactNode } from 'react'
import { NearbySendProvider } from '@/features/nearby-send'

export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return <NearbySendProvider>{children}</NearbySendProvider>
}
