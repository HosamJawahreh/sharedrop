import { FrameType, TRANSFER_PROTOCOL, type FrameTypeValue } from './transfer-protocol.js'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export interface DecodedFrame {
  type: FrameTypeValue
  payload: Uint8Array
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProtocolError'
  }
}

export function encodeJsonFrame(type: FrameTypeValue, value: unknown): Uint8Array {
  const json = textEncoder.encode(JSON.stringify(value))
  return encodeFrame(type, json)
}

export function encodeFrame(type: FrameTypeValue, payload: Uint8Array): Uint8Array {
  const header = new Uint8Array(TRANSFER_PROTOCOL.HEADER_SIZE)
  header[0] = TRANSFER_PROTOCOL.MAGIC
  header[1] = TRANSFER_PROTOCOL.VERSION
  header[2] = type
  const view = new DataView(header.buffer)
  view.setUint32(3, payload.byteLength, false)
  const frame = new Uint8Array(header.byteLength + payload.byteLength)
  frame.set(header, 0)
  frame.set(payload, header.byteLength)
  return frame
}

export function encodeFileChunkFrame(
  fileId: string,
  chunkIndex: number,
  data: Uint8Array,
): Uint8Array {
  const fileIdBytes = textEncoder.encode(fileId)
  if (fileIdBytes.byteLength > 65535) {
    throw new ProtocolError('File id is too long.')
  }

  const payload = new Uint8Array(2 + fileIdBytes.byteLength + 4 + data.byteLength)
  const view = new DataView(payload.buffer)
  view.setUint16(0, fileIdBytes.byteLength, false)
  payload.set(fileIdBytes, 2)
  view.setUint32(2 + fileIdBytes.byteLength, chunkIndex, false)
  payload.set(data, 2 + fileIdBytes.byteLength + 4)
  return encodeFrame(FrameType.FILE_CHUNK, payload)
}

export function decodeFrame(buffer: ArrayBuffer): DecodedFrame {
  const bytes = new Uint8Array(buffer)
  if (bytes.byteLength < TRANSFER_PROTOCOL.HEADER_SIZE) {
    throw new ProtocolError('Frame too short.')
  }
  if (bytes[0] !== TRANSFER_PROTOCOL.MAGIC) {
    throw new ProtocolError('Invalid frame magic.')
  }
  if (bytes[1] !== TRANSFER_PROTOCOL.VERSION) {
    throw new ProtocolError('Unsupported frame version.')
  }

  const type = bytes[2] as FrameTypeValue
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const length = view.getUint32(3, false)
  if (TRANSFER_PROTOCOL.HEADER_SIZE + length !== bytes.byteLength) {
    throw new ProtocolError('Invalid frame length.')
  }

  const payload = bytes.slice(TRANSFER_PROTOCOL.HEADER_SIZE)
  return { type, payload }
}

export function decodeJsonFrame<T>(frame: DecodedFrame): T {
  return JSON.parse(textDecoder.decode(frame.payload)) as T
}

export function decodeFileChunkPayload(payload: Uint8Array): {
  fileId: string
  chunkIndex: number
  data: Uint8Array
} {
  if (payload.byteLength < 6) {
    throw new ProtocolError('Invalid chunk payload.')
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  const fileIdLength = view.getUint16(0, false)
  const headerSize = 2 + fileIdLength + 4
  if (payload.byteLength < headerSize) {
    throw new ProtocolError('Invalid chunk header.')
  }
  const fileId = textDecoder.decode(payload.slice(2, 2 + fileIdLength))
  const chunkIndex = view.getUint32(2 + fileIdLength, false)
  const data = payload.slice(headerSize)
  if (data.byteLength > TRANSFER_PROTOCOL.MAX_CHUNK_SIZE) {
    throw new ProtocolError('Chunk exceeds maximum size.')
  }
  return { fileId, chunkIndex, data }
}

export function decodeJsonPayload<T>(payload: Uint8Array): T {
  return JSON.parse(textDecoder.decode(payload)) as T
}
