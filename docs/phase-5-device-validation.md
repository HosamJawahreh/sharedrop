# Phase 5 — Device Validation

This document records **actual** validation results for ShareDrop peer-to-peer file transfer.

**Validation environment (automated agent):** Linux development machine, Cursor agent sandbox. Physical Android and iOS devices were **not available** to the validating agent.

**Rule:** Results marked `NOT TESTED` were not performed. No fabricated throughput, memory, or device data appears below.

---

## Summary matrix

| Combination                     | Discovery  | Connection | Small file | Multi-file | Unicode    | Zero-byte  | Cancel     | Reject     | Integrity      | Large files | Overall        |
| ------------------------------- | ---------- | ---------- | ---------- | ---------- | ---------- | ---------- | ---------- | ---------- | -------------- | ----------- | -------------- |
| Chrome Desktop ↔ Chrome Desktop | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | PARTIAL (mock) | NOT TESTED  | **NOT TESTED** |
| Chrome Desktop ↔ Android Chrome | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED     | NOT TESTED  | **NOT TESTED** |
| Chrome Desktop ↔ iPhone Safari  | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED     | NOT TESTED  | **NOT TESTED** |
| Android Chrome ↔ iPhone Safari  | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED     | NOT TESTED  | **NOT TESTED** |
| iPhone Safari ↔ iPhone Safari   | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED     | NOT TESTED  | **NOT TESTED** |
| Android Chrome ↔ Android Chrome | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED     | NOT TESTED  | **NOT TESTED** |

---

## What was validated in Phase 5 (automated)

Phase 5 added development diagnostics, transfer instrumentation, and regression tests. The following were validated **without physical devices**:

### Automated regression tests (mock transport)

| Test                                  | Result | Notes                              |
| ------------------------------------- | ------ | ---------------------------------- |
| Single-file P2P transfer (mock relay) | PASS   | `transfer-engine.test.ts`          |
| Zero-byte file (mock relay)           | PASS   | `transfer-engine.test.ts`          |
| Malformed chunk sequence              | PASS   | Receiver → `failed`                |
| Hash mismatch                         | PASS   | Receiver → `failed`, no file saved |
| Size mismatch before hash             | PASS   | Receiver → `failed`                |
| totalBytes mismatch in request        | PASS   | Request rejected, stays `idle`     |
| Too many files in request             | PASS   | Request rejected                   |
| Path traversal filename in request    | PASS   | Request rejected                   |
| Malformed binary frame                | PASS   | Receiver → `failed`, no crash      |
| Protocol frame codec                  | PASS   | `transfer-frame.test.ts`           |
| Filename sanitization                 | PASS   | `filename.test.ts`                 |
| Transport diagnostics exposure        | PASS   | `getDiagnostics()` bytes sent      |

### Code review (sender memory)

| Check                                                   | Result                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| No whole-file `file.arrayBuffer()` in transfer engine   | PASS — only `file.slice(start, end).arrayBuffer()` per chunk |
| Backpressure via `bufferedAmount` + `bufferedamountlow` | PASS — implemented; real DataChannel behavior **NOT TESTED** |
| Progress throttling (100 ms)                            | PASS — unchanged from Phase 4                                |

---

## Detailed test log template

Use this template when performing manual validation on real devices:

```text
Date:
Sender: [browser / OS / device]
Receiver: [browser / OS / device]
Network: [same Wi-Fi / cross-network / TURN]
Test: [e.g. small file, Unicode filename, 100 MB]
File name:
File size:
Duration:
Average throughput:
Integrity (size + SHA-256):
Success / Failure:
Peak memory (observed):
Peak bufferedAmount:
ICE candidate type:
Notes:
```

---

## Large-file results

| Size   | Result     | Duration | Throughput | Memory | Notes                          |
| ------ | ---------- | -------- | ---------- | ------ | ------------------------------ |
| 100 MB | NOT TESTED | —        | —          | —      | Requires real browser + device |
| 500 MB | NOT TESTED | —        | —          | —      | Requires real browser + device |
| 1 GB   | NOT TESTED | —        | —          | —      | Requires real browser + device |

---

## Receiver memory (Blob assembly)

| Browser        | 100 MB     | 500 MB     | 1 GB       | Notes                              |
| -------------- | ---------- | ---------- | ---------- | ---------------------------------- |
| Chrome desktop | NOT TESTED | NOT TESTED | NOT TESTED | Blob assembly — memory ∝ file size |
| Android Chrome | NOT TESTED | NOT TESTED | NOT TESTED | —                                  |
| iPhone Safari  | NOT TESTED | NOT TESTED | NOT TESTED | Mobile RAM limits likely           |

