/**
 * The HERE Transit client: one request, one response, parsed into our own shape.
 *
 * It knows nothing about trips, tenants or D1, and it is named for the vendor on purpose — when
 * the provider changes, the file to replace is the one with the vendor's name on it, and a
 * search through the codebase is not part of the job. Everything that decides *whether* a call is
 * made — the cache, the workspace's allowance, the shared key — lives in `./search`, and nothing
 * outside this directory imports this module.
 *
 * **The provider is HERE, behind our own proxy** (ADR 0011). The community instance the reference
 * product uses forbids commercial use in its own operator's words, so it was never the cheaper
 * option; a free endpoint whose terms exclude us is not an option at all. That argument is the
 * ADR's and is not restated here — but see the note in `./search` about the document itself not
 * being on disk at this HEAD.
 *
 * **The credential is a `wrangler secret`.** It is handed in as a string; this module never reads
 * an environment, and a per-tenant provider credential is neither offered nor accepted — one
 * deployment serves every workspace, so a tenant-supplied third-party key is a cross-tenant leak
 * rather than a feature.
 *
 * **`fetch` is a parameter.** No test in this repository calls HERE, and none can: the transport
 * arrives as an argument, so the seam is the module boundary rather than a global somebody
 * remembered to intercept.
 */

import { z } from 'zod'

import { minorUnitDigits } from '#/lib/money'
import { TransitProviderError } from './search'

import type {
  TransitClient,
  TransitConnection,
  TransitLeg,
  TransitQuery,
  TransitStop,
  TransportMode,
} from './search'

/** Where the timetable router lives. Overridable so a test can name a URL that answers. */
export const HERE_TRANSIT_ENDPOINT =
  'https://transit.router.hereapi.com/v8/routes'

/** Long enough for a slow timetable, short enough that a dialog is never hung on one. */
export const HERE_TIMEOUT_MS = 10_000

/**
 * How many alternatives to ask for. Five is a list a person reads; twenty is a list they scroll.
 *
 * Which is why {@link TransitQuery} carries a departure clock: the router answers with the five
 * services after the instant it is given, so *when* the window opens decides what is in it.
 */
const ALTERNATIVES = 5

/* ---------------------------------------------------------------- the wire */

const wirePlace = z.object({
  name: z.string().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
})

const wireEndpoint = z.object({ time: z.string(), place: wirePlace.optional() })

const wireSection = z.object({
  type: z.string(),
  departure: wireEndpoint,
  arrival: wireEndpoint,
  transport: z
    .object({
      mode: z.string().optional(),
      name: z.string().optional(),
      headsign: z.string().optional(),
    })
    .optional(),
  intermediateStops: z
    .array(
      z.object({
        departure: wireEndpoint.optional(),
        arrival: wireEndpoint.optional(),
      }),
    )
    .optional(),
  fares: z
    .array(
      z.object({
        price: z.object({ currency: z.string(), value: z.number() }).optional(),
      }),
    )
    .optional(),
})

/**
 * The answer HERE promises, as much of it as we read.
 *
 * Unknown keys are ignored rather than refused — a vendor adding a field is not a reason to stop
 * working — but a field we *do* read arriving in the wrong shape is refused outright. A response
 * that half-parses is a form half-filled with numbers nobody can account for.
 */
const wireResponse = z.object({
  routes: z.array(
    z.object({ id: z.string().optional(), sections: z.array(wireSection) }),
  ),
})

/* ------------------------------------------------------------- vocabulary */

/**
 * HERE's transport vocabulary onto ours.
 *
 * Ours is the coarser of the two and that is the right direction to lose detail in: `IC 728` on
 * the card says more about a service than the difference between `intercityTrain` and
 * `interRegionalTrain` ever would, and the twelve modes are what the rest of the product already
 * draws icons and labels for. Anything unrecognised is `transit`, which is true of everything a
 * timetable router answers with and claims nothing further.
 */
