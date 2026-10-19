import { beforeEach, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMemberDeparture } from '../use-member-departure'

const ports = vi.hoisted(() => ({
  depart: vi.fn(),
  recover: vi.fn(),
  router: {
    clearCache: vi.fn(),
    invalidate: vi.fn(async () => {}),
    state: { matches: [] },
  },
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ports.router }))
vi.mock('#/server/fns/members', () => ({
  departMemberFn: ports.depart,
  recoverDepartureWorkspaceFn: ports.recover,
}))

beforeEach(() => vi.clearAllMocks())

it('reports an uncertain self-departure without activating or navigating as a success', async () => {
  ports.depart.mockRejectedValue(new Error('network response unavailable'))
  ports.recover.mockResolvedValue({ ok: true })
  const { result } = renderHook(() => useMemberDeparture())
  await expect(result.current.depart('self-member')).resolves.toEqual({
    ok: false,
    reason: 'failed',
  })
  expect(ports.recover).not.toHaveBeenCalled()
  expect(ports.router.clearCache).not.toHaveBeenCalled()
  expect(ports.router.invalidate).toHaveBeenCalledOnce()
})
