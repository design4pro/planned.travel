# One owner for "the trips this person is on"

Tracker: FR #133, filed by the sandcastle deep-review (run 12177) while reviewing #107.
Measured on `develop` at `0d938e1a`.

## 📝 TLDR

`recomputeTravelStats` expresses "the trips this person is a member of" twice — a private
`memberOfTrip` helper (`atlas.ts:876`) used by the trip-row read and the distance read, and a
materialized `tripIds` list (`atlas.ts:944`) used by the four remaining aggregates. The ticket is
right that this is one concept with two private expressions and that `memberOfTrip` should go.

**It is wrong about the mechanism, in two ways, and correcting them is the substance of this
document.**

1. The ticket wants the shared thing to be a **materialized id list** (`tripIdsForMember`), with the
   trip rows filtered by `inArray(trips.id, memberTripIds)` and the leg distances by
   `inArray(transports.tripId, memberTripIds)`. Both lists would be the traveller's **unfiltered**
   lifetime membership. D1 caps a statement at **100 bound parameters** (`docs/plans/01-trips-core.md`
   §"The three limits"), and the paid plans sell **unlimited** trips (`src/lib/plans.ts:311`, `:367`).
   A traveller with 400 lifetime trips and twelve in 2026 has a working 2026 stat row today and a
   rejected statement after that change. The refactor as written is a regression.
2. The ticket says the concept "already has an owner in `src/server/repos/trips.ts`
   (`listTripsForUser`)" and asks that `listTripsForUser` be rewired through the new helper.
   `listTripsForUser` has not been a membership read since ADR 0007: it is a thin alias for
   `listTrips` over `readableTripFilter` (`trips.ts:219`), which is `visibility = 'organization'`
   **OR** membership, keyed on `scope.ctx.userId`. Routing it through membership would **narrow the
   dashboard** — it would drop every organization-visible trip the reader is not travelling on — and
   would do so without an ADR. This spec declines it.

What this spec builds instead: **one exported expression in `trips.ts`, `memberTripIds(scope,
userId)`, that renders as a scalar sub-select rather than as an id list.** Both populations read
through it, `memberOfTrip` is deleted with the `exists` / `SQL` / `SQLiteColumn` imports and its
column-typed parameter, no bound parameter is added to either statement, and no round trip is added
either. The four year-filtered aggregates keep the `tripIds` list they already have, because that
list is a **different set** — "member trips that started in year Y" — and is not a second expression
of the same concept.

Backend only. Nothing changes on screen, no copy, no migration, no behaviour.

## 📝 Problem Statement

Every claim below was read on `develop` at `0d938e1a`.

