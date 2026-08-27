import { describe, expect, it } from 'vitest'
import { connectionSubtitle, connectionTitle, transferFailureCopy } from './connection-ux-copy'

describe('connection UX copy', () => {
  it('maps connected and connecting titles', () => {
    expect(connectionTitle('connected', "Ahmed's iPhone", null)).toBe(
      "Connected to Ahmed's iPhone ✓",
    )
    expect(connectionTitle('connecting', 'Office Laptop', null)).toBe(
      'Connecting to Office Laptop…',
    )
  })

  it('maps timeout and generic failures without technical jargon', () => {
    expect(connectionTitle('failed', 'Peer', 'Connection timed out.')).toBe('Connection timed out')
    expect(connectionSubtitle('failed', 'Connection timed out.')).toBe(
      'The device could not be reached in time.',
    )
    expect(connectionTitle('failed', 'Peer', "Couldn't connect to this device.")).toBe(
      'Unable to connect',
    )
    expect(connectionSubtitle('failed', null)).toBe('The device could not be reached.')
  })

  it('maps transfer failure and cancellation copy', () => {
    expect(transferFailureCopy('cancelled').title).toBe('Transfer cancelled')
    expect(transferFailureCopy('failed').title).toBe('Transfer failed')
  })
})
