import { describe, expect, it } from 'vitest'
import {
  connectionSubtitle,
  connectionTitle,
  resolveConnectionUxPhase,
  transferFailureCopy,
} from './connection-ux-copy'

describe('connection UX copy', () => {
  it('maps connection phases to human-readable titles', () => {
    expect(connectionTitle('connected', "Ahmed's iPhone", null, 'offerer')).toBe('Ready to send')
    expect(connectionTitle('connected', "Ahmed's iPhone", null, 'answerer')).toBe(
      'Ready to receive',
    )
    expect(connectionTitle('connecting', 'Office Laptop', null)).toBe('Connecting to Office Laptop')
    expect(connectionTitle('waiting', 'Office Laptop', null)).toBe('Connecting to Office Laptop')
    expect(resolveConnectionUxPhase('requesting')).toBe('waiting')
    expect(resolveConnectionUxPhase('connecting')).toBe('connecting')
  })

  it('maps timeout and generic failures without technical jargon', () => {
    expect(connectionTitle('failed', 'Travel Phone', 'Connection timed out.')).toBe(
      'The connection took too long.',
    )
    expect(connectionSubtitle('failed', 'Travel Phone', 'Connection timed out.')).toBe(
      'Please try again.',
    )
    expect(connectionTitle('failed', 'Travel Phone', "Couldn't connect to this device.")).toBe(
      "Couldn't connect to Travel Phone.",
    )
    expect(connectionSubtitle('failed', 'Travel Phone', null)).toBe(
      'Check that ShareDrop is open on the other device, then try again.',
    )
  })

  it('maps offline and disconnected failures without nearby or Wi‑Fi claims', () => {
    expect(connectionTitle('failed', 'Peer', 'Device offline')).toBe(
      'This device is currently offline.',
    )
    expect(connectionTitle('disconnected', 'Peer', null)).toBe('Connection was lost.')
    expect(connectionSubtitle('connected', 'My iPhone', null, 'answerer')).toBe(
      'My iPhone is connected',
    )
    expect(connectionSubtitle('disconnected', 'Peer', null)).toBe(
      'Return to nearby devices to connect again.',
    )
    expect(connectionSubtitle('disconnected', 'Peer', null)?.toLowerCase()).not.toMatch(/wi-?fi/)
  })

  it('maps transfer failure and cancellation copy', () => {
    expect(transferFailureCopy('cancelled').title).toBe('Transfer cancelled')
    expect(transferFailureCopy('failed').title).toBe("Couldn't send the file")
  })
})
