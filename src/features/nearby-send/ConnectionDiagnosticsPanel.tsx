import type { ReactNode } from 'react'
import { formatBytes } from '@/core/transfer'
import { summarizeIceServers } from '@/core/connection'
import { useNearbySend } from './useNearbySend'
import './ConnectionDiagnosticsPanel.css'

function formatBitrate(value: number | null): string {
  if (value === null) return '—'
  return `${formatBytes(value)}/s`
}

export function ConnectionDiagnosticsPanel(): ReactNode {
  const { domain } = useNearbySend()
  const { connectionDiagnostics, connectionState } = domain
  const stats = connectionDiagnostics?.webRtcStats
  const iceSummary = import.meta.env.DEV ? summarizeIceServers() : null

  if (!import.meta.env.DEV || !connectionDiagnostics) {
    return null
  }

  return (
    <aside className="connection-diagnostics" aria-label="Connection diagnostics">
      <p className="connection-diagnostics__title">Connection</p>
      <dl className="connection-diagnostics__list">
        <div>
          <dt>State</dt>
          <dd>{connectionState}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{connectionDiagnostics.role ?? '—'}</dd>
        </div>
        <div>
          <dt>ICE servers</dt>
          <dd>
            {iceSummary
              ? `${iceSummary.serverCount} (${iceSummary.schemes.join('+') || 'none'}; policy=${iceSummary.iceTransportPolicy})`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Signaling</dt>
          <dd>{stats?.signalingState ?? '—'}</dd>
        </div>
        <div>
          <dt>ICE gathering</dt>
          <dd>{stats?.iceGatheringState ?? '—'}</dd>
        </div>
        <div>
          <dt>ICE</dt>
          <dd>{stats?.iceConnectionState ?? connectionDiagnostics.iceConnectionState ?? '—'}</dd>
        </div>
        <div>
          <dt>Peer</dt>
          <dd>{stats?.connectionState ?? connectionDiagnostics.peerConnectionState ?? '—'}</dd>
        </div>
        <div>
          <dt>Handshake DC</dt>
          <dd>{connectionDiagnostics.dataChannelState ?? '—'}</dd>
        </div>
        <div>
          <dt>Transfer DC</dt>
          <dd>{connectionDiagnostics.transferChannelState ?? '—'}</dd>
        </div>
        <div>
          <dt>RTT</dt>
          <dd>{stats?.rttMs !== null && stats?.rttMs !== undefined ? `${stats.rttMs} ms` : '—'}</dd>
        </div>
        <div>
          <dt>Candidate</dt>
          <dd>{stats?.candidateType ?? '—'}</dd>
        </div>
        <div>
          <dt>Local cand.</dt>
          <dd>{stats?.localCandidate ?? '—'}</dd>
        </div>
        <div>
          <dt>Remote cand.</dt>
          <dd>{stats?.remoteCandidate ?? '—'}</dd>
        </div>
        <div>
          <dt>Out bitrate</dt>
          <dd>{formatBitrate(stats?.availableOutgoingBitrate ?? null)}</dd>
        </div>
        <div>
          <dt>Stats bytes ↑</dt>
          <dd>
            {stats?.bytesSent !== null && stats?.bytesSent !== undefined
              ? formatBytes(stats.bytesSent)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Stats bytes ↓</dt>
          <dd>
            {stats?.bytesReceived !== null && stats?.bytesReceived !== undefined
              ? formatBytes(stats.bytesReceived)
              : '—'}
          </dd>
        </div>
      </dl>
    </aside>
  )
}
