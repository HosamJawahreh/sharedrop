import { describe, expect, it } from 'vitest'
import {
  clearAppInstalledMark,
  clearInstallPromptDismissal,
  detectDisplayMode,
  dismissInstallPrompt,
  getPwaInstallState,
  markAppInstalled,
  wasAppInstalledMarked,
  wasInstallPromptDismissed,
} from './install-state'

describe('pwa install state', () => {
  it('detects browser vs standalone display modes', () => {
    expect(detectDisplayMode((query) => ({ matches: query.includes('standalone') }), {})).toBe(
      'standalone',
    )
    expect(detectDisplayMode(() => ({ matches: false }), { standalone: true })).toBe('standalone')
    expect(detectDisplayMode(() => ({ matches: false }), {})).toBe('browser')
  })

  it('exposes install prompt eligibility only when not installed', () => {
    const browser = getPwaInstallState({
      canPromptInstall: true,
      matchMedia: () => ({ matches: false }),
    })
    expect(browser.canPromptInstall).toBe(true)
    expect(browser.isStandalone).toBe(false)
    expect(browser.showInstallHint).toBe(false)

    const installed = getPwaInstallState({
      canPromptInstall: true,
      matchMedia: (query) => ({ matches: query.includes('standalone') }),
    })
    expect(installed.isStandalone).toBe(true)
    expect(installed.canPromptInstall).toBe(false)
    expect(installed.isInstalled).toBe(true)
    expect(installed.showInstallHint).toBe(false)
  })

  it('shows a soft install hint when native prompt is unavailable', () => {
    const hint = getPwaInstallState({
      canPromptInstall: false,
      installDismissed: false,
      matchMedia: () => ({ matches: false }),
    })
    expect(hint.showInstallHint).toBe(true)
    expect(hint.canPromptInstall).toBe(false)

    const dismissed = getPwaInstallState({
      canPromptInstall: false,
      installDismissed: true,
      matchMedia: () => ({ matches: false }),
    })
    expect(dismissed.showInstallHint).toBe(false)
  })

  it('hides install UI after appinstalled even when still in a browser tab', () => {
    const afterInstall = getPwaInstallState({
      canPromptInstall: false,
      appInstalled: true,
      matchMedia: () => ({ matches: false }),
    })
    expect(afterInstall.isInstalled).toBe(true)
    expect(afterInstall.isStandalone).toBe(false)
    expect(afterInstall.showInstallHint).toBe(false)
    expect(afterInstall.canPromptInstall).toBe(false)
  })

  it('persists install prompt dismissal', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    }
    expect(wasInstallPromptDismissed(storage)).toBe(false)
    dismissInstallPrompt(storage)
    expect(wasInstallPromptDismissed(storage)).toBe(true)
    clearInstallPromptDismissal(storage)
    expect(wasInstallPromptDismissed(storage)).toBe(false)
  })

  it('persists appinstalled mark', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    }
    expect(wasAppInstalledMarked(storage)).toBe(false)
    markAppInstalled(storage)
    expect(wasAppInstalledMarked(storage)).toBe(true)
    clearAppInstalledMark(storage)
    expect(wasAppInstalledMarked(storage)).toBe(false)
  })
})
