import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { loadTripWeatherFn } from '../-server/weather'

import type { DayWeatherView } from '#/components/planner/weather-model'
import type { WeatherUnit } from '#/lib/weather'

/** A forecast moves slowly, and the server keeps its own, fresher, cache behind this one. */
export const TRIP_WEATHER_STALE_MS = 15 * 60_000

export function tripWeatherKey(tripId: string) {
  return ['trip-weather', tripId] as const
}

export interface TripWeatherView {
  /** What to draw for one day: the answer, `loading` before it, `unavailable` if it failed. */
  readonly viewOf: (dayId: string) => DayWeatherView
  /** The reader's unit, for drawing the metric readings. */
  readonly unit: WeatherUnit
}

/**
 * The weather of a trip's days, fetched after the screen is on the page.
 *
 * Deliberately a query and not a route loader: the board paints from the loader's data alone, and
 * a provider that is slow or down must not hold it back. Until the answer is in every day reads
 * `loading`; a request that fails outright reads `unavailable` for every day, because the server
 * function already turns each provider failure into that answer and what is left is the network.
 * An answer already in hand outlives a later failed refetch: a forecast seen a minute ago is not
 * replaced by a dash because the connection blinked. A day the answer does not mention reads `none`.
 *
 * `plan` is the board's own data. Every edit of the plan reloads it, and a day's location is read
 * off the plan, so a new `plan` after the first is the cue to ask again rather than keep showing
 * the forecast of the place a day used to be spent in.
 */
export function useTripWeather(tripId: string, plan: unknown): TripWeatherView {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: tripWeatherKey(tripId),
    queryFn: () => loadTripWeatherFn({ data: { tripId, recorded: true } }),
    staleTime: TRIP_WEATHER_STALE_MS,
    // A planner left open over midnight must not keep yesterday's "today"; stale entries only.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Remember the trip with the plan: a screen kept mounted across a switch to another trip sees a
  // different plan, but that is a new trip (its query is already asking), not an edit of this one.
  const seen = React.useRef({ tripId, plan })
  React.useEffect(() => {
    const before = seen.current
    seen.current = { tripId, plan }
    if (before.tripId === tripId && before.plan !== plan) {
      void client.invalidateQueries({ queryKey: tripWeatherKey(tripId) })
    }
  }, [client, plan, tripId])

  const answer = query.data
  if (answer === undefined) {
    return query.isError
      ? {
          unit: 'metric',
          viewOf: (dayId) => ({ dayId, status: 'unavailable' }),
        }
      : { unit: 'metric', viewOf: () => ({ status: 'loading' }) }
  }

  const byDay = new Map(answer.days.map((day) => [day.dayId, day]))
  return {
    unit: answer.distanceUnit,
    viewOf: (dayId) => byDay.get(dayId) ?? { dayId, status: 'none' },
  }
}
