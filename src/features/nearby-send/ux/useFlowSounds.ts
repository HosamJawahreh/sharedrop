import { useEffect, useRef } from 'react'
import type { ConnectionState } from '@/core/connection'
import type { TransferProgressView } from '@/core/transfer'
import { playFlowSound } from './flow-sounds'

const PROGRESS_TICK_MARKS = [0.25, 0.5, 0.75] as const

export function useConnectionFlowSounds(connectionState: ConnectionState): void {
  const prev = useRef<ConnectionState>(connectionState)

  useEffect(() => {
    const wasIdle = prev.current === 'idle' || prev.current === 'disconnected'
    const isConnecting = connectionState === 'requesting' || connectionState === 'connecting'

    if (wasIdle && isConnecting) {
      playFlowSound('connecting')
    }

    if (prev.current !== 'connected' && connectionState === 'connected') {
      playFlowSound('connected')
    }

    prev.current = connectionState
  }, [connectionState])
}

export function useTransferFlowSounds(progress: TransferProgressView): void {
  const prevSession = useRef(progress.sessionState)
  const prevIncoming = useRef(progress.incomingRequest !== null)
  const tickMarks = useRef<Set<number>>(new Set())

  useEffect(() => {
    const session = progress.sessionState
    const hadIncoming = prevIncoming.current
    const hasIncoming =
      session === 'awaiting_acceptance' &&
      progress.role === 'receiver' &&
      progress.incomingRequest !== null

    if (!hadIncoming && hasIncoming) {
      playFlowSound('incoming')
    }

    if (prevSession.current !== 'transferring' && session === 'transferring') {
      tickMarks.current = new Set()
      playFlowSound('transfer_start')
    }

    if (session === 'transferring') {
      for (const mark of PROGRESS_TICK_MARKS) {
        if (progress.overallProgress >= mark && !tickMarks.current.has(mark)) {
          tickMarks.current.add(mark)
          playFlowSound('transfer_tick')
        }
      }
    }

    if (prevSession.current !== 'completed' && session === 'completed') {
      playFlowSound('transfer_complete')
    }

    if (
      prevSession.current !== 'failed' &&
      prevSession.current !== 'cancelled' &&
      (session === 'failed' || session === 'cancelled')
    ) {
      playFlowSound('transfer_failed')
    }

    if (session === 'idle' || session === 'completed' || session === 'failed') {
      tickMarks.current = new Set()
    }

    prevSession.current = session
    prevIncoming.current = hasIncoming
  }, [progress])
}
