/**
 * The transit proxy — cache read, meter, provider call, cache write, in that order.
 *
 * Every caller goes through here and none reaches `./here` directly. That is not tidiness: the
 * three rules this module applies are the ones that make an outbound, metered, third-party call
 * safe to expose to a browser, and a second door past them would be a second policy.
 *
 * ## The cache is shared across tenants by construction
 *
 * {@link transitCacheKey} is built from the normalised query and nothing else — origin stop,
 * destination stop, date, mode filter. It holds no trip id, no day id, no member id and no
 * organization id, so two workspaces asking the same question of the same timetable are one
 * question. **That two stops connect on a date is a public fact about a timetable, not a fact
 * about anybody's trip**, and a key that quietly acquired a tenant id would leak nothing while
 * multiplying the provider bill by the number of workspaces. `__tests__/search.test.ts` asserts
 * the two keys are the same string, because that failure is invisible from every screen.
 *
 * The stop's *name* is deliberately not in the key either. A name is the label the traveller
 * typed; the stop is where it is. Two people who call one platform "Santa Apolónia station" and
 * "Lisboa Sta. Apolónia" are asking about the same platform, and a key built from their words
 * would buy the same answer twice.
 *
 * ## The ceiling is checked after the cache and before the call
 *
 * A cache hit spends nothing, because it costs nothing. A miss spends one unit of the workspace's
 * `transit_searches_per_month` allowance through `./meter`, and the ceiling itself is resolved by
 * the caller from `resolveLimits()` — the published number is the enforced number.
 *
 * ## Failure is typed
 *
 * Nothing here throws a bare `fetch` rejection at a server function. A provider that is
 * unconfigured, unreachable, refusing or answering nonsense produces a {@link TransitProviderError}
 * with a reason on it, so the screen can say which of those happened instead of showing a stack.
 */

import { z } from 'zod'

import { TRANSPORT_MODES } from '#/server/db/schema'
import { RateCeilingError, spendRateUnit } from './meter'

import type { RateCounterStore } from './meter'

/* ---------------------------------------------------------------- vocabulary */

/** The full transport vocabulary a connection's legs are described in. */
export type TransportMode = (typeof TRANSPORT_MODES)[number]

/**
 * The modes a *public-transport* search may be filtered by.
 *
 * A subset of {@link TRANSPORT_MODES} rather than a vocabulary of its own, so a saved connection
 * is an ordinary transport record with an ordinary mode and nothing has to be translated on the
 * way into D1. Walking and flying are not in the filter: a walk is how a connection joins up, not
 * a connection anybody searches for, and a flight is not what a timetable router answers.
 */
export const TRANSIT_MODES = ['train', 'bus', 'tram', 'metro', 'ferry'] as const
export type TransitMode = (typeof TRANSIT_MODES)[number]

/* -------------------------------------------------------------------- query */

/**
 * One end of a search.
 *
 * Coordinates are required and the name is a label. This is the one place in this area where the
 * station catalogue is a *gate* rather than a shortcut, and the reason is the provider's and not
 * ours: a timetable router is asked where, not what it is called. The dialog says so by offering
 * the picker and nothing else for these two fields.
 */
export interface TransitPlace {
  readonly name: string
  readonly lat: number
  readonly lng: number
}

export interface TransitQuery {
  readonly origin: TransitPlace
  readonly destination: TransitPlace
  /** The day the traveller wants to travel, `YYYY-MM-DD`. */
  readonly date: string
  /**
   * The clock the search departs from, `HH:MM`, in the origin stop's own time.
   *
   * A timetable router answers with the services departing *at or after* an instant, and it
   * answers with a handful of them rather than with the day. So this is not a refinement of the
   * date - it is the half of the question that decides which services can be reached at all: a
   * search anchored at midnight can only ever return the night's first few departures, and a
   * traveller looking for the 09:00 would be shown sleeper buses and told that is what runs.
   */
  readonly time: string
  /** Empty means "every mode this provider answers". */
  readonly modes: ReadonlyArray<TransitMode>
}

const placeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/** The wire shape of a search, shared by the server function and by this module. */
export const transitQuerySchema = z.object({
  origin: placeSchema,
  destination: placeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a calendar date'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a wall clock'),
  modes: z.array(z.enum(TRANSIT_MODES)).max(TRANSIT_MODES.length),
})

/* ------------------------------------------------------------------ answers */

/** A place a connection calls at, with the wall clock it is called at. */
export interface TransitStop {
  readonly name: string
  readonly lat: number | null
  readonly lng: number | null
  /**
   * The local time at *that* stop, `YYYY-MM-DDTHH:MM:SS`, with the provider's offset dropped.
   *
   * A time is stored as it is written at the place it applies to (`03-S2b`), and an offset is not
   * a zone: `+01:00` does not survive the Sunday the clocks change, so it cannot be turned into
   * the IANA name the endpoint would need to be readable elsewhere. What is kept is the clock a
   * traveller standing on the platform would read.
   */
  readonly at: string | null
}

