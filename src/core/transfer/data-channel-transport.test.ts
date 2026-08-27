import { describe, expect, it } from 'vitest'
import { wrapRtcDataChannel } from './data-channel-transport'

interface MockRtcDataChannel extends RTCDataChannel {
  dispatchMessage(data: ArrayBuffer): void
  setBufferedAmount(amount: number): void
  emitBufferedAmountLow(): void
}

function createMockRtcDataChannel(): MockRtcDataChannel {
  const binaryListeners = new Set<(event: MessageEvent<ArrayBuffer>) => void>()
  const lowListeners = new Set<() => void>()
  let bufferedAmount = 0
  let readyState: RTCDataChannelState = 'open'

  const channel = {
    binaryType: 'arraybuffer' as BinaryType,
    get bufferedAmount() {
      return bufferedAmount
    },
    bufferedAmountLowThreshold: 0,
    get readyState() {
      return readyState
    },
    send(data: ArrayBuffer) {
      bufferedAmount = Math.max(0, bufferedAmount - data.byteLength)
    },
    close() {
      readyState = 'closed'
    },
    addEventListener(type: string, listener: EventListener) {
      if (type === 'message') {
        binaryListeners.add(listener as (event: MessageEvent<ArrayBuffer>) => void)
      } else if (type === 'bufferedamountlow') {
        lowListeners.add(listener as () => void)
      }
    },
    removeEventListener() {},
    dispatchMessage(data: ArrayBuffer) {
      const event = { data } as MessageEvent<ArrayBuffer>
      for (const listener of binaryListeners) listener(event)
    },
    setBufferedAmount(amount: number) {
      bufferedAmount = amount
    },
    emitBufferedAmountLow() {
      for (const listener of lowListeners) listener()
    },
  }

  return channel as unknown as MockRtcDataChannel
}

describe('wrapRtcDataChannel', () => {
  it('forwards binary messages and tracks byte counters', () => {
    const channel = createMockRtcDataChannel()
    const transport = wrapRtcDataChannel(channel)
    const received: number[] = []

    transport.subscribeBinary((data) => {
      received.push(new Uint8Array(data).byteLength)
    })

    channel.dispatchMessage(new Uint8Array([1, 2, 3]).buffer)
    transport.send(new Uint8Array([4, 5]))

    expect(received).toEqual([3])
    expect(transport.getDiagnostics().bytesReceived).toBe(3)
    expect(transport.getDiagnostics().bytesSent).toBe(2)
  })

  it('applies bufferedAmountLowThreshold and emits bufferedamountlow', () => {
    const channel = createMockRtcDataChannel()
    const transport = wrapRtcDataChannel(channel)
    const lows: number[] = []

    transport.setBufferedAmountLowThreshold(256 * 1024)
    transport.subscribeBufferedAmountLow(() => {
      lows.push(transport.getBufferedAmount())
    })

    channel.setBufferedAmount(512 * 1024)
    channel.emitBufferedAmountLow()

    expect(transport.getBufferedAmountLowThreshold()).toBe(256 * 1024)
    expect(lows).toEqual([512 * 1024])
    expect(transport.getDiagnostics().bufferedAmount).toBe(512 * 1024)
  })
})
