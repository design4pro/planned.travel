/**
 * The zone a trip is read in when it has none of its own.
 *
 * `trips.timezone` is written by the dev seeds only, so a trip a person made in the app has none,
 * and its weather days would be bucketed in UTC with no sunrise or sunset to show. This module
 * derives one **at read time and stores nothing**: the PDF export, booking import, collab and
 * export-document readers still read the column, so a value written here would change how they
 * read a time, and a backfill is a `drizzle/` change.
 *
 * The zone is the one of the airport nearest to the first located day of the whole trip (not of
 * the forecast window, so it does not drift as the dates pass), and only when every one of these
 * holds, else there is none and the caller keeps its UTC bucketing and shows no sun:
 *
 * - an airport lies within {@link NEAREST_AIRPORT_RADIUS_KM};
 * - that airport has a zone. The catalogue zones an airport only when its country has exactly one
 *   zone, so the nearest airport of *any* kind is taken rather than the nearest zoned one, which
 *   is what stops a place near a border from taking the neighbouring country's clock;
 * - the place's country code, when it has one, is the airport's (a place made in the planner records
 *   none, so for it the guard is the nearest-of-any-kind rule alone, and a place within 100 km of
 *   a neighbour's airport can take its clock, #1498);
 * - `Intl` accepts the name.
 *
 * Trips in a country with several zones therefore get no derived zone (#1498).
 */

import { resolveTimeZone } from '#/lib/time'
import { findNearestAirport } from '#/server/catalog/airports'

import type { Database } from '#/server/db/types'
import type { DayLocation } from '#/server/repos'

export async function deriveTripZone(
  db: Database,
  locations: ReadonlyArray<DayLocation>,
): Promise<string | null> {
  // No dated, located day means no weather query to bucket or to give sun times, so the catalogue
  // is not read at all (a plan with only undated days refetches on every edit).
  if (!locations.some((day) => day.date !== null && day.location !== null)) {
    return null
  }
  const first = locations.find((day) => day.location !== null)
  const point = first?.location ?? null
  if (first === undefined || point === null) return null

  const airport = await findNearestAirport(db, point)
  if (airport === null || airport.timezone === null) return null

  const placeCountry = first.countryCode?.toUpperCase() ?? null
  if (
    placeCountry !== null &&
    placeCountry !== airport.countryCode?.toUpperCase()
  ) {
    return null
  }

  return resolveTimeZone(airport.timezone) === airport.timezone
    ? airport.timezone
    : null
}
