import type { ReactNode } from 'react'

/** DEV-only collapsed shell so diagnostics never look like consumer product UI. */
export function DevDiagnostics({
  label = 'Developer diagnostics',
  children,
}: {
  label?: string
  children: ReactNode
}): ReactNode {
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <details className="dev-diagnostics">
      <summary>{label}</summary>
      <div className="dev-diagnostics__body">{children}</div>
    </details>
  )
}
