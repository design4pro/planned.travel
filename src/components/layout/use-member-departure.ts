import { useRouter } from '@tanstack/react-router'
import { finishDeparture } from '#/lib/member-departure-recovery'
import {
  departMemberFn,
  recoverDepartureWorkspaceFn,
} from '#/server/fns/members'
import type { DepartureOutcome } from './member-departure-control'

export function useMemberDeparture() {
  const router = useRouter()
  const navigate = () => {
    router.clearCache()
    window.location.replace('/dashboard')
  }
  const recover = async (): Promise<DepartureOutcome> => {
    try {
      const result = await recoverDepartureWorkspaceFn({ data: {} })
      if (result.ok) {
        navigate()
        return { ok: true }
      }
    } catch {
      /* Offer activation recovery again without repeating the membership mutation. */
    }
    return { ok: false, reason: 'failed' }
  }
  const depart = async (
    memberId: string,
  ): Promise<DepartureOutcome> => {
    try {
      const result = await departMemberFn({ data: { memberId } })
      if (result.ok && result.left) {
        router.clearCache()
        const ready = await finishDeparture({
          activationFailed: result.activationFailed,
          recover: async () =>
            (await recoverDepartureWorkspaceFn({ data: {} })).ok,
          navigate,
        })
        return ready ? { ok: true } : { ok: false, reason: 'activation-failed' }
      }
      await router.invalidate({ sync: true })
      if (router.state.matches.some(({ status }) => status === 'error'))
        return { ok: false, reason: 'failed' }
      return result.ok ? { ok: true } : result
    } catch {
      await router.invalidate({ sync: true }).catch(() => undefined)
      return { ok: false, reason: 'failed' }
    }
  }
  return { depart, recover }
}
