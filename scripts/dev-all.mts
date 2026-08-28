#!/usr/bin/env tsx
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { buildDevServerUrls, formatDevStartupBanner } from '../server/lan-addresses.js'

const WEB_PORT = 5173
const SIGNALING_PORT = 8787

async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(true))
    probe.once('listening', () => {
      probe.close(() => resolve(false))
    })
    probe.listen(port, '127.0.0.1')
  })
}

async function main(): Promise<void> {
  const webPortBusy = await isPortListening(WEB_PORT)
  const signalingPortBusy = await isPortListening(SIGNALING_PORT)

  console.log(formatDevStartupBanner(buildDevServerUrls(WEB_PORT, SIGNALING_PORT)))

  if (webPortBusy && !signalingPortBusy) {
    console.warn(
      `[dev:all] Port ${WEB_PORT} is in use but signaling port ${SIGNALING_PORT} is not.`,
    )
    console.warn(
      `[dev:all] This usually means only "npm run dev" is running. LAN discovery requires both services — use a single "npm run dev:all" after stopping other ShareDrop processes.`,
    )
  } else if (webPortBusy) {
    console.warn(
      `[dev:all] Port ${WEB_PORT} is already in use. Stop the other ShareDrop/Vite process before starting dev:all.`,
    )
  }

  const child = spawn(
    'npx',
    [
      'concurrently',
      '-n',
      'web,signal',
      '-c',
      'cyan,magenta',
      'npm run dev',
      'npm run dev:signaling',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        SHAREDROP_DEV_ALL: '1',
      },
    },
  )

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

void main()
