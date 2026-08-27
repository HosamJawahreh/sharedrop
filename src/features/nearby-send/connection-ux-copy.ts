/**
 * Consumer-facing connection copy. Never expose ICE/SDP/WebRTC jargon.
 */

export function connectionTitle(
  state: 'connecting' | 'connected' | 'failed' | 'disconnected',
  deviceName: string,
  failureMessage: string | null,
): string {
  if (state === 'connected') return `Connected to ${deviceName} ✓`
  if (state === 'disconnected') return 'Connection lost'
  if (state === 'failed') {
    if (failureMessage?.toLowerCase().includes('timed out')) {
      return 'Connection timed out'
    }
    if (failureMessage?.toLowerCase().includes('offline')) {
      return 'Device went offline'
    }
    return 'Unable to connect'
  }
  return `Connecting to ${deviceName}…`
}

export function connectionSubtitle(
  state: 'connecting' | 'connected' | 'failed' | 'disconnected',
  failureMessage: string | null,
): string | null {
  if (state === 'connected') return null
  if (state === 'disconnected') {
    return 'The transfer was interrupted. Return to nearby devices to connect again.'
  }
  if (state === 'failed') {
    if (failureMessage?.toLowerCase().includes('timed out')) {
      return 'The device could not be reached in time.'
    }
    if (failureMessage?.toLowerCase().includes('offline')) {
      return 'That device is no longer available.'
    }
    return 'The device could not be reached.'
  }
  return 'Connecting…'
}

export function transferFailureCopy(sessionState: 'failed' | 'cancelled'): {
  title: string
  hint: string
} {
  if (sessionState === 'cancelled') {
    return {
      title: 'Transfer cancelled',
      hint: 'You can start a new transfer whenever you are ready.',
    }
  }
  return {
    title: 'Transfer failed',
    hint: 'The file could not be transferred completely. Try again.',
  }
}
