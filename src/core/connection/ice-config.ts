/**
 * Resolve ICE server configuration from environment.
 *
 * Supports arbitrary RTCIceServer lists including:
 * - STUN (`stun:`)
 * - TURN (`turn:`)
 * - TURN over TLS (`turns:`)
 *
 * Example:
 * VITE_ICE_SERVERS='[
 *   {"urls":"stun:stun.l.google.com:19302"},
 *   {"urls":"turn:turn.example.com:3478","username":"user","credential":"secret"},
 *   {"urls":"turns:turn.example.com:5349","username":"user","credential":"secret"}
 * ]'
 *
 * Do not hard-code production TURN credentials in the repository.
 * ICE selects host / srflx / relay naturally — do not force TURN in production.
 * Optional `VITE_ICE_TRANSPORT_POLICY=relay` is for validation only.
 */

export type IceUrlScheme = 'stun' | 'turn' | 'turns'

export type IceTransportPolicy = 'all' | 'relay'

/** Safe, credential-free summary for diagnostics and tests. */
export interface IceServersSummary {
  serverCount: number
  schemes: IceUrlScheme[]
  stunCount: number
  turnCount: number
  turnsCount: number
  /** True when any entry carries username/credential fields (values never included). */
  hasCredentials: boolean
  iceTransportPolicy: IceTransportPolicy
}

const DEFAULT_STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' }

const ICE_SCHEME = /^(stun|turn|turns):/i

function iceUrlScheme(value: string): IceUrlScheme | null {
  const match = ICE_SCHEME.exec(value.trim())
  if (!match) return null
  return match[1]!.toLowerCase() as IceUrlScheme
}

function isIceUrl(value: string): boolean {
  return iceUrlScheme(value) !== null
}

function collectUrlSchemes(urls: string | string[]): IceUrlScheme[] {
  const list = typeof urls === 'string' ? [urls] : urls
  const schemes: IceUrlScheme[] = []
  for (const entry of list) {
    const scheme = iceUrlScheme(entry)
    if (scheme) schemes.push(scheme)
  }
  return schemes
}

function isStunOnly(urls: string | string[]): boolean {
  const schemes = collectUrlSchemes(urls)
  return schemes.length > 0 && schemes.every((scheme) => scheme === 'stun')
}

/**
 * Validate a single ICE server entry.
 * Rejects unsupported schemes, empty url lists, and non-string credentials.
 */
function isIceServer(value: unknown): value is RTCIceServer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const urls = record.urls
  const hasUrls =
    typeof urls === 'string'
      ? isIceUrl(urls)
      : Array.isArray(urls) &&
        urls.length > 0 &&
        urls.every((entry) => typeof entry === 'string' && isIceUrl(entry))
  if (!hasUrls) return false

  // Credentials must be plain strings when present (no OAuth objects / numbers).
  if (record.username !== undefined && typeof record.username !== 'string') return false
  if (record.credential !== undefined && typeof record.credential !== 'string') return false

  // TURN/TURNS entries that supply one of username/credential must supply both.
  if (!isStunOnly(urls as string | string[])) {
    const hasUser = typeof record.username === 'string'
    const hasCred = typeof record.credential === 'string'
    if (hasUser !== hasCred) return false
  }

  return true
}

/** Normalize a validated server: strip accidental STUN credentials. */
function normalizeIceServer(server: RTCIceServer): RTCIceServer {
  const urls = server.urls
  if (isStunOnly(urls)) {
    return { urls }
  }
  const next: RTCIceServer = { urls }
  if (typeof server.username === 'string') next.username = server.username
  if (typeof server.credential === 'string') next.credential = server.credential
  return next
}

export function parseIceServersJson(raw: string): RTCIceServer[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (!parsed.every(isIceServer)) return null
    return parsed.map((server) => normalizeIceServer(server))
  } catch {
    return null
  }
}

function warnInvalidIceConfigOnce(raw: string): void {
  if (!import.meta.env.DEV) return
  // Avoid logging the raw value — it may contain TURN credentials.
  console.warn(
    `[ShareDrop] VITE_ICE_SERVERS is set but invalid (${raw.length} chars). Falling back to default STUN. Check JSON and stun:/turn:/turns: schemes.`,
  )
}

export function getIceServers(
  envValue: string | undefined = import.meta.env.VITE_ICE_SERVERS,
): RTCIceServer[] {
  const configured = envValue?.trim()
  if (configured) {
    const parsed = parseIceServersJson(configured)
    if (parsed) return parsed
    warnInvalidIceConfigOnce(configured)
  }

  return [DEFAULT_STUN]
}

export function resolveIceTransportPolicy(
  raw: string | undefined = import.meta.env.VITE_ICE_TRANSPORT_POLICY,
): IceTransportPolicy {
  const value = raw?.trim().toLowerCase()
  if (value === 'relay') return 'relay'
  return 'all'
}

/** Credential-free ICE summary for diagnostics — never includes secrets. */
export function summarizeIceServers(
  servers: readonly RTCIceServer[] = getIceServers(),
  policy: IceTransportPolicy = resolveIceTransportPolicy(),
): IceServersSummary {
  let stunCount = 0
  let turnCount = 0
  let turnsCount = 0
  let hasCredentials = false
  const schemeSet = new Set<IceUrlScheme>()

  for (const server of servers) {
    if (typeof server.username === 'string' || typeof server.credential === 'string') {
      hasCredentials = true
    }
    for (const scheme of collectUrlSchemes(server.urls)) {
      schemeSet.add(scheme)
      if (scheme === 'stun') stunCount += 1
      else if (scheme === 'turn') turnCount += 1
      else if (scheme === 'turns') turnsCount += 1
    }
  }

  return {
    serverCount: servers.length,
    schemes: [...schemeSet],
    stunCount,
    turnCount,
    turnsCount,
    hasCredentials,
    iceTransportPolicy: policy,
  }
}

export function createPeerConnectionConfig(
  options: {
    iceServers?: RTCIceServer[]
    iceTransportPolicy?: IceTransportPolicy
  } = {},
): RTCConfiguration {
  const iceServers = options.iceServers ?? getIceServers()
  const iceTransportPolicy = options.iceTransportPolicy ?? resolveIceTransportPolicy()
  const config: RTCConfiguration = { iceServers }
  // Only set when forcing relay for validation — default browser behavior is `all`.
  if (iceTransportPolicy === 'relay') {
    config.iceTransportPolicy = 'relay'
  }
  return config
}
