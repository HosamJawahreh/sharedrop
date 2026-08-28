# Browser support

ShareDrop uses WebSocket signaling for discovery and WebRTC for direct file transfer.

## Tested browsers

| Browser           | Discovery          | Notes                                     |
| ----------------- | ------------------ | ----------------------------------------- |
| Chrome (desktop)  | Supported          | Primary development target                |
| Edge (desktop)    | Expected supported | Chromium-based                            |
| Firefox (desktop) | Expected supported | WebSocket signaling                       |
| Safari (macOS)    | Expected supported | WebSocket signaling                       |
| iOS Safari        | Expected supported | Requires LAN access to dev signaling host |
| Android Chrome    | Expected supported | Requires LAN access to dev signaling host |

## Phase 3 — Connection

| Browser           | WebRTC connection  | Notes                                |
| ----------------- | ------------------ | ------------------------------------ |
| Chrome (desktop)  | Supported          | Primary dev target                   |
| Edge (desktop)    | Expected supported | Chromium-based                       |
| Firefox (desktop) | Expected supported | WebRTC signaling + peer connection   |
| Safari (macOS)    | Expected supported | Requires user gesture for some flows |
| iOS Safari        | Expected supported | Background tabs may drop connections |
| Android Chrome    | Expected supported | Test on LAN with `npm run dev:all`   |

Connection requires both devices reachable via the signaling service. Direct P2P is attempted first; TURN may be required across restrictive networks (configure via `VITE_ICE_SERVERS`).

### LAN vs Internet

| Path                        | Typical ICE | Notes                                |
| --------------------------- | ----------- | ------------------------------------ |
| Same LAN / direct           | `host`      | Often works with default STUN config |
| Internet via STUN           | `srflx`     | NAT traversal without relay          |
| Restrictive NAT / firewalls | `relay`     | Requires configured TURN / TURNS     |

Do **not** hard-code production TURN credentials. Example:

```bash
VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]'
```

Candidate type diagnostics remain in the development diagnostics panel only.

## Phase 4 — File transfer

| Browser           | P2P file transfer  | Notes                                                                                    |
| ----------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| Chrome (desktop)  | Supported          | Primary dev target; Blob download                                                        |
| Edge (desktop)    | Expected supported | Chromium-based                                                                           |
| Firefox (desktop) | Expected supported | Backpressure + SHA-256 verified in tests                                                 |
| Safari (macOS)    | Expected supported | Blob download; user gesture may be needed for multi-file save                            |
| iOS Safari        | Expected supported | Memory limits apply for very large files; one download tap per file when saving multiple |
| Android Chrome    | Expected supported | Test on LAN with `npm run dev:all`                                                       |

Transfer uses a dedicated ordered reliable DataChannel. File bytes never pass through the signaling server.

### Receiver download strategy

- **All browsers:** assemble received chunks into a `Blob`, then `<a download>` with `URL.createObjectURL`
- **Not used initially:** File System Access API (Chrome-only), server fallback (explicitly prohibited)

### Known transfer limitations

1. **No resume** — interrupted transfers fail; user must retry
2. **Receiver memory** — Blob assembly holds full file in RAM until saved
3. **Multi-file save on iOS** — may require separate taps per file
4. **Very large files** — no artificial 5 GB/10 GB ceiling; practical limits are device RAM (Blob assembly), browser, connection, and storage. Measure on target hardware; mobile may OOM sooner.
5. **Sequential files** — one file at a time over the DataChannel (by design)

See [transfer-protocol.md](./transfer-protocol.md) for protocol details and limits.

## Phase 8 — PWA / identity / background

See [pwa-support.md](./pwa-support.md) and [device-identity.md](./device-identity.md).

| Capability                        | Chrome Desktop         | Android Chrome            | iOS Safari                                    |
| --------------------------------- | ---------------------- | ------------------------- | --------------------------------------------- |
| PWA install                       | Supported              | Supported                 | Add to Home Screen (no `beforeinstallprompt`) |
| Standalone mode                   | Supported              | Supported                 | Supported                                     |
| Notifications                     | Supported (permission) | Supported (permission)    | Partial                                       |
| Background receiving while closed | **NOT SUPPORTED**      | **NOT SUPPORTED**         | **NOT SUPPORTED**                             |
| WebRTC transfer                   | Supported              | **NOT TESTED** (physical) | **NOT TESTED** (physical)                     |

