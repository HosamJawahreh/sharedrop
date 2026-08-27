import { describe, expect, it } from 'vitest'
import { buildDevServerUrls, getLanIPv4Addresses } from './lan-addresses.js'

describe('lan-addresses', () => {
  it('builds LAN URLs from detected addresses', () => {
    const urls = buildDevServerUrls(5173, 8787, ['192.168.1.25'])
    expect(urls.localWebUrl).toBe('http://localhost:5173')
    expect(urls.lanWebUrls).toEqual(['http://192.168.1.25:5173'])
    expect(urls.lanSignalingUrls).toEqual(['ws://192.168.1.25:8787'])
  })

  it('returns string addresses from getLanIPv4Addresses', () => {
    const addresses = getLanIPv4Addresses()
    expect(Array.isArray(addresses)).toBe(true)
    for (const address of addresses) {
      expect(typeof address).toBe('string')
    }
  })
})
