# Production deployment

ShareDrop Phase 11 — production deployment architecture for signaling, HTTPS/WSS, ICE, and the PWA.

```text
Internet
    │
    ▼
HTTPS reverse proxy (TLS termination)
    │
    ├── static ShareDrop PWA (dist/)
    │
    └── WSS upgrade ──► Signaling server (presence + SDP/ICE only)
                              │
Peer A ◄── WebRTC DataChannel (host / srflx / relay) ──► Peer B
              └── optional TURN relay when direct ICE fails
```

**File bytes never enter the signaling server.** TURN may relay encrypted WebRTC traffic only — it is not cloud file storage.

## Status vocabulary

| Term              | Meaning                                           |
| ----------------- | ------------------------------------------------- |
| **PROVEN**        | Automated or physical test succeeded              |
| **READY**         | Code and configuration model are in place         |
| **CONFIGURED**    | Env / docs describe how to wire a real deployment |
| **NOT TESTED**    | Physical / production verification unavailable    |
| **NOT SUPPORTED** | Platform or product cannot provide this           |

## Expected topology

| Layer       | Requirement                                        |
| ----------- | -------------------------------------------------- |
| Web app/PWA | HTTPS (secure context for WebRTC / install)        |
| Signaling   | WSS (`wss://…`) behind reverse proxy               |
| ICE         | STUN required; TURN/TURNS recommended for global   |
| Origins     | Explicit `https://` in `SIGNALING_ALLOWED_ORIGINS` |

Do not hard-code a production domain or private IP in source. Use environment variables.

## Reverse proxy (HTTPS + WSS)

The Node signaling process speaks **plain HTTP** for `/health` and **plain WS** for upgrades. Terminate TLS at the proxy.

A generic HTTP reverse proxy does **not** automatically support WebSockets. You must configure:

- TLS / HTTPS termination for the web app and signaling hostnames
- WebSocket `Upgrade` + `Connection` headers
- Long-lived read timeouts (ICE/presence connections stay open)
- Routing of signaling traffic to the Node process

Example Caddy sketch (placeholders only):

```caddy
app.example.com {
  root * /var/www/sharedrop
  file_server
  try_files {path} /index.html
}

signal.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

Example nginx WebSocket essentials:

```nginx
location / {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
}
```

Then build and run (placeholders — never commit real secrets):

```bash
VITE_SIGNALING_URL=wss://signal.example.com \
VITE_ICE_SERVERS='[{"urls":"stun:stun.example.com:19302"},{"urls":"turn:turn.example.com:3478","username":"…","credential":"…"}]' \
npm run build

NODE_ENV=production \
SHAREDROP_ENV=production \
SIGNALING_ALLOWED_ORIGINS=https://app.example.com \
npm run start:signaling
```

Serve `dist/` over HTTPS. Live HTTPS/WSS in this repository environment: **NOT TESTED**.

## Signaling URL resolution

Authoritative path: `resolveSignalingUrl`.

| Context                       | Result                            |
| ----------------------------- | --------------------------------- |
| `http://localhost:5173`       | `ws://localhost:8787` (derived)   |
| `http://192.168.x.x:5173`     | `ws://192.168.x.x:8787` (derived) |
| HTTPS page, no override       | `wss://<same-host>:8787`          |
| `VITE_SIGNALING_URL` set      | Validated `ws://` or `wss://` URL |
| HTTPS page + explicit `ws://` | **Rejected** (mixed content)      |

## Environment variables

See [`.env.example`](../.env.example).

### Client (Vite)

| Variable                    | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `VITE_SIGNALING_URL`        | Production signaling (`wss://…`)                 |
| `VITE_ICE_SERVERS`          | JSON `RTCIceServer[]` — STUN / TURN / TURNS      |
| `VITE_ICE_TRANSPORT_POLICY` | Optional `relay` for forced-TURN validation only |

### Signaling server

| Variable                            | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `SIGNALING_HOST` / `SIGNALING_PORT` | Bind (default `0.0.0.0:8787`)               |
| `SIGNALING_ALLOWED_ORIGINS`         | Bare `https://` origins in production       |
| `SIGNALING_MAX_CONNECTIONS`         | Max concurrent WebSockets                   |
| `SIGNALING_MAX_MESSAGES_PER_SECOND` | Per-connection rate (ICE candidates exempt) |
| `SIGNALING_MAX_MESSAGE_BYTES`       | Max WebSocket frame size                    |
| `NODE_ENV` / `SHAREDROP_ENV`        | `production` enforces origin policy         |
| `SHAREDROP_VERSION`                 | Version on `/health`                        |

## Health check

```text
GET /health
GET /healthz
```

Returns status, version, uptime, connection count only — no devices, SDP, secrets, or env.

## Logging & abuse

Structured ops events only (`listening`, `connection_accepted|rejected|closed`). Never log file bytes, SDP, or TURN credentials.

Abuse: origin allowlist, max connections, rate limits (presence/control), payload size caps. Trickle `connection_ice` is not rate-limited so TURN candidate bursts are not dropped.

## PWA production notes

- Manifest + service worker generated by `vite-plugin-pwa`
- Install headline (exact): **Need Faster Transfer? Download To Your Device**
- No install UI when standalone or after `appinstalled`
- `beforeinstallprompt` is never faked
- Receiving while the app is **closed/terminated** is **NOT SUPPORTED**

## Related

- [phase-11-validation-report.md](./phase-11-validation-report.md)
- [global-connectivity.md](./global-connectivity.md)
- [turn-deployment.md](./turn-deployment.md)
- [security.md](./security.md)
- [browser-support.md](./browser-support.md)
- [pwa-support.md](./pwa-support.md)
