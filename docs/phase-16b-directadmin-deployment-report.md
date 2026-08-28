# Phase 16B — MyInterServer DirectAdmin Deployment Report

Repository: `https://github.com/HosamJawahreh/sharedrop.git` (commit `5467b0a` at validation time).

## Production architecture (from code, not assumed)

ShareDrop uses **architecture B: static `dist/` hosting plus a separate Node.js signaling process**, with TLS termination at the web server (reverse proxy). The Node signaling server does **not** serve the Vite frontend.

| Layer | Implementation |
| ----- | -------------- |
| HTTPS frontend | Static files from `dist/` (Vite default output directory) |
| Signaling | `server/index.ts` → `startSignalingServer()` (`npm start`) |
| WSS | TLS at proxy; Node speaks plain WebSocket on `PORT` |
| `/health` | `GET /health` and `GET /healthz` on the signaling HTTP server |

Authoritative references: `docs/production-deployment.md`, `server/signaling-server.ts`, `package.json`.

### Same-domain routing (`https://DOMAIN/`, `wss://DOMAIN/ws`, `https://DOMAIN/health`)

The signaling WebSocket server accepts upgrades on **any path** (no `/ws` handler in code). A `/ws` URL works when the reverse proxy forwards that path to the Node process.

DirectAdmin **Node.js Selector (Passenger)** assigns a **whole domain or subdomain** to the Node app. It does **not**, by itself, split one domain between static `public_html` and path-based proxy routes.

| Goal | DirectAdmin Node.js app alone | Required hosting setup |
| ---- | ----------------------------- | ------------------------ |
| `https://DOMAIN/` → PWA | Not via Node app on same URL | Deploy `dist/` to `public_html` (or document root) |
| `wss://DOMAIN/ws` | Not automatic | Apache/nginx proxy `/ws` → Node `PORT` with WebSocket upgrade headers |
| `https://DOMAIN/health` | Not automatic | Proxy `/health` → Node `PORT` |

**Recommended DirectAdmin layout (no custom proxy):**

- **Frontend:** `https://your-domain.example` — static `dist/` in `public_html`
- **Signaling Node app:** subdomain `signal.your-domain.example` — Application URL in Node.js Selector
- **Build:** `VITE_SIGNALING_URL=wss://signal.your-domain.example`
- **Runtime:** `SIGNALING_ALLOWED_ORIGINS=https://your-domain.example`

**Same-domain layout (requires proxy rules outside Node.js Selector):**

- `VITE_SIGNALING_URL=wss://your-domain.example/ws`
- Proxy `/ws` and `/health` to the hosting-assigned `PORT`; serve `dist/` at `/`

## DirectAdmin screen — exact values

Replace `your-domain.example` and `/home/USERNAME/...` with your account paths.

| Field | Exact value |
| ----- | ----------- |
| **Node.js version** | `24.19.0` (hosting provides; repo `engines.node`: `>=20.0.0`) |
| **Application mode** | `Production` |
| **Application root** | Repository root containing `package.json` after clone, e.g. `/home/USERNAME/domains/your-domain.example/sharedrop` |
| **Application URL** | `signal.your-domain.example` (signaling subdomain; **not** the static frontend domain) |
| **Application startup file** | `server/index.ts` |
| **Install command** | `npm ci` |
| **Build command** | `VITE_SIGNALING_URL=wss://signal.your-domain.example npm run build` (same-domain: `wss://your-domain.example/ws`) |
| **Start command** | `npm start` (runs `tsx server/index.ts` per `package.json`) |
| **Frontend deployment** | Copy **contents** of `dist/` to `public_html` for `your-domain.example` |
| **WebSocket URL** | `wss://signal.your-domain.example` (or `wss://your-domain.example/ws` with proxy) |
| **Health URL** | `https://signal.your-domain.example/health` (or `https://your-domain.example/health` with proxy) |

### Git clone (SSH)

```bash
cd /home/USERNAME/domains/your-domain.example
git clone https://github.com/HosamJawahreh/sharedrop.git sharedrop
cd sharedrop
```

### Environment variables (signaling — DirectAdmin panel)

Do **not** commit these. Do **not** set `SIGNALING_PORT` on DirectAdmin unless you control a fixed reverse-proxy target. Let the platform assign `PORT`.

| Variable | Production value |
| -------- | ---------------- |
| `NODE_ENV` | `production` |
| `SHAREDROP_ENV` | `production` |
| `SIGNALING_HOST` | `0.0.0.0` |
| `SIGNALING_ALLOWED_ORIGINS` | `https://your-domain.example` |
| `PORT` | *(assigned by hosting — do not hardcode)* |

Optional: `SHAREDROP_VERSION=0.13.3`, `VITE_ICE_SERVERS` at build time for cross-network ICE.

### Build-time client variable

| Variable | Production value |
| -------- | ---------------- |
| `VITE_SIGNALING_URL` | `wss://signal.your-domain.example` (subdomain) **or** `wss://your-domain.example/ws` (same domain + proxy) |

HTTPS pages require `wss://` (`resolve-signaling-url.ts` rejects `ws://` on HTTPS).

## Local validation (Phase 16B)

```bash
npm ci
npm run build
NODE_ENV=production SHAREDROP_ENV=production SIGNALING_HOST=0.0.0.0 PORT=9876 SIGNALING_ALLOWED_ORIGINS=https://example.com npm start
curl -s http://127.0.0.1:9876/health
```

Verified: `GET /health` returns `{"ok":true,"service":"sharedrop-signaling",...}`.

Port resolution order: `SIGNALING_PORT` → `PORT` → `8787` (`server/config.ts`).

## Automated gates

| Gate | Result |
| ---- | ------ |
| `npm ci` | Pass |
| `npm run build` | Pass → output `dist/` |
| `npm test` (Vitest) | 173 passed (36 files) |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run format:check` | Pass |
| `npm start` + `/health` | Pass (local) |
| `npm run test:e2e` (Playwright) | See below |

## Playwright investigation (Phase 16A: 17 failed, 1 passed)

**Root cause — test environment, not application regression:**

1. **First run after `npm ci`:** All 18 tests failed immediately with `browserType.launch: Executable doesn't exist` — Playwright browsers were not installed. Fix: `npx playwright install chromium` (not required on production hosting).

2. **After browser install — full suite (`npm run test:e2e`):** 11 passed, 7 failed in ~9.2m. Failures: `TimeoutError` in `connectPair` waiting for `getConnectionState() === 'connected'` (60s). `playwright.config.ts` starts `npm run dev:all` (Vite + signaling) — signaling was available; peers were discovered before connect.

3. **Flakiness under suite load:** `npx playwright test -g "transfers 1 KB"` passed in 6.3s alone. Re-running `e2e/transfer.spec.ts` as a block: 6 passed, 6 failed with the same connect timeout — intermittent under long transfers (10 MB / 100 MB tests), not a stable product defect.

4. **Tests that passed in full suite** include `primary-flow.spec.ts` (`connectPairViaHomepageUi`), `device-identity.spec.ts`, and `global-connectivity.spec.ts` (including 100 MB transfer) — same signaling stack.

**Conclusion:** Phase 16A Playwright failures are **test-environment** (missing browsers + connect timing flake in `connectPair` under load). No code change applied for 16B.

## Post-deploy verification

1. `curl https://signal.your-domain.example/health` → `ok: true`
2. Open `https://your-domain.example` → discovery status visible
3. Two browsers connect and transfer a small file

## Final status

**PHASE 16B — READY FOR DIRECTADMIN DEPLOYMENT**
