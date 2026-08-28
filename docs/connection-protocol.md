# Connection protocol

Phase 3 extends signaling with WebRTC connection negotiation messages.

## Roles

- **Offerer** — device that selects a peer and initiates the connection
- **Answerer** — device that receives the connection request while ShareDrop is open

Only the offerer sends `connection_offer`. Only the answerer sends `connection_answer`.

## Session identifier

`connectionSessionId` is a cryptographically random ephemeral id (`conn_<uuid>`).

It is separate from presence `sessionId` on devices.

Sessions expire after 120 seconds if unused.

## Client → server messages

| Type                 | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `connection_request` | Offerer asks to connect to answerer            |
| `connection_accept`  | Answerer accepts (auto when ShareDrop is open) |
| `connection_reject`  | Answerer rejects                               |
| `connection_offer`   | Offerer SDP offer                              |
| `connection_answer`  | Answerer SDP answer                            |
| `connection_ice`     | Trickle ICE candidate                          |
| `connection_cancel`  | Either side cancels                            |

All messages include:

```text
connectionSessionId
fromDeviceId
toDeviceId
```

## Server behavior

- Validates sender matches registered device
- Validates session membership for negotiation messages
- Routes messages to the target device's WebSocket
- Never inspects or stores file data
- Enforces payload size limits (SDP max 16KB, ICE candidate max 2KB)

## WebRTC lifecycle

```text
Offerer selects device
      ↓
connection_request
      ↓
connection_accept
      ↓
connection_offer
      ↓
connection_answer
      ↓
trickle ICE (both directions)
      ↓
RTCDataChannel open
      ↓
HELLO → PEER_READY handshake
      ↓
connected
```

## Handshake

The DataChannel is used only for verification:

```text
Offerer → HELLO
Answerer → PEER_READY
```

No file data is exchanged.

## ICE configuration

Configure via `VITE_ICE_SERVERS` JSON array.

Development default:

```json
[{ "urls": "stun:stun.l.google.com:19302" }]
```

Production should include STUN and TURN as needed.

## Timeouts

- Connection attempt: 30 seconds
- Handshake: 10 seconds
- Session TTL: 120 seconds

## Security

- Sender device id must match registered WebSocket owner
- Session participants are validated on every negotiation message
- Unknown sessions are rejected
- Oversized or malformed payloads are rejected
