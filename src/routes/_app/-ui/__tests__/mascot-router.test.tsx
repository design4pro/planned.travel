import { afterEach, expect, it } from 'vitest'
import {
  markWorkspaceStale,
  resetWorkspaceClaim,
  setWorkspaceClaim,
} from '#/lib/workspace-claim-store'
import { refreshMascotDashboard } from '../../-lib/mascot-refresh'

afterEach(resetWorkspaceClaim)

it('does not accept a refreshed dashboard when access becomes stale', async () => {
  setWorkspaceClaim('first')
  const result = await refreshMascotDashboard(async () => {
    markWorkspaceStale('first')
    return { ok: true }
  })
  expect(result).toBeNull()
})
