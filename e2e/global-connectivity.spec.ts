import { test, expect } from '@playwright/test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  acceptOnReceiver,
  connectPair,
  sendFiles,
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

test.describe('Phase 9 global connectivity diagnostics', () => {
  test('records ICE candidate type and transfer diagnostics after connect', async ({ browser }) => {
    await withShareDropPair(browser, async (pair) => {
      await connectPair(pair)

      await pair.sender.evaluate(async () => {
        await window.__sharedropE2E!.refreshConnectionDiagnostics()
      })

      const connection = await pair.sender.evaluate(() => {
        const diagnostics = window.__sharedropE2E!.getConnectionDiagnostics()
        return {
          state: diagnostics?.state ?? null,
          ice: diagnostics?.iceConnectionState ?? null,
          peer: diagnostics?.peerConnectionState ?? null,
          candidateType: diagnostics?.webRtcStats?.candidateType ?? null,
          rttMs: diagnostics?.webRtcStats?.rttMs ?? null,
        }
      })

      expect(connection.state).toBe('connected')
      // Localhost Chromium pairs typically select host; srflx/relay require real NAT/TURN.
      expect(['host', 'srflx', 'relay', 'prflx', null]).toContain(connection.candidateType)

      const buffer = deterministicBytes(256 * 1024, 0x91)
      const sources = [fileSpec('phase9-diag.bin', buffer)]
      await sendFiles(pair.sender, sources)
      await acceptOnReceiver(pair.receiver)
      await waitForTransferComplete(pair.receiver, 'receiver')

      const transfer = await pair.sender.evaluate(() =>
        window.__sharedropE2E!.getTransferDiagnostics(),
      )
      expect(transfer.bytesSent).toBeGreaterThan(buffer.length)
      expect(transfer.transferDurationMs).not.toBeNull()
      expect((transfer.averageThroughputBytesPerSecond ?? 0) > 0).toBe(true)

      const summaries = await pair.receiver.evaluate(() =>
        window.__sharedropE2E!.getReceivedFileSummaries(),
      )
      expect(summaries).toHaveLength(1)
      expect(summaries[0]?.size).toBe(buffer.length)
      expect(summaries[0]?.sha256).toBe(sha256Hex(buffer))
    })
  })

  test('transfers 100 MB with SHA-256 verification', async ({ browser }) => {
    test.setTimeout(600_000)

    const dir = await mkdtemp(path.join(tmpdir(), 'sharedrop-100mb-'))
    const filePath = path.join(dir, 'phase9-100mb.bin')
    const buffer = deterministicBytes(100 * 1024 * 1024, 0x29)
    const expectedSha = sha256Hex(buffer)
    await writeFile(filePath, buffer)

    try {
      await withShareDropPair(browser, async (pair) => {
        await connectPair(pair)

        const started = Date.now()
        await pair.sender.locator('input[type="file"]').setInputFiles(filePath)
        await expect(pair.sender.getByText('Selected files')).toBeVisible()
        await pair.sender.getByRole('button', { name: 'Send', exact: true }).click()
        await expect(pair.sender.getByText(/Waiting for My iPhone/i)).toBeVisible({
          timeout: 15_000,
        })
        await acceptOnReceiver(pair.receiver)
        await waitForTransferComplete(pair.receiver, 'receiver', 540_000)
        const durationMs = Date.now() - started

        const summaries = await pair.receiver.evaluate(() =>
          window.__sharedropE2E!.getReceivedFileSummaries(),
        )
        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.size).toBe(buffer.length)
        expect(summaries[0]?.sha256).toBe(expectedSha)
        expect(summaries[0]?.name).toBe('phase9-100mb.bin')

        const transfer = await pair.sender.evaluate(() =>
          window.__sharedropE2E!.getTransferDiagnostics(),
        )
        const throughput = transfer.averageThroughputBytesPerSecond
        expect(throughput === null || throughput > 0).toBe(true)
        expect(durationMs).toBeGreaterThan(0)

        await pair.sender.evaluate(async () => {
          await window.__sharedropE2E!.refreshConnectionDiagnostics()
        })
        const candidateType = await pair.sender.evaluate(
          () =>
            window.__sharedropE2E!.getConnectionDiagnostics()?.webRtcStats?.candidateType ?? null,
        )
        expect(['host', 'srflx', 'relay', 'prflx', null]).toContain(candidateType)

        console.log(
          JSON.stringify({
            phase9_100mb: {
              durationMs,
              throughputBytesPerSecond: throughput,
              candidateType,
              sha256: expectedSha,
            },
          }),
        )
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
