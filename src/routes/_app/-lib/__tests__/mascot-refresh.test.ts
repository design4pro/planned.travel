import { describe, expect, it, vi } from 'vitest'
import { refreshMascotDashboard } from '../mascot-refresh'

describe('dashboard revalidation', () => {
  it('rejects an error match even when router invalidation resolves', async () => {
    const router = {
      state: { matches: [{ routeId: '/_app/dashboard', status: 'error' }] },
      invalidate: vi.fn().mockResolvedValue(undefined),
    }
    expect(await refreshMascotDashboard(router)).toBe(false)
    expect(router.invalidate).toHaveBeenCalledWith({ sync: true })
  })

  it('requires the dashboard and every active match to succeed', async () => {
    const router = {
      state: {
        matches: [
          { routeId: '/_app/dashboard', status: 'success' },
          { routeId: '/_app', status: 'error' },
        ],
      },
      invalidate: vi.fn().mockResolvedValue(undefined),
    }
    expect(await refreshMascotDashboard(router)).toBe(false)
    router.state.matches[1].status = 'success'
    expect(await refreshMascotDashboard(router)).toBe(true)
  })
})