export interface TransitLeg {
  readonly mode: TransportMode
  /** The service as the timetable names it: `IC 728`, `S7`, `4`. */
  readonly name: string | null
  readonly headsign: string | null
  readonly origin: TransitStop
  readonly destination: TransitStop
  readonly intermediateStops: ReadonlyArray<TransitStop>
}

/**
 * A fare, when the provider states one.
 *
 * An integer count of minor units beside a three-letter ISO-4217 code, like every other priced row
 * in this area — never a float. When the provider states nothing, this is `null` and nothing is
 * written: a guessed price on a money column is worse than an empty one.
 */
export interface TransitFare {
  readonly amountMinor: number
  readonly currency: string
}

export interface TransitConnection {
  readonly id: string
  readonly departureAt: string
  readonly arrivalAt: string
  readonly durationMinutes: number
  /** Changes, not legs: a two-leg journey has one change. */
  readonly changes: number
  readonly modes: ReadonlyArray<TransportMode>
  readonly fare: TransitFare | null
  readonly legs: ReadonlyArray<TransitLeg>
}

const stopSchema = z.object({
  name: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  at: z.string().nullable(),
})

const legSchema = z.object({
  mode: z.enum(TRANSPORT_MODES),
  name: z.string().nullable(),
  headsign: z.string().nullable(),
  origin: stopSchema,
  destination: stopSchema,
  intermediateStops: z.array(stopSchema),
})

/**
 * The validator every answer passes, whether it came from the provider or from our own cache.
 *
 * The cache is not more trustworthy than the provider — it holds what the provider said, written
 * by a build of this code that may be older than the one reading it — so an entry that does not
 * parse is a miss, not an answer.
 */
export const transitConnectionSchema = z.object({
  id: z.string().min(1),
  departureAt: z.string(),
  arrivalAt: z.string(),
  durationMinutes: z.number().int().min(0),
  changes: z.number().int().min(0),
  modes: z.array(z.enum(TRANSPORT_MODES)),
  fare: z
    .object({
      amountMinor: z.number().int().min(0),
      currency: z.string().length(3),
    })
    .nullable(),
  legs: z.array(legSchema),
})

const cachedSchema = z.object({
  v: z.literal(1),
  connections: z.array(transitConnectionSchema),
})

/* ------------------------------------------------------------------ failure */

/** Which way the provider let us down. Each one reads differently to the traveller. */
export type TransitFailureReason =
  /** No credential is set on this deployment, so no call was attempted. */
  | 'unconfigured'
  /** The request never produced a response — DNS, timeout, connection reset. */
  | 'unreachable'
  /** The provider answered, and the answer was a refusal. */
  | 'refused'
  /** The provider answered, and the answer was not the shape it promises. */
  | 'malformed'

/**
 * A provider failure with a reason on it.
 *
 * Every path out of `./here` and out of this module ends in one of these, so a server function
 * never has to decide what a `TypeError: fetch failed` means to a person looking at a dialog.
 */
export class TransitProviderError extends Error {
  constructor(
    readonly reason: TransitFailureReason,
    message: string,
    readonly status: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'TransitProviderError'
  }
}

/* -------------------------------------------------------------------- cache */

/** The slice of Workers KV the proxy uses. A real `KVNamespace` satisfies it; so does a map. */
export interface TransitCache {
  get: (key: string) => Promise<string | null>
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>
}

/**
 * How long an answer is served from the cache.
 *
 * Six hours: long enough that a planner comparing two dates back and forth pays for each question
 * once, short enough that a cancellation or a timetable amendment is never a day stale. The real
 * bound is the provider's own retention term rather than this number — ADR 0011 carries it, and
 * that document is not on disk at this HEAD (reported on #173) — so this is the conservative side
 * of every term such an agreement usually carries.
 */
export const TRANSIT_CACHE_TTL_SECONDS = 6 * 60 * 60

/** Bumped when the stored shape changes, so warm entries are ignored rather than misread. */
const CACHE_VERSION = 'v1'

/** Four decimal places is about eleven metres: the same platform, whoever pinned it. */
function atCoordinates(place: TransitPlace): string {
  return `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`
}

/**
 * The cache key: the normalised query and nothing else.
 *
 * Bounded by construction — two coordinate pairs, a date, a clock and at most five mode names — so
 * no traveller's typing can push it past KV's 512-byte key limit.
 *
 * The clock is part of it, and has to be: the provider answers with the services after the instant
 * it is given, so two searches of the same day at two different hours are two different questions
 * with two different answers. Keyed on the date alone, the first search of the day would be served
 * to everyone asking about it for the next six hours.
 */
export function transitCacheKey(query: TransitQuery): string {
  const modes = [...new Set(query.modes)].sort()
  return [
    `transit:${CACHE_VERSION}`,
    atCoordinates(query.origin),
    atCoordinates(query.destination),
    `${query.date}T${query.time}`,
    modes.length === 0 ? 'any' : modes.join('+'),
  ].join(':')
}

