# ShareDrop

Browser-based peer-to-peer file transfer.

**Send files directly between your devices. No account. No upload. No storage.**

## Current phase

Phase 11 — Production infrastructure & global P2P readiness.

## Quick start

```bash
npm install
npm run dev:all
```

Use the **LAN URL** printed in the startup banner on phones/other devices (not `localhost`).

1. Tap **Send to nearby**
2. Choose a device under **Your devices** (saved) or **Nearby**
3. Wait for **Connected ✓**
4. Select files (or drag & drop on desktop) → **Send**
5. Receiver taps **Accept**

Optional: install the PWA when prompted (**Need Faster Transfer? Download To Your Device**); rename **This device** on the home screen.

## Connectivity

ShareDrop works over the same LAN and, with proper ICE config, across networks:

```bash
# Optional cross-network relay (never commit real secrets)
VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:…","username":"…","credential":"…"}]'
```

See [docs/global-connectivity.md](docs/global-connectivity.md), [docs/production-deployment.md](docs/production-deployment.md), and [docs/turn-deployment.md](docs/turn-deployment.md).

Physical device results are recorded honestly in [docs/device-validation.md](docs/device-validation.md). Phase 11 summary: [docs/phase-11-validation-report.md](docs/phase-11-validation-report.md).

## File size

> Send files of any size — limited only by your device, browser, connection, and available storage.

There is no artificial 5 GB / 10 GB product ceiling. Receiver memory still scales with file size until download (Blob assembly).

## Documentation

- [Production deployment](docs/production-deployment.md)
- [Security](docs/security.md)
- [Global connectivity](docs/global-connectivity.md)
- [Device validation](docs/device-validation.md)
- [Phase 11 validation report](docs/phase-11-validation-report.md)
- [Phase 10 validation report](docs/phase-10-validation-report.md)
- [Phase 9 validation report](docs/phase-9-validation-report.md)
- [TURN deployment](docs/turn-deployment.md)
- [PWA support](docs/pwa-support.md)
- [Device identity](docs/device-identity.md)
- [Browser support](docs/browser-support.md)
- [Architecture](docs/architecture.md)
- [LAN development](docs/lan-development.md)
- [Development](docs/development.md)
