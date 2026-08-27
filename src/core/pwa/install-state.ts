/** PWA install / standalone detection — no unnecessary fingerprinting. */

export type PwaDisplayMode = 'browser' | 'standalone'

export interface PwaInstallState {
  displayMode: PwaDisplayMode
  /** True when running in an installed standalone/fullscreen display mode. */
  isStandalone: boolean
  /** True when the browser may offer a deferred install prompt. */
  canPromptInstall: boolean
  /** True after a successful install event or when already standalone. */
  isInstalled: boolean
  /**
   * Soft install tip for browsers without beforeinstallprompt.
   * Never fakes a native install button.
   */
  showInstallHint: boolean
}

const INSTALL_DISMISS_KEY = 'sharedrop.pwaInstallDismissed.v1'
const APP_INSTALLED_KEY = 'sharedrop.pwaAppInstalled.v1'

export function detectDisplayMode(
  matchMedia: ((query: string) => { matches: boolean }) | undefined = typeof window !==
    'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia.bind(window)
    : undefined,
  navigatorLike: { standalone?: boolean } = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { standalone?: boolean })
    : {},
): PwaDisplayMode {
  const media = matchMedia ?? (() => ({ matches: false }))
  if (media('(display-mode: standalone)').matches) return 'standalone'
  if (media('(display-mode: fullscreen)').matches) return 'standalone'
  if (media('(display-mode: minimal-ui)').matches) return 'standalone'
  // iOS Safari installed PWA
  if (navigatorLike.standalone === true) return 'standalone'
  return 'browser'
}

export function getPwaInstallState(options?: {
  canPromptInstall?: boolean
  installDismissed?: boolean
  /** True after Chromium `appinstalled` even if still viewing the browser tab. */
  appInstalled?: boolean
  matchMedia?: (query: string) => { matches: boolean }
  navigatorLike?: { standalone?: boolean }
}): PwaInstallState {
  const displayMode = detectDisplayMode(options?.matchMedia, options?.navigatorLike)
  const isStandalone = displayMode === 'standalone'
  const dismissed = Boolean(options?.installDismissed)
  const appInstalled = Boolean(options?.appInstalled)
  const isInstalled = isStandalone || appInstalled
  const canPromptInstall =
    Boolean(options?.canPromptInstall) && !isStandalone && !dismissed && !appInstalled
  return {
    displayMode,
    isStandalone,
    canPromptInstall,
    isInstalled,
    showInstallHint: !isInstalled && !canPromptInstall && !dismissed,
  }
}

export function wasInstallPromptDismissed(
  storage: { getItem(key: string): string | null } | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): boolean {
  if (!storage) return false
  try {
    return storage.getItem(INSTALL_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstallPrompt(
  storage: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  } | null = typeof localStorage !== 'undefined' ? localStorage : null,
): void {
  if (!storage) return
  try {
    storage.setItem(INSTALL_DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearInstallPromptDismissal(
  storage: { removeItem(key: string): void } | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  if (!storage) return
  try {
    storage.removeItem(INSTALL_DISMISS_KEY)
  } catch {
    // ignore
  }
}

export function wasAppInstalledMarked(
  storage: { getItem(key: string): string | null } | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): boolean {
  if (!storage) return false
  try {
    return storage.getItem(APP_INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

/** Persist Chromium `appinstalled` so the soft tip does not reappear in the browser tab. */
export function markAppInstalled(
  storage: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  } | null = typeof localStorage !== 'undefined' ? localStorage : null,
): void {
  if (!storage) return
  try {
    storage.setItem(APP_INSTALLED_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearAppInstalledMark(
  storage: { removeItem(key: string): void } | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): void {
  if (!storage) return
  try {
    storage.removeItem(APP_INSTALLED_KEY)
  } catch {
    // ignore
  }
}

export { INSTALL_DISMISS_KEY, APP_INSTALLED_KEY }
