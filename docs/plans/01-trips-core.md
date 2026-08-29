# 01 — Trips core

## Area brief

A trip is the aggregate root of this product: every place, day, booking, expense, list, file and
message in the repository hangs off one. This plan owns the eleven `TRP-*` rows of
`.claude/ultrabuild/recon/gap-rows.json` — the trip list and its lifecycle, trip creation, membership
and guests, the planner workspace shell, the day model and the merged day timeline.

Read `docs/SPEC.md`, `DESIGN.md` and `docs/ARCHITECTURE.md` first, then `TEMPLATE.md` for the
stage shape, `README.md` for the shared-file protocol and the wave table, and
`12-verification-protocol.md` for what a **Verification** heading has to contain. This file does not
restate them.

## What is already on disk, measured

The trips area is not greenfield. Every claim below was read at this branch's HEAD, and a stage that
contradicts one owes its own measurement.

| Surface                                                          | State at HEAD                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/_app/trips/index.tsx` (264 lines)                    | Ships, D1-live. Status pills with counts, favourites and archived scopes, a search form bound to the URL, an `Alert` at the trip ceiling, a designed empty state, `TripGrid` and a pending skeleton.                  |
| `src/routes/_app/dashboard.tsx` (537 lines)                      | Ships, D1-live. `UpNext` hero, stat row, trip mix, next bookings, storage meter, pending skeleton.                                                                                                                    |
| `src/routes/_app/-ui/trip-card.tsx` (263 lines)                  | `TripTile`, `TripGrid`, `AddTile`. Renders a cover, a countdown badge and a place count. No per-card actions.                                                                                                         |
| `src/routes/_app/-ui/new-trip-dialog.tsx` (247 lines)            | Five fields — title, destination, two dates, currency — over `createTripFn`. No cover, no reminder, no members.                                                                                                       |
| `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` (1437 lines) | The planner. One full-bleed MapLibre canvas, two folding glass rails, a category filter bar, `@dnd-kit` with an optimistic `PlanOrder` that rolls back, a bidirectional selection reducer, fold-aware camera padding. |
| `src/routes/_app/trips/$tripId/-server/plan.ts` (536 lines)      | `loadPlanBoard` plus eight writes, each one Zod-validated and one repository call deep.                                                                                                                               |
| `src/server/repos/trips.ts` (520 lines)                          | `createTrip`, `updateTrip`, `archiveTrip`, `restoreTrip`, `setTripFavourite`, `deleteTrip`, the `trip_members` writers and the share-link writers. Only `createTrip` and the readers have a caller.                   |
| `src/server/repos/days.ts` (254 lines)                           | `syncTripDays` owns the contiguous `1..n` day run. `createDayNote`, `updateDayNote`, `deleteDayNote` exist; only `createDayNote` is called, and only by the seeder and the isolation fixture.                         |
| `src/components/planner/` (12 modules)                           | `ordering.ts` is the pure move engine, `plan-dnd.ts` the drag adapter, `selection.ts` the cross-highlight reducer, plus `DaySection`, `StopRow`, `IdeasList`, `PlannerRail`, `PlaceThumb`, `DragPreview`.             |
| `src/components/layout/trip-sub-nav.tsx` (122 lines)             | The seven-tab strip on the inverse band, with a `motion` active pill and a Share button that currently links to the Collab tab.                                                                                       |

Two consequences bind every stage in this file. **No stage recreates the trips index or the
dashboard**: both ship, both are D1-live, and both are edited in place by exactly one stage each.
**No stage rewrites the drag engine**: `TRP-10` is already closed on disk, and `01-S4` extends it
under an explicit no-regression obligation rather than replacing it.

## Where the eleven rows land

| Row      | Status now | Stage               | Wave | Moves to                             |
| -------- | ---------- | ------------------- | ---- | ------------------------------------ |
| `TRP-03` | absent     | `01-S1`             | 1    | done                                 |
| `TRP-09` | absent     | `01-S2`             | 1    | done                                 |
| `TRP-07` | partial    | `01-S3`             | 1    | done                                 |
| `TRP-08` | partial    | `01-S4`             | 2    | done                                 |
| `TRP-10` | done       | `01-S4` (protected) | 2    | done                                 |
| `TRP-05` | absent     | `01-S5`             | 2    | partial — deferral stated in `01-S5` |
| `TRP-11` | absent     | `01-S6`             | 4    | done                                 |
| `TRP-01` | partial    | `01-S7`             | 5    | done                                 |
| `TRP-02` | partial    | `01-S8`             | 5    | partial — deferral stated in `01-S8` |
| `TRP-06` | partial    | `01-S9`             | 5    | done                                 |
| `TRP-04` | partial    | `01-S10`            | 6    | done                                 |

Ten stages, eleven rows. `01-S4` carries two: the row it closes and the row it must not break.

**Two rows land partial rather than done, and both say so in one place each.** `TRP-05` keeps its
currency converter and `TRP-02` keeps its stock-photo cover search, and each of those two capabilities
waits on a commercial decision nobody has taken — a rate source for the first, an image provider for
the second. Each deferral is written out under its stage's **Blockers** with the same four things: the
capability, why it cannot be built today, the stage id it is deferred to, and that stage's target
wave. Nothing else in either row is deferred, and no other row in this file lands anywhere but done.

**Two stages sit later than the row's wave in `README.md`, and neither is a change to the wave
table.** That column is the earliest wave a row _may_ start in, derived mechanically from
`gap-rows.json`; a plan may schedule a stage later, and this one does twice. `TRP-10` is listed there
in wave 1 and is already closed on disk, so its stage is the wave-2 one that must not regress it —
there is nothing to start. `TRP-01` is listed there in wave 2 and its stage is scheduled in wave 5,
for the reason argued in the next section. Neither `gap-rows.json`, `gap-cuts.json` nor `README.md` is
edited by this plan, and no edge is re-pointed.

## Order of the stages, and the edges it satisfies

`gap-rows.json` records **eight** `dependsOn` edges whose source is a `TRP-*` row — the count is
`TRP-01`, `TRP-02`, `TRP-05`, `TRP-06`, `TRP-08` and `TRP-11` with one each and `TRP-04` with two.
Every one is satisfied by the stage table above, and each is checked here rather than left to a
reader's arithmetic. `X → Y` reads "X depends on Y", so Y's stage must be in a strictly earlier wave.

| Edge              | Y's stage and wave | X's stage and wave | Satisfied |
| ----------------- | ------------------ | ------------------ | --------- |
| `TRP-01 → TRP-03` | `01-S1`, wave 1    | `01-S7`, wave 5    | yes       |
| `TRP-02 → TRP-11` | `01-S6`, wave 4    | `01-S8`, wave 5    | yes       |
| `TRP-04 → TRP-02` | `01-S8`, wave 5    | `01-S10`, wave 6   | yes       |
| `TRP-04 → ACC-05` | `09-S7`, wave 2    | `01-S10`, wave 6   | yes       |
| `TRP-05 → MNY-07` | `04-S1`, wave 1    | `01-S5`, wave 2    | yes       |
| `TRP-06 → TRP-11` | `01-S6`, wave 4    | `01-S9`, wave 5    | yes       |
| `TRP-08 → TRP-09` | `01-S2`, wave 1    | `01-S4`, wave 2    | yes       |
| `TRP-11 → ADM-02` | `10-S1`, wave 3    | `01-S6`, wave 4    | yes       |

Nine further edges point **into** a `TRP-*` row from another area — `BKG-05`, `BKG-10`, `MNY-06`,
`LST-02`, `DOC-08`, `COL-09`, `COL-11`, `ACC-04` and `ADM-03`. Those are obligations on the plans
that own those rows, not on this one. What this plan owes them is that the row each waits on closes
no later than the wave `README.md` records for it, and it does: `TRP-06` closes in wave 5 against
`BKG-05` and `DOC-08` in wave 6, `TRP-08` in wave 2 against `BKG-10` and `COL-09` in wave 3, `TRP-11`
in wave 4 against `LST-02`, `COL-11` and `ADM-03` in wave 5, `TRP-03` in wave 1 against `MNY-06` in
wave 2, and `TRP-05` in wave 2 against `ACC-04` in wave 3. The one stage this plan schedules later
than the wave table's earliest is `01-S7`, and `TRP-01` is depended on by nothing.

Two orderings are stronger than the edge set requires, and both are deliberate rather than
accidental, so a reader does not go looking for an edge that is not there:

- **`TRP-11` precedes `TRP-01` as well as `TRP-02`.** The edge set only requires
  `TRP-11 → TRP-02`; `TRP-01` names `TRP-03` and nothing else. `01-S7` is nonetheless scheduled in
  wave 5, behind `01-S6` in wave 4, because the trip card grows two membership-fed affordances at
  once — the entry point into the people panel, and the travel-companion figure in the spotlight
  card's statistics strip. Building the card in wave 2 and rebuilding it in wave 4 is the same card
  designed twice, and the second design is the one that has to be right. This costs the edge set
  nothing: `README.md`'s wave column is the **earliest** wave a row may start in, not the wave it
  must be built in, and no row anywhere depends on `TRP-01`.
- **`TRP-03` precedes `TRP-02` as well as `TRP-01`.** Also not an edge. `01-S1` moves trip creation
  into the module that owns every other trip write and gives the edit path its server function and
  its confirmation surfaces; `01-S8` then grows the form that both creation and edit render. A
  creation dialog written before the edit path exists is a form with one caller and no shape.

## The `TRP-08` / `TRP-09` cut, applied

`gap-cuts.json` records that the mutual pair between these two rows was cut in round 3 by removing
`TRP-09 → TRP-08` and keeping `TRP-08 → TRP-09`, on the reason that the day-note record and its write
path must exist before a merged timeline can order notes among places. This plan applies that cut as
a split of work, not merely as a wave order:

- **`01-S2` (wave 1) ships the record and the write path first.** The note gains its optional detail
  column, its validated icon, its optional time, the restricted markdown subset that renders the
  detail, and a server module of its own carrying one read and four writes. Repositioning inside
  `01-S2` is **notes among notes only**, through explicit up/down controls that rewrite
  `day_notes.sort_order` for one day. Nothing in `01-S2` touches `src/components/planner/ordering.ts`.
- **`01-S4` (wave 2) ships the merged ordering second.** The day becomes one sequence in which a note
  and a stop share a single position space, `PlanOrder` carries both kinds, and a note becomes
  draggable. `01-S4` cannot start before `01-S2` closes, because there is nothing to interleave until
  the note has a writable position of its own.

The reason for that division, stated once so no stage re-argues it: the ordering engine is the piece
`TRP-10` already closed and the piece a regression would be most expensive in. Extending it is worth
one whole stage's attention, and it should not be a paragraph inside a stage whose real subject is a
form.

## Transport rows in the timeline are `BKG-10`, not this plan

`TRP-08`'s row name in `gap-rows.json` mentions inline transports, multi-day phase labels and an
active car rental in the day header. The same three behaviours are named in `BKG-10`
(`03-reservations-and-transport.md`, wave 3), whose surviving edge is `BKG-10 → TRP-08` — the merged
timeline is the **host surface** and transport rows are placed **into** it. `01-S4` therefore ships
the host: one sequence, one position space, one sort contract, and a declared extension point that
takes a third item kind without another change to `ordering.ts`. It ships no transport row, no phase
label and no day-header rental, and `BKG-10` closes those in wave 3. Splitting it any other way puts
one file in two plans.

## Eight places where this plan contradicts `gap-rows.json` or the code

The matrix is a round-3 measurement, and four of its `TRP-*` rows are wrong or stale at this HEAD; the grilling of this plan (2026-08-28) found four more places where the code itself disagrees with what a stage would otherwise assume.
Each is corrected here with the file and line that refutes it, because a stage written from the stale
reading would build something that already exists or miss something that does not.

1. **`TRP-08` says "No notes". The day payload has carried notes since before this plan existed.**
   `PlanBoardDay.notes` is declared at `src/routes/_app/trips/$tripId/-server/plan.ts:140-146`,
   populated at `:220-224` from `getTripItinerary`, carried through `plan-model.ts:184` into
   `PlannerDay.notes`, and rendered at `src/components/planner/day-section.tsx:164-192` as a
   read-only list beneath the stop list. What is missing is not the read — it is that the list sits
   **outside** the ordering space, carries no icon and has no writer. That is what `01-S2` and
   `01-S4` fix, in that order.
2. **`TRP-09` says "no UI". There is a read-only UI.** Same evidence as above. The row's absent status
   is correct about the write path and wrong about the render, and `01-S2` extends the existing
   render rather than adding a second one.
3. **`day_notes` has no title column, and the row's field list assumes one.**
   `src/server/db/schema.ts:581-603` defines `body text NOT NULL`, `time`, `icon text NOT NULL DEFAULT
'sticky-note'`, `created_by` and `sort_order` — and no title and no detail. `01-S2` maps the
   existing `body` to the note's required headline, because it is already `NOT NULL` and the seeded
   rows already read as one, and asks wave 0 for a **new nullable `detail` column** for the long
   text. The opposite mapping would need `body` to become nullable, which is a narrowing change and
   is forbidden by the migration ritual.
4. **`createDayNote` accepts a day from another tenant.** `src/server/repos/days.ts:229-237` parses
   its input and inserts, calling neither `requireTrip` nor `requireTripDay` — unlike every
   comparable writer, e.g. `addTripMember` (`src/server/repos/trips.ts:434-441`) and
   `createShareLink` (`:486-492`). Because `createTenantRepository().insert` stamps the **caller's**
   `organization_id`, a well-formed `dayId` belonging to organization B is written as a row owned by
   A that points at B's day. It is unreachable today only because no server function calls it. `01-S2`
   is the stage that gives it one, so `01-S2` fixes it and adds the isolation case that proves it —
   the same rule `00-S5` applies to the unchunked sweep it makes reachable.
5. **`trips.status` has six values, not five, and archiving writes two columns.** `TRIP_STATUSES`
   (`src/server/db/schema.ts:254-261`) is `draft, planning, booked, active, completed, archived`.
   `archiveTrip` (`src/server/repos/trips.ts:369-371`) sets `is_archived = true` **and**
   `status = 'archived'`; `restoreTrip` (`:373-375`) clears the flag **and resets `status` to
   `'planning'`**, so a `completed` trip that is archived and restored comes back "in planning".
   Decision 2 below makes `is_archived` the only truth and `01-S1` stops both writers touching
   `status`.
6. **Every organization member can read every trip, and `trips.visibility` is dead.** `requireTrip`
   (`trips.ts:152-154`) is `requireById` under the tenant filter and nothing more; `listTrips`
   (`:209`) has no membership predicate; the `visibility` column (`private` / `organization` /
   `public`, default `private`, `schema.ts:631`) is read by nothing. Decision 1 below gives the
   column its meaning and `01-S1` the predicate.
7. **`deleteTrip` cascades in D1 and nowhere else.** The `files` rows go with the trip through the
   foreign key, but the objects they name in R2 — and the cover image — are deleted only by the
   per-file paths in `src/server/fns/files.ts:219,273`. A trip delete would orphan every object.
   Decision 3 below adds the `trip-purge` task.
8. **`is_favourite` is a column on `trips`, so one member's star is everyone's.** `schema.ts:640`,
   read by `listFilter` and `countTripsByStatus`. Decision 5 below moves the favourite to a per-person
   table and leaves the column dead and documented.

## Decisions taken in the grilling of this plan

Grilled on 2026-08-28 against the reference (`wiki: Trip-Members-and-Sharing`, `wiki:
Admin-Permissions`, `wiki: My-Trips-Dashboard`, `wiki: Day-Plans-and-Notes`, `wiki: Creating-a-Trip`)
and against the code at HEAD. Each decision is applied in the stage named; the glossary entries it
produced are in `CONTEXT.md` and the one architectural record is `docs/adr/0007`. A stage that finds
its own text disagreeing with this table follows the table.

| #   | Decision                                                                                                                                                                                                                                                                                                                   | Lands in                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | **A trip is private to its members** unless `visibility = 'organization'`, which opens it to the workspace; `public` grants nothing to a signed-in reader. A trip the caller may not read is `NotFoundError`, never `FORBIDDEN`. ADR 0007.                                                                                 | `01-S1` (predicate, tests), every later reader     |
| 1b  | The visibility switch lives on the people screen, **owner only**.                                                                                                                                                                                                                                                          | `01-S6`                                            |
| 2   | **Archive is a flag, not a status.** `archiveTrip`/`restoreTrip` stop writing `status`; a restored trip keeps the status it was archived with; `'archived'` stays in the CHECK, never written.                                                                                                                             | `01-S1`                                            |
| 3   | Delete stays **terminal**; the R2 objects a trip owns (files, cover) are purged by a **`trip-purge`** queue task the delete enqueues; a **copy duplicates the cover object** under a new key; both tasks share one object helper.                                                                                          | `01-S1`                                            |
| 4a  | Copy opens a **dialog** with title and date range prefilled from the source. Dated copy → `createTrip` builds the day run; undated → the source's run is copied numbered and dateless. Source days with no target day send their places to the ideas column and drop their notes, and the completion notice says so.       | `01-S1`                                            |
| 4b  | A copy reproduces the **plan, never the record**: days, places **and their tags**, assignments, notes here; budget lines, packing and to-dos through a **copier registry** that plans `04` and `05` fill in their own stages. Never reservations, stays, transports, expenses, files, conversations, share tokens, people. | `01-S1` (registry, own copiers); `04-*`, `05-*`    |
| 5   | **Favourite is per person**: `trip_favourites (organization_id, trip_id, user_id)`; `trips.is_favourite` stays, dead and documented. Any reader may favourite.                                                                                                                                                             | `01-S1` (table, writer), `01-S7` (filter)          |
| 6   | Roles: **owner** = trip metadata (title, summary, dates, currency, cover, reminder, visibility), lifecycle (archive, restore, delete), people (members, roles, guests, share); **editor** = the plan's content; **viewer** = read. **Every reader** may copy, favourite and leave.                                         | `01-S1` table; `01-S2`, `01-S4`, `01-S6`, `01-S10` |
| 7   | A guest name already on the trip is **refused inline**, not suffixed; `MAX_TRIP_GUESTS = 50` as a repository invariant.                                                                                                                                                                                                    | `01-S6`                                            |
| 7b  | A guest can be **merged into a member** (owner action, irreversible): a relinker registry moves every `guest_id` reference the owning plans register, then the guest row goes. Link tables hold `user_id` **xor** `guest_id`.                                                                                              | `01-S6` (action, registry); `04-*`, `05-*`         |
| 8   | A timed item dragged against clock order is not refused: the reader is **asked to drop its time**, and one batch clears the time and writes the order.                                                                                                                                                                     | `01-S4`                                            |
| 9   | Travel statistics count **the trips a person is a member of**; `travel-stats` envelopes go to the trip's members, not the workspace.                                                                                                                                                                                       | `01-S1`; amendment in `00-S4`                      |
| 10  | Delete confirmation is **graduated**: typing the title is required only when the trip carries a record (a reservation, transport, expense or file) or more than one member; the server decides, not the client.                                                                                                            | `01-S1`                                            |
| 11  | The five browser preferences stay in the browser, as the plan argues.                                                                                                                                                                                                                                                      | `01-S3`, `01-S5`, `01-S7`, `01-S9`                 |

Two obligations leave this plan: `00-S4`'s statistics scope (decision 9) and the copier and relinker
registrations plus the `user_id` xor `guest_id` shape in `04-budget-and-currencies.md` and
`05-packing-and-todos.md` (decisions 4b and 7b). Each is written into that plan in the same change as
this table.

## The four planner core files

`src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` (1437 lines), the sibling
`-ui/plan-actions.tsx` (831) and `-ui/plan-model.ts` (312), and
`src/routes/_app/trips/$tripId/-server/plan.ts` (536) are the planner's core. They are cited in
shorthand elsewhere as `-ui/plan-screen.tsx`, `-ui/plan-actions.tsx`, `-ui/plan-model.ts` and
`-server/plan.ts`; the paths above are the measured ones and are what a stage's **Owned paths** must
carry. Prefixed `$tripId` is a route parameter directory, not a shell variable, and a stage that
writes it into a command quotes it.

**Each of the four is named by at most one stage per wave**, counting the stages of every other plan
and not only this one. The schedule below is the whole of it as measured by
`scripts/ultrabuild/check-plan-collisions.mjs` at the foot of this file, and a stage added later that
breaks it is rejected before it is scheduled:

| Wave | Stage                          | Which of the four it holds                 |
| ---- | ------------------------------ | ------------------------------------------ |
| 1    | `07-S1` (`07-…`, another plan) | `-server/plan.ts`                          |
| 1    | `01-S2`                        | `-ui/plan-model.ts`, `-ui/plan-screen.tsx` |
| 2    | `01-S4`                        | all four                                   |
| 3    | `02-S4` (`02-…`, another plan) | `-ui/plan-screen.tsx`                      |
| 3    | `02-S5` (`02-…`)               | `-ui/plan-actions.tsx`                     |
| 4    | `02-S7` (`02-…`)               | `-ui/plan-model.ts`, `-server/plan.ts`     |
| 4    | `03-S5` (`03-…`, another plan) | `-ui/plan-screen.tsx`                      |
| 5    | `01-S9`                        | `-ui/plan-screen.tsx`                      |
| 5    | `02-S9` (`02-…`)               | `-ui/plan-model.ts`, `-server/plan.ts`     |
| 5    | `02-S10` (`02-…`)              | `-ui/plan-actions.tsx`                     |
| 6    | `02-S11` (`02-…`)              | `-ui/plan-actions.tsx`                     |
| 6    | `03-S8` (`03-…`)               | `-ui/plan-model.ts`, `-server/plan.ts`     |

No other stage in this file names one. Eight of the twelve rows belong to sibling plans that were
written after this file's first draft — `02-places-and-maps.md` and `03-reservations-and-transport.md`
— and every one of them lands in a wave where no other stage holds the same file, so the rule survives
their arrival rather than merely predating it. Two waves carry three holders each (3 and 5) and none
carries two claims on one file, which is the property that matters: the check reports **no same-wave
exclusive collision**.

**Wave 1 of `-server/plan.ts` belongs to another plan, and this one yields it.** An earlier draft of
`01-S2` claimed `-server/plan.ts` as `edit` in wave 1, and so does `07-S1` of
`07-collaboration-and-sharing.md`, which adds a room-mirror call after each of the module's eight
writers. `node scripts/ultrabuild/check-plan-collisions.mjs 01` reported that pair as a same-wave
exclusive collision — the clobbering case **Owned paths** exists to prevent, because the two stages
are built concurrently and the second one to write the file drops the first one's work. The
resolution is this plan's, because the other plan's file is not ours to edit:

- `01-S2` does **not** name `-server/plan.ts`. Its four writes and its one read live in a new sibling
  module, `src/routes/_app/trips/$tripId/-server/day-notes.ts`, and the planner's route file composes
  the two loaders. A note is a record of its own with its own tenant guards, so a module of its own is
  where it would have gone had the collision never existed; the collision only forced the decision
  earlier.
- `loadPlanBoard` keeps projecting its three-field note shape for exactly one wave, unread by anything
  once `01-S2` lands, and `01-S4` deletes that projection in wave 2 as part of the merged read. `01-S4`
  is the stage that owns `-server/plan.ts` next, so the removal costs no extra claim on it.
- `01-S4` inherits the file from `07-S1` rather than from `01-S2`, which makes one obligation
  explicit: **`reorderPlanFn` gains its item-kind vocabulary without losing the mirror call `07-S1`
  put there.** Widening a function whose body a wave-1 stage of another plan has already edited is
  precisely where that call would be silently dropped, and `01-S4`'s Verification carries the case.

The check is a measurement, not a judgement: the script's current output is pasted verbatim under
**Cross-plan collisions** at the end of this file, and a stage that changes an **Owned paths** list
re-runs it.

## Two shared test files, and the one file that stays exclusive

Within-wave **Owned paths** in this plan are disjoint on every **exclusive** disposition — `new`,
`edit`, `create`, `delete`. Two files are named by several stages at once under the cooperative
`append` disposition, which is the documented pattern rather than an exception this plan invented:
`scripts/ultrabuild/check-plan-collisions.mjs` says so in its own header, naming both of them, and
treats `append` as a non-collision by construction. A third file that looks like a fourth candidate
for sharing is deliberately kept exclusive, for a reason that does not apply to the other two.

**`src/server/repos/__tests__/tenant-isolation.test.ts` is appended to, because the contract says it
may be.** `00-foundations.md`'s tenant procedure records it as "the one append-only exception to
within-wave disjointness", on the reasoning that almost every stage adds a repository function and
forcing them into separate waves would serialise the whole build for one file. Five stages here name
it — `01-S1`, `01-S2`, `01-S4`, `01-S6` and `01-S7` — each marked `append`, each adding one new
`describe` block at the end of the file and editing nobody else's, so two of them landing in one wave
produce a merge resolved by keeping both. `01-S1` and `01-S2` are the only pair that actually lands in
the same wave.

**`e2e/trips-core.visual.spec.ts` is appended to for the same reason and on the same authority.**
`12-verification-protocol.md` §4 fixes both the name and the sharing: a module plan adds
`e2e/<module>.visual.spec.ts`, where `<module>` is the plan's area name in the same kebab-case as its
plan file — so `01-trips-core.md` produces `e2e/trips-core.visual.spec.ts` — and "one spec file per
plan file, not one per stage: stages within a plan share the file and are told apart by their
`test.describe` block". This plan does exactly that. `01-S1` creates the file, marked `new`, and the
nine later stages are each marked `append`, each adding one `test.describe` block whose name is its
stage id and title. The plan's baseline directory,
`e2e/__screenshots__/trips-core.visual.spec.ts/`, carries the same dispositions: created by `01-S1`,
appended to by every later stage, which records only the frames its own block takes.

Three properties make that sharing safe within a wave, and each is a property of the file rather than
a hope about the agents:

- **Every block is self-contained.** A stage's block declares its own local route table, calls
  `auditServerClock(page, <that table>)` over it inside its own `describe`, and asserts its own
  frames. No stage edits a line another stage wrote, so two agents appending two independent blocks
  to the end of one file in one wave produce a merge resolved by keeping both — the identical shape
  as the five appends to `tenant-isolation.test.ts` above.
- **Re-recording is narrowed to the block that owns it.** `--update-snapshots` over the whole file
  would re-record baselines a stage did not design, so every stage's Verification block narrows it
  with `-g '<stage-id>'`. `-g` matches the full test title, and every block's title begins with its
  stage id, so the filter is exact and a stage can only ever rewrite its own pixels.
- **The directory is mechanically isolated from every other plan.** `snapshotPathTemplate` in
  `playwright.config.ts` is `{snapshotDir}/{testFileName}/{arg}-{projectName}{ext}`, so this plan's
  baselines live under a directory named after this plan's spec file and cannot collide with or
  disturb `e2e/visual.spec.ts`'s 52 approved frames or any sibling plan's. `e2e/visual.spec.ts` is
  never appended to and never split.

**`e2e/helpers/shoot.ts` is the file that stays exclusive, and the difference is what it is.** It is
a shared module where a claimant edits an existing table — `RELATIVE_TIME_SITES` — rather than adding
an independent block, so two stages wanting it in one wave really would clobber each other. The
protocol's own answer applies unchanged: "two stages in the same wave may not both claim it, and the
second one to want it declares a module-local helper instead". Exactly one stage in this plan claims
it, `01-S5` in wave 2, which needs a `RELATIVE_TIME_SITES` entry for its live clock; the only other
claimant in the whole plan set is `10-S2` in wave 1, a different wave, and the check output at the
foot of this file is the measurement of that. Every stage's block imports its helpers from
`./helpers/shoot.ts` and re-implements none of them.

## Multi-row writes, and the three D1 limits that bound them

Three stages in this plan write more than one row in one logical step — the trip copy in `01-S1`, the
note reorder in `01-S2`, the merged reorder in `01-S4`. The mechanism is fixed here once so that no
stage re-derives it and no stage writes a call that cannot compile.

**`scope.db.batch()` does not exist.** `TenantScope['db']` is the abstract Drizzle handle — measured,
`readonly db: Database` at `src/server/repos/base.ts:43`, where `Database` is
`BaseSQLiteDatabase<'async', unknown>` at `src/server/db/types.ts:14` — and `batch()` is a D1 driver
method that abstract type does not carry.
The repository layer's one batching helper is `runBatch(scope, statements)`
(`src/server/repos/batch.ts:35`), which feature-detects the driver, calls `db.batch()` when it is
there and awaits the statements in order when it is not — which is what makes the same code run under
the in-memory test driver. Measured callers at HEAD: `src/server/repos/collab.ts:333`,
`src/server/repos/places.ts:326`, `src/server/repos/vacay.ts:428` and
`src/server/repos/itinerary.ts:343` — the last of which is inside `reorderAssignments`, the very
function `01-S4` widens. Every stage below calls `runBatch`; none names `scope.db.batch`.

**The three limits, read from Cloudflare's published D1 platform limits rather than assumed**,
because each of them is a real ceiling this plan can hit:

| Limit                              | Value  | What it binds here                                               |
| ---------------------------------- | ------ | ---------------------------------------------------------------- |
| Bound parameters per statement     | 100    | A multi-row `INSERT` — the copy's places, assignments and notes. |
| SQL statement length               | 100 KB | The same statements, from the other side.                        |
| Duration of a whole `batch()` call | 30 s   | How many statements one `runBatch` may carry.                    |

The first two apply to **each statement inside a batch**, not to the batch as a whole. That has one
consequence the copy has to respect: `insertMany` (`src/server/repos/base.ts:189-204`) sends
`rows × columns` bound parameters in **one** statement and does **not** chunk, so a caller inserting
many rows chunks at `floor(100 / columns)` rows per call. That divisor is a named constant beside the
limit it came from, and it is held by a unit test rather than by a comment — the rule
`00-foundations.md` states for the queue producer, applied to the other batching surface.

**And the rule `batch.ts` states in its own header:** _a batch that rewrites a whole itinerary belongs
in a queue consumer, not in a request path._ This plan obeys it by splitting on whether the write is
bounded by one day or by the trip's whole inventory:

- **Bounded, so it stays in the request path.** `01-S2`'s `reorderDayNotes` and `01-S4`'s
  `reorderDayTimeline` each rewrite the positions of **one day**, which is a handful of `UPDATE`
  statements of three bound parameters each. One `runBatch`, inside the server function, is right.
- **Unbounded, so it is enqueued.** `01-S1`'s copy duplicates every place, assignment and note in the
  source trip, and the `places` ceiling is `UNLIMITED` on every paid tier — `PLAN_QUOTAS.business`
  at `src/server/db/types.ts:63-69`, where `UNLIMITED` is `Number.POSITIVE_INFINITY` (`:20`) — so the
  row count has no product bound at all. It runs in a `trip-copy` queue consumer. `01-S1` says how,
  and what the request path still does synchronously.

## Shared paths this plan never claims

`README.md`'s six shared paths are absent from every **Owned paths** list below:
`src/server/db/schema.ts`, `src/server/worker.ts`, `wrangler.jsonc`, `src/styles/tokens.css`,
`src/components/ui/**` and `src/routeTree.gen.ts`. None of the ten stages needs a new token or a new
primitive, and each says so. `package.json` and `pnpm-lock.yaml` are not edited by anything here.

**Three stages need a schema change, and each files it one wave early.** The filing rule is
`00-foundations.md`'s, stated at the end of `00-S1`'s **Data and migration**: a schema stage "absorbs
any **Data and migration** requirement filed by a wave-1 stage", so the wave-_n_ schema stage collects
what wave _n+1_ asked for and wave _n+1_ opens against a schema that already has it. A stage that
filed to the schema stage of its **own** wave would run against a column that does not exist yet.
This plan therefore files as follows, and every **Data and migration** heading below names the same
target:

| Filing stage | Its wave | Files to                                                                                                                     | What                              |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `01-S1`      | 1        | `00-S1` (`00-foundations.md`, wave 0) — **landed**, `drizzle/0006_mighty_nehzno.sql`                                         | `trips.copy_pending_at`, nullable |
| `01-S2`      | 1        | `00-S1` (`00-foundations.md`, wave 0) — **landed**, same migration                                                           | `day_notes.detail`, nullable      |
| `01-S1`      | 1        | `00-S6` (`00-foundations.md`, wave 0) — the follow-up the register minted because `00-S1` closed before decision 5 was taken | the `trip_favourites` table       |
| `01-S6`      | 4        | the wave-3 schema stage, minted by `00-S1`'s register                                                                        | the `trip_guests` table           |

The wave-3 schema stage does not exist yet by id: `00-foundations.md`'s stage register mints the
per-wave shared-file stages "when the wave opens", and a wave with no filed requirement mints none.
`01-S6` files against that register rather than against an id, which is what the register is for.
`trip_favourites` is the one exception with an id: `00-S1` had already generated its migration when
the grilling moved the favourite off the trip row, so the register minted `00-S6`, a wave-0 follow-up
carrying that one table, and `01-S1` does not open until it has landed. The
seven stages that need no column say so under their own **Data and migration** heading and name the
schema stage they would have filed to, so a reader can tell "nothing to file" from "forgot to ask".

`src/routeTree.gen.ts` has the one mechanical exception `README.md` grants: `01-S6` adds a route file,
runs `pnpm generate-routes`, and the regenerated tree travels in its diff without ever being
hand-edited or listed as an owned path.

## Clean-room

The reference product is never named in this file, its wiki pages are cited as `` `wiki: <Page-Name>` ``
with no URL, and no sentence, table name, column name, enum value, class name or user-visible string
is carried across from it. Where a behaviour is sourced, the citation says which page was studied and
the behaviour is then described in this product's own vocabulary against the tables that already
exist in `src/server/db/schema.ts`. Two of its concepts are deliberately **not** ported and each
stage that meets one says so: an instance-wide administrator who bypasses per-trip permission, and a
user directory that enumerates every account on the deployment. Both are single-tenant assumptions
and both would be a cross-tenant data leak here.

## Stage 01-S1 — Every action a trip's owner can take on it

### Stage id

`01-S1` · Wave 1 · effort **L**. The first stage of the plan and the one the trip list, the creation
dialog and the reminder preference all write through. Recorded as **M** in `gap-rows.json`, and the
difference is one thing the matrix did not price: the copy is the only unbounded write in this plan,
so it is a queue handler and a two-phase surface rather than one repository function. That is argued
under **Server** and bounded under **Quota**.

### Reference rows

- `TRP-03` absent → **done**. Edit, copy, archive, unarchive, favourite, delete.

Sourced from `wiki: My-Trips-Dashboard` for which actions belong to an active trip and which to an
archived one, and from `wiki: Creating-a-Trip` for the field set edit shares with creation.

**Contradiction with the row, stated with evidence.** The row's evidence is accurate and is the
cheapest movement in this plan: `src/server/repos/trips.ts` already defines `updateTrip` (`:340`),
`archiveTrip` (`:369`), `restoreTrip` (`:373`), `setTripFavourite` (`:377`) and `deleteTrip` (`:386`),
and none of the five has a caller anywhere in `src/`. This stage is almost entirely a missing write
path, exactly as `README.md` says the dominant gap in this repository is. The one genuinely new
repository function is the copy, and it is the only part of this stage that is not cheap movement.

**Two cross-plan obligations land here, both assigned to `TRP-03` by name in `00-foundations.md`.**
They are listed under **Reference rows** rather than buried in prose because a reader checking whether
this plan carries what wave 0 handed it should find them in one place:

1. **The reminder obligation was withdrawn during the grilling of `00-foundations.md`.** `00-S5` was
   redesigned from schedule-at-write to a scan model: the `*/15` sweep reads due trips directly
   (`start_date IS NOT NULL AND reminder_days > 0 AND is_archived = 0`) and dispatches through
   `00-S2` with recipients resolved at fire time. There is no KV index to keep in sync, so `TRP-03`
   calls nothing on edit, archive, restore or delete — the next scan simply sees the row as it now
   is, an archived trip never surfaces from the scan, and a deleted trip is absent. What was
   obligation 1 is now a non-obligation, recorded so nobody re-adds a scheduler call by reflex.
2. **A trip write moves every member's travel statistics.** `00-S4`'s **Server** heading records that
   `tripCount`, `dayCount`, `placeCount`, `cityCount` and `spendMinor` are workspace-wide, that a
   write changing `trips.country_codes` or `trips.start_date` also moves every member's year-row
   `countryCount`, and that "those write paths belong to `01-trips-core.md` and
   `04-budget-and-currencies.md` … it records the requirement here so neither plan invents a second
   recompute". This stage is where the trip write paths get their callers, so this stage enqueues the
   `travel-stats` envelopes `00-S4` defined. It writes no aggregate of its own.

**Two deletes, and why we ship one.** The reference offers Delete on an active trip and Permanently
delete on an archived one, which is two recoverable states plus a terminal one. We ship one terminal
delete, because `trips.is_archived` (`src/server/db/schema.ts:638`) already **is** the recoverable
state and a second one would need a `deleted_at` column, a filter on every trip read in the
repository, and a sweep to make the recovery window mean anything. The archive is the undo; delete is
final from either place and says so, and the archived section labels it "Delete permanently" because
from there it is the last copy. Confirmed in the grilling (decision 3), with two things the reference
does not do and this stage does: **the objects the trip owns in R2 are purged** by a `trip-purge`
queue task the delete enqueues — the reference leaves its uploads on disk — and **the confirmation is
graduated** (decision 10): typing the trip's title is demanded only when the trip carries a record or
more than one member, and the server, not the client, decides which case it is.

**Archive is a flag, and this stage stops the two writers that say otherwise (decision 2).**
`archiveTrip` writes `status = 'archived'` and `restoreTrip` resets `status` to `'planning'` at HEAD
(`src/server/repos/trips.ts:369-375`); both lines go, so a trip comes back from the archive with the
lifecycle status it went in with, and `'archived'` remains in `trips_status_chk` as a value nothing
writes.

Rows unblocked: `TRP-01` (`01-S7`) directly.

### Owned paths

- `src/routes/_app/-server/trip-lifecycle.ts` — new. Every trip-level write server function,
  including `createTripFn` moved here from `-server/overview.ts`.
- `src/routes/_app/-server/overview.ts` — edit. `createTripFn` (`:641`) is **moved out**, not
  copied; the module keeps its four loaders and its two notification writes. The move carries no
  reminder call: after the grilling redesign of `00-S5`, trip creation runs no reminder code — the
  scan sees the new trip on its own — and `00-S5` no longer edits this module at all. **Four stages
  touch this module across four waves and no two share one**, which is what makes the shared claim
  legal: this stage in wave 1, `09-S7` (`09-account-and-settings.md`, wave 2) for the unread-count
  answer, `10-S3` (`10-administration.md`, wave 4) for the audit count inside `loadAdmin`, and
  `01-S7` in wave 5. Each of the three siblings names this stage in return; the measurement is the
  check output at the foot of this file.
- `src/routes/_app/-ui/trip-actions.tsx` — new. The per-trip action menu, the destructive
  confirmations and the edit sheet.
- `src/routes/_app/-ui/trip-card.tsx` — edit. Mounts the action menu on `TripTile`.
- `src/routes/_app/-ui/new-trip-dialog.tsx` — edit, and the edit is one import specifier: it calls
  `createTripFn` from its new module.
- `src/server/repos/trips.ts` — edit. Adds the read predicate decision 1 requires (`canReadTrip`,
  folded into `requireTrip` and `listTrips`), the trip-role guard the writers share, the copy's two
  halves — `startTripCopy` and `copyTripContents` — and the copier registry; removes the two `status`
  writes from `archiveTrip`/`restoreTrip`; deletes `setTripFavourite`, whose replacement lives in
  `trip-favourites.ts`.
  Three stages touch this module across three waves and no two share one: this stage in wave 1,
  `07-S6` (`07-collaboration-and-sharing.md`, wave 2) for the share-link writers, and `01-S6` in
  wave 4 for the membership guards. Each adds functions; none reshapes one the others call.
- `src/server/queue/handlers/trip-copy.ts` — new. The consumer half of the copy: the inventory, in
  chunks, off the request path.
- `src/server/queue/handlers/__tests__/trip-copy.test.ts` — new.
- `src/server/queue/handlers/trip-purge.ts` — new. Deletes the R2 objects a deleted trip owned, in
  chunks, off the request path (decision 3).
- `src/server/queue/handlers/__tests__/trip-purge.test.ts` — new.
- `src/server/storage/objects.ts` — new. The one R2 object helper both handlers use: copy an object to
  a new key, delete a list of keys in bounded chunks. Reaches the bucket through `filesBucket()` in
  `src/server/fns/context.ts` and nothing else; contains no SQL.
- `src/server/storage/__tests__/objects.test.ts` — new.
- `src/server/repos/trip-favourites.ts` — new. The per-person favourite (decision 5): `setFavourite`,
  `listFavouriteTripIds`, `countFavourites`, all `tenantFilter()`-bound.
- `src/server/repos/index.ts` — append. One export line for the favourites module. Sibling claims in
  other waves — `06-S3` (wave 2), `06-S5` (wave 3), `01-S6` (wave 4), `07-S10` (wave 5) — and none in
  wave 1.
- `src/server/repos/__tests__/member-isolation.test.ts` — new. The sibling of the tenant-isolation
  file for the boundary decision 1 draws **inside** one organization; see **Tenant isolation test**.
- `src/routes/_app/-ui/trip-copy-dialog.tsx` — new. The copy dialog (decision 4a).
- `src/server/queue/types.ts` — edit. Adds the `trip-copy` kind and its payload schema — one member
  on a union, not a reshape. **Shared across waves with `00-S4` (`00-foundations.md`, wave 0)**,
  which adds the `travel-stats` kind and the `DB` binding to `TaskBindings` in the same file, and
  with `07-S8` (`07-collaboration-and-sharing.md`, wave 4), which adds the link-preview kind. Also with `13-S1`
  (`13-community-gallery.md`, wave 3), `13-S4` (wave 6) and `13-S6` (`13-content-studio.md`, wave 10,
  `append`). Wave 0 closes before this wave opens and every later claim opens after it closes, so no
  two of them run together.
- `src/server/queue/consumer.ts` — edit. Registers the handler and its `case`. **Shared across waves
  with `00-S4` (wave 0), `13-S1` (wave 3), `07-S8` (wave 4), `13-S4` (wave 6) and `13-S6` (wave 10)**,
  for the same reason and in the same `switch`.
- `src/server/repos/__tests__/trip-lifecycle.test.ts` — new. The stage's own repository tests, in a
  new file so that no wave-1 stage has to contend for `repositories.test.ts`.
- `src/routes/_app/-server/__tests__/trip-lifecycle-side-effects.test.ts` — new. The reminder cancel
  and the statistics fan-out, held as assertions. The route-local `__tests__` directory follows
  `src/routes/(auth)/-lib/__tests__` and `src/routes/api/tiles/-lib/__tests__`, which already exist.
  `01-S10` adds `trip-reminder.test.ts` to the same directory in wave 6; a different file, five waves
  apart.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block, under the
  append-only exception in `00-foundations.md`'s tenant procedure.
- `e2e/trips-core.visual.spec.ts` — new. The plan's single spec file, created here and named as
  `12-verification-protocol.md` §4 requires: `<module>` is this plan's area name in the same
  kebab-case as its plan file. This stage adds the first `test.describe` block; the nine later stages
  append their own. See **Two shared test files** in the Area brief.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — new. The plan's baseline directory, which
  `snapshotPathTemplate` guarantees cannot collide with or disturb any existing baseline.

### Data and migration

**One additive column, filed to `00-S1` (`00-foundations.md`, wave 0)** — the wave-0 schema stage,
which is the one that "absorbs any **Data and migration** requirement filed by a wave-1 stage". This
stage is wave 1, so it files one wave early and does **not** edit `src/server/db/schema.ts`.

| Table   | Column            | Type      | Null     | Default | CHECK                       |
| ------- | ----------------- | --------- | -------- | ------- | --------------------------- |
| `trips` | `copy_pending_at` | `integer` | nullable | none    | none — see the reason below |

Epoch milliseconds, the convention every instant in this schema already uses. Non-null means the
`trip-copy` job for this trip has not finished; the handler clears it as its last statement. Nullable
with no default, so a rollback keeps working: the previous Worker never reads the column and every
existing row is null, which reads correctly as "not copying". No `CHECK` is added and no index: a
constraint change on SQLite makes drizzle-kit emit a full table rebuild (`drizzle/0001_aspiring_cargill.sql`
is the precedent), and the column is never a filter — it is read on rows the trip list has already
selected. The migration backfills nothing.

**Why a column rather than a status value.** `trips.status` is CHECK-constrained to six values
(`trips_status_chk`, `src/server/db/schema.ts:671`), so adding a seventh is exactly the table rebuild
the migration ritual tells a stage to avoid. A nullable timestamp is additive, and it carries more
information than a flag: it says when the copy started, which is what lets the trip list distinguish
"in flight" from "the consumer died three days ago" without a second column.

**One additive table, filed to `00-S6` (`00-foundations.md`, wave 0) — decision 5.** `00-S1` has
closed — `drizzle/0006_mighty_nehzno.sql` carries `copy_pending_at` — so this table cannot ride it;
the register minted `00-S6` for it, and this stage does not open until that stage has landed. The
table is specified in both places identically.

| Column            | Type                   | Null     | Notes                                            |
| ----------------- | ---------------------- | -------- | ------------------------------------------------ |
| `id`              | `text` PK              | not null | `pk()`, `newId()` default                        |
| `organization_id` | `text`                 | not null | `orgRef()`, `ON DELETE CASCADE`                  |
| `trip_id`         | `text` → `trips.id`    | not null | `ON DELETE CASCADE`                              |
| `user_id`         | `text`                 | not null | `userRef()`, no Drizzle FK, as every user column |
| `created_at`      | `integer` timestamp_ms | not null | `timestamps()`                                   |

Indexes: `trip_favourites_org_user_idx` on `(organization_id, user_id)` — the read the trip list makes
— and `trip_favourites_trip_user_unq`, unique on `(trip_id, user_id)`, so a double click cannot write
two stars. Additive, backfills nothing; a rollback is safe because the previous Worker never reads the
table. **`trips.is_favourite` stays in the schema, dead**: dropping a column is a table rebuild on
SQLite, so it keeps its default of `false`, gains a doc comment saying the favourite lives in
`trip_favourites`, and nothing writes or reads it after this stage. `trips.visibility` is read from
this stage on (decision 1) and needs no change; `trips.status` keeps its six-value `CHECK` and this
stage writes only five of them (decision 2).

Every other column this stage writes exists: `trips.is_archived` and `trips.status` at
`src/server/db/schema.ts:635-645`, each already carrying its `CHECK` or its boolean default.

The copy writes only rows whose tables already exist: `trips`, `days`, `places`, `day_assignments`
and `day_notes`. Ids come from `newId()` through each table's own `pk()` default; dates stay
`YYYY-MM-DD` text and `order_index` stays `real`, so no second convention is introduced.

**What a copy copies, and what it deliberately does not (decisions 4a, 4b).** It copies the trip
row, its day run, its place inventory **with the places' tags**, the day assignments that place those
places, and the day notes; through the copier registry described under **Server**, the owning plans
add budget lines, packing lists and to-dos with nothing ticked. It does **not** copy expenses, expense
shares, settlements, files, reservations, stays, transports, messages, share links or members other than
the copying user's own owner row. The rule behind that line is one sentence and is now a glossary
term (**Trip copy**): a copy reproduces the **plan**, never the **record of what happened**, and money
paid, bookings made and documents received are the record. The copied trip is created with
`status: 'planning'`, `is_archived: false`, `visibility: 'private'` and **the title and date range the
reader confirmed in the copy dialog**, prefilled from the source. A dated copy gets its day run from
`createTrip`'s existing `syncTripDays` call, exactly as a new trip does; an undated copy gets the
source's run copied by count and by title with `date: null` on every row, so the shape of the itinerary
survives and the reader dates it later in the edit sheet. In both cases the handler maps the source's
`day_number` onto the target's, and a source day with no target day — the reader shortened the range —
sends its places to the ideas column and drops its notes, and the completion notification names how
many of each. The cover image is **copied as a new R2 object** under a new key, never shared: a shared
key would vanish with whichever trip is deleted first.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/trips.ts`.**

