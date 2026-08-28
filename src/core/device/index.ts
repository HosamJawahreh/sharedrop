export type { DeviceStatus, DeviceType, LocalDeviceInfo, NearbyDevice, Platform } from './types'
export type { ShareDropDeviceIdentity } from './identity-types'
export { DEVICE_IDENTITY_STORAGE_KEY } from './identity-types'
export {
  createLocalDeviceInfo,
  parseUserAgentForTest,
  refreshLocalDevicePresentation,
} from './local-device'
export { devicePayloadToNearbyDevice, nearbyDeviceToPayload } from './device-mapper'
export { getDeviceIcon } from './device-icon'
export {
  buildDefaultDisplayName,
  deviceTypeLabel,
  sanitizeDisplayName,
  isValidCustomDisplayName,
  type DisplayNameValidationResult,
} from './display-name'
export {
  clearDeviceIdentity,
  createFreshIdentity,
  loadDeviceIdentity,
  loadOrCreateDeviceIdentity,
  parseStoredIdentity,
  resetStoredDisplayName,
  saveDeviceIdentity,
  updateStoredDisplayName,
  type DeviceIdentityStorage,
} from './device-identity-store'
