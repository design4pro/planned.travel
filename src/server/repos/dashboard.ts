/**
 * The dashboard read.
 *
 * Every screen in the product is served by its own module; the dashboard is the one screen that spans
 * all of them, so it gets a composition module rather than a table of its own. It mostly fans out to
 * the scoped queries the other repositories already expose and awaits them together, which keeps the
 * dashboard to a single round of parallel reads.
 */

import { count, eq, inArray } from 'drizzle-orm'
import { bucketListItems, places, reservations, visitedCountries } from '#/server/db/schema'
import { bucketListRepository, visitedCountriesRepository } from './atlas'
import { tenantFilter } from './base'
import { getStorageUsage } from './files'
import { countMembers } from './members'
import { countUnread } from './notifications'
import { placesRepository } from './places'
import { listUpcomingReservations, reservationsRepository } from './reservations'
import { countTripsByStatus, listTripsForUser, listUpcomingTrips } from './trips'
import type { Reservation, Trip } from '#/server/db/types'
import type { TenantScope } from './base'
import type { TripStatusCounts } from './trips'

export interface DashboardSummary {
  readonly trips: TripStatusCounts
  readonly upcomingTrips: ReadonlyArray<Trip>
  readonly myTrips: ReadonlyArray<Trip>
  readonly upcomingReservations: ReadonlyArray<Reservation>
  readonly counts: {
    readonly places: number
    readonly reservations: number
    readonly members: number
    readonly files: number
    readonly unreadNotifications: number
    readonly visitedCountries: number
    readonly bucketList: number
  }
  readonly storageBytes: number
}

/**
 * Everything above the fold on the dashboard for one traveller, in a single parallel fan-out.
 *
 * `today` is a parameter rather than `new Date()` so the caller can pass the traveller's own timezone
 * and so tests are not tied to the clock.
 */
export async function getDashboardSummary(
  scope: TenantScope,
  options: { readonly userId?: string; readonly today?: string } = {},
): Promise<DashboardSummary> {
  const userId = options.userId ?? scope.ctx.userId
  const today = options.today ?? new Date().toISOString().slice(0, 10)

  const [
    trips,
    upcomingTrips,
    myTrips,
    upcomingReservations,
    placeCount,
    reservationCount,
    memberCount,
    unreadNotifications,
    visitedCountryCount,
    bucketListCount,
    storage,
  ] = await Promise.all([
    countTripsByStatus(scope),
    listUpcomingTrips(scope, { today, limit: 4 }),
    listTripsForUser(scope, userId, { limit: 6 }),
    listUpcomingReservations(scope, { from: today, limit: 5 }),
    placesRepository.count(scope),
    reservationsRepository.count(scope, eq(reservations.status, 'confirmed')),
    countMembers(scope),
    countUnread(scope, userId),
    visitedCountriesRepository.count(scope, eq(visitedCountries.userId, userId)),
    bucketListRepository.count(scope, eq(bucketListItems.userId, userId)),
    getStorageUsage(scope),
  ])

  return {
    trips,
    upcomingTrips,
    myTrips,
    upcomingReservations,
    counts: {
      places: placeCount,
      reservations: reservationCount,
      members: memberCount,
      files: storage.fileCount,
      unreadNotifications,
      visitedCountries: visitedCountryCount,
      bucketList: bucketListCount,
    },
    storageBytes: storage.bytes,
  }
}

/** Place counts for a set of trips, keyed by trip id — the counter on each dashboard trip card. */
export async function countPlacesPerTrip(
  scope: TenantScope,
  tripIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (tripIds.length === 0) {
    return counts
  }
  const rows = await scope.db
    .select({ tripId: places.tripId, value: count() })
    .from(places)
    .where(tenantFilter(scope, places, inArray(places.tripId, [...tripIds])))
    .groupBy(places.tripId)

  for (const row of rows) {
    counts.set(row.tripId, row.value)
  }
  return counts
}
