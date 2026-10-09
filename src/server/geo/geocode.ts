/**
 * The geocoding proxy — parse, plan gate, cache, credential, retention, meter, vendor, cache write.
 *
 * Every consumer enters here and none reaches `./geoapify` directly, for the reason
 * `src/server/transit/search.ts` gives about its own vendor: the rules this module applies are what
 * make an outbound, metered, third-party call safe to expose to a browser, and a second door past
 * them would be a second policy.
 *
 * **The order of operations is the whole contract**, and each position is load-bearing rather than
 * incidental:
 *
 * 1. **Parse first.** A query below the minimum or above the maximum length is refused before KV is
 *    touched at all — a malformed question should not cost a round trip, and the normalisation the
 *    key needs happens here anyway.
 * 2. **The plan gate before the cache.** A ceiling of zero is a plan boundary rather than a rate
 *    limit, and {@link forwardCacheKey} carries no organization id: left behind the cache, a
 *    workspace excluded from the feature would be served real answers any other workspace had
 *    already paid for. The branch is unreachable under today's figures — no plan's geocoding
 *    allowance is zero — and stays because it is the boundary, not because it fires.
 * 3. **The cache before the meter.** A cached answer costs nothing and must therefore spend nothing.
 * 4. **Unconfigured after the cache and before the meter.** A deployment whose credential was
 *    removed still serves what it already holds, and must not spend a workspace's allowance on a
 *    call that never leaves the Worker.
 * 5. **The retention check before the meter.** Refusing a result we may not store *after* paying for
 *    it charges a workspace for nothing. Checking the adapter's declaration up front is strictly
 *    cheaper, and it also keeps the cache from ever holding an unstorable answer.
 * 6. **The meter before the vendor**, or the ceiling is advisory.
 * 7. **The provider ledger around the vendor call**, so the operator's own view of the vendor — the
 *    `provider_usage` tally and the `block` policy an operator can set on it — sees every call this
 *    module makes. It sits inside the meter rather than outside it because the two count different
 *    things: the meter is a workspace's monthly allowance, the ledger is this deployment's bill.
 *
 * ## The cache is shared across tenants, and unexpiring
 *
 * The key carries no tenant identifier, which is ADR 0013's term and the property that makes a
 * shared cache legal: that an address resolves to a point is a public fact, not a fact about
 * anybody's trip. It carries the provider slug, so a second adapter could never read answers the
 * first one gave, and the language, because a geocoder answers *in* a language — the language is
 * part of the question rather than a fact about who asked.
 *
 * Nothing is written with an `expirationTtl`, unlike the transit proxy's. A timetable goes
 * stale and a doorway does not, and permanent storage is precisely the right ADR 0013 bought.
 * {@link GEO_CACHE_VERSION} is the only eviction lever, which is why it exists — and why empty
 * answers are never written: with no TTL, a wrong empty would be permanent.
 *
 * ## Failure is typed
 *
 * Nothing here throws a bare `fetch` rejection at a server function. Four of
 * {@link GeoFailureReason}'s five are `TransitFailureReason`'s, spelled the same way on purpose so
 * a reader who knows one module knows the other; `unstorable` is the one this port adds, and it is
 * what makes the retention right enforceable rather than declared.
 *
 * **No refusal prose is authored here.** These messages are developer-facing English on an error
 * object; the stage that renders a failed lookup mints its own catalogue keys against `reason`.
 */

import { z } from 'zod'

import { LOCALE_TAGS } from '#/lib/i18n/locales'
import { callProvider } from '#/server/metering/outbound'
import { RateCeilingError, spendRateUnit } from '#/server/metering/rate'

import type { Locale } from '#/lib/i18n/locales'
import type { RateCounterStore } from '#/server/metering/rate'
import type { OutboundRuntime } from '#/server/metering/outbound'
import type { MeteredProvider } from '#/server/db/types'

/* ---------------------------------------------------------------- vocabulary */

