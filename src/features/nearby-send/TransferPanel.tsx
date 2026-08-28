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
import { DeviceRoleCard } from './DeviceRoleCard'
import { transferFailureCopy } from './connection-ux-copy'
import { AirdropWave, ConnectionPulse } from './motion'
import { TransferProgressRing } from './TransferProgressRing'
import { SuccessMark } from './SuccessMark'
import { TransferStage } from './TransferStage'
import { useTransferFlowSounds } from './ux/useFlowSounds'
import './TransferPanel.css'
import './SuccessMark.css'
import './TransferStage.css'
import './DeviceRoleCard.css'

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
  const { transferProgress, connectingDevice, connectionRole } = domain
  const deviceName = connectingDevice?.displayName ?? 'device'
  const selectedFiles = transfer.getSelectedFiles()
  const { sessionState, role, files, totalBytes, transferredBytes, bytesPerSecond, etaSeconds } =
    transferProgress
  const incoming = transferProgress.incomingRequest
  const isConnectionReceiver = connectionRole === 'answerer'

  useTransferFlowSounds(transferProgress)

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
    const primaryName = files[0]?.name ?? 'file'
    return (
      <div className="transfer-panel transfer-panel--complete sd-glass-panel sd-motion-complete">
        <SuccessMark />
        <p className="transfer-panel__status transfer-panel__status--success">
          {role === 'receiver' ? 'Received successfully' : 'Sent successfully'}
        </p>
        <p className="transfer-panel__filename">{primaryName}</p>
        <div className="sd-action-stack">
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
      </div>
    )
  }

  if (isFailed) {
    const copy = transferFailureCopy(sessionState === 'cancelled' ? 'cancelled' : 'failed')
    return (
      <div className="transfer-panel transfer-panel--failed sd-glass-panel">
        <p className="transfer-panel__status transfer-panel__status--error">{copy.title}</p>
        <p className="transfer-panel__hint">{copy.hint}</p>
        <div className="sd-action-stack">
          <Button
            className="transfer-panel__action"
            onClick={() => {
              resetTransfer()
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (isIncoming && incoming) {
    return (
      <div className="transfer-panel transfer-panel--incoming sd-glass-panel sd-motion-device-enter">
        <div className="transfer-incoming">
          <p className="transfer-panel__heading">Incoming transfer</p>
          {connectingDevice ? (
            <DeviceRoleCard
              compact
              displayName={incoming.senderDisplayName}
              platform={connectingDevice.platform}
              deviceType={connectingDevice.deviceType}
            />
          ) : null}
          <p className="transfer-incoming__lead">wants to send you</p>
          <p className="transfer-incoming__summary">
            {incoming.files.length} file{incoming.files.length === 1 ? '' : 's'} ·{' '}
            {formatBytes(incoming.totalBytes)}
          </p>
          <div className="sd-action-stack">
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
              Decline
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isSending || isTransferring) {
    const heading =
      role === 'receiver'
        ? `Receiving ${activeFile?.name ?? 'file'}`
        : isSending
          ? `Waiting for ${deviceName}…`
          : `Sending ${activeFile?.name ?? 'file'}`

    const flowDirection = role === 'sender' ? 'out' : 'in'
    const progress = isTransferring ? transferProgress.overallProgress : (activeFile?.progress ?? 0)

    return (
      <div className="transfer-panel transfer-panel--active sd-glass-panel">
        <div className="transfer-motion transfer-motion--stage">
          <AirdropWave variant="transfer" direction={flowDirection === 'out' ? 'out' : 'in'} />
          {isTransferring ? (
            <TransferProgressRing progress={progress} label="Transfer progress" />
          ) : (
            <ConnectionPulse phase="waiting" />
          )}
        </div>

        <p className="transfer-panel__heading">{heading}</p>

        {isTransferring && files.length > 1 && activeFileIndex > 0 ? (
          <p className="transfer-panel__file-index">
            {activeFileIndex} of {files.length}
          </p>
        ) : null}

        {activeFile && isTransferring ? (
          <p className="transfer-panel__filename">{activeFile.name}</p>
        ) : null}

        {connectingDevice && isTransferring ? (
          <TransferStage
            localName={domain.localDisplayName}
            localPlatform={domain.localPlatform}
            localDeviceType={domain.localDeviceType}
            remoteName={connectingDevice.displayName}
            remotePlatform={connectingDevice.platform}
            remoteDeviceType={connectingDevice.deviceType}
            direction={flowDirection}
            active
          />
        ) : null}

        {isTransferring ? (
          <>
            <p className="transfer-panel__bytes">
              {formatBytes(transferredBytes)} / {formatBytes(totalBytes)}
            </p>
            <p className="transfer-panel__stats">
              {bytesPerSecond > 0 ? <span>{formatSpeed(bytesPerSecond)}</span> : null}
              {etaSeconds !== null ? <span>{formatDuration(etaSeconds)} left</span> : null}
            </p>
            <ProgressBar
              value={transferProgress.overallProgress}
              label="Overall transfer progress"
            />
            <div className="sd-action-stack">
              <Button
                variant="ghost"
                className="transfer-panel__action"
                onClick={() => {
                  void cancelTransfer()
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <p className="transfer-panel__hint">Waiting for the other device to accept…</p>
        )}
      </div>
    )
  }

  if (isConnectionReceiver) {
    return (
      <div className="transfer-panel transfer-panel--receive-idle sd-glass-panel">
        <div className="transfer-motion transfer-motion--stage">
          <AirdropWave variant="ambient" />
          <ConnectionPulse phase="waiting" />
        </div>
        {connectingDevice ? (
          <DeviceRoleCard
            displayName={connectingDevice.displayName}
            platform={connectingDevice.platform}
            deviceType={connectingDevice.deviceType}
          />
        ) : null}
        <p className="transfer-panel__hint">Waiting for {deviceName} to send files.</p>
      </div>
    )
  }

  return (
    <div
      className={[
        'transfer-panel',
        'transfer-panel--select',
        'sd-glass-panel',
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

      {connectingDevice ? (
        <div className="transfer-destination">
          <p className="transfer-destination__label">Send files to</p>
          <DeviceRoleCard
            compact
            displayName={connectingDevice.displayName}
            platform={connectingDevice.platform}
            deviceType={connectingDevice.deviceType}
          />
        </div>
      ) : null}

      {selectedFiles.length === 0 ? (
        <div className="sd-action-stack">
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
        </div>
      ) : (
        <>
          <p className="transfer-panel__summary">
            {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} ·{' '}
            {formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0))}
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
          <div className="sd-action-stack">
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
