import type { ReactNode } from 'react'
import { useNearbySend } from './useNearbySend'
import './DiscoveryDiagnosticsPanel.css'

export function DiscoveryDiagnosticsPanel(): ReactNode {
  const { domain } = useNearbySend()
  const { discoveryDiagnostics, discoveryState } = domain

  if (!import.meta.env.DEV || !discoveryDiagnostics) {
    return null
  }

  return (
    <aside className="discovery-diagnostics" aria-label="Discovery diagnostics">
      <p className="discovery-diagnostics__title">Discovery</p>
      <dl className="discovery-diagnostics__list">
        <div>
          <dt>State</dt>
          <dd>{discoveryState}</dd>
        </div>
        <div>
          <dt>Connected</dt>
          <dd>{discoveryDiagnostics.connected ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>{discoveryDiagnostics.registered ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Nearby devices</dt>
          <dd>{discoveryDiagnostics.nearbyCount}</dd>
        </div>
        <div>
          <dt>Signaling URL</dt>
          <dd>{discoveryDiagnostics.signalingUrl}</dd>
        </div>
        <div>
          <dt>Heartbeat</dt>
          <dd>{discoveryDiagnostics.heartbeatActive ? 'Active' : 'Inactive'}</dd>
        </div>
        {discoveryDiagnostics.reconnectAttempt > 0 ? (
          <div>
            <dt>Reconnect attempt</dt>
            <dd>{discoveryDiagnostics.reconnectAttempt}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  )
}
