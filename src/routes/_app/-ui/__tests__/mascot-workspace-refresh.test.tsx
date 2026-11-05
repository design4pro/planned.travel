import { afterEach, expect, it, vi } from 'vitest'
import {
  beginWorkspaceSwitch,
  endWorkspaceSwitch,
  resetWorkspaceClaim,
  setWorkspaceClaim,
} from '#/lib/workspace-claim-store'
import { refreshMascotDashboard } from '../../-lib/mascot-refresh'

afterEach(resetWorkspaceClaim)

it('waits for a workspace transition before refreshing the dashboard', async () => {
  const transition = beginWorkspaceSwitch()
  const router = {
    state: { matches: [{ routeId: '/_app/dashboard', status: 'success' }] },
    invalidate: vi.fn().mockResolvedValue(undefined),
  }

  const refresh = refreshMascotDashboard(router)
  await Promise.resolve()
  expect(router.invalidate).not.toHaveBeenCalled()
  endWorkspaceSwitch(transition)
  expect(await refresh).toBe(true)
  expect(router.invalidate).toHaveBeenCalledOnce()
})

it('drops a delayed refresh when its workspace changes', async () => {
  setWorkspaceClaim('first')
  const transition = beginWorkspaceSwitch()
  const router = {
    state: { matches: [{ routeId: '/_app/dashboard', status: 'success' }] },
    invalidate: vi.fn().mockResolvedValue(undefined),
  }

  const refresh = refreshMascotDashboard(router)
  setWorkspaceClaim('second')
  endWorkspaceSwitch(transition)
  expect(await refresh).toBe(false)
  expect(router.invalidate).not.toHaveBeenCalled()
})
