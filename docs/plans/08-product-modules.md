# Product modules

The four optional modules a workspace switches on beside the trip itself: the leave planner, the
world-map tracker, the travel journal and the saved place collections. And the gate that decides
which of them a plan has actually bought.

Read `docs/SPEC.md`, `DESIGN.md` and `docs/ARCHITECTURE.md` first. The stage shape is fixed by
`TEMPLATE.md`, the container rule by `12-verification-protocol.md` §1, and the clean-room rule and
shared-file protocol by `README.md`. Nothing below restates them.

## Area brief

### The four modules on disk, measured at HEAD

All four ship a finished screen. All four are read-only. That is one sentence and it is the whole
diagnosis: the schema is complete, the repositories are complete, and the server function that would
let a member change anything was never written.

- **The leave planner.** `src/routes/_app/vacay.tsx` (478 lines) loads `loadVacay`
  (`src/routes/_app/-server/library.ts:114`) and renders a year switcher, an entitlement panel with
  a `Progress` bar and three figures, a traveller list with per-person colour swatches, a legend and
  twelve month grids. A grid cell is a `<span>` carrying a `title` attribute
  (`vacay.tsx:375-409`) — not a button, not focusable, and there is nothing to click it for.
  `src/server/repos/vacay.ts` exports 28 functions; `loadVacay` reaches exactly two of them,
  `ensurePlan` (`:142`) and `getPlanOverview` (`:572`). `updatePlan` (`:181`), `setEntitlement`
  (`:307`), `setEntry` (`:366`), `setEntryRange` (`:400`), `removeEntry` (`:447`),
  `addCompanyHoliday` (`:486`), `addHolidayCalendar` (`:524`), `invitePlanMember` (`:207`),
  `setPlanMemberStatus` (`:224`) and `setUserColour` (`:248`) have no caller in production code — no
  screen and no server function reaches any of them. The dev seeder
  (`src/routes/api/dev/-seed/apply.ts`) exercises most, and the repository suites already cover
  `setEntitlement`, `setEntry` and `setEntryRange`
  (`src/server/repos/__tests__/repositories.test.ts:469-490`) plus `addCompanyHoliday`,
  `addHolidayCalendar` and `setUserColour` (`__tests__/tenant-isolation.test.ts:460-468`), so
  tenant-scope tests for these writes already exist and are extended, not duplicated.
- **The world-map tracker.** `src/routes/_app/atlas.tsx` delegates to `-ui/atlas-screen.tsx` (1,019
  lines), which composes `src/components/atlas/` — `country-overlay.tsx`, `atlas-panel.tsx`,
  `country-actions.tsx`, `country-search.tsx`, `countries-list.tsx`, `country-card.tsx`,
  `country-record.tsx`, `atlas-legend.tsx` — over a MapLibre canvas. This is the one module whose
  write path is partly built: `src/server/fns/atlas.ts` exposes `markCountryVisitedFn` (`:441`),
  `unmarkCountryVisitedFn` (`:485`), `addCountryToBucketListFn` (`:547`) and
  `removeCountryFromBucketListFn` (`:585`). The half that is not built is everything below country
  level and everything beside it: `markRegionVisited` (`src/server/repos/atlas.ts:221`) is reached
  only by the seeder and the atlas repository suite
  (`__tests__/atlas-country-facts.test.ts:520`), `unmarkRegionVisited` (`:244`) and
  `listVisitedRegions` (`:210`) are reached by nothing, and `createBucketListItem` (`:269`),
  `updateBucketListItem` (`:280`), `achieveBucketListItem` (`:293`) and `deleteBucketListItem`
  (`:314`) are reachable on a screen only through the two country-shaped wrappers, so a bucket list
  that models `kind` cannot hold a city or a walk.
- **The travel journal.** `src/routes/_app/journey/index.tsx` (614 lines) and
  `$journeyId.tsx` (384 lines) render `loadJourneys`, `loadJournalOverview` and `loadJourneyStory`.
  The story screen's empty state reads "This journey has no entries yet" and invites the reader to
  write the first one (`$journeyId.tsx:134-141`). There is no way to write it: `createEntryInput` is
  defined at `src/server/repos/journey.ts:119` and `createEntry` at `:560`, and no server function
  anywhere imports either. `updateJourney` (`:516`), `deleteJourney` (`:556`), `publishJourney`
  (`:534`), `unpublishJourney` (`:546`), `addPhoto` (`:600`), `attachPhotoToEntry` (`:612`) and
  `deletePhoto` (`:628`) are in the same position. `createJourneyFn` (`library.ts:884`) is the
  module's only write.
- **The place collections.** `src/routes/_app/collections/index.tsx` (170 lines) and
  `$collectionId.tsx` (338 lines) render `loadCollections` and `loadCollectionDetail`, with status
  pills and label pills that filter through `validateSearch` — client-side narrowing of a payload
  the server already sent. `createCollectionFn` (`library.ts:918`) is the only write.
  `updateCollection` (`src/server/repos/collections.ts:309`), `deleteCollection` (`:326`),
  `addCollectionPlace` (`:330`), `saveTripPlaceToCollection` (`:363`), `updateCollectionPlace`
  (`:398`), `setCollectionPlaceStatus` (`:410`), `deleteCollectionPlace` (`:420`), `createLabel`
  (`:427`), `deleteLabel` (`:436`) and `setCollectionPlaceLabels` (`:441`) have no caller in
  production code — the repository suites reach `addCollectionPlace`, `saveTripPlaceToCollection`,
  `createLabel` and `setCollectionPlaceLabels`; no screen or server function reaches any. The
  screen's own empty state promises that a place can be saved "from the map, from another trip, or
  straight from a recommendation" (`$collectionId.tsx:161`). None of those three is reachable.

And one consumer reads numbers nothing in production writes. `AtlasPanel` renders the statistics
from `listTravelStats` through `loadAtlas`, while `recomputeTravelStats`
(`src/server/repos/atlas.ts:792`) is called only by the dev seeder and the repository suite
(`__tests__/repositories.test.ts:451`), never from a request path. Marking a country moves the map
and leaves every figure beside it frozen at its seeded value.

### The rows this plan moves, and how far it moves each

| Row      | Stage    | Wave | Status               |
| -------- | -------- | ---- | -------------------- |
| `ADD-02` | `08-S1`  | 1    | partial → done       |
| `ADD-05` | `08-S2`  | 1    | partial → done       |
| `ADD-07` | `08-S3`  | 1    | partial → done       |
| `ADD-09` | `08-S4`  | 1    | partial → done       |
| `ADD-03` | `08-S5`  | 2    | partial → done       |
| `ADD-06` | `08-S6`  | 2    | partial → done       |
| `ADD-08` | `08-S7`  | 2    | absent → done        |
| `ADD-04` | `08-S8`  | 3    | partial → done       |
| `ADD-10` | `08-S9`  | 3    | absent → **partial** |
| —        | `08-S10` | 3    | closes no row        |

`08-S10` closes no row deliberately, in the shape `00-foundations.md` uses for its four write-path
stages: it is the enforcement of the module entitlements the other nine stages ship behind, and it
is named by each of them rather than re-decided in each of them.

### One row closes as partial, and the rule that decides which

A row closes **done** when every path it names is reachable on the screen, even where a detail inside
a path is degraded and said to be: a photograph refused because its format cannot be converted here
(`08-S7`), an address the traveller types because no geocoder fills it, a region marked from a list
because no sub-national geometry is shipped (`08-S2`). A row closes **partial** when a whole path it
names has **no entry point at all**, because then nothing on the surface stands in for it and a
reader of the matrix would be told a lie.

`ADD-10` is the one row in this file in that position. Of the three ways it names of getting a place
into a collection, two ship in `08-S9` — saving a place from a trip into several lists at once, and
copying a set of places between lists without duplicating them. The third, search-and-add, needs the
place search owned by `02-places-and-maps.md` `02-S13`, and **`02-S13` is wave 6 and is BLOCKED**:
that plan does not schedule it, and it waits on Gate A — the geocoding and place-search provider
decision owned by `docs/plans/11-boundaries-and-blockers.md` `11-S3`, which has no provider and no
budget. `08-S9` therefore ships every path that does not need a geocoder, leaves the search entry
point **absent rather than stubbed**, builds no second search, and records the row as
`absent → partial` with `02-S13` named as the stage that closes it. Nothing else in this file
inherits that residue.

One discrepancy, recorded rather than corrected. `11-S3`'s register lists `MAP-02` at wave 2. The
authority for a wave is the `### Stage id` line of the stage that owns the row, and that is
`02-S13` · Wave 6 in `02-places-and-maps.md`, which also carries **BLOCKED** in its `## Stage`
heading. This plan cites the stage, not the register, and the register's stale figure is filed for
the owner of `11-boundaries-and-blockers.md` rather than edited from a file that does not own it.

### One row is excluded, and it is not planned here

`ADD-01` is **excluded from this plan** and is closed by no stage in it. It describes a registry
whose switches are scoped to a deployment rather than to a customer, and one deployment here serves
every customer, so a switch of that shape is not a product control. The argument, the hosted
equivalent and the disposition live in `docs/plans/11-boundaries-and-blockers.md`, which owns that
row. What that file hands back to this one is the enforcement gap it measured — twelve module flags
that are sold, resolved and rendered and that gate nothing — and `08-S10` is where it lands.

### Reading order is wave order, with one deliberate consequence

The file runs lowest wave first: four wave-1 stages, one per module, then three wave-2 stages, then
three wave-3 stages. Each wave-1 stage does the same thing in its own module — it exposes the write
path over repository functions that already exist, on the screen that already ships, and adds no
route and no column. That is the cheapest movement on the matrix and it is deliberately the whole of
wave 1 here.

The consequence worth stating: the gate that sells these modules lands **last**, in wave 3. Until it
does, every module behaves exactly as it does today — resolved, displayed and ungated — so no stage
before `08-S10` may claim to have enforced an entitlement, and none of them tries.

### What this plan does not own

None of the six shared paths of `README.md` is claimed by any stage here. Three consequences travel
with that, and each is carried by the stage that needs it:

- **No stage in this plan changes the schema, and none files a column requirement.** All four
  modules' tables were built complete. `journey_entries` already carries `mood_id`, `weather`,
  `temperature_celsius`, `tags`, `entry_time`, `sort_order` and a lat/lng pair
  (`src/server/db/schema.ts`); `visited_regions` already carries its unique
  `(organization_id, user_id, region_code)` index; `collection_places` already carries a
  denormalised copy of every place field plus `source_trip_id` and `source_place_id`; the eight
  `vacay_*` tables already carry entitlements, colours, company holidays and calendars. There is no
  `pnpm db:generate` in this plan.
- **The travel-statistics write path is `00-foundations.md`'s `00-S4`, not this plan's.** `08-S6`
  consumes it and states its trigger; it does not build a second recompute.
- **The restricted markdown renderer is `01-trips-core.md`'s `01-S2`** (`src/lib/markdown/parse.ts`
  and `render.tsx`, wave 1), per entry 5 of `11-S2`, which gives the single implementation to the
  earliest wave-1 stage that needs one. `08-S7` renders an entry body through it and writes no
  second parser.

Two allocations are made here rather than inside a stage, because they are the two places where
stages of this plan could otherwise collide with each other:

**`src/routes/_app/-server/library.ts` is claimed by exactly one stage per wave.** It is a
953-line four-module module and every stage here would otherwise want it. Wave 1 it belongs to
`08-S3`, wave 2 to `08-S7`, wave 3 to `08-S9`. Every other stage keeps its reads and writes in its
own module server file — `src/routes/_app/-server/vacay.ts` (`08-S1`),
`src/routes/_app/-server/journal.ts` (`08-S3`), `src/routes/_app/-server/collections.ts` (`08-S4`)
and the existing `src/server/fns/atlas.ts` — and says so under its own **Server** heading.

**The three existing baselines these screens already have are re-recorded by named stages.**
`e2e/__screenshots__/visual.spec.ts/` holds four PNGs each for `/atlas`, `/journey` and `/vacay`
(light and dark × `chromium` and `mobile-safari`), recorded from `APP_ROUTES` in
`e2e/helpers/shoot.ts:490-498`. A stage that changes the resting pixels of one of those screens
re-records that route's four frames with `--update-snapshots`, lists them explicitly under **Owned
paths**, and argues the change — `12-verification-protocol.md` §5 forbids widening the ratio, not
re-recording a frame whose product genuinely changed. §4 freezes `e2e/visual.spec.ts` against
_growth_; new tests go in this plan's own `e2e/product-modules.visual.spec.ts`, created by `08-S1`
and appended to by the rest.

| Route      | Re-recorded by                                       |
| ---------- | ---------------------------------------------------- |
| `/vacay`   | `08-S1` (wave 1), `08-S5` (wave 2), `08-S8` (wave 3) |
| `/atlas`   | `08-S2` (wave 1), `08-S6` (wave 2)                   |
| `/journey` | `08-S3` (wave 1), `08-S7` (wave 2)                   |

`08-S10` does not appear in that table and does not re-record anything: the demo workspace's plan
includes both gated modules, so its locked state is unreachable on the seeded fixture and the
resting frames are unchanged. The stage proves that by running the comparison and getting a pass.

One section that `TEMPLATE.md` does not describe closes this file: **Cross-plan collisions**, the
verbatim output of `scripts/ultrabuild/check-plan-collisions.mjs 08`. It is here because a judgement
re-made by hand every round is eventually made wrong.

## Stage 08-S1 — The leave planner starts writing: allowances, carry-over and the plan's own settings

### Stage id

`08-S1` · Wave 1 · effort **M**. The write half of the year plan: the allowance a traveller is given,
the leftover that follows them into next year, and the five switches that decide how both are
counted.

### Reference rows

- `ADD-02` partial → **done**.

Sourced from `wiki: Vacay-Overview` for the behaviour set — a plan that exists for a traveller
without being created by hand, an allowance edited where it is read rather than on a settings page,
used and remaining derived rather than stored, leftover days carried into the following year, and a
small settings surface for how weekends and public holidays count. Described here in
planned.travel's vocabulary against the eight `vacay_*` tables that already exist.

**Two contradictions with the row, both stated with evidence.**

