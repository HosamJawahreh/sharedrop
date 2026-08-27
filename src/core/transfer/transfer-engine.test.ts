import { describe, expect, it, vi } from 'vitest'
import { FrameType } from '../../../shared/transfer-protocol'
import { encodeFileChunkFrame, encodeJsonFrame } from '../../../shared/transfer-frame'
import type { ConnectionEngine, ConnectionState } from '@/core/connection'
import type { DataChannelTransport } from './data-channel-transport'
import { createTransferEngine } from './transfer-engine'

interface MockTransport extends DataChannelTransport {
  emitBinary: (data: ArrayBuffer) => void
  emitLow: () => void
  sent: Uint8Array[]
}

function createMockTransport(): MockTransport {
  const binaryListeners = new Set<(data: ArrayBuffer) => void>()
  const lowListeners = new Set<() => void>()
  const sent: Uint8Array[] = []
  let bufferedAmount = 0

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
    getDiagnostics() {
      return {
        bytesSent: sent.reduce((sum, frame) => sum + frame.byteLength, 0),
        bytesReceived: 0,
        bufferedAmount,
        bufferedAmountLowThreshold: null,
        state: 'open' as const,
      }
    },
    getState() {
      return 'open' as const
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
    emitLow() {
      bufferedAmount = 0
      for (const listener of lowListeners) listener()
    },
  }
}

