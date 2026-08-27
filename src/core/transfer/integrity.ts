import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export class StreamingSha256 {
  private readonly hash = sha256.create()

  update(data: Uint8Array): void {
    this.hash.update(data)
  }

  digestHex(): string {
    return bytesToHex(this.hash.digest())
  }
}

export async function hashBlobInChunks(blob: Blob, chunkSize: number): Promise<string> {
  const hasher = new StreamingSha256()
  let offset = 0
  while (offset < blob.size) {
    const chunk = blob.slice(offset, offset + chunkSize)
    const buffer = new Uint8Array(await chunk.arrayBuffer())
    hasher.update(buffer)
    offset += chunkSize
  }
  return hasher.digestHex()
}