1. The row lists "week start" among the settings. **It is already a shipped setting, at both levels,
   and this plan adds no second one.** Measured at HEAD, not recalled:
   `organization_settings.week_starts_on` is `integer('week_starts_on').notNull().default(1)`
   (`src/server/db/schema.ts:1817`) behind `organization_settings_week_start_chk`,
   `"week_starts_on" BETWEEN 0 AND 6` (`:1828`); `user_settings.week_starts_on` is the nullable
   override (`:1842`) behind `user_settings_week_start_chk`,
   `("week_starts_on" IS NULL OR "week_starts_on" BETWEEN 0 AND 6)` (`:1857-1858`); and the two are
   merged by one resolver — `weekStartsOn: user?.weekStartsOn ?? organization.weekStartsOn` in
   `getEffectiveSettings` (`src/server/repos/settings.ts:295`, declared on `EffectiveSettings` at
   `:255`, the function at `:271`). Both halves are editable by a traveller today: the workspace
   default at `src/routes/_app/settings/organization.tsx:434-450` over `workspaceDefaultsInput`
   (`src/routes/_app/-server/settings.ts:467`), and the personal override at
   `src/routes/_app/settings/index.tsx:304-326` over `regionalSettingsInput` (`:185`), whose
   "Workspace default" option writes `null` and hands the question back to the workspace.

   So there is no missing column, **no CHECK to add and no migration to file** — and `vacay_plans`
   deliberately does not get a `week_starts_on` of its own. It would be a second authority on a
   question `organization_settings` and `user_settings` already answer, and the two would disagree
   the first time a traveller changed one of them; this is the same argument `08-S3` makes against a
   `journey_trips` join table, applied to a setting instead of a relation.

   The real defect is narrower than the row suggests, and it is **fixed in this plan rather than
   deferred**: at plan drafting, nothing in the leave planner read the resolved value. `loadVacay`
   publishes a literal
   `weekStartsOn: 1` (`src/routes/_app/-server/library.ts:133-134`) that **no consumer reads**.
   At drafting the route had no week-start consumer, and the screen hard-coded a
   Monday-first header instead (`WEEKDAY_INITIALS`, `vacay.tsx:41-49`, rendered at `:337`). The month
   grid belongs to `08-S5`, so the wiring is `08-S5`'s and is specified there: it reads
   existing settings through this module's own server file and rotates the week, and `08-S7`,
   which holds `library.ts` in wave 2, drops the unread literal in the same wave. This stage neither
   reads nor writes the setting — an allowance and a carry-over do not care where a week begins — so
   it is named here as measured fact and nowhere else in `08-S1`.

   **08-S5b implementation (#1112):** the grid now reads existing workspace and traveller settings
   once through `readGrid`, using the same override precedence and Monday for an invalid resolved
   value. It does not call the row-creating `getEffectiveSettings` or write settings. Headings,
   month padding and Home/End rotate together; the shared library loader and its literal stay
   untouched for their assigned owner.

2. The row calls the plan "auto-created per user". It already is: `ensurePlan`
   (`src/server/repos/vacay.ts:142`) creates the row and its membership on first read, behind the
   `vacay_plans_org_owner_unq` index, and `loadVacay` calls it on every load. That behaviour is
   **already done at HEAD** and this stage neither rebuilds nor re-tests it beyond the isolation
   case below.

### Owned paths

- `src/server/repos/vacay.ts` — edit. One new function (`recomputeCarryOver`) and the Zod input it
  needs. No other stage in wave 1 names this file; `08-S5` (wave 2) and `08-S8` (wave 3) edit it
  after this stage closes.
- `src/routes/_app/-server/vacay.ts` — new. The module's server functions, created here and grown by
  `08-S5` and `08-S8`. It exists so that four wave-1 stages do not contend for
  `src/routes/_app/-server/library.ts`, which `08-S3` holds for this wave.
- `src/routes/_app/-server/__tests__/vacay.test.ts` — new.
- `src/routes/_app/vacay.tsx` — edit. The screen composes the new components; its month grid is
  untouched by this stage and belongs to `08-S5`.
- `src/components/vacay/entitlement-panel.tsx` — new.
- `src/components/vacay/plan-settings-dialog.tsx` — new.
- `src/components/vacay/carry-over.ts` — new. The pure year-walk the panel previews and the
  repository writes, so both agree without either importing the other.
- `src/components/vacay/index.ts` — new. The module barrel, created with the directory.
- `src/components/vacay/__tests__/carry-over.test.ts` — new.
- `src/components/vacay/__tests__/entitlement-panel.test.tsx` — new.
- `e2e/product-modules.visual.spec.ts` — new. This plan's spec file, per
  `12-verification-protocol.md` §4. Every later stage appends a `test.describe` to it.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — new. Its baseline directory, which
  `playwright.config.ts`'s `snapshotPathTemplate` keeps disjoint from every existing one.
- `e2e/__screenshots__/visual.spec.ts/vacay-light-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-dark-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-light-mobile-safari.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-dark-mobile-safari.png` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block, under the
  append-only pattern `README.md` documents.

The four `vacay-*` baselines are re-recorded because the entitlement panel gains a control and the
resting screen therefore genuinely changes. `08-S5` (wave 2) and `08-S8` (wave 3) re-record the same
four after their own changes; they are in different waves, so no two of the three ever hold them at
once.

### Data and migration

**No schema change, and none is filed.** Every column this stage writes exists and is deployed:

| Table              | Columns this stage writes                                 | State                            |
| ------------------ | --------------------------------------------------------- | -------------------------------- |
| `vacay_user_years` | `entitlement_days`, `carried_over_days`                   | exists, `NOT NULL` with defaults |
| `vacay_years`      | `year`                                                    | exists, created by `ensureYear`  |
| `vacay_plans`      | the five settings columns listed under **Reference rows** | exist, `NOT NULL` with defaults  |

No migration, no backfill, and **no index is added** — but not for the reason an earlier draft of
this stage gave, which was a composite index that does not exist. Measured on the shipped table
(`src/server/db/schema.ts:1629-1631`), `vacay_user_years` carries exactly three indexes:

| Index                                 | Columns, in order                     | Line   |
| ------------------------------------- | ------------------------------------- | ------ |
| `vacay_user_years_plan_user_year_unq` | `plan_id`, `user_id`, `year` (unique) | `1629` |
| `vacay_user_years_org_plan_idx`       | `organization_id`, `plan_id`          | `1630` |
| `vacay_user_years_org_user_year_idx`  | `organization_id`, `user_id`, `year`  | `1631` |

**There is no index over `(organization_id, plan_id, user_id, year)`, and the unique one carries no
tenant column at all** — do not write either into a query plan from memory. This stage reads and
writes one row at a time by all four columns, and the `(organization_id, plan_id)` prefix of
`vacay_user_years_org_plan_idx` already serves that predicate: one plan-year holds one row per
traveller, so the residual scan is the plan's member count, and a fourth index would cost one extra
row written on every entitlement edit for a saving D1 cannot bill. The unique index is not a tenant
guard either. What it does is make `setEntitlement`'s read-then-write safe under a race:
`setEntitlement` (`src/server/repos/vacay.ts:307-342`) resolves the plan, looks the row up with
`findOne` and then either `requireUpdate`s it or inserts — it is **not** an `onConflict` upsert — so
two concurrent first-time edits for one traveller-year collide on
`vacay_user_years_plan_user_year_unq` rather than leaving two rows behind. This stage never argues
tenant safety from an index; that argument is `tenantFilter()` and the insert stamp, both stated
under **Server**.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/vacay.ts`.** Three existing functions carry this stage:
  `updatePlan` (`:181`), `setEntitlement` (`:307`) and `ensureYear` (`:278`). One is added.

  `recomputeCarryOver(scope, planId, userId)` walks the plan's years ascending from the earliest
  `vacay_years` row, and for each year computes `entitlement + carried − used` from
  `countUsedDays(scope, planId, userId, year)` (`:631`), clamps it at zero, and writes it as the
  **next** year's `carried_over_days` through `setEntitlement`. It writes no row for a year that has
  none, and it stops at the newest year the plan knows about, so it never invents a future. Every
  read and write it makes is an existing `tenantFilter()`-bound call — the function adds no SQL of
  its own, which is why it belongs in this module rather than anywhere else.

  Why a recompute rather than a running total: `carried_over_days` is a stored column —
  `getPlanOverview` reads it directly at `src/server/repos/vacay.ts:607` — and editing an allowance
  three years back would otherwise leave every later year wrong with nothing to notice it. The
  published number is the computed number.

- **Server functions — `src/routes/_app/-server/vacay.ts`**, all `POST`:
  - `setEntitlementFn` — one traveller's allowance and carry-over for one year; returns the
    recomputed balance list for the year on screen so the panel re-reads nothing extra.
  - `updateVacayPlanFn` — the five settings; returns the updated plan row.
  - `recomputeCarryOverFn` — the explicit "recalculate" action on the panel; returns the affected
    years so the screen can say what moved.

  Each resolves its scope the way the module's loader already does, then calls the repository. The
  route re-reads `loadVacay` afterwards, so the screen shows what the database holds rather than what
  the client hoped.

- **Zod v4, `z.strictObject()` with the `error` parameter**, reusing the repository's existing
  `setEntitlementInput` (`:112`) and `updatePlanInput` (`:83`) rather than restating their fields:
  the server function's validator is the repository input plus nothing. `entitlementDays` and
  `carriedOverDays` stay `nonNegativeIntSchema.max(365)`; `year` stays `yearSchema`.

- **Authorisation, decided in the handler and nowhere else.** A server function is reachable without
  the route that renders it, so `beforeLoad` decides nothing here. Two rules:
  1. The plan id from the client is resolved with `vacayPlansRepository.requireById(scope, planId)`
     before anything is written — a well-formed id from another workspace is a `NotFoundError`, which
     is what the repository already does inside `updatePlan` and `setEntitlement`.
  2. `userId` in `setEntitlementInput` is **optional and defaults to the caller**
     (`vacay.ts:313`). Setting somebody else's allowance is a plan-owner action: the handler passes
     an explicit `userId` only when the caller is the plan's `owner_user_id`, and otherwise drops it
     so the repository defaults to `scope.ctx.userId`. A member editing a colleague's allowance is
     rejected in the handler with a message that names the reason, never silently ignored.

- Nothing slow, nothing enqueued, no realtime patch. `recomputeCarryOver` is bounded by the number of
  years a plan has — single digits — and each step is an indexed point read.

### UI (route, components)

- **Route.** `/vacay`, at `src/routes/_app/vacay.tsx`. It already exists, so **no route file is
  added and `pnpm generate-routes` is not run.** SSR stays the default: the screen is server-rendered
  today and its payload is small.
- **The module gets a home.** `src/components/vacay/` is created by this stage, as SPEC §6 requires
  for a module's product components. Nothing moves into it from `src/routes/_app/-ui/` — the leave
  planner keeps its whole composition inside `vacay.tsx` today, so what lands here is extracted from
  the route file rather than moved between directories. **Exactly two files move out of `-ui/` in this
  plan, and neither of them is this stage's**: `src/routes/_app/-ui/world-map.tsx` is `08-S2`'s and
  `src/routes/_app/-ui/create-dialogs.tsx` is `08-S3`'s. The consolidated table of both — one row per
  source file, one owner per row — is kept once, under `08-S3`'s **UI** heading, and no file appears
  in it twice.
- **Components reused, not rebuilt** — from `src/components/ui`: `Dialog`, `Button`, `Input`,
  `Switch`, `Progress`, `Card`, `Skeleton`, `EmptyState`, `Alert`, `Badge`, `Avatar`, `Toast` via
  `sonner`. From `src/components/layout`: `PageHeader`, `AppFrame`, `AppSections`. From the route's
  own `-ui/scaffold.tsx`: `Panel` and `HeaderSkeleton`, imported and not touched — `04-S1`, `09-S8`
  and `10-S3` also read that file and no stage here writes it.
- **New components.**
  - `EntitlementPanel` replaces the read-only panel at `vacay.tsx:133-172`. The oversized display
    numeral, the `Progress` bar and the three `Figure` tiles stay exactly as designed; what is added
    is an **inline edit**: the "Days" and "Carried" tiles become buttons that swap the figure for a
    numeric `Input` in place, committing on blur or `Enter` and cancelling on `Escape`. Every numeral
    keeps `font-variant-numeric: tabular-nums`, so the swap does not reflow the row.
  - `PlanSettingsDialog` — a `Dialog` with four `Switch` rows (block weekends, public holidays,
    company holidays, carry-over) and one numeric `Input` for the default allowance, opened from a
    settings `Button` in the `PageHeader` actions beside the year switcher.
  - `carry-over.ts` — `previewCarryOver(years)`, pure, no React, no server import. The dialog uses it
    to show what turning carry-over off would cost before it is turned off, and the repository's walk
    is asserted against the same function in a unit test, so the number the traveller was shown and
    the number written cannot drift.
- **States, named rather than promised.**
  - _Entitlement panel, empty:_ a traveller with no `vacay_user_years` row sees the copy that is
    already there ("Set an allowance for this year and your remaining days appear here") now with a
    primary "Set an allowance" `Button` under it, on `--color-surface-2`.
  - _Skeleton:_ `VacayPending` (`vacay.tsx:439-478`) already ships the shape; this stage extends it
    with the panel's new control row so the skeleton and the settled layout are the same height and
    nothing shifts after paint.
  - _Error:_ a failed write keeps the field open with its value, shows an `Alert` in `danger` tone
    inside the panel naming what failed, and offers "Try again". The loader's own failure keeps the
    existing `ErrorPanel`. A rejected authorisation ("only the plan owner may set someone else's
    allowance") renders as the same `Alert`, not as a thrown boundary.
  - _Loading:_ the commit button and the dialog's save button take `loading`, the row goes
    `aria-busy`, and the panel's figures keep their last value rather than blanking.
- **Motion.** The tile-to-input swap is a 150ms opacity and 2px translate on `--ease-out-quint`; the
  dialog uses the `Dialog` primitive's existing enter and exit. `prefers-reduced-motion: reduce`
  collapses both to opacity only. No layout-affecting property is animated.
- **Tokens.** None missing. Colour, spacing, radius and shadow all come from
  `src/styles/tokens.css` through the primitives; the one non-token colour on this screen is a
  traveller's own swatch, which is a stored per-user value and already handled by `inkOn()` in
  `src/routes/_app/-lib/tone.ts`.

### Quota

**The metric is `members`, and the assertion is the one that already exists.** A leave plan is one
row per traveller per workspace — `vacay_plans_org_owner_unq` — so the population of `vacay_plans` is
the population of `member`, which `assertQuota(scope, 'members', …)` already enforces at
`src/server/repos/members.ts:160` and `:276`. Minting a second metric would charge a tenant twice for
one seat, and the published seat number would stop being the enforced number.

The rows this stage writes are `vacay_user_years` — at most one per traveller per year — and updates
to `vacay_plans`. Neither is metered, and nothing is added to `resolveLimits()`
(`src/server/billing/limits.ts`), to `PLAN_QUOTAS` (`src/server/db/types.ts`) or to
`src/server/billing/__tests__/limits.test.ts`.

Entitlement to the module is a different question from quota and is not decided here: the leave
planner has **no key in `MODULE_KEYS`** (`src/lib/plans.ts:126-139`, twelve keys, none of them this
module), so there is nothing to gate. `08-S10` states that measurement once for the whole plan and
does not invent a key to gate it with.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope, against B's plan id: `updatePlan`, `setEntitlement`, `ensureYear` and
`recomputeCarryOver` each reject with `NotFoundError`, and B's `vacay_plans`, `vacay_years` and
`vacay_user_years` rows are byte-identical afterwards. Then the reverse read: `getPlanOverview` in
B's scope for A's plan id is a `NotFoundError`, and `listUserYears(scopeB, aPlanId, year)` returns an
empty array — the distinction matters, because `requireById` throws and `findMany` returns `[]`, and
a test that asserts the wrong one of those passes for the wrong reason.

One case is the point of the block: `setEntitlement` with an **explicit `userId` belonging to B**,
called in A's scope. It must write A's row for that user id or nothing at all — never B's — because
the input accepts a caller-supplied user id (`vacay.ts:112-119`) and the repository's tenant filter
is the only thing standing between that and a cross-workspace write. Assert B's
`vacay_user_years` count is unchanged.

Functions covered: `ensurePlan`, `updatePlan`, `ensureYear`, `setEntitlement`, `recomputeCarryOver`,
`getPlanOverview`, `listUserYears`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/components/vacay/__tests__/carry-over.test.ts` — `previewCarryOver` clamps a negative
    leftover to zero rather than carrying a debt; a gap year with no row breaks the chain instead of
    carrying through it; turning carry-over off yields zero for every year; the preview equals what
    `recomputeCarryOver` writes for the same input, which is the invariant that stops the number on
    screen and the number in the database from drifting.
  - `src/routes/_app/-server/__tests__/vacay.test.ts` — a member setting a colleague's allowance is
    rejected while the plan owner's identical call succeeds; a foreign plan id is a `NotFoundError`;
    `updateVacayPlanFn` with carry-over turned off returns balances whose `carriedOverDays` is zero,
    matching the zeroing branch at `getPlanOverview` (`src/server/repos/vacay.ts:607`).
  - `src/components/vacay/__tests__/entitlement-panel.test.tsx` — the tile commits on `Enter` and
    reverts on `Escape`; the input is reachable from the tile by keyboard alone; a rejected write
    leaves the typed value in the field and renders the alert.
- Playwright, with the port resolved rather than assumed:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g vacay --update-snapshots
  ```

  The spec file this stage creates declares `/vacay?year=2026` in its own route table — the same
  `PINNED_YEAR` pin `e2e/helpers/shoot.ts:462` gives the gate, because the route defaults its year to
  the server's clock — and calls `auditServerClock(page, <that table>)` once in a `describe` of its
  own, per `12-verification-protocol.md` §4. `/vacay` declares no `relativeTime` and prints no
  clock-derived string of a shape outside `RELATIVE_TIME_SITES`, so `e2e/helpers/shoot.ts` is not
  claimed by this stage and no entry is added to it. That file is held by `01-S5` and `10-S2`, and
  this stage does not contend for it.

- Frames, per `12-verification-protocol.md` §3 — light and dark at 360, 1280 and 2560:

  ```sh
  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/vacay?year=2026" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S1" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth
  ```

  Plus a declared-state set, because the outcome of this stage is a state the screen is not in when
  it loads: `--state editing --click '[data-part="entitlement-tile"][data-field="entitlement"]'`
  for the inline editor, and `--state settings --click '[data-part="vacay-settings"]'` for the
  dialog. Both selectors are published by the components this stage writes as stable `data-part`
  attributes rather than class names, and both are verified to resolve by the spec run above passing
  — a `page.locator(sel).count()` of 1 is the check, and reading the JSX is not.

- Console must be silent: the spec attaches `watchConsole(page, route)` before navigating and asserts
  the report's `fatal` list is empty at the end of every test, including the frame-only ones.
- Layout shift after the settle mark is asserted at `0` on `chromium` and reported as a stated skip
  on `mobile-safari`, where `layout-shift` is not a supported entry type.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds;
`pnpm lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; no TODO, no
placeholder copy, no `console.log` and no commented-out code is left behind; and no file outside
**Owned paths** is touched.

The `docs/SPEC.md` §2 visual clauses, ticked against the entitlement panel and the settings dialog:

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every interactive element, including the
      inline tile while its write is in flight.
- [ ] Designed empty state on `--color-surface-2` for a traveller with no allowance, a skeleton whose
      shape matches the settled panel, and an error state that keeps the typed value and offers a
      retry.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared rather than reused.
- [ ] 360px through 2560px, where the small layout is designed: at 360px the sidebar stacks above the
      grid and the settings dialog becomes a full-height sheet.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names on every tile and switch,
      WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every figure.

### Blockers

- **None.** No package outside the SPEC §3 pinned set, no binding absent from `wrangler.jsonc`, no
  third-party service, no migration, and no dependency on an unlanded row in another plan.
- Week start is explicitly **not** a blocker and is **not** deferred. The column exists on both
  settings tables with the `0–6` CHECK, the resolver merges them and both editing surfaces ship —
  every citation is under **Reference rows** above. What is missing is a read, and `08-S5` performs
  it in wave 2. An earlier draft of this stage recorded a deferred migration here; it was wrong, and
  it is recorded as wrong so the same claim is not re-derived.

## Stage 08-S2 — Below country level, and beside it: regions on the record and a bucket list that is not only countries

### Stage id

`08-S2` · Wave 1 · effort **M**. The two halves of the world-map tracker that never got a write path:
the sub-national record, and the aspirations that are not whole countries.

### Reference rows

- `ADD-05` partial → **done**.

Sourced from `wiki: Atlas-Overview` for the behaviour set — a visited record that can be finer than a
country, a country that counts as visited once anything inside it does, an aspiration list that holds
places and regions as well as countries, and a guard that stops a derived record being deleted as if
it had been entered by hand. Described here against `visited_regions` and `bucket_list_items`, which
already exist.

**What is already done and is not rebuilt.** The country half of this row ships and writes:
`markCountryVisitedFn` (`src/server/fns/atlas.ts:441`), `unmarkCountryVisitedFn` (`:485`),
`addCountryToBucketListFn` (`:547`) and `removeCountryFromBucketListFn` (`:585`), rendered through
`src/components/atlas/country-actions.tsx` and `country-overlay.tsx`. This stage adds to that surface
and replaces none of it.

**A contradiction with the row, stated with evidence.** The row describes the sub-national layer as a
map layer. **We have no sub-national geometry and this stage does not invent one.** Measured:
`public/atlas/` contains exactly one dataset, `country-outlines-50m.v1.txt`, which is country
outlines; `src/lib/map/style.ts:624` and `:730` draw region _boundaries_ and _labels_ from the
basemap's own layers, which carry no stable code we could key a fill or a click on. A paintable,
clickable region layer needs a second tileset in the `TILES` R2 bucket, which is an infrastructure
and cost decision rather than a stage. So the region record here is **list-shaped, not map-shaped**:
regions are added and removed from the country's own panel, the map keeps painting the parent
country, and the disposition is under **Blockers**. This is a smaller feature than the row describes
and it is honest about being one.

### Owned paths

- `src/server/repos/atlas.ts` — edit. The bucket-list input widens beyond countries; no new SQL.
- `src/server/fns/atlas.ts` — edit. Four new server functions beside the four that exist.
  **`00-S4` (`00-foundations.md`, wave 0) also edits this file**, to make the two country write
  functions enqueue a statistics recompute. Wave 0 closes before wave 1 opens, so this stage edits it
  afterwards and inherits that enqueue rather than repeating it. No other stage in wave 1 names it.
- `src/server/fns/__tests__/atlas.test.ts` — edit. The new functions' cases join the existing
  coverage of the four country ones; the file already stands up the `AsyncLocalStorage` context they
  need, and a second harness for the same module would be a duplicate rather than an isolation.
  `00-S4` also edits this file, in wave 0.
- `src/components/atlas/world-map.tsx` — new. Moved from `src/routes/_app/-ui/world-map.tsx`.
- `src/routes/_app/-ui/world-map.tsx` — delete. The other half of the same move.
- `src/routes/_app/-ui/atlas-screen.tsx` — edit. One import line
  (`atlas-screen.tsx:35`) follows the move, and the panel gains the regions section's props. No other
  stage in any plan names this file.
- `src/components/atlas/region-record.tsx` — new. The regions section of the country panel.
- `src/components/atlas/bucket-list-dialog.tsx` — new. Adding an aspiration that is not a country.
- `src/components/atlas/country-actions.tsx` — edit. The new sections hang off the existing actions
  surface rather than a second one.
- `src/components/atlas/index.ts` — edit. The barrel gains three exports.
- `src/components/atlas/__tests__/region-record.test.tsx` — new.
- `src/components/atlas/__tests__/bucket-list-dialog.test.tsx` — new.
- `src/components/atlas/__tests__/country-actions.test.tsx` — edit. The existing suite grows the
  cases for the new sections.
- `e2e/product-modules.visual.spec.ts` — append. A `test.describe` named for this stage.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `e2e/__screenshots__/visual.spec.ts/atlas-light-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/atlas-dark-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/atlas-light-mobile-safari.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/atlas-dark-mobile-safari.png` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.

The four `atlas-*` baselines are re-recorded because the country panel gains a section, which changes
the resting screen. `08-S6` (wave 2) re-records the same four after the statistics panel changes;
different waves, so the two never hold them at once.

### Data and migration

**No schema change, and none is filed.**

- `visited_regions` exists with `country_code`, `region_code`, `region_name`, `first_visited_on` and
  a unique `(organization_id, user_id, region_code)` index, plus
  `visited_regions_org_country_idx` — the exact shape the panel queries by.
- `bucket_list_items` exists with `kind`, `name`, `country_code`, `target_year` and an achieved
  marker. It has **no unique index**, and `src/server/fns/atlas.ts` already compensates for that in
  application code when adding a country. This stage keeps that compensation and extends it to the
  other kinds rather than adding an index: a unique index over a free-text `name` would reject a
  second "Old town" in a different country, and drizzle-kit rebuilds the whole table for an index
  change on SQLite.

No migration, no backfill.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/atlas.ts`.** Four existing functions carry the region half:
  `listVisitedRegions` (`:210`), `markRegionVisited` (`:221`), `unmarkRegionVisited` (`:244`) and
  `countVisitedRegions` (`:674`). Four more carry the bucket half: `listBucketList` (`:255`),
  `createBucketListItem` (`:269`), `achieveBucketListItem` (`:293`) and `deleteBucketListItem`
  (`:314`). **No function is added and no SQL is written**; what changes is that
  `createBucketListItemInput` (`:91`) stops being reachable only through a country-shaped wrapper.
- **Server functions — `src/server/fns/atlas.ts`**, all `POST` except the first:
  - `loadCountryRegionsFn` (`GET`) — the regions recorded for one country, plus the region names the
    workspace has already used, so the input can suggest rather than only accept.
  - `markRegionVisitedFn` — records a region and, when the parent country has no `visited_countries`
    row, records that too through `markCountryVisited` in the same call. That cascade is the row's
    behaviour and it is decided on the server, because a client that forgot it would leave the map
    disagreeing with the panel above it.
  - `unmarkRegionVisitedFn` — removes a region. It does **not** unmark the parent country: a country
    with a trip behind it stays visited, and removing the last region is not evidence that the
    traveller was never there. The panel says so in place rather than leaving the traveller to
    discover it.
  - `addBucketListItemFn` / `removeBucketListItemFn` — an aspiration of any `kind` the schema
    allows, with an optional country and target year.
- **Zod v4**, `z.strictObject()` with the `error` parameter, reusing `markRegionVisitedInput`
  (`atlas.ts:82`) and `createBucketListItemInput` (`:91`) as the validators rather than restating
  their fields. `regionCode` is trimmed and upper-cased before it reaches the unique index, so
  `us-ca` and `US-CA` are one region and not two.
- **Authorisation, decided in the handler.** `visited_regions` and `bucket_list_items` are
  **per-traveller within a workspace**: both carry `user_id` and both indexes lead
  `(organization_id, user_id, …)`. The handler therefore passes `scope.ctx.userId` and never a user
  id from the client — there is no shape of this feature in which one member edits another's visited
  list, so the input does not accept the field at all. That is stricter than validation and is the
  point: a field that does not exist cannot be forged.
- **The recompute this stage must trigger, and the one it must not.** `markRegionVisitedFn`'s
  cascade calls `markCountryVisited`, which is an input to `travel_stats`, so the same
  deterministic `travel-stats` envelope `00-S4` defined is enqueued from the cascade — one task, not
  two, because the envelope id collapses. A region write that does **not** cascade enqueues nothing:
  `regionCount` is recomputed from `visited_regions` by the same handler, and `00-S4` measured that
  it takes no year predicate, so a region write moves exactly one figure on one row and the next
  country write will pick it up. The bucket-list functions enqueue nothing, for the reason `00-S4`
  states: `bucket_list_items` feeds no column of `travel_stats`.
- Nothing slow, nothing inline that should not be. No realtime patch: the atlas is per-traveller and
  has no room.

### UI (route, components)

- **Route.** `/atlas`, at `src/routes/_app/atlas.tsx`, unchanged. **No route file is added and
  `pnpm generate-routes` is not run.**
- **The move this stage owns.** `src/routes/_app/-ui/world-map.tsx` becomes
  `src/components/atlas/world-map.tsx`. It exports `WorldCoverageMap`, a static SVG world with no
  data fetching and no route knowledge — a module component by SPEC §6's definition, sitting in a
  route-local directory for no reason. `src/routes/_app/-ui/atlas-screen.tsx` stays where it is and
  is deliberately not moved: it is the composition of one route, which is what `-ui/` is for. The
  consolidated table of every move in this plan is in `08-S3`, and no file appears in it twice.
- **Components reused, not rebuilt** — `Dialog`, `Combobox`, `Input`, `Button`, `IconButton`,
  `Badge`, `Chip`, `EmptyState`, `Skeleton`, `Alert`, `Select` from `src/components/ui`; and from
  this module's own directory `CountryActions`, `CountryRecord` and `AtlasPanel`, which are extended
  rather than duplicated.
- **New components.**
  - `RegionRecord` — a section inside the open country panel: a list of recorded regions as
    removable `Chip`s, and a `Combobox` that accepts a typed region name and offers the names the
    workspace has recorded before. It states the cascade in one line of copy before it happens
    ("Marking a region marks the country too") rather than surprising the traveller with a repainted
    map.
  - `BucketListDialog` — a `Dialog` with a name `Input`, a kind `Select` over the schema's own kinds,
    an optional country `Combobox` reusing the existing country search data, and an optional target
    year. Opened from the bucket tab's header and from the country panel, where the country is
    pre-filled.
- **States.**
  - _Regions, empty:_ on `--color-surface-2`, "No regions recorded here yet" with one line saying
    what a region is for and the combobox focused behind it — the empty state is the input, not a
    dead end.
  - _Bucket list, empty:_ the existing bucket tab keeps its empty state and gains the "Add
    something" primary action, so the tab that lists aspirations can now make one.
  - _Skeleton:_ the regions section renders three `Skeleton` chips while `loadCountryRegionsFn`
    resolves, at the height the settled chips occupy.
  - _Error:_ a failed write leaves the chip in place with a `danger`-tone `Alert` under the section
    naming what failed and a "Try again" button; a failed section load shows the same alert with a
    reload action, and never blanks the panel around it.
  - _Loading:_ the add button and each chip's remove control take `loading` and `disabled`; an
    optimistic chip renders at 60% opacity until the server answers, and rolls back on failure.
- **Motion.** A chip enters on a 180ms opacity and scale from 0.96 on `--ease-out-quint` and leaves
  on 150ms; list entrances stagger 20ms and cap at eight. `prefers-reduced-motion: reduce` collapses
  to opacity. The map is never animated by this stage.
- **Tokens.** None missing. The panel already sits on `--color-surface` above the canvas with
  `--shadow-glass`, and the region chips use the existing `Chip` tones.

### Quota

**Creates no metered row, and no metric is minted.** Two tables grow:

- `visited_regions` is bounded by the world times the traveller — one row per
  `(user, region_code)` behind a unique index, so it cannot grow with usage.
- `bucket_list_items` is not bounded by anything, and this is stated rather than hidden. It is
  unmetered at HEAD — measured: `src/server/repos/atlas.ts` contains no `assertQuota` call — and this
  stage keeps it that way rather than minting a metric the catalogue does not sell. What it does add
  is a repository-level ceiling that is not a plan quota: `createBucketListItem` refuses past a
  fixed per-traveller maximum with a named error, which is a noisy-neighbour guard rather than
  something a plan can buy more of. The read side is already bounded by
  `ATLAS_BUCKET_LIST_LIMIT = 40` (`src/routes/_app/-server/library.ts:300`), which caps the SSR
  payload and is a different control for a different reason; both are stated in the code so neither
  is mistaken for the other.

Nothing is added to `resolveLimits()`, to `PLAN_QUOTAS` or to
`src/server/billing/__tests__/limits.test.ts`.

Entitlement is decided elsewhere: `atlas` **is** a key in `MODULE_KEYS` (`src/lib/plans.ts:126-139`),
so this module is gated — by `08-S10` in wave 3, through `assertModule`, and not by a second check
invented here. Until that stage lands the module behaves exactly as it does today.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope: `markRegionVisited` for a region whose parent country only B has visited writes A's own
row and leaves B's untouched, because the unique index is
`(organization_id, user_id, region_code)` and A's write cannot collide with B's;
`unmarkRegionVisited(scopeA, bRegionId)` is a `NotFoundError` and B's row survives;
`deleteBucketListItem(scopeA, bItemId)` and `achieveBucketListItem(scopeA, bItemId)` are
`NotFoundError` and B's item is unchanged. Then the reverse: `listVisitedRegions(scopeB, aUserId)`
returns `[]` — `findMany`, so an empty array and not a rejection — while
`visitedRegionsRepository.requireById(scopeB, aRowId)` is where the `NotFoundError` actually comes
from (`src/server/repos/base.ts:298`), and both are asserted so neither is mistaken for the other.

One case is the point of the block: the **cascade** must not cross a workspace. Called in A's scope
for a country B has visited, `markRegionVisitedFn`'s cascade writes A's `visited_countries` row and
B's count of visited countries is unchanged.

Functions covered: `listVisitedRegions`, `markRegionVisited`, `unmarkRegionVisited`,
`countVisitedRegions`, `listBucketList`, `createBucketListItem`, `achieveBucketListItem`,
`deleteBucketListItem`, and `markCountryVisited` through the cascade.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/server/fns/__tests__/atlas.test.ts` — the cascade records the country exactly once when the
    country was unrecorded and not at all when it was already recorded; unmarking a region leaves the
    country recorded; `regionCode` is normalised before the unique index sees it, so two casings are
    one row; a bucket item of each schema kind round-trips; the per-traveller ceiling rejects with
    its named error and writes nothing; a cascade enqueues one `travel-stats` envelope and a
    non-cascading region write enqueues none.
  - `src/components/atlas/__tests__/region-record.test.tsx` — the combobox commits on `Enter`, the
    optimistic chip rolls back on rejection, the remove control is reachable by keyboard and carries
    an accessible name that includes the region.
  - `src/components/atlas/__tests__/bucket-list-dialog.test.tsx` — a name is required, a country is
    not, the kind defaults to the schema's default, and the dialog returns focus to its trigger on
    close.
  - `src/components/atlas/__tests__/country-actions.test.tsx` — the existing cases still hold with
    the two new sections mounted, and the panel's tab order runs actions → regions → bucket.
- Playwright:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g atlas --update-snapshots
  ```

  The spec's route table declares `/atlas` with `map: true`, which is not optional: `settleMap()`
  fails a route that renders a `[data-map-ready]` marker without declaring one and a route that
  declares one and renders none, so the flag and the canvas travel together. The declaration also
  moves the route to the viewport-after-resize capture path.

- Frames, per `12-verification-protocol.md` §3, plus the declared state that is the point of the
  stage — the country panel open with its regions section, which the resting screen never shows:

  ```sh
  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/atlas" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S2" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
    --state regions --click '[data-part="country-panel-regions"]'
  ```

  The selector is a `data-part` attribute this stage publishes, and it is verified to resolve by the
  spec run above reaching the same state — a `page.locator(sel).count()` of 1, not a reading of the
  JSX. The resting set is still taken, because a panel section is judged against the panel it
  changes.

- Console must be silent: `watchConsole` asserted empty of `fatal` in every test. The one tolerated entry on
  this route is the headless software rasteriser's GL advisory, which
  `TOLERATED_CONSOLE_WARNINGS` already scopes to routes declaring a live map; this stage adds nothing
  to that list.
- Layout shift after the settle mark asserted at `0` on `chromium`, stated as a skip on
  `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the regions section and the bucket dialog:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every control, including a chip whose
      removal is in flight.
- [ ] Designed empty state on `--color-surface-2` for a country with no regions, skeleton chips at
      the settled height, and an error state with a retry that does not blank the panel.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, stagger capped at eight,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity over the map canvas, with dark shadows re-declared — the panel floats on
      a surface whose contrast is measured against both basemap ramps, not assumed.
- [ ] 360px through 2560px: at 360px the country panel is a full-height sheet and the regions section
      scrolls inside it rather than pushing the actions off screen.
- [ ] Keyboard navigable end to end, accessible names on every chip and control, WCAG 2.2 AA in both
      themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every count.

### Blockers

- **No sub-national geometry, so no clickable region layer.** Measured above: `public/atlas/` carries
  country outlines only, and the basemap's region boundaries and labels carry no stable code.
  Disposition: **defer**. A region tileset in the `TILES` R2 bucket is an infrastructure and cost
  decision of the same shape as the three binding decisions in
  `docs/plans/11-boundaries-and-blockers.md`, and it is recorded there rather than assumed here. The
  list-shaped record this stage ships is complete on its own terms and does not become wrong if the
  layer arrives later — the rows it writes are exactly the rows a layer would paint from.
- Nothing else. No package outside the pinned set, no new binding, no third-party service.

## Stage 08-S3 — The journal stops being a read-only object, and the module gets a home

### Stage id

`08-S3` · Wave 1 · effort **M**. Renaming, re-covering, retiring and deleting a journal; the trips it
draws on; and the place anchors those trips contribute. Also the stage that retires
`src/routes/_app/-ui/create-dialogs.tsx` into two module directories, and that carries this plan's
consolidated table of the **two** files moving out of `-ui/` — the other, `world-map.tsx`, moves in
`08-S2`, which is the only stage that names it.

### Reference rows

- `ADD-07` partial → **done**.

Sourced from `wiki: Journey-Overview` for the behaviour set — a journal that lists its entries,
photographs and places as counts, is created with a title and a subtitle, and draws on one or more
trips whose places arrive as anchors the traveller can then write against. Described here against
`journeys` and `journey_entries`, which already exist.

**What is already done and is not rebuilt.** The list, the counts, the cover art and creation all
ship: `loadJourneys` (`src/routes/_app/-server/library.ts:493`), `loadJournalOverview` (`:574`),
`loadJourneyStory` (`:655`), `createJourneyFn` (`:884`) and `loadJourneyTripOptions` (`:942`),
rendered through `src/routes/_app/journey/index.tsx` and `$journeyId.tsx`.

**A contradiction with the row, stated with evidence and settled rather than deferred.** The row
reads `journeys.trip_id` as a defect — "a single nullable FK rather than many-to-many". Measured:
`src/server/db/schema.ts` gives `journey_entries` both `source_trip_id` and `source_place_id`, each a
nullable FK with its own index. So the journal↔trip relation **already exists**, one level down,
where it also records _which_ trip each piece of the story came from. Adding a `journey_trips` join
table would create a second authority on the same question, and the two would disagree the first time
an entry was moved. This stage therefore derives a journal's trips as the distinct set of
`source_trip_id` across its entries, unioned with `journeys.trip_id` as the seed, and links a trip by
importing its places as anchors rather than by writing a membership row. That is the row's behaviour
— "linking one or more trips whose places import as location anchors" — reached without a migration,
and this plan opens none.

### Owned paths

- `src/server/repos/journey.ts` — edit. One new function (`importTripPlaceAnchors`) and one new
  read (`listJourneyTripIds`). No other wave-1 stage names this file; `08-S7` (wave 2) edits it
  after this stage closes.
- `src/routes/_app/-server/journal.ts` — new. The module's write functions, created here and grown
  by `08-S7` and `08-S10`.
- `src/routes/_app/-server/__tests__/journal.test.ts` — new.
- `src/routes/_app/-server/library.ts` — edit. **This stage holds the four-module server file for the
  whole of wave 1**, per the allocation in the area brief; `08-S7` holds it in wave 2 and `08-S9` in
  wave 3. Two loaders change: `loadJourneys` carries the owner id so a card can show what the reader
  may do, and `loadJourneyStory` carries the derived trip set.
- `src/routes/_app/journey/index.tsx` — edit.
- `src/routes/_app/journey/$journeyId.tsx` — edit.
- `src/routes/_app/collections/index.tsx` — edit. One import line follows the dialog move below; the
  collections stage of this wave, `08-S4`, deliberately does not name this file.
- `src/components/journey/new-journey-dialog.tsx` — new (moved).
- `src/components/journey/journey-actions.tsx` — new.
- `src/components/journey/trip-link-dialog.tsx` — new.
- `src/components/journey/index.ts` — new. The module barrel, created with the directory.
- `src/components/collections/new-collection-dialog.tsx` — new (moved).
- `src/components/collections/index.ts` — new. Created with the directory, exporting the moved
  dialog. `08-S4` adds its components in this same wave and imports them by path rather than editing
  this barrel, so two wave-1 stages never hold one file; `08-S9` folds them into it in wave 3.
- `src/routes/_app/-ui/create-dialogs.tsx` — delete.
- `src/components/journey/__tests__/journey-actions.test.tsx` — new.
- `src/components/journey/__tests__/trip-link-dialog.test.tsx` — new.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `e2e/__screenshots__/visual.spec.ts/journey-light-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/journey-dark-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/journey-light-mobile-safari.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/journey-dark-mobile-safari.png` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.

### Data and migration

**No schema change, and none is filed.** `journeys` already carries `title`, `slug`, `subtitle`,
`description`, `cover_image_url`, `cover_gradient`, `status` (`draft`/`published`/`archived` behind
`journeys_status_chk`), `visibility`, `public_token`, `started_on` and `ended_on`.
`journey_entries` already carries `type` with `place` among its allowed values
(`schema.ts:220-227`), `source_trip_id`, `source_place_id`, `location_name`, a lat/lng pair with its
CHECK, and `sort_order` as a `real` for fractional reordering. Dates stay `YYYY-MM-DD` text; ids come
from `newId()`. No migration, no backfill, no index.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/journey.ts`.** Three existing functions carry the lifecycle:
  `updateJourney` (`:516`), `publishJourney` (`:534`) / `unpublishJourney` (`:546`) and
  `deleteJourney` (`:556`). Two are added, both built on `tenantFilter()` and the module's existing
  repository objects:
  - `listJourneyTripIds(scope, journeyId)` — resolves the journal through
    `journeysRepository.requireById(scope, journeyId)` (`src/server/repos/journey.ts:63`), then reads
    the distinct `source_trip_id` across the journal's entries, unioned with `journeys.trip_id`. One
    indexed read on `journey_entries_org_journey_idx`. It resolves the parent first **so that a
    foreign journal id throws rather than returning `[]`** — an empty array and a refusal are
    different answers and the tenant test asserts the refusal.
  - `importTripPlaceAnchors(scope, journeyId, tripId)` — resolves both ids inside the scope, reads
    the trip's places, and inserts one `type: 'place'` entry per place that the journal does not
    already anchor, carrying `source_trip_id`, `source_place_id`, `location_name`, the lat/lng pair
    and an `entry_date` taken from the place's day where it has one. It is **idempotent by
    `source_place_id`**: importing the same trip twice adds nothing, which is what makes the action
    safe to offer as a button rather than as a warning. Writes go through `runBatch`
    (`src/server/repos/batch.ts`) so a partial import cannot leave half a trip anchored.
- **Tenant scoping, stated rather than implied.** Both new functions are built on `tenantFilter()`
  from `src/server/repos/base.ts`, which always begins
  `eq(table.organizationId, scope.ctx.organizationId)` and lets a caller only `AND` further
  predicates onto it. `journeys` and `journey_entries` each carry `organization_id NOT NULL`, and each
  carries at least one composite index led by it — `journeys_org_owner_idx`
  (`src/server/db/schema.ts:1356`) and `journey_entries_org_journey_idx` (`:1392`). **Not every
  composite index on those tables leads with the tenant column**: `journey_entries_journey_date_idx`
  (`:1393`) and `journey_entries_journey_sort_idx` (`:1394`) both lead with `journey_id`. An index is
  therefore a performance fact in this plan and never a safety argument. The safety argument is the
  code path, and it is sufficient on its own: every read is narrowed by `tenantFilter()`, and
  `createTenantRepository` stamps `organization_id` on insert from `scope.ctx` and omits it from the
  caller's payload type (`src/server/repos/base.ts:196-200`, whose own comment reads "The tenant
  column is stamped here and cannot be overridden by the caller's payload"). An anchor imported into
  a journal is written under the caller's workspace and no other, by construction rather than by
  discipline.
- **Server functions — `src/routes/_app/-server/journal.ts`**, all `POST`:
  `updateJourneyFn`, `setJourneyStatusFn` (publish, unpublish, archive), `deleteJourneyFn` and
  `importTripPlacesFn`. Each returns the shape its screen re-reads, and the route invalidates
  afterwards.
- **Zod v4**, `z.strictObject()` with the `error` parameter, reusing `updateJourneyInput`
  (`journey.ts:86`) as the update validator. `importTripPlacesFn` takes
  `{ journeyId: idSchema, tripId: idSchema }` and nothing else.
- **Authorisation, decided in the handler.** `journeys.owner_user_id` decides destructive actions:
  deleting a journal or changing its status is the owner's, and any member of the workspace may
  import anchors into a journal they can see. Both ids are resolved through
  `journeysRepository.requireById(scope, …)` (`src/server/repos/journey.ts:63`) and
  `tripsRepository.requireById(scope, …)` (`src/server/repos/trips.ts:45`) first, so a well-formed id
  from another workspace is a `NotFoundError` before any rule is applied — a well-formed id is not an
  authorised id. **Not `getTrip`**: `getTrip` (`src/server/repos/trips.ts:223`) delegates to
  `tripsRepository.findById` and returns `null` for a foreign id, so it cannot be the guard — the
  throwing sibling on the same repository object is, and every stage of this plan that resolves a
  trip names `requireById` for that reason. Deleting is confirmed on the client and irreversible on
  the server; the copy says so, and `journey_entries` and `journey_photos` cascade with the row.
- Nothing enqueued and nothing slow: an import is bounded by one trip's places and runs in one batch.
  No realtime patch — a journal has no room and no presence.

### UI (route, components)

- **Routes.** `/journey` and `/journey/$journeyId` already exist. **No route file is added and
  `pnpm generate-routes` is not run.** SSR stays the default.
- **The two moves this plan makes, and who owns each.** This is the consolidated table the plan
  keeps in one place; no file appears in it twice, and no other stage moves a file out of
  `src/routes/_app/-ui/`.

  | From                                     | To                                                                                                             | Owner   |
  | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------- |
  | `src/routes/_app/-ui/world-map.tsx`      | `src/components/atlas/world-map.tsx`                                                                           | `08-S2` |
  | `src/routes/_app/-ui/create-dialogs.tsx` | `src/components/journey/new-journey-dialog.tsx` **and** `src/components/collections/new-collection-dialog.tsx` | `08-S3` |

  The second row is why one stage owns it: the file holds one dialog for each of two modules, and a
  file split across two concurrent stages is exactly what the wave rule exists to prevent. `08-S3`
  therefore performs the whole retirement — both new components, the deletion, and the two import
  sites, `src/routes/_app/journey/index.tsx:37` and `src/routes/_app/collections/index.tsx:16`, which
  are the only two importers at HEAD (`grep -rn create-dialogs src/`) and are both named in this
  stage's **Owned paths**. `08-S4` names none of those paths.

  **`src/routes/_app/-ui/cover-art.tsx` is deliberately not moved, and this plan does not delete
  it.** An earlier draft of this stage listed it as moved to `src/components/journey/cover-art.tsx`
  and deleted at source while also declaring `trip-card.tsx` untouched. That could not have built:
  `src/routes/_app/-ui/trip-card.tsx:13` imports `{ CoverArt, seedFrom }` from `./cover-art`, so the
  same stage's `pnpm typecheck` and `pnpm build` would both have failed on a file the stage did not
  own. Repairing it inside this stage would mean editing `trip-card.tsx`, which `01-S1` claims in its
  **Owned paths** in **wave 1** — the same wave as this stage — and which `01-S7` claims again in
  wave 5 (`docs/plans/01-trips-core.md`; cited by stage rather than by line, because that file is
  still being written and a line number into a live sibling is a citation that rots). The wave-1
  overlap is precisely the same-wave exclusive collision the wave rule exists to prevent, and
  `node scripts/ultrabuild/check-plan-collisions.mjs 08` would report it.

  The reason it is not simply rescheduled into a later wave is that it is not a journal component at
  all. It has two importers in two different modules — `trip-card.tsx:13` and
  `src/routes/_app/journey/index.tsx:36` — so it is neither route-local nor module-owned, and moving
  it under `src/components/journey/` would make the trips module import from the journal's directory,
  which is worse than where it sits now. It stays at `src/routes/_app/-ui/cover-art.tsx`, both
  importers keep their import lines byte-for-byte, and promoting it to a shared home is filed as a
  cross-plan extension rather than smuggled into a stage that owns one of its two callers. Nothing in
  this plan depends on the promotion having happened.

  Three directories are created here or in `08-S1`, which is what SPEC §6 asks for and what the
  recon recorded as missing: `src/components/vacay/` (`08-S1`), `src/components/journey/` and
  `src/components/collections/` (`08-S3`). `src/components/atlas/` already exists.
  `src/routes/_app/-ui/atlas-screen.tsx` and `scaffold.tsx` stay where they are on a stated rule: a
  file that composes one route is route-local, a file that renders a module concept is a module
  component, and a file two modules import is neither — `cover-art.tsx` is the one instance of the
  third case and is treated as above. `trip-card.tsx`, `new-trip-dialog.tsx`, `trip-header.tsx`,
  `trip-map.tsx` and `settings-nav.tsx` belong to
  other plans and are not touched by any stage of this plan.

- **Components reused, not rebuilt** — `Dialog`, `DropdownMenu`, `Button`, `IconButton`, `Input`,
  `Textarea`, `Select`, `Badge`, `Card`, `EmptyState`, `Skeleton`, `Alert`, `Toast`. `CoverArt` and
  `seedFrom` keep both their location and their API and are imported from `../-ui/cover-art` exactly
  as they are today; `PageHeader`, `Panel` and `HeaderSkeleton` are imported unchanged.
- **New components.**
  - `JourneyActions` — a `DropdownMenu` on the story header and on each list card: rename, edit
    subtitle and cover, publish or unpublish, archive, delete. Destructive items are `danger`-toned
    and route through a confirming `Dialog` that names the journal and the entry count it will take
    with it.
  - `TripLinkDialog` — the trips this journal already draws on as `Badge`s, and the ones it could,
    from the existing `loadJourneyTripOptions`. Importing states the count before it happens
    ("Adds 14 places as anchors; ones already here are skipped") and reports the count after.
- **States.**
  - _Trips, empty:_ on `--color-surface-2`, "This journal is not tied to a trip yet", with the
    import action beside it and a line explaining what an anchor is.
  - _Anchors imported, none new:_ an informational `Alert` — "Every place from that trip is already
    here" — which is the honest outcome of an idempotent action and not an error.
  - _Skeleton:_ the dialog's trip list renders four `Skeleton` rows at the settled row height.
  - _Error:_ a failed write keeps the dialog open with its values, shows a `danger` `Alert` naming
    what failed, and offers a retry. A failed delete never leaves the screen navigated away.
  - _Loading:_ every menu item and dialog button takes `loading` and `disabled`; the import button
    reports progress as a count rather than a spinner alone, because the traveller cares how many.
- **Motion.** The dropdown and dialog use the primitives' existing enter and exit; imported anchors
  enter the story list on a 200ms opacity and 4px translate on `--ease-out-quint`, staggered 24ms and
  capped at eight. `prefers-reduced-motion: reduce` collapses to opacity.
- **Tokens.** None missing.

### Quota

**The metric is `journeys`, and the assertion already exists.** `createJourney`
(`src/server/repos/journey.ts:499`) calls `assertQuota(scope, 'journeys', await
journeysRepository.count(scope))` at `:507`, before the insert, and `journeys` is in `PLAN_QUOTAS`
(`src/server/db/types.ts:41-70`) with a value for each of the four tiers. This stage creates no
journal, so it adds no assertion and changes none: renaming, publishing, archiving and deleting do
not grow the metric, and deleting shrinks it, which the live `count(*)` reflects on the next check
because usage is never cached. (Since #799 that count leaves out an orphaned journey whose owner has
left the workspace, ADR 0034.)

The rows this stage does create are `journey_entries` of type `place`, through
`importTripPlaceAnchors`. They are **children of a metered parent**: a journal cannot exist without
passing the `journeys` ceiling, and the anchors are bounded by the trip's places, which are metered
themselves under `places` at `src/server/repos/places.ts:269`. Metering them a third time would
charge one tenant three times for one place. Nothing is added to `resolveLimits()`, to `PLAN_QUOTAS`
or to `src/server/billing/__tests__/limits.test.ts`.

Entitlement: `journal` **is** a key in `MODULE_KEYS` (`src/lib/plans.ts:126-139`), so this module is
gated — by `08-S10` in wave 3, through `assertModule`, and by no second check invented here.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope, against B's ids: `updateJourney`, `publishJourney`, `unpublishJourney` and
`deleteJourney` each reject with `NotFoundError`, and B's `journeys` row and its entry count are
unchanged. `listJourneyTripIds(scopeA, bJourneyId)` is a `NotFoundError` rather than an empty array,
because it resolves the journal first.

Two cases are the point of the block, and both are parenting attacks rather than read attacks:

1. `importTripPlaceAnchors(scopeA, aJourneyId, bTripId)` — A's own journal, B's trip. It must be a
   `NotFoundError` from the trip resolution and must write **no** `journey_entries` row, because the
   attack here is not reading B's trip but copying its places into A's workspace under A's own ids.
   Assert A's entry count is unchanged, not merely that the call threw.
2. `importTripPlaceAnchors(scopeA, bJourneyId, aTripId)` — B's journal, A's trip. `NotFoundError`,
   and B's entry count is unchanged.

Functions covered: `getJourney`, `updateJourney`, `publishJourney`, `unpublishJourney`,
`deleteJourney`, `listJourneyTripIds`, `importTripPlaceAnchors`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/routes/_app/-server/__tests__/journal.test.ts` — a non-owner cannot delete or change status
    while a member can import; a foreign id is a `NotFoundError`; importing the same trip twice adds
    nothing the second time and reports zero; an import into a journal with an existing anchor for
    the same `source_place_id` skips that one and adds the rest.
  - `src/components/journey/__tests__/journey-actions.test.tsx` — the destructive item opens the
    confirmation rather than acting, the confirmation names the entry count, `Escape` cancels, and
    focus returns to the trigger.
  - `src/components/journey/__tests__/trip-link-dialog.test.tsx` — the count is stated before the
    import and after it, and the zero-new outcome renders as information and not as an error.
- Playwright:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g journey --update-snapshots
  ```

  The spec reaches `/journey/$journeyId` by clicking the first card on `/journey` rather than by
  hard-coding a seeded id, so the test does not break when the fixture changes. `/journey` is
  declared `relativeTime: true` in `APP_ROUTES` already; the spec's own table repeats that
  declaration for the routes it declares and calls `auditServerClock()` once. **This stage adds no
  clock-derived string of a new shape** — the story screen prints absolute dates through
  `formatDate` — so `RELATIVE_TIME_SITES` gains no entry and `e2e/helpers/shoot.ts` is not claimed.

- Frames, per `12-verification-protocol.md` §3, with the declared state that is the point:

  ```sh
  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/journey" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S3" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
    --state actions --click '[data-part="journey-actions"]'
  ```

  Plus the resting and `--state trips --click '[data-part="journey-trip-link"]'` sets on the story
  route. Both selectors are `data-part` attributes this stage publishes and both are verified to
  resolve by the spec run reaching them.

- Console must be silent: `fatal` empty in every test including the frame-only ones.
- Layout shift after the settle mark asserted at `0` on `chromium`, stated as a skip on
  `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the actions menu, the confirmation and the trip dialog:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every menu item and button, including the
      import while it runs.
- [ ] Designed empty state on `--color-surface-2` for a journal with no trips, skeleton rows in the
      dialog at the settled height, and an error state that keeps the dialog open with its values.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, stagger capped at eight,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, with dark shadows re-declared — including the cover card, whose art sits
      under an inverse surface in both themes.
- [ ] 360px through 2560px: at 360px the actions menu is a bottom sheet and the trip dialog is
      full-height.
- [ ] Keyboard navigable end to end, accessible names on every action, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every count.

### Blockers

None. Every table, column and repository function this stage needs exists; no package outside the
SPEC §3 pinned set is required; no binding is added; no row in another plan gates it. The markdown
renderer five rows want is **not** needed here — a journal's own description is plain text, and the
entry body that needs it belongs to `08-S7`, which consumes `01-S2`'s implementation rather than
writing a second one.

## Stage 08-S4 — A collection you can change: what it is called, what each place is worth, and the labels that sort them

### Stage id

`08-S4` · Wave 1 · effort **M**. The write half of a collection's own identity, its per-place status,
and the labels the screen already filters by but nothing can create.

### Reference rows

- `ADD-09` partial → **done**.

Sourced from `wiki: Collections-Overview` for the behaviour set — a saved list with its own name,
colour, cover and description; a status on each saved place that moves in one tap; and per-list
labels with a small manager and filters that match any of the selected labels rather than all of
them. Described here against `collections`, `collection_labels` and `collection_place_labels`, which
already exist.

**What is already done and is not rebuilt.** The index, the detail screen, the status pills, the
label pills, the place cards and creation all ship: `loadCollections`
(`src/routes/_app/-server/library.ts:741`), `loadCollectionDetail` (`:814`) and `createCollectionFn`
(`:918`), rendered through `src/routes/_app/collections/index.tsx` and `$collectionId.tsx`.

**Two contradictions with the row, stated with evidence.**

1. The row calls the place status "three-state". **Ours is five**, and stays five:
   `COLLECTION_PLACE_STATUSES` (`src/server/db/schema.ts:211-217`) is
   `idea · shortlisted · planned · visited · rejected`, the CHECK constraint
   `collection_places_status_chk` enforces it, and `$collectionId.tsx:28-33` already renders all five
   as filter pills. A three-value cycle would need a migration to narrow a column, which
   `ARCHITECTURE.md` §9 forbids in the same stage that stops writing it, and would throw away a
   distinction the screen already makes. So the "one tap" is a small popover picker rather than a
   cycle: five values do not cycle usefully, and a traveller who overshoots on a cycle has to go
   round again.
2. The row pairs the status with "dropped on copy-to-trip". **Copy-to-trip is `ADD-10`'s**, and is
   `08-S9`. This stage ships the status and its write path; `08-S9` decides what a copy does to it,
   and says so.

### Owned paths

- `src/server/repos/collections.ts` — edit. No new SQL: the six write functions this stage exposes
  already exist. What is added is a Zod input for the multi-label assignment and the ordering rule
  for a new label. No other wave-1 stage names this file; `08-S9` (wave 3) edits it afterwards.
- `src/routes/_app/-server/collections.ts` — new. The module's write functions, created here and
  grown by `08-S9`.
- `src/routes/_app/-server/__tests__/collections.test.ts` — new.
- `src/routes/_app/collections/$collectionId.tsx` — edit. The detail screen composes the new
  controls and its search contract widens to several labels.
- `src/components/collections/collection-actions.tsx` — new.
- `src/components/collections/label-manager.tsx` — new.
- `src/components/collections/status-picker.tsx` — new.
- `src/components/collections/filters.ts` — new. The pure OR-matching predicate, shared by the
  screen and its test.
- `src/components/collections/__tests__/filters.test.ts` — new.
- `src/components/collections/__tests__/label-manager.test.tsx` — new.
- `src/components/collections/__tests__/status-picker.test.tsx` — new.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.

Two files this stage deliberately does **not** name, and why: `src/routes/_app/collections/index.tsx`
and `src/components/collections/index.ts` both belong to `08-S3` this wave, which owns the retirement
of the shared create-dialogs module and creates the module directory with it. This stage imports its
own components by path. `08-S9` folds them into the barrel in wave 3.

Neither is any baseline re-recorded: `/collections` is not in `PUBLIC_ROUTES` or `APP_ROUTES`
(`e2e/helpers/shoot.ts:441-449`, `:490-498`) and `e2e/__screenshots__/visual.spec.ts/` holds no
frame for it, so this stage's screens are baselined for the first time, in this plan's own spec file
and its own baseline directory.

### Data and migration

**No schema change, and none is filed.** `collections` already carries `name`, `slug`,
`description`, `colour`, `icon`, `cover_image_url`, `visibility` and `sort_order`.
`collection_labels` already carries `name`, `colour`, `sort_order` and a unique
`(collection_id, name)` index — so a duplicate label name is a database error this stage must
present as a field error rather than a crash. `collection_place_labels` is the join, reached through
`collectionPlaceLabelsAccess` (`src/server/repos/collections.ts:50`). No migration, no backfill, no
index.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/collections.ts`.** Six existing functions carry this stage and no
  function is added; exactly one body changes, named in the last bullet of this section:
  `updateCollection` (`:309`), `deleteCollection` (`:326`),
  `setCollectionPlaceStatus` (`:410`), `createLabel` (`:427`), `deleteLabel` (`:436`) and
  `setCollectionPlaceLabels` (`:441`). `updateCollection` already reserves a new slug through
  `reserveSlug` when the name changes, so renaming a collection keeps its URL honest without a second
  implementation.
- **Tenant scoping, stated rather than implied.** Every one of them is built on `tenantFilter()`
  from `src/server/repos/base.ts`, which begins
  `eq(table.organizationId, scope.ctx.organizationId)`. `collections`, `collection_labels` and
  `collection_place_labels` each carry `organization_id NOT NULL` as a column, and the first two each
  carry a composite index led by it — `collections_org_owner_idx` (`src/server/db/schema.ts:1220`)
  and `collection_labels_org_collection_idx` (`:1287`). **The tenant column does not lead every
  composite index on them, and on the join table it leads none**: `collection_labels_collection_sort_idx`
  (`:1288`) leads with `collection_id`, and `collection_place_labels` indexes `organization_id` alone
  (`:1306`) under a composite primary key of `(collection_place_id, label_id)` (`:1305`). None of that
  is the safety argument and none of it is offered as one. **The safety argument is that
  `createTenantRepository` / `createTenantTableAccess` stamp `organization_id` from `scope.ctx` on
  every insert and omit it from the caller's payload type** (`src/server/repos/base.ts:196-200`), so
  a label row cannot be written into another workspace even by a handler that forgot to check — the
  handler is given no way to express the wrong workspace. What an index would buy is a narrower scan,
  and this stage adds none.
- **Server functions — `src/routes/_app/-server/collections.ts`**, all `POST`:
  `updateCollectionFn`, `deleteCollectionFn`, `setPlaceStatusFn`, `createLabelFn`, `deleteLabelFn`
  and `setPlaceLabelsFn`. Each returns the row the screen re-reads.
- **Zod v4**, `z.strictObject()` with the `error` parameter, reusing `updateCollectionInput`
  (`:73`) and `createLabelInput` (`:118`). The label assignment input is
  `{ collectionPlaceId: idSchema, labelIds: z.array(idSchema).max(16) }` — a bounded array, because
  an unbounded one is a write amplification a client can choose.
- **Authorisation, decided in the handler.** `collections.owner_user_id` decides deletion; any member
  may set a status or a label on a collection they can see, which is what makes a shared list worth
  sharing. `collections.visibility` is read but **not** enforced as a permission by this stage: it is
  a three-value enum with no member entity behind it, so `organization` and `private` cannot be told
  apart without one, and `08-S9` is where roles land. This stage says that in place rather than
  pretending the enum already gates anything.
- No queue, no realtime, nothing slow. Each write is one indexed statement, except
  `setCollectionPlaceLabels`, which today is a **pair**: `collectionPlaceLabelsAccess.removeWhere`
  followed by `insertMany` (`src/server/repos/collections.ts:461-470`), not a batch — this stage
  changes those two calls into one `runBatch(scope, [...])` from `src/server/repos/batch.ts:35`, which
  is the plan's only modification to an existing repository function body here, so a failure between
  the delete and the insert can no longer leave a place with none of its labels. The sixteen-element
  cap on the input keeps the batch bounded.

### UI (route, components)

- **Route.** `/collections/$collectionId` already exists. **No route file is added and
  `pnpm generate-routes` is not run.** Its `validateSearch` widens from `label?: string` to
  `labels?: Array<string>` with a bounded length, and the pills toggle membership of that array.
- **Filtering stays client-side in this stage, deliberately.** `loadCollectionDetail` already ships
  the whole place list and the whole label list to the browser, so narrowing on the server would add
  a round trip per pill click and show the traveller a spinner where they now see an instant result.
  `filters.ts` holds the predicate: a place matches when its label set intersects the selected set
  (**any**, not all) and its status is in the selected statuses. When `08-S9` makes the list large
  enough to page, it owns `library.ts` in wave 3 and moves the narrowing to the loader; this stage
  writes the predicate as a pure function precisely so that move is a call-site change and not a
  rewrite.
- **Components reused, not rebuilt** — `Popover`, `DropdownMenu`, `Dialog`, `Button`, `IconButton`,
  `Input`, `Textarea`, `Select`, `Badge`, `Chip`, `Card`, `EmptyState`, `Skeleton`, `Alert`,
  `Toast`, plus `FilterBar`, `FilterCount` and `filterLinkClass` from the route's own
  `-ui/scaffold.tsx`, imported and not written.
- **New components.**
  - `CollectionActions` — a `DropdownMenu` in the `PageHeader`: rename, description, colour, icon,
    cover image, visibility, delete. Editing opens one `Dialog` rather than six, because the fields
    are one object.
  - `StatusPicker` — a `Popover` on each place card's status `Badge`, listing the five statuses with
    their existing tones from `src/routes/_app/-lib/tone.ts`. It writes optimistically and rolls back
    on failure. The trigger is the badge itself, so the screen gains a control without gaining a row.
  - `LabelManager` — a `Dialog` listing the collection's labels with inline rename, a colour swatch
    and a delete that names how many places carry the label before removing it. Creating a label with
    a name that already exists is a field error on the input, from the unique index, not a toast.
- **States.**
  - _Labels, empty:_ on `--color-surface-2`, "No labels yet" with one line on what a label is for and
    the name field focused behind it.
  - _Filtered to nothing:_ the screen's existing "Nothing matches that filter" empty state keeps its
    reset action and gains the count of what is hidden, so the traveller knows the list is not empty.
  - _Skeleton:_ `CardsSkeleton` from `-ui/scaffold.tsx` already covers the list; the label manager
    renders four `Skeleton` rows at the settled height.
  - _Error:_ a failed status write restores the previous badge and shows a `danger` `Alert` above the
    list with a retry; a failed label write keeps the dialog open with its values.
  - _Loading:_ the picker's item takes `loading`, the badge goes `aria-busy` and keeps its label
    rather than blanking.
- **Motion.** Popover and dialog use the primitives' existing enter and exit. A place card whose
  status changed flashes its badge on a 180ms opacity ramp on `--ease-out-quint` — no colour
  animation, no layout property. `prefers-reduced-motion: reduce` removes the flash entirely.
- **Tokens.** None missing. A label's colour is a stored per-row value like a traveller's swatch, and
  the text on it is chosen by the same measured `inkOn()` helper the leave planner uses, not by a
  hard-coded pair.

### Quota

**The metric is `collections`, and the assertion already exists.** `createCollection`
(`src/server/repos/collections.ts:295`) calls
`assertQuota(scope, 'collections', await collectionsRepository.count(scope))` at `:300`, before the
insert, and `collections` is in `PLAN_QUOTAS` (`src/server/db/types.ts:41-70`) for all four tiers.
This stage creates no collection, so it adds no assertion: renaming and re-colouring do not grow the
metric, and deleting shrinks it, which the live `count(*)` reflects immediately because usage is
never cached.

The rows this stage creates are `collection_labels` and `collection_place_labels`. Both are
**children of a metered parent** — a label cannot exist without a collection, which passed the
`collections` ceiling — and both are bounded: labels by the unique `(collection_id, name)` index and
the assignment by the sixteen-element cap on the input. Nothing is added to `resolveLimits()`, to
`PLAN_QUOTAS` or to `src/server/billing/__tests__/limits.test.ts`.

Entitlement: saved collections have **no key in `MODULE_KEYS`** (`src/lib/plans.ts:126-139`), so
there is nothing to gate and no key is invented to gate it with. `08-S10` states that measurement
once for the plan.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope, against B's ids: `updateCollection`, `deleteCollection`, `setCollectionPlaceStatus`,
`createLabel` (parented on B's collection), `deleteLabel`, and `setCollectionPlaceLabels` called with
**B's `collectionPlaceId`**, each reject with `NotFoundError` — each resolves its own row through
`requireById`, `requireUpdate` or `requireRemove` first (`src/server/repos/collections.ts:309`,
`:326`, `:410`, `:427`, `:436`, `:446`) — and B's `collections`, `collection_labels` and
`collection_place_labels` rows are byte-identical afterwards.

Then the reverse read, and the two shapes are **not** the same:
`getCollection(scopeB, aCollectionId)` resolves to **`null`** — it delegates to
`collectionsRepository.findById` (`src/server/repos/collections.ts:159-164`) and does not throw — and
`listLabels(scopeB, aCollectionId)` returns `[]`. The throwing shape is asserted separately, on
`collectionsRepository.requireById(scopeB, aCollectionId)`, which does raise `NotFoundError`. All
three are asserted, because a test that expects a rejection from a read that was built to return a
nullable would fail against correct code and teach the wrong contract.

One case is the point of the block, and its expected outcome is a **filtered write, not a rejection**:
`setCollectionPlaceLabels(scopeA, aPlaceId, [bLabelId])` — A's own place, one of B's labels. The
shipped function resolves the place, then re-reads the requested label ids through
`collectionLabelsRepository.findMany` narrowed by both `tenantFilter()` and
`eq(collectionLabels.collectionId, place.collectionId)` (`src/server/repos/collections.ts:449-459`),
so a foreign label id survives neither filter: the call **resolves**, its returned array does **not**
contain `bLabelId`, and no `collection_place_labels` row referencing it is written. Assert all three —
the resolution, the returned array and a zero row count for that label id — because the join table is
the one place where two ids from two workspaces could meet in a single statement, and a filter on only
one of them would look correct. Assert the same for `[aLabelId, bLabelId]`, where the returned array
must be exactly `[aLabelId]`: a drop that also dropped the caller's own label would pass a test that
only looked for the absence of `bLabelId`.

Functions covered: `getCollection`, `listCollectionPlaces`, `listLabels`, `updateCollection`,
`deleteCollection`, `setCollectionPlaceStatus`, `createLabel`, `deleteLabel`,
`setCollectionPlaceLabels`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/components/collections/__tests__/filters.test.ts` — the label predicate matches **any**
    selected label and not all of them; no labels selected means no label narrowing rather than no
    results; status and label narrow together; a place carrying a deleted label is not hidden by a
    stale id in the URL.
  - `src/routes/_app/-server/__tests__/collections.test.ts` — a duplicate label name returns a field
    error rather than a five-hundred; a non-owner cannot delete a collection but can set a status; a
    foreign **`collectionId`** or **`collectionPlaceId`** is a `NotFoundError`, while a foreign
    **`labelId`** inside `labelIds` is dropped and the call resolves without it, which is the shipped
    contract and not a second one; the sixteen-label cap rejects a seventeenth.
  - `src/components/collections/__tests__/status-picker.test.tsx` — the badge is the trigger and is
    reachable by keyboard, the optimistic value rolls back on rejection, and the accessible name of
    the trigger includes both the place and the current status.
  - `src/components/collections/__tests__/label-manager.test.tsx` — deleting a label names its place
    count first, `Escape` cancels, focus returns to the trigger.
- Playwright:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  ```

  The spec declares `/collections` and reaches `/collections/$collectionId` by clicking the first
  card, and calls `auditServerClock(page, <its own table>)` once in a `describe` of its own — the
  only check that reads a route declaration against the streamed payload, and the one the calendar
  cannot move. Neither screen prints a clock-derived string, so no `relativeTime` is declared and
  `RELATIVE_TIME_SITES` gains no entry.

- Frames, per `12-verification-protocol.md` §3, with the two declared states that are the point:

  ```sh
  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/collections" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S4" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth
  ```

  and, on the detail route, `--state status --click '[data-part="place-status"]'` for the picker and
  `--state labels --click '[data-part="label-manager"]'` for the manager. Both selectors are
  `data-part` attributes this stage publishes, verified to resolve by the spec run reaching them.

- Console must be silent: `fatal` empty in every test.
- Layout shift after the settle mark asserted at `0` on `chromium`, stated as a skip on
  `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the status picker, the label manager and the actions
menu:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every control, including a badge whose
      write is in flight.
- [ ] Designed empty state on `--color-surface-2` for a collection with no labels and for a filter
      that matches nothing, `CardsSkeleton` for the list, and an error state that restores the
      previous value and offers a retry.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured — the status flash disappears entirely under it.
- [ ] Light and dark parity with dark shadows re-declared, and every stored label colour checked for
      AA contrast against the text `inkOn()` picks for it in both themes.
- [ ] 360px through 2560px: at 360px the filter bar scrolls horizontally with its selected pills
      pinned first, and both dialogs are full-height sheets.
- [ ] Keyboard navigable end to end, accessible names on every pill, badge and label,
      WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every count.

### Blockers

- **Sharing roles are not built here and the visibility enum does not stand in for them.**
  `collections.visibility` has three values and no member entity behind it, so viewer, editor and
  admin cannot be distinguished. That is `ADD-10`'s work, in `08-S9`, wave 3. Disposition: **defer to
  a named stage in this plan**, not to another plan and not to a package.
- Nothing else. No package outside the pinned set, no binding, no third-party service.

## Stage 08-S5 — Twelve months you can actually click: logging a day, a run of days, and the days the company takes

### Stage id

`08-S5` · Wave 2 · effort **L**. The month grid stops being a picture. A cell becomes a control, a
drag becomes a range, a mode switch turns the same gesture into a company holiday, and a trip already
in the diary shows through.

### Reference rows

- `ADD-03` partial → **done**.

Sourced from `wiki: Vacay-Calendar` for the behaviour set — a twelve-month year at a glance,
click-to-log with a kind, per-person colours, a marker where a trip already occupies the day, and a
mode in which the same click records something the whole workspace is away for and which costs
nobody an allowance day. Described here against `vacay_entries`, `vacay_company_holidays` and
`vacay_holiday_calendars`, which already exist.

**What is already done and is not rebuilt.** The read side of this row is finished and is good:
`vacay.tsx` renders twelve `MonthGrid`s (mapped at `:242`, the component at `:301-437`) that colour
the traveller's own days from their stored swatch, inset weekends, tint company holidays in the
warning tone, underline a day somebody else is away, and summarise each month's kinds as `Badge`s.
None of that is redesigned. What changes is that a cell becomes a `<button>`: today it is a `<span>`
with a `title` attribute (`vacay.tsx:375-409`), which is neither focusable nor announced and has
nothing to activate.

**A contradiction with the row, stated with evidence.** The row expects public holidays "from an
external source". **There is no source and this stage does not invent one.** Measured:
`vacay_holiday_calendars` (`src/server/db/schema.ts`) carries `region`, `label`, `colour` and
`sort_order` — a subscription record with **no day rows anywhere in the schema** — so a calendar row
paints nothing until something fetches its days. Fetching them means a third-party feed with a
licence, a cost and an outbound subrequest from a Worker. The disposition is under **Blockers**; what
this stage ships is the stacking surface over the days a workspace enters itself, which is complete
on its own terms.

**The week the grid draws stops being a constant, and this is the stage that reads it.** `08-S1`
measured the setting rather than the row's wording: `organization_settings.week_starts_on`
(`src/server/db/schema.ts:1817`, CHECK at `:1828`), `user_settings.week_starts_on` (`:1842`, CHECK at
`:1857-1858`) and one resolver over the pair, `weekStartsOn: user?.weekStartsOn ??
organization.weekStartsOn` in `getEffectiveSettings` (`src/server/repos/settings.ts:295`), with both
editing surfaces already shipped at `src/routes/_app/settings/organization.tsx:434-450` and
`src/routes/_app/settings/index.tsx:304-326`. At plan drafting, the leave planner read none of it:
the header was
a Monday-first literal (`WEEKDAY_INITIALS`, `vacay.tsx:41-49`, rendered at `:337`) and `loadVacay`
published an unread `weekStartsOn: 1` (`src/routes/_app/-server/library.ts:133-134`).
08-S5b (#1112) now consumes the setting through the read-only handler described in the 08-S1
implementation note above. This stage consumes the resolved value — see **Server** and **UI** —
and adds **no column, no CHECK and no migration**, because a per-plan copy would be a second authority on a question the settings tables
already answer.

### Owned paths

- `src/server/repos/vacay.ts` — edit. One new read (`listTripDateRanges`); the seven write functions
  are already there. `08-S1` (wave 1) and `08-S8` (wave 3) hold this file in their own waves.
- `src/routes/_app/-server/vacay.ts` — edit. Created by `08-S1`, grown here.
- `src/routes/_app/-server/__tests__/vacay.test.ts` — edit.
- `src/routes/_app/vacay.tsx` — edit. The grid moves into the module directory and the screen
  composes it.
- `src/components/vacay/month-grid.tsx` — new. Extracted from `vacay.tsx:301-437`, made interactive,
  and made to take `weekStartsOn` as a prop rather than to assume Monday. The rotation is a pure
  function of that number and the seven weekday labels, so it lives with the component it serves and
  is covered by the component's own test; it is small enough that a separate module would be an
  abstraction for one caller.
- `src/components/vacay/day-cell.tsx` — new.
- `src/components/vacay/range-select.ts` — new. The pure pointer-and-keyboard range model.
- `src/components/vacay/holiday-manager.tsx` — new.
- `src/components/vacay/index.ts` — edit. Created by `08-S1`, grown here.
- `src/components/vacay/__tests__/range-select.test.ts` — new.
- `src/components/vacay/__tests__/month-grid.test.tsx` — new.
- `src/components/vacay/__tests__/holiday-manager.test.tsx` — new.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `e2e/__screenshots__/visual.spec.ts/vacay-light-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-dark-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-light-mobile-safari.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-dark-mobile-safari.png` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.

The four `vacay-*` baselines are re-recorded here for the second of three times, after `08-S1` in
wave 1 and before `08-S8` in wave 3. The change is real: every cell gains a focus ring and a hover
state and the header gains a mode switch.

This stage does **not** claim `src/routes/_app/-server/library.ts`. `08-S7` holds it in wave 2. Both
reads this stage needs — the trip overlaps and the resolved week start — are therefore added to the
module's own server file, and `loadVacay` is not touched by this stage. The unread `weekStartsOn: 1`
literal it still publishes (`library.ts:133-134`) is removed by `08-S7`, in the same wave, as one
line of the edit it already owns; that is stated in `08-S7`'s **Owned paths** as well, so the removal
has exactly one owner and this stage's grid does not depend on it having happened.

### Data and migration

**No schema change, and none is filed.** `vacay_entries` already carries `plan_id`, `user_id`,
`date`, `kind` behind `vacay_entries_kind_chk` and `note`, with a unique
`(plan_id, user_id, date)` index that makes a day idempotent — clicking twice sets, it does not
duplicate. `vacay_company_holidays` already carries `plan_id`, `date` and `label` with a unique
`(plan_id, date)` index. `vacay_holiday_calendars` already carries the subscription record.
Dates stay `YYYY-MM-DD` text. No migration, no backfill, no index.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/vacay.ts`.** Seven existing functions carry the writes:
  `setEntry` (`:366`), `setEntryRange` (`:400`), `removeEntry` (`:447`), `addCompanyHoliday`
  (`:486`), `removeCompanyHoliday` (`:507`), `addHolidayCalendar` (`:524`) and
  `removeHolidayCalendar` (`:540`). One read is added:

  `listTripDateRanges(scope, { from, to })` — the workspace's trips that overlap a date window, as
  `{ tripId, title, startDate, endDate }`, one `tenantFilter()`-bound query on `trips`.

  It lives here rather than in `src/server/repos/trips.ts` for a stated reason: it is the leave
  planner's question, not the trip module's, and `trips.ts` is held in this wave by `07-S6`
  (`07-collaboration-and-sharing.md`), so a second claimant would clobber it. There is precedent in
  the codebase — `src/server/repos/atlas.ts:805-814` reads `trips` for the same kind of cross-module
  aggregate — and no SQL leaves `src/server/repos/`.

- **Tenant scoping, stated rather than implied.** Every write is built on `tenantFilter()` from
  `src/server/repos/base.ts`, which begins `eq(table.organizationId, scope.ctx.organizationId)`;
  `vacay_entries`, `vacay_company_holidays` and `vacay_holiday_calendars` each carry
  `organization_id NOT NULL` as the leading column of a composite index. The new read is held to the
  same rule: `listTripDateRanges` filters `trips` through `tenantFilter()` and nothing else, so a
  window that spans another workspace's trips returns none of them.
- **Server functions — `src/routes/_app/-server/vacay.ts`**, all `POST` except the first:
  - `loadVacayGridFn` (`GET`) — the two things the grid needs that the plan overview does not carry:
    `tripWindows`, the year's trip date ranges for the dots, and `weekStartsOn`, the resolved
    preference. In 08-S5b (#1112), `readGrid` reads the existing workspace and traveller rows once
    through `getOrganizationSettings` and `getUserSettings`, then applies the same nullish override
    precedence as `getEffectiveSettings`. It avoids that helper because it can create a missing
    workspace row: this stage reads settings, never writes them, and adds no per-plan column.
    The returned value is narrowed at
    the boundary with `z.number().int().min(0).max(6).catch(1)` before it leaves the handler, so a
    row written before the CHECK existed cannot rotate the header into an undefined index; the CHECK
    makes that unreachable in D1 and the narrowing makes it unreachable in types as well. Separate
    from `loadVacay` on purpose: these are the parts of the screen that change when a trip or a
    preference changes rather than when a leave day does, and keeping them separate lets the grid
    re-read them alone.
  - `setVacayEntryFn` / `setVacayEntryRangeFn` / `removeVacayEntryFn` — one day, a run of days, and
    a day cleared.
  - `setCompanyHolidayFn` / `removeCompanyHolidayFn` — the same gesture in company mode.
  - `addHolidayCalendarFn` / `removeHolidayCalendarFn` — the stacked subscriptions.
- **Zod v4**, `z.strictObject()` with the `error` parameter, reusing `setEntryInput` (`:93`),
  `setEntryRangeInput` (`:102`), `addCompanyHolidayInput` (`:121`) and `addHolidayCalendarInput`
  (`:128`). One refinement is added at the boundary rather than in the schema: a range is rejected
  when `to` precedes `from`, and when it spans more than 366 days, because
  `setEntryRange` writes one row per day and an unbounded range is a write amplification the client
  chooses.
- **Authorisation, decided in the handler.** Two different rules, and the difference is the point:
  - A **personal** entry is the caller's own. `setEntryInput.userId` is optional and defaults to
    `scope.ctx.userId` (`vacay.ts:93-100`, `:369`); the handler passes an explicit id only for a plan
    owner logging on behalf of a colleague, and otherwise omits it. `08-S8` extends that to accepted
    plan members and says so there.
  - A **company holiday** belongs to the plan and affects everybody on it, so only the plan's
    `owner_user_id` may add or remove one. A member who tries gets a named rejection and the mode
    switch is not offered to them at all — the affordance and the rule agree, which is what stops a
    disabled control from being the only explanation a traveller gets.
  - Both resolve the plan through `vacayPlansRepository.requireById(scope, planId)` first.
- Nothing enqueued: a range is bounded at 366 rows and written through `runBatch`, which is one D1
  batch and therefore one transaction — a half-written fortnight is not a state this screen can
  reach.

### UI (route, components)

- **Route.** `/vacay`, unchanged. **No route file is added and `pnpm generate-routes` is not run.**
- **Components reused, not rebuilt** — `Popover`, `Select`, `Dialog`, `Switch`, `Button`,
  `IconButton`, `Badge`, `Chip`, `Card`, `Alert`, `Skeleton`, `EmptyState`, `Toast`, plus `Panel`
  from `-ui/scaffold.tsx`.
- **New components.**
  - `DayCell` — a `<button>` where a `<span>` used to be. It keeps every visual state the current
    cell has (own colour, company tint, weekend inset, other-traveller underline) and adds
    `hover`, `focus-visible`, `active`, `disabled` and an in-flight state. Its accessible name is the
    full date plus what is on it, which is what the `title` attribute was gesturing at and never
    announced. A trip overlap renders as a second marker distinct from the other-traveller underline
    — a hairline along the top edge in `--color-info`, against the underline along the bottom — so
    two different facts never share one mark.
  - `MonthGrid` — extracted, and now a roving-tabindex grid: one tab stop per month, arrow keys move
    by day, `PageUp`/`PageDown` by month, `Home`/`End` to the ends of the week, `Shift` plus arrows
    extends a range. That is the keyboard half of the drag, and it is not optional. It also takes
    `weekStartsOn` and rotates with it: the seven column headings, the leading blanks before the
    first of the month, and `Home`/`End` are all derived from that one number rather than from a
    Monday-first constant, so a workspace that starts on Sunday reads a Sunday-first year and the
    weekend inset moves with it instead of staying under columns six and seven. The heading labels
    keep their existing three-letter form and their existing tone; nothing about the settled picture
    changes for the default of `1`, which is why the four `vacay-*` baselines re-recorded here differ
    only by the interactive states named above.
  - `range-select.ts` — the pure model behind both: anchor, focus, direction, and the resolved
    inclusive date list. Pointer drag and `Shift`-arrow produce the same value, so one test covers
    both and they cannot disagree.
  - `HolidayManager` — a `Dialog` listing the plan's company holidays for the year with their labels,
    and the stacked calendar subscriptions with their colours and order. Adding a company holiday
    from here is the same write as clicking a day in company mode.
- **The mode switch.** A segmented `PillNav` in the header — "My time off" and "Company" — shown only
  to the plan owner. In company mode the grid's hover preview switches tone to `--color-warning-soft`
  and the cell's accessible name says which kind of day the click will record, so the mode is legible
  before it is used and not only after.
- **States.**
  - _Empty:_ the existing "Nothing marked in {year}" card keeps its copy and gains a primary action
    that focuses the first day of the current month — an empty calendar should point at the gesture,
    not just describe it.
  - _Skeleton:_ `VacayPending` already renders six month cards of `Skeleton` cells; this stage
    extends it to twelve at the settled cell size so the grid does not jump when it resolves.
  - _Error:_ a failed day write reverts the cell to its previous fill and raises a `danger` `Alert`
    above the grid naming the date and the reason, with a retry that re-sends only the failed days. A
    failed range reverts every day in it — the range is one transaction and the UI matches.
  - _Loading:_ an in-flight cell keeps its numeral, drops to 60% opacity and sets `aria-busy`; a
    range in flight does the same across its span. No spinner replaces a date.
- **Motion.** A cell's fill transitions over 150ms on `--ease-out-quint`; the drag preview is opacity
  only. Nothing animates a layout property, and `prefers-reduced-motion: reduce` removes the fill
  transition and the preview ramp.
- **Tokens.** None missing. `--color-info`, `--color-warning-soft` and `--color-surface-inset` are
  already declared and already used by this screen.

### Quota

**Creates no metered row, and no metric is minted.** `vacay_entries` is bounded by the calendar times
the traveller — one row per `(plan, user, date)` behind a unique index, at most 366 a year — and
`vacay_company_holidays` by `(plan, date)`, at most 366 a year for the whole workspace. Neither can
grow with usage in the way a metered resource does, and the population of plans is already bounded by
the `members` metric, whose `assertQuota(scope, 'members', …)` call sites are
`src/server/repos/members.ts:160` and `:276`, as `08-S1` states.

The control that does matter is the 366-day cap on a range, enforced at the server-function boundary
before `setEntryRange` runs. It is a write-amplification guard, not a plan quota, and it is not
something a tenant can buy more of. Nothing is added to `resolveLimits()`, to `PLAN_QUOTAS` or to
`src/server/billing/__tests__/limits.test.ts`.

Entitlement: the leave planner has no key in `MODULE_KEYS`, so there is nothing to gate; `08-S10`
states that measurement once for the plan and this stage does not invent a key.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope, against B's plan: `setEntry`, `setEntryRange`, `removeEntry`, `addCompanyHoliday`,
`removeCompanyHoliday`, `addHolidayCalendar` and `removeHolidayCalendar` each reject with
`NotFoundError`, and B's `vacay_entries`, `vacay_company_holidays` and `vacay_holiday_calendars`
counts are unchanged. In the reverse direction, `listVacayEntries(scopeB, aPlanId, …)` returns `[]`
and `vacayEntriesRepository.requireById(scopeB, aEntryId)` throws — both asserted, because one is a
`findMany` and the other a `requireById` and they fail differently.

Two cases are the point of the block:

1. `setEntryRange` in A's scope for B's plan writes **no** row at all, not "some rows and then an
   error". The range runs through `runBatch`, so the assertion is that B's entry count is identical
   afterwards and A's is too.
2. `listTripDateRanges(scopeA, window)` returns only A's trips for a window in which B has trips —
   this is a **new read over another module's table**, so it is the one function in this stage whose
   tenant filter has never been exercised, and it gets its own explicit case rather than being
   assumed to inherit one.

Functions covered: `setEntry`, `setEntryRange`, `removeEntry`, `listVacayEntries`,
`addCompanyHoliday`, `removeCompanyHoliday`, `listCompanyHolidays`, `addHolidayCalendar`,
`removeHolidayCalendar`, `listHolidayCalendars`, `listTripDateRanges`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/components/vacay/__tests__/range-select.test.ts` — a backwards drag resolves the same
    inclusive list as a forwards one; `Shift`-arrow and pointer drag produce identical values;
    a range crossing a month boundary stays contiguous; the 366-day cap is expressed here and in the
    validator, and the test asserts they agree.
  - `src/components/vacay/__tests__/month-grid.test.tsx` — one tab stop per month; arrow keys move
    the roving index without leaving the grid; `Shift`-arrow extends; a cell's accessible name
    carries the date, the kind and any company holiday; the trip marker and the other-traveller
    marker are two distinct elements with two distinct names. Plus the rotation, table-driven over
    `weekStartsOn` of `0`, `1` and `6`: the column headings start on the named day, the first of the
    month lands in the right column in each of the three, and `Home`/`End` reach that week's own ends
    rather than Monday's and Sunday's. `6` is in the table because it is the only value at which the
    weekend straddles the two edges of the row, which is where an off-by-one hides.
  - `src/components/vacay/__tests__/holiday-manager.test.tsx` — a member does not see the company
    controls; the owner does; removing a holiday names the date first.
  - `src/routes/_app/-server/__tests__/vacay.test.ts` — a member's company-holiday write is
    rejected with the named reason; a reversed range is rejected; a 367-day range is rejected and
    writes nothing; a duplicate day is idempotent rather than an error, from the unique index. And
    for `loadVacayGridFn`: a traveller with no personal override reads the workspace default, an
    override of `0` wins over a workspace `1`, clearing the override back to `null` returns the
    workspace value again, and the window returns only the caller's own trips.
- Playwright, and the frames, per `12-verification-protocol.md` §3, pinned to the same year the gate
  pins:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g vacay --update-snapshots

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/vacay?year=2026" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S5" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
    --state kind-picker --click '[data-part="vacay-day"][data-date="2026-08-19"]'
  ```

  The declared state is the kind picker open over a specific day, because the point of this stage is
  a gesture the resting screen cannot show. A second state set, `--state company`, is taken with the
  mode switch engaged via `--click '[data-part="vacay-mode"][data-value="company"]'`. Both selectors
  are `data-part` attributes this stage publishes; both are verified to resolve by the spec run
  above reaching the same states, not by reading the JSX.

- Console must be silent: `fatal` empty in every test.
- Layout shift after the settle mark asserted at `0` on `chromium` — with the cell's focus ring
  drawn inside its own box precisely so a focused day cannot reflow a week — and stated as a skip on
  `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the grid, the kind picker, the mode switch and the
holiday manager:

- [ ] Spacing on the 4px grid from `--space-*`; the cell stays on the same 28px module it has today.
- [ ] Hover, focus-visible, active, disabled and loading on every cell and control, including a cell
      whose write is in flight and a range in flight across its whole span.
- [ ] Designed empty state on `--color-surface-2` that points at the gesture, a twelve-month
      skeleton at the settled cell size, and an error state that reverts the affected days and
      retries only those.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, and
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared, and every stored traveller colour checked
      against the numeral `inkOn()` puts on it in both themes.
- [ ] 360px through 2560px: at 360px the year is one month per row with a sticky month header and
      the picker is a bottom sheet; at 2560px the twelve months stay on a four-column grid rather
      than stretching to unreadable cells.
- [ ] Keyboard navigable end to end — a whole year reachable and loggable without a pointer — with
      accessible names on every day, and WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every
      numeral in the grid and every figure in the panel.

### Blockers

- **No public-holiday day source.** Measured above: `vacay_holiday_calendars` records a subscription
  and no table anywhere holds its days. A commercial feed is a licence and a cost decision and an
  outbound subrequest per load, of the same shape as the three infrastructure decisions in
  `docs/plans/11-boundaries-and-blockers.md`, and it is recorded there rather than assumed here.
  Disposition: **defer**. What ships is the stacking surface over days the workspace enters itself,
  and the rows it writes are exactly the rows a feed would fill, so nothing built here becomes wrong
  if one arrives.
- Nothing else. No package outside the SPEC §3 pinned set, no binding, no unlanded row.

## Stage 08-S6 — Statistics that move when the map does

**Implementation contract:** [Atlas statistics spec](../../.ai/specs/2026-10-10-atlas-statistics-that-follow-the-trip.md)
supersedes the original design below. #1119 keeps the roll-up current after place and transport writes;
#1120 reads the existing `/atlas` year rows without `loadTravelStatsFn`, a new request, a stale marker
or count-up motion. Figures belong to the traveller; distance is shown only above zero. The period
control remains enabled during re-reads, and the stored all-time streak names its years. Empty and
failed section states remain the following ticket's scope. The original server-function, labelling,
motion and verification proposals below are historical, not implementation instructions.

### Stage id

`08-S6` · Wave 2 · effort **S**. The smallest stage in this plan and the one with the worst symptom:
a panel of ten figures that nothing in production has ever recomputed.

### Reference rows

- `ADD-06` partial → **done**.

Sourced from `wiki: Atlas-Statistics` for the figure set — distinct countries and cities, trips all
time and this year, saved places, days travelled, a six-continent breakdown and a streak of
consecutive years. Described here against `travel_stats`, which already carries every column.

**The dependency, named as `TEMPLATE.md` requires.** The recomputation write path is
**`00-S4` in `docs/plans/00-foundations.md`, wave 0** — the `travel-stats` task kind, its handler
under `src/server/queue/handlers/travel-stats.ts`, the `DB` binding on `TaskBindings`, and the
enqueue from the two visited-country write functions. This stage does not build a second recompute,
does not call `recomputeTravelStats` from a request path, and does not read a figure it computes
itself. It consumes that stage and owns the panel.

**The trigger that keeps the panel consistent with the map**, stated so that no screen ever again
reads a number nothing writes:

1. A member marks or unmarks a country. `markCountryVisitedFn` / `unmarkCountryVisitedFn`
   (`src/server/fns/atlas.ts:441`, `:485`) write `visited_countries` and enqueue the `travel-stats`
   envelope `00-S4` defined — the all-time roll-up always, plus the year of `visitedOn` when the
   write carries one. The envelope id is deterministic per `(user, year)`, so a burst of toggles
   collapses to one recompute instead of fanning out.
2. `08-S2` (wave 1) added the region cascade. When a region write marks a previously unrecorded
   parent country it goes through the same `markCountryVisited` and therefore the same envelope —
   one task, not two.
3. The queue consumer recomputes and upserts. The map has already repainted optimistically; the
   panel catches up on its next read.
4. **The panel re-reads rather than guessing.** After a write settles, the atlas screen invalidates
   its router state and the statistics section re-fetches. A figure that has not caught up yet is
   rendered as _stale_ rather than as _wrong_: the section shows its last value at full opacity with
   a small "updating" marker beside the heading, driven by `travel_stats.computed_at` being older
   than the newest `visited_countries.updated_at` the payload carries. That is the difference between
   a panel that lags for a second and a panel that lies indefinitely, and it is the whole point of
   the stage.

### Owned paths

- `src/server/fns/atlas.ts` — edit. One new read function. `00-S4` holds this file in wave 0 and
  `08-S2` in wave 1; this stage edits it in wave 2 and each of the three names the others.
- `src/server/fns/__tests__/atlas.test.ts` — edit. Same three-wave sharing, same reason.
- `src/components/atlas/atlas-panel.tsx` — edit. The statistics section of the existing panel. No
  other stage in any plan names this file.
- `src/components/atlas/stats-model.ts` — new. The pure derivation from stored rows to what is
  printed: which figures are the workspace's, which are the traveller's, which are omitted.
- `src/components/atlas/__tests__/stats-model.test.ts` — new.
- `src/components/atlas/__tests__/atlas-panel.test.tsx` — edit.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `e2e/__screenshots__/visual.spec.ts/atlas-light-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/atlas-dark-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/atlas-light-mobile-safari.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/atlas-dark-mobile-safari.png` — edit.

The four `atlas-*` baselines are re-recorded here for the second of two times, after `08-S2` in wave

1. This stage does **not** claim `src/routes/_app/-server/library.ts`, which `08-S7` holds in wave 2;
   the reason is under **Server** and it is a better design rather than an accommodation.

### Data and migration

**No schema change, and none is filed.** `travel_stats` exists with `stat_year` (`0` for the
all-time roll-up), `trip_count`, `place_count`, `city_count`, `country_count`, `region_count`,
`day_count`, `distance_metres`, `spend_minor`, `currency`, `by_continent` as JSON, `year_streak`,
`last_trip_id` and `computed_at`, behind the unique
`(organization_id, user_id, stat_year)` index at `src/server/db/schema.ts:1515`. No migration, no
backfill, no index.

### Server (repo, server function, Zod)

- **Repository.** None added and none changed. `listTravelStats` (`src/server/repos/atlas.ts:742`)
  and `getTravelStats` (`:752`) are the reads; `recomputeTravelStats` (`:792`) and
  `upsertTravelStats` (`:764`) belong to `00-S4`'s handler and are not called from a request path
  here.
- **Server function — `src/server/fns/atlas.ts`**: `loadTravelStatsFn` (`GET`), returning one row
  per year plus the all-time roll-up, each with its `by_continent` breakdown and its `computed_at`.

  **Why a separate function rather than a wider `loadAtlas`.** Two reasons, and the first is already
  argued in the codebase. `src/routes/_app/-server/library.ts:291-300` explains that the atlas
  payload is dehydrated into the SSR document on every request, which is why the bucket list is
  capped at forty rows; the year-by-year breakdown is exactly the kind of weight that argument
  excludes, and the statistics live behind a tab that is not open on load. The second reason is the
  wave allocation: `library.ts` is held by `08-S7` this wave, and a second claimant would clobber it.
  The design and the constraint agree, which is the only comfortable way for them to be.

- **Zod v4**, `z.strictObject({ userId: idSchema.optional() })` with the `error` parameter. The
  optional user id exists so a workspace can eventually look at a colleague's rows; when it is
  omitted the handler uses `scope.ctx.userId`, and when it is present it is checked for membership of
  the caller's workspace before it is used — a well-formed id is not an authorised id.
- **Authorisation and tenant scoping, decided in the handler.** The read is `tenantFilter()`-bound
  through `listTravelStats`, which begins `eq(travelStats.organizationId, scope.ctx.organizationId)`
  and only then narrows by user, so a user id from another workspace returns nothing rather than
  someone else's numbers. `travel_stats` carries `organization_id NOT NULL` as the leading column of
  its unique index (`src/server/db/schema.ts:1515`).
- Nothing enqueued from here. The recompute is `00-S4`'s and stays in the queue, because five
  aggregate queries on the read path is exactly what D1's rows-read billing punishes.

### UI (route, components)

- **Route.** `/atlas`, unchanged. **No route file is added and `pnpm generate-routes` is not run.**
- **Components reused, not rebuilt** — `StatCard`, `Sparkline`, `SectionLabel`, `Tabs`, `Select`,
  `Skeleton`, `EmptyState`, `Alert`, `Badge`, `Progress` from `src/components/ui`, inside the
  existing `AtlasPanel`. No new primitive, and no second stat card.
- **The labelling this stage is bound to, and why it is not cosmetic.** `00-S4` measured what
  `recomputeTravelStats` actually aggregates, and the panel's copy is bound by that measurement
  rather than by what the figures look like:
  - Seven figures — trips, days, places, cities, spend, currency and last trip — are
    `tenantFilter()`-bound only, so every member of a workspace sees the same numbers. They are
    labelled as the workspace's and never as "your trips".
  - `country_count` **changes sides between the two row kinds**: on the all-time row it is the
    traveller's own visited list, and on a year row it is the workspace's distinct countries for that
    year, derived from `trips.country_codes`. Only the all-time figure may say "countries you have
    visited"; a year row's is labelled the workspace's, exactly like the seven above.
  - `region_count` is per-traveller and takes **no year predicate**, so it is a lifetime figure and
    nothing else. It is printed once, on the all-time row, and is omitted from year rows rather than
    being printed there with a qualifier nobody reads. _Amended by #139:_ this stage measured the
    lifetime figure as repeated on every year row; the recompute now writes it onto the all-time row
    only and leaves an explicit `0` on year rows, so the stored column agrees with the copy rule
    above instead of merely being hidden by it.
  - `by_continent` is per-traveller on both kinds and is labelled as the traveller's.
  - `distance_metres` is **omitted entirely**. No transport leg records a distance, so nothing can
    derive it and the seeder is the only thing that has ever filled it; a panel printing a permanent
    zero is worse than a panel that omits the line. `00-S4` records the same decision under its own
    Blockers and this stage carries it.
  - `year_streak` is the workspace's consecutive years, computed by `00-S4`'s handler from year rows
    whose `trip_count` is workspace-scoped, and is labelled that way.

  `stats-model.ts` is where that split lives, as data rather than as scattered conditionals, so the
  rule is testable and a future figure cannot be added without choosing a side.

- **States.**
  - _Empty:_ a workspace with no trips and no visited countries gets a designed panel on
    `--color-surface-2` — "Nothing to count yet" with one line naming the first thing to do (mark a
    country, or plan a trip) and a link to each — not a grid of zeros.
  - _Skeleton:_ the section renders `StatCard`-shaped skeletons at the settled height while
    `loadTravelStatsFn` resolves, so opening the tab does not resize the panel.
  - _Error:_ a failed load shows a `danger` `Alert` inside the section with a retry, and the rest of
    the panel — map, countries, bucket list — keeps working. A statistics failure must not take the
    atlas down.
  - _Stale:_ the fourth state, described under **Reference rows**, and the one this row exists for.
  - _Loading:_ the year `Select` and the retry take `loading` and `disabled`; figures keep their last
    value rather than blanking.
- **Motion.** A figure that changes counts up over 220ms on `--ease-out-quint` from its previous
  value, opacity and transform only; `prefers-reduced-motion: reduce` sets it immediately with no
  ramp. The stale marker fades in over 150ms and never moves anything.
- **Tokens.** None missing. Every figure carries `font-variant-numeric: tabular-nums`, without
  exception, because every one of them changes.

### Quota

**Creates no countable row, so there is no `assertQuota` call site to name.** `travel_stats` is a
derived cache — one row per user per year, upserted rather than appended, bounded by membership times
years — and this stage only reads it. Metering a
derived row would charge a tenant twice for the trips it already pays for. Nothing is added to
`resolveLimits()`, to `PLAN_QUOTAS` or to `src/server/billing/__tests__/limits.test.ts`.

The cost that does matter is D1 rows-read, and the control is that the recompute stays in the queue
and the panel reads one indexed row per year.

Entitlement: `atlas` is a key in `MODULE_KEYS`, so this panel is gated with the rest of the module by
`08-S10` in wave 3, through `assertModule`, and not by a second check here.

### Tenant isolation test

**No case is added to `src/server/repos/__tests__/tenant-isolation.test.ts`, and the reason is that
this stage adds no repository function.** `00-S4` adds the block that covers `recomputeTravelStats`,
`upsertTravelStats`, `getTravelStats` and `listTravelStats`, including the assertion an implementer
gets wrong — that a year row's `country_count` is non-zero by construction because it is derived from
`trips` rather than from the visited list.

Where this stage's boundary is proved instead: `loadTravelStatsFn` accepts an optional user id, and
the unit test named below holds that a user id from another workspace yields an empty list rather
than that workspace's figures, exercised through the same `createScope()` fixtures.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/components/atlas/__tests__/stats-model.test.ts` — the all-time row labels its country count
    as the traveller's and a year row labels its own as the workspace's; the region figure appears
    once and not on year rows; distance never appears; a year with no row is absent rather than
    zeroed; the stale predicate is true when `computed_at` precedes the newest visited-country write
    and false otherwise.
  - `src/server/fns/__tests__/atlas.test.ts` — `loadTravelStatsFn` returns rows for the caller by
    default; a foreign user id returns an empty list; the all-time row is present even when no year
    row is.
  - `src/components/atlas/__tests__/atlas-panel.test.tsx` — the statistics tab renders skeletons then
    figures; the error state leaves the map and the country list mounted; the stale marker is
    announced to assistive technology rather than being colour alone.
- Playwright, and the frames per `12-verification-protocol.md` §3 — the state that is the point of
  this stage is **not** a resting screen, it is the panel after a write:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g atlas --update-snapshots

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/atlas" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S6" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
    --state stats --click '[data-part="atlas-tab"][data-value="stats"]'
  ```

  The spec's own test marks a country, waits for the panel's figure to change, and asserts it
  matches the map's country count — the assertion this row exists for, and one no screenshot can
  make. The selector is a `data-part` attribute the panel already needs for its tabs; it is verified
  to resolve by that spec run, not by reading the JSX.

- Console must be silent: `fatal` empty in every test; the rasteriser GL advisory is the only tolerated entry
  on this route and this stage adds nothing to `TOLERATED_CONSOLE_WARNINGS`.
- Layout shift after the settle mark asserted at `0` on `chromium` — the count-up animation is
  transform and opacity and the skeletons are the settled height, so neither can shift the panel —
  and stated as a skip on `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the statistics section:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on the year selector, the tab and the retry,
      including while a recompute is in flight.
- [ ] Designed empty state on `--color-surface-2` that names the first action rather than showing a
      grid of zeros, `StatCard`-shaped skeletons at the settled height, and an error state that
      leaves the rest of the atlas working.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured — the count-up sets immediately under it.
- [ ] Light and dark parity with dark shadows re-declared, over both basemap ramps.
- [ ] 360px through 2560px: at 360px the figures are a two-column grid inside the panel sheet; at
      2560px they hold their measure instead of stretching.
- [ ] Keyboard navigable end to end, an accessible name on every figure that says whose number it is,
      and WCAG 2.2 AA in both themes — including the stale marker, which is never colour alone.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every figure
      without exception.

### Blockers

- **`travel_stats.distance_metres` has no source**, so the figure is omitted rather than printed as a
  permanent zero. `00-S4` records the same decision and
  `docs/plans/11-boundaries-and-blockers.md` carries the disposition. **Report**, not defer: nothing
  is waiting on a decision here, because no transport leg records a distance and inventing one is a
  different feature in a different plan.
- **This stage cannot start before `00-S4` closes.** It is a wave-0 stage and this is a wave-2 stage,
  so the ordering is structural rather than a risk — it is named because a reader who sees the panel
  read `listTravelStats` today might otherwise think the row is only a labelling job.

## Stage 08-S7 — Writing an entry: the story, the photographs, the timeline and the page you can send someone

### Stage id

`08-S7` · Wave 2 · effort **L**. The largest stage in this plan, and the one the journal exists for.
The screen already invites the reader to write the first entry; this is the stage that lets them.

### Reference rows

- `ADD-08` absent → **done**.

Sourced from `wiki: Journey-Entries` for the behaviour set — a dated entry with a written story, a
mood, the weather it was, an ordered set of photographs, free tags, a time and a map pin; a timeline
that reads as a story on a phone; a map of where the entries happened; and a read-only page that can
be given to somebody without an account. Described here against `journey_entries` and
`journey_photos`, which already carry every column.

`dependsOn` in the matrix names `ADD-07` and `DOC-01`. `ADD-07` is `08-S3`, wave 1, in this file.
**`DOC-01` is `06-documents-and-media.md`, wave 1** — file storage in the `FILES` R2 bucket. Measured
at HEAD, the storage half already works for trips: `src/server/fns/files.ts` exposes
`uploadTripFileFn` (`:114`), `updateTripFileFn` (`:214`), `deleteTripFileFn` (`:243`) and
`downloadTripFileFn` (`:273`), over `recordFile` (`src/server/repos/files.ts:165`). What that path
cannot do is store a photograph that belongs to no trip: `recordFile` calls `requireTrip` before it
writes. The journal therefore has its own upload path over the same bucket, and the storage
consequence is stated under **Quota** rather than hidden.

**Two behaviours from the row are not built, and each is named rather than quietly dropped.**

1. **A structured pros-and-cons pair.** `journey_entries` has no columns for it, and this plan opens
   no migration: `00-S1` absorbs schema requirements filed by **wave-1** stages, and this is a wave-2
   stage with no window of its own. The entry body is markdown with a list form, which expresses the
   same thing without a third opinion field beside `mood_id` and the body. Disposition under
   **Blockers**.
2. **Three per-section toggles on the shared page.** Same reason — the toggle state has nowhere to
   live. What ships instead is one decision made once and stated in the share dialog: a shared
   journal shows the story (entries, dates, places, photographs and moods) and never shows anything
   the workspace owns (who wrote what, counts, the mood catalogue, unattached photographs). A share
   that leaks a colleague's name because a toggle defaulted wrongly is worse than a share with no
   toggles.

### Owned paths

- `src/server/repos/journey.ts` — edit. Two new functions and the photo-recording path; `08-S3`
  holds this file in wave 1 and `08-S10` does not name it at all.
- `src/routes/_app/-server/journal.ts` — edit. Created by `08-S3`, grown here.
- `src/routes/_app/-server/__tests__/journal.test.ts` — edit.
- `src/routes/_app/-server/library.ts` — edit. **This stage holds the four-module server file for the
  whole of wave 2**, per the area brief; `08-S3` held it in wave 1 and `08-S9` holds it in wave 3.
  `JourneyEntryCard` gains the fields the timeline and the map need. One line that belongs to another
  module travels with this edit for the single reason that this stage holds the file: `loadVacay`'s
  `weekStartsOn: 1` (`:133-134`) is deleted from its return shape and from `VacayOverview`
  (`:77`). It is an unread literal; `08-S5b` (#1112) reads `data.grid.weekStartsOn` from the
  read-only handler, rather than this library field. `08-S5` reads the resolved setting through
  `src/routes/_app/-server/vacay.ts`
  instead, so leaving it would be a second answer to a question one resolver already answers. The
  deletion has exactly one owner, named here and in `08-S5`, and neither stage depends on the other's
  ordering within wave 2: `08-S5` never reads the field and nothing else does.
- `src/routes/_app/journey/$journeyId.tsx` — edit.
- `src/routes/journal/$token.tsx` — new. The public page. **A new route file, so
  `pnpm generate-routes` runs and the regenerated `src/routeTree.gen.ts` travels with this stage's
  diff. It is never hand-edited and is not listed here.**
- `src/routes/journal/-server/public.ts` — new. The unauthenticated read, deliberately route-local.
- `src/routes/journal/-ui/public-shell.tsx` — new.
- `src/components/journey/entry-composer.tsx` — new.
- `src/components/journey/entry-timeline.tsx` — new.
- `src/components/journey/entry-card.tsx` — new.
- `src/components/journey/entry-map.tsx` — new.
- `src/components/journey/photo-grid.tsx` — new.
- `src/components/journey/photo-picker.tsx` — new.
- `src/components/journey/share-dialog.tsx` — new.
- `src/components/journey/entry-model.ts` — new. Ordering, grouping and the accepted-image predicate.
- `src/components/journey/index.ts` — edit.
- `src/components/journey/__tests__/entry-model.test.ts` — new.
- `src/components/journey/__tests__/entry-composer.test.tsx` — new.
- `src/components/journey/__tests__/photo-picker.test.tsx` — new.
- `src/components/journey/__tests__/entry-timeline.test.tsx` — new.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `e2e/__screenshots__/visual.spec.ts/journey-light-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/journey-dark-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/journey-light-mobile-safari.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/journey-dark-mobile-safari.png` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.

Three files this stage deliberately does not touch, each with its owner named.
`src/server/fns/file-policy.ts` belongs to `06-S1` (`06-documents-and-media.md`, wave 1) and is the
shared upload policy; this module narrows **at its own input** instead, for the reason under **UI**.
`src/server/repos/files.ts` belongs to `06-S2` (wave 2) and `06-S6` (wave 4), and
`src/server/fns/files.ts` to `00-S3` (wave 0), `06-S1`, `06-S2` and `06-S6`; this stage reads
`getStorageUsage` from the first and writes neither.

### Data and migration

**No schema change, and none is filed.** Measured in `src/server/db/schema.ts`:

- `journey_entries` carries `type` (with `note`, `photo` and `place` among its allowed values),
  `title`, `body`, `entry_date`, `entry_time`, `location_name`, `lat`/`lng` with their CHECK,
  `weather`, `temperature_celsius` as a `real`, `tags` as JSON, `mood_id`, `source_trip_id`,
  `source_place_id` and `sort_order` as a `real` for fractional reordering.
- `journey_photos` carries `storage_key` behind a **globally unique index**
  (`journey_photos_storage_key_unq`), `thumbnail_key`, `caption`, `content_type`, `size_bytes`
  with a non-negative CHECK, `width`, `height`, `taken_at`, a lat/lng pair, `uploaded_by` and
  `sort_order`, indexed `(entry_id, sort_order)` — which is exactly the ordered gallery.
- `journeys` carries `public_token` behind a unique index, `visibility` and `status`.

Dates stay `YYYY-MM-DD` text, times `HH:MM` text, `taken_at` epoch milliseconds, ids from `newId()`.
No migration, no backfill, no index.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/journey.ts`.** Seven existing functions carry the stage:
  `createEntry` (`:560`), `updateEntry` (`:584`), `deleteEntry` (`:596`), `addPhoto` (`:600`),
  `attachPhotoToEntry` (`:612`), `deletePhoto` (`:628`) and `getJourneyStory` (`:251`). Two are
  added:
  - `recordJourneyPhoto(scope, input)` — the metered wrapper around `addPhoto`. It reads
    `getStorageUsage(scope)` from `./files` — repositories already import each other where a
    question spans two tables, as `collections.ts` does with `placesRepository` — adds this
    workspace's `journey_photos` bytes, and asserts before it writes. The order is the one
    `ARCHITECTURE.md` §6 fixes for R2: object first, assert second, compensating delete on throw.
  - `getJourneyByPublicToken(db, token)` — the **only** function in this module that does not take a
    `TenantScope`, because the public page has no session and therefore no tenant. It resolves the
    unique `public_token`, returns nothing unless the journal's status is `published`, and returns
    the story rows for that journal id and no other. Its tenant boundary is the token itself, and
    that is stated at the call site and asserted in the isolation block below rather than assumed.
- **Tenant scoping, stated rather than implied.** Every authenticated read and write is built on
  `tenantFilter()` from `src/server/repos/base.ts`, which begins
  `eq(table.organizationId, scope.ctx.organizationId)`; `journey_entries` and `journey_photos` each
  carry `organization_id NOT NULL` as the leading column of a composite index, and
  `createTenantRepository` stamps it on insert. The **one** function that has no `TenantScope` is
  `getJourneyByPublicToken`, and that exception is stated at its definition, at its single call site
  and in the isolation block below — an unscoped repository function nobody has written down is how
  the next reader copies the wrong pattern.
- **Server functions — `src/routes/_app/-server/journal.ts`**, all `POST` except where noted:
  `createEntryFn`, `updateEntryFn`, `deleteEntryFn`, `reorderEntriesFn`, `uploadEntryPhotoFn`,
  `attachPhotoFn`, `deletePhotoFn`, `setEntryPhotoOrderFn`, and `shareJourneyFn` /
  `unshareJourneyFn` over the existing `publishJourney` (`:534`) and `unpublishJourney` (`:546`).
- **The public read — `src/routes/journal/-server/public.ts`**: one `GET` function taking a token and
  returning the story. It is route-local rather than in `src/server/fns/` on purpose: it is the one
  server function in this repository that must run **without** `appScope()`, and keeping it beside
  the only route that may call it makes that visible instead of leaving an unscoped function in the
  shared directory where the next reader will copy it.
- **Zod v4**, `z.strictObject()` with the `error` parameter, reusing `createEntryInput`
  (`journey.ts:119`), `updateEntryInput` (`:122`) and `addPhotoInput` (`:125`). The token validator
  is a fixed-length opaque string with a character class, not `z.uuid()`, because
  `publishJourney` mints it; and a well-formed token is not an authorised token — the lookup, not the
  shape, is what decides.
- **Authorisation, decided in every handler and never in `beforeLoad`.**
  - Authenticated writes resolve the journal through `journeysRepository.requireById(scope, …)`
    first. Any member of the workspace may write an entry into a journal they can see; only
    `owner_user_id` may share, unshare or delete somebody else's entry.
  - The public function decides nothing from a session because there is none. It returns a story
    only when the token matches **and** the journal's status is `published`, so unsharing takes
    effect on the next request rather than when a cache expires. `unpublishJourney` clears the token,
    so a link that has been revoked cannot be revived by pasting the old one.
  - The public route is `ssr: true` and reads nothing from the app shell: it must render for a
    visitor with no session and no workspace, which is a different contract from every other route in
    this repository and is why it lives outside `_app/`.
- **Nothing slow inline.** A photograph is streamed to R2 in the request that uploads it — that is
  the one bounded piece of I/O — and thumbnailing is **not** attempted: the `thumbnail` task kind is
  declared in `src/server/queue/types.ts` with no handler, and `thumbnail_key` stays null until a
  stage owns it. The gallery renders the original at a constrained size and the payload cost is
  stated rather than pretended away. No realtime patch: a journal has no room.

### UI (route, components)

- **Routes.** `/journey/$journeyId` exists and is extended. `/journal/$token` is **new**, so
  `pnpm generate-routes` is a step of this stage.
- **Components reused, not rebuilt** — `Dialog`, `Sheet`, `Textarea`, `Input`, `Select`,
  `Combobox`, `DatePicker`, `Button`, `IconButton`, `Chip`, `Badge`, `Avatar`, `Card`,
  `EmptyState`, `Skeleton`, `Alert`, `Progress`, `Toast`, `ScrollArea`, `Separator`. The map is the
  existing MapLibre setup in `src/components/map` and `src/lib/map`, not a second one. The body
  renders through **`src/lib/markdown` from `01-S2`** (`01-trips-core.md`, wave 1) — the single
  restricted-subset implementation `11-S2` entry 5 assigns to the earliest wave-1 stage that needs
  one. This stage writes no parser and no sanitiser.
- **New components.**
  - `EntryComposer` — a `Sheet` on small screens and a `Dialog` on large: date, optional time, title,
    markdown body with a live preview, mood as a row of the workspace's own mood chips, weather and
    temperature, tags as a `Combobox` over tags already used in the journal, an optional place pin
    picked on a small map or copied from an anchor entry, and the photo strip. It edits as well as
    creates, from the same component and the same validator.
  - `EntryTimeline` and `EntryCard` — the story, grouped by date with a sticky date rail, ordered by
    `entry_date` then `sort_order`. On a phone it is a single column with the photographs full-bleed;
    on a wide screen the date rail moves to the side and the measure is capped so a long body stays
    readable rather than stretching to 2560px.
  - `EntryMap` — one canvas over the entries that have a pin, with the same `[data-map-ready]`
    marker every map wrapper in the product publishes, because `settleMap()` audits that in both
    directions. Selecting a pin scrolls its entry into view and selecting an entry highlights its
    pin; the two directions share one reducer.
  - `PhotoGrid` and `PhotoPicker` — an ordered gallery with drag reordering through `@dnd-kit`
    (already a dependency and already used by the planner) and a keyboard alternative that moves a
    photograph with `Ctrl`-arrow, because a drag that has no keyboard equivalent is not navigable.
    The picker offers both a file input and the journal's unattached photographs, which
    `loadJourneyStory` already counts (`library.ts:683`).
  - `ShareDialog` — the token link with a copy button, what the page will show stated in plain
    sentences, and a revoke that says the link stops working immediately.
  - `PublicShell` (`src/routes/journal/-ui/`) — the public page's own chrome: a title, a date range,
    the timeline, and a single quiet line identifying the product. It is **not** the guest shell
    `07-S6` builds for shared trips, and the difference is deliberate rather than accidental: that
    one carries tabs, a currency and a member list, and this one is a magazine page whose whole
    content is the story. Two shells with two jobs, not one shell forced to do both.
- **The image formats this module accepts, measured rather than assumed.**
  `src/server/fns/file-policy.ts:41-48` accepts `image/heic` and `image/heif` among the upload types.
  No browser in our support matrix decodes either, and no package in the pinned set converts them, so
  a journal that stored one would show a broken frame in its own gallery. **This module narrows at
  its own input** — `png`, `jpeg`, `webp`, `avif`, `gif` — and rejects the rest at the boundary with
  a designed error naming the formats that work and what to do about it. The shared policy file is
  not edited: it governs trip documents too, where an undisplayable original is still a valid
  attachment. `entry-model.ts` holds the predicate so the client refuses before the upload starts and
  the server refuses again, which is the only order that is both fast and safe.
- **States.**
  - _Empty:_ the existing "This journey has no entries yet" card keeps its copy and gains the primary
    "Write the first entry" action that opens the composer — the invitation the screen has been
    making since it shipped.
  - _Empty gallery:_ on `--color-surface-2`, "No photographs on this entry" with the picker beside
    it.
  - _Empty map:_ when no entry has a pin, the map is not rendered at all and a line explains what
    pinning an entry does — a blank canvas is not an empty state.
  - _Skeleton:_ the timeline renders three entry-card skeletons at the settled height, with a photo
    strip placeholder, so the story does not jump as it resolves.
  - _Error:_ a failed save keeps the composer open with every field intact and shows a `danger`
    `Alert` naming the failure; a failed upload marks that one photograph as failed inside the strip
    with a retry, and does not lose the others; a failed public load renders a designed page that
    says the link is no longer available, never a stack trace and never the app shell.
  - _Loading:_ the save button takes `loading`; each uploading photograph shows a determinate
    `Progress` over its own tile; the entry being reordered stays visible at reduced opacity.
- **Motion.** Entries enter on a 220ms opacity and 6px translate on `--ease-out-quint`, staggered
  24ms and capped at eight. The sheet uses `--ease-drawer`. Reordering animates transform only.
  `prefers-reduced-motion: reduce` collapses everything to opacity and removes the stagger.
- **Tokens.** None missing. The public page uses the same token contract as the app, so it is dark
  and light aware without a second palette.

### Quota

**Two metrics, both existing, both asserted before the write.**

- `files` — `assertQuota(scope, 'files', usage.fileCount)` inside `recordJourneyPhoto` in
  `src/server/repos/journey.ts`, before the `journey_photos` row is inserted, exactly as `recordFile`
  does at `src/server/repos/files.ts:170`.
- `storage_bytes` — `assertQuota(scope, 'storage_bytes', usage.bytes, values.sizeBytes)` at the same
  call site, with the photograph's own size as the `additional` argument, as at `:171`. For R2 the order is fixed by `ARCHITECTURE.md` §6 and is followed here: **the object is
  written first, the quota is asserted second, and the object is deleted if the assertion throws**,
  because a dangling object is a cleanup job and a dangling row is a broken gallery.

Both metrics already exist in `PLAN_QUOTAS` (`src/server/db/types.ts:41-70`) and in
`resolveLimits()` for `storage_bytes`, so **nothing is added to the catalogue and no case is added to
`src/server/billing/__tests__/limits.test.ts`.**

**One asymmetry, stated rather than hidden.** `getStorageUsage` in `src/server/repos/files.ts`
counts `trip_files` only. `recordJourneyPhoto` therefore counts journal bytes on top of it, so the
journal cannot exceed the ceiling — but a **trip** upload still sees only trip bytes and will not
notice journal photographs. Making that symmetric means editing `getStorageUsage` in `src/server/repos/files.ts`, which
`06-documents-and-media.md` claims for `06-S2` in wave 2 — the same wave as this stage, so a second
claimant would clobber it. The requirement is recorded here for `06-S2` to absorb: one function, one
extra sum, and the same ceiling for both writers.

Entry rows themselves consume no metric: they are children of a journal that already passed the
`journeys` ceiling, and metering the sentences inside a journal would be metering the product.

Entitlement: `journal` is a key in `MODULE_KEYS`, so this module is gated by `08-S10` in wave 3
through `assertModule`. The **public** page is deliberately outside that gate and says why in that
stage: revoking a plan must stop new writes, not break a link a traveller has already given to their
family.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope, against B's ids: `createEntry` parented on B's journal, `updateEntry`, `deleteEntry`,
`addPhoto`, `attachPhotoToEntry` and `deletePhoto` on B's rows each reject with `NotFoundError`, and
B's `journey_entries` and `journey_photos` counts are unchanged. The reverse read:
`listJourneyEntries(scopeB, aJourneyId)` — a `findMany`, so `[]` — and
`journeyEntriesRepository.requireById(scopeB, aEntryId)` — a throw. Both asserted.

Three cases are the point of the block:

1. `attachPhotoToEntry(scopeA, aPhotoId, bEntryId)` — A's own photograph onto B's entry. It must
   reject and leave the photograph unattached, because this is the one call that names two ids and a
   filter on only the first would look correct.
2. `recordJourneyPhoto` in A's scope counts **A's** bytes only. Seed B with a large photograph and
   assert A's assertion is unaffected by it, because a storage ceiling that leaked across tenants
   would be a denial-of-service one tenant could buy for another.
3. `getJourneyByPublicToken` is the function with no `TenantScope`, so it gets the block's most
   explicit case: a token belonging to B's journal returns **B's** story and nothing of A's, a token
   for a journal whose status is not `published` returns nothing, and a token that has been revoked
   returns nothing. The assertion that matters is the negative one — the returned story contains no
   row from any other journal, and no field that names a member of either workspace.

Functions covered: `createEntry`, `updateEntry`, `deleteEntry`, `listJourneyEntries`,
`getJourneyStory`, `addPhoto`, `recordJourneyPhoto`, `attachPhotoToEntry`, `deletePhoto`,
`publishJourney`, `unpublishJourney`, `getJourneyByPublicToken`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Plus
  `pnpm generate-routes`, run before the gate because a new route file is added, with the regenerated
  tree in the diff.
- Unit tests:
  - `src/components/journey/__tests__/entry-model.test.ts` — entries order by date then
    `sort_order`, and a fractional reorder between two neighbours produces a value strictly between
    them; the accepted-format predicate rejects the camera format and accepts the five that render;
    grouping by date puts a timeless entry after the timed ones on the same day rather than before
    them.
  - `src/components/journey/__tests__/entry-composer.test.tsx` — a date is required and nothing else
    is; the preview renders through `src/lib/markdown` and not through `dangerouslySetInnerHTML`; a
    rejected save keeps every field; `Escape` closes only after confirming when the body is dirty.
  - `src/components/journey/__tests__/photo-picker.test.tsx` — a rejected format never starts an
    upload and names the formats that work; one failed upload leaves the others intact;
    `Ctrl`-arrow reorders without a pointer and announces the new position.
  - `src/components/journey/__tests__/entry-timeline.test.tsx` — selecting a pin scrolls its entry
    into view and selecting an entry highlights its pin, from one reducer and not two.
  - `src/routes/_app/-server/__tests__/journal.test.ts` — a non-owner cannot share or delete
    another member's entry; an oversized photograph is rejected and the R2 object is deleted rather
    than orphaned; unsharing clears the token and a subsequent read with the old token returns
    nothing.
- Playwright:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g journey --update-snapshots
  ```

  The spec's route table declares `/journey/$journeyId` with `map: true` once the entry map ships —
  `settleMap()` fails a route that renders the marker without declaring it and one that declares it
  and renders none, so the flag and the canvas travel together. `/journal/$token` is declared as a
  **public** route case reached with a fresh context that has no storage state, which is the only way
  to prove a page is genuinely reachable without a session. `auditServerClock()` is called once over
  the spec's own table. No entry is added to `RELATIVE_TIME_SITES`: the timeline prints absolute
  dates through `src/lib/format.ts`, deliberately, so nothing on the screen is clock-derived and
  `e2e/helpers/shoot.ts` is not claimed by this stage.

- Frames, per `12-verification-protocol.md` §3, over three surfaces — the story route, the composer
  state and the public page:

  ```sh
  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/journey" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S7" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
    --state composer --click '[data-part="journey-entry-new"]'
  ```

  and the public page captured **without** `--auth`, which is the whole claim being made about it.
  Every selector is a `data-part` attribute this stage publishes and is verified to resolve by the
  spec run reaching the same state.

- Console must be silent: `fatal` empty in every test, including on the public page where a hydration
  mismatch would be easiest to introduce and is never tolerable — React 19 surfaces one as an
  uncaught error and a `console.error`, both fatal before the tolerance list is consulted.
- Layout shift after the settle mark asserted at `0` on `chromium`, which is the reason every
  photograph tile reserves its aspect ratio from the stored `width` and `height` before the image
  loads; stated as a skip on `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the composer, the timeline, the gallery, the entry map
and the public page — five surfaces, so thirty frames:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every control, including each uploading
      tile and each reordering handle.
- [ ] Designed empty states on `--color-surface-2` for no entries, no photographs and no pins;
      entry-card skeletons at the settled height; and error states that keep the composer's contents
      and retry one failed upload without losing the rest.
- [ ] Motion 150–260ms on `--ease-out-quint` or `--ease-drawer`, transform and opacity only, stagger
      capped at eight, `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared, on the public page as well as inside the
      app — a shared link opens in whichever theme the reader's system prefers and is designed for
      both.
- [ ] 360px through 2560px: at 360px the composer is a full-height sheet and the timeline is one
      column with full-bleed photographs; at 2560px the body keeps a readable measure rather than
      stretching.
- [ ] Keyboard navigable end to end — including reordering photographs and placing a pin — with
      accessible names on every control, and WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every count
      and every temperature.

### Blockers

- **Camera-format photographs are rejected, not converted — BLOCKED.** `image/heic` and `image/heif`
  are accepted by `src/server/fns/file-policy.ts:41-48`, decoded by no browser we support, and
  converted by no package in the SPEC §3 pinned set. Disposition: **defer**, as
  `docs/plans/11-boundaries-and-blockers.md` entry 10 of `11-S2` records — it waits on the
  image-transformation binding decision in `11-S3`. Until then this module rejects them at its own
  input with a designed error. This is the one deferral in this plan with a visible product cost and
  it is stated as such.
- **Thumbnails are not generated — BLOCKED on the same binding.** The `thumbnail` task kind is
  declared in `src/server/queue/types.ts` with no handler, so `thumbnail_key` stays null and the
  gallery renders originals at a constrained size. Disposition: **report**, to
  `docs/plans/11-boundaries-and-blockers.md`, which carries the image-transformation binding decision
  in `11-S3`. This stage invents no substitute and installs nothing.
- **A markdown renderer is not in the SPEC §3 pinned dependency set**, and the entry body needs one.
  **BLOCKED on a decision already taken**: `docs/plans/11-boundaries-and-blockers.md`, entry 5 of
  `11-S2`, records the verdict — stop and report, do not install — and assigns the single
  restricted-subset implementation to the earliest wave-1 stage that needs one, which is `01-S2`
  (`01-trips-core.md`). Disposition: **hand-roll, once, elsewhere.** This stage consumes
  `src/lib/markdown` and writes neither a parser nor a sanitiser, and it does not start if `01-S2`
  has not landed. No package is assumed present.
- **Pros and cons, and the three share toggles**, both deferred for want of columns, as argued under
  **Reference rows**. Disposition: **defer**. Neither is filed as a wave-0 requirement, because
  `00-S1` absorbs requirements from wave-1 stages and this is a wave-2 stage.

## Stage 08-S8 — Two travellers, one calendar: joining a plan, logging for each other, and leaving without losing anything

### Stage id

`08-S8` · Wave 3 · effort **L**. The leave planner stops being one person's diary. A colleague is
invited, accepts, and appears in the same grid with their own colour; either of them can log a day
for the other; and leaving takes nothing with it.

### Reference rows

- `ADD-04` partial → **done**.

Sourced from `wiki: Vacay-Sharing` for the behaviour set — an invitation a colleague accepts or
declines, a merged year in which several people's absences sit side by side, days that can be logged
on somebody else's behalf, and a separation that leaves both parties' history intact. Described here
against `vacay_plan_members`, `vacay_user_colours` and `vacay_entries`, which already exist.

`dependsOn` names `ADD-02`, `COL-01` and `ACC-05`. `ADD-02` is `08-S1` in this file, wave 1.
`COL-01` is `07-S1` (`07-collaboration-and-sharing.md`, wave 1). `ACC-05` is
`09-account-and-settings.md`, wave 2 — the notification matrix — and it is a genuine dependency: an
invitation nobody is told about is not an invitation.

**What is already done and is not rebuilt.** The merged read ships: `getPlanOverview`
(`src/server/repos/vacay.ts:572`) already unions the owner, the members and everyone with an entry
into one balance list, and `vacay.tsx:174-215` already renders the traveller list with per-person
swatches and used-day counts. Nothing in that is redesigned. What is missing is every write behind
it: `invitePlanMember` (`:207`), `setPlanMemberStatus` (`:224`), `removePlanMember` (`:234`) and
`setUserColour` (`:248`) have no production caller — the dev seeder reaches all but
`removePlanMember`, which nothing calls, and `setUserColour` is also exercised by
`src/server/repos/__tests__/tenant-isolation.test.ts:468`.

**A contradiction with the row, stated with evidence.** The row expects "live sync over named
events". **We have exactly one realtime primitive and it is addressed by trip id.** Measured:
`TripRoom` (`src/server/do/trip-room.ts`) is one Durable Object per trip, bound as `TRIP_ROOM` in
`wrangler.jsonc` and re-exported from `src/server/worker.ts`; a leave plan has no trip. A second
Durable Object class means editing both of those files, which `README.md` lists among the six shared
paths no feature stage may claim, and there is no wave-0 window left for a wave-3 stage to file one
through. So the merged grid **re-reads on invalidation** rather than streaming: a colleague's change
appears on the next load or the next write, and the invitation itself is delivered as a notification,
which is the part a traveller actually needs to be told about. The disposition is under **Blockers**,
and the row's outcome — several people's absences in one grid, kept in step — is met by a different
mechanism rather than dropped.

### Owned paths

- `src/server/repos/vacay.ts` — edit. One new function (`leavePlan`); `08-S1` held this file in wave
  1 and `08-S5` in wave 2, and neither is in this wave.
- `src/routes/_app/-server/vacay.ts` — edit.
- `src/routes/_app/-server/__tests__/vacay.test.ts` — edit.
- `src/routes/_app/vacay.tsx` — edit.
- `src/components/vacay/plan-members.tsx` — new.
- `src/components/vacay/invite-dialog.tsx` — new.
- `src/components/vacay/colour-picker.tsx` — new.
- `src/components/vacay/index.ts` — edit.
- `src/components/vacay/__tests__/plan-members.test.tsx` — new.
- `src/components/vacay/__tests__/invite-dialog.test.tsx` — new.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `e2e/__screenshots__/visual.spec.ts/vacay-light-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-dark-chromium.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-light-mobile-safari.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/vacay-dark-mobile-safari.png` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.

The four `vacay-*` baselines are re-recorded here for the third and last time in this plan, after
`08-S1` (wave 1) and `08-S5` (wave 2). This stage does not claim
`src/routes/_app/-server/library.ts`, which `08-S9` holds in wave 3.

### Data and migration

**No schema change, and none is filed.** `vacay_plan_members` already carries `plan_id`, `user_id`
and `status` behind `VACAY_MEMBER_STATUSES` (`pending`, `accepted`, `declined`);
`vacay_user_colours` already carries the per-plan swatch; `vacay_entries` already carries `user_id`
independently of who wrote the row, which is what makes logging on somebody's behalf expressible
without a column. `notifications` already carries `title_key`, `body_key` and a `params` JSON record.
No migration, no backfill, no index.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/vacay.ts`.** Four existing functions carry the membership:
  `invitePlanMember` (`:207`), `setPlanMemberStatus` (`:224`), `removePlanMember` (`:234`) and
  `setUserColour` (`:248`). One is added, and it is the row's "lossless" clause:

  `leavePlan(scope, planId, userId)` — moves that traveller's `vacay_entries` for the plan onto
  their **own** plan, obtained through `ensurePlan(scope, userId)` (`:142`), carries their
  `vacay_user_years` entitlement rows across for the same years, and only then removes the membership
  row. Every step runs inside `runBatch`, so a half-dissolved plan is not a state the product can
  reach. Removing the membership first and moving afterwards would be the same code in the order that
  loses data if the second half fails, which is why the order is stated here rather than left to the
  implementer.

- **Tenant scoping, stated rather than implied.** Every read and write is built on `tenantFilter()`
  from `src/server/repos/base.ts`, which begins
  `eq(table.organizationId, scope.ctx.organizationId)`; `vacay_plan_members`, `vacay_user_colours`
  and `vacay_entries` each carry `organization_id NOT NULL` as the leading column of a composite
  index, and the dissolve's move runs entirely inside one scope, so entries cannot land in a plan
  belonging to another workspace even when both ids are supplied by the client.
- **Server functions — `src/routes/_app/-server/vacay.ts`**, all `POST`:
  `invitePlanMemberFn`, `respondToPlanInviteFn` (accept or decline), `leavePlanFn`,
  `removePlanMemberFn` and `setPlanColourFn`.

- **The invitation is delivered, not merely recorded.** `invitePlanMemberFn` calls `notify()`
  (`src/server/repos/notifications.ts:129`) — the write path `00-S2` supplies in wave 0 — with a
  `titleKey`, a `bodyKey` and a `params` record, **never a rendered sentence**: that module stores
  keys deliberately so a notification written a year ago still renders in the reader's current
  language, and this stage does not break that contract. The keys it mints are new members of the
  catalogue and are rendered by the existing sites in
  `src/routes/_app/notifications.tsx` and `src/components/layout/notification-bell.tsx`. Whether the
  reader is also emailed is `ACC-05`'s matrix decision and this stage does not second-guess it.

- **Zod v4**, `z.strictObject()` with the `error` parameter. The invite input is
  `{ planId: idSchema, userId: idSchema }` — a **workspace member's** id, because
  `vacay_plan_members.user_id` is a `userRef` and a leave plan is not a way to bring somebody into a
  workspace. Inviting a stranger is `ADM-02`'s job (`10-administration.md`) and this stage links to
  it rather than growing a second invitation system.
- **Authorisation, decided in every handler.**
  - Only the plan's `owner_user_id` may invite or remove.
  - Only the invited user may accept or decline their own row: the handler compares the membership
    row's `user_id` with `scope.ctx.userId` and rejects otherwise. A well-formed membership id from
    the client is not an authorised one.
  - Logging a day **for** somebody is extended from `08-S1`'s rule: the plan owner may, and so may a
    member whose `vacay_plan_members.status` is `accepted` — a shared calendar in which only one
    person may write is not shared. A `pending` or `declined` member may not, and the grid does not
    offer it to them.
  - Everyone resolves the plan through `vacayPlansRepository.requireById(scope, …)` first.
  - `leavePlan` is the caller's own membership; `removePlanMember` is the owner's action on somebody
    else's, and both funnel into the same lossless move so that "removed" and "left" cannot diverge.
- Nothing enqueued and nothing slow: the dissolve is bounded by one traveller's entries in one plan
  and runs in one batch.

### UI (route, components)

- **Route.** `/vacay`, unchanged. **No route file is added and `pnpm generate-routes` is not run.**
- **Components reused, not rebuilt** — `Dialog`, `Combobox`, `AvatarStack`, `Avatar`, `Badge`,
  `Button`, `IconButton`, `Alert`, `EmptyState`, `Skeleton`, `Toast`, `Popover`, plus `Panel` from
  `-ui/scaffold.tsx` and `MonthGrid` and `DayCell` from `08-S5`, which are given a "logging for"
  subject rather than a second grid.
- **New components.**
  - `PlanMembers` — the existing traveller list becomes a membership surface: each row carries the
    person, their swatch, their used days, their status as a `Badge` (`pending` in a muted tone,
    `declined` struck through and dimmed), and an owner-only overflow menu with remove. The viewer's
    own row carries "Leave this plan", which is the same write from the other side.
  - `InviteDialog` — a `Combobox` over the workspace's members who are not already on the plan,
    showing avatar and name, with the invitation's effect stated in one line before it is sent.
  - `ColourPicker` — a `Popover` of swatches from the token palette plus the stored value, with the
    contrast of the numeral that will sit on it checked by the same measured `inkOn()` helper the
    grid uses, so a traveller cannot pick a colour that makes their own dates unreadable.
  - **The "logging for" affordance.** When the viewer may write for someone else, the grid header
    carries a subject selector: their own name by default, a colleague when chosen. The selected
    subject changes the cell preview colour and the accessible name of every cell, so it is never
    ambiguous whose day a click will take. Choosing a subject does not re-fetch the year.
- **States.**
  - _Members, alone:_ on `--color-surface-2`, "Only you on this plan" with one line on what fusing
    does and the invite action beside it.
  - _Invitation pending:_ the invitee's own screen shows a persistent `Alert` above the grid naming
    the inviter, with Accept and Decline; declining collapses it and does not re-appear on reload.
  - _Skeleton:_ the traveller list renders three rows of `Skeleton` at the settled height.
  - _Error:_ a failed invite keeps the dialog open with the person selected; a failed leave shows a
    `danger` `Alert` and — this is the one that matters — states explicitly that nothing was moved,
    because the batch is atomic and a traveller who has just been told "leaving failed" needs to know
    their year is intact.
  - _Loading:_ every action takes `loading` and `disabled`; the leave action asks for confirmation
    first and the confirmation names where the entries will go.
- **Motion.** Rows enter on 200ms opacity and 4px translate on `--ease-out-quint`, staggered 24ms,
  capped at eight; the swatch popover uses the primitive's own transition.
  `prefers-reduced-motion: reduce` collapses to opacity.
- **Tokens.** None missing.

### Quota

**The metric is `members`, and the assertion is the one that already exists.** A plan membership is a
row per workspace member per plan, and the population of workspace members is asserted at
`src/server/repos/members.ts:160` and `:276` through `assertQuota(scope, 'members', …)`. Because
`vacay_plan_members.user_id` must be an existing workspace member — the input accepts nothing else —
this stage cannot grow the seat count and therefore adds no assertion of its own. Minting a second
metric would charge twice for one seat and the published seat number would stop being the enforced
one.

`vacay_user_colours` is one row per traveller per plan and `notifications` rows are bounded by the
invitations that produced them. Nothing is added to `resolveLimits()`, to `PLAN_QUOTAS` or to
`src/server/billing/__tests__/limits.test.ts`.

Entitlement: the leave planner has no key in `MODULE_KEYS` (`src/lib/plans.ts:126-139`), so there is
nothing to gate and none is invented. `collaboration` is a key, and it deliberately is **not** read
here: it sells inviting people to a **trip**, and stretching it to cover a leave plan would be a
product decision made in a repository. `08-S10` states the rule and this stage follows it.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope, against B's ids: `invitePlanMember` on B's plan, `setPlanMemberStatus` on B's
membership row, `removePlanMember`, `setUserColour` and `leavePlan` each reject with `NotFoundError`,
and B's `vacay_plan_members`, `vacay_user_colours` and `vacay_entries` counts are unchanged.

Two cases are the point of the block:

1. `invitePlanMember(scopeA, aPlanId, bUserId)` — A's own plan, a user id belonging only to B's
   workspace. The membership row must not be written. `vacay_plan_members.user_id` is a `userRef`
   with no database-level foreign key, so nothing below the repository stops a foreign id from being
   stored; the handler's membership check is the whole defence and this case is what proves it
   exists.
2. `leavePlan` in A's scope for A's own plan, run while B has entries on the same dates: A's entries
   move to A's own plan and B's are untouched. The dissolve is the one operation in this module that
   both reads and writes across two plans, which is where a missing filter would be invisible.

Functions covered: `listPlanMembers`, `invitePlanMember`, `setPlanMemberStatus`, `removePlanMember`,
`listUserColours`, `setUserColour`, `leavePlan`, and `notify` as called by the invite path.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/routes/_app/-server/__tests__/vacay.test.ts` — only the owner may invite or remove; only
    the invitee may accept their own invitation; an `accepted` member may log a day for a colleague
    and a `pending` one may not; a failed dissolve moves nothing; the invite writes a key-based
    notification and never a rendered sentence.
  - `src/components/vacay/__tests__/plan-members.test.tsx` — the owner sees remove and the member
    does not; the viewer's own row offers leave; the confirmation names where entries will go; status
    is conveyed by text as well as by tone.
  - `src/components/vacay/__tests__/invite-dialog.test.tsx` — members already on the plan are absent
    from the combobox; a rejected invite keeps the selection; the dialog returns focus to its
    trigger.
- Playwright, and the frames per `12-verification-protocol.md` §3 — the state that matters is the
  merged grid with two travellers on it, which the resting single-traveller screen cannot show:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g vacay --update-snapshots

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/vacay?year=2026" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S8" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
    --state invite --click '[data-part="vacay-invite"]'
  ```

  A second state set, `--state subject`, is taken with the "logging for" selector open. Both
  selectors are `data-part` attributes this stage publishes and both are verified to resolve by the
  spec run reaching them.

- Console must be silent: `fatal` empty in every test.
- Layout shift after the settle mark asserted at `0` on `chromium`, stated as a skip on
  `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the membership panel, the invite dialog, the colour
picker and the subject selector:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every control, including an invitation
      being sent and a dissolve in flight.
- [ ] Designed empty state on `--color-surface-2` for a plan with one person, skeleton rows at the
      settled height, and an error state that says explicitly that nothing was moved.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, stagger capped at eight,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared, and every selectable swatch checked for AA
      contrast against the numeral in both themes — the picker refuses a pair that fails.
- [ ] 360px through 2560px: at 360px the membership panel is above the grid and the invite dialog is
      a full-height sheet.
- [ ] Keyboard navigable end to end, accessible names that say whose day a cell is, WCAG 2.2 AA in
      both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every count.

### Blockers

- **No realtime for a leave plan.** Measured above: the only Durable Object is per trip, and a
  second class means editing `src/server/worker.ts` and `wrangler.jsonc`, both shared paths a
  feature stage may not claim. Disposition: **defer**, and the row's outcome is met by re-reading on
  invalidation plus a notification for the invitation. A future stage that wants streaming files the
  binding requirement through wave 0 rather than reaching into those two files.
- **`ACC-05` must have landed.** The notification matrix (`09-account-and-settings.md`, wave 2)
  decides how an invitation reaches a person who is not looking at the screen. This stage writes the
  notification through `notify()` regardless — that path is `00-S2`'s and lands in wave 0 — but the
  channel choice is not this stage's to make.
- Nothing else. No package outside the SPEC §3 pinned set, no new binding, no third-party service.

## Stage 08-S9 — Places into collections: saving them, copying them, reading one closely, and deciding who else may

### Stage id

`08-S9` · Wave 3 · effort **L**. A collection can be created today and nothing can be put in it. This
stage supplies every path a place takes into a list, the sheet that shows one properly, the filters
that narrow the list and its map together, the bulk actions over a selection, and the sharing rule
that decides who may do any of it.

### Reference rows

- `ADD-10` absent → **partial**. The residue, its owner and the rule that makes it a `partial`
  rather than a `done` are stated below and in the area brief.

Sourced from `wiki: Collections-Places` for the behaviour set — saving a place into one or several
lists at once, copying a set of places between lists without producing duplicates, a detail view of
one saved place, filters that narrow the list and the map together, a handful of actions over a
selection, and a sharing setting per list. Described here against `collection_places`,
`collection_labels` and `collections`, which already exist.

`dependsOn` names `ADD-09` and `MAP-02`. `ADD-09` is `08-S4`, wave 1, in this file. **`MAP-02` is
owned by `02-places-and-maps.md` `02-S13`, which is wave 6 and is BLOCKED** — that plan writes the
stage out in full, schedules none of it, and holds it behind Gate A, the geocoding and place-search
provider decision owned by `docs/plans/11-boundaries-and-blockers.md` `11-S3`. There is no date on
which it lands, and this stage plans as if it never does.

That is why the row **does not close here**. Search-and-add is one of the three ways `ADD-10` names
of getting a place into a list, it has no entry point without a geocoder, and nothing on this screen
can stand in for it — so the row is recorded `absent → partial`, `02-S13` is named as the stage that
closes it, and this stage claims only what a traveller can actually do. The other two ways ship in
full. The consequence is scoped rather than assumed: every path into a collection that does not need
a geocoder ships now, the search-and-add path **consumes `02-S13`'s search component** on the day it
exists, and until then the search entry point is absent rather than stubbed — a disabled control with
no explanation is worse than no control. This stage builds no second search and no second geocoder.

**Two contradictions with the row, stated with evidence.**

1. The row asks for **per-list viewer, editor and admin roles**. There is no member entity for a
   collection and this plan opens no migration: `collections.visibility`
   (`src/server/db/schema.ts:210`) is a three-value enum and nothing else. But a second role system
   would be the wrong answer even with a migration, because the workspace already has one:
   `src/server/repos/context.ts:15-16` ranks `owner`, `admin` and `member`, with `hasAtLeastRole`
   (`:117`), `assertRole` (`:122`) and `assertCanAdminister` (`:136`). This stage therefore maps the
   row's three roles onto the two authorities that exist — the list's `owner_user_id` and the
   caller's workspace role — and says so on the sharing surface in plain words rather than inventing
   a per-list rank nobody administers.
2. The enum's third value, `public`, **is not offered**. A public list needs a share token and a
   route that serves it without a session; `collections` has no `public_token` column, unlike
   `journeys`, which does. The picker offers the two values that are enforceable and the third is
   recorded under **Blockers** rather than shown as a setting that does nothing.

### Owned paths

- `src/server/repos/collections.ts` — edit. The quota assertion, the de-duplicating bulk copy and the
  server-side narrowing; `08-S4` held this file in wave 1.
- `src/routes/_app/-server/collections.ts` — edit. Created by `08-S4`, grown here.
- `src/routes/_app/-server/__tests__/collections.test.ts` — edit.
- `src/routes/_app/-server/library.ts` — edit. **This stage holds the four-module server file for the
  whole of wave 3**, per the area brief; `08-S3` held it in wave 1 and `08-S7` in wave 2.
  `loadCollectionDetail` gains server-side narrowing and the viewer's own permissions.
- `src/routes/_app/collections/$collectionId.tsx` — edit.
- `src/routes/_app/collections/index.tsx` — edit. `08-S3` held this file in wave 1 for the dialog
  move; this stage adds the per-card actions in wave 3.
- `src/components/collections/place-sheet.tsx` — new.
- `src/components/collections/save-to-collection.tsx` — new.
- `src/components/collections/bulk-bar.tsx` — new.
- `src/components/collections/collection-map.tsx` — new.
- `src/components/collections/sharing-dialog.tsx` — new.
- `src/components/collections/selection.ts` — new. The pure selection and de-duplication model.
- `src/components/collections/index.ts` — edit. Created by `08-S3`; this stage folds in `08-S4`'s
  components and its own, which is the first wave in which one stage can hold it alone.
- `src/components/collections/__tests__/selection.test.ts` — new.
- `src/components/collections/__tests__/place-sheet.test.tsx` — new.
- `src/components/collections/__tests__/bulk-bar.test.tsx` — new.
- `src/components/collections/__tests__/save-to-collection.test.tsx` — new.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.

No baseline in `e2e/__screenshots__/visual.spec.ts/` is re-recorded: `/collections` is in neither
`PUBLIC_ROUTES` nor `APP_ROUTES`, so this plan's own spec file holds every frame of it.
`src/server/repos/places.ts` is **not** claimed — it belongs to `02-places-and-maps.md`, whose
`02-S6` owns it in wave 4. `createPlace` is imported and called, exactly as
`src/server/repos/collections.ts` already imports `placesRepository` and `categoriesRepository`.

### Data and migration

**No schema change, and none is filed.** `collection_places` already carries the full denormalised
place — `name`, `description`, `notes`, `lat`/`lng` with their CHECK, `address`, `city`,
`country_code`, `website`, `phone`, `image_url`, `price_minor` with a `text(3)` currency,
`category_id`, `status` behind `collection_places_status_chk`, `source`, `external_id`,
`source_trip_id`, `source_place_id`, `saved_by` and a `real` `sort_order`. That denormalisation is
the feature, not an accident: a saved place survives the trip it came from being deleted.
`collection_place_labels` is the join. No migration, no backfill, no index.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/collections.ts`.** Four existing functions carry the writes:
  `addCollectionPlace` (`:330`), `saveTripPlaceToCollection` (`:363`), `updateCollectionPlace`
  (`:398`) and `deleteCollectionPlace` (`:420`). Three are added:
  - `copyPlacesToCollection(scope, { fromIds, toCollectionId })` — the bulk copy, **de-duplicating on
    `source_place_id` first and on a normalised `(name, lat, lng)` triple second**, so copying the
    same set twice adds nothing and copying two lists that overlap adds each place once. It reports
    what it added and what it skipped, because a silent skip reads as a failed action.
  - `copyPlacesToTrip(scope, { collectionPlaceIds, tripId, dayId })` — the other direction, over
    `createPlace` from `./places`, which already asserts the `places` ceiling at
    `src/server/repos/places.ts:269`. The copied trip place keeps `source` provenance; the collection
    row is left where it is, because copying is not moving and the row says so.
  - `listCollectionPlacesFiltered(scope, input)` — the narrowing `08-S4` deliberately left on the
    client, moved to the server now that a list can grow: statuses as an `IN`, labels as an
    **any-of** over the join, and a keyset page on `sort_order` then id. Built on `tenantFilter()`
    like everything else in the module. It **resolves the collection through
    `collectionsRepository.requireById(scope, input.collectionId)` before it reads**, deliberately
    unlike its sibling `listCollectionPlaces` (`src/server/repos/collections.ts:214`), which filters
    only and therefore answers a foreign collection id with `[]`. A paged read must be able to say
    "no such list" rather than "this list is empty", because the caller pages until it is told to
    stop; the tenant test asserts both shapes so neither is mistaken for the other.
- **The quota assertion this module has never had.** `addCollectionPlace`,
  `saveTripPlaceToCollection` and `copyPlacesToCollection` all grow `collection_places`, which no
  ceiling has ever counted. All three now call
  `assertQuota(scope, 'places', <saved place count>, <how many are being added>)` **before** the
  insert, inside the repository. The count is `collectionPlacesRepository.count(scope)` plus
  `placesRepository.count(scope)`: a saved place is a saved place, the catalogue sells one number for
  them, and two independent ceilings under one published figure is how a published number stops being
  the enforced number.
- **Tenant scoping, stated rather than implied.** Every read and write is built on `tenantFilter()`
  from `src/server/repos/base.ts`, which begins
  `eq(table.organizationId, scope.ctx.organizationId)`; `collection_places` carries
  `organization_id NOT NULL` as the leading column of a composite index
  (`collection_places_org_collection_idx`, `src/server/db/schema.ts:1258`) and
  `collection_place_labels` carries it as a single-column index (`:1306`) — the join table's own
  composite is its primary key, `(collection_place_id, label_id)`, which carries no tenant column, so
  the guarantee here is the insert stamp of `src/server/repos/base.ts:196-200` and not the index. The
  two-sided calls — save-from-trip, bulk copy, copy-to-trip — resolve
  **both** ids inside the caller's own scope before a single row is written, which is the property
  the isolation cases below exist to hold.
- **Server functions — `src/routes/_app/-server/collections.ts`**, all `POST` except the first:
  `loadCollectionPlacesFn` (`GET`, the narrowed page), `addPlaceFn`, `savePlaceToCollectionsFn` (one
  place, several lists, one call), `updatePlaceFn`, `deletePlacesFn`, `copyPlacesFn`,
  `copyPlacesToTripFn` and `setCollectionSharingFn`.
- **Zod v4**, `z.strictObject()` with the `error` parameter, reusing `addCollectionPlaceInput`
  (`:106`), `updateCollectionPlaceInput` (`:112`) and `listCollectionPlacesInput` (`:205`). Every
  bulk input is a **bounded** array — at most 100 ids — because an unbounded one lets a client choose
  the size of a transaction. Money stays integer minor units plus a `text(3)` currency; no float
  amount appears anywhere in this stage.
- **Authorisation, decided in every handler, over the two authorities that exist.**
  - `private` — only `collections.owner_user_id` may read or write it. Every read resolves through
    the repository, so a non-owner gets a `NotFoundError` rather than a "forbidden", which is also
    the honest answer: the list is not theirs to know about.
  - `organization` — every member of the workspace may read it and add, edit or label a place in it;
    only the owner or a workspace `admin` (`hasAtLeastRole(scope.ctx.role, 'admin')`,
    `src/server/repos/context.ts:117`) may delete the list, change its sharing or bulk-delete its
    places. That is the row's viewer / editor / admin split expressed in the ranks the product
    already administers.
  - Copying **into** a trip resolves the trip in the caller's own scope first, so a well-formed trip
    id from another workspace is a `NotFoundError` before a single place is written.
- Nothing enqueued: every bulk action is capped at 100 rows and runs through `runBatch`, which is one
  D1 batch and therefore one transaction. No realtime patch — a collection has no room, and the trip
  it copies into is re-read by the trip screen's own loader.

### UI (route, components)

- **Routes.** `/collections` and `/collections/$collectionId` already exist. **No route file is
  added and `pnpm generate-routes` is not run.** The detail route's `validateSearch` gains a bounded
  `labels` array (from `08-S4`) and a keyset cursor.
- **Components reused, not rebuilt** — `Sheet`, `Dialog`, `Popover`, `DropdownMenu`, `Checkbox`,
  `Combobox`, `Button`, `IconButton`, `Chip`, `Badge`, `Card`, `EmptyState`, `Skeleton`, `Alert`,
  `Toast`, `Pagination`, `ScrollArea`, plus the map setup in `src/components/map` and `src/lib/map`
  and the `FilterBar` from `-ui/scaffold.tsx`. `StatusPicker` and `LabelManager` come from `08-S4`.
- **New components.**
  - `PlaceSheet` — one saved place read closely: its image, address, city and country with the flag
    the screen already renders, price with `tabular-nums`, website and phone as real links, notes,
    its labels, its status picker, and its provenance ("Saved from Kyoto, March 2026") when
    `source_trip_id` is set. Editing happens in the sheet, not on the card.
  - `SaveToCollection` — one place, a list of the workspace's collections with a `Checkbox` each, and
    one call. It is the component a trip screen will mount later; it takes a place id and knows
    nothing about where it was rendered.
  - `BulkBar` — a bar that appears when a selection exists, stating the count and offering the five
    actions: set status, add label, copy to another list, copy to a trip, remove. Destructive items
    confirm and name the count. It is `position: sticky` at the bottom on small screens and inline on
    large, and it never covers the last row of the list.
  - `CollectionMap` — the list's places on one canvas, publishing the `[data-map-ready]` marker every
    map wrapper in the product publishes. **The filters narrow the list and the map together**,
    from the same predicate, so the two can never disagree; selecting a pin opens the sheet and
    selecting a card highlights the pin, from one reducer.
  - `SharingDialog` — two choices with their consequences written out ("Only you" / "Everyone in
    this workspace can view and add"), the current setting, and one line naming who may delete the
    list. No third option, for the reason under **Reference rows**.
  - `selection.ts` — the pure selection model and the de-duplication predicate the copy uses, so the
    count the bar promises and the count the server reports come from one rule.
- **States.**
  - _Empty:_ the screen's existing "Nothing saved here yet" copy currently promises three ways to
    save a place. This stage makes two of them real and **rewrites the third promise out** rather
    than leaving copy that describes a path the product does not have — the empty state offers "Add a
    place" and "Copy from a trip", and gains the search entry point on the day `02-S13` lands — not
    before, since `MAP-02` is BLOCKED behind Gate A.
  - _Filtered to nothing:_ the existing state keeps its reset action and gains the hidden count.
  - _Empty map:_ when no place in the list has coordinates, the map is not rendered and a line says
    which places are missing them, with a link to fix the first one.
  - _Skeleton:_ `CardsSkeleton` for the list and a map placeholder at the settled height, so the two
    columns do not resize each other as they resolve.
  - _Error:_ a failed bulk action names how many succeeded and how many did not, and offers a retry
    over the failures only; a failed sheet save keeps the sheet open with its values; a quota
    rejection is a designed panel naming the ceiling and the plan, not a toast — it is the one error
    in this stage a traveller can act on by upgrading, and `QuotaExceededError` already carries the
    metric, the limit and the usage.
  - _Loading:_ the bulk bar's button takes `loading` and the selected rows go `aria-busy` without
    losing their selection.
- **Motion.** The sheet uses `--ease-drawer`; the bulk bar enters on 200ms opacity and 8px translate
  on `--ease-out-quint`; cards stagger 20ms, capped at eight.
  `prefers-reduced-motion: reduce` collapses all of it to opacity.
- **Tokens.** None missing.

### Quota

**The metric is `places`, asserted inside the repository before every write that grows a saved-place
row**, at the three call sites named under **Server**. `places` already exists in `PLAN_QUOTAS`
(`src/server/db/types.ts:41-70`) for all four tiers, so **nothing is added to the catalogue and no
case is added to `src/server/billing/__tests__/limits.test.ts`.** `collections` stays the ceiling on
the lists themselves, asserted at `src/server/repos/collections.ts:300`, and this stage does not
change it.

**One asymmetry, stated rather than hidden**, of the same shape as the storage one in `08-S7`: after
this stage, a **collection** write counts both tables and an **itinerary** write still counts only
`places`, because `src/server/repos/places.ts:269` passes `placesRepository.count(scope)` alone.
Making it symmetric is a one-line change in `src/server/repos/places.ts`, which
`02-places-and-maps.md` claims for `02-S6` in **wave 4** — a later wave than this stage, so reaching
into it here would clobber a plan that has not run yet. The requirement is recorded here for `02-S6`
to absorb. The asymmetry is safe in the direction that matters — no tenant can
exceed the published number by saving into collections — and it is named so that nobody later reads
the two call sites as a contradiction.

Entitlement: saved collections have **no key in `MODULE_KEYS`** (`src/lib/plans.ts:126-139`), so
there is nothing to gate and none is invented. `08-S10` states that measurement once for the plan.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block.

In A's scope, against B's ids: `addCollectionPlace` parented on B's collection,
`updateCollectionPlace`, `deleteCollectionPlace`, `saveTripPlaceToCollection` with B's place id, and
`listCollectionPlacesFiltered` on B's collection each reject with `NotFoundError`, and B's
`collection_places` count is unchanged. Beside it, the contrasting shape:
`listCollectionPlaces(scopeA, { collectionId: bCollectionId })` returns `[]` — it is a `findMany`
with no parent resolution (`src/server/repos/collections.ts:214`) and does not throw. Both are
asserted, so the new paged read's refusal is not read as a property the whole module already had.

Three cases are the point of the block, and each is a two-id call where one filter would look
sufficient:

1. `saveTripPlaceToCollection(scopeA, { collectionId: aCollectionId, placeId: bPlaceId })` — A's own
   list, B's place. It must reject and write nothing. The repository already resolves both ids in the
   scope and its own comment says why; this case is what keeps that true.
2. `copyPlacesToCollection(scopeA, { fromIds: [bCollectionPlaceId], toCollectionId: aCollectionId })`
   — a bulk copy is the same attack at scale, and the assertion is that A's count is unchanged, not
   merely that the call threw.
3. `copyPlacesToTrip(scopeA, { collectionPlaceIds: [aId], tripId: bTripId })` — A's own places into
   B's trip. `NotFoundError`, and B's `places` count is unchanged.

Plus one quota case, because the ceiling is new: with the `places` ceiling reached by A's own rows, a
`saveTripPlaceToCollection` in A's scope throws `QuotaExceededError` and writes nothing, while B's
identical call under B's own ceiling succeeds — a ceiling that leaked across tenants would be a
denial of service one tenant could buy for another.

Functions covered: `listCollectionPlaces`, `listCollectionPlacesWithLabels`,
`listCollectionPlacesFiltered`, `addCollectionPlace`, `saveTripPlaceToCollection`,
`updateCollectionPlace`, `deleteCollectionPlace`, `copyPlacesToCollection`, `copyPlacesToTrip`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/components/collections/__tests__/selection.test.ts` — de-duplication matches on
    `source_place_id` first and on the normalised name-and-coordinate triple second; copying an
    overlapping pair of lists adds each place once; the promised count equals the server's reported
    count for the same input.
  - `src/routes/_app/-server/__tests__/collections.test.ts` — a `private` list is a `NotFoundError`
    for a non-owner rather than a forbidden; a `member` may add a place to an `organization` list and
    may not delete the list; a 101-id bulk input is rejected; a bulk copy that exceeds the `places`
    ceiling writes nothing at all rather than a prefix.
  - `src/components/collections/__tests__/place-sheet.test.tsx` — provenance renders only when the
    source trip is set; the status picker inside the sheet writes the same way it does on the card;
    `Escape` closes and returns focus to the card that opened it.
  - `src/components/collections/__tests__/bulk-bar.test.tsx` — the bar appears only with a selection,
    states the count, confirms before removing, and is reachable by keyboard from the list without
    a pointer.
  - `src/components/collections/__tests__/save-to-collection.test.tsx` — several lists in one call;
    a list the place is already in is shown as already saved rather than offered twice.
- Playwright, and the frames per `12-verification-protocol.md` §3:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts

  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/collections" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S9" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
    --state sheet --click '[data-part="collection-place-card"]'
  ```

  A second state set, `--state bulk`, is taken with two cards selected via
  `--click '[data-part="collection-place-select"]'`. The spec's route table declares the detail route
  with `map: true` once `CollectionMap` ships, because `settleMap()` audits that declaration in both
  directions, and calls `auditServerClock()` once over its own table. Every selector is a `data-part`
  attribute this stage publishes and is verified to resolve by the spec run reaching it.

- Console must be silent: `fatal` empty in every test; the rasteriser GL advisory is tolerated only because
  the route now declares a live map, and nothing is added to `TOLERATED_CONSOLE_WARNINGS`.
- Layout shift after the settle mark asserted at `0` on `chromium` — the bulk bar is `sticky` and
  reserves its own height so its appearance cannot push the list — and stated as a skip on
  `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the place sheet, the bulk bar, the map, the save
dialog and the sharing dialog:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every control, including each row of a
      bulk action in flight.
- [ ] Designed empty states on `--color-surface-2` for an empty list, a filter that matches nothing
      and a map with no pins; `CardsSkeleton` plus a map placeholder at the settled height; and an
      error state that reports partial success honestly and retries only the failures.
- [ ] Motion 150–260ms on `--ease-out-quint` or `--ease-drawer`, transform and opacity only, stagger
      capped at eight, `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared, over both basemap ramps.
- [ ] 360px through 2560px: at 360px the map is a collapsible strip above the list and the sheet is
      full height; at 2560px the list and map sit side by side with the list holding its measure.
- [ ] Keyboard navigable end to end — selection, bulk actions and the map's pins — with accessible
      names on every card and control, and WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on every price
      and every count.

### Blockers

- **`MAP-02` gates the search-and-add path, and it is BLOCKED.** The row is owned by
  `02-places-and-maps.md` `02-S13`, **wave 6**, whose `## Stage` heading carries **BLOCKED** and
  whose own text says it is not scheduled until Gate A closes. Gate A — a geocoding and place-search
  provider with terms a subscription-funded product may use, and a budget — is owned by
  `docs/plans/11-boundaries-and-blockers.md` `11-S3` and has neither. Disposition: **scope**, and
  the row closes `partial` rather than `done` because of it — every other path into a collection
  ships here, the search entry point is absent rather than disabled, and `02-S13` is what closes
  `ADD-10`. This stage builds no second search and no second geocoder, and it does not wait: nothing
  it ships depends on `02-S13` having landed.
- **A public collection is not offered.** `collections.visibility` allows `public` and nothing can
  serve it: there is no `public_token` column and no unauthenticated route. Disposition: **defer**.
  It needs a column and a route, and a wave-3 stage has no wave-0 window to file the column through.
  The picker offers the two enforceable values, so no setting on the screen is a lie.
- Nothing else. No package outside the SPEC §3 pinned set, no new binding, no third-party service.

## Stage 08-S10 — The modules that are sold become the modules that are enforced

### Stage id

`08-S10` · Wave 3 · effort **M**. Twelve module flags are resolved on every metered write and thrown
away unread. This stage gives them a single enforcement point, a single error and a designed surface
for the traveller who meets it.

### Reference rows

**Closes no gap row**, in the shape `00-foundations.md` uses for its four write-path stages. It is
the enforcement half of the registry row that `docs/plans/11-boundaries-and-blockers.md` excludes
from this plan, and that file names `08-product-modules.md` as where the work lands. This stage
therefore ships the _hosted_ control — what a subscription has bought — and not a deployment-wide
switch, which is the shape that does not survive multi-tenancy.

Rows it protects rather than closes: `ADD-05` and `ADD-06` behind the `atlas` module, `ADD-07` and
`ADD-08` behind `journal`. Those four are `08-S2`, `08-S6`, `08-S3` and `08-S7`, all of which land
before this stage and each of which names `assertModule` as its gate rather than writing one.

**What is measured, and what it means.**

- `src/lib/plans.ts:99-114` declares `PlanModules` as twelve booleans and `:126-139` lists them as
  `MODULE_KEYS`. `resolveLimits()` (`src/server/billing/limits.ts:216`) resolves them for a tenant
  and returns them inside `EffectiveLimits.limits`, which is `PlanLimits` and therefore includes
  every module flag. `/pricing` renders them as what a plan includes.
- `resolveQuotas()` (`src/server/repos/base.ts:407`) calls `resolveLimitsFromRow` on every metered
  write and returns `{ plan, planId, limits: resolved.metrics }` — **the column-shaped half only**.
  The module flags it just computed are discarded at `:423`.
- `assertWithinLimit()` (`src/server/billing/entitlements.ts:259`) already handles a module key and
  already throws `FeatureLockedError` (`src/server/billing/types.ts:291`) for one. It has **no
  caller outside `__tests__`**, and the reason is structural rather than neglect: it takes a
  `BillingContext`, whose `BillingRuntime` (`types.ts:141-154`) requires a `Stripe` client, a webhook
  secret and a task queue. No repository can build one, so no repository has ever called it.

**So the gate is a second entry point to one authority, not a second authority**, and the difference
is the whole design of this stage: `resolveLimitsFromRow` in `src/server/billing/limits.ts` stays the
only place that decides what a tenant may do, and `FeatureLockedError` stays the only error that says
so. Nothing is re-implemented.

### Owned paths

- `src/server/repos/base.ts` — edit. `resolveModules()` and `assertModule()` beside `resolveQuotas`
  and `assertQuota`, reading the half of `resolveLimitsFromRow`'s answer that `:423` currently drops.
  No other stage in any plan names this file.
- `src/server/billing/entitlements.ts` — edit. `moduleLabel` and the message shape are exported so
  the repository path and the billing path say the same sentence about the same module. No other
  stage in any plan names this file.
- `src/server/billing/__tests__/entitlements.test.ts` — edit.
- `src/routes/_app/-server/shell.ts` — edit. `ShellPayload` gains the resolved module flags, so every
  authenticated screen knows what the workspace has bought without a second round trip. It is
  already the one place per request that resolves the tenant. **`02-S2` (`02-places-and-maps.md`)
  also edits this file, in wave 1**; this stage is wave 3, so the two never hold it at once, and each
  names the other.
- `src/routes/_app/-server/journal.ts` — edit. The journal's write functions call the gate. `08-S3`
  held this file in wave 1 and `08-S7` in wave 2.
- `src/server/fns/atlas.ts` — edit. The atlas write functions call the gate. `00-S4` held this file
  in wave 0, `08-S2` in wave 1 and `08-S6` in wave 2; all four name each other.
- `src/server/fns/__tests__/atlas.test.ts` — edit.
- `src/components/billing/module-locked.tsx` — new.
- `src/components/billing/index.ts` — new.
- `src/components/billing/__tests__/module-locked.test.tsx` — new.
- `src/routes/_app/atlas.tsx` — edit. Renders the locked surface instead of the module.
- `src/routes/_app/journey/index.tsx` — edit. `08-S3` held it in wave 1.
- `src/routes/_app/journey/$journeyId.tsx` — edit. `08-S3` held it in wave 1, `08-S7` in wave 2.
- `e2e/product-modules.visual.spec.ts` — append.
- `e2e/__screenshots__/product-modules.visual.spec.ts/` — append.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.

**No baseline in `e2e/__screenshots__/visual.spec.ts/` is re-recorded**, and that is a claim this
stage proves rather than assumes: the demo workspace's plan includes both gated modules, so its
resting frames are unchanged, and the stage runs the `/atlas` and `/journey` comparisons and reports
the pass.

### Data and migration

**No schema change, and none is filed.** `subscriptions` already carries `plan`, `status`, `seats`,
`stripe_price_id`, `quota_overrides`, `seat_limit` and `storage_limit_bytes` — the exact row
`resolveQuotas` already reads at `src/server/repos/base.ts:408-420`. A module is not stored; it is
derived from the price id and the row's overrides. No migration, no backfill, no index.

### Server (repo, server function, Zod)

- **`src/server/repos/base.ts`.**
  - `resolveModules(scope): Promise<PlanModules>` — the same single query `resolveQuotas` runs,
    returning `resolved.limits` narrowed to the module keys. To avoid running that query twice on one
    request, both are refactored onto one internal resolver that returns both halves, so the metered
    write path costs exactly what it costs today.
  - `assertModule(scope, key: ModuleKey): Promise<void>` — throws `FeatureLockedError` from
    `src/server/billing/types.ts` when the flag is false, carrying the `{ key, planId }` lock the
    error already models and the message `moduleLabel` already composes. It does not construct a
    `BillingContext` and does not touch Stripe.
- **Where the gate is called, and where it is deliberately not.** It is called **at the server
  function boundary**, not inside the repository, and the reason is measurable rather than stylistic:
  the same repositories are called by `00-S4`'s `travel-stats` queue handler and by the dev seeder,
  and a background recompute that threw `FeatureLockedError` would dead-letter a task for a tenant
  whose only sin is being on the free plan. `assertQuota` lives in the repository because a row is a
  row wherever it is written; an entitlement is about a person using a surface, and that is the
  boundary the surface is reached through.

  | Module    | Gated at                                                                                                                                                                |
  | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `atlas`   | `markCountryVisitedFn`, `unmarkCountryVisitedFn`, `addCountryToBucketListFn`, `removeCountryFromBucketListFn`, and the four `08-S2` added, in `src/server/fns/atlas.ts` |
  | `journal` | every write function in `src/routes/_app/-server/journal.ts`                                                                                                            |

  **Reads are not gated.** A workspace that downgrades keeps seeing what it has already written and
  can still export or delete it; only new writes stop. Locking a traveller out of their own journal
  because a card expired is a data-hostage pattern and not a product control.

  **The public journal page is outside the gate**, named here because it is the one exception and an
  unstated exception is a defect: `08-S7`'s `/journal/$token` serves a link the traveller has already
  given to somebody else, and revoking a plan must stop new writes rather than break a page a
  stranger has bookmarked. Unsharing remains the owner's own action.

- **The two ungated modules, stated once for the whole plan.** The leave planner and saved
  collections have **no key in `MODULE_KEYS`** (`src/lib/plans.ts:126-139`, twelve keys:
  `itinerary`, `map`, `budget`, `packing`, `reservations`, `journal`, `atlas`, `collaboration`,
  `realtime`, `offlineMaps`, `pdfExport`, `prioritySupport`). Adding a key is a change to what the
  catalogue **sells** — it changes `/pricing`, the plan comparison and every existing subscription's
  resolved limits — and that is a product decision made with a price list, not a side effect of an
  enforcement stage. So the two are ungated, every stage of this plan says so under its own **Quota**
  heading, and no key is invented.
- **Zod.** No new input: `assertModule` takes a `ModuleKey`, which is a TypeScript union over
  `MODULE_KEYS` and is never read from a request. There is nothing here for a client to send and
  therefore nothing to validate — which is the safest shape available and is why it was chosen.
- **Authorisation.** The gate is not authorisation and is not confused with it: `assertModule`
  answers "has this workspace bought this", `assertRole` (`src/server/repos/context.ts:122`) answers
  "may this member do this", and both run, in that order, in the handlers that need both.
- **Caching.** `resolveQuotas` reads `subscriptions` directly on each call and this stage does not
  add a cache to the repository path. `entitlements.ts` keeps its own 60-second KV cache for the
  billing surfaces that already use it, invalidated by the Stripe webhook. Two caches over one row
  would be one cache too many, and the repository path's read is a single indexed row on the tenant's
  own subscription.

### UI (route, components)

- **Route.** No route file is added and **`pnpm generate-routes` is not run.**
- **Components reused, not rebuilt** — `EmptyState`, `Card`, `Button`, `Badge`, `Alert`, `Dialog`
  from `src/components/ui`; the plan names and prices come from `src/lib/plans.ts`, which is
  isomorphic and safe to import from a component.
- **New component.** `ModuleLocked` (`src/components/billing/`) — the surface a workspace sees when
  its plan does not include a module. It is a designed page and not a disabled screen: the module's
  name, one sentence on what it does, what the current plan includes, the lowest plan that includes
  this module with its price, a primary action to the billing screen, and — this is the part that
  makes it honest — a line saying that anything already written stays and stays readable. It renders
  from `ShellPayload.modules`, so it costs no extra request.
- **Where it appears.** `/atlas` and `/journey` render it instead of the module when the flag is
  false. Navigation is **not** hidden: a module that vanishes from the nav reads as a bug, and a
  traveller who cannot find the atlas cannot decide to pay for it. The nav item carries a small lock
  affordance instead, which is the same information without the vanishing act.
- **The write-path error.** When a write is refused mid-session — the plan changed in another tab, or
  the webhook has just landed — `FeatureLockedError` surfaces as the same panel inside a `Dialog`
  rather than as a toast, because it is not a transient failure and a toast that disappears is the
  wrong shape for a state that will still be true in a minute.
- **States.**
  - _Locked:_ the state above, on `--color-surface-2`, with the module's own iconography so the page
    still reads as the atlas or the journal rather than as a generic paywall.
  - _Skeleton:_ the shell resolves the flags before any module loader runs, so there is no state in
    which the screen must guess; the module's own skeleton is unchanged.
  - _Error:_ a failed plan resolution **fails open for reads and closed for writes** — the module
    renders and a write is refused with a message naming the resolution failure rather than the plan.
    Failing closed on a read would turn a billing hiccup into an outage; failing open on a write
    would give away the product.
  - _Loading / disabled:_ the upgrade action takes `loading`; the lock affordance in the nav is never
    the only cue, being paired with text in its accessible name.
- **Motion.** The locked panel enters on 220ms opacity and 4px translate on `--ease-out-quint`; the
  dialog uses the primitive's own transition. `prefers-reduced-motion: reduce` collapses to opacity.
- **Tokens.** None missing.

### Quota

**Creates no countable row and adds no metric.** This stage is the enforcement of the _module_ half
of `PlanLimits`; the _quota_ half is already enforced by `assertQuota`
(`src/server/repos/base.ts:430`) at the eight call sites that exist. Nothing is added to
`resolveLimits()`, nothing to `PLAN_QUOTAS`, and therefore no case is added to
`src/server/billing/__tests__/limits.test.ts` — that test asserts the catalogue and the resolver
agree, and neither changes here.

One property is asserted rather than assumed, because it is the whole promise of the stage: **the
published number and the published module list are the enforced ones.** The unit tests below hold
that every key `/pricing` renders for a plan is a key `resolveModules` returns true for on a tenant
subscribed to that plan, for all four tiers, so a module cannot be advertised and gated at the same
time.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block, because this
stage does add functions to a repository module even though neither returns rows.

With A on a plan that includes `atlas` and B on one that does not: `resolveModules(scopeA)` returns
A's flags and `resolveModules(scopeB)` returns B's, from the same process and in either order, so a
memoised resolver cannot leak one tenant's plan into another's request. `assertModule(scopeB,
'atlas')` throws `FeatureLockedError` and `assertModule(scopeA, 'atlas')` resolves. Then the case
that makes it worth writing: A's atlas write functions succeed while B's identical calls are refused,
and **B's data is untouched** — a refused write must leave no partial row, which matters because the
gate runs before the repository and a mis-ordered call would write first and refuse afterwards.

The query itself is already tenant-bound and stays so: `resolveQuotas` filters on
`organization_id` — `eq(subscriptions.organizationId, scope.ctx.organizationId)` at
`src/server/repos/base.ts:419` — and `resolveModules` shares that one query rather than writing a
second one, so there is no second place for the scoping to be forgotten.

Functions covered: `resolveModules`, `assertModule`, and `resolveQuotas` for the shared-query
refactor.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests:
  - `src/server/billing/__tests__/entitlements.test.ts` — `assertModule` throws the same
    `FeatureLockedError`, with the same lock and the same message, that `assertWithinLimit` throws
    for the same key and plan, so the two entry points cannot drift; a tenant with no subscription
    row resolves to the free plan's modules rather than to none; a per-tenant override that enables a
    module beats the catalogue, in the direction `resolveLimits` already documents; and the
    catalogue-versus-resolver property named under **Quota**, over all four tiers.
  - `src/server/fns/__tests__/atlas.test.ts` — a gated write is refused before the repository is
    called and writes nothing; an ungated one is unchanged; the `travel-stats` enqueue from
    `00-S4` still happens for an entitled tenant and never for a refused write.
  - `src/components/billing/__tests__/module-locked.test.tsx` — the panel names the module, the
    current plan and the lowest plan that includes it; the reassurance about existing data is
    present; the upgrade action is a link to billing and is reachable by keyboard; the nav lock is
    never colour alone.
- Playwright, and the frames — the state that is the point of this stage is **not reachable on the
  seeded workspace**, and that is stated rather than skipped:

  ```sh
  PORT=$(scripts/ultrabuild/resolve-port.sh)
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/product-modules.visual.spec.ts
  PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/visual.spec.ts -g "atlas|journey"
  ```

  The last command has **no `--update-snapshots`**: it is the evidence that this stage changed no
  resting pixel for an entitled tenant, and a pass is the claim. The locked state is reached the way
  `12-verification-protocol.md` §3 requires an unreachable state to be reached — through the
  component's own prop in a spec, rendering `ModuleLocked` directly at both viewports and both
  themes, rather than by mutating a subscription row a fixture owns. A stage that cannot reach a
  state without a fixture it does not own records that, and this one does.

- Frames, per `12-verification-protocol.md` §3 — light and dark at 360, 1280 and 2560 over both
  gated routes for the entitled case:

  ```sh
  PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
    --url "http://localhost:$PORT/atlas" \
    --out ".claude/ultrabuild/shots/<slug>/round-<n>/08-S10" \
    --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
  ```

  and the same six over the locked component rendered from its own prop in the spec, filed in the
  same directory under a `locked` state name. Everything lands under
  `.claude/ultrabuild/shots/<slug>/round-<n>/08-S10/` and nothing at the repository root.

- Console must be silent: `fatal` empty in every test.
- Layout shift after the settle mark asserted at `0` on `chromium`, stated as a skip on
  `mobile-safari`.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `08-S1`.

The `docs/SPEC.md` §2 clauses, ticked against the locked panel, the refusal dialog and the nav lock:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on the upgrade action and the nav item.
- [ ] The locked panel **is** a designed empty state on `--color-surface-2`; the module's own
      skeleton loading state is unchanged; and the plan-resolution failure has a designed error state
      rather than a thrown boundary.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared.
- [ ] 360px through 2560px: at 360px the panel is a single column with the plan comparison stacked;
      at 2560px it holds a readable measure instead of stretching.
- [ ] Keyboard navigable end to end, accessible names that state the lock in words, WCAG 2.2 AA in
      both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint, `tabular-nums` on the price.

### Blockers

- **The leave planner and saved collections cannot be gated without changing what the catalogue
  sells.** Measured: neither has a key in `MODULE_KEYS`. Disposition: **report**. Adding one is a
  pricing decision for the user, of the same kind as the three binding decisions in
  `docs/plans/11-boundaries-and-blockers.md`, and this stage does not make it in a repository.
- Nothing else. No package outside the SPEC §3 pinned set, no new binding, no third-party service,
  and every stage this one depends on is in an earlier wave of this same file.

## Cross-plan collisions

The verbatim output of `node scripts/ultrabuild/check-plan-collisions.mjs 08`, run against
`docs/plans/` as it stood when this file was written. It is here because a judgement re-made by hand
every round is eventually made wrong: round 8 produced two real collisions while every plan involved
carried an acceptance criterion about avoiding them, because each plan could only read the siblings
that already existed.

`node scripts/ultrabuild/check-plan-collisions.mjs 08` — exit status `0`:

```
plans 13 · stages 91 · owned paths 544

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (3) — legal; each plan must name the other:
  src/server/fns/atlas.ts
      00-foundations.md  00-S4  wave 0  (edit)
      08-product-modules.md  08-S2  wave 1  (edit)
      08-product-modules.md  08-S6  wave 2  (edit)
      08-product-modules.md  08-S10  wave 3  (edit)
  src/server/fns/__tests__/atlas.test.ts
      00-foundations.md  00-S4  wave 0  (edit)
      08-product-modules.md  08-S2  wave 1  (edit)
      08-product-modules.md  08-S6  wave 2  (edit)
      08-product-modules.md  08-S10  wave 3  (edit)
  src/routes/_app/-server/shell.ts
      02-places-and-maps.md  02-S2  wave 1  (edit)
      08-product-modules.md  08-S10  wave 3  (edit)
```

`node scripts/ultrabuild/check-plan-refs.mjs 08` — exit status `0`:

```
plan 08: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
```

Both commands were re-run after this round's corrections to `08-S1`, `08-S3`, `08-S4` and `08-S9` —
one miscounted move and three false claims about shipped schema, all six listed at the end of this
section — and both blocks above are that re-run's verbatim output. The only figure that has moved
across three re-runs is the corpus total (`owned paths` 538 → 545 → 544, from sibling plans edited in
the same rounds); this plan's own rows, and the verdict that matters, are identical each time.

**The move that the check could not see, and the reason this section now lists prose counts as well as
paths.** `check-plan-collisions.mjs` reads **Owned paths**, so it can only find a collision both
stages declare. This round's blocking finding was the opposite shape: the area-facing prose in `08-S1`
and the `### Stage id` of `08-S3` both said `08-S3` moved **three** files out of
`src/routes/_app/-ui/`, while the consolidated table under `08-S3`'s **UI** heading listed **two** and
assigned `src/routes/_app/-ui/world-map.tsx` to `08-S2`. `08-S2` and `08-S3` are both wave 1, so an
implementer who followed the prose would have had two concurrent stages moving one file — the exact
same-wave exclusive collision the wave rule exists to prevent, and one the check reports as clean
because only `08-S2` declares the path. The consolidated table is now the single authority: two rows,
two source files, one owner each, and every other mention of the moves points at it rather than
restating a count. The count is checkable by hand in one line, and it must equal the number of table
rows:

```sh
grep -c '^  | `src/routes/_app/-ui/' docs/plans/08-product-modules.md
```

**One thing neither check verifies, learned the expensive way.** Both read stage _ids_; neither reads
the _wave_ or the _status_ a citation attributes to a sibling stage. `08-S9` cited `MAP-02` as
"wave 2" — the figure in `11-S3`'s register — while the stage that owns the row, `02-S13`, states
`Wave 6` on its `### Stage id` line and **BLOCKED** in its `## Stage` heading, and the stage then
closed `ADD-10` as `done` on the strength of a dependency that is not scheduled. `check-plan-refs`
passed on it, because the token resolved. So a citation of a sibling's wave or status is read from
that sibling's own `### Stage id` and `## Stage` lines, every time, and never from a register that
summarises it:

```sh
grep -n '^## Stage 02-S13' -A 4 docs/plans/02-places-and-maps.md
```

Every `NN-Sn` token this file cites — `00-S1`, `00-S2`, `00-S3`, `00-S4`, `01-S1`, `01-S2`, `01-S5`,
`02-S2`, `02-S6`, `04-S1`, `04-S2`, `06-S1`, `06-S2`, `06-S6`, `07-S1`, `07-S6`, `09-S8`, `10-S2`,
`10-S3`, `11-S1`, `11-S2`, `11-S3` and the ten `08-S*` of this plan — resolves to a `## Stage`
heading in the plan whose prefix it carries, and every stage carries a Playwright invocation in its
**Verification** block. Both are the checks' finding, not a claim made by hand: the two commands above replace reading
eleven sibling plans, and round 12 spent four blocking findings on defects both would have caught.

**No same-wave exclusive collision involves this plan**, which is the result that matters: no stage
of `08-product-modules.md` shares an exclusive disposition on a file with any stage of any other plan
in the same wave.

Three paths are touched by more than one plan in different waves. Each is named in the owning stage,
with the sibling stage id, as the check requires:

| Path                                     | This plan's stages                  | The sibling                          | Named in                                   |
| ---------------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------ |
| `src/server/fns/atlas.ts`                | `08-S2` w1, `08-S6` w2, `08-S10` w3 | `00-S4` w0 (`00-foundations.md`)     | `08-S2`, `08-S6`, `08-S10` **Owned paths** |
| `src/server/fns/__tests__/atlas.test.ts` | `08-S2` w1, `08-S6` w2, `08-S10` w3 | `00-S4` w0 (`00-foundations.md`)     | `08-S2`, `08-S6`, `08-S10` **Owned paths** |
| `src/routes/_app/-server/shell.ts`       | `08-S10` w3                         | `02-S2` w1 (`02-places-and-maps.md`) | `08-S10` **Owned paths**                   |

Seventeen files are shared **between stages of this plan alone**, and none of them appears in the
report, because the check only lists a path when more than one **plan file** claims it. They are
recorded here so that they are read as a schedule rather than discovered as a merge conflict:

| Path                                               | Stages, by wave                       |
| -------------------------------------------------- | ------------------------------------- |
| `src/routes/_app/-server/library.ts`               | `08-S3` w1 · `08-S7` w2 · `08-S9` w3  |
| `src/server/repos/vacay.ts`                        | `08-S1` w1 · `08-S5` w2 · `08-S8` w3  |
| `src/server/repos/journey.ts`                      | `08-S3` w1 · `08-S7` w2               |
| `src/server/repos/collections.ts`                  | `08-S4` w1 · `08-S9` w3               |
| `src/routes/_app/-server/vacay.ts`                 | `08-S1` w1 · `08-S5` w2 · `08-S8` w3  |
| `src/routes/_app/-server/journal.ts`               | `08-S3` w1 · `08-S7` w2 · `08-S10` w3 |
| `src/routes/_app/-server/collections.ts`           | `08-S4` w1 · `08-S9` w3               |
| `src/routes/_app/vacay.tsx`                        | `08-S1` w1 · `08-S5` w2 · `08-S8` w3  |
| `src/routes/_app/journey/$journeyId.tsx`           | `08-S3` w1 · `08-S7` w2 · `08-S10` w3 |
| `src/routes/_app/journey/index.tsx`                | `08-S3` w1 · `08-S10` w3              |
| `src/routes/_app/collections/index.tsx`            | `08-S3` w1 · `08-S9` w3               |
| `src/components/vacay/index.ts`                    | `08-S1` w1 · `08-S5` w2 · `08-S8` w3  |
| `src/components/journey/index.ts`                  | `08-S3` w1 · `08-S7` w2               |
| `src/components/collections/index.ts`              | `08-S3` w1 · `08-S9` w3               |
| `e2e/__screenshots__/visual.spec.ts/vacay-*.png`   | `08-S1` w1 · `08-S5` w2 · `08-S8` w3  |
| `e2e/__screenshots__/visual.spec.ts/atlas-*.png`   | `08-S2` w1 · `08-S6` w2               |
| `e2e/__screenshots__/visual.spec.ts/journey-*.png` | `08-S3` w1 · `08-S7` w2               |

Every one of them is a different wave in every row, which is the rule: same-wave stages run
concurrently and would clobber each other; consecutive waves run in order and the later stage reads
what the earlier one left.

**One caveat on the measurement, stated because it is the same caveat that produced round 8's two
collisions.** The run above reports 13 plan files, 91 stages and 545 owned paths — the total moves
every round because sibling plans are edited in the same round this one is: at least four other plan
files in this directory were being written while this one was. The output is therefore a snapshot,
not a proof about a set that has stopped moving. It should be re-run — the command is one line and its exit
status is 1 on a collision, so a stage can gate on it — before any wave of this plan is scheduled.
The four stages the check reports as stating no parseable wave (`11-S1`, `11-S2`, `11-S3` and
`04-S2`) belong to other plans; a stage with no wave is invisible to the check, and every stage in
this file states one on its `### Stage id` line.

### Six claims about shipped code that this file got wrong, and how each was measured

Recorded here rather than silently corrected, because every one of them read as a confident statement
of fact and each would have sent an implementer to write a test that cannot pass. Two rules come out
of them.

**A nullable read and a throwing read are different contracts, and which one a repository function
has is decided by whether it calls `findById` or `requireById` — read the body, never the name.** That
is what the first three cost.

**An index is a performance fact, never a tenant guard — and an index asserted from memory is usually
wrong.** That is what the last three cost. The tenant guarantee in this repo is `tenantFilter()` on
every read and the insert stamp at `src/server/repos/base.ts:196-200` on every write, and both hold
whatever the indexes look like. Every index claim remaining in this file now names the index, its
columns in order and its line in `src/server/db/schema.ts`, and can be re-checked in one command:

```sh
grep -n "index('journey_entries\|index('collection_\|index('vacay_user_years" src/server/db/schema.ts
```

| Was written                                                                                                                                                                                  | Is actually true                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Measured by                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `08-S3`: a foreign trip id resolved through `getTrip` is a `NotFoundError`                                                                                                                   | `getTrip` (`src/server/repos/trips.ts:223`) delegates to `findById` and returns `null`. The stage now names `tripsRepository.requireById` (`:45`)                                                                                                                                                                                                                                                                                                                                                                                                | `grep -n 'export async function getTrip' -A 3 src/server/repos/trips.ts`             |
| `08-S4`: `getCollection` "resolves through `requireById` and throws"                                                                                                                         | `getCollection` (`src/server/repos/collections.ts:159`) calls `findById` and returns `null`; the throw is on `collectionsRepository.requireById`                                                                                                                                                                                                                                                                                                                                                                                                 | `grep -n 'export async function getCollection' -A 5 src/server/repos/collections.ts` |
| `08-S4`: `setCollectionPlaceLabels` rejects a foreign **label** id                                                                                                                           | It **drops** it and resolves: the label re-read is narrowed by `tenantFilter()` and by the place's own collection (`collections.ts:449-459`), and the returned array simply omits it. Only a foreign `collectionPlaceId` throws (`:446`)                                                                                                                                                                                                                                                                                                         | `sed -n '440,472p' src/server/repos/collections.ts`                                  |
| `08-S1`: `vacay_user_years` is "already keyed on `(organization_id, plan_id, user_id, year)` with `organization_id` leading"                                                                 | No such index exists. The three shipped indexes are `vacay_user_years_plan_user_year_unq` on `(plan_id, user_id, year)` — no tenant column at all — `vacay_user_years_org_plan_idx` on `(organization_id, plan_id)` and `vacay_user_years_org_user_year_idx` on `(organization_id, user_id, year)`. The conclusion ("no index") survived, on the `(organization_id, plan_id)` prefix; the stated reason did not                                                                                                                                  | `awk 'NR>=1628 && NR<=1632 {print NR": "$0}' src/server/db/schema.ts`                |
| `08-S3` and `08-S4`: `organization_id` is the leading column of **every** composite index on `journeys`, `journey_entries`, `collections`, `collection_labels` and `collection_place_labels` | It is not, on three of the five. `journey_entries_journey_date_idx` (`:1393`) and `journey_entries_journey_sort_idx` (`:1394`) lead with `journey_id`; `collection_labels_collection_sort_idx` (`:1288`) leads with `collection_id`; `collection_place_labels` has no composite index on the tenant column at all — `organization_id` alone (`:1306`), under a primary key of `(collection_place_id, label_id)` (`:1305`). `08-S4` had used the false premise as its tenant-safety argument; both stages now argue from the insert stamp instead | `awk '/= sqliteTable/{t=$0} /index\(/{print NR": "t" "$0}' src/server/db/schema.ts`  |
| `08-S1` and `08-S3`: **three** files move out of `src/routes/_app/-ui/` and `08-S3` owns all three                                                                                           | **Two** do, and they have different owners in the same wave: `world-map.tsx` → `08-S2`, `create-dialogs.tsx` → `08-S3`. Followed as written, two wave-1 stages would have moved one file concurrently. The consolidated table under `08-S3`'s **UI** heading is now the only place the moves are counted                                                                                                                                                                                                                                         | `grep -c '^  \| .src/routes/_app/-ui/' docs/plans/08-product-modules.md`             |

A fourth statement in `08-S4` described `setCollectionPlaceLabels` as replacing its join rows "inside
`runBatch`". It does not — `grep -c runBatch src/server/repos/collections.ts` is `0`, and the shipped
body is a `removeWhere` followed by an `insertMany` (`:461-470`). That sentence now reads as the
change the stage makes rather than as the state it finds, which is the only honest way to keep it.
