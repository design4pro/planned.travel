# Atlas statistics: keep the roll-up current, and read it by year

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S6 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S6` is the statistics half of the atlas module (reference row `ADD-06`). The stage was written when nothing in
production recomputed `travel_stats`. That is no longer true, and the stage's premises have moved with the code, so this spec
describes what is **left** at HEAD (`4ed3a555`), as **two tickets that are each a full path from write to screen**:

1. **08-S6a - the roll-up follows the trip's contents.** The Stats tab prints places, cities, days and distance from the stored
   roll-up, and the roll-up is rebuilt only when a trip is created, edited, copied, deleted or its people change, or a country is
   marked. Adding, editing or deleting a place, saving or deleting a transport leg, or confirming a booking import rebuilds
   nothing, so a traveller who plans a trip and then fills it sees "Your places: 0" until something unrelated happens to enqueue a
   recompute. One helper in the existing fan-out module is called from the seven server functions and the one import routine that move
   those figures.
2. **08-S6b - read the roll-up by year.** The year rows are already in the `/atlas` payload and nothing reads them. The Stats tab
   gains a period control ("All time" and every year with a trip), the traveller's year streak with the years it spans, the
   countries a year's trips cover, and a designed empty state and failed state for the section. The payload does not change.

No schema change, no migration, no route added, no package added, no new server function, no new queue message kind, and no change
to the `/atlas` payload.

**Reference row `ADD-06` is `partial` today and is `done` when both tickets have merged.**

The plan's stage block is not built as written. Every departure is a row of the Resolved assumptions table; the headline ones are:
no `loadTravelStatsFn` (the rows ship already), no "stale" marker (its premise is gone), no 220 ms count-up (its only job was the
marker), no `distance_metres` omission (the leg form records a distance now), and the figures are labelled the **traveller's**, not
the workspace's (ADR 0007). Later stages are named here by what they ship, never by id: the backlog reads any mention of a stage id
in a spec as that stage being specified already.

## 📝 Problem Statement

Verified against the repository at HEAD:

- **The recompute exists and is wired to too few writes.** `src/server/queue/handlers/travel-stats.ts` (handler; the 10 s collapse
  window `RECOMPUTE_WINDOW_MS`) and `src/server/queue/travel-stats-fanout.ts` (`requestTravelStatsRecompute`, `enqueueTravelStats`,
  `affectedStatYears`) are built. Producers: `markCountryVisitedFn` / `unmarkCountryVisitedFn` (`src/server/fns/atlas.ts`), trip
  create, edit, copy and delete (`src/routes/_app/-server/trip-lifecycle.ts`), membership changes
  (`src/routes/_app/trips/$tripId/-server/people.ts`) and the trip-copy handler (which keeps a private copy of the fan-out,
  `src/server/queue/handlers/trip-copy.ts`). Nothing else enqueues, and no cron rebuilds the table (`wrangler.jsonc` `crons`).
- **The figures that go stale are the ones the panel prints from storage.** `recomputeTravelStats` (`src/server/repos/atlas.ts`)
  counts the traveller's **member** trips (`memberTripIds`, ADR 0007), then their days, places, distinct places' cities, expenses,
  and transport distance. `src/routes/_app/-ui/atlas-screen.tsx` builds the Stats tab from the **all-time** row for trips, places,
  cities, days and distance, and from live reads (`visited_countries`, `visited_regions`) for the headline country count, regions,
  visits and the continent row. A country mark therefore moves live figures only; the stored ones move on trip writes and nothing
  else that a traveller does to a trip.
- **The writes that move the stored figures and enqueue nothing**: `createPlanPlaceFn`, `updatePlanPlaceFn`, `deletePlanPlaceFn`
  (`src/routes/_app/trips/$tripId/-server/plan.ts`), `createPlaceFn` (`src/routes/_app/-server/trip.ts`), the places a confirmed
  booking import creates (`src/server/fns/booking-import.ts`, `confirmBookingImport`), and `saveTransportFn`, `deleteTransportFn`,
  `saveSearchedConnectionFn` (`src/server/fns/transports.ts`). Days follow the trip's dates, and those writes enqueue already.
- **Years are attributed differently per figure.** Trips, days, places and cities of a year row are the trips whose `start_date`
  falls in it. Distance is the transports whose own `departure_date` falls in it (`recomputeTravelStats`, `transportYearFilter`), so a
  trip that starts on 30 December has legs in two years. A producer that sends only the trip's start year leaves the right row
  stale for any leg that departs in another year, and an edit that moves a leg's departure date moves two rows.
- **Year rows ship and nobody reads them.** `loadAtlas` (`src/routes/_app/-server/library.ts`) returns `stats` with one entry per
  `travel_stats` row (`statYear`, `tripCount`, `placeCount`, `cityCount`, `countryCount`, `dayCount`, `distanceMetres`,
  `yearStreak`), and the screen takes `statYear === 0` and discards the rest. There is no year control, no "this year" figure, no
  streak anywhere on the screen, although the reference figure set the plan cites is "trips all time and this year" and "a streak of
  consecutive years". Every field the year view needs is in those rows already.
- **The labelling the plan asks for is already in the catalogue, and says the opposite of what the plan says.** The plan labels seven
  figures the workspace's. The recompute is member-scoped, `src/lib/i18n/messages/en/atlas.ts` already reads "Your trips" and "Your
  places", and its comments record why. `year_streak` is the **traveller's** (`yearStreakFrom`); the recompute writes it on the
  all-time row, and the dev seed also writes it on year rows, so the model reads it from the all-time row only. `region_count` is stored on the all-time row and is `0` on year rows. A year row's `country_count` is the distinct countries
  of that year's trips, and the all-time row's is the visited list.
- **`distance_metres` has a source.** The leg form records a distance (`src/components/modules/transports/leg-form.ts`,
  `distanceKm` -> `distanceMetres`) and the Trips tile already prints the all-time distance as its caption. The plan's "omit it" is
  history.
- **The stale marker has no premise.** Its predicate compared `computed_at` with the newest `visited_countries.updated_at`. The
  stored figures a country mark moves are the all-time `country_count` and `by_continent` and the `by_continent` of the year of
  `visitedOn` (`markCountryVisitedFn` sends the all-time row and that one year), and the panel reads none of them from storage. A
  year row's `by_continent` also keeps only the visited countries that year's trips went to, which is why the year view prints no
  continent breakdown (Resolved assumption 9). The real lag is the 1-10 s recompute window after a write made on another screen,
  which is over by the time the atlas opens.
- **The Stats tab has no section states of its own.** No empty state beyond per-tile captions, and no failed state: a failed
  re-read after a write is already detected on this screen (`status` in `atlas-screen.tsx`, `match.status === 'error'`) and feeds
  the country card's retry, and the Stats tab ignores it.
- **The plan's verification paths are history.** `e2e/product-modules.visual.spec.ts`, `e2e/__screenshots__/` and the four
  `atlas-*` baselines do not exist (ADR 0016: journeys replace the visual gate).

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                            | Not owned (read only, or left alone)                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/queue/travel-stats-fanout.ts` - `enqueueTripRollup`; `affectedStatYears` takes any number of further dates (08-S6a)                                                                                                                                                                                                                                         | `src/server/queue/handlers/travel-stats.ts`, `src/server/repos/atlas.ts` (`recomputeTravelStats`, `listTravelStats`): **not touched**; the recompute is correct, only its triggers are missing |
| The call sites: `plan.ts` (three functions; `requirePlaceOfPlan` returns the place), `trip.ts` (`createPlaceFn`, which gains the planner-write guard), `transports.ts` (three functions), `booking-import.ts` (`confirmBookingImport`)                                                                                                                                  | `src/server/queue/handlers/trip-copy.ts`: its private fan-out stays (Risks)                                                                                                                    |
| `src/routes/_app/-server/library.ts`: **not touched**; the year rows already ship                                                                                                                                                                                                                                                                                       | The `loadAtlas` payload, the seven reads, the 40-row bucket-list cap, the live figures                                                                                                         |
| `src/components/atlas/stats-model.ts` (+ test) - new, pure: which periods exist, which tiles a period shows, whose figure each is                                                                                                                                                                                                                                       | `src/components/ui/*`: untouched; `StatCard`, `Select`, `Alert`, `EmptyState`, `Skeleton` reused as they are                                                                                   |
| `src/components/atlas/atlas-panel.tsx` - the Stats tab: the period control, the streak and countries tiles, the section states                                                                                                                                                                                                                                          | The Country and Bucket list tabs, the headline, the map                                                                                                                                        |
| `src/routes/_app/-ui/atlas-screen.tsx` - passes the year rows and the section status down                                                                                                                                                                                                                                                                               | `src/routes/_app/atlas.tsx`: no route change; `pnpm generate-routes` is not run                                                                                                                |
| `src/lib/format.ts` - `formatYear` (+ a case in `src/lib/__tests__/format-locale.test.ts`)                                                                                                                                                                                                                                                                              | `src/server/db/schema.ts`, `drizzle/`: no schema change. `src/lib/plans.ts`, `src/server/billing/**`: no quota, no `MODULE_KEYS` entry                                                         |
| `src/lib/i18n/messages/<locale>/atlas.ts` - edit, **all 23 locales**                                                                                                                                                                                                                                                                                                    | `src/routes/api/dev/-seed/**`: the seed already writes 2026 and 2025 rows and a streak, which is what the browser spec reads                                                                   |
| Tests: `src/server/queue/__tests__/travel-stats-fanout.test.ts`, `src/routes/_app/-server/__tests__/` and `src/server/fns/__tests__/` (producer side-effect and isolation tests), a `loadAtlas` isolation test, `src/components/atlas/__tests__/stats-model.test.ts`, `atlas-panel.test.tsx`; `e2e/product-modules.spec.ts` - create or append (no baselines; ADR 0016) |                                                                                                                                                                                                |
| `CONTEXT.md` - **Travel statistics**, **Stat year** (neither is in the glossary)                                                                                                                                                                                                                                                                                        |                                                                                                                                                                                                |