| Piece                                         | State at HEAD                                                                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `memberOfTrip` (`atlas.ts:876-894`)           | Private to `atlas.ts`. Takes `(scope, userId, tripIdColumn: SQLiteColumn)`, returns `SQL`. Renders a correlated `EXISTS` over `trip_members`, tenant-filtered on both sides. Called twice.                                             |
| Call site 1 — trip rows (`atlas.ts:939`)      | `memberOfTrip(scope, userId, trips.id)` beside `yearFilter`. Feeds `tripCount`, `currency`, `lastTripId`, `countryCodes`, and the `tripIds` list.                                                                                      |
| Call site 2 — leg distance (`atlas.ts:1009`)  | `memberOfTrip(scope, userId, transports.tripId)` beside `transportYearFilter`. The **unfiltered** membership is deliberate: a trip starting 30 December has January legs, and a year row sums legs by their own `departure_date`.      |
| `tripIds` (`atlas.ts:944`)                    | `tripRows.map(row => row.id)` — the **year-filtered** member set. Used by `dayCount`, `placeCount`, `cityRows` and `spendRow` through `inArray`, each behind a `tripIds.length === 0` short-circuit.                                   |
| `exists`, `SQL`, `SQLiteColumn` in `atlas.ts` | Imported at `:17`, `:55`, `:56`. **Used by `memberOfTrip` and nothing else** — the other `SQL` occurrences in the file (`:415`, `:475`) are the word in a comment.                                                                     |
| `listTripsForUser` (`trips.ts:764`)           | `userId !== scope.ctx.userId → []`, otherwise `listTrips(scope, {limit})`. `listTrips` (`:485`) reads through `readableTrips` → `readableTripFilter`. **Not a membership read.**                                                       |
| `readableTripFilter` (`trips.ts:219`)         | `anyOf(eq(trips.visibility, 'organization'), isMember)`, `isMember` keyed on `scope.ctx.userId`. Exported, documented as ADR 0007 / PRD #104 decision 1.                                                                               |
| `favouritedTripFilter` (`trips.ts:283`)       | The same archetype — a named, exported, correlated `EXISTS` predicate over a trip, living in `trips.ts` beside `readableTripFilter`. This is the shelf the new expression belongs on.                                                  |
| `trip_members` indexes (`schema.ts:778-780`)  | `trip_members_trip_user_unq (trip_id, user_id)`, `trip_members_org_trip_idx (organization_id, trip_id)`, **`trip_members_org_user_idx (organization_id, user_id)`**. The third is the one a sub-select driving from the user seeks on. |
| `transports_org_trip_idx` (`schema.ts:1144`)  | `(organization_id, trip_id)` — the index the outer `transports.trip_id in (…)` probe uses.                                                                                                                                             |
| Import graph                                  | `atlas.ts` imports `./base` and `./validation` only. `trips.ts` imports `./base`, `./context`, `./days`, `./validation`. Neither `trips.ts` nor anything it reaches imports `atlas.ts`. **`atlas.ts → trips.ts` closes no cycle.**     |
| D1 bound-parameter ceiling                    | **100 per statement**, recorded in `docs/plans/01-trips-core.md` from Cloudflare's published limits, with the repo's own convention for it: a named constant beside the limit, held by a unit test rather than by a comment.           |
| Trip quota                                    | `free` sells `trips: 2` _at a time_ (archived trips still count in the stats read, which has no `is_archived` term); `starter`, `pro` and `business` sell `trips: null` — unlimited (`src/lib/plans.ts:262`, `:311`, `:367`).          |
| Coverage of the year-boundary leg             | **None.** No test asserts that a leg departing in year Y on a trip starting in year Y−1 lands on year Y's row. That case is the entire reason call site 2 uses the unfiltered membership, and nothing holds it.                        |

### The concept, stated exactly

Two sets are in play in this function and they are not the same set:

- **The member population** — every trip the stat row's `user_id` holds a `trip_members` row on,
  with no date term at all. Call sites 1 and 2 want this.
- **The year cohort** — the subset of that population whose `start_date` falls in `statYear`. The day,
  place, city and spend aggregates want this, and it is exactly what `tripRows` already returns.

The year cohort is _derived from_ the member population; it is not a second spelling of it. The
duplication the ticket found is real, but it is between `memberOfTrip`'s two call sites and the
absence of a shared, owned definition — not between `memberOfTrip` and `tripIds`.

### What this is not

Not a change to which trips count toward a stat row. Not a change to `listTripsForUser`, the
dashboard, or `readableTripFilter`. Not a migration. Not a fix for the pre-existing bound-parameter
cliff in the four year-cohort aggregates (Q5 below files it).

## 📝 Resolved assumptions (autonomous defaults)

This spec was written by an unattended `om-auto-write-spec` run. Each question below was resolved
with the most reversible, smallest-scope answer. Override any of them on this PR before it merges.

