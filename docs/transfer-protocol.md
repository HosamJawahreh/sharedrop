# Transfer protocol

ShareDrop Phase 4 transfers files directly between peers over a dedicated WebRTC DataChannel (`sharedrop-transfer`). The signaling server never receives file bytes.

## Channel design

Phase 3 opens a handshake channel (`sharedrop-handshake`) for `HELLO` / `PEER_READY`. Phase 4 adds a **separate ordered, reliable** transfer channel.

A single channel with typed framing is used (not separate control/data channels) because:

- One channel simplifies backpressure (`bufferedAmount` applies uniformly)
- Ordered reliable delivery is already provided by SCTP
- Binary file chunks and small JSON control messages coexist via frame headers

## Frame format

Every message uses a 7-byte header:

```text
byte 0     magic (0x53)
byte 1     version (1)
byte 2     frame type
bytes 3-6  payload length (uint32 BE)
...        payload
```

Control payloads are UTF-8 JSON. `FILE_CHUNK` payloads are binary.

## Message types

| Type | Name              | Direction         | Purpose                    |
| ---- | ----------------- | ----------------- | -------------------------- |
| 1    | TRANSFER_REQUEST  | Sender → Receiver | File metadata + session id |
| 2    | TRANSFER_ACCEPT   | Receiver → Sender | User accepted transfer     |
| 3    | TRANSFER_REJECT   | Receiver → Sender | User or policy rejected    |
| 4    | FILE_START        | Sender → Receiver | Begin one file             |
| 5    | FILE_CHUNK        | Sender → Receiver | Binary chunk               |
| 6    | FILE_END          | Sender → Receiver | Size + SHA-256 hex digest  |
| 7    | TRANSFER_COMPLETE | Sender → Receiver | All files sent             |
| 8    | TRANSFER_CANCEL   | Either            | Abort session              |
| 9    | TRANSFER_ERROR    | Either            | Fatal protocol error       |

## Session state machine

```text
idle
  → preparing            (sender selects files)
  → awaiting_acceptance  (TRANSFER_REQUEST sent / received)
  → transferring         (TRANSFER_ACCEPT + FILE_START)
  → completed            (TRANSFER_COMPLETE)
  → cancelled            (TRANSFER_CANCEL)
  → failed               (error, hash mismatch, disconnect)
```

Invalid transitions (for example `FILE_CHUNK` before `FILE_START`) fail safely.

## File metadata

Each file descriptor includes:

- `fileId` — cryptographically random temporary id (not the filename)
- `name` — sanitized filename
- `size`, `mimeType`, `lastModified`
- `index`, `totalFiles` — preserve order in multi-file sessions

## Chunking

- Default chunk size: **256 KiB** (`TRANSFER_PROTOCOL.DEFAULT_CHUNK_SIZE`)
- Maximum chunk size: **1 MiB**
- Sender reads with `File.slice()` — never `file.arrayBuffer()` for whole files
- Files transfer **sequentially** within a session

### Why 256 KiB?

Conservative balance for WebRTC/SCTP buffers across Chrome, Firefox, and Safari. Configurable via `TransferEngineOptions.chunkSize` without protocol changes.

## Backpressure

Sender monitors `RTCDataChannel.bufferedAmount`:

- Pause when above **1 MiB** (`BUFFERED_AMOUNT_HIGH`)
- Resume on `bufferedamountlow` at **256 KiB** (`BUFFERED_AMOUNT_LOW`)

Progress UI emits at most every **100 ms** (~10 updates/sec).

## Integrity

Per file:

1. Receiver tracks bytes received vs declared size
2. Streaming SHA-256 (`@noble/hashes`) over chunks
3. `FILE_END` carries sender digest; mismatch → `failed`

Empty files hash to the standard SHA-256 of an empty input.

## Security limits

| Limit                  | Default |
| ---------------------- | ------- |
| Max files per transfer | 100     |
| Max filename length    | 255     |
| Max chunk size         | 1 MiB   |

There is **no artificial 5 GiB / 10 GiB marketing ceiling**. Practical size limits are device RAM, browser Blob limits, connection quality, and available storage.

Incoming metadata is validated; path traversal filenames are rejected.

## Receiver storage

Initial implementation assembles chunks into a `Blob`, then triggers download via temporary object URLs and `<a download>`. This is the safest cross-browser approach (including iOS Safari).

**Limitation:** receiver memory is proportional to file size until download. Very large files may be constrained by device RAM — document and test per browser.

Resume is **not** implemented; connection loss → `failed`, user retries.

## Implementation map

```text
UI → TransferEngine → DataChannelTransport → RTCDataChannel
```

Source:

- `shared/transfer-protocol.ts` — types and limits
- `shared/transfer-frame.ts` — encode/decode
- `src/core/transfer/transfer-engine.ts` — engine
- `src/core/transfer/data-channel-transport.ts` — transport wrapper
