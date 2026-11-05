import { useEffect, useState } from 'react'
import { selectReservationPrompt } from '../-lib/mascot-state'
import { selectMascotPrompt } from '#/lib/mascot-prompts'
import type { MascotCandidate } from '#/lib/mascot-prompts'
import {
  dismissOccurrence,
  readSuppression,
  writeSuppression,
} from '#/lib/mascot-suppression'
import { Mascot } from './mascot'
import type { createChatLauncher } from '../-lib/mascot-chat'
import type { TripCard } from '../-server/overview'

type Reservation = {
  id: string
  tripId: string
  status: string
  startDate: string | null
}
type Props = {
  trip: Pick<TripCard, 'id' | 'startDate' | 'endDate'> | null
  trips: ReadonlyArray<Pick<TripCard, 'id' | 'isArchived'>>
  reservations: ReadonlyArray<Reservation>
  today: string
  userId: string
  workspaceId: string
  onRefresh: () => Promise<boolean>
  candidates?: ReadonlyArray<MascotCandidate>
  nowMs?: number
  partial?: boolean
  reduceMotion?: boolean
  adapter?: Parameters<typeof createChatLauncher>[0]
}

export function DashboardMascot(props: Props) {
  const [snapshot, setSnapshot] = useState<{
    now: number
    scope: { userId: string; workspaceId: string }
    today: string
    dismissed: ReturnType<typeof readSuppression>
  } | null>(null)
  const [hidden, setHidden] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [focused, setFocused] = useState<{
    id: string
    tripId?: string
    startDate: string
    source: 'reservation' | 'event' | 'notification'
    action?: boolean
    userId: string
    workspaceId: string
  } | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    let active = true
    let inFlight = false
    const refresh = (today: string, now = Date.now()) => {
      let dismissed: ReturnType<typeof readSuppression> = []
      try {
        dismissed = readSuppression(
          sessionStorage,
          props.userId,
          props.workspaceId,
          now,
        )
      } catch {
        // Browser storage can be blocked.
      }
      setSnapshot({
        now,
        today,
        dismissed,
        scope: { userId: props.userId, workspaceId: props.workspaceId },
      })
    }
    const revalidate = async () => {
      if (inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      let valid = false
      try {
        valid = await props.onRefresh()
      } catch {
        /* Failed refresh removes stale context. */
      }
      if (!active) return
      inFlight = false
      setInvalid(!valid)
      if (valid) refresh(new Date().toISOString().slice(0, 10))
      else setSnapshot(null)
    }
    const scheduleExpiry = () => {
      if (expiryTimer !== undefined) clearTimeout(expiryTimer)
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      const expiries = (props.candidates ?? []).flatMap((candidate) => {
        if (candidate.source !== 'notification') return []
        const expiry = Date.parse(candidate.occurrence) + 7 * 86_400_000 + 1
        return Number.isFinite(expiry) && expiry > now ? [expiry] : []
      })
      if (expiries.length)
        expiryTimer = setTimeout(
          () => {
            refresh(new Date().toISOString().slice(0, 10))
            scheduleExpiry()
          },
          Math.min(...expiries) - now,
        )
    }
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      timer = setTimeout(
        () => {
          void revalidate()
          schedule()
        },
        86_400_000 - (now % 86_400_000),
      )
    }
    setInvalid(false)
    const serverNow = props.nowMs ?? Date.now()
    const arrivalNow = Date.now()
    const expiredOnArrival = (props.candidates ?? []).some((candidate) => {
      if (candidate.source !== 'notification') return false
      const expiry = Date.parse(candidate.occurrence) + 7 * 86_400_000
      return expiry >= serverNow && expiry < arrivalNow
    })
    refresh(props.today, expiredOnArrival ? arrivalNow : serverNow)
    schedule()
    scheduleExpiry()
    const visible = () => {
      if (document.visibilityState === 'visible') void revalidate()
      schedule()
      scheduleExpiry()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
      if (expiryTimer !== undefined) clearTimeout(expiryTimer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [
    props.today,
    props.userId,
    props.workspaceId,
    props.reservations,
    props.candidates,
    props.nowMs,
    props.onRefresh,
  ])
  const select = (
    reservations = props.reservations,
    candidates = props.candidates,
  ) => {
    if (!snapshot || hidden || invalid) return null
    if (
      snapshot.scope.userId !== props.userId ||
      snapshot.scope.workspaceId !== props.workspaceId
    )
      return null
    if (candidates) {
      const candidate = selectMascotPrompt({
        today: snapshot.today,
        nowMs: snapshot.now,
        dismissed: snapshot.dismissed,
        candidates,
      })
      if (!candidate) return null
      return { ...candidate, startDate: candidate.occurrence }
    }
    const reservation = selectReservationPrompt({
      today: snapshot.today,
      currentScope: { userId: props.userId, workspaceId: props.workspaceId },
      dismissedScope: snapshot.scope,
      nowMs: snapshot.now,
      dismissed: snapshot.dismissed,
      trips: props.trips,
      reservations,
    })
    return reservation
      ? { ...reservation, source: 'reservation' as const }
      : null
  }
  const selected = select()
  const retained =
    focused &&
    snapshot &&
    !hidden &&
    !invalid &&
    focused.userId === props.userId &&
    focused.workspaceId === props.workspaceId &&
    (focused.source !== 'notification' ||
      Date.parse(focused.startDate) + 7 * 86_400_000 >= snapshot.now) &&
    snapshot.scope.userId === props.userId &&
    snapshot.scope.workspaceId === props.workspaceId &&
    (props.candidates
      ? props.candidates.some(
          (item) =>
            item.id === focused.id &&
            item.source === focused.source &&
            (item.source === 'notification' || item.tripId === focused.tripId),
        )
      : props.reservations.some(
          (item) => item.id === focused.id && item.tripId === focused.tripId,
        ) &&
        props.trips.some(
          (trip) => trip.id === focused.tripId && !trip.isArchived,
        ) &&
        !props.trips.some(
          (trip) => trip.id === focused.tripId && trip.isArchived,
        ))
      ? focused
      : null
  const prompt = focused ? retained : selected
  const promptDetails =
    !focused ||
    Boolean(
      select(
        props.reservations.filter(
          (item) =>
            item.id === focused.id &&
            item.tripId === focused.tripId &&
            item.startDate === focused.startDate,
        ),
        props.candidates?.filter(
          (item) =>
            item.id === focused.id &&
            item.source === focused.source &&
            item.occurrence === focused.startDate,
        ),
      ),
    )
  function dismiss() {
    if (!prompt || !snapshot) return
    const entries = dismissOccurrence(
      snapshot.dismissed,
      prompt.source,
      prompt.id,
      prompt.startDate,
      Date.now(),
    )
    try {
      writeSuppression(sessionStorage, props.userId, props.workspaceId, entries)
    } catch {
      /* Storage is optional. */
    }
    setHidden(true)
  }
  return (
    <Mascot
      trip={invalid ? null : props.trip}
      adapter={props.adapter}
      available={!invalid}
      reduceMotion={props.reduceMotion}
      today={snapshot?.today ?? props.today}
      prompt={prompt}
      promptDetails={promptDetails}
      partial={props.partial}
      showEmpty={Boolean(
        props.candidates &&
        snapshot &&
        !hidden &&
        !invalid &&
        !prompt &&
        !props.partial,
      )}
      onRetry={props.onRefresh}
      onDismiss={dismiss}
      onPromptFocus={() =>
        setFocused(
          prompt
            ? {
                ...prompt,
                userId: props.userId,
                workspaceId: props.workspaceId,
              }
            : null,
        )
      }
      onPromptBlur={() => setFocused(null)}
    />
  )
}