| #   | Question                                                                                                                               | Resolution                                                                                                                                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | The ticket asks that `listTripsForUser` be rewired through the new membership helper. Do it?                                           | **No.** `listTripsForUser` is untouched by this spec.                                                                                                                                                               | It is not a membership read. Since ADR 0007 it is a thin alias for `listTrips` over `readableTripFilter` (`trips.ts:219`), which admits organization-visible trips the reader holds no membership row on — and its own docblock says so, naming that wider set as the one the dashboard rail wants. Rewiring it through membership would silently drop those trips from `/dashboard` and from `countTripsByStatus`'s neighbours in `dashboard.ts:69`. A read predicate that ADR 0007 fixed is not narrowed as a side effect of a DRY cleanup.                  |
| Q2  | The ticket asks for a materialized `tripIdsForMember(scope, userId)` id list. Use one?                                                 | **No — a sub-select expression, `memberTripIds(scope, userId)`, whose result is passed to `inArray`.** No ids cross the wire.                                                                                       | D1 rejects a statement carrying more than 100 bound parameters, and drizzle's `inArray` binds one parameter per id (`conditions.cjs:111-119`). Trips are unlimited on every paid plan, so the unfiltered lifetime membership is unbounded. A materialized list makes the 2026 stat row of a 400-trip traveller fail where it succeeds today. `inArray(column, sqlWrapper)` passes the wrapper through unbound (`bindIfParam`, `conditions.cjs:52-57`) and renders `col in (select …)` — verified, see Architecture. Three bound parameters, total.             |
| Q3  | Where does the concept live?                                                                                                           | **`src/server/repos/trips.ts`**, exported as `memberTripIds`, beside `readableTripFilter` and `favouritedTripFilter` under the existing `Guards` banner.                                                            | `docs/SPEC.md` §8: one concept, one owner. `trips.ts` owns `trip_members` — `listTripMembers`, `addTripMember`, `tripRolesFor` and the membership half of `readableTripFilter` are all there — and it already holds two exported trip predicates of exactly this archetype. `atlas.ts → trips.ts` closes no import cycle (`trips.ts` reaches `base`, `context`, `days`, `validation`; none reach `atlas.ts`).                                                                                                                                                  |
| Q4  | Should the four year-cohort aggregates also read through the shared expression?                                                        | **No.** `dayCount`, `placeCount`, `cityRows` and `spendRow` keep `inArray(…, tripIds)` and their `tripIds.length === 0` short-circuits, unchanged.                                                                  | They read a different set — the year cohort, not the member population — and `tripRows` has already paid for it. Pushing the member expression down into them would mean re-deriving `yearFilter` inside a nested `EXISTS` over `trips` for each one: four more statements doing work the function already did, to express a set that is not the one this ticket is about. Smallest diff that removes the duplication the ticket actually found.                                                                                                               |
| Q5  | Those four aggregates already breach the 100-parameter ceiling for a traveller with >100 member trips in one year cohort. Fix it here? | **No — file a follow-up issue** titled `recomputeTravelStats exceeds D1's 100-bound-parameter ceiling on a large year cohort`, linked from this PR. This spec adds nothing to that exposure and removes none of it. | Pre-existing at HEAD, a different concept (how an unbounded id list is chunked), and it wants the repo's established chunking convention — a named constant beside the limit, held by a unit test — applied across all four reads at once. Folding it in here would double the diff and mix a live defect with a structural cleanup, which `docs/SPEC.md` §8's "can half of this land and leave the repository self-consistent?" test says are two items. The vitest driver is in-memory and does not enforce D1's ceiling, so no test will go red either way. |
| Q6  | Does `recomputeTravelStats` gain or lose a database round trip?                                                                        | **Neither.** Six statements before, six after.                                                                                                                                                                      | The membership moves from a correlated `EXISTS` to an `IN (sub-select)` inside the _same two_ statements. The ticket's id-list shape would have added a seventh; this one does not. It also seeks a better index: the sub-select drives from `trip_members_org_user_idx (organization_id, user_id)` — the traveller is the constant — where the correlated `EXISTS` drives from `trip_members_trip_user_unq` once per candidate trip row.                                                                                                                      |

