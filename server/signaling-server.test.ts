/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { createSignalingServer } from './signaling-server.js'

describe('signaling server integration', () => {
  let port = 0
  let closeServer: () => Promise<void>

  beforeAll(async () => {
    port = 9100 + Math.floor(Math.random() * 1000)
    process.env.SIGNALING_PORT = String(port)
    process.env.SIGNALING_ALLOWED_ORIGINS = '*'
    delete process.env.NODE_ENV
    delete process.env.SHAREDROP_ENV
    const handle = createSignalingServer()

    await new Promise<void>((resolve) => {
      handle.httpServer.on('listening', () => resolve())
    })

    closeServer = () => handle.close()
  })

  afterAll(async () => {
    await closeServer()
  })

  it('exposes GET /health without device lists or secrets', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.service).toBe('sharedrop-signaling')
    expect(typeof body.version).toBe('string')
    expect(typeof body.uptimeSeconds).toBe('number')
    expect(typeof body.connections).toBe('number')
    expect(body).not.toHaveProperty('devices')
    expect(body).not.toHaveProperty('origins')
  })

  it('registers two devices and broadcasts presence', async () => {
    const deviceA = {
      deviceId: 'dev_a',
      sessionId: 'ses_a',
      displayName: 'Linux Laptop',
      deviceType: 'desktop',
      platform: 'linux',
      browser: 'Chrome',
      status: 'available',
      lastSeen: Date.now(),
    }

    const deviceB = {
      deviceId: 'dev_b',
      sessionId: 'ses_b',
      displayName: 'iPhone',
      deviceType: 'phone',
      platform: 'ios',
      browser: 'Safari',
      status: 'available',
      lastSeen: Date.now(),
    }

    const wsA = new WebSocket(`ws://localhost:${port}`)
    const wsB = new WebSocket(`ws://localhost:${port}`)

    await Promise.all([
      new Promise((resolve) => wsA.on('open', resolve)),
      new Promise((resolve) => wsB.on('open', resolve)),
    ])

    const messagesB: Array<{ type: string; device?: { deviceId: string } }> = []
    wsB.on('message', (data) => {
      messagesB.push(JSON.parse(String(data)))
    })

    wsA.send(JSON.stringify({ type: 'register', device: deviceA }))
    await new Promise((resolve) => wsA.once('message', resolve))

    wsB.send(JSON.stringify({ type: 'register', device: deviceB }))
    await new Promise((resolve) => wsB.once('message', resolve))

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(messagesB.some((message) => message.type === 'device_joined')).toBe(true)

    wsA.close()
    wsB.close()
  })
})
