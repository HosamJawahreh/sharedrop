/**
 * Application error model.
 *
 * Technical details stay internal for debugging.
 * User-facing messages must never expose raw browser/network jargon.
 */

export type ErrorCategory = 'discovery' | 'session' | 'connection' | 'transfer' | 'user_action'

export interface AppErrorOptions {
  /** Safe message shown to the user. */
  userMessage: string
  /** Technical detail for logs / debugging. */
  technicalMessage: string
  cause?: unknown
}

export class AppError extends Error {
  readonly category: ErrorCategory
  readonly userMessage: string
  readonly technicalMessage: string
  override readonly cause?: unknown

  constructor(category: ErrorCategory, options: AppErrorOptions) {
    super(options.userMessage)
    this.name = 'AppError'
    this.category = category
    this.userMessage = options.userMessage
    this.technicalMessage = options.technicalMessage
    this.cause = options.cause
  }
}

export class DiscoveryError extends AppError {
  constructor(options: AppErrorOptions) {
    super('discovery', options)
    this.name = 'DiscoveryError'
  }
}

export class SessionError extends AppError {
  constructor(options: AppErrorOptions) {
    super('session', options)
    this.name = 'SessionError'
  }
}

export class ConnectionError extends AppError {
  constructor(options: AppErrorOptions) {
    super('connection', options)
    this.name = 'ConnectionError'
  }
}

export class TransferError extends AppError {
  constructor(options: AppErrorOptions) {
    super('transfer', options)
    this.name = 'TransferError'
  }
}

export class UserActionError extends AppError {
  constructor(options: AppErrorOptions) {
    super('user_action', options)
    this.name = 'UserActionError'
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError
}

/** Map an unknown failure to a categorized error without leaking internals. */
export function toUserFacingError(
  category: ErrorCategory,
  fallbackUserMessage: string,
  error: unknown,
): AppError {
  if (error instanceof AppError) {
    return error
  }

  const technicalMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'

  return new AppError(category, {
    userMessage: fallbackUserMessage,
    technicalMessage,
    cause: error,
  })
}
