import type { PlannerDay } from '#/components/planner'
import type { BookingRow } from '#/server/fns/reservations'
import type { PlanBoardDay } from '../-server/plan'

/** Exact trip-local relationships; chronology and Note rendering stay owned by the board. */
export function dayDetailModel(
  day: PlanBoardDay,
  planner: PlannerDay,
  days: ReadonlyArray<PlanBoardDay>,
  bookings: ReadonlyArray<BookingRow>,
) {
  const starts = new Map(days.map((d) => [d.dayId, d.dayNumber]))
  const assignments = new Set(day.stops.map((s) => s.assignmentId))
  const reservationIds = new Set(
    day.stays.map((s) => s.reservationId).filter((id) => id !== null),
  )
  const byId = new Map(bookings.map((row) => [row.id, row]))
  const stays = [...planner.stays]
    .sort(
      (a, b) =>
        (starts.get(a.startDayId) ?? Infinity) -
          (starts.get(b.startDayId) ?? Infinity) || a.id.localeCompare(b.id),
    )
    .map((stay) => ({
      ...stay,
      confirmation:
        (stay.reservationId === null
          ? null
          : byId.get(stay.reservationId)?.confirmationNumber?.trim()) || null,
    }))
  return {
    day,
    stays,
    notes: planner.items.flatMap((item) =>
      item.kind === 'note' ? [item.note] : [],
    ),
    reservations: [...byId.values()].filter(
      (row) =>
        row.dayId === day.dayId ||
        (row.assignmentId !== null && assignments.has(row.assignmentId)) ||
        reservationIds.has(row.id),
    ),
  }
}

export type DayDetailModel = ReturnType<typeof dayDetailModel>
