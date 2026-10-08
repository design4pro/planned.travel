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
 * What is returned is a function of the trip's days and of the provider's forecast: no place, stay
 * or member id, no coordinate, and no time at which anyone looked a point up.
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
import type { WeatherRuntime } from '#/server/weather/weather'
import type { TenantScope } from '#/server/repos'

const id = z.string().trim().min(1).max(64)

export const tripWeatherInputSchema = z.strictObject({ tripId: id })

export type TripWeatherInput = z.infer<typeof tripWeatherInputSchema>

export interface TripWeatherPorts {
  /** The runtime the forecast is read through. */
  readonly weather: (options: WeatherRuntimeOptions) => WeatherRuntime
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
    trip.timezone ?? settings.timezone,
  )

  return {
    distanceUnit: settings.distanceUnit,
    days: locations.map(({ dayId }, index) => ({
      dayId,
      ...(outcomes[index] ?? { status: 'unavailable' as const }),
    })),
  }
}

export const loadTripWeatherFn = createServerFn({ method: 'GET' })
  .validator(tripWeatherInputSchema)
  .handler(async ({ data }): Promise<TripWeather> =>
    loadTripWeather(await appScope(), data, { weather: weatherRuntime }),
  )
