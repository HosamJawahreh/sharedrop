import { describe, expect, it } from 'vitest'
import { evaluateLanReadiness } from './lan-readiness'

describe('evaluateLanReadiness', () => {
  it('reports ready for discovery when signaling and presence are active', () => {
    const report = evaluateLanReadiness({
      signalingUrl: 'ws://192.168.1.25:8787',
      webAppOrigin: 'http://192.168.1.25:5173',
      signalingState: 'connected',
      discoveryState: 'active',
      discoveryDiagnostics: {
        connected: true,
        registered: true,
        nearbyCount: 0,
        heartbeatActive: true,
        localDeviceId: 'dev_1',
        reconnectAttempt: 0,
        signalingUrl: 'ws://192.168.1.25:8787',
      },
      nearbyDeviceCount: 0,
    })

    expect(report.readyForDiscovery).toBe(true)
    expect(report.readyForPeerTesting).toBe(false)
    expect(report.steps.find((step) => step.step === 'nearby_devices_visible')?.status).toBe(
      'pending',
    )
  })

  it('reports peer testing ready when a nearby device is visible', () => {
    const report = evaluateLanReadiness({
      signalingUrl: 'ws://192.168.1.25:8787',
      webAppOrigin: 'http://192.168.1.25:5173',
      signalingState: 'connected',
      discoveryState: 'active',
      discoveryDiagnostics: {
        connected: true,
        registered: true,
        nearbyCount: 1,
        heartbeatActive: true,
        localDeviceId: 'dev_1',
        reconnectAttempt: 0,
        signalingUrl: 'ws://192.168.1.25:8787',
      },
      nearbyDeviceCount: 1,
    })

    expect(report.readyForPeerTesting).toBe(true)
  })
})
