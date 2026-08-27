# Security

ShareDrop security model for signaling, presence, connections, and transfers.

## Product principles

- No accounts
- No cloud file storage
- No persistent file storage on ShareDrop infrastructure
- Signaling helps peers find/connect; **file bytes stay peer-to-peer**
- Saved device IDs are local convenience only — **never authentication credentials**

## Signaling

| Control           | Behavior                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| Origin policy     | Exact HTTPS origins in production. Dev may use `*`, `lan`, or `http://`     |
| Origin validation | WebSocket `Origin` header checked on every upgrade                          |
| Rate limiting     | Per-connection budget for presence/control; trickle `connection_ice` exempt |
| Payload size      | Cap via `SIGNALING_MAX_MESSAGE_BYTES` / protocol constants                  |
| Max connections   | Cap via `SIGNALING_MAX_CONNECTIONS`                                         |
| Malformed frames  | Rejected (`INVALID_MESSAGE`); server stays up                               |
| Health endpoint   | `/health` — status, version, uptime, connection count only                  |
| HTTPS → WSS       | HTTPS pages must resolve/use `wss://` (explicit `ws://` rejected)           |
| Privacy           | Signaling never receives file contents or transfer chunks                   |

### Origin policy (centralized)

Implemented in `server/origin-policy.ts`, loaded via `server/config.ts`.

| Mode     | `SIGNALING_ALLOWED_ORIGINS`            | When to use                   |
| -------- | -------------------------------------- | ----------------------------- |
| Wildcard | `*`                                    | Local development only        |
| LAN      | `lan`                                  | Phone/laptop on private Wi‑Fi |
| Explicit | `https://app.example.com` (comma list) | Production (required)         |

Production (`NODE_ENV=production` or `SHAREDROP_ENV=production`) **refuses** to start with `*`, `lan`, missing value, or non-HTTPS entries.

Do **not** set `SIGNALING_ALLOWED_ORIGINS=*` in production unless you consciously accept open Origin (not supported by the production config path).

## Presence

Presence payloads include only what discovery needs: `deviceId`, `sessionId`, `displayName`, type/platform/browser/status, `lastSeen`.

| Control       | Behavior                                   |
| ------------- | ------------------------------------------ |
| Registration  | Required before device appears to peers    |
| Heartbeat     | Required to stay online                    |
| TTL           | Stale devices expire and broadcast as left |
| Unregister    | Explicit leave + connection close cleanup  |
| Reconnect     | New session; fresh registration            |
| Rate limiting | Shared connection message budget           |
| Limits        | Max connections + max message bytes        |

No IP / location / MAC / advertising ID is used for identity.

Saved devices remain **local** bookmarks. Knowing a `deviceId` does not authenticate a peer for transfers.

## Connection authorization

- Connection request / accept / reject gates the WebRTC session
- Only session participants may exchange offer/answer/ICE
- Session TTL expires abandoned sessions
- Cancel cleans up session state
- Spoofing `displayName` or knowing a `deviceId` does **not** bypass accept/reject

## Transfer integrity

- Chunked DataChannel protocol with size + SHA-256 verification
- Incomplete / mismatch / interruption → failed (never success)
- Filenames sanitized
- No artificial product size ceiling

## Configuration hygiene

- No production domain hard-coded in source
- No private IPs committed
- No credentials committed (use `.env.example` placeholders only)
- Malformed client signaling URLs fail safely before connect
- Production errors and ops logs must not expose secrets

## Abuse protections

| Control          | Behavior                                                          |
| ---------------- | ----------------------------------------------------------------- |
| Origin policy    | Exact HTTPS origins in production                                 |
| Max connections  | `SIGNALING_MAX_CONNECTIONS`                                       |
| Message rate     | Presence/control rate-limited; trickle ICE candidates not dropped |
| Payload size     | `SIGNALING_MAX_MESSAGE_BYTES`                                     |
| Malformed frames | `INVALID_MESSAGE`                                                 |

## Privacy audit (Phase 11)

| Guarantee                                                    | Status |
| ------------------------------------------------------------ | ------ |
| No account required                                          | Held   |
| No file upload to ShareDrop servers                          | Held   |
| No cloud file storage                                        | Held   |
| No persistent file storage on infra                          | Held   |
| No tracking required for transfer                            | Held   |
| File path is WebRTC peer-to-peer (or TURN-relayed encrypted) | Held   |
| Signaling never receives file bytes / chunks                 | Held   |

## Logging privacy

Ops logs may include: timestamp, event type, connection count, duration-related fields, error/rejection category, server version / bind metadata.

Ops logs must **not** include: SDP, ICE credentials, TURN credentials, file names, file bytes, transfer chunks, full signaling payloads, unnecessary device metadata.

## Related

- [production-deployment.md](./production-deployment.md)
- [phase-11-validation-report.md](./phase-11-validation-report.md)
- [global-connectivity.md](./global-connectivity.md)
- [turn-deployment.md](./turn-deployment.md)
- [browser-support.md](./browser-support.md)
