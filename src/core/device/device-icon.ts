import type { DeviceType, Platform } from './types'

const PLATFORM_ICONS: Record<Platform, Record<DeviceType, string>> = {
  ios: { phone: '📱', tablet: '📱', desktop: '💻', unknown: '📱' },
  android: { phone: '📱', tablet: '📱', desktop: '💻', unknown: '📱' },
  macos: { phone: '📱', tablet: '📱', desktop: '💻', unknown: '💻' },
  windows: { phone: '📱', tablet: '📱', desktop: '💻', unknown: '💻' },
  linux: { phone: '📱', tablet: '📱', desktop: '💻', unknown: '💻' },
  unknown: { phone: '📱', tablet: '📱', desktop: '💻', unknown: '📱' },
}

export function getDeviceIcon(platform: Platform, deviceType: DeviceType): string {
  return PLATFORM_ICONS[platform][deviceType]
}
