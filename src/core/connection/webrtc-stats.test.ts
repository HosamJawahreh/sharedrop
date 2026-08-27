import { describe, expect, it, vi } from 'vitest'
import { collectWebRtcStats, emptyWebRtcStats } from './webrtc-stats'

function createFakePeerConnection(stats: Map<string, RTCStats>): RTCPeerConnection {
  return {
    signalingState: 'stable',
    iceGatheringState: 'complete',
    iceConnectionState: 'connected',
    connectionState: 'connected',
    getStats: vi.fn(async () => stats),
  } as unknown as RTCPeerConnection
}

describe('collectWebRtcStats', () => {
  it('returns empty defaults when getStats fails', async () => {
    const pc = {
      signalingState: 'have-local-offer',
      iceGatheringState: 'gathering',
      iceConnectionState: 'checking',
      connectionState: 'connecting',
      getStats: vi.fn(async () => {
        throw new Error('stats unavailable')
      }),
    } as unknown as RTCPeerConnection

    const snapshot = await collectWebRtcStats(pc)
    expect(snapshot.signalingState).toBe('have-local-offer')
    expect(snapshot.candidateType).toBeNull()
    expect(snapshot.rttMs).toBeNull()
  })

  it('extracts selected candidate type and RTT without credentials', async () => {
    const stats = new Map<string, RTCStats>([
      [
        'transport-1',
        {
          id: 'transport-1',
          type: 'transport',
          timestamp: 0,
          selectedCandidatePairId: 'pair-1',
        } as RTCStats,
      ],
      [
        'pair-1',
        {
          id: 'pair-1',
          type: 'candidate-pair',
          timestamp: 0,
          state: 'succeeded',
          currentRoundTripTime: 0.042,
          localCandidateId: 'local-1',
          remoteCandidateId: 'remote-1',
        } as RTCStats,
      ],
      [
        'local-1',
        {
          id: 'local-1',
          type: 'local-candidate',
          timestamp: 0,
          candidateType: 'relay',
          protocol: 'udp',
          address: '203.0.113.10',
          port: 50000,
        } as RTCStats,
      ],
      [
        'remote-1',
        {
          id: 'remote-1',
          type: 'remote-candidate',
          timestamp: 0,
          candidateType: 'relay',
          protocol: 'udp',
          address: '203.0.113.20',
          port: 50001,
        } as RTCStats,
      ],
    ])

    const snapshot = await collectWebRtcStats(createFakePeerConnection(stats))
    expect(snapshot.candidateType).toBe('relay')
    expect(snapshot.rttMs).toBe(42)
    expect(snapshot.localCandidate).toContain('relay')
    expect(snapshot.remoteCandidate).toContain('relay')

    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toMatch(/credential/i)
    expect(serialized).not.toMatch(/password/i)
    expect(serialized).not.toMatch(/username/i)
  })

  it('clones empty stats without shared mutation', () => {
    const a = emptyWebRtcStats()
    const b = emptyWebRtcStats()
    a.candidateType = 'host'
    expect(b.candidateType).toBeNull()
  })
})
