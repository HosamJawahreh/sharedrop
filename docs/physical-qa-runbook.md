# Physical QA runbook (Phase 14A)

Use this checklist on **real devices** connected to the **same Wi‑Fi** first. Record results in [phase-14a-physical-qa-report.md](./phase-14a-physical-qa-report.md).

**Rule:** Mark **PASS** only after you perform the test. Use **NOT TESTED** when hardware is unavailable.

---

## Setup

```bash
npm install
npm run dev:all
```

1. Note the **LAN URL** from the startup banner (e.g. `http://192.168.x.x:5173`).
2. Open that URL on **every** test device — never use `localhost` on phones.
3. Allow local network / discovery permissions if the browser prompts.
4. Record for each device: OS version, browser name + version, browser vs installed PWA.

Optional DEV diagnostics: collapse **Developer diagnostics** at the bottom (DEV builds only). Consumer UI stays clean in production builds.

---

## Test A — Desktop → Mobile (receiver)

**Sender:** Linux/macOS/Windows desktop browser  
**Receiver:** iPhone Safari or Android Chrome

| Step | Action                             | Pass criteria                                                            |
| ---- | ---------------------------------- | ------------------------------------------------------------------------ |
| 1    | Open ShareDrop on both devices     | Homepage loads; no layout breakage                                       |
| 2    | Wait on receiver                   | Sender appears under **Available now** (note time to appear)             |
| 3    | Tap sender on receiver             | —                                                                        |
| 4    | On sender, tap receiver            | Connection screen; pulse/phase matches state                             |
| 5    | Wait                               | **Connected to [device] ✓**                                              |
| 6    | Sender: select 1 small file + Send | Receiver sees incoming request                                           |
| 7    | Receiver: **Decline**              | Sender shows clear failure; no stale transfer UI                         |
| 8    | Repeat send; receiver **Accept**   | Transfer completes; files intact                                         |
| 9    | Note                               | Discovery time, connect time, transfer size, duration, approximate speed |

---

## Test B — Mobile → Desktop (sender)

Reverse roles from Test A.

| Step | Action                                        | Pass criteria                                   |
| ---- | --------------------------------------------- | ----------------------------------------------- |
| 1    | Mobile selects desktop from **Available now** | Immediate tap feedback                          |
| 2    | Connect                                       | Connected state                                 |
| 3    | Mobile: file picker                           | Names, count, total size correct                |
| 4    | Send                                          | Desktop receives; direction clear on both sides |
| 5    | Complete                                      | Calm completion state; can send again           |

---

## Test C — File selection matrix (per sender device)

| File type                                | Expected                                                 |
| ---------------------------------------- | -------------------------------------------------------- |
| One small text file (~1 KB)              | Sends; integrity OK                                      |
| 3+ files                                 | Count and total size correct; can remove one before send |
| JPEG/PNG                                 | Picker opens; name displays                              |
| PDF                                      | Picker opens; transfer OK                                |
| Large file (e.g. 50–200 MB, device-safe) | Progress accurate; no fake 100%; note speed and any OOM  |

---

## Test D — PWA vs browser

On iOS and Android (if available):

1. Test full flow in **Safari / Chrome tab**.
2. Install PWA (**Need Faster Transfer? Download To Your Device** or platform add-to-home).
3. Repeat discovery → connect → transfer from **installed icon**.
4. Compare: device name stability, discovery on open, background return behavior.

---

## Test E — Motion review

On each physical device:

| Mode           | Checks                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| Normal         | Presence wave calm; selection responsive; connection pulse clear; transfer direction obvious |
| Reduced motion | Enable OS **Reduce Motion**; loops stop; status text still clear                             |

---

## Test F — Interruptions (document actual behavior)

Do not expect full background transfer unless observed.

| Scenario    | Procedure                                         | Record                                 |
| ----------- | ------------------------------------------------- | -------------------------------------- |
| Screen lock | Start transfer → lock → unlock                    | Connection/transfer state; UI accuracy |
| Background  | Start transfer → switch apps → return             | Same                                   |
| Wi‑Fi drop  | Briefly disable Wi‑Fi mid-connect or mid-transfer | Error copy; recovery or honest failure |

Classify as **ShareDrop bug**, **platform limitation**, or **expected browser policy**.

---

## Test G — Homepage layout

| Viewport      | Checks                                                  |
| ------------- | ------------------------------------------------------- |
| Small iPhone  | No horizontal scroll; cards tappable; identity readable |
| Large Android | Same                                                    |
| Desktop       | Same; drag-and-drop if testing desktop send             |

---

## Recording template (copy per session)

```text
Date:
Sender: [device] / [OS] / [browser or PWA version]
Receiver: [device] / [OS] / [browser or PWA version]
Network: Same Wi‑Fi / SSID: ___
Discovery: PASS|FAIL — appeared in __ s
Connection: PASS|FAIL — connected in __ s
Decline: PASS|FAIL
Transfer: PASS|FAIL — __ MB in __ s (~__ MB/s)
Files: [types/sizes tested]
Motion: OK / issue: ___
Interruption: ___
Issues: ___
```

---

## After any code fix

```bash
npm test
CI=1 npx playwright test
npm run typecheck && npm run lint && npm run format:check && npm run build
```

Then **retest the affected physical combination**.

Update [phase-14a-physical-qa-report.md](./phase-14a-physical-qa-report.md) and [device-validation.md](./device-validation.md).