/** What a vendor's licence permits us to do with a coordinate it returned. */
export type GeocodeRetention = 'permanent' | 'ephemeral'

/**
 * A credit the vendor's licence obliges us to carry.
 *
 * A proper noun and a link, never a sentence. The sentence around it — "Map data from", or a
 * one-line attribution footer — is ours and lives in the 23-locale catalogue, exactly as
 * `src/lib/i18n/messages/en/atlas.ts` already does it for the basemap. Splitting it here is what
 * lets this module ship zero copy while the obligation is still met.
 */
export interface GeocodeCredit {
  /** As the licence spells it: `'OpenStreetMap'`, `'Geoapify'`. */
  readonly name: string
  readonly url: string
}

/**
 * Who answers, and on what terms.
 *
 * Known to the deployment whether or not a credential is set, because which adapter this build
 * imports is a fact about the build and not about the key it was handed. That is what makes
 * position 4 of the order implementable: a cache hit on an unconfigured deployment still needs the
 * **slug**, which is in the key, and the **attribution**, which {@link GeocodeResult} does not make
 * optional.
 */
export interface GeocodeVendor {
  readonly slug: MeteredProvider
  readonly retention: GeocodeRetention
  /** Travels with a stored coordinate — ADR 0013's condition on the storage right. */
  readonly attribution: ReadonlyArray<GeocodeCredit>
}

/* --------------------------------------------------------------------- query */

export const GEOCODE_QUERY_MIN_LENGTH = 3
export const GEOCODE_QUERY_MAX_LENGTH = 160

/**
 * How many candidates the vendor is asked for. Five is a list a person reads.
 *
 * There is deliberately **no `limit` parameter**. A caller-chosen count would enter the cache key —
 * or, worse, would not, and a request for ten would be served a cached five. A consumer that wants
 * three slices three, which is what `here.ts`'s fixed `ALTERNATIVES` does for the same reason.
 */
export const GEOCODE_CANDIDATES = 5

/**
 * The wire shapes, shared by this module and by the server function that will wrap it.
 *
 * They live here so `02-S4`'s `-server/geocode.ts` reuses them instead of writing a second, looser
 * copy — docs/SPEC.md's rule is that every server-function input is validated with Zod, and two
 * validators for one input is two answers to what a valid query is.
 */
export const forwardQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(GEOCODE_QUERY_MIN_LENGTH)
    .max(GEOCODE_QUERY_MAX_LENGTH),
  language: z.enum(LOCALE_TAGS),
})

export const reverseQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  language: z.enum(LOCALE_TAGS),
})

export type ForwardQuery = z.infer<typeof forwardQuerySchema>
export type ReverseQuery = z.infer<typeof reverseQuerySchema>

/** What a caller hands in, before validation has had a look at it. */
export type ForwardQueryInput = z.input<typeof forwardQuerySchema>
export type ReverseQueryInput = z.input<typeof reverseQuerySchema>

/* ------------------------------------------------------------------- answers */

export interface GeocodeCandidate {
  /** The vendor's own id for the place — what a caller writes to `places.external_id`. */
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly city: string | null
  /** ISO-3166-1 alpha-2, upper case — the shape `places.country_code` stores. */
  readonly countryCode: string | null
  readonly lat: number
  readonly lng: number
}

/**
 * The answer, for both directions.
 *
 * A reverse lookup is a forward lookup with a different question, and returning a second shape
 * would give every consumer two result types to narrow.
 *
 * The attribution sits on the envelope rather than on each candidate because it is a property of
 * the vendor that answered, not of a row: a caller stores one candidate out of one result, and the
 * credit it must keep is one field away either way. Repeating it five times would be five copies of
 * one fact in a shape a consumer serialises to the browser.
 */