### Phase boundaries (tickets)

Two tickets. Each is a full path (write -> queue -> stored row -> screen -> test). They are independent: the year view reads rows the
recompute already writes, and the producers fix rows whichever screen reads them. The first ships on its own and is useful on its
own, so it goes first; the second does not need to wait for it to be correct, only to be honest (a year's places figure is right
only once the producers have run), so it is `Blocked by` the first.

| Ticket | Delivers                                                                                                                                                                                                                      | Rows                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 08-S6a | `enqueueTripRollup`; the eight call sites and the planner-write guard on `createPlaceFn`; the year attribution for transport legs; unit tests for the producer and for every site, including the writes that must not enqueue | the "stays current" half                    |
| 08-S6b | `stats-model.ts`; the period control; the streak and countries tiles; the empty and failed states; `formatYear`; the 23 locales; the `CONTEXT.md` entries                                                                     | the "read by year" half; `ADD-06` -> `done` |

### The producer (08-S6a)

One function in `src/server/queue/travel-stats-fanout.ts`, the module that already owns "when a recompute is asked for"
(`docs/SPEC.md` §8, one concept one owner):

```ts
export async function enqueueTripRollup(
  scope: TenantScope,
  trip: Trip,
  otherDates?: ReadonlyArray<string | null | undefined>,
): Promise<void>
```

