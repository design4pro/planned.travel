# Weather for every day of a trip, from free sources we are licensed to use

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #631  |
| **Spec PR**        | none  |
| **Implementation** | none  |

## 📝 TLDR

Every dated day of a trip that has a location gets a weather reading: a compact badge in the day
header of the planner, and a fuller reading behind it. The reading comes from one of three sources
chosen by how far the day is from today. Days inside the forecast window use a **forecast** from MET
Norway's Locationforecast. Past days use a **recorded** daily value from NASA POWER. Days beyond the
window use a climate **estimate** from NASA POWER's long-term means, which always carries a visible
marker. Both providers are free and licensed for commercial use. That is the one property that lifts
the block on `DOC-08` (`06-S7` in `docs/plans/06-documents-and-media.md`), and phase 1 records it as
ADR 0024. Three rules apply throughout. Readings are cached in the existing `KV` namespace under keys
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

| Day relative to today                                 | Kind       | Provider                         | What it gives                                                                                                                |
| ----------------------------------------------------- | ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| today … last day the forecast fully covers (≈ 9 days) | `forecast` | MET Norway Locationforecast 2.0  | min/max °C, precipitation mm, precipitation probability where given, max wind m/s, a condition symbol, and four 6-hour slots |
| before today                                          | `recorded` | NASA POWER daily point API       | min/max °C, precipitation mm/day, mean wind m/s at 2 m                                                                       |
| after the forecast's last full day                    | `estimate` | NASA POWER climatology point API | the long-term monthly mean min/max °C and precipitation for that day's month                                                 |

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
  - HTTPS and gzip only;
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
- **Ordering per location**, the same as geo: plan gate (`ceiling <= 0` → `RateCeilingError`) →
  cache → meter (`spendRateUnit`, a miss only) → vendor call inside
  `callProvider(outbound, { provider: 'met-norway' | 'nasa-power', operation, organizationId })` →
  cache write. A read or write error on KV is logged and treated as a miss, as `geocode.ts:336` and
  `:362` do.
- **Batching.** The server function groups the trip's days by rounded coordinate and makes **at most
  one call per location and provider**:
  - one Locationforecast call covers every forecast day at that location;
  - one NASA daily call (`start`..`end` spanning the past days) covers every recorded day;
  - one climatology call covers every estimated day.

  A fourteen-day trip in one city costs at most three outbound calls on a cold cache, and none on a
  warm one.

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
| `wx:v1:forecast:<lat4>:<lng4>`              | `{ v:1, fetchedAt, lastModified, expires, series: RawStep[] }`: the provider's timeseries, trimmed to the fields we read, **not** grouped into days | `min(3600, seconds until MET's Expires)`, floor 60  |
| `wx:v1:recorded:<lat1>:<lng1>:<YYYY-MM-DD>` | `{ v:1, fetchedAt, day: RecordedDay }`                                                                                                              | 24 h if the date is under 90 days old, else 30 days |
| `wx:v1:estimate:<lat1>:<lng1>`              | `{ v:1, fetchedAt, months: MonthlyMean[12] }`                                                                                                       | 30 days                                             |

- `<lat4>` means rounded to 4 decimals, which is also MET's truncation rule. `<lat1>` means rounded to
  1 decimal. NASA's grid is about 0.5°, so a finer key only fragments the cache for the same cell.
- **Days are grouped at read time, never in the cache.** Two trips at the same coordinate can have
  different time zones (or none, which resolves to UTC), so a cached day boundary would be wrong for
  one of them. The entry holds the raw timeseries; `met-norway.ts` groups it into the reading trip's
  local days on every read. That is a pure function over at most about 90 steps.
- **This deviates from the `06-S7` key sketch, deliberately.** Forecast and estimate are keyed per
  location, not per date, because one provider call answers every date and one KV entry per call
  keeps reads at one per location. Recorded values stay per date because the requested range differs
  between trips. The long TTLs on settled history and on climatology follow from what the data is: a
  30-year monthly mean does not change within a month.
- **No tenant data in any key**: coordinates, a date, and nothing else. The module exports no
  function that takes a trip, place or member id (`06-S7`, isolation rule).
- **A missing value in a cached entry is a miss, not an error.** That covers a malformed entry, a
  wrong `v`, or a failed Zod parse; the pattern is `src/server/billing/entitlements.ts:110-136`.
  NASA's `-999` normalises to `null` for that field, never to a number.

**Limits.** A fourth rate metric, `weather_lookups_per_month`, goes into `RATE_METRICS` and
`PLAN_RATE_CEILINGS` (`src/server/billing/limits.ts:120-189`, whose comment "All three are far below…"
becomes "All four", with a paragraph for weather): free 300, solo 3,000, crew 12,000. Only
a cache miss spends it, one unit per outbound call. When the remaining budget is smaller than the
number of misses, calls are spent in the order **forecast → estimate → recorded**: the near-term day
is the one a traveller acts on. Everything not reached is `unavailable`, and a test covers a
budget of 1 against 3 needed calls. The numbers follow the geocode reasoning in that
file's comment: a cold fourteen-day trip spends up to three units, so Free's 300 covers about a
hundred cold trip views a month.

## 📝 API Contracts

One server function, route-local like `-server/geocode.ts:40-99`:

```ts
// src/routes/_app/trips/$tripId/-server/weather.ts
const input = z.strictObject({ tripId: id })

