/** DataChannel transport abstraction — hides RTCDataChannel from TransferEngine consumers. */

export type BinaryListener = (data: ArrayBuffer) => void

/** Dev-only transport counters — not used by transfer protocol logic. */
export interface TransportDiagnostics {
  bytesSent: number
  bytesReceived: number
  bufferedAmount: number
  bufferedAmountLowThreshold: number | null
  state: 'connecting' | 'open' | 'closing' | 'closed'
}

export interface DataChannelTransport {
  send(data: Uint8Array): void
  getBufferedAmount(): number
  setBufferedAmountLowThreshold(threshold: number): void
  getBufferedAmountLowThreshold(): number | null
  getState(): 'connecting' | 'open' | 'closing' | 'closed'
  getDiagnostics(): TransportDiagnostics
  subscribeBinary(listener: BinaryListener): () => void
  subscribeBufferedAmountLow(listener: () => void): () => void
  subscribeOpen(listener: () => void): () => void
  subscribeClose(listener: () => void): () => void
  close(): void
}

export function wrapRtcDataChannel(channel: RTCDataChannel): DataChannelTransport {
  const binaryListeners = new Set<BinaryListener>()
  const lowListeners = new Set<() => void>()
  const openListeners = new Set<() => void>()
  const closeListeners = new Set<() => void>()
  let bytesSent = 0
  let bytesReceived = 0
  let lowThreshold: number | null = null

  channel.binaryType = 'arraybuffer'

  channel.addEventListener('message', (event) => {
    if (event.data instanceof ArrayBuffer) {
      bytesReceived += event.data.byteLength
      for (const listener of binaryListeners) {
        listener(event.data)
      }
    }
  })

  channel.addEventListener('bufferedamountlow', () => {
    for (const listener of lowListeners) {
      listener()
    }
  })

  channel.addEventListener('open', () => {
    for (const listener of openListeners) {
      listener()
    }
  })

  channel.addEventListener('close', () => {
    for (const listener of closeListeners) {
      listener()
    }
  })

  return {
    send(data: Uint8Array): void {
      const payload = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ) as ArrayBuffer
      bytesSent += payload.byteLength
      channel.send(payload)
    },
    getBufferedAmount() {
      return channel.bufferedAmount
    },
    setBufferedAmountLowThreshold(threshold) {
      lowThreshold = threshold
      channel.bufferedAmountLowThreshold = threshold
    },
    getBufferedAmountLowThreshold() {
      return lowThreshold
    },
    getState() {
      return channel.readyState
    },
    getDiagnostics(): TransportDiagnostics {
      return {
        bytesSent,
        bytesReceived,
        bufferedAmount: channel.bufferedAmount,
        bufferedAmountLowThreshold: lowThreshold,
        state: channel.readyState,
      }
    },
    subscribeBinary(listener) {
      binaryListeners.add(listener)
      return () => binaryListeners.delete(listener)
    },
    subscribeBufferedAmountLow(listener) {
      lowListeners.add(listener)
      return () => lowListeners.delete(listener)
    },
    subscribeOpen(listener) {
      openListeners.add(listener)
      if (channel.readyState === 'open') {
        listener()
      }
      return () => openListeners.delete(listener)
    },
    subscribeClose(listener) {
      closeListeners.add(listener)
      return () => closeListeners.delete(listener)
    },
    close() {
      channel.close()
    },
  }
}
