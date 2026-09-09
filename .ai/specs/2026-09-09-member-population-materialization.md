# One membership read, not one membership list

Tracker: FR #136, filed by the sandcastle deep-review (run 90519) while reviewing #107.
Measured on `develop` at `944b4103`. Every code claim below was verified against the tree at that
commit and against `node_modules/drizzle-orm` for the rendering claims.

## 📝 TLDR

FR #136 asks that `recomputeTravelStats` stop expressing "the trips this person is a member of"
twice — once as the correlated `EXISTS` in `memberOfTrip` (`atlas.ts:876`), once as the materialized
`tripIds` list (`atlas.ts:944`) — by fetching the member's trips **unfiltered by year**, applying the
year window in TypeScript, and driving the leg-distance aggregate off `inArray(transports.tripId,
allMemberTripIds)`.

**The defect it names is real. It already has an owner, and the mechanism it proposes would put a
fresh D1 bound-parameter cliff into the one statement in this function that has none.** This spec
builds nothing and recommends closing #136. Three findings, each measured rather than argued:

1. **The duplication is already owned.** `.ai/specs/2026-09-09-member-trip-population.md` (FR #133,
   merged on `develop` as PR #368, commit `1a28035d`) deletes `memberOfTrip`, the `exists` import and
   both type imports, and gives the concept one exported owner — `memberTripIds(scope, userId)` in
   `trips.ts`, rendered as a **sub-select**. Both of #136's substantive asks land there; its third,
   cosmetic ask is made moot rather than granted (see "What is left of #136", below).
2. **The distance change is rejected by D1.** `MAX_BOUND_PARAMETERS = 100` (`trips.ts:774`) is this
   repository's own codified copy of Cloudflare's per-statement ceiling, pinned by
   `expect(MAX_BOUND_PARAMETERS).toBe(100)` (`trip-lifecycle.test.ts:695`). Both paid plans — `solo`
   and `crew` — sell **unlimited** trips (`plans.ts:311`, `:367`; `free` sells two, `:262`).
   `inArray(transports.tripId, allMemberTripIds)` binds one parameter per **lifetime** member trip on
   a statement that today binds **none**.
3. **CI cannot see it.** The repository suite drives drizzle through `sqlite-proxy` over
   `node:sqlite` (`repos/__tests__/harness.ts:15`, `:20`, `:150`), which does not enforce D1's
   ceiling. Every assertion stays green and the failure appears only against D1, inside a queue
   consumer.

The half of #136 that is independent of the distance change — moving the year window from SQL into
TypeScript — is also declined, on cost rather than correctness: it removes no concept (both date
predicates survive, on different columns) and makes every year recompute read the traveller's whole
lifetime trip list, `country_codes` JSON included.

Backend only. Nothing changes on screen, no copy, no migration, no code.

## 📝 Problem Statement

### What `recomputeTravelStats` does today

| Piece                                               | State at HEAD                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `memberOfTrip` (`atlas.ts:876-894`)                 | Module-private. `(scope, userId, tripIdColumn: SQLiteColumn) => SQL`. Correlated `EXISTS` over `trip_members`, tenant-filtered on both sides. Two call sites.            |
| `yearFilter` (`atlas.ts:918-924`)                   | `undefined` for the all-time row; otherwise `trips.start_date` between `${statYear}-01-01` and `-12-31`.                                                                 |
| Trip read (`atlas.ts:926-942`)                      | Selects `id`, `currency`, `end_date`, `country_codes` — **not `start_date`** — where `yearFilter` and `memberOfTrip(…, trips.id)`, ordered `start_date desc`.            |
| `tripIds` (`atlas.ts:944`)                          | `tripRows.map(row => row.id)`. For a year row this is the **year cohort**; for the all-time row (`yearFilter === undefined`) it is the **whole lifetime membership**.    |
| Four cohort aggregates (`atlas.ts:968-1000`)        | `dayCount`, `placeCount`, `cityRows`, `spendRow`: `inArray(x.tripId, tripIds)`, each behind a `tripIds.length === 0` short-circuit. **One bound parameter per id.**      |
| Distance (`atlas.ts:1001-1011`)                     | `sum(transports.distance_metres)` where `transportYearFilter` and `memberOfTrip(…, transports.tripId)`. **No bound parameter scales with trip count** — hence no guard.  |
| `transportYearFilter` (`atlas.ts:958-964`)          | `transports.departure_date` within the year. Deliberately its own date column: a trip starting 30 December has January legs, and a year row sums legs by their own date. |
| `exists`, `SQL`, `SQLiteColumn` (`:17`,`:55`,`:56`) | Used by `memberOfTrip` and nothing else — the other `SQL` occurrences (`:415`, `:475`) are the word in prose.                                                            |

All six statements run in one `Promise.all` (`atlas.ts:966-1013`), so one rejected statement fails the
whole recompute, not one figure.

### What #133's merged spec already does to it

`.ai/specs/2026-09-09-member-trip-population.md` is on `develop` and unimplemented. Its design adds
`memberTripIds(scope, userId)` to `trips.ts` — a `select({ id: tripMembers.tripId })` builder passed
to `inArray` as an `SQLWrapper`, so it renders `col in (select …)` and binds nothing per trip —
rewires both `memberOfTrip` call sites onto it, **deletes `memberOfTrip` and the `exists` / `SQL` /
`SQLiteColumn` imports**, leaves the four cohort aggregates on `tripIds` because the year cohort is a
different set, and records the cohort aggregates' pre-existing parameter cliff as a follow-up issue
owed by its own implementation step 1 (its Q5).

After #133 lands, `recomputeTravelStats` has **one definition** of the member population with two
uses, five bound parameters on each of those two statements regardless of trip count, and the same
six statements as today.

### What is left of #136 once #133 is subtracted

#136 asks for three things. #133 grants the first two and makes the third moot:

| #136 asks for                                                                             | After #133                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `memberOfTrip` and the `exists` / `SQL` / `SQLiteColumn` imports deleted                  | **Granted**, identically.                                                                                                     |
| One expression of the member population instead of two                                    | **Granted** — one exported owner, two uses.                                                                                   |
| The distance query to stop being "the one aggregate with no `tripIds.length === 0` guard" | **Moot.** A sub-select needs no guard; the shape difference disappears because the id list it would have needed never exists. |

What remains unimplemented is therefore only the _mechanism_: replace call site 2's sub-select with a
JavaScript-held id list, and move the year window out of SQL into a TypeScript `filter`. The first is
finding 2 above. The second is a cost with no matching benefit — Q3.

### The ticket's own defence, taken seriously

#136 makes three arguments for itself, and two of them are correct:

> "This is not the `tripIdsForMember` suggestion the loop rejected in acfeb1cb"

**Correct, and worth stating plainly.** `acfeb1cb` rejected `tripIdsForMember` because it was _a
second query_ and because `trips.ts` was outside that issue's owned paths. Neither objection applies
to #136, which reuses the `tripRows` read the function already performs. This spec does not recycle
that rejection.

> "it adds zero queries"

**Correct.** Six statements before, six after; the change adds none. It also subtracts one in the
no-trip case, where #136's guard skips the distance read that today runs unguarded — three statements
today against two after, not zero after: the trip read and `listVisitedCountries` run whatever
`tripIds` holds. Round-trip count is not the objection here.

> "the all-time pass already reads exactly that set and already `inArray`s over it, so neither the
> row-scan shape nor the SQLite variable-count exposure is new."

**True as to class, false as to reach — and the reach is what decides it.** At `statYear = 0`,
`yearFilter` is `undefined` (`atlas.ts:918-920`), so `tripIds` genuinely _is_ the full lifetime
membership and genuinely _is_ fed to four `inArray`s. The author is right that this is not a new
_kind_ of exposure. But take a `solo` traveller on 400 lifetime member trips, twelve of them starting
in 2026:

| Statement              | Today, `statYear = 2026` | After #136, `statYear = 2026` |
| ---------------------- | ------------------------ | ----------------------------- |
| Four cohort aggregates | 12 trip parameters each  | 12 trip parameters each       |
| Distance               | **0** trip parameters    | **400** — D1 rejects it       |

The distance statement is the one place in this function that is _structurally_ immune to trip count,
and #136 removes that immunity. That is a new statement joining the cliff, not the same statement
staying where it was.

### The honest weakening of that argument, and why it survives

That same 400-trip traveller **already** has a permanently failing all-time recompute today: the four
cohort aggregates bind 400 parameters at `statYear = 0`, and because all six statements share one
`Promise.all`, the whole task fails. Every trip write enqueues an all-time recompute
(`trip-lifecycle.ts:275-286` always seeds `ALL_TIME_STAT_YEAR` into the fan-out; `:321-352` sends it
to every member), so for this cohort the statistics panel is already frozen. #136's marginal damage
today is to freeze the year row of a traveller whose all-time row is frozen anyway.

The argument survives on **ordering**. That pre-existing cliff has an owner and a known fix: chunk
the four cohort aggregates under `MAX_BOUND_PARAMETERS`, the convention this repository already
applies twice (`trips.ts:774-779`, `notifications/dispatch.ts:88` and `:270`). When that fix lands,
the four aggregates stop breaching the ceiling — and a distance statement built on #136's id list
would be a fifth statement needing the same treatment, on the one statement in this function that
needs none today.

The requirement it adds is **avoidable, not unsolvable**, and the distinction matters because the
weaker claim is the true one: `spendRow` is already a `sum()` over an `inArray` id list inside the
set this document calls covered, so a chunked fold generalizes from `count()` to `sum()` without a
new technique. The objection is that the work would be gratuitous. #133's sub-select binds nothing
per trip and needs no chunking at all, so #136 buys a chunking obligation for a statement that is
structurally immune to trip count today, and buys nothing with it. Landing it _before_ the cliff fix
hides that obligation inside a batch of statements already owed one; landing it _after_ makes it the
one statement the just-finished fix has to be reopened to cover.

### What this is not

Not a defence of `memberOfTrip` — it should go, and #133 removes it. Not a claim that the four cohort
aggregates are safe — they are not, and that has its own ticket. Not a rejection of #133. Not a
change to any figure on any stat row.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written by an unattended `om-auto-write-spec` run. Each question was resolved with the
most reversible, smallest-scope answer. Override any of them on this PR before it merges.

| #   | Question                                                                                      | Resolution                                                                                                                                         | Why                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Adopt the ticket's `inArray(transports.tripId, allMemberTripIds)` for the distance aggregate? | **No.**                                                                                                                                            | It binds one D1 parameter per lifetime member trip on the one statement in this function that today binds none, against a ceiling codified twice in this repository and pinned by a unit test, on plans that sell unlimited trips. It buys a chunking obligation the sub-select does not carry, for no gain. Doing nothing is the reversible option.                                                 |
| Q2  | Is the duplication the ticket names still unowned?                                            | **No — FR #133's merged spec owns it**, and its `memberTripIds` sub-select performs both deletions #136 asks for.                                  | `.ai/specs/2026-09-09-member-trip-population.md` landed on `develop` at `1a28035d` (PR #368). `docs/SPEC.md` §8 asks for one concept with one owner; two specs proposing two owners for one concept is the same violation with extra steps. The later ticket yields to the merged design.                                                                                                            |
| Q3  | Move the year window from SQL (`yearFilter`) into a TypeScript `filter`, independently of Q1? | **No.**                                                                                                                                            | It deletes no concept: `transportYearFilter` stays in SQL regardless, because legs are windowed on their own `departure_date`, so the function keeps two year expressions either way. It costs every year recompute the traveller's full lifetime trip list including the `country_codes` JSON — 400 rows where 12 were needed — on a fan-out path that runs for every member of every trip write.   |
| Q4  | Then what does this spec build?                                                               | **Nothing under `src/`.** It is a decision record; the recommendation is that a human closes #136 once #133's implementation lands.                | `om-spec-writing`'s smallest-scope rule taken to its conclusion. The value is that the analysis is written down: without it the next deep-review pass re-derives the same suggestion and the same rebuttal has to be re-earned — exactly what #133's "recorded so it is not re-derived" section exists to prevent.                                                                                   |
| Q5  | The four cohort aggregates really do breach the ceiling. File that issue from this run?       | **No — #133's implementation step 1 owns it**, under the title it already names. This spec restates that title so both runs converge on one issue. | Filing it here would race #133's step 1 and produce two issues for one defect. It is also a different concept — how an unbounded id list is chunked — not the concept #136 raised. Naming caveat: #133's title says "on a large year cohort", and the all-time row is the case that fails first; the title is kept unchanged anyway, because convergence on one issue matters more than its wording. |
| Q6  | The ticket's diff is smaller on paper than in code. Fold the discrepancies into scope?        | **No.** Recorded as observations only.                                                                                                             | Two of them: the trip read does not select `start_date` (`atlas.ts:928-931`), so the ticket's TypeScript predicate needs a column added first; and it selects `end_date`, which `recomputeTravelStats` never reads. The second is pre-existing dead selection, unrelated to either ticket, and this repository's convention is to name such a find rather than delete it as a side effect.           |

None of the six carries `⚠ NEEDS HUMAN CONFIRMATION`. Q1, Q3 and Q4 together decline the ticket
outright, so they are the three to read first — but each declines in the direction that changes
nothing: no statement's parameter profile grows, no read widens, no figure moves. **Merging this PR
does not close #136**; a human does, at step 3 below.

## 📝 Proposed Solution

No code. The sequence is:

1. **Land this document**, so the analysis exists before anyone acts on it.
2. **Implement FR #133.** That is #133's own plan, owned by its own spec and its own PR — a
   dependency of the recommendation below, not a step of this one.
3. **A human closes #136 as superseded**, once #133's implementation merges, quoting Q1. Not before:
   until `memberOfTrip` is actually gone, #136 still describes a true state of the code.

### Alternatives considered

| Option                                                                                   | Why not                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implement #136 as written**                                                            | Q1. Puts an unbounded parameter list into the one statement that has none, on plans sold as unlimited, where no test can see it, and where the known chunking fix would have to be extended to reach it.                                                                                                                                                             |
| **Implement #136's TypeScript year window only, keeping #133's sub-select for distance** | Correct — no parameter grows — but pointless: Q3. It trades a five-parameter SQL predicate for a full-lifetime-list read on the fan-out path, and removes no concept, because `transportYearFilter` stays in SQL either way.                                                                                                                                         |
| **Implement #136 with the id lists chunked under `MAX_BOUND_PARAMETERS`**                | Buys nothing #133 has not already bought. Chunking the distance read is tractable — summing the partial sums in TypeScript, the same additive fold `spendRow` would need — but it is a new correctness surface added to remove a sub-select that already works. Chunking belongs where an id list is genuinely unavoidable — the four cohort aggregates, Q5's issue. |
| **Close #136 immediately as a duplicate of #133, with no spec**                          | Loses the analysis. #136 is not a duplicate: it proposes a different mechanism, it correctly distinguishes itself from the `acfeb1cb` rejection, and its central factual claim needs measurement rather than assertion to place. A one-line duplicate closure invites the same proposal a third time.                                                                |
| **Supersede #133's design with #136's**                                                  | The merged design is better on every axis that changes the verdict: fewer bound parameters, fewer rows read, the same statement count, one exported owner. The id list wins one axis, and it is not one of those: on a traveller with no trips its guard skips the distance read that the sub-select simply runs — one statement, binding nothing.                   |

## 📝 Architecture

No component, boundary or data flow changes. For the record, the shape this spec leaves in place is
#133's, and the two properties that must survive any future revisit of this area are:

- **The population is the stat row's `userId`, never `scope.ctx.userId`.** Cron and the queue
  consumer recompute for someone other than themselves (`queue/handlers/travel-stats.ts:207-225`).
- **The two populations are different sets.** "Every trip this person is a member of" (the trip read
  and the distance read) and "the subset of those that started in year Y" (the four cohort
  aggregates) are not two spellings of one concept, and a refactor that collapses them changes which
  legs land on which year's row.

### Files this spec touches

`.ai/specs/2026-09-09-member-population-materialization.md` — this file. Nothing else, in `src/` or
anywhere else.

### One correction owed to a neighbouring document

`.ai/specs/2026-09-09-member-trip-population.md:59` names the unlimited-trip plans as `starter`,
`pro` and `business`. This repository's plans are `free`, `solo` and `crew` (`plans.ts:28`), and the
line numbers that line cites for `trips: null` (`:311`, `:367`) are correct but belong to `solo` and
`crew`. Line `:20` cites the same two line numbers and is fine as written — it says "the paid plans"
without naming them, so `:59` is the only line to correct. Its argument is unaffected — both paid
plans do sell unlimited trips — but the names are wrong. Recorded here rather than fixed, because
that document is merged and belongs to FR #133; its implementation PR is the right place to correct
it.

## 📝 Data Model

No change. No migration, no column, no index.

## 📝 API Contracts

No change. No server function, route, repository export or public projection moves.
`recomputeTravelStats`'s signature, return type and every figure it writes are untouched, as is
`docs/SPEC.md` §6's Zod rule, which binds at the server-function boundary this function does not sit
on.

## 📝 UI/UX

None.

## 📝 Visual change expected

**None.** No route renders differently, in either theme, at any viewport. No code changes, so the
blind A/B pair (`docs/SPEC.md` §7 item 4) has nothing to compare and the PR carries `skip-qa`.

## 📝 Copy

**None.** No user-facing string is added, changed or removed. No locale file is touched and the
23-locale parity test is unaffected.

## 📝 Edge Cases & Failure Scenarios

The cases below describe what **would** happen if #136 were implemented as written — the evidence for
declining it.

| Case                                                                  | Under #136 as written                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `solo` traveller on 400 lifetime trips, 12 in 2026, recomputes 2026 | The distance statement binds 400 parameters and D1 rejects it; the shared `Promise.all` fails the whole task. Works today.                                                                                                    |
| The same traveller recomputes all-time                                | Already failing today on the four cohort aggregates — Q5's issue, not this one's. #136 neither causes nor fixes it.                                                                                                           |
| The same traveller, **after** Q5's chunking fix lands                 | The four aggregates are chunked and pass; the distance statement built on an id list is the only remaining breach, and the fix that just landed has to be reopened to cover it. This is the case that decides Q1.             |
| A `free` traveller on 2 trips (`plans.ts:262`)                        | Works. The regression is invisible until a workspace grows, which is the worst shape for a defect to have.                                                                                                                    |
| The whole repository test suite                                       | Green. `harness.ts:15` drives `sqlite-proxy` over `node:sqlite`, which does not enforce D1's 100. The refactor would ship looking verified.                                                                                   |
| A leg departing 2 January on a trip that started 30 December          | Still lands on the departure year — `allMemberTripIds` is deliberately unfiltered, and #136 gets this right. #133's implementation step 3 puts the first test under this property, which nothing currently holds.             |
| The traveller is on no trip                                           | `allMemberTripIds` is empty. #136's guard saves a round trip; it is not a correctness requirement, because drizzle renders `sql\`false\`` for an empty array rather than invalid SQL. The sub-select needs no guard at all.   |
| The `userId` belongs to another tenant                                | Still isolated: the id list is derived from a `tenantFilter`-scoped, membership-scoped read, so it cannot name a foreign trip. Tenant safety is not the objection, and `tenant-isolation.test.ts:1812-2054` would stay green. |

## 📝 Risks & Impact Review

| Risk                                                                                           | Severity | Mitigation                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #133's implementation never lands, so #136 is closed while `memberOfTrip` is still in the tree | Medium   | The recommendation is explicitly gated on #133's implementation PR merging, and merging this PR closes nothing. Until then #136 stays open with this document linked from it as the reason not to implement it as written.                                                  |
| The verdict is wrong because D1's ceiling is not 100                                           | Low      | It is this repository's own number, in two independently written places (`trips.ts:774`, `notifications/dispatch.ts:88`), one pinned by `expect(MAX_BOUND_PARAMETERS).toBe(100)`. If Cloudflare has raised it, the constant is the single place to correct, and Q1 with it. |
| Declining a human-filed FR outright is the wrong call for a reviewer to make unattended        | Medium   | Surfaced as Q1/Q3/Q4 at the top of the assumptions table and posted as a PR comment before merge. The decision costs nothing to reverse — no code moved — and the FR is closed by a human, not by this PR.                                                                  |
| The cohort-aggregate cliff (Q5) is forgotten because both specs deferred it                    | Medium   | Named here with the same issue title #133 uses, so the two runs converge on one issue rather than each assuming the other filed it. If #133's implementation reaches step 1 and finds no issue, it files one; this document is the second reminder.                         |
| Q1 is read as "the cliff does not matter", because the all-time row already fails              | Medium   | Stated explicitly in "The honest weakening of that argument": the cliff matters _more_ after it is fixed, not less, and that is why the ordering argument rather than the today-snapshot carries the verdict.                                                               |
| A future reader mistakes this spec for a rejection of refactoring `recomputeTravelStats`       | Low      | The TLDR's first sentence grants the defect and names #133 as the fix. This document declines one mechanism, not the cleanup.                                                                                                                                               |
| **💥 Breaking changes**                                                                        | —        | **None.** No code, no schema, no stored value, no rendered pixel.                                                                                                                                                                                                           |

## 📋 Phasing

One phase, zero implementation steps under `src/`. The deliverable is this document. The tracker
hygiene that follows depends on FR #133's implementation, which is that spec's plan and not this
one's.

## 📋 Implementation Plan

### Phase 1 — record the decision

**Step 1 — land this document.** Merge the spec PR carrying this file, with `Refs #136`.
_Verify:_ `.ai/specs/2026-09-09-member-population-materialization.md` is on `develop`, the PR is
linked from #136, and #136 is still open.

That is the whole of this spec's own work. The two actions below are **not steps of this plan** — they
are the recommendation it makes, gated on work owned elsewhere, recorded so the gate is legible.

### Recommended follow-through, owned elsewhere

- **Dependency: FR #133's implementation** (`om-auto-implement-spec` against
  `.ai/specs/2026-09-09-member-trip-population.md`). Nothing in this document changes that plan; it
  only explains why the competing plan was not adopted. Its step 1 files the Q5 follow-up
  (`recomputeTravelStats exceeds D1's 100-bound-parameter ceiling on a large year cohort`, `bug` +
  `priority-medium`, naming `atlas.ts:968-1000`, the ceiling, and `trips.ts:774-779` /
  `notifications/dispatch.ts:88`, `:270` as the convention to apply). Its implementation PR is also
  the right place to correct the plan names noted under Architecture.
- **Then, a human closes #136**, commenting with Q1's measurement and a link to this document. A
  human decision, not an automated one: this run declined a ticket its author filed deliberately, and
  the author gets to overrule that.

### Out of scope, recorded so it is not re-derived

- Chunking the four cohort aggregates under D1's ceiling — Q5's own issue, and the only place in this
  function where an id list is genuinely unavoidable.
- Dropping the unused `end_date` from the trip read's projection (`atlas.ts:930`) — pre-existing dead
  selection, unrelated to either ticket (Q6).
- Adding `start_date` to that projection — only needed by the TypeScript year window this spec
  declines (Q6).
- Year-scoping `regionCount` through `visited_regions.first_visited_on` — already recorded as its own
  ticket in `recomputeTravelStats`'s docblock.
- An `is_archived` term on the stat population — not a question either ticket asked.
