# Development

## Prerequisites

- Node.js 20+ recommended
- npm

## Install

```bash
npm install
```

## Development servers

Run frontend and signaling together:

```bash
npm run dev:all
```

Or separately:

```bash
# Terminal 1 — web app (http://localhost:5173)
npm run dev

# Terminal 2 — signaling service (ws://localhost:8787)
npm run dev:signaling
```

See [lan-development.md](lan-development.md) for multi-device LAN testing.

### Testing from another device on your network

1. Start both services with `npm run dev:all`
2. Note the **LAN** URL printed in the startup banner
3. On the other device, open `http://<LAN-IP>:5173`
4. Signaling connects automatically to `ws://<LAN-IP>:8787`

Override signaling URL if needed:

```bash
VITE_SIGNALING_URL=ws://192.168.1.42:8787 npm run dev
```

See [browser-support.md](browser-support.md) for mobile/browser limitations.

## Typecheck

```bash
npm run typecheck
```

## Lint

```bash
npm run lint
```

## Format

```bash
npm run format
```

## Test

```bash
npm test
```

## Production build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Environment variables

| Variable                    | Default                   | Description                                                                |
| --------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| `VITE_SIGNALING_URL`        | `ws(s)://<hostname>:8787` | Client signaling WebSocket URL                                             |
| `VITE_ICE_SERVERS`          | Google STUN               | JSON array of `RTCIceServer` (STUN / TURN / TURNS). No secrets in repo.    |
| `SIGNALING_PORT`            | `8787`                    | Signaling server port                                                      |
| `SIGNALING_HOST`            | `0.0.0.0`                 | Signaling server bind address                                              |
| `SIGNALING_ALLOWED_ORIGINS` | `*`                       | Comma-separated allowed origins; use `lan` for private networks only (dev) |

## Conventions

- Strict TypeScript
- UI stays free of WebSocket/WebRTC/chunking details
- Prefer browser platform APIs over extra dependencies
- Keep the core workflow focused: Open → See available devices → Select device → Connect → Select files → Send
