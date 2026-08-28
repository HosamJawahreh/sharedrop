import type { ReactNode } from 'react'
import './SuccessMark.css'

export function SuccessMark(): ReactNode {
  return (
    <div className="success-mark" aria-hidden="true">
      <span className="success-mark__ring" />
      <span className="success-mark__check">✓</span>
    </div>
  )
}
