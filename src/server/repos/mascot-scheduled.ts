import { and, asc, eq, gte, lte, ne, sql } from 'drizzle-orm'
import {
  dayAssignments,
  days,
  places,
  reservations,
  trips,
} from '#/server/db/schema'
import { tenantFilter } from './base'
import { readableTripFilter } from './trips'
import type { TenantScope } from './base'

export async function listMascotScheduled(scope: TenantScope, today: string) {
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 7)
  const through = end.toISOString().slice(0, 10)
  const tripFilter = tenantFilter(
    scope,
    trips,
    eq(trips.isArchived, false),
    readableTripFilter(scope),
  )
  const dateFilter = (
    column: typeof reservations.startDate | typeof days.date,
  ) =>
    and(
      gte(column, today),
      lte(column, through),
      sql`date(${column}, '+0 days') = ${column}`,
    )
  const bookings = await scope.db
    .select({
      id: reservations.id,
      tripId: reservations.tripId,
      occurrence: reservations.startDate,
    })
    .from(reservations)
    .innerJoin(trips, and(eq(trips.id, reservations.tripId), tripFilter))
    .where(
      tenantFilter(
        scope,
        reservations,
        eq(reservations.status, 'confirmed'),
        dateFilter(reservations.startDate),
      ),
    )
    .orderBy(asc(reservations.startDate), asc(reservations.id))
    .limit(50)
  const events = await scope.db
    .select({
      id: dayAssignments.id,
      tripId: dayAssignments.tripId,
      occurrence: days.date,
    })
    .from(dayAssignments)
    .innerJoin(trips, and(eq(trips.id, dayAssignments.tripId), tripFilter))
    .innerJoin(
      days,
      and(
        eq(days.id, dayAssignments.dayId),
        eq(days.tripId, dayAssignments.tripId),
        tenantFilter(scope, days),
      ),
    )
    .innerJoin(
      places,
      and(
        eq(places.id, dayAssignments.placeId),
        eq(places.tripId, dayAssignments.tripId),
        tenantFilter(scope, places),
      ),
    )
    .where(
      tenantFilter(
        scope,
        dayAssignments,
        ne(dayAssignments.reservationStatus, 'cancelled'),
        ne(dayAssignments.reservationStatus, 'completed'),
        dateFilter(days.date),
      ),
    )
    .orderBy(asc(days.date), asc(dayAssignments.id))
    .limit(50)
  return [
    ...bookings.map((row) => ({ ...row, source: 'reservation' as const })),
    ...events.map((row) => ({ ...row, source: 'event' as const })),
  ]
    .sort((a, b) => {
      const left = a.occurrence ?? ''
      const right = b.occurrence ?? ''
      if (left !== right) return left < right ? -1 : 1
      if (a.source !== b.source) return a.source < b.source ? -1 : 1
      if (a.id === b.id) return 0
      return a.id < b.id ? -1 : 1
    })
    .slice(0, 50)
}
