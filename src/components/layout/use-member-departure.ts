import { useRef } from 'react'
import { toast } from 'sonner'
import { useTranslate } from '#/lib/i18n'
import { useRouter } from '@tanstack/react-router'
import { finishDeparture } from '#/lib/member-departure-recovery'
import {
  departMemberFn,
  recoverDepartureWorkspaceFn,
} from '#/server/fns/members'
import { DEPARTURE_COPY } from './member-departure-control'
import type { DepartureOutcome } from './member-departure-control'

export function useMemberDeparture() {
  const router = useRouter()
  const t = useTranslate()
  const membersRef = useRef<HTMLTableElement>(null)
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
  const depart = async (memberId: string): Promise<DepartureOutcome> => {
    const confirmation = document.querySelector('[role="dialog"]')
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
      if (result.ok) {
        toast.success(t('settings.workspace.departure.removed'))
        requestAnimationFrame(() => membersRef.current?.focus())
        return { ok: true }
      }
      if (result.reason === 'not-found' || result.reason === 'not-permitted') {
        requestAnimationFrame(() => {
          if (!confirmation?.isConnected) {
            toast.error(t(DEPARTURE_COPY[result.reason]))
            membersRef.current?.focus()
          }
        })
      }
      return result
    } catch {
      await router.invalidate({ sync: true }).catch(() => undefined)
      return { ok: false, reason: 'failed' }
    }
  }
  return { depart, recover, membersRef }
}
