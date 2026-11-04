import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sweepScheduledAccountSecurity } from '../account-security-scheduled'

const mocks = vi.hoisted(() => ({
  expand: vi.fn(),
  recover: vi.fn(),
  retire: vi.fn(),
  sweep: vi.fn(),
  marker: vi.fn(),
}))
vi.mock('drizzle-orm/d1', () => ({ drizzle: () => ({}) }))
vi.mock('../account-authority', () => ({
  expandAccountAuthority: mocks.expand,
  recoverAccountDeletions: mocks.recover,
  retireAccountSecurityMetadata: mocks.retire,
}))
vi.mock('../account-security-cleanup', () => ({
  sweepAccountSecurity: mocks.sweep,
}))
vi.mock('#/server/erasure/participant-backfill-marker', () => ({
  readParticipantBackfillMarker: mocks.marker,
}))
beforeEach(() => {
  for (const mock of Object.values(mocks))
    mock.mockReset().mockResolvedValue(undefined)
})
describe('independent account maintenance', () => {
  it('continues durable cleanup and deletion recovery when historical marker storage fails', async () => {
    mocks.marker.mockRejectedValue(new Error('fixture KV failure'))
    await expect(
      sweepScheduledAccountSecurity(
        {} as Parameters<typeof sweepScheduledAccountSecurity>[0],
        Date.now(),
      ),
    ).rejects.toThrow('maintenance remains pending')
    expect(mocks.sweep).toHaveBeenCalledOnce()
    expect(mocks.recover).toHaveBeenCalledOnce()
    expect(mocks.retire).toHaveBeenCalledOnce()
  })
})