- `canReadTrip(scope, tripId)` and the predicate inside `requireTrip` and `listTrips` — new, and
  the whole of decision 1 at the repository. A trip is readable when the acting user has a
  `trip_members` row on it **or** `trips.visibility = 'organization'`. `requireTrip` raises
  `NotFoundError` for a trip that fails it — the same error a foreign tenant's id raises, so the two
  cases are indistinguishable from outside — and `listTrips`, `countTripsByStatus` and every reader
  in this module take the predicate as one `EXISTS` sub-select on `trip_members` bound by
  `tenantFilter()`, never as a second query per row. `listTripsForUser` (`:414`) becomes a thin alias
  and is kept for its callers. `visibility = 'public'` grants nothing here; it is the share plan's
  concern.
- `startTripCopy(scope, tripId, input)` — new, and the **synchronous half** of the copy. Input is
  `{ title, startDate, endDate }` from the dialog. Resolves the source with `requireTrip` (which is now
  the read check — any reader may copy, decision 6), asserts both quotas (see **Quota**), reserves a
  slug with the existing `reserveTripSlug`, inserts the new trip through `createTrip`'s path so a dated
  copy gets its day run from `syncTripDays` exactly as a new trip does, sets `copyPendingAt` to
  `Date.now()`, and inserts the caller's `owner` membership. It returns the new trip's id. **It writes
  the trip row, the owner row and — for a dated copy — the day run**, all O(1) in the source's size;
  nothing here scales with the source's place count or note count, which is the property that lets
  it stay in a POST handler at all.
- `copyTripContents(scope, sourceTripId, targetTripId)` — new, and the **asynchronous half**, called
  only by the queue handler. In this order: the day run when the target has none (the undated case),
  then the day map from source `day_number` to target day id; the places and their `place_tags`; the
  day assignments remapped onto the new day ids and the new place ids, with an assignment whose source
  day has no target left unscheduled so its place sits in the ideas column; the day notes remapped
  the same way, with the ones whose day has no target dropped and counted; then **every registered
  copier** in registration order; then the cover object through `src/server/storage/objects.ts`; and
  finally `copy_pending_at` is cleared. It writes through `daysRepository`
  (`src/server/repos/days.ts:26`), `placesRepository` (`src/server/repos/places.ts:43`),
  `dayAssignmentsRepository` (`src/server/repos/itinerary.ts:46`) and `dayNotesRepository`
  (`src/server/repos/days.ts:27`), all of which those modules already export — the same composition
  `01-S4`'s `reorderDayTimeline` uses to reach note rows from `itinerary.ts`, so the multi-table write
  still has exactly one home. SQL stays in `src/server/repos`.
- **The copier registry (decision 4b).** `registerTripCopier(name, fn)` in `trips.ts`, where `fn` is
  `(scope, sourceTripId, targetTripId, maps: { dayIds, placeIds }) => Promise<CopierReport>`. This
  stage registers nothing beyond its own four passes; `04-budget-and-currencies.md` registers the
  budget-line and cost-category copier and `05-packing-and-todos.md` the packing and to-do copiers, each
  in the stage that owns the table, each obeying the same chunk bound below, each returning the row
  count it wrote so the completion notification can name it. The registry is the seam that keeps a
  table in one plan while the copy still reproduces the whole plan; until a copier is registered the
  copy simply omits that module, which is what the reader is told.
- **The undated run is copied, not resynchronised, and that is a measurement rather than a
  preference.** `syncTripDays` (`src/server/repos/days.ts:149-172`) derives the wanted run from the
  trip's date range and, when either date is null, takes the `wanted.length === 0` branch that
  **creates no days at all** — it only clears stale dates on days that already exist. So for a copy
  the reader left undated, `copyTripContents` inserts the day rows itself: `day_number` `1..n` from the
  source's own run, `date: null`, `title` and `notes` carried across. For a dated copy the run already
  exists from `startTripCopy`, and the same pass only builds the map from source day id to target day
  id — by `day_number` in both cases — that the assignment and note passes then read.
- **How the inventory is chunked, and where the number comes from.** Each table's rows go in through
  `insertMany`, which sends one statement carrying `rows × columns` bound parameters and does not
  chunk (`src/server/repos/base.ts:189-204`). D1 refuses a statement with more than **100 bound
  parameters**, so `copyTripContents` chunks at `Math.max(1, Math.floor(MAX_BOUND_PARAMETERS / columns))`
  rows per call, where `MAX_BOUND_PARAMETERS = 100` is a named constant declared at the top of
  `src/server/repos/trips.ts` with the limit it came from written beside it — the same discipline
  `00-foundations.md` requires of a queue producer, applied to the other batching surface. The chunk
  loop is held by a unit test that copies more rows than one chunk can carry, not by a comment.
  Where several statements go together — the assignment remap — they go
  through `runBatch(scope, statements)` (`src/server/repos/batch.ts:35`), because `scope.db` has no
  `batch()` method of its own; see **Multi-row writes** in the Area brief.
- **Why the split is where it is.** `src/server/repos/batch.ts`'s own header says a batch that
  rewrites a whole itinerary belongs in a queue consumer, and `TEMPLATE.md` says anything slow is
  enqueued on `TASKS` and never run inline. The copy is exactly that: `places` is `UNLIMITED` on every
  paid tier, so a 20 000-place trip is a legal trip and a copy of it is an unbounded write. What the
  request path keeps is the part with a product bound on it, so the reader gets a trip id and a
  destination to navigate to inside one round trip.
- `assertTripRole(scope, tripId, allowed)` — new, and the one role guard. Reads the acting user's
  role through the existing `tripRoleFor` (`:460-470`) and raises `RepositoryError` with a
  `FORBIDDEN` code when it is not in `allowed`. It is called by `updateTrip`, `archiveTrip`,
  `restoreTrip` and `deleteTrip` **inside the repository**, after `requireTrip` and before the write.
  `startTripCopy` and `setFavourite` do not call it: both are open to any reader (decision 6), and
  `requireTrip` is their check. `copyTripContents` does not call it either: by the time the handler
  runs, the target trip is the caller's own and the source has already been read-checked; re-checking
  a membership the acting member may have lost in the meantime would abandon a copy the product already
  promised.
- `archiveTrip` and `restoreTrip` lose one field each (decision 2): neither writes `status` any more,
  so the lifecycle status survives the round trip. `updateTrip` and `deleteTrip` are otherwise unchanged
  in behaviour. `updateTrip` already reconciles the day run through `syncTripDays` when the range
  moves (`:362-364`), which is why the edit path needs no day handling of its own.
- `setTripFavourite` is **deleted** from this module; its replacement is `setFavourite(scope, tripId,
isFavourite)` in `src/server/repos/trip-favourites.ts`, which upserts or removes the caller's own
  `trip_favourites` row after `requireTrip`. `listFavouriteTripIds(scope)` and `countFavourites(scope)`
  are the reads `01-S7` and the existing `favourites` scope use, both `tenantFilter()`-bound and
  keyed by `scope.ctx.userId`.

**Why the role guard is in the repository and not in the handler.** `TRIP_MEMBER_ROLES` is
`['owner', 'editor', 'viewer']` (`src/server/db/schema.ts:263`), and `createTrip` already writes an
`owner` membership for the creator (`src/server/repos/trips.ts:325-330`), so every trip in the
database has at least one. Putting the check in the repository means it holds for the queue consumer
and for a future server route as well as for these server functions, which is the same argument
`ARCHITECTURE.md` §6 makes about quota. The matrix is decision 6 of the grilling, and it follows the
reference's defaults rather than the earlier draft of this plan, which let an editor archive a trip
and change its dates:

| Write                                                                       | Role required     | Why                                                                          |
| --------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `updateTrip` (title, summary, dates, currency, cover, reminder, visibility) | `owner`           | The trip's metadata; moving the dates moves every member's day run.          |
| `archiveTrip`, `restoreTrip`, `deleteTrip`                                  | `owner`           | The trip's lifecycle; delete is terminal and cascading.                      |
| `startTripCopy`                                                             | any reader        | Reads the source, writes a new trip the caller then owns.                    |
| `setFavourite`                                                              | any reader        | A bookmark on the caller's own row; it changes nothing on the trip.          |
| the plan's content — places, days, notes, assignments                       | `owner`, `editor` | What an editor is for; enforced where those writers live (`01-S2`, `01-S4`). |

**Server functions — `src/routes/_app/-server/trip-lifecycle.ts`.** Seven, each
`createServerFn({ method: 'POST' })` except where noted, each resolving its tenant through the
existing `appScope()` in `-server/context.ts`:

| Function             | Input                                                                         | Returns                         |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| `createTripFn`       | moved unchanged from `-server/overview.ts:556`                                | `{ tripId }`                    |
| `updateTripFn`       | `{ tripId, title?, destination?, startDate?, endDate?, currency?, summary? }` | `{ tripId }`                    |
| `copyTripFn`         | `{ tripId, title, startDate, endDate }` — dates both present or both absent   | `{ tripId, copyPending: true }` |
| `archiveTripFn`      | `{ tripId }`                                                                  | `{ tripId, isArchived: true }`  |
| `restoreTripFn`      | `{ tripId }`                                                                  | `{ tripId, isArchived: false }` |
| `setTripFavouriteFn` | `{ tripId, isFavourite }` — the caller's own favourite                        | `{ tripId, isFavourite }`       |
| `deleteTripFn`       | `{ tripId, confirmTitle? }` — required when the server says so, see below     | `{ deleted: true }`             |

**Zod v4.** `z.strictObject()` for every input with the `error` parameter carrying the message the
form shows; `z.iso.date()` for `startDate` and `endDate`; a trimmed non-empty `title`; a
`z.literal`-free confirmation field compared to the trip's own title **on the server**, not in the
browser — and **whether it is required at all is the server's call**
(decision 10): `deleteTripFn` counts the trip's reservations, transports, expenses, files and members,
and demands a matching `confirmTitle` when any of the first four is non-zero or the member count
exceeds one; below that threshold an absent field is accepted. `DELETE_CONFIRM_THRESHOLD` is a named
constant beside that rule with a unit test, so the client can render the lighter dialog but can never
skip the ceremony for a trip that earns it. Blank string means "clear it", `undefined` means "unchanged" — the convention
`-server/plan.ts:70-81` already established, reused rather than reinvented.

**Authorisation.** Decided in the repository, twice over. **Who may read** is `canReadTrip`
(decision 1): a well-formed `tripId` from the browser is re-resolved by `requireTrip` inside the
tenant scope and is a `NotFoundError` when it belongs to another organization **or** to a private trip
the caller is not a member of — the same error, deliberately, so the answer never reveals that a trip
exists. **Who may write** is `assertTripRole`, as tabulated above, and its refusal is `FORBIDDEN`,
distinguishable from not-found because the caller has already proved they may see the trip. The
server function contributes nothing but the tenant scope. `beforeLoad` guards nothing here and none
of these functions relies on one.

**The `trip-copy` task, and the handler that runs it.** `copyTripFn` calls `startTripCopy`, then
enqueues one envelope through the single-message `enqueueTask` (`src/server/queue/jobs.ts:66`) — one
message, so there is nothing to chunk on this side — and returns. The envelope is
`{ kind: 'trip-copy', orgId, id: 'trip-copy:<targetTripId>',
payload: { sourceTripId, targetTripId, requestedBy } }`. The id is deterministic on the **target**
id, which is minted by this call and cannot repeat, so a redelivered message copies once, and a
second Copy click on the same source is a different trip and a different envelope.

- **The kind and its payload** are declared in `src/server/queue/types.ts` as one more member of the
  `TASK_KINDS` union and one more `z.strictObject()` in the payload map, with the `error` parameter.
  `runHandler` (`src/server/queue/consumer.ts`) gains the matching `case` and the registry gains the
  module — measured, a `case` without a registry entry falls through to `unhandled()` and
  dead-letters, which is how `thumbnail` behaves today, and this stage does not repeat it.
- **The handler reaches D1 through the binding `00-S4` adds.** `TaskBindings` carries no `DB` at
  HEAD; `00-S4` (`00-foundations.md`, wave 0) adds it to the same file, and wave 0 closes before this
  wave opens. No `wrangler.jsonc` change is involved: the `DB` binding already exists on the Worker
  and the consumer runs in that Worker.
- **Its scope is rebuilt, never carried.** `createScope()` needs `{ userId, organizationId, role }`.
  The envelope carries the organization id and the requesting user id, the role is read with
  `getMembership` (`src/server/repos/members.ts:144`), and a requester who is no longer a member is a
  **permanent** failure. Every statement the handler then runs is `tenantFilter()`-bound to that
  organization, so a forged envelope can only copy rows it already owns.
- **Transient versus permanent, and what each leaves behind.** A D1 or network error throws and the
  queue retries — the copy is idempotent per chunk because every chunk re-reads the target's current
  row count before it writes. A permanent error — the source deleted mid-copy, the requester no
  longer a member, a `places` ceiling crossed by a concurrent write — deletes the target trip through
  `deleteTrip`, which cascades, and notifies the requester. A copy either completes or leaves
  nothing; a half-populated trip nobody asked for is worse than no trip.
- **Two things happen after the last chunk**, in this order: `copy_pending_at` is cleared, and the
  requester is notified through `notify()` (`src/server/repos/notifications.ts:129`) with a
  `titleKey`/`bodyKey` pair and a params record — never a rendered sentence, which is the contract
  that module's own docstring states. The notification write path is `00-S2`'s, in wave 0.

**The `trip-purge` task (decision 3), which is the delete's second half.** `deleteTripFn`, after
`assertTripRole` and before the cascading `deleteTrip`, reads the trip's `files.storage_key` list and
its `cover_image_key` through the tenant-scoped repositories, then deletes the rows, then enqueues one
envelope `{ kind: 'trip-purge', orgId, id: 'trip-purge:<tripId>', payload: { keys } }`. The D1 delete
is the record and never waits for R2: a queue failure is caught and logged once, and the trip is still
gone. The handler deletes the keys through `deleteObjects` in `src/server/storage/objects.ts`, which
chunks at R2's per-call ceiling (a named constant beside the limit it came from, held by a unit test)
and is idempotent — a key already gone is not an error — so a redelivery finishes rather than fails.
`copyTripContents` reaches the same module for `copyObject`, so the two handlers share one R2 surface
and neither opens the bucket itself. The `files.ts` per-file delete path is untouched. Storage usage
is computed from `files` rows (`src/server/repos/files.ts:171`), so the tenant's meter drops with the
cascade and the purge only reconciles what we pay for.

**The travel-statistics envelopes, which are `00-S4`'s obligation on this stage.** `createTripFn`,
`updateTripFn`, `deleteTripFn` and the `trip-copy` handler each change `tripCount`, `dayCount`,
`placeCount` and `cityCount` for **every member of the trip**, and `updateTripFn` also moves the
year-row `countryCount` when it moves `start_date` or `country_codes`. Each of those four paths
therefore enqueues the `travel-stats` envelopes `00-S4` defined, with `00-S4`'s deterministic
`(user, year)` ids so repeats collapse:

- **The recipient set is the trip's members** (decision 9), read with `listTripMembers`
  (`src/server/repos/trips.ts:403`) in the caller's scope — not the workspace, because after decision
  1 a private trip is invisible to a non-member and its statistics must be too. `00-S4` is amended in
  the same change to count a person's trips by membership; this stage only sends to the people that
  count applies to. `getMembership` (`src/server/repos/members.ts:144`) is the sibling the handler uses
  to rebuild its own scope.
- **The years** are the all-time roll-up (`statYear = 0`) always, plus the year of the trip's
  `start_date` when it has one, plus the **previous** `start_date`'s year on an edit that moved it.
- **The fan-out is chunked before it is enqueued, and the bound is not a comment.** This producer
  scales with membership, which is exactly the shape `00-foundations.md` names: `enqueueTasks`
  (`src/server/queue/jobs.ts:79-94`) maps every input into one `sendBatch` without chunking, and a
  `sendBatch` array holds at most 100 messages. So the envelopes go out in chunks of
  `QUEUE_BATCH_MAX = 100`, declared at the top of `src/routes/_app/-server/trip-lifecycle.ts` beside
  that citation, and a unit test with 250 envelopes asserts three calls. The 100-member ceiling
  Better Auth's organization plugin is configured with is a configuration value and not a guarantee,
  so the chunk loop does not lean on it.
- **A queue failure never fails the write.** It is caught, logged once with `serializeError`, and the
  trip write still returns — the same isolation `00-S2` requires of dispatch. A stale statistics
  panel is a smaller harm than a save that appears to have failed.

**The reminder: no obligation remains.** After the grilling redesign of `00-S5` (scan model — the
sweep reads current rows and excludes archived trips in its predicate), `archiveTripFn`,
`restoreTripFn`, `deleteTripFn` and `updateTripFn` call no reminder code at all: archiving stops
future reminders because the scan skips archived trips, restoring resumes them the same way,
deletion removes the row the scan would have read, and a date edit is simply what the next scan
sees. `src/server/queue/reminders.ts` stays `00-S5`'s and is not an owned path here; a scheduler
call added in this stage would be the defect, not the omission of one.

