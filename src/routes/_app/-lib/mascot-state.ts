import { isDismissed } from '#/lib/mascot-suppression'

type Reservation = {
  readonly id: string
  readonly tripId: string
  readonly status: string
  readonly startDate: string | null
}

export function projectMascotReservations(
  rows: ReadonlyArray<Reservation>,
): Array<Reservation> {
  return rows.map(({ id, tripId, status, startDate }) => ({
    id,
    tripId,
    status,
    startDate,
  }))
}

type ReadableTrip = { readonly id: string; readonly isArchived: boolean }

function ordinal(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const time = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === date
    ? time / 86_400_000
    : null
}

export function selectReservationPrompt(input: {
  readonly today: string
  readonly currentScope: { userId: string; workspaceId: string }
  readonly dismissedScope: { userId: string; workspaceId: string }
  readonly trips: ReadonlyArray<ReadableTrip>
  readonly reservations: ReadonlyArray<Reservation>
  readonly dismissed: Parameters<typeof isDismissed>[0]
  readonly nowMs: number
}): { id: string; tripId: string; startDate: string } | null {
  const today = ordinal(input.today)
  if (today === null) return null
  const readable = new Set(
    input.trips.filter((trip) => !trip.isArchived).map((trip) => trip.id),
  )
  const sameScope =
    input.currentScope.userId === input.dismissedScope.userId &&
    input.currentScope.workspaceId === input.dismissedScope.workspaceId
  for (const trip of input.trips) if (trip.isArchived) readable.delete(trip.id)
  const candidates = input.reservations.flatMap((reservation) => {
    if (
      reservation.status !== 'confirmed' ||
      !readable.has(reservation.tripId) ||
      !reservation.startDate
    )
      return []
    if (
      sameScope &&
      isDismissed(
        input.dismissed,
        'reservation',
        reservation.id,
        reservation.startDate,
        input.nowMs,
      )
    )
      return []
    const day = ordinal(reservation.startDate)
    if (day === null || day < today || day > today + 7) return []
    return [
      {
        id: reservation.id,
        tripId: reservation.tripId,
        startDate: reservation.startDate,
      },
    ]
  })
  candidates.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1
    if (a.id === b.id) return 0
    return a.id < b.id ? -1 : 1
  })
  return candidates[0] ?? null
}

export function mascotBand(input: {
  today: string
  startDate: string | null
  endDate: string | null
}): {
  band: 'settled' | 'eager' | 'countdown' | 'travelling' | 'drifting'
  days: number | null
} {
  const today = ordinal(input.today)
  const start = input.startDate === null ? null : ordinal(input.startDate)
  const end = input.endDate === null ? null : ordinal(input.endDate)
  if (
    today === null ||
    start === null ||
    (input.endDate !== null && end === null) ||
    (end !== null && (end < start || today > end))
  )
    return { band: 'drifting', days: null }
  const days = start - today
  if (days <= 0) return { band: 'travelling', days: null }
  if (days <= 7) return { band: 'countdown', days }
  if (days <= 30) return { band: 'eager', days: null }
  return { band: 'settled', days: null }
}
