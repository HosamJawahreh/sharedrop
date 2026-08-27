import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react'
import { formatBytes, formatDuration, formatSpeed } from '@/core/transfer'
import { Button } from '@/components/ui'
import { useNearbySend } from './useNearbySend'
import { transferFailureCopy } from './connection-ux-copy'
import './TransferPanel.css'

function ProgressBar({ value, label }: { value: number; label: string }): ReactNode {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="transfer-progress" aria-label={label}>
      <div className="transfer-progress__track">
        <div className="transfer-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="transfer-progress__label">{percent}%</span>
    </div>
  )
}

function appendFiles(existing: readonly File[], incoming: FileList | File[]): File[] {
  return [...existing, ...Array.from(incoming)]
}

export function TransferPanel(): ReactNode {
  const {
    domain,
    selectFiles,
    removeSelectedFile,
    sendFiles,
    acceptIncomingTransfer,
    rejectIncomingTransfer,
    cancelTransfer,
    saveReceivedFiles,
    resetTransfer,
    transfer,
  } = useNearbySend()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)
  const { transferProgress, connectingDevice } = domain
  const deviceName = connectingDevice?.displayName ?? 'device'
  const selectedFiles = transfer.getSelectedFiles()
  const { sessionState, role, files, totalBytes, transferredBytes, bytesPerSecond, etaSeconds } =
    transferProgress
  const incoming = transferProgress.incomingRequest

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const list = event.target.files
    if (!list || list.length === 0) return
    selectFiles(appendFiles(transfer.getSelectedFiles(), list))
    event.target.value = ''
  }

  const onDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current += 1
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      dragDepth.current = 0
      setIsDragging(false)
      const dropped = event.dataTransfer.files
      if (!dropped || dropped.length === 0) return
      selectFiles(appendFiles(transfer.getSelectedFiles(), dropped))
    },
    [selectFiles, transfer],
  )

  const isIncoming =
    sessionState === 'awaiting_acceptance' && role === 'receiver' && incoming !== null
  const isSending = sessionState === 'awaiting_acceptance' && role === 'sender'
  const isTransferring = sessionState === 'transferring'
  const isComplete = sessionState === 'completed'
  const isFailed = sessionState === 'failed' || sessionState === 'cancelled'
  const activeFile = files.find((file) => file.status === 'transferring') ?? files[0]
  const activeFileIndex = activeFile
    ? files.findIndex((file) => file.fileId === activeFile.fileId) + 1
    : 0

  if (isComplete) {
    const fileCount = files.length
    return (
      <div className="transfer-panel transfer-panel--complete">
        <p className="transfer-panel__status transfer-panel__status--success">
          Transfer complete ✓
        </p>
        <p className="transfer-panel__summary">
          {role === 'receiver' ? 'Files successfully received.' : 'Files successfully sent.'}
          <br />
          {fileCount} file{fileCount === 1 ? '' : 's'} · {formatBytes(totalBytes)}
        </p>
        {role === 'receiver' ? (
          <Button
            className="transfer-panel__action"
            onClick={() => {
              saveReceivedFiles()
            }}
          >
            Save files
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="transfer-panel__action"
          onClick={() => {
            resetTransfer()
          }}
        >
          Send more
        </Button>
      </div>
    )
  }

  if (isFailed) {
    const copy = transferFailureCopy(sessionState === 'cancelled' ? 'cancelled' : 'failed')
    return (
      <div className="transfer-panel transfer-panel--failed">
        <p className="transfer-panel__status transfer-panel__status--error">{copy.title}</p>
        <p className="transfer-panel__hint">{copy.hint}</p>
        <Button
          className="transfer-panel__action"
          onClick={() => {
            resetTransfer()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (isIncoming && incoming) {
    return (
      <div className="transfer-panel transfer-panel--incoming">
        <p className="transfer-panel__heading">{incoming.senderDisplayName} wants to send you:</p>
        <p className="transfer-panel__summary">
          {incoming.files.length} file{incoming.files.length === 1 ? '' : 's'}
          <br />
          {formatBytes(incoming.totalBytes)}
        </p>
        <div className="transfer-panel__actions">
          <Button
            className="transfer-panel__action"
            onClick={() => {
              void acceptIncomingTransfer()
            }}
          >
            Accept
          </Button>
          <Button
            variant="ghost"
            className="transfer-panel__action"
            onClick={() => {
              void rejectIncomingTransfer()
            }}
          >
            Reject
          </Button>
        </div>
      </div>
    )
  }

  if (isSending || isTransferring) {
    const heading =
      role === 'receiver'
        ? `Receiving from ${deviceName}`
        : isSending
          ? `Waiting for ${deviceName}…`
          : `Sending to ${deviceName}`

    return (
      <div className="transfer-panel transfer-panel--active">
        <p className="transfer-panel__heading">{heading}</p>
        {isTransferring && files.length > 1 && activeFileIndex > 0 ? (
          <p className="transfer-panel__file-index">
            {activeFileIndex} of {files.length}
          </p>
        ) : null}
        {activeFile ? (
          <>
            <p className="transfer-panel__filename">
              {role === 'receiver' ? 'Receiving:' : 'Sending:'} {activeFile.name}
            </p>
            <ProgressBar value={activeFile.progress} label={`${activeFile.name} progress`} />
          </>
        ) : null}
        {isTransferring ? (
          <>
            <p className="transfer-panel__bytes">
              {formatBytes(transferredBytes)} / {formatBytes(totalBytes)}
            </p>
            {bytesPerSecond > 0 ? (
              <p className="transfer-panel__speed">{formatSpeed(bytesPerSecond)}</p>
            ) : null}
            {etaSeconds !== null ? (
              <p className="transfer-panel__eta">{formatDuration(etaSeconds)}</p>
            ) : null}
            <ProgressBar
              value={transferProgress.overallProgress}
              label="Overall transfer progress"
            />
            <Button
              variant="ghost"
              className="transfer-panel__action"
              onClick={() => {
                void cancelTransfer()
              }}
            >
              Cancel transfer
            </Button>
          </>
        ) : (
          <p className="transfer-panel__hint">Waiting for the other device to accept…</p>
        )}
      </div>
    )
  }

  return (
    <div
      className={[
        'transfer-panel',
        'transfer-panel--select',
        isDragging ? 'transfer-panel--dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="transfer-panel__input"
        aria-label="Select files to send"
        onChange={handleFileChange}
      />

      {selectedFiles.length === 0 ? (
        <>
          <Button
            className="transfer-panel__picker"
            onClick={() => {
              fileInputRef.current?.click()
            }}
          >
            Select files
          </Button>
          <p className="transfer-panel__drop-hint" aria-hidden={isDragging ? undefined : true}>
            {isDragging ? 'Drop files to send' : 'Or drag files here'}
          </p>
        </>
      ) : (
        <>
          <p className="transfer-panel__heading">Selected files</p>
          <p className="transfer-panel__summary">
            {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'}
            <br />
            {formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0))} total
          </p>
          <ul className="transfer-panel__file-list">
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className="transfer-panel__file"
              >
                <div className="transfer-panel__file-info">
                  <span className="transfer-panel__filename">{file.name}</span>
                  <span className="transfer-panel__filesize">{formatBytes(file.size)}</span>
                </div>
                <Button
                  variant="ghost"
                  className="transfer-panel__remove"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => {
                    removeSelectedFile(index)
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          {isDragging ? (
            <p className="transfer-panel__drop-hint" role="status">
              Drop to add more files
            </p>
          ) : null}
          <div className="transfer-panel__actions">
            <Button
              variant="ghost"
              onClick={() => {
                fileInputRef.current?.click()
              }}
            >
              Add more
            </Button>
            <Button
              className="transfer-panel__action"
              onClick={() => {
                void sendFiles()
              }}
            >
              Send
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