export interface GeocodeResult {
  /** Ranked: the vendor's order, preserved. Empty is an answer, not a failure. */
  readonly candidates: ReadonlyArray<GeocodeCandidate>
  /** The credits that must be kept beside any coordinate taken from `candidates`. */
  readonly attribution: ReadonlyArray<GeocodeCredit>
  readonly cached: boolean
  /** Lookups spent this month after this one, or `null` when this one spent nothing. */
  readonly spent: number | null
  readonly ceiling: number
}

/**
 * The validator every candidate passes, whether it came from the vendor or from our own cache.
 *
 * The cache is not more trustworthy than the vendor — it holds what the vendor said, written by a
 * build of this code that may be older than the one reading it — so an entry that does not parse is
 * a miss, not an answer. With no TTL to retire it, that re-validation is the only thing standing
 * between an old shape and a permanent misreading.
 */
export const geocodeCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const cachedSchema = z.object({
  v: z.literal(1),
  candidates: z.array(geocodeCandidateSchema),
})

/* ------------------------------------------------------------------- failure */

/** Which way the lookup let us down. Each one reads differently to the traveller. */
export type GeoFailureReason =
  /** No credential is set on this deployment, so no call was attempted. */
  | 'unconfigured'
  /** The request never produced a response — DNS, timeout, connection reset. */
  | 'unreachable'
  /** The provider answered, and the answer was a refusal. */
  | 'refused'
  /** The provider answered, and the answer was not the shape it promises. */
  | 'malformed'
  /** The adapter does not declare permanent storage, so its answer may not be handed over. */
  | 'unstorable'

/**
 * A provider failure with a reason on it.
 *
 * Every path out of `./geoapify` and out of this module ends in one of these, so a server function
 * never has to decide what a `TypeError: fetch failed` means to a person looking at a form.
 */
export class GeoProviderError extends Error {
  constructor(
    readonly reason: GeoFailureReason,
    message: string,
    readonly status: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'GeoProviderError'
  }
}

/* --------------------------------------------------------------------- cache */

/** The slice of Workers KV the proxy uses. A real `KVNamespace` satisfies it; so does a map. */
export interface GeoCache {
  get: (key: string) => Promise<string | null>
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>
}

/** Bumped when the stored shape changes. The only eviction lever an unexpiring cache has. */
export const GEO_CACHE_VERSION = 'v1'

/**
 * Two spellings of one question, folded into one key.
 *
 * The query is folded for the key and sent to the vendor **unfolded** — the vendor should see what
 * the traveller typed, and only the key needs `"  Plaza   Mayor "` and `"plaza mayor"` to collide.
 *
 * `toLowerCase()` and not `toLocaleLowerCase()`, deliberately: a locale-sensitive fold lower-cases
 * `İSTANBUL` differently for a Turkish reader than for a Polish one, and the key has to be the same
 * string for both or the cross-tenant cache stops being one.
 */