const MODE_FOR_HERE: Readonly<Record<string, TransportMode>> = {
  highSpeedTrain: 'train',
  intercityTrain: 'train',
  interRegionalTrain: 'train',
  regionalTrain: 'train',
  cityTrain: 'train',
  bus: 'bus',
  privateBus: 'bus',
  busRapid: 'bus',
  lightRail: 'tram',
  monorail: 'tram',
  inclined: 'tram',
  aerial: 'tram',
  subway: 'metro',
  ferry: 'ferry',
  flight: 'flight',
  pedestrian: 'walk',
  walk: 'walk',
}

/** Ours back onto theirs, for the `modes` filter. One of ours can be several of theirs. */
const HERE_FOR_MODE: Readonly<Record<string, ReadonlyArray<string>>> = {
  train: [
    'highSpeedTrain',
    'intercityTrain',
    'interRegionalTrain',
    'regionalTrain',
    'cityTrain',
  ],
  bus: ['bus', 'privateBus', 'busRapid'],
  tram: ['lightRail', 'monorail', 'inclined', 'aerial'],
  metro: ['subway'],
  ferry: ['ferry'],
}

function modeOf(section: z.infer<typeof wireSection>): TransportMode {
  if (section.type === 'pedestrian') {
    return 'walk'
  }
  return MODE_FOR_HERE[section.transport?.mode ?? ''] ?? 'transit'
}

/* ----------------------------------------------------------------- clocks */

/**
 * The wall clock at the place the time applies to, with the provider's offset dropped.
 *
 * HERE states `2026-10-09T08:12:00+01:00`. The offset is not a zone — it does not survive the
 * Sunday the clocks change — so it cannot become the IANA name an endpoint needs, and keeping it
 * would only invite a reader to convert a time that is already correct where it is read.
 */
function localClock(time: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/.exec(time)
  if (match === null) {
    return time
  }
  // `YYYY-MM-DDTHH:MM` is sixteen characters; anything shorter did not match at all.
  const stamp = match[1]
  return stamp.length === 16 ? `${stamp}:00` : stamp
}

/** Minutes between two instants, which needs the offsets the wall clocks dropped. */
function minutesBetween(from: string, to: string): number {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0
  }
  return Math.max(0, Math.round((end - start) / 60_000))
}

/* ------------------------------------------------------------------ money */

/**
 * A stated fare into minor units.
 *
 * `minorUnitDigits` rather than a hundred, so a ¥2,450 fare is 2450 yen and not 245,000 of a minor
 * unit the yen does not have. Rounded once, here, and an integer from this point on.
 */
function fareOf(
  sections: ReadonlyArray<z.infer<typeof wireSection>>,
): TransitConnection['fare'] {
  for (const section of sections) {
    for (const fare of section.fares ?? []) {
      const price = fare.price
      if (price === undefined) {
        continue
      }
      const currency = price.currency.trim().toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency)) {
        continue
      }
      const amountMinor = Math.round(
        price.value * 10 ** minorUnitDigits(currency),
      )
      if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
        continue
      }
      return { amountMinor, currency }
    }
  }
  // Nothing is written for a journey whose fare the provider did not state. The first fare stated
  // is taken as *the* fare rather than a sum of the section fares: whether two priced sections are
  // one ticket or two is a term of the tariff, and adding them up would be arithmetic we invented.
  return null
}

/* ------------------------------------------------------------------ parse */

function stopOf(
  endpoint: z.infer<typeof wireEndpoint> | undefined,
): TransitStop {
  return {
    name: endpoint?.place?.name ?? '',
    lat: endpoint?.place?.location?.lat ?? null,
    lng: endpoint?.place?.location?.lng ?? null,
    at: endpoint === undefined ? null : localClock(endpoint.time),
  }
}

function legOf(section: z.infer<typeof wireSection>): TransitLeg {
  return {
    mode: modeOf(section),
    name: section.transport?.name ?? null,
    headsign: section.transport?.headsign ?? null,
    origin: stopOf(section.departure),
    destination: stopOf(section.arrival),
    intermediateStops: (section.intermediateStops ?? []).map((stop) =>
      stopOf(stop.departure ?? stop.arrival),
    ),
  }
}