/* -------------------------------------------------------------------- proxy */

/** The provider seam. `./here` implements it; a test hands over a stub. */
export interface TransitClient {
  search: (query: TransitQuery) => Promise<ReadonlyArray<TransitConnection>>
}

export interface TransitSearchRuntime {
  /** Where answers are kept — shared across every tenant, on purpose. */
  readonly cache: TransitCache
  /** Where allowances are tallied — per workspace, on purpose. */
  readonly counters: RateCounterStore
  /**
   * The provider, or `null` on a deployment that holds no credential for one.
   *
   * Absent rather than throwing on use, because the two are not the same to the meter: a client
   * that refuses when called is called after the allowance has been spent, and a search that never
   * leaves the Worker would burn a unit of it every time. `null` is a refusal this module can make
   * one line earlier - see {@link searchTransitConnections}.
   */
  readonly client: TransitClient | null
  readonly organizationId: string
  /** `resolveLimits().rates.transit_searches_per_month` for this workspace. */
  readonly ceiling: number
  readonly now: () => Date
  readonly logger?: { warn: (message: string, fields?: unknown) => void } | null
}

export interface TransitSearchResult {
  readonly connections: ReadonlyArray<TransitConnection>
  readonly cached: boolean
  /** Searches spent this month after this one, or `null` when this one spent nothing. */
  readonly spent: number | null
  readonly ceiling: number
}

async function cached(
  runtime: TransitSearchRuntime,
  key: string,
): Promise<ReadonlyArray<TransitConnection> | null> {
  let raw: string | null = null
  try {
    raw = await runtime.cache.get(key)
  } catch (cause) {
    // A cache that cannot be read is a miss, never a failure: the answer is one call away.
    runtime.logger?.warn('transit.cache.read_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return null
  }
  if (raw === null) {
    return null
  }
  try {
    const parsed = cachedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.connections : null
  } catch {
    return null
  }
}

/**
 * Search public-transport connections, through the plan gate, the cache and the meter.
 *
 * The order is the whole contract: **gate, then cache, then meter, then provider**. Checking the
 * *tally* before the cache would charge a workspace for an answer we already had, and calling the
 * provider first would make the ceiling advisory.
 *
 * A provider this deployment has no credential for is not part of it either, and is refused
 * between the cache and the meter: the answers already held are still served, and the workspace is
 * not charged for a search that never leaves the Worker.
 *
 * A ceiling of zero is not part of that trade, and is answered before anything else. It is a plan
 * boundary rather than a rate limit — the workspace may make no search at all, ever — and
 * `transitCacheKey` deliberately carries no organization, so entries are shared across tenants.
 * Left behind the cache, a Free workspace would get real results for any route a paying one had
 * asked about in the last six hours, and see neither a meter nor a refusal. Nothing leaks and
 * nothing is spent, but the boundary stops being one, so it is enforced where the cache cannot
 * reach around it.
 */
export async function searchTransitConnections(
  runtime: TransitSearchRuntime,
  query: TransitQuery,
): Promise<TransitSearchResult> {
  if (runtime.ceiling <= 0) {
    throw new RateCeilingError('transit_searches_per_month', runtime.ceiling, 0)
  }

  const key = transitCacheKey(query)

  const hit = await cached(runtime, key)
  if (hit !== null) {
    return {
      connections: hit,
      cached: true,
      spent: null,
      ceiling: runtime.ceiling,
    }
  }

  // Before the meter and after the cache. A deployment with no provider credential can still serve
  // what it already holds, but it must not spend a workspace's allowance on a call that cannot be
  // made - the reader sees the same refusal either way, and the allowance is the difference.
  if (runtime.client === null) {
    throw new TransitProviderError(
      'unconfigured',
      'Connection search is not configured on this deployment.',
    )
  }

  // Throws `RateCeilingError`, which the caller turns into a refusal the reader can act on.
  const spent = await spendRateUnit(runtime.counters, {
    metric: 'transit_searches_per_month',
    organizationId: runtime.organizationId,
    ceiling: runtime.ceiling,
    now: runtime.now,
    logger: runtime.logger,
  })

  const connections = await runtime.client.search(query)

  // An empty answer is not cached. "No connection was found" is far more likely to be a bad date
  // or a provider having a moment than a fact about the timetable, and six hours is a long time to
  // keep telling a traveller their train does not exist.
  if (connections.length > 0) {
    try {
      await runtime.cache.put(key, JSON.stringify({ v: 1, connections }), {
        expirationTtl: TRANSIT_CACHE_TTL_SECONDS,
      })
    } catch (cause) {
      runtime.logger?.warn('transit.cache.write_failed', {
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  return { connections, cached: false, spent, ceiling: runtime.ceiling }
}
