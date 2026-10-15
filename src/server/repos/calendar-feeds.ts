/**
 * The calendar read model: what a trip's `.ics` is built from.
 *
 * `readFeedSource` answers one question for `src/server/calendar/feed.ts` — the rows of the trips
 * the reader may open, narrowed to the columns a calendar may show. Two decisions are made here and
 * nowhere else:
 *
 * - **ADR 0007's read predicate decides which trips.** The trips are read first, through
 *   {@link readableTripFilter} under ADR 0002's tenant filter, and every content statement then
 *   filters on the ids that read returned, never on the ids the caller passed. A foreign or private
 *   trip contributes no row to any of the nine statements.
 * - **The projection decides which columns.** Every select names its columns. A confirmation number,
 *   a booking code, a seat, a price and a provider URL are not named, so they are never read and no
 *   later edit to the builder can emit them; the test captures the SQL to keep it that way.
 */

import { asc, inArray } from 'drizzle-orm'
import {
  dayAccommodations,
  dayAssignments,
  dayNotes,
  days,
  places,
  reservations,
  transportLegs,
  transports,
  trips,
} from '#/server/db/schema'
import { allOf, tenantFilter } from './base'
import { ID_FILTER_CHUNK, readableTripFilter } from './trips'
import type { FeedSource } from '#/server/calendar/feed'
import type { TenantScope } from './base'

/**
 * Which trips a calendar covers. One kind today — an explicit list; a later kind (every trip the
 * reader is on) is another variant, not another function.
 */
export type FeedSelection = {
  readonly kind: 'trips'
  readonly tripIds: ReadonlyArray<string>
}

const EMPTY_SOURCE: FeedSource = {
  trips: [],
  days: [],
  places: [],
  stops: [],
  dayNotes: [],
  stays: [],
  transports: [],
  legs: [],
  reservations: [],
}

/**
 * The calendar rows of each selected trip the acting user may read: one statement for the trips,
 * then eight in parallel for their content. Nothing is returned for a trip the reader cannot open,
 * and when none is readable the eight content statements are not issued at all.
 *
 * At most {@link ID_FILTER_CHUNK} trips, so no statement binds more parameters than D1 allows.
 */