---

## Browser download behavior

| Browser        | Filename preserved | Unicode    | Arabic     | Emoji      | Zero-byte  | Multi-file | Result     |
| -------------- | ------------------ | ---------- | ---------- | ---------- | ---------- | ---------- | ---------- |
| Chrome desktop | NOT TESTED         | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Android Chrome | NOT TESTED         | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| iPhone Safari  | NOT TESTED         | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |

---

## Cancellation & interruption

| Scenario                        | Result     | Notes                                                 |
| ------------------------------- | ---------- | ----------------------------------------------------- |
| Sender cancel during transfer   | NOT TESTED | Mock: `TRANSFER_CANCEL` handled                       |
| Receiver reject before start    | NOT TESTED | Mock: `TRANSFER_REJECT` handled                       |
| Connection lost during transfer | NOT TESTED | Engine sets `failed` on disconnect (code review PASS) |
| Wi-Fi disabled mid-transfer     | NOT TESTED | —                                                     |

---

## Development diagnostics added (Phase 5)

Available only when `import.meta.env.DEV` is true (stripped from production consumer UI):

### Connection panel

- signalingState, iceGatheringState, iceConnectionState, connectionState
- RTT, candidate type, local/remote candidate summary
- available outgoing bitrate (when exposed by browser)
- WebRTC stats bytes sent/received (data-channel reports)

### Transfer panel

- bytes sent/received (transport counters)
- bufferedAmount, peak bufferedAmount
- bufferedAmountLowThreshold
- backpressure pause count
- transfer duration, average throughput

Implementation:

- `src/core/connection/webrtc-stats.ts`
- `src/core/transfer/diagnostics.ts`
- `src/features/nearby-send/ConnectionDiagnosticsPanel.tsx` (extended)
- `src/features/nearby-send/TransferDiagnosticsPanel.tsx` (new)

---

## Known limitations (not bugs)

1. **Receiver Blob assembly** — memory proportional to file size until download
2. **No resume** — interrupted transfers fail; user retries manually
3. **Sequential files** — one file at a time over DataChannel
4. **iOS multi-file save** — may require separate user taps per file
5. **WebRTC stats availability** — varies by browser; unavailable metrics show `—`

---

## Bugs found and fixed in Phase 5

| Issue                                             | Fix                                              |
| ------------------------------------------------- | ------------------------------------------------ |
| Missing dev transfer metrics                      | Added `TransferDiagnostics` + panel              |
| Missing WebRTC stats in connection diagnostics    | Added `collectWebRtcStats()` + polling           |
| Transport byte counters unavailable               | Extended `DataChannelTransport.getDiagnostics()` |
| Path traversal via `../` segments before basename | Fixed `sanitizeFilename()` segment check         |

---

## How to run manual validation

```bash
npm run dev:all
```

1. Open `http://<lan-ip>:5173` on two devices/browsers on the same network.
2. Device A: **Send to nearby** → select Device B → connect.
3. Select files → **Send**; Device B: **Accept**.
4. Verify received files (size + hash if needed).
5. Record results in this document.

Development diagnostics appear at the bottom of the connection screen in dev builds only.

---

## Phase 5 verdict

```text
FAIL Phase 5 (physical validation incomplete)
```

**Reason:** Real cross-browser and cross-device transfer validation was not performed. Automated regression coverage increased, diagnostics were added, and defensive handling was verified in tests — but the Phase 5 objective requires evidence from real browsers/devices.

**Recommendation:** Run the manual matrix above on available hardware, update this document with measured results, then re-evaluate for Phase 5 pass.

---

## Suggested Phase 6

1. Complete physical validation matrix with recorded metrics
2. Streaming receiver storage (File System Access API + fallbacks) if Blob memory is a blocker
3. TURN/cross-network reliability testing
4. Optional transfer resume protocol design (not implementation until stability proven)

---

## Phase 6 update (LAN readiness)

Phase 6 implemented LAN development infrastructure. See [lan-development.md](lan-development.md).

Verified in development (not full P2P transfer):

- `npm run dev:all` prints LAN URLs (e.g. `http://192.168.100.205:5173`)
- Signaling URL auto-derives from page host (`ws://localhost:8787` when opened locally)
- LAN readiness panel reports signaling **connected** when servers are running

Full integration and physical device matrix remain **NOT TESTED**.

## Phase 7 update (browser e2e)

See [phase-7-validation-report.md](phase-7-validation-report.md).

Same-machine Chromium ↔ Chromium browser-to-browser transfer (real WebRTC + byte/SHA-256 verification) is **PASS** via Playwright. Physical Android/iPhone matrix remains **NOT TESTED**.
