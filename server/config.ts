import { PROTOCOL } from '../shared/protocol.js'
import { resolveAllowedOrigins } from './origin-policy.js'

export interface ServerConfig {
  port: number
  host: string
  allowedOrigins: string[]
  maxConnections: number
  maxMessagesPerSecond: number
  maxMessageBytes: number
  serverVersion: string
  isProduction: boolean
}

export interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.SHAREDROP_ENV === 'production'
}

/**
 * Load signaling server configuration from environment.
 * Production refuses SIGNALING_ALLOWED_ORIGINS=* / unset.
 */
export function loadConfig(options: LoadConfigOptions = {}): ServerConfig {
  const env = options.env ?? process.env
  const isProduction = isProductionEnv(env)
  const port = parsePositiveInt(env.SIGNALING_PORT, 8787)
  const host = env.SIGNALING_HOST ?? '0.0.0.0'
  const allowedOrigins = resolveAllowedOrigins(env.SIGNALING_ALLOWED_ORIGINS, { isProduction })

  return {
    port,
    host,
    allowedOrigins,
    maxConnections: parsePositiveInt(env.SIGNALING_MAX_CONNECTIONS, PROTOCOL.MAX_CONNECTIONS),
    maxMessagesPerSecond: parsePositiveInt(
      env.SIGNALING_MAX_MESSAGES_PER_SECOND,
      PROTOCOL.MAX_MESSAGES_PER_SECOND,
    ),
    maxMessageBytes: parsePositiveInt(env.SIGNALING_MAX_MESSAGE_BYTES, PROTOCOL.MAX_MESSAGE_BYTES),
    serverVersion: env.SHAREDROP_VERSION ?? '0.11.0',
    isProduction,
  }
}
