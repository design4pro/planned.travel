/**
 * Unscoped exception: findLiveFeedByDigestUnscoped takes Database for a digest point lookup.
 * Its sole production caller is src/server/public/calendar-feed.ts. It returns coordinates only,
 * never content, credentials or the digest. Every subsequent read uses the resolved tenant scope.
 */
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

import { asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  calendarFeeds,
  tripMembers,
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
import { allOf, createScope, tenantFilter } from './base'
import { member, user, ORGANIZATION_ROLES } from '#/server/db/auth-schema'
import { hashFeedSecret, mintFeedSecret } from '#/server/calendar/secret'
import { newId } from '#/server/db/schema'
import { NotFoundError } from './context'
import type { Database } from '#/server/db/types'
import type { SQL } from 'drizzle-orm'
import { ID_FILTER_CHUNK, readableTripFilter, requireTrip } from './trips'
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

/** Branded coordinates, constructible only by the digest resolver in this module. */
declare const resolvedFeed: unique symbol
type FeedCoordinates = {
  readonly id: string
  readonly organizationId: string
  readonly userId: string
  readonly scope: string
  readonly tripId: string | null
  readonly lastServedAt: Date | null
}

export type ResolvedFeed = FeedCoordinates & { readonly [resolvedFeed]: true }

function armedWithin(createdAt: SQL | typeof member.createdAt | typeof tripMembers.createdAt): SQL {
  return sql`coalesce(${calendarFeeds.rotatedAt}, ${calendarFeeds.createdAt}) >= ${createdAt}`
}

/** The single credential-to-tenant lookup; no tenant content or credential leaves it. */
export async function findLiveFeedByDigestUnscoped(db: Database, digest: string): Promise<ResolvedFeed | null> {
  const [row] = await db.select({ id: calendarFeeds.id, organizationId: calendarFeeds.organizationId, userId: calendarFeeds.userId, scope: calendarFeeds.scope, tripId: calendarFeeds.tripId, lastServedAt: calendarFeeds.lastServedAt })
    .from(calendarFeeds).where(allOf(eq(calendarFeeds.tokenDigest, digest), isNull(calendarFeeds.revokedAt))).limit(1)
  // The resolver alone produces the brand; it does not change the wire projection.
  return row ? row as ResolvedFeed : null
}

/** Resolve the current membership, arming instant and ban before granting any content scope. */
export async function openFeedScope(db: Database, found: ResolvedFeed, now = new Date()): Promise<TenantScope | null> {
  return liveFeedScope(db, found, now)
}

async function liveFeedScope(db: Database, found: FeedCoordinates, now = new Date()): Promise<TenantScope | null> {
  const provisional = createScope(db, { organizationId: found.organizationId, userId: found.userId, role: 'member' })
  const [row] = await db.select({ role: member.role }).from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .innerJoin(calendarFeeds, allOf(eq(calendarFeeds.id, found.id), tenantFilter(provisional, calendarFeeds), eq(calendarFeeds.userId, member.userId), isNull(calendarFeeds.revokedAt)))
    .where(allOf(tenantFilter(provisional, member, eq(member.userId, found.userId)), armedWithin(member.createdAt), sql`not (coalesce(${user.banned}, 0) = 1 and (${user.banExpires} is null or ${user.banExpires} > ${now.getTime()}))`)).limit(1)
  if (!row || !ORGANIZATION_ROLES.some((role) => role === row.role)) return null
  return createScope(db, { organizationId: found.organizationId, userId: found.userId, role: row.role })
}

/** The owner must still be on the trip within the membership that armed this link. */
export async function feedTripAccess(scope: TenantScope, found: ResolvedFeed): Promise<boolean> {
  return tripAccess(scope, found)
}

async function tripAccess(scope: TenantScope, found: FeedCoordinates): Promise<boolean> {
  if (found.organizationId !== scope.ctx.organizationId || found.userId !== scope.ctx.userId || found.tripId === null) return false
  const rows = await scope.db.select({ id: tripMembers.id }).from(tripMembers)
    .innerJoin(calendarFeeds, allOf(tenantFilter(scope, calendarFeeds, eq(calendarFeeds.id, found.id)), isNull(calendarFeeds.revokedAt)))
    .where(allOf(tenantFilter(scope, tripMembers, eq(tripMembers.tripId, found.tripId), eq(tripMembers.userId, found.userId)), armedWithin(tripMembers.createdAt))).limit(1)
  return rows.length !== 0
}

async function ownFeed(scope: TenantScope, feedId: string) {
  const [row] = await scope.db.select({ id: calendarFeeds.id, organizationId: calendarFeeds.organizationId, userId: calendarFeeds.userId, scope: calendarFeeds.scope, tripId: calendarFeeds.tripId, lastServedAt: calendarFeeds.lastServedAt, revokedAt: calendarFeeds.revokedAt }).from(calendarFeeds)
    .where(tenantFilter(scope, calendarFeeds, eq(calendarFeeds.id, feedId), eq(calendarFeeds.userId, scope.ctx.userId))).limit(1)
  if (!row) throw new NotFoundError('Calendar feed', feedId)
  return row
}

export async function getFeed(scope: TenantScope, feedId: string) {
  const row = await ownFeed(scope, feedId)
  // Management has already resolved the row through both the tenant and owner filter.
  const liveScope = row.revokedAt === null ? await liveFeedScope(scope.db, row) : null
  const on = liveScope !== null && row.scope === 'trip' && await tripAccess(liveScope, row)
  return { id: row.id, tripId: row.tripId, on, lastServedAt: row.lastServedAt }
}

export async function listFeeds(scope: TenantScope) {
  const rows = await scope.db.select({ id: calendarFeeds.id }).from(calendarFeeds).where(tenantFilter(scope, calendarFeeds, eq(calendarFeeds.userId, scope.ctx.userId)))
  return Promise.all(rows.map((row) => getFeed(scope, row.id)))
}

export async function enableFeed(scope: TenantScope, input: { scope: 'trip'; tripId: string }) {
  const trip = await requireTrip(scope, input.tripId)
  const [membership] = await scope.db.select({ id: tripMembers.id }).from(tripMembers).where(tenantFilter(scope, tripMembers, eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, scope.ctx.userId))).limit(1)
  if (!membership) throw new NotFoundError('Trip', input.tripId)
  const secret = mintFeedSecret()
  const now = new Date()
  const tokenDigest = await hashFeedSecret(secret)
  const [row] = await scope.db.insert(calendarFeeds).values({ id: newId(), organizationId: scope.ctx.organizationId, userId: scope.ctx.userId, tripId: input.tripId, scope: 'trip', tokenDigest, rotatedAt: now })
    .onConflictDoUpdate({ target: [calendarFeeds.organizationId, calendarFeeds.userId, calendarFeeds.tripId], targetWhere: sql`${calendarFeeds.scope} = 'trip'`, set: { tokenDigest, revokedAt: null, rotatedAt: now, lastServedAt: null, updatedAt: now } }).returning({ id: calendarFeeds.id })
  if (!row) throw new Error('Feed insert returned no row')
  return { feedId: row.id, secret, tripTitle: trip.title }
}

export async function revokeFeed(scope: TenantScope, feedId: string): Promise<void> {
  await ownFeed(scope, feedId)
  await scope.db.update(calendarFeeds).set({ revokedAt: new Date() }).where(tenantFilter(scope, calendarFeeds, eq(calendarFeeds.id, feedId), eq(calendarFeeds.userId, scope.ctx.userId)))
}

/** Stamped at most hourly by the handler, never a per-poll write. */
export async function touchFeed(scope: TenantScope, feedId: string, now: Date): Promise<void> {
  const rows = await scope.db.update(calendarFeeds).set({ lastServedAt: now }).where(tenantFilter(scope, calendarFeeds, eq(calendarFeeds.id, feedId), eq(calendarFeeds.userId, scope.ctx.userId), isNull(calendarFeeds.revokedAt), sql`coalesce(${calendarFeeds.rotatedAt}, ${calendarFeeds.createdAt}) <= ${now.getTime()}`)).returning({ id: calendarFeeds.id })
  if (rows.length === 0) throw new NotFoundError('Calendar feed', feedId)
}
