/**
 * Background / notification capability probes.
 * Honest detection only — does not claim closed-app WebRTC receiving.
 */

export type BackgroundCapabilityLevel = 'supported' | 'partial' | 'unsupported' | 'unknown'

export interface BackgroundCapabilityReport {
  notificationsApi: BackgroundCapabilityLevel
  serviceWorker: BackgroundCapabilityLevel
  pushManager: BackgroundCapabilityLevel
  /** WebRTC while the document is fully closed — never supported in browsers today. */
  webrtcWhileTerminated: 'unsupported'
  /** Best-effort note for UI (never promise closed-app receiving). */
  consumerMessage: string
}

export function probeBackgroundCapabilities(
  globalObj: {
    Notification?: unknown
    navigator?: { serviceWorker?: unknown }
    PushManager?: unknown
    ServiceWorkerRegistration?: {
      prototype?: { pushManager?: unknown; showNotification?: unknown }
    }
  } = typeof globalThis !== 'undefined' ? globalThis : {},
): BackgroundCapabilityReport {
  const hasNotification = typeof globalObj.Notification !== 'undefined'
  const hasServiceWorker = Boolean(globalObj.navigator?.serviceWorker)
  const hasPush =
    typeof globalObj.PushManager !== 'undefined' ||
    Boolean(globalObj.ServiceWorkerRegistration?.prototype?.pushManager)

  return {
    notificationsApi: hasNotification ? 'supported' : 'unsupported',
    serviceWorker: hasServiceWorker ? 'supported' : 'unsupported',
    pushManager: hasPush ? 'partial' : 'unsupported',
    webrtcWhileTerminated: 'unsupported',
    consumerMessage:
      'Keep ShareDrop open to receive transfers. Background receiving while the app is fully closed is not available.',
  }
}
