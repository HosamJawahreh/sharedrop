# Phase 7 — End-to-End Transfer Validation Report

**Date:** 2026-08-26  
**Environment:** Linux development machine, Chromium via Playwright, local signaling (`ws://127.0.0.1:8787`)  
**Rule:** Physical Android/iPhone results that were not performed are marked **NOT TESTED**. No fabricated benchmarks.

---

## Verdict

```text
PARTIAL — PHYSICAL VALIDATION REMAINS
```

Same-machine Chromium browser-to-browser transfer is proven with real WebRTC DataChannels, byte equality, and SHA-256 verification. Physical mobile device matrix was not executed in this environment.

---

## Automated quality gates

```text
unit/integration (vitest): 76/76 PASS
e2e (playwright chromium): 12/12 PASS
typecheck: PASS
lint: PASS
build: PASS
format: PASS
```

---

## Browser integration (Playwright, real Chromium ×2)

Harness: `e2e/transfer.spec.ts`  
Uses: real Vite app, real signaling server, real `RTCPeerConnection`, real `RTCDataChannel`, real `TransferEngine`.  
Verification: `source bytes === received bytes` and SHA-256 match via `__sharedropE2E.getReceivedFileSnapshots()`.

| Test                            | Result   | Notes                                           |
| ------------------------------- | -------- | ----------------------------------------------- |
| same-machine browser-to-browser | **PASS** | Two independent browser contexts                |
| 1 KB                            | **PASS** | Byte + SHA-256 verified                         |
| 10 KB binary                    | **PASS** | Byte + SHA-256 verified                         |
| 1 MB                            | **PASS** | Byte + SHA-256 verified                         |
| 10 MB                           | **PASS** | Byte + SHA-256 verified (~1.5 min on this host) |
| multiple files (3)              | **PASS** | Independent integrity per file                  |
| Unicode filename                | **PASS** | `日本語.txt`                                    |
| Arabic filename                 | **PASS** | `مرحبا.txt`                                     |
| emoji filename                  | **PASS** | `🎉party.txt`                                   |
| spaces in filename              | **PASS** | `my file.txt`                                   |
| zero-byte                       | **PASS** | Empty SHA-256 verified                          |
| sender cancellation             | **PASS** | No completed received files                     |
| receiver cancellation           | **PASS** | Late chunks ignored after cancel                |
| receiver rejection              | **PASS** | No FILE data delivered                          |
| connection interruption         | **PASS** | Both sides → `failed`, no complete              |
| transfer diagnostics            | **PASS** | bytesSent/duration/throughput observed          |

### Observed diagnostics (1 MB transfer, Chromium localhost)

Exact peak buffered / RTT / candidate type vary per run. The diagnostics test asserts:

- `bytesSent > file size` (protocol overhead)
- `bytesReceived > 0`
- `transferDurationMs > 0`
- `averageThroughputBytesPerSecond > 0`
- `peakBufferedAmount >= 0`

**Real DataChannel backpressure pauses:** **NOT OBSERVED** in e2e (localhost transfers often stay under the high-water mark). Unit test covers pause/resume with a forced high `bufferedAmount`.

---

## Physical device matrix

| Combination                              | Result                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Chrome Desktop ↔ Chrome Desktop (manual) | **NOT TESTED** (automated Chromium e2e covers equivalent same-machine path) |
| Chrome Desktop ↔ Android Chrome          | **NOT TESTED**                                                              |
| Chrome Desktop ↔ iPhone Safari           | **NOT TESTED**                                                              |
| Android Chrome ↔ iPhone Safari           | **NOT TESTED**                                                              |
| iPhone Safari ↔ iPhone Safari            | **NOT TESTED**                                                              |
| Android Chrome ↔ Android Chrome          | **NOT TESTED**                                                              |

---

## Large files (100 MB / 500 MB / 1 GB)

| Size   | Result         | Duration | Throughput | Memory |
| ------ | -------------- | -------- | ---------- | ------ |
| 100 MB | **NOT TESTED** | —        | —          | —      |
| 500 MB | **NOT TESTED** | —        | —          | —      |
| 1 GB   | **NOT TESTED** | —        | —          | —      |

Largest automated transfer in Phase 7: **10 MB** (PASS).

---

## Bugs found and fixed in Phase 7

| Symptom                                                        | Root cause                                                                           | Fix                                                    | Tests                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------- |
| Cancel/interrupt e2e flaked when transfer finished too quickly | Waited for `transferring` after accept; already `completed`                          | Wait for Cancel button; use 8 MB payload               | e2e cancel/interrupt       |
| Connection interrupt left sender stuck                         | `waitForBuffer` waited forever for `bufferedamountlow` after channel close           | Unblock on close/cancel; fail send on closed transport | e2e interruption           |
| Receiver cancel showed failed UI                               | Late `FILE_CHUNK` after cancel nullified `activeReceive` → protocol error → `failed` | Ignore frames in terminal states                       | unit + e2e receiver cancel |
| `cancel()` could throw before setting state                    | `sendFrame` threw on closed channel                                                  | try/catch around cancel send                           | covered by cancel e2e      |

---

## Known limitations (not bugs)

1. Receiver Blob assembly — memory ∝ file size until download
2. No resume
3. Sequential multi-file transfer
4. Real DataChannel backpressure pauses not always observed on localhost
5. Safari/iOS download behavior still requires physical validation

---

## How to re-run

```bash
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
npm run format:check
```

Manual LAN physical matrix: see [lan-development.md](lan-development.md) and [phase-5-device-validation.md](phase-5-device-validation.md).
