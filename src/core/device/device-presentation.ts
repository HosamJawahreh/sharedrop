/**
 * Consumer-facing device labels.
 *
 * Browsers cannot read the OS account name or hostname in most cases.
 * We use Client Hints (when available) and UA parsing, then honest fallbacks.
 */

import type { DeviceType, Platform } from './types'

export interface DevicePresentation {
  /** Best available distinguishing name (not necessarily OS hostname). */
  baseName: string
  /** Short category label, e.g. iPhone, MacBook, Windows PC. */
  typeLabel: string
  /** Value advertised to peers over signaling (base + type when helpful). */
  displayName: string
}

function cleanLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** Detect Chromebook from user agent. */
export function isChromebookUserAgent(ua: string): boolean {
  return /CrOS/i.test(ua)
}

export function deviceCategoryLabel(platform: Platform, deviceType: DeviceType, ua = ''): string {
  if (isChromebookUserAgent(ua)) return 'Chromebook'
  if (platform === 'ios') return deviceType === 'tablet' ? 'iPad' : 'iPhone'
  if (platform === 'android') {
    return deviceType === 'tablet' ? 'Android Tablet' : 'Android Phone'
  }
  if (platform === 'macos') {
    return deviceType === 'desktop' ? 'MacBook' : 'Mac'
  }
  if (platform === 'windows') return 'Windows PC'
  if (platform === 'linux') return deviceType === 'desktop' ? 'Linux PC' : 'Linux Device'
  if (deviceType === 'phone') return 'Phone'
  if (deviceType === 'tablet') return 'Tablet'
  if (deviceType === 'desktop') return 'Computer'
  return 'Device'
}

function deriveBaseNameFromUa(platform: Platform, deviceType: DeviceType, ua: string): string {
  if (isChromebookUserAgent(ua)) return 'Chromebook'

  // Some Android builds include a model string in the UA.
  // Android model in modern UA (e.g. Android 14; Pixel 8) or legacy Build/ strings.
  const androidModern = ua.match(/Android\s+[\d.]+;\s*([^)]+)\)/i)
  if (platform === 'android' && androidModern?.[1]) {
    const model = cleanLabel(androidModern[1].replace(/\s+Build\/.*$/i, ''))
    if (model.length > 1 && !/^Android/i.test(model)) return model
  }

  const androidModel = ua.match(/;\s*([^;]+)\s+Build\//i)
  if (platform === 'android' && androidModel?.[1]) {
    const model = cleanLabel(androidModel[1])
    if (model.length > 1 && !/^Android/i.test(model)) return model
  }

  if (platform === 'ios') {
    if (/iPad/i.test(ua)) return 'iPad'
    if (/iPhone|iPod/i.test(ua)) return 'iPhone'
  }

  if (platform === 'macos') return 'Mac'
  if (platform === 'windows') return 'Windows PC'
  if (platform === 'linux') return 'Linux PC'

  if (deviceType === 'phone') return 'Mobile'
  if (deviceType === 'tablet') return 'Tablet'
  if (deviceType === 'desktop') return 'Computer'
  return 'Device'
}

export interface ResolveDeviceBaseNameInput {
  platform: Platform
  deviceType: DeviceType
  userAgent?: string
  /** Chromium User-Agent Client Hints model when available. */
  clientHintsModel?: string | null
}

/**
 * Resolve the best privacy-safe base name for this device.
 * May return a model name (e.g. MacBook Pro) — not claimed to be OS hostname.
 */
export function resolveDeviceBaseName(input: ResolveDeviceBaseNameInput): string {
  const ua = input.userAgent ?? ''
  const hinted = input.clientHintsModel ? cleanLabel(input.clientHintsModel) : ''
  if (hinted.length > 0 && hinted.toLowerCase() !== 'unknown') {
    return hinted
  }
  return deriveBaseNameFromUa(input.platform, input.deviceType, ua)
}

export function buildDevicePresentation(input: ResolveDeviceBaseNameInput): DevicePresentation {
  const typeLabel = deviceCategoryLabel(input.platform, input.deviceType, input.userAgent)
  const baseName = resolveDeviceBaseName(input)
  const displayName =
    baseName.toLowerCase() === typeLabel.toLowerCase() ? baseName : `${baseName} ${typeLabel}`

  return { baseName, typeLabel, displayName: cleanLabel(displayName) }
}

/** Read Chromium client hints model when supported. */
export async function readClientHintsModel(): Promise<string | null> {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & {
    userAgentData?: {
      getHighEntropyValues: (hints: string[]) => Promise<{ model?: string }>
    }
  }
  if (!nav.userAgentData?.getHighEntropyValues) return null
  try {
    const values = await nav.userAgentData.getHighEntropyValues(['model'])
    const model = values.model?.trim()
    return model && model.length > 0 ? model : null
  } catch {
    return null
  }
}

export function peerCardLabels(device: {
  displayName: string
  platform: Platform
  deviceType: DeviceType
}): { name: string; typeLabel: string } {
  const typeLabel = deviceCategoryLabel(device.platform, device.deviceType)
  const suffix = ` ${typeLabel}`
  if (device.displayName.endsWith(suffix)) {
    return { name: device.displayName.slice(0, -suffix.length), typeLabel }
  }
  return { name: device.displayName, typeLabel }
}
