import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { evaluateLanReadiness, type LanReadinessReport } from '@/core/dev/lan-readiness'
import { resolveWebAppOrigin } from '@/core/signaling/resolve-signaling-url'
import { useNearbySend } from './useNearbySend'
import './LanDiagnosticsPanel.css'

function stepLabel(step: LanReadinessReport['steps'][number]['step']): string {
  switch (step) {
    case 'web_app_loaded':
      return 'Web app loaded'
    case 'signaling_connected':
      return 'Signaling connected'
    case 'presence_registered':
      return 'Presence registered'
    case 'nearby_devices_visible':
      return 'Nearby device visible'
  }
}

function statusSymbol(status: LanReadinessReport['steps'][number]['status']): string {
  if (status === 'pass') return '✓'
  if (status === 'pending') return '…'
  return '✕'
}

export function LanDiagnosticsPanel(): ReactNode {
  const { domain, discovery, signalingUrl, signalingClient } = useNearbySend()
  const { discoveryState, discoveryDiagnostics, nearbyDevices } = domain
  const [report, setReport] = useState<LanReadinessReport | null>(null)

  const webAppOrigin = useMemo(() => resolveWebAppOrigin(), [])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const refresh = (): void => {
      setReport(
        evaluateLanReadiness({
          signalingUrl,
          webAppOrigin,
          signalingState: signalingClient.getState(),
          discoveryState,
          discoveryDiagnostics,
          nearbyDeviceCount: nearbyDevices.length,
        }),
      )
    }

    refresh()
    const timer = setInterval(refresh, 1500)
    return () => clearInterval(timer)
  }, [
    signalingUrl,
    webAppOrigin,
    signalingClient,
    discoveryState,
    discoveryDiagnostics,
    nearbyDevices.length,
  ])

  const runReadinessCheck = (): void => {
    void discovery.start().finally(() => {
      setReport(
        evaluateLanReadiness({
          signalingUrl,
          webAppOrigin,
          signalingState: signalingClient.getState(),
          discoveryState,
          discoveryDiagnostics,
          nearbyDeviceCount: nearbyDevices.length,
        }),
      )
    })
  }

  if (!import.meta.env.DEV || !report) {
    return null
  }

  return (
    <aside className="lan-diagnostics" aria-label="LAN development diagnostics">
      <p className="lan-diagnostics__title">LAN readiness</p>
      <dl className="lan-diagnostics__list">
        <div>
          <dt>Web app</dt>
          <dd>{report.webAppOrigin ?? '—'}</dd>
        </div>
        <div>
          <dt>Signaling</dt>
          <dd>{report.signalingUrl}</dd>
        </div>
        <div>
          <dt>Signaling state</dt>
          <dd>{signalingClient.getState()}</dd>
        </div>
        <div>
          <dt>Device ID</dt>
          <dd>{discoveryDiagnostics?.localDeviceId ?? '—'}</dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>{discoveryDiagnostics?.registered ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Heartbeat</dt>
          <dd>{discoveryDiagnostics?.heartbeatActive ? 'Active' : 'Inactive'}</dd>
        </div>
        <div>
          <dt>Reconnect attempt</dt>
          <dd>{discoveryDiagnostics?.reconnectAttempt ?? 0}</dd>
        </div>
        <div>
          <dt>Nearby count</dt>
          <dd>{nearbyDevices.length}</dd>
        </div>
      </dl>

      <ul className="lan-diagnostics__steps">
        {report.steps.map((step) => (
          <li key={step.step}>
            <span className={`lan-diagnostics__status lan-diagnostics__status--${step.status}`}>
              {statusSymbol(step.status)}
            </span>
            <span className="lan-diagnostics__step-label">{stepLabel(step.step)}</span>
            <span className="lan-diagnostics__step-detail">{step.detail}</span>
          </li>
        ))}
      </ul>

      <p className="lan-diagnostics__summary">
        {report.readyForPeerTesting
          ? 'Ready for peer testing — select a nearby device.'
          : report.readyForDiscovery
            ? 'Discovery ready — open ShareDrop on a second device/browser.'
            : 'Not ready — check signaling URL and network access.'}
      </p>

      <button type="button" className="lan-diagnostics__action" onClick={runReadinessCheck}>
        Run readiness check
      </button>
    </aside>
  )
}
