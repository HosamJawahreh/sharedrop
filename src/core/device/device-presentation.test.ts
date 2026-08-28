import { describe, expect, it } from 'vitest'
import {
  buildDevicePresentation,
  deviceCategoryLabel,
  isChromebookUserAgent,
  resolveDeviceBaseName,
} from './device-presentation'

describe('device presentation', () => {
  it('labels Mac desktops as MacBook', () => {
    expect(deviceCategoryLabel('macos', 'desktop')).toBe('MacBook')
  })

  it('detects Chromebook from user agent', () => {
    expect(isChromebookUserAgent('Mozilla/5.0 (X11; CrOS x86_64)')).toBe(true)
    expect(deviceCategoryLabel('linux', 'desktop', 'CrOS')).toBe('Chromebook')
  })

  it('uses client hints model when provided', () => {
    expect(
      resolveDeviceBaseName({
        platform: 'macos',
        deviceType: 'desktop',
        clientHintsModel: 'MacBook Pro',
      }),
    ).toBe('MacBook Pro')
  })

  it('builds display name as base plus type', () => {
    const presentation = buildDevicePresentation({
      platform: 'ios',
      deviceType: 'phone',
      clientHintsModel: 'HusamJawahreh',
    })
    expect(presentation.baseName).toBe('HusamJawahreh')
    expect(presentation.typeLabel).toBe('iPhone')
    expect(presentation.displayName).toBe('HusamJawahreh iPhone')
  })

  it('avoids duplicate when base matches type', () => {
    const presentation = buildDevicePresentation({
      platform: 'ios',
      deviceType: 'phone',
      userAgent: 'iPhone',
    })
    expect(presentation.displayName).toBe('iPhone')
  })
})
