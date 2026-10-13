/**
 * The weather cache and allowance the demo workspace opens with, so the planner's weather journey
 * (`e2e/trip-weather.spec.ts`) is deterministic without a stubbed provider.
 *
 * The journey must meet every state a day can be in. Calling MET Norway and NASA POWER from a test
 * would make it depend on two services and on the day it runs, and a stub inside the Worker would
 * be a branch that exists only for tests. So the seed does what the product does on a warm cache:
 * it writes the entries the policy reads (`wx:v2:...`, in `src/server/weather/weather.ts`) and
 * spends the demo workspace's whole monthly allowance, so a day nothing was written for is
 * `unavailable` through the real ceiling path and no outbound call is ever attempted.
 *
 * It is keyed on the fixture, not on a clock. The entries are for the coordinates the dataset's own
 * stops resolve to, and for the days around `SEED_ANCHOR_DAY`, which the e2e suite pins the Worker
 * to. Against the pinned day the Lisbon trip, which runs from three days before it to three days
 * after, reads as:
 *
 * | Day (date)    | Where          | What the planner shows                                   |
 * | ------------- | -------------- | -------------------------------------------------------- |
 * | 1 (day -3)    | the airport    | `recorded`, from the entry below                         |
 * | 2, 3          | Alfama, market | `not-yet-recorded`: inside the provider's publication lag |
 * | 4 (today), 5  | Belém, LX      | `forecast`, from the entry below                         |
 * | 6             | Cascais        | `unavailable`: no entry, and the allowance is spent      |
 * | 7             | no stop        | nothing: a day with no location asks for nothing         |
 *
 * and the first day of the Tokyo trip, which is weeks past the forecast window, is an `estimate`.
 * The other Tokyo days have no entry and read `unavailable`, which is also what they should show.
 *
 * Nothing here lives in the deployed Worker: the seed endpoint is behind `import.meta.env.DEV`.
 * The writes carry no TTL, because a KV expiry runs on the real clock and the fixture does not:
 * an entry that lapsed in a month would turn the journey red on a morning nobody touched it.
 */

import { PLAN_RATE_CEILINGS } from '#/server/billing/limits'
import { rateMeterKey, rateWindowOf } from '#/server/metering/rate'
import {
  estimateCacheKey,
  forecastCacheKey,
  recordedCacheKey,
} from '#/server/weather/weather'
import {
  SEED_ANCHOR_INSTANT,
  flagshipTrip,
  instantOn,
  lisbonTrip,
  subscription,
} from './dataset'

import type { SeedTrip } from './types'

/** The slice of Workers KV the seed uses. A real `KVNamespace` satisfies it; so does a map. */
export interface WeatherSeedStore {
  readonly put: (key: string, value: string) => Promise<void>
}

/**
 * When a seeded forecast stops being fresh. Far off on purpose: freshness is read against the
 * pinned clock in a journey and the wall clock everywhere else, and either way the entry must be
 * served and never refetched.
 */
const SEEDED_FRESH_UNTIL = '2099-01-01T00:00:00.000Z'

const MS_PER_DAY = 86_400_000