**No Durable Object patch.** The trip room stays invalidation-only, which is how every write in
`-server/plan.ts` already behaves, and `src/server/do/protocol.ts` is untouched.

### UI (route, components)

**Route.** None added, moved or removed. `pnpm generate-routes` is not run, and `src/routeTree.gen.ts`
does not appear in **Owned paths**.

**Components.** `src/routes/_app/-ui/trip-actions.tsx` exports `TripActionsMenu`, `TripEditSheet` and
`TripDeleteDialog`; `-ui/trip-copy-dialog.tsx` exports `TripCopyDialog`. Every primitive it needs already ships in `src/components/ui` and is reused by
name, because a second implementation of one is a defect: `DropdownMenu` with its items and
separators, `IconButton` for the trigger, `Dialog` for the destructive confirmation, `Sheet` for the
edit form, `Field` + `Input` + `SimpleSelect` for the fields, `Button` with its `loading` prop,
`Alert` for the server error, and `toast` from `sonner` for the success line. No new primitive is
required and none is proposed.

**How the menu behaves.** The trigger is an `IconButton` in the tile's top-right corner. Above the
`md` breakpoint it is transparent at rest and becomes opaque on `group-hover` **and** on
`group-focus-within`, so it is reachable by keyboard at every width; below `md` it is always opaque,
because a hover-revealed control on a touch screen is an invisible control. The items are Copy and
Favourite/Unfavourite for every reader, then — for an `owner` only — Edit, Archive/Restore and
Delete. The payload already carries the caller's role, so items the role cannot exercise are **not
rendered** rather than disabled: the repository's refusal is the control, the menu is a courtesy, and
a viewer's menu is two items long. `aria-label` on the trigger names the trip, so a screen reader
hears "Actions for Lisbon in April" and not five identical buttons.

**States, named rather than asserted.**

- _Menu items._ Rest, hover (`--color-surface-2` wash), focus-visible (the shared focus ring, never
  `outline-none`), active, disabled while a write for that trip is in flight, and a `Spinner` in the
  item that is running. The destructive item carries `--color-danger` text and a `--color-danger-soft`
  hover.
- _Delete dialog._ Graduated (decision 10). The dialog names what goes with the trip — days, places,
  bookings, money, files and people — as counts read from the payload, not as a vague warning. When
  the server's threshold is met (any reservation, transport, expense or file, or more than one
  member) the trip's title must be typed to arm the button; below it the button is armed at once and
  the dialog is one paragraph and two buttons. The button is disabled until armed and shows `loading`
  while the write is in the air. The threshold rule is the server's; the client reads a `requiresTitle`
  flag from the payload and never computes it.
- _Copy dialog._ `TripCopyDialog` in `-ui/trip-copy-dialog.tsx` (decision 4a): a `Dialog` with the
  title `Input` and the shipped `DateRangePicker`, both prefilled from the source, a clear-dates
  control that turns the copy into an undated template, and a one-line note when the chosen range is
  shorter than the source's run saying that the extra days' places will land in ideas and their notes
  will be dropped. Submit shows `loading`, cannot be dismissed mid-flight, and navigates to the new
  trip's tile on success.
- _Edit sheet._ Per-field inline errors from the Zod message; a form-level `Alert` on
  `--color-surface-2` for a server error, with a Retry that re-submits; the sheet cannot be dismissed
  while a save is in flight.
- _Empty and skeleton._ This stage adds no list, so it adds no empty state and no skeleton of its own.
  The two lists it appears inside — the trip grid and the archived section — keep the empty state
  already shipped at `src/routes/_app/trips/index.tsx:205-232` and the `CardsSkeleton` at `:250`, and
  `01-S7` owns their redesign. Stated rather than skipped: the box below is ticked against those two
  surfaces re-checked after this stage's edit, not against new ones.
- _Optimistic and rollback._ Favourite toggles optimistically and reverts on failure with the reason
  in a toast, matching the `PlanOrder` rollback in `plan-screen.tsx`. Archive, restore, copy and
  delete are not optimistic: they move a card between sections or remove it, and a card that flickers
  back is worse than a card that waits 200 ms.
- _Copying._ The copy is two-phase, so the tile has a third resting state and it is designed rather
  than implied. While `copy_pending_at` is non-null the new tile renders a `Chip` on the cover reading
  "Copying" with an inline `Spinner`, its cover and its counts sit behind the shipped `Skeleton` at
  `--color-surface-2`, and the tile is not a link — a trip whose places have not landed is a planner
  with an empty day list. `aria-busy` is set on the tile and the chip carries the accessible name, so
  the state is announced rather than only drawn. The action menu on that tile offers Delete alone;
  every other item is `disabled` with a `Tooltip` naming the reason. The tile clears itself on the
  route's next load — the trip list already revalidates on focus — and the completion notification
  `00-S2`'s write path delivers is the second, quieter signal.
- _Copy failed._ When the handler's permanent path has run, the trip is gone and the requester has a
  notification carrying the reason. The trip list shows no ghost tile and no error banner of its own:
  the notification centre is where an asynchronous failure belongs, and inventing a second inbox on
  the trip grid is how two places come to disagree about what happened.

**Motion.** The menu uses the `DropdownMenu` primitive's own entrance, 220 ms on `--ease-out-quint`
in, 150 ms out, transform and opacity only. The trigger's reveal is an opacity transition on
`--duration-fast`. `prefers-reduced-motion: reduce` collapses both to opacity, which the primitives
already honour.

**Tokens.** None missing. Colour, spacing, radius, shadow and easing all resolve from
`src/styles/tokens.css` as it stands, so nothing is filed for a wave-1 token stage. Every count the
dialog prints carries `tabular-nums`.

### Quota

Two metrics, both already in the catalogue, both asserted inside the repository before the write, and
both asserted **in the synchronous half** so that a copy which cannot fit is refused where the reader
is looking rather than in a consumer they cannot see.

- **`trips`.** `startTripCopy` creates a trip row. It calls
  `assertQuota(scope, 'trips', await tripsRepository.count(scope))` as its **first** write-path
  statement, before the insert and before any child row, copying `createTrip`'s call at
  `src/server/repos/trips.ts:315`. Usage is a live `COUNT(*)`, never `usage_records`. The metric is a
  catalogue metric resolved by `resolveLimits()` in `src/server/billing/limits.ts:227` and is
  deliberately absent from `PLAN_QUOTAS`; nothing is added to either.
- **`places`.** A copy also duplicates the source's place inventory, which is metered. `startTripCopy`
  reads the source's place count — one indexed `COUNT(*)` through `placesRepository.count`, because
  `places` leads `places_org_trip_idx` with `organization_id` — and calls
  `assertQuota(scope, 'places', <live tenant count> + <source count>)` **before** it inserts the trip
  row. The projection is the point: asserting the current usage alone would admit a copy that crosses
  the ceiling on its four-hundredth row, inside a consumer, hours after the reader was told it worked.
  `places` is a `PLAN_QUOTAS` metric (`src/server/db/types.ts:43`) already resolved for `createPlace`
  (`src/server/repos/places.ts:269`).
- **The handler asserts again, and the second assertion is not redundant.** Between the enqueue and
  the consumer another write can have taken the headroom, so `copyTripContents` re-asserts `places`
  with the live count before each chunk. A failure there is the permanent path: the target trip is
  deleted and the requester is notified. Re-asserting per chunk rather than once is what makes a
  retried chunk safe.

No metric is added, so `src/server/billing/__tests__/limits.test.ts` gains no case and is not named
in **Owned paths**. The other six writes create no countable row: they update or delete one that
already counted. The `trip-copy` envelope itself is not metered — a queue message is not a sold unit,
and it is bounded at exactly one per copy by the deterministic id on the target trip.

### Tenant isolation test

One new `describe('trip lifecycle')` block appended to
`src/server/repos/__tests__/tenant-isolation.test.ts`, built on the `createHarness` / `seedWorld`
fixtures the file already constructs for `alpha` and `beta`.

In A's scope, against B's trip id: `updateTrip`, `archiveTrip`, `restoreTrip`, `setFavourite`,
`deleteTrip` and `startTripCopy` each raise `NotFoundError`, and B's trip row, day run, places and
assignments are byte-identical afterwards. Then, in A's scope with A's own trip: the acting user is
demoted to `editor` through `updateTripMember` and `deleteTrip` raises the `FORBIDDEN`
`RepositoryError` rather than a `NotFoundError` — the two failures must stay distinguishable, because
one means "not yours to see" and the other "not yours to do", and collapsing them tells an attacker
whether a trip exists.

Then the asynchronous half, which is where a two-phase copy could leak across a boundary and a
one-phase copy could not. In A's scope, `copyTripContents(scopeA, bTripId, aTargetTripId)` raises
`NotFoundError` from the `requireTrip` on the source and writes nothing into A's target — a foreign
source id is not a readable source id, and this is the assertion that proves the envelope is not a
cross-tenant read primitive. Then the mirror: `copyTripContents(scopeA, aSourceTripId, bTripId)`
raises `NotFoundError` on the target, so a forged envelope cannot graft A's inventory onto B's trip.
Both are run again with the scope built the way the handler builds it — `createScope()` from the
envelope's organization id — to show that the rejection comes from the tenant filter and not from the
server function that is absent in a consumer. And the purge: a `trip-purge` envelope carrying B's keys
under A's organization deletes nothing, because the handler re-reads the keys it may delete through
`filesRepository` in A's scope and ignores the envelope's list where the two disagree.

Functions covered: `startTripCopy`, `copyTripContents`, `assertTripRole`, `updateTrip`,
`archiveTrip`, `restoreTrip`, `setFavourite`, `deleteTrip`, the `trip-purge` handler.

**Member isolation — the boundary decision 1 draws inside one organization.** A new file,
`src/server/repos/__tests__/member-isolation.test.ts`, on the same `createHarness`/`seedWorld`
fixtures with a third user `alpha-2` who is a member of `alpha`'s organization and of none of its
trips. In `alpha-2`'s scope against `alpha`'s private trip: `requireTrip`, `updateTrip`, `startTripCopy`,
`setFavourite` and `deleteTrip` each raise `NotFoundError` — not `FORBIDDEN` — and `listTrips`,
`countTripsByStatus` and `listFavouriteTripIds` return no row, no count and no id for it. Then the
trip's `visibility` is set to `organization` and the same reads succeed while `updateTrip` and
`deleteTrip` now raise `FORBIDDEN`, because the caller can see the trip and is not its owner. Then
`alpha-2` is added as `viewer` and `requireTrip` succeeds on the private trip again. Every later stage
of every plan that adds a trip-scoped reader appends a case here, under the same append-only rule as
the tenant file; the two files are the two halves of one question — "may this scope see this row?" —
and a repository function is done when both say yes only where they should.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/server/repos/__tests__/trip-lifecycle.test.ts`, new, holding seven invariants:

1. A copy reproduces the plan and not the record — after `startTripCopy` and `copyTripContents` the
   new trip has the source's day count, place count, assignment count and note count, and zero
   expenses, files, reservations and share links.
2. A copy is independent — editing the copy's assignments leaves the source's `order_index` values
   unchanged.
3. **`startTripCopy` writes exactly two rows.** After it and before the handler runs, the target has
   its trip row and its owner membership and **nothing else** — zero days, zero places, zero
   assignments, zero notes — and `copy_pending_at` is non-null. This is the assertion that fails if
   somebody folds the two halves back together.
   A fourth invariant sits with it: `syncTripDays` on a dateless trip returns without creating a day
   (`src/server/repos/days.ts:155-172`), so the copied run comes from `copyTripContents` and the test
   asserts the day count against the source rather than against the date range.
4. **The chunk bound holds.** A source with more places than one statement's `floor(100 / columns)`
   rows produces the expected number of `insertMany` calls and copies every row exactly once. Written
   against an unchunked implementation it fails on the call count, which is the point of writing it
   as a count rather than as a total.
5. **`copy_pending_at` is cleared exactly once**, as the handler's last statement, and a re-run of
   `copyTripContents` against an already-complete target copies nothing a second time.
6. `assertTripRole` admits `owner` and `editor` for an archive and only `owner` for a delete, and the
   refusal is a `RepositoryError`, not a `NotFoundError`.
7. `deleteTrip` cascades — after it, `days`, `places`, `day_assignments` and `day_notes` for that trip
   return zero rows in the same scope.
8. **Archiving does not touch `status`** (decision 2): a `completed` trip archived and restored is
   `completed` afterwards, `is_archived` toggles, and no row in the table ever carries
   `status = 'archived'` after the round trip.
9. **The favourite is the caller's** (decision 5): `setFavourite` in A-user-1's scope is invisible to
   A-user-2's `listFavouriteTripIds`; setting it twice writes one row; unsetting removes it; the
   `favourites` count on the trips index is per caller.
10. **The copier registry runs in order and reports** (decision 4b): two fake copiers registered in a
    test are called once each with the day and place maps, their reports are summed into the
    completion notification's params, and an unregistered module leaves the target without its rows
    rather than throwing.
11. **A shortened copy sends the overflow to ideas** (decision 4a): a five-day source copied into a
    three-day range yields three days, every place of days four and five present and unscheduled, and
    the notes of those days absent and counted in the report; a dated copy has its run from
    `syncTripDays` and an undated one from `copyTripContents`, asserted by the day rows' `date`.
12. **A trip with no record confirms lightly, one with a record does not** (decision 10):
    `deleteTripFn` on a trip with one member and no reservation, transport, expense or file accepts
    an absent `confirmTitle`; adding one expense makes the same call refuse until the title matches;
    the threshold constant is what the two cases read.

**Unit tests.** `src/server/queue/handlers/__tests__/trip-copy.test.ts`, new, against the in-memory
driver `src/server/repos/__tests__/harness.ts` builds and a fake `TASKS`:

1. A handled message copies the inventory, clears `copy_pending_at` and writes one notification row
   for the requester.
2. The same message delivered twice leaves one copy — the deterministic id is asserted, and the
   second delivery finds `copy_pending_at` already null and returns without writing.
3. A requester who is no longer a member fails **permanently** — `TaskPermanentError`, not a retry —
   and the target trip is gone afterwards.
4. A `places` ceiling crossed between the enqueue and the consumer is the same permanent path, and
   the target trip is gone afterwards. The complementary case is the one that matters most: a
   transient D1 rejection **throws** so the queue retries, and the target trip is still there.
5. The handler never reads outside the envelope's organization, which is the unit-level companion to
   the isolation block above.
6. **The cover object is copied, not shared**: a source with a `cover_image_key` yields a target
   whose key differs and whose object exists in the fake bucket, and deleting the source afterwards
   leaves the target's object in place.

**Unit tests.** `src/server/queue/handlers/__tests__/trip-purge.test.ts` and
`src/server/storage/__tests__/objects.test.ts`, new, against a fake `R2Bucket`:

1. A handled purge deletes every key in the envelope that the repositories confirm, in chunks of the
   named constant — 2 500 keys produce the expected number of `delete` calls — and returns.
2. A key already absent is not a failure; the same envelope delivered twice ends in the same state.
3. A key the organization does not own is skipped, not deleted — the handler's list is the
   intersection of the envelope and what `filesRepository` still knows in that scope.
4. `deleteTripFn` enqueues exactly one `trip-purge` envelope with the trip's file keys and cover key,
   and a rejected enqueue does not fail the delete.

**Unit tests.** `src/routes/_app/-server/__tests__/trip-lifecycle-side-effects.test.ts`, new, against
a fake `TASKS` that records its calls in order — the surviving cross-plan obligation, held as
assertions rather than as prose:

1. `createTripFn`, `updateTripFn`, `deleteTripFn` and the `trip-copy` handler each enqueue the
   `travel-stats` envelopes for every **trip member** (decision 9), with `00-S4`'s deterministic ids,
   and a trip of 250 members produces three `enqueueTasks` calls of at most 100 envelopes each; a
   workspace member who is not on the trip receives none.
2. A queue rejection does not propagate: the write still returns.
3. No lifecycle function touches reminder code — the module imports nothing from
   `src/server/queue/reminders.ts` or `src/server/catalog/reminders.ts`, asserted structurally,
   because under `00-S5`'s scan model archive, restore, delete and edit need no reminder call.

That file is a new owned path and is listed as one below; it lives beside the module it tests, which
is the route-local `__tests__` convention `src/routes/(auth)/-lib/__tests__` already sets.

Plus the isolation block above, which runs inside `pnpm test` with everything else.

**Browser evidence.** The dev server is resolved rather than assumed, and the port is passed
explicitly to everything:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/trips-core.visual.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/trips-core.visual.spec.ts -g '01-S1' --update-snapshots
```

The third invocation is narrowed with `-g` and that is not decoration. `e2e/trips-core.visual.spec.ts`
is the plan's single spec file — `12-verification-protocol.md` §4 — and nine later stages append their
own `test.describe` blocks to it, so `--update-snapshots` over the whole file would re-record
baselines this stage did not design. `-g` matches the full test title and every block's title begins
with its stage id, so the filter is exact. Every later stage of this plan runs the same three lines
with its own id in the `-g`.

`e2e/trips-core.visual.spec.ts` imports every helper from
`./helpers/shoot.ts` — `visit`, `settle`, `shoot`, `applyTheme`, `THEMES`, `useSession`,
`watchConsole` — and re-implements none of them. This stage's block declares its own route table for
`/trips` and calls `auditServerClock(page, <that table>)` once inside that block, because
`auditServerClock` is called only over `APP_ROUTES` in `e2e/visual.spec.ts:310` and a route declared
in a module spec is otherwise audited by nothing. It does **not** claim `e2e/helpers/shoot.ts`: the
only clock-derived string on this stage's surface is the trip card's countdown badge, which is
already the first entry in `RELATIVE_TIME_SITES` (`e2e/helpers/shoot.ts:573`), so `pinRelativeTime()`
already covers it. A non-empty return from `auditRelativeTime()` is read and reported rather than
discarded.

**The frames.** `/trips`, light and dark, at 360, 1280 and 2560 — six for the resting screen. This
stage's outcome is a state the screen is not in when it loads, so it owes three more sets, declared
with their selectors:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S1" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state menu-open --click '[data-part="trip-actions-trigger"]'
```

and a second run with `--state delete-confirm` clicking through to the confirmation (against a seeded
trip that carries a record, so the frame shows the typed confirmation), a third with
`--state copy-dialog --click '[data-part="trip-copy-trigger"]'`, and a fourth with
`--state copy-pending`, which is the state the queue split creates and which a resting frame would
never show: the fixture seeds one trip with a non-null `copy_pending_at`, so the tile renders its
"Copying" chip, its skeletonised counts and its single-item menu. The three selectors are stable
attributes the product publishes — `[data-part="trip-actions-trigger"]`,
`[data-part="trip-delete-dialog"]` and `[data-part="trip-copy-pending"]` — not class names and not
nth-child paths, and **each is verified against the running server with a `page.locator(sel).count()`
of 1 before the capture is run**, not by reading the JSX. The copy-pending frame is the one this
stage would be judged on wrongly without: an asynchronous copy that shows the reader nothing is
indistinguishable from a copy that failed. `PT_SERVER_TODAY=2026-08-20` matches `BASELINE_DAY`
(`e2e/helpers/shoot.ts:1014`) and the header `playwright.config.ts` sends; omitting it photographs a
different day.

Frames go to `.claude/ultrabuild/shots/<slug>/round-<n>/01-S1/` and nowhere else — not the repository
root, not `docs/`.

**Console.** `watchConsole(page, route)` is attached before every navigation and the report's `fatal`
list is asserted empty at the end of every test, including the ones that only take a frame. Nothing is
added to `TOLERATED_CONSOLE_WARNINGS`.

**Layout shift.** Asserted after `settle()`, gated on `PerformanceObserver.supportedEntryTypes`
including `layout-shift`; on `mobile-safari` the entry type is absent and `observe()` does not throw,
so the assertion is skipped with that stated reason rather than passing vacuously.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

None. Every package this stage needs is in the `docs/SPEC.md` §3 pinned set — `radix-ui` behind the
menu and dialog primitives, `lucide-react` for the icons, `sonner` for the toast, `zod` for the
inputs — no binding is added to `wrangler.jsonc`, no third-party service is called, and no row in
another plan gates it.

**Three wave-0 stages gate it and all three close before wave 1 opens**, so none is a blocker; they
are named because a stage that consumes another stage's output owes the reader that list. `00-S1`
generated the migration for `trips.copy_pending_at` (landed, `drizzle/0006_mighty_nehzno.sql`);
`00-S6` generates the one for `trip_favourites` (decision 5) and this stage does not open before it. `00-S4` adds `DB` to `TaskBindings` in
`src/server/queue/types.ts`, without which no queue handler can reach D1, and defines the
`travel-stats` envelope this stage enqueues. `00-S2`'s notification write path is used for the
copy's completion message. `00-S5` is deliberately absent from this list: after its grilling
redesign the lifecycle paths call no reminder code at all.

## Stage 01-S2 — A day note becomes something you can write

### Stage id

`01-S2` · Wave 1 · effort **L**. The first half of the `TRP-08`/`TRP-09` cut: the record and its
write path, before the merged ordering. Recorded as **M** in `gap-rows.json`, and the difference is
one thing the row's name asks for and the matrix did not price — the note's detail is markdown, no
markdown renderer is in the dependency set, and `11-boundaries-and-blockers.md` disposes of that gap
as **hand-roll a restricted subset** owned by the earliest wave-1 stage that needs it. This is that
stage. The subset is specified under **UI** and bounded under **Blockers**.

### Reference rows

- `TRP-09` absent → **done**. Every field the row names ships here: the required headline, the
  markdown detail rendered through the restricted subset this stage mints, the icon picker, the
  optional time, a position of the note's own, and repositioning by explicit up and down controls.
  Two of the row's behaviours — the ordering space shared with places, and drag repositioning inside
  it — are the second half of the `TRP-08`/`TRP-09` cut and land in `01-S4` in wave 2. That is the
  cut, not a deferral: it is recorded in `gap-cuts.json`, argued in the Area brief, and the row's
  status moves once, here.

Sourced from `wiki: Day-Plans-and-Notes` for the note's field set, its icon affordance, its optional
time and the two ways it is repositioned.

**Two contradictions with the row, both measured, both already argued in the Area brief.** The row
says "no server function, no UI"; the server function half is right and the UI half is wrong — a
read-only note list has rendered at `src/components/planner/day-section.tsx:164-192` since before this
plan, fed by `PlanBoardDay.notes` (`-server/plan.ts:140-146`). And the row's field list assumes a
`title` column that `day_notes` does not have (`src/server/db/schema.ts:581-603`). This stage extends
the render it found and maps the field set onto the columns that exist.

**The field mapping, fixed here so no later stage re-guesses it.** `body` is the note's headline: it
is already `NOT NULL`, the seeded rows already read as one line, and making it nullable to free the
name would be a narrowing change the migration ritual forbids. The long text becomes a **new nullable
`detail` column**. `time` and `icon` are used as they stand.

Rows unblocked: `TRP-08` (`01-S4`) directly.

### Owned paths

- `src/server/repos/days.ts` — edit. The two guards, the icon vocabulary, the detail field and the
  note reorder.
- `src/routes/_app/trips/$tripId/-server/day-notes.ts` — new. The note's one read and its four
  writes. A new module rather than an addition to `-server/plan.ts`, for the reason **The four
  planner core files** gives: `07-S1` holds `-server/plan.ts` in wave 1.
- `src/routes/_app/trips/$tripId/plan.tsx` — edit, and the edit is the loader. It resolves the board
  read and the note read together and hands both to `PlanScreen`; the route's pending component and
  its error component are untouched. No route is added, moved or renamed, so the generated tree does
  not change and `pnpm generate-routes` is not a step of this stage.
- `src/lib/markdown/parse.ts` — new. The restricted markdown subset, as a pure function from text to
  a typed node tree. No React, no HTML, no string output.
- `src/lib/markdown/render.tsx` — new. The node tree as a React element tree, token-styled.
- `src/lib/markdown/__tests__/parse.test.ts` — new.
- `src/lib/markdown/__tests__/render.test.tsx` — new.
- `src/routes/_app/trips/$tripId/-ui/plan-model.ts` — edit. The note view model.
- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` — edit. Mounts the note editor and wires the
  four writes; no other part of the screen changes.
- `src/routes/_app/trips/$tripId/-ui/note-dialog.tsx` — new. The note editor.
- `src/components/planner/note-row.tsx` — new. One note in a day section.
- `src/components/planner/day-section.tsx` — edit. Renders note rows and the day's add-note control.
- `src/components/planner/types.ts` — edit. `PlannerNote`.
- `src/components/planner/index.ts` — edit. Exports the two new symbols.
- `src/components/planner/__tests__/notes.test.tsx` — new. This stage's component tests, in their own
  file so no wave-1 stage contends for `rails.test.tsx`.
- `src/server/repos/__tests__/day-notes.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S2` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S2'` so no other block is re-recorded.

**The six shared paths this stage claims, and every stage of every plan that touches one in a later
wave.** Measured with `scripts/ultrabuild/check-plan-collisions.mjs`, not read off the siblings; the
run and its output are at the foot of this file. No entry shares wave 1 with this stage, which is
what makes each claim legal.

