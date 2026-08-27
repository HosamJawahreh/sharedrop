# Architecture

ShareDrop is a browser-based peer-to-peer file transfer product.

**Product philosophy:** send files directly between devices. No account. No upload. No storage.

## Frontend architecture

```text
UI
 │
 ▼
Nearby Experience
 │
 ▼
Discovery Engine
 │
 ▼
Session Engine
 │
 ▼
Connection Engine
 │
 ▼
Transfer Engine
 │
 ▼
Transport Layer
 │
 ▼
WebRTC DataChannel
```

### Layer rules

- React components own **UI state** only (`currentScreen`, `selectedDeviceId`, etc.).
- Domain engines own **networking and transfer state**.
- UI never imports `RTCPeerConnection`, ICE, signaling payloads, or chunking logic.
- File contents are never stored in React state. Transfer code streams/chunks from `File` handles via `TransferEngine`.

### Source layout

```text
src/
├── app/                 # App shell, providers, routes
├── core/                # Domain contracts and engines
│   ├── device/
│   ├── saved-devices/
│   ├── pwa/
│   ├── background/
│   ├── discovery/
│   ├── session/
│   ├── connection/
│   ├── transfer/
│   ├── transport/
│   └── errors/
├── features/
│   └── nearby-send/     # Core product workflow UI
├── components/ui/       # Shared presentational controls
├── types/
├── utils/
└── main.tsx
```

## Global P2P readiness

```text
Device A (any network)
        ↓  signaling (presence / SDP / ICE only)
Device B (any network)
        ↓  WebRTC DataChannel (file bytes)
```

- Same LAN often uses host candidates (direct)
- Cross-network may use STUN (`srflx`) or TURN (`relay`)
- Configure ICE via `VITE_ICE_SERVERS` (STUN / TURN / TURNS). No production TURN credentials are hard-coded.
- Candidate types remain in **development diagnostics** only

See [device-identity.md](./device-identity.md) and [pwa-support.md](./pwa-support.md).

## Domain boundaries

| Domain        | Responsibility                                         |
| ------------- | ------------------------------------------------------ |
| Device        | Local persistent ShareDrop identity + presence payload |
| Discovery     | Find available ShareDrop devices via signaling         |
| Session       | Ephemeral peer session lifecycle                       |
| Connection    | Abstract peer link (no WebRTC leakage)                 |
| Transfer      | File transfer metadata and progress                    |
| Transport     | Byte channel; production = WebRTC DataChannel          |
| PWA           | Manifest, service worker app shell, install state      |
| Saved devices | Local convenience list (not authentication)            |

Phase 4 adds **direct peer-to-peer file transfer** over a dedicated WebRTC DataChannel after connection succeeds. See [transfer-protocol.md](./transfer-protocol.md).

## Future WebRTC architecture

```text
Device A
   │
   ├──────── signaling (session setup only) ────────┐
   │                                                 ▼
   └──────── WebRTC DataChannel (file bytes) ───► Device B
```

- Signaling exists only to establish communication.
- File bytes travel peer-to-peer over a DataChannel whenever the network permits.
- TURN may later relay transport when direct connectivity fails. TURN is **not** file storage.

## Signaling responsibility

Signaling may exchange:

- session identifiers
- SDP / ICE candidates
- presence / discovery messages

Signaling must **not** receive or store file contents.

## Transfer responsibility (Phase 4)

The transfer engine:

- accepts `File` handles via browser file picker (never uploads to signaling)
- sends `TRANSFER_REQUEST` and waits for receiver acceptance
- chunks with `File.slice()` and respects DataChannel backpressure
- verifies SHA-256 integrity per file
- reports throttled progress to UI (`TransferProgressView`)
- triggers browser download on the receiver via Blob URLs

```text
TransferPanel (UI)
      │
      ▼
TransferEngine
      │
      ▼
DataChannelTransport
      │
      ▼
RTCDataChannel (sharedrop-transfer)
```

UI must not import frame codecs or manipulate `RTCDataChannel` directly.

## Privacy (signaling — Phase 8)

The signaling service knows only presence/session coordination data:

- ShareDrop `deviceId` (client-generated random id) and ephemeral `sessionId`
- user-visible `displayName` (local custom or generated)
- coarse `deviceType`, `platform`, `browser` strings
- connection timing for heartbeat/expiry
- SDP / ICE for WebRTC setup

It does **not** store:

- file contents
- accounts or emails
- saved-device lists (those stay in the browser)
- IP addresses for analytics
- browser fingerprints as identity

Persistent `deviceId` values live in **localStorage on the device**. Presence still expires when heartbeats stop.

- No cloud file storage
- No upload-first transfer path
- No permanent transfer history required for the core workflow

Primary transfer path:

```text
Sender → WebRTC DataChannel → Receiver
```

Not:

```text
Sender → HTTP upload → server → HTTP download → Receiver
```
