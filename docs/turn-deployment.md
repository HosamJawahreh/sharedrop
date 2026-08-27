# TURN deployment

ShareDrop supports TURN and TURNS through `VITE_ICE_SERVERS`. No TURN provider is hard-coded. No TURN credentials are committed to the repository.

Phase 11B prepares **configuration and relay-compatible architecture**. Physical relay proof requires a real TURN deployment.

## When TURN is needed

| Scenario                                                         | Likely ICE path       |
| ---------------------------------------------------------------- | --------------------- |
| Same LAN / same host                                             | `host` — TURN unused  |
| Simple NAT + STUN                                                | `srflx` — TURN unused |
| Symmetric NAT, CGNAT, strict firewalls, some cross-network pairs | `relay` via TURN      |

Do **not** treat “TURN unavailable” as automatic connection failure — direct paths may still succeed.

## Architecture

```text
ConnectionEngine
  → RTCPeerConnection(iceServers from VITE_ICE_SERVERS)
  → ICE (host / srflx / relay — browser selects)
  → RTCDataChannel
  → TransferEngine
```

File bytes never enter the signaling server. TURN may relay **encrypted** WebRTC traffic only.

## Configure

1. Provision a TURN server (self-hosted coturn, or a managed provider).
2. Prefer **ephemeral credentials** (time-limited) over long-lived shared secrets.
3. Set env at build time (placeholders only):

```bash
export VITE_ICE_SERVERS='[
  {"urls":"stun:stun.example.com:19302"},
  {"urls":"turn:turn.example.com:3478?transport=udp","username":"…","credential":"…"},
  {"urls":"turns:turn.example.com:5349?transport=tcp","username":"…","credential":"…"}
]'
```

4. Serve the app over **HTTPS** and signaling over **WSS**.
5. Leave `VITE_ICE_TRANSPORT_POLICY` unset in production (natural ICE = `all`).
6. For forced-relay validation only:

```bash
export VITE_ICE_TRANSPORT_POLICY=relay
```

7. In a **DEV** build, confirm diagnostics candidate type becomes `relay` when the path requires relay (or when policy is forced).
8. Transfer a real file; verify bytes + SHA-256.

UDP / TCP / TLS transports are expressed in the TURN URL (`?transport=udp|tcp`) — no application architecture changes required.

## Credential security

| Rule                                     | Status      |
| ---------------------------------------- | ----------- |
| Never commit credentials                 | Required    |
| Never log credentials                    | Required    |
| Never show credentials in diagnostics    | Required    |
| Safe diagnostics: server count + schemes | Allowed     |
| Prefer ephemeral TURN credentials        | Recommended |

Invalid `VITE_ICE_SERVERS` falls back to default STUN. Dev warnings must not echo the raw env value.

## Validation checklist

```text
[ ] VITE_ICE_SERVERS parses (STUN + TURN + TURNS)
[ ] No secrets committed to git
[ ] Diagnostics show schemes without usernames/passwords
[ ] Natural ICE still selects host/srflx when available
[ ] Forced relay (optional) yields candidateType=relay
[ ] Connection succeeds across networks that fail without TURN
[ ] File transfer integrity PASS
[ ] Throughput recorded
```

## Cross-network test log (template)

Copy one row per physical test. Do not fabricate.

```text
Date:
Device A / Browser A / OS A / Network A:
Device B / Browser B / OS B / Network B:
Candidate type:
Connection duration:
RTT:
File size:
Transfer duration:
Throughput:
SHA-256:
Result: PASS | FAIL | NOT TESTED
```

## Phase 11B status

| Item                                               | Result                                                 |
| -------------------------------------------------- | ------------------------------------------------------ |
| STUN / TURN / TURNS config parsing                 | **PASS** (automated)                                   |
| Multiple ICE servers                               | **PASS** (automated)                                   |
| Credential-safe diagnostics                        | **PASS** (automated)                                   |
| Relay-compatible RTCConfiguration                  | **READY** / **CONFIGURED**                             |
| Trickle ICE not dropped by signaling rate limits   | **PASS** (Phase 11C)                                   |
| Production TURN infrastructure in this environment | **NOT TESTED** — no TURN server/credentials configured |
| Physical relay transfer                            | **NOT TESTED**                                         |
| Wi‑Fi ↔ cellular / cross-country                   | **NOT TESTED**                                         |

Do not claim production TURN works solely because JSON parsing succeeds.

See [global-connectivity.md](./global-connectivity.md), [production-deployment.md](./production-deployment.md), and [phase-11-validation-report.md](./phase-11-validation-report.md).