It is a sibling of `enqueueTripStatsFor` (the wrapper `people.ts` uses, which takes the recipients because a membership change
cannot read them), not an extra argument on it: this one reads the members and carries dates, and the two share
`enqueueTravelStats` underneath. It computes the stat years from `trip.startDate` plus every date in `otherDates` through
`affectedStatYears`, whose signature widens from `(startDate, previousStartDate?)` to `(startDate, ...otherDates)` so every
existing caller keeps compiling; the function still drops a year the payload schema refuses and always includes the all-time row.
It calls the existing `enqueueTravelStats`, which reads the trip's members once, builds the collapsing envelope ids and **never
throws** (a queue refusal is logged and the write stands). It adds no envelope builder.

Each caller already holds the trip: `requireEditablePlan` returns it in the three plan functions, `requireTrip` is called in the
three transport functions, and `confirmBookingImport` holds `trip`. `createPlaceFn` holds none, and `createPlace` only checks that
the caller can **read** the trip (`readableTrips`), never their role, so a viewer can add a place and the new recompute would run
for every member behind that hole. It therefore gains the same guard the planner's other place writes use
(`requireWritableTrip`, then `assertTripRole(['owner', 'editor'])` - `requireEditablePlan` in `plan.ts` is private to that module,
so the guard is shared by moving it to the repository next to `assertTripRole`, or by repeating the two calls, whichever the slicer
finds smaller) and passes the trip on. `updatePlanPlaceFn` compares the new city with the stored one, so `requirePlaceOfPlan`
returns the place it already reads. Transport writes read the leg's previous `departureDate` from the row `requireTransportOfTrip`
returns, **after** that call has proved the transport belongs to the trip in the caller's tenant and before the write. The helper
is called **after** the D1 write has succeeded.

| Function                                      | Enqueues when                                        | Years sent                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `createPlanPlaceFn`, `createPlaceFn`          | always, after the insert                             | all-time + the trip's start year                                                                                                             |
| `updatePlanPlaceFn`                           | only when the stored `city` differs from the new one | same. A place's name, rating, coordinates, visited flag never move a roll-up figure, so no recompute                                         |
| `deletePlanPlaceFn`                           | always, after the delete                             | same                                                                                                                                         |
| `confirmBookingImport`                        | once, at the end, and only if a place was created    | same. One envelope set for the whole import, never one per row                                                                               |
| `saveTransportFn`, `saveSearchedConnectionFn` | always, after the save                               | all-time + the trip's start year + the **departure year of the saved leg** + (on an edit) the previous departure year, read before the write |
| `deleteTransportFn`                           | always, after the delete                             | all-time + the trip's start year + the departure year of the deleted leg, read before the delete                                             |

Writes that must **not** enqueue, asserted by tests so the list does not erode: `reorderPlaces`, `setPlaceVisited`,
`setTransportStatusFn`, `reorderDayTransports`, day notes, the import's `pin` step.

A burst is cheap by construction: the envelope id carries the collapse window, so any number of place writes by one member inside
one 10 s window is one recompute per `(traveller, year)`, and a trip with N members costs N, not N times the writes. Booking import
enqueues once for the whole confirm.

### The year view (08-S6b)

**Data source: the rows already in the payload.** `loadAtlas` returns every `travel_stats` row of the traveller; one row per year
travelled plus the all-time row, so the count is bounded by the years a person has travelled. The payload is **unchanged**: no
field is added. There is no second request, so no loading state, no failed state and no waterfall for a year change: it is a local
state change over data in hand. The plan's lazy `loadTravelStatsFn` is not built.

**Periods.** `stats-model.ts` derives them: "All time" first, then every year whose row has `tripCount > 0`, newest first. A year
whose row exists with zero trips (a recompute after the last trip left the year, or a leg that departs in a year with no trip
starting in it) is not a period: it would be a screen of zeros. The control is shown only when at least one year exists; a
traveller with no dated trip sees the Stats tab exactly as today plus the streak tile. The period is local component state, default
"All time", and falls back to "All time" when the chosen year disappears after a re-read.

**What each period shows, and whose it is.**

| Tile                        | All time                                | A year                                                 | Whose / source                         |
| --------------------------- | --------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Places                      | stored `placeCount`                     | the year row's                                         | the traveller's member trips           |
| Regions                     | live `regionCount`                      | **absent** (the row stores `0`; a lifetime figure)     | the traveller's                        |
| Visits                      | live `visitCount`                       | **absent** (a lifetime tally)                          | the traveller's                        |
| Trips (+ distance caption)  | stored `tripCount`, `distanceMetres`    | the year row's; distance from legs departing that year | the traveller's member trips           |
| Cities                      | stored `cityCount`                      | the year row's                                         | the traveller's member trips           |
| Days away                   | stored `dayCount`                       | the year row's                                         | the traveller's member trips           |
| **Countries on your trips** | **absent** (the headline is the answer) | the year row's `countryCount`                          | the countries the year's trips went to |
| **Years in a row**          | stored `yearStreak` of the all-time row | **absent**                                             | the traveller's streak, newest run     |

