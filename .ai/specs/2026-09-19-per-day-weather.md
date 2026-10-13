# Weather for every day of a trip, from free sources we are licensed to use

| Field              | Value                                           |
| ------------------ | ----------------------------------------------- |
| **Status**         | in-progress                                     |
| **Issue**          | #631                                            |
| **Spec PR**        | #636                                            |
| **Implementation** | #1003, #1004, #1044, #1046, #1192, #1197, #1209 |

## 📝 TLDR

Every dated day of a trip that has a location gets a weather reading: a compact badge in the day
header of the planner, and a fuller reading behind it. The reading comes from one of three sources
chosen by how far the day is from today. Days inside the forecast window use a **forecast** from MET
Norway's Locationforecast. Past days use a **recorded** daily value from NASA POWER. Days beyond the
window use a climate **estimate** from NASA POWER's long-term means, which always carries a visible
marker. Both providers are free and licensed for commercial use. That is the one property that lifts
the block on `DOC-08` (`06-S7` in `docs/plans/06-documents-and-media.md`), and phase 1 records it as
ADR 0038. Three rules apply throughout. Readings are cached in the existing `KV` namespace under keys
that carry no tenant data. A whole trip is resolved in one batched server call. A reading that is
missing renders as missing, never as an invented number.

## 📝 Problem Statement

The planner shows no weather at all: `06-S7` records `DOC-08` as **absent**, and
`src/components/planner/day-section.tsx` has nothing to show. A traveller who wants to know whether a
day will rain has to leave the product to find out. The behaviour we are measured against is
`wiki: Weather-Forecasts`:

- a compact badge on each day;
- a fuller panel with minimum and maximum temperature, precipitation, wind, sunrise and sunset, and a
  coarse strip across the day;
- a source that changes with how far away the day is;
- a marker that separates an estimate from a forecast.

