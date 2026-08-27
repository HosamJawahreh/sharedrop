import {
  FrameType,
  TRANSFER_PROTOCOL,
  type FileDescriptor,
  type FileEndPayload,
  type FileStartPayload,
  type FrameTypeValue,
  type ReceivedFile,
  type TransferErrorPayload,
  type TransferFileProgress,
  type TransferProgressView,
  type TransferRequestPayload,
  type TransferSessionState,
} from '../../../shared/transfer-protocol'
import {
  decodeFileChunkPayload,
  decodeFrame,
  decodeJsonPayload,
  encodeFileChunkFrame,
  encodeJsonFrame,
  ProtocolError,
} from '../../../shared/transfer-frame'
import type { ConnectionEngine } from '@/core/connection'
import type { LocalDeviceInfo } from '@/core/device'
import { TransferError } from '@/core/errors'
import { createId } from '@/utils/id'
import type { DataChannelTransport } from './data-channel-transport'
import { type TransferDiagnostics } from './diagnostics'
import { sanitizeFilename } from './filename'
import { StreamingSha256 } from './integrity'

export interface TransferEngine {
  getProgress(): TransferProgressView
  getReceivedFiles(): readonly ReceivedFile[]
  setSelectedFiles(files: readonly File[]): void
  getSelectedFiles(): readonly File[]
  removeSelectedFile(index: number): void
  sendPrepared(): Promise<void>
  acceptIncoming(): Promise<void>
  rejectIncoming(): Promise<void>
  cancel(): Promise<void>
  downloadReceivedFile(fileId: string): void
  downloadAllReceived(): void
  reset(): void
  getDiagnostics(): TransferDiagnostics
  subscribeProgress(listener: (progress: TransferProgressView) => void): () => void
  start(): Promise<void>
  stop(): void
}

export interface TransferEngineOptions {
  connection: ConnectionEngine
  localDevice: LocalDeviceInfo
  chunkSize?: number
}

interface ActiveReceiveFile {
  descriptor: FileDescriptor
  chunks: Uint8Array[]
  receivedBytes: number
  expectedChunkIndex: number
  hasher: StreamingSha256
}