export function normalizeGeocodeQuery(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * `geo:v1:{slug}:f:{language}:{sha256hex}`.
 *
 * Hashed, because a free-text query is unbounded and a KV key caps at 512 bytes.
 */
export async function forwardCacheKey(
  slug: string,
  language: Locale,
  query: string,
): Promise<string> {
  const digest = await sha256Hex(normalizeGeocodeQuery(query))
  return `geo:${GEO_CACHE_VERSION}:${slug}:f:${language}:${digest}`
}

/**
 * `geo:v1:{slug}:r:{language}:{lat},{lng}`.
 *
 * Plain, because two rounded numbers are bounded by construction and readable in a dump. Four
 * decimal places is about eleven metres: the same doorway, whoever dropped the pin — the same
 * rounding `transitCacheKey` uses and for the same reason.
 */
export function reverseCacheKey(
  slug: string,
  language: Locale,
  lat: number,
  lng: number,
): string {
  return `geo:${GEO_CACHE_VERSION}:${slug}:r:${language}:${lat.toFixed(4)},${lng.toFixed(4)}`
}

/* --------------------------------------------------------------------- proxy */

/** The provider seam. `./geoapify` implements it; a test hands over a stub. */
export interface GeocodeProvider extends GeocodeVendor {
  forward: (query: ForwardQuery) => Promise<ReadonlyArray<GeocodeCandidate>>
  reverse: (query: ReverseQuery) => Promise<ReadonlyArray<GeocodeCandidate>>
}

export interface GeocodeRuntime {
  /** Where answers are kept — shared across every tenant, on purpose. */
  readonly cache: GeoCache
  /** Where allowances are tallied — per workspace, on purpose. */
  readonly counters: RateCounterStore
  /**
   * Who this deployment speaks for. Present even when {@link GeocodeRuntime.provider} is `null`,
   * because the slug is in the cache key and the attribution is not optional on a result.
   */
  readonly vendor: GeocodeVendor
  /** `null` on a deployment holding no credential; see `./bindings`. */
  readonly provider: GeocodeProvider | null
  /** The provider ledger's runtime, so every vendor call is counted and blockable. */
  readonly outbound: OutboundRuntime
  readonly organizationId: string
  /** `resolveLimits().rates.geocode_lookups_per_month` for this workspace. */
  readonly ceiling: number
  readonly now: () => Date
  readonly logger?: { warn: (message: string, fields?: unknown) => void } | null
}

async function cached(
  runtime: GeocodeRuntime,
  key: string,
): Promise<ReadonlyArray<GeocodeCandidate> | null> {
  let raw: string | null = null
  try {
    raw = await runtime.cache.get(key)
  } catch (cause) {
    // A cache that cannot be read is a miss, never a failure: the answer is one call away.
    runtime.logger?.warn('geo.cache.read_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return null
  }
  if (raw === null) {
    return null
  }
  try {
    const parsed = cachedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.candidates : null
  } catch {
    return null
  }
}

async function write(
  runtime: GeocodeRuntime,
  key: string,
  candidates: ReadonlyArray<GeocodeCandidate>,
): Promise<void> {
  // An empty answer is not cached. It is far more likely to be a vendor having a moment than a fact
  // about the world, and with no TTL a wrong empty would be permanent.
  if (candidates.length === 0) {
    return
  }
  try {
    await runtime.cache.put(key, JSON.stringify({ v: 1, candidates }))
  } catch (cause) {
    // Logged and swallowed: the answer is already in hand, and failing it over its own bookkeeping
    // helps nobody.
    runtime.logger?.warn('geo.cache.write_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/**
 * Positions 2, 4 and 5 of the order, which are identical for both directions.
 *
 * Split out rather than written twice because they are one rule about whether a *call* may be made,
 * and two copies of it would be two policies the day one of them is edited.
 */
function refuseBeforeTheMeter(runtime: GeocodeRuntime): GeocodeProvider {
  if (runtime.provider === null) {
    throw new GeoProviderError(
      'unconfigured',
      'Geocoding is not configured on this deployment.',
    )
  }
  if (runtime.provider.retention !== 'permanent') {
    throw new GeoProviderError(
      'unstorable',
      `The ${runtime.provider.slug} adapter does not declare permanent storage, so its answer may not be handed over.`,
    )
  }
  return runtime.provider
}

/** Position 6, and the shape of an answer that had to be paid for. */
async function spend(runtime: GeocodeRuntime): Promise<number> {
  // Throws `RateCeilingError`, which carries the metric, the ceiling and the amount spent. The
  // words a traveller reads are the rendering stage's, not this module's.
  return spendRateUnit(runtime.counters, {
    metric: 'geocode_lookups_per_month',
    organizationId: runtime.organizationId,
    ceiling: runtime.ceiling,
    now: runtime.now,
    logger: runtime.logger,
  })
}

/**
 * Position 7: the vendor call, with the provider ledger wrapped around it.
 *
 * The slug comes from `runtime.vendor` rather than from the provider, so the row a call is recorded
 * under is the same one the cache key was built from — one vendor identity, read once. The operation
 * distinguishes the two directions because they are separately interesting in the console: a spike
 * in reverse lookups is a map being dragged, a spike in forward ones is a form being typed into.
 *
 * `callProvider` decides nothing about the answer here: a candidate list is not a `Response`, so its
 * default failure check reads `false` and only a throw is an error — which is what a
 * {@link GeoProviderError} already is.
 *
 * @throws {ProviderBlockedError} when an operator has set the provider's policy to `block`.
 */
async function ask(
  runtime: GeocodeRuntime,
  operation: 'geocode.forward' | 'geocode.reverse',
  send: () => Promise<ReadonlyArray<GeocodeCandidate>>,
): Promise<ReadonlyArray<GeocodeCandidate>> {
  return callProvider(
    runtime.outbound,
    {
      provider: runtime.vendor.slug,
      operation,
      organizationId: runtime.organizationId,
    },
    send,
  )
}

function hit(
  runtime: GeocodeRuntime,
  candidates: ReadonlyArray<GeocodeCandidate>,
): GeocodeResult {
  return {
    candidates,
    // From `runtime.vendor` and not from `runtime.provider`, which may be `null` here.
    attribution: runtime.vendor.attribution,
    cached: true,
    spent: null,
    ceiling: runtime.ceiling,
  }
}

/**
 * Turn a typed address into ranked candidates with coordinates.
 *
 * @throws {GeoProviderError} unconfigured, unstorable, unreachable, refused or malformed.
 * @throws {RateCeilingError} when the workspace has spent its monthly allowance.
 * @throws {ProviderBlockedError} when an operator has stopped the provider deployment-wide.
 */
export async function forwardGeocode(
  runtime: GeocodeRuntime,
  input: ForwardQueryInput,
): Promise<GeocodeResult> {
  const query = forwardQuerySchema.parse(input)

  if (runtime.ceiling <= 0) {
    throw new RateCeilingError('geocode_lookups_per_month', runtime.ceiling, 0)
  }

  const key = await forwardCacheKey(
    runtime.vendor.slug,
    query.language,
    query.query,
  )

  const warm = await cached(runtime, key)
  if (warm !== null) {
    return hit(runtime, warm)
  }

  const provider = refuseBeforeTheMeter(runtime)
  const spent = await spend(runtime)

  const candidates = await ask(runtime, 'geocode.forward', () =>
    provider.forward(query),
  )
  await write(runtime, key, candidates)

  return {
    candidates,
    attribution: runtime.vendor.attribution,
    cached: false,
    spent,
    ceiling: runtime.ceiling,
  }
}

/**
 * Turn a point into an address — zero or one candidate.
 *
 * @throws {GeoProviderError} unconfigured, unstorable, unreachable, refused or malformed.
 * @throws {RateCeilingError} when the workspace has spent its monthly allowance.
 * @throws {ProviderBlockedError} when an operator has stopped the provider deployment-wide.
 */
export async function reverseGeocode(
  runtime: GeocodeRuntime,
  input: ReverseQueryInput,
): Promise<GeocodeResult> {
  const query = reverseQuerySchema.parse(input)

  if (runtime.ceiling <= 0) {
    throw new RateCeilingError('geocode_lookups_per_month', runtime.ceiling, 0)
  }

  const key = reverseCacheKey(
    runtime.vendor.slug,
    query.language,
    query.lat,
    query.lng,
  )

  const warm = await cached(runtime, key)
  if (warm !== null) {
    return hit(runtime, warm)
  }

  const provider = refuseBeforeTheMeter(runtime)
  const spent = await spend(runtime)

  const candidates = await ask(runtime, 'geocode.reverse', () =>
    provider.reverse(query),
  )
  await write(runtime, key, candidates)

  return {
    candidates,
    attribution: runtime.vendor.attribution,
    cached: false,
    spent,
    ceiling: runtime.ceiling,
  }
}