type DayWeather =
  | { dayId: string; status: 'none' } // undated day, or no location
  | { dayId: string; status: 'unavailable'; kind: WeatherKind } // provider/ceiling/parse failure
  | { dayId: string; status: 'ok'; reading: DayReading; sun: SunTimes | null }

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
  sunrise: string | null // 'HH:mm' local to the trip's zone; null in polar night / midnight sun
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
  one coordinate, chosen in this order:
  1. the place of a stay covering that day (`day_accommodations` from `start_day_id` to
     `end_day_id` → `places.lat/lng`). On a changeover day covered by two stays, the stay whose
     `start_day_id` is this day wins, because that is where the traveller sleeps. A stay whose
     `place_id` is `NULL` (the FK is `set null`) is skipped, not treated as a location;
  2. else the first assigned place by `order_index` (`day_assignments` → `places`);
  3. else `null`, which makes the day `none`.

  This is the one SQL change, and it lives in `server/repos` as SPEC §6 requires.

- **Failure mapping**: `RateCeilingError`, `ProviderBlockedError`, a vendor error, or a timeout
  (10 s, like `GEOAPIFY_TIMEOUT_MS`) turns the affected days into `unavailable`. The function
  **never rejects** for a provider reason. A trip-not-found or role failure still throws, as it does
  everywhere else.
- **Client**: called with TanStack Query from the plan screen after first paint, with key
  `['trip-weather', tripId]` and `staleTime` of 15 minutes. It is not part of the route loader.

## 📝 UI/UX

