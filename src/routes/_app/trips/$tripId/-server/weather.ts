/**
 * The planner's weather read: a forecast badge for each dated day with a location.
 *
 * One batched read for the whole trip, so a plan with fourteen days costs one request and the
 * policy behind it can share a single provider call between days that are spent in the same place.
 * It authorises **before** it spends: the subscription row, the cache and the allowance are reached
 * only for a caller who may read the trip, and a private trip the caller is not on is not-found
 * before any day or place is read.
 *
 * A provider that fails, times out, answers nonsense or is out of allowance is a result, not an
 * error. Every one of those leaves the reader with a day marked `unavailable`, so the screen never
 * has to know why and an error crossing the wire is not one more thing to render as an apology. An
 * unreadable trip is not a degraded lookup, so that still throws.
 *
 * What is returned is a function of the trip's days, of the provider's forecast and of each day's
 * coordinate (through the computed sun times): no place, stay or member id, no coordinate itself,
 * and no time at which anyone looked a point up.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { resolveLimitsFromRow } from '#/server/billing/limits'
import {
  getEffectiveSettings,
  getSubscription,
  readDayLocations,
  requireTrip,
} from '#/server/repos'
import { weatherRuntime } from '#/server/weather/bindings'
import { resolveTripWeather } from '#/server/weather/weather'
import { appScope } from '../../../-server/context'

import type { TripWeather } from '#/lib/weather'
import type { WeatherRuntimeOptions } from '#/server/weather/bindings'
import type { WeatherOutcome, WeatherRuntime } from '#/server/weather/weather'
import type { TenantScope } from '#/server/repos'

const id = z.string().trim().min(1).max(64)

export const tripWeatherInputSchema = z.strictObject({ tripId: id })

export type TripWeatherInput = z.infer<typeof tripWeatherInputSchema>

export interface TripWeatherPorts {
  /** The runtime the forecast is read through. */
  readonly weather: (options: WeatherRuntimeOptions) => WeatherRuntime
}

/**
 * The outcome as it goes on the wire. A trip with no zone of its own has days bucketed in UTC, and
 * sunrise and sunset in UTC are the wrong clock for the place, so its days carry no `sun`: the
 * panel then draws neither row rather than a time that can be hours off.
 */
function withSunOf(outcome: WeatherOutcome | undefined, hasZone: boolean) {
  if (outcome === undefined) {
    return { status: 'unavailable' as const }
  }
  if (outcome.status !== 'ok' || hasZone) {
    return outcome
  }
  return { status: 'ok' as const, reading: outcome.reading }
}

/**
 * The weather of each day of a trip the caller may read.
 *
 * @throws {NotFoundError} for a trip the caller cannot see.
 */
export async function loadTripWeather(
  scope: TenantScope,
  input: TripWeatherInput,
  ports: TripWeatherPorts,
): Promise<TripWeather> {
  const trip = await requireTrip(scope, input.tripId)
  const [locations, settings, subscription] = await Promise.all([
    readDayLocations(scope, trip.id),
    getEffectiveSettings(scope),
    getSubscription(scope),
  ])

  const runtime = ports.weather({
    organizationId: scope.ctx.organizationId,
    ceiling: resolveLimitsFromRow(subscription).rates.weather_lookups_per_month,
  })
  const outcomes = await resolveTripWeather(
    runtime,
    locations.map(({ date, location }) => ({ date, location })),
    // The trip's own zone, UTC when it has none: never the reader's, so two members of one trip
    // see one answer.
    trip.timezone ?? 'UTC',
  )

  return {
    distanceUnit: settings.distanceUnit,
    days: locations.map(({ dayId }, index) => ({
      dayId,
      ...withSunOf(outcomes[index], trip.timezone !== null),
    })),
  }
}

export const loadTripWeatherFn = createServerFn({ method: 'GET' })
  .validator(tripWeatherInputSchema)
  .handler(async ({ data }): Promise<TripWeather> =>
    loadTripWeather(await appScope(), data, { weather: weatherRuntime }),
  )