| Path                                     | Later claims, with wave                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/routes/_app/trips/$tripId/plan.tsx` | `03-S5` (`03-…`, wave 4)                                                                 |
| `-ui/plan-model.ts`                      | `01-S4` (wave 2), `02-S7` (`02-…`, wave 4), `02-S9` (wave 5), `03-S8` (`03-…`, wave 6)   |
| `-ui/plan-screen.tsx`                    | `01-S4` (wave 2), `02-S4` (wave 3), `03-S5` (wave 4), `01-S9` (wave 5)                   |
| `src/components/planner/day-section.tsx` | `01-S4` (wave 2), `02-S4` (wave 3), `03-S5` (wave 4), `02-S9` (wave 5), `03-S8` (wave 6) |
| `src/components/planner/types.ts`        | `01-S4` (wave 2), `03-S5` (wave 4), `03-S8` (wave 6)                                     |
| `src/components/planner/index.ts`        | `01-S4` (wave 2), `03-S5` (wave 4)                                                       |

Two of the four planner core files are named here — `-ui/plan-model.ts` and `-ui/plan-screen.tsx` —
and no stage of any plan names either of those two in wave 1 except this one, which is the schedule
**The four planner core files** fixes.

`src/routes/_app/trips/$tripId/-server/plan.ts` is **not** named, and its absence is the collision
resolution rather than an oversight: `07-S1` of `07-collaboration-and-sharing.md` claims it as `edit`
in wave 1 to add its room-mirror calls, and two exclusive claims on one file in one wave clobber each
other. `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` is absent for a different reason: the note
editor is a new dialog, not a variant of the place dialog, and adding a fifth dialog to an 831-line
module to save a file is how that module got to 831 lines.

`src/lib/markdown/**` is new in this stage and claimed by no stage of any plan. Four other rows want
the same renderer — `EXT-04`, `COL-07`, `ADD-08` and `DOC-06` — and every one of them **imports** this
module. A second implementation of it, in any plan, is a defect and not a convenience; that is entry 5
of `11-S2`'s register speaking, not this stage.

### Data and migration

**One additive column, filed to `00-S1` (`00-foundations.md`, wave 0)** — the wave-0 schema stage,
which is the one that "absorbs any **Data and migration** requirement filed by a wave-1 stage". This
stage is wave 1, so it files one wave early and does **not** edit `src/server/db/schema.ts`. Filing
to the schema stage of this stage's **own** wave would put the column behind the code that reads it.

| Table       | Column   | Type   | Null     | Default | CHECK                       |
| ----------- | -------- | ------ | -------- | ------- | --------------------------- |
| `day_notes` | `detail` | `text` | nullable | none    | none — see the reason below |

Nullable with no default, because every existing row has no detail and a rollback must keep working
against the new schema. No `CHECK` is added for the icon vocabulary either: drizzle-kit emits a full
table rebuild for a constraint change on SQLite, as `drizzle/0001_aspiring_cargill.sql` shows, and a
rebuild is a poor trade for an invariant a Zod enum holds exactly. `icon` keeps its
`NOT NULL DEFAULT 'sticky-note'` and gains no constraint.

No new index. `day_notes` already carries `day_notes_org_trip_idx` on `(organization_id, trip_id)` and
`day_notes_day_sort_idx` on `(day_id, sort_order)` (`src/server/db/schema.ts:599-600`), and `detail`
is not a filter. The migration backfills nothing.

Times stay `HH:MM` text and `sort_order` stays `real`, so a fractional insert between two notes needs
no renumbering pass. No second convention is introduced.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/days.ts`.**

- **The guard, which is a defect fix.** `createDayNote` (`:229-237`) parses and inserts, calling
  neither `requireTrip` nor `requireTripDay`. Because `createTenantRepository().insert` stamps the
  caller's `organization_id`, a `dayId` from organization B is written as a row owned by A pointing at
  B's day. This stage adds `await requireTrip(scope, values.tripId)` and
  `await requireTripDay(scope, values.tripId, values.dayId)` — the second already exists in this
  module at `:104-115` and already raises `NotFoundError` when the day belongs to a different trip —
  before the insert, and the same pair to `updateDayNote` whenever the patch moves a note between
  days. `deleteDayNote` needs neither: `requireRemove` is tenant-filtered and the note's id is its
  own authority.
- **`requireWritableTripDay(scope, tripId, dayId)`** — new, and the reason it exists is a
  consequence of the collision. `-server/plan.ts` refuses a write to an archived trip in a
  module-private `writableTrip` (`:97-106`) which is **not exported**, and exporting it would mean
  editing a file `07-S1` holds in wave 1. So the same policy gets a repository-level home instead:
  one function that calls `requireTrip`, refuses `trip.isArchived` with the same message the planner
  already shows, calls `assertTripRole(scope, tripId, ['owner', 'editor'])` — the guard `01-S1` adds;
  a note is the plan's content and a `viewer` reads it and writes none (decision 6) — then calls
  `requireTripDay`, and returns both rows. It is where the policy belonged
  anyway — every other authorisation decision in this product is taken in a repository, not in a
  server function. `-server/plan.ts` is left exactly as it is; `01-S4` owns both modules in wave 2
  and may fold the private guard into this one, and this stage does not require it to.
- **The icon vocabulary.** `DAY_NOTE_ICONS`, a `readonly` tuple exported from this module, is the
  single list both the picker and the validator read. Each entry is the kebab-case name of an icon
  that exists in `lucide-react`, which is already a pinned dependency and already how
  `categories.icon` is stored (`src/server/db/schema.ts:433`). The input becomes
  `z.enum(DAY_NOTE_ICONS).optional()` — omitted, never nulled, because the column is `NOT NULL` with a
  default. Our set is chosen for what a traveller annotates a day with; it is not sized to match any
  other product's.
- **`detail`.** `createDayNoteInput` and `updateDayNoteInput` gain
  `detail: longTextSchema.nullish()`. `body` keeps `longTextSchema.min(1)` and stays required.
- **`reorderDayNotes(scope, dayId, noteIds)`** — new. Resolves the day, refuses ids that are not that
  day's notes rather than rejecting the whole call, and writes `sort_order` from array position so the
  run renormalises to `0..n-1` on every move. One `runBatch(scope, statements)` from
  `src/server/repos/batch.ts:35` — **not** `scope.db.batch()`, which does not exist on the abstract
  Drizzle handle and would not typecheck; `reorderAssignments` (`src/server/repos/itinerary.ts:343`)
  is the shipped example of the same call. The statements are one `UPDATE` per note of one day, three
  bound parameters each, so the write stays far inside D1's 100-parameter ceiling and belongs in the
  request path rather than in a queue — see **Multi-row writes** in the Area brief. This is the same
  self-healing contract `reorderPlanFn` (`-server/plan.ts:256`) already uses for assignments, and it
  is deliberately the same so that `01-S4` can merge the two number lines without reconciling two
  philosophies.

**Server functions — `src/routes/_app/trips/$tripId/-server/day-notes.ts`.** One read and four
writes, every one of them `.validator()`-guarded and one repository call deep, exactly as
`-server/plan.ts` does it. The writes are `createServerFn({ method: 'POST' })` and each opens with
`requireWritableTripDay`, so a note cannot be written onto an archived trip or onto another tenant's
day; the read is `{ method: 'GET' }` and resolves the trip with `requireTrip` before it reads:

| Function            | Method | Input                                              | Returns             |
| ------------------- | ------ | -------------------------------------------------- | ------------------- |
| `loadDayNotes`      | GET    | `{ tripId }`                                       | `PlanNotesPayload`  |
| `createDayNoteFn`   | POST   | `{ tripId, dayId, body, detail, time, icon }`      | `{ noteId }`        |
| `updateDayNoteFn`   | POST   | `{ tripId, noteId, body?, detail?, time?, icon? }` | `{ noteId }`        |
| `deleteDayNoteFn`   | POST   | `{ tripId, noteId }`                               | `{ deleted: true }` |
| `reorderDayNotesFn` | POST   | `{ tripId, dayId, noteIds }`                       | `{ dayId }`         |

`PlanNotesPayload` is `{ tripId, notes: ReadonlyArray<PlanNote> }` where `PlanNote` is
`{ id, dayId, body, detail, time, icon, sortOrder }` — the whole trip's notes in one query, through
`listTripDayNotes` (`src/server/repos/days.ts:219-227`), which is already ordered by
`(sort_order, id)` and already tenant-filtered. One query, not one per day: `day_notes` leads
`day_notes_org_trip_idx` with `organization_id`, so the read is index-bounded and D1 charges for the
trip's notes rather than for a scan.

**The board's own note projection is not extended, and it is not left to rot.** `loadPlanBoard` keeps
projecting `{ id, body, time }` at `-server/plan.ts:140-146` for one wave, because that file belongs
to `07-S1` in wave 1. From the moment this stage lands, nothing reads it — `plan-model.ts` builds
every note from `PlanNotesPayload` — and `01-S4` deletes the projection in wave 2 as part of the
merged read, in the stage that owns the file next. That is one wave of a dead field, stated here so it
is not discovered as a surprise, and it is the whole price of the yield.

**Zod v4.** `z.strictObject()` with the `error` parameter; `z.enum(DAY_NOTE_ICONS)` for the icon; a
blank string clears an optional field and `undefined` leaves it unchanged. The time is a
blank-tolerant union declared in this module: `-server/plan.ts`'s `timeOrBlank` (`:73-76`) is
module-private and exporting it would mean editing a file this stage does not own, so the four-line
union is re-declared rather than reached for. `01-S4` owns both modules and may lift it into a shared
one; two four-line unions for one wave is the cheaper of the two mistakes available here.

**Authorisation and tenant scoping.** Both decided in the repository, and neither in the server
function. All SQL this stage adds is in `src/server/repos/days.ts`; the new module under `-server/`
contains none. Every statement goes through `dayNotesRepository`, built by `createTenantRepository`
in `src/server/repos/base.ts`, so a read starts from `tenantFilter()` —
`eq(day_notes.organization_id, scope.ctx.organizationId)`, which a caller can only `AND` onto — and an
insert has `organization_id` stamped from the scope rather than taken from the payload.
`requireTrip` re-resolves the trip in the caller's scope and `requireTripDay` proves the day belongs
to it; both raise `NotFoundError` across a tenant boundary. A well-formed `dayId` from the browser is
not an authorised `dayId`, which is precisely the hole this stage closes.

Nothing enqueued, no Durable Object patch. A note write invalidates the router like every other
planner write; the trip room stays a signal.

### UI (route, components)

**Route.** None added, moved or renamed, so the generated route tree does not change:
`pnpm generate-routes` is not a step of this stage and `src/routeTree.gen.ts` is not an owned path.
One existing route file changes, `src/routes/_app/trips/$tripId/plan.tsx`, and only in its `loader`:
it awaits `loadPlanBoard` and `loadDayNotes` together with `Promise.all` and hands
`{ board, notes }` to `PlanScreen`. Both are server functions, so both run on the server and neither
pulls D1 into the browser bundle — the isomorphic-loader rule that makes a direct database call in a
loader a bug. The second call adds one indexed D1 read to the planner's server render and no
round trip on the client, because the loader resolves before the route paints.

**Components.** `NoteRow` in `src/components/planner/note-row.tsx` renders one note: the chosen icon
in a `--color-surface-inset` tile, the headline in the UI face, the optional time in
`tabular-nums`, the detail rendered through `src/lib/markdown` and clamped to two lines with the rest
behind a disclosure, and an actions cluster. `DaySection` renders the run of notes and an add-note
control in the day header. The editor, `NoteDialog` in `-ui/note-dialog.tsx`, reuses `Dialog`,
`Field`, `Input`, `Textarea`, `Button`, `IconButton`, `Alert`, `Spinner` and `Tooltip` from
`src/components/ui`, plus a radio group of icon buttons built on the shipped `RadioGroup`
(`src/components/ui/radio-group.tsx`) so the picker is one tab stop with arrow-key movement rather
than twenty tab stops. Nothing is added to `src/components/ui`, which this plan never claims.

**The markdown detail, and the subset it renders.** `TRP-09` says the detail is markdown, no markdown
parser and no HTML sanitiser is in the pinned dependency set, and
`11-boundaries-and-blockers.md` disposes of exactly that gap as entry 5 of `11-S2`'s register:
**hand-roll a restricted subset**, "one implementation under `src/lib/`, owned by the earliest wave-1
stage that needs it and reused by the other four". `TRP-09` is a wave-1 row and this is its stage, so
this stage writes it. The subset is entry 5's, copied into work rather than reinterpreted:

- **Block level:** paragraph, heading levels one to three, unordered list, ordered list, fenced code,
  block quote, thematic break, and a simple pipe table.
- **Inline:** emphasis, strong, code span, hard break, and a link whose scheme is checked against an
  `http` / `https` / `mailto` allow-list before it becomes an anchor.
- **Explicitly not in the subset:** raw HTML pass-through in any form — which is what removes the
  sanitiser requirement altogether rather than deferring it; images inside a body; reference links;
  footnotes; autolink literals; nested block quotes.
- **Shape:** `parse()` in `src/lib/markdown/parse.ts` is pure and returns a readonly node tree with no
  React in it; `Markdown` in `src/lib/markdown/render.tsx` turns that tree into a React element tree.
  **Never a string assigned to `dangerouslySetInnerHTML`** — `src/` contains exactly one of those, the
  theme bootstrap at `src/routes/__root.tsx:95`, and this stage adds none. A serialiser can later walk
  the same tree for the document export in `DOC-06` rather than parsing twice.
- **Degradation:** syntax outside the subset renders as its literal characters. Nothing throws, so a
  note written in a fuller dialect elsewhere is still readable here.
- **Type-level:** the node tree is a discriminated union, the renderer switches on it exhaustively,
  and there is no `any` and no cast anywhere in either module.

It is styled from tokens only: `--text-body` and its paired line height for prose, `--color-ink-2`
for body text and `--color-ink-3` for a block quote's rule, `--color-surface-inset` behind a code
span and a fenced block, `--radius-sm` on both, `--space-*` for every gap, and `--color-brand` on a
link with a visible `focus-visible` ring. Both themes are checked, and the code surface gets its own
dark value rather than an inverted light one. Long content inside a note detail scrolls its own
container rather than growing the day rail.

`src/lib/markdown` imports nothing from `server/` and fetches no data, so it obeys the same rule as a
`components/ui` primitive; it lives under `src/lib/` because that is where entry 5 of the register put
it and because `README.md` reserves `src/components/ui/**` as a shared path no feature stage may
claim.

The editor writes the raw text and shows what it will look like: `NoteDialog` puts the `Textarea` and
a live rendered preview side by side above 640px and behind a two-item `Tabs` below it, so a 360px
viewport is a designed layout rather than two panes crushed together.

**Repositioning in this stage is notes among notes.** Each note carries an up and a down `IconButton`
that call `reorderDayNotesFn` with the resulting order. The first note's up control and the last
note's down control are `disabled`, not hidden, so the row's control count does not change as it
moves. Drag repositioning and interleaving with stops are `01-S4`'s, and this stage adds no
`useSortable` and no change to `ordering.ts`.

**States.**

- _The note list._ Empty is the common case and is designed rather than blank: a day with stops and no
  notes shows a single dashed `--color-edge` add-note affordance reading "Add a note for this day",
  on `--color-surface-2`. A day with neither stops nor notes keeps the existing
  "Nothing planned — drop a place here" target (`day-section.tsx:139-149`) and puts the note
  affordance beneath it.
- _Skeleton._ The planner's day rail is server-rendered through the route loader, so a note run has no
  independent pending state; the day section's existing skeleton covers it. What does get one is the
  note **being saved**: the row renders at 60% opacity with a `Spinner` in place of its icon until the
  router invalidation lands.
- _Error._ A failed write leaves the dialog open with an `Alert` on `--color-surface-2` carrying the
  server's message and a Retry, and a failed reorder rolls the run back to its previous order and
  says so in a toast — the rollback contract `plan-screen.tsx` already applies to `PlanOrder`.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading, on the add control, the
  two chevrons, the icon radios, the detail disclosure, the preview tabs, the save and the delete.
- _An empty detail._ A note with a headline and no detail renders no empty prose block and no
  placeholder line — the row is simply one line tall, and the disclosure control is absent rather
  than present-and-disabled, because there is nothing behind it to disclose.

**Motion.** A note entering the run fades and lifts 4px over 220 ms on `--ease-out-quint`; a run of
several staggers by 24 ms capped at eight rows. Reordering animates transform only. Reduced motion
collapses to opacity.

**Tokens.** None missing; nothing filed for a token stage. The time carries `tabular-nums`.

### Quota

**No countable row, and the reason is not that nobody asked.** A day note is a text row on a day of a
trip the tenant has already paid for: `days` are created only by `syncTripDays` from the trip's own
date range, and `trips` is a catalogue metric asserted at `src/server/repos/trips.ts:315`. There is no
`day_notes` metric in `resolveLimits()` and none in `PLAN_QUOTAS`, and this stage adds neither, because
a metric added to the resolver is a number the billing screen then has to publish and
`src/server/billing/__tests__/limits.test.ts` then has to hold — and we do not sell notes. Nothing is
added to that test file and it is not named in **Owned paths**.

The bound that does exist is structural: `longTextSchema` caps a note's size, and the notes of a day
are read in one indexed query on `(day_id, sort_order)`.

### Tenant isolation test

One new `describe('day notes')` block appended to
`src/server/repos/__tests__/tenant-isolation.test.ts`. The file already imports `createDayNote`
(`:67`) and already builds a note for each tenant in `seedWorld` (`:273`), so the generic read, list,
update, delete and count cases over `dayNotesRepository` already run; what is missing is the
foreign-parent case, which is the one this stage's guard makes pass.

In A's scope: `createDayNote` with B's `tripId` and B's `dayId` raises `NotFoundError`;
`createDayNote` with A's own `tripId` and B's `dayId` raises `NotFoundError` — the case that fails
today and the reason the guard is two calls and not one; `updateDayNote` moving A's note onto B's day
raises `NotFoundError`; `reorderDayNotes` with B's `dayId` raises `NotFoundError`; and
`reorderDayNotes` on A's own day with a list containing one of B's note ids leaves both tenants'
`sort_order` values unchanged for the foreign id. B's `day_notes` rows are byte-identical afterwards
and B's day still holds the same number of notes.

Functions covered: `createDayNote`, `updateDayNote`, `deleteDayNote`, `reorderDayNotes`.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

The migration this stage filed is generated and applied by `00-S1` in wave 0, not here; this stage's
gate runs against the schema that stage produced and fails loudly if `detail` is absent, which is the
intended coupling.

**Unit tests.**

- `src/server/repos/__tests__/day-notes.test.ts` — new. Five invariants: an icon outside
  `DAY_NOTE_ICONS` is rejected by the input rather than written; an omitted icon takes the column
  default and a `null` icon is rejected; `reorderDayNotes` renormalises a fractional run to
  `0..n-1` and drops ids that are not that day's; a note with a detail round-trips the author's text
  byte for byte, including newlines, because a rendering decision must never become a storage
  decision; and `requireWritableTripDay` refuses an archived trip with the message the planner shows.
- `src/lib/markdown/__tests__/parse.test.ts` — new. Every block form and every inline form in the
  subset, one case each, asserted against the node tree rather than against a string. Then the four
  that matter more than the happy path: a `javascript:` link and a `data:` link survive as literal
  text and never become an anchor; a raw `<script>` in the source is text, not a node; unclosed
  emphasis and a half-written table degrade to their literal characters without throwing; and a
  10 000-character body parses within the test's default timeout, so a long note cannot become a
  render stall.
- `src/lib/markdown/__tests__/render.test.tsx` — new. The tree renders the expected elements; an
  allow-listed link is an `<a>` carrying `rel="noreferrer noopener"`; a disallowed one is plain text;
  the rendered subtree contains no `dangerouslySetInnerHTML` — asserted by rendering a body full of
  markup and querying for the element that markup would have produced, which must not exist; and a
  heading level three is an `<h3>` so the note's prose does not outrank the day it sits in.
- `src/components/planner/__tests__/notes.test.tsx` — new. `NoteRow` disables the up control on the
  first note and the down control on the last; the icon radio group is one tab stop and moves with
  arrow keys; the detail disclosure is a real `button` with an accessible name; and a note with no
  detail renders no disclosure at all.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S2'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` block declares `/trips/$tripId/plan` for a seeded trip, marks it `map: true`
— the route renders `[data-map-ready]` and `settleMap()` fails a route that renders the marker
without declaring it — and calls `auditServerClock` over its own route table.

Frames: the planner at 360, 1280 and 2560 in both themes for the resting screen, and **two** declared
non-resting sets, because the two states this stage exists to add are both invisible at rest — the
editor with its live preview, and a note's expanded detail in the day rail:

`scripts/ultrabuild/capture.mjs` takes **one** `--state` and one `--click` per run — `opt.state` is a
single string at `:102` and `opt.click` a single selector at `:222` — so this is two invocations and
not one with two flags, and each writes its own `<state>-` prefixed frames into the same directory:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<seeded-trip-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S2" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
  --state note-editor --click '[data-part="day-add-note"]'

PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<seeded-trip-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S2" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
  --state note-detail --click '[data-part="note-disclosure"]'
```

The seeded note the second state opens carries a detail exercising every block form in the subset —
a heading, a list, a quote, a fenced block, a rule and a table — so the frame the critic judges shows
the renderer doing its whole job rather than one paragraph.

`[data-part="day-add-note"]`, `[data-part="note-row"]` and `[data-part="note-disclosure"]` are stable
published attributes and each is verified with a `page.locator(sel).count()` against the running
server before the capture runs. The
`--map` flag is not optional on this route: it re-waits for the two-sided `[data-map-ready]` predicate
after every resize and every theme change, and without it a frame is filed mid-restyle.

`e2e/helpers/shoot.ts` is **not** claimed. The planner prints no clock-derived string of a shape
outside `RELATIVE_TIME_SITES`; a note's time is a stored `HH:MM`, not a relative string, and is
therefore stable across days.

**Console.** `watchConsole` attached before navigation, `fatal` asserted empty in every test,
`TOLERATED_CONSOLE_WARNINGS` untouched. **Layout shift** asserted after `settle()`, gated on
`supportedEntryTypes`.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One missing package, and the register already decided what happens to it.** The note's detail is
markdown. Measured against `package.json`: the pinned dependency set contains **no markdown parser and
no HTML sanitiser** — the runtime dependencies are `@dnd-kit/*`, `@tanstack/*`, `better-auth`,
`class-variance-authority`, `clsx`, `date-fns`, `drizzle-orm`, `lucide-react`, `maplibre-gl`,
`motion`, `nanoid`, `partysocket`, `pmtiles`, `radix-ui`, `react`, `sonner`, `stripe`,
`tailwind-merge`, `tailwindcss`, `vaul` and `zod`. Measured in `src/`: exactly one
`dangerouslySetInnerHTML`, the theme bootstrap script at `src/routes/__root.tsx:95`.

- **Missing capability:** a markdown parser, and the HTML sanitiser any parser that passes raw HTML
  through obliges.
- **Verdict, `docs/SPEC.md` §3:** stop and report, do not install. No package is added, and neither
  `package.json` nor `pnpm-lock.yaml` is edited by this stage or by any other in this file.
- **Disposition: hand-roll a restricted subset.** This is entry 5 of the register in
  `11-boundaries-and-blockers.md` (`11-S2`), which lists `TRP-09` first among the five rows it blocks
  and assigns the implementation to "the earliest wave-1 stage that needs it". That is this stage, so
  the subset is **built here**, not deferred: `src/lib/markdown/parse.ts` and
  `src/lib/markdown/render.tsx`, specified in full under **UI** and tested under **Verification**.
- **Why hand-rolling is safe here and would not be with a parser.** The sanitiser exists to clean the
  raw HTML a general parser lets through. This subset passes **no** raw HTML at all and emits a React
  element tree rather than a string, so there is no HTML to clean and no
  `dangerouslySetInnerHTML` anywhere in the path. The one remaining injection surface is a link's
  scheme, and it is closed by an allow-list of `http`, `https` and `mailto` with everything else
  rendered as literal text. That is a smaller, provable security surface than the one a parser plus a
  sanitiser would create — which is why the register chose it.
- **The bound, restated so this stage cannot quietly grow:** what is in the subset and what is not is
  entry 5's list, reproduced under **UI**. A syntax outside it renders as its own characters. This
  stage does not add images, reference links, footnotes, autolink literals, nested block quotes or
  raw HTML, and a later stage that wants one of them argues it against the register rather than
  against this file.
- **Reuse, not re-implementation.** `EXT-04`, `COL-07`, `ADD-08` and `DOC-06` import this module. The
  register is explicit that a second implementation is a defect, and the export surface is kept
  deliberately small — `parse`, `Markdown`, and the node types — so that consuming it is easier than
  writing another one.

Nothing else blocks this stage: no binding is added to `wrangler.jsonc`, no third-party service is
called, and the only other plan it waits on is `00-S1` (`00-foundations.md`, wave 0) for the `detail`
column, which closes before this wave opens.

## Stage 01-S3 — A trip reopens on the tab you left it on

### Stage id

`01-S3` · Wave 1 · effort **S**. The smallest stage in the plan, and the one that mints the browser
preference module the three later client-preference stages reuse — `01-S5`, `01-S7` and `01-S9`.

### Reference rows

- `TRP-07` partial → **done**.

Sourced from `wiki: Trip-Planner-Overview` for the behaviour that each trip remembers its own last
section rather than the app remembering one section for all trips.

**Agreement with the row, and the half of it we do not port.** The row is accurate: all seven tabs are
declared in `src/components/layout/nav-model.ts:91-99`, each has a real route under
`src/routes/_app/trips/$tripId/`, and nothing persists the active one. The upstream tab strip also
hides four of the seven behind an instance-wide administrative switch. That is a single-tenant
concept — one deployment serves every tenant here, so an instance switch would turn a feature off for
every customer at once — and the hosted equivalent already exists as the per-plan module flags in
`src/lib/plans.ts`. Entitlement gating of tabs is `ADD-01`'s subject in
`08-product-modules.md`, not this stage's, and this stage renders all seven.

Rows unblocked: none. `TRP-07` has no dependants in `gap-rows.json`.

### Owned paths

- `src/lib/local-preference.ts` — new. A `useSyncExternalStore`-backed reader and writer for a
  namespaced browser preference, storage-failure tolerant, with the storage **area** — `local` or
  `session` — a required part of every preference's declaration rather than a default baked into the
  module.
- `src/lib/__tests__/local-preference.test.ts` — new.
- `src/lib/trip-tab.ts` — new. The tab vocabulary check and the trip-tab preference declaration
  (`planned.trip-tab`, area `local`), isomorphic and free of storage access of its own.
- `src/lib/__tests__/trip-tab.test.ts` — new.
- `src/components/layout/trip-sub-nav.tsx` — edit. Records the active tab on activation.
- `src/routes/_app/trips/$tripId/index.tsx` — edit. The redirect reads the remembered tab.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S3` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S3'` so no other block is re-recorded.

### Data and migration

**None, and the choice is deliberate rather than lazy.** The remembered tab is a per-browser
navigation convenience, not an account setting: it is worthless on a second device, it changes on
every click, and writing it to D1 would put a round trip and a row write on the path of a tab click.
`user_settings` (`src/server/db/schema.ts:1827-1856`) carries theme, locale, timezone, currency, week
start, date format, distance unit, map style, accent colour and reduce-motion, and none of those has
this shape. No column is filed for `00-S1` or for any later schema stage, and no migration is
generated.

The trade-off is stated rather than hidden: the preference does not follow the user to a second
device. Three later stages make the same call for the same reason — the widget visibility (`01-S5`),
the trips view mode (`01-S7`) and the planner layout (`01-S9`) — and all four go through the one
module this stage mints, so that a future stage which does want them on the server has one place to
change and not four.

### Server (repo, server function, Zod)

**None of any kind.** No repository function, no server function, no Zod schema, no SQL, no
authorisation decision — this stage writes no row and reads no row. It is recorded here explicitly
because an empty heading is indistinguishable from an author who never asked.

The one server-side seam it touches is the isomorphism of `beforeLoad`, which is a correctness
question rather than a data one. `src/routes/_app/trips/$tripId/index.tsx:9-11` throws
`redirect({ to: '/trips/$tripId/plan', replace: true })` from `beforeLoad`, and `beforeLoad` runs on
the server for a cold load and in the browser for a client navigation. Neither `window.localStorage`
nor `window.sessionStorage` exists in the first case. The rule this stage fixes: the redirect reads
the remembered tab **only when `typeof window !== 'undefined'`**, and falls back to `plan` otherwise. A cold load of
`/trips/<id>` therefore lands on the plan and a client navigation lands on the remembered tab, which
is the honest behaviour and is what the stage's evidence has to show — not a hydration mismatch
dressed as a feature.

### UI (route, components)

**Route.** No route file is added or moved, so `pnpm generate-routes` is not run and
`src/routeTree.gen.ts` is not an owned path. `src/routes/_app/trips/$tripId/index.tsx` is edited in
place and keeps its path.

**Components.** `TripSubNav` gains one call in the tab `Link`'s activation path and nothing else. Its
`motion` active pill, its horizontal scroll on narrow viewports and its two-row narrow layout are
untouched — the stage is a memory, not a redesign, and the strip already meets the bar.

**The storage contract, and the lifetime decision it forces.** Keys are namespaced under this
product's own prefix, `planned.`, matching `THEME_STORAGE_KEY = 'planned.theme'`
(`src/lib/theme.ts:18`). The module exposes two factories and no free-floating getters, so no caller
can reach a storage object directly:

```ts
export type PreferenceArea = 'local' | 'session'

export function definePreference<T>(spec: {
  readonly key: `planned.${string}`
  readonly area: PreferenceArea
  readonly fallback: T
  readonly parse: (raw: string) => T | undefined
}): Preference<T>

export function defineKeyedPreference<T>(spec: {
  readonly key: `planned.${string}`
  readonly area: PreferenceArea
  readonly limit: number
  readonly fallback: T
  readonly parse: (raw: string) => T | undefined
}): KeyedPreference<T>
```

`Preference<T>` is `read()`, `write(next)` and `subscribe(listener)`; `KeyedPreference<T>` is the same
surface with an owner id — a trip id — as the first argument. React reads them through two hooks over
`useSyncExternalStore`, exported from the same module:

```ts
export function useLocalPreference<T>(
  pref: Preference<T>,
): readonly [T, (next: T) => void]

export function useKeyedPreference<T>(
  pref: KeyedPreference<T>,
  ownerId: string,
): readonly [T, (next: T) => void]
```

`useLocalPreference` is the name two sibling plans already import — `03-S6`
(`03-reservations-and-transport.md`, wave 4) and `09-S8` (`09-account-and-settings.md`, wave 3) both
name it in their **Components** list — so it is fixed here and not renamed later.

**`area` is required and has no default.** That is the whole point of the signature. How long a
preference lives is a product decision, and a defaulted lifetime is a decision nobody took: pinning
the module to `sessionStorage` would have quietly thrown away the behaviour of three of its four
consumer stages and half of the fourth, two of them against a `gap-rows.json` row that asks in as
many words for the choice to be _persisted_. The template-literal type on `key` makes an unnamespaced key a compile error rather
than a review note.

**Every preference in this plan, its area and the reason.** No stage may add a sixth without adding
a row here.

| Preference                  | Stage   | Shape                                                      | Area      | Why that lifetime                                                                                                                                                   |
| --------------------------- | ------- | ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planned.trip-tab`          | `01-S3` | keyed by trip id, `limit` 24                               | `local`   | `TRP-07` asks for per-trip tab **persistence**. A reader who works a trip's costs on Monday and reopens it on Thursday is owed the costs tab, not the plan.         |
| `planned.dashboard-widgets` | `01-S5` | one record: which widgets are shown, the pinned zones      | `local`   | Hiding a widget and choosing time zones is configuration. Re-hiding the converter every morning is not a preference, it is a chore.                                 |
| `planned.trips-view`        | `01-S7` | one record: last chosen mode, archived fold open           | `local`   | `TRP-01` reads "grid/list view modes **persisted** client-side". Session lifetime would fail the row on its own wording.                                            |
| `planned.planner-layout`    | `01-S9` | keyed by trip id, `limit` 8: rail widths, detail minimised | `local`   | A rail dragged to the width a reader can work at is a workspace setting; making them drag it again tomorrow is the defect the handle was built to remove.           |
| `planned.planner-days`      | `01-S9` | keyed by trip id, `limit` 8: which days are unfolded       | `session` | The only one that is genuinely a sitting. Which days you have open is where you are in this piece of work, and a fold restored a week later hides days added since. |

**Two sibling stages consume this module from other plans, and the area field is what they need.**
`03-S6` stores a per-trip booking-group fold and a per-session type filter, and its own text says the first is `localStorage`
and the second `sessionStorage` — two lifetimes from one module, which is exactly the choice the
`area` field exists to express and which a module pinned to one storage object could not have served.
`09-S8` renders `01-S5`'s widget-visibility record as a settings surface and mints no second store;
it reads and writes the same declaration, which is why that declaration lives in a module and not
inside a component. Both sit behind the wave-1 stage that mints the module, and `09-S8`'s wave 3
sits behind the wave-2 stage that declares the record it renders. Any declaration a sibling plan adds states its area
in its own stage, under the same rule this table applies here.

**Why the two per-trip preferences are one bounded record and not one key per trip.** A key per trip
in `localStorage` grows without bound and nothing ever collects it: a workspace with four hundred
trips over three years leaves four hundred dead keys behind, which is the real reason a session area
looked attractive in the first place. Instead each keyed preference is a single key holding
`{ v: 1, entries: [[tripId, value], ...] }`, most-recently-touched first and truncated at `limit`, so
the store is self-pruning and its worst case is a few hundred bytes. `v` is a version stamp: a
payload that does not carry the current one is discarded whole rather than migrated, because a
preference is cheap to lose and expensive to guess at.

There is deliberately **no composed-key escape hatch**: `definePreference` takes a literal key and a
caller who wants per-trip state uses `defineKeyedPreference`, because the alternative is the
unbounded key set this paragraph just ruled out. `03-S6`'s `planned.book-groups.<tripId>` is that
same shape written the other way; it gets the behaviour it describes from the keyed factory under one
bounded key, and reconciling the spelling belongs in that plan's stage rather than in an edit made
here to a file this plan does not own.

**Failure and cross-tab behaviour.** Every read and every write is wrapped in `try`/`catch` for the
same reason `src/lib/theme.ts:52-59` wraps its own: storage access itself throws in Safari private
browsing, and a preference is never worth a white screen. A value that fails `parse` is treated as
absent. For the `local` area the module attaches one `window.addEventListener('storage')` listener so
a second tab's write reaches this tab's subscribers; because that event never fires in the tab that
wrote, `write()` notifies its own subscribers directly. The `session` area is per-tab by
construction, so no cross-tab event exists for it and no listener is attached.

**First paint, which is where a `local` preference can become a layout shift.** `read()` returns the
fallback when `typeof window === 'undefined'`, and both hooks pass a `getServerSnapshot` returning
the same fallback, so server HTML and the hydrating client agree byte for byte and React re-renders with
the stored value in the commit after. That gap is invisible for a preference that moves no box and
visible for one that does. The module therefore carries one rule in its docstring, and each consumer
states how it satisfies it: **a stored preference is never the sole source of a layout-affecting
first paint.**

- `01-S3` — the remembered tab is a redirect decision taken in `beforeLoad`, in the browser only. The
  strip never renders one tab and then another; a cold load lands on `plan` and says so above.
- `01-S5` — the reference column reserves a fixed height inside the route's existing pending
  component, so which widgets are folded changes nothing outside the column.
- `01-S7` — the mode is projected into the route's own `view` search parameter. The URL is the truth
  that the server and the browser both read; the preference only supplies the default for an in-app
  navigation.
- `01-S9` — the workspace paints behind its first-open splash and the rails take their stored width
  before it exits, and the rails are overlays above the map canvas, so a width is a repaint and never
  a document reflow.

**States.** No list, so no empty state, no skeleton and no error surface of its own — stated rather
than skipped, and the box below is ticked against the tab strip re-checked after the edit. The tab
`Link` keeps the hover, focus-visible and active states it already has; nothing here can be disabled
and nothing here loads.

**Motion.** Unchanged: the shared `layoutId` pill at 260 ms on the quintic easing already declared at
`trip-sub-nav.tsx:7`, already collapsed to `duration: 0` under `useReducedMotion()`.

**Tokens.** None missing, none filed.

### Quota

**No countable row.** This stage creates no row in any table; it writes one string into the visitor's
own browser. No metric is added to `resolveLimits()` and none to `PLAN_QUOTAS`, so
`src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path.

### Tenant isolation test

**None, and the reason is that there is nothing to isolate.** The stage adds no repository function
and touches no repository. `src/server/repos/__tests__/tenant-isolation.test.ts` is not listed under
**Owned paths** and is not edited.

The adjacent risk is worth naming once, because it is the one way a client-side memory can leak: the
record is keyed by trip id, and a trip id is not a secret but it is also not a capability — landing
on a remembered tab for a trip the session can no longer read produces the route's own
`notFoundComponent` (`src/routes/_app/trips/$tripId/route.tsx:21-25`) because the loader is still
tenant-scoped. The memory can never widen access; at worst it names a route that then refuses.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/lib/__tests__/local-preference.test.ts` — reading with no stored value returns the fallback; a
  stored value that fails the caller's guard returns the fallback rather than propagating; a payload
  whose `v` is not the current one is discarded whole rather than half-read; a `getItem` that throws
  returns the fallback and does not rethrow; a `setItem` that throws is swallowed; subscribers are
  notified on write and unsubscribed cleanly.
- `src/lib/__tests__/local-preference.test.ts`, the area cases, which are the ones that fail if
  somebody re-pins the module to one storage object — an `area: 'local'` preference writes to
  `localStorage` and to nothing else, and still reads back after `sessionStorage.clear()`; an
  `area: 'session'` preference writes to `sessionStorage` and leaves `localStorage` untouched; a
  `storage` event for the watched key updates a `local` subscriber and a `storage` event for another
  key does not; no listener is attached for a `session` preference. The jsdom environment supplies
  both storage objects and dispatchable `StorageEvent`s, so this is measured rather than asserted.
- `src/lib/__tests__/local-preference.test.ts`, the keyed cases — writing past `limit` drops the
  least-recently-touched entry and never the one just written; reading an id that was pruned returns
  the fallback; touching an existing id reorders without growing the record.
- `src/lib/__tests__/trip-tab.test.ts` — the declaration names area `local`, which is the assertion
  that fails if the lifetime is changed without changing this plan; an unknown tab id read back from
  storage resolves to `plan`, so a renamed tab cannot strand a user on a dead route; the seven ids
  match `TRIP_TABS` exactly, which is the assertion that fails if someone adds an eighth tab without
  revisiting this module.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S3'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` block asserts the behaviour end to end in two engine-independent tests. The
first is the memory itself — visit `/trips/<id>/costs`, navigate to `/trips`, click back into the
trip, and assert the URL is the costs tab. The second is the **lifetime**, which is the assertion a
session-scoped store would fail: open a second page in the same browser context and walk it into the
same trip, and the costs tab is still the one that opens. `sessionStorage` is per tab by
construction, so that second page is the cheapest measurement that tells the two areas apart from
outside the code. It then takes its frames of the strip in its non-default state, which is the point
of the stage and is not visible at rest:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<seeded-trip-id>/costs" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S3" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state tab-remembered
```

The selector the assertion uses is `nav[aria-label="Trip sections"] a[aria-current="page"]`, a role
plus an accessible name plus a published ARIA state rather than a class name, and it is verified with
a `count()` of 1 against the running server before the run. `auditServerClock` is called over this
stage's route table; `e2e/helpers/shoot.ts` is not claimed, because the sub-navigation prints no
clock-derived string at all.

The mobile engine matters more than usual here: the strip is horizontally scrollable and
`mobile-safari` is the only project with touch and momentum scrolling, so the 360px frames and the
`--project=mobile-safari` run are read rather than skimmed.

**Console.** `watchConsole` attached, `fatal` empty, tolerance list untouched. A hydration mismatch is
the specific failure this stage risks and React 19 surfaces it as both an uncaught error and a
`console.error`, so it is fatal before the tolerance list is consulted — which is exactly the guard
that proves the `typeof window` fallback above is right. **Layout shift** asserted after `settle()`,
gated on `supportedEntryTypes`.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

None. No package, no binding, no third-party service, and no dependency on a row in another plan.

## Stage 01-S4 — One sequence per day, in time-then-position order

### Stage id

`01-S4` · Wave 2 · effort **L**. The second half of the `TRP-08`/`TRP-09` cut, and the only stage in
this plan that touches all four planner core files.

### Reference rows

- `TRP-08` partial → **done**, for the host surface: places and notes in one sequence, one position
  space, one sort contract, and a declared extension point for a third item kind.
- `TRP-10` done → **done**. Not re-opened and not re-implemented. It is carried here because this
  stage edits the exact modules that closed it — `src/components/planner/ordering.ts`,
  `plan-dnd.ts` and the drag path in `plan-screen.tsx` — and a stage that widens a drag engine
  without naming the row it could break is how a closed row quietly re-opens.

Sourced from `wiki: Day-Plans-and-Notes` for the merged sequence and its time-or-position ordering.

**What is deliberately not here.** The row's name also mentions inline transports, per-type multi-day
phase labels and an active car rental promoted to the day header. Those three belong to `BKG-10`
(`03-reservations-and-transport.md`, wave 3), whose surviving edge in `gap-cuts.json` is
`BKG-10 → TRP-08` precisely because the timeline is the host and the transport rows are placed into
it. This stage ships the host and the seam; `BKG-10` ships the rows. Doing it the other way puts
`src/components/planner/ordering.ts` in two plans.

**Contradiction with the row, already established in the Area brief.** "No notes" is wrong at this
HEAD — notes render read-only beneath the stop list at
`src/components/planner/day-section.tsx:164-192`. What this stage changes is that they stop being a
separate list.

Rows unblocked: `BKG-10` (`03-…`, wave 3) directly; `TRP-06` (`01-S9`) reads the merged day.

### Owned paths

- `src/components/planner/ordering.ts` — edit. The item-id space, the move rules, the change variants.
- `src/components/planner/plan-dnd.ts` — edit. The drag adapter over the widened space.
- `src/components/planner/day-section.tsx` — edit. Renders one sequence instead of two lists.
- `src/components/planner/drag-preview.tsx` — edit. A note's drag preview.
- `src/components/planner/types.ts` — edit. `PlannerItem`, the discriminated union.
- `src/components/planner/index.ts` — edit. The new exports.
- `src/components/planner/__tests__/ordering.test.ts` — edit. Extended, never rewritten.
- `src/components/planner/__tests__/keyboard-drag.test.tsx` — edit. Same rule.
- `src/components/planner/__tests__/rails.test.tsx` — edit. Same rule.
- `src/components/planner/__tests__/timeline.test.ts` — new. The sort contract, on its own.
- `src/routes/_app/trips/$tripId/-server/__tests__/plan-reorder.test.ts` — new. The widened reorder
  handler, including the inherited mirror call. The route-local `__tests__` directory follows
  `src/routes/(auth)/-lib/__tests__` and `src/routes/api/tiles/-lib/__tests__`, which already exist.
- `src/server/repos/itinerary.ts` — edit. `reorderDayTimeline`. Shared with `07-S9`
  (`07-collaboration-and-sharing.md`, wave 3), which reads the same module a wave later for its
  upcoming-assignments query; different waves, so the two never run together, and this stage adds a
  function rather than reshaping one `07-S9` will read.
- `src/routes/_app/trips/$tripId/-server/plan.ts` — edit. `reorderPlanFn` widens, and
  `loadPlanBoard`'s superseded three-field `notes` projection (`:140-146`, populated at `:220-224`) is
  **deleted**: since `01-S2` the notes are read from `-server/day-notes.ts` and nothing consumes it.
  Inherited from `07-S1` (`07-…`, wave 1), whose room-mirror calls are in this file — see the
  obligation below.
- `src/routes/_app/trips/$tripId/-ui/plan-model.ts` — edit. Builds the merged sequence from the board
  and from `PlanNotesPayload`.
- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` — edit. The drag path and the refusal message.
- `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` — edit. A note's row menu, beside the stop's.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S4` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S4'` so no other block is re-recorded.

All four planner core files are named here, and **this is the only wave-2 stage in any plan that names
any of them**, which is the schedule the Area brief fixes.

**The eleven shared paths this stage claims, and every stage of every plan that touches one in
another wave.** Measured with `scripts/ultrabuild/check-plan-collisions.mjs`; the run and its output
are at the foot of this file. Nothing below sits in wave 2.

| Path                                                | Other claims, with wave                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/components/planner/ordering.ts`                | `03-S5` (`03-…`, wave 4)                                                                         |
| `src/components/planner/plan-dnd.ts`                | `03-S5` (wave 4)                                                                                 |
| `src/components/planner/__tests__/ordering.test.ts` | `03-S5` (wave 4)                                                                                 |
| `src/components/planner/day-section.tsx`            | `01-S2` (wave 1), `02-S4` (`02-…`, wave 3), `03-S5` (wave 4), `02-S9` (wave 5), `03-S8` (wave 6) |
| `src/components/planner/types.ts`                   | `01-S2` (wave 1), `03-S5` (wave 4), `03-S8` (wave 6)                                             |
| `src/components/planner/index.ts`                   | `01-S2` (wave 1), `03-S5` (wave 4)                                                               |
| `-ui/plan-model.ts`                                 | `01-S2` (wave 1), `02-S7` (wave 4), `02-S9` (wave 5), `03-S8` (wave 6)                           |
| `-ui/plan-screen.tsx`                               | `01-S2` (wave 1), `02-S4` (wave 3), `03-S5` (wave 4), `01-S9` (wave 5)                           |
| `-ui/plan-actions.tsx`                              | `02-S5` (wave 3), `02-S10` (wave 5), `02-S11` (wave 6)                                           |
| `-server/plan.ts`                                   | `07-S1` (`07-…`, wave 1), `02-S7` (wave 4), `02-S9` (wave 5), `03-S8` (wave 6)                   |
| `src/server/repos/itinerary.ts`                     | `07-S9` (wave 3), `02-S9` (wave 5)                                                               |

`src/server/repos/days.ts` is **not** here. `reorderDayTimeline` lives in `itinerary.ts` and reaches
the note rows through the `dayNotesRepository` that `days.ts` already exports (`:26`), so the note
module is unchanged and the two-table write still has exactly one home.
`src/routes/_app/trips/$tripId/-server/day-notes.ts` is **not** here either: this stage reads its
payload and calls no function it owns, and the note's four writes keep working unchanged through the
merge.

**The inheritance obligation, because this file passed through another plan first.** `07-S1` edited
`-server/plan.ts` in wave 1 to add a `mirrorToRoom` call after each of its eight writers. This stage
widens `reorderPlanFn`'s input from `assignmentIds` to `items: Array<{ kind, id }>` and dispatches to
`reorderDayTimeline` — a change to the body of a function that now ends in one of those calls. **The
mirror call survives the widening**, and mirrors one `day` upsert per touched day exactly as it did
before, now carrying the merged order. Verification carries the case: a reorder still publishes to the
room, asserted against the mirror rather than inferred from the D1 write.

### Data and migration

**No schema change and no migration.** Both position columns exist and both are `real`:
`day_assignments.order_index` (`src/server/db/schema.ts:544`, `NOT NULL DEFAULT 0`) and
`day_notes.sort_order` (`:596`, through the shared `sortOrder()` helper). This stage is wave 2, so
its schema stage would be the wave-1 one; nothing is filed for it on this stage's account.

**One number line, two columns, stated once.** The merged position space is not a new column; it is
the agreement that for a given day, `day_assignments.order_index` and `day_notes.sort_order` are read
and written as one sequence of positions `0..n-1`. The server derives every position from array
index on each write, so the two columns cannot drift apart and no fractional value survives a move —
the same self-healing contract `reorderPlanFn` already documents at `-server/plan.ts:261-267` and the
one `01-S2` deliberately gave `reorderDayNotes` so that the two could be merged without reconciling
two philosophies.

A rollback is safe by construction: the previous Worker reads `order_index` for stops and
`sort_order` for notes and renders them as two lists, exactly as it does today, because this stage
writes no value either column could not already hold.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/itinerary.ts`.**

`reorderDayTimeline(scope, input)` where `input` is
`{ tripId, dayId, items: ReadonlyArray<{ kind: 'stop' | 'note'; id: string }>, clearTime?: ReadonlyArray<{ kind; id }> }`.
It resolves the trip with `requireTrip`, the role with `assertTripRole(scope, tripId, ['owner', 'editor'])`
(decision 6) and the day with `requireTripDay` (`src/server/repos/days.ts:104-115`, which
already rejects a day belonging to another trip), reads the day's current stop ids and note ids,
**drops** any incoming id that is not in either set rather than rejecting the whole call — a stale tab
one delete behind should still be able to reorder the rows that do exist, which is the rule
`-server/plan.ts:269-272` already states — appends any known id the client omitted at its current
relative position so a partial list cannot silently delete an item's position, and then writes
positions `0..n-1` into the two tables — and `time = NULL` (`assignment_time` for a stop,
`day_notes.time` for a note) for every id in `clearTime`, which must also be in `items` — through
**one `runBatch(scope, statements)` call** (`src/server/repos/batch.ts:35`), so decision 8's
"drop the time and move" is one transaction.

`runBatch` is the repository layer's only batching helper, and it is the reason this stage does not
write `scope.db.batch(...)`: `TenantScope['db']` is the abstract Drizzle handle and carries no
`batch` method, so that call would not typecheck. `runBatch` feature-detects the driver, uses
`db.batch()` where it exists and awaits the statements in order where it does not — which is what
lets the same code run under the in-memory test driver. It is already the call inside
`reorderAssignments` (`src/server/repos/itinerary.ts:343`), the very function this stage widens, so
the widening keeps a call it inherits rather than introducing one.

On D1 that batch is a real transaction: statements run sequentially and a failure rolls the whole
sequence back. That is the property the merged space needs, because a half-applied reorder is a day
whose two columns disagree about one number line. The batch is bounded by one day — one `UPDATE` per
item, three bound parameters each — so it stays inside D1's 100-parameter-per-statement ceiling and
inside the 30 s a whole batch call may take, which is why this write stays in the request path while
`01-S1`'s copy does not. **Multi-row writes** in the Area brief states both limits once.

SQL stays in this module. Both halves of the write are `organization_id`-scoped and neither can be
made otherwise: the assignment rows go through `dayAssignmentsRepository` and the note rows through the
`dayNotesRepository` that `days.ts` exports, both built by `createTenantRepository`, whose every
statement starts from `tenantFilter()` — `eq(table.organizationId, scope.ctx.organizationId)` — with
callers able only to `AND` predicates onto it. Both tables carry `organization_id NOT NULL` and both
lead a composite index with it (`day_assignments_org_trip_idx`, `day_notes_org_trip_idx`), so the
two-table batch is bounded by the tenant on both sides.

**Server function — `src/routes/_app/trips/$tripId/-server/plan.ts`.** `reorderPlanFn` is widened
rather than duplicated. Its `days` array entries carry `items: Array<{ kind, id }>` in place of
`assignmentIds`, and the handler dispatches per day to `reorderDayTimeline`. The `mirrorToRoom` call
`07-S1` added at the end of that handler in wave 1 stays exactly where it is and now carries the
merged order. `schedulePlaceFn`, `unschedulePlaceFn` and `rankIdeasFn` are untouched: an idea has no
position among notes, and the ideas column is still a list of places only.

**The one deletion in this module.** `loadPlanBoard`'s `PlanBoardDay.notes` projection goes. Since
`01-S2` the planner's notes arrive from `-server/day-notes.ts` with their icon, their detail and their
position, and `plan-model.ts` merges from there; the board's three-field copy has had no reader since
wave 1 and keeping two projections of one record is how they start to disagree. `PlanBoardDay` loses
one field and gains nothing — a narrowing of a payload type, so the compiler names every reader, and
`pnpm typecheck` is the proof that none is left.

**Zod v4.** `z.strictObject()` with the `error` parameter; the item is
`z.strictObject({ kind: z.enum(['stop', 'note']), id })` reusing the module's existing `id` schema
(`:69`), and `clearTime` is an optional array of the same item shape whose every entry must also
appear in `items` — refined, not assumed; the per-day array is capped, as the existing validator already caps its own, so one request
cannot ask for an unbounded batch.

**Authorisation.** Decided in the repository: `writableTrip` (`:97-106`) refuses an archived trip,
`requireTrip` refuses a trip outside the caller's tenant or outside the caller's sight (decision 1),
`assertTripRole` refuses a `viewer` (decision 6), and `requireTripDay` refuses a day outside the trip. A well-formed `dayId` from the browser is not an
authorised `dayId`.

Nothing enqueued and no Durable Object patch. `src/server/do/protocol.ts` already declares a `day`
and a `stop` entity kind, and this stage adds none: the planner's writes have never published a patch
and the trip room stays an invalidation signal, which is what `repo-platform.md` records and what
`use-trip-room.ts` consumes.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path.

**The id space.** `ordering.ts` already keeps two id spaces apart with a prefix — `IDEA_PREFIX` at
`:29`, `ideaItemId`, `isIdeaItemId`, `placeIdOfIdeaItem` at `:38-51`. This stage adds the third by the
same mechanism and no other: `noteItemId(noteId)`, `isNoteItemId(itemId)`, `noteIdOfNoteItem(itemId)`
behind a `note:` prefix. A stop keeps being identified by its bare assignment id, so nothing that
already works has to be re-keyed. `containerOf`, `indexOf`, `itemsIn` and `removePlanItem` are
unchanged; `movePlanItem` gains the two rules below and nothing else.

**The two new move rules.**

1. **A note cannot leave the days.** Dropping a note into the ideas container is refused. The ideas
   column is the trip's unscheduled place inventory and a note has no meaning outside a day, so the
   refusal is a product statement, not a limitation. It reuses the existing `'unknown'` refusal path's
   shape and gets its own reason, `'not-in-ideas'`.
2. **A timed row is moved by its time, and the reader is asked before that changes (decision 8).**
   `PlanMoveRefusal` gains `'timed'`, but for this one reason the refusal is a **question**, not an
   end: dropping an item that carries a time into a position that contradicts that time — before an
   item with an earlier time, or after one with a later time — opens a `Dialog` reading "Move Café
   Sacher and drop its 14:30?". Confirming issues **one** `reorderPlanFn` call whose entry carries the
   item in `clearTime` as well as in `items`, so the time is cleared and the order written in one
   batch and there is never a moment in which the row has a time and the wrong position; declining
   leaves the board untouched. This is the reference's behaviour and it finishes the reader's gesture
   instead of sending them to the editor to remove the time by hand. The invariant survives — a time
   is authoritative for as long as the item has one.

**The sort contract, stated as a pure function.** For one day: read the items in ascending position.
Walk them once, carrying the last time seen; an item without a time inherits the carried time, and
items before the first timed item inherit nothing and sort first. Then stable-sort by inherited time,
with position as the tiebreak. The result is that timed items appear in clock order, untimed items
stay attached to the timed item they follow, and a day with no times at all is exactly the
position order it already has today. It lives in `src/components/planner/ordering.ts` as
`mergeDayTimeline(items)`, is pure, takes ids and times and nothing else, and has its own test file.

**Components.** `PlannerItem` in `types.ts` is a discriminated union of
`{ kind: 'stop'; row: PlannerRow }` and `{ kind: 'note'; note: PlannerNote }`, and `PlannerDay` gains
`items` beside the `rows` it already has. `rows` is kept deliberately: `routeDaysOf`
(`plan-model.ts:298-311`) draws the map's per-day route line from stop coordinates and must not learn
about notes, and `mapPlacesOf` has the same property. `DaySection` renders one `SortableContext` over
`items`; `StopRow` and the `NoteRow` `01-S2` created are the two renderers, and neither is rewritten.
`plan-actions.tsx` gains `NoteMenu` alongside its existing `StopMenu`, built on the same shipped
`DropdownMenu`. No new primitive from `src/components/ui` is required and none is proposed, and the
note's detail keeps rendering through `src/lib/markdown` exactly as `01-S2` wired it — this stage
imports that module and does not re-implement, extend or fork it.

**The extension point `BKG-10` fills.** `PlannerItem` is a union and `mergeDayTimeline` reads only
`{ id, position, time }`, so a third kind is one variant in the union, one prefix in the id space and
one renderer — and no change to the merge, the drag adapter or the repository's two-table batch beyond
its own table. This is stated so `BKG-10` does not open `ordering.ts` and find a design that assumed
two.

**States.**

- _Empty._ A day with no stops and no notes keeps its dashed drop target
  (`day-section.tsx:139-149`) and gains the add-note affordance beneath it, both on
  `--color-surface-2`. A day with notes but no stops is no longer an empty day — the change is that
  the drop target only appears when the whole sequence is empty, which is the bug the two-list layout
  has today.
- _Skeleton._ The rail is loader-rendered; the day section's existing skeleton covers a cold load. An
  item with a write in flight keeps the `pendingItemIds` treatment `DaySection` already takes
  (`:20`, `:158`), which now covers notes as well as stops.
- _Error._ A refused move never mutates the board and states its reason inline in a toast:
  a duplicate place, a note dragged to the ideas column. A timed row dragged out of clock order is
  not an error but a question — the `Dialog` above — and declining it is the same no-op as a refusal. A
  **failed** write rolls the optimistic `PlanOrder` back to the previous arrangement, which is the
  contract `plan-screen.tsx` already implements and this stage must not weaken.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the row, its drag
  handle and its menu.

**Keyboard.** The merged list is keyboard-draggable, not mouse-only. `src/lib/dnd-keyboard.ts`
already supplies the sensor behaviour and `__tests__/keyboard-drag.test.tsx` already holds it for
stops; this stage extends both to notes and adds the refusal announcements to the same live region,
so a keyboard user hears why a move was refused rather than watching nothing happen. The
"drop its time?" dialog opens on a keyboard drop exactly as on a pointer drop, with focus on its
confirm button and `Escape` declining.

**Motion.** Reordering animates transform only, 220 ms on `--ease-out-quint`, with the drag overlay
already provided by `DragPreview`. Reduced motion collapses to no movement, which `@dnd-kit` respects
through the existing configuration.

**Tokens.** None missing, none filed. Times carry `tabular-nums`.

### Quota

**No countable row.** Every write in this stage updates a position on a row that already exists and
already counted: `day_assignments` rows are created by `schedulePlaceFn` and bounded through the
`places` metric asserted in `src/server/repos/places.ts:269`, and `day_notes` rows are created by
`01-S2`, which recorded why no note metric exists. No metric is added to `resolveLimits()` and none to
`PLAN_QUOTAS`; `src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path.

### Tenant isolation test

One new `describe('day timeline ordering')` block appended to
`src/server/repos/__tests__/tenant-isolation.test.ts`, on the existing `alpha`/`beta` fixtures.

In A's scope: `reorderDayTimeline` against B's `dayId` raises `NotFoundError`;
`reorderDayTimeline` against A's own day with A's own `tripId` but B's `dayId` raises `NotFoundError`,
which is `requireTripDay`'s job and must not be assumed; `reorderDayTimeline` on A's own day carrying
one of B's assignment ids and one of B's note ids writes neither — B's `order_index` and `sort_order`
values are byte-identical afterwards and A's own day renumbers to `0..n-1` over its own items only.
Finally, the whole call is rolled back on failure: a batch containing an unknown table id leaves A's
own positions unchanged rather than half-written.

Functions covered: `reorderDayTimeline`.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/planner/__tests__/timeline.test.ts` — new, and it is the stage's centre of gravity.
  `mergeDayTimeline` with no times returns position order unchanged; with all times returns clock
  order; an untimed item follows the timed item above it and never jumps to the top; items before the
  first timed item sort first; the function is stable, so two items with the same inherited time keep
  their relative positions; and it is idempotent, so merging a merged list is a fixed point.
- `src/components/planner/__tests__/ordering.test.ts` — extended, not rewritten. Every existing case
  is kept and must still pass — that is the `TRP-10` no-regression obligation, stated as a mechanical
  one. New cases: a note moves within a day; a note refused into the ideas column returns
  `'not-in-ideas'` and the unchanged order; a timed row into a contradicting position returns
  `'timed'` and the unchanged order — the screen turns that into the question, the engine never
  moves it on its own; a place dropped onto a day that already holds it still returns `'duplicate'`.
- `src/components/planner/__tests__/keyboard-drag.test.tsx` — extended. A note is pickable, movable and
  droppable by keyboard, and a refusal is announced.
- `src/components/planner/__tests__/rails.test.tsx` — extended. A day renders one list, notes and stops
  interleave in the merged order, and the empty-day drop target appears only when the whole sequence
  is empty.
- `src/routes/_app/trips/$tripId/-server/__tests__/plan-reorder.test.ts` — new, and it exists for the
  inheritance obligation above. Driven the way `src/server/fns/__tests__/atlas.test.ts` drives a
  server function: an `AsyncLocalStorage` installed under the framework's global symbol before the
  module is imported dynamically, `#/routes/_app/-server/context` mocked for the scope, and
  `#/server/fns/context` mocked so `mirrorToRoom` is a spy. Four cases: a merged reorder writes the
  merged order through `reorderDayTimeline`; a reorder carrying `clearTime` nulls the time and writes
  the order in one batch, and an entry in `clearTime` that is not in `items` is refused by the
  validator; **the same call still mirrors one `day` upsert per
  touched day**, which is the `07-S1` behaviour this stage must not drop; and a mirror that rejects
  does not fail the save, because D1 is the record and the room is a signal.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S4'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` declares `/trips/$tripId/plan` with `map: true` and calls `auditServerClock`
over its own table.

Frames: the planner resting at 360, 1280 and 2560 in both themes, plus a declared mid-drag set, since
a drag is the state the stage exists to change and a resting rail is not evidence about it:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<seeded-trip-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S4" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
  --state merged-day --settle 800
```

and a second run at `--state note-hover --hover '[data-part="note-row"]'`. Both selectors are stable
published attributes and each is verified with a `page.locator(sel).count()` against the running
server before the capture runs; a selector that resolves to nothing makes `capture.mjs` throw at
`--hover`, and discovering that during capture costs a round. `--map` is required on this route and
re-waits the two-sided `[data-map-ready]` predicate after every resize and theme change.

`e2e/helpers/shoot.ts` is not claimed: a note's time and a stop's time are stored `HH:MM` strings, not
clock-derived, so `RELATIVE_TIME_SITES` needs no entry and the existing three are untouched. This
matters because `01-S5` lands in the same wave and does claim that file; only one wave-2 stage may.

**Console.** `watchConsole` attached, `fatal` empty in every test including the frame-only ones,
tolerance list untouched. **Layout shift** asserted after `settle()`, gated on `supportedEntryTypes`,
and it is the assertion that catches a merged list which reflows once the times resolve.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

One item is added to this stage's definition of done and is not negotiable: **every test that passed
in `ordering.test.ts`, `keyboard-drag.test.tsx` and `rails.test.tsx` before the stage still passes
after it**, unchanged rather than adjusted. That is what carrying `TRP-10` means.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

None. `@dnd-kit/core`, `@dnd-kit/sortable` and `@dnd-kit/utilities` are all in the pinned set and all
already in use; no package, no binding, no third-party service. The one dependency on another plan is
in the opposite direction — `BKG-10` waits on this stage, not the reverse — and `01-S2` must have
closed, which wave 1 guarantees.

## Stage 01-S5 — The dashboard's reference column, and the clock in it

### Stage id

`01-S5` · Wave 2 · effort **M**. The stage that adds the dashboard's second column and the one
widget in it that can be built today.

### Reference rows

- `TRP-05` absent → **partial**, deliberately and with the residue named below.

Sourced from `wiki: My-Trips-Dashboard` for the fixed reference column on wide screens, the
per-widget visibility control, and the bottom sheet the same widgets open in on a narrow one.

**What this stage closes:** the reference column itself, its per-widget show/hide, the mobile bottom
sheet, and the multi-time-zone clock.

**What is deferred, why, and to where.** The currency converter is **not** built here. It needs a
foreign-exchange rate source, and there is none: `00-foundations.md` records that no rate source
exists in the dependency set or in `src/`, and `11-boundaries-and-blockers.md`'s stage `11-S3` lists
`TRP-05` by name among the fifteen rows waiting on a provider decision, alongside `MNY-06`, `MNY-07`
and `COL-10`. `11-S3` also states the rule this stage obeys rather than works around: **the plan that
needs a provider stops at the decision** — it does not name a provider, does not assume a free tier,
does not write a client for an unnamed service, and does not ship a feature degraded into
uselessness to avoid asking.

- **Deferred to:** a stage this file mints when the decision lands, taking the next free id after
  `01-S10`, **target wave 6**. The id is deliberately not written down before the stage that carries
  it exists: a cited `NN-Sn` token that no `## Stage` heading defines is a dangling reference, and
  `scripts/ultrabuild/check-plan-refs.mjs` fails the plan on one.
- **Why it is not minted as a stage block now:** its shape is decided by terms nobody has read yet.
  What a provider licenses us to cache, for how long, and what attribution it requires on screen are
  the three things that decide the widget's data path and its layout, and all three are unknown. A
  stage block written before them would be a guess wearing the format of a plan.
- **What unblocks it:** the provider decision recorded in `11-S3`. The stage is minted in this file
  on the day that decision lands, takes the next free id, and moves `TRP-05` partial → done.

A free tier is not evidence a capability is free to us: this product charges for subscriptions
through Stripe, so a "free for non-commercial use" tier is unavailable at any traffic level. That is
`11-S3`'s constraint and it is repeated here because it is the specific trap this row invites.

Rows unblocked: none.

### Owned paths

- `src/routes/_app/dashboard.tsx` — edit. Mounts the column and the sheet; the existing hero, stat
  row, trip mix, bookings and storage meter are untouched. Shared across waves with `14-S1`
  (`14-dashboard-mascot.md`, wave 3) and `01-S7` (wave 5); no other wave-2 stage names it.
- `src/routes/_app/-ui/dashboard-widgets.tsx` — new. The column, the sheet, the visibility control.
- `src/routes/_app/-ui/timezone-clock.tsx` — new. The clock widget.
- `src/lib/clock-zones.ts` — new. Pure: zone validation, the label, the offset line, the ordering,
  and the reference column's one preference declaration — `planned.dashboard-widgets`, area `local`,
  holding both which widgets are shown and which zones are pinned, since the zones are half of that
  record.
- `src/lib/__tests__/clock-zones.test.ts` — new.
- `e2e/helpers/shoot.ts` — edit, and this stage is the **only** wave-2 stage that claims it; `01-S4`
  states in its own Verification block that it does not. One entry is added to
  `RELATIVE_TIME_SITES`; nothing else in the module changes. One sibling plan claims the same file in
  a different wave and for the same one-entry reason: `10-S2` (`10-administration.md`, wave 1), for
  the audit trail's relative timestamps. Wave 1 closes before wave 2 opens, `10-S2` names this stage
  in return, and neither stage touches the other's entry.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S5` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S5'` so no other block is re-recorded.

### Data and migration

**No schema change and no migration, and the decision is argued rather than assumed.**

The per-widget visibility is a per-browser preference, stored through the
`src/lib/local-preference.ts` module `01-S3` minted, as one `definePreference` declaration under
`planned.dashboard-widgets` with **`area: 'local'`** — the lifetime is written into the declaration
and is covered by this stage's own unit test, because a widget the reader turned off yesterday that
is back this morning is not a preference at all. It is not a column. `user_settings` (`src/server/db/schema.ts:1827-1856`) carries theme, locale, timezone,
currency, week start, date format, distance unit, map style, accent colour, reduce-motion and an
onboarding stamp — every one of them a setting that must follow the account to a second device.
Whether a reference column is folded on this laptop is not in that class, and adding a column plus a
write path plus a resolver for it would put a D1 write on a checkbox.

The trade-off, stated rather than hidden: the fold does not follow the user to another device — it
survives the browser being closed, which is the lifetime that matters here, but a second laptop
starts from the default set. This is the same call `01-S3` made for the remembered tab, `01-S7` makes
for the view mode and `01-S9` makes for the rail widths; all four go through the same module with an
explicit area, and if a later stage decides the preference should be an account setting there is one
place to change.

The chosen time zones live in the same record and therefore share its `local` area, as IANA zone
identifiers validated against the runtime's own zone list on the way in and on the way out. One
sibling stage reads this record rather than minting its own: `09-S8` (`09-account-and-settings.md`,
wave 3) renders the visibility list as a settings surface, a wave after this stage declares it, and
its own text says it "mints no second one". That is the second reason the declaration lives in a
module instead of inside the component that draws the column. `user_settings.timezone` already exists and this stage reads nothing from
it — see the next heading for why.

### Server (repo, server function, Zod)

**None.** No repository function, no server function, no Zod schema, no SQL, no authorisation
decision, and `loadDashboard` (`src/routes/_app/-server/overview.ts:181`) is not touched.

That is a design decision and not an omission. A clock renders from the browser's own `Date` and
`Intl`; a zone list comes from `Intl.supportedValuesOf('timeZone')`, which the runtime supplies with
no network call and no dependency; and the fold state is a browser preference. Adding a server round
trip would buy nothing and would put the dashboard's loader in this stage's ownership, where two other
stages in this plan also want it.

The one server-side fact worth recording so a later stage does not trip on it: the app's day is
pinned in development through `x-pt-server-today`, read inside an `if (import.meta.env.DEV)` branch at
`src/server/clock.ts:73-90`. That pin governs the **server's** notion of today. The clock widget is a
client clock and is not pinned by it, which is exactly why it needs the `RELATIVE_TIME_SITES` entry
under **Verification** rather than a server fixture.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path. `/dashboard` ships and is edited in place — this stage does not recreate it, and the
existing sections keep their current composition and their pending skeleton
(`dashboard.tsx:520-537`).

**Layout.** Above `xl` the dashboard becomes a two-column grid: the existing content column and a
reference column of fixed width that sticks below the app nav. Between `md` and `xl` the column
becomes a single row of widgets under the hero, because a 900px-wide screen has room for the widgets
but not for a permanent second column. Below `md` the widgets are not on the page at all: a compact
control in the header opens them in a `Sheet` — the shipped primitive, `vaul`-backed, which already
gives a bottom sheet its drag-to-dismiss, its focus trap and its `Escape`.

**The visibility control** is a `DropdownMenu` of `Checkbox` items, one per widget, in the dashboard's
header. Turning every widget off collapses the column entirely and the grid returns to one column, so
the reader is never left with a strip of empty rail — the failure mode a naive `display: none` per
widget produces.

**The clock widget.** A `Card` with a `SectionLabel` header, then one row per chosen zone: the city
label, the local time in the display face at `tabular-nums`, and the offset from the reader's own zone
as a signed hour figure, also `tabular-nums`. Zones are added from a `Combobox` over
`Intl.supportedValuesOf('timeZone')` filtered as the reader types, and removed with an `IconButton`
per row. The default set on first open is the reader's own zone plus the destination zone of the
nearest upcoming trip when the payload has one, so the widget is useful before it is configured.

The clock ticks on a one-minute interval aligned to the next minute boundary rather than a
one-second timer: seconds are not shown, so a per-second render is a wasted frame every second for
the life of the page. The interval is cleared on unmount and on `document.visibilitychange` to hidden.

**Components reused, not rebuilt.** `Card`, `SectionLabel`, `Sheet` and its parts, `DropdownMenu`,
`Checkbox`, `Combobox`, `IconButton`, `Button`, `EmptyState`, `Skeleton`, `Alert`, `Separator` — all
from `src/components/ui`. No new primitive is required and none is proposed.

**States.**

- _Empty._ Two of them, both designed. Every widget hidden: the column disappears and the control's
  menu is the only trace, which is the correct empty state for a fold. The clock with no zones: an
  `EmptyState` on `--color-surface-2` reading that no zones are pinned yet, with the add control as
  its action.
- _Skeleton._ The column renders inside the route's existing pending component, so a cold load shows
  a `Skeleton` block of the column's exact height — that height is fixed, which is what keeps the
  layout-shift assertion below honest.
- _Error._ The clock's own failure mode is a zone identifier the runtime rejects, which happens when a
  stored preference outlives a runtime update. The row renders an `Alert` on `--color-surface-2`
  naming the zone and offering to remove it, rather than throwing inside a formatter and taking the
  dashboard with it.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the visibility items,
  the zone combobox, the per-row remove and the sheet trigger.

**Motion.** The column folds with an opacity and 4px transform over 220 ms on `--ease-out-quint`; the
sheet uses the primitive's `--ease-drawer`. No layout property is animated. Reduced motion collapses
both to opacity.

**Tokens.** None missing, none filed for a wave-2 token stage. Every figure the widget prints —
time, offset — carries `tabular-nums`, which is what stops a clock from jittering its own row once a
minute.

### Quota

**No countable row.** This stage writes nothing to D1 at all: no insert, no update, no delete. No
metric is added to `resolveLimits()` and none to `PLAN_QUOTAS`, so
`src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path. The deferred
converter will not create a row either — a conversion is a read of a cached rate — but its cache and
its provider terms belong to the deferred rate stage above, not to this one to pre-empt.

### Tenant isolation test

**None, and the reason is that the stage adds no repository function.**
`src/server/repos/__tests__/tenant-isolation.test.ts` is not listed under **Owned paths** and is not
edited.

The adjacent risk, named once: a browser preference must never become an authorisation input. The
zone list is validated against the runtime's own zone set before it reaches `Intl`, and nothing the
reader stores locally is sent to a server function or used as a query key. The dashboard's data still
arrives entirely through `loadDashboard`, which is tenant-scoped and untouched.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/lib/__tests__/clock-zones.test.ts` — the preference declaration names
`area: 'local'`, which is the case that fails if a later edit gives the column a session lifetime and
makes a reader re-hide the same widget every morning; an unknown zone identifier is rejected
rather than passed to `Intl`; the offset line is signed and correct across a zone with a
half-hour offset, which is where a naive integer-hours implementation fails; the label is derived from
the identifier without hard-coding a city list; zones sort by offset then label, so the column reads
top-to-bottom as the day moves; and the tick alignment computes the delay to the next minute boundary
rather than a fixed 60000, which is what stops the clock drifting a second per hour.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S5'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` declares `/dashboard` and calls `auditServerClock` over its own route table.

**The `RELATIVE_TIME_SITES` entry, which is the whole reason this stage claims a shared helper.** The
clock prints a live, client-derived time string. `12-verification-protocol.md` §4 measures that
`countRelativeTime()` sums locators built from `RELATIVE_TIME_SITES` (`e2e/helpers/shoot.ts:573`),
which holds three hand-written entries — the trip-card countdown, the dashboard hero's start stat and
the journey backlog reason — and that a new shape of clock-derived string on a route declaring nothing
counts as zero and passes vacuously. Without an entry, `pinRelativeTime()` writes nothing on this
widget, the mask covers nothing, the live time is inside the comparison at full size, and the baseline
fails on the next minute rather than on the next regression. This stage therefore adds one entry with
the same fields the existing three carry — `source`, `within`, `region`, and the drift and pinning
flags — and asserts in its own `describe` that the region is non-empty on `/dashboard`, so a future
restyle that breaks the selector fails loudly instead of silently un-masking.

Frames: `/dashboard` at 360, 1280 and 2560 in both themes for the resting screen, plus a declared
non-resting set for the sheet, which is the only way the widgets are reachable at 360:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/dashboard" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S5" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state widgets-sheet --click '[data-part="dashboard-widgets-trigger"]'
```

The selector is a stable published attribute and is verified with a `page.locator(sel).count()` of 1
against the running server before the capture runs. The 2560 frame is read for the specific defect a
sticky second column produces at that width — a column that stretches instead of sitting at its own
measure.

**Console.** `watchConsole` attached, `fatal` empty in every test, `TOLERATED_CONSOLE_WARNINGS`
untouched. **Layout shift** asserted after `settle()`, gated on `supportedEntryTypes`; the fixed
column height in the skeleton is what this assertion exists to hold.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One, and it is the reason this row moves to partial rather than done.**

- **Capability:** a foreign-exchange rate source for the currency converter widget.
- **It is not a package.** No dependency outside the `docs/SPEC.md` §3 pinned set would supply it, so
  nothing is installed and neither `package.json` nor `pnpm-lock.yaml` is edited. It is a
  **third-party service whose commercial terms have not been read**, which is the third kind of
  blocker `TEMPLATE.md` names.
- **Disposition: defer**, and the disposition is already recorded — `11-S3` in
  `11-boundaries-and-blockers.md` lists `TRP-05` among the rows waiting on it, together with the two
  terms that decide the cost more than the per-call price does: what may be cached and for how long,
  and what attribution is owed on screen.
- **Target:** the next free id in this file, wave 6, minted here when the decision lands and not
  cited before then.
- **What this stage does about it:** nothing. It ships the column, the fold and the clock, and the
  converter is absent rather than stubbed. A disabled control promising a feature that has no provider
  is worse than no control, and `11-S3` forbids shipping one degraded into uselessness to avoid asking.

No binding is added to `wrangler.jsonc` and no other plan's row gates this stage.

## Stage 01-S6 — Who is on this trip, including the people without accounts

### Stage id

`01-S6` · Wave 4 · effort **L**. The membership record and the surface that manages it, and the one
stage in this plan that adds a route file.

### Reference rows

- `TRP-11` absent → **done**.

Sourced from `wiki: Trip-Members-and-Sharing` for the two lists — people with accounts and people
without — the owner marking, the self-removal affordance, and the rule that a guest is an assignable
participant who can never sign in.

**Why this row is early relative to its in-degree, said accurately.** `README.md` measures `TRP-11`'s
transitive in-degree at 8 and its direct in-degree at 5, which is fourth and second respectively —
respectable, not leading, and `COL-01` and `ACC-05` lead on both readings. `TRP-11` is nonetheless
worth reading first inside this plan because membership is what three later surfaces here read: the
initial-members picker in `01-S8`, the participant vocabulary the planner shows in `01-S9`, and the
travel-companion figure on the card in `01-S7`. That is a reading priority, not an in-degree claim.

**Two upstream behaviours we deliberately do not port, both single-tenant assumptions.**

1. **The invite picker does not enumerate every account.** Upstream it lists every registered user on
   the deployment. Here one deployment serves every tenant, so that list would be a cross-tenant data
   leak — the exact thing `docs/SPEC.md` §5 exists to prevent. Our picker searches **the caller's own
   workspace** through `listMemberProfiles` (`src/server/repos/members.ts:118`), which is
   tenant-scoped, and a person outside the workspace is invited to the workspace first through
   `ADM-02` (`10-administration.md`, wave 3, and `TRP-11`'s own `dependsOn`).
2. **There is no instance administrator who bypasses per-trip permission.** The workspace `owner` and
   `admin` roles govern the workspace; a trip's roles govern the trip, and `01-S1`'s `assertTripRole`
   is the only bypass-free path to a trip write.

Rows unblocked: `TRP-02` (`01-S8`) and `TRP-06` (`01-S9`) directly.

### Owned paths

- `src/server/repos/trip-guests.ts` — new. The guest record, the participant read model, the
  guest-into-member merge and its relinker registry (decision 7b).
- `src/server/repos/index.ts` — edit. Two export lines; no other repository module is touched. Three
  sibling stages touch the same barrel in three other waves and none in wave 4: `06-S3`
  (`06-documents-and-media.md`, wave 2) and `06-S5` (wave 3), both as `append`, which is the
  cooperative disposition and not a collision at all, and `07-S10`
  (`07-collaboration-and-sharing.md`, wave 5), which adds its own export line a wave later. Every one
  of the four edits is an addition to the same list of re-exports; none reorders or removes a line.
- `src/server/repos/trips.ts` — edit. The membership guards named below. Shared with `01-S1` (wave 1)
  and `07-S6` (`07-…`, wave 2), both earlier; this stage adds to what they left.
- `src/routes/_app/trips/$tripId/-server/people.ts` — new. The stage's server functions.
- `src/routes/_app/trips/$tripId/people.tsx` — new. The route.
- `src/routes/_app/trips/$tripId/-ui/people-screen.tsx` — new. The screen, including the trip's
  visibility switch (decision 1b).
- `src/components/layout/trip-sub-nav.tsx` — edit, and the edit is the Share button's destination:
  today it links to `/trips/$tripId/collab` (`:98-121`), which is the chat tab and not a people
  surface.
- `src/server/repos/__tests__/trip-guests.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `src/server/repos/__tests__/member-isolation.test.ts` — append. One new `describe` block, under
  the same append-only rule; the file is `01-S1`'s.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S6` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S6'` so no other block is re-recorded.

`src/routeTree.gen.ts` is **not** an owned path and is never hand-edited. `pnpm generate-routes` is a
step of this stage (see **UI**) and the regenerated tree travels in the diff, which is the one
mechanical exception `README.md` grants.

### Data and migration

**One additive table, filed as a requirement for the wave-3 foundations schema stage.** This stage
is wave 4 and files one wave early, under the rule `00-S1` states — a schema stage collects what the
**next** wave asked for, so the table lands before this stage's wave opens. That stage has no id yet:
`00-foundations.md`'s stage register mints the per-wave shared-file stages "when the wave opens", and
this filing is what makes the wave-3 one exist. This stage does not edit `src/server/db/schema.ts`.

`trip_guests`, following the conventions every existing domain table follows:

| Column            | Type                   | Null     | Notes                                            |
| ----------------- | ---------------------- | -------- | ------------------------------------------------ |
| `id`              | `text` PK              | not null | `pk()`, `newId()` default — time-sortable        |
| `organization_id` | `text`                 | not null | `orgRef()`, `ON DELETE CASCADE`                  |
| `trip_id`         | `text` → `trips.id`    | not null | `ON DELETE CASCADE`                              |
| `display_name`    | `text`                 | not null | The only identity a guest has                    |
| `colour`          | `text`                 | nullable | `colour()`, matching `trip_members.colour`       |
| `created_by`      | `text`                 | nullable | `userRef()`, no Drizzle FK, as every user column |
| `created_at`      | `integer` timestamp_ms | not null | `timestamps()`                                   |
| `updated_at`      | `integer` timestamp_ms | not null | `timestamps()`, `$onUpdateFn`                    |

Indexes: `trip_guests_org_trip_idx` on `(organization_id, trip_id)` — leading `organization_id`, as
every composite index in this schema does — and `trip_guests_trip_name_unq`, a unique index on
`(trip_id, display_name)`, which is what makes the disambiguation rule below enforceable rather than
hopeful. No `CHECK` constraint: there is no enum column.

Additive, backfills nothing, and a rollback is safe because the previous Worker never reads the table.

**Guest participation in other modules: the shape is decided here, the columns land there, and the
merge is built here (decisions 7b, 4b).** A guest has to be a valid assignee in expense splits,
packing items and day-plan participants, and none of those links is added in this stage. The reason
is measured rather than aesthetic: `assignment_participants` (`src/server/db/schema.ts:564-579`) has
a composite primary key of `(assignment_id, user_id)`, so it cannot hold a guest without a primary-key
change, and drizzle-kit emits a full table rebuild for that on SQLite — which is not additive and is
exactly what the migration ritual forbids. The additive shape is fixed here for every plan that links a
guest: **one nullable `guest_id` column beside the existing `user_id`, with a repository rule that
exactly one of the two is set** — never a single polymorphic participant id — because that is the
shape a merge can walk with one `UPDATE` per table. Each column belongs to the plan that owns the
surface reading it: `04-budget-and-currencies.md` for expense shares, `05-packing-and-todos.md` for
packing and to-dos (which already files `assigned_guest_id` in that shape), and `BKG-10`/`TRP-08`'s
successor for day-plan participants. This stage gives all three the one read model they build
against — `listTripParticipants` — and the one write they register into: `registerGuestRelinker(name,
fn)`, where `fn` is `(scope, tripId, guestId, userId) => Promise<number>` and rewrites that plan's
`guest_id` rows to `user_id`. The stage that adds a `guest_id` column registers its relinker in the
same change, so a guest merged after that stage lands loses nothing.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/trip-guests.ts`, new.**

- `listTripGuests(scope, tripId)` — ordered by `display_name`.
- `createTripGuest(scope, { tripId, displayName, colour })` — `requireTrip`, `assertTripRole(['owner'])`,
  the uniqueness rule and the `MAX_TRIP_GUESTS` bound below, then insert through
  `createTenantRepository(tripGuests, 'trip guest')`.
- `renameTripGuest(scope, guestId, displayName)` — `requireUpdate`, refusing a name already on the
  same trip.
- `mergeTripGuest(scope, tripId, guestId, userId)` — decision 7b. `requireTrip`,
  `assertTripRole(['owner'])`, the target must hold a `trip_members` row on this trip; then every
  registered relinker runs in registration order inside one `runBatch`, then the guest row is removed,
  and the per-relinker counts are returned so the screen can say what moved. Irreversible, and the
  dialog says so.
- `removeTripGuest(scope, guestId)` — `requireRemove`.
- `listTripParticipants(scope, tripId)` — the read model every later participant picker consumes.
  Returns one array of a discriminated union: `{ kind: 'member', userId, role, colour }` from
  `listTripMembers` (`src/server/repos/trips.ts:403`) joined to `listUserProfiles`
  (`src/server/repos/members.ts:210`), and `{ kind: 'guest', guestId, displayName, colour }` from this
  module. One shape, one place, so a picker never has to merge two lists itself and never has to
  decide what a participant is.

**Duplicate names are refused, not suffixed (decision 7).** A second guest with a name already on
the trip — case-insensitively, after trimming — is refused with a message the field shows inline
("A guest named Anna is already on this trip"), and the reader chooses the distinguishing word. The
reference appends an ordinal instead; we do not, because the server cannot tell a second Anna from the
same Anna typed twice, and a silent "Anna 2" is how a cost gets split onto a person who does not exist.
`trip_guests_trip_name_unq` stays as the backstop the rule is written against, and there is no attempt
loop. The point is the same as the reference's: two identical names in a participant picker is how a
cost gets split onto the wrong person.

**Repository — `src/server/repos/trips.ts`, edited.** Three guards on the membership writers, each
inside the repository so they hold for every caller:

- `addTripMember` refuses a `userId` that is not a member of the caller's organization, resolved
  through `getMembership` (`src/server/repos/members.ts:144`). A well-formed user id is not an
  authorised user id, and without this check a trip membership is a way to name any account in the
  database.
- `removeTripMember` refuses to remove the trip's last `owner`. The trip would otherwise become
  unownable, and `assertTripRole` would then refuse every write on it forever.
- `addTripMember`, `updateTripMember` and `removeTripMember` call `assertTripRole(scope, tripId,
['owner'])` — the guard `01-S1` added — except for the self-removal path, which any member may take
  for themselves and which is the same call with the acting user's own membership id.

**Server functions — `src/routes/_app/trips/$tripId/-server/people.ts`, new.** One `GET` loader and
six `POST` writes:

| Function              | Method | Input                              | Returns                                                         |
| --------------------- | ------ | ---------------------------------- | --------------------------------------------------------------- |
| `loadTripPeople`      | GET    | `{ tripId }`                       | members, guests, invitable profiles, the caller's own role      |
| `addTripMemberFn`     | POST   | `{ tripId, userId, role }`         | `{ memberId }`                                                  |
| `setTripRoleFn`       | POST   | `{ tripId, memberId, role }`       | `{ memberId, role }`                                            |
| `removeTripMemberFn`  | POST   | `{ tripId, memberId }`             | `{ removed: true }`                                             |
| `leaveTripFn`         | POST   | `{ tripId }`                       | `{ removed: true }`                                             |
| `addTripGuestFn`      | POST   | `{ tripId, displayName }`          | `{ guestId, displayName }`                                      |
| `renameTripGuestFn`   | POST   | `{ tripId, guestId, displayName }` | `{ guestId, displayName }`                                      |
| `removeTripGuestFn`   | POST   | `{ tripId, guestId }`              | `{ removed: true }`                                             |
| `mergeTripGuestFn`    | POST   | `{ tripId, guestId, memberId }`    | `{ memberId, relinked: Record<string, number> }`                |
| `setTripVisibilityFn` | POST   | `{ tripId, visibility }`           | `{ tripId, visibility }` — `'private'` or `'organization'` only |

`loadTripPeople` returns the invitable set **already filtered** to workspace members who are not yet
on the trip, so the client never receives a directory it then has to subtract from, plus the trip's
`visibility` and the caller's role. `setTripVisibilityFn` writes through `updateTrip`, whose
`assertTripRole` is `owner` (decision 6); `'public'` is not accepted here — it is the share plan's
value and this switch has two positions.

**Zod v4.** `z.strictObject()` with the `error` parameter; `z.enum(TRIP_MEMBER_ROLES)` for the role,
reading the tuple the schema already exports (`src/server/db/schema.ts:157`) rather than restating it;
a trimmed `displayName` between 1 and the shared `shortTextSchema` bound. No `z.string().email()`
anywhere — the picker searches profiles the server already resolved, and an email never crosses the
wire as an identifier.

**Authorisation, said explicitly.** Every decision is in the repository, through `assertTripRole` and
the three guards above. The server function contributes the tenant scope and nothing else. Adding,
promoting and removing another member, every guest write including the merge, and the visibility
switch require the trip `owner` role; leaving requires only that the membership being removed is the
caller's own; reading requires membership or `visibility = 'organization'`, which `requireTrip` inside
the caller's scope establishes from `01-S1` on (decision 1). `beforeLoad` on the new route is UX
— it makes the page 404 gracefully — and is never the boundary.

**The invited person is told.** `addTripMemberFn` calls `notify()`
(`src/server/repos/notifications.ts:129`), whose write path is supplied by `00-S2` in wave 0, with the
`trip` scope, the trip's id as the entity and the trip's own URL as the action. One notification per
invitation, so no fan-out and no chunking question; `notifyMany` is not used and the queue is not
touched. A guest is never notified, because a guest has no account and no address — that is what
being a guest means.

Nothing slow, nothing enqueued, and no Durable Object patch kind is added.

### UI (route, components)

**Route.** `src/routes/_app/trips/$tripId/people.tsx`, new, default SSR. `pnpm generate-routes` is run
after the file lands and `src/routeTree.gen.ts` is never hand-edited and never listed as an owned
path.

It is a **route and not an eighth tab.** `TRIP_TABS` (`src/components/layout/nav-model.ts:91-99`)
stays at seven, which is what `TRP-07` and `01-S3`'s test assert; the people screen is reached from
the sub-navigation's existing Share button and, from wave 5, from the trip card's own action menu. A
route rather than a modal buys three things a panel does not: a shareable address, a place for the
mobile layout to be a full page instead of a squeezed sheet, and a URL the capture script can point
at.

**Screen.** Above `lg`, two columns: people on the left, and on the right the invite control, then
the **visibility card** (decision 1b) — a `Card` with one `Switch` reading "Visible to everyone in
the workspace", its current state in words beneath ("Only the people listed here can see this trip"
or "Anyone in the workspace can open this trip"), rendered for the `owner` and rendered read-only as
a sentence for everyone else — and beneath that the card that will hold this trip's link sharing when
`COL-10` and `COL-11` (`07-collaboration-and-sharing.md`) land. The column is not a placeholder for a
feature that does not exist: the invite control and the visibility card are real from this stage. Below `lg` the columns stack, invite
first, because on a phone the reason you opened this page is to add somebody.

**The two lists.** Members carry an `Avatar`, a name, the workspace handle, a role `Badge`, and a
marking on the trip's owner; the caller's own row is labelled as theirs. Non-owner rows carry a remove
`IconButton`; the caller's own row carries a leave affordance instead, which is a different verb and a
different icon because it has a different consequence — leaving redirects to the trips index, removing
does not move you anywhere. Guests are a second list beneath, each row a name, a guest `Badge`, a
rename control, a remove control and a **merge** control ("This is now…", a `Combobox` over the trip's
members, decision 7b), all `owner`-only.

**Components reused, not rebuilt.** `Card`, `SectionLabel`, `Avatar`, `AvatarStack`, `Badge`,
`Button`, `IconButton`, `Combobox`, `Input`, `Field`, `Dialog`, `Alert`, `EmptyState`, `Skeleton`,
`Separator`, `Tooltip`, `DropdownMenu` — every one already in `src/components/ui`. No new primitive is
required and none is proposed.

**States.**

- _Empty._ A trip with one member and no guests is the common first state, so it is designed rather
  than treated as an error: the guests list shows an `EmptyState` on `--color-surface-2` explaining
  that a guest is somebody travelling with you who does not need an account, with the add control as
  its action. A workspace whose every member is already on the trip shows the invite combobox in a
  resolved empty state pointing at workspace invitations, not an endlessly empty dropdown.
- _Skeleton._ The route's `pendingComponent` renders two column skeletons of the same height as the
  loaded lists, reusing `RowsSkeleton` from `src/routes/_app/-ui/scaffold.tsx:228`.
- _Error._ The route's `errorComponent` uses the shipped `ErrorPanel`, as every other trip route does.
  A failed write leaves its own row in an error state with the server's message and a Retry, and never
  clears the list.
- _Destructive confirmation._ Removing a guest states what goes with them; leaving a trip states that
  you will lose access until somebody re-adds you; merging a guest names the member who will inherit
  their assignments and says it cannot be undone. All three are `Dialog`s with a `loading` button, not
  a browser `confirm`. Switching visibility to `organization` is a plain toggle — it is reversible —
  but its label changes to the sentence above so the consequence is read, not inferred.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading — including the invite
  button, which is disabled until a person is chosen and shows `loading` while the write is in flight.

**Motion.** Rows enter with opacity and a 4px lift over 220 ms on `--ease-out-quint`, staggered by
24 ms and capped at eight. A removed row leaves in 150 ms. Reduced motion collapses to opacity.

**Tokens.** None missing, none filed for a wave-4 token stage. Any count the screen prints carries
`tabular-nums`.

### Quota

**One row kind is created and neither metric already in the catalogue applies. Both answers are
argued rather than assumed.**

- **A trip membership does not consume `members`.** That metric counts **workspace seats** and is
  asserted where a seat is created — `src/server/repos/members.ts:160` and `:276`, for a member and
  for a pending invitation. A `trip_members` row links a seat that already exists and already counted
  to one trip. Charging for it a second time would make the enforced number differ from the published
  one, which is the exact failure `resolveLimits()` exists to prevent. No `assertQuota` call is added
  to `addTripMember`.
- **A guest consumes nothing, and no metric is added.** A guest cannot sign in, cannot be notified and
  exists only inside one trip, so it is not a seat and selling it as one would publish a number we do
  not mean. Nothing is added to `resolveLimits()` or to `PLAN_QUOTAS`, and
  `src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path.
- **What bounds guests instead is structural, and it is not a quota.** `createTripGuest` refuses past
  a named constant, `MAX_TRIP_GUESTS = 50` (decision 7), declared in `src/server/repos/trip-guests.ts`
  next to the reason it exists: the participant pickers and the split arithmetic every later plan builds on this
  read model degrade badly past a few dozen names, and an unbounded per-trip list is a noisy-neighbour
  surface with no meter behind it. It is a repository invariant with a unit test, not a plan ceiling,
  it is not published on the pricing page, and it is deliberately not routed through `assertQuota`,
  because `assertQuota` is for numbers we sell.

### Tenant isolation test

One new `describe('trip people')` block appended to
`src/server/repos/__tests__/tenant-isolation.test.ts`, on the existing `alpha`/`beta` fixtures, and
`seedWorld` gains a guest for each tenant so the generic read, list, update, delete and count cases
cover `tripGuestsRepository` the way they cover every other repository.

In A's scope: `createTripGuest` onto B's trip raises `NotFoundError`; `renameTripGuest` and
`removeTripGuest` against B's guest id raise `NotFoundError` and leave B's row byte-identical;
`listTripGuests` for B's trip id returns `[]` and never B's guests; `listTripParticipants` for B's trip
id returns an empty participant set rather than a member list — the specific trap being that
`listTripMembers` (`src/server/repos/trips.ts:403-411`) returns `[]` through `findMany` for a foreign
trip rather than raising, so a participant reader that does not call `requireTrip` first would report
"a trip with no people" instead of refusing. `listTripParticipants` therefore calls `requireTrip`
first, and this case is what proves it. Finally, `addTripMember` with a `userId` belonging to B's
organization raises rather than writing a membership naming a stranger, and `mergeTripGuest` with
B's guest id or B's member id raises `NotFoundError` and relinks nothing.

Functions covered: `createTripGuest`, `renameTripGuest`, `removeTripGuest`, `mergeTripGuest`,
`listTripGuests`, `listTripParticipants`, `addTripMember`, `updateTripMember`, `removeTripMember`.

One `describe` block appended to `member-isolation.test.ts` (`01-S1`'s file): a non-member of a
private trip gets `NotFoundError` from `loadTripPeople`'s repository calls and from
`setTripVisibility`; an `editor` gets `FORBIDDEN` from `setTripVisibility`, `createTripGuest` and
`mergeTripGuest`; and flipping `visibility` to `organization` makes `listTripParticipants` readable to
the non-member without making any guest write possible.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
`pnpm generate-routes` runs before the gate, because a route file that is not in the generated tree
fails `pnpm typecheck` rather than the browser.

**Unit tests.** `src/server/repos/__tests__/trip-guests.test.ts` — a second guest with an existing
name, in any letter case and with surrounding spaces, is refused with the inline message and the
unique index is never reached; renaming onto an existing name is refused the same way;
`MAX_TRIP_GUESTS` is enforced at the boundary at 50 and the refusal names the limit; a merge runs
two fake relinkers in order inside one batch, removes the guest, returns both counts, refuses a
`memberId` that is not on the trip, and leaves everything in place when a relinker throws; `listTripParticipants` returns members and guests in one array with the discriminant
intact and the trip's owner first; removing the last owner is refused; and a member removed from the
workspace no longer appears as an invitable profile.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S6'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` declares `/trips/$tripId/people` — a route no existing spec knows about —
and calls `auditServerClock` over its own route table, which is the only check that reads a route's
declaration against the streamed payload and is called nowhere else for a module route.

Frames: `/trips/<id>/people` at 360, 1280 and 2560 in both themes, plus a declared non-resting set for
the invite picker, which is the affordance the stage is about:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<seeded-trip-id>/people" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S6" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state invite-open --click '[data-part="trip-invite-trigger"]'
```

a second run at `--state guest-remove` reaching the destructive dialog, and a third at
`--state guest-merge --click '[data-part="trip-guest-merge"]'`. All three selectors are stable
published attributes, each verified with a `page.locator(sel).count()` of 1 against the running server
before the capture runs. `e2e/helpers/shoot.ts` is not claimed: the screen prints no clock-derived
string — a joined date is rendered as an absolute date, deliberately, so that this page is stable on
every calendar day.

**Console.** `watchConsole` attached, `fatal` empty in every test, tolerance list untouched. **Layout
shift** asserted after `settle()`, gated on `supportedEntryTypes`.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

None that stop the stage, and one dependency that is already satisfied by the wave order: the
notification write path this stage calls is `00-S2`'s, in wave 0, and `TRP-11`'s own `dependsOn` names
`ADM-02` (`10-administration.md`, wave 3), which supplies the workspace-invitation path a person
outside the workspace has to travel before they can be put on a trip. No package outside the
`docs/SPEC.md` §3 pinned set, no binding added to `wrangler.jsonc`, no third-party service.

## Stage 01-S7 — Reading a list of trips two ways, and finding the archived ones

### Stage id

`01-S7` · Wave 5 · effort **M**. Scheduled behind `01-S6` rather than in wave 2; the Area brief argues
why, and the argument is that the card grows two membership-fed affordances and should be designed
once.

### Reference rows

- `TRP-01` partial → **done**.

Sourced from `wiki: My-Trips-Dashboard` for the two view modes, the prominent card for the trip that
matters now, the collapsed archive at the foot of the list, and the per-card actions that appear on
hover on a pointer device and are always visible on a touch one.

**What already ships, and is therefore extended rather than recreated.**
`src/routes/_app/trips/index.tsx` (264 lines) is D1-live and already has the status pills with counts,
the favourites and archived scopes, the URL-bound search, the plan-ceiling `Alert`, a designed empty
state and a pending skeleton. `src/routes/_app/dashboard.tsx` (537 lines) already has the `UpNext`
hero, which **is** the prominent card, plus the stat row, trip mix, next bookings and storage meter.
This stage adds to both and rebuilds neither; a stage that recreated either would be a defect under
`README.md`'s extend-never-recreate rule.

**What is missing and lands here:** a grid/list switch remembered between sessions; a list mode that
is a genuinely different layout rather than a narrower grid; the progress bar and statistics strip on
the prominent card, including the travel-companion figure `01-S6` makes countable; a collapsible
archived section with restore and permanent delete in place; and the per-card action menu, mounted
here on the list rows as `01-S1` mounted it on the tiles.

Rows unblocked: none. No row in `gap-rows.json` names `TRP-01`.

### Owned paths

- `src/routes/_app/trips/index.tsx` — edit.
- `src/routes/_app/dashboard.tsx` — edit. Shared across waves with `01-S5` (wave 2) and `14-S1`
  (`14-dashboard-mascot.md`, wave 3); this stage is the last of the three and edits the hero only.
- `src/routes/_app/-ui/trip-card.tsx` — edit.
- `src/routes/_app/-ui/trip-list-row.tsx` — new. The list mode's row.
- `src/routes/_app/-lib/view-mode.ts` — new. The view-mode vocabulary, the `planned.trips-view`
  preference declaration (area `local`) and the search-parameter resolution rule.
- `src/routes/_app/-lib/__tests__/view-mode.test.ts` — new. The route-local helper directory has no
  `__tests__` today; this stage creates it, following `src/routes/(auth)/-lib/__tests__` and
  `src/routes/api/tiles/-lib/__tests__`, which already do.
- `src/routes/_app/-server/overview.ts` — edit. `loadTrips` and `loadDashboard` payloads. Shared with
  four stages in four earlier waves, all closed long before this stage opens: `00-S5`
  (`00-foundations.md`, wave 0), `01-S1` (wave 1), `09-S7` (`09-account-and-settings.md`, wave 2) and
  `10-S3` (`10-administration.md`, wave 4). This stage is the last of the five, it widens two loaders
  and moves nothing, and each sibling names it in return.
- `src/server/repos/trip-guests.ts` — edit. `countTripPeople`.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S7` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S7'` so no other block is re-recorded.

`src/routes/_app/-ui/trip-actions.tsx` is **not** here: the menu `01-S1` built is reused as it stands,
and a second implementation of it would be the defect this list is meant to prevent.

### Data and migration

**No schema change and no migration.** Every column and table is present: `trips.is_archived`
(`src/server/db/schema.ts:635`), `trips.start_date`/`end_date` for the progress figure,
`trip_favourites` from `01-S1` (decision 5 — `trips.is_favourite` is dead and this stage never reads
it), and `trip_guests` from `01-S6`. The view mode and the archived fold are one
per-browser record through `src/lib/local-preference.ts` — `planned.trips-view`, **`area: 'local'`**
— and not a column, for the reasons `01-S3` and `01-S5` already argued. The area is not a detail
here: `TRP-01` asks for "grid/list view modes **persisted** client-side", so a session lifetime would
fail the row on its own wording, and a reader who prefers the list would be handed the grid back
every morning. This stage is wave 5, so its schema stage would be the wave-4 one; nothing is filed
for it.

**One measured read-cost note, because this screen is the one that could regress it.** D1 bills rows
**read**, not rows returned. `countTripPeople` therefore counts in one grouped query over
`(organization_id, trip_id)` for the whole page of trips, exactly as `countTripsByStatus`
(`src/server/repos/trips.ts:268-292`) and `countPlacesPerTrip` already do — never one query per
card.
Both `trip_members` and `trip_guests` lead their composite index with `organization_id`, so the scan
is bounded by the tenant.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/trip-guests.ts`, edited.** `countTripPeople(scope, tripIds)` returns
a `Map<string, number>` of members plus guests per trip, in two grouped queries built on
`tenantFilter()`. SQL stays here.

**Server functions — `src/routes/_app/-server/overview.ts`, edited.** No new endpoint; two existing
payloads grow:

- `loadTrips` (`:259`) returns the archived trips as their own array beside the active list, so the
  archived section is a fold rather than a second request, adds the companion count per card, and
  marks each card with the **caller's** favourite from `listFavouriteTripIds` (`01-S1`); the
  `favourites` scope and its pill count read the same table. Every list it returns is already
  narrowed by `01-S1`'s read predicate — a private trip the caller is not on is not in the payload
  (decision 1).
  Its existing `archived` search filter is kept, because the archived **scope** and the archived
  **section** are different readings and a URL that names the scope must keep working.
- `loadDashboard` (`:181`) adds the companion count and the elapsed fraction for the trip in the hero.
  The fraction is computed on the server from `serverToday()`, not in the browser, so it is pinned by
  `x-pt-server-today` in development and a baseline of the progress bar is stable — a client-computed
  percentage would move every day and mask a real regression.

**Zod v4.** `tripFilterSchema` on `loadTrips` keeps its shape; no input is added, because the view
mode never reaches the server. `z.strictObject()` and the `error` parameter apply to anything new.

**Authorisation.** Unchanged: both loaders resolve the tenant through `appScope()` and read through
tenant-scoped repositories. The action menu's writes are `01-S1`'s server functions, whose role checks
are in the repository, so the menu can render an item the caller may not use and the refusal is still
the repository's — the menu hides items the caller's role cannot exercise as a courtesy, never as the
control.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path.

**Where the mode lives, and why it is in the URL as well as in storage.** `view` joins the route's
existing `validateSearch` schema (`trips/index.tsx:30-34`) as `z.enum(['grid', 'list']).optional()`.
The URL is the truth that the server and the browser both read, so the first render — cold, streamed,
hydrated, or shared as a link — is already in the right mode and no box moves after paint. Storage
supplies only the default: the switch writes `planned.trips-view` and navigates with `replace: true`,
and an in-app navigation to `/trips` with no `view` reads the remembered mode in `beforeLoad` under
the same `typeof window !== 'undefined'` guard `01-S3` established, then redirects once. A cold load
of a bookmarked `/trips` carrying no `view` stays in grid, which is the same honest contract `01-S3`
states for the tab and is preferable to a page that paints one layout and swaps to another.
`loaderDeps` narrows to the three data-bearing keys — `status`, `q`, `scope` — so changing the mode
re-renders and never re-invokes `loadTrips`; today it forwards the whole search object
(`trips/index.tsx:37`), which would put a D1 read on a layout toggle.

**The two modes, and why list is not a narrow grid.** Grid keeps the existing `TripTile` — cover art,
title, countdown badge, place count, action menu. List is a different information order for a
different question: one row per trip, dense, with the dates and the status legible in a vertical scan,
the companion avatars as an `AvatarStack`, and the same action menu at the row's end. A reader in grid
mode is browsing; a reader in list mode is looking something up. Below `md` the switch is hidden and
the layout is always the row: a two-column grid of cover art on a 360px screen is a squeezed desktop,
which `docs/SPEC.md` §2 rules out by name.

**The prominent card.** The hero at `dashboard.tsx:91` gains a `Progress` bar — only while a trip is
under way, because a percentage on a trip that has not started is noise — and a three-figure strip:
nights, places, travelling companions. All three are display-face numerals with `tabular-nums`, which
is what the `StatCard` pattern in `DESIGN.md` is for and what `HeroStat` (`:235`) already renders.

**The archived section** sits at the foot of the trips index as a `disclosure` — a real button with
`aria-expanded` and a `Chip` carrying the count — collapsed by default, and its open state is the
second field of the same `planned.trips-view` record, so it outlives the session with the mode. It is
below the fold of every viewport this plan photographs, so resolving it after hydration moves nothing
that is on screen. Its
rows carry Copy for every reader and, for an `owner`, Restore and Delete permanently — `01-S1`'s
`copyTripFn`, `restoreTripFn` and `deleteTripFn` behind `01-S1`'s role-filtered menu; no new write is
added.

**Components reused, not rebuilt.** `Card`, `Progress`, `AvatarStack`, `Badge`, `Chip`, `Button`,
`IconButton`, `SectionLabel`, `Skeleton`, `EmptyState`, `Alert`, `Separator`, `Tooltip`, and
`TripActionsMenu` from `01-S1`. No new primitive is required and none is proposed.

**States.**

- _Empty._ Three, each different and each designed. No trips at all keeps the existing full-bleed
  `EmptyState` (`trips/index.tsx:205-232`). A filter that matches nothing keeps the existing reset
  affordance. An archived section with nothing in it is not rendered at all rather than rendered
  empty, because a fold that opens onto nothing is a broken promise.
- _Skeleton._ `CardsSkeleton` in grid mode and a new rows skeleton of the same row height in list mode,
  both on `--color-surface-2`. The skeleton reads the mode from the `view` search parameter, which is
  known on the server and on the client alike, so it always matches the layout that is about to
  arrive and the page never swaps shape after hydration.
- _Error._ The route's existing `ErrorPanel` is kept. A failed lifecycle write from a row's menu keeps
  the row and surfaces the reason in a toast, which is `01-S1`'s contract.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the mode switch, the
  disclosure, the row, and every menu item.

**Motion.** Switching mode cross-fades over 220 ms on `--ease-out-quint` with a 4px lift, transform
and opacity only; rows stagger by 24 ms capped at eight. The archive fold animates its own height
through the shipped disclosure behaviour rather than a hand-rolled `max-height` transition. Reduced
motion collapses to opacity.

**Tokens.** None missing, none filed. Every changing number carries `tabular-nums`.

### Quota

**No countable row.** This stage reads; the writes its menus invoke are `01-S1`'s, whose `trips` and
`places` assertions are already in the repository. No metric is added to `resolveLimits()` and none to
`PLAN_QUOTAS`; `src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path.

The trip ceiling is **displayed** here and not enforced here: `loadTrips` already returns `tripLimit`
from `resolveQuotas` (`:274`) and the index already renders the `Alert` at the ceiling (`:194-206`).
That stays a courtesy in front of an enforcement that lives in `createTrip`.

### Tenant isolation test

One new `describe('trip people counts')` block appended to
`src/server/repos/__tests__/tenant-isolation.test.ts`. In A's scope, `countTripPeople` over a list of
trip ids containing both A's and B's returns an entry for A's trips only and no entry — not a zero —
for B's, so a caller cannot learn that a foreign id exists from the shape of the answer. Counting with
B's ids alone returns an empty map. B's `trip_members` and `trip_guests` rows are unchanged
afterwards.

Functions covered: `countTripPeople`.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/routes/_app/-lib/__tests__/view-mode.test.ts`, over the pure module: an unknown
stored value resolves to grid rather than crashing; the preference declaration names `area: 'local'`,
which is the case that fails if the mode is ever given a session lifetime and stops satisfying
`TRP-01`; the record is a single exported declaration, so the skeleton, the switch and the
`beforeLoad` seed cannot read two different keys; a URL that already carries `view` is returned
unchanged rather than overridden by the stored mode, which is the rule that keeps a shared link
meaning what it says; and the elapsed fraction is clamped to `0..1`, is
zero before the start date, is one after the end date, and takes today as an argument rather than
reading a clock — the signature that fails to compile if somebody moves the computation into the
component.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S7'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` declares `/trips` and `/dashboard` and calls `auditServerClock` over its own
route table.

Both routes already print clock-derived strings that `RELATIVE_TIME_SITES` covers — the trip-card
countdown badge and the dashboard hero's start stat are two of its three entries — so
`e2e/helpers/shoot.ts` is **not** claimed and no entry is added. A non-empty return from
`auditRelativeTime()` is read and reported rather than discarded: it is legitimate when the pinned day
sits past the rows that carry the string, and it is the identical signal a silently deleted string
produces, so the evidence says which of the two it is.

Frames: `/trips` and `/dashboard` at 360, 1280 and 2560 in both themes — twelve for the two resting
surfaces — plus two declared states, because list mode and the opened archive are not what the screen
loads into:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S7" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state list-mode --click '[data-part="trip-view-list"]'
```

and a second run at `--state archive-open --click '[data-part="trip-archive-disclosure"]'`. Both
selectors are stable published attributes, each verified with a `page.locator(sel).count()` of 1
against the running server before the capture runs. Because the mode is in the URL, `--url
"http://localhost:$PORT/trips?view=list"` reaches the same frame with no click at all; the click path
is the one that ships because it also exercises the write and the `replace: true` navigation, and the
URL form is recorded here as the fallback for a run where the control moves. The spec adds one
non-visual assertion beside them: while the mode is switched, it counts the requests the page makes
to the server-function endpoint behind `loadTrips` and expects **zero**, which is the measurement
that fails if `loaderDeps` is left forwarding the whole search object and a layout toggle starts
costing a D1 read. The 2560 frames are read for the defect a card
grid produces at that width — four columns of stretched cover art instead of a bounded measure.

**Console.** `watchConsole` attached, `fatal` empty in every test, tolerance list untouched. **Layout
shift** asserted after `settle()`, gated on `supportedEntryTypes`, and it is the assertion that
catches a mode switch which paints grid before it paints list.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

None. No package outside the pinned set, no binding, no third-party service. `01-S1` and `01-S6` must
have closed, which waves 1 and 4 guarantee.

## Stage 01-S8 — One form for starting a trip and for changing it

### Stage id

`01-S8` · Wave 5 · effort **L**. The creation dialog grows from five fields to the full set, and the
same form becomes the edit sheet `01-S1` opened.

### Reference rows

- `TRP-02` partial → **partial**, deliberately, with one of the row's five capabilities deferred and
  the deferral written out under **Blockers** with its reason, its target stage and its target wave.
  What closes here: the dates-to-duration linkage, the full ISO-4217 currency picker, the cover image
  by drop, by paste and by file picker, the reminder presets, and the initial-members selection. What
  does not: the **stock-photo search** the row's name lists as the fourth way to reach a cover, which
  needs an image provider nobody has chosen. `TRP-04` is the only row that depends on `TRP-02`, and it
  depends on the reminder control, which ships here — so the partial status blocks nothing.

Sourced from `wiki: Creating-a-Trip` for the field set, the date-and-duration linkage, the accounting
currency, the cover image, the reminder choice and the initial-members selection.

**What ships today.** `src/routes/_app/-ui/new-trip-dialog.tsx` (247 lines) has exactly five fields —
title, destination, two dates and currency, from a nine-entry currency list at `:31-40` — over
`createTripFn`. It already validates the date order in the browser and disables the save while the
title is empty, and `createTrip` already reserves the slug, writes the owner membership and builds the
day run (`src/server/repos/trips.ts:311-338`). The gap is the field set, not the plumbing.

**Two corrections to the row, measured.** First, the row says no upload path writes
`trips.cover_image_key` or `cover_image_url`. That is right, and the missing half is only the upload:
both columns exist (`src/server/db/schema.ts:350-351`), `updateTripInput` already accepts both
(`src/server/repos/trips.ts:70-71`), and `TripTile` already renders a cover. Second, the currency list
does not need to be hand-written to reach parity: `Intl.supportedValuesOf('currency')` is supplied by
the runtime with no dependency and no network call, and it is a complete ISO-4217 set rather than
somebody's list of 165. The nine-entry list stays as the pinned favourites shown first, which is a
better reading affordance than an alphabetical wall.

Rows unblocked: `TRP-04` (`01-S10`) directly.

### Owned paths

- `src/routes/_app/-ui/trip-form.tsx` — new. The one field set, rendered by both callers.
- `src/routes/_app/-ui/new-trip-dialog.tsx` — edit. Becomes a thin dialog around the form.
- `src/routes/_app/-ui/trip-actions.tsx` — edit. The edit sheet renders the same form.
- `src/routes/_app/-server/trip-lifecycle.ts` — edit. `createTripFn` accepts the wider input.
- `src/lib/currency-list.ts` — new. Pinned favourites, the runtime set, and the search over both.
- `src/lib/__tests__/currency-list.test.ts` — new.
- `src/routes/_app/-ui/__tests__/trip-form.test.tsx` — new. The date-and-duration linkage.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S8` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S8'` so no other block is re-recorded.

`src/lib/money.ts` is deliberately **not** claimed: `CURRENCY_OPTIONS` (`:40-73`) is a curated list
with a reason written above it, `04-budget-and-currencies.md` reads that module, and widening it would
put one file in two plans. The new module imports the favourites from it and adds the rest.

### Data and migration

**No schema change and no migration.** Every field maps to a column that exists:
`trips.title`, `summary`, `destination`, `start_date`, `end_date`, `currency`, `cover_image_key`,
`cover_image_url`, `reminder_days` (`src/server/db/schema.ts:338-354`), and the initial members are
`trip_members` rows. This stage is wave 5, so its schema stage would be the wave-4 one; nothing is
filed for it.

**Where the duration lives, and why it is not a column.** The form offers a duration when neither date
is set, and derives it when both are. It is never stored: the trip's day run is the duration, and
`syncTripDays` (`src/server/repos/days.ts:141-201`) is the single writer of that run. A `day_count`
column would be a second source of truth for a number `days` already answers, and the two would
disagree the first time somebody moved a date. When the form submits a duration with no dates, the
server creates that many days directly through the day repository; when it submits two dates,
`createTrip` builds the run from the range exactly as it does today.

Dates stay `YYYY-MM-DD` text, currency stays `text(3)`, the budget stays integer minor units. No second
convention.

### Server (repo, server function, Zod)

**Repository.** No new function. `createTrip` and `updateTrip` already accept every field, already
enforce the date order through `assertDateOrder` (`src/server/repos/trips.ts:390-396`) and already
reconcile the day run. The one repository behaviour this stage relies on and must not weaken is that
`assertDateOrder` is server-side: the browser's own check at `new-trip-dialog.tsx:74-75` is a courtesy
and the `trips_date_order_chk` constraint (`src/server/db/schema.ts:369-372`) is the backstop.

**Server functions — `src/routes/_app/-server/trip-lifecycle.ts`, edited.** `createTripFn`'s validator
widens to the full field set plus `dayCount`, `coverImageKey`, `coverImageUrl`, `reminderDays` and
`memberUserIds`. It then does, in order: create the trip; when a duration was given without dates,
create that many days; and when member ids were given, add each through `addTripMember` as `editor` — the role the
reference gives a member by default and the one the form offers, with a per-person role control for
`viewer` — which `01-S6` guarded to refuse a user outside the workspace. No reminder is scheduled — under `00-S5`'s
scan model the next sweep sees the new trip on its own, and `reminderDays` is just a stored column.

Members are added **after** the trip exists, because a membership needs a trip id, and each failure is
reported per person rather than failing the creation — a trip that was created is not un-created
because one invitation could not be written.

**The cover image is uploaded before the trip is saved, and stored after.** The file goes to R2 through
the existing upload server function in `src/server/fns/files.ts`, which is `DOC-01`'s
(`06-documents-and-media.md`, wave 1) and is reused rather than reimplemented; this stage writes only
the returned key and URL onto the trip. The R2 ordering rule is `files.ts`'s and is not re-derived
here: object first, `assertQuota` second, compensating delete if the assertion throws
(`src/server/repos/files.ts:170-171`).

**Zod v4.** `z.strictObject()` with the `error` parameter; `z.iso.date()` for both dates; the currency
validated as a three-letter uppercase code rather than against a hard-coded list, because the runtime's
set is not ours to freeze; `dayCount` an integer with a stated range and rejected outright when either
date is present, so the two ways of expressing a duration can never both arrive; `memberUserIds` a
bounded array of ids.

**Authorisation.** `createTripFn` needs only a tenant scope — creating a trip inside your own workspace
is what a member does — and the `trips` quota assertion inside `createTrip` is what bounds it. Editing
goes through `updateTripFn`, whose `assertTripRole` check `01-S1` put in the repository — `owner`
only (decision 6), so the edit sheet opens for an owner and the form's owner-only fields (cover,
reminder) are rendered only when the payload's role says `owner`. A member id
arriving from the browser is re-resolved against the caller's workspace before it becomes a
membership.

Nothing enqueued — under `00-S5`'s scan model there is no reminder key to write — and no Durable
Object patch. `visibility` is **not** a field of this form: decision 1b puts the switch on the people
screen (`01-S6`), and a new trip is `private` until its owner says otherwise.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path. The dialog opens over `/trips` and over `/dashboard` as it does today.

**One form, two frames.** `TripForm` is the field set and its client rules; `NewTripDialog` wraps it in
the shipped `Dialog` and `TripEditSheet` wraps it in the shipped `Sheet`. Two frames because the two
jobs differ — creating is a short focused act over the list, editing is a longer one beside the thing
being edited — and one form because a field that behaves differently in the two places is a bug
waiting for a bug report.

**The date and duration rule, stated so it can be tested.** Both dates set: the duration is derived,
displayed and not editable. Neither date set: the duration is editable and the trip is created with
that many undated days. Moving the start date with both dates set moves the end date to preserve the
duration; moving the end date changes the duration. An end before its start is refused inline, and the
server refuses it again.

**The cover control** is one control with three ways in — drop, paste, and choose — sharing one
drop-target region that is also a real `button`, so the keyboard path is the file picker and not
nothing. It shows the chosen image immediately from an object URL, uploads on submit, and reports its
own progress. The fourth way in, a stock-photo search, is under **Blockers**.

**Components reused, not rebuilt.** `Dialog`, `Sheet`, `Field`, `Input`, `Textarea`, `Combobox`,
`DatePicker`, `DateRangePicker`, `RadioGroup`, `Button`, `IconButton`, `Progress`, `Alert`, `Avatar`,
`Badge`, `EmptyState`, `Skeleton`. `DateRangePicker` and `MultiCombobox` are two of the four primitives
`repo-ui.md` records as built, tested and imported by no screen; this stage is where two of them get
their first consumer, which is better than adding a fifth unconsumed one.

**States.**

- _Empty._ The members picker with every workspace member already chosen shows a resolved empty state
  pointing at workspace invitations, not an empty dropdown. The cover control's rest state is its
  designed empty state — a dashed `--color-edge` region on `--color-surface-2` naming all three ways
  in.
- _Skeleton._ The members picker loads its profiles asynchronously and shows three skeleton rows at the
  row height it will use, so the popover does not resize under the pointer.
- _Error._ Per-field inline messages from the Zod message; a form-level `Alert` on `--color-surface-2`
  for a server failure with a Retry that re-submits; an upload failure that names the file and offers
  to continue without a cover, because a cover must never be able to block a trip from existing.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading, including the save, which
  is disabled while the title is empty and shows `loading` while the write is in flight, and the dialog,
  which cannot be dismissed mid-save.

**Motion.** The dialog and sheet use the primitives' own entrances — 220 ms in on `--ease-out-quint`,
150 ms out, `--ease-drawer` for the sheet. The duration field appearing and disappearing as the dates
change animates opacity and height-independent transform only. Reduced motion collapses to opacity.

**Tokens.** None missing, none filed. The duration and the budget carry `tabular-nums`.

### Quota

- **`trips`** is asserted inside `createTrip` (`src/server/repos/trips.ts:315`) before any write, as it
  is today. This stage adds no second assertion and no bypass; the dialog's own disabled state at the
  ceiling (`trips/index.tsx:194-206`) stays a courtesy in front of it.
- **`storage_bytes` and `files`** are asserted by `recordFile`
  (`src/server/repos/files.ts:170-171`) for the cover image, in the fixed R2 order — object, assert,
  compensating delete on throw. This stage calls that path and does not re-implement it.
- **A trip membership consumes nothing**, for the reason `01-S6` argued: `members` counts workspace
  seats and a trip membership links a seat that already counted.

No metric is added to `resolveLimits()` or `PLAN_QUOTAS`, so
`src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path.

### Tenant isolation test

**No new `describe` block, and the reason is that this stage adds no repository function.** Every write
it performs is an existing repository call whose isolation case already exists: `createTrip` and
`updateTrip` are covered in the file's foreign-parent block (`:845` onward, which already asserts
`updateTrip(scope, beta.tripId, …)` raises), `addTripMember` gained its case in `01-S6`, and
`recordFile` is covered in the same block. `src/server/repos/__tests__/tenant-isolation.test.ts` is not
listed under **Owned paths** and is not edited.

The one new cross-tenant surface is the initial-members list, and it is closed in the server function
rather than at the repository: `memberUserIds` is re-resolved through `getMembership` in the caller's
scope before any membership is written, which is `01-S6`'s guard on `addTripMember` and is asserted
there.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/lib/__tests__/currency-list.test.ts` — the favourites appear first and appear once; the runtime
  set is deduplicated against them; search matches on code and on name; an environment whose
  `Intl.supportedValuesOf` is unavailable degrades to the favourites rather than throwing, which is the
  case that decides whether the form renders at all on an older engine.
- `src/routes/_app/-ui/__tests__/trip-form.test.tsx` — both dates set hides the duration field and
  derives the figure; neither date set shows it; moving the start preserves the duration by moving the
  end; moving the end changes the duration; an inverted range is refused inline; and a duration and a
  date range can never both be submitted, which is the invariant the server's validator also holds.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S8'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
The stage's `describe` declares `/trips` and calls `auditServerClock` over its own route table;
`e2e/helpers/shoot.ts` is not claimed, because a form prints no clock-derived string.

Frames: the dialog open is the stage, so the resting `/trips` set is owed and the open dialog is
declared:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S8" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state new-trip-dialog --click '[data-part="new-trip-trigger"]'
```

and a second run at `--state trip-edit-sheet`, reached through the card menu `01-S1` built. Both
selectors are stable published attributes, each verified with a `page.locator(sel).count()` of 1
against the running server before the capture runs. The 360px dialog frame is read specifically for the
failure this form invites: a modal taller than the viewport whose save button is below the fold.

**Console.** `watchConsole` attached, `fatal` empty in every test, tolerance list untouched. **Layout
shift** asserted after `settle()`, gated on `supportedEntryTypes` — the duration field appearing and
disappearing is exactly the kind of change that scores here if it is done by unmounting a block instead
of reserving its space.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One, and it removes one of four ways into a control rather than the control. It is why this stage
leaves `TRP-02` at partial.**

- **Capability:** a stock-photo search for the cover image — type a query, choose a result, store the
  image with its attribution. It is the fourth of the four ways the row's name lists into the cover
  field, after drop, paste and picker.
- **It is not a package.** No dependency outside the `docs/SPEC.md` §3 pinned set would supply it;
  nothing is installed and neither `package.json` nor `pnpm-lock.yaml` is edited. It is a
  **third-party service with unread commercial terms**, which is `11-S3`'s class of blocker rather
  than `11-S2`'s.
- **It is not in `11-S3`'s register, and this file does not pretend otherwise.** Measured against
  `docs/plans/11-boundaries-and-blockers.md` as it stands: `11-S3` records **fifteen** rows waiting on
  **three** open provider decisions — geocoding and place search, weather, and foreign-exchange rates
  — and an image provider is none of the three. `TRP-02` does not appear in that stage's table at all;
  the only row of this plan that does is `TRP-05`, under rates. So the deferral is recorded **here**,
  in the stage that owns the capability, and filing it into `11-S3` is listed as a contract extension
  by the run that wrote this plan rather than asserted as already done.
- **Disposition: defer**, with the same shape `01-S5` uses for its own deferral:
  - **Deferred to:** a stage this file mints when the decision lands, **target wave 6** — the same
    wave `01-S5`'s deferred rate capability targets, so the two land together if the decisions do.
    Neither id is cited before the stage that carries it exists, for the reason `01-S5` gives.
  - **Why not hand-roll:** there is nothing to hand-roll. `11-S2`'s **hand-roll a restricted subset**
    fallback applies to a missing _package_, where the work is ours to do; this is a missing
    _catalogue of licensed photographs_, and no amount of our code produces one.
  - **Why not drop:** the requirement is real, the column it would write already exists, and the three
    ways that do ship write to the same field — so the day a provider is chosen, the picker gains a
    fourth tab and nothing else changes.
  - **What unblocks it:** a provider decision of the kind `11-S3` governs — whether a paid,
    subscription-funded product may use the tier at all, what may be cached and for how long, and what
    attribution is owed on screen. That last one is a design constraint on the trip card and the hero
    rather than on the picker alone, which is exactly why it is not a detail to settle inside a form
    stage.
- **What ships instead:** the other three ways in — drop, paste, choose — all of which write to our own
  R2 bucket through the existing file path, cost nothing per request and carry no attribution
  obligation. No disabled fourth tab is rendered promising a search that has no provider, and no copy
  anywhere on the form mentions one.

No binding is added to `wrangler.jsonc`. `01-S1` and `01-S6` must have closed, which waves 1 and 4
guarantee, and `DOC-01` must have closed for the upload path, which wave 1 guarantees.

## Stage 01-S9 — The planner as a workspace you can arrange

### Stage id

`01-S9` · Wave 5 · effort **L**. The largest surface in the repository, extended rather than rebuilt.

### Reference rows

- `TRP-06` partial → **done**.

Sourced from `wiki: Trip-Planner-Overview` for the resizable panes, the day detail that floats over
the map and minimises without closing, the first-open splash, the full-screen overlays on a narrow
viewport, and the short undo history over the planner's own edits.

**What already ships, measured, and is therefore extended.**
`src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` is 1437 lines and already gives one full-bleed
MapLibre canvas with two folding glass rails, a category filter bar, `@dnd-kit` with an optimistic
`PlanOrder` that rolls back on failure, a bidirectional selection reducer, and camera padding that
shrinks with a folded rail. The row's evidence is accurate about what is missing: drag-to-resize, the
day detail, the splash, and the undo control.

**Ahead of the reference already, and not to be regressed.** Two behaviours this screen has that the
upstream product does not are named here so no stage trades them away for a described feature: the
fold-aware camera padding, which is why a pin never hides behind glass when a rail opens, and the
optimistic-with-rollback drag, which is why a drop feels instant while the write is in the air.
`README.md` forbids regressing what we are already ahead on, and these are two of this screen's.

Rows unblocked: `DOC-08` (`06-documents-and-media.md`, wave 6) places its per-day weather badge into
the day detail this stage builds, which is why its surviving edge is `DOC-08 → TRP-06`.

### Owned paths

- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` — edit. Four sibling stages touch this file in
  four earlier waves and none in wave 5: `01-S2` (wave 1), `01-S4` (wave 2), `02-S4`
  (`02-places-and-maps.md`, wave 3) and `03-S5` (`03-reservations-and-transport.md`, wave 4). This
  stage is the last of the five and is the one that extracts the chrome, so every earlier edit has
  landed before the module is split.
- `src/routes/_app/trips/$tripId/-ui/plan-workspace.tsx` — new. The workspace chrome extracted:
  the rail widths, the resize handles, the splash and the narrow-viewport overlays.
- `src/routes/_app/trips/$tripId/-ui/day-detail.tsx` — new.
- `src/routes/_app/trips/$tripId/-ui/plan-undo.ts` — new. The undo ring, pure.
- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-undo.test.ts` — new.
- `src/routes/_app/trips/$tripId/-ui/plan-layout.ts` — new. Pure: the two workspace preference
  declarations with their areas, and the width clamp. It exists as its own module so the lifetimes
  are assertable without rendering the workspace.
- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-layout.test.ts` — new.
- `src/components/planner/rail.tsx` — edit. The rail accepts a width and publishes a resize handle.
- `src/components/planner/__tests__/rails.test.tsx` — edit.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S9` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S9'` so no other block is re-recorded.

`-ui/plan-model.ts`, `-ui/plan-actions.tsx` and `-server/plan.ts` are **not** claimed: this stage
changes how the workspace is arranged, not what it holds or what it writes. It is the only wave-5
stage that names any of the four planner core files, and it names one.

**The extraction is part of the stage, not a refactor smuggled into it.** `plan-screen.tsx` is already
the largest module in `src/`, and adding four behaviours to it without moving anything out would make
the next stage that opens it worse off. The chrome moves to `plan-workspace.tsx`; the three things the
screen's own header says it owns — the optimistic arrangement, the selection reducer and the writes —
stay exactly where they are, because those are the reasons the screen is a screen.

### Data and migration

**No schema change and no migration.** The workspace's arrangement is per-browser through
`src/lib/local-preference.ts`, for the reason `01-S3` argued and under the same `planned.` namespace,
and it is **two declarations with two different lifetimes** rather than one convenient bag:

- `planned.planner-layout` — **`area: 'local'`**, keyed by trip id with `limit` 8, holding the two
  rail widths and the day-detail minimised flag. A rail dragged to the width a reader can actually
  work at is a workspace setting; forgetting it overnight would make them drag it again tomorrow,
  which is the defect the handle exists to remove.
- `planned.planner-days` — **`area: 'session'`**, keyed by trip id with `limit` 8, holding which days
  are unfolded. This is the one preference in the plan that is genuinely a sitting: which days you
  have open is where you are in this piece of work, and a fold restored a week later hides the days
  a collaborator has added since. It is the only `session` consumer of the module, and `01-S3`'s
  table says so.

The undo ring is in memory only and is deliberately not persisted at all: an undo offered after a
reload would reverse an edit the reader has forgotten making, and possibly one somebody else has
since built on. This stage is wave 5, so its schema stage would be the wave-4 one; nothing is filed
for it.

### Server (repo, server function, Zod)

**None.** No repository function, no server function, no Zod schema, no SQL, no authorisation
decision. Every write the undo control reverses is an existing planner server function in
`-server/plan.ts`, invoked with an inverse payload the ring already holds; the day detail reads from
`loadPlanBoard`'s existing payload, which already carries each day's stops, stays and notes
(`:132-146`).

Two consequences, both deliberate:

- **Undo is not a server concept.** There is no undo endpoint and no server-side history. The ring
  holds an inverse call and issues it through the same validated, tenant-scoped server function the
  original edit used, so an undo is authorised exactly as the edit was and cannot become a way to
  write something the caller could not have written directly.
- **A stale undo fails safely.** If the row it would reverse is gone, the server function raises and
  the ring reports it and drops the entry rather than retrying. Undo never invents a row.

### UI (route, components)

**Route.** `src/routes/_app/trips/$tripId/plan.tsx` is not edited and no route is added or moved, so
`pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an owned path. The route keeps
default SSR: the rails are content and belong in the streamed document, and the map already mounts on
the client.

**Resizing, and the reason it is not a mouse-only affordance.** Each rail's inner edge carries a
handle with `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`,
`aria-valuemax` and an accessible name. It drags with a pointer and it moves with arrow keys, `Home`
and `End` when focused, in 16px steps. Width is clamped to a readable band and kept in
`planned.planner-layout` (area `local`), applied to the rail as a CSS custom property in a layout
effect so the stored width is committed before the browser paints the hydrated frame — and behind the
first-open splash, which is still on screen while the map's first style resolves. Because both rails
are overlays above the full-bleed canvas, a corrected width repaints a floating panel and never
reflows the document.
The camera is told: the existing fold-aware padding already recomputes when a rail folds, and this
stage feeds it the width as well, so resizing a rail keeps a pin out from under it exactly as folding
one does.

**The day detail** is a `GlassPanel` floating over the map, opened from a day's header — which is
already a real button (`day-section.tsx:74-112`). It holds that day's date and title, its stays with
their check-in window and confirmation number, its notes, and a declared region for the weather badge
`DOC-08` will place. It minimises to a slim bar that keeps its title and its close control, and closes
with `Escape` or its own control. It is not a `Dialog`: it must not trap focus or block the map, since
its whole purpose is to be read while the route stays visible. Focus is therefore managed explicitly —
opening moves focus to the panel's heading, closing returns it to the day header that opened it.

**The first-open splash** shows the trip's title over the workspace while the loader's data and the
map's first style resolve, then crosses into the workspace. It has a floor and a ceiling: it is not
shown at all on a navigation that resolves immediately, so a fast load never flashes it, and it never
outlives the data by more than its exit. `[data-map-ready]` is what it waits on, which is the same
marker the capture and the e2e settle already read, so the splash and the test agree on what "ready"
means instead of each having an opinion.

**Narrow viewports.** Below the workspace breakpoint the two rails are not narrow rails; they are
full-screen overlays behind a Plan control and a Places control, dismissed by their own close control,
by `Escape` and by a tap outside. The screen already imports `Sheet` and this is where it earns its
place. The resize handles are absent below that breakpoint, because there is nothing to resize
against.

**The undo control** sits at the head of the itinerary rail and is present only when the ring is not
empty. Its accessible name and its tooltip both name the action that will be reversed — "Undo moving
Café Sacher to day 3" — because an unlabelled undo is a dare. The ring is bounded and its bound is a
named constant beside the reason for it; it covers the four planner edits that already have server
functions: adding a place, scheduling one, reordering, and removing an assignment.

**Components reused, not rebuilt.** `GlassPanel`, `Sheet`, `Button`, `IconButton`, `Tooltip`,
`SectionLabel`, `Badge`, `Skeleton`, `EmptyState`, `Alert`, `ScrollArea`. No new primitive is required
and none is proposed.

**States.**

- _Empty._ The day detail for a day with nothing on it is a designed empty state on
  `--color-surface-2`, naming the two things that would fill it — a stop and a note — rather than an
  empty panel. The undo control's empty state is its absence, which is stated so it reads as a decision.
- _Skeleton._ The splash **is** the workspace's loading state, and the day detail shows skeleton rows at
  the height of the rows it will render while a route invalidation is in flight.
- _Error._ A failed undo reports the reason in a toast and drops the entry. A day detail whose data has
  gone — the day was removed by a collaborator while the panel was open — closes itself with a
  message rather than rendering a panel about nothing.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the handles, the
  overlay triggers, the minimise, the close and the undo.

**Motion.** The day detail enters at 220 ms on `--ease-out-quint` and minimises at 150 ms, transform
and opacity only. The overlays use `--ease-drawer`. The splash cross-fades. Resizing is **not**
animated: a handle that lags the pointer feels broken, and a width change is a layout property, which
`DESIGN.md` forbids animating anyway. Reduced motion collapses every one of these to opacity or
to nothing, and the splash to a plain hold.

**Tokens.** None missing, none filed for a wave-5 token stage. Every figure the day detail prints —
times, the check-in window, the confirmation number — carries `tabular-nums`.

### Quota

**No countable row.** This stage creates nothing: it arranges what the screen already loads and
reverses writes that were already counted when they were made. No metric is added to `resolveLimits()`
and none to `PLAN_QUOTAS`; `src/server/billing/__tests__/limits.test.ts` gains no case and is not an
owned path.

### Tenant isolation test

**None, and the reason is that the stage adds no repository function.**
`src/server/repos/__tests__/tenant-isolation.test.ts` is not listed under **Owned paths** and is not
edited.

The one thing worth stating, because an undo ring is exactly where a shortcut would be tempting: undo
never bypasses the server. It re-issues an existing planner server function, which resolves the tenant
through `appScope()` and re-resolves the trip through `writableTrip` and `requireTrip`, so an inverse
payload built in a browser cannot reach a row the caller could not otherwise write. There is no
client-supplied identifier in the ring that is not already validated on the way back in.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-undo.test.ts` — the ring is bounded and drops its
  oldest entry, not its newest; each of the four tracked edits produces an inverse that returns the
  board to the arrangement before it; undoing twice reverses two edits in order; a rejected inverse
  drops its entry rather than retrying; and the ring is cleared when the loader's own order lands from
  a different source, so an undo can never fight a collaborator's write.
- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-layout.test.ts` — `planned.planner-layout` names
  `area: 'local'` and `planned.planner-days` names `area: 'session'`. These two cases are the reason
  the module is separate: they fail if a later edit collapses the workspace's two lifetimes into one,
  in either direction — a rail width forgotten overnight, or a week-old day fold restored over days a
  collaborator has since added. The clamp is covered here too: a stored width outside the readable
  band resolves to the nearest end rather than being honoured, so a record written by an older build
  with a wider band cannot hand back a rail that covers the map.
- `src/components/planner/__tests__/rails.test.tsx` — extended, not rewritten. The handle exposes
  `role="separator"` with a name and the three ARIA values; arrow keys move it and clamp at both ends;
  the width is read back from the preference module on mount; and every existing case still passes.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S9'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` declares `/trips/$tripId/plan` with `map: true` and calls `auditServerClock`
over its own route table. `e2e/helpers/shoot.ts` is not claimed.

Frames: the workspace resting at 360, 1280 and 2560 in both themes, plus three declared states, because
every one of this stage's four outcomes is a state the screen is not in when it loads:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<seeded-trip-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S9" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
  --state day-detail --click '[data-part="day-header"]'
```

then `--state day-detail-minimised --click '[data-part="day-detail-minimise"]'`, and at 360 only,
`--state plan-overlay --click '[data-part="plan-overlay-trigger"]'`. Each selector is a stable
published attribute and each is verified with a `page.locator(sel).count()` of 1 against the running
server before its capture runs; a selector that resolves to nothing makes `capture.mjs` throw at
`--click`. `--map` is required on this route and re-waits the two-sided `[data-map-ready]` predicate
after every resize and every theme change — which matters more here than anywhere else in the plan,
because this stage changes what the map's viewport is.

The splash is captured with `--settle 0` against a cold navigation so the frame is the splash and not
what follows it, and the evidence says plainly that a frame of a transient state is a frame of a
transient state.

**Console.** `watchConsole` attached, `fatal` empty in every test, tolerance list untouched. The one
tolerated warning that legitimately appears on this route is the headless rasteriser's GL advisory,
which is already in `TOLERATED_CONSOLE_WARNINGS` scoped to routes declaring a live map; nothing is
added. **Layout shift** asserted after `settle()`, gated on `supportedEntryTypes` — and this is the
stage where it earns its keep, because a splash that hands over to a workspace is the classic way to
score a large shift after paint.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

One item is added and is not negotiable: **the fold-aware camera padding and the optimistic-rollback
drag both still behave exactly as they do before the stage**, evidenced by the existing planner tests
passing unchanged and by a frame with a rail resized and a pin still clear of it.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

None. `motion`, `vaul` behind `Sheet`, `radix-ui` and `@dnd-kit` are all pinned and all already in use;
no package, no binding, no third-party service. `01-S6` must have closed, which wave 4 guarantees, and
the day detail's weather region stays empty until `DOC-08` lands in wave 6 — which is a later stage
filling a declared seam, not a blocker on this one.

## Stage 01-S10 — A reminder that fires on the right day, and can be turned off

### Stage id

`01-S10` · Wave 6 · effort **M**. The last stage of the plan: the sweep already fires (the scan
model `00-S5` ships honours `reminder_days` from wave 0 on), and this stage gives the traveller the
choice the sweep honours.

### Reference rows

- `TRP-04` partial → **done**.

Sourced from `wiki: Creating-a-Trip` and its reminder sub-page for the preset choices, the custom
range and the anchoring to the trip's departure.

**What already exists, measured, as redecided during the grilling of `00-foundations.md`.**
`trips.reminder_days` is `NOT NULL DEFAULT 3` with a non-negative `CHECK`
(`src/server/db/schema.ts:547`, `:561`). `00-S5` ships the scan model in wave 0: the `*/15` sweep
reads due, unarchived trips straight from D1, computes the 08:00 UTC anchor from the row it just
read, and dispatches through `00-S2` — in-app rows and per-recipient e-mail under the traveller's
own preferences — deduplicated by a self-expiring KV marker keyed by trip and due instant. There is
no schedule-at-write step anywhere: creation, edit, archive and delete run no reminder code, and a
changed date is simply what the next scan sees. So the preference is stored, the transport exists,
and every trip with a future start date is already reminded at the stored default.

**What is missing and lands here:** the reader can neither choose the value nor see it. The control
and its semantics are the whole stage.

**A refinement of `00-S5`'s sentence, stated rather than assumed.** `00-S5` says `TRP-04` "owns the
preference UI". `TRP-02`'s row text names reminder presets as a field of the creation dialog, and
`01-S8` renders the control there because a form field belongs to the form. This stage owns the
control's **semantics** — the preset vocabulary, the custom range, the meaning of zero, the product
bound of 30 days on the server validator. The two do not overlap and the split is recorded here so
neither stage assumes the other did it.

**The upstream kill switch is not ported.** Upstream, an administrator can disable reminders for the
whole deployment, and the control is then rendered dimmed with an explanation rather than hidden. One
deployment serves every tenant here, so that switch would silence reminders for every customer at
once. The hosted equivalent already exists and is somebody else's row: the per-user notification
channel matrix in `ACC-05` (`09-account-and-settings.md`, wave 2), which is `TRP-04`'s other
`dependsOn` and which decides whether this reminder reaches a person by email, in the notification
centre, or not at all.

Rows unblocked: none. `TRP-04` is a leaf.

### Owned paths

- `src/routes/_app/-ui/trip-form.tsx` — edit. The reminder control's presets, custom range and copy.
- `src/routes/_app/-server/trip-lifecycle.ts` — edit. `updateTripFn`'s validator narrows
  `reminderDays` to the product bound (`0..30`); no reminder code is called.
- `src/routes/_app/-server/__tests__/trip-reminder.test.ts` — new. The validator bounds and the
  absence-of-scheduler assertion.
- `e2e/trips-core.visual.spec.ts` — append. One new `test.describe` block, named `01-S10` and this
  stage's title, in the plan's single spec file that `01-S1` creates. It declares its own route table
  and edits no other block.
- `e2e/__screenshots__/trips-core.visual.spec.ts/` — append. Only the frames this stage's own block
  records; `--update-snapshots` is narrowed with `-g '01-S10'` so no other block is re-recorded.

`src/server/queue/reminders.ts` and `src/server/catalog/reminders.ts` are **not** claimed: both are
`00-S5`'s and both closed in wave 0. This stage calls neither — under the scan model there is
nothing for a write path to call, and a scheduler call added here would be the defect.

### Data and migration

**No schema change and no migration.** `trips.reminder_days` exists with its default and its `CHECK`,
and the sweep's only state outside D1 is `00-S5`'s self-expiring KV marker. This stage is wave 6, so
its schema stage would be the wave-5 one; nothing is filed for it.

**Zero is the off switch, and it needs no column.** `reminder_days = 0` means no reminder, which the
non-negative `CHECK` already permits and the scan's `reminder_days > 0` predicate already honours. A
separate `reminder_enabled` boolean would be a second way to say the same thing and the two would
disagree.

**A trip with no start date has nothing to anchor to.** That is not an error and is not hidden: the
control renders with an explanation that the reminder starts working once the trip has a departure
date, and the scan's `start_date IS NOT NULL` predicate skips the row. When the date is later filled
in, the next sweep sees it — no code path in this stage schedules anything.

### Server (repo, server function, Zod)

**Repository.** None added. The row this stage writes is the trip row, through `updateTrip` in
`src/server/repos/trips.ts`, which already accepts `reminderDays` through `tripFields` (`:74`) and
already validates it as a non-negative integer capped at 365. Its `organization_id` scoping is the
repository's own and is unchanged: `tripsRepository` is a `createTenantRepository`, so every statement
starts from `tenantFilter()` on `trips.organization_id`, and `requireTrip` re-resolves the id inside
the caller's scope before the update.

**Server function — `src/routes/_app/-server/trip-lifecycle.ts`, edited.** `updateTripFn` accepts
`reminderDays` and writes it through `updateTrip`; it calls no reminder code, before or after the
write. Under `00-S5`'s scan model an edited date or lead time is simply what the next sweep reads,
a moved start date yields a new due instant and therefore a fresh reminder, and there is no key to
cancel because there is no key at all — the orphaned-anchor hazard the retired design had to manage
is not managed here, it is absent.

**Zod v4.** The `reminderDays` input is an integer in `0..30`, with the `error` parameter carrying the
message the field shows. The repository's own cap is 365 and stays there — the wider bound is the
column's, the narrower one is the product's, and narrowing at the boundary rather than in the column
means the decision can change without a migration.

**Authorisation.** In the repository, through the `assertTripRole` guard `01-S1` added to `updateTrip`:
`owner` (decision 6). The reminder is not separately gated, because the person who can move a trip's
dates is the person who sets its reminder — and the reference shows the control on edit to the owner
alone, which `01-S8`'s form already does with its owner-only fields.

**Delivery is already asynchronous.** The sweep dispatches through `00-S2` — in-app rows plus
per-recipient `email` envelopes with deterministic ids, chunked under that stage's bounds; nothing
in this stage sends anything inline. No Durable Object patch, no new task kind.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path.

**The control.** A `RadioGroup` of presets — none, one day, three days, nine days — plus a custom
option that reveals a numeric `Input` bounded to 1–30. One tab stop for the presets with arrow-key
movement, which is what a radio group is for and what a row of buttons would lose. Beneath it, one line
of resolved copy naming the actual date the reminder would be sent, computed from the trip's own start
date — a preset in days is arithmetic the reader should not have to do, and the resolved date is what
makes the choice obvious.

**When there is no start date** the presets stay enabled and the resolved line says the reminder will
start once a departure date is set. The value is stored either way, so filling the date in later needs
no second visit to this control.

**Components reused, not rebuilt.** `RadioGroup`, `Field`, `Input`, `Alert`, `Tooltip`, `SectionLabel`
— all from `src/components/ui`. No new primitive is required and none is proposed.

**States.**

- _Empty._ Not a list, so no empty state of its own; the resolved-date line is what an unset trip shows
  instead of a blank, and it renders on `--color-surface-2` inside the form's own section.
- _Skeleton._ The control is part of a form that is either open or not; it has no independent pending
  state. Stated rather than skipped.
- _Error._ A custom value outside 1–30 is refused inline with the bound named, and the server refuses it
  again. A failed save leaves the form's existing `Alert` in place, which `01-S8` owns.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the radios and the custom
  input.

**Motion.** The custom input reveals with opacity and a 4px transform over 220 ms on
`--ease-out-quint`; reduced motion collapses it to opacity.

**Tokens.** None missing, none filed. The day figure and the resolved date carry `tabular-nums`.

### Quota

**No countable row.** A reminder is a scan hit and, when it comes due, one queue envelope and one
self-expiring KV marker. It creates no D1 row, so no metric applies; none is added to `resolveLimits()` and none to `PLAN_QUOTAS`,
and `src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path.

