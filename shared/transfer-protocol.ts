/** ShareDrop binary transfer protocol over WebRTC DataChannel. */

/** Default WebRTC SCTP max message size; encoded frames must fit within this limit. */
const SCTP_MAX_MESSAGE_BYTES = 256 * 1024

/** Worst-case FILE_CHUNK inner payload overhead: file-id length prefix + max file id + chunk index. */
const FILE_CHUNK_PAYLOAD_OVERHEAD = 2 + 128 + 4

export const TRANSFER_PROTOCOL = {
  MAGIC: 0x53,
  VERSION: 1,
  HEADER_SIZE: 7,
  SCTP_MAX_MESSAGE_BYTES,
  DEFAULT_CHUNK_SIZE: SCTP_MAX_MESSAGE_BYTES - 7 - FILE_CHUNK_PAYLOAD_OVERHEAD,
  MAX_CHUNK_SIZE: 1024 * 1024,
  BUFFERED_AMOUNT_HIGH: 1024 * 1024,
  BUFFERED_AMOUNT_LOW: 256 * 1024,
  MAX_FILES_PER_TRANSFER: 100,
  /**
   * No artificial marketing-style per-file / total-byte ceiling.
   * Practical limits are device RAM, browser Blob limits, connection, and storage.
   * Protocol still bounds chunk size, filename length, and files-per-transfer.
   */
  MAX_FILENAME_LENGTH: 255,
  MAX_FILE_ID_LENGTH: 128,
  MAX_TRANSFER_SESSION_ID_LENGTH: 128,
  PROGRESS_EMIT_INTERVAL_MS: 100,
} as const

export const FrameType = {
  TRANSFER_REQUEST: 1,
  TRANSFER_ACCEPT: 2,
  TRANSFER_REJECT: 3,
  FILE_START: 4,
  FILE_CHUNK: 5,
  FILE_END: 6,
  TRANSFER_COMPLETE: 7,
  TRANSFER_CANCEL: 8,
  TRANSFER_ERROR: 9,
} as const

export type FrameTypeValue = (typeof FrameType)[keyof typeof FrameType]

export interface FileDescriptor {
  fileId: string
  name: string
  size: number
  mimeType: string
  lastModified: number
  index: number
  totalFiles: number
}

export interface TransferRequestPayload {
  transferSessionId: string
  senderDeviceId: string
  senderDisplayName: string
  files: FileDescriptor[]
  totalBytes: number
}

export interface FileStartPayload {
  transferSessionId: string
  file: FileDescriptor
}

export interface FileEndPayload {
  transferSessionId: string
  fileId: string
  size: number
  sha256: string
}

export interface TransferErrorPayload {
  transferSessionId: string
  code: string
  message: string
}

export type TransferSessionState =
  | 'idle'
  | 'preparing'
  | 'awaiting_acceptance'
  | 'transferring'
  | 'completed'
  | 'cancelled'
  | 'failed'

export interface TransferFileProgress {
  fileId: string
  name: string
  size: number
  bytesTransferred: number
  progress: number
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled'
}

export interface TransferProgressView {
  sessionState: TransferSessionState
  role: 'sender' | 'receiver' | null
  files: readonly TransferFileProgress[]
  totalBytes: number
  transferredBytes: number
  overallProgress: number
  bytesPerSecond: number
  etaSeconds: number | null
  incomingRequest: TransferRequestPayload | null
}

export interface ReceivedFile {
  fileId: string
  name: string
  size: number
  mimeType: string
  blob: Blob
  sha256: string
}