None of the six carries `⚠ NEEDS HUMAN CONFIRMATION`. Q1 and Q2 both decline an instruction written
into the ticket, so they are the two to read first — but each declines it in the _conservative_
direction: Q1 preserves the shipped read predicate rather than narrowing it, and Q2 preserves the
shipped bound-parameter profile rather than growing it.

## 📝 Proposed Solution

One exported function in `trips.ts`, two call sites in `atlas.ts`, one private helper and three
imports deleted.

```ts
// src/server/repos/trips.ts — beside readableTripFilter and favouritedTripFilter

export function memberTripIds(scope: TenantScope, userId: string) {
  return scope.db
    .select({ id: tripMembers.tripId })
    .from(tripMembers)
    .where(tenantFilter(scope, tripMembers, eq(tripMembers.userId, userId)))
}
```

```ts
// src/server/repos/atlas.ts — call site 1
.where(tenantFilter(scope, trips, yearFilter, inArray(trips.id, memberTripIds(scope, userId))))

// src/server/repos/atlas.ts — call site 2
.where(
  tenantFilter(
    scope,
    transports,
    transportYearFilter,
    inArray(transports.tripId, memberTripIds(scope, userId)),
  ),
)
```

The function is called twice rather than its result reused, so each statement gets a fresh builder
and neither can be perturbed by the other. "One definition, two uses" is the property §8 asks for;
"one object, two uses" is not required and is the more fragile of the two.

### Alternatives considered

| Option                                                                                                      | Why not                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The ticket's shape** — `tripIdsForMember` returning `Array<string>`, both call sites on `inArray(…, ids)` | Regresses every stat row of a traveller with more than ~99 lifetime member trips, on plans that sell unlimited trips, by pushing the _unfiltered_ membership through a 100-parameter ceiling that the year-filtered list currently keeps it under. Adds a seventh round trip. Q2. |
| **Move `memberOfTrip` to `trips.ts` and export it unchanged**                                               | Gives the concept an owner and is the smallest possible diff, but keeps the `tripIdColumn: SQLiteColumn` parameter the ticket specifically objects to, and keeps the worse index seek (Q6). The sub-select reaches the same place with a plainer signature.                       |
| **An `INNER JOIN trip_members` on both reads**                                                              | Param-free too, but multiplies the trip row by its membership on call site 1 — the exact hazard `readableTripFilter`'s docblock records — so it needs a `DISTINCT` that the sub-select does not. A third spelling of the concept, in a ticket about there being two.              |
| **Push the member expression into all six aggregates**                                                      | Q4. The other four read the year cohort, and re-deriving `yearFilter` inside a nested `EXISTS` four times is more SQL, not less.                                                                                                                                                  |

## 📝 Architecture

### `src/server/repos/trips.ts` — edited

**Added:** `memberTripIds(scope, userId)`, exported, under the `Guards` banner (`:197`) immediately
after `favouritedTripFilter`, with a docblock that carries over what `memberOfTrip`'s docblock knows
and is worth keeping:

- the population is the `trip_members` rows for the **stat row's** `user_id`, never
  `scope.ctx.userId`, because cron and the queue consumer recompute for someone other than
  themselves;
- membership alone, not the readability predicate — an organization-visible trip is one a person
  _may_ open, not one they are travelling on. This is the sentence that keeps a future reader from
  "simplifying" it into `readableTripFilter`, and it is why the two live side by side;
- a sub-select rather than an id list, naming the D1 ceiling as the reason, in the same register
  `readableTripFilter`'s own docblock uses for "a sub-select rather than a join or a second query".

`tenantFilter(scope, tripMembers, …)` binds the tenant on the inner side; the outer statement binds
it on its own. Neither side can cross an organization boundary, which is the property `memberOfTrip`
already had and this must not lose.

**Not touched:** `listTripsForUser`, `listTrips`, `readableTripFilter`, `readableTrips`,
`favouritedTripFilter`, `tripRolesFor`, or anything else in the file (Q1).

