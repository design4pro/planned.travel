/**
 * The transit proxy — cache read, meter, provider call, cache write, in that order.
 *
 * Every caller goes through here and none reaches `./here` directly. That is not tidiness: the
 * three rules this module applies are the ones that make an outbound, metered, third-party call
 * safe to expose to a browser, and a second door past them would be a second policy.
 *
 * ## A cached answer belongs to the member whose Request fetched it
 *
 * {@link transitCacheKey} is built from the organization, the member and the normalised query -
 * origin stop, destination stop, date, clock, mode filter. HERE's Platform Terms forbid "scaling
 * one Request to serve multiple End Users" (§6.4 l) and "Provid[ing] Results and/or HERE Content to
 * another person or entity" (§6.4 h), and an End User is every person who uses the Application
 * (§21.7), not the workspace. So two members asking the same question of the same timetable are
 * two Requests, whether they share a workspace or not. ADR 0011 recorded the opposite and was
 * amended for it; ADR 0019 made the same reading for road routing first.
 *
 * Both ids come from the server-side scope the caller holds (`scope.ctx`), never from request
 * input, so a caller cannot ask for somebody else's entry by naming it.
 *
 * The stop's *name* is deliberately not in the key. A name is the label the traveller typed; the
 * stop is where it is. Two spellings of one platform are one question, and a key built from the
 * words would buy the same answer twice for the same member.
 *
 * ## An answer is stored only when HERE's headers say it may be
 *
 * Exhibit 2 §1.3 allows caching "only as explicitly allowed by the caching headers". The provider
 * client hands the response's headers up with the connections, {@link storableLifetimeSeconds}
 * reads them, and an answer with no permitting header is returned and not stored. The lifetime is
 * the lesser of the header's and {@link TRANSIT_CACHE_MAX_TTL_SECONDS}.
 *
 * ## The ceiling is checked after the cache and before the call
 *
 * A cache hit spends nothing, because it costs nothing. A miss - and so a first search by every
 * member - spends one unit of the workspace's `transit_searches_per_month` allowance through `#/server/metering/rate`, and the ceiling itself is resolved by
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
import { storableLifetimeSeconds } from '#/lib/http-cache'
import { RateCeilingError, spendRateUnit } from '#/server/metering/rate'

import type { CachingHeaders } from '#/lib/http-cache'
import type { RateCounterStore } from '#/server/metering/rate'

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
 * The longest an answer is ever kept, whatever HERE's headers allow.
 *
 * A flat 24 hours covers both retention limits in the Platform Terms with one number: 30 days for
 * Results in general (§6.4 j) and 24 hours for Results in Japan (§6.4 k), without a detector for
 * which side of that border a search is on. The real lifetime is the header's, when it is shorter.
 */
export const TRANSIT_CACHE_MAX_TTL_SECONDS = 24 * 60 * 60

/**
 * Bumped when the key's shape changes, so warm entries are ignored rather than misread.
 *
 * `v2` is the first key that names an owner: no entry written under the shared `v1` key is ever
 * read again, and each ages out of KV within its own six hours.
 */
const CACHE_VERSION = 'v2'

/** Four decimal places is about eleven metres: the same platform, however it was pinned. */
function atCoordinates(place: TransitPlace): string {
  return `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`
}

/** Whose Request an entry is: one member, inside one workspace. */
export interface TransitCacheOwner {
  readonly organizationId: string
  readonly memberId: string
}

/**
 * The cache key: the owner and the normalised query.
 *
 * Bounded by construction - two ids of at most 64 characters (`requireTenantContext` refuses
 * longer), two coordinate pairs, a date, a clock and at most five mode names - so no traveller's
 * typing can push it past KV's 512-byte key limit. The ids are generated, never typed, and carry
 * no `:`, so the segments cannot run together.
 *
 * The clock is part of it, and has to be: the provider answers with the services after the instant
 * it is given, so two searches of the same day at two different hours are two different questions
 * with two different answers.
 */
export function transitCacheKey(
  owner: TransitCacheOwner,
  query: TransitQuery,
): string {
  const modes = [...new Set(query.modes)].sort()
  return [
    `transit:${CACHE_VERSION}`,
    owner.organizationId,
    owner.memberId,
    atCoordinates(query.origin),
    atCoordinates(query.destination),
    `${query.date}T${query.time}`,
    modes.length === 0 ? 'any' : modes.join('+'),
  ].join(':')
}

/* -------------------------------------------------------------------- proxy */

/**
 * What the provider answered: the connections, and the headers that say whether and for how long
 * the answer may be stored. The client reports them as they arrived and decides nothing; whether
 * to keep an answer is this module's call, through {@link storableLifetimeSeconds}.
 */
export interface TransitAnswer {
  readonly connections: ReadonlyArray<TransitConnection>
  readonly caching: CachingHeaders
}

/** The provider seam. `./here` implements it; a test hands over a stub. */
export interface TransitClient {
  search: (query: TransitQuery) => Promise<TransitAnswer>
}

export interface TransitSearchRuntime {
  /** Where answers are kept - each one under the member whose Request fetched it. */
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
  /** Whose allowance a miss is spent against, and the first half of every cache key. */
  readonly organizationId: string
  /** The member searching, from the server-side scope: the second half of every cache key. */
  readonly memberId: string
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
 * boundary rather than a rate limit - the workspace may make no search at all, ever. Left behind
 * the cache, a workspace downgraded to such a plan would keep getting real results from its own
 * members' old entries, with neither a meter nor a refusal, until they expired. Nothing leaks and
 * nothing is spent, but the boundary stops being one, so it is enforced where the cache cannot
 * reach around it. That protects a member from their own old entries; other tenants' entries are
 * unreachable by construction, since the key names its owner.
 */
export async function searchTransitConnections(
  runtime: TransitSearchRuntime,
  query: TransitQuery,
): Promise<TransitSearchResult> {
  if (runtime.ceiling <= 0) {
    throw new RateCeilingError('transit_searches_per_month', runtime.ceiling, 0)
  }

  const key = transitCacheKey(runtime, query)

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

  const { connections, caching } = await runtime.client.search(query)

  // Stored only when HERE's headers permit it, and no longer than they say (Exhibit 2 §1.3). An
  // empty answer is not stored either: "No connection was found" is far more likely to be a bad
  // date or a provider having a moment than a fact about the timetable, and an hour is a long time
  // to keep telling a traveller their train does not exist.
  const lifetime = storableLifetimeSeconds(caching)
  if (connections.length > 0 && lifetime !== null) {
    try {
      await runtime.cache.put(key, JSON.stringify({ v: 1, connections }), {
        expirationTtl: Math.min(lifetime, TRANSIT_CACHE_MAX_TTL_SECONDS),
      })
    } catch (cause) {
      runtime.logger?.warn('transit.cache.write_failed', {
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  return { connections, cached: false, spent, ceiling: runtime.ceiling }
}
