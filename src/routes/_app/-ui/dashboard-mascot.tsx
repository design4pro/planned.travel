import { useEffect, useRef, useState } from 'react'
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
    suppressionNow: number
  } | null>(null)
  const hydratedScope = useRef<string | null>(null)
  const completedBoundary = useRef<string | null>(null)
  const boundaryDeadline = useRef<{ key: string; deadline: number } | null>(
    null,
  )
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
    let active = true
    let inFlight = false
    let pendingBoundary = false
    const refresh = (today: string, now = Date.now()) => {
      const suppressionNow = Date.now()
      let dismissed: ReturnType<typeof readSuppression> = []
      try {
        dismissed = readSuppression(
          sessionStorage,
          props.userId,
          props.workspaceId,
          suppressionNow,
        )
      } catch {
        // Browser storage can be blocked.
      }
      setSnapshot({
        now,
        today,
        dismissed,
        suppressionNow,
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
      if (!valid) {
        setSnapshot(null)
        pendingBoundary = false
        if (timer !== undefined) clearTimeout(timer)
        if (props.nowMs !== undefined)
          completedBoundary.current = JSON.stringify([
            props.userId,
            props.workspaceId,
            props.nowMs,
          ])
      } else {
        if (props.nowMs === undefined)
          refresh(new Date().toISOString().slice(0, 10))
        if (pendingBoundary) {
          pendingBoundary = false
          if (props.nowMs !== undefined)
            completedBoundary.current = JSON.stringify([
              props.userId,
              props.workspaceId,
              props.nowMs,
            ])
          void revalidate()
        }
      }
    }
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      const now = props.nowMs ?? Date.now()
      const boundaryKey =
        props.nowMs === undefined
          ? null
          : JSON.stringify([props.userId, props.workspaceId, props.nowMs])
      if (boundaryKey !== null && completedBoundary.current === boundaryKey)
        return
      if (
        boundaryKey !== null &&
        boundaryDeadline.current?.key !== boundaryKey
      ) {
        boundaryDeadline.current = {
          key: boundaryKey,
          deadline: performance.now() + 86_400_000 - (now % 86_400_000),
        }
      }
      const delay =
        boundaryKey === null
          ? 86_400_000 - (now % 86_400_000)
          : Math.max(
              0,
              (boundaryDeadline.current?.deadline ?? performance.now()) -
                performance.now(),
            )
      timer = setTimeout(() => {
        if (inFlight) {
          pendingBoundary = true
        } else {
          if (boundaryKey !== null) completedBoundary.current = boundaryKey
          void revalidate()
        }
        if (boundaryKey === null) schedule()
      }, delay)
    }
    setInvalid(false)
    const snapshotToday =
      props.nowMs === undefined
        ? props.today
        : new Date(props.nowMs).toISOString().slice(0, 10)
    refresh(snapshotToday, props.nowMs)
    schedule()
    const scopeKey = JSON.stringify([props.userId, props.workspaceId])
    if (props.nowMs !== undefined && hydratedScope.current !== scopeKey) {
      hydratedScope.current = scopeKey
      void revalidate()
    }
    const visible = () => {
      if (document.visibilityState === 'visible') void revalidate()
      schedule()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
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
        suppressionNowMs: snapshot.suppressionNow,
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
