# Atlas statistics: keep the roll-up current, and read it by year

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | implemented                                    |
| **Issue**          | #1118                                     |
| **Spec PR**        | #1109                                    |
| **Implementation** | #1443, #1453, #1462                                     |
| **Plan**           | 08-S6 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S6` is the statistics half of the atlas module (reference row `ADD-06`). The stage was written when nothing in
production recomputed `travel_stats`. That is no longer true, and the stage's premises have moved with the code, so this spec
describes what is **left** at HEAD (`4ed3a555`), as **two tickets that are each a full path from write to screen**:

1. **08-S6a - the roll-up follows the trip's contents.** The Stats tab prints places, cities, days and distance from the stored
   roll-up, and the roll-up is rebuilt only when a trip is created, edited, copied, deleted or its people change, or a country is
   marked. Adding, editing or deleting a place, saving or deleting a transport, or confirming a booking import rebuilds
   nothing, so a traveller who plans a trip and then fills it sees "Your places: 0" until something unrelated happens to enqueue a
   recompute. One helper in the existing fan-out module is called from the six server functions and the one import routine that move
   those figures.
2. **08-S6b - read the roll-up by year.** The year rows are already in the `/atlas` payload and #1120 reads them by period. The Stats tab
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
  (`src/routes/_app/trips/$tripId/-server/plan.ts`), the places a confirmed
  booking import creates (`src/server/fns/booking-import.ts`, `confirmBookingImport`), and `saveTransportFn`, `deleteTransportFn`,
  `saveSearchedConnectionFn` (`src/server/fns/transports.ts`). Days follow the trip's dates, and those writes enqueue already.
- **Years are attributed differently per figure.** Trips, days, places and cities of a year row are the trips whose `start_date`
  falls in it. Distance is the transports whose own `departure_date` falls in it (`recomputeTravelStats`, `transportYearFilter`), so a trip that starts on 30 December has transports in two years. A producer that sends only the trip's start year leaves the right row
  stale for any transport that departs in another year, and an edit that moves a transport's departure date moves two rows.
- **Year rows ship without a separate read.** `loadAtlas` (`src/routes/_app/-server/library.ts`) returns `stats` with one entry per
  `travel_stats` row (`statYear`, `tripCount`, `placeCount`, `cityCount`, `countryCount`, `dayCount`, `distanceMetres`,
  `yearStreak`). Issue #1120 adds the period control and year view in `AtlasPanel`, with a traveller-owned all-time streak.
  The payload and read remain unchanged; every field the year view needs is in those rows already.
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
  the country card's retry. The Stats tile group now reflects loading; the section's failed state remains the next ticket's scope.
- **The plan's verification paths are history.** `e2e/product-modules.visual.spec.ts`, `e2e/__screenshots__/` and the four
  `atlas-*` baselines do not exist (ADR 0016: journeys replace the visual gate).

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Not owned (read only, or left alone)                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/queue/travel-stats-fanout.ts` - `enqueueTripRollup`; `affectedStatYears` takes any number of further dates (08-S6a)                                                                                                                                                                                                                                                                                                                                                             | `src/server/repos/atlas.ts` (`recomputeTravelStats`, `listTravelStats`): **not touched**; the recompute is correct, only its triggers are missing. `src/server/queue/handlers/travel-stats.ts` changes in one place (a former member's message is acknowledged, not dead-lettered) |
| The call sites: `plan.ts` (three functions; `requirePlaceOfPlan` returns the place), `transports.ts` (three functions), `booking-import.ts` (`confirmBookingImport`)                                                                                                                                                                                                                                                      | `src/server/queue/handlers/trip-copy.ts`: its private fan-out stays (Risks)                                                                                                                                                                                                        |
| `src/routes/_app/-server/library.ts`: **not touched**; the year rows already ship                                                                                                                                                                                                                                                                                                                                                                                                           | The `loadAtlas` payload, the seven reads, the 40-row bucket-list cap, the live figures                                                                                                                                                                                             |
| `src/lib/atlas/stats-period.ts` (+ test) - new, pure: which periods exist, which tiles a period shows, whose figure each is                                                                                                                                                                                                                                                                                                                                                           | `src/components/ui/*`: untouched; `StatCard`, `Select`, `Alert`, `EmptyState`, `Skeleton` reused as they are                                                                                                                                                                       |
| `src/components/atlas/atlas-panel.tsx` - the Stats tab: the period control, the streak and countries tiles, the section states                                                                                                                                                                                                                                                                                                                                                              | The Country and Bucket list tabs, the headline, the map                                                                                                                                                                                                                            |
| `src/routes/_app/-ui/atlas-screen.tsx` - passes the year rows and the section status down                                                                                                                                                                                                                                                                                                                                                                                                   | `src/routes/_app/atlas.tsx`: no route change; `pnpm generate-routes` is not run                                                                                                                                                                                                    |
| `src/lib/format.ts` - `formatYear` (+ a case in `src/lib/__tests__/format-locale.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                  | `src/server/db/schema.ts`, `drizzle/`: no schema change. `src/lib/plans.ts`, `src/server/billing/**`: no quota, no `MODULE_KEYS` entry                                                                                                                                             |
| `src/lib/i18n/messages/<locale>/atlas.ts` - edit, **all 23 locales**                                                                                                                                                                                                                                                                                                                                                                                                                        | `src/routes/api/dev/-seed/**`: the seed already writes 2026 and 2025 rows and a streak, which is what the browser spec reads                                                                                                                                                       |
| Tests: `src/server/queue/__tests__/travel-stats-fanout.test.ts`, `src/routes/_app/trips/$tripId/-server/__tests__/`, `src/routes/_app/-server/__tests__/` and `src/server/fns/__tests__/` (producer side-effect and isolation tests), a repository isolation test for `listTravelStats`, the outcome test per ticket, `src/lib/atlas/__tests__/stats-period.test.ts`, `atlas-panel.test.tsx`; the atlas journey in `e2e/journeys.spec.ts` - create or append (no baselines; ADR 0016) |                                                                                                                                                                                                                                                                                    |
| `CONTEXT.md` - **Travel statistics**, **Stat year** (neither is in the glossary)                                                                                                                                                                                                                                                                                                                                                                                                            |                                                                                                                                                                                                                                                                                    |

### Phase boundaries (tickets)

Two tickets. Each is a full path (write -> queue -> stored row -> screen -> test). They are independent: the year view reads rows the
recompute already writes, and the producers fix rows whichever screen reads them. The first ships on its own and is useful on its
own, so it goes first; the second does not need to wait for it to be correct, only to be honest (a year's places figure is right
only once the producers have run), so it is `Blocked by` the first.

| Ticket | Delivers                                                                                                                                                                                                                  | Rows                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 08-S6a | `enqueueTripRollup`; the seven call sites; the year attribution for transports; unit tests for the producer and for every site, including the writes that must not enqueue | the "stays current" half                    |
| 08-S6b | `stats-period.ts`; the period control; the streak and countries tiles; the empty and failed states; `formatYear`; the 23 locales; the `CONTEXT.md` entries                                                                 | the "read by year" half; `ADD-06` -> `done` |

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
three transport functions, and `confirmBookingImport` holds `trip`. Its "a place was created" flag is set **right after `createPlace` resolves**, inside the place resolver, and is not inferred from the resolver's return value: the resolver returns an existing place's id for a name match (nothing created, nothing enqueued) and returns `null` from its `catch` after a later failure in the same row (a place exists, so it enqueues once). Because `persist` and `stamp` can throw after places were created, the enqueue runs in a `finally` guarded by the flag, not as a last statement. `confirmBookingImport` is port-injected and its test mock deliberately throws in `taskQueue`; the ticket either names the mock change or injects the enqueue as a port. `updatePlanPlaceFn` compares the new city with the stored one,
so `requirePlaceOfPlan` returns the place it already reads. The helper is called **after** the D1 write has succeeded.

**The planner owns place creation.** Issue #936 removes the unused inventory-only endpoint and its
unmounted dialog. `createPlanPlaceFn` remains the only interactive add-place path and retains
`requireEditablePlan` (archive before role). Issue #928 already enforces `PLACE_WRITE_ROLES`
(`owner`, `editor`) inside all six repository writers. This stage adds recomputation to the
remaining seven call sites; it must not restore the removed endpoint.

**The previous departure date of a transport.** The recompute attributes distance to the year of a transport's own
`departure_date`, which is a column of the `transports` row (a leg is one part of a transport and carries no date the recompute
reads). `saveTransportFn` and `saveSearchedConnectionFn` call only `requireTrip` today, and a tab on the previous bundle sends no
`intent` (treated as `create`, which `saveTransport` accepts as an overwrite of an existing id of the same trip). So the previous
date is read **by id, whatever the intent**: the row is read through the tenant-scoped transports repository (`getTransport`)
**before** the write, and used only when it exists and its `tripId` equals the trip the caller was just proved able to write. A
missing row, or a row of another trip, means a create and contributes no previous year. `deleteTransportFn` already calls
`requireTransportOfTrip`, whose row carries the date.

| Function                                      | Enqueues when                                                                                                            | Years sent                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createPlanPlaceFn`          | always, after the insert                                                                                                 | all-time + the trip's start year                                                                                                                      |
| `updatePlanPlaceFn`                           | only when the stored `city` differs from the new one                                                                     | same. A place's name, rating, coordinates, visited flag never move a roll-up figure, so no recompute                                                  |
| `deletePlanPlaceFn`                           | always, after the delete                                                                                                 | same                                                                                                                                                  |
| `confirmBookingImport`                        | once, at the end, and only if a place was created (flag set right after `createPlace` resolves; enqueued in a `finally`) | same. One envelope set for the whole import, never one per row                                                                                        |
| `saveTransportFn`, `saveSearchedConnectionFn` | always, after the save                                                                                                   | all-time + the trip's start year + the **departure year of the saved transport** + the previous departure year of the row read by id before the write |
| `deleteTransportFn`                           | always, after the delete                                                                                                 | all-time + the trip's start year + the departure year of the deleted transport, read before the delete                                                |

Writes that must **not** enqueue, asserted by tests so the list does not erode: `rankIdeasFn`, `reorderPlanFn`, `schedulePlaceFn`, `unschedulePlaceFn`, `updateStopFn`, `setTransportStatusFn`, `reorderDayTransportsFn`, day notes and the import's `pin` step. (A place's visited flag goes through `updatePlanPlaceFn`, which the city-change rule already covers.)

**A traveller who left the workspace.** `trip_members` rows outlive a departure (CONTEXT.md, stranded trips) and
`enqueueTravelStats` addresses every member of the trip. Before #1119, the handler answered a message for a former workspace member with
`TaskPermanentError`, which dead-lettered it. Without the acknowledgement change, each place or transport write would dead-letter
one envelope per year for every departed member (a KV record, an R2 object and an error log each). The handler changes in one
place: `scopeForTraveller` returns `null` for "no longer a member" and the handler returns metrics such as `{ statYear, skipped: 'not a member' }` after one `warn` log, which the consumer acknowledges and marks done, instead of throwing. The file-header and `scopeForTraveller` doc comments, which say "permanent failure", are updated with it. The membership probe stays, so a message for a non-member still recomputes nothing; only the failure class
changes. The handler tests (`travel-stats.test.ts`) assert acknowledgement with no write for both
a non-member and a departed workspace member who remains on a trip.

**Cost.** Only the recompute collapses. Each write sends members x years envelopes (at most four per member: the all-time row, the start year, a departure year and a previous one), each a queue operation plus a KV read at the consumer, and no module gate exists yet, so every
workspace pays it whether or not it uses the atlas. Accepted: the envelopes are tiny and the count is bounded by the trip's
members; the entitlement gate belongs to the module-enforcement work, which owns `assertModule` (Resolved assumption). A burst is
cheap where it matters: the envelope id carries the collapse window, so any number of place writes by one member inside one 10 s
window is one recompute per `(traveller, year)`. Booking import enqueues once for the whole confirm.

### The year view (08-S6b)

**Data source: the rows already in the payload.** `loadAtlas` returns every `travel_stats` row of the traveller; one row per year
travelled plus the all-time row, so the count is bounded by the years a person has travelled. The payload is **unchanged**: no
field is added. There is no second request, so no loading state, no failed state and no waterfall for a year change: it is a local
state change over data in hand. The plan's lazy `loadTravelStatsFn` is not built.

**Periods.** `stats-period.ts` derives them: "All time" first, then every year whose row has `tripCount > 0`, newest first. A year
whose row exists with zero trips (a recompute after the last trip left the year, or a transport that departs in a year with no trip
starting in it) is not a period: it would be a screen of zeros. The control is shown only when at least one year exists; a
traveller with no dated trip sees the Stats tab exactly as today plus the streak tile. The period is component state of
`AtlasPanel` (always mounted), **not** of the Stats tab content, which Radix unmounts whenever another tab is active: a reader who
picks 2019 and then taps a country on the map (which switches the shelf to the Country tab) finds 2019 still selected on return.
Default "All time"; it falls back to "All time" when the chosen year disappears after a re-read.

**What each period shows, and whose it is.**

| Tile                        | All time                                | A year                                                       | Whose / source                         |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| Places                      | stored `placeCount`                     | the year row's                                               | the traveller's member trips           |
| Regions                     | live `regionCount`                      | **absent** (the row stores `0`; a lifetime figure)           | the traveller's                        |
| Visits                      | live `visitCount`                       | **absent** (a lifetime tally)                                | the traveller's                        |
| Trips (+ distance caption)  | stored `tripCount`, `distanceMetres`    | the year row's; distance from transports departing that year | the traveller's member trips           |
| Cities                      | stored `cityCount`                      | the year row's                                               | the traveller's member trips           |
| Days away                   | stored `dayCount`                       | the year row's                                               | the traveller's member trips           |
| **Countries on your trips** | **absent** (the headline is the answer) | the year row's `countryCount`                                | the countries the year's trips went to |
| **Year streak**             | stored `yearStreak` of the all-time row | **absent**                                                   | the traveller's streak, newest run     |

A zero distance is "not recorded" and prints no distance; then the tile shows its caption. This is **not** the Trips tile's rule
today: it tests `=== null` and prints "0 km" for a traveller with trips and no transports (`atlas-screen.tsx` passes the all-time
number), so 08-S6b changes the test to `> 0`. In a year view the Trips tile prints that year's distance (transports that depart in
the year) where it has one, and otherwise "Trips that start in {year}". `year_streak` counts the run of consecutive years with a trip that **starts** in them, newest first, planned trips
included, which is what `yearStreakFrom` does. The run ends at the **newest year that has a trip**, not at the current year, so the tile says which years it spans: with a streak of N and the newest year Y the caption reads "Trips every year, Y-N+1 to Y"
(N of one reads "A trip in Y"). A traveller whose run ended in 2015 reads that, not a streak that looks current. A planned future
year with nothing in between ends the run there: a traveller who travelled every year from 2019 to 2026 and plans a trip in 2028
reads "1" over "A trip in 2028". That is `yearStreakFrom`'s rule and the caption states it; skipping future years would change a
stored figure for every traveller and belongs to a decision about what a streak is, so it is not made here (Resolved assumption).

**Continents.** The all-time view keeps the live `atlas.byContinent` row exactly as it is. A year view **does not show it**: the
row is the traveller's all-time visited list by continent, and a year row's `by_continent` keeps only visited countries that year's
trips went to, which would disagree with the "Countries on your trips" tile beside it and lag a country mark by design (Resolved
assumption 9). Nothing is added to the payload and `continentCells` is untouched.

**Section states.**

- _Empty:_ a traveller with no visited country, no region and no trip gets, in place of the tile grid, an `EmptyState` on
  `--color-surface-2` titled "Nothing to count yet" with a line naming what to do ("Mark a country on the map, or plan a trip")
  and one action, a `Link` to `/trips`. It has no button that moves to the Country tab: on a phone that tab's own empty state only
  repeats the invitation and offers nothing to press, so such a button would lead nowhere. It is not a grid of zeros, is plain
  content and is not announced. "No trip" reads the all-time row: a row with `tripCount` 0, or **no row at all**, counts as no trip
  (nothing has been counted). A first trip created seconds ago may still show the empty state until its recompute lands; the
  router's next invalidation corrects it.
- _Re-reading:_ during the screen's `router.invalidate()` (the `loading` status the screen already computes) the `role="group"`
  that wraps the tile grid carries `aria-busy="true"` and keeps every figure at full opacity; it is the **only** element that does.
  The all-time continents row sits outside it, as do the period control, the live region and the `Alert`, or their announcements are
  held back. No marker, no animation, and the control is **not** disabled (a focused control that becomes disabled drops focus to
  the page).
- _Failed:_ when the screen's status is `failed` (the re-read did not come back), a `danger` `Alert` inside the Stats tab says the
  figures could not be reloaded, that nothing the traveller changed was lost, and that the figures shown may be out of date. It
  offers a retry button in its `actions`, with its own loading label, that runs `router.invalidate()`; the old figures stay under
  it, and so does everything else the failed re-read left stale. Below `sm` the `Alert` is compact: its title and the retry
  button stay visible and the body is kept for screen readers (`sr-only`), so it costs the least height it can; the panel scrolls beneath it. Focus rules, each with a test:
  - `Button`'s loading state keeps the pressed button focusable but inert. When the retry **fails again**
    the `Alert` is re-keyed (so `role="alert"` announces again) and focus goes back to the retry button.
  - When the re-read **succeeds**, focus moves to the period control, or to the Stats tab panel when there is none, **only if the
    retry was pressed from this `Alert`** (a flag set on press). A recovery started elsewhere (the country card's retry shares the
    same `failed` status) leaves focus where it is.
  - The Stats tab panel is a legitimate focus target only with a visible indicator: the panel's `layout.content`
    (`focus-visible:outline-none` in `atlas-panel.tsx`) is overridden for the Stats `TabsContent` so the primitive's own outline
    shows.
    The first load failing
    stays the route's `errorComponent`. **Reachability is proven first.** `atlas-screen.tsx` derives `failed` from
    `match.status === 'error'`, and the route's `errorComponent` replaces the whole screen when the leaf match errors, so the state
    exists only if a failed `router.invalidate()` leaves the screen mounted. The first step of 08-S6b is a test with a real router
    (the loader rejects on the second read) that shows what happens. If the screen stays, the `Alert`, the retry and the focus rules
    are built as written. If the route's `errorComponent` takes over, the failed state and its focus rules (AC 18) are **not built**,
    the ticket says so in its description, and the country card's retry is filed as the same finding in a follow-up issue.
- _Skeleton:_ none. There is no request of the section's own.

**Motion and tokens.** None added. Figures change instantly on a period change; every figure keeps `font-variant-numeric:
tabular-nums` (the tile primitive already does) so nothing shifts.

### Alternatives considered, and why they lost

| Alternative                                                            | Why not                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The plan as written (lazy `loadTravelStatsFn`, stale marker, count-up) | Ships a marker for a lag a traveller cannot see, adds a second request for rows in the payload, and leaves the real defect (no producer on place and transport writes) in place |
| Only the producers now; the year view later                            | "This year" and the streak, part of the reference figure set, stay missing from a stage that claims to finish the row                                                           |
| Producers send the all-time row only (no trip read, no year)           | Year rows would go stale until the next trip edit, which is the defect again one level down                                                                                     |
| A nightly cron that rebuilds rows older than a day                     | Adds a scan over every traveller's trips to hide missing triggers, and still shows yesterday's places for a day                                                                 |
| Recompute inline on the write                                          | Six aggregate queries on a request path, which D1's rows-read billing punishes; the queue is why the handler exists                                                             |
| A workspace-wide figure set labelled "the workspace's" (the plan)      | The recompute is member-scoped (ADR 0007); a label that says otherwise would be wrong for every workspace where someone is not on every trip                                    |

## 📝 Architecture

- **Owner module of each new concept (`docs/SPEC.md` §8):** when a trip's contents ask for a recompute ->
  `src/server/queue/travel-stats-fanout.ts` (`enqueueTripRollup`); which periods exist, which tiles a period shows and whose each
  figure is -> `src/lib/atlas/stats-period.ts` (pure, no I/O, no React), so a future figure cannot be added without choosing a
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
  `cloudflare:workers`. The helper's module is already covered there by `travel-stats-fanout.test.ts`. The call-site tests do
  **not** mock the fan-out module: they stub the queue binding (`#/server/auth/env`), as
  `src/routes/_app/-server/__tests__/trip-lifecycle-side-effects.test.ts` does, and read the real envelopes, so each can assert the
  `orgId` is the caller's workspace, the id prefix, the `userId` and the years. A mocked fan-out would leave no envelope to check.

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

// src/lib/atlas/stats-period.ts (pure)
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
scope.ctx.userId)`), which is all the model reads. `listTravelStats(scope, userId)` returns **any** member's rows of the workspace
for the id it is given, so `loadAtlas`'s one call with the caller's id is what keeps the figures the caller's; the isolation test
lives at the repository (see Verification), because `loadAtlas` is an inline server-function handler whose return value a Node
test cannot read.

## 📝 UI/UX

Route `/atlas`, Stats tab, unchanged otherwise. No new primitive, no second stat card.

- **Period control.** `SimpleSelect` (`src/components/ui/select.tsx`) with a **visible** label "Show figures for" tied to its
  trigger (`triggerId`), above the tile grid; options "All time" and one per year (digits from `formatYear`, no grouping
  separator, as Latin digits in every locale, `docs/SPEC.md` §9). Keyboard: the primitive's own (Enter/Space opens, arrows move, Escape closes). Hover,
  focus-visible and active states come from the primitive. It is never disabled by a re-read.
- **Where the state lives.** The period and the live region both belong to `AtlasPanel`, which stays mounted when the reader
  switches tabs; the tile grid and the control render inside the Stats tab from them.
- **Announcements.** One visually hidden `role="status"` element in `AtlasPanel`, outside every tab, empty on mount. It is written
  only when the reader changes the period, and when the period falls back to "All time" because the chosen year is gone **while
  the Stats tab is showing** ("Showing figures for all time." / "Showing figures for {year}."); a fall-back that happens while
  another tab is open is silent and the reader finds "All time" selected on return. It is never written on mount and never by a
  re-read that changes nothing. A component test covers each case.
- **Tiles.** The existing `StatCard` grid (`grid-cols-2`, `sm:grid-cols-3`, `xl:grid-cols-6`), wrapped in a `role="group"` named by
  the period ("Figures for all time" / "Figures for {year}") so a reader who arrives after the announcement still knows which year
  the figures are for. The all-time view gains the streak tile as a full-width last row (`col-span-full`), so seven tiles never
  leave an orphan; a year view has five tiles (places, trips, cities, days, countries) and the last one spans both columns below
  `sm`, so no tile sits alone in the last row of the two-column grid at 360px. Every tile's label says whose figure it is ("Your
  places", "Countries on your trips", "Year streak"); `data-stat` names the figure (`countries`, `streak`) as the others do. In a
  year view the places tile prints no caption at zero ("Nothing pinned on a trip yet" says "yet" about a year that is over). Tile
  order is the all-time order with the absent tiles removed, so Trips moves up when Regions and Visits drop out; that is accepted.
- **Continents.** The existing `dl` row, all-time view only (see "Continents" above). In a year view the section is absent.
- **Empty and failed states.** As above, inside the Stats tab only. The `Alert` is `tone="danger"` (`role="alert"`) with a `title`
  and an `actions` retry button; the empty state is plain content.
- **Responsive.** At 360px the grid is two columns inside the panel sheet and the control is full width; the failed `Alert` is
  compact so it costs about 90px (the phone shelf is `h-[min(58svh,30rem)]` with the headline and tabs above it, about 250px for this tab at 360x800 and about 160px at 360x640, where the control and the compact `Alert` still leave room for little more than the first tile row, and the panel scrolls); at 2560px the shelf's existing measure holds and nothing stretches.

## 📝 Visual change expected

`/atlas`, Stats tab, light and dark, 360x800, 1280x900 and 2560x1440:

- 08-S6a: nothing visible changes by itself; the figures are right more often.
- 08-S6b: the all-time view with the period control and the streak tile; a year view (five tiles, no continent row); the control
  open; the empty state; the failed state with the old figures under the alert; the tab in a non-English locale and in Arabic
  (right-to-left) with a year in Latin digits (`formatYear` pins `-u-nu-latn` like the other formatters, `src/lib/format.ts`).
- The Country and Bucket list tabs, the headline and the map do not change by a pixel.

## 📝 Copy

Every new string, as an `en` key in `src/lib/i18n/messages/en/atlas.ts` and the same key in all 23 locales (`i18n-messages` skill):

| Key                             | `en` text                                                               |
| ------------------------------- | ----------------------------------------------------------------------- |
| `panel.stat.scope.label`        | Show figures for                                                        |
| `panel.stat.scope.all`          | All time                                                                |
| `panel.stat.scope.groupAll`     | Figures for all time                                                    |
| `panel.stat.scope.groupYear`    | Figures for {year}                                                      |
| `panel.stat.scope.announceAll`  | Showing figures for all time.                                           |
| `panel.stat.scope.announceYear` | Showing figures for {year}.                                             |
| `panel.stat.tripsCaptionYear`   | Trips that start in {year}                                              |
| `panel.stat.daysCaptionYear`    | Across your trips that start in {year}                                  |
| `panel.stat.countries`          | Countries on your trips                                                 |
| `panel.stat.countriesCaption`   | On your trips that start in {year}                                      |
| `panel.stat.streak`             | Year streak                                                             |
| `panel.stat.streakCaptionRange` | Trips every year, {first} to {last}                                     |
| `panel.stat.streakCaptionOne`   | A trip in {last}                                                        |
| `panel.stat.streakNone`         | Add a trip with dates to start a streak                                 |
| `panel.stats.empty.title`       | Nothing to count yet                                                    |
| `panel.stats.empty.body`        | Mark a country on the map, or plan a trip, and your figures start here. |
| `panel.stats.empty.planTrip`    | Plan a trip                                                             |
| `panel.stats.error.title`       | The figures could not be reloaded                                       |
| `panel.stats.error.body`        | Nothing you changed was lost. These figures may be out of date.         |
| `panel.stats.error.retry`       | Try again                                                               |
| `panel.stats.error.retrying`    | Trying again                                                            |

`{year}`, `{first}` and `{last}` are rendered through `formatYear`, never `formatNumber`, which would print "2,026". A sentence
never embeds a translated phrase as a placeholder (the all-time and year announcements are separate keys). No plural key varies on
two numbers. **Translator comment on every key that carries a year** (`scope.groupYear`, `scope.announceYear`,
`tripsCaptionYear`, `daysCaptionYear`, `countriesCaption`, `streakCaptionRange`, `streakCaptionOne`): in Hungarian and Turkish a
case suffix attaches to the digits and changes with how the year is pronounced (2026-ban but 2025-ben; 2026'da but 2025'te), so
the comment asks for a form that needs no suffix on the number (a label such as "Year: {year}", or an en dash range), as
`panel.bucket.target` already does in `tr` and `hu`. If the catalogue already has a "Try again"
key in `atlas.ts` (`list.error.retry`, `card.error.retry`) the slicer reuses the pattern but adds its own key, as each surface does
today. `src/components/atlas/__tests__/copy-rules.test.ts` stays green: no key is dead, no literal reaches a screen.

## 📝 Edge Cases & Failure Scenarios

- **The queue refuses the message.** The write stands; the helper logs once and returns (`requestTravelStatsRecompute`). The figures
  catch up on the next producer.
- **A trip with no start date.** Only the all-time row is recomputed; a transport that departs in a dated year still sends that
  year, and the resulting year row has `tripCount` 0, so it is not a period.
- **A transport's departure date moves from December to January.** Both years are sent: the one read before the write and the new
  one.
- **A tab on the previous bundle saves an existing transport with no `intent`.** The previous date is still read by id (the row
  exists and belongs to the trip), so the old year is not missed.
- **A year row left with zero trips** (the last trip of the year was deleted or moved): not offered; if it was the selected period
  the control falls back to "All time".
- **Five members, one place added.** Five envelopes per year inside one window, one recompute each; a second place inside the same
  window adds none.
- **A member who left the workspace is still on the trip.** Their envelope is acknowledged with one `warn` log and nothing is
  written; it is not dead-lettered.
- **Booking import with ten stays.** One enqueue at the end; if every stay failed to create a place, none.
- **A traveller with trips but no visited country.** The empty state is not shown (a trip is something to count); the countries
  tile in a year view shows the year's `countryCount`, which may be zero.
- **No all-time row yet** (a new traveller, or old data that predates the first recompute; no backfill, Out of scope). Treated as no trip: with no country and no region the empty state shows, which for old data lasts until the next producer or trip edit runs; otherwise the tiles show
  their per-tile captions as today.
- **A streak that ended long ago.** Newest year with a trip 2015, streak 3: the tile reads "Trips every year, 2013 to 2015", not a
  number that looks current.
- **The first trip of a new year.** The all-time recompute (year 0 is sent first) can run before the new year's row exists, and queues order nothing, so the tile can briefly pair the stored streak with a newest year the streak does not yet include (a wrong range); it heals on the next all-time recompute and is accepted.
- **A planned future year.** Trips in 2019-2026 and one planned in 2028: the streak is 1 and the tile reads "A trip in 2028".
- **The chosen year disappears** after a re-read: the control falls back to "All time"; the live region says so when the Stats tab
  is showing, and is silent otherwise.
- **The reader picks a year, taps a country on the map, and comes back.** The year is still selected (state lives in `AtlasPanel`).
- **The re-read fails after a country mark.** The `Alert` says the figures could not be reloaded and nothing was lost; the live
  headline, the map and the other tabs are as the optimistic update left them, not asserted to be current.
- **The retry fails again.** The `Alert` announces again and focus returns to the retry button.
- **A traveller with trips and no transports.** The Trips tile prints its caption, not "0 km".
- **Streak of 0.** The tile prints 0 with the "Add a trip with dates to start a streak" caption, not a blank.
- **The period control with one year only.** Shown (two options), because "this year" is the figure the reference set names.
- **A year with no places.** The places tile shows 0 without a caption; the other tiles show their own numbers; nothing throws.
- **The re-read fails while a year is selected.** The `Alert` shows; the selected year's figures stay under it.
- **Arabic.** The control, tiles and heading mirror through logical properties; the year is Latin digits, as every number in every locale is; a figure and
  its unit stay one run (`data-numeric`), as the Trips caption does today.

## ✅ Acceptance criteria

08-S6a:

1. `enqueueTripRollup(scope, trip, otherDates?)` exists in `src/server/queue/travel-stats-fanout.ts`, wraps `enqueueTravelStats`,
   builds no envelope itself, never throws, and is not defined in a route module; `affectedStatYears(startDate, ...otherDates)`
   keeps every existing caller compiling and tested.
2. `createPlanPlaceFn`, `deletePlanPlaceFn` call it after the write with the trip's start year; `updatePlanPlaceFn`
   calls it only when the city changed (`requirePlaceOfPlan` returns the place it reads); `confirmBookingImport` calls it once,
   only when a place was created (the flag is set when `createPlace` resolves, so a created place whose reservation or `persist` then fails still enqueues, and a reused place does not).
3. `saveTransportFn`, `saveSearchedConnectionFn` and `deleteTransportFn` also send the transport's departure year, and on a save
   the previous departure year, read by id through the tenant-scoped repository before the write and used only when the row
   belongs to the trip (whatever `intent` says). A test moves a transport's departure date across a year boundary and asserts
   both years are sent; another saves an existing transport with no `intent` and asserts the same.
4. `rankIdeasFn`, `reorderPlanFn`, `schedulePlaceFn`, `unschedulePlaceFn`, `updateStopFn`, `setTransportStatusFn`,
   `reorderDayTransportsFn`, day notes and the import `pin` step enqueue nothing (asserted).
5. A queue binding that throws does not fail any of these writes (asserted for one site of each module).
6. `createPlanPlaceFn` refuses a viewer, a non-member of an organization-visible trip, and an archived-trip write
   before the insert, and enqueues nothing in those cases. Preserve the authorization tests added by #936.
7. Isolation, for one site per module, with the queue binding **stubbed** (the fan-out module is not mocked): a trip id from
   another workspace and a private trip the caller is not on both fail as `NotFoundError` with zero envelopes, and every envelope
   that is enqueued carries the caller's `orgId`, the traveller's `userId` and the expected stat years.
8. The handler acknowledges a message for a former workspace member (one `warn` log, nothing written, no `TaskPermanentError`); a
   message for a non-member still recomputes nothing.
9. Outcome, one server-project test: the envelopes produced by `createPlanPlaceFn` and by a `saveTransportFn` that crosses a year
   boundary are run through the recompute on the test database, and `listTravelStats` then shows the new `placeCount`, and the
   new `distanceMetres` on the affected year rows. The whole point of the ticket is that the stored number moves.

08-S6b:

10. `statsPeriods` returns "All time" first, then each year with `tripCount > 0`, newest first, and no year with zero trips.
11. In a year view `regions`, `visits`, `streak` and the continent row are absent and `countries` is present; in the all-time view
    `countries` is absent and `streak` is present; the Trips tile prints no distance for 0 (the test is `> 0`); the streak is read
    from the all-time row only.
12. The streak caption names the years it spans ("Trips every year, 2013 to 2015", "A trip in 2027").
13. `listTravelStats(scope, userId)` has a repository test: with a colleague's rows seeded in the same workspace it returns only the
    named user's rows. `loadAtlas` is not touched, so its one call with `scope.ctx.userId` is guarded by the existing review rule,
    not a new test.
14. The Stats tab shows the period control only when a year exists; it carries a visible label and an accessible name, is never
    disabled; changing it changes the tiles and the group name and writes the live region once; the fall-back to "All time" writes
    it while the Stats tab is showing and is silent otherwise; nothing is written on mount.
15. The period survives a tab switch: select a year, switch to the Country tab and back, the year is still selected.
16. `aria-busy` is on the `role="group"` wrapping the tile grid only, never on the tab panel, the control, the live region, the
    continents row or the `Alert`.
17. A traveller with no country, no region and no trip (no all-time row, or a row with `tripCount` 0) sees the empty state with the
    `/trips` link, not zeros; no focus moves and nothing is announced.
18. (Only if the real-router proof of 08-S6b's first step shows the screen stays mounted on a failed re-read.) With the screen's status `failed` the Stats tab shows the `Alert` with a retry that has its own loading label and runs
    `router.invalidate()`, keeps the old figures, leaves the other tabs and the map mounted. When the retry fails again the `Alert`
    announces again and focus returns to the retry button. When the re-read succeeds focus moves to the period control (or to the
    Stats tab panel, which shows a focus indicator) **only** when the retry was pressed from this `Alert`.
19. In a year view at 360px no tile sits alone in the last row of the grid; the failed `Alert` is compact below `sm`.
20. All new keys exist in the 23 locales (parity test), the year-bearing keys carry the translator comment, and `copy-rules.test.ts`
    is green.
21. No new `fatal` console entry on `/atlas`, and no horizontal overflow from 360px to 2560px in either theme.

## 📝 Risks & Impact Review

| Risk                                                                              | Severity | Mitigation                                                                                                                                            |
| --------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| More queue traffic and recompute work (six aggregate queries per member and year) | Medium   | The collapse window folds a burst to one recompute per `(traveller, year)`; a place edit that moves nothing does not enqueue; an import enqueues once |
| A call site is forgotten, or added later without the producer                     | Medium   | The "must not enqueue" and "must enqueue" lists are asserted per function; the helper is the single named seam                                        |
| A departed member's envelope dead-letters on every write                          | Medium   | The handler acknowledges a former member's message instead of failing it permanently (one change, tested)                                             |
| Queue and KV cost is members x years per write, with no module gate yet           | Low      | Envelopes are tiny and bounded; the collapse window bounds the recomputes; the gate belongs to the module-enforcement work                            |
| A planned future trip ends the streak at the future year                          | Low      | The caption states the years; skipping future years is a rule about what a streak is and is not decided here                                          |
| A transport's year row is missed when the departure date moves                    | Medium   | The previous date is read before the write and sent with the new one; a test moves a transport across a year boundary                                 |
| A refused planner write must not enqueue recomputation      | Medium   | Preserve the existing archive and role guards and test zero envelopes for refused writes                      |
| The streak tile can print a wrong range for seconds after a new year's first trip | Low      | The all-time recompute can run before the new year's row exists; it heals on the next recompute and is accepted (Edge Cases)                          |
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
- Restoring the unused inventory-only endpoint or dialog removed by #936.
- A button in the empty state that leads into the map's search, which needs a design for the phone shelf of its own.

### Blockers

None. The recompute stage this one depended on is merged; no decision waits on a person.

### Backward compatibility (`BACKWARD_COMPATIBILITY.md`)

- **Server-function behaviour (§2).** Existing planner inputs and outputs are unchanged; recomputation runs after a successful write.
  The unused endpoint removal is owned by #936, not this stage.
- **Queue (§6).** The envelope shape and kind are unchanged. The handler's disposition for a former member's message changes from
  dead-letter to acknowledge; an old in-flight envelope is handled by the new handler, which only makes it quieter.
- **Locale keys (§5).** 21 keys are added to all 23 locales; none is renamed or removed.
- **Schema, URLs, events, the `/atlas` payload:** untouched.

### Known limit: trip-level producers stay start-year only

The existing trip-level producers (`trip-lifecycle.ts` create, edit, copy and delete; `people.ts` membership changes; the trip-copy
handler) send the trip's start year and the all-time row, as they do today. A trip that starts on 30 December with a transport that
departs on 2 January therefore leaves January's distance wrong after a trip delete, a copy, or a membership change, until the next
transport write on that trip or a later recompute of that year. This stage fixes the writes that move places and transports; widening
the trip-level producers with the trip's transport departure years is a follow-up the slicer may file (it needs one read of the trip's
departure dates in each producer). The year view prints that year's distance as the stored row has it.

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
2. `plan.ts` (three functions; `requirePlaceOfPlan` returns the place so the city can be compared) and `booking-import.ts`: add
   recomputation after successful writes, preserving the existing planner-write guards.
3. `transports.ts`: read the previous row by id (`getTransport`, used only when it belongs to the trip) before a save, and the
   row `requireTransportOfTrip` returns before a delete; send both years.
4. `handlers/travel-stats.ts`: acknowledge a former member's message; update its test.
5. Side-effect and isolation tests per module with the queue binding stubbed: envelope `orgId`, `userId`, years, the not-enqueue
   list, the queue-refusal case, the viewer and foreign-trip cases; the outcome test through the recompute.

Before the first PR of either phase, the "Docs and CI" grep (`AGENTS.md`) runs on these terms across `.ai/specs/`, `CONTEXT.md`,
`docs/` and comments in `src/`: `enqueueTripStatsFor`, `affectedStatYears`, `travel-stats`, `TaskPermanentError`,
`panel.stat.`, `loadTravelStatsFn`.

### Phase 2 - read the roll-up by year (08-S6b)

0. A real-router test that shows whether a failed `router.invalidate()` leaves `AtlasScreen` mounted (decides whether the failed state is built).
1. `stats-period.ts` and its test (periods, tiles per period, whose figure, zero-distance rule, streak range, fall-back).
2. `formatYear` in `src/lib/format.ts` and a case in `src/lib/__tests__/format-locale.test.ts`.
3. `atlas-panel.tsx`: the period state and the live region in `AtlasPanel`, the control, the group name, the streak and countries
   tiles, the `> 0` distance test, the empty and failed states, the Stats `TabsContent` focus outline; `atlas-screen.tsx` passes the
   year rows and the section status; component tests including the focus assertions.
4. A repository test that `listTravelStats` returns only the named user's rows.
5. The 21 keys in the 23 locales; `CONTEXT.md` entries.
6. The atlas journey in `e2e/journeys.spec.ts` gains one step (ADR 0016 allows a browser test only for what no lower layer can fail on: server rendering and hydration of the `Select` and of `formatYear`, and a silent console): select a year on the seeded workspace, assert the tiles change and the regions tile and continent
   row are gone; the empty and failed states are covered at component level.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit:
  - `src/server/queue/__tests__/travel-stats-fanout.test.ts` - `enqueueTripRollup` years, extra dates, never throws;
    `affectedStatYears` with zero, one and two further dates.
  - Producer side-effect and isolation tests next to each module (`src/routes/_app/trips/$tripId/-server/__tests__/` for the plan
    writes, `src/server/fns/__tests__/` for transports and the import),
    with the queue binding stubbed and the real envelopes read: arguments per function, the not-enqueue list, a transport moved
    across a year boundary sends both years, a save with no `intent` still reads the previous date, a refusing queue does not fail
    the write, a viewer and a foreign or private trip are refused with zero envelopes and the caller's `orgId`. For
    `confirmBookingImport`: reusing an existing place by name enqueues nothing, and a created place whose reservation or `persist` then
    fails still enqueues once.
  - `src/server/queue/handlers/__tests__/travel-stats.test.ts` - a former member's message is acknowledged, not dead-lettered.
  - One outcome test in the Node `server` project: the envelopes a place add and a cross-year transport save produce, run through
    the recompute, move `placeCount` and the year rows' `distanceMetres` as `listTravelStats` reads them.
  - A repository test: `listTravelStats` with a colleague's rows seeded returns only the named user's rows.
  - `src/lib/atlas/__tests__/stats-period.test.ts` - periods exclude zero-trip years and sort newest first; per-period tiles
    and whose figure each is; distance 0 prints nothing; streak only on all time, read from the all-time row, with its range; the
    fall-back when the year is gone.
  - `src/components/atlas/__tests__/atlas-panel.test.tsx` - the control appears only with a year, has a visible label, is never
    disabled; changing it changes tiles and group name and writes the live region once; nothing on mount; `aria-busy` placement;
    the period survives a tab switch; the empty state with its link and no focus move; the failed state keeps the old figures and
    the other tabs, announces again and returns focus to the retry button when the retry fails, and moves focus after a successful
    retry only when the retry was pressed from the `Alert`.
  - `src/lib/__tests__/format-locale.test.ts` - `formatYear` prints no grouping separator in `en`, `de` and `ar`.
- Browser: the atlas journey in `e2e/journeys.spec.ts` on the seeded workspace (2026 and 2025 rows, a streak of 7): the period control, a year
  view, the console silent. The seed stores a streak of 7 over two year rows, so the spec asserts the tiles and the group name, not the streak against the rows. No baselines (ADR 0016). Evidence for review is the blind A/B pair from `scripts/visual/capture.mjs`
  with `--state stats` at 360x800, 1280x900 and 2560x1440, light and dark.
- Layout shift after settle is asserted at 0 on `chromium`: the tiles reserve no height they do not use and nothing animates.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                      | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Why                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What is the complete slice at HEAD, given the plan's premises moved?                          | Re-based slice, two tickets: producers on place and transport writes, then the year view over rows already shipped                                                                                                                                                                                                                                                                                                                                                          | Decided by product owner sub-agent (confidence high): the real lag is missing producers, not country marks; "this year" and the streak are part of the reference figure set                    |
| 2   | Lazy `loadTravelStatsFn` or the rows already in the payload?                                  | The rows already in `loadAtlas`; no new server function and no payload change                                                                                                                                                                                                                                                                                                                                                                                               | Decided by software architect sub-agent (confidence high): the rows ship already and `router.invalidate()` refreshes them; a lazy call adds loading and error states for data in hand          |
| 3   | The stale marker                                                                              | None; rely on `router.invalidate()` and the collapse window                                                                                                                                                                                                                                                                                                                                                                                                                 | Decided by product owner sub-agent (confidence medium): its predicate no longer matches any stored figure the panel reads; it is the easiest to add back                                       |
| 4   | The 220 ms count-up                                                                           | Not built; figures change instantly                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided by product owner sub-agent (confidence medium): its only job was showing a stale figure catching up, and it adds layout-shift assertions                                               |
| 5   | How do place and transport writes ask for a recompute?                                        | `enqueueTripRollup(scope, trip, otherDates?)` in `travel-stats-fanout.ts`, taking the trip the caller already holds                                                                                                                                                                                                                                                                                                                                                         | Decided by software architect sub-agent (confidence high): one owner for "when"; no extra trip read; transports add their departure years                                                      |
| 6   | Which year does a transport write move?                                                       | The transport's departure year (and the previous one on an edit), plus the trip's start year                                                                                                                                                                                                                                                                                                                                                                                | Verified against `recomputeTravelStats` (`transportYearFilter`); both specialists flagged the plan's "start year only" as wrong for transports                                                 |
| 7   | Whose figures are they, and how are they labelled?                                            | The traveller's, as the catalogue already says; no "workspace" label                                                                                                                                                                                                                                                                                                                                                                                                        | Verified, not asked: `memberTripIds` (ADR 0007), `panel.stat.*` comments in `en/atlas.ts`, `yearStreakFrom`                                                                                    |
| 8   | Is distance omitted?                                                                          | No: printed on the Trips tile when recorded; 0 prints nothing                                                                                                                                                                                                                                                                                                                                                                                                               | Verified, not asked: the leg form records a distance and the tile already prints it                                                                                                            |
| 9   | Does a year view print a continent breakdown?                                                 | No: the row is absent in a year view; the all-time row is unchanged                                                                                                                                                                                                                                                                                                                                                                                                         | Panel round 1, product owner (conditions applied): a year row's `by_continent` lags a country mark and disagrees with "Countries on your trips"; adding it back needs recompute on every mark  |
| 10  | Which other figures does a year view hide?                                                    | Regions, visits and the streak; it adds "Countries on your trips"                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by software architect sub-agent (confidence high): year rows store `region_count` 0; visits and regions are lifetime figures                                                           |
| 11  | Does a place update enqueue?                                                                  | Only when the city changed                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Default applied: the city count is the only figure a place edit moves; a visited toggle or rename would otherwise cost a recompute per window                                                  |
| 12  | Are years with zero trips periods?                                                            | No                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Default applied: a row can exist with zero trips after a delete or a transport departing in a year no trip starts in; a period of zeros is noise                                               |
| 13  | Is the period in the URL?                                                                     | No, local state, default "All time"                                                                                                                                                                                                                                                                                                                                                                                                                                         | Default applied: reversible, no route or search-contract change; a deep link is listed out of scope                                                                                            |
| 14  | The empty state                                                                               | A designed `EmptyState`: a body that points at the map and one `Link` to `/trips`, shown only when no country, region or trip exists (an absent all-time row counts as no trip)                                                                                                                                                                                                                                                                                             | Default applied from the plan's empty-state requirement; the "Mark a country" button of the first draft was dropped after panel round 2 (row 29)                                               |
| 15  | The failed state                                                                              | A `danger` `Alert` fed by the screen's existing `failed` status; "may be out of date"; retry with a loading state; focus returns                                                                                                                                                                                                                                                                                                                                            | Decided by product owner sub-agent (confidence high); wording and focus per panel round 1, UX and accessibility specialists (conditions applied)                                               |
| 16  | The plan's `e2e/product-modules.visual.spec.ts` and four baselines                            | Not built; the atlas journey in `e2e/journeys.spec.ts` journey, no baselines                                                                                                                                                                                                                                                                                                                                                                                                | ADR 0016                                                                                                                                                                                       |
| 17  | The trip-copy handler's private fan-out and expense writes' `spend_minor`                     | Left alone and named in Risks                                                                                                                                                                                                                                                                                                                                                                                                                                               | Default applied: neither is needed for the figures this stage prints                                                                                                                           |
| 18  | Where does the glossary change land?                                                          | `CONTEXT.md` gains **Travel statistics** and **Stat year**                                                                                                                                                                                                                                                                                                                                                                                                                  | Default applied: neither term is in the glossary and both are used across the atlas                                                                                                            |
| 19  | May `createPlaceFn` keep its viewer-readable write?                                           | No: it gains the planner-write guard before the insert                                                                                                                                                                                                                                                                                                                                                                                                                      | Panel round 1, security and tenancy reviewer (condition applied): `createPlace` checks only that the caller can read the trip; the new recompute would amplify the hole                        |
| 20  | Does the streak tile say which years it spans?                                                | Yes: "Trips every year, {first} to {last}" / "A trip in {last}"                                                                                                                                                                                                                                                                                                                                                                                                             | Panel round 1, UX specialist (condition applied): the run ends at the newest year with a trip, not at the current year; the wording was sharpened in round 2 (row 32)                          |
| 21  | Is the period control disabled while the screen re-reads?                                     | No; `aria-busy` on the tile grid wrapper only                                                                                                                                                                                                                                                                                                                                                                                                                               | Panel round 1, accessibility and UX specialists (conditions applied): a focused control that becomes disabled drops focus                                                                      |
| 22  | Panel verdicts, round 1 (`afk-decide`)                                                        | Product owner, software architect, security and tenancy, accessibility and UX specialists each **approve with conditions**; every condition applied in the following commit                                                                                                                                                                                                                                                                                                 | Round 2 verdicts are recorded in the rows below                                                                                                                                                |
| 23  | Is `createPlaceFn`'s guard a separate ticket, and should the dead function be deleted?        | Neither: the guard is the first commit of 08-S6a, named in the ticket body; deleting `AddPlaceDialog` is out of scope                                                                                                                                                                                                                                                                                                                                                       | Panel round 2, product owner and tenancy reviewer: the function has no UI caller today, so nobody loses a control; the guard is the narrower change and keeps a future caller safe             |
| 24  | Who stops a departed member's envelopes from dead-lettering?                                  | The handler: it acknowledges a former member's message after one `warn` log instead of throwing `TaskPermanentError`                                                                                                                                                                                                                                                                                                                                                        | Panel round 2, security and tenancy reviewer (condition applied): the smaller change than filtering recipients at every producer, and it also fixes the existing trip-write producers          |
| 25  | Where does the `listTravelStats` isolation test live, given `loadAtlas` is an inline handler? | At the repository: the function returns only the named user's rows; `loadAtlas` stays untouched                                                                                                                                                                                                                                                                                                                                                                             | Panel round 2, security and tenancy reviewer: a Node test cannot read an inline handler's return, and extracting it would contradict the "no change to `library.ts`" merge-safety promise      |
| 26  | Are the cost of members x years envelopes and the missing module gate acceptable?             | Yes; the gate belongs to the module-enforcement work                                                                                                                                                                                                                                                                                                                                                                                                                        | Panel round 2, security and tenancy reviewer flagged it as a human cost call; applied as the most reversible option (a later gate removes the traffic, nothing here depends on it)             |
| 27  | How is a transport's previous departure year found?                                           | Read by id through the tenant-scoped repository before the write, used only when the row belongs to the trip, whatever `intent` says                                                                                                                                                                                                                                                                                                                                        | Panel round 2, security and tenancy reviewer (condition applied): a tab on the previous bundle sends no `intent`                                                                               |
| 28  | Does the outcome get its own test?                                                            | Yes: the envelopes are run through the recompute and `listTravelStats` is read back                                                                                                                                                                                                                                                                                                                                                                                         | Panel round 2, product owner (condition applied): argument-only tests would pass a producer that sends the wrong years                                                                         |
| 29  | Does the empty state keep a "Mark a country" button?                                          | No: one `Link` to `/trips` and a body that points at the map                                                                                                                                                                                                                                                                                                                                                                                                                | Panel round 2, UX specialist (condition applied): the Country tab offers nothing to press on a phone, so the button led nowhere                                                                |
| 30  | The period state and the live region                                                          | Both in `AtlasPanel`, outside the unmounting tab content; the fall-back is announced only while the Stats tab shows                                                                                                                                                                                                                                                                                                                                                         | Panel round 2, accessibility and UX specialists (conditions applied): the year survives a map tap, and the status region is always mounted                                                     |
| 31  | Focus on retry, after a repeated failure and on recovery                                      | Retry failing again re-keys the `Alert` and refocuses the button; success moves focus only when the retry came from this `Alert`; the Stats panel shows its focus outline                                                                                                                                                                                                                                                                                                   | Panel round 2, accessibility specialist (conditions applied): WCAG 2.2 4.1.3, 2.4.3 and 2.4.7                                                                                                  |
| 32  | Copy: label, streak, failed state, year phrases                                               | "Show figures for", "Year streak" with a range caption, a failed state that says nothing was lost, a translator comment on year keys                                                                                                                                                                                                                                                                                                                                        | Panel round 2, UX specialist (conditions applied): "Period" is ambiguous, "run" is an idiom, hu and tr suffix the digits                                                                       |
| 33  | A planned future trip ends the streak at the future year                                      | Left as `yearStreakFrom` has it; the caption names the year                                                                                                                                                                                                                                                                                                                                                                                                                 | Default applied: skipping future years changes a stored figure for every traveller and is a decision about what a streak is; the UX specialist flagged the surprise and the caption answers it |
| 34  | The failed `Alert` on a phone                                                                 | Compact below `sm`: title and retry visible, body `sr-only`                                                                                                                                                                                                                                                                                                                                                                                                                 | Panel round 2, UX specialist (condition applied): the shelf is about 250px at 360x800                                                                                                          |
| 35  | Panel verdicts, round 2 (`afk-decide`)                                                        | Product owner, tenancy, accessibility and UX specialists each **ship with fixes** (approve with conditions), every condition applied                                                                                                                                                                                                                                                                                                                                        | Round 1 conditions were all found applied; the new findings were gaps in the design, none a blocker, none `ESCALATE: yes`                                                                      |
| 36  | Panel verdict, round 2, software architect (`afk-decide`)                                     | **Approve with conditions** (confidence high, `ESCALATE: no`); every condition applied: stale rows 14 and 20 aligned, markdown repaired, the import "created" flag set right after `createPlace` resolves, the not-enqueue list names server functions, the envelope bound corrected to four, the streak window accepted, the handler's doc comments and test name updated                                                                                                  | Decided by software architect sub-agent (confidence high): the code claims hold at HEAD; the defects were stale or contradictory text and one under-specified call site                        |
| 37  | Independent specification review of the PR (`om-auto-review-pr`)                              | Verdict **request changes** (two majors, no blocker), both resolved in the spec: the failed state is built only after a real-router reachability proof; the trip-level producers' start-year limit is declared as a known limit with a follow-up the slicer may file. Minors applied: Latin digits for years, the atlas journey in `journeys.spec.ts`, the import enqueue in a `finally`, a Backward compatibility section, softened phone-height claim, the docs grep step | Decided by an independent reviewer sub-agent (read-only); every finding checked against the code before it was applied                                                                         |

## Amendment - issue #936: one place-creation endpoint

Issue #936 removes the unmounted `AddPlaceDialog` and `createPlaceFn`. This supersedes the endpoint-retention
choices in historical Resolved assumptions rows 19 and 23. The operational scope above now has seven producer
call sites (three planner, three transport, one booking import), with no `trip.ts` producer or endpoint restoration.
The planner keeps its archive-before-role guard; #928 already added owner/editor enforcement in the repository.
The implementation PR for #936 records the intentional server-function removal and its compatibility exception.

## Implementation amendment - issue #1119 (08-S6a)

The producer slice adds the seven content-write triggers, variadic affected years and acknowledgement
without a write for absent workspace members. The problem statements above describe the snapshot
before this slice; 08-S6b still owns the period UI and glossary additions. At that snapshot, transport writers had no general archived-trip guard; #1041 now applies the shared repository guard to transport writes until the trip is restored. The first-commit guard
requirement in the original ticket brief was superseded by #936 and #928, as recorded above.

## Implementation amendment - issue #1120 (08-S6b1)

The period model lives in `src/lib/atlas/stats-period.ts`. `AtlasPanel` owns the chosen period and a persistent live region, reads the existing `atlas.stats` rows, and exposes a named, busy tile group. Year views omit lifetime regions, visits, streak and continents; all time retains the live figures and adds the stored streak with its range. Zero distance uses the trip caption. Four existing labels now explicitly name the traveller; the fourteen new keys and year translator comments are present in all 23 locales. `formatYear` prints Latin digits without grouping. The empty and failed section states remain the following ticket's scope.


## Implementation amendment - issue #1121 (08-S6b2)

The Stats tab now replaces its figures with a filled, surface-2 empty state when live country and
region counts are zero and the all-time row has no trips (a missing all-time row also means none).
It offers one link to `/trips`, with no live announcement or focus move. The three empty-state keys
ship in all 23 locales.

The real-router test `src/routes/_app/-ui/__tests__/atlas-reload.test.tsx` uses the production atlas
route's loader and rendering options. A successful initial read followed by a rejected invalidation
unmounts the atlas and renders the route error component. Per the conditional scope in #1121, the
Stats failed alert, its four keys and its focus rules are therefore not built. The same unreachable
country-card retry is tracked by #1456. The earlier failed-state descriptions above are design
history, superseded by this measured branch.

`ADD-06` is **done** with this final slice. The original gap matrix is no longer present (see
`docs/plans/README.md`); this disposition records the historical row's completion. The implementation
metadata lists the already merged producer and year-view PRs; the PR-opening step appends this final
slice's PR number when it exists.
