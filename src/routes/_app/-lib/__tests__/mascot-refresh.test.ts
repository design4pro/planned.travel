import { describe, expect, it } from 'vitest'
import { refreshMascotDashboard } from '../mascot-refresh'

describe('dashboard revalidation', () => {
  it('returns fresh data from the authorized read', async () => {
    await expect(
      refreshMascotDashboard(async () => ({ ok: true })),
    ).resolves.toEqual({ ok: true })
  })

  it('propagates access failures instead of retaining a successful result', async () => {
    await expect(
      refreshMascotDashboard(async () => {
        throw new Error('access lost')
      }),
    ).rejects.toThrow('access lost')
  })
})
