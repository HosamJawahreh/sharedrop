import type { DiscoveryDiagnostics, DiscoveryState } from '@/core/discovery'

export type LanReadinessStep =
  'web_app_loaded' | 'signaling_connected' | 'presence_registered' | 'nearby_devices_visible'

export type LanReadinessStepStatus = 'pass' | 'fail' | 'pending'

export interface LanReadinessStepResult {
  step: LanReadinessStep
  status: LanReadinessStepStatus
  detail: string
}

export interface LanReadinessReport {
  signalingUrl: string
  webAppOrigin: string | null
  steps: readonly LanReadinessStepResult[]
  readyForDiscovery: boolean
  readyForPeerTesting: boolean
}

export function evaluateLanReadiness(input: {
  signalingUrl: string
  webAppOrigin: string | null
  signalingState: 'disconnected' | 'connecting' | 'connected'
  discoveryState: DiscoveryState
  discoveryDiagnostics: DiscoveryDiagnostics | null
  nearbyDeviceCount: number
}): LanReadinessReport {
  const steps: LanReadinessStepResult[] = [
    {
      step: 'web_app_loaded',
      status: input.webAppOrigin ? 'pass' : 'fail',
      detail: input.webAppOrigin ?? 'Not running in a browser context',
    },
    {
      step: 'signaling_connected',
      status:
        input.signalingState === 'connected'
          ? 'pass'
          : input.signalingState === 'connecting'
            ? 'pending'
            : 'fail',
      detail: `Signaling client: ${input.signalingState}`,
    },
    {
      step: 'presence_registered',
      status: input.discoveryDiagnostics?.registered
        ? 'pass'
        : input.discoveryState === 'active' || input.discoveryState === 'connecting'
          ? 'pending'
          : 'fail',
      detail: input.discoveryDiagnostics?.registered
        ? 'Registered with signaling presence'
        : 'Start “Send to nearby” to register presence',
    },
    {
      step: 'nearby_devices_visible',
      status: input.nearbyDeviceCount > 0 ? 'pass' : 'pending',
      detail:
        input.nearbyDeviceCount > 0
          ? `${input.nearbyDeviceCount} nearby device(s) visible`
          : 'Open ShareDrop in a second browser/device on the same LAN',
    },
  ]

  const readyForDiscovery =
    steps.find((step) => step.step === 'signaling_connected')?.status === 'pass' &&
    steps.find((step) => step.step === 'presence_registered')?.status === 'pass'

  const readyForPeerTesting = readyForDiscovery && input.nearbyDeviceCount > 0

  return {
    signalingUrl: input.signalingUrl,
    webAppOrigin: input.webAppOrigin,
    steps,
    readyForDiscovery,
    readyForPeerTesting,
  }
}