A zero distance is "not recorded" and prints no distance (the Trips tile's existing rule); then the tile shows its caption. In a
year view the Trips tile prints that year's distance (legs that depart in the year) where it has one, and otherwise "Trips that start
in {year}". `year_streak` counts the run of consecutive years with a trip that **starts** in them, newest first, planned trips
included, which is what `yearStreakFrom` does. The run ends at the **newest year that has a trip**, not at the current year, so
the tile says which years it spans: with a streak of N and the newest year Y the caption reads "from Y-N+1 to Y" (N of one reads
"In Y"). A traveller whose run ended in 2015 reads that, not a streak that looks current; a planned future year with nothing in
between shows a run of one.

**Continents.** The all-time view keeps the live `atlas.byContinent` row exactly as it is. A year view **does not show it**: the
row is the traveller's all-time visited list by continent, and a year row's `by_continent` keeps only visited countries that year's
trips went to, which would disagree with the "Countries on your trips" tile beside it and lag a country mark by design (Resolved
assumption 9). Nothing is added to the payload and `continentCells` is untouched.

**Section states.**

- _Empty:_ a traveller with no visited country, no region and no trip gets, in place of the tile grid, an `EmptyState` on
  `--color-surface-2` titled "Nothing to count yet" with a line naming the first thing to do and two actions: a button that
  switches the panel to the Country tab and moves focus to that tab's trigger (the blank-map invitation already lives there), and
  a `Link` to `/trips`. It is not a grid of zeros. It is plain content and is not announced.
- _Re-reading:_ during the screen's `router.invalidate()` (the `loading` status the screen already computes) the **tile grid and its
  wrapper** carry `aria-busy="true"` and keep every figure at full opacity. The period control, the live region and the `Alert` stay
  outside the busy element, or their announcements are held back. No marker, no animation, and the control is **not** disabled
  (a focused control that becomes disabled drops focus to the page).
- _Failed:_ when the screen's status is `failed` (the re-read did not come back), a `danger` `Alert` inside the Stats tab says the
  figures shown may be out of date and offers a retry button (loading state while `router.invalidate()` runs) in the `Alert`'s
  actions; the old figures stay under it, and so does everything else the failed re-read left stale. The `Alert` stays mounted until
  the re-read settles; on success focus moves to the period control, or to the tab panel when there is none. The first load failing
  stays the route's `errorComponent`.
- _Skeleton:_ none. There is no request of the section's own.

**Motion and tokens.** None added. Figures change instantly on a period change; every figure keeps `font-variant-numeric:
tabular-nums` (the tile primitive already does) so nothing shifts.

### Alternatives considered, and why they lost

| Alternative                                                            | Why not                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The plan as written (lazy `loadTravelStatsFn`, stale marker, count-up) | Ships a marker for a lag a traveller cannot see, adds a second request for rows in the payload, and leaves the real defect (no producer on place and leg writes) in place |
| Only the producers now; the year view later                            | "This year" and the streak, part of the reference figure set, stay missing from a stage that claims to finish the row                                                     |
| Producers send the all-time row only (no trip read, no year)           | Year rows would go stale until the next trip edit, which is the defect again one level down                                                                               |
| A nightly cron that rebuilds rows older than a day                     | Adds a scan over every traveller's trips to hide missing triggers, and still shows yesterday's places for a day                                                           |
| Recompute inline on the write                                          | Six aggregate queries on a request path, which D1's rows-read billing punishes; the queue is why the handler exists                                                       |
| A workspace-wide figure set labelled "the workspace's" (the plan)      | The recompute is member-scoped (ADR 0007); a label that says otherwise would be wrong for every workspace where someone is not on every trip                              |

## 📝 Architecture

- **Owner module of each new concept (`docs/SPEC.md` §8):** when a trip's contents ask for a recompute ->
  `src/server/queue/travel-stats-fanout.ts` (`enqueueTripRollup`); which periods exist, which tiles a period shows and whose each
  figure is -> `src/components/atlas/stats-model.ts` (pure, no I/O, no React), so a future figure cannot be added without choosing a
  side; rendering -> `src/components/atlas/atlas-panel.tsx`; the year row shape on the wire -> `AtlasPayload` in `library.ts`; year
  digits -> `src/lib/format.ts`.
- **The route-tree constraint holds.** `travel-stats-fanout.ts` reaches the queue binding through `#/server/auth/env`
  (`cloudflare:workers`), so the helper lives under `src/server/queue` and is **never defined or exported from a route module**.
  Call sites in `src/routes/**` import it as `people.ts` and `trip-lifecycle.ts` already do; `src/server/fns/**` sites are outside the
  route tree, as `atlas.ts` shows.
- **No second fan-out.** The helper wraps `enqueueTravelStats`; the envelope id, the recipient set and the never-throws posture stay
  where they are. The private fan-out in the trip-copy handler is left alone and named in Risks.
- `components/ui` is untouched and still never fetches or imports from `server/`; the panel receives rows and callbacks as props.
- Tests: queue and server-function tests run in the Node `server` project, which cannot load a module that reaches
  `cloudflare:workers`. The helper's module is already covered there by `travel-stats-fanout.test.ts`; the call-site tests mock the
  fan-out module and assert the arguments, in the pattern of `src/routes/_app/-server/__tests__/trip-lifecycle-side-effects.test.ts`.

## 📝 Data Model

**No schema change, and none is filed.** `travel_stats` carries `stat_year` (`0` for the all-time roll-up), `trip_count`,
`place_count`, `city_count`, `country_count`, `region_count`, `day_count`, `distance_metres`, `spend_minor`, `currency`,
`by_continent` as JSON, `year_streak`, `last_trip_id` and `computed_at`, behind the unique `(organization_id, user_id, stat_year)`
index. `spend_minor` and `currency` are stored and are not in the payload; expense writes also move `spend_minor` and are out of
this stage (Risks).

Index honesty: the read the screen already makes (`listTravelStats`) is `tenantFilter()`-bound and led by `organization_id` through
the unique index; this stage adds no read. The safety argument for the producers is the tenant filter inside the repository calls
the recompute makes and the organization on the envelope, taken from the caller's scope, never an index.

## 📝 API Contracts

No server function is added, changed or removed. The contracts that change:

```ts
// src/server/queue/travel-stats-fanout.ts
export function affectedStatYears(
  startDate: string | null | undefined,
  ...otherDates: Array<string | null | undefined>
): Array<number> // was (startDate, previousStartDate?): existing callers compile unchanged

export async function enqueueTripRollup(
  scope: TenantScope,
  trip: Trip,
  otherDates?: ReadonlyArray<string | null | undefined>,
): Promise<void> // never throws

// src/components/atlas/stats-model.ts (pure)
type StatsPeriod = { kind: 'all' } | { kind: 'year'; year: number }
type StatTileId =
  | 'places'
  | 'regions'
  | 'visits'
  | 'trips'
  | 'cities'
  | 'days'
  | 'countries'
  | 'streak'
function statsPeriods(rows: ReadonlyArray<StatsRow>): ReadonlyArray<StatsPeriod>
function statsView(
  rows: ReadonlyArray<StatsRow>,
  period: StatsPeriod,
  live: LiveFigures,
): StatsView
```

`AtlasPayload` (`src/routes/_app/-server/library.ts`) is unchanged: `stats` already carries `statYear`, `tripCount`, `placeCount`,
`cityCount`, `countryCount`, `dayCount`, `distanceMetres` and `yearStreak` for every row of the caller (`listTravelStats(scope,
scope.ctx.userId)`), which is all the model reads.

## 📝 UI/UX

Route `/atlas`, Stats tab, unchanged otherwise. No new primitive, no second stat card.

- **Period control.** `SimpleSelect` (`src/components/ui/select.tsx`) with a **visible** label "Period" tied to its trigger
  (`triggerId`), above the tile grid; options "All time" and one per year (digits from `formatYear`, no grouping separator, in the
  locale's numerals). Keyboard: the primitive's own (Enter/Space opens, arrows move, Escape closes). Hover, focus-visible and active
  states come from the primitive. It is never disabled by a re-read.
- **Announcements.** One visually hidden `role="status"` element, always mounted in the Stats tab and empty on mount. It is written
  only when the reader changes the period and when the period falls back to "All time" because the chosen year is gone ("Showing
  figures for all time." / "Showing figures for {year}."), never on mount and never by a re-read that changes nothing.
- **Tiles.** The existing `StatCard` grid (`grid-cols-2`, `sm:grid-cols-3`, `xl:grid-cols-6`), wrapped in a `role="group"` named by
  the period ("Figures for all time" / "Figures for {year}") so a reader who arrives after the announcement still knows which year
  the figures are for. The all-time view gains the streak tile as a full-width last row (`col-span-full`), so seven tiles never
  leave an orphan; a year view has five tiles (places, trips, cities, days, countries) and the last one spans both columns below
  `sm`, so no tile sits alone in the last row of the two-column grid at 360px. Every tile's label says whose figure it is ("Your
  places", "Countries on your trips", "Years in a row"); `data-stat` names the figure (`countries`, `streak`) as the others do.
- **Continents.** The existing `dl` row, all-time view only (see "Continents" above). In a year view the section is absent.
- **Empty and failed states.** As above, inside the Stats tab only. The `Alert` is `tone="danger"` (`role="alert"`) with a `title`
  and an `actions` retry button; the empty state is plain content.
- **Responsive.** At 360px the grid is two columns inside the panel sheet and the control is full width; at 2560px the shelf's
  existing measure holds and nothing stretches.

## 📝 Visual change expected

`/atlas`, Stats tab, light and dark, 360x800, 1280x900 and 2560x1440:

- 08-S6a: nothing visible changes by itself; the figures are right more often.
- 08-S6b: the all-time view with the period control and the streak tile; a year view (five tiles, no continent row); the control
  open; the empty state; the failed state with the old figures under the alert; the tab in a non-English locale and in Arabic
  (right-to-left) with a year in the locale's digits.
- The Country and Bucket list tabs, the headline and the map do not change by a pixel.

## 📝 Copy

Every new string, as an `en` key in `src/lib/i18n/messages/en/atlas.ts` and the same key in all 23 locales (`i18n-messages` skill):

| Key                             | `en` text                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `panel.stat.scope.label`        | Period                                                                        |
| `panel.stat.scope.all`          | All time                                                                      |
| `panel.stat.scope.groupAll`     | Figures for all time                                                          |
| `panel.stat.scope.groupYear`    | Figures for {year}                                                            |
| `panel.stat.scope.announceAll`  | Showing figures for all time.                                                 |
| `panel.stat.scope.announceYear` | Showing figures for {year}.                                                   |
| `panel.stat.tripsCaptionYear`   | Trips that start in {year}                                                    |
| `panel.stat.daysCaptionYear`    | Across your trips that start in {year}                                        |
| `panel.stat.countries`          | Countries on your trips                                                       |
| `panel.stat.countriesCaption`   | Countries those trips cover                                                   |
| `panel.stat.streak`             | Years in a row                                                                |
| `panel.stat.streakCaptionRange` | From {first} to {last}                                                        |
| `panel.stat.streakCaptionOne`   | In {last}                                                                     |
| `panel.stat.streakNone`         | Plan a trip to start a run                                                    |
| `panel.stats.empty.title`       | Nothing to count yet                                                          |
| `panel.stats.empty.body`        | Mark a country you have been to, or plan a trip, and your figures start here. |
| `panel.stats.empty.markCountry` | Mark a country                                                                |
| `panel.stats.empty.planTrip`    | Plan a trip                                                                   |
| `panel.stats.error.title`       | These figures may be out of date                                              |
| `panel.stats.error.body`        | The last refresh did not come back.                                           |
| `panel.stats.error.retry`       | Try again                                                                     |

`{year}`, `{first}` and `{last}` are rendered through `formatYear`, never `formatNumber`, which would print "2,026". A sentence never embeds a translated phrase as a placeholder (the all-time and year announcements are separate keys). No plural key varies on two numbers. If the catalogue already has a "Try again" button key in `atlas.ts` (`list.error.retry`, `card.error.retry`) the slicer reuses the pattern but adds its own key, as each surface does today.
`src/components/atlas/__tests__/copy-rules.test.ts` stays green: no key is dead, no literal reaches a screen.

## 📝 Edge Cases & Failure Scenarios

- **The queue refuses the message.** The write stands; the helper logs once and returns (`requestTravelStatsRecompute`). The figures
  catch up on the next producer.
- **A trip with no start date.** Only the all-time row is recomputed; a leg that departs in a dated year still sends that year, and
  the resulting year row has `tripCount` 0, so it is not a period.
- **A leg's departure date moves from December to January.** Both years are sent: the one read before the write and the new one.
- **A year row left with zero trips** (the last trip of the year was deleted or moved): not offered; if it was the selected period the
  control falls back to "All time".
- **Five members, one place added.** Five envelopes per year inside one window, one recompute each; a second place inside the same
  window adds none.
- **Booking import with ten stays.** One enqueue at the end; if every stay failed to create a place, none.
- **A traveller with trips but no visited country.** The empty state is not shown (a trip is something to count); the countries
  tile in a year view shows the year's `countryCount`.
- **A streak that ended long ago.** Newest year with a trip 2015, streak 3: the tile reads "From 2013 to 2015", not a number that
  looks current.
- **A planned future year with nothing in between.** Trips in 2027 and 2024: the streak is 1 and the tile reads "In 2027".
- **The chosen year disappears** after a re-read: the control falls back to "All time" and the live region says so.
- **The re-read fails after a country mark.** The `Alert` says the figures may be out of date; the live headline, the map and the
  other tabs are as the optimistic update left them, not asserted to be current.
- **Streak of 0.** The tile prints 0 with the "Plan a trip to start a run" caption, not a blank.
- **The period control with one year only.** Shown (two options), because "this year" is the figure the reference set names.
  six zeros, nothing throws.
- **The re-read fails while a year is selected.** The Alert shows; the selected year's figures stay under it.
- **Arabic.** The control, tiles and heading mirror through logical properties; the year is in the locale's numerals; a figure and
  its unit stay one run (`data-numeric`), as the Trips caption does today.

## ✅ Acceptance criteria

08-S6a:

1. `enqueueTripRollup(scope, trip, otherDates?)` exists in `src/server/queue/travel-stats-fanout.ts`, wraps `enqueueTravelStats`,
   builds no envelope itself, never throws, and is not defined in a route module; `affectedStatYears(startDate, ...otherDates)`
   keeps every existing caller compiling and tested.
2. `createPlanPlaceFn`, `createPlaceFn`, `deletePlanPlaceFn` call it after the write with the trip's start year; `updatePlanPlaceFn`
   calls it only when the city changed (`requirePlaceOfPlan` returns the place it reads); `confirmBookingImport` calls it once,
   only when a place was created.
3. `saveTransportFn`, `saveSearchedConnectionFn` and `deleteTransportFn` also send the transport's departure year, and on an edit
   the previous departure year, read from the row `requireTransportOfTrip` returns before the write. A test moves a transport's
   departure date across a year boundary and asserts both years are sent.
4. `reorderPlaces`, `setPlaceVisited`, `setTransportStatusFn`, `reorderDayTransports`, day notes and the import `pin` step enqueue
   nothing (asserted).
5. A queue binding that throws does not fail any of these writes (asserted for one site of each module).
6. `createPlaceFn` refuses a caller who cannot write the trip (a viewer; a non-member of a workspace-visible trip; an archived trip)
   before the insert, and enqueues nothing in that case.
7. For one site per module, a trip id from another workspace and a private trip the caller is not on both fail as `NotFoundError`
   with zero envelopes, and every envelope that is enqueued carries the caller's `orgId`.

08-S6b:

8. `statsPeriods` returns "All time" first, then each year with `tripCount > 0`, newest first, and no year with zero trips.
9. In a year view `regions`, `visits`, `streak` and the continent row are absent and `countries` is present; in the all-time view
   `countries` is absent and `streak` is present; distance never prints as `0`; the streak is read from the all-time row only.
10. The streak caption names the years it spans ("From 2013 to 2015", "In 2027") and `loadAtlas` has a test that another member's
    `travel_stats` rows in the same workspace never appear in its `stats`.
11. The Stats tab shows the period control only when a year exists; it carries a visible label and an accessible name, is never
    disabled; changing it changes the tiles and the group name and writes the live region once; the fall-back to "All time" writes
    it too; nothing is written on mount.
12. `aria-busy` is on the tile grid wrapper only, never on the tab panel, the control, the live region or the `Alert`.
13. A traveller with no country, no region and no trip sees the empty state with both actions, not zeros; "Mark a country" moves
    focus to the Country tab trigger.
14. With the screen's status `failed` the Stats tab shows the `Alert` with a loading retry that runs `router.invalidate()`, keeps the
    old figures, leaves the other tabs and the map mounted, and moves focus to the period control (or the panel) when the re-read
    succeeds.
15. In a year view at 360px no tile sits alone in the last row of the grid.
16. All new keys exist in the 23 locales (parity test) and `copy-rules.test.ts` is green.
17. No new `fatal` console entry on `/atlas`, and no horizontal overflow from 360px to 2560px in either theme.

## 📝 Risks & Impact Review

| Risk                                                                              | Severity | Mitigation                                                                                                                                            |
| --------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| More queue traffic and recompute work (six aggregate queries per member and year) | Medium   | The collapse window folds a burst to one recompute per `(traveller, year)`; a place edit that moves nothing does not enqueue; an import enqueues once |
| A call site is forgotten, or added later without the producer                     | Medium   | The "must not enqueue" and "must enqueue" lists are asserted per function; the helper is the single named seam                                        |
| A transport's year row is missed when the departure date moves                    | Medium   | The previous date is read before the write and sent with the new one; a test moves a transport across a year boundary                                 |
| `createPlaceFn` accepted a viewer's write, and the producer would amplify it      | Medium   | The planner-write guard (writable trip and owner or editor role) goes in before the insert; tested for a viewer and a non-member                      |
| Copy in 22 non-English locales for 21 keys                                        | Low      | The parity test blocks a missing key; the `i18n-messages` procedure                                                                                   |

### Out of scope

- Expense and reservation writes also move the stored `spend_minor`. It is stored and not printed, so no producer is added; the
  stage that prints spend adds them.
- The trip-copy handler keeps a private copy of the fan-out (`src/server/queue/handlers/trip-copy.ts`, `enqueueTravelStats`). It
  runs inside the consumer with its own task context. Folding it into the shared module is a follow-up the slicer may file; nothing
  here makes it worse.
- A per-year continent breakdown (it needs a recompute on every country mark for every year the country appears in, and a label
  that says "visited countries on that year's trips"), a deep link to a period (`?year=`), a sparkline of trips per year, a
  travel-stats export, a colleague's statistics.
- Gating the panel by entitlement: the module-enforcement stage owns it, through `assertModule`, not a second check here.
- Backfilling rows for places added before this ships: the next producer, or the next trip edit, rebuilds them; no migration.

### Blockers

None. The recompute stage this one depended on is merged; no decision waits on a person.

### Merging beside the neighbouring atlas work

The plan gives `src/routes/_app/-server/library.ts` to another stage of the same wave. This spec does not edit that file at all
(the payload is unchanged), so whichever lands first, the other does not conflict with it. `atlas-panel.tsx` and `atlas-screen.tsx`
are edited in the Stats tab and the props that feed it only.

### Reference-row disposition

`ADD-06` is `partial` today. It becomes `done` when both tickets have merged.

## 📋 Phasing

Two tickets, in order. Neither is a horizontal layer: the first ships a producer, its call sites, a guard and their tests; the
second ships the model, the screen, the copy and the browser spec.

## 📋 Implementation Plan

### Phase 1 - the roll-up follows the trip's contents (08-S6a)

1. `affectedStatYears` widened to `(startDate, ...otherDates)`; `enqueueTripRollup` in `travel-stats-fanout.ts` and its test (years
   from the start date and from extra dates, the guard on an unusable year, never throws, no envelope when the trip has no members).
2. `plan.ts` (three functions; `requirePlaceOfPlan` returns the place so the city can be compared), `trip.ts` (`createPlaceFn` gains
   the planner-write guard), `booking-import.ts`.
3. `transports.ts`: read the previous departure date from `requireTransportOfTrip`'s row before an edit and before a delete, send
   both years.
4. Side-effect and isolation tests per module: enqueue arguments, the not-enqueue list, the queue-refusal case, the viewer and
   foreign-trip cases.

### Phase 2 - read the roll-up by year (08-S6b)

1. `stats-model.ts` and its test (periods, tiles per period, whose figure, zero-distance rule, streak range, fall-back).
2. `formatYear` in `src/lib/format.ts` and a case in `src/lib/__tests__/format-locale.test.ts`.
3. `atlas-panel.tsx`: the control, the live region, the group name, the streak and countries tiles, the empty and failed states;
   `atlas-screen.tsx` passes the year rows and the section status; component tests including the focus assertions.
4. A `loadAtlas` test that another member's rows never appear.
5. The 21 keys in the 23 locales; `CONTEXT.md` entries.
6. `e2e/product-modules.spec.ts`: select a year on the seeded workspace, assert the tiles change and the regions tile and continent
   row are gone; the empty and failed states are covered at component level.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit:
  - `src/server/queue/__tests__/travel-stats-fanout.test.ts` - `enqueueTripRollup` years, extra dates, never throws;
    `affectedStatYears` with zero, one and two further dates.
  - Producer side-effect and isolation tests next to each module (`plan`, `trip`, `transports`, `booking-import`): arguments per
    function, the not-enqueue list, a transport moved across a year boundary sends both years, a refusing queue does not fail the
    write, a viewer and a foreign or private trip are refused with zero envelopes and the caller's `orgId`.
  - `src/components/atlas/__tests__/stats-model.test.ts` - periods exclude zero-trip years and sort newest first; per-period tiles
    and whose figure each is; distance 0 prints nothing; streak only on all time, read from the all-time row, with its range; the
    fall-back when the year is gone.
  - `src/components/atlas/__tests__/atlas-panel.test.tsx` - the control appears only with a year, has a visible label, is never
    disabled; changing it changes tiles and group name and writes the live region once; nothing on mount; `aria-busy` placement;
    the empty state with both actions and the focus move; the failed state keeps the old figures and the other tabs, and focus
    after a successful retry.
  - `src/lib/__tests__/format-locale.test.ts` - `formatYear` prints no grouping separator in `en`, `de` and `ar`.
  - A `loadAtlas` test: another member's `travel_stats` rows never reach `stats`.
- Browser: `e2e/product-modules.spec.ts` on the seeded workspace (2026 and 2025 rows, a streak of 7): the period control, a year
  view, the console silent. No baselines (ADR 0016). Evidence for review is the blind A/B pair from `scripts/visual/capture.mjs`
  with `--state stats` at 360x800, 1280x900 and 2560x1440, light and dark.
- Layout shift after settle is asserted at 0 on `chromium`: the control and tiles have fixed heights and nothing animates.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                  | Applied default                                                                                                                                                             | Why                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What is the complete slice at HEAD, given the plan's premises moved?      | Re-based slice, two tickets: producers on place and transport writes, then the year view over rows already shipped                                                          | Decided by product owner sub-agent (confidence high): the real lag is missing producers, not country marks; "this year" and the streak are part of the reference figure set                   |
| 2   | Lazy `loadTravelStatsFn` or the rows already in the payload?              | The rows already in `loadAtlas`; no new server function and no payload change                                                                                               | Decided by software architect sub-agent (confidence high): the rows ship already and `router.invalidate()` refreshes them; a lazy call adds loading and error states for data in hand         |
| 3   | The stale marker                                                          | None; rely on `router.invalidate()` and the collapse window                                                                                                                 | Decided by product owner sub-agent (confidence medium): its predicate no longer matches any stored figure the panel reads; it is the easiest to add back                                      |
| 4   | The 220 ms count-up                                                       | Not built; figures change instantly                                                                                                                                         | Decided by product owner sub-agent (confidence medium): its only job was showing a stale figure catching up, and it adds layout-shift assertions                                              |
| 5   | How do place and transport writes ask for a recompute?                    | `enqueueTripRollup(scope, trip, otherDates?)` in `travel-stats-fanout.ts`, taking the trip the caller already holds                                                         | Decided by software architect sub-agent (confidence high): one owner for "when"; no extra trip read; transports add their departure years                                                     |
| 6   | Which year does a transport write move?                                   | The transport's departure year (and the previous one on an edit), plus the trip's start year                                                                                | Verified against `recomputeTravelStats` (`transportYearFilter`); both specialists flagged the plan's "start year only" as wrong for transports                                                |
| 7   | Whose figures are they, and how are they labelled?                        | The traveller's, as the catalogue already says; no "workspace" label                                                                                                        | Verified, not asked: `memberTripIds` (ADR 0007), `panel.stat.*` comments in `en/atlas.ts`, `yearStreakFrom`                                                                                   |
| 8   | Is distance omitted?                                                      | No: printed on the Trips tile when recorded; 0 prints nothing                                                                                                               | Verified, not asked: the leg form records a distance and the tile already prints it                                                                                                           |
| 9   | Does a year view print a continent breakdown?                             | No: the row is absent in a year view; the all-time row is unchanged                                                                                                         | Panel round 1, product owner (conditions applied): a year row's `by_continent` lags a country mark and disagrees with "Countries on your trips"; adding it back needs recompute on every mark |
| 10  | Which other figures does a year view hide?                                | Regions, visits and the streak; it adds "Countries on your trips"                                                                                                           | Decided by software architect sub-agent (confidence high): year rows store `region_count` 0; visits and regions are lifetime figures                                                          |
| 11  | Does a place update enqueue?                                              | Only when the city changed                                                                                                                                                  | Default applied: the city count is the only figure a place edit moves; a visited toggle or rename would otherwise cost a recompute per window                                                 |
| 12  | Are years with zero trips periods?                                        | No                                                                                                                                                                          | Default applied: a row can exist with zero trips after a delete or a transport departing in a year no trip starts in; a period of zeros is noise                                              |
| 13  | Is the period in the URL?                                                 | No, local state, default "All time"                                                                                                                                         | Default applied: reversible, no route or search-contract change; a deep link is listed out of scope                                                                                           |
| 14  | The empty state                                                           | A designed `EmptyState`: a button to the Country tab (focus follows) and a link to `/trips`, only when no country, region or trip exists                                    | Default applied from the plan's empty-state requirement; accessibility conditions of panel round 1 applied                                                                                    |
| 15  | The failed state                                                          | A `danger` `Alert` fed by the screen's existing `failed` status; "may be out of date"; retry with a loading state; focus returns                                            | Decided by product owner sub-agent (confidence high); wording and focus per panel round 1, UX and accessibility specialists (conditions applied)                                              |
| 16  | The plan's `e2e/product-modules.visual.spec.ts` and four baselines        | Not built; `e2e/product-modules.spec.ts` journey, no baselines                                                                                                              | ADR 0016                                                                                                                                                                                      |
| 17  | The trip-copy handler's private fan-out and expense writes' `spend_minor` | Left alone and named in Risks                                                                                                                                               | Default applied: neither is needed for the figures this stage prints                                                                                                                          |
| 18  | Where does the glossary change land?                                      | `CONTEXT.md` gains **Travel statistics** and **Stat year**                                                                                                                  | Default applied: neither term is in the glossary and both are used across the atlas                                                                                                           |
| 19  | May `createPlaceFn` keep its viewer-readable write?                       | No: it gains the planner-write guard before the insert                                                                                                                      | Panel round 1, security and tenancy reviewer (condition applied): `createPlace` checks only that the caller can read the trip; the new recompute would amplify the hole                       |
| 20  | Does the streak tile say which years it spans?                            | Yes: "From {first} to {last}" / "In {last}"                                                                                                                                 | Panel round 1, UX specialist (condition applied): the run ends at the newest year with a trip, not at the current year                                                                        |
| 21  | Is the period control disabled while the screen re-reads?                 | No; `aria-busy` on the tile grid wrapper only                                                                                                                               | Panel round 1, accessibility and UX specialists (conditions applied): a focused control that becomes disabled drops focus                                                                     |
| 22  | Panel verdicts, round 1 (`afk-decide`)                                    | Product owner, software architect, security and tenancy, accessibility and UX specialists each **approve with conditions**; every condition applied in the following commit | Round 2 verdicts are recorded in the row below                                                                                                                                                |