The reason nobody built this is recorded, and it is not an engineering one. `11-S3`
(`docs/plans/11-boundaries-and-blockers.md`) says **a tier whose terms exclude a commercial,
subscription-funded product is unusable to us**. The obvious free source fails that test: Open-Meteo's
free API terms say "You may only use the free API services for non-commercial purposes" and count
"apps that have subscriptions" as commercial. On 2026-09-19 the product owner took the decision
`11-S3` reserves for them (#631): use MET Norway plus NASA POWER. Both publish terms that allow
commercial use, and neither needs a key.

## 📝 Proposed Solution

### Source selection

Today is computed in the trip's time zone (`trips.timezone`, via `todayKeyIn` in `src/lib/time.ts`).

`recorded` and `estimate` rename `06-S7`'s `archive` and `climate`. The reason is the badge: those
two words are what its accessible name says to a reader, and the glossary should match what the
product says. Phase 1 step 2 updates `06-S7` to this vocabulary in the same change, so one set of
words survives.

| Day relative to today                                 | Kind       | Provider                         | What it gives                                                                                                                |
| ----------------------------------------------------- | ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| today … last day the forecast fully covers (≈ 9 days) | `forecast` | MET Norway Locationforecast 2.0  | min/max °C, precipitation mm, precipitation probability where given, max wind m/s, a condition symbol, and four 6-hour slots |
| before today, but inside POWER's publication lag      | `recorded` | none yet                         | nothing is published yet: the day renders "Not yet recorded", never a back-filled forecast                                   |
| before today, beyond that lag                         | `recorded` | NASA POWER daily point API       | min/max °C, precipitation mm/day, mean wind m/s at 2 m                                                                       |
| after the forecast's last full day                    | `estimate` | NASA POWER climatology point API | the long-term monthly mean min/max °C and precipitation for that day's month                                                 |

POWER publishes a day some time after it ends, and the delay is a property of the product rather
than of our code. `nasa-power.ts` holds it as `POWER_LAG_DAYS`, measured against the live API and
pinned with the date it was measured; days inside it are "Not yet recorded". This case is not
exotic - it is what a traveller sees on day 5 of their own trip, looking back at days 1 to 4, which
is the single most-viewed state this feature has. **`POWER_LAG_DAYS` must be verified against the
API before phase 2 merges**; if the honest answer turns out to be that the lag is long enough to
matter for a whole trip, the alternative is to persist each day's forecast reading as the day rolls
past, and that is a fourth KV shape and a change to this Data Model, not an implementation detail.

Sunrise and sunset are **computed, not fetched**. `src/lib/sun.ts` (new, pure) runs the standard NOAA
solar-position algorithm for a latitude, a longitude, a date and a time zone. That costs no request
and works for every kind.

The forecast window is not a constant. **Today is always a forecast day**, read from the hours still
ahead; the timeseries starts at the current hour. The window ends on the last local date for which
the MET response carries data for the whole day. That full-day rule applies only to the far end,
so the boundary moves with the provider rather than with our guess.

### What the provider terms bind us to (verified 2026-09-19)

- **MET Norway**, under CC BY 4.0 with commercial use allowed:
  - a `User-Agent` that identifies the application and gives a contact; a request without one is
    answered with 403;
  - responses are cached, and `Expires` / `If-Modified-Since` are honoured;
  - coordinates are truncated to at most 4 decimals;
  - at most 20 requests per second per application, spread out rather than simultaneous;
  - HTTPS, and gzip - which the Workers runtime negotiates on every outbound `fetch`, so no
    `Accept-Encoding` header is set by hand;
  - attribution is shown on screen.
- **NASA POWER** has no restriction on use, including commercial use, and asks to be cited. Its grid
  is roughly 0.5°. Near-real-time values settle into climate-quality values after 2-3 months, and the
  fill value for missing data is `-999`.

### Alternatives considered, and why they lost

- **Open-Meteo free API** (the reference product's source: forecast, archive and climate behind one
  API). Its non-commercial clause rules it out; this is the case `11-S3` names.
- **Open-Meteo commercial subscription.** Same capability, but a recurring bill. Once the free
  sources above cover the need, `docs/ARCHITECTURE.md` §8's budget does not justify it.
- **Meteostat.** CC BY-NC, excluded by the same clause.
- **A twelve-column 2-hour strip, as the reference renders it** (#631). Locationforecast's `compact`
  product carries `next_1_hours` for only the first two to three days; beyond that the finest step is
  six hours. A strip whose resolution changes between day 2 and day 4 of one trip is harder to read
  than a uniform one, so every forecast day gets four 6-hour slots. The `complete` product does not
  help: it adds parameters per step, not steps.
- **Per-date MET Sunrise 3.0 calls.** A trip of fourteen days would cost fourteen calls for numbers a
  pure function computes exactly.
- **Estimate from "the same date last year"** (a single past year, as `06-S7` sketched). One year is
  one sample: a freak day becomes the estimate. The monthly long-term mean is what a traveller packing
  for next spring actually needs, and one call covers every month of a location.
- **Fetching inside the plan loader.** `plan.tsx` runs `Promise.all` over three loaders, so any
  rejection renders `PlanError`. A provider outage must never take the planner down, and
  first paint must not wait for an external call.

## 📝 Architecture

**Owner (docs/SPEC.md §8): `src/server/weather/`, one concept: a weather reading for a place and a
date.** It follows `src/server/geo/`: a binding seam, vendor clients, and a policy module.

```
src/server/weather/
  weather.ts          policy: kind selection, KV read-through, metering, normalisation to DayReading
  met-norway.ts       vendor client: Locationforecast compact → normalised forecast days
  nasa-power.ts       vendor client: daily point + climatology point → normalised values
  bindings.ts         the only file importing `cloudflare:workers`; assembles WeatherRuntime
  cloudflare-env.d.ts
  __tests__/          weather.test.ts, met-norway.test.ts, nasa-power.test.ts, seam.test.ts
src/lib/sun.ts        pure sunrise/sunset (no I/O), shared by server and UI
src/routes/_app/trips/$tripId/-server/weather.ts   the trip-scoped server function
src/components/planner/day-weather-badge.tsx       badge + popover with the fuller reading
```

- **`WeatherRuntime`** mirrors `GeocodeRuntime` (`src/server/geo/geocode.ts:315`): `cache` (the same
  KV slice as `GeoCache`), `counters`, `outbound: requestOutboundRuntime()`, `organizationId`,
  `ceiling`, `now()`, `logger`, and the two vendor clients. `fetch` is injected into both clients,
  so tests drive them with a fake.
- **Ordering per location**: cache → plan gate (`ceiling <= 0`, or a budget already exhausted) →
  meter (`spendRateUnit`, once per outbound call) → vendor call inside
  `callProvider(outbound, { provider: 'met-norway' | 'nasa-power', operation, organizationId })` →
  cache write. A read or write error on KV is logged and treated as a miss, as `geocode.ts:336` and
  `:362` do.
- **The gate sits after the cache here, unlike geo, and that is deliberate.** `geocode.ts` gates
  first so a workspace at ceiling 0 is never served an answer another workspace paid for. That
  reasoning does not transfer: the weather metric meters **outbound calls**, and a cache hit makes
  none, so gating one would charge for a read that costs us nothing. Gating first would also
  contradict three things this spec already promises - the Edge Cases row "Cached days still
  render", AC4's "every **uncached** day", and the phase-3 journey, which seeds entries, sets the
  ceiling to 0, and expects the seeded days to render. Exhausting the budget therefore degrades the
  board rather than emptying it: cached days render, uncached days go `unavailable`, and no
  `RateCeilingError` reaches the caller - a ceiling is not an error on a read path that has an
  honest "we could not get this" state.
- **A failure is cached, because a spent unit cannot be refunded.** `spendRateUnit` increments a KV
  counter (`src/server/metering/rate.ts:129`) before the call, so an outage would otherwise bill
  every retry: a Free workspace reloading a three-location board during a thirty-minute MET outage
  would burn nine units a reload and eventually lock itself out of a feature that was never
  delivered. On any vendor error or timeout the policy writes
  `wx:v1:fail:<provider>:<lat4>:<lng4>` with a 5-minute TTL. While that entry is present the
  location's days of that provider's kinds resolve to `unavailable` **without an outbound call and
  without a meter spend**. The entry holds no tenant data, like every other key here.
- **Batching.** The server function groups the trip's days by rounded coordinate and makes **at most
  one call per location and kind** — not per provider, because NASA POWER answers two of the three
  kinds through two different endpoints:
  - one Locationforecast call covers every forecast day at that location;
  - one NASA daily call (`start`..`end` spanning the past days) covers every recorded day;
  - one climatology call covers every estimated day.

  A fourteen-day trip in one city costs at most three outbound calls on a cold cache, and none on a
  warm one.

- **MET's per-second cap is not bounded by a monthly ceiling.** `weather_lookups_per_month` is
  metered per organisation (`src/server/metering/rate.ts:77`, `PLAN_RATE_CEILINGS` keyed by
  `PlanId` at `src/server/billing/limits.ts:171`), so twenty workspaces opening a board in the same
  second are twenty simultaneous calls from one `User-Agent` while every monthly ceiling is intact.
  MET's limit is 20 requests per second **per application**. The bound is therefore stated here and
  checked in phase 2: at most one MET call per location, at most 12 locations per request (below),
  and a location re-validated no more often than its `Expires` (Data Model) - so reaching 20 req/s
  needs more than twenty distinct-location board opens inside one second, all of them cold or past
  `Expires`, which is far above our volumes. If the
  outbound counters (`src/server/metering/outbound.ts`) ever show that ceiling approached, the
  answer is a KV token bucket under `wx:v1:ratelimit:met-norway:<unix-second>`, and this paragraph
  is where that decision gets recorded.
- **User-Agent.** A checked-in constant in `met-norway.ts`, `planned.travel/1.0 (+https://planned.travel)`
  (a site link satisfies MET's contact rule). It is not a secret, and no credential exists for
  either provider, so `06-S7` constraint 1 (the secret) has nothing to store.
- **Units.** Values are stored and sent in metric. The UI converts at render using the reader's
  existing `distance_unit` (user over organisation, `src/server/repos/settings.ts:319-322`):
  `metric` → °C, mm, km/h, and `imperial` → °F, in, mph. No new preference and no column.

## 📝 Data Model

**No D1 change, no migration.** `journey_entries.weather` / `temperature_celsius` are unrelated,
because they hold what a traveller wrote. KV only, in the existing `KV` binding:

| Key                                         | Value                                                                                                                                               | TTL                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `wx:v1:forecast:<lat4>:<lng4>`              | `{ v:1, fetchedAt, lastModified, expires, series: RawStep[] }`: the provider's timeseries, trimmed to the fields we read, **not** grouped into days | 6 h, fixed — retention, not freshness (below)       |
| `wx:v1:recorded:<lat1>:<lng1>:<YYYY-MM-DD>` | `{ v:1, fetchedAt, day: RecordedDay }`                                                                                                              | 24 h if the date is under 90 days old, else 30 days |
| `wx:v1:estimate:<lat1>:<lng1>`              | `{ v:1, fetchedAt, months: MonthlyMean[12] }`                                                                                                       | 30 days                                             |

- **Freshness is the stored `expires`; the KV TTL is only retention.** MET's terms make honouring
  `Expires` mandatory, and the obvious way to encode that - a TTL equal to the seconds until
  `Expires` - quietly makes the conditional re-fetch below impossible. `lastModified` lives inside
  this same entry, so an entry that is evicted at the instant it goes stale takes the validator with
  it, and there is never a moment where the code holds a stale body and something to send in
  `If-Modified-Since`. The two concerns are therefore split. The entry is **retained** for a fixed
  6 h whatever the header says, and is judged **fresh** at read time by comparing `now` against the
  `expires` field in the value:
  - `now < expires` → a hit. Served without an outbound call and without a rate unit, so `Expires`
    is honoured exactly: a reading is never served past it without asking MET first.
  - `now >= expires`, entry present → a **conditional re-fetch** carrying
    `If-Modified-Since: lastModified`. A `304` keeps `series` untouched and rewrites the entry with
    the response's new `Expires` and a fresh 6 h retention; a `200` replaces it wholesale. Either
    way it is one outbound call and one rate unit, like any other miss - the 304 saves MET a body,
    not us a call.
  - no entry → an unconditional fetch, as on a cold cache.

  Six hours is the retention, not a freshness claim: it is long enough that a board reopened later
  the same day still holds a validator to send, and short enough that a coordinate nobody revisits
  leaves nothing behind for a day. A missing or already-past `Expires` header is floored at 60 s
  from `fetchedAt`, so a broken header degrades to re-validating often rather than to serving stale
  data forever.

- `<lat4>` means rounded to 4 decimals, which is also MET's truncation rule. `<lat1>` means rounded to
  1 decimal. NASA's grid is about 0.5°, so a finer key only fragments the cache for the same cell.
- **Days are grouped at read time, never in the cache.** Two trips at the same coordinate can have
  different time zones (or none, which resolves to UTC), so a cached day boundary would be wrong for
  one of them. The entry holds the raw timeseries; `met-norway.ts` groups it into the reading trip's
  local days on every read. That is a pure function over at most about 90 steps.
- **Known limitation: one zone per trip, not one per day.** Both the day boundaries above and
  `sun.ts`'s rise and set times use the trip's zone (`trips.timezone`, `src/server/db/schema.ts:695`
  - a single nullable column). On a multi-zone trip - Tokyo to London - the London days are bucketed
    into Tokyo's 24 hours and their sunrise is hours out. #631 asks for the day's own zone, and this
    spec knowingly does not deliver it in v1. **It is not blocked on a dependency.** The `airports`
    catalogue already carries an IANA zone beside a coordinate on the same row
    (`src/server/db/schema.ts:3160-3161`), `public/atlas/airports-iata.v1.txt` ships 3,535 of 9,057
    rows zoned against `tzdata-2026c`, and `src/server/catalog/airports.ts` - the one stated
    exception to the `server/repos` rule - already reads it; the table carries no `organizationId`,
    so a weather module may read it without touching tenant data. It is deferred on its own merits:
    the zoned grid is sparse, so in a thinly served region the nearest zoned airport can sit the
    wrong side of a boundary; `airports` indexes only the codes, the name and the city
    (`:3164-3176`) and has no index on `lat`/`lng`, so nearest-neighbour means a bounding-box
    prefilter and a scan; and it costs a D1 query per distinct day-location on a read path this spec
    otherwise keeps off D1 apart from `readDayLocations`. The product also models a trip as
    single-zone - `trips.timezone` is one nullable column - so the trip's zone is the one the rest of
    the planner already reads a time in, and a trip crossing zones is wrong here in the same way it
    is already wrong elsewhere. Fixing that properly is a change to the model, not to this feature.
- **This deviates from the `06-S7` key sketch, deliberately.** Forecast and estimate are keyed per
  location, not per date, because one provider call answers every date and one KV entry per call
  keeps reads at one per location. Recorded values stay per date because the requested range differs
  between trips. The long TTLs on settled history and on climatology follow from what the data is: a
  30-year monthly mean does not change within a month.
- **One version lever.** `src/server/weather/weather.ts` exports
  `WEATHER_CACHE_VERSION = 'v1'`, the single source of the `v1` in every key and of the `v` in every
  value, as `src/server/geo/geocode.ts:251` does for geo. A change to any stored shape bumps it;
  entries are never rewritten in place, and the previous prefix is left to expire on its own TTL.
- **No tenant data in any key**: coordinates, a date, and nothing else. The module exports no
  function that takes a trip, place or member id (`06-S7`, isolation rule).
- **A missing value in a cached entry is a miss, not an error.** That covers a malformed entry, a
  wrong `v`, or a failed Zod parse; the pattern is `src/server/billing/entitlements.ts:110-136`.
  NASA's `-999` normalises to `null` for that field, never to a number.
- **Concurrent misses on the same key are accepted, not serialised.** The overlap window is one
  provider round-trip, and the per-request call cap below bounds what that can cost. A
  `wx:v1:lock:` single-flight entry would add a failure mode (a stale lock) to save a duplicate call
  that a forecast entry fresh until its `Expires` already makes rare.

**Limits.** A fourth rate metric, `weather_lookups_per_month`, goes into `RATE_METRICS` and
`PLAN_RATE_CEILINGS` (`src/server/billing/limits.ts:120-189`, whose comment "All three are far below…"
becomes "All four", with a paragraph for weather): free 300, solo 3,000, crew 12,000. Only
an outbound call spends it, one unit each — a miss, and equally the conditional re-fetch of a
forecast entry past its `expires`, whose 304 saves MET a body but is still a request. When the
remaining budget is smaller than the
number of misses, calls are spent in the order **forecast → estimate → recorded**: the near-term day
is the one a traveller acts on. Everything not reached is `unavailable`, and a test covers a
budget of 1 against 3 needed calls. The numbers follow the geocode reasoning in that
file's comment: a cold fourteen-day trip spends up to three units, so Free's 300 covers about a
hundred cold trip views a month. Free's allowance is non-zero because the surface that spends it is
on - `src/server/billing/limits.ts:126-137` fixes the rule that "an allowance is zero exactly when
the surface that spends it is off", and the planner board is in Free's catalogue entry
(`src/lib/plans.ts:246,254`, "a day-by-day itinerary and map"), so a zero here would refuse every
open of a screen the pricing page sells.

## 📝 API Contracts

One server function, route-local beside the plan loaders in `src/routes/_app/trips/$tripId/-server/`
(`plan.ts`, `day-notes.ts` and `plan-transports.ts` are its structural models - there is no
`-server/geocode.ts` in this repository):

```ts
// src/routes/_app/trips/$tripId/-server/weather.ts
const input = z.strictObject({ tripId: id })

type DayWeather =
  | { dayId: string; status: 'none' } // undated day, or no location
  | { dayId: string; status: 'unavailable'; kind: WeatherKind } // provider/ceiling/parse failure
  | { dayId: string; status: 'not-yet-recorded' } // past day inside POWER_LAG_DAYS
  | { dayId: string; status: 'ok'; reading: DayReading; sun?: SunTimes } // `sun` is absent on an answer that predates it and on a trip with no time zone (amendment 33)

type WeatherKind = 'forecast' | 'recorded' | 'estimate'

interface DayReading {
  kind: WeatherKind
  source: 'met-norway' | 'nasa-power'
  tempMinC: number | null
  tempMaxC: number | null
  precipitationMm: number | null
  precipitationProbability: number | null // forecast only, 0-100
  windMs: number | null
  symbol: string | null // forecast only; MET symbol code
  slots: ReadonlyArray<{
    from: string
    symbol: string | null
    tempC: number | null
  }> | null // forecast only, 4 × 6 h
  fetchedAt: string // ISO
}

interface SunTimes {
  sunrise: string | null // 'HH:mm' in the trip's zone (see the multi-zone limitation); null for a side the sun does not cross the horizon for (amendment 30)
  sunset: string | null
}

export const loadTripWeather: ServerFn<
  { tripId: string },
  { days: DayWeather[] }
>
```

- **Authorisation**: no `assertTripRole`. Its own docstring (`src/server/repos/trips.ts`) says read
  paths are deliberately not guarded by it. As in the other plan loaders, the trip is read in the
  tenant scope, so a trip the caller cannot see is `NotFound`. Every member, viewer included, sees
  weather, and nothing is written.
- **Day location**: resolved in the tenant scope by a new repository read,
  `readDayLocations(scope, tripId)` in `src/server/repos/itinerary.ts`. For each dated day it returns
  one coordinate. A candidate qualifies only when its place row has **both** `lat` and `lng` non-null
  (`src/server/db/schema.ts:211` makes them nullable, and a hand-made place routinely has neither);
  a candidate missing either is skipped and the next rule applies:
  1. the place of the stay covering that day - `day_accommodations` joined to `days` at both ends,
     where this day's `day_number` (`src/server/db/schema.ts:828`, unique per trip) is between the
     start day's and the end day's. `start_day_id` and `end_day_id` are ids, not an order, so the
     comparison is on `day_number` and never on the ids themselves. When more than one stay covers
     the day - the schema permits it, there is no exclusion constraint - the tie is broken in this
     order: the stay whose `start_day_id` **is** this day (that is where the traveller sleeps), then
     the stay with the highest start `day_number`, then the lowest `id`. The order is total, so the
     result is deterministic. A stay whose `place_id` is `NULL` (the FK is `set null`) is skipped,
     not treated as a location;
  2. else the first assigned place by `order_index` (`day_assignments` → `places`);
  3. else `null`, which makes the day `none`.

  This is the one SQL change, and it lives in `server/repos` as SPEC §6 requires.

- **Failure mapping**: `RateCeilingError`, `ProviderBlockedError`, a vendor error, or a timeout
  turns the affected days into `unavailable`. The function **never rejects** for a provider reason.
  A trip-not-found or role failure still throws, as it does everywhere else.
- **Two bounds, and the per-call one is the smaller.** The per-call timeout is **6 s** and the
  request's overall deadline is **8 s**. The order matters and is the reason this deviates from
  `GEOAPIFY_TIMEOUT_MS` (10 s): geocoding makes one call with no outer deadline, so a per-call bound
  is the only bound it has. Here the calls fan out under an 8 s deadline, and a per-call timeout
  above it could never fire - the deadline would always resolve first, every hung provider would
  look identical, and the per-call bound would be decoration. At 6 s a single hung provider aborts
  with about two seconds of headroom left, so the kinds that did answer still render instead of the
  whole board going `unavailable` together.
- **Concurrency and a cap.** All provider calls for one request are issued concurrently
  under `Promise.allSettled`, never in sequence - a 21-day, 6-city trip on a cold cache is up to 18
  calls, which at the 6 s per-call timeout would be close to two minutes if they queued. Every kind
  still unresolved at the 8 s deadline renders `unavailable`. At most **12 distinct day-locations** are resolved per request, in day order; days
  beyond that render `unavailable`. The worst case per request is therefore 12 locations × 3 kinds =
  36 outbound calls plus 36 KV reads, stated here so it can be checked against the Workers
  per-request subrequest limit before phase 2 lands.
- **Client**: called with TanStack Query from the plan screen after first paint, with key
  `['trip-weather', tripId]` and `staleTime` of 15 minutes. It is not part of the route loader.

## 📝 UI/UX

- **Badge** (`day-weather-badge.tsx`), placed **beside** the day header button in `day-section.tsx`,
  never inside it. The date label (`:161-166`) sits inside the header `<button>` (`:134-171`), so the
  badge cannot go there. The header button and the badge become siblings in a new
  `flex items-center` wrapper: the button's `w-full` (`:139`) becomes `flex-1 min-w-0`, its contents
  and the inner `flex-1` span (`:156`) are untouched, and the badge sits at the row's end, vertically
  centred. This narrows the day header's click target by the badge's width, which is the price of one
  button per action. It shows a condition icon for a forecast, a
  thermometer for recorded or estimated days, the max/min pair in `tabular-nums`, and the unit. Its
  box is **reserved at final size** from first paint: a skeleton while loading, and nothing but empty
  space for `none`. A late reading never shifts the itinerary (SPEC §2, zero layout shift).
- **The estimate marker** is not decoration. An estimated badge carries a `≈` prefix and a dashed
  outline in `--color-info`, and its accessible name starts with "Estimate". A recorded badge's name
  starts with "Recorded". A reader must never pack for an estimate believing it is a forecast.
- **Fuller reading**: activating the badge opens a `Popover` (`src/components/ui/popover.tsx`) with:
  - the min/max, precipitation (with probability when forecast), wind, and sunrise/sunset;
  - for a forecast, the four 6-hour slots (night, morning, afternoon, evening);
  - for an estimate, one line explaining that it is a long-term monthly average and not a forecast;
  - an attribution line that names MET Norway (with CC BY 4.0) or NASA POWER.

  The badge is its own button, the header button's sibling, so no button is nested in another. Focus returns to
  the badge when the popover closes.

  **Why four slots and not the reference's twelve.** The reference renders twelve columns at 2-hour
  steps across the day (#631). We render four 6-hour slots, and the reason is the provider rather
  than the design: Locationforecast's `compact` product carries `next_1_hours` only for roughly the
  first two to three days and drops to 6-hour blocks beyond that, so a uniform 2-hour strip is
  unbuildable for most days of a trip at the moment somebody plans it - which is exactly when this
  screen is read. Four 6-hour slots are the finest resolution available for **every** forecast day,
  which is what keeps the block's shape stable across a trip. Two alternatives were rejected:
  `complete` returns the same time steps with more parameters per step, so it buys extra variables
  and not finer resolution, at a much larger response that works against both MET's caching
  expectations and the size of the cached timeseries; and bucketing `next_1_hours` at 2-hour steps
  for the first 48-72 h with a 6-hour fallback beyond would change the block's column count between
  day 2 and day 4 of one trip, which reads worse than a uniform block and doubles the grouping
  logic. `recorded` and `estimate` days carry **no strip at all** - `slots` is `null` and the region
  is omitted, never filled with interpolated values.

  **When #124 lands**, `DayWeatherPanel` moves into its declared weather region, the badge's
  `Popover` is removed, and activating the badge opens the day detail with focus on that region. The
  badge itself stays. Until then the Popover is the only place the fuller reading exists, and that
  is why this spec ships it rather than waiting: #124 is open and labelled `blocked`, with no date.

- **Unavailable**: a muted "—" badge whose name and popover say "Weather unavailable for this day".
  It is never a zero and never a blank that looks like success.
- **Not yet recorded**: its own state, not a flavour of unavailable. A muted badge reading "Not yet
  recorded", carrying no popover, for a past day inside `POWER_LAG_DAYS`. It is a separate
  `DayWeather` variant (`status: 'not-yet-recorded'`) because "we have not published it yet" and
  "we asked and it failed" are different answers to the traveller and `unavailable`'s copy is fixed
  regardless of kind: folding the two together would make AC14 unsatisfiable, since a genuine NASA
  failure on a `recorded` day already produces `{ status: 'unavailable' }` (shipped without `kind`, Amendment 22).
- **Colour**: semantic tokens only (`--color-info`, `--color-warning`, `--color-danger` and their
  `-soft` companions). There is no weather palette and no change to `src/styles/tokens.css`. The icons
  come from the icon set already in use.
- Motion: the popover uses the existing primitive's motion, and `prefers-reduced-motion` is honoured
  by it. Keyboard: Tab reaches the badge, Enter/Space opens it, Escape closes it.

Illustrative mockup (static, not app code): `assets/per-day-weather/mockup-01-day-rows.html`. Open it
in a browser for the light, dark and 360 px views; rendered frames are attached to this spec's pull
request rather than committed, because `.ai/specs/AGENTS.md` reserves `assets/` for the `.html`
reproduction and nothing else.

## 📝 Visual change expected

- Route `/trips/$tripId/plan`: every dated day header with a location gains a badge. States to
  capture:
  - resting forecast;
  - recorded (past trip);
  - estimate with its marker;
  - not yet recorded;
  - unavailable;
  - loading skeleton;
  - popover open for a forecast and for an estimate.
- Light and dark, at 360, 1280 and 2560 px (desktop and mobile), per `06-S7` § Verification.
- No other route changes. Undated days and days without a location look exactly as today.

## 📝 Copy

New keys in `src/lib/i18n/messages/en/trips.ts`. The implementation lands every one of them in all 23
locales in the same change (`i18n-messages` skill).

| Key                                     | en text                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `plan.weather.badge.forecast`           | `Forecast: {condition}, high {max}, low {min}`        |
| `plan.weather.badge.recorded`           | `Recorded: high {max}, low {min}`                     |
| `plan.weather.badge.estimate`           | `Estimate: typical high {max}, low {min}`             |
| `plan.weather.badge.unavailable`        | `Weather unavailable for this day`                    |
| `plan.weather.badge.notYetRecorded`     | `Not yet recorded`                                    |
| `plan.weather.badge.loading`            | `Loading weather`                                     |
| `plan.weather.panel.title`              | `Weather for {date}`                                  |
| `plan.weather.panel.temperature`        | `High / low`                                          |
| `plan.weather.panel.temperatureTypical` | `Typical high / low`                                  |
| `plan.weather.panel.precipitation`      | `Precipitation`                                       |
| `plan.weather.panel.probability`        | `{percent} chance`                                    |
| `plan.weather.panel.wind`               | `Wind`                                                |
| `plan.weather.panel.sunrise`            | `Sunrise`                                             |
| `plan.weather.panel.sunset`             | `Sunset`                                              |
| `plan.weather.panel.slot.night`         | `Night`                                               |
| `plan.weather.panel.slot.morning`       | `Morning`                                             |
| `plan.weather.panel.slot.afternoon`     | `Afternoon`                                           |
| `plan.weather.panel.slot.evening`       | `Evening`                                             |
| `plan.weather.panel.estimateNote`       | `A long-term average for this month, not a forecast.` |
| `plan.weather.panel.recordedNote`       | `Measured values for this day.`                       |
| `plan.weather.attribution.metNorway`    | `Forecast data: MET Norway, CC BY 4.0`                |
| `plan.weather.attribution.nasaPower`    | `Data: NASA Langley Research Center POWER Project`    |
| `plan.weather.condition.clear`          | `Clear`                                               |
| `plan.weather.condition.fair`           | `Fair`                                                |
| `plan.weather.condition.partlyCloudy`   | `Partly cloudy`                                       |
| `plan.weather.condition.cloudy`         | `Cloudy`                                              |
| `plan.weather.condition.fog`            | `Fog`                                                 |
| `plan.weather.condition.rain`           | `Rain`                                                |
| `plan.weather.condition.heavyRain`      | `Heavy rain`                                          |
| `plan.weather.condition.sleet`          | `Sleet`                                               |
| `plan.weather.condition.snow`           | `Snow`                                                |
| `plan.weather.condition.thunder`        | `Thunder`                                             |
| `plan.weather.panel.noSunrise`          | `No sunrise`                                          |
| `plan.weather.panel.noSunset`           | `No sunset`                                           |

The popover's temperature row takes `plan.weather.panel.temperature` for a `forecast` and a
`recorded` day and `plan.weather.panel.temperatureTypical` for an `estimate`: the estimate is a
long-term average, and a row labelled "High / low" over it would read as a prediction. They are two
keys rather than one interpolated string because the wording differs, not a word inside it.

MET's symbol codes are mapped to the condition groups by a table in `day-weather-badge.tsx`'s model
file; the day/night suffix is dropped for the label.

## 📝 Observability

`resolveTripWeather` emits one structured log per resolution - `weather.resolved` with
`{ organizationId, locations, days, hits, misses, unavailable }`, where `days` counts the asked days
per kind (`{ forecast: 5 }`, so a new kind adds a key and not a field) and `hits` and `misses` count
locations - and no tenant identifier beyond `organizationId`, on top of `callProvider`'s existing `calls` / `errors` /
`blocked` counters. The two rates that decide whether this feature is working are the cache hit
ratio and the share of days rendering `unavailable`; without that line both are invisible until a
user reports a blank badge.

## 📝 Edge Cases & Failure Scenarios

| Case                                                               | What the user sees                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day has no date                                                    | No badge (`none`), exactly as today.                                                                                                                                                                                                                           |
| Day has a date but no stay and no place                            | No badge (`none`).                                                                                                                                                                                                                                             |
| MET returns 403/429/5xx or times out                               | Forecast days show "unavailable". Recorded and estimated days still render, because they come from separate calls. Logged via `callProvider`.                                                                                                                  |
| NASA returns `-999` for a field                                    | That field is omitted in the popover. If both temperatures are missing, the day is "unavailable".                                                                                                                                                              |
| A past day still inside POWER's publication lag (`POWER_LAG_DAYS`) | `status: 'not-yet-recorded'`: a muted badge reading "Not yet recorded", with that accessible name and no popover. It is never back-filled from the forecast, never shown as a number, and never collapsed into `unavailable`. No outbound call is made for it. |
| Workspace hits `weather_lookups_per_month`                         | Cached days still render. Uncached days show "unavailable". The ceiling is never exceeded.                                                                                                                                                                     |
| Provider ledger blocks a vendor (`ProviderBlockedError`)           | Same as an outage for that vendor.                                                                                                                                                                                                                             |
| KV read or write fails                                             | Treated as a miss, with a logged event. The reading is still served from the provider.                                                                                                                                                                         |
| Trip time zone missing or invalid                                  | `resolveTimeZone` falls back to UTC, which is the existing behaviour. A trip with no zone shows no sun rows (amendment 33).                                                                                                                                    |
| Trip spanning two time zones                                       | Days are bucketed and sun times computed in the trip's single zone. Wrong by the offset for the far leg - the limitation recorded in the Data Model, not a defect to file.                                                                                     |
| Polar day or polar night                                           | `sun.ts` returns `null` for rise/set. The popover says "No sunrise" or "No sunset", shown as a dash with that accessible name.                                                                                                                                 |
| Trip in the far future (for example next year)                     | Every day is an estimate with its marker.                                                                                                                                                                                                                      |
| A recorded or estimated day                                        | No hourly strip at all. `slots` is `null` and the popover omits the region entirely - never empty columns, and never a value interpolated from the daily min/max.                                                                                              |
| Two days at the same place                                         | One call; both days are served from the same entry.                                                                                                                                                                                                            |
| The forecast window's last day is partial                          | It is not a forecast day, so it is an estimate.                                                                                                                                                                                                                |

## ✅ Acceptance criteria

Each line is independently checkable, and the phase steps below reference them rather than restating
them.

- **AC1** A 14-day single-city trip **straddling all three kinds** — it starts far enough in the past
  that its first day is published (beyond `POWER_LAG_DAYS`), covers today, and runs past the
  forecast window — makes exactly 3 outbound calls on a cold cache and spends exactly 3 rate units
  (`weather.test.ts`, on a fixed fake `today` so the placement cannot drift). The placement is
  stated because the count follows from the kinds present, not from the day count: a trip starting
  today is 2 calls, an all-past trip beyond the lag is 1, and a far-future trip is 1. **At most 3
  per location** is the invariant; 3 is the maximum this fixture is built to hit.
- **AC2** The same trip on a warm cache — every entry present and, for the forecast, still inside
  its `expires` — makes 0 outbound calls and spends 0 rate units.
- **AC2b** A forecast entry that is present but past its `expires` produces exactly one conditional
  request carrying `If-Modified-Since`, and a `304` answer leaves the cached `series` unchanged
  while moving `expires` forward.
- **AC3** A MET outage leaves every `recorded` and `estimate` day rendering, and `loadTripWeather`
  resolves rather than rejects.
- **AC4** A ceiling of 0 produces `unavailable` for every uncached day with no outbound call.
- **AC5** No exported function of `src/server/weather/` accepts a trip, place or member id
  (`seam.test.ts`).
- **AC6** `sunTimes` is within ±2 min of the NOAA calculator for all six fixture cases, and returns
  `null` at Tromsø on 21 December and 21 June.
- **AC7** `slots` is non-null for `forecast` and `null` for `recorded` and `estimate`, and the panel
  omits the region when it is `null`.
- **AC8** Every key in **Copy** exists in all 23 locales (the parity test).
- **AC9** The plan route's `PerformanceObserver('layout-shift')` sum is 0 across the weather query
  settling, and the first day header's `boundingBox()` is identical before and after.
- **AC10** A foreign workspace's trip id resolves no day locations (`tenant-isolation.test.ts`).
- **AC11** An estimate badge's accessible name begins with "Estimate"; a recorded badge's with
  "Recorded".
- **AC12** No MET request URL carries more than 4 decimal places of latitude or longitude.
- **AC13** After a vendor error, the next resolution for that location spends no rate unit and makes
  no outbound call while the `wx:v1:fail:` entry lives.
- **AC14** A past day inside `POWER_LAG_DAYS` resolves to `status: 'not-yet-recorded'`, renders
  "Not yet recorded" as its accessible name, and is never back-filled from a forecast. A NASA
  failure on a past day outside the lag resolves to `{ status: 'unavailable' }` (shipped without `kind`, Amendment 22)
  instead, so the two are distinguishable by the type and not only by the copy.

## 📝 Risks & Impact Review

- **Blast radius.** The change is additive: a new module, a new server function, a new KV prefix
  `wx:v1:`, a fourth rate metric, a badge, and one repository read. No schema change, no migration,
  no change to an existing contract. `BACKWARD_COMPATIBILITY.md`: no protected surface is touched.
  `RATE_METRICS` gains a member, and the generic loops in `limits.test.ts` (`:590`, `:610`, `:619`,
  `:711`) cover it.
- **Licence risk.** It is the reason this spec exists. The terms were read on 2026-09-19 and are
  recorded in ADR 0038. A term change by either provider is handled by a new ADR, and the vendor
  seam keeps a swap to one file.
- **Cost.** Zero per call. KV reads and writes stay within the existing binding's allowance at our
  volumes (`docs/ARCHITECTURE.md` §8).
- **Rollback.** Revert the badge import in `day-section.tsx` and the query hook, and the feature is
  gone. KV entries expire on their own. The rate metric can stay unused.

### Out of scope

- Any paid or non-commercial source.
- Alerts and warnings, radar or map layers, air quality, and weather notifications.
- Weather per place, rather than per day.
- A per-day time zone resolved from the day's coordinate through the `airports` catalogue, and the
  nearest-neighbour index it would need.
- The public or shared trip page.
- Storing readings in D1.
- A separate temperature-unit preference; this spec couples to `distance_unit`.
- Filling the #124 day-detail region. That is a one-line render once #124 merges, and belongs to
  whichever lands second.

## 📋 Phasing

1. **Decision on record.** ADR 0038, plus `11-S3`, `06-S7` and `09-S8` updated. Docs only.
   This spec first named the record 0025; that number was taken by the time phase 1 ran (#819), so
   the record is the next free number at that time, 0038, and every plan record cites it. Count by
   the highest number in `docs/adr/`, not by the file count: it holds two records numbered 0031.
2. **Server.** Vendors, policy, limits, repository read and server function, all with unit tests and
   no UI caller. The app is unchanged.
3. **Surface.** Badge, popover, copy in 23 locales, and a Playwright journey. The feature becomes
   visible.

Each phase is one pull request and leaves `develop` green.

## 📋 Implementation Plan

### Phase 1 — decision on record

1. Write `docs/adr/0038-met-norway-and-nasa-power-for-weather.md` in the shape of
   `0013-geoapify-for-geocoding.md` (Context / Decision / Consequences / Alternatives rejected). Record
   the three kinds, the terms quoted above with the date they were read, the rejected
   alternatives with the clause that rejects each, and - as `0013` does for Geoapify - what each
   provider may do with the coordinates it receives and for how long, since every request discloses
   a tenant's trip coordinates to a third party. Check: the file exists, and `pnpm lint` passes on
   markdown.
2. In `docs/plans/11-boundaries-and-blockers.md`, strike weather through in "The provider decisions"
   and in the `DOC-08` register row, citing ADR 0038, the same way geocoding cites 0013. In
   `docs/plans/06-documents-and-media.md` `06-S7`, mark the stage unblocked, rename `archive` and
   `climate` to `recorded` and `estimate`, and point at this spec. In
   `docs/plans/09-account-and-settings.md`, change the "Temperature unit" row (`:2605`, and the
   paragraph at `:2620-2626` that defers it onto this row) from "defer, behind a block" to the
   closed disposition - coupled to `distance_unit`, no separate switch - citing this ADR, because
   this spec is where that concept is owned (docs/SPEC.md §8).
   Check: `grep -n "DOC-08" docs/plans/11-boundaries-and-blockers.md` shows the struck row with the
   citation, and `grep -n "Temperature unit" docs/plans/09-account-and-settings.md` shows the closed
   row.

### Phase 2 — server

3. Write `src/lib/sun.ts` (`sunTimes(lat, lng, dateKey, timeZone): SunTimes | null` for each side).
   Tests against the NOAA Solar Calculator's (gml.noaa.gov/grad/solcalc) values, captured once into
   `src/lib/__tests__/sun.fixtures.ts` with date, coordinate, zone and expected `HH:mm`. Cases: Oslo on
   21 June and 21 December, Quito on the equinox, Tromsø on 21 December (no sunrise) and 21 June (no
   sunset), and Sydney on 21 December. Each must be within ±2 min.
4. Write `src/server/weather/met-norway.ts`: `createMetNorwayClient({ fetch })` and `metNorwayVendor`.
   It calls `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=&lon=` with the fixed
   `User-Agent` and `If-Modified-Since` when a previous `lastModified` is known. `lat` and `lon` are
   truncated to 4 decimals in the request URL - the same rounding the cache key uses, and MET
   answers 403 for anything finer - and a test asserts no request URL ever carries more. The client
   sets no `Accept-Encoding` of its own: the Workers runtime negotiates content encoding on every
   outbound `fetch`, which is what satisfies MET's compression term. It normalises the timeseries into full local days (the trip's time zone), producing min/max,
   summed precipitation, max probability, max wind, a dominant symbol and four 6-hour slots, and it
   returns `expires`. A `304` carries no body, so the client reports it as such and returns only the
   response's fresh `expires` and `lastModified`; the caller keeps the cached `series`. Tests use a
   recorded fixture: day bucketing across a time-zone offset, dropping a partial last day, and a 304
   returning the new headers without a series.
5. Write `src/server/weather/nasa-power.ts` with `createNasaPowerClient({ fetch })`, `daily(lat, lng,
start, end)` using `T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M`, `community=AG`, `time-standard=LST`, and
   `climatology(lat, lng)` using `T2M,T2M_RANGE,PRECTOTCORR` (no wind, because an estimate does not
   show it; the typical high and low are the mean moved half the range up and down, see ADR 0038). `-999` becomes `null`. Tests use fixtures for
   both endpoints and a fill-value case.
   6a. Write the **pure half** of `src/server/weather/weather.ts`:
   `selectKind(dateKey, today, forecastWindowEnd, powerLagDays)` and `groupByLocation(days)` - no
   I/O and no runtime argument. `selectKind` returns `'forecast' | 'recorded' | 'estimate' |
'not-yet-recorded'`, the last of which is the one answer that is not a `WeatherKind` and needs
   no provider: `groupByLocation` drops those days, so they cost no call. Tests: selection at each
   boundary (the day before today, today itself, the last fully covered day, the day after it, and a
   past day inside `POWER_LAG_DAYS` answering `'not-yet-recorded'`); a
   fourteen-day trip in one city groups to one location; two days at the same coordinate group
   together; a day with no coordinate groups nowhere; a `'not-yet-recorded'` day groups nowhere.

6b. Write the **read-through half**: `resolveTripWeather(runtime, days, today, timeZone)` - the KV
read per the key/TTL table, with the forecast entry's freshness taken from its stored `expires`
rather than from its presence (Data Model), `spendRateUnit` per outbound call - a miss or a
conditional re-fetch alike - in the order forecast → estimate →
recorded, `callProvider` around each call, the `wx:v1:fail:` negative entry on any vendor error,
`Promise.allSettled` with the 6 s per-call timeout inside the 8 s request deadline and the
12-location cap, and the mapping of every
provider-side error to `unavailable`. Tests, with an in-memory KV, fake counters and a fake
fetch:

- one call per location and kind for the fourteen-day trip AC1 fixes — straddling all three kinds
  against a fixed fake `today`, so three calls at one location: one MET Locationforecast, one NASA
  daily, one NASA climatology (AC1);
- a fourteen-day trip starting today, which has no `recorded` days and so makes two calls, not
  three - the bound is per kind present, not a constant;
- a warm cache - every entry present and inside its `expires` - making zero calls (AC2);
- a forecast entry present but past its `expires`: exactly one conditional request, and a `304`
  answer re-using the cached `series` while moving `expires` forward and spending one unit (AC2b);
- a malformed entry treated as a miss;
- an outage on one vendor leaving the other kinds intact, writing the negative entry, and the
  next resolution spending **no** unit and making **no** call while it lives;
- **one provider hanging**, on fake timers: it aborts at the 6 s per-call timeout rather than at
  the 8 s request deadline, that kind renders `unavailable`, and the kinds that answered still
  render - the case that would be untestable if the per-call bound sat above the deadline;
- a ceiling of 0 or exhausted producing `unavailable` without a call;
- a budget of 1 against 3 needed calls spending it on the forecast;
- **no exported function accepting a trip, place or member id**, asserted by a `seam.test.ts`
  that keys are built only from `(kind, lat, lng, date?)`.

7. Write `src/server/weather/bindings.ts` with `weatherRuntime({ organizationId, ceiling })`, wiring
   `env.KV`, `requestOutboundRuntime()` and the global `fetch`, plus `cloudflare-env.d.ts`. Add `'met-norway'` and
   `'nasa-power'` to `METERED_PROVIDERS` (`src/server/db/schema.ts:414`). `callProvider` accepts only
   those slugs. No migration is needed, because the column is plain text, and the fixtures in
   `src/server/fns/console/__tests__/providers.test.ts` and
   `src/server/catalog/__tests__/provider-usage.test.ts` are updated, together with the
   `METERED_PROVIDERS` docblock at `src/server/db/schema.ts:406-419`, whose "Five, because five
   clients exist" enumeration becomes seven with `src/server/weather/met-norway.ts` and
   `src/server/weather/nasa-power.ts` named as the two new call sites. Add
   `weather_lookups_per_month` to `RATE_METRICS` and `PLAN_RATE_CEILINGS`, and one test in
   `limits.test.ts` asserting that every plan's weather allowance is above 0.
8. Add `readDayLocations(scope, tripId)` in `src/server/repos/itinerary.ts` (stay → first place →
   null), and a case in `src/server/repos/__tests__/tenant-isolation.test.ts` showing that another
   workspace's trip id resolves nothing.
9. Write `src/routes/_app/trips/$tripId/-server/weather.ts` with `loadTripWeather`: a Zod
   `strictObject` input, **no `assertTripRole`** (the trip is read in the tenant scope, so a trip the
   caller cannot see is `NotFound`, as every other plan loader does -
   `src/server/repos/trips.ts:485`), the ceiling from
   `resolveLimitsFromRow(await getSubscription(scope)).rates.weather_lookups_per_month`, and the
   runtime reaching it as an injected port, the way `src/server/fns/booking-import.ts:889` takes
   `geocoding: geocodeRuntime`, so the `cloudflare:workers` import stays behind
   `src/server/weather/bindings.ts` and the function stays testable with a fake runtime.
   Tests: a viewer can read; a foreign trip is refused; a provider error yields `unavailable` rather than a rejection.
   Gate: `validation.commands` green.

### Phase 3 — surface

10. Add every key in **Copy** to `en/trips.ts` and to the 22 other locales (`i18n-messages` skill).
    Check: the parity test passes.
11. Write `src/components/planner/day-weather-badge.tsx` (badge + `DayWeatherPanel` in a `Popover`),
    a pure model file mapping symbol → condition group and metric → display units, and render the
    badge in `day-section.tsx` from a `weather` prop. The plan screen runs the query and passes each
    day's `DayWeather` down. Unit tests cover the model: unit conversion, symbol grouping, and the
    accessible name for each kind, including the estimate prefix.
12. Make the e2e journey deterministic by **seeding the cache, not by stubbing the providers**. (As built, Amendment items 42 to 48.)
    Nothing test-only ships in the Worker: `scripts/seed/seed.mjs` writes three `wx:v1:` entries for
    the seeded trip's coordinates (one `forecast`, one `recorded`, one `estimate`) beside the rows
    it already writes, seeds one place at a coordinate with no entry, and sets the demo workspace's
    `weather_lookups_per_month` ceiling to 0 - so the `unavailable` state comes from the real
    ceiling path and no outbound call is ever attempted. This exercises the read-through path the
    product actually runs, instead of a branch that exists only for tests, and it needs no
    `WEATHER_FIXTURES` variable, no fixture module in the bundle and no `wrangler.jsonc` guard. The
    vendor-outage case lives in `weather.test.ts` (step 6b), not in the journey. Add a journey
    `e2e/trip-weather.spec.ts` on that seeded trip.
    Cover a forecast day, a past trip's recorded day, an estimate with its marker and accessible
    name, an unavailable day, and keyboard open/close of the popover. **No layout shift** is measured, not
    eyeballed: the first day header's `boundingBox()` is equal before and after the weather query
    settles, and a `PerformanceObserver('layout-shift')` sum on the plan route stays at 0. Capture evidence in light and dark at 360/1280/2560.
    Gate: `validation.commands` green, plus `pnpm e2e`.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                  | Applied default                                                                                                              | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Split into separate specs (forecast vs history/estimate)? | One spec, three phases.                                                                                                      | `06-S7` argues the halves are not independently useful. A forecast-only badge leaves most of a trip blank at planning time.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Q2  | Which coordinate represents a day?                        | The stay covering the day, else the first assigned place by order, else none.                                                | This reuses existing rows with no new field. Carrying yesterday's location forward would invent a location.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Q3  | Temperature unit preference?                              | Couple to the existing `distance_unit` (user over organisation).                                                             | This closes `09-S8`'s deferral of the temperature unit onto `06-S7`: the answer is "no separate preference", not "later". No new column, and reversible.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Q4  | Sunrise/sunset source?                                    | Compute locally in `src/lib/sun.ts`.                                                                                         | Zero calls, exact, and testable. MET Sunrise would be one call per date.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Q5  | How is the estimate derived?                              | NASA POWER long-term monthly mean for the day's month.                                                                       | One call per location, a statistically meaningful average, and always marked as an estimate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Q6  | Where does the fuller reading live before #124 lands?     | A `Popover` from the badge. `DayWeatherPanel` moves into #124's region when it lands, and the Popover is removed then.       | #124 is open and labelled `blocked`, with no date. Waiting would ship a badge whose reading a reader cannot open; the panel body is written once and re-mounted, not written twice.                                                                                                                                                                                                                                                                                                                                                                             |
| Q7  | Rate ceilings for `weather_lookups_per_month`?            | Free 300, Solo 3,000, Crew 12,000.                                                                                           | The providers cost nothing, and the ceiling exists to bound abuse and respect MET's rate policy. The numbers are cheap to change.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Q8  | Fetch in the route loader or after paint?                 | After paint, through TanStack Query.                                                                                         | A provider outage must never render `PlanError` or delay the board.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Q9  | Whose time zone - the trip's or the day's?                | The trip's, for both day bucketing and sun times, with the multi-zone trip recorded as a known wrong case rather than fixed. | #631 asks for the day's zone, and it is reachable with **no new dependency**: the `airports` catalogue carries IANA zones beside coordinates (`src/server/db/schema.ts:3160-3161`; 3,535 zoned rows on `tzdata-2026c`). Deferred on cost and accuracy instead - a sparse zoned grid, no `lat`/`lng` index to make nearest-neighbour cheap, and a D1 query per day-location on a read path otherwise kept off D1 - and because the product models a trip as single-zone to begin with. Overturn this row by taking the airports lookup, not by adding a package. |

## Amendment

What ships in #1004 (phase 2, the forecast slice, #820) differs from the design above in these places.

1. **No `fetchedAt` crosses the wire.** `DayReading` carries no fetch time at all, for any kind. The cache entry keeps it internally, and the badge draws nothing from it (the parent #818 asked for it coarsened or recorded as acceptable; this records it as not sent). This does not hide that another workspace looked a point up: the cache is read before the allowance is spent, so a workspace can still tell a cached point (a forecast, at no cost) from an uncached one (`unavailable` once its allowance is gone, or a slower answer) for a point given to four decimals, about 11 m, within the provider's stated expiry. That is accepted for `develop` because the key holds a coordinate and nothing else, the time is not sent, and the only fix is a cache per workspace, which multiplies provider calls and KV entries by the number of workspaces. A person decides whether it is acceptable before any `develop` -> `main` promotion, with the attribution item (#822).
2. **The response carries the reader's `distanceUnit`.** `TripWeather` is `{ distanceUnit, days }`; readings stay metric and are converted at render, because the cached entry is shared by every workspace.
3. **`unavailable` has no `kind`.** An unavailable day is `{ dayId, status: 'unavailable' }`; the badge needs no more.
4. **The forecast reaches 14 days ahead, and never past the last fully covered local date.** `FORECAST_LOOKAHEAD_DAYS = 14` stops a far-future day from spending an allowance unit; a day inside it but beyond what the provider covers is `none`.
5. **A day's location skips a place without a point.** The stay rule is unchanged; for the first-stop fallback, the first stop whose place has both coordinates is taken, so a stop a person typed in by hand does not hide a located one.
6. **A trip with no time zone is bucketed in UTC.** Never the reader's zone, so two members of one trip see one answer.
7. **The allowance is spent once per request.** The cache is read for every place first, then one read and one write of the tally grants as many lookups as are left, earliest day first (`spendRateUnits`). Serial per-place spends wrote one KV key several times a second, which KV does not honour. A place the grant does not reach is `unavailable`, the same as a spent month.
8. **`nasa-power` is registered as a metered provider ahead of its client** (#823), as the ticket lists both slugs; there is no CHECK on the slug column, so no migration.
9. **A dated day with no forecast keeps an empty, reserved box**, so a late answer shifts nothing; an undated day draws nothing. The box's width is a floor (`min-w-20`), so a rare wide reading widens it instead of painting over the day header.
10. **The plan screen asks again when the plan is edited.** The weather query is keyed by trip only, so the screen invalidates it when the board's data is reloaded; an answer already in hand survives a failed refetch.
11. **Daily highs and lows come from the `instant` temperatures only.** The `compact` product carries no `air_temperature_max/min` for its six-hour steps, so beyond the hourly stretch a day's extremes are the extremes of the steps present (at most four a day) and can understate the true peak. Recorded as a known limit; #821 (re-validation, failure memory, the resolution log) did not take up whether another product is worth its size, so it stays a limit until a ticket asks for it.
12. **Attribution is not on screen yet.** CC BY 4.0 requires it with the reading; it lands with the popover (#822) and must precede any promotion to `main`. _Closed by the popover below (#822)._
13. **A stored forecast entry gained `lastModified` without a version bump (#821).** The field is additive and defaults to `null`, so an entry written before it is read as before and fetched without a validator once it expires; bumping `WEATHER_CACHE_VERSION` would have discarded entries still inside their six-hour retention for no gain. The "any change to a stored shape bumps it" rule above is for a change an older reader cannot survive.

What ships with the popover (#822, the fuller forecast) differs from the design above in these places.

14. **The panel is `DayWeatherPanel` in `day-weather-panel.tsx`**, a unit with no popover in it, and the badge in `day-weather-badge.tsx` puts it in one. A forecast badge is now a button, the day header button's sibling; an unavailable, loading or empty day stays a picture or empty space, because there is nothing behind it to open. Sunrise and sunset are rows of the panel since #824 (computed in `src/lib/sun.ts`, carried on every `ok` outcome the server resolves, and left off the wire for a trip with no time zone, amendment 33); the recorded note is a line of it since #823 (amendment 26), and the estimate note since #825 (amendment 36).
15. **`DayReading` carries `precipitationMm`, `precipitationProbability`, `windMs` and `slots`**, all metric, converted at render like the temperatures (`mm` or `in`, `km/h` or `mph`; the unit symbols are written the way `formatDistance` writes `km`, not as copy). The daily total is the sum of the steps' amounts, each step contributing its hourly figure and only otherwise its six-hourly one, so the overlapping six-hour figures are never added on top of the hourly ones; it is `null`, never `0`, when no step carries one.
16. **The compact product sends no chance of rain.** Its summaries carry `precipitation_amount` and nothing else (`next_12_hours.details` is empty, recorded 2026-10-09), so `precipitationProbability` is `null` for every MET reading today and the panel's "chance" is not drawn. The client still reads `probability_of_precipitation` when a summary states one, so a richer product needs no further change.
17. **Slots are the slots that have a step, or one that covers them**, so today, once the morning has gone, has two and a later day four. `from` is the slot's local start (`00:00`, `06:00`, `12:00`, `18:00`), the sky is that of the step whose six hours cover most of the slot (none when they cover less than half of it, because past the hourly stretch the steps sit at 00, 06, 12 and 18 UTC, which is not a slot start in most zones), and the temperature is the mean of the steps inside the slot. `slots` is `null` when a day has none, which the panel reads as no region at all.
18. **The forecast cache is `wx:v2:forecast:<lat4>:<lng4>`.** A step now stores wind, precipitation and the chance, which is a change of stored shape; `WEATHER_CACHE_VERSION` moved from `v1` to `v2` as the Data Model requires (the failure key carries the same prefix, so its `v1` entries are dropped too, which costs at most one retry), and the `v1` entries are left to expire on their 6 h retention. Unlike `lastModified` (item 13), the new step fields are required, so an older entry cannot be read as the new shape and a bump, not a default, is the right answer. Until they do, a board opened for a point costs one call it would not have, which is the price of never serving a step without the fields it is now read for.

What ships with the recorded kind (#823) differs from the design above in these places.

19. **`POWER_LAG_DAYS` is 3, measured 2026-10-12.** At 11:42 and 12:09 UTC the daily point service held values through 2026-10-09 and the fill value for 10 to 12 October at Oslo, Sydney, Tokyo, New York, Nairobi and Reykjavik. A date is published once it is three or more days before today in UTC (`lastRecordedDate`), whatever the trip's zone, because the service publishes on its own clock; a request whose `end` is after today is answered clipped to today, so the call never asks past the newest published day.
20. **NASA is sent one decimal, not four.** The grid is about 0.5 degrees, so the request, the recorded key (`wx:v2:recorded:<lat1>:<lng1>:<date>`, `v2` with the forecast key) and the failure entry (`wx:v2:fail:nasa-power:<lat1>:<lng1>`, the one-decimal value written with four, as `59.9000:10.8000`, by the shared `failureCacheKey`) share one rounding. ADR 0038 is amended to say so.
21. **Day kind is one pure function.** `selectKind(date, { today, forecastEnd, recordedEnd, recordedStart })` returns `forecast`, `recorded`, `not-yet-recorded` or `none`; it runs once before the fetch with `forecastEnd = today + FORECAST_LOOKAHEAD_DAYS` (so a far-future day is never fetched) and once after, with the last date the forecast really covers. Since #825 a day past the window is an `estimate` (amendment 36).
22. **The wire reading is a union on `kind`.** `DayReading = ForecastReading | RecordedReading`. A recorded day has nullable temperatures (a fill value is an absent field, never a number; both absent is `unavailable`, and has no reading), precipitation and wind, `source: 'nasa-power'`, no symbol and no slots. `unavailable` still has no `kind` (item 3): "unavailable for the recorded kind" is told from `not-yet-recorded` by `status`.
23. **Recorded days are an opt-in of the request.** `loadTripWeather` takes `recorded?: boolean`, absent meaning `false`, and the planner always sends `true`. A tab loaded before this deploy runs a bundle that cannot draw `not-yet-recorded` (its badge model has no such branch) and would draw a null temperature as `0`, so without the flag the server answers `none` for a past day, exactly as before. A schema only gains an optional field (`BACKWARD_COMPATIBILITY.md`). The field is removable once no tab older than this release can be open.
24. **One allowance grant covers both kinds.** The cold calls of both kinds are one list, forecast calls first, so a month that runs out costs the recorded days before the forecast ones. One recorded call per location covers every cold past day of it, and the range sent is the span of the cold days, not of the trip.
25. **Retention of an empty day is one hour.** A day the provider answers with neither temperature (the fill value beyond the lag, or a gap) is `unavailable`, is not given the 24 h / 30 d retention of a real reading, and is kept for an hour so a gap does not spend an allowance unit on every view.
26. **Copy.** `plan.weather.badge.recordedHigh` and `recordedLow` name a recorded day that has only one temperature, and `plan.weather.panel.high` and `low` label the lone figure; the recorded note and the attribution are two lines in the panel. A not-yet-recorded day is drawn as a muted clock with its own accessible name, not as the unavailable dash, so the two never look alike. The clock also carries a `title`, so a pointer reader sees the words.
27. **Nothing dated before the provider's data is asked for.** NASA POWER refuses a range that starts before 1981-01-01 with a 422 (measured 2026-10-12), and a refusal is remembered per provider and cell for every workspace, so one mistyped year ("1026") would blank the cell for all of them for five minutes at a time. `RecordedProvider.firstDate` (`POWER_FIRST_DATE`, `1981-01-01`) reaches `selectKind` as `recordedStart`: an earlier past day is `none`, with no call, no unit and no failure entry.
28. **The forecast takes its places in the cap first.** Of the 12 locations a request resolves, those with a forecast day are kept before those with only recorded days, each in day order, so a trip under way with a dozen past stays still shows today's forecast. A finished trip with more than 12 locations still leaves the later ones `unavailable`; counting recorded days by one-decimal cell rather than by location is a follow-up.
29. **Known limit of the lag.** `POWER_LAG_DAYS = 3` was measured at midday UTC (item 19), so the first hours of the UTC day on which a date turns "recorded" are unmeasured. If the service publishes later than 00:00 UTC, that date reads `unavailable` for those hours (one allowance unit per cell per hour at most, by the one-hour retention of an empty day). Re-measure just after 00:00 UTC; a lag of 4 is the safe value if it differs.

What ships with the sun times (#824, #1197) differs from the design above in these places.

30. **`sunTimes` returns a `SunTimes`, not `SunTimes | null`, and a side is `null` when the sun does not cross the horizon for it on that local date.** On a full polar day that is both sides; on the first or last day of a polar period it can be one side alone, because each side is resolved on its own. A bad date or coordinate gives `{ sunrise: null, sunset: null }`; an unknown zone is read as UTC, as `resolveTimeZone` does everywhere else.
31. **`sun` is optional on the wire type** (`sun?: SunTimes` on `DayWeather`'s `ok` member) and required on the server's `WeatherOutcome`, so an answer cached or served by a worker that predates it leaves the two rows out instead of breaking the panel.
32. **The fixtures sit inside `src/lib/__tests__/sun.test.ts`**, not in a `sun.fixtures.ts`, and number seven for the within-two-minutes check (Oslo twice, Quito, Sydney, and Tokyo, Los Angeles and Apia, whose zones put the crossing on a neighbouring UTC day); Tromsø is asserted separately as `null`. The values are the output of NOAA's published `main.js`, run under node, rounded to the minute.
33. **A trip with no time zone shows no sun times.** `trips.timezone` is written by the seeds only, so a trip created through the UI has none and the weather read falls back to UTC for day bucketing (the edge-case table above). Sunrise and sunset would then be UTC clock times of a place elsewhere, up to hours off and sometimes a sunset before a sunrise, so the route leaves `sun` off those days and the panel draws neither row. The Data Model's `sun` is optional for the same reason. Giving a trip a zone is #1198; until then the rows appear on seeded trips only.
34. **A recorded day carries `sun` too.** `sun` rides on every `ok` outcome, so the `recorded` kind (#823), which has a popover of its own, gets the two rows as a forecast does; the sun is computed from the place and the date and needs nothing from NASA POWER. The badge model's `recorded` member carries `sun` beside `reading`, as the `forecast` one does.
35. **A side belongs to the local calendar date its instant falls on, which leaves a gap where a sunset first passes midnight.** Where the evening sunset drifts past 00:00 (Reykjavik around 15 June, Fairbanks in late May, the days before a polar day in northern Norway) the one date whose sunset lands after midnight has `sunset: null`, and the next date shows `00:00`-ish, the evening before's sunset, ahead of its own sunrise. The panel names the missing side ("No sunset"), which is true of that calendar date and reads oddly in a city that has no polar day. Resolving a side against the solar day instead (a sunset after midnight shown for the day it follows, with a "+1" or the date) needs a display decision and is #1201; `sun.test.ts` pins the Reykjavik dates so a change of rule is deliberate.

What ships with the estimate kind (#825) differs from the design above in these places.

36. **A day is an estimate before the fetch when it is further out than `FORECAST_LOOKAHEAD_DAYS`, and after it when the forecast stops short.** `selectKind` returns `estimate` for a date after `forecastEnd`. A day within the lookahead is a forecast day until the series has been read; the allowance is granted once, up front, so the climatology is asked for before that is known. A place with a forecast day past `FORECAST_CERTAIN_DAYS` (7; MET's compact series ran to today plus nine on 2026-10-12) therefore asks for its climatology too, and a forecast day the series does not cover becomes an estimate when the place asked for one. A forecast that could not be had (outage, spent allowance) leaves a day past those seven with its estimate and a nearer day `unavailable`. A trip wholly inside the seven days never calls the climatology.
37. **Estimates are an opt-in of the request.** `loadTripWeather` takes `estimate?: boolean`, absent meaning `false`, and the planner always sends `true`, for the reason item 23 gives for `recorded`: a bundle that predates the kind would draw an average as a forecast. Without the flag a day beyond the forecast is `none`, nothing is asked of the climatology and nothing is spent.
38. **The estimate key is `wx:v2:estimate:<lat1>:<lng1>`**, `v2` because `WEATHER_CACHE_VERSION` is `v2` since item 18, and the value is `{ v:2, fetchedAt, months }` with twelve months, January first. It is kept thirty days, or an hour when no month has a temperature. A climatology failure is remembered under its own entry (`wx:v2:fail:nasa-power-climatology:<lat>:<lng>`), not the daily one: they are two services, and a failed precautionary call (item 36) must not blank a place's recorded days.
39. **The allowance and the cap follow the order forecast, estimate, recorded.** The cold calls are one list in that order, so a ceiling of one buys the forecast and a ceiling of two the forecast and the estimate; a climatology asked only as a precaution (item 36) ranks as an estimate all the same, because the ticket's own fourteen-day trip needs it to; the 12-location cap keeps places with a forecast day, then with an estimate, then with only recorded days.
40. **`EstimateReading` carries `windMs: null`** so the panel's wind row is left out by the rule that already leaves out a row with no value, and it carries `sun` like every other kind. The climatology reader derives the high and the low together, so a month has both or neither, and a month with neither is `unavailable`. A reading that does carry one temperature (the shape allows it) draws the one it has: the badge is named `estimateHigh` or `estimateLow`, and the panel labels the lone figure `High` or `Low`.
41. **The badge marks an estimate with a `≈` that is hidden from assistive technology and a dashed `border-info` outline**; the accessible name begins "Estimate" in every locale. Copy added: `plan.weather.badge.estimate`, `estimateHigh`, `estimateLow`, `plan.weather.panel.temperatureTypical`, `estimateNote` and `precipitationTypical` ("Typical precipitation per day", the mean in mm per day), in all 23 locales. Where a locale's word for a forecast and for an estimate would be one word (Turkish, Indonesian), the estimate uses a different one.

What ships with the browser proof (#826) differs from the design above in these places.

42. **The cache is seeded by the dev seed route, not by `scripts/seed/seed.mjs`.** `POST /api/dev/seed` (dev only, absent from the bundle) writes the entries through `env.KV` (`src/routes/api/dev/-seed/weather-cache.ts`), because the script has no binding for the KV namespace the Worker reads. The keys are the `wx:v2:` ones of item 18 and are written with no TTL and an `expires` of 2099, so a seeded entry never goes stale between runs. The seed reads its own result back through `resolveTripWeather` in a unit test (`__tests__/weather-cache.test.ts`) with vendors that fail the test if called, so a change to the cache keys or the policy fails there before it fails the journey.
43. **The allowance is spent by writing the rate counter, not by a ceiling of 0.** The ceiling is the plan's (`PLAN_RATE_CEILINGS`), not a per-workspace setting, so the seed writes the month's counter (`rate:v1:weather_lookups_per_month:<org>:<YYYY-MM>`, the window of the fixture anchor day) at the plan's ceiling. A day with no cached entry then resolves to `unavailable` through the real allowance path, and no vendor is called.
44. **The weather policy follows the pinned day.** `weatherRuntime` took the wall clock, so a journey anchored on the fixture day (2026-08-20) would have seen every seeded day as long past or far ahead. `src/server/clock.ts` gains `serverNow()`, which reads the same `x-pt-server-today` header as `serverToday()`, in development only (the branch is folded out of the production build), and `bindings.ts` passes it as `now`. This is the one line the "nothing in the Worker changes" premise of item 12 did not allow for.
45. **The seeded days.** Lisbon day 1 is `recorded`, days 2 and 3 are `not-yet-recorded` (inside the three-day lag), days 4 and 5 are `forecast`, day 6 (Cascais) is `unavailable` and day 7 has no place and so no badge; Tokyo day 1 is an `estimate`. No place is added to the dataset: Cascais already resolves to a coordinate with no entry (item 12 asked for a place to be seeded).
46. **"No outbound call" is asserted twice.** The browser cannot see what the Worker fetches, so the journey checks that the page itself requests nothing from `api.met.no` or `power.larc.nasa.gov`, and reads the `met-norway` and `nasa-power` call counts on `/console/providers` (the provider ledger counts every outbound call the Worker makes) before and after and requires them to be equal.
47. **The layout-shift assertion covers the weather answer, not the whole visit.** The shell's top navigation shifts by 0.00073 at about 0.7 s, before any weather request, when its font loads. The journey counts the shifts reported after the read is released and requires exactly 0, with no tolerance; the whole-visit total is attached to the test as an annotation. The proof found one real shift of 0.000027, a `not-yet-recorded` clock drawn into the skeleton's own `<span>`, and `day-weather-badge.tsx` gives it a `key` so the element is replaced; the journey fails without it. The shell navigation is not changed here.
48. **The pictures are taken when `WEATHER_EVIDENCE_DIR` is set.** One PNG per theme, width (360, 1280, 2560) and state, written to that directory; the test is skipped otherwise, and no frame is compared in the suite. On a phone the days are behind the "Days" sheet, which the journey opens first.