### `src/server/repos/atlas.ts` — edited

**Deleted:** `memberOfTrip` (`:876-894`) and its docblock (`:855-875`). The parts of that docblock
that are still true move to `memberTripIds`; the paragraph arguing for the correlated `EXISTS` and
the column parameter goes with the code it justified.

**Deleted imports:** `exists` (`:17`), `import type { SQL }` (`:55`), `import type { SQLiteColumn }`
(`:56`) — each used only by `memberOfTrip`. `inArray` is already imported (`:19`).

**Added import:** `import { memberTripIds } from './trips'`.

**Edited:** the two `where` clauses, as shown above. The `recomputeTravelStats` docblock's sentence
"`{@link memberOfTrip}` is where it is enforced" and the distance docblock's "`{@link memberOfTrip}`
against `transports.trip_id`" both re-point at `{@link memberTripIds}`; the distance docblock keeps
its whole year-boundary argument, which is unchanged and is the reason call site 2 does not use
`tripIds`.

**Not touched:** `tripIds`, the four year-cohort aggregates, their `length === 0` short-circuits,
`yearCodes`, `regionCount`, `upsertTravelStats`, or the returned figures.

### The rendered SQL, verified rather than assumed

Rendered through drizzle 0.45.2 with the D1 dialect, on a reduction of the three tables to the
columns involved:

```sql
-- call site 1
select "id", "currency", "end_date", "country_codes" from "trips"
where ("trips"."organization_id" = ?
   and "trips"."start_date" >= ? and "trips"."start_date" <= ?
   and "trips"."id" in (select "trip_id" from "trip_members"
                        where ("trip_members"."organization_id" = ?
                           and "trip_members"."user_id" = ?)))
order by "trips"."start_date" desc

-- call site 2
select sum("distance_metres") from "transports"
where ("transports"."organization_id" = ?
   and "transports"."departure_date" >= ? and "transports"."departure_date" <= ?
   and "transports"."trip_id" in (select "trip_id" from "trip_members"
                                  where ("trip_members"."organization_id" = ?
                                     and "trip_members"."user_id" = ?)))
```

Five bound parameters on a year row, three on the all-time row, **independent of how many trips the
traveller is on** — which is the whole point. `inArray` passes an `SQLWrapper` through unbound
(`drizzle-orm/sql/expressions/conditions.cjs:52-57`, and the `values: … | SQLWrapper` overload at
`conditions.d.ts:170`), so nothing here relies on undocumented behaviour.

### Files this spec does **not** touch

`src/server/repos/dashboard.ts`, `src/server/repos/base.ts`, `src/server/db/schema.ts`, `drizzle/`,
every route and server function, and every locale file.

## 📝 Data Model

No change. No migration, no new column, no new index — `trip_members_org_user_idx`,
`transports_org_trip_idx` and the `trips` primary key already cover both statements
(`schema.ts:780`, `:1144`).

## 📝 API Contracts

No server function, route, or public projection changes. One internal repository surface grows by
one named export:

| Surface                                      | Before                                                         | After                                                 |
| -------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `src/server/repos/trips.ts`                  | —                                                              | `+ memberTripIds(scope: TenantScope, userId: string)` |
| `src/server/repos/atlas.ts` (module-private) | `memberOfTrip(scope, userId, tripIdColumn: SQLiteColumn): SQL` | deleted                                               |
| `src/server/repos/index.ts`                  | `export * from './trips'`                                      | unchanged — the new export re-exports itself          |

`recomputeTravelStats`'s signature, return type and every figure on the row are unchanged. Zod is
untouched: this function takes no client input (`docs/SPEC.md` §6's rule applies at the server-function
boundary, and `recomputeTravelStats` is called by cron and the queue consumer).

## 📝 UI/UX

None. `recomputeTravelStats` is called by the cron trigger and the queue consumer; nothing reads it
live, and the stat row it writes is unchanged figure for figure.

