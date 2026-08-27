# PWA support

ShareDrop Phase 8 ships as an installable Progressive Web App using Vite + `vite-plugin-pwa`.

## What is implemented

| Piece                | Status                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| Web App Manifest     | Yes (`name`, `short_name`, `start_url`, `scope`, `display: standalone`, icons, theme) |
| Service worker       | Yes (app-shell caching via Workbox; **does not** proxy WebRTC file bytes)             |
| Install prompt       | Yes — uses `beforeinstallprompt` when the browser provides it                         |
| Soft install tip     | Yes — same headline when BIP is unavailable (no fake Install button)                  |
| Standalone detection | Yes — `display-mode` media queries + iOS `navigator.standalone`                       |
| Offline app shell    | Partial — cached shell assets; signaling/WebRTC still need network                    |

Primary install copy:

> **Need Faster Transfer? Download To Your Device**

Supporting copy explains faster access and does **not** claim background WebRTC while closed.

CTA when BIP is available: **Install ShareDrop**

The prompt/tip is hidden when:

- already running as an installed/standalone PWA
- the user dismissed it (persisted for the browsing profile)

Installation is never faked. On iOS Safari (no `beforeinstallprompt`), ShareDrop shows an honest tip pointing to the browser’s Add to Home Screen flow.

## Platform matrix (honest)

| Capability                              | Chrome Desktop                                          | Android Chrome                                           | iOS Safari                                                              |
| --------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| PWA install                             | Supported (Chromium install UI / `beforeinstallprompt`) | Supported                                                | Supported via Share → Add to Home Screen (**no** `beforeinstallprompt`) |
| Standalone mode                         | Supported                                               | Supported                                                | Supported (home-screen icon)                                            |
| Notifications API                       | Supported (permission required)                         | Supported (permission required)                          | Partial / version-dependent                                             |
| Web Push                                | Supported with service worker + push service            | Supported                                                | Partial (iOS 16.4+ home-screen PWA; limitations apply)                  |
| Background receiving while fully closed | **NOT SUPPORTED**                                       | **NOT SUPPORTED**                                        | **NOT SUPPORTED**                                                       |
| WebRTC transfer while tab/PWA open      | Supported                                               | Supported (**NOT TESTED** on physical device in Phase 8) | Expected / **NOT TESTED** on physical device                            |
| Receive transfers with app terminated   | **NOT SUPPORTED**                                       | **NOT SUPPORTED**                                        | **NOT SUPPORTED**                                                       |

Physical mobile validation remains **NOT TESTED** unless explicitly recorded elsewhere.

## Background receiving (architecture)

Desired long-term flow:

```text
Installed PWA → sender connects → recipient notified → Accept/Reject → WebRTC transfer
```

Browser reality:

- A **terminated** PWA cannot maintain or accept a WebRTC DataChannel
- Service workers cannot run RTCPeerConnection as a general substitute for an open page
- Web Push can deliver a **metadata** wake-up on some platforms, but the user must open the app to complete WebRTC

Phase 8 therefore:

- Probes Notification / Service Worker / Push capability (`src/core/background`)
- Documents limitations honestly
- Does **not** show UI promising “receive while closed”
- Does **not** upload file contents to a server for push delivery

If push is added later, notifications must contain only metadata (e.g. “Ahmed wants to send you 3 files”) with Accept/Reject opening the live app session.

## Service worker boundaries

Files travel:

```text
Peer A → WebRTC DataChannel → Peer B
```

The service worker must never intercept or store transfer bytes. Signaling may coordinate presence/SDP/ICE only.

## Automation limits (Playwright)

- Manifest + SW registration are validated best in **production build / preview**
- Dev server keeps `devOptions.enabled: false` (no SW noise during development)
- Playwright **cannot** fully simulate the native install gesture / OS install UI
- Passing “manifest file exists” alone is **not** treated as a full install PASS

## Related docs

- [Device identity](./device-identity.md)
- [Browser support](./browser-support.md)
- [Architecture](./architecture.md)