What has to be bounded here is not rows but fan-out, and it already is, in a place that is not this
stage's: the sweep dispatches through `00-S2`, whose in-app and e-mail chunk bounds are held in unit
tests, and its KV marker is one per fired reminder with a TTL, bounded by trips with a near-future
start date.

### Tenant isolation test

**No new `describe` block, and the reason is that the stage adds no repository function.**
`src/server/repos/__tests__/tenant-isolation.test.ts` is not listed under **Owned paths** and is not
edited. `updateTrip`'s isolation case already exists in the file's foreign-parent block, which asserts
that `updateTrip(scope, beta.tripId, …)` raises, and `00-S5` appended the case covering the sweep's
per-trip scope construction.

The tenant property this stage must not break lives entirely in `00-S5`'s sweep and is asserted
there: the KV marker key embeds the organization id and can only suppress a reminder inside its own
organization, and every member-shaped read runs in a real member's `tenantFilter()`-bound scope.
This stage writes one tenant-scoped column and nothing else.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/routes/_app/-server/__tests__/trip-reminder.test.ts`:

1. `updateTripFn` accepts `reminderDays` of 0, 1, 3, 9 and 30 and stores the value; 31 and −1 are
   refused with the bound named — the product's `0..30` narrowing over the repository's own 365 cap.
2. Setting `reminderDays` to zero stores zero, which the scan's `reminder_days > 0` predicate reads
   as "off" — asserted by driving `00-S5`'s exported scan against the edited row.
3. Moving a start date requires no reminder call: the module imports nothing from
   `src/server/queue/reminders.ts` or `src/server/catalog/reminders.ts`, asserted structurally, and
   the edited row surfaces from the scan under its new due instant.
4. The resolved-date line's arithmetic — `start_date − reminder_days` at 08:00 UTC — matches
   `00-S5`'s exported anchor function, so the copy and the sweep can never disagree about the date.

**Browser evidence.** Port resolved with `scripts/ultrabuild/resolve-port.sh`, then the three
`PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` invocations `01-S1` writes
out in full — `--project=setup` once, then the plan's spec, then `--update-snapshots` narrowed to
this stage's own `describe` block with `-g '01-S10'`, so no other block's baselines are re-recorded — against
`e2e/trips-core.visual.spec.ts`, the plan's single spec file.
This stage's `describe` declares `/trips` — the surface the form opens over — and calls
`auditServerClock` over its own route table.

The resolved-date line is derived from the trip's start date and the chosen offset, both of which are
fixture data rather than the clock, so it is stable on every calendar day and `e2e/helpers/shoot.ts` is
not claimed and `RELATIVE_TIME_SITES` gains no entry. That is a property worth stating: had the line
been phrased relative to today it would have needed an entry, and phrasing it as an absolute date is
what avoids the mask.

Frames: the reminder control is inside a dialog, so the state is declared:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/01-S10" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state reminder-custom --click '[data-part="trip-reminder-custom"]'
```

