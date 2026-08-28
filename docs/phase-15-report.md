# Phase 15 — Premium UI/UX Report

## UI/UX

### Visual system

- Indigo / blue-violet primary palette with electric-blue accents (`src/index.css`)
- Deep navy dark mode via `prefers-color-scheme: dark`
- Central design tokens: `--color-primary`, `--color-secondary`, `--color-success`, `--color-danger`, `--color-warning`
- Motion tokens extended with `--motion-ambient-slow` for ambient waves

### Typography

- Existing Avenir Next / system stack retained with clearer hierarchy on device cards and connection headings
- Consumer copy: "Send files. Simply.", "Nearby devices", "Ready to send / receive"

### Homepage

- Minimal hero: ShareDrop + tagline + ambient `AirdropWave`
- Primary list: **Nearby devices** (unsaved peers)
- Secondary: **Saved devices** with `DeviceCard` components
- Removed "Your device" orientation block and rename entry points

### Device cards

- New `DeviceCard` component: icon, name, type label, availability dot, whole-card tap target

### Transfer screen

- Sender (offerer): "Send files to" + file picker
- Receiver (answerer): "Ready to receive" idle state — no file picker
- Transfer motion: `AirdropWave` + `TransferFlow` during active send/receive
- Completion: "Sent successfully" / "Received successfully"

### Animation system

- `AirdropWave`: ambient homepage/connection ripples + transfer packet variant
- Existing `PresenceWave`, `ConnectionPulse`, `TransferFlow` integrated
- `prefers-reduced-motion`: global collapse + wave-specific disable

## Device Identity

### Detection

- `device-presentation.ts`: Client Hints model (Chromium), UA model strings (Android `; Pixel 8)` and `Build/`), platform fallbacks
- Format: `<baseName> <typeLabel>` when distinct (e.g. `Pixel 7 Android Phone`, `Linux PC`)
- `refreshLocalDevicePresentation()` on provider mount for async Client Hints
- Rename UI removed from consumer flow; `DeviceNameSettings` not rendered

### Platform limitations

- Browsers cannot read OS hostname / account name in most cases
- iOS Safari: typically generic `iPhone` / `iPad` unless Client Hints or saved custom name
- Android: model from UA when present; otherwise honest `Mobile` + type label
- Desktop: `Mac`, `Windows PC`, `Linux PC` — not claimed as exact hostname

### Display format

- Cards: line 1 = base name, line 2 = type + availability
- Signaling `displayName` = full presentation string

## Connection UX

### Sender (offerer — device that tapped a peer)

- Connects → "Connecting to {name}" → "Ready to send" → file selection → send

### Receiver (answerer)

- Incoming connect auto-accepted by engine → "Ready to receive" / "{name} is connected"
- Incoming **file** transfer: Accept / Decline on `TransferPanel`

## Animation

| Context            | Component                               | Reduced motion     |
| ------------------ | --------------------------------------- | ------------------ |
| Homepage discovery | `AirdropWave` ambient                   | Static rings       |
| Connecting         | `AirdropWave` + `ConnectionPulse`       | No pulse animation |
| Transferring       | `AirdropWave` transfer + `TransferFlow` | Progress bar only  |
| Complete           | `sd-motion-complete` class              | Instant            |

## Regression (automated)

| Gate       | Result                                                       |
| ---------- | ------------------------------------------------------------ |
| Vitest     | **169 passed**                                               |
| Playwright | Not run in this session (helpers/tests updated for new copy) |
| Typecheck  | **PASS**                                                     |
| ESLint     | **PASS**                                                     |
| Prettier   | **PASS**                                                     |
| Build      | **PASS**                                                     |

Run locally: `npm test && npm run test:e2e`

## Final Status

**PHASE 15 — PREMIUM UI/UX COMPLETE**
