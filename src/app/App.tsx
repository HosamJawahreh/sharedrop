import type { ReactNode } from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRoutes } from './routes/AppRoutes'

export function App(): ReactNode {
  return (
    <AppProviders>
      <main className="app-shell">
        <AppRoutes />
      </main>
    </AppProviders>
  )
}
