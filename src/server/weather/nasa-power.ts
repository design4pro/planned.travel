/**
 * The NASA POWER client: one request, one response, parsed into our own shape.
 *
 * It knows nothing about tenants, caches or allowances, and it is named for the vendor on purpose -
 * when the provider changes, the file to replace is the one with the vendor's name on it. Everything
 * that decides *whether* a call is made lives in `./weather`, and nothing outside this directory
 * imports this module.
 *
 * **What the provider is given is decided here, because it is a property of the request.** The
 * service has no restriction on use, commercial use included, and asks to be cited; the citation is
 * the planner's, not this file's. It needs no credential and no identifying header. What it learns
 * from us is a coordinate cut to one decimal (about eleven kilometres, finer than its half-degree
 * grid needs and the same cut the cache key uses), a range of dates and the fixed parameters - never
 * a name, an id or anything about the trip.
 *
 * **The fill value is not a number.** For a day it has not got, the service answers `-999` in the
 * field's place. That becomes `null` here, so nothing downstream can average it, convert it or draw
 * it as a temperature of minus 999 degrees.
 *
 * **`fetch` is a parameter.** No test in this repository calls NASA, and none can: the transport
 * arrives as an argument, so the seam is the module boundary rather than a global somebody
 * remembered to intercept.
 */

import { z } from 'zod'

import { WeatherProviderError, roundCoordinate } from './weather'

import type { RecordedProvider, RecordedValues } from './weather'

/** Where the daily point service lives. */
export const NASA_POWER_ENDPOINT =
  'https://power.larc.nasa.gov/api/temporal/daily/point'

/**
 * How many days after a date the service publishes it, measured against the live service on
 * 2026-10-12 at 11:42 UTC: it held values through 2026-10-09 and the fill value for 10, 11 and 12
 * October, at Oslo, Sydney, Tokyo, New York, Nairobi and Reykjavik alike. So a date is published
 * once it is three or more days before today in UTC, and a day inside the lag is "not yet recorded".
 *
 * Re-measure it when the service changes how it publishes, and change the date here with the value:
 * a lag set too short turns "not yet recorded" into "unavailable" for days that are merely late, and
 * one set too long hides days that exist.
 */
export const POWER_LAG_DAYS = 3

/** What the service answers in a field's place for a day it has no value for. */
const FILL_VALUE = -999

/** The parameters asked for: daily maximum and minimum temperature, precipitation and wind at 2 m. */
const PARAMETERS = 'T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M'

/* ---------------------------------------------------------------- the wire */

/**
 * The answer the service promises, as much of it as we read.
 *
 * Each parameter maps a `YYYYMMDD` day to a figure. A parameter the answer leaves out is read as
 * having no days, but a figure that is not a number is refused outright: a response that
 * half-parses is a day with a temperature from nowhere.
 */
const figures = z.record(z.string(), z.number())

const wireResponse = z.object({
  properties: z.object({
    parameter: z.object({
      T2M_MAX: figures.optional(),
      T2M_MIN: figures.optional(),
      PRECTOTCORR: figures.optional(),
      WS2M: figures.optional(),
    }),
  }),
  header: z.object({ fill_value: z.number().optional() }).optional(),
})

const compact = (isoDate: string): string => isoDate.replaceAll('-', '')

const expand = (compactDate: string): string =>
  `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`

function parseDays(body: unknown): ReadonlyMap<string, RecordedValues> {
  const parsed = wireResponse.safeParse(body)
  if (!parsed.success) {
    throw new WeatherProviderError(
      'malformed',
      'NASA POWER answered with a body that is not a daily series.',
    )
  }
  const { parameter } = parsed.data.properties
  const fill = parsed.data.header?.fill_value ?? FILL_VALUE
  const figureOf = (
    series: Record<string, number> | undefined,
    day: string,
  ): number | null => {
    const value = series?.[day]
    return value === undefined || value === fill || value === FILL_VALUE
      ? null
      : value
  }

  const dates = new Set(
    [
      parameter.T2M_MAX,
      parameter.T2M_MIN,
      parameter.PRECTOTCORR,
      parameter.WS2M,
    ].flatMap((series) => Object.keys(series ?? {})),
  )
  const days = new Map<string, RecordedValues>()
  for (const date of dates) {
    days.set(expand(date), {
      tempMaxC: figureOf(parameter.T2M_MAX, date),
      tempMinC: figureOf(parameter.T2M_MIN, date),
      precipitationMm: figureOf(parameter.PRECTOTCORR, date),
      windMs: figureOf(parameter.WS2M, date),
    })
  }
  return days
}

/* ------------------------------------------------------------------ client */

export interface NasaPowerClientOptions {
  readonly fetch: typeof fetch
}

export type NasaPowerClient = RecordedProvider

/**
 * The daily point client over a transport.
 *
 * A failure is a {@link WeatherProviderError} whose message carries the status and nothing else:
 * never the URL, which holds a coordinate, and never the body, which is the provider's text.
 */
export function createNasaPowerClient(
  options: NasaPowerClientOptions,
): NasaPowerClient {
  return {
    lagDays: POWER_LAG_DAYS,
    async daily(lat, lng, range, init) {
      const url = new URL(NASA_POWER_ENDPOINT)
      url.searchParams.set('parameters', PARAMETERS)
      url.searchParams.set('community', 'AG')
      url.searchParams.set('latitude', roundCoordinate(lat, 1))
      url.searchParams.set('longitude', roundCoordinate(lng, 1))
      url.searchParams.set('start', compact(range.start))
      url.searchParams.set('end', compact(range.end))
      url.searchParams.set('format', 'JSON')
      // Local solar time, so a day is the day at the place and not the day in Greenwich.
      url.searchParams.set('time-standard', 'LST')

      let response: Response
      try {
        response = await options.fetch(url.toString(), { signal: init.signal })
      } catch (cause) {
        if (init.signal.aborted) {
          throw cause
        }
        throw new WeatherProviderError(
          'unreachable',
          'NASA POWER could not be reached.',
        )
      }

      if (!response.ok) {
        throw new WeatherProviderError(
          'refused',
          `NASA POWER answered ${response.status}.`,
        )
      }

      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw new WeatherProviderError(
          'malformed',
          'NASA POWER answered with a body that is not JSON.',
        )
      }

      return parseDays(body)
    },
  }
}
