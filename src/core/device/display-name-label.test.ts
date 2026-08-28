import { describe, expect, it } from 'vitest'
import { deviceTypeLabel } from './display-name'

describe('deviceTypeLabel', () => {
  it('uses clear consumer-facing platform labels', () => {
    expect(deviceTypeLabel('phone', 'ios')).toBe('iPhone')
    expect(deviceTypeLabel('phone', 'android')).toBe('Android Phone')
    expect(deviceTypeLabel('desktop', 'linux')).toBe('Linux PC')
    expect(deviceTypeLabel('desktop', 'windows')).toBe('Windows PC')
    expect(deviceTypeLabel('desktop', 'macos')).toBe('MacBook')
  })

  it('uses honest generic labels for unknown platforms', () => {
    expect(deviceTypeLabel('phone', 'unknown')).toBe('Phone')
    expect(deviceTypeLabel('desktop', 'unknown')).toBe('Computer')
  })
})