- **Badge** (`day-weather-badge.tsx`), placed **beside** the day header button in `day-section.tsx`,
  never inside it. The date label (`:163-171`) sits inside the header `<button>` (`:140-176`), so the
  badge cannot go there. The header button and the badge become siblings in a new
  `flex items-center` wrapper: the button keeps `flex-1` and its current contents, and the badge sits
  at the row's end, vertically centred. It shows a condition icon for a forecast, a
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
  the badge when the popover closes. When the day detail (#124, `01-S9b`) lands, it renders the same
  `DayWeatherPanel` body in its declared weather region. This spec does not wait for it.

- **Unavailable**: a muted "—" badge whose name and popover say "Weather unavailable for this day".
  It is never a zero and never a blank that looks like success.
- **Colour**: semantic tokens only (`--color-info`, `--color-warning`, `--color-danger` and their
  `-soft` companions). There is no weather palette and no change to `src/styles/tokens.css`. The icons
  come from the icon set already in use.
- Motion: the popover uses the existing primitive's motion, and `prefers-reduced-motion` is honoured
  by it. Keyboard: Tab reaches the badge, Enter/Space opens it, Escape closes it.

Illustrative mockup (static, not app code): `assets/per-day-weather/mockup-01-day-rows.html`,
rendered as `mockup-01-day-rows-light.png`, `mockup-02-day-rows-dark.png` and
`mockup-03-day-rows-mobile.png` in the same folder.

## 📝 Visual change expected

- Route `/trips/$tripId/plan`: every dated day header with a location gains a badge. States to
  capture:
  - resting forecast;
  - recorded (past trip);
  - estimate with its marker;
  - unavailable;
  - loading skeleton;
  - popover open for a forecast and for an estimate.
- Light and dark, at 360, 1280 and 2560 px (desktop and mobile), per `06-S7` § Verification.
- No other route changes. Undated days and days without a location look exactly as today.

## 📝 Copy

New keys in `src/lib/i18n/messages/en/trips.ts`. The implementation lands every one of them in all 23
locales in the same change (`i18n-messages` skill).

| Key                                   | en text                                               |
| ------------------------------------- | ----------------------------------------------------- |
| `plan.weather.badge.forecast`         | `Forecast: {condition}, high {max}, low {min}`        |
| `plan.weather.badge.recorded`         | `Recorded: high {max}, low {min}`                     |
| `plan.weather.badge.estimate`         | `Estimate: typical high {max}, low {min}`             |
| `plan.weather.badge.unavailable`      | `Weather unavailable for this day`                    |
| `plan.weather.badge.loading`          | `Loading weather`                                     |
| `plan.weather.panel.title`            | `Weather for {date}`                                  |
| `plan.weather.panel.precipitation`    | `Precipitation`                                       |
| `plan.weather.panel.probability`      | `{percent} chance`                                    |
| `plan.weather.panel.wind`             | `Wind`                                                |
| `plan.weather.panel.sunrise`          | `Sunrise`                                             |
| `plan.weather.panel.sunset`           | `Sunset`                                              |
| `plan.weather.panel.slot.night`       | `Night`                                               |
| `plan.weather.panel.slot.morning`     | `Morning`                                             |
| `plan.weather.panel.slot.afternoon`   | `Afternoon`                                           |
| `plan.weather.panel.slot.evening`     | `Evening`                                             |
| `plan.weather.panel.estimateNote`     | `A long-term average for this month, not a forecast.` |
| `plan.weather.panel.recordedNote`     | `Measured values for this day.`                       |
| `plan.weather.attribution.metNorway`  | `Forecast data: MET Norway, CC BY 4.0`                |
| `plan.weather.attribution.nasaPower`  | `Data: NASA Langley Research Center POWER Project`    |
| `plan.weather.condition.clear`        | `Clear`                                               |
| `plan.weather.condition.fair`         | `Fair`                                                |
| `plan.weather.condition.partlyCloudy` | `Partly cloudy`                                       |
| `plan.weather.condition.cloudy`       | `Cloudy`                                              |
| `plan.weather.condition.fog`          | `Fog`                                                 |
| `plan.weather.condition.rain`         | `Rain`                                                |
| `plan.weather.condition.heavyRain`    | `Heavy rain`                                          |
| `plan.weather.condition.sleet`        | `Sleet`                                               |
| `plan.weather.condition.snow`         | `Snow`                                                |
| `plan.weather.condition.thunder`      | `Thunder`                                             |
| `plan.weather.panel.noSunrise`        | `No sunrise`                                          |
| `plan.weather.panel.noSunset`         | `No sunset`                                           |

MET's symbol codes are mapped to the condition groups by a table in `day-weather-badge.tsx`'s model
file; the day/night suffix is dropped for the label.

## 📝 Edge Cases & Failure Scenarios

| Case                                                               | What the user sees                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Day has no date                                                    | No badge (`none`), exactly as today.                                                                                                          |
| Day has a date but no stay and no place                            | No badge (`none`).                                                                                                                            |
| MET returns 403/429/5xx or times out                               | Forecast days show "unavailable". Recorded and estimated days still render, because they come from separate calls. Logged via `callProvider`. |
| NASA returns `-999` for a field                                    | That field is omitted in the popover. If both temperatures are missing, the day is "unavailable".                                             |
| Yesterday or the day before, not yet in NASA's near-real-time data | "Unavailable" for that day. It is never back-filled from the forecast.                                                                        |
| Workspace hits `weather_lookups_per_month`                         | Cached days still render. Uncached days show "unavailable". The ceiling is never exceeded.                                                    |
| Provider ledger blocks a vendor (`ProviderBlockedError`)           | Same as an outage for that vendor.                                                                                                            |
| KV read or write fails                                             | Treated as a miss, with a logged event. The reading is still served from the provider.                                                        |
| Trip time zone missing or invalid                                  | `resolveTimeZone` falls back to UTC, which is the existing behaviour.                                                                         |
| Polar day or polar night                                           | `sun.ts` returns `null` for rise/set. The popover says "No sunrise" or "No sunset", shown as a dash with that accessible name.                |
| Trip in the far future (for example next year)                     | Every day is an estimate with its marker.                                                                                                     |
| Two days at the same place                                         | One call; both days are served from the same entry.                                                                                           |
| The forecast window's last day is partial                          | It is not a forecast day, so it is an estimate.                                                                                               |

## 📝 Risks & Impact Review

- **Blast radius.** The change is additive: a new module, a new server function, a new KV prefix
  `wx:v1:`, a fourth rate metric, a badge, and one repository read. No schema change, no migration,
  no change to an existing contract. `BACKWARD_COMPATIBILITY.md`: no protected surface is touched.
  `RATE_METRICS` gains a member, and the generic loops in `limits.test.ts` (`:590`, `:610`, `:619`,
  `:711`) cover it.
- **Licence risk.** It is the reason this spec exists. The terms were read on 2026-09-19 and are
  recorded in ADR 0024. A term change by either provider is handled by a new ADR, and the vendor
  seam keeps a swap to one file.
- **Cost.** Zero per call. KV reads and writes stay within the existing binding's allowance at our
  volumes (`docs/ARCHITECTURE.md` §8).
- **Rollback.** Revert the badge import in `day-section.tsx` and the query hook, and the feature is
  gone. KV entries expire on their own. The rate metric can stay unused.

### Out of scope

- Any paid or non-commercial source.
- Alerts and warnings, radar or map layers, air quality, and weather notifications.
- Weather per place, rather than per day.
- The public or shared trip page.
- Storing readings in D1.
- A separate temperature-unit preference; this spec couples to `distance_unit`.
- Filling the #124 day-detail region. That is a one-line render once #124 merges, and belongs to
  whichever lands second.

## 📋 Phasing

1. **Decision on record.** ADR 0024, plus `11-S3` and `06-S7` updated. Docs only.
2. **Server.** Vendors, policy, limits, repository read and server function, all with unit tests and
   no UI caller. The app is unchanged.
3. **Surface.** Badge, popover, copy in 23 locales, and a Playwright journey. The feature becomes
   visible.

Each phase is one pull request and leaves `develop` green.

## 📋 Implementation Plan

### Phase 1 — decision on record

1. Write `docs/adr/0024-met-norway-and-nasa-power-for-weather.md` in the shape of
   `0013-geoapify-for-geocoding.md` (Context / Decision / Consequences / Alternatives rejected). Record
   the three kinds, the terms quoted above with the date they were read, and the rejected
   alternatives with the clause that rejects each. Check: the file exists, and `pnpm lint` passes on
   markdown.
2. In `docs/plans/11-boundaries-and-blockers.md`, strike weather through in "The provider decisions"
   and in the `DOC-08` register row, citing ADR 0024, the same way geocoding cites 0013. In
   `docs/plans/06-documents-and-media.md` `06-S7`, mark the stage unblocked and point at this spec.
   Check: `grep -n "DOC-08" docs/plans/11-boundaries-and-blockers.md` shows the struck row with the
   citation.

### Phase 2 — server

3. Write `src/lib/sun.ts` (`sunTimes(lat, lng, dateKey, timeZone): SunTimes | null` for each side).
   Tests against the NOAA Solar Calculator's (gml.noaa.gov/grad/solcalc) values, captured once into
   `src/lib/__tests__/sun.fixtures.ts` with date, coordinate, zone and expected `HH:mm`. Cases: Oslo on
   21 June and 21 December, Quito on the equinox, Tromsø on 21 December (no sunrise) and 21 June (no
   sunset), and Sydney on 21 December. Each must be within ±2 min.
4. Write `src/server/weather/met-norway.ts`: `createMetNorwayClient({ fetch })` and `metNorwayVendor`.
   It calls `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=&lon=` with the fixed
   `User-Agent`, `Accept-Encoding: gzip`, and `If-Modified-Since` when a previous `lastModified` is
   known. It normalises the timeseries into full local days (the trip's time zone), producing min/max,
   summed precipitation, max probability, max wind, a dominant symbol and four 6-hour slots, and it
   returns `expires`. Tests use a recorded fixture: day bucketing across a time-zone offset, dropping a
   partial last day, and a 304 re-using the cached entry.
5. Write `src/server/weather/nasa-power.ts` with `createNasaPowerClient({ fetch })`, `daily(lat, lng,
start, end)` using `T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M`, `community=AG`, `time-standard=LST`, and
   `climatology(lat, lng)` using `T2M_MAX,T2M_MIN,PRECTOTCORR` (no wind, because an estimate does not
   show it). `-999` becomes `null`. Tests use fixtures for
   both endpoints and a fill-value case.
6. Write `src/server/weather/weather.ts`, containing `resolveTripWeather(runtime, days: {dayId,
date, lat, lng}[], today, timeZone)`: kind selection, grouping by rounded coordinate, the
   KV read-through with the key/TTL table, metering per miss, `callProvider` around each call, and
   mapping errors to `unavailable`. Tests, with an in-memory KV, fake counters and a fake fetch:
   - selection at each boundary;
   - one call per location and provider for a fourteen-day trip;
   - a warm cache making zero calls;
   - a malformed entry treated as a miss;
   - an outage on one vendor leaving the other kinds intact;
   - a ceiling of 0 or exhausted producing `unavailable` without a call;
   - **no exported function accepting a trip, place or member id**, asserted by a `seam.test.ts`
     that keys are built only from `(kind, lat, lng, date?)`.
7. Write `src/server/weather/bindings.ts` with `weatherRuntime({ organizationId, ceiling })`, wiring
   `env.KV`, `requestOutboundRuntime()` and the global `fetch`, plus `cloudflare-env.d.ts`. Add `'met-norway'` and
   `'nasa-power'` to `METERED_PROVIDERS` (`src/server/db/schema.ts:414`). `callProvider` accepts only
   those slugs. No migration is needed, because the column is plain text, and the fixtures in
   `src/server/fns/console/__tests__/providers.test.ts` and
   `src/server/catalog/__tests__/provider-usage.test.ts` are updated. Add
   `weather_lookups_per_month` to `RATE_METRICS` and `PLAN_RATE_CEILINGS`, and one test in
   `limits.test.ts` asserting that every plan's weather allowance is above 0.
8. Add `readDayLocations(scope, tripId)` in `src/server/repos/itinerary.ts` (stay → first place →
   null), and a case in `src/server/repos/__tests__/tenant-isolation.test.ts` showing that another
   workspace's trip id resolves nothing.
9. Write `src/routes/_app/trips/$tripId/-server/weather.ts` with `loadTripWeather`: a Zod
   `strictObject` input, `assertTripRole` at read level, the ceiling from
   `resolveLimitsFromRow(await getSubscription(scope)).rates.weather_lookups_per_month`, and the
   runtime through injected `ports` as `-server/geocode.ts` does. Tests: a viewer can read; a foreign
   trip is refused; a provider error yields `unavailable` rather than a rejection.
   Gate: `validation.commands` green.

### Phase 3 — surface

10. Add every key in **Copy** to `en/trips.ts` and to the 22 other locales (`i18n-messages` skill).
    Check: the parity test passes.
11. Write `src/components/planner/day-weather-badge.tsx` (badge + `DayWeatherPanel` in a `Popover`),
    a pure model file mapping symbol → condition group and metric → display units, and render the
    badge in `day-section.tsx` from a `weather` prop. The plan screen runs the query and passes each
    day's `DayWeather` down. Unit tests cover the model: unit conversion, symbol grouping, and the
    accessible name for each kind, including the estimate prefix.
12. Make e2e deterministic without stubbing across the server boundary, which `page.route` cannot
    reach. `bindings.ts` swaps the global `fetch` for `fixtureFetch` from
    `src/server/weather/fixtures.ts` when `env.WEATHER_FIXTURES === '1'`. That variable is set only
    in the e2e dev vars (`.dev.vars.example` documents it) and never in `wrangler.jsonc`, and a unit
    test asserts that `wrangler.jsonc` does not define it. The fixture responds by coordinate: one
    location returns a forecast, one returns HTTP 503, and NASA returns fixed daily and climatology
    bodies. Add a journey `e2e/trip-weather.spec.ts` on a seeded trip whose places use those
    coordinates.
    Cover a forecast day, a past trip's recorded day, an estimate with its marker and accessible
    name, an unavailable day, and keyboard open/close of the popover. **No layout shift** is measured, not
    eyeballed: the first day header's `boundingBox()` is equal before and after the weather query
    settles, and a `PerformanceObserver('layout-shift')` sum on the plan route stays at 0. Capture evidence in light and dark at 360/1280/2560.
    Gate: `validation.commands` green, plus `pnpm e2e`.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                  | Applied default                                                                  | Why                                                                                                                               |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Split into separate specs (forecast vs history/estimate)? | One spec, three phases.                                                          | `06-S7` argues the halves are not independently useful. A forecast-only badge leaves most of a trip blank at planning time.       |
| Q2  | Which coordinate represents a day?                        | The stay covering the day, else the first assigned place by order, else none.    | This reuses existing rows with no new field. Carrying yesterday's location forward would invent a location.                       |
| Q3  | Temperature unit preference?                              | Couple to the existing `distance_unit` (user over organisation).                 | This needs no new column or preference and is reversible. `09-S8` can split it later.                                             |
| Q4  | Sunrise/sunset source?                                    | Compute locally in `src/lib/sun.ts`.                                             | Zero calls, exact, and testable. MET Sunrise would be one call per date.                                                          |
| Q5  | How is the estimate derived?                              | NASA POWER long-term monthly mean for the day's month.                           | One call per location, a statistically meaningful average, and always marked as an estimate.                                      |
| Q6  | Where does the fuller reading live before #124 lands?     | A `Popover` from the badge. The same panel body goes into the #124 region later. | This does not block on an open issue and reuses an existing primitive.                                                            |
| Q7  | Rate ceilings for `weather_lookups_per_month`?            | Free 300, Solo 3,000, Crew 12,000.                                               | The providers cost nothing, and the ceiling exists to bound abuse and respect MET's rate policy. The numbers are cheap to change. |
| Q8  | Fetch in the route loader or after paint?                 | After paint, through TanStack Query.                                             | A provider outage must never render `PlanError` or delay the board.                                                               |
