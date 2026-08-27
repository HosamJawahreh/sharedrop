import { describe, expect, it } from 'vitest'
import { TRANSFER_PROTOCOL } from '../../../shared/transfer-protocol'

describe('transfer size policy (Phase 9)', () => {
  it('does not define artificial 5 GiB / 10 GiB marketing ceilings', () => {
    expect(
      'MAX_FILE_BYTES' in TRANSFER_PROTOCOL || 'MAX_TOTAL_TRANSFER_BYTES' in TRANSFER_PROTOCOL,
    ).toBe(false)
    expect(TRANSFER_PROTOCOL.MAX_FILES_PER_TRANSFER).toBe(100)
  })
})
