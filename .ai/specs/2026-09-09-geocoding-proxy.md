# One geocoding proxy behind a provider port

Source issue: [#281](https://github.com/design4pro/planned.travel/issues/281) — "Location search when
adding a place: one geocoding proxy behind a provider port". Decided in ADR
`docs/adr/0013-geoapify-for-geocoding.md`; nine rounds of grilling on the issue closed every open
question it opened.

## 📝 TLDR

A place is added to a trip with no way to say where it is, because no server module turns a typed
address into a point. This spec mints that module — `src/server/geo/**` — as one proxy behind a
provider port: forward geocoding (text → ranked candidates with coordinates) and reverse geocoding
(a point → an address), with a cross-tenant unexpiring KV cache, a per-tenant monthly ceiling, typed
failure, and a declared retention right the module enforces. One adapter ships, Geoapify, and its
calls are counted in the provider ledger under a slug this change adopts. It needs no new
dependency, no migration and no user-facing copy; nothing is rendered, so done rests on unit tests
rather than on the blind A/B pair (docs/SPEC.md §7.4).

## 📝 Problem Statement

`src/server/geo/` does not exist. Every fact below was verified against `develop` rather than taken
from the plan:

| Link               | Where                                                                               | State                                                      |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Coordinate columns | `places.lat` / `places.lng` — the `geo()` spread, `src/server/db/schema.ts:211,896` | nullable; `places_lat_chk` allows both-null                |
| Address columns    | `places.address`, `.city`, `.country_code`                                          | present, nullable, filled by hand today                    |
| Provenance         | `places.source` (`PLACE_SOURCES`), `places.external_id`                             | `'search'` is already in the vocabulary and unreachable    |
| Vendor decision    | `docs/adr/0013-geoapify-for-geocoding.md`                                           | accepted 2026-08-30 — Geoapify, behind our own proxy       |
| Vendor slug        | `PLANNED_PROVIDERS` — `src/server/db/schema.ts:447`                                 | `geoapify` listed as decided-but-unwritten                 |
| Vendor credential  | `.dev.vars.example`                                                                 | no `GEOAPIFY_API_KEY` line                                 |
| Rate metrics       | `RATE_METRICS` — `src/server/billing/limits.ts:118`                                 | two metrics, both zero on Free                             |
| Per-tenant tally   | `src/server/transit/meter.ts`                                                       | metric-agnostic already, but private to the transit module |
| **The proxy**      | —                                                                                   | **none**                                                   |

Four consumers are waiting on the same missing piece and none of them can be written without it:
the address of a dropped pin (`02-S4`), address completion on the place form (`02-S11`),
search-as-you-type and share-link resolution (`02-S13`), and the confirmation import (`03-S7`,
[#178](https://github.com/design4pro/planned.travel/issues/178), `status: ready` today), which
extracts a hotel's name and address and has nowhere to get a pin from. A place created without
coordinates is a place the map draws nothing for, which is the state the product is in.

### Why this is one item and not four

ADR 0013 assigns `src/server/geo/geocode.ts` to `02-S4` in plan 02's wave 3. Round 1 of the grilling
overrode that: under docs/SPEC.md §8 a geocoding proxy is one concept with one owner, plan 02 has no
PRD and no tickets in the tracker, and three of the four consumers sit in stages that would each have
to re-derive the same cache key, the same ceiling and the same failure vocabulary. This issue takes
the ownership; ADR 0013's assignment sentence is corrected when plan 02's PRD lands.

### What this is not

Not a place-search UI, not a second vendor, not routing. The component, its results list, its
23-locale copy and the mandatory Geoapify/OSM attribution belong to `02-S4`, `02-S11` and `02-S13`.
Gate B (`MAP-08`, `MAP-09`) stays open and is untouched.

## 📝 Resolved assumptions (autonomous defaults)

The issue's grilling log closed its own five open questions before this spec was written. Three
gaps remained, and this autonomous run resolved them as follows. Every one is a single constant or
a single line, and all three are reversible without touching a consumer.

**All three are settled.** Q1 was the one carrying `⚠ NEEDS HUMAN CONFIRMATION`; it was confirmed
as proposed on 2026-09-09, so no assumption in this document is still waiting on a decision.

| #   | Question                                                                                     | Applied default                                                      | Why                                                                                                                                                                                                                                                                                                   | Confirm?  |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Q1  | What are the per-plan figures for the new rate metric, given that Free must not be zero?     | `free: 200`, `solo: 2 000`, `crew: 8 000` lookups per calendar month | Sized against the work, as the two siblings are: Free's catalogue entry sells two trips, and a trip of twenty places costs roughly a hundred debounced lookups. Solo is an order above transit because geocoding is per-keystroke; Crew keeps the four-times step the other two metrics already have. | confirmed |
| Q2  | Where does the lifted rate meter live?                                                       | `src/server/metering/rate.ts`, beside `outbound.ts`                  | Its own header already inherits both of `outbound.ts`'s postures by name, so the two are the same subject. A new top-level directory for one file would be a third home for metering.                                                                                                                 | ok        |
| Q3  | Does the cache key carry the traveller's BCP-47 tag or the language code sent to the vendor? | The BCP-47 tag                                                       | The issue costed the language at "up to 23 entries per query" and this is that number. Keying on the vendor code would push a vendor-specific mapping into a key the port is supposed to keep vendor-neutral.                                                                                         | ok        |

**Q1 was asked, and answered.** The issue's own Boundaries section says "Ask first: any per-plan
figure" and plan 02 has no PRD to take the number from, so the figures were put to a human rather
than taken by the run. They were confirmed as proposed. They remain cheap to revise: `rates` reaches
no rendered surface today — `EffectiveLimits.rates` has exactly one consumer,
`src/server/fns/transports.ts:696`, and no pricing or billing screen reads it — so changing them
later is a one-line edit with no copy to follow.

**Q1's arithmetic assumes a debounced client, and this module cannot enforce one.** "A hundred
lookups per trip" is a hundred _settled_ queries; an undebounced type-ahead spends one per
keystroke and would exhaust Free's 200 inside two place names. Round 7 put debounce and
cancel-on-supersede with the UI stages because the server can observe neither, so the figure is a
number handed over together with an obligation: `02-S11` and `02-S13` must debounce before their
first request, and a consumer that does not is not a consumer these figures were sized for. This is
recorded as a contract rather than a hope, and it is the first thing to re-check if a workspace
reaches the ceiling.

## 📝 Proposed Solution

One directory, `src/server/geo/**`, arranged exactly as `src/server/transit/**` is, because that
module already answers the same three questions and the issue named it as the precedent to follow
rather than reinvent:

- **`geocode.ts`** decides _whether_ a call is made: it parses the input, reads the cross-tenant
  cache, refuses an unconfigured or non-storing provider, spends one unit of the workspace's monthly
  allowance, makes the call through the provider ledger, and writes the answer back. Every consumer
  enters here.
- **`geoapify.ts`** is the vendor, and nothing outside the directory imports it. It holds the
  endpoint, the wire schemas, the locale→language mapping, the declared retention right and the
  vendor credits.
- **`bindings.ts`** is the single seam that touches `cloudflare:workers`, which is what lets the
  other two be tested with a fake `fetch` and maps for the stores.

The port is one interface with one adapter and **no chain and no fall-through**. Round 2 of the
grilling killed the ordered registry: ADR 0013 rejected HERE and Google on their own terms, so
adopting either is a commercial decision plus a new ADR, and an ordered registry today is machinery
for a vendor nobody may add. The retention right stays on the port as a declared property, which is
the whole of ADR 0013's decisive term at a fraction of the surface — and with one adapter, nothing
can cross a retention boundary mid-request.

### Alternatives considered

- **A geocoding client called directly from each consumer's server function.** Rejected: the cache
  key, the ceiling and the failure vocabulary would then be four implementations of one rule, and
  docs/SPEC.md §8 says a cache key's shape is a concept with one owner.
- **Copying `meter.ts` into `src/server/geo/`.** Rejected for the same reason. It is already written
  to be metric-agnostic, so lifting it costs an import rewrite in three files and copying it costs a
  second implementation of a counter key two other callers depend on.
- **A per-tenant ceiling on a day window, mirroring Geoapify's own 3,000-credits-a-day term.**
  Rejected in round 3. A day window would make `rateWindowOf`, the counter key and
  `PLAN_RATE_CEILINGS` window-aware, and all three are shared with transit and with `03-S7`. The
  vendor's day term is the operator's vendor-level ceiling and belongs in
  `provider_registry.limit_window`, which already accepts `day`.
- **Separate ceilings for forward and reverse lookups.** Rejected in round 3: two metrics for one
  purchased allowance is two numbers a plan has to publish and a reader has to understand, and the
  cheaper of the two would be the one nobody ever reaches.
- **Enforcing debounce or cancel-on-supersede server-side.** Rejected in round 7. Debounce is a
  property of a keyboard and cancel-on-supersede of an in-flight request; the server can observe
  neither, and the only approximation is a short-window limiter, which is exactly where KV's
  non-atomic increment is least trustworthy. Query length is the one cost control that is a fact
  about the request, and it is enforced here.

## 📝 Architecture

### `src/server/geo/geocode.ts` — new

The proxy. Holds the vocabulary, the input schemas, the result types, the failure type, the cache
keys and the two orchestrating functions.

**The order of operations is the whole contract**, and it is the transit order with two checks
inserted:

```
parse → plan gate → cache → configured? → may we store it? → meter → ledger → vendor → cache write
```

Each position is load-bearing:

1. **Parse first.** A query below the minimum or above the maximum length is refused before KV is
   touched at all — a malformed question should not cost a round trip, and the normalisation the
   key needs happens here anyway.
2. **The plan gate before the cache.** A ceiling of zero is a plan boundary rather than a rate
   limit, and the key carries no organization id: left behind the cache, a workspace excluded from
   the feature would be served real answers any other workspace had already paid for. This branch
   is unreachable under the figures in Q1 and stays because it is the boundary, not because it
   fires.
3. **The cache before the meter.** A cached answer costs nothing and must therefore spend nothing.
4. **Unconfigured after the cache and before the meter.** A deployment whose credential was removed
   still serves what it already holds, and must not spend a workspace's allowance on a call that
   never leaves the Worker.
5. **The retention check before the meter.** Refusing a result we may not store _after_ paying for
   it charges a workspace for nothing. Checking the adapter's declaration up front is strictly
   cheaper and also keeps the cache from ever holding an unstorable answer.
6. **The meter before the vendor**, or the ceiling is advisory.

```ts
/** What a vendor's licence permits us to do with a coordinate it returned. */
export type GeocodeRetention = 'permanent' | 'ephemeral'

/**
 * A credit the vendor's licence obliges us to carry. A proper noun and a link,
 * never a sentence — see the Copy section for why the sentence around it is a
 * catalogue key and this is not.
 */
export interface GeocodeCredit {
  /** As the licence spells it: `'OpenStreetMap'`, `'Geoapify'`. */
  readonly name: string
  readonly url: string
}

/**
 * Who answers, and on what terms. Known to the deployment whether or not a
 * credential is set, because which adapter this build imports is a fact about
 * the build and not about the key it was handed.
 */
export interface GeocodeVendor {
  readonly slug: MeteredProvider
  readonly retention: GeocodeRetention
  /** Travels with a stored coordinate — ADR 0013's condition on the storage right. */
  readonly attribution: ReadonlyArray<GeocodeCredit>
}

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
  /** Who this deployment speaks for. Present even when `provider` is `null`. */
  readonly vendor: GeocodeVendor
  /** `null` on a deployment holding no credential; see the transit seam's header. */
  readonly provider: GeocodeProvider | null
  /** The provider ledger's runtime, so every vendor call is counted and blockable. */
  readonly outbound: OutboundRuntime
  readonly organizationId: string
  /** `resolveLimits().rates.geocode_lookups_per_month` for this workspace. */
  readonly ceiling: number
  readonly now: () => Date
  readonly logger?: { warn: (message: string, fields?: unknown) => void } | null
}

export async function forwardGeocode(
  runtime: GeocodeRuntime,
  input: ForwardQueryInput,
): Promise<GeocodeResult>

export async function reverseGeocode(
  runtime: GeocodeRuntime,
  input: ReverseQueryInput,
): Promise<GeocodeResult>
```

**Why `vendor` sits beside `provider` rather than inside it.** Position 4 of the order promises that
a deployment whose credential was removed still serves what the cache already holds. That promise
needs two facts a cache hit cannot get from a `null` provider: the **slug**, because it is in the
cache key, and the **attribution**, because `GeocodeResult.attribution` is not optional and ADR 0013
says a stored coordinate carries its credit. Both are properties of the adapter this build imports,
not of the key it was given, so they live on `GeocodeVendor`, which `bindings.ts` always supplies —
`geoapifyVendor` is a module-level constant in `geoapify.ts` and `createGeoapifyClient` is what
returns `null` without a key. `GeocodeProvider extends GeocodeVendor`, so a configured deployment
still has one object to hand a test and the adapter still declares its own slug, retention and
credits in one place; the runtime just reads them from `runtime.vendor`, whose presence does not
depend on the credential. Without the split, position 4 is unimplementable.

Both answer the same envelope, because a reverse lookup is a forward lookup with a different
question and returning a second shape would give every consumer two result types to narrow:

```ts
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
```

The attribution sits on the envelope rather than on each candidate because it is a property of the
vendor that answered, not of a row: a caller stores one candidate out of one result and the credit
it must keep is one field away either way. Repeating it five times would be five copies of one fact
in a shape a consumer serialises to the browser. It is a `GeocodeCredit` and not a rendered string
for the reason the Copy section gives: a name and a URL are the vendor's, a sentence is ours and
belongs in the catalogue.

**Normalisation and the cache key.** The query is folded for the key and sent to the vendor
unfolded — the vendor should see what the traveller typed, and only the key needs two spellings of
one question to collide:

```ts
export function normalizeGeocodeQuery(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()
}
```

`toLowerCase()` and not `toLocaleLowerCase()`, deliberately: a locale-sensitive fold makes `İSTANBUL`
lower-case differently for a Turkish reader than for a Polish one, and the key has to be the same
string for both or the cross-tenant cache stops being one.

```ts
const GEO_CACHE_VERSION = 'v1'

/** Hashed, because a free-text query is unbounded and a KV key caps at 512 bytes. */
export async function forwardCacheKey(
  slug: string,
  language: Locale,
  query: string,
): Promise<string> // `geo:v1:{slug}:f:{language}:{sha256hex}`

/** Plain, because two rounded numbers are bounded by construction and readable in a dump. */
export function reverseCacheKey(
  slug: string,
  language: Locale,
  lat: number,
  lng: number,
): string // `geo:v1:{slug}:r:{language}:{lat.toFixed(4)},{lng.toFixed(4)}`
```

Four decimal places is about eleven metres: the same doorway, whoever dropped the pin — the same
rounding `transitCacheKey` uses and for the same reason.

The key carries **no tenant identifier**, which is ADR 0013's term and the property that makes an
unexpiring shared cache legal. It carries the provider slug — `runtime.vendor.slug`, so the key is
still buildable on a deployment holding no credential — so that a second adapter, if one is ever
adopted, cannot read answers the first one gave; and it carries the language because a geocoder
answers _in_ a language, so the language is part of the question rather than a fact about who asked.

**The cache does not expire.** `put` is called without `expirationTtl`, unlike
`TRANSIT_CACHE_TTL_SECONDS`. That an address resolves to a point is a public fact that does not go
stale in the way a timetable does, and permanent storage is precisely the right ADR 0013 bought.
`GEO_CACHE_VERSION` is the only eviction lever, which is why it exists.

**Empty answers are not cached.** An empty result is far more likely to be a vendor having a moment
than a fact about the world, and with no TTL a wrong empty would be permanent. Every entry is
re-validated on read against the same Zod schema the vendor's answer passes, so an entry written by
an older build is a miss rather than a misreading.

### `src/server/geo/geoapify.ts` — new

The vendor module, named for the vendor so that replacing it is a file and not a search. `fetch` is
a parameter and the API key is a string handed in, exactly as `here.ts` takes them: no test in this
repository calls Geoapify and none can.

It owns four things nothing else may know:

- The endpoints (`/v1/geocode/search`, `/v1/geocode/reverse`) and a timeout in the shape
  `HERE_TIMEOUT_MS` has.
- The wire schemas, and the mapping from the vendor's feature properties to `GeocodeCandidate`.
- **The locale→language mapping.** Twenty of our twenty-three tags are already bare ISO 639-1 codes;
  the three that are not (`pt-BR`, `zh-Hans`, `zh-Hant`) collapse to `pt` and `zh`. Two `zh` readers
  therefore receive the same script from the vendor, which is a quality loss owned by the vendor's
  parameter and not by this design; it is recorded here so the surface stages do not rediscover it.
- **The declared retention right**, as an exported `geoapifyVendor: GeocodeVendor` constant:
  `slug: 'geoapify'`, `retention: 'permanent'`, and `attribution` carrying the OSM credit always and
  the Geoapify credit while we are on the free plan — each a `GeocodeCredit`, a proper noun and a
  URL, never a sentence.

`geoapifyVendor` is a module-level constant precisely because it must outlive the credential:
`createGeoapifyClient` refuses an empty key by throwing `GeoProviderError('unconfigured')`, so the
binding seam can hand `null` to the proxy rather than a client that fails after the meter has run —
the same arrangement, and the same reason, as `hereClient()`. The client it does return spreads
`geoapifyVendor`, so a configured deployment satisfies `GeocodeProvider` from the one declaration.

### `src/server/geo/bindings.ts` and `cloudflare-env.d.ts` — new

The seam. `cache` and `counters` are both `env.KV` in two roles that must not be confused; `outbound`
is `requestOutboundRuntime()` from `src/server/metering/bindings.ts`; `vendor` is `geoapifyVendor`,
handed over unconditionally; `provider` is the Geoapify client or `null`, and only that field depends
on whether a key is set. `GEOAPIFY_API_KEY` is declared as an optional `Cloudflare.Env` member in a sibling
`cloudflare-env.d.ts`, word for word the arrangement `src/server/transit/cloudflare-env.d.ts`
documents, and added to `.dev.vars.example`.

`bindings.ts` ships with **no caller**, and that is deliberate rather than an oversight: it is what
"one proxy, minted once" means, its first caller is `02-S4`'s route-local `-server/geocode.ts`, and
the alternative is that the next stage re-derives the seam and this module's testability with it.
`src/server/transit/bindings.ts` shipped the same way.

### `src/server/transit/meter.ts` → `src/server/metering/rate.ts` — moved

Lifted, not copied (docs/SPEC.md §8), and lifted **unchanged**: no window argument, no new
parameter, and above all no change to `rateMeterKey`, whose current string is what transit's tally
and `03-S7`'s share. The move exists because the file now has three callers and lives inside the
directory of one of them.

`src/server/metering/` is the destination because `meter.ts`'s own header already names
`outbound.ts` as the source of both of its postures — the gate fails open, recording fails open and
silent — so the two files are one subject filed apart.

Everything that imports it, in full (`grep -rn 'RateCeilingError\|spendRateUnit\|rateMeterKey\|rateWindowOf\|RateCounterStore'`):

| File                                                | Change                                 |
| --------------------------------------------------- | -------------------------------------- |
| `src/server/transit/search.ts:39,41`                | import path only                       |
| `src/server/fns/transports.ts:42`                   | import path only                       |
| `src/server/transit/__tests__/search.test.ts:28-40` | the meter's cases move out — see below |

`src/components/modules/transports/connection-search.tsx:553` names `RateCeilingError` in a comment
and imports nothing; it is left alone.

### Files this spec does **not** touch

`src/routes/**`, `src/components/**`, `src/lib/i18n/messages/**`, `drizzle/**`, `wrangler.jsonc`,
and every file the place-search UI stages own. No route, no server function, no rendered surface and
no locale key.

## 📝 Data Model

**No migration.** This was verified rather than assumed, and it is the reason adopting the vendor
slug is cheap:

- `provider_registry.slug` carries **no `CHECK`** (`src/server/db/schema.ts:2915` states why: an
  operator agrees a ceiling before we write the client, and a constraint from a tuple in that file
  would make configuration wait on a deploy).
- `provider_usage.provider` is `$type`-narrowed and not `CHECK`-constrained
  (`src/server/db/schema.ts:3008`), because the vocabulary grows by amendment and a `CHECK` prices
  each amendment at a table recreate.

So moving `geoapify` from `PLANNED_PROVIDERS` to `METERED_PROVIDERS` is a TypeScript change with no
SQL behind it. `pnpm db:generate` must produce no new migration; if it does, something else moved
and the step is wrong.

`places` is untouched. In particular **no attribution column is added**: the attribution is a
constant of the provider that answered, and `places.source = 'search'` plus `places.external_id`
already record where a coordinate came from. Whether a surface needs the string denormalised onto
the row is `02-S4`'s decision to take against its own rendering, not this module's to pre-empt.

The runtime D1 effects are the ordinary ones every metered provider has: `provider_usage` rows
written by `callProvider` under the `geoapify` slug, and an optional `provider_registry` row an
operator creates in the console to set the vendor-level ceiling. A missing registry row is the open
state, so nothing has to be seeded.

### `src/server/billing/limits.ts` — edited

```ts
export const RATE_METRICS = [
  'transit_searches_per_month',
  'extraction_calls_per_month',
  'geocode_lookups_per_month',
] as const

export const PLAN_RATE_CEILINGS = {
  free: {
    transit_searches_per_month: 0,
    extraction_calls_per_month: 0,
    geocode_lookups_per_month: 200,
  },
  solo: {
    transit_searches_per_month: 250,
    extraction_calls_per_month: 100,
    geocode_lookups_per_month: 2_000,
  },
  crew: {
    transit_searches_per_month: 1_000,
    extraction_calls_per_month: 400,
    geocode_lookups_per_month: 8_000,
  },
}
```

The doc comment above `PLAN_RATE_CEILINGS` currently reads "**Free is zero for both**, because Free
cannot open the booking desk at all". It must be rewritten rather than extended, because the new
metric is the first one that breaks its rule and the reason it breaks it is the interesting part:
the two existing metrics are zero on Free because `reservations` is off in Free's catalogue entry
and neither call is reachable from anywhere else, while the place form is not off — Free's own
entry sells "a day-by-day itinerary and map" and "a map of the places you want to see"
(`src/lib/plans.ts:246,254`), and a zero here would contradict a claim the pricing page makes.

The figures themselves are Q1's and are confirmed. They are also invisible: `rates` reaches no
rendered surface today, so nothing published has to move with them.

## 📝 API Contracts

**No server function and no route ships in this change.** The module's exported functions are the
contract, and the first `createServerFn` wrapper around them is `02-S4`'s route-local
`-server/geocode.ts`, exactly as ADR 0013 describes. Recorded so the next stage knows what it is
handed and what it owes:

| Export                                      | Input                                            | Answers                                   | Throws                                                         |
| ------------------------------------------- | ------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------- |
| `forwardGeocode(runtime, input)`            | `{ query: string, language: Locale }`            | `GeocodeResult`                           | `GeoProviderError`, `RateCeilingError`, `ProviderBlockedError` |
| `reverseGeocode(runtime, input)`            | `{ lat: number, lng: number, language: Locale }` | `GeocodeResult`, 0 or 1 candidates        | the same three                                                 |
| `forwardQuerySchema` / `reverseQuerySchema` | —                                                | the Zod shapes the server function reuses | —                                                              |
| `geoRuntime({ organizationId, ceiling })`   | —                                                | `GeocodeRuntime` bound to this Worker     | —                                                              |

Validation, per docs/SPEC.md's rule that every server-function input is validated with Zod — the
schemas live here so the wrapper reuses them instead of writing a second, looser copy:

```ts
export const GEOCODE_QUERY_MIN_LENGTH = 3
export const GEOCODE_QUERY_MAX_LENGTH = 160
/** How many candidates the vendor is asked for. Five is a list a person reads. */
export const GEOCODE_CANDIDATES = 5

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
```

There is deliberately **no `limit` parameter**. A caller-chosen count would enter the cache key —
or, worse, would not, and a request for ten would be served a cached five. The module asks for
`GEOCODE_CANDIDATES` every time and a consumer that wants three slices three, which is what
`here.ts`'s fixed `ALTERNATIVES` does for the same reason.

There is also **no proximity bias**. Biasing results toward the trip's centre would improve them
and would put a coordinate into the cache key, multiplying every entry by the places a traveller
might be near. It is recorded as a future question for `02-S13`, not taken here.

### Failure vocabulary

```ts
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

export class GeoProviderError extends Error {
  constructor(
    readonly reason: GeoFailureReason,
    message: string,
    readonly status: number | null = null,
    options?: { cause?: unknown },
  )
}
```

Four of the five are `TransitFailureReason`'s, spelled the same way on purpose so a reader who knows
one module knows the other; `unstorable` is the one this port adds and it is what makes the retention
right enforceable rather than declared. The messages are developer-facing English on an error object.

**No refusal prose is authored here.** `RateCeilingError`'s message today is transit-specific
(`'…all N of its searches this month'`), and
[#220](https://github.com/design4pro/planned.travel/issues/220) replaces it with carried facts
(`metric`, `ceiling`, `spent`). That issue is a **precondition** of this one, decided in round 6:
folding it in would mean editing `searchConnectionsFn` and the surface that renders its refusal,
which is UI and copy in files this change does not own. Implemented before #220 lands, a geocoding
refusal would tell a traveller they had run out of _searches_, which is why the ordering is a
prerequisite and not a preference.

## 📝 UI/UX

None. This change ships no component, no route and no state a traveller can reach. The place-search
field, its results list, its empty and error states and the mandatory Geoapify/OSM attribution
belong to `02-S4`, `02-S11` and `02-S13`.

## 📝 Visual change expected

**None — backend-only work.** No route renders differently in light or dark, on desktop or mobile,
in any of the 23 locales. There is no screen to photograph, so docs/SPEC.md §7.4's blind A/B pair
does not apply and done rests on §7.1–7.3: `pnpm build`, `pnpm lint`, `pnpm typecheck` and
`pnpm test` (round 1 of the grilling settled this explicitly).

The screens that _will_ change once a consumer calls this module — the place form, the map's pin
drop, the confirmation import review — change in the stages that own them, and those stages carry
their own visual verification.

## 📝 Copy

**No new user-facing strings.** Zero keys are added to the 23-locale catalogue and no existing key
changes, so the i18n parity test is unaffected.

Three near misses, recorded so a reviewer does not go looking:

- `GeoProviderError`'s messages are developer-facing English on an error object, never rendered.
  The stage that renders a failed lookup mints its own keys against `reason`.
- `RateCeilingError`'s message belongs to #220 and is not touched here.
- The Geoapify and OSM credits are **not an exception to the catalogue rule** — they are split along
  the line this repository already draws for exactly this obligation. `geoapify.ts` holds only the
  `GeocodeCredit` pairs: `{ name: 'OpenStreetMap', url: … }` and `{ name: 'Geoapify', url: … }`, a
  proper noun and a link, with no word for a translator to touch. Every word around them is a
  catalogue key the rendering stage adds, which is what `src/lib/i18n/messages/en/atlas.ts:67`
  already does — `'map.attribution.label': 'Map data from'` is the copy, the credit beside it is the
  proper noun. A stage that prefers one sentence to a label plus a pill writes a
  `footer.attribution`-shaped key instead (`src/lib/i18n/messages/en/marketing.ts:332`, translated in
  all 23 locales with the vendor names embedded and **not** on the parity test's `PROPER_NOUNS`
  allow-list). Either way the sentence lives in the catalogue and this module ships zero copy —
  which is why the earlier claim that these were "vendor credits, not translated copy" was the wrong
  frame, and is retracted here rather than carried into `02-S4`.

## 📝 Edge Cases & Failure Scenarios

| Case                                                               | Behaviour                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query shorter than 3 or longer than 160 characters                 | Zod refuses before KV is read. No allowance spent, no call.                                                                                                                     |
| `"  Plaza   Mayor "` versus `"plaza mayor"`                        | One question: trimmed, whitespace-collapsed, NFC-normalised and lower-cased into one key.                                                                                       |
| Two workspaces, same query, same language                          | Identical key, so the second is a cache hit: `spent: null`, `cached: true`, no vendor call.                                                                                     |
| Same query, two languages                                          | Two keys, two calls, two entries. Accepted cost — up to 23 per query, and reuse only among readers of one language.                                                             |
| Workspace at its ceiling                                           | `RateCeilingError` carrying `metric`, `ceiling` and `spent` (post-#220), thrown before the vendor is reached.                                                                   |
| Deployment with no `GEOAPIFY_API_KEY`                              | `provider` is `null` but `vendor` is not, so the key and the credits are still in hand: cache hits answer, a miss throws `GeoProviderError('unconfigured')` and spends nothing. |
| Adapter declaring `retention: 'ephemeral'`                         | `GeoProviderError('unstorable')` before the meter. Unreachable with the shipped adapter; asserted with a stub, which is what makes criterion 7 a test rather than a note.       |
| Vendor times out / DNS fails                                       | `unreachable`. Counted as a call in the ledger, because a timeout usually reached the vendor and is billable.                                                                   |
| Vendor answers 401 / 429 / 5xx                                     | `refused`, with the status carried. Counted as a call and as an error.                                                                                                          |
| Vendor answers 200 with an unexpected body                         | `malformed`. No bare `fetch` rejection or `ZodError` escapes the module.                                                                                                        |
| Vendor answers zero features                                       | An empty `candidates` array — an answer, not a failure. Not written to the cache.                                                                                               |
| Operator has set `policy: 'block'` and the vendor ceiling is spent | `callProvider` throws `ProviderBlockedError` before the vendor is reached, and records the attempt as `blocked`.                                                                |
| KV read fails                                                      | Treated as a miss and logged, never as a failure — the answer is one call away. Inherited posture.                                                                              |
| KV write fails                                                     | Logged and swallowed. The answer is already in hand and failing it over its own bookkeeping helps nobody.                                                                       |
| Two lookups from one workspace in the same instant                 | Both may read `n` and write `n + 1`. Known, bounded and inherited: the loop a ceiling exists to catch is thousands of calls, not two.                                           |
| Cache entry written by an older build                              | Fails the read-side schema parse and is treated as a miss.                                                                                                                      |

**One ordering is imperfect and is accepted knowingly.** The workspace's unit is spent before
`callProvider` consults the operator's block gate, so a call refused at our own gate has already
cost a tenant one lookup. Inverting it means splitting `shutGate` out of `callProvider` and
re-implementing half of `outbound.ts` here, which is a second copy of a rule two callers share; and
the operator block is an emergency control that is off in the ordinary case, so the interaction is
rare by construction. [#214](https://github.com/design4pro/planned.travel/issues/214) makes transit
the second caller with the same seam, and is the right place to decide it once for both.

## 📝 Risks & Impact Review

| Risk                                              | Blast radius                                         | Mitigation                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moving `meter.ts` breaks the transit tally        | Connection search stops metering or stops working    | The move is mechanical; `rateMeterKey` is unchanged and asserted so; the meter's existing cases move with it and their bodies are not edited                                                                                                                                      |
| An unexpiring cache holds a wrong answer for ever | One query, in one language, permanently mis-resolved | Empty answers are never cached; entries are re-validated on read; `GEO_CACHE_VERSION` is the eviction lever and exists for exactly this                                                                                                                                           |
| Free being non-zero opens a new abuse surface     | Vendor credits spent by workspaces paying nothing    | 200 a month is a small number, the cache is shared so repeated questions are free, and `provider_registry` + block policy is the operator backstop                                                                                                                                |
| Plan figures ship unreviewed                      | One constant, invisible to any screen                | Retired: Q1 gated the merge of this spec until a human confirmed the three figures, which they did                                                                                                                                                                                |
| Implemented before #220                           | A geocoding refusal reads as a transit refusal       | Stated as a precondition; the implementation PR should not open until #220 has merged                                                                                                                                                                                             |
| `bindings.ts` ships with no caller                | A dead export until `02-S4`                          | Deliberate and documented in the file header; the same shape `src/server/transit/bindings.ts` shipped in. If `02-S4` has not started by the time plan 02's PRD lands, the module is unexercised code with a maintenance cost and the schedule, not the design, is what to revisit |
| An undebounced consumer blows through Free's 200  | A Free workspace refused mid-place-form              | The obligation is stated with the figures and handed to `02-S11` and `02-S13`; the server enforces query length, which is the only half it can see                                                                                                                                |
| The vendor slug move touches console fixtures     | Two test files assert `geoapify` is _planned_        | Enumerated below and owned by this change under docs/SPEC.md §8                                                                                                                                                                                                                   |

**Rollback.** Every part is additive or mechanical. Phase 2 reverts by deleting `src/server/geo/`
and moving the slug back — no data has been written that a rollback strands, because
`provider_usage` rows under a slug that is no longer metered are historical accounting and the
console already renders a planned slug's counters. Phase 1 reverts by moving one file back and
rewriting three imports. There is no migration to reverse and no user-visible state to restore.

**Backward compatibility.** No public surface changes: no route, no server function, no column, no
config format. `RATE_METRICS` grows by one member, which widens a `Record` type rather than
narrowing it, and `quota_overrides` cannot name a rate metric so no stored value is affected.

**The concept this change owns**, enumerated per docs/SPEC.md §8's "give the owner the whole grep
result" rule — the membership of `geoapify` in the two provider lists:

| File                                                      | Why it is in scope                                     |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `src/server/db/schema.ts:413,444`                         | the two lists themselves, and their doc comments       |
| `src/server/db/types.ts:293`                              | a comment that names `geoapify` as the planned example |
| `src/server/fns/console/providers.ts:192`                 | the same, in the console's own explanation             |
| `src/server/fns/console/__tests__/providers.test.ts:145`  | a fixture asserting the slug is planned                |
| `src/server/catalog/__tests__/provider-usage.test.ts:645` | the same                                               |

## 📋 Phasing

**Phase 1 — the metric and the lifted meter.** A pure refactor plus one constant. It ships on its
own, changes no behaviour, and leaves the repository with a rate meter three modules can reach and a
geocoding allowance nothing spends yet.

**Phase 2 — the proxy, the adapter and the vendor slug.** Mints `src/server/geo/**` and adopts
`geoapify` into the ledger. It ships on its own too, and lands a module whose first caller is a
later stage.

Independently deployable, in this order: phase 2 imports the meter from its new home.

## 📋 Implementation Plan

Prerequisite: [#220](https://github.com/design4pro/planned.travel/issues/220) has merged. Each step
leaves the application working and is verified by the gate in `.ai/agentic.config.json`.

### Phase 1 — the metric and the lifted meter

1. **Move `src/server/transit/meter.ts` to `src/server/metering/rate.ts`** with no edit other than
   the header's opening sentence, and rewrite the imports in `src/server/transit/search.ts` and
   `src/server/fns/transports.ts`. Verify: `pnpm typecheck` clean, `pnpm test` green, and
   `git diff -M` reports the file as a rename.
2. **Move the meter's cases out of `src/server/transit/__tests__/search.test.ts`** into
   `src/server/metering/__tests__/rate.test.ts` — tests belong to the owner of the code they test.
   The import paths change; the assertion bodies do not. Verify: both suites green, and the
   `rateMeterKey` assertions still compare the same literal strings.
3. **Add `geocode_lookups_per_month`** to `RATE_METRICS` and to all three rows of
   `PLAN_RATE_CEILINGS` (`200` / `2 000` / `8 000`), and rewrite the "Free is zero for both"
   paragraph to say why this metric is the first that is not. Verify: `limits.test.ts` green,
   including its assertion that no rate metric is a `UsageMetric`.

### Phase 2 — the proxy, the adapter and the vendor slug

4. **Adopt the vendor slug.** Move `geoapify` from `PLANNED_PROVIDERS` to `METERED_PROVIDERS` and
   update the four doc comments and two fixtures enumerated above. This is the **first** step of the
   phase and not a later one: `GeocodeVendor.slug` is typed `MeteredProvider`, so an adapter written
   before the move cannot typecheck, and the invariant that every step leaves the gate green is what
   makes the ordering load-bearing rather than tidy. Verify: the console suites green,
   `pnpm db:generate` produces no migration, `pnpm typecheck` clean.
5. **Write `src/server/geo/geocode.ts`** — vocabulary, `forwardQuerySchema` / `reverseQuerySchema`,
   `GeocodeCredit` / `GeocodeVendor` / `GeocodeProvider`, `GeocodeCandidate` / `GeocodeResult`,
   `GeoProviderError`, `normalizeGeocodeQuery`, the two cache keys and the two orchestrators, driven
   by a stub provider and maps for the stores. Verify: a new
   `src/server/geo/__tests__/geocode.test.ts` covering the issue's success criteria 1–10 — the two
   workspaces producing one key, a hit spending nothing, a miss spending exactly one, the refusal
   before the vendor, the unconfigured deployment still serving the cache **from `runtime.vendor`
   alone, with `provider: null`**, the length bounds, the whitespace and case fold, the two
   languages not sharing an entry, and a stub declaring `ephemeral` being refused.
6. **Write `src/server/geo/geoapify.ts`** — endpoints, timeout, wire schemas, the candidate mapping,
   the locale→language table, and the exported `geoapifyVendor` constant (`slug: 'geoapify'`,
   `retention: 'permanent'`, the two `GeocodeCredit` pairs), with `fetch` injected. Verify: fixtures
   for a populated answer, an empty answer and each of `unreachable`, `refused` and `malformed`; a
   case asserting `pt-BR` → `pt` and both `zh-*` → `zh`; and a case asserting the key is never
   present in a thrown message.
7. **Wire the ledger.** Wrap the vendor call in `callProvider` with operations `geocode.forward` and
   `geocode.reverse`. Verify: criterion 11 — a call is recorded in `provider_usage` under `geoapify`
   and a `block` policy stops it.
8. **Write `src/server/geo/bindings.ts` and `src/server/geo/cloudflare-env.d.ts`**, and add
   `GEOAPIFY_API_KEY` to `.dev.vars.example`. Verify: `pnpm typecheck`, `pnpm build` and
   `bash .ai/scripts/check-generated.sh` clean.

### Out of scope, recorded so it is not re-derived

- A proximity bias on forward lookups — a real quality win, and it enters the cache key. `02-S13`'s
  question.
- Any second adapter, any provider chain, any fall-through rule.
- A denormalised attribution column on `places` — `02-S4`'s call against its own rendering.
- Splitting the operator block gate out of `callProvider` so a blocked call spends no tenant unit —
  #214's, once transit is the second caller.
- Debounce, minimum-length-before-request and cancel-on-supersede in the client. Out of scope but
  **load-bearing for Q1's figures**, per the note under the resolved assumptions — `02-S11` and
  `02-S13`.
