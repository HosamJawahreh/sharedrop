import { describe, expect, it } from 'vitest'
import { FrameType, TRANSFER_PROTOCOL } from './transfer-protocol.js'
import {
  ProtocolError,
  decodeFileChunkPayload,
  decodeFrame,
  decodeJsonPayload,
  encodeFileChunkFrame,
  encodeJsonFrame,
} from './transfer-frame.js'

describe('transfer-frame', () => {
  it('round-trips JSON control frames', () => {
    const payload = { transferSessionId: 'xfer_1', code: 'OK', message: 'accepted' }
    const frame = encodeJsonFrame(FrameType.TRANSFER_ACCEPT, payload)
    const decoded = decodeFrame(frame.buffer as ArrayBuffer)
    expect(decoded.type).toBe(FrameType.TRANSFER_ACCEPT)
    expect(decodeJsonPayload(decoded.payload)).toEqual(payload)
  })

  it('round-trips binary file chunks', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const frame = encodeFileChunkFrame('file_abc', 2, data)
    const decoded = decodeFrame(frame.buffer as ArrayBuffer)
    expect(decoded.type).toBe(FrameType.FILE_CHUNK)
    const chunk = decodeFileChunkPayload(decoded.payload)
    expect(chunk.fileId).toBe('file_abc')
    expect(chunk.chunkIndex).toBe(2)
    expect(Array.from(chunk.data)).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects invalid magic', () => {
    const frame = encodeJsonFrame(FrameType.TRANSFER_REQUEST, {})
    frame[0] = 0
    expect(() => decodeFrame(frame.buffer as ArrayBuffer)).toThrow(ProtocolError)
  })

  it('rejects length mismatch', () => {
    const frame = encodeJsonFrame(FrameType.TRANSFER_REQUEST, { ok: true })
    const truncated = frame.slice(0, frame.byteLength - 1)
    expect(() => decodeFrame(truncated.buffer as ArrayBuffer)).toThrow(ProtocolError)
  })

  it('rejects oversized chunks', () => {
    const oversized = new Uint8Array(TRANSFER_PROTOCOL.MAX_CHUNK_SIZE + 1)
    const frame = encodeFileChunkFrame('file_1', 0, oversized)
    const decoded = decodeFrame(frame.buffer as ArrayBuffer)
    expect(() => decodeFileChunkPayload(decoded.payload)).toThrow(ProtocolError)
  })

  it('keeps default chunk frames within the SCTP max message size', () => {
    const data = new Uint8Array(TRANSFER_PROTOCOL.DEFAULT_CHUNK_SIZE)
    const maxFileId = 'f'.repeat(TRANSFER_PROTOCOL.MAX_FILE_ID_LENGTH)
    const frame = encodeFileChunkFrame(maxFileId, 0, data)
    expect(frame.byteLength).toBeLessThanOrEqual(TRANSFER_PROTOCOL.SCTP_MAX_MESSAGE_BYTES)
  })
})
