import { useEffect, useState } from 'react'
import { selectReservationPrompt } from '../-lib/mascot-state'
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
    tripId: string
    startDate: string
  } | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let active = true
    let inFlight = false
    const refresh = (today: string) => {
      const now = Date.now()
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
    refresh(props.today)
    schedule()
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
    props.onRefresh,
  ])
  const select = (reservations: ReadonlyArray<Reservation>) =>
    snapshot && !hidden && !invalid
      ? selectReservationPrompt({
          today: snapshot.today,
          currentScope: {
            userId: props.userId,
            workspaceId: props.workspaceId,
          },
          dismissedScope: snapshot.scope,
          nowMs: snapshot.now,
          dismissed: snapshot.dismissed,
          trips: props.trips,
          reservations,
        })
      : null
  const retained = focused
    ? select(
        props.reservations.filter(
          (item) =>
            item.id === focused.id &&
            item.startDate === focused.startDate &&
            item.tripId === focused.tripId,
        ),
      )
    : null
  const prompt = focused ? retained : select(props.reservations)
  function dismiss() {
    if (!prompt || !snapshot) return
    const entries = dismissOccurrence(
      snapshot.dismissed,
      'reservation',
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
      onDismiss={dismiss}
      onPromptFocus={() => setFocused(prompt)}
      onPromptBlur={() => setFocused(null)}
    />
  )
}
