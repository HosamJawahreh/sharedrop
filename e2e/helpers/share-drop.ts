import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { E2EReceivedFileSnapshot } from '../../src/e2e/share-drop-e2e-api'

export const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

export const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

export interface ShareDropPair {
  sender: Page
  receiver: Page
  cleanup: () => Promise<void>
}

export async function createShareDropPair(browser: Browser): Promise<ShareDropPair> {
  const senderContext = await browser.newContext({ userAgent: ANDROID_PHONE_UA })
  const receiverContext = await browser.newContext({ userAgent: IPHONE_UA })
  const sender = await senderContext.newPage()
  const receiver = await receiverContext.newPage()
  return {
    sender,
    receiver,
    cleanup: async () => {
      await senderContext.close()
      await receiverContext.close()
    },
  }
}

export async function withShareDropPair(
  browser: Browser,
  run: (pair: ShareDropPair) => Promise<void>,
): Promise<void> {
  const pair = await createShareDropPair(browser)
  try {
    await run(pair)
  } finally {
    await Promise.all([
      pair.sender.evaluate(async () => window.__sharedropE2E?.stopNearby()).catch(() => {}),
      pair.receiver.evaluate(async () => window.__sharedropE2E?.stopNearby()).catch(() => {}),
    ])
    await pair.cleanup()
  }
}

async function waitForE2E(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__sharedropE2E !== undefined)
}

export async function startNearbySend(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Send to nearby' }).click()
  await expect(page.getByRole('heading', { name: 'Nearby devices', exact: true })).toBeVisible()
  await waitForE2E(page)
}

async function waitForPeerVisible(page: Page, displayName: string): Promise<string> {
  await waitForE2E(page)
  await page.waitForFunction(
    (name) => {
      const api = window.__sharedropE2E
      if (!api) return false
      const peers = api.getNearbyDevices()
      return peers.some((device) => device.displayName === name)
    },
    displayName,
    { timeout: 30_000 },
  )

  return page.evaluate((name) => {
    const api = window.__sharedropE2E
    if (!api) throw new Error('ShareDrop E2E API is unavailable')
    const peer = api.getNearbyDevices().find((device) => device.displayName === name)
    if (!peer) throw new Error(`Peer ${name} not found`)
    return peer.deviceId
  }, displayName)
}

export async function connectPair(pair: ShareDropPair): Promise<void> {
  const { sender, receiver } = pair
  await Promise.all([startNearbySend(sender), startNearbySend(receiver)])

  const receiverDeviceId = await receiver.evaluate(() => window.__sharedropE2E!.getLocalDeviceId())
  await sender.waitForFunction(
    (deviceId) => {
      const api = window.__sharedropE2E
      if (!api) return false
      return api.getNearbyDevices().some((device) => device.deviceId === deviceId)
    },
    receiverDeviceId,
    { timeout: 30_000 },
  )
  await waitForPeerVisible(receiver, 'My Android Phone')

  await sender.evaluate(async (deviceId) => {
    const api = window.__sharedropE2E
    if (!api) throw new Error('ShareDrop E2E API is unavailable')
    await api.connectToDevice(deviceId)
  }, receiverDeviceId)

  await sender.waitForFunction(
    () => window.__sharedropE2E?.getConnectionState() === 'connected',
    null,
    {
      timeout: 60_000,
    },
  )
  await receiver.waitForFunction(
    () => window.__sharedropE2E?.getConnectionState() === 'connected',
    null,
    { timeout: 60_000 },
  )

  await expect(sender.getByRole('heading', { name: /Connected to/i })).toBeVisible({
    timeout: 15_000,
  })
  await expect(receiver.getByRole('heading', { name: /Connected to/i })).toBeVisible({
    timeout: 15_000,
  })
}

export interface TestFileSpec {
  name: string
  mimeType: string
  buffer: Buffer
}

export async function sendFiles(
  sender: Page,
  files: TestFileSpec[],
  options?: { waitForIncomingOnReceiver?: boolean },
): Promise<void> {
  await sender.locator('input[type="file"]').setInputFiles(
    files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      buffer: file.buffer,
    })),
  )

  await expect(sender.getByText('Selected files')).toBeVisible()
  await sender.getByRole('button', { name: 'Send', exact: true }).click()

  if (options?.waitForIncomingOnReceiver !== false) {
    await expect(sender.getByText(/Waiting for My iPhone/i)).toBeVisible({ timeout: 15_000 })
  }
}

export async function acceptOnReceiver(receiver: Page): Promise<void> {
  await expect(receiver.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 30_000 })
  await receiver.getByRole('button', { name: 'Accept' }).click()
}

export async function rejectOnReceiver(receiver: Page): Promise<void> {
  await expect(receiver.getByRole('button', { name: 'Reject' })).toBeVisible({ timeout: 30_000 })
  await receiver.getByRole('button', { name: 'Reject' }).click()
}

export async function waitForTransferComplete(
  page: Page,
  _role: 'sender' | 'receiver',
  timeout = 120_000,
): Promise<void> {
  await expect(page.getByText(/Transfer complete/i)).toBeVisible({ timeout })
}

export async function readReceivedSnapshots(page: Page): Promise<E2EReceivedFileSnapshot[]> {
  await page.waitForFunction(() => window.__sharedropE2E !== undefined)
  return page.evaluate(async () => {
    const api = window.__sharedropE2E
    if (!api) {
      throw new Error('ShareDrop E2E API is unavailable')
    }
    return api.getReceivedFileSnapshots()
  })
}

export async function waitForSessionState(
  page: Page,
  state: string,
  timeout = 60_000,
): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__sharedropE2E?.getTransferProgress().sessionState === expected,
    state,
    { timeout },
  )
}

export async function disconnectPage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = window.__sharedropE2E
    if (!api) throw new Error('ShareDrop E2E API is unavailable')
    await api.disconnect()
  })
}

export function verifySnapshotsAgainstSources(
  snapshots: E2EReceivedFileSnapshot[],
  sources: TestFileSpec[],
  expectedSha256: string[],
): void {
  expect(snapshots).toHaveLength(sources.length)
  for (let index = 0; index < sources.length; index += 1) {
    const snapshot = snapshots[index]
    const source = sources[index]
    expect(snapshot?.name).toBe(source.name)
    expect(snapshot?.size).toBe(source.buffer.length)
    expect(snapshot?.sha256).toBe(expectedSha256[index])
    expect(Buffer.from(snapshot?.bytes ?? [])).toEqual(source.buffer)
  }
}
