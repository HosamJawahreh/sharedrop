import { describe, expect, it } from 'vitest'
import { sanitizeFilename, formatBytes } from './filename'

describe('sanitizeFilename', () => {
  it('preserves Unicode and emoji filenames', () => {
    expect(sanitizeFilename('مرحبا.txt')).toBe('مرحبا.txt')
    expect(sanitizeFilename('photo 📷.jpg')).toBe('photo 📷.jpg')
  })

  it('strips path traversal segments', () => {
    expect(sanitizeFilename('../../evil.txt')).toBeNull()
    expect(sanitizeFilename('folder/file.txt')).toBe('file.txt')
    expect(sanitizeFilename('..\\windows\\path.txt')).toBeNull()
  })

  it('rejects empty and control characters', () => {
    expect(sanitizeFilename('')).toBeNull()
    expect(sanitizeFilename('   ')).toBeNull()
    expect(sanitizeFilename('bad\u0000name.txt')).toBe('badname.txt')
  })

  it('handles duplicate-looking names independently', () => {
    expect(sanitizeFilename('report.pdf')).toBe('report.pdf')
    expect(sanitizeFilename('report.pdf')).toBe('report.pdf')
  })
})

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(4.2 * 1024 * 1024)).toBe('4.2 MB')
  })
})
