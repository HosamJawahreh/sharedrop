/** Development-only transfer runtime metrics. */

import type { TransferSessionState } from '../../../shared/transfer-protocol'

export interface TransferDiagnostics {
  sessionState: TransferSessionState
  role: 'sender' | 'receiver' | null
  bytesSent: number
  bytesReceived: number
  bufferedAmount: number
  bufferedAmountLowThreshold: number | null
  peakBufferedAmount: number
  backpressurePauseCount: number
  transferStartedAt: number | null
  transferCompletedAt: number | null
  transferDurationMs: number | null
  averageThroughputBytesPerSecond: number | null
}

export function emptyTransferDiagnostics(): TransferDiagnostics {
  return {
    sessionState: 'idle',
    role: null,
    bytesSent: 0,
    bytesReceived: 0,
    bufferedAmount: 0,
    bufferedAmountLowThreshold: null,
    peakBufferedAmount: 0,
    backpressurePauseCount: 0,
    transferStartedAt: null,
    transferCompletedAt: null,
    transferDurationMs: null,
    averageThroughputBytesPerSecond: null,
  }
}