## 📝 Visual change expected

**None.** No route renders differently, in either theme or at any viewport. `/_app/atlas` and the
dashboard stat cards read `travel_stats` rows whose values this change does not move, so the blind
A/B pair (`docs/SPEC.md` §7 item 4) has nothing to compare and the QA gate is `skip-qa`.

The evidence that the figures did not move is the repository test suite, not a screenshot — see
Implementation Plan step 3.

## 📝 Copy

**None.** No user-facing string is added, changed or removed, so no locale file is touched and the
i18n parity test is unaffected.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                               | Behaviour after the change                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The traveller is on **no** trip                                                    | The sub-select returns no rows, `trips.id in (…)` is false for every row, `tripRows` is empty, `tripIds` is empty and the four short-circuits fire exactly as today. Distance sums nothing and `Number(null ?? 0)` writes `0`. Held by the existing "workspace member who is on no trip" block (`tenant-isolation.test.ts:2016`). |
| The `userId` belongs to **another tenant**                                         | `tenantFilter` binds the caller's `organization_id` on both the inner and the outer side, so the sub-select is empty and every figure is zero — the same answer as today, and the same one the "foreign traveller" block asserts (`tenant-isolation.test.ts:1812-2014`).                                                          |
| A leg **departs in a different calendar year** than its trip starts                | The unfiltered member population is still what call site 2 filters on, so the leg lands on the year it departed in. This is the case the `EXISTS` existed for, it is currently untested, and step 3 puts a test under it.                                                                                                         |
| The traveller is on **more than 100** trips                                        | Call sites 1 and 2 are unaffected — they bind five parameters regardless. The four year-cohort aggregates still bind one per trip _in the year cohort_ and still break past ~99, exactly as at HEAD. Q5's follow-up owns that; this change neither causes nor widens it.                                                          |
| A trip is **archived**                                                             | Counted, as at HEAD — `recomputeTravelStats` has no `is_archived` term and this spec does not add one.                                                                                                                                                                                                                            |
| Cron or the queue consumer recomputes for a user who is **not** `scope.ctx.userId` | Correct, and this is the property most at risk from a careless "reuse `readableTripFilter`" refactor. `memberTripIds` takes `userId` explicitly and never reads `scope.ctx.userId`; its docblock says why, and `tenant-isolation.test.ts:1812` is the block that would catch a regression.                                         |
| `trip_members` holds a row for a **deleted** trip                                  | Impossible — `trip_members.trip_id` is `references(() => trips.id, { onDelete: 'cascade' })` (`schema.ts:769`). And an id in the sub-select that matched no trip row would simply not match, rather than producing a phantom.                                                                                                     |

## 📝 Risks & Impact Review

| Risk                                                                                        | Severity | Mitigation                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The refactor silently changes a figure on a stat row                                        | Medium   | The change is behaviour-preserving by construction — the same population, expressed as `IN (sub-select)` rather than `EXISTS`. It is held by nine existing assertions across `tenant-isolation.test.ts:1812-2054` and `repositories.test.ts:666-684`, which run unchanged and must stay green without edits. **A test that needs editing to pass is the signal that the refactor changed behaviour.** |
| The query planner picks a worse plan for `IN (sub-select)` than for the correlated `EXISTS` | Low      | Both indexes exist and the sub-select's is the more selective one: it drives from `trip_members_org_user_idx (organization_id, user_id)` with both columns constant, where the `EXISTS` drove from `trip_members_trip_user_unq` once per candidate row. SQLite materializes a small, deterministic sub-select once per statement.                                                                     |
| `atlas.ts` importing `trips.ts` closes an import cycle                                      | Low      | Verified absent: `trips.ts` imports `./base`, `./context`, `./days`, `./validation`, and none of those reaches `atlas.ts`. Only `dashboard.ts` and `index.ts` import `atlas.ts`. `pnpm typecheck` and `pnpm build` are the mechanical check.                                                                                                                                                          |
| Q1's refusal is wrong and the ticket author really does want `listTripsForUser` narrowed    | Medium   | Surfaced as the first row of the assumptions table and in the PR comment, before merge. If the author wants it, it is a separate item with an ADR amendment — narrowing a read predicate ADR 0007 fixed is not a refactor.                                                                                                                                                                            |
| Q5's follow-up is never filed and the bound-parameter cliff is forgotten                    | Low      | The follow-up issue is filed as part of step 1 of the implementation, not as a promise in a comment, and this PR links it.                                                                                                                                                                                                                                                                            |
| **💥 Breaking changes**                                                                     | —        | **None.** No public surface, no schema, no stored value, no rendered pixel. One module-private helper is deleted and one internal export is added.                                                                                                                                                                                                                                                    |

