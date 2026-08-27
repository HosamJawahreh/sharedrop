#!/usr/bin/env tsx
import { spawn } from 'node:child_process'
import { buildDevServerUrls, formatDevStartupBanner } from '../server/lan-addresses.js'

console.log(formatDevStartupBanner(buildDevServerUrls()))

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
