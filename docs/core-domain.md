# Core domain

## Device

Temporary nearby device identity. Not a user account.

Minimum fields:

- `deviceId`
- `sessionId`
- `displayName`
- `deviceType`
- `browser`
- `platform`
- `status`
- `lastSeen`

Contracts live in `src/core/device`.

## Discovery

Finds temporary nearby peers.

Engine surface:

- `start()`
- `stop()`
- `getNearbyDevices()`
- `subscribeToDevices()`
- `subscribeToDiscoveryState()`

## Connection (Phase 3)

Peer connection uses WebRTC behind `ConnectionEngine`:

```text
UI → ConnectionEngine → RTCPeerConnection → RTCDataChannel (handshake only)
         │
         └── SignalingClient (offer/answer/ICE routing)
```

- Offerer/answerer roles prevent offer collisions
- DataChannel handshake (`HELLO` / `PEER_READY`) verifies connectivity
- No file data is transferred in Phase 3
- ICE servers configured via `VITE_ICE_SERVERS`

See [connection-protocol.md](connection-protocol.md).

## Discovery (Phase 2)

Real nearby discovery uses ephemeral signaling presence:

```text
UI → DiscoveryEngine → PresenceService → SignalingClient → WebSocket → Signaling Server
```

- Signaling server maintains in-memory ephemeral device presence
- Heartbeat every 15s; presence expires after 45s without heartbeat
- No file data enters signaling
- No persistent user identity

The null discovery engine remains available for tests (`createNullDiscoveryEngine()`).

## Session

Ephemeral communication session between two devices.

Fields:

- `sessionId`
- `localDeviceId`
- `remoteDeviceId`
- `state`
- `createdAt`
- `expiresAt`

States:

- `idle`
- `discovering`
- `connecting`
- `connected`
- `closing`
- `closed`
- `failed`

Contracts live in `src/core/session`.

## Connection

Peer connection abstraction for the UI and higher layers.

Surface:

- `connect()`
- `disconnect()`
- `getState()`
- `send()`
- `subscribe()`
- `subscribeToMessages()`

Does not expose browser WebRTC types to React.

Contracts live in `src/core/connection`.

## Transfer

Future transfer metadata and engine boundary.

Fields:

- `transferId`
- `fileId`
- `name`
- `size`
- `mimeType`
- `status`
- `progress`
- `bytesTransferred`

`sendFiles()` accepts `File` handles and must stream/chunk — never load entire large files into memory unnecessarily.

Contracts live in `src/core/transfer`.

## Transport

Lowest byte channel. Production implementation target: WebRTC DataChannel.

Contracts live in `src/core/transport`.

## Errors

Categorized errors in `src/core/errors`:

- `DiscoveryError`
- `SessionError`
- `ConnectionError`
- `TransferError`
- `UserActionError`

Each error carries:

- `userMessage` — safe for UI
- `technicalMessage` — for debugging
