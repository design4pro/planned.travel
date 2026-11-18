import { useCallback, useLayoutEffect, useRef, useState } from 'react'

interface FocusAttempt {
  readonly identity: unknown
  readonly workspaceId: string | null
  cancelled: boolean
  detach: () => void
}

/** The surviving page owns a retry's focus until the recovered view commits. */
export function useDashboardRetryFocus({
  identity,
  workspaceId,
  recovered,
  onRetry,
}: {
  identity: unknown
  workspaceId: string | null
  recovered: boolean
  onRetry: () => Promise<boolean>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const current = useRef<FocusAttempt | null>(null)
  const [settled, setSettled] = useState<{
    attempt: FocusAttempt
    ok: boolean
  } | null>(null)

  useLayoutEffect(
    () => () => {
      const attempt = current.current
      if (!attempt) return
      attempt.cancelled = true
      attempt.detach()
      current.current = null
    },
    [identity, workspaceId],
  )

  const retry = useCallback(() => {
    if (current.current) return
    const origin = containerRef.current
    const attempt: FocusAttempt = {
      identity,
      workspaceId,
      cancelled: false,
      detach: () => {},
    }
    const cancel = () => {
      attempt.cancelled = true
      attempt.detach()
    }
    const pointer = (event: Event) => {
      if (event.target instanceof Node && !origin?.contains(event.target))
        cancel()
    }
    const focus = (event: Event) => {
      const target = event.target
      // Removing the recovery view can focus body automatically. An outside
      // pointer still cancels ownership, even when it targets non-focusable space.
      if (
        !(target instanceof Element) ||
        !target.isConnected ||
        target === document.body ||
        target === document.documentElement
      )
        return
      if (!origin?.contains(target)) cancel()
    }
    attempt.detach = () => {
      document.removeEventListener('focusin', focus, true)
      document.removeEventListener('pointerdown', pointer, true)
    }
    current.current = attempt
    document.addEventListener('focusin', focus, true)
    document.addEventListener('pointerdown', pointer, true)
    const finish = (ok: boolean) => {
      if (current.current === attempt) setSettled({ attempt, ok })
    }
    void Promise.resolve()
      .then(onRetry)
      .then(finish, () => finish(false))
  }, [identity, workspaceId, onRetry])

  useLayoutEffect(() => {
    if (!settled) return
    const { attempt, ok } = settled
    if (current.current !== attempt) {
      setSettled(null)
      return
    }
    const cancelled =
      attempt.cancelled ||
      attempt.identity !== identity ||
      attempt.workspaceId !== workspaceId
    // A promise can settle before a concurrent render commits the new page.
    if (ok && !recovered && !cancelled) return
    attempt.detach()
    current.current = null
    if (!cancelled) {
      const target = ok
        ? (document.querySelector<HTMLElement>(
            '[data-dashboard-mascot-launcher]',
          ) ??
          document.querySelector<HTMLElement>('[data-dashboard-create-trip]'))
        : recovered
          ? null
          : containerRef.current
      if (target?.isConnected) target.focus()
    }
    setSettled(null)
  }, [settled, recovered, identity, workspaceId])

  return { containerRef, retry }
}
