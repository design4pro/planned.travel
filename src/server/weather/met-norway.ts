/**
 * The MET Norway client: one request, one response, parsed into our own shape.
 *
 * It knows nothing about tenants, caches or allowances, and it is named for the vendor on purpose -
 * when the provider changes, the file to replace is the one with the vendor's name on it. Everything
 * that decides *whether* a call is made lives in `./weather`, and nothing outside this directory
 * imports this module.
 *
 * **What the provider's terms bind us to is done here, because it is a property of the request.**
 * Locationforecast is CC BY 4.0 with commercial use allowed, on three conditions this file keeps:
 * the request carries a `User-Agent` that identifies the application (an anonymous one is answered
 * with 403), the coordinates are cut to four decimals (finer ones are answered with 403 as well, and
 * a finer URL would also fragment every cache that keys on it), and the `Expires` header is read so
 * the caller can honour it. The `Last-Modified` header is read too, and sent back as
 * `If-Modified-Since` when the caller holds one, which is how a stale entry is re-validated for the
 * price of a request rather than a body. The attribution is the planner's, not this file's.
 *
 * **No `Accept-Encoding` is set.** The Workers runtime negotiates compression on every outbound
 * `fetch`, which is what satisfies the provider's request to receive gzip; a header written by hand
 * is how a body ends up compressed twice.
 *
 * **There is no credential.** The service is keyless, so there is nothing to store, nothing to
 * leak into a URL and nothing a tenant could supply.
 *
 * **`fetch` is a parameter.** No test in this repository calls MET Norway, and none can: the
 * transport arrives as an argument, so the seam is the module boundary rather than a global
 * somebody remembered to intercept.
 */

import { z } from 'zod'

import { WeatherProviderError, roundCoordinate, stripDayNight } from './weather'

import type { ForecastProvider, ForecastStep } from './weather'

/** Where Locationforecast lives; the `compact` product carries what a day badge needs. */
export const MET_NORWAY_ENDPOINT =
  'https://api.met.no/weatherapi/locationforecast/2.0/compact'

/**
 * Who is asking. MET Norway answers an anonymous request with 403, and a site link satisfies its
 * rule that the agent give a way to be reached. Not a secret; checked in on purpose.
 */
export const MET_NORWAY_USER_AGENT =
  'planned.travel/1.0 (+https://planned.travel)'

/* ---------------------------------------------------------------- the wire */

const summary = z.object({
  summary: z.object({ symbol_code: z.string() }),
})

/**
 * The answer Locationforecast promises, as much of it as we read.
 *
 * Unknown keys are ignored rather than refused - a provider adding a field is not a reason to stop
 * working - but a field we *do* read arriving in the wrong shape is refused outright. A response
 * that half-parses is a day with a temperature from nowhere.
 */
const wireResponse = z.object({
  properties: z.object({
    timeseries: z.array(
      z.object({
        time: z.string(),
        data: z.object({
          instant: z.object({
            details: z.object({ air_temperature: z.number().optional() }),
          }),
          next_1_hours: summary.optional(),
          next_6_hours: summary.optional(),
          next_12_hours: summary.optional(),
        }),
      }),
    ),
  }),
})

type WireStep = z.infer<typeof wireResponse>['properties']['timeseries'][number]

/**
 * The symbol that describes the stretch after a step, finest first that is a stable summary.
 *
 * The six-hour summary leads because it is the one every step in the answer carries until the last,
 * and the one-hour and twelve-hour ones only exist on part of the series. A step with none - the
 * answer's last, which has nothing after it - yields `null`, which is a step without a symbol
 * rather than a bad one.
 */
function symbolOf(step: WireStep): string | null {
  const code =
    step.data.next_6_hours?.summary.symbol_code ??
    step.data.next_1_hours?.summary.symbol_code ??
    step.data.next_12_hours?.summary.symbol_code
  return code === undefined ? null : stripDayNight(code)
}

function parseSteps(body: unknown): ReadonlyArray<ForecastStep> {
  const parsed = wireResponse.safeParse(body)
  if (!parsed.success) {
    throw new WeatherProviderError(
      'malformed',
      'MET Norway answered with a body that is not a forecast.',
    )
  }
  const steps: Array<ForecastStep> = []
  for (const step of parsed.data.properties.timeseries) {
    const tempC = step.data.instant.details.air_temperature
    // A step with no temperature or no readable time says nothing about any day; dropping it is
    // honest where a zero would not be.
    if (tempC === undefined || Number.isNaN(Date.parse(step.time))) {
      continue
    }
    steps.push({ time: step.time, tempC, symbol: symbolOf(step) })
  }
  return steps
}

function expiryOf(response: Response): Date | null {
  const header = response.headers.get('Expires')
  if (header === null) {
    return null
  }
  const parsed = new Date(header)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** The validator to send back, when the provider gave one that is a date. */
function lastModifiedOf(response: Response): string | null {
  const header = response.headers.get('Last-Modified')
  return header !== null && !Number.isNaN(Date.parse(header)) ? header : null
}

/* ------------------------------------------------------------------ client */

export interface MetNorwayClientOptions {
  readonly fetch: typeof fetch
}

export type MetNorwayClient = ForecastProvider

/**
 * The Locationforecast client over a transport.
 *
 * A failure is a {@link WeatherProviderError} whose message carries the status and nothing else:
 * never the URL, which holds a coordinate, and never the body, which is the provider's text.
 */
export function createMetNorwayClient(
  options: MetNorwayClientOptions,
): MetNorwayClient {
  return {
    async forecast(lat, lng, init) {
      const url = new URL(MET_NORWAY_ENDPOINT)
      url.searchParams.set('lat', roundCoordinate(lat))
      url.searchParams.set('lon', roundCoordinate(lng))

      let response: Response
      try {
        response = await options.fetch(url.toString(), {
          headers: {
            'User-Agent': MET_NORWAY_USER_AGENT,
            ...(init.lastModified
              ? { 'If-Modified-Since': init.lastModified }
              : {}),
          },
          signal: init.signal,
        })
      } catch (cause) {
        if (init.signal.aborted) {
          throw cause
        }
        throw new WeatherProviderError(
          'unreachable',
          'MET Norway could not be reached.',
        )
      }

      // The provider's answer to a validator that still holds: no body, a new expiry.
      if (response.status === 304) {
        return {
          notModified: true,
          expires: expiryOf(response),
          lastModified: lastModifiedOf(response),
        }
      }

      if (!response.ok) {
        throw new WeatherProviderError(
          'refused',
          `MET Norway answered ${response.status}.`,
        )
      }

      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw new WeatherProviderError(
          'malformed',
          'MET Norway answered with a body that is not JSON.',
        )
      }

      return {
        series: parseSteps(body),
        expires: expiryOf(response),
        lastModified: lastModifiedOf(response),
      }
    },
  }
}
