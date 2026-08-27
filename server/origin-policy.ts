/** Development origin helpers for signaling WebSocket connections. */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
]

export function isPrivateNetworkOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }
    return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
  } catch {
    return false
  }
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (allowedOrigins.includes('*')) return true
  if (!origin) return false
  if (allowedOrigins.includes('lan') && isPrivateNetworkOrigin(origin)) return true
  return allowedOrigins.includes(origin)
}

export class OriginPolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OriginPolicyError'
  }
}

function assertProductionOriginEntry(entry: string): void {
  if (entry === 'lan' || entry === '*') {
    throw new OriginPolicyError(
      'SIGNALING_ALLOWED_ORIGINS must list explicit HTTPS origins in production (not * or lan).',
    )
  }
  let parsed: URL
  try {
    parsed = new URL(entry)
  } catch {
    throw new OriginPolicyError(`Invalid origin in SIGNALING_ALLOWED_ORIGINS: ${entry}`)
  }
  if (parsed.protocol !== 'https:') {
    throw new OriginPolicyError(
      `Production origins must use https:// (got ${entry}). Development may use http:// or lan.`,
    )
  }
  // Bare origin: scheme + host (+ optional port). Reject path/query/hash noise.
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new OriginPolicyError(
      `SIGNALING_ALLOWED_ORIGINS entries must be bare origins (scheme + host[+port]), got ${entry}`,
    )
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new OriginPolicyError(
      `SIGNALING_ALLOWED_ORIGINS entries must be bare origins (scheme + host[+port]), got ${entry}`,
    )
  }
}

/**
 * Resolve allowed origins from SIGNALING_ALLOWED_ORIGINS.
 * Production must use explicit HTTPS origins (never `*` or `lan`).
 */
export function resolveAllowedOrigins(
  raw: string | undefined,
  options: { isProduction: boolean },
): string[] {
  const trimmed = raw?.trim()

  if (options.isProduction) {
    if (!trimmed || trimmed === '*') {
      throw new OriginPolicyError(
        'SIGNALING_ALLOWED_ORIGINS must list explicit HTTPS origins in production (not *).',
      )
    }
  }

  const value = trimmed && trimmed.length > 0 ? trimmed : '*'
  if (value === '*') return ['*']
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  if (options.isProduction) {
    for (const origin of origins) {
      assertProductionOriginEntry(origin)
    }
  }

  return origins
}
