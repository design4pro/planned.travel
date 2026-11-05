import { afterEach, expect, it, vi } from 'vitest'
import {
  beginWorkspaceSwitch,
  endWorkspaceSwitch,
  markWorkspaceStale,
  resetWorkspaceClaim,
  setWorkspaceClaim,
} from '#/lib/workspace-claim-store'
import { refreshMascotDashboard } from '../../-lib/mascot-refresh'

afterEach(resetWorkspaceClaim)

it('waits for a workspace transition before reading', async () => {
  setWorkspaceClaim('first')
  const transition = beginWorkspaceSwitch()
  const read = vi.fn().mockResolvedValue('fresh')
  const refresh = refreshMascotDashboard(read)
  await Promise.resolve()
  expect(read).not.toHaveBeenCalled()
  endWorkspaceSwitch(transition)
  expect(await refresh).toBe('fresh')
})

it('drops a delayed read when the workspace or generation changes', async () => {
  setWorkspaceClaim('first')
  let complete: (value: string) => void = () => {}
  const read = () =>
    new Promise<string>((resolve) => {
      complete = resolve
    })
  const refresh = refreshMascotDashboard(read)
  setWorkspaceClaim('first')
  complete('old')
  expect(await refresh).toBeNull()
})

it('never reads from a stale tab and drops a refusal during a read', async () => {
  setWorkspaceClaim('first')
  let complete: (value: string) => void = () => {}
  const read = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve
      }),
  )
  const refresh = refreshMascotDashboard(read)
  markWorkspaceStale('first')
  complete('old')
  expect(await refresh).toBeNull()
  expect(await refreshMascotDashboard(read)).toBeNull()
  expect(read).toHaveBeenCalledOnce()
})

it('drops a read started before a workspace switch', async () => {
  setWorkspaceClaim('first')
  let complete: (value: string) => void = () => {}
  const refresh = refreshMascotDashboard(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve
      }),
  )
  const transition = beginWorkspaceSwitch()
  complete('old')
  expect(await refresh).toBeNull()
  endWorkspaceSwitch(transition)
})