The selector is a stable published attribute and is verified with a `page.locator(sel).count()` of 1
against the running server before the capture runs. The resting `/trips` set is still owed, because the
custom state is judged against the state it changes from.

**Console.** `watchConsole` attached, `fatal` empty in every test, tolerance list untouched. **Layout
shift** asserted after `settle()`, gated on `supportedEntryTypes`; the custom input revealing inside a
dialog is the specific movement it measures here.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes;
the feature is verified in a real browser in light and dark, desktop and mobile; nothing is left
behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

None. No package outside the `docs/SPEC.md` §3 pinned set, no binding added to `wrangler.jsonc` — the
reminder rides the `TASKS` queue and the `*/15` cron that are already declared and already wired — and
no third-party service. Two rows gate it and both close earlier: `ACC-05`
(`09-account-and-settings.md`, wave 2) for the channel the reminder is delivered on, and `TRP-02`
(`01-S8`, wave 5) for the form the control lives in. `TRP-02` lands at partial rather than done, and
that changes nothing here: what `01-S8` defers is the cover image's stock-photo search, and what this
stage needs from it is the reminder control, which `01-S8` ships.

## Cross-plan collisions

Two stages in the same wave that both take an exclusive disposition — `edit`, `new`, `create`,
`delete` — on one file clobber each other, because the runs that execute a wave go in parallel.
`append` is the documented cooperative disposition and is not a collision. This is checked by
measurement rather than by reading the sibling plans, because a plan can only read the siblings that
existed when it was written, and round 8 produced two real collisions in a set where every plan
carried an acceptance criterion about it.

