import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import {
  BILLING_INTERVALS,
  PLAN_IDS,
  isEntitlingStatus,
  planById,
} from '#/lib/plans'
import {
  useWorkspaceClaim,
  workspaceClaimState,
} from '#/lib/workspace-claim-store'
import { loadLocalBilling } from '../../-server/local-billing'
import type { BillingInterval, PlanId } from '#/lib/plans'
import type { Entitlements } from '#/server/billing/types'

type ReturnMarker = 'checkout' | 'plan'
type Outcome = 'pending' | 'checking' | 'confirmed' | 'scheduled' | 'delayed'
const STORAGE_KEY = 'billing-selection'
const HINT_TTL = 30 * 60 * 1000
const BACKOFF = [2000, 4000, 8000, 16000, 29000]
export function clearBillingSelection(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* Storage may be disabled. */
  }
}

const hintSchema = z.object({
  organizationId: z.string(),
  viewerId: z.string(),
  operation: z.enum(['checkout', 'plan']),
  createdAt: z.number(),
  planId: z.enum(PLAN_IDS),
  interval: z.enum(BILLING_INTERVALS),
  seats: z.number().int().min(1).max(1000).optional(),
})
type Hint = z.infer<typeof hintSchema>

/** Display-only, one operation per tab; no provider identifiers ever enter storage or URLs. */
export function rememberBillingSelection(
  organizationId: string,
  viewerId: string,
  operation: ReturnMarker,
  selection: { planId: PlanId; interval: BillingInterval; seats?: number },
): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...selection,
        organizationId,
        viewerId,
        operation,
        createdAt: Date.now(),
      }),
    )
  } catch {
    /* Storage disabled: the return remains generic. */
  }
}

function readHint(
  state: Entitlements,
  viewerId: string,
  marker: ReturnMarker | undefined,
): Hint | null {
  try {
    const parsed = hintSchema.safeParse(
      JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'),
    )
    if (!parsed.success) return null
    const hint = parsed.data
    const age = Date.now() - hint.createdAt
    if (
      hint.organizationId !== state.organizationId ||
      hint.viewerId !== viewerId ||
      marker === undefined ||
      age < 0 ||
      age >= HINT_TTL
    )
      return null
    if (hint.operation !== marker) return null
    if (planById(hint.planId).seatBased && hint.seats === undefined) return null
    return hint
  } catch {
    return null
  }
}

function outcomeOf(state: Entitlements, hint: Hint | null): Outcome {
  if (hint === null) return 'checking'
  if (
    state.planId === hint.planId &&
    state.interval === hint.interval &&
    isEntitlingStatus(state.status) &&
    (!planById(hint.planId).seatBased || state.seats === hint.seats)
  )
    return 'confirmed'
  const scheduled = state.pendingChange
  // The scheduled projection confirms plan and interval only, never future seats.
  if (
    scheduled?.planId === hint.planId &&
    scheduled.interval === hint.interval &&
    scheduled.effectiveAt.getTime() > Date.now()
  )
    return 'scheduled'
  return 'pending'
}

export function useBillingReturn(
  initial: Entitlements,
  viewerId: string,
  marker: ReturnMarker | undefined,
) {
  const claim = useWorkspaceClaim()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  const [readState, setReadState] = useState<{
    source: Entitlements
    state: Entitlements
  } | null>(null)
  const state = readState?.source === initial ? readState.state : initial
  const [delayed, setDelayed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const displayHint = hydrated ? readHint(initial, viewerId, marker) : null
  const derived = outcomeOf(state, displayHint)
  let outcome: Outcome = derived
  if (derived !== 'confirmed' && derived !== 'scheduled' && delayed)
    outcome = 'delayed'
  const manual = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    let active = true
    let running = false
    let exhausted = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | null = null
    let requestTimeout: ReturnType<typeof setTimeout> | undefined
    const disabled =
      claim.stale ||
      claim.switching ||
      claim.organizationId !== initial.organizationId
    const hint = readHint(initial, viewerId, marker)
    if (hint === null) clearBillingSelection()
    setReadState(null)
    setRefreshing(false)
    setDelayed(disabled)
    let resolved = ['confirmed', 'scheduled'].includes(outcomeOf(initial, hint))
    const deadline = setTimeout(() => {
      exhausted = true
      clearTimeout(timer)
      controller?.abort()
      clearTimeout(requestTimeout)
      running = false
      if (active) setRefreshing(false)
      if (active && !resolved && marker) setDelayed(true)
    }, 60000)

    function schedule() {
      if (
        !active ||
        disabled ||
        !marker ||
        resolved ||
        exhausted ||
        running ||
        document.visibilityState === 'hidden'
      )
        return
      if (attempt === BACKOFF.length) {
        exhausted = true
        setDelayed(true)
        return
      }
      timer = setTimeout(() => {
        void read(false)
      }, BACKOFF[attempt])
    }
    async function read(isManual: boolean) {
      if (!active || disabled) return
      if (isManual) setRefreshing(true)
      if (running) return
      clearTimeout(timer)
      if (!isManual) attempt += 1
      running = true
      const request = new AbortController()
      controller = request
      const requestTimer = setTimeout(() => {
        if (!active || controller !== request) return
        request.abort()
        exhausted = true
        running = false
        setRefreshing(false)
        if (active) setDelayed(true)
      }, 10000)
      requestTimeout = requestTimer
      try {
        const next = await loadLocalBilling({
          data: {},
          signal: request.signal,
          fetch: (input, init) =>
            fetch(input, { ...init, referrerPolicy: 'no-referrer' }),
        })
        if (
          !active ||
          request.signal.aborted ||
          workspaceClaimState() !== claim
        )
          return
        if (
          next.viewerId !== viewerId ||
          next.entitlements.organizationId !== initial.organizationId
        ) {
          exhausted = true
          setDelayed(true)
          return
        }
        setReadState({ source: initial, state: next.entitlements })
        resolved = ['confirmed', 'scheduled'].includes(
          outcomeOf(next.entitlements, hint),
        )
        if (resolved) {
          clearTimeout(deadline)
          setDelayed(false)
        }
      } catch {
        if (active && !request.signal.aborted) {
          exhausted = true
          setDelayed(true)
        }
      } finally {
        clearTimeout(requestTimer)
        if (controller === request) {
          running = false
          if (active) setRefreshing(false)
        }
        if (!request.signal.aborted) schedule()
      }
    }
    manual.current = () => read(true)
    function visibility() {
      clearTimeout(timer)
      schedule()
    }
    document.addEventListener('visibilitychange', visibility)
    schedule()
    return () => {
      active = false
      controller?.abort()
      clearTimeout(timer)
      clearTimeout(deadline)
      clearTimeout(requestTimeout)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [initial, viewerId, marker, claim])

  return { state, outcome, refreshing, refresh: () => manual.current() }
}
