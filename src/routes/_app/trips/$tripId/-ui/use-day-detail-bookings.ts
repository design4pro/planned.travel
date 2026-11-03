import * as React from 'react'
import { loadBookingDeskFn } from '#/server/fns/reservations'
import type { BookingRow } from '#/server/fns/reservations'
import type { PlanBoardPayload } from '../-server/plan'

interface ReaderGeneration {
  readonly key: string
}
interface BookingRead {
  readonly rows: ReadonlyArray<BookingRow>
  readonly loading: boolean
  readonly error: boolean
}

/** Owned by the mounted screen, never shared with another Trip or reader. */
export function useDayDetailBookings(
  payload: PlanBoardPayload,
  dayId: string | null,
  readerScope = JSON.stringify([payload.editable, payload.archived]),
) {
  const key = JSON.stringify([payload.tripId, readerScope])
  const generation = React.useRef<ReaderGeneration>({ key })
  const cache = React.useRef<{
    owner: ReaderGeneration
    board: PlanBoardPayload
    rows: ReadonlyArray<BookingRow>
  } | null>(null)
  const retryRequested = React.useRef(false)
  // Cut off old data during render, including A -> B -> A and closed details.
  if (generation.current.key !== key) {
    generation.current = { key }
    cache.current = null
    retryRequested.current = false
  }
  const owner = generation.current
  const [attempt, retry] = React.useReducer((n) => n + 1, 0)
  const [read, setRead] = React.useState<
    BookingRead & {
      owner: ReaderGeneration
      board: PlanBoardPayload
      dayId: string | null
    }
  >({
    owner,
    board: payload,
    dayId: null,
    rows: [],
    loading: true,
    error: false,
  })
  React.useEffect(() => {
    let current = true
    const publish = (next: BookingRead) =>
      setRead({ ...next, owner, board: payload, dayId })
    if (dayId === null) {
      retryRequested.current = false
      publish({ rows: [], loading: false, error: false })
      return
    }
    const known = cache.current?.owner === owner ? cache.current : null
    if (known?.board === payload && !retryRequested.current) {
      publish({ rows: known.rows, loading: false, error: false })
      return
    }
    retryRequested.current = false
    publish({ rows: known?.rows ?? [], loading: true, error: false })
    void loadBookingDeskFn({ data: { tripId: payload.tripId } })
      .then((result) => {
        if (!current || generation.current !== owner) return
        if (result.found === false) {
          cache.current = null
          publish({ rows: [], loading: false, error: true })
          return
        }
        cache.current = { owner, board: payload, rows: result.bookings }
        publish({ rows: result.bookings, loading: false, error: false })
      })
      .catch(() => {
        if (current && generation.current === owner)
          publish({ rows: known?.rows ?? [], loading: false, error: true })
      })
    return () => {
      current = false
    }
  }, [payload, dayId, attempt, owner])
  const current =
    read.owner === owner && read.board === payload && read.dayId === dayId
  return {
    rows: read.owner === owner ? read.rows : [],
    loading: dayId !== null && (!current || read.loading),
    error: current && read.error,
    retry: () => {
      if (generation.current !== owner) return
      retryRequested.current = true
      retry()
    },
  }
}