Consumer UI says **Your devices** / **Available now** on the homepage — never “Same Wi-Fi required.” Global connectivity is best-effort via WebRTC + configured ICE servers.

## Phase 10 — Consumer UX

| Capability                | Status                                                             |
| ------------------------- | ------------------------------------------------------------------ |
| Device name + type labels | Custom name + platform label (no IP / deviceId in UI)              |
| Saved device priority     | **Your devices** above **Available now**; online saved first       |
| Desktop drag & drop       | Supported on the transfer file area                                |
| Transfer progress         | Bytes, %, speed, ETA from actual throughput (throttled UI updates) |
| Install message           | Exact: **Need Faster Transfer? Download To Your Device**           |
| Diagnostics in production | Hidden — DEV builds only                                           |

Physical multi-device UX validation remains **NOT TESTED** unless recorded in validation docs.

## Phase 11 — Production infrastructure & global ICE

| Capability                | Status                                           |
| ------------------------- | ------------------------------------------------ |
| HTTPS + secure context    | Required for production (documented)             |
| WSS signaling             | Required via `VITE_SIGNALING_URL=wss://…`        |
| STUN (`stun:`)            | Env-driven; validated; default public STUN       |
| TURN (`turn:`)            | Env-driven credentials; never committed          |
| TURNS (`turns:`)          | Env-driven; TLS TURN for restrictive networks    |
| Multiple ICE servers      | Supported via `VITE_ICE_SERVERS` JSON array      |
| Natural ICE selection     | host / srflx / relay — not forced in production  |
| Forced relay (validation) | Optional `VITE_ICE_TRANSPORT_POLICY=relay`       |
| Origin policy             | Production rejects `*`                           |
| Health endpoint           | `GET /health` on signaling server                |
| Reverse proxy             | Documented (TLS termination + WebSocket Upgrade) |

Physical HTTPS/WSS/TURN relay and cross-country tests: see [phase-11-validation-report.md](./phase-11-validation-report.md).

Consumer UI prefers **Your devices** / **Available now** language. Discovery is **never** claimed to mean same Wi‑Fi.

### Background receiving

| Mode       | Behavior                                  |
| ---------- | ----------------------------------------- |
| Foreground | Full discovery / connect / transfer       |
| Background | May suspend; heartbeats may expire        |
| Terminated | **NOT SUPPORTED** — cannot receive WebRTC |

Do not claim “receive while ShareDrop is closed.”

## Discovery notes

- Devices connect to the signaling service over WebSocket (`ws://` in development, `wss://` in production).
- Presence expires when heartbeats stop.
- Discovery shows active ShareDrop peers — not a guaranteed same-Wi-Fi/LAN scan.

## Known limitations

1. **No native LAN scan** — Browsers cannot freely scan local networks. Discovery uses signaling presence instead.
2. **Same Wi-Fi is not verified** — The UI does not claim same-Wi-Fi.
3. **Mobile dev testing** — Phones must reach the signaling server on your development machine (use your LAN IP, not `localhost`).
4. **Background tabs** — Mobile browsers may suspend tabs and delay heartbeats; presence may expire until the tab is active again.
5. **Safari WebSocket limits** — Reconnection after long backgrounding may take a few seconds.
6. **Terminated PWA cannot receive WebRTC** — keep ShareDrop open to accept transfers.

## Mobile development access

When testing from a phone on the same network:

```bash
npm run dev:all
```

Open on your phone:

```text
http://<your-lan-ip>:5173
```

The client connects to signaling at:

```text
ws://<your-lan-ip>:8787
```

Override with `VITE_SIGNALING_URL` if needed.

## Production transport

Production must use:

- `https://` for the web app
- `wss://` for signaling

Configure `VITE_SIGNALING_URL` to your secure signaling endpoint.
Configure `VITE_ICE_SERVERS` when cross-network TURN is required.
