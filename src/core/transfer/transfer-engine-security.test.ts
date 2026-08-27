import { describe, expect, it, vi } from 'vitest'
import { FrameType, TRANSFER_PROTOCOL } from '../../../shared/transfer-protocol'
import {
  ProtocolError,
  decodeFrame,
  encodeFileChunkFrame,
  encodeJsonFrame,
} from '../../../shared/transfer-frame'
import type { ConnectionEngine, ConnectionState } from '@/core/connection'
import type { DataChannelTransport, TransportDiagnostics } from './data-channel-transport'
import { createTransferEngine } from './transfer-engine'
import { StreamingSha256 } from './integrity'

interface MockTransport extends DataChannelTransport {
  emitBinary: (data: ArrayBuffer) => void
  sent: Uint8Array[]
}

function createMockTransport(): MockTransport {
  const binaryListeners = new Set<(data: ArrayBuffer) => void>()
  const lowListeners = new Set<() => void>()
  const sent: Uint8Array[] = []
  const bufferedAmount = 0

  return {
    sent,
    send(data) {
      sent.push(data)
    },
    getBufferedAmount() {
      return bufferedAmount
    },
    setBufferedAmountLowThreshold() {},
    getBufferedAmountLowThreshold() {
      return null
    },
    getState() {
      return 'open' as const
    },
    getDiagnostics(): TransportDiagnostics {
      return {
        bytesSent: sent.reduce((sum, frame) => sum + frame.byteLength, 0),
        bytesReceived: 0,
        bufferedAmount,
        bufferedAmountLowThreshold: null,
        state: 'open',
      }
    },
    subscribeBinary(listener) {
      binaryListeners.add(listener)
      return () => binaryListeners.delete(listener)
    },
    subscribeBufferedAmountLow(listener) {
      lowListeners.add(listener)
      return () => lowListeners.delete(listener)
    },
    subscribeOpen(listener) {
      listener()
      return () => {}
    },
    subscribeClose() {
      return () => {}
    },
    close() {},
    emitBinary(data) {
      for (const listener of binaryListeners) listener(data)
    },
  }
}

function createMockConnection(transport: DataChannelTransport): ConnectionEngine {
  let state: ConnectionState = 'connected'
  const listeners = new Set<(state: ConnectionState) => void>()

  return {
    listen: () => {},
    stopListening: () => {},
    async connect() {
      state = 'connected'
      for (const listener of listeners) listener(state)
    },
    async disconnect() {
      state = 'disconnected'
      for (const listener of listeners) listener(state)
    },
    async cancel() {
      state = 'idle'
      for (const listener of listeners) listener(state)
    },
    getState: () => state,
    getRemoteDeviceId: () => 'dev_remote',
    getTransferTransport: () => transport,
    whenTransferTransportReady: async () => transport,
    async send() {},
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    subscribeToMessages: () => () => {},
  }
}

const localDevice = {
  deviceId: 'dev_local',
  sessionId: 'ses_local',
  displayName: 'Linux Laptop',
  deviceType: 'desktop' as const,
  platform: 'linux' as const,
  browser: 'Chrome',
}

async function startReceiverWithRequest(
  transport: MockTransport,
  request: Record<string, unknown>,
): Promise<ReturnType<typeof createTransferEngine>> {
  const receiver = createTransferEngine({
    connection: createMockConnection(transport),
    localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
  })
  await receiver.start()
  transport.emitBinary(encodeJsonFrame(FrameType.TRANSFER_REQUEST, request).buffer as ArrayBuffer)
  await vi.waitFor(() => expect(receiver.getProgress().incomingRequest).not.toBeNull())
  return receiver
}

