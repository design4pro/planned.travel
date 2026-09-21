/**
 * The trip-card read model — the per-reader facts a trip tile carries beyond its row.
 *
 * The trip index and the dashboard decorate a page of up to a hundred trips with four figures: the
 * place count, the people count (members plus guests, `01-S7`), the reader's own role and the
 * reader's own star. They are read here, for the whole page, in one function, so the two decisions
 * every such read has to make are made once:
 *
 * - **D1's bound-parameter ceiling.** Every statement binds one parameter per id beside the tenant
 *   and read predicates, so the ids are read {@link ID_FILTER_CHUNK} at a time and a full page never
 *   becomes a statement D1 refuses.
 * - **ADR 0007's read predicate.** Every statement narrows the ids through
 *   {@link readableTripFilter} inside SQL, under ADR 0002's tenant filter, so a foreign id and a
 *   private trip the reader is not on get **no entry at all** — for every figure alike, and not a
 *   zero that would say such a trip exists.
 *
 * The next per-tile figure belongs here too, and inherits both.
 */

import { count, eq, inArray, sql } from 'drizzle-orm'
import { places, tripGuests, tripMembers, trips } from '#/server/db/schema'
import { tenantFilter } from './base'
import {
  ID_FILTER_CHUNK,
  favouritedTripFilter,
  readableTripFilter,
} from './trips'
import type { TenantScope } from './base'
import type { TripMember } from '#/server/db/types'

/** What one trip tile shows about the reader's relation to the trip, beyond the trip row itself. */
export interface TripCardFacts {
  readonly placeCount: number
  readonly peopleCount: number
  /** The reader's own role, or `null` on an organization-visible trip they are not a member of. */
  readonly role: TripMember['role'] | null
  /** Whether the reader starred it — their own star, never another member's. */
  readonly isFavourite: boolean
}

/**
 * The card facts of each given trip the acting user may read, keyed by trip id.
 *
 * Five statements per {@link ID_FILTER_CHUNK} ids, never one per card. A trip id sits in
 * exactly one chunk, so the chunks' answers never overlap and simply merge.
 */
export async function readTripCardFacts(
  scope: TenantScope,
  tripIds: ReadonlyArray<string>,
): Promise<Map<string, TripCardFacts>> {
  const chunks: Array<ReadonlyArray<string>> = []
  for (let index = 0; index < tripIds.length; index += ID_FILTER_CHUNK) {
    chunks.push(tripIds.slice(index, index + ID_FILTER_CHUNK))
  }
  const answers = await Promise.all(
    chunks.map((chunk) => readChunk(scope, chunk)),
  )
  return new Map(answers.flatMap((answer) => [...answer]))
}

/** One chunk's statements, each over the chunk's ids the reader may read. */
async function readChunk(
  scope: TenantScope,
  tripIds: ReadonlyArray<string>,
): Promise<Map<string, TripCardFacts>> {
  const readable = tenantFilter(
    scope,
    trips,
    inArray(trips.id, [...tripIds]),
    readableTripFilter(scope),
  )
  const readableIds = scope.db
    .select({ id: trips.id })
    .from(trips)
    .where(readable)

  const [readableRows, placeCounts, memberCounts, guestCounts, roles] =
    await Promise.all([
      // The readable ids themselves, which is what decides who gets an entry, and the star beside
      // them — bounded to this chunk rather than read for every trip the reader ever starred.
      scope.db
        .select({
          id: trips.id,
          isFavourite: sql<boolean>`${favouritedTripFilter(scope)}`.mapWith(
            Boolean,
          ),
        })
        .from(trips)
        .where(readable),
      scope.db
        .select({ tripId: places.tripId, value: count() })
        .from(places)
        .where(tenantFilter(scope, places, inArray(places.tripId, readableIds)))
        .groupBy(places.tripId),
      scope.db
        .select({ tripId: tripMembers.tripId, value: count() })
        .from(tripMembers)
        .where(
          tenantFilter(
            scope,
            tripMembers,
            inArray(tripMembers.tripId, readableIds),
          ),
        )
        .groupBy(tripMembers.tripId),
      scope.db
        .select({ tripId: tripGuests.tripId, value: count() })
        .from(tripGuests)
        .where(
          tenantFilter(
            scope,
            tripGuests,
            inArray(tripGuests.tripId, readableIds),
          ),
        )
        .groupBy(tripGuests.tripId),
      scope.db
        .select({ tripId: tripMembers.tripId, role: tripMembers.role })
        .from(tripMembers)
        .where(
          tenantFilter(
            scope,
            tripMembers,
            inArray(tripMembers.tripId, readableIds),
            eq(tripMembers.userId, scope.ctx.userId),
          ),
        ),
    ])

  const valueOf = (rows: ReadonlyArray<{ tripId: string; value: number }>) =>
    new Map(rows.map((row) => [row.tripId, row.value]))
  const placesOn = valueOf(placeCounts)
  const membersOn = valueOf(memberCounts)
  const guestsOn = valueOf(guestCounts)
  const roleOn = new Map(roles.map((row) => [row.tripId, row.role]))

  return new Map(
    readableRows.map((trip): [string, TripCardFacts] => [
      trip.id,
      {
        placeCount: placesOn.get(trip.id) ?? 0,
        peopleCount:
          (membersOn.get(trip.id) ?? 0) + (guestsOn.get(trip.id) ?? 0),
        role: roleOn.get(trip.id) ?? null,
        isFavourite: trip.isFavourite,
      },
    ]),
  )
}
