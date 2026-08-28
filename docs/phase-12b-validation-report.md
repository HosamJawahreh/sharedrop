# Phase 12B validation report — Global Saved Devices

**Date:** 2026-08-27  
**Version:** 0.11.0  
**Rule:** Physical cross-network / cross-country results are **NOT TESTED** unless actually executed. No fabricated Germany↔China claims.

## Final verdict

**PARTIAL**

Automated UX semantics, identity matching, and consumer copy gates are **PASS**. Physical Wi‑Fi↔cellular and cross-country transfers remain **NOT TESTED**.

## Product model (documented)

| Category          | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| **Your devices**  | Locally remembered `deviceId`s — Online / Offline; not authentication |
| **Available now** | Currently discoverable peers not already listed under Your devices    |

- Online saved device → normal connection flow (network-agnostic)
- Offline saved device → “This device is currently offline.” — **no** queued delivery
- ICE / STUN / TURN remain invisible in consumer UI

## Automated

| Gate       | Result               |
| ---------- | -------------------- |
| Vitest     | **PASS** (156 / 156) |
| Playwright | **PASS** (17 / 17)   |
| Typecheck  | **PASS**             |
| Lint       | **PASS**             |
| Build      | **PASS**             |
| Format     | **PASS**             |

## Semantics checklist

| Item                                                | Status          |
| --------------------------------------------------- | --------------- |
| Your devices / Available now language               | **PASS**        |
| No consumer “nearby” for global saved devices       | **PASS**        |
| Online saved → connection flow                      | **PASS** (unit) |
| Offline saved → no false connect                    | **PASS** (unit) |
| deviceId identity across rename / session / network | **PASS** (unit) |
| No consumer ICE / TURN / Wi‑Fi blame                | **PASS**        |
| No cloud / queued delivery                          | **PASS**        |
| Wi‑Fi ↔ cellular physical                           | **NOT TESTED**  |
| Cross-country physical                              | **NOT TESTED**  |

## Related

- [device-identity.md](./device-identity.md)
- [global-connectivity.md](./global-connectivity.md)
- [product-scope.md](./product-scope.md)
- [browser-support.md](./browser-support.md)
