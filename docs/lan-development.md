# LAN development

ShareDrop development is designed for **same-LAN multi-device testing**. The web app and signaling server must be reachable from phones and other computers on your local network.

This guide covers LAN development only. It does **not** prove cross-Internet or cross-network WebRTC reliability.

---

## Quick start

```bash
npm install
npm run dev:all
```

The startup banner prints:

- Local URL: `http://localhost:5173`
- LAN URL(s): `http://<your-lan-ip>:5173` (when detected)
- Signaling: `ws://<host>:8787`

Open ShareDrop on another device using a **LAN** URL — not `localhost`.

---

## How signaling URL resolution works

The browser **does not hard-code** your LAN IP in source code.

When `VITE_SIGNALING_URL` is unset, the client derives:

```text
ws(s)://<same-host-as-web-app>:8787
```

Examples:

| Web app opened at             | Signaling connects to       |
| ----------------------------- | --------------------------- |
| `http://localhost:5173`       | `ws://localhost:8787`       |
| `http://192.168.1.25:5173`    | `ws://192.168.1.25:8787`    |
| `http://192.168.100.205:5173` | `ws://192.168.100.205:8787` |

Override when needed:

```bash
VITE_SIGNALING_URL=ws://192.168.1.25:8787 npm run dev
```

Implementation: `src/core/signaling/resolve-signaling-url.ts`

---

## Find your LAN address

### Linux

```bash
hostname -I
```

or:

```bash
ip -4 addr show scope global
```

### macOS

```bash
ipconfig getifaddr en0
```

(Wi‑Fi is often `en0`; Ethernet may be `en1`.)

### Windows

```powershell
ipconfig
```

Look for **IPv4 Address** on your active Wi‑Fi/Ethernet adapter.

---

## Required ports (development)

| Port   | Service             |
| ------ | ------------------- |
| `5173` | Vite web app        |
| `8787` | WebSocket signaling |

Your OS firewall may block inbound LAN connections. Allow these ports for **private/local networks only** — do not expose them to the public Internet.

---

## Server bind addresses

| Variable                    | Default   | Purpose                                   |
| --------------------------- | --------- | ----------------------------------------- |
| `SIGNALING_HOST`            | `0.0.0.0` | Listen on all interfaces (LAN-accessible) |
| `SIGNALING_PORT`            | `8787`    | Signaling port                            |
| `SIGNALING_ALLOWED_ORIGINS` | `*`       | WebSocket origin policy                   |

### Origin policy (development)

- `*` — allow all browser origins (default, simplest for LAN dev)
- `lan` — allow private-network origins only (`192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`, `localhost`)
- explicit list — e.g. `http://192.168.1.25:5173,http://localhost:5173` (recommended for tighter dev setups)

Production must **not** use `*`. Set explicit HTTPS/WSS origins.

---

## Vite LAN access

Vite is configured with `host: true` in `vite.config.ts`, which binds to all interfaces and prints network URLs on startup.

---

## Development diagnostics

In development builds only (`import.meta.env.DEV`), the app shows diagnostics panels at the bottom of the screen:

- **Discovery** — registration, heartbeat, nearby count
- **Connection** — ICE/WebRTC stats
- **Transfer** — bytes, backpressure, throughput
- **LAN readiness** — web app URL, signaling URL, readiness checklist

Use **Run readiness check** after tapping **Send to nearby** to verify signaling registration.

Readiness steps:

1. Web app loaded
2. Signaling connected
3. Presence registered
4. Nearby device visible (requires a second browser/device)

---

## Same-machine integration test (two browsers)

Before mobile testing:

1. Run `npm run dev:all`
2. Open `http://localhost:5173` in Browser A
3. Open `http://localhost:5173` in Browser B (separate profile/incognito helps)
4. Both: **Send to nearby**
5. Each should appear in the other's nearby list
6. Connect → select files → send → verify download + integrity

Use dev diagnostics to confirm ICE candidate type and transfer throughput.

---

## Troubleshooting

### Phone cannot open the web app

- Confirm phone and PC are on the **same Wi‑Fi**
- Use the PC's LAN IP, not `localhost`
- Check OS firewall allows inbound TCP **5173**
- Avoid guest/isolated Wi‑Fi (client isolation blocks device-to-device traffic)

### WebSocket connection fails

- Verify signaling is running (`npm run dev:all`)
- Open devtools → Network → WS on the phone; expect `ws://<lan-ip>:8787`
- Check firewall allows inbound TCP **8787**
- If using `SIGNALING_ALLOWED_ORIGINS`, include your LAN web origin or use `lan`/`*`

### Devices don't see each other

- Both devices must tap **Send to nearby** (discovery must be active)
- Both must reach the **same signaling server**
- Check LAN readiness panel: presence registered on both sides
- Background tabs on mobile may delay heartbeats — keep tabs active

### WebRTC connection fails on LAN

- Check connection diagnostics: ICE state, candidate type
- Same-network transfers should prefer direct/host candidates
- VPNs can interfere with local routing — disable for LAN testing
- STUN default (`stun:stun.l.google.com:19302`) should not block LAN P2P

### Transfer fails after connection

- Confirm transfer DataChannel state is `open` in connection diagnostics
- Check transfer diagnostics for backpressure pauses and errors
- See [transfer-protocol.md](transfer-protocol.md)

---

## What LAN testing proves vs does not prove

| Proven by LAN testing             | Not proven                     |
| --------------------------------- | ------------------------------ |
| Discovery over signaling on LAN   | Cross-Internet reliability     |
| WebRTC connection on same network | TURN relay behavior            |
| P2P file transfer on LAN          | Production TLS/WSS deployment  |
| Integrity verification            | Mobile browser memory at 1 GB+ |

Cross-network testing requires TURN (`VITE_ICE_SERVERS`) and is a later phase.

---

## Related docs

- [development.md](development.md) — scripts and env vars
- [browser-support.md](browser-support.md) — browser limitations
- [phase-5-device-validation.md](phase-5-device-validation.md) — validation matrix template
