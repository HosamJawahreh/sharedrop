import { test, expect } from '@playwright/test'
import {
  acceptOnReceiver,
  connectPair,
  disconnectPage,
  readReceivedSnapshots,
  rejectOnReceiver,
  sendFiles,
  verifySnapshotsAgainstSources,
  waitForSessionState,
  waitForTransferComplete,
  withShareDropPair,
  type TestFileSpec,
} from './helpers/share-drop'
import { deterministicBytes, sha256Hex } from './helpers/crypto'

function fileSpec(
  name: string,
  buffer: Buffer,
  mimeType = 'application/octet-stream',
): TestFileSpec {
  return { name, mimeType, buffer }
}

test.describe('ShareDrop browser-to-browser transfer', () => {
  test('transfers 1 KB with byte and SHA-256 verification', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const buffer = deterministicBytes(1024)
      const sources = [fileSpec('test-small.txt', buffer, 'text/plain')]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver')

      const snapshots = await readReceivedSnapshots(pair.receiver)
      verifySnapshotsAgainstSources(snapshots, sources, [sha256Hex(buffer)])
    })
  })

  test('transfers 10 KB binary payload', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const buffer = deterministicBytes(10 * 1024, 0x13)
      const sources = [fileSpec('test-binary.bin', buffer)]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver')

      const snapshots = await readReceivedSnapshots(pair.receiver)
      verifySnapshotsAgainstSources(snapshots, sources, [sha256Hex(buffer)])
    })
  })

  test('transfers 1 MB file', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const buffer = deterministicBytes(1024 * 1024, 0x42)
      const sources = [fileSpec('test-1mb.bin', buffer)]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver', 180_000)

      const snapshots = await readReceivedSnapshots(pair.receiver)
      verifySnapshotsAgainstSources(snapshots, sources, [sha256Hex(buffer)])
    })
  })

  test('transfers 10 MB file', async ({ browser }) => {
    test.setTimeout(300_000)

    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const buffer = deterministicBytes(10 * 1024 * 1024, 0x7f)
      const sources = [fileSpec('test-10mb.bin', buffer)]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver', 240_000)

      const snapshots = await readReceivedSnapshots(pair.receiver)
      verifySnapshotsAgainstSources(snapshots, sources, [sha256Hex(buffer)])
    })
  })

  test('transfers zero-byte file', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const sources = [fileSpec('empty.txt', Buffer.alloc(0), 'text/plain')]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver')

      const snapshots = await readReceivedSnapshots(pair.receiver)
      verifySnapshotsAgainstSources(snapshots, sources, [sha256Hex(Buffer.alloc(0))])
    })
  })

  test('transfers multiple files independently', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const sources = [
        fileSpec('file-1.txt', Buffer.from('first')),
        fileSpec('file-2.txt', Buffer.from('second')),
        fileSpec('file-3.bin', deterministicBytes(512, 0x11)),
      ]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver')

      const snapshots = await readReceivedSnapshots(pair.receiver)
      const hashes = sources.map((source) => sha256Hex(source.buffer))
      verifySnapshotsAgainstSources(snapshots, sources, hashes)
    })
  })

  test('transfers Unicode, Arabic, emoji, and spaced filenames', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const sources = [
        fileSpec('日本語.txt', Buffer.from('unicode')),
        fileSpec('مرحبا.txt', Buffer.from('arabic')),
        fileSpec('🎉party.txt', Buffer.from('emoji')),
        fileSpec('my file.txt', Buffer.from('spaces')),
      ]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver')

      const snapshots = await readReceivedSnapshots(pair.receiver)
      const hashes = sources.map((source) => sha256Hex(source.buffer))
      verifySnapshotsAgainstSources(snapshots, sources, hashes)
    })
  })

  test('sender cancellation stops transfer for both sides', async ({ browser }) => {
    test.setTimeout(300_000)

    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      // Large enough that transfer stays in "transferring" long enough to cancel.
      const buffer = deterministicBytes(8 * 1024 * 1024, 0x99)
      await sendFiles(pair.sender, [fileSpec('large-cancel.bin', buffer)])
      await acceptOnReceiver(pair.receiver)

      await expect(pair.sender.getByRole('button', { name: 'Cancel transfer' })).toBeVisible({
        timeout: 60_000,
      })
      await pair.sender.getByRole('button', { name: 'Cancel transfer' }).click()

      await expect(pair.sender.getByText(/Transfer cancelled/i)).toBeVisible({ timeout: 60_000 })
      await waitForSessionState(pair.receiver, 'cancelled', 60_000)

      const snapshots = await readReceivedSnapshots(pair.receiver)
      expect(snapshots).toHaveLength(0)
      await expect(pair.receiver.getByText(/Transfer complete/i)).not.toBeVisible()
    })
  })

  test('receiver cancellation stops transfer for both sides', async ({ browser }) => {
    test.setTimeout(300_000)

    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const buffer = deterministicBytes(8 * 1024 * 1024, 0xaa)
      await sendFiles(pair.sender, [fileSpec('receiver-cancel.bin', buffer)])
      await acceptOnReceiver(pair.receiver)

      await expect(pair.receiver.getByRole('button', { name: 'Cancel transfer' })).toBeVisible({
        timeout: 60_000,
      })
      await pair.receiver.getByRole('button', { name: 'Cancel transfer' }).click()

      await expect(pair.receiver.getByText(/Transfer cancelled/i)).toBeVisible({ timeout: 60_000 })
      await waitForSessionState(pair.sender, 'cancelled', 60_000)

      const snapshots = await readReceivedSnapshots(pair.receiver)
      expect(snapshots).toHaveLength(0)
      await expect(pair.sender.getByText(/Transfer complete/i)).not.toBeVisible()
    })
  })

  test('receiver rejection prevents file transfer', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const sources = [fileSpec('reject-me.txt', Buffer.from('should-not-arrive'), 'text/plain')]
      await sendFiles(pair.sender, sources)
      await rejectOnReceiver(pair.receiver)

      await expect(pair.sender.getByText(/Transfer failed/i)).toBeVisible({ timeout: 30_000 })
      await waitForSessionState(pair.receiver, 'idle')

      const snapshots = await readReceivedSnapshots(pair.receiver)
      expect(snapshots).toHaveLength(0)
    })
  })

  test('connection interruption fails transfer and cleans up', async ({ browser }) => {
    test.setTimeout(300_000)

    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const buffer = deterministicBytes(8 * 1024 * 1024, 0x55)
      await sendFiles(pair.sender, [fileSpec('interrupt-me.bin', buffer)])
      await acceptOnReceiver(pair.receiver)

      await expect(pair.sender.getByRole('button', { name: 'Cancel transfer' })).toBeVisible({
        timeout: 60_000,
      })
      await disconnectPage(pair.sender)

      await waitForSessionState(pair.sender, 'failed', 60_000)
      await waitForSessionState(pair.receiver, 'failed', 60_000)

      const snapshots = await readReceivedSnapshots(pair.receiver)
      expect(snapshots).toHaveLength(0)
      await expect(pair.receiver.getByText(/Transfer complete/i)).not.toBeVisible()
    })
  })

  test('records transfer diagnostics during large transfer', async ({ browser }) => {
    test.setTimeout(300_000)

    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      const buffer = deterministicBytes(1024 * 1024, 0x31)
      await sendFiles(pair.sender, [fileSpec('diag.bin', buffer)])
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver', 180_000)

      const senderDiagnostics = await pair.sender.evaluate(() => {
        const api = window.__sharedropE2E
        if (!api) throw new Error('missing e2e api')
        return api.getTransferDiagnostics()
      })

      expect(senderDiagnostics.bytesSent).toBeGreaterThan(buffer.length)
      expect(senderDiagnostics.bytesReceived).toBeGreaterThan(0)
      expect(senderDiagnostics.transferDurationMs).toBeGreaterThan(0)
      expect(senderDiagnostics.averageThroughputBytesPerSecond).toBeGreaterThan(0)
      expect(senderDiagnostics.peakBufferedAmount).toBeGreaterThanOrEqual(0)
    })
  })
})
