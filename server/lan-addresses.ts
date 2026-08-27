import { networkInterfaces } from 'node:os'

/** Collect non-internal IPv4 addresses suitable for LAN development URLs. */
export function getLanIPv4Addresses(): string[] {
  const interfaces = networkInterfaces()
  const addresses = new Set<string>()

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue
    for (const entry of entries) {
      const family = entry.family as string | number
      const isIPv4 = family === 'IPv4' || family === 4
      if (isIPv4 && !entry.internal) {
        addresses.add(entry.address)
      }
    }
  }

  return [...addresses].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export interface DevServerUrls {
  webPort: number
  signalingPort: number
  localWebUrl: string
  lanWebUrls: string[]
  localSignalingUrl: string
  lanSignalingUrls: string[]
}

export function buildDevServerUrls(
  webPort = 5173,
  signalingPort = 8787,
  lanAddresses = getLanIPv4Addresses(),
): DevServerUrls {
  return {
    webPort,
    signalingPort,
    localWebUrl: `http://localhost:${webPort}`,
    lanWebUrls: lanAddresses.map((address) => `http://${address}:${webPort}`),
    localSignalingUrl: `ws://localhost:${signalingPort}`,
    lanSignalingUrls: lanAddresses.map((address) => `ws://${address}:${signalingPort}`),
  }
}

export function formatDevStartupBanner(urls: DevServerUrls): string {
  const lines = ['', 'ShareDrop development servers', '', 'Local:', `  ${urls.localWebUrl}`, '']

  if (urls.lanWebUrls.length > 0) {
    lines.push('LAN:')
    for (const url of urls.lanWebUrls) {
      lines.push(`  ${url}`)
    }
    lines.push('')
  } else {
    lines.push('LAN:', '  (no external IPv4 address detected)', '')
  }

  lines.push('Signaling:')
  lines.push(`  ${urls.localSignalingUrl}`)
  for (const url of urls.lanSignalingUrls) {
    lines.push(`  ${url}`)
  }
  lines.push('')
  lines.push('Open ShareDrop from another device using a LAN URL above.')
  lines.push('Signaling follows the web app host automatically (no IP in source code).')
  lines.push('')

  return lines.join('\n')
}
