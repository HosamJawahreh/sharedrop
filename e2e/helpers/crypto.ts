import { createHash } from 'node:crypto'

export function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

export function deterministicBytes(size: number, seed = 0x5a): Buffer {
  const buffer = Buffer.alloc(size)
  for (let index = 0; index < size; index += 1) {
    buffer[index] = (seed + index) & 0xff
  }
  return buffer
}