describe('transfer-engine security and integrity', () => {
  it('fails on hash mismatch', async () => {
    const transport = createMockTransport()
    const receiver = await startReceiverWithRequest(transport, {
      transferSessionId: 'xfer_hash',
      senderDeviceId: 'dev_sender',
      senderDisplayName: 'Sender',
      files: [
        {
          fileId: 'file_1',
          name: 'a.txt',
          size: 3,
          mimeType: 'text/plain',
          lastModified: 0,
          index: 0,
          totalFiles: 1,
        },
      ],
      totalBytes: 3,
    })

    await receiver.acceptIncoming()
    transport.emitBinary(
      encodeJsonFrame(FrameType.FILE_START, {
        transferSessionId: 'xfer_hash',
        file: {
          fileId: 'file_1',
          name: 'a.txt',
          size: 3,
          mimeType: 'text/plain',
          lastModified: 0,
          index: 0,
          totalFiles: 1,
        },
      }).buffer as ArrayBuffer,
    )
    transport.emitBinary(
      encodeFileChunkFrame('file_1', 0, new TextEncoder().encode('abc')).buffer as ArrayBuffer,
    )
    transport.emitBinary(
      encodeJsonFrame(FrameType.FILE_END, {
        transferSessionId: 'xfer_hash',
        fileId: 'file_1',
        size: 3,
        sha256: '0'.repeat(64),
      }).buffer as ArrayBuffer,
    )

    await vi.waitFor(() => expect(receiver.getProgress().sessionState).toBe('failed'))
    expect(receiver.getReceivedFiles()).toHaveLength(0)
  })

  it('fails on size mismatch before hash check', async () => {
    const transport = createMockTransport()
    const receiver = await startReceiverWithRequest(transport, {
      transferSessionId: 'xfer_size',
      senderDeviceId: 'dev_sender',
      senderDisplayName: 'Sender',
      files: [
        {
          fileId: 'file_1',
          name: 'a.txt',
          size: 4,
          mimeType: 'text/plain',
          lastModified: 0,
          index: 0,
          totalFiles: 1,
        },
      ],
      totalBytes: 4,
    })

    await receiver.acceptIncoming()
    transport.emitBinary(
      encodeJsonFrame(FrameType.FILE_START, {
        transferSessionId: 'xfer_size',
        file: {
          fileId: 'file_1',
          name: 'a.txt',
          size: 4,
          mimeType: 'text/plain',
          lastModified: 0,
          index: 0,
          totalFiles: 1,
        },
      }).buffer as ArrayBuffer,
    )
    transport.emitBinary(
      encodeFileChunkFrame('file_1', 0, new TextEncoder().encode('ab')).buffer as ArrayBuffer,
    )

    const hasher = new StreamingSha256()
    hasher.update(new TextEncoder().encode('ab'))
    transport.emitBinary(
      encodeJsonFrame(FrameType.FILE_END, {
        transferSessionId: 'xfer_size',
        fileId: 'file_1',
        size: 4,
        sha256: hasher.digestHex(),
      }).buffer as ArrayBuffer,
    )

    await vi.waitFor(() => expect(receiver.getProgress().sessionState).toBe('failed'))
  })

  it('rejects transfer request with totalBytes mismatch', async () => {
    const transport = createMockTransport()
    const receiver = createTransferEngine({
      connection: createMockConnection(transport),
      localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
    })
    await receiver.start()

    transport.emitBinary(
      encodeJsonFrame(FrameType.TRANSFER_REQUEST, {
        transferSessionId: 'xfer_bad_total',
        senderDeviceId: 'dev_sender',
        senderDisplayName: 'Sender',
        files: [
          {
            fileId: 'file_1',
            name: 'a.txt',
            size: 10,
            mimeType: 'text/plain',
            lastModified: 0,
            index: 0,
            totalFiles: 1,
          },
        ],
        totalBytes: 999,
      }).buffer as ArrayBuffer,
    )

    await vi.waitFor(() => expect(receiver.getProgress().sessionState).toBe('idle'))
    expect(receiver.getProgress().incomingRequest).toBeNull()
  })

  it('rejects transfer request with too many files', async () => {
    const transport = createMockTransport()
    const receiver = createTransferEngine({
      connection: createMockConnection(transport),
      localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
    })
    await receiver.start()

    const files = Array.from(
      { length: TRANSFER_PROTOCOL.MAX_FILES_PER_TRANSFER + 1 },
      (_, index) => ({
        fileId: `file_${index}`,
        name: `f${index}.txt`,
        size: 1,
        mimeType: 'text/plain',
        lastModified: 0,
        index,
        totalFiles: TRANSFER_PROTOCOL.MAX_FILES_PER_TRANSFER + 1,
      }),
    )

    transport.emitBinary(
      encodeJsonFrame(FrameType.TRANSFER_REQUEST, {
        transferSessionId: 'xfer_many',
        senderDeviceId: 'dev_sender',
        senderDisplayName: 'Sender',
        files,
        totalBytes: files.length,
      }).buffer as ArrayBuffer,
    )

    await vi.waitFor(() => expect(receiver.getProgress().sessionState).toBe('idle'))
    expect(receiver.getProgress().incomingRequest).toBeNull()
  })

  it('rejects invalid filename in transfer request', async () => {
    const transport = createMockTransport()
    const receiver = createTransferEngine({
      connection: createMockConnection(transport),
      localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
    })
    await receiver.start()

    transport.emitBinary(
      encodeJsonFrame(FrameType.TRANSFER_REQUEST, {
        transferSessionId: 'xfer_bad_name',
        senderDeviceId: 'dev_sender',
        senderDisplayName: 'Sender',
        files: [
          {
            fileId: 'file_1',
            name: '../../evil.txt',
            size: 1,
            mimeType: 'text/plain',
            lastModified: 0,
            index: 0,
            totalFiles: 1,
          },
        ],
        totalBytes: 1,
      }).buffer as ArrayBuffer,
    )

    await vi.waitFor(() => expect(receiver.getProgress().sessionState).toBe('idle'))
    expect(receiver.getProgress().incomingRequest).toBeNull()
  })

  it('survives malformed binary frame without crashing', async () => {
    const transport = createMockTransport()
    const receiver = createTransferEngine({
      connection: createMockConnection(transport),
      localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
    })
    await receiver.start()

    transport.emitBinary(new Uint8Array([0, 1, 2]).buffer)

    await vi.waitFor(() => expect(receiver.getProgress().sessionState).toBe('failed'))
  })

  it('ignores late chunks after cancellation and stays cancelled', async () => {
    const transport = createMockTransport()
    const receiver = await startReceiverWithRequest(transport, {
      transferSessionId: 'xfer_cancel_late',
      senderDeviceId: 'dev_sender',
      senderDisplayName: 'Sender',
      files: [
        {
          fileId: 'file_1',
          name: 'a.txt',
          size: 4,
          mimeType: 'text/plain',
          lastModified: 0,
          index: 0,
          totalFiles: 1,
        },
      ],
      totalBytes: 4,
    })

    await receiver.acceptIncoming()
    transport.emitBinary(
      encodeJsonFrame(FrameType.FILE_START, {
        transferSessionId: 'xfer_cancel_late',
        file: {
          fileId: 'file_1',
          name: 'a.txt',
          size: 4,
          mimeType: 'text/plain',
          lastModified: 0,
          index: 0,
          totalFiles: 1,
        },
      }).buffer as ArrayBuffer,
    )

    await receiver.cancel()
    expect(receiver.getProgress().sessionState).toBe('cancelled')

    transport.emitBinary(
      encodeFileChunkFrame('file_1', 0, new Uint8Array([1, 2, 3, 4])).buffer as ArrayBuffer,
    )

    expect(receiver.getProgress().sessionState).toBe('cancelled')
    expect(receiver.getReceivedFiles()).toHaveLength(0)
  })

  it('exposes transport diagnostics through getDiagnostics', async () => {
    const transport = createMockTransport()
    const engine = createTransferEngine({
      connection: createMockConnection(transport),
      localDevice,
    })
    await engine.start()
    transport.send(new Uint8Array([1, 2, 3, 4, 5]))
    expect(engine.getDiagnostics().bytesSent).toBe(5)
    expect(engine.getDiagnostics().sessionState).toBe('idle')
  })

  it('rejects malformed frame via decodeFrame', () => {
    expect(() => decodeFrame(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer)).toThrow(
      ProtocolError,
    )
  })
})
