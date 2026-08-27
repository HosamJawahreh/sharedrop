import { afterEach, describe, expect, it, vi } from 'vitest'
import { logOpsEvent } from './ops-log.js'

describe('ops-log', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits structured JSON without leaking secrets or payloads', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logOpsEvent('connection_rejected', {
      reason: 'origin_not_allowed',
      connections: 2,
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const line = String(spy.mock.calls[0]?.[0])
    const entry = JSON.parse(line) as Record<string, unknown>

    expect(entry.service).toBe('sharedrop-signaling')
    expect(entry.event).toBe('connection_rejected')
    expect(entry.reason).toBe('origin_not_allowed')
    expect(entry.connections).toBe(2)
    expect(typeof entry.ts).toBe('string')

    expect(line).not.toMatch(/"sdp"/i)
    expect(line).not.toMatch(/ice[-_ ]?credential/i)
    expect(line).not.toMatch(/"credential"/i)
    expect(line).not.toMatch(/filename/i)
    expect(line).not.toMatch(/TURN_/i)
    expect(entry).not.toHaveProperty('payload')
    expect(entry).not.toHaveProperty('deviceId')
    expect(entry).not.toHaveProperty('sdp')
  })
})