Two checks, not one, and both are run rather than reasoned about. `check-plan-collisions.mjs` answers
the ownership question above. `check-plan-refs.mjs` answers two more that cost four blocking findings
in an earlier round: every `NN-Sn` token this file cites must be **defined** by a `## Stage` heading in
the plan whose prefix it carries, and an area plan must actually invoke Playwright rather than assert
that it was verified. Both outputs are pasted verbatim below.

The command and its output, verbatim, run against the full plan set — thirteen files, including the
five area plans that did not exist when this one was first drafted. Sibling plans are rewritten
**while this file is being written**, and the drift is watched rather than assumed: within one hour
the plan count moved 8 → 13, the stage count 48 → 91, and the owned-path total 284 → 554 → 553 → 535
→ 541; at the grilling revision of 2026-08-28 it read 16 · 105 · 682, three more plans (`13-community-gallery.md`,
`13-content-studio.md`, `14-dashboard-mascot.md`) having arrived and this revision having added its
own files. The two moves that are this plan's own are worth naming. The twenty per-stage spec and baseline
paths an earlier draft claimed became the two shared ones `12-verification-protocol.md` §4 fixes, so
eighteen owned paths left this file; and this revision added six back — the `trip-copy` handler, its
test, `src/server/queue/types.ts`, `src/server/queue/consumer.ts`, the reminder-and-statistics
side-effect test, and nothing else — when `01-S1`'s copy moved out of the request path. The rest of
the drift is other plans' edits. So the first line and the seventh are a timestamp, not a claim; the
two lines that carry this plan's obligation and must not move are the fifth — **no same-wave exclusive
collision** — and the nineteen stanzas under the seventh, every one of which is answered in the table
below.

