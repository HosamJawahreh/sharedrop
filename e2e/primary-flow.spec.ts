import { test, expect } from '@playwright/test'
import {
  acceptOnReceiver,
  connectPairViaHomepageUi,
  readReceivedSnapshots,
  sendFiles,
  verifySnapshotsAgainstSources,
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

/**
 * Phase 12C — complete primary product path (browser ↔ browser):
 * Open → Available now → Select → Connect → Files → Send → Accept → Bytes → Integrity → Complete
 */
test.describe('Phase 12C primary product flow', () => {
  test('homepage to integrity-verified transfer via Available now UI', async ({ browser }) => {
    test.setTimeout(180_000)

    await withShareDropPair(browser, async (pair) => {
      await connectPairViaHomepageUi(pair)

      await expect(pair.sender.getByRole('heading', { name: /Ready to send/i })).toBeVisible()
      await expect(pair.receiver.getByRole('heading', { name: /Ready to receive/i })).toBeVisible()

      const buffer = deterministicBytes(64 * 1024, 0x12)
      const sources = [fileSpec('phase-12c-primary.bin', buffer)]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver')
      await waitForTransferComplete(pair.sender, 'sender')

      const snapshots = await readReceivedSnapshots(pair.receiver)
      verifySnapshotsAgainstSources(snapshots, sources, [sha256Hex(buffer)])
    })
  })
})
