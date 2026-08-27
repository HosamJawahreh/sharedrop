import { useEffect, useState, type ReactNode } from 'react'
import { formatBytes, formatSpeed } from '@/core/transfer'
import type { TransferDiagnostics } from '@/core/transfer/diagnostics'
import { useNearbySend } from './useNearbySend'
import './TransferDiagnosticsPanel.css'

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function TransferDiagnosticsPanel(): ReactNode {
  const { transfer } = useNearbySend()
  const [diagnostics, setDiagnostics] = useState<TransferDiagnostics>(() =>
    transfer.getDiagnostics(),
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const timer = setInterval(() => {
      setDiagnostics(transfer.getDiagnostics())
    }, 1000)
    return () => clearInterval(timer)
  }, [transfer])

  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <aside className="transfer-diagnostics" aria-label="Transfer diagnostics">
      <p className="transfer-diagnostics__title">Transfer</p>
      <dl className="transfer-diagnostics__list">
        <div>
          <dt>State</dt>
          <dd>{diagnostics.sessionState}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{diagnostics.role ?? '—'}</dd>
        </div>
        <div>
          <dt>Bytes sent</dt>
          <dd>{formatBytes(diagnostics.bytesSent)}</dd>
        </div>
        <div>
          <dt>Bytes received</dt>
          <dd>{formatBytes(diagnostics.bytesReceived)}</dd>
        </div>
        <div>
          <dt>Buffered</dt>
          <dd>{formatBytes(diagnostics.bufferedAmount)}</dd>
        </div>
        <div>
          <dt>Peak buffered</dt>
          <dd>{formatBytes(diagnostics.peakBufferedAmount)}</dd>
        </div>
        <div>
          <dt>Low threshold</dt>
          <dd>
            {diagnostics.bufferedAmountLowThreshold !== null
              ? formatBytes(diagnostics.bufferedAmountLowThreshold)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Backpressure pauses</dt>
          <dd>{diagnostics.backpressurePauseCount}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(diagnostics.transferDurationMs)}</dd>
        </div>
        <div>
          <dt>Avg throughput</dt>
          <dd>
            {diagnostics.averageThroughputBytesPerSecond !== null
              ? formatSpeed(diagnostics.averageThroughputBytesPerSecond)
              : '—'}
          </dd>
        </div>
      </dl>
    </aside>
  )
}