```text
$ node scripts/ultrabuild/check-plan-collisions.mjs 01
plans 16 · stages 105 · owned paths 682

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (19) — legal; each plan must name the other:
  src/server/queue/types.ts
      00-foundations.md  00-S4  wave 0  (edit)
      01-trips-core.md  01-S1  wave 1  (edit)
      07-collaboration-and-sharing.md  07-S8  wave 4  (edit)
      13-community-gallery.md  13-S1  wave 3  (edit)
      13-community-gallery.md  13-S4  wave 6  (edit)
      13-content-studio.md  13-S6  wave 10  (append)
  src/server/queue/consumer.ts
      00-foundations.md  00-S4  wave 0  (edit)
      01-trips-core.md  01-S1  wave 1  (edit)
      07-collaboration-and-sharing.md  07-S8  wave 4  (edit)
      13-community-gallery.md  13-S1  wave 3  (edit)
      13-community-gallery.md  13-S4  wave 6  (edit)
      13-content-studio.md  13-S6  wave 10  (append)
  src/routes/_app/-server/overview.ts
      01-trips-core.md  01-S1  wave 1  (edit)
      01-trips-core.md  01-S7  wave 5  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
      10-administration.md  10-S3  wave 4  (edit)
  src/server/repos/trips.ts
      01-trips-core.md  01-S1  wave 1  (edit)
      01-trips-core.md  01-S6  wave 4  (edit)
      07-collaboration-and-sharing.md  07-S6  wave 2  (edit)
  src/server/repos/index.ts
      01-trips-core.md  01-S1  wave 1  (append)
      01-trips-core.md  01-S6  wave 4  (edit)
      06-documents-and-media.md  06-S3  wave 2  (append)
      06-documents-and-media.md  06-S5  wave 3  (append)
      07-collaboration-and-sharing.md  07-S10  wave 5  (edit)
      13-community-gallery.md  13-S1  wave 3  (append)
      13-content-studio.md  13-S1  wave 7  (append)
      13-content-studio.md  13-S2  wave 8  (append)
      13-content-studio.md  13-S4  wave 9  (append)
      13-content-studio.md  13-S5  wave 9  (append)
      13-content-studio.md  13-S6  wave 10  (append)
      13-content-studio.md  13-S7  wave 11  (append)
  src/routes/_app/trips/$tripId/plan.tsx
      01-trips-core.md  01-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
  src/routes/_app/trips/$tripId/-ui/plan-model.ts
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S7  wave 4  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
  src/routes/_app/trips/$tripId/-ui/plan-screen.tsx
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      01-trips-core.md  01-S9  wave 5  (edit)
      02-places-and-maps.md  02-S4  wave 3  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
  src/components/planner/day-section.tsx
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S4  wave 3  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
  src/components/planner/types.ts
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
  src/components/planner/index.ts
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
  src/components/planner/ordering.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
  src/components/planner/plan-dnd.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
  src/components/planner/__tests__/ordering.test.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
  src/server/repos/itinerary.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
      07-collaboration-and-sharing.md  07-S9  wave 3  (edit)
  src/routes/_app/trips/$tripId/-server/plan.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S7  wave 4  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
      07-collaboration-and-sharing.md  07-S1  wave 1  (edit)
  src/routes/_app/trips/$tripId/-ui/plan-actions.tsx
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S5  wave 3  (edit)
      02-places-and-maps.md  02-S10  wave 5  (edit)
      02-places-and-maps.md  02-S11  wave 6  (edit)
  src/routes/_app/dashboard.tsx
      01-trips-core.md  01-S5  wave 2  (edit)
      01-trips-core.md  01-S7  wave 5  (edit)
      14-dashboard-mascot.md  14-S1  wave 3  (edit)
  e2e/helpers/shoot.ts
      01-trips-core.md  01-S5  wave 2  (edit)
      10-administration.md  10-S2  wave 1  (edit)
$ echo $?
0
```

```text
$ node scripts/ultrabuild/check-plan-refs.mjs 01
plan 01: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
$ echo $?
0
```

**Neither of the two shared test files appears in either list, and that is the check agreeing rather
than the check missing them.** `src/server/repos/__tests__/tenant-isolation.test.ts` is claimed by
five stages here and by stages of several sibling plans, and `e2e/trips-core.visual.spec.ts` by ten
stages here; every one of those claims outside `01-S1`'s creating `new` is `append`, and the script
excludes `append` from `EXCLUSIVE` by construction — its own header names both a module's visual spec
and the isolation test as the two files the cooperative pattern exists for. The visual spec is
additionally absent from the cross-plan list because no sibling plan names it: `snapshotPathTemplate`
gives this plan its own baseline directory, and each sibling area plan owns exactly one spec file of
its own under the same §4 rule.

**No same-wave exclusive collision involves this plan.** The one that did — `01-S2` and `07-S1` both
claiming `src/routes/_app/trips/$tripId/-server/plan.ts` as `edit` in wave 1 — is resolved by this
plan yielding the file, and the resolution is argued in full under **The four planner core files**.
`01-S2` no longer names that path at all; the wave-2 claim that remains is `01-S4`'s, and wave 1 has
closed by then.

**Every cross-wave path the check lists is named in its owning stage, with the sibling stage id.** All
nineteen, in the order the check prints them:

| Path                                                 | This plan's stages          | Sibling stages, with wave                                                                                                                                  | Where this plan names them                                    |
| ---------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/server/queue/types.ts`                          | `01-S1`                     | `00-S4` (wave 0), `13-S1` (wave 3), `07-S8` (wave 4), `13-S4` (wave 6), `13-S6` (wave 10, `append`)                                                        | **Owned paths** of `01-S1`                                    |
| `src/server/queue/consumer.ts`                       | `01-S1`                     | `00-S4` (wave 0), `13-S1` (wave 3), `07-S8` (wave 4), `13-S4` (wave 6), `13-S6` (wave 10, `append`)                                                        | **Owned paths** of `01-S1`                                    |
| `src/routes/_app/-server/overview.ts`                | `01-S1`, `01-S7`            | `00-S5` (wave 0), `09-S7` (wave 2), `10-S3` (wave 4)                                                                                                       | **Owned paths** of `01-S1` and of `01-S7`                     |
| `src/server/repos/trips.ts`                          | `01-S1`, `01-S6`            | `07-S6` (wave 2)                                                                                                                                           | **Owned paths** of `01-S1` and of `01-S6`                     |
| `src/routes/_app/trips/$tripId/plan.tsx`             | `01-S2`                     | `03-S5` (wave 4)                                                                                                                                           | **Owned paths** of `01-S2`, shared-path table                 |
| `src/routes/_app/trips/$tripId/-ui/plan-model.ts`    | `01-S2`, `01-S4`            | `02-S7` (wave 4), `02-S9` (wave 5), `03-S8` (wave 6)                                                                                                       | Both stages' shared-path tables, and the four-file schedule   |
| `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx`  | `01-S2`, `01-S4`, `01-S9`   | `02-S4` (wave 3), `03-S5` (wave 4)                                                                                                                         | All three stages' **Owned paths**, and the four-file schedule |
| `src/components/planner/day-section.tsx`             | `01-S2`, `01-S4`            | `02-S4` (wave 3), `03-S5` (wave 4), `02-S9` (wave 5), `03-S8` (wave 6)                                                                                     | Both stages' shared-path tables                               |
| `src/components/planner/types.ts`                    | `01-S2`, `01-S4`            | `03-S5` (wave 4), `03-S8` (wave 6)                                                                                                                         | Both stages' shared-path tables                               |
| `src/components/planner/index.ts`                    | `01-S2`, `01-S4`            | `03-S5` (wave 4)                                                                                                                                           | Both stages' shared-path tables                               |
| `src/components/planner/ordering.ts`                 | `01-S4`                     | `03-S5` (wave 4)                                                                                                                                           | `01-S4`'s shared-path table                                   |
| `src/components/planner/plan-dnd.ts`                 | `01-S4`                     | `03-S5` (wave 4)                                                                                                                                           | `01-S4`'s shared-path table                                   |
| `src/components/planner/__tests__/ordering.test.ts`  | `01-S4`                     | `03-S5` (wave 4)                                                                                                                                           | `01-S4`'s shared-path table                                   |
| `src/server/repos/itinerary.ts`                      | `01-S4`                     | `07-S9` (wave 3), `02-S9` (wave 5)                                                                                                                         | **Owned paths** of `01-S4`, shared-path table                 |
| `src/routes/_app/trips/$tripId/-server/plan.ts`      | `01-S4`                     | `07-S1` (wave 1), `02-S7` (wave 4), `02-S9` (wave 5), `03-S8` (wave 6)                                                                                     | **Owned paths** of `01-S4`, the brief, the four-file schedule |
| `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` | `01-S4`                     | `02-S5` (wave 3), `02-S10` (wave 5), `02-S11` (wave 6)                                                                                                     | `01-S4`'s shared-path table, and the four-file schedule       |
| `e2e/helpers/shoot.ts`                               | `01-S5`                     | `10-S2` (wave 1)                                                                                                                                           | **Owned paths** of `01-S5`                                    |
| `src/routes/_app/dashboard.tsx`                      | `01-S5`, `01-S7`            | `14-S1` (wave 3)                                                                                                                                           | **Owned paths** of `01-S5` and of `01-S7`                     |
| `src/server/repos/index.ts`                          | `01-S1` (`append`), `01-S6` | `06-S3` (wave 2, `append`), `06-S5` (wave 3, `append`), `13-S1` (wave 3, `append`), `07-S10` (wave 5), `13-*` content-studio stages (waves 7–11, `append`) | **Owned paths** of `01-S1` and of `01-S6`                     |

Sibling plans are named by file the first time each appears above: `00-foundations.md`,
`02-places-and-maps.md`, `03-reservations-and-transport.md`, `06-documents-and-media.md`,
`07-collaboration-and-sharing.md`, `09-account-and-settings.md`, `10-administration.md`,
`13-community-gallery.md`, `13-content-studio.md` and `14-dashboard-mascot.md`.

Ten of the nineteen paths are new to this section since this plan's first draft, and all ten are the
planner cluster claimed by `02-…` and `03-…`; two more arrived with the queue revision, the registry
pair `01-S1` claims; the grilling revision added one — `src/routes/_app/dashboard.tsx`, which
`14-S1` now also edits in wave 3, between this plan's wave-2 and wave-5 claims — and put `01-S1`'s
`append` on the repository barrel beside the `13-*` appends that arrived with the two newest plans.
None is a collision. In every one of the nineteen, no two exclusive claims share a wave, and every
`append` is cooperative by construction. The naming obligation is met from this side for all nineteen;
where a sibling also names this plan — `00-S5`, `09-S7`, `10-S3`, `07-S1`, `07-S6`, `07-S9`, `07-S10`
and `10-S2` do — it is met from both.

**Three of the nineteen are named from one side only, and that is stated rather than glossed.**
`src/server/queue/types.ts` and `src/server/queue/consumer.ts` are claimed by `00-S4` in wave 0, by
`07-S8` in wave 4 and by the `13-*` stages listed above, and `src/routes/_app/dashboard.tsx` by `14-S1`
in wave 3; none of those stages names this plan — they were written before this
revision existed and neither file is this plan's to edit. The obligation the acceptance criterion
places on this plan is met: both paths are named in `01-S1`'s **Owned paths** with both sibling stage
ids and both waves. The reciprocal note is filed as a contract extension. Nothing about the schedule
depends on it: wave 0 closes before wave 1 opens and wave 4 opens after it closes, so the three claims
cannot run together whether or not the siblings mention this one.

The stages the check cannot read are `04-S2`, `11-S1`, `11-S2` and `11-S3` — **none of them this
plan's**. Their `### Stage id` line does not carry `` `<id>` · Wave <n> ``, so the parser cannot place
them in a wave. **Every stage in this file states its wave in that exact form**, which is what makes
this plan checkable at all — a stage with no wave is invisible to the check and silently exempt from
it. The two files that carry those four are not this plan's to edit, and the fix is filed as a
contract extension rather than made here.

`src/lib/markdown/**`, `src/routes/_app/trips/$tripId/-server/day-notes.ts`, `src/lib/local-preference.ts`,
`src/lib/trip-tab.ts`, `src/lib/clock-zones.ts`, `src/routes/_app/-lib/view-mode.ts`,
`src/server/queue/handlers/trip-copy.ts`, `src/server/queue/handlers/trip-purge.ts`,
`src/server/storage/objects.ts`, `src/server/repos/trip-favourites.ts`,
`src/server/repos/__tests__/member-isolation.test.ts`, `src/routes/_app/-ui/trip-copy-dialog.tsx`,
`src/routes/_app/-server/__tests__/trip-lifecycle-side-effects.test.ts` and
`src/routes/_app/trips/$tripId/-ui/plan-layout.ts` are new claims of this plan and appear nowhere else
in the plan set, in any wave — which is what makes the browser-preference module a single home for
five preferences rather than five scattered readers of `window.localStorage`. Four rows in other plans
consume the markdown module rather than re-owning it; that obligation is written into `01-S2`'s
**Owned paths** and into entry 5 of `11-S2`'s register.
