import { TRANSFER_PROTOCOL } from '../../../shared/transfer-protocol'

const PATH_TRAVERSAL = /(\.\.|\/|\\|:)/

/** Sanitize an incoming filename — strip paths, limit length, preserve Unicode. */
export function sanitizeFilename(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name
    .trim()
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  if (!trimmed || trimmed.length > TRANSFER_PROTOCOL.MAX_FILENAME_LENGTH) {
    return null
  }
  const segments = trimmed.split(/[/\\]/).filter(Boolean)
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    return null
  }
  const baseName = segments[segments.length - 1] ?? trimmed
  if (!baseName || PATH_TRAVERSAL.test(baseName)) {
    return null
  }
  return baseName
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null
  if (seconds < 60) return `About ${Math.ceil(seconds)} seconds remaining`
  const minutes = Math.ceil(seconds / 60)
  return `About ${minutes} minute${minutes === 1 ? '' : 's'} remaining`
}
