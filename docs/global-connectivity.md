# Global connectivity

ShareDrop connects peers with **WebSocket signaling** (presence + SDP/ICE) and transfers files over a **WebRTC DataChannel**. File bytes never touch the signaling server.

```text
Peer A
  ↓
Production signaling (presence / offer / answer / ICE)
  ↓
WebRTC ICE negotiation
  ├── host   (direct / LAN)
  ├── srflx  (STUN reflexive)
  └── relay  (TURN when direct fails)
  ↓
RTCDataChannel → TransferEngine
```

When direct connectivity is unavailable and TURN is configured, ICE may select `relay`. The transfer engine does not know or care which candidate type was selected.

## ICE candidate types

| Type    | Meaning                                      | Typical path                |
| ------- | -------------------------------------------- | --------------------------- |
| `host`  | Local interface address                      | Same machine / LAN          |
| `srflx` | Server-reflexive via STUN                    | Simple NAT                  |
| `relay` | Relayed via TURN/TURNS                       | Restrictive NAT / firewalls |
| `prflx` | Peer-reflexive (learned during connectivity) | Occasional                  |

Do **not** force TURN in production. Optional `VITE_ICE_TRANSPORT_POLICY=relay` is for validation only.

## STUN / TURN / TURNS

| Scheme   | Role                                             | Credentials     |
| -------- | ------------------------------------------------ | --------------- |
| `stun:`  | Discover public mapped addresses                 | None (stripped) |
| `turn:`  | Relay encrypted WebRTC when direct paths fail    | Via env         |
| `turns:` | TURN over TLS (TCP/TLS; helpful for strict nets) | Via env         |

STUN does **not** guarantee NAT traversal. TURN relays encrypted WebRTC media/data — it is **not** cloud file storage.

Configuration is provider-agnostic: any `RTCIceServer[]` JSON via `VITE_ICE_SERVERS`.

## Discovery semantics (global presence)

A device discovered through signaling may be:

- on the same Wi‑Fi
- on another Wi‑Fi
- on cellular
- in another city or country

Prefer: **Available devices** / **Online** / **Offline** / **Saved devices**.

“Nearby” branding may remain for product simplicity, but do **not** claim discovery means same Wi‑Fi.

## Saved devices across networks

Saved matching uses persistent `deviceId` only — never IP, LAN, or geography.

```text
Device A saves Device B
Device B: Wi‑Fi → cellular → different country
Device B online via signaling → Device A recognizes saved identity
```

Saved identity is **not** authentication. Connection still requires accept/reject.

## Configuration

| Variable                    | Role                                             |
| --------------------------- | ------------------------------------------------ |
| `VITE_SIGNALING_URL`        | `wss://…` signaling (production)                 |
| `VITE_ICE_SERVERS`          | JSON `RTCIceServer[]` — STUN / TURN / TURNS      |
| `VITE_ICE_TRANSPORT_POLICY` | Optional `relay` for forced-TURN validation only |
| `SIGNALING_ALLOWED_ORIGINS` | Production: explicit HTTPS origins               |

Example (placeholders only — never commit real credentials):

```bash
VITE_ICE_SERVERS='[
  {"urls":"stun:stun.example.com:19302"},
  {"urls":"turn:turn.example.com:3478?transport=udp","username":"u","credential":"p"},
  {"urls":"turns:turn.example.com:5349?transport=tcp","username":"u","credential":"p"}
]'
```

Malformed `VITE_ICE_SERVERS` falls back to default STUN. In development a warning is emitted **without** logging the raw secret-bearing string.

Safe diagnostics may report server count and schemes (`stun`/`turn`/`turns`) — never usernames or passwords.

## Failure behavior

| Scenario               | Expected behavior                                         |
| ---------------------- | --------------------------------------------------------- |
| TURN unavailable       | Direct `host`/`srflx` may still succeed — not a hard fail |
| Direct P2P unavailable | ICE may select `relay` if TURN is configured              |
| No viable ICE path     | User-friendly “Unable to connect” (no ICE jargon)         |
| Network interruption   | Transfer fails cleanly; never report incomplete success   |

## Consumer UX

- Connecting… / Connected ✓
- No STUN/TURN/ICE jargon in production UI
- Candidate type / RTT: **development diagnostics only**

## Cross-network validation procedure

For each **physical** test, record (do not fabricate):

| Field               | Example                   |
| ------------------- | ------------------------- |
| Date                | YYYY-MM-DD                |
| Device A / B        | model                     |
| Browser A / B       | Chrome 128 / Safari 18    |
| OS A / B            | Android 15 / iOS 18       |
| Network A / B       | Wi‑Fi home / cellular LTE |
| Candidate type      | host / srflx / relay      |
| Connection duration | ms                        |
| RTT                 | ms                        |
| File size           | bytes                     |
| Transfer duration   | ms                        |
| Throughput          | bytes/s                   |
| SHA-256 result      | PASS / FAIL               |
| Result              | PASS / FAIL / NOT TESTED  |

Target matrix (status must stay honest):

| Scenario            | Status      |
| ------------------- | ----------- |
| Wi‑Fi ↔ Wi‑Fi       | record live |
| Wi‑Fi ↔ cellular    | record live |
| cellular ↔ cellular | record live |
| Different networks  | record live |
| Cross-country       | record live |

See [turn-deployment.md](./turn-deployment.md), [device-validation.md](./device-validation.md), [phase-11-validation-report.md](./phase-11-validation-report.md).

## Related

- [production-deployment.md](./production-deployment.md)
- [security.md](./security.md)
- [browser-support.md](./browser-support.md)
