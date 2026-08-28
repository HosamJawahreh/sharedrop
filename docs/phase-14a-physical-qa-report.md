# Phase 14A validation report — Physical device QA + real-world validation

**Date:** 2026-08-28  
**Version:** 0.13.2  
**Scope:** Real-world reliability on physical devices and browsers. No product redesign; observe → reproduce → minimal fix only when bugs are found.

## LAN discovery failure investigation (2026-08-28)

Physical test on `http://192.168.100.205:5173` showed homepage error:

> Couldn't reach ShareDrop. Check your connection and try again.

### Root cause (most likely)

**Signaling service not reachable on port 8787** while the Vite frontend on 5173 loads fine.

Common causes observed in this environment:

1. **`npm run dev` only** — serves the web app but does **not** start the signaling server (`ws://…:8787`). Discovery requires both.
2. **Stale process on port 5173** — an older Vite instance without signaling, while a new `dev:all` may bind signaling on 8787 but fail/skip web on 5173.
3. **`VITE_SIGNALING_URL=ws://localhost:8787`** — phones opening the LAN URL would incorrectly connect to their own localhost (fixed in 0.13.2).
4. **OS firewall** — TCP 8787 blocked from LAN devices (5173 allowed, 8787 not).

### Architecture (verified)

| Service   | Port | Bind                     | Started by                           |
| --------- | ---- | ------------------------ | ------------------------------------ |
| Vite web  | 5173 | `0.0.0.0` (`host: true`) | `npm run dev` or `npm run dev:all`   |
| Signaling | 8787 | `0.0.0.0` (default)      | `npm run dev:signaling` or `dev:all` |

Browser signaling URL when opened at `http://192.168.100.205:5173`:

`ws://192.168.100.205:8787` (derived from `window.location.hostname` — no hardcoded localhost in browser).

### Fixes applied (0.13.2)

- Vite `strictPort: true` — prevents silent port drift when 5173 is busy
- `dev:all` warns when 5173 is in use without signaling on 8787
- Ignore loopback `VITE_SIGNALING_URL` when page is opened from a LAN host
- DEV LAN diagnostics: HTTP `/health` probe for signaling reachability

### Physical retest after fix

**NOT TESTED** — requires user to stop all ShareDrop processes, run `npm run dev:all`, open LAN URL on laptop + phone, and confirm discovery.

---

Automated regression remains green on the Linux development host. **No physical mobile or cross-device LAN sessions were performed in this run.** All physical matrix rows below are **NOT TESTED** until measured on real hardware.

Do not treat Playwright Chromium pairs as proof of phone/tablet reliability.

---

## Environment (this run)

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| QA host            | Linux x86_64 (Ubuntu, kernel 7.0)        |
| LAN interface      | Not available / not used in this session |
| Automated browsers | Chromium via Playwright (same host)      |
| Physical phones    | **Not connected to this QA session**     |

---

## Automated regression baseline

| Gate       | Result               |
| ---------- | -------------------- |
| Vitest     | **PASS** (163 / 163) |
| Playwright | **PASS** (18 / 18)   |
| Typecheck  | **PASS**             |
| Lint       | **PASS**             |
| Format     | **PASS**             |
| Build      | **PASS**             |

These gates validate logic and same-host browser behavior only — **not** physical-device reliability.

---

## Physical test matrix (same Wi‑Fi)

Record actual results after testing. **Do not mark PASS without performing the test.**

| Sender        | Receiver      | Network    | Browser / PWA (sender) | Browser / PWA (receiver) | Discovery | Connection | Transfer | Decline | Accept | Result     |
| ------------- | ------------- | ---------- | ---------------------- | ------------------------ | --------- | ---------- | -------- | ------- | ------ | ---------- |
| Linux Desktop | iPhone        | Same Wi‑Fi | —                      | —                        | —         | —          | —        | —       | —      | NOT TESTED |
| iPhone        | Linux Desktop | Same Wi‑Fi | —                      | —                        | —         | —          | —        | —       | —      | NOT TESTED |
| Linux Desktop | Android       | Same Wi‑Fi | —                      | —                        | —         | —          | —        | —       | —      | NOT TESTED |
| Android       | Linux Desktop | Same Wi‑Fi | —                      | —                        | —         | —          | —        | —       | —      | NOT TESTED |
| iPhone        | Android       | Same Wi‑Fi | —                      | —                        | —         | —          | —        | —       | —      | NOT TESTED |
| Android       | iPhone        | Same Wi‑Fi | —                      | —                        | —         | —          | —        | —       | —      | NOT TESTED |

### Automated reference (same host — not physical QA)

| Sender           | Receiver         | Network  | Discovery | Connection | Transfer | Result |
| ---------------- | ---------------- | -------- | --------- | ---------- | -------- | ------ |
| Chromium Desktop | Chromium Desktop | loopback | PASS      | PASS       | PASS     | PASS   |

---

## Browser / PWA matrix