/** The calendar date of a trip's `dayNumber`, counted from its start date. */
function dateOfDay(trip: SeedTrip, dayNumber: number): string {
  if (trip.startDate === undefined) {
    throw new TypeError(`weather seed: ${trip.slug} has no start date`)
  }
  const start = Date.parse(`${trip.startDate}T00:00:00.000Z`)
  return new Date(start + (dayNumber - 1) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

/** The point the planner reads a day at: the first stop of the day that has a coordinate. */
function pointOfDay(
  trip: SeedTrip,
  dayNumber: number,
): { readonly lat: number; readonly lng: number } {
  const stop = trip.stops.find((candidate) => candidate.dayNumber === dayNumber)
  const place = trip.places.find(
    (candidate) => candidate.key === stop?.placeKey,
  )
  if (place === undefined) {
    throw new TypeError(
      `weather seed: ${trip.slug} day ${String(dayNumber)} has no stop with a place`,
    )
  }
  return { lat: place.lat, lng: place.lng }
}

/** The four steps a day carries in the long range of MET's compact product, at 00, 06, 12, 18 UTC. */
const STEP_HOURS = ['00:00', '06:00', '12:00', '18:00'] as const
const STEP_SKY = ['fair', 'fair', 'partlycloudy', 'cloudy'] as const
const STEP_TEMPERATURE = [17, 19, 27, 24] as const

/**
 * A forecast from the anchor day to three days after it, as the cache stores one.
 *
 * It ends on `day(3)`, so the last date the policy counts as covered in full is `day(2)`; a place
 * read from this entry has its forecast for today and the two days after.
 */
function forecastEntry(warmerBy: number): string {
  const series = [0, 1, 2, 3].flatMap((offset) =>
    STEP_HOURS.map((hour, index) => ({
      time: instantOn(offset, hour).toISOString(),
      tempC: STEP_TEMPERATURE[index] + warmerBy,
      symbol: STEP_SKY[index],
      windMs: 3.4,
      precipitationMm: 0,
      precipitationProbability: null,
    })),
  )
  return JSON.stringify({
    v: 2,
    fetchedAt: SEED_ANCHOR_INSTANT.toISOString(),
    expires: SEEDED_FRESH_UNTIL,
    lastModified: null,
    series,
  })
}

const RECORDED_DAY = {
  tempMinC: 18.2,
  tempMaxC: 28.4,
  precipitationMm: 0,
  windMs: 3.1,
} as const

/** Tokyo's long-term monthly means, January first. October is the month the trip falls in. */
const TOKYO_CLIMATE = [
  [2.6, 10.1, 3.9],
  [3.3, 10.9, 4.3],
  [6.4, 14.1, 4.8],
  [11.5, 19.2, 5.0],
  [16.2, 23.4, 5.1],
  [19.9, 26.0, 6.3],
  [23.8, 29.9, 4.6],
  [24.9, 31.1, 4.4],
  [21.5, 27.2, 7.6],
  [15.9, 21.5, 6.2],
  [10.2, 17.0, 3.8],
  [5.1, 12.4, 3.2],
].map(([tempMinC, tempMaxC, precipitationMm]) => ({
  tempMinC,
  tempMaxC,
  precipitationMm,
}))

/** What the seed wrote, for the report and for the test. */
export interface WeatherSeedReport {
  readonly entries: number
  /** The month the allowance was spent in, which is the fixture's and not the machine's. */
  readonly allowanceWindow: string
  readonly allowance: number
}

/**
 * Writes the entries above and spends the demo workspace's weather allowance for the fixture month.
 *
 * Idempotent: every key is overwritten with the same value, so a warm re-seed that writes no rows
 * still restores a store somebody cleared. The allowance is per organization and a rebuild mints a
 * new organization, which is why it is written here, after the seed, with the id the seed returned.
 */
export async function seedWeatherCache(
  store: WeatherSeedStore,
  organizationId: string,
): Promise<WeatherSeedReport> {
  const recordedPoint = pointOfDay(lisbonTrip, 1)
  const writes: Array<readonly [string, string]> = [
    [
      recordedCacheKey(
        recordedPoint.lat,
        recordedPoint.lng,
        dateOfDay(lisbonTrip, 1),
      ),
      JSON.stringify({
        v: 2,
        fetchedAt: SEED_ANCHOR_INSTANT.toISOString(),
        day: RECORDED_DAY,
      }),
    ],
  ]
  for (const [dayNumber, warmerBy] of [
    [4, 0],
    [5, 1],
  ] as const) {
    const point = pointOfDay(lisbonTrip, dayNumber)
    writes.push([
      forecastCacheKey(point.lat, point.lng),
      forecastEntry(warmerBy),
    ])
  }
  const estimatePoint = pointOfDay(flagshipTrip, 1)
  writes.push([
    estimateCacheKey(estimatePoint.lat, estimatePoint.lng),
    JSON.stringify({
      v: 2,
      fetchedAt: SEED_ANCHOR_INSTANT.toISOString(),
      months: TOKYO_CLIMATE,
    }),
  ])

  const allowance =
    PLAN_RATE_CEILINGS[subscription.planId].weather_lookups_per_month
  const allowanceWindow = rateWindowOf(SEED_ANCHOR_INSTANT)
  writes.push([
    rateMeterKey('weather_lookups_per_month', organizationId, allowanceWindow),
    String(allowance),
  ])

  await Promise.all(writes.map(([key, value]) => store.put(key, value)))
  return { entries: writes.length, allowanceWindow, allowance }
}
