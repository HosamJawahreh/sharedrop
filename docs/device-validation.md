# Device & network validation (Phase 9)

**Date:** 2026-08-26  
**Environment:** Linux development host; Chromium via Playwright; local signaling `ws://127.0.0.1:8787`; default Google STUN in ICE config.  
**Rule:** Unavailable physical/mobile/cross-network tests are **NOT TESTED**. No fabricated throughput or platform claims.

## Automated quality gates

```text
Vitest: 98/98
Playwright: 17/17
Typecheck / lint / build / format: PASS
Full report: docs/phase-9-validation-report.md
```

## Device matrix

| Device A       | Device B       | Result                                         | Evidence                        |
| -------------- | -------------- | ---------------------------------------------- | ------------------------------- |
| Chrome Desktop | Chrome Desktop | **PASS** (automated Chromium ×2, same machine) | Playwright Phase 7–9 e2e        |
| Chrome Desktop | Android Chrome | **NOT TESTED**                                 | No physical Android in this run |
| Chrome Desktop | iPhone Safari  | **NOT TESTED**                                 | No physical iPhone in this run  |
| Android Chrome | Android Chrome | **NOT TESTED**                                 |                                 |
| Android Chrome | iPhone Safari  | **NOT TESTED**                                 |                                 |
| iPhone Safari  | iPhone Safari  | **NOT TESTED**                                 |                                 |

### Automated Chromium pair (representative)

| Field          | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| Browser        | Chromium (Playwright)                                               |
| OS             | Linux                                                               |
| Network        | loopback / same host                                                |
| Connection     | WebRTC DataChannel                                                  |
| Candidate type | `host` (Phase 9 diagnostics e2e)                                    |
| Integrity      | byte equality + SHA-256 (≤10 MB e2e); SHA-256 + size for 100 MB e2e |
| 100 MB         | **16.7 s**, ~**6.3 MB/s** (6620215 B/s), SHA-256 verified           |

## Network matrix

| Scenario                             | Result                                    |
| ------------------------------------ | ----------------------------------------- |
| Same-host / LAN-equivalent automated | **PASS**                                  |
| Manual LAN multi-device              | **NOT TESTED**                            |
| Wi-Fi ↔ cellular                     | **NOT TESTED**                            |
| Different networks                   | **NOT TESTED**                            |
| Cross-country                        | **NOT TESTED**                            |
| STUN config present                  | **PASS** (default + `VITE_ICE_SERVERS`)   |
| STUN `srflx` physical observation    | **NOT TESTED** (localhost prefers `host`) |
| TURN config parsing                  | **PASS**                                  |
| TURN `relay` physical transfer       | **NOT TESTED**                            |

## Large files

| Size   | Result         | Notes                                           |
| ------ | -------------- | ----------------------------------------------- |
| 10 MB  | **PASS**       | Phase 7 e2e                                     |
| 100 MB | **PASS**       | 16.7 s; ~6.3 MB/s; candidate `host`; SHA-256 OK |
| 500 MB | **NOT TESTED** |                                                 |
| 1 GB   | **NOT TESTED** |                                                 |
| 2 GB+  | **NOT TESTED** |                                                 |

Receiver memory ∝ file size (Blob assembly). Mobile OOM risk remains until physically measured.

**Product policy:** no artificial 5 GB / 10 GB ceiling. Limits are device, browser, connection, and storage.

## Saved devices (automated)

| Check                       | Result                        |
| --------------------------- | ----------------------------- |
| Persist across reload       | **PASS** (Playwright Phase 8) |
| Online matching by deviceId | **PASS**                      |
| Offline state               | **PASS** (unit + UI)          |
| Reconnect + transfer        | **PASS** (Playwright Phase 8) |

## PWA

| Check                                | Result         |
| ------------------------------------ | -------------- |
| Manifest + SW (production build)     | **PASS**       |
| Browser-mode transfer (Chromium e2e) | **PASS**       |
| Installed PWA transfer               | **NOT TESTED** |
| Android PWA                          | **NOT TESTED** |
| iOS PWA                              | **NOT TESTED** |

## Background receiving

| Platform           | Result                                                              |
| ------------------ | ------------------------------------------------------------------- |
| Desktop Chrome     | **NOT SUPPORTED** while terminated; foreground **PASS** (automated) |
| Android Chrome/PWA | **NOT TESTED** / terminated **NOT SUPPORTED**                       |
| iOS Safari/PWA     | **NOT TESTED** / terminated **NOT SUPPORTED**                       |

## How to run physical validation

1. `npm run dev:all` — open LAN URL on both devices.
2. Confirm device names; start **Send to nearby**.
3. Connect; note **Connection** diagnostics (candidate type) in DEV builds.
4. Transfer small → multi → Unicode/Arabic/emoji → zero-byte → cancel → interrupt → reconnect.
5. Record browser version, OS, network, candidate type, size, duration, throughput.
6. For TURN: configure `VITE_ICE_SERVERS`, force a relay path, confirm `candidateType=relay`.

Update this file with measured rows — never invent them.