| Platform      | Browser / mode   | Homepage | Discovery | Connect | Send | Receive | PWA install | Result     |
| ------------- | ---------------- | -------- | --------- | ------- | ---- | ------- | ----------- | ---------- |
| Linux Desktop | Chrome           | —        | —         | —       | —    | —       | N/A         | NOT TESTED |
| Linux Desktop | Firefox          | —        | —         | —       | —    | —       | N/A         | NOT TESTED |
| Linux Desktop | Edge             | —        | —         | —       | —    | —       | N/A         | NOT TESTED |
| iOS           | Safari (browser) | —        | —         | —       | —    | —       | —           | NOT TESTED |
| iOS           | Installed PWA    | —        | —         | —       | —    | —       | —           | NOT TESTED |
| Android       | Chrome (browser) | —        | —         | —       | —    | —       | —           | NOT TESTED |
| Android       | Installed PWA    | —        | —         | —       | —    | —       | —           | NOT TESTED |

---

## Section checklists (fill during physical QA)

### Homepage (per device)

| Check                            | Small iPhone | Large Android | Desktop | Notes |
| -------------------------------- | ------------ | ------------- | ------- | ----- |
| No horizontal scroll             | —            | —             | —       |       |
| No clipped content               | —            | —             | —       |       |
| Device cards usable              | —            | —             | —       |       |
| Touch targets comfortable        | —            | —             | —       |       |
| Device identity clear            | —            | —             | —       |       |
| Discovery motion not distracting | —            | —             | —       |       |

### Motion (Phase 13C)

| Check                           | Normal motion | Reduced motion | Notes |
| ------------------------------- | ------------- | -------------- | ----- |
| Presence wave smooth            | —             | —              |       |
| Device entrance acceptable      | —             | —              |       |
| Selection responsive            | —             | —              |       |
| Connection pulse understandable | —             | —              |       |
| Transfer direction clear        | —             | —              |       |
| Completion appropriate          | —             | —              |       |

### File selection

| Check                    | Result     | Notes |
| ------------------------ | ---------- | ----- |
| Small file               | NOT TESTED |       |
| Multiple files           | NOT TESTED |       |
| Image                    | NOT TESTED |       |
| PDF                      | NOT TESTED |       |
| Large file (device-safe) | NOT TESTED |       |
| Remove before send       | NOT TESTED |       |

### Interruption testing

| Scenario           | Result     | Observed behavior | Notes |
| ------------------ | ---------- | ----------------- | ----- |
| Screen lock        | NOT TESTED |                   |       |
| App backgrounding  | NOT TESTED |                   |       |
| Wi‑Fi interruption | NOT TESTED |                   |       |

---

## Bugs discovered

_None in this run — no physical sessions performed._

When bugs are found, record:

1. Root cause
2. Affected platform/browser
3. Reproduction steps
4. Fix applied (minimal)
5. Regression coverage added

---

## Platform limitations (known — not ShareDrop bugs)

| Platform / policy          | Limitation                                     | Workaround if any            |
| -------------------------- | ---------------------------------------------- | ---------------------------- |
| iOS Safari / PWA           | No reliable background receive when terminated | Keep app foreground          |
| Android Chrome / PWA       | Background transfer behavior varies by OEM/OS  | Document actual behavior     |
| Mobile browsers            | Large files may OOM receiver (Blob assembly)   | Test per device              |
| Cross-network without TURN | Direct ICE may fail                            | Configure `VITE_ICE_SERVERS` |

---

## Acceptance criteria (Phase 14A)

| Criterion                                  | Status      |
| ------------------------------------------ | ----------- |
| At least one desktop ↔ mobile combo tested | **NOT MET** |
| Discovery physically validated             | **NOT MET** |
| Connection physically validated            | **NOT MET** |
| Sender flow physically validated           | **NOT MET** |
| Receiver flow physically validated         | **NOT MET** |
| File transfer physically validated         | **NOT MET** |
| Accept and Decline physically validated    | **NOT MET** |
| Mobile UI reviewed                         | **NOT MET** |
| Motion reviewed on physical hardware       | **NOT MET** |
| Bugs documented                            | **N/A**     |
| Fixes with regression validation           | **N/A**     |
| Untested combinations honestly documented  | **PASS**    |
| Automated regression baseline              | **PASS**    |

---

## How to complete Phase 14A

See [physical-qa-runbook.md](./physical-qa-runbook.md).

1. `npm run dev:all` on a machine with a reachable LAN IP.
2. Open the **LAN URL** (not `localhost`) on each physical device.
3. Run each matrix row; record PASS / FAIL / NOT TESTED with browser version and OS.
4. Update this file and [device-validation.md](./device-validation.md) with measured rows.
5. If bugs are found: reproduce → minimal fix → re-run automated gates → retest physically.

---

## Recommended next step

**Complete physical QA** using the runbook, then re-issue this report with filled matrix rows. Do not proceed to Phase 14B until at least one real desktop ↔ mobile combination is validated.

## Related

- [physical-qa-runbook.md](./physical-qa-runbook.md)
- [device-validation.md](./device-validation.md)
- [lan-development.md](./lan-development.md)
- [phase-13c-validation-report.md](./phase-13c-validation-report.md)