export function createTransferEngine(options: TransferEngineOptions): TransferEngine {
  const { connection, localDevice } = options
  const chunkSize = options.chunkSize ?? TRANSFER_PROTOCOL.DEFAULT_CHUNK_SIZE

  let transport: DataChannelTransport | null = null
  let sessionState: TransferSessionState = 'idle'
  let role: 'sender' | 'receiver' | null = null
  let transferSessionId: string | null = null
  let selectedFiles: File[] = []
  let preparedDescriptors: FileDescriptor[] = []
  let incomingRequest: TransferRequestPayload | null = null
  let receivedFiles: ReceivedFile[] = []
  let fileProgress = new Map<string, TransferFileProgress>()
  let totalBytes = 0
  let transferredBytes = 0
  let activeReceive: ActiveReceiveFile | null = null
  let cancelRequested = false
  let speedWindowStart = Date.now()
  let speedWindowBytes = 0
  let bytesPerSecond = 0
  let lastProgressEmit = 0
  let peakBufferedAmount = 0
  let backpressurePauseCount = 0
  let transferStartedAt: number | null = null
  let transferCompletedAt: number | null = null
  const progressListeners = new Set<(progress: TransferProgressView) => void>()
  const unsubscribers: Array<() => void> = []

  const emitProgress = (force = false): void => {
    const now = Date.now()
    if (!force && now - lastProgressEmit < TRANSFER_PROTOCOL.PROGRESS_EMIT_INTERVAL_MS) {
      return
    }
    lastProgressEmit = now
    for (const listener of progressListeners) {
      listener(getProgress())
    }
  }

  const updateSpeed = (bytes: number): void => {
    speedWindowBytes += bytes
    const elapsed = (Date.now() - speedWindowStart) / 1000
    if (elapsed >= 0.5) {
      bytesPerSecond = speedWindowBytes / elapsed
      speedWindowStart = Date.now()
      speedWindowBytes = 0
    }
  }

  const getProgress = (): TransferProgressView => {
    const overallProgress = totalBytes > 0 ? transferredBytes / totalBytes : 0
    const remaining = bytesPerSecond > 0 ? (totalBytes - transferredBytes) / bytesPerSecond : null
    return {
      sessionState,
      role,
      files: Array.from(fileProgress.values()),
      totalBytes,
      transferredBytes,
      overallProgress,
      bytesPerSecond,
      etaSeconds: remaining,
      incomingRequest,
    }
  }

  const fail = (userMessage: string, technicalMessage: string): never => {
    sessionState = 'failed'
    emitProgress(true)
    throw new TransferError({ userMessage, technicalMessage })
  }

  const sendFrame = (type: FrameTypeValue, payload?: unknown): void => {
    if (!transport || transport.getState() !== 'open') {
      throw new TransferError({
        userMessage: 'Transfer channel is not ready.',
        technicalMessage: 'Transfer transport unavailable',
      })
    }
    const frame = payload === undefined ? encodeJsonFrame(type, {}) : encodeJsonFrame(type, payload)
    transport.send(frame)
  }

  const validateIncomingRequest = (request: TransferRequestPayload): void => {
    if (
      !request.transferSessionId ||
      request.transferSessionId.length > TRANSFER_PROTOCOL.MAX_TRANSFER_SESSION_ID_LENGTH
    ) {
      throw new ProtocolError('Invalid transfer session id')
    }
    if (!request.files || request.files.length === 0) {
      throw new ProtocolError('Transfer request has no files')
    }
    if (request.files.length > TRANSFER_PROTOCOL.MAX_FILES_PER_TRANSFER) {
      throw new ProtocolError('Too many files in transfer request')
    }

    let computedTotal = 0
    for (const file of request.files) {
      if (!file.fileId || file.fileId.length > TRANSFER_PROTOCOL.MAX_FILE_ID_LENGTH) {
        throw new ProtocolError('Invalid file id in transfer request')
      }
      const name = sanitizeFilename(file.name)
      if (!name) throw new ProtocolError('Invalid filename in transfer request')
      if (!Number.isFinite(file.size) || file.size < 0) {
        throw new ProtocolError('Invalid file size in transfer request')
      }
      computedTotal += file.size
    }

    if (computedTotal !== request.totalBytes) {
      throw new ProtocolError('Transfer totalBytes mismatch')
    }
  }

  const applySelectedFiles = (files: readonly File[]): void => {
    selectedFiles = [...files]
    if (selectedFiles.length === 0) {
      preparedDescriptors = []
      if (sessionState === 'preparing') {
        sessionState = 'idle'
      }
      fileProgress.clear()
      totalBytes = 0
      transferredBytes = 0
      emitProgress(true)
      return
    }
    sessionState = 'preparing'
    preparedDescriptors = validateFiles(selectedFiles)
    fileProgress = new Map(
      preparedDescriptors.map((file) => [
        file.fileId,
        {
          fileId: file.fileId,
          name: file.name,
          size: file.size,
          bytesTransferred: 0,
          progress: 0,
          status: 'pending',
        },
      ]),
    )
    transferredBytes = 0
    emitProgress(true)
  }

  const resetSession = (): void => {
    sessionState = 'idle'
    role = null
    transferSessionId = null
    selectedFiles = []
    preparedDescriptors = []
    incomingRequest = null
    receivedFiles = []
    fileProgress.clear()
    totalBytes = 0
    transferredBytes = 0
    activeReceive = null
    cancelRequested = false
    bytesPerSecond = 0
    speedWindowBytes = 0
    speedWindowStart = Date.now()
    transferStartedAt = null
    transferCompletedAt = null
    peakBufferedAmount = 0
    backpressurePauseCount = 0
    emitProgress(true)
  }

  const validateFiles = (files: readonly File[]): FileDescriptor[] => {
    if (files.length === 0) {
      fail('Select at least one file.', 'No files selected')
    }
    if (files.length > TRANSFER_PROTOCOL.MAX_FILES_PER_TRANSFER) {
      fail('Too many files selected.', 'Exceeded max files per transfer')
    }

    let total = 0
    const descriptors: FileDescriptor[] = []

    files.forEach((file, index) => {
      const name = sanitizeFilename(file.name)
      if (!name) {
        fail('One of the selected files has an invalid name.', `Invalid filename: ${file.name}`)
      }
      if (!Number.isFinite(file.size) || file.size < 0) {
        fail('One of the selected files has an invalid size.', `Invalid size: ${file.name}`)
      }
      total += file.size
      descriptors.push({
        fileId: createId('file'),
        name: name!,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        index,
        totalFiles: files.length,
      })
    })

    totalBytes = total
    return descriptors
  }

  const markTransferStarted = (): void => {
    if (transferStartedAt === null) {
      transferStartedAt = Date.now()
    }
    transferCompletedAt = null
  }

  const markTransferCompleted = (): void => {
    if (transferCompletedAt === null) {
      transferCompletedAt = Date.now()
    }
  }

  const getDiagnostics = (): TransferDiagnostics => {
    const transportDiagnostics = transport?.getDiagnostics()
    const durationMs =
      transferStartedAt !== null ? (transferCompletedAt ?? Date.now()) - transferStartedAt : null
    const averageThroughputBytesPerSecond =
      durationMs !== null && durationMs > 0 ? transferredBytes / (durationMs / 1000) : null

    return {
      sessionState,
      role,
      bytesSent: transportDiagnostics?.bytesSent ?? 0,
      bytesReceived: transportDiagnostics?.bytesReceived ?? 0,
      bufferedAmount: transportDiagnostics?.bufferedAmount ?? 0,
      bufferedAmountLowThreshold: transportDiagnostics?.bufferedAmountLowThreshold ?? null,
      peakBufferedAmount,
      backpressurePauseCount,
      transferStartedAt,
      transferCompletedAt,
      transferDurationMs: durationMs,
      averageThroughputBytesPerSecond,
    }
  }

  const waitForBuffer = async (): Promise<void> => {
    if (!transport) return
    while (
      transport.getBufferedAmount() > TRANSFER_PROTOCOL.BUFFERED_AMOUNT_HIGH &&
      !cancelRequested &&
      transport.getState() === 'open'
    ) {
      peakBufferedAmount = Math.max(peakBufferedAmount, transport.getBufferedAmount())
      backpressurePauseCount += 1
      await new Promise<void>((resolve) => {
        const current = transport!
        let settled = false
        const finish = (): void => {
          if (settled) return
          settled = true
          clearInterval(poll)
          unsubLow()
          unsubClose()
          resolve()
        }
        const unsubLow = current.subscribeBufferedAmountLow(finish)
        const unsubClose = current.subscribeClose(finish)
        const poll = setInterval(() => {
          if (cancelRequested || current.getState() !== 'open') {
            finish()
          }
        }, 100)
      })
    }
  }

  const sendFile = async (file: File, descriptor: FileDescriptor): Promise<void> => {
    const hasher = new StreamingSha256()
    let offset = 0
    let chunkIndex = 0

    fileProgress.set(descriptor.fileId, {
      fileId: descriptor.fileId,
      name: descriptor.name,
      size: descriptor.size,
      bytesTransferred: 0,
      progress: 0,
      status: 'transferring',
    })
    emitProgress(true)

    sendFrame(FrameType.FILE_START, {
      transferSessionId: transferSessionId!,
      file: descriptor,
    } satisfies FileStartPayload)

    while (offset < file.size && !cancelRequested) {
      const end = Math.min(offset + chunkSize, file.size)
      const slice = file.slice(offset, end)
      const buffer = new Uint8Array(await slice.arrayBuffer())
      hasher.update(buffer)

      await waitForBuffer()
      if (!transport || transport.getState() !== 'open' || cancelRequested) break

      try {
        transport.send(encodeFileChunkFrame(descriptor.fileId, chunkIndex, buffer))
      } catch {
        sessionState = 'failed'
        emitProgress(true)
        return
      }

      offset = end
      chunkIndex += 1
      transferredBytes += buffer.byteLength

      const progress = fileProgress.get(descriptor.fileId)
      if (progress) {
        progress.bytesTransferred = offset
        progress.progress = descriptor.size > 0 ? offset / descriptor.size : 1
        fileProgress.set(descriptor.fileId, progress)
      }

      updateSpeed(buffer.byteLength)
      emitProgress()
    }

    if (cancelRequested || sessionState === 'failed') return
    if (!transport || transport.getState() !== 'open') {
      sessionState = 'failed'
      emitProgress(true)
      return
    }

    sendFrame(FrameType.FILE_END, {
      transferSessionId: transferSessionId!,
      fileId: descriptor.fileId,
      size: descriptor.size,
      sha256: hasher.digestHex(),
    } satisfies FileEndPayload)

    const progress = fileProgress.get(descriptor.fileId)
    if (progress) {
      progress.status = 'completed'
      progress.progress = 1
      progress.bytesTransferred = descriptor.size
      fileProgress.set(descriptor.fileId, progress)
    }
    emitProgress(true)
  }

  const finalizeReceivedFile = (sha256: string): void => {
    if (!activeReceive) return
    const { descriptor, chunks, receivedBytes } = activeReceive
    if (receivedBytes !== descriptor.size) {
      activeReceive = null
      fail('Received file size did not match.', 'Size mismatch on receiver')
    }

    const blob = new Blob(chunks as BlobPart[], { type: descriptor.mimeType })
    activeReceive = null

    receivedFiles.push({
      fileId: descriptor.fileId,
      name: descriptor.name,
      size: descriptor.size,
      mimeType: descriptor.mimeType,
      blob,
      sha256,
    })

    const progress = fileProgress.get(descriptor.fileId)
    if (progress) {
      progress.status = 'completed'
      progress.progress = 1
      progress.bytesTransferred = descriptor.size
      fileProgress.set(descriptor.fileId, progress)
    }
    emitProgress(true)
  }

  const handleControlFrame = async (type: number, payload: Uint8Array): Promise<void> => {
    switch (type) {
      case FrameType.TRANSFER_REQUEST: {
        let request: TransferRequestPayload
        try {
          request = decodeJsonPayload<TransferRequestPayload>(payload)
          validateIncomingRequest(request)
        } catch {
          sendFrame(FrameType.TRANSFER_REJECT, {
            transferSessionId: 'unknown',
            code: 'INVALID',
            message: 'Invalid transfer request',
          })
          return
        }
        if (sessionState !== 'idle') {
          sendFrame(FrameType.TRANSFER_REJECT, {
            transferSessionId: request.transferSessionId,
            code: 'BUSY',
            message: 'Receiver busy',
          })
          return
        }
        incomingRequest = request
        transferSessionId = request.transferSessionId
        role = 'receiver'
        sessionState = 'awaiting_acceptance'
        totalBytes = request.totalBytes
        fileProgress = new Map(
          request.files.map((file) => [
            file.fileId,
            {
              fileId: file.fileId,
              name: file.name,
              size: file.size,
              bytesTransferred: 0,
              progress: 0,
              status: 'pending',
            },
          ]),
        )
        emitProgress(true)
        break
      }
      case FrameType.TRANSFER_ACCEPT: {
        if (role !== 'sender' || sessionState !== 'awaiting_acceptance') return
        sessionState = 'transferring'
        markTransferStarted()
        emitProgress(true)
        await sendAllFiles()
        break
      }
      case FrameType.TRANSFER_REJECT: {
        sessionState = 'failed'
        emitProgress(true)
        break
      }
      case FrameType.FILE_START: {
        const start = decodeJsonPayload<FileStartPayload>(payload)
        if (sessionState !== 'transferring' && sessionState !== 'awaiting_acceptance') {
          throw new ProtocolError('Unexpected FILE_START')
        }
        sessionState = 'transferring'
        markTransferStarted()
        const name = sanitizeFilename(start.file.name)
        if (!name) throw new ProtocolError('Invalid filename in FILE_START')
        activeReceive = {
          descriptor: { ...start.file, name },
          chunks: [],
          receivedBytes: 0,
          expectedChunkIndex: 0,
          hasher: new StreamingSha256(),
        }
        const progress = fileProgress.get(start.file.fileId)
        if (progress) {
          progress.status = 'transferring'
          fileProgress.set(start.file.fileId, progress)
        }
        emitProgress(true)
        break
      }
      case FrameType.FILE_END: {
        const end = decodeJsonPayload<FileEndPayload>(payload)
        if (!activeReceive || activeReceive.descriptor.fileId !== end.fileId) {
          throw new ProtocolError('Unexpected FILE_END')
        }
        if (activeReceive.receivedBytes !== end.size) {
          fail('Received file was incomplete.', 'File size mismatch before hash')
        }
        const hash = activeReceive.hasher.digestHex()
        if (hash !== end.sha256) {
          activeReceive = null
          fail('Received file failed integrity check.', 'Hash mismatch')
        }
        finalizeReceivedFile(hash)
        break
      }
      case FrameType.TRANSFER_COMPLETE: {
        sessionState = 'completed'
        markTransferCompleted()
        emitProgress(true)
        break
      }
      case FrameType.TRANSFER_CANCEL: {
        cancelRequested = true
        sessionState = 'cancelled'
        activeReceive = null
        emitProgress(true)
        break
      }
      case FrameType.TRANSFER_ERROR: {
        decodeJsonPayload<TransferErrorPayload>(payload)
        sessionState = 'failed'
        emitProgress(true)
        break
      }
      default:
        throw new ProtocolError(`Unexpected frame type: ${type}`)
    }
  }

  const handleBinaryFrame = (buffer: ArrayBuffer): void => {
    if (
      sessionState === 'cancelled' ||
      sessionState === 'failed' ||
      sessionState === 'completed' ||
      cancelRequested
    ) {
      return
    }

    try {
      const frame = decodeFrame(buffer)
      if (frame.type === FrameType.FILE_CHUNK) {
        if (!activeReceive) throw new ProtocolError('Unexpected FILE_CHUNK')
        const chunk = decodeFileChunkPayload(frame.payload)
        if (chunk.fileId !== activeReceive.descriptor.fileId) {
          throw new ProtocolError('Unexpected file id in chunk')
        }
        if (chunk.chunkIndex !== activeReceive.expectedChunkIndex) {
          throw new ProtocolError('Unexpected chunk sequence')
        }
        activeReceive.expectedChunkIndex += 1
        activeReceive.receivedBytes += chunk.data.byteLength
        activeReceive.hasher.update(chunk.data)
        activeReceive.chunks.push(chunk.data)
        transferredBytes += chunk.data.byteLength

        const progress = fileProgress.get(chunk.fileId)
        if (progress) {
          progress.bytesTransferred = activeReceive.receivedBytes
          progress.progress =
            activeReceive.descriptor.size > 0
              ? activeReceive.receivedBytes / activeReceive.descriptor.size
              : 1
          fileProgress.set(chunk.fileId, progress)
        }
        updateSpeed(chunk.data.byteLength)
        emitProgress()
        return
      }

      void handleControlFrame(frame.type, frame.payload).catch(() => {
        sessionState = 'failed'
        emitProgress(true)
      })
    } catch {
      sessionState = 'failed'
      emitProgress(true)
    }
  }

  const sendAllFiles = async (): Promise<void> => {
    cancelRequested = false
    peakBufferedAmount = 0
    backpressurePauseCount = 0
    markTransferStarted()
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]
        const descriptor = preparedDescriptors[index]
        if (!file || !descriptor) continue
        await sendFile(file, descriptor)
        if (cancelRequested) {
          sessionState = 'cancelled'
          emitProgress(true)
          return
        }
        if (sessionState === 'failed') {
          emitProgress(true)
          return
        }
      }

      if (!transport || transport.getState() !== 'open') {
        sessionState = 'failed'
        emitProgress(true)
        return
      }

      sendFrame(FrameType.TRANSFER_COMPLETE, { transferSessionId: transferSessionId! })
      sessionState = 'completed'
      markTransferCompleted()
      emitProgress(true)
    } catch {
      if (sessionState === 'transferring' || sessionState === 'awaiting_acceptance') {
        sessionState = 'failed'
        emitProgress(true)
      }
    }
  }

  const attachTransport = (nextTransport: DataChannelTransport): void => {
    transport = nextTransport
    transport.setBufferedAmountLowThreshold(TRANSFER_PROTOCOL.BUFFERED_AMOUNT_LOW)
    unsubscribers.push(transport.subscribeBinary(handleBinaryFrame))
    unsubscribers.push(
      transport.subscribeClose(() => {
        if (sessionState === 'transferring' || sessionState === 'awaiting_acceptance') {
          sessionState = 'failed'
          emitProgress(true)
        }
      }),
    )
  }

  return {
    async start(): Promise<void> {
      if (connection.getState() !== 'connected') return
      const readyTransport = await connection.whenTransferTransportReady()
      attachTransport(readyTransport)
      unsubscribers.push(
        connection.subscribe((next) => {
          if (
            (next === 'disconnected' || next === 'failed') &&
            (sessionState === 'transferring' || sessionState === 'awaiting_acceptance')
          ) {
            sessionState = 'failed'
            emitProgress(true)
          }
        }),
      )
    },

    stop(): void {
      for (const unsub of unsubscribers.splice(0)) {
        unsub()
      }
      transport = null
    },

    getProgress(): TransferProgressView {
      return getProgress()
    },

    getReceivedFiles(): readonly ReceivedFile[] {
      return receivedFiles
    },

    setSelectedFiles(files: readonly File[]): void {
      applySelectedFiles(files)
    },

    getSelectedFiles(): readonly File[] {
      return selectedFiles
    },

    removeSelectedFile(index: number): void {
      applySelectedFiles(selectedFiles.filter((_, i) => i !== index))
    },

    async sendPrepared(): Promise<void> {
      if (selectedFiles.length === 0) {
        fail('Select at least one file.', 'No files selected')
      }
      if (!transport) {
        await this.start()
      }
      role = 'sender'
      transferSessionId = createId('xfer')
      sessionState = 'awaiting_acceptance'
      emitProgress(true)

      sendFrame(FrameType.TRANSFER_REQUEST, {
        transferSessionId,
        senderDeviceId: localDevice.deviceId,
        senderDisplayName: localDevice.displayName,
        files: preparedDescriptors,
        totalBytes,
      } satisfies TransferRequestPayload)

      await new Promise<void>((resolve, reject) => {
        const unsub = this.subscribeProgress((progress) => {
          if (progress.sessionState === 'completed') {
            unsub()
            resolve()
          } else if (progress.sessionState === 'failed' || progress.sessionState === 'cancelled') {
            unsub()
            reject(
              new TransferError({
                userMessage: 'Transfer failed.',
                technicalMessage: `Transfer ended in ${progress.sessionState}`,
              }),
            )
          }
        })
      })
    },

    async acceptIncoming(): Promise<void> {
      if (!incomingRequest || !transport) {
        fail('No incoming transfer to accept.', 'Missing incoming request')
      }
      sendFrame(FrameType.TRANSFER_ACCEPT, { transferSessionId: transferSessionId! })
      sessionState = 'transferring'
      markTransferStarted()
      incomingRequest = null
      emitProgress(true)
    },

    async rejectIncoming(): Promise<void> {
      if (!incomingRequest) return
      sendFrame(FrameType.TRANSFER_REJECT, {
        transferSessionId: transferSessionId ?? incomingRequest.transferSessionId,
        code: 'REJECTED',
        message: 'Rejected by user',
      })
      incomingRequest = null
      sessionState = 'idle'
      emitProgress(true)
    },

    async cancel(): Promise<void> {
      cancelRequested = true
      if (transferSessionId && transport?.getState() === 'open') {
        try {
          sendFrame(FrameType.TRANSFER_CANCEL, { transferSessionId })
        } catch {
          // Channel may already be closing; local cancellation still applies.
        }
      }
      sessionState = 'cancelled'
      activeReceive = null
      emitProgress(true)
    },

    downloadReceivedFile(fileId: string): void {
      const file = receivedFiles.find((entry) => entry.fileId === fileId)
      if (!file) return
      const url = URL.createObjectURL(file.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.click()
      URL.revokeObjectURL(url)
    },

    downloadAllReceived(): void {
      for (const file of receivedFiles) {
        this.downloadReceivedFile(file.fileId)
      }
    },

    reset(): void {
      resetSession()
    },

    getDiagnostics(): TransferDiagnostics {
      return getDiagnostics()
    },

    subscribeProgress(listener: (progress: TransferProgressView) => void): () => void {
      progressListeners.add(listener)
      listener(getProgress())
      return () => progressListeners.delete(listener)
    },
  }
}
