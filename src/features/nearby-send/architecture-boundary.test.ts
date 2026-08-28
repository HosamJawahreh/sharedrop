import { describe, expect, it } from 'vitest'

/** Consumer UI must not own WebRTC / signaling wire details. */
const FORBIDDEN = [
  'RTCPeerConnection',
  'RTCDataChannel',
  'RTCIceCandidate',
  'new WebSocket',
  'createOffer',
  'createAnswer',
  'setLocalDescription',
  'setRemoteDescription',
  'addIceCandidate',
] as const

const featureSources = import.meta.glob('./*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('nearby-send architecture boundary', () => {
  it('UI feature sources do not manipulate WebRTC or WebSocket directly', () => {
    const entries = Object.entries(featureSources).filter(
      ([path]) =>
        !path.includes('.test.') &&
        !path.endsWith('create-nearby-send-stack.ts') &&
        !path.includes('/index.ts'),
    )

    expect(entries.length).toBeGreaterThan(5)

    for (const [path, text] of entries) {
      for (const token of FORBIDDEN) {
        expect(text, `${path} must not contain ${token}`).not.toContain(token)
      }
    }
  })

  it('stack factory is the only feature entry that constructs engines', () => {
    const stack = featureSources['./create-nearby-send-stack.ts']
    expect(stack).toBeDefined()
    expect(stack).toContain('createDiscoveryEngine')
    expect(stack).toContain('createWebRTCConnectionEngine')
    expect(stack).toContain('createTransferEngine')
    expect(stack).toContain('createSignalingClient')
  })
})
