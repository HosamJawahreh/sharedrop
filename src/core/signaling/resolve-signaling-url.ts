/** Resolve the WebSocket signaling URL for browser and SSR contexts. */

const DEFAULT_SIGNALING_PORT = 8787

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(hostname)
}

function hostnameFromWebSocketUrl(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function webSocketUrlForLocation(location: SignalingLocation): string {
  if (location.protocol === 'https:') {
    // Same-origin Node app (Hostinger): TLS + signaling on one host, no /ws path required.
    return `wss://${location.hostname}`
  }

  if (import.meta.env.DEV || location.port === '4173') {
    const portSuffix = location.port ? `:${location.port}` : ''
    return `ws://${location.hostname}${portSuffix}/ws`
  }

  return `ws://${location.hostname}:${DEFAULT_SIGNALING_PORT}`
}

/** Browser location fields used for signaling URL derivation (port optional). */
export type SignalingLocation = Pick<Location, 'protocol' | 'hostname'> & {
  port?: string
}

export interface ResolveSignalingUrlOptions {
  /** Explicit override (tests, VITE_SIGNALING_URL). */
  override?: string | undefined
  /** Browser location; defaults to globalThis.location when available. */
  location?: SignalingLocation | undefined
  /** Env value from import.meta.env.VITE_SIGNALING_URL */
  configuredUrl?: string | undefined
  /**
   * Production builds: always honor configuredUrl (disable LAN loopback overrides).
   */
  strictConfiguredUrl?: boolean | undefined
}

/**
 * Resolve signaling WebSocket URL.
 *
 * Priority:
 * 1. Explicit override
 * 2. VITE_SIGNALING_URL (when provided) — must be ws:// or wss://
 * 3. Same host as the web app + port 8787 (LAN-safe — no localhost hardcoding in browser)
 * 4. SSR/test fallback: ws://localhost:8787
 *
 * When the page is served over HTTPS, resolved URLs must use `wss://`
 * (mixed-content `ws://` is rejected). Production builds should set
 * `VITE_SIGNALING_URL=wss://…`.
 */
export function resolveSignalingUrl(options: ResolveSignalingUrlOptions = {}): string {
  const location = options.location ?? getBrowserLocation()

  const override = options.override?.trim()
  if (override) {
    return assertWebSocketUrl(override, location)
  }

  const configuredUrl = options.configuredUrl?.trim()
  if (configuredUrl) {
    const resolved = assertWebSocketUrl(configuredUrl, location)
    // LAN physical devices must not follow loopback env overrides from the dev machine.
    if (
      !options.strictConfiguredUrl &&
      location &&
      !isLoopbackHostname(location.hostname) &&
      isLoopbackHostname(hostnameFromWebSocketUrl(resolved) ?? '')
    ) {
      return webSocketUrlForLocation(location)
    }
    return resolved
  }

  if (location) {
    return webSocketUrlForLocation(location)
  }

  return `ws://localhost:${DEFAULT_SIGNALING_PORT}`
}

/** Reject non-WebSocket schemes so production never silently uses http(s) signaling URLs. */
export function assertWebSocketUrl(
  raw: string,
  location?: SignalingLocation | undefined,
): string {
  const trimmed = raw.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Signaling URL must be a valid ws:// or wss:// URL.')
  }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error('Signaling URL must use ws:// or wss://.')
  }
  // HTTPS pages must not use insecure ws:// (browsers block mixed content).
  if (location?.protocol === 'https:' && parsed.protocol === 'ws:') {
    throw new Error('Signaling URL must use wss:// when the application is loaded over HTTPS.')
  }
  return trimmed
}

/** True when a signaling URL is suitable for an HTTPS production page. */
export function isProductionSignalingUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'wss:'
  } catch {
    return false
  }
}

function getBrowserLocation(): SignalingLocation | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location
}

/** Current web app origin when running in a browser. */
export function resolveWebAppOrigin(
  location: SignalingLocation | undefined = getBrowserLocation(),
): string | null {
  if (!location) return null
  const port = location.port ? `:${location.port}` : ''
  return `${location.protocol}//${location.hostname}${port}`
}
