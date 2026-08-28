# ShareDrop

Browser-based peer-to-peer file transfer.

**Send files directly between your devices. No account. No upload. No storage.**

## Current phase

Phase 14C — Final LAN certification (see [docs/phase-14c-lan-certification-report.md](docs/phase-14c-lan-certification-report.md)).

## Quick start

```bash
npm install
npm run dev:all
```

Use the **LAN URL** printed in the startup banner on phones/other devices (not `localhost`).

1. Open ShareDrop — **Your devices** and **Available now** appear on the homepage
2. Tap an **Online** device (saved or newly available)
3. Wait for **Connected ✓**
4. Select files (or drag & drop on desktop) → **Send**
5. Receiver taps **Accept**

Saved devices are a local convenience: when Online they can connect across networks the architecture supports. Offline devices cannot receive files (no cloud queue).

Optional: install the PWA when prompted (**Need Faster Transfer? Download To Your Device**); rename **This device** on the home screen.

## Connectivity

ShareDrop works over the same LAN and, with proper ICE config, across networks:

```bash
# Optional cross-network relay (never commit real secrets)
VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:…","username":"…","credential":"…"}]'
```

See [docs/global-connectivity.md](docs/global-connectivity.md), [docs/production-deployment.md](docs/production-deployment.md), and [docs/turn-deployment.md](docs/turn-deployment.md).

Physical device QA is tracked in [docs/phase-14a-physical-qa-report.md](docs/phase-14a-physical-qa-report.md) and [docs/physical-qa-runbook.md](docs/physical-qa-runbook.md). Automated gates do not replace phone/tablet testing.

## File size

> Send files of any size — limited only by your device, browser, connection, and available storage.

There is no artificial 5 GB / 10 GB product ceiling. Receiver memory still scales with file size until download (Blob assembly).

## Documentation

- [Production deployment](docs/production-deployment.md)
- [Security](docs/security.md)
- [Global connectivity](docs/global-connectivity.md)
- [Device validation](docs/device-validation.md)
- [Phase 14C LAN certification report](docs/phase-14c-lan-certification-report.md)
- [Phase 14B LAN certification report](docs/phase-14b-lan-certification-report.md)
- [Phase 14A physical QA report](docs/phase-14a-physical-qa-report.md)
- [Physical QA runbook](docs/physical-qa-runbook.md)
- [Phase 13C validation report](docs/phase-13c-validation-report.md)
- [Phase 13B validation report](docs/phase-13b-validation-report.md)
- [Phase 13A validation report](docs/phase-13a-validation-report.md)
- [Phase 12 final validation report](docs/phase-12-final-validation-report.md)
- [Phase 12B validation report](docs/phase-12b-validation-report.md)
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
