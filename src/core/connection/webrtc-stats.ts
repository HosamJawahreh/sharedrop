/** Parsed WebRTC statistics for development diagnostics. */

export interface WebRtcStatsSnapshot {
  signalingState: string | null
  iceGatheringState: string | null
  iceConnectionState: string | null
  connectionState: string | null
  rttMs: number | null
  candidateType: string | null
  localCandidate: string | null
  remoteCandidate: string | null
  availableOutgoingBitrate: number | null
  bytesSent: number | null
  bytesReceived: number | null
}

const EMPTY_STATS: WebRtcStatsSnapshot = {
  signalingState: null,
  iceGatheringState: null,
  iceConnectionState: null,
  connectionState: null,
  rttMs: null,
  candidateType: null,
  localCandidate: null,
  remoteCandidate: null,
  availableOutgoingBitrate: null,
  bytesSent: null,
  bytesReceived: null,
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Collect connection and candidate statistics from an RTCPeerConnection. */
export async function collectWebRtcStats(
  peerConnection: RTCPeerConnection,
): Promise<WebRtcStatsSnapshot> {
  const snapshot: WebRtcStatsSnapshot = {
    signalingState: peerConnection.signalingState ?? null,
    iceGatheringState: peerConnection.iceGatheringState ?? null,
    iceConnectionState: peerConnection.iceConnectionState ?? null,
    connectionState: peerConnection.connectionState ?? null,
    rttMs: null,
    candidateType: null,
    localCandidate: null,
    remoteCandidate: null,
    availableOutgoingBitrate: null,
    bytesSent: null,
    bytesReceived: null,
  }

  try {
    const report = await peerConnection.getStats()
    let selectedPairId: string | null = null

    report.forEach((stat) => {
      if (stat.type === 'transport' && 'selectedCandidatePairId' in stat) {
        selectedPairId = readString(stat.selectedCandidatePairId)
      }

      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        const currentRtt = readNumber(stat.currentRoundTripTime)
        if (currentRtt !== null) {
          snapshot.rttMs = Math.round(currentRtt * 1000)
        }
        const bitrate = readNumber(stat.availableOutgoingBitrate)
        if (bitrate !== null) {
          snapshot.availableOutgoingBitrate = bitrate
        }
        if (!selectedPairId) {
          selectedPairId = readString(stat.id)
        }
      }

      if (stat.type === 'data-channel') {
        const sent = readNumber(stat.bytesSent)
        const received = readNumber(stat.bytesReceived)
        if (sent !== null) snapshot.bytesSent = (snapshot.bytesSent ?? 0) + sent
        if (received !== null) snapshot.bytesReceived = (snapshot.bytesReceived ?? 0) + received
      }

      if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
        // Ignore — ShareDrop uses data channels only.
      }
    })

    if (selectedPairId) {
      const selectedPair = report.get(selectedPairId)
      if (selectedPair && selectedPair.type === 'candidate-pair') {
        const localId = readString(selectedPair.localCandidateId)
        const remoteId = readString(selectedPair.remoteCandidateId)
        if (localId) {
          const local = report.get(localId) as RTCStats & { candidateType?: string }
          if (local && local.type === 'local-candidate') {
            snapshot.candidateType = readString(local.candidateType)
            snapshot.localCandidate = formatCandidate(local)
          }
        }
        if (remoteId) {
          const remote = report.get(remoteId)
          if (remote && remote.type === 'remote-candidate') {
            snapshot.remoteCandidate = formatCandidate(remote)
          }
        }
      }
    }
  } catch {
    return snapshot
  }

  return snapshot
}

function formatCandidate(stat: RTCStats): string {
  const record = stat as RTCStats & {
    candidateType?: string
    protocol?: string
    address?: string
    ip?: string
    port?: number
  }
  const type = readString(record.candidateType) ?? 'unknown'
  const protocol = readString(record.protocol) ?? '?'
  const address = readString(record.address) ?? readString(record.ip) ?? '?'
  const port = readNumber(record.port)
  return port !== null ? `${type}/${protocol} ${address}:${port}` : `${type}/${protocol} ${address}`
}

export function emptyWebRtcStats(): WebRtcStatsSnapshot {
  return { ...EMPTY_STATS }
}
