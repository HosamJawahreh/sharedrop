/**
 * Consumer-facing connection copy. Never expose ICE/SDP/WebRTC/TURN jargon.
 */

import type { ConnectionState } from '@/core/connection'

export type ConnectionUxPhase = 'waiting' | 'connecting' | 'connected' | 'failed' | 'disconnected'

export type ConnectionIntentRole = 'offerer' | 'answerer' | null

export function resolveConnectionUxPhase(connectionState: ConnectionState): ConnectionUxPhase {
  if (connectionState === 'requesting') return 'waiting'
  if (connectionState === 'connecting' || connectionState === 'disconnecting') return 'connecting'
  if (connectionState === 'connected') return 'connected'
  if (connectionState === 'failed') return 'failed'
  if (connectionState === 'disconnected') return 'disconnected'
  return 'connecting'
}

function isTimeoutMessage(message: string | null): boolean {
  return message?.toLowerCase().includes('timed out') ?? false
}

function isOfflineMessage(message: string | null): boolean {
  return message?.toLowerCase().includes('offline') ?? false
}

function isUnavailableMessage(message: string | null): boolean {
  const lower = message?.toLowerCase() ?? ''
  return (
    lower.includes('no longer') ||
    lower.includes('not available') ||
    lower.includes('unavailable') ||
    lower.includes('disconnected')
  )
}

export function connectionTitle(
  phase: ConnectionUxPhase,
  deviceName: string,
  failureMessage: string | null,
  role: ConnectionIntentRole = null,
): string {
  if (phase === 'connected') {
    if (role === 'answerer') return 'Ready to receive'
    return 'Ready to send'
  }
  if (phase === 'disconnected') {
    if (isUnavailableMessage(failureMessage)) {
      return 'That device is no longer available.'
    }
    return 'Connection was lost.'
  }
  if (phase === 'failed') {
    if (isTimeoutMessage(failureMessage)) {
      return 'The connection took too long.'
    }
    if (isOfflineMessage(failureMessage)) {
      return 'This device is currently offline.'
    }
    return `Couldn't connect to ${deviceName}.`
  }
  if (phase === 'waiting') return `Connecting to ${deviceName}`
  return `Connecting to ${deviceName}`
}

export function connectionSubtitle(
  phase: ConnectionUxPhase,
  deviceName: string,
  failureMessage: string | null,
  role: ConnectionIntentRole = null,
): string | null {
  if (phase === 'connected') {
    if (role === 'answerer') return `${deviceName} is connected`
    return deviceName
  }
  if (phase === 'disconnected') {
    if (isUnavailableMessage(failureMessage)) {
      return 'Find devices to try again.'
    }
    return 'Return to nearby devices to connect again.'
  }
  if (phase === 'failed') {
    if (isTimeoutMessage(failureMessage)) {
      return 'Please try again.'
    }
    if (isOfflineMessage(failureMessage)) {
      return 'That device is not available right now.'
    }
    return 'Check that ShareDrop is open on the other device, then try again.'
  }
  if (phase === 'waiting') return null
  return null
}

export function transferFailureCopy(sessionState: 'failed' | 'cancelled'): {
  title: string
  hint: string
} {
  if (sessionState === 'cancelled') {
    return {
      title: 'Transfer cancelled',
      hint: 'You can send again whenever you are ready.',
    }
  }
  return {
    title: "Couldn't send the file",
    hint: 'Try again.',
  }
}
