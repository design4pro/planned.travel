import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useTranslate } from '#/lib/i18n'
import { DEPARTURE_COPY } from './member-departure-control'
import { departMemberFn } from '#/server/fns/members'
import type { DepartureOutcome } from './member-departure-control'

export function useMemberDeparture() {
  const router = useRouter()
  const t = useTranslate()
  return async (memberId?: string): Promise<DepartureOutcome> => {
    try {
      const result = await departMemberFn({ data: { memberId } })
      if (result.ok && result.left) {
        router.clearCache()
        // A document navigation discards all departed-workspace client state, including in-flight loaders.
        window.location.replace('/dashboard')
        return { ok: true }
      }
      if (!result.ok) toast.error(t(DEPARTURE_COPY[result.reason]))
      await router.invalidate({ sync: true })
      if (router.state.matches.some(({ status }) => status === 'error'))
        return { ok: false, reason: 'failed' }
      return result.ok ? { ok: true } : result
    } catch {
      await router.invalidate({ sync: true }).catch(() => undefined)
      return { ok: false, reason: 'failed' }
    }
  }
}