function relay(from: MockTransport, to: MockTransport): void {
  const originalSend = from.send.bind(from)
  from.send = (data) => {
    originalSend(data)
    queueMicrotask(() => {
      to.emitBinary(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
      )
    })
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

describe('createTransferEngine', () => {
  it('validates selected files and tracks progress', () => {
    const transport = createMockTransport()
    const engine = createTransferEngine({
      connection: createMockConnection(transport),
      localDevice,
    })

    engine.setSelectedFiles([new File(['hello'], 'hello.txt', { type: 'text/plain' })])
    const progress = engine.getProgress()
    expect(progress.sessionState).toBe('preparing')
    expect(progress.files).toHaveLength(1)
    expect(progress.totalBytes).toBe(5)
  })

  it('completes a single-file transfer over relayed mock transport', async () => {
    const senderTransport = createMockTransport()
    const receiverTransport = createMockTransport()
    relay(senderTransport, receiverTransport)
    relay(receiverTransport, senderTransport)

    const sender = createTransferEngine({
      connection: createMockConnection(senderTransport),
      localDevice,
      chunkSize: 2,
    })
    const receiver = createTransferEngine({
      connection: createMockConnection(receiverTransport),
      localDevice: {
        ...localDevice,
        deviceId: 'dev_remote',
        displayName: 'iPhone',
        deviceType: 'phone',
        platform: 'ios',
      },
      chunkSize: 2,
    })

    await sender.start()
    await receiver.start()
    sender.setSelectedFiles([new File(['hello'], 'hello.txt', { type: 'text/plain' })])

    const receiverDone = new Promise<void>((resolve, reject) => {
      const unsub = receiver.subscribeProgress((progress) => {
        if (progress.sessionState === 'completed') {
          unsub()
          resolve()
        } else if (progress.sessionState === 'failed') {
          unsub()
          reject(new Error('Receiver failed'))
        }
      })
    })

    const sendPromise = sender.sendPrepared()

    await vi.waitFor(() => {
      expect(receiver.getProgress().incomingRequest).not.toBeNull()
    })

    await receiver.acceptIncoming()
    await sendPromise
    await receiverDone

    const received = receiver.getReceivedFiles()
    expect(received).toHaveLength(1)
    expect(received[0]?.name).toBe('hello.txt')
    expect(received[0]?.size).toBe(5)
    expect(await received[0]!.blob.text()).toBe('hello')
  })

  it('supports zero-byte files', async () => {
    const senderTransport = createMockTransport()
    const receiverTransport = createMockTransport()
    relay(senderTransport, receiverTransport)
    relay(receiverTransport, senderTransport)

    const sender = createTransferEngine({
      connection: createMockConnection(senderTransport),
      localDevice,
    })
    const receiver = createTransferEngine({
      connection: createMockConnection(receiverTransport),
      localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
    })

    await sender.start()
    await receiver.start()
    sender.setSelectedFiles([new File([], 'empty.txt', { type: 'text/plain' })])

    const receiverDone = new Promise<void>((resolve) => {
      const unsub = receiver.subscribeProgress((progress) => {
        if (progress.sessionState === 'completed') {
          unsub()
          resolve()
        }
      })
    })

    const sendPromise = sender.sendPrepared()
    await vi.waitFor(() => expect(receiver.getProgress().incomingRequest).not.toBeNull())
    await receiver.acceptIncoming()
    await sendPromise
    await receiverDone

    expect(receiver.getReceivedFiles()[0]?.size).toBe(0)
  })

  it('pauses on full buffer and resumes on bufferedamountlow', async () => {
    let bufferedAmount = 2 * 1024 * 1024
    const senderTransport = createMockTransport()
    const receiverTransport = createMockTransport()
    senderTransport.getBufferedAmount = () => bufferedAmount
    senderTransport.setBufferedAmountLowThreshold = () => {}
    senderTransport.getBufferedAmountLowThreshold = () => 256 * 1024
    const originalSubscribeLow = senderTransport.subscribeBufferedAmountLow.bind(senderTransport)
    senderTransport.subscribeBufferedAmountLow = (listener) => {
      const unsub = originalSubscribeLow(listener)
      queueMicrotask(() => {
        bufferedAmount = 0
        listener()
      })
      return unsub
    }

    relay(senderTransport, receiverTransport)
    relay(receiverTransport, senderTransport)

    const sender = createTransferEngine({
      connection: createMockConnection(senderTransport),
      localDevice,
      chunkSize: 1024,
    })
    const receiver = createTransferEngine({
      connection: createMockConnection(receiverTransport),
      localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
      chunkSize: 1024,
    })

    await sender.start()
    await receiver.start()
    sender.setSelectedFiles([
      new File([new Uint8Array(4096)], 'chunky.bin', { type: 'application/octet-stream' }),
    ])

    const receiverDone = new Promise<void>((resolve) => {
      const unsub = receiver.subscribeProgress((progress) => {
        if (progress.sessionState === 'completed') {
          unsub()
          resolve()
        }
      })
    })

    const sendPromise = sender.sendPrepared()
    await vi.waitFor(() => expect(receiver.getProgress().incomingRequest).not.toBeNull())
    await receiver.acceptIncoming()
    await sendPromise
    await receiverDone

    expect(sender.getDiagnostics().backpressurePauseCount).toBeGreaterThan(0)
    expect(new Uint8Array(await receiver.getReceivedFiles()[0]!.blob.arrayBuffer())).toHaveLength(
      4096,
    )
  })

  it('rejects malformed chunk sequence', async () => {
    const transport = createMockTransport()
    const receiver = createTransferEngine({
      connection: createMockConnection(transport),
      localDevice: { ...localDevice, deviceId: 'dev_remote', displayName: 'Receiver' },
    })

    await receiver.start()

    transport.emitBinary(
      encodeJsonFrame(FrameType.TRANSFER_REQUEST, {
        transferSessionId: 'xfer_1',
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
      }).buffer as ArrayBuffer,
    )

    await vi.waitFor(() => expect(receiver.getProgress().incomingRequest).not.toBeNull())
    await receiver.acceptIncoming()

    transport.emitBinary(
      encodeJsonFrame(FrameType.FILE_START, {
        transferSessionId: 'xfer_1',
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
      encodeFileChunkFrame('file_1', 1, new Uint8Array([1, 2, 3, 4])).buffer as ArrayBuffer,
    )

    await vi.waitFor(() => {
      expect(receiver.getProgress().sessionState).toBe('failed')
    })
  })
})
