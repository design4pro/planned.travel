/**
 * The favourite — one person's bookmark on a trip they may read (PRD #104 decision 5).
 *
 * The row's existence *is* the star, so this module has three verbs and no update: setting writes
 * the caller's row if it is not already there, unsetting deletes it, and nothing else about the
 * trip moves. `trips.is_favourite` is the shape this replaces — a single boolean shared by every
 * member, recording nobody's choice — and it is deprecated in the schema rather than read here.
 *
 * **Every read goes back through {@link readableTrips}.** A bookmark is only ever created by
 * somebody who could read the trip, but readability can be taken away afterwards: a private trip a
 * member is removed from leaves their row behind. Counting or listing that row would put a trip
 * ADR 0007 has made invisible back into a pill count, which is the same leak as listing it. The
 * table is therefore where the choice is *written*, and `trips` is where it is *read from*.
 *
 * The dependency runs one way — this module imports `trips.ts`, never the other way about — which
 * is why the correlated predicate the trip list filters on, {@link favouritedTripFilter}, lives
 * there beside the read predicate it is ANDed with.
 */

import { eq } from 'drizzle-orm'
import { tripFavourites } from '#/server/db/schema'
import { allOf, createTenantRepository } from './base'
import { favouritedTripFilter, readableTrips, requireTrip } from './trips'
import type { SQL } from 'drizzle-orm'
import type { TenantScope } from './base'

export const tripFavouritesRepository = createTenantRepository(
  tripFavourites,
  'trip favourite',
)

/**
 * The acting user's own row on one trip.
 *
 * Always `scope.ctx.userId`, never a parameter: "unstar this for my colleague" is not a question a
 * tenant-scoped write may answer, and a `userId` argument is the seam through which it would be
 * asked.
 */
function ownRow(scope: TenantScope, tripId: string): SQL {
  return allOf(
    eq(tripFavourites.tripId, tripId),
    eq(tripFavourites.userId, scope.ctx.userId),
  )
}

/**
 * Stars or unstars a trip for the acting user.
 *
 * `requireTrip` and no role guard: the star is a reader's verb (PRD #104 decision 6) — it changes
 * nothing on the trip and nobody else can see it — but it names a trip id, so a caller who may not
 * see that trip is answered with `NotFoundError` and learns nothing.
 *
 * Idempotent in both directions, which is what a double click needs: setting twice leaves one row
 * (the read-then-insert here, backstopped by the unique index on `(trip_id, user_id)`), and
 * clearing a star that was never set is a no-op rather than a missing-row error.
 */
export async function setFavourite(
  scope: TenantScope,
  tripId: string,
  isFavourite: boolean,
): Promise<void> {
  await requireTrip(scope, tripId)
  const where = ownRow(scope, tripId)

  if (!isFavourite) {
    await tripFavouritesRepository.removeWhere(scope, where)
    return
  }
  if ((await tripFavouritesRepository.findOne(scope, where)) !== null) {
    return
  }
  await tripFavouritesRepository.insert(scope, {
    tripId,
    userId: scope.ctx.userId,
  })
}

/**
 * The ids of the trips the acting user has starred and may still read.
 *
 * Ids rather than rows because that is what the callers want: a trip list already holds the rows
 * and needs only to know which of them carry the reader's star.
 */
export async function listFavouriteTripIds(
  scope: TenantScope,
): Promise<Array<string>> {
  const rows = await readableTrips(scope).findMany({
    where: favouritedTripFilter(scope),
  })
  return rows.map((trip) => trip.id)
}

/** How many trips the acting user has starred — the trips index's Favourites figure. */
export async function countFavourites(scope: TenantScope): Promise<number> {
  return readableTrips(scope).count(favouritedTripFilter(scope))
}
