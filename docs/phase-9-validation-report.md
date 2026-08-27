# Phase 9 validation report — Global P2P + Real Device Reliability

**Date:** 2026-08-26  
**Version:** 0.9.0  
**Environment:** Linux host; Chromium via Playwright; signaling `ws://127.0.0.1:8787`; default Google STUN via ICE config.  
**Rule:** Unavailable physical/mobile/cross-network/TURN-infrastructure tests are **NOT TESTED**. No fabricated claims.

## Final verdict

**PARTIAL**

Automated desktop Chromium↔Chromium transfer, integrity, cancellation, interruption, saved devices, PWA build markers, ICE diagnostics, and 100 MB transfer are green. Physical Android/iPhone, Wi‑Fi↔cellular, cross-country, and production TURN relay transfers were not available in this environment.

## Automated validation

| Gate       | Result |
| ---------- | ------ |
| Vitest     | 98/98  |
| Playwright | 17/17  |
| Typecheck  | PASS   |
| Lint       | PASS   |
| Build      | PASS   |
| Format     | PASS   |

## Device validation

| Pair                            | Result                                      |
| ------------------------------- | ------------------------------------------- |
| Chrome Desktop ↔ Chrome Desktop | **PASS** (Playwright Chromium×2, same host) |
| Chrome Desktop ↔ Android Chrome | **NOT TESTED**                              |
| Chrome Desktop ↔ iPhone Safari  | **NOT TESTED**                              |
| Android Chrome ↔ Android Chrome | **NOT TESTED**                              |
| Android Chrome ↔ iPhone Safari  | **NOT TESTED**                              |
| iPhone Safari ↔ iPhone Safari   | **NOT TESTED**                              |

### Automated Chromium pair evidence

| Field          | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| Browser        | Chromium (Playwright headless shell)                                    |
| OS             | Linux                                                                   |
| Network        | loopback / same host                                                    |
| Candidate type | `host`                                                                  |
| 100 MB         | duration **16.7 s**; throughput **~6.3 MB/s** (6620215 B/s); SHA-256 OK |

## Network validation

| Scenario                          | Result                                  |
| --------------------------------- | --------------------------------------- |
| LAN / same-host automated         | **PASS**                                |
| Manual multi-device LAN           | **NOT TESTED**                          |
| Wi-Fi ↔ cellular                  | **NOT TESTED**                          |
| Different networks                | **NOT TESTED**                          |
| Cross-country                     | **NOT TESTED**                          |
| STUN config                       | **PASS** (default + `VITE_ICE_SERVERS`) |
| STUN `srflx` physical observation | **NOT TESTED** (localhost uses `host`)  |
| TURN config parsing               | **PASS**                                |
| TURN `relay` physical transfer    | **NOT TESTED**                          |

## Large files

| Size   | Result         | Notes                |
| ------ | -------------- | -------------------- |
| 10 MB  | **PASS**       | Phase 7/9 e2e        |
| 100 MB | **PASS**       | See throughput above |
| 500 MB | **NOT TESTED** |                      |
| 1 GB   | **NOT TESTED** |                      |
| 2 GB+  | **NOT TESTED** |                      |

**Policy:** no artificial 5 GB / 10 GB per-file ceiling. Practical limits remain device, browser, connection, and storage (receiver Blob memory).

## PWA

| Check                           | Result         |
| ------------------------------- | -------------- |
| Browser transfer (Chromium e2e) | **PASS**       |
| Manifest + service worker build | **PASS**       |
| Installed PWA transfer          | **NOT TESTED** |
| Android PWA                     | **NOT TESTED** |
| iOS PWA                         | **NOT TESTED** |

## Saved devices

| Check            | Result   |
| ---------------- | -------- |
| Persistence      | **PASS** |
| Online matching  | **PASS** |
| Offline state    | **PASS** |
| Reconnect + send | **PASS** |

## Background receiving

| Platform | Result                                            |
| -------- | ------------------------------------------------- |
| Desktop  | Foreground **PASS**; terminated **NOT SUPPORTED** |
| Android  | **NOT TESTED** / terminated **NOT SUPPORTED**     |
| iOS      | **NOT TESTED** / terminated **NOT SUPPORTED**     |

## Phase 9 product changes recorded

- Removed marketing-style `MAX_FILE_BYTES` / `MAX_TOTAL_TRANSFER_BYTES` ceilings.
- E2E connection diagnostics + 100 MB integrity path.
- Docs: `global-connectivity.md`, `device-validation.md`, `turn-deployment.md`.

## See also

- [device-validation.md](./device-validation.md)
- [global-connectivity.md](./global-connectivity.md)
- [turn-deployment.md](./turn-deployment.md)
