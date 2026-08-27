import { HANDSHAKE } from '../../../shared/connection-protocol'
import type { ConnectionPayload } from './types'

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

export async function performOffererHandshake(channel: RTCDataChannel): Promise<void> {
  await waitForChannelOpen(channel)
  channel.send(HANDSHAKE.HELLO)
  await waitForChannelMessage(channel, HANDSHAKE.PEER_READY)
}

export async function performAnswererHandshake(channel: RTCDataChannel): Promise<void> {
  await waitForChannelOpen(channel)
  const message = await waitForChannelMessage(channel, HANDSHAKE.HELLO)
  if (message !== HANDSHAKE.HELLO) {
    throw new Error('Invalid handshake greeting')
  }
  channel.send(HANDSHAKE.PEER_READY)
}

function waitForChannelOpen(channel: RTCDataChannel): Promise<void> {
  if (channel.readyState === 'open') {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const onOpen = (): void => {
      cleanup()
      resolve()
    }
    const onError = (): void => {
      cleanup()
      reject(new Error('DataChannel failed to open'))
    }
    const cleanup = (): void => {
      channel.removeEventListener('open', onOpen)
      channel.removeEventListener('error', onError)
    }

    channel.addEventListener('open', onOpen)
    channel.addEventListener('error', onError)
  })
}

function waitForChannelMessage(channel: RTCDataChannel, expected: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Handshake timed out'))
    }, 10_000)

    const onMessage = (event: MessageEvent): void => {
      const value = decodeMessage(event.data)
      if (value === expected) {
        cleanup()
        resolve(value)
      }
    }
    const onError = (): void => {
      cleanup()
      reject(new Error('DataChannel error during handshake'))
    }
    const cleanup = (): void => {
      clearTimeout(timeout)
      channel.removeEventListener('message', onMessage)
      channel.removeEventListener('error', onError)
    }

    channel.addEventListener('message', onMessage)
    channel.addEventListener('error', onError)
  })
}

function decodeMessage(data: ConnectionPayload): string {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return TEXT_DECODER.decode(new Uint8Array(data))
  return TEXT_DECODER.decode(data)
}

export function encodeMessage(data: ConnectionPayload): string | ArrayBuffer {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return data
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

export function encodeText(value: string): Uint8Array {
  return TEXT_ENCODER.encode(value)
}
