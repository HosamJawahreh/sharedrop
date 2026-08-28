# Phase 16A — Production Deployment Report

## Repository inventory

| Item             | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Package manager  | **npm** (`package-lock.json`)                                        |
| Node.js          | **>= 20.0.0** (`engines` in `package.json`)                          |
| Install          | `npm ci` (or `npm install`)                                          |
| Build            | `npm run build` → `tsc -b && vite build`                             |
| Frontend output  | **`dist/`** (static PWA shell)                                       |
| Signaling entry  | **`server/index.ts`** → `startSignalingServer()`                     |
| Production start | **`npm start`** (alias: `npm run start:signaling`)                   |
| Dev commands     | Unchanged: `npm run dev`, `npm run dev:signaling`, `npm run dev:all` |

## Ports & endpoints

| Service           | Dev default                   | Production                             |
| ----------------- | ----------------------------- | -------------------------------------- |
| Vite frontend     | `5173`                        | Static `dist/` via HTTPS (not Node)    |
| Signaling HTTP/WS | `8787`                        | `SIGNALING_PORT` or hosting **`PORT`** |
| Bind address      | `0.0.0.0`                     | `SIGNALING_HOST` (default `0.0.0.0`)   |
| Health            | `GET /health`, `GET /healthz` | Same on signaling process              |

## Required environment variables

### Build time (client)

| Variable             | Required          | Notes                               |
| -------------------- | ----------------- | ----------------------------------- |
| `VITE_SIGNALING_URL` | **Yes** for HTTPS | Must be `wss://…` when app is HTTPS |
| `VITE_ICE_SERVERS`   | Optional          | STUN/TURN JSON for cross-network    |

### Runtime (signaling server)

| Variable                      | Required | Notes                                      |
| ----------------------------- | -------- | ------------------------------------------ |
| `NODE_ENV` or `SHAREDROP_ENV` | **Yes**  | `production` enforces origin policy        |
| `SIGNALING_ALLOWED_ORIGINS`   | **Yes**  | Bare `https://` origins (not `*` or `lan`) |
| `SIGNALING_HOST`              | Optional | Default `0.0.0.0`                          |
| `PORT`                        | Hosting  | Used when `SIGNALING_PORT` unset           |
| `SIGNALING_PORT`              | Optional | Overrides `PORT` when set                  |

See `.env.example` for the full template.

## Production behavior verified

- HTTPS frontend + **WSS** via `VITE_SIGNALING_URL`
- LAN loopback overrides **disabled** in production builds (`import.meta.env.PROD`)
- CORS/origin: explicit HTTPS origins in production (`server/origin-policy.ts`)
- Signaling binds `0.0.0.0`; port from `SIGNALING_PORT` → `PORT` → `8787`
- Developer diagnostics panels **removed** from consumer UI

## MyInterServer deployment steps

1. **Clone** the GitHub repository into your Node.js application directory.
2. **Select Node.js 20+** in the hosting control panel.
3. **Set application startup** to `npm start` with working directory at the repo root.
4. **Configure environment** in the panel (or `.env` if supported):
   - `NODE_ENV=production`
   - `SHAREDROP_ENV=production`
   - `SIGNALING_ALLOWED_ORIGINS=https://your-domain.example`
   - `SIGNALING_HOST=0.0.0.0`
   - Let the platform set `PORT` (do not hardcode 8787 unless using a reverse proxy to that port).
5. **Build the frontend** (SSH or one-off build step before deploy):
   ```bash
   VITE_SIGNALING_URL=wss://your-domain.example/ws npm run build
   ```
6. **Serve `dist/`** over HTTPS (same domain or subdomain as configured in origins).
   - Option A: Static files in `public_html` / document root pointing to `dist/`
   - Option B: Reverse proxy from the web server to static `dist/`
7. **Proxy WebSocket** to the Node signaling process (if signaling is on a path or subdomain):
   - Upgrade headers + long timeouts (see `docs/production-deployment.md`)
8. **Verify** `GET https://your-signaling-host/health` returns `ok: true`.
9. Open the HTTPS app, confirm nearby discovery and connection.

## Regression (automated)

| Gate       | Result                           |
| ---------- | -------------------------------- |
| Vitest     | Run locally                      |
| Playwright | Run locally (`npm run test:e2e`) |
| Typecheck  | Run locally                      |
| ESLint     | Run locally                      |
| Prettier   | Run locally                      |
| Build      | Run locally                      |

## Clone & deploy readiness

The repository is structured for clean clone → `npm ci` → build → `npm start` with environment-driven configuration. No secrets are committed.

## Final status

**PHASE 16A — DEPLOYMENT READY**