function connectionOf(
  route: z.infer<typeof wireResponse>['routes'][number],
  index: number,
): TransitConnection | null {
  const first = route.sections.at(0)
  const last = route.sections.at(-1)
  if (first === undefined || last === undefined) {
    return null
  }
  const legs = route.sections.map(legOf)
  const ridden = legs.filter((leg) => leg.mode !== 'walk')
  return {
    id: route.id ?? `route-${index}`,
    departureAt: localClock(first.departure.time),
    arrivalAt: localClock(last.arrival.time),
    durationMinutes: minutesBetween(first.departure.time, last.arrival.time),
    // Changes, not legs: three trains is two changes, and a walk between them is not a third.
    changes: Math.max(0, ridden.length - 1),
    modes: [...new Set(ridden.map((leg) => leg.mode))],
    fare: fareOf(route.sections),
    legs,
  }
}

/* ----------------------------------------------------------------- client */

export interface HereClientOptions {
  /** From `wrangler secret put HERE_API_KEY`. Never a value a tenant supplies. */
  readonly apiKey: string
  readonly fetch: typeof fetch
  readonly endpoint?: string
}

function requestUrl(options: HereClientOptions, query: TransitQuery): URL {
  const url = new URL(options.endpoint ?? HERE_TRANSIT_ENDPOINT)
  url.searchParams.set('origin', `${query.origin.lat},${query.origin.lng}`)
  url.searchParams.set(
    'destination',
    `${query.destination.lat},${query.destination.lng}`,
  )
  url.searchParams.set('departureTime', `${query.date}T${query.time}:00`)
  url.searchParams.set('alternatives', String(ALTERNATIVES))
  url.searchParams.set('return', 'intermediate,fares')
  const modes = query.modes.flatMap((mode) => HERE_FOR_MODE[mode] ?? [])
  if (modes.length > 0) {
    url.searchParams.set('modes', [...new Set(modes)].join(','))
  }
  return url
}

/**
 * A client bound to one credential and one transport.
 *
 * Built rather than called, so the composition root wires the secret in once and every caller
 * afterwards holds a {@link TransitClient} that cannot be handed the wrong key.
 */
export function createHereClient(options: HereClientOptions): TransitClient {
  const apiKey = options.apiKey.trim()
  if (apiKey === '') {
    throw new TransitProviderError(
      'unconfigured',
      'Connection search is not configured on this deployment. Set HERE_API_KEY with `wrangler secret put HERE_API_KEY`.',
    )
  }

  return {
    async search(
      query: TransitQuery,
    ): Promise<ReadonlyArray<TransitConnection>> {
      const url = requestUrl(options, query)
      // The credential rides in the query, which is the only form the vendor accepts, so the URL
      // is never logged and never appears in a failure message — see the cases below, which quote
      // the status and the vendor's own text and never the request.
      url.searchParams.set('apiKey', apiKey)

      let response: Response
      try {
        response = await options.fetch(url, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(HERE_TIMEOUT_MS),
        })
      } catch (cause) {
        throw new TransitProviderError(
          'unreachable',
          'The timetable service could not be reached. Try again in a moment.',
          null,
          { cause },
        )
      }

      if (!response.ok) {
        throw new TransitProviderError(
          'refused',
          `The timetable service refused the search (${response.status}).`,
          response.status,
        )
      }

      let body: unknown
      try {
        body = await response.json()
      } catch (cause) {
        throw new TransitProviderError(
          'malformed',
          'The timetable service answered something this product cannot read.',
          response.status,
          { cause },
        )
      }

      const parsed = wireResponse.safeParse(body)
      if (!parsed.success) {
        throw new TransitProviderError(
          'malformed',
          'The timetable service answered something this product cannot read.',
          response.status,
        )
      }

      return parsed.data.routes.flatMap((route, index) => {
        const connection = connectionOf(route, index)
        return connection === null ? [] : [connection]
      })
    },
  }
}
