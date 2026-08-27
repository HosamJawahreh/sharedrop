/** Minimal signaling health payload — no device lists or secrets. */

export interface HealthPayload {
  ok: true
  service: 'sharedrop-signaling'
  version: string
  uptimeSeconds: number
  /** Current WebSocket connection count (not device presence). */
  connections: number
}

export function buildHealthPayload(options: {
  version: string
  startedAtMs: number
  connectionCount: number
  nowMs?: number
}): HealthPayload {
  const now = options.nowMs ?? Date.now()
  const uptimeSeconds = Math.max(0, Math.floor((now - options.startedAtMs) / 1000))
  return {
    ok: true,
    service: 'sharedrop-signaling',
    version: options.version,
    uptimeSeconds,
    connections: Math.max(0, options.connectionCount),
  }
}