## 📋 Phasing

One phase. The change is a single concept — "the member-trip population and how `recomputeTravelStats`
reads it" — and `docs/SPEC.md` §8's test says half of it landing would leave the repository
inconsistent: `memberOfTrip` deleted with one call site still on it does not compile.

## 📋 Implementation Plan

### Phase 1 — one owner, two call sites

**Step 1 — file the follow-up (Q5).** Open the issue
`recomputeTravelStats exceeds D1's 100-bound-parameter ceiling on a large year cohort`, labelled
`bug` + `priority-medium`, naming the four aggregates (`atlas.ts:968-1000`), the ceiling and the
repo's chunking convention (`docs/plans/01-trips-core.md`), and the fact that the in-memory vitest
driver does not enforce the limit. Link it from this implementation's PR body.
_Verify:_ the issue exists and is referenced from the PR.

**Step 2 — add `memberTripIds` to `trips.ts`.** Export it under the `Guards` banner after
`favouritedTripFilter`, with the docblock described in Architecture. No call site yet.
_Verify:_ `pnpm typecheck` and `pnpm lint` clean; `pnpm test` unchanged and green.

**Step 3 — write the year-boundary regression test first.** In
`src/server/repos/__tests__/repositories.test.ts`, beside the existing `recomputeTravelStats` case
(`:666`): a trip starting 30 December of year Y−1 with a transport departing 2 January of year Y and
a recorded `distance_metres`, asserting that year Y's row carries that distance and year Y−1's does
not. This is the property call site 2's unfiltered population exists to hold and the only one no
existing test covers.
_Verify:_ the new test passes on HEAD **before** step 4 — it is a characterization test, not a
red-green cycle, and a test that only passes after the refactor is testing the wrong thing.

**Step 4 — rewire both call sites and delete `memberOfTrip`.** Replace the two `where` clauses, delete
the helper and its docblock, drop the `exists` / `SQL` / `SQLiteColumn` imports, add the
`memberTripIds` import, and re-point the two `{@link}` references.
_Verify:_ `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Every assertion in
`tenant-isolation.test.ts:1812-2054`, `repositories.test.ts:666-684`, `member-isolation.test.ts` and
`trip-lifecycle.test.ts` passes **without being edited**; `grep -rn 'memberOfTrip\|SQLiteColumn' src/server/repos/atlas.ts`
returns nothing.

**Step 5 — the full gate.** `node .ai/scripts/agent-kit-check.mjs`, `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh`.
_Verify:_ all green. No screenshots — Visual change expected is "none", and the PR carries `skip-qa`.

### Out of scope, recorded so it is not re-derived

- Narrowing `listTripsForUser` to membership (Q1) — needs an ADR amendment, not a refactor.
- Chunking the four year-cohort aggregates under D1's 100-parameter ceiling (Q5) — its own issue.
- Year-scoping `regionCount` through `visited_regions.first_visited_on` — already recorded as a
  ticket of its own in `recomputeTravelStats`'s docblock, and untouched here.
- An `is_archived` term on the stat population — not a question this ticket asked.
