import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionPulse, PresenceWave, TransferFlow } from './index'

describe('ShareDrop motion primitives', () => {
  it('renders presence wave without blocking interaction semantics', () => {
    const { container } = render(<PresenceWave />)
    expect(container.querySelector('.sd-motion-presence')).toBeTruthy()
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it('reflects connection phase in data attribute', () => {
    const { rerender } = render(<ConnectionPulse phase="connecting" label="Connecting to" />)
    expect(screen.getByText('Connecting to')).toBeInTheDocument()
    expect(document.querySelector('[data-motion-phase="connecting"]')).toBeTruthy()

    rerender(<ConnectionPulse phase="connected" />)
    expect(document.querySelector('[data-motion-phase="connected"]')).toBeTruthy()
    expect(document.querySelector('.sd-motion-connection__pulse')).toBeNull()

    rerender(<ConnectionPulse phase="failed" />)
    expect(document.querySelector('.sd-motion-connection__pulse')).toBeNull()
  })

  it('uses actual transfer progress for packet position', () => {
    render(<TransferFlow direction="out" progress={0.42} active />)
    const flow = document.querySelector('.sd-motion-transfer')
    expect(flow).toHaveAttribute('data-motion-progress', '0.420')
    expect(flow).toHaveClass('sd-motion-transfer--progress')
  })

  it('does not render transfer flow when inactive', () => {
    render(<TransferFlow direction="in" progress={0} active={false} />)
    expect(document.querySelector('.sd-motion-transfer')).toBeNull()
  })
})