export async function readFeedSource(
  scope: TenantScope,
  selection: FeedSelection,
): Promise<FeedSource> {
  if (selection.tripIds.length > ID_FILTER_CHUNK) {
    throw new RangeError(
      `A calendar covers at most ${ID_FILTER_CHUNK} trips, got ${selection.tripIds.length}`,
    )
  }
  if (selection.tripIds.length === 0) {
    return EMPTY_SOURCE
  }

  const tripRows = await scope.db
    .select({
      id: trips.id,
      title: trips.title,
      summary: trips.summary,
      startDate: trips.startDate,
      endDate: trips.endDate,
      updatedAt: trips.updatedAt,
    })
    .from(trips)
    .where(
      allOf(
        tenantFilter(scope, trips, inArray(trips.id, [...selection.tripIds])),
        readableTripFilter(scope),
      ),
    )
    .orderBy(asc(trips.id))
  if (tripRows.length === 0) {
    return EMPTY_SOURCE
  }
  const readableIds = tripRows.map((row) => row.id)

  const [
    dayRows,
    placeRows,
    stopRows,
    noteRows,
    stayRows,
    transportRows,
    legRows,
    reservationRows,
  ] = await Promise.all([
    scope.db
      .select({
        id: days.id,
        tripId: days.tripId,
        dayNumber: days.dayNumber,
        date: days.date,
        title: days.title,
        updatedAt: days.updatedAt,
      })
      .from(days)
      .where(tenantFilter(scope, days, inArray(days.tripId, readableIds)))
      .orderBy(asc(days.id)),
    scope.db
      .select({
        id: places.id,
        tripId: places.tripId,
        name: places.name,
        address: places.address,
        durationMinutes: places.durationMinutes,
        updatedAt: places.updatedAt,
      })
      .from(places)
      .where(tenantFilter(scope, places, inArray(places.tripId, readableIds)))
      .orderBy(asc(places.id)),
    scope.db
      .select({
        id: dayAssignments.id,
        tripId: dayAssignments.tripId,
        dayId: dayAssignments.dayId,
        placeId: dayAssignments.placeId,
        orderIndex: dayAssignments.orderIndex,
        startTime: dayAssignments.startTime,
        endTime: dayAssignments.endTime,
        durationMinutes: dayAssignments.durationMinutes,
        notes: dayAssignments.notes,
        updatedAt: dayAssignments.updatedAt,
      })
      .from(dayAssignments)
      .where(
        tenantFilter(
          scope,
          dayAssignments,
          inArray(dayAssignments.tripId, readableIds),
        ),
      )
      .orderBy(asc(dayAssignments.id)),
    scope.db
      .select({
        id: dayNotes.id,
        tripId: dayNotes.tripId,
        dayId: dayNotes.dayId,
        body: dayNotes.body,
        detail: dayNotes.detail,
        time: dayNotes.time,
        sortOrder: dayNotes.sortOrder,
        updatedAt: dayNotes.updatedAt,
      })
      .from(dayNotes)
      .where(
        tenantFilter(scope, dayNotes, inArray(dayNotes.tripId, readableIds)),
      )
      .orderBy(asc(dayNotes.id)),
    scope.db
      .select({
        id: dayAccommodations.id,
        tripId: dayAccommodations.tripId,
        startDayId: dayAccommodations.startDayId,
        endDayId: dayAccommodations.endDayId,
        reservationId: dayAccommodations.reservationId,
        name: dayAccommodations.name,
        address: dayAccommodations.address,
        checkInTime: dayAccommodations.checkInTime,
        checkOutTime: dayAccommodations.checkOutTime,
        updatedAt: dayAccommodations.updatedAt,
      })
      .from(dayAccommodations)
      .where(
        tenantFilter(
          scope,
          dayAccommodations,
          inArray(dayAccommodations.tripId, readableIds),
        ),
      )
      .orderBy(asc(dayAccommodations.id)),
    scope.db
      .select({
        id: transports.id,
        tripId: transports.tripId,
        dayId: transports.dayId,
        status: transports.status,
        title: transports.title,
        serviceNumber: transports.serviceNumber,
        departureName: transports.departureName,
        departureDate: transports.departureDate,
        departureTime: transports.departureTime,
        departureTimezone: transports.departureTimezone,
        arrivalDate: transports.arrivalDate,
        arrivalTime: transports.arrivalTime,
        arrivalTimezone: transports.arrivalTimezone,
        updatedAt: transports.updatedAt,
      })
      .from(transports)
      .where(
        tenantFilter(
          scope,
          transports,
          inArray(transports.tripId, readableIds),
        ),
      )
      .orderBy(asc(transports.id)),
    scope.db
      .select({
        id: transportLegs.id,
        tripId: transportLegs.tripId,
        transportId: transportLegs.transportId,
        position: transportLegs.position,
        fromName: transportLegs.fromName,
        fromTimezone: transportLegs.fromTimezone,
        toName: transportLegs.toName,
        toTimezone: transportLegs.toTimezone,
        serviceNumber: transportLegs.serviceNumber,
        departureDayId: transportLegs.departureDayId,
        departureDate: transportLegs.departureDate,
        departureTime: transportLegs.departureTime,
        arrivalDate: transportLegs.arrivalDate,
        arrivalTime: transportLegs.arrivalTime,
        updatedAt: transportLegs.updatedAt,
      })
      .from(transportLegs)
      .where(
        tenantFilter(
          scope,
          transportLegs,
          inArray(transportLegs.tripId, readableIds),
        ),
      )
      .orderBy(asc(transportLegs.id)),
    scope.db
      .select({
        id: reservations.id,
        tripId: reservations.tripId,
        assignmentId: reservations.assignmentId,
        transportId: reservations.transportId,
        status: reservations.status,
        title: reservations.title,
        location: reservations.location,
        startDate: reservations.startDate,
        startTime: reservations.startTime,
        endDate: reservations.endDate,
        endTime: reservations.endTime,
        updatedAt: reservations.updatedAt,
      })
      .from(reservations)
      .where(
        tenantFilter(
          scope,
          reservations,
          inArray(reservations.tripId, readableIds),
        ),
      )
      .orderBy(asc(reservations.id)),
  ])

  return {
    trips: tripRows,
    days: dayRows,
    places: placeRows,
    stops: stopRows,
    dayNotes: noteRows,
    stays: stayRows,
    transports: transportRows,
    legs: legRows,
    reservations: reservationRows,
  }
}
