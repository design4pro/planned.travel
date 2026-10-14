# 03 — Reservations and transport

> **Migrated — frozen.** This area's backlog now lives on the tracker as **PRD #167**, and the
> tracker is its authority. This file takes no further edits: it is kept because un-migrated plans
> cite its stages to establish which stage holds a file in which wave, and deleting it would make
> those claims uncheckable. See `docs/adr/0004-sandcastle-replaces-ultrabuild.md`, the amendment of
> 2026-08-30, for the measurement and for the condition under which it can be deleted.

The trip's paperwork: the bookings a traveller reads back to a stranger at a desk, the legs between
them, the stay that covers a run of nights, and the confirmation file that could fill all three in
without anybody retyping it.

Ten rows carry the `BKG-` prefix in the materialised wave table in `docs/plans/README.md` — the
surviving record of the recon row store, which itself exists nowhere on disk or in git history. Two
of them do not survive the hosted multi-tenant boundary and are disposed of in
`11-boundaries-and-blockers.md`; one is blocked on a commercial decision nobody in this repository
can take; the remaining seven are built here, in eight stages.

## What is on disk today

There is no inventory file to read: the wave table in `docs/plans/README.md` maps rows to stages,
`docs/ARCHITECTURE.md` holds the platform shape, and every claim below is re-checkable with one
`grep` at the executing run's own HEAD. What matters for this file, measured at HEAD:

**Both screens exist and both are live against D1.** `src/routes/_app/trips/$tripId/book.tsx` (127
lines) loads `loadBookingDeskFn` and renders four stat tiles plus
`src/components/modules/book/bookings-timeline.tsx` (658 lines), which groups by date, edits status
from the card's own pill, copies a confirmation code and deletes behind a confirm dialog.
`src/routes/_app/trips/$tripId/transports.tsx` (132 lines) loads `loadTripTransports` and renders
`src/components/modules/transports/transports-timeline.tsx` (673 lines) with a connections analyser
(`connections.ts`, 309 lines) that already flags an impossible or a tight change between two legs.
Neither screen is a skeleton, and no stage here rewrites one.

**Both write paths exist.** `src/server/fns/reservations.ts` (307 lines) exposes `createBookingFn`,
`updateBookingFn`, `setBookingStatusFn`, `deleteBookingFn` and `loadBookingDeskFn`;
`src/server/fns/transports.ts` (196 lines) exposes `createLegFn`, `updateLegFn`, `setLegStatusFn`
and `deleteLegFn`. Both validate with Zod, both resolve a tenant scope through `appScope()` and both
mirror into the trip's Durable Object.

**The tables are richer than the screens.** `reservations` (`src/server/db/schema.ts`)
already carries `day_id`, `end_day_id`, `place_id`, `assignment_id` and `transport_id`, and only the
first is ever set from the product. `transports` (`:644-692`) already carries a departure and an
arrival endpoint each with a code, a coordinate pair and an IANA zone, and the form writes them as
free text. `day_accommodations` (`:605-638`) is complete — day range, check-in window, check-out,
confirmation number, price — and `src/routes/_app/trips/$tripId/-server/plan.ts:218` reads exactly
one field of it, the name.

**The import is a finished engine with nothing attached to either end.**
`src/server/queue/handlers/booking-import.ts` (257 lines) reads a source object from `FILES`, parses
a calendar through `src/server/queue/ics.ts` or a JSON export through its own schema, classifies
each row, extracts a reference code, stages the result in `KV` under `import:<jobId>` for 24 hours
and pokes the trip's room so an open tab hears about it. It is registered in the consumer at
`src/server/queue/consumer.ts:81`. `grep -rn "booking-import" src/` returns the type, the registry,
the switch arm and the handler — and **no producer anywhere**; repeat that grep at your own HEAD
rather than trusting this sentence. There is no UI that could reach it.

**One dead export, found while reading and named rather than removed by surprise.**
`src/routes/_app/-server/trip.ts:408` exports `loadTripBookings`, and `grep -rn loadTripBookings src/
e2e/` returns only its own definition: the booking desk moved to `loadBookingDeskFn` and this loader
lost its last caller. `03-S2` deletes it together with the loader this plan's own work orphans, and
says so under **Owned paths** rather than leaving two unreachable server functions behind.

## The ten rows, and the stages that close them

| Row      | Stage           | Wave | Effort | Status move                              |
| -------- | --------------- | ---- | ------ | ---------------------------------------- |
| `BKG-06` | `03-S1`         | 1    | M      | partial → done                           |
| `BKG-07` | `03-S2`         | 2    | L      | absent → done                            |
| `BKG-08` | `03-S3`         | 3    | L      | absent → done                            |
| `BKG-02` | `03-S4`         | 3    | M      | partial → done                           |
| `BKG-10` | `03-S5`         | 4    | M      | absent → done                            |
| `BKG-01` | `03-S6`         | 4    | M      | partial → done                           |
| `BKG-03` | `03-S7`         | 5    | L      | partial → done                           |
| `BKG-05` | `03-S8`         | 6    | L      | partial → done                           |
| `BKG-04` | `03-S7`         | 5    | —      | absent → done (hosted shape, ADR 0012)   |
| `BKG-09` | none — excluded | —    | —      | `11-boundaries-and-blockers.md`, `11-S1` |

### The one exclusion, and the one that came back

`BKG-09` is **not planned here and carries no stage**. It is disposed of in
`docs/plans/11-boundaries-and-blockers.md`, stage `11-S1`, which argues why the shape does not survive
one deployment serving every tenant, and records that it has no hosted equivalent. Nothing in this
file plans around it, and no stage below may quietly re-import it: a per-tenant credential for a
third-party account is the exact shape `11-S1` refused.

`BKG-04` was excluded on the same argument and **is not any more**. `11-S1` refused it because the
reference implements it with a model credential each tenant supplies, and a per-tenant third-party
credential is the shape that does not survive hosting. ADR 0012 supersedes that disposition without
disturbing the rule behind it: the extraction runs on the platform's own Workers AI binding, so there
is no tenant credential to hold, and the cost is metered per tenant in `resolveLimits()` like every
other ceiling. What `11-S1` refused is still refused. What returns is the capability, in the only
shape a hosted product can carry it, and it is built in `03-S7` beside the deterministic extractor
rather than in a stage of its own — one import, with a second reader behind it, is one concept.

### The row that was blocked, and the three decisions that unblocked this file

**No row in this plan is blocked any more.** Three of the open decisions `11-S3` was holding have been
taken, and each has an ADR that carries the argument so no stage below has to repeat it:

- **ADR 0011** buys public-transit routing from HERE, behind our own proxy, with a cross-tenant cache
  and a per-tenant ceiling. `BKG-08` stops being a record and becomes a build: `03-S3` moves from wave
  2 to **wave 3**, because a found connection is saved as the station chain `03-S2` builds in wave 2,
  and two stages in the same wave may not depend on each other.
- **ADR 0010** settles the airport reference dataset. It is not a provider decision at all: the source
  is public-domain, the artefact is built at build time into the catalogue, and there is no runtime
  call to license. `BKG-07` therefore reaches **done** in `03-S2` rather than stopping at `partial`.
- **ADR 0012** binds Workers AI for confirmation extraction, which is what brings `BKG-04` back and
  carries `BKG-03` to **done**.

The `11-S3` register still holds decisions this plan does not touch. ADR 0013 takes a fourth one —
geocoding, from Geoapify — because `03-S7` needs a pin for the address it extracts; but that decision
belongs to `02-places-and-maps.md`, whose Gate A it closes, and `03-S7` calls the proxy that plan
mints in `02-S4`, its wave 3, rather than minting one of its own.

## The order of the stages, and the dependency edges it satisfies

`X → Y` reads "X depends on Y", the direction the cut-edge table in `docs/plans/README.md` uses.

| Edge              | Supplier                                       | Satisfied because |
| ----------------- | ---------------------------------------------- | ----------------- |
| `BKG-07 → BKG-06` | `03-S1`, wave 1                                | `03-S2` is wave 2 |
| `BKG-08 → BKG-06` | `03-S1`, wave 1                                | `03-S3` is wave 3 |
| `BKG-08 → BKG-07` | `03-S2`, wave 2                                | `03-S3` is wave 3 |
| `BKG-02 → MNY-02` | `04-budget-and-currencies.md`, `04-S3`, wave 2 | `03-S4` is wave 3 |
| `BKG-10 → TRP-08` | `01-trips-core.md`, `01-S4`, wave 2            | `03-S5` is wave 4 |
| `BKG-10 → BKG-06` | `03-S1`, wave 1                                | `03-S5` is wave 4 |
| `BKG-10 → BKG-07` | `03-S2`, wave 2                                | `03-S5` is wave 4 |
| `BKG-01 → ACC-04` | `09-account-and-settings.md`, `09-S8`, wave 3  | `03-S6` is wave 4 |
| `BKG-03 → DOC-01` | `06-documents-and-media.md`, `06-S1`, wave 1   | `03-S7` is wave 5 |
| `BKG-03 → BKG-02` | `03-S4`, wave 3                                | `03-S7` is wave 5 |
| `BKG-05 → TRP-06` | `01-trips-core.md`, `01-S9`, wave 5            | `03-S8` is wave 6 |
| `BKG-05 → BKG-02` | `03-S4`, wave 3                                | `03-S8` is wave 6 |

**One edge the row graph does not carry, and the wave order has to.** `src/server/repos/reservations.ts`
is claimed **once** in this plan, by `03-S4` in wave 3, and two later stages write columns that live
on that table: `03-S6` (wave 4) clears `reservations.imported_at` when a reader saves a booking, and
`03-S7` (wave 5) sets it when an import is confirmed. Neither owns the file, so neither can add a
writer — and neither can smuggle the value through the booking payload, because both validators in
front of it are `z.object`s that strip an unknown key without complaining. `03-S4` therefore mints
`markReservationsImported` and `clearReservationImported` alongside its own `linkReservationExpense`,
three and two waves before their callers exist — **and files `reservations.imported_at` itself**, in
its own **Data and migration** section, because a repository function cannot be written in wave 3
against a column a wave-5 stage files for a later migration. The full argument is in that stage's
**Server** section; it is repeated here because a reader checking the wave order is the reader most
likely to ask why a wave-3 stage exports a function nothing in wave 3 calls and declares a column
nothing in wave 3 reads.

Three edges point **out** of this file and are named with the plan that supplies them, as the
sibling plans do:

- **The merged day timeline** that `03-S5` places transport rows into is built by `01-S4`
  (`01-trips-core.md`, wave 2). That stage's **UI** section names the extension point in those terms:
  `PlannerItem` is a union, `mergeDayTimeline` reads only `{ id, position, time }`, "so a third kind
  is one variant in the union, one prefix in the id space and one renderer". `03-S5` fills exactly
  that seam and nothing wider.
- **The expense ledger** that `03-S4` writes into is owned entirely by `04-budget-and-currencies.md`.
  `04-S3` (`MNY-02`, wave 2) owns editing an expense; `04-S1` (`MNY-07`, wave 1) owns the frozen-rate
  columns. `03-S4` calls `createExpense`, `updateExpense` and `getExpense` as they are exported today,
  changes not one line of `src/server/repos/expenses.ts`, and keeps its half of the link on
  `reservations.expense_id`, a column on a table it owns. Its **Owned paths** section gives the
  ownership reason, which is not merely stylistic: `expenses.ts` carries an exclusive claim in every
  wave from 0 to 3, including `03-S4`'s own.
- **The file library** that `03-S7` uploads a confirmation file through is `DOC-01`, closed by
  `06-S1` (`06-documents-and-media.md`, wave 1). `03-S7` depends only on behaviour already on disk —
  `uploadTripFileFn`, `recordFile`, the R2 storage key — and not on anything `06-S1` adds, which is
  why it can sit at wave 5 without waiting on that file's own schedule. Reservation **attachments** —
  a file linked to a booking — are `DOC-04`'s, closed by `06-S6` (same plan, wave 4), whose own
  reference rows name `BKG-02` for the same reason; they are deferred there by name in `03-S4`.

## Three disagreements with the inputs, each with its own evidence

A plan that silently routes around a stale input is how two documents come to disagree without anyone
noticing. These three are stated up front.

### 1. The item's sequencing sentence asks for the opposite of the recorded edge

The instruction that produced this file asks that "`BKG-07` is sequenced before `BKG-06` and
`BKG-10`". The first half of that cannot be satisfied without reversing a cut this repository already
made and recorded, and it contradicts the criterion in the same list that says stage order must
satisfy every `dependsOn` edge. Measured, three ways:

1. The cut-edge table in `docs/plans/README.md` records the removed edge as `BKG-06 → BKG-07` with
   the reason "The transport record must exist before its endpoint pickers can edit it." The
   surviving edge is the other one: `BKG-07 → BKG-06`.
2. The same file's wave table places `BKG-06` in wave 1 and `BKG-07` in wave 2 on this plan's rows,
   which is that edge applied.
3. The edge table above in this file materialises `BKG-07 → BKG-06` as an edge every stage order
   here must satisfy.

So this plan sequences `BKG-06` (`03-S1`, wave 1) before `BKG-07` (`03-S2`, wave 2), and `BKG-07`
before `BKG-10` (`03-S5`, wave 4) — which is the half of the instruction that the edge set does
support, and which the three `BKG-10` edges in the table above (`BKG-10 → TRP-08`,
`BKG-10 → BKG-06`, `BKG-10 → BKG-07`) require. Reversing
the first pair would put the station-chain editor in front of the record it edits, and the stage that
executed it would have nothing to open.

### 2. `BKG-06` names nine transport types; we already ship twelve

The row asks for nine. `TRANSPORT_MODES` (`src/server/db/schema.ts`) already declares twelve
— walk, bike, car, taxi, transit, bus, train, tram, metro, ferry, flight, other — each backed by a
generated `CHECK` constraint and each already labelled and icon-mapped in
`src/components/modules/transports/leg-form.ts:11-24` and `mode-icon.ts`. **`03-S1` narrows nothing.**
Where the row's nine and our twelve differ, ours is a superset, and a stage that removed three modes
to match a count would break existing rows against a `CHECK` constraint for no product reason.

### 3. Two stages state a wave later than their row's floor, and both for the same measured reason

`README.md` reads its own table as "**this stage may start once every wave above it is closed**",
which is a floor and not a fixture. Two stages here sit one wave above their floor, each because the
floor would have put two exclusive claims on one file in one wave — which
`scripts/ultrabuild/check-plan-collisions.mjs` was written to report as a clobber, correctly, because
that is what it is. That script is **absent at `HEAD`** and the **Cross-plan collisions** section at
the foot of this file says so and says what replaces it; where this file names the check, it is naming
the rule, not a command a reader can run. Neither move violates an edge: **no plan file names `BKG-03` or `BKG-10` as a supplier** —
re-measurable with `grep -rn "BKG-03\|BKG-10" docs/plans/`, whose every cross-plan hit is a
disposition, a host-and-seam note or an edge pointing the other way — so no other plan slips by a
single wave.

- **`03-S7` (`BKG-03`) states wave 5**, floor 4. `BKG-01` and `BKG-03` both land in wave 4 and both
  need the desk route `src/routes/_app/trips/$tripId/book.tsx`. The alternative — splitting the desk
  into two files so two agents could edit it at once — would be a refactor performed to satisfy a
  scheduler, which is the wrong reason to move code.
- **`03-S5` (`BKG-10`) states wave 4**, floor 3, and it is the stage this plan had to fit around
  everybody else. The planner's day surface is the most contended part of the repository:
  `src/components/planner/day-section.tsx` alone is claimed by `01-S2` (wave 1), `01-S4` (wave 2),
  `02-S4` (wave 3) and `02-S9` (wave 5), and `-server/plan.ts` and `-ui/plan-model.ts` are claimed by
  `07-S1`, `01-S4`, `02-S7` and `02-S9` between waves 1 and 5. **There is no wave in which one stage
  could hold all of them.** So this one takes the wave in which its own files are free — 4 — and
  splits its server work into a route-local module of its own rather than taking `-server/plan.ts` in
  a wave where a sibling holds it. What that costs is one honest trade-off about a two-call reorder,
  written out under that stage's **Server** heading with the four properties that bound it and the
  small change that removes it later. What it buys is that no agent's work is overwritten, which is
  the thing the wave column exists to guarantee.

## Conventions that bind every stage in this file

- **Money is integer minor units plus a `text(3)` ISO-4217 currency, never a float.** Every column
  this plan reads or asks for follows the `minor()` and `currency()` helpers already in
  `src/server/db/schema.ts`: `reservations.price_minor` + `reservations.currency`,
  `transports.price_minor` + `currency`, `day_accommodations.price_minor` + `currency`,
  `expenses.amount_minor` + `currency`. No stage introduces a second money convention, and no stage
  divides before it stores. On screen every one of them is rendered by `formatMoneyMinor`
  (`src/lib/format.ts:509`) with `tabular-nums`, because a number that changes must not move the
  column it sits in.
- **Dates are `YYYY-MM-DD` text, times `HH:MM` text, instants epoch milliseconds, ids `newId()`.**
  Unchanged from `src/server/db/schema.ts`; no stage invents a fifth shape.
- **SQL lives only in `src/server/repos/**`.** Every read and write below is a repository function
  built on `tenantFilter()` from `src/server/repos/base.ts`, which starts every statement from
  `eq(table.organizationId, scope.ctx.organizationId)` and lets a caller only `AND` onto it.
- **Authorisation is decided in the handler, never in `beforeLoad`.** Every server function starts at
  `appScope()` (`src/server/fns/context.ts`) and re-resolves the trip with `requireTrip`, because a
  server function is a public endpoint reachable without the route that renders its UI and a
  well-formed id from the client is not an authorised id.
- **Nothing slow runs inline.** The only slow thing here is the import, and it goes on `TASKS`
  through the producer `03-S7` builds.
- **One spec file for the whole plan.** `e2e/reservations-and-transport.visual.spec.ts`, per
  `12-verification-protocol.md` §4: `03-S1` creates it, every later stage **appends** its own
  `test.describe` block named for the stage. `e2e/visual.spec.ts` is never touched.
- **Every stage states its wave in the form the collision check parses**, `` `<id>` · Wave <n> ·
effort **S|M|L**. `` on the line under `### Stage id`, because a stage with no parseable wave is
  invisible to `check-plan-collisions.mjs` and cannot be cleared.
- **`src/server/db/schema.ts` is cited by symbol, never by line.** Every other file in this plan may
  carry a line number and does, because those files are stable and the numbers verify. The schema is
  the one file every plan in the set files columns onto, so it grows continuously and a line number
  into it rots for everybody at once — an earlier draft cited `TRANSPORT_MODES` at a line that now
  holds a comment about sort keys and `EXPENSE_CATEGORIES` at one that now holds a coordinate check.
  A table name, a column name or an exported tuple is unique under `grep` and survives the growth.
- **The vocabulary is `CONTEXT.md`'s, and three words in it are easy to get wrong.** A **leg** is the
  part of a transport between two consecutive stations, never a whole transport and never a
  "leg"; a **stay** is the lodging across a run of nights, and "accommodation" names the table
  rather than the concept; a **stop** is a place put on a day at a position in that day's order, and
  a booking is linked to one. A **reservation** is the record; "booking desk" is the screen it is read
  on, not a second name for it.

### The six shared paths, and what this plan asks of them

`README.md` forbids any feature stage from claiming `src/server/db/schema.ts`, `src/server/worker.ts`,
`wrangler.jsonc`, `src/styles/tokens.css`, `src/components/ui/**` or `src/routeTree.gen.ts`. **No
stage below lists any of them under Owned paths.** Every schema change this plan needs is therefore
filed onto a schema stage of `00-foundations.md`, and this section says **which one**, because an
earlier draft filed all six onto the wave-0 stage and five of them had no owner.

**How the filing works, read off `00-foundations.md` rather than assumed.** Its shared-file table
gives `src/server/db/schema.ts` to "**one schema stage per wave**", whose ritual is to "collect every
column and table **the next wave** asked for", and its **stage register** mints the wave-1 through
wave-6 instances "when the wave opens, taking the next free `00-S<k>` id". So the supplier of a
requirement filed by a stage in wave _n_ is the schema stage of wave _n − 1_, and only a wave-1 filer
is supplied by `00-S1` — which is exactly what `00-S1`'s own closing clause says it absorbs
("any **Data and migration** requirement filed by a wave-1 stage in plans 01–11"). A requirement from
a later wave that names `00-S1` names a stage that has already closed and will not carry it.

| Requirement                             | Asked by, in wave | Supplier: `00-foundations.md` schema stage         | Kind            |
| --------------------------------------- | ----------------- | -------------------------------------------------- | --------------- |
| `transports.arrival_day_id`             | `03-S1`, wave 1   | `00-S1`, wave 0 — named, and inside its own clause | additive column |
| `transport_legs` table                  | `03-S2`, wave 2   | the **wave-1** schema stage of the register        | additive table  |
| `airports` table (no `organization_id`) | `03-S2`, wave 2   | the **wave-1** schema stage of the register        | additive table  |
| `reservations.expense_id`               | `03-S4`, wave 3   | the **wave-2** schema stage of the register        | additive column |
| `reservations.imported_at`              | `03-S4`, wave 3   | the **wave-2** schema stage of the register        | additive column |
| `user_settings.mask_confirmation_codes` | `03-S6`, wave 4   | the **wave-3** schema stage of the register        | additive column |
| `day_accommodations.reservation_id`     | `03-S8`, wave 6   | the **wave-5** schema stage of the register        | additive column |

Three requirements are filed on different registers in the same file, and are named here so that no
reader has to find them inside a stage:

| Requirement                         | Asking stage    | Supplier                                                         |
| ----------------------------------- | --------------- | ---------------------------------------------------------------- |
| the **`AI` binding**                | `03-S7`, wave 5 | the **wave-4** bindings stage of `00-foundations.md`             |
| metric `transit_searches_per_month` | `03-S3`, wave 3 | the **wave-2** quota stage of `00-foundations.md`, with its test |
| metric for the extraction calls     | `03-S7`, wave 5 | the **wave-4** quota stage of `00-foundations.md`, with its test |

Neither `wrangler.jsonc` nor `src/server/billing/limits.ts` nor
`src/server/billing/__tests__/limits.test.ts` appears in any stage's **Owned paths** in this plan.
Quota metrics are a wave-0 concern in `README.md`'s own table, for the same reason schema is: a stage
cannot sit in the same wave as the stage that supplies it.

The wave-1, wave-2, wave-3 and wave-5 stages have no id yet, because the register mints ids as waves
open; they are cited by wave, which is the only stable name they have, and the filing stage restates
the requirement under its own **Data and migration** heading exactly as the ritual requires. Four
`pnpm db:generate` runs across the plan's life, not one, which is what "one schema stage per wave"
means.

**`reservations.imported_at` is asked for by `03-S4`, not by the stage whose behaviour needs it**,
and that is the whole reason this table changed. `src/server/repos/reservations.ts` is claimed exactly
once in this plan, by `03-S4` in wave 3, so `markReservationsImported` and `clearReservationImported`
can only be minted there — and a repository function cannot be written in wave 3 against a column that
arrives in wave 4. Filing the column with its writer puts the two in the same wave and makes the stage
compile; `03-S7` (wave 5) and `03-S6` (wave 4) then read and call, and neither declares a column.

**Asking for a column is not the same as being able to write it.** A column whose asking stage owns no
repository file is a column silently stripped by the `z.object` standing in front of it — the defect
`03-S8` records against `day_accommodations.reservation_id` and closes by owning two lines of
`src/server/repos/itinerary.ts` in the one wave where that file is free. Every requirement above is
filed by a stage that either owns the writing repository itself (`03-S1`, `03-S4`, `03-S6`, `03-S8`)
or creates the table outright (`03-S2`).

Every one is additive: nullable or defaulted, nothing dropped, nothing renamed, nothing narrowed, so
a rollback keeps working against the new schema (`ARCHITECTURE.md` §9). No stage needs a token that
`src/styles/tokens.css` does not already carry, no stage needs a primitive
`src/components/ui/index.ts` does not already export. **One stage needs a binding `wrangler.jsonc`
does not declare** — `03-S7` needs `AI`, per ADR 0012 — and it is filed onto the wave-4 bindings stage
of `00-foundations.md` under that stage's **Blockers**, in the same way the schema requirements below
are filed. No stage claims `wrangler.jsonc`.

## Clean-room

The upstream project is **the reference product** and is never named. Its wiki pages are cited as
`` `wiki: <Page-Name>` `` with no URL: this area studied `wiki: Reservations-and-Bookings`,
`wiki: Accommodations`, `wiki: Transport-Flights-Trains-Cars` and `wiki: AI-Booking-Import`. No
sentence, column name, enum value or interface string is carried across. Where a behaviour needed a
name, it was named in this product's own vocabulary against the tables already in
`src/server/db/schema.ts` — which is why the import marker below is a nullable instant called
`imported_at` rather than the boolean flag the reference keeps, and why the reader's privacy switch
is `mask_confirmation_codes` in the idiom of the `reduce_motion` column beside it.

---

## Stage 03-S1 — A transport that knows which day it leaves and which day it lands

### Stage id

`03-S1` · Wave 1 · effort **M**. The first stage of this plan and the one every other transport stage
opens on top of.

### Reference rows

- `BKG-06` partial → **done**.

Sourced from `wiki: Transport-Flights-Trains-Cars` for the behaviours: a movement between two
endpoints belongs to a day rather than to a bare timestamp, its arrival day may be a different day
from its departure, and a hire car is described by the words _pick up_ and _return_ rather than
_departure_ and _arrival_.

**Agreement with the row, and the two parts of it that are not this stage's.** The row is right that
`src/routes/_app/trips/$tripId/transports.tsx` writes through `createLegFn`/`updateLegFn`/
`setLegStatusFn`/`deleteLegFn`, that `TRANSPORT_MODES` has twelve values, and that endpoints are free
text. Two named behaviours are deliberately elsewhere:

- **The endpoint pickers** are `BKG-07`'s (`03-S2`, wave 2). The recorded cut says why in one line:
  the record must exist before its endpoint pickers can edit it. This stage leaves endpoint entry
  exactly as it is — a name, an optional code — and changes only its labels.
- **The count of types** is not narrowed; see the Area brief's second disagreement.

Rows unblocked: `BKG-07` (`03-S2`), `BKG-08` (`03-S3`), `BKG-10` (`03-S5`), and `MAP-09`
(`02-places-and-maps.md`, wave 4), which draws the leg on the map and needs the record to be
complete first.

### Owned paths

- `src/server/repos/transports.ts` — edit. `arrivalDayId` joins `transportFields`; both day
  references are guarded against the leg's own trip.
- `src/server/fns/transports.ts` — edit. `loadTransportDeskFn` is added beside the four writers, and
  the two write validators gain the arrival day.
- `src/routes/_app/trips/$tripId/transports.tsx` — edit. The loader switches to the desk function;
  the four stat tiles keep their arithmetic.
- `src/components/modules/transports/leg-form.ts` — edit. The draft gains two day fields;
  `endpointLabels` gains the hire-car case; `validateLegDraft` gains the day-order rule.
- `src/components/modules/transports/leg-dialog.tsx` — edit. Two day selects, and the relabelled
  legend.
- `src/components/modules/transports/transports-timeline.tsx` — edit. The card shows which day it
  belongs to, and its date formatter is replaced by the shared one — see **Verification**. The
  rename from `legs-timeline.tsx` — the vocabulary fix below, not a tidy-up — already landed ahead
  of this stage, so this entry is an edit only.
- `src/components/modules/transports/types.ts` — edit. `TransportData`, already renamed from
  `LegData` ahead of this stage, gains `departureDayId`, `arrivalDayId`.
- `src/components/modules/transports/index.ts` — edit. The two new exports.
- `src/components/modules/transports/__tests__/leg-form.test.ts` — edit. Extended, never rewritten.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/reservations-and-transport.visual.spec.ts` — new. This plan's spec file, per
  `12-verification-protocol.md` §4.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — new. Its baseline directory.

**Paths deliberately not claimed.** `src/routes/_app/-server/trip.ts` holds `loadTripTransports`
(`:354`) and is claimed by `07-S1` — read as `07-S2` in `07-collaboration-and-sharing.md` — in
**wave 1**, the same wave as this stage. Claiming it here would be the exact same-wave clobber
`check-plan-collisions.mjs` exists to catch, so this stage adds its loader to
`src/server/fns/transports.ts` instead and leaves the old one in place, orphaned, for `03-S2` to
delete in wave 2. That is stated rather than hidden: for the length of wave 1 the repository carries
one unreferenced server function, and the stage that created the condition is the stage that names
the stage which clears it.

### Data and migration

**One additive column, filed onto `00-S1`, the wave-0 schema stage of `00-foundations.md`, not
declared here.** This stage is wave 1, so `00-S1` is its supplier by the register's own rule — and it
is the one requirement in this plan that falls inside `00-S1`'s closing clause verbatim, which absorbs
"any **Data and migration** requirement filed by a wave-1 stage in plans 01–11". The other five
requirements of this plan are filed onto later schema stages; the table under **The six shared paths**
says which.

- `transports.arrival_day_id` — `text`, **nullable**, `REFERENCES days(id) ON DELETE SET NULL`, with
  `index('transports_arrival_day_idx').on(t.arrivalDayId)`. It sits beside the existing
  `day_id` (`transports` in `src/server/db/schema.ts`), which from this stage forward is read as the **departure**
  day. No column is renamed: `day_id` keeps its name, its index (`transports_day_idx`, `:686`) and its
  meaning for every row already written, and the new column is simply the second end of the same
  journey. A rollback reads `day_id` exactly as it does today and ignores a column it does not know.
- Migration: the next ordinal `pnpm db:generate` mints in the `drizzle/` series — three files exist
  today (`0000`, `0001`, `0002`), so the generator picks up from there rather than from a number this
  document guesses. It **backfills nothing**: every existing leg keeps `arrival_day_id` null, which
  reads as "the arrival day was never recorded", which is true.

Nothing else. `transports` already holds the carrier, the service number, the booking code, the seat,
both endpoint names and codes, both coordinate pairs, both zones, both dates and both times
(`:644-692`). Its money is already this repository's one convention and this stage does not touch it:
`price_minor` is an **integer count of minor units** and `currency` is a `text(3)` ISO-4217 code
(through the shared `minor()` and `currency()` helpers in `src/server/db/schema.ts`). No float
is written, no float is read, and no amount is divided before it is stored. Every read and write in
this stage goes through `transportsRepository`, whose statements begin at `tenantFilter()` on
`organization_id`, the leading column of `transports_org_trip_idx`.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/transports.ts`.** `transportFields` gains
`arrivalDayId: idSchema.nullish()`, so both `createTransportInput` and `updateTransportInput` accept
it without a second schema. `createTransport` and `updateTransport` each resolve **both** day
references through `requireTripDay(scope, tripId, dayId)` (`src/server/repos/days.ts`), which already
refuses a day belonging to another trip — the same guard the module applies to `dayId` today. A leg
whose arrival day precedes its departure day is refused in the repository as well as in the form,
because the form is a convenience and the repository is the rule.

No new SQL shape: both are `createTenantRepository` writes, `organization_id` is stamped on insert and
cannot be supplied by the caller, and every read continues through `transportsRepository`, whose every
statement begins at `tenantFilter()`.

**Server function — `src/server/fns/transports.ts`.**

- `loadTransportDeskFn` — `createServerFn({ method: 'GET' })`, validator
  `z.object({ tripId })`. Returns the trip's currency, the legs with their two day references, the
  per-mode totals, the trip's total distance, **and the trip's days** as `{ id, dayNumber, date,
title }`. The last of those is why it exists: an editable screen cannot offer "which day does this
  leave on" without the list of days, and the read-only loader it replaces never carried one. This is
  the same split `loadBookingDeskFn` already makes for the booking desk, whose own docstring gives
  the same reason — so this stage follows a pattern already in the repository rather than inventing
  a second one.
- `createTransportFn` / `updateTransportFn` — renamed from `createLegFn` / `updateLegFn`, and their
  existing Zod objects gain `arrivalDayId` as the same
  `''`-means-unset trimmed string the other optional fields use, normalised with `orNull` before it
  reaches the repository.

**Zod, in v4 idiom.** `z.object` with explicit `.trim().max()` bounds on every string, `z.enum` for
mode and status, the `error` parameter for a message a person reads. No `z.string().email()`-era
spellings are introduced.

**Authorisation, and the gap this stage names rather than closes.** In the handler: `appScope()`
then `requireTrip(scope, data.tripId)` before any read or write, on all five functions. Validation is
shape; permission is the trip lookup inside the tenant scope.

That is membership, and membership is not a role. `requireTrip` (`src/server/repos/trips.ts:152`)
takes no role argument and never has, so **a `viewer` who is on the trip can write a transport
today** — the Durable Object already refuses them (`src/server/do/trip-room.ts:358` compares
`session.identity.role !== 'editor'`), which is exactly the asymmetry that makes the hole easy to
miss: the collaborative surface says no and the server function says yes. The guard that closes it is
`assertTripRole(scope, tripId, allowed)`, and `01-S1` (`01-trips-core.md`) mints it in **wave 1** —
this stage's own wave. Two stages in one wave may not depend on each other, so this stage cannot call
it, and inventing a second guard here to fill one wave is how a repository ends up with two
authorisation helpers that disagree.

So the hole is named here and closed one wave later: **`03-S2` puts `assertTripRole` into the
transports repository in wave 2**, where the helper exists and where that file is claimed again
anyway. `03-S4` does the same for reservations in wave 3 and `03-S8` for accommodations in wave 6 —
in the repositories rather than in the handlers, so the rule holds for the queue consumer and for any
future route as well as for these server functions, which is the placement argument `01-S1` makes for
the guard itself. Whoever implements this stage must not quietly add a role check of their own: the
gap is one wave long, it is written down, and the stage that closes it is named.

**Realtime.** The four writers keep their existing `mirrorToRoom` calls unchanged —
`patch('route', …)` at `src/server/fns/transports.ts:138`, `:157` and `:180`,
`tombstone('route', …)` at `:193` — because `route` is the kind `TRIP_ENTITY_KINDS` declares for a
transport row (`src/server/do/protocol.ts:54`, in the list at `:50-60`). The day reference travels
in the mirrored patch as one more field on the `route` entity, well inside the 32 KiB frame and the
40 msg/s ceiling in `src/server/do/protocol.ts`. Nothing here is slow, so nothing is enqueued.

### UI (route, components)

**Route.** `src/routes/_app/trips/$tripId/transports.tsx`, edited in place. **No route file is added
or moved, so `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an owned path.** The
route keeps the default SSR: the screen is text and numbers, it is the fastest thing on the tab, and
a client-only render would trade a good first paint for nothing.

**Components reused, not rebuilt.** `Dialog`, `Field`, `Input`, `SimpleSelect`, `Textarea`, `Button`,
`Alert`, `Badge` and `EmptyState` from `src/components/ui`; `ModulePanel`, `FilterRow`, `RowMenu`,
`StatusMenu`, `ConfirmDialog`, `CopyValue`, `FactList`, `useAction` and `useOptimistic` from
`src/components/modules/shared`. **No new primitive is proposed and no new one is needed** — the day
reference is a select over a bounded list, which `SimpleSelect` already is.

**What changes on screen.**

- The dialog grows a **Departure day** and an **Arrival day** select, each defaulting to "No day yet"
  and each listing the trip's days as `Day 3 · Fri 9 Oct` — the day number first, because that is how
  a person refers to a day of their own trip, with the date as the disambiguator.
- Choosing an arrival day earlier than the departure day is refused inline under the second select,
  with the reason written as a sentence rather than a code.
- **Hire-car relabelling.** `endpointLabels(mode)` already answers `From airport` / `To airport` for a
  flight and `From port` / `To port` for a ferry. `car` gains `Pick-up` / `Drop-off`, and the two day
  selects follow: `Pick-up day` and `Return day`. One function decides all four strings, so the labels
  cannot drift apart.
- The card in the timeline gains a quiet day chip beside its date — `Day 3` — and shows both when the
  leg spans two days, which is the case the row is actually about.

**States, named rather than asserted.**

- _Empty._ The legs list already has an `EmptyState`; its copy is re-pointed at the new affordance:
  heading "No legs yet", body "Add the flight, the train or the hire car and the days it covers", and
  the primary action opening the dialog. On `--color-surface-2`, with the mode glyph at 20% ink as the
  illustration.
- _Skeleton._ `HeaderSkeleton` and `StatsSkeleton` from `src/routes/_app/trips/$tripId/-ui/scaffold`
  already cover the route's `pendingComponent`; a `RowsSkeleton` of five rows is added beneath them so
  the list does not pop in under a header that has already settled. Skeleton surfaces are
  `--color-surface-2` on `--color-surface`.
- _Error._ The route's `errorComponent` is `ErrorPanel`, unchanged. A **failed write** keeps the
  dialog open, restores the draft exactly as typed and states the server's message in the dialog's
  `Alert`; `useAction` already carries that contract and this stage does not weaken it.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the two new selects,
  the dialog's save button (which shows its spinner and keeps its width, so the button does not
  resize mid-write) and the card's day chip.

**Motion.** Nothing new. The dialog's existing enter/exit stays at `--duration`/`--duration-fast` on
`--ease-out-quint`, transform and opacity only, and collapses under `prefers-reduced-motion: reduce`
through the shared primitive.

**Tokens.** None missing. Spacing is `--space-*` on the 4px grid, the card keeps `--radius-xl` and
`--shadow-card` with its dark re-declaration, and both day chips inherit `--color-ink-3` on
`--color-surface-2`, which is a pair already checked at AA in both themes.

### Quota

**No countable row, and the reason is worth stating once for the whole plan.** A transport leg is a
child of a trip. `assertQuota` is called in exactly eight places today —
`trips.createTrip`, `journey.createJourney`, `collections.createCollection`, `places.createPlace`,
`members` twice and `files.recordFile` twice — and `USAGE_METRICS`
(`src/server/db/schema.ts`) has no metric for a leg or a booking. The sold ceiling that bounds
this table is `trips`, which is enforced at the moment the trip is created, and the published number
is the enforced number.

This stage therefore adds no metric to `resolveLimits()` (`src/server/billing/limits.ts`) and none to
`PLAN_QUOTAS` (`src/server/db/types.ts`), and `src/server/billing/__tests__/limits.test.ts` gains no
case and is not an owned path. Inventing a metric here would publish a ceiling nothing sells.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block, in the
shape the file already uses: two organizations seeded identically, then organization A asks, in A's
scope, for organization B's rows.

Covered: `getTransport`, `listTripTransports`, `listDayTransports`, `createTransport`,
`updateTransport`, `setTransportStatus`, `deleteTransport`, `nextDeparture`,
`summariseTripTransports`, `totalTripDistanceMetres`.

Every one of these must be a `NotFoundError` from A's scope, and the specific new case this stage
owes: **`createTransport` with a `departureDayId` or an `arrivalDayId` belonging to B's trip is a
`NotFoundError`, not a row quietly parented across the boundary** — and `updateTransport` moving an
existing A row onto a B day is the same. B's rows are re-read afterwards and must be byte-identical.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/modules/transports/__tests__/leg-form.test.ts` — the hire-car labels replace the
  generic ones for `car` and for no other mode; an arrival day before a departure day is an error and
  the same two days in order are not; a draft with no day at all is valid, because an idea has no day.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the block above.

**Browser evidence**, per `12-verification-protocol.md` §3.

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/reservations-and-transport.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/demo-trip-01-tokyo-and-kyoto/transports" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/03-S1" \
  --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth
```

The route is `/trips/demo-trip-01-tokyo-and-kyoto/transports`. That id is stable, not guessed:
`src/server/repos/__tests__/trips.test.ts:27-33` asserts the five demo trips carry exactly those
keys, and `src/routes/api/dev/-seed/dataset/flagship.ts:30` is where the first one is declared, with
seeded transports at `:1124` so the frames are of a populated screen rather than an empty state.

**The declared state**, because the point of this stage is a control that does not exist at rest: the
leg dialog, open, on the hire-car branch where the relabelling is visible. Reached with
`--click '[data-part="new-leg"]'` followed by selecting the mode, and captured as
`--state leg-dialog-car`. **The selector is verified to exist by the stage's own spec** — a
`page.locator('[data-part="new-leg"]').count()` of 1 before the frame is filed — and the attribute is
added to the existing action button in `transports-timeline.tsx` precisely so the selector survives a
restyle. The resting set is still owed; a dialog is judged against the screen it opens over.

**Console** must be silent: the spec attaches `watchConsole(page, route)` before navigating and
asserts `fatal` is empty at the end of every test, including the frame-only ones. Nothing is added to
`TOLERATED_CONSOLE_WARNINGS`.

**Layout shift after paint** is read per `12-verification-protocol.md` §6: a `layout-shift`
`PerformanceObserver` installed as an init script, the mark taken after `settle()`, the sum after the
mark asserted to be `0`, and the WebKit run reported as a skip rather than as a pass — the entry type
is Chromium-only and `observe()` does not throw in WebKit.

**`auditServerClock(page, <this spec's route table>)`** runs once in its own `describe`. The two trip
tabs are declared with `relativeTime: false`, and the declaration is what that audit checks against
the streamed document.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One, inherited and named as `12-verification-protocol.md` §7.2 requires.** That section defers seven
abbreviated-month call sites that build their own `Intl.DateTimeFormat` with `month: 'short'`, which
workerd and WebKit resolve from different ICU builds, and states the defect is "latent today and
active the moment a trip tab is baselined". **This stage is the first in the repository to baseline a
trip tab**, and two of the seven are in files it owns:
`src/components/modules/transports/transports-timeline.tsx` — renamed ahead of this stage — and
`src/components/modules/book/bookings-timeline.tsx:89` (the latter is `03-S6`'s to fix, and is named
here so the inheritance is recorded once).

Disposition: **substitute**, inside this stage's own file only. `src/lib/format.ts` already closed
this for itself by answering from a CLDR table instead of asking the platform, and it exports
`formatWeekday(value, locale)` at `:328`, which produces exactly the `Tue 23 Jun` shape the
module-local formatter produces. `transports-timeline.tsx` calls it and deletes its own formatter.
`src/lib/format.ts` itself is **not** edited and is not an owned path. No package, no binding, no
third-party service, no dependency on an unlanded row.

---

## Stage 03-S2 — A journey with more than two stations, and times that say which clock they are on

### Stage id

`03-S2` · Wave 2 · effort **XL**. The largest stage in this plan, and the one that adds its two new
tables.

**It carries two concepts, and that is a deliberate exception argued rather than assumed.**
`docs/SPEC.md` §8 asks for one concept per owner, and the station chain and the airport catalogue are
two. They are joined here because the catalogue exists for exactly one consumer — the chain editor's
endpoint type-ahead, which this stage owns — and because splitting it out would mean a new stage id
and a new row in the wave table of `docs/plans/README.md`, a file this plan does not own. A reader who
prefers the split can lift the three catalogue paths and the `airports` table into a wave-1 stage of
their own without touching anything else here: the catalogue has no dependency on this plan, only a
consumer in it.

### Reference rows

- `BKG-07` absent → **done**. The station chain, its per-leg detail, timezone-aware times, and the
  airport reference dataset behind the endpoint type-ahead.

**The residue this row used to carry is gone, and it was never a provider decision.** An earlier draft
stopped this row at `partial` and deferred the airport dataset to `11-S3`'s register of open
commercial decisions. ADR 0010 records why that filing was wrong: the dataset is **public domain**,
there is no licence to negotiate, no tier to buy and no runtime call to make. It is a build-time
artefact in the idiom `scripts/build-country-outlines.mjs` already establishes in this repository —
a pinned public source, a deterministic build, a committed artefact and a `--check` mode that fails
when the artefact drifts from the source. What was filed as a cost decision was a build step.

Sourced from `wiki: Transport-Flights-Trains-Cars` for the behaviour that a long-distance rail
journey is a chain of stations rather than a pair, that the leg between two consecutive stations
carries its own service number, platform, seat and times, and that a journey recorded before the
chain existed must keep reading correctly; and for the behaviour that a departure time is understood
against the clock at the place it departs from.

**What ships, so nobody has to guess.** N stations, N−1 legs, per-leg service number / platform /
seat / day / time, an explicit zone per endpoint, a local-clock label beside every time input, and the
endpoint type-ahead that fills a name, a city, a country and a zone from a three-letter code. A
traveller may still type a code the catalogue does not know and pick the zone themselves; the
type-ahead is a shortcut over free text, never a gate in front of it, because an airport that opened
after our last build must not be an airport a person cannot record.

Rows unblocked: `BKG-10` (`03-S5`, wave 4).

### Owned paths

- `src/server/repos/transports.ts` — edit. The chain's repository functions live beside the record
  they belong to; wave 2, and `03-S1` holds this file in wave 1, so the two never run together.
- `src/server/fns/transports.ts` — edit. One writer for the whole chain, and the desk loader carries
  it.
- `src/components/modules/transports/chain-editor.tsx` — new. The station chain and its leg rows.
- `src/components/modules/transports/leg-dialog.tsx` — edit. Mounts the chain editor for the two modes
  that use it.
- `src/components/modules/transports/leg-form.ts` — edit. The chain's draft shape and its validation.
- `src/components/modules/transports/transports-timeline.tsx` — edit. A chained transport reads as a chain on the
  card.
- `src/components/modules/transports/types.ts` — edit. `TransportData` gains `legs`.
- `src/components/modules/transports/index.ts` — edit.
- `src/components/modules/transports/__tests__/chain.test.ts` — new. The chain invariant, on its own.
- `src/lib/timezones.ts` — new. The zone list and the local-clock label.
- `src/lib/__tests__/timezones.test.ts` — new.
- `scripts/build-airports.mjs` — new. The build-time artefact, in the idiom
  `scripts/build-country-outlines.mjs` already establishes: a pinned public-domain source, a
  deterministic cut, a committed artefact and a `--check` mode that fails when the two drift. It is
  not run at request time and it is not run at deploy time; it is run when the dataset is refreshed,
  and its output is reviewed like any other change.
- `src/server/catalog/airports.ts` — new. The prefix read over the catalogue table. It lives in
  `src/server/catalog` and not in `src/server/repos` because an airport belongs to no tenant, which is
  the single stated exception to the tenant-scoped repository rule in `AGENTS.md` and `docs/SPEC.md`
  §6 — and stating which exception is being used is the price of using it.
- `src/server/catalog/__tests__/airports.test.ts` — new. The prefix query, the cap, and the case that
  matters most: a code the catalogue does not carry resolves to nothing and blocks no write.
- `src/routes/_app/-server/trip.ts` — edit. Deletes `loadTripTransports` (`:354`), which `03-S1`
  orphaned, and `loadTripBookings` (`:408`), which was already unreachable at HEAD, together with the
  two payload interfaces that exist only to type them. Three sibling stages share this file, all in
  other waves: `07-S2` (`07-collaboration-and-sharing.md`, wave 1) for the collaboration panel's
  loader, and `05-S1` (wave 3) and `05-S5` (wave 5) in `05-packing-and-todos.md` for the packing
  loaders. Four stages, four waves, no concurrency — and this stage removes two functions none of the
  other three touches, which is why the removal is safe to schedule between them.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/reservations-and-transport.visual.spec.ts` — append. This stage's own `describe` block.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — append. Its own baselines only.

### Data and migration

**One additive table, stated here and created by the wave-1 schema stage of `00-foundations.md`.**
This stage is wave 2, and the register in that file mints one schema stage per wave whose ritual is to
collect what **the next wave** asked for — so the supplier is the wave-1 instance, not `00-S1`, whose
closing clause absorbs wave-1 filers only and which has already closed by the time this stage runs.
The requirement is filed under this heading, which is the ritual `00-foundations.md` prescribes, and
it is restated in this plan's shared-paths table with its supplier named.

`transport_legs` — the legs of one transport record, ordered.

| Column                               | Type                         | Notes                                                    |
| ------------------------------------ | ---------------------------- | -------------------------------------------------------- |
| `id`                                 | `text` PK, `newId()`         | The `pk()` helper.                                       |
| `organization_id`                    | `text NOT NULL`              | `orgRef()`; FK `organization.id ON DELETE CASCADE`.      |
| `trip_id`                            | `text NOT NULL`              | FK `trips.id ON DELETE CASCADE`.                         |
| `transport_id`                       | `text NOT NULL`              | FK `transports.id ON DELETE CASCADE`.                    |
| `position`                           | `integer NOT NULL DEFAULT 0` | 0-based index in the chain.                              |
| `from_name`                          | `text NOT NULL`              |                                                          |
| `from_code`                          | `text(8)`                    | Nullable.                                                |
| `from_lat`, `from_lng`               | `real`                       | Nullable pair.                                           |
| `from_timezone`                      | `text`                       | IANA name, nullable.                                     |
| `to_name`                            | `text NOT NULL`              |                                                          |
| `to_code`                            | `text(8)`                    | Nullable.                                                |
| `to_lat`, `to_lng`                   | `real`                       | Nullable pair.                                           |
| `to_timezone`                        | `text`                       | IANA name, nullable.                                     |
| `service_number`, `platform`, `seat` | `text`                       | Nullable; the three facts a person reads at a desk.      |
| `departure_day_id`, `arrival_day_id` | `text`                       | FK `days.id ON DELETE SET NULL`.                         |
| `departure_date`, `arrival_date`     | `text`                       | `YYYY-MM-DD`.                                            |
| `departure_time`, `arrival_time`     | `text`                       | `HH:MM`.                                                 |
| `sort_order`                         | `real NOT NULL DEFAULT 0`    | `sortOrder()`; the day-timeline position `03-S5` writes. |
| `created_at`, `updated_at`           | `integer` epoch ms           | The `timestamps()` helper.                               |

Indexes, **`organization_id` leading on the composite one**, as every other table in the schema does:
`transport_legs_org_trip_idx (organization_id, trip_id)`,
`transport_legs_transport_position_idx (transport_id, position)`,
`transport_legs_departure_day_idx (departure_day_id)`,
`transport_legs_arrival_day_idx (arrival_day_id)`.

Constraints: `nonNegativeCheck('transport_legs_position_chk', t.position)`, and
`latLngChecks` for each coordinate pair — the helper in `src/server/db/schema.ts` that every other
geocoded table already uses.

**No enum column, so no `enumCheck`.** The mode is the parent record's; a leg does not have one.

**No money column either, and that is a decision rather than an omission.** A ticket is priced once,
on the record, not once per leg: splitting a fare across four legs would invent four numbers
nobody was charged. The price stays on `transports.price_minor` — an **integer count of minor units**
beside a `text(3)` ISO-4217 `currency` — and this table carries neither. Should a per-leg fare
ever be wanted it arrives as one more additive column in that same convention, never as a float.

**Migration and backfill.** The next ordinal in the `drizzle/` series, generated by `pnpm db:generate`.
It **backfills nothing, deliberately**, and that is the whole of the compatibility answer: a transport
with zero rows in this table is read as a one-leg chain whose endpoints are the record's own
`departure_*` and `arrival_*` columns. Every leg written before this stage therefore keeps rendering
exactly as it does today with no data migration, and a rollback to the previous Worker reads those
same columns and ignores a table it does not know. No column is dropped, renamed or narrowed, and the
record's flat endpoint columns keep being written for the first and last station of a chain so that a
reader which knows nothing about legs still sees where the journey starts and ends.

**A second additive table, filed onto the same wave-1 schema stage: `airports`.** It is the one table
in this plan that belongs to **no tenant**, and so the one that carries no `organization_id`. That is
the whole reason its reads live in `src/server/catalog` rather than `src/server/repos`: the
tenant-scoped base repository starts every statement from
`eq(table.organizationId, scope.ctx.organizationId)`, and a table with no such column cannot be read
through it. Naming the exception is required by `docs/SPEC.md` §6, and this is the naming.

| Column         | Type               | Notes                                                           |
| -------------- | ------------------ | --------------------------------------------------------------- |
| `iata`         | `text(3)` PK       | The code a traveller types. Upper case, exactly three.          |
| `icao`         | `text(4)`          | Nullable; not every entry has one.                              |
| `name`         | `text NOT NULL`    | The airport's own name.                                         |
| `city`         | `text`             | Nullable in the source, so nullable here.                       |
| `country_code` | `text(2) NOT NULL` | ISO-3166-1 alpha-2, the same shape `places.country_code` uses.  |
| `lat`, `lng`   | `real NOT NULL`    | Both required: an airport without a position is not usable.     |
| `timezone`     | `text NOT NULL`    | IANA name, which is the field the chain editor is really after. |

One index and it is the only access path: `airports_name_idx (name)`, alongside the primary key on
`iata`. The type-ahead matches a code exactly or a name by prefix, caps the result at ten rows and
orders by name, so the query is answerable from an index and never from a scan.

**Where the rows come from, and why the answer is short.** ADR 0010 records it: OurAirports, which
places its data in the **public domain**, cut at build time by `scripts/build-airports.mjs` into the
migration that seeds this table. There is no runtime provider, no key, no quota and no attribution
obligation, which is why this stage names none. The source is pinned by revision in the script, the
same way `scripts/build-country-outlines.mjs` pins its own, so two builds of one revision produce
byte-identical output and a drift is a failing `--check` rather than a silent difference.

**Refreshing it is a change like any other.** A new airport does not reach a tenant until someone runs
the script and lands the migration, and that is acceptable precisely because the type-ahead is a
shortcut over free text rather than a gate in front of it. The alternative — fetching a live dataset
at request time — would put a third-party dependency in the path of typing a station name, which is
the shape this plan set refuses everywhere else.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/transports.ts`.** SQL for the new table lives here, beside the record
it hangs off, rather than in a new module: `src/server/repos/index.ts` maps one repository to the
`transports` table and this is the same aggregate, so a second module would split one write across two
homes for no gain. A `transportLegsRepository = createTenantRepository(transportLegs, 'transport leg')`
is added, and:

- `listTransportLegs(scope, transportId)` — ordered by `position` then `id`.
- `listTripLegs(scope, tripId)` — every leg of the trip, for the desk and for `03-S5`.
- `replaceTransportChain(scope, transportId, legs)` — the only writer. It resolves the parent with
  `transportsRepository.requireById`, resolves every referenced day with `requireTripDay` against the
  parent's own trip, deletes the record's existing legs and inserts the new ones with `position`
  assigned from array index, **in one `scope.db.batch()`**. `db.batch()` on D1 is a real transaction —
  statements run sequentially and a failure rolls the whole sequence back — which is the property a
  chain needs, because a half-replaced chain is a journey with two station threes.
- The parent's flat `departure_*` / `arrival_*` columns are rewritten from the first and last leg
  in the same batch, so the two representations cannot disagree.

Every statement is `tenantFilter()`-scoped on both sides of the delete-and-insert, and
`organization_id` is stamped by the repository rather than accepted from the caller.

**The invariant, enforced in the repository and not only in the form.** A chain is either empty or has
at least one leg; consecutive legs must agree at the join, so leg _i_'s arrival endpoint
is written from leg _i+1_'s departure endpoint rather than accepted twice; and a chain is capped
at 12 legs, which is a bound on the write rather than a product opinion.

**And the reason for that bound is not the one an earlier draft gave.** It said the cap keeps the
mirrored patch inside the 32 KiB frame `src/server/do/protocol.ts` fixes. It does not, because the
patch this stage sends carries the leg count and the two outer endpoints rather than the chain — see
**Realtime** below — so its size does not grow with the chain and no chain length could breach that
frame. The cap survives on its own footing: it is the `.max(12)` in the validator, and it exists so a
malformed or hostile payload cannot ask the repository to delete and re-insert an unbounded number of
rows inside one `db.batch()`. Twelve is generous for a journey a person actually takes, and a bound
on a write is a bound whether or not anything downstream needed it.

**Server function — `src/server/fns/transports.ts`.**

- `saveLegChainFn` — `createServerFn({ method: 'POST' })`. Validator: `z.object({ tripId, transportId,
stations: z.array(stationSchema).min(2).max(13), legs: z.array(legSchema).max(12) })`, where
  `stationSchema` carries a name, an optional code bounded to 8 characters, an optional coordinate pair
  bounded to WGS-84 and an optional zone validated with a refinement that asks `Intl` whether it
  accepts the name. A `.superRefine` enforces `legs.length === stations.length - 1`, so a chain
  that does not describe a journey is refused at the boundary and never reaches the repository.
- `loadTransportDeskFn` — widened to carry each leg's legs.

**Authorisation, and the guard `03-S1` could not reach.** `appScope()` then
`requireTrip(scope, data.tripId)`, then the repository re-resolves the parent transport inside the
same scope. A well-formed transport id from the client is not an authorised transport id, and the
chain writer never trusts the one it was handed.

**This stage also closes the role gap `03-S1` named one wave ago.** `assertTripRole(scope, tripId,
['owner', 'editor'])` — minted by `01-S1` (`01-trips-core.md`, wave 1), which is closed by the time
this stage opens — is called **inside `src/server/repos/transports.ts`**, on every writer in it, this
stage's chain writer included. In the repository and not in the handler, for the reason `01-S1` gives
when it argues the guard's placement: a rule that lives in the handler holds for the handlers that
exist today, and a rule that lives in the repository holds for the queue consumer and for any route
added later as well. A `viewer` on a trip can write a transport at HEAD; after this stage they cannot,
and the Durable Object's refusal at `src/server/do/trip-room.ts:358` stops being the only thing
standing in their way.

The catalogue read is the one call in this stage that takes **no** role and no trip: an airport is a
public fact, `src/server/catalog/airports.ts` reads a table with no `organization_id`, and there is
nothing there to scope. It still requires a session, because an unauthenticated type-ahead over any
dataset is an open endpoint someone else can bill us for — the ceiling on it is stated under
**Quota**.

**Nothing is enqueued and nothing is slow.** The mirror is one `route` upsert — the kind the four
writers in `src/server/fns/transports.ts` already patch — carrying the leg count and the two
outer endpoints, not the whole chain, because a patch is a notification here and D1 is the record.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path.

**Components.** `chain-editor.tsx` is new and is a product component, not a primitive: it composes
`Field`, `Input`, `SimpleSelect`, `Combobox`, `IconButton`, `Button` and `Separator` from
`src/components/ui`. `Combobox` is used as it is — it already renders grouped options under uppercase
headings (`src/components/ui/combobox.tsx:20-28`, `:114-120`), which is exactly what a zone list
grouped by region needs, so no second implementation of a filtered listbox is written.

**The editor, described as behaviour.**

- A vertical chain: station, leg, station, leg, station. The stations are the rail; the
  legs hang between them, which is the same visual grammar
  `src/components/modules/book/bookings-timeline.tsx` already uses for dates and which makes the two
  screens read as one product.
- **Add stop** inserts a station between two existing ones and splits the leg it landed on,
  carrying the service number and seat down to the second half rather than blanking both — the
  traveller is adding a change of train, not retyping their ticket.
- **Remove stop** joins the two legs either side and states what it merged, with an undo in the
  toast for the length of the toast.
- Each leg row holds service number, platform, seat, a day select and a time input for each end.
- **The zone is beside the time it governs**, not in a settings panel: each station carries a zone
  combobox, and the leg's time inputs render the resolved local-clock label — `14:05 · Asia/Tokyo
(UTC+9)` — under the field. When the two ends of a leg sit in different zones, the leg
  shows the elapsed duration as well as both wall clocks, because that is the number that stops being
  obvious the moment a journey crosses a boundary.
- On a **360px** viewport the chain is a single column with the leg fields stacked in a disclosure
  that opens on the leg being edited; the rail stays, because losing it loses the one thing that
  makes a chain legible. This is a designed narrow layout, not the desktop grid at a smaller width.

**The zone list — `src/lib/timezones.ts`, and why it is not a duplicate.** `src/lib/time.ts` already
owns _formatting_ in a zone and validating a stored zone (`resolveTimeZone`, `:30`). It does not
enumerate. This module enumerates: `Intl.supportedValuesOf('timeZone')` — measured on this machine at
**418 zones**, and available in every engine the product supports — grouped by region for the
combobox, each with its current UTC offset computed through `Intl.DateTimeFormat` with
`timeZoneName: 'shortOffset'`. It calls `resolveTimeZone` for validation rather than re-implementing
it, and it holds no table of its own, so it cannot go stale the way a checked-in list would.

**States.**

- _Empty._ A transport with no chain shows its two flat endpoints and a single quiet action, "Break
  this into legs", on `--color-surface-2`. There is no empty chain: the first click produces a
  two-station chain seeded from the endpoints already recorded.
- _Skeleton._ The editor lives inside a dialog that opens with data already loaded, so it has no
  fetch of its own; the dialog's own opening transition covers it. Stated rather than skipped.
- _Error._ Validation failures are per-field and inline. A **failed save** keeps the whole chain as
  typed — a chain is expensive to retype and losing it to a network blip is unforgivable — and states
  the server's message in the dialog's `Alert` with the save button returned to its rest state.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on every add, remove,
  field and the save button. The add and remove buttons are real `IconButton`s with accessible names
  ("Add a stop after Nagoya"), never bare glyphs.

**Motion, and the property it deliberately does not touch.** `DESIGN.md` — "Transform and
opacity only. Never animate layout-affecting properties." — rules out the obvious implementation
here, which is to transition the chain's height as a row is inserted or removed. This stage does not
do that, and the rule is restated in the stage because a chain editor is exactly the surface on which
somebody reaches for a height transition by reflex.

What actually animates: an inserted station row mounts at `opacity: 0` and `translateY(-4px)` and
settles to `opacity: 1` / `translateY(0)` over `--duration` on `--ease-out-quint`; a removed row
leaves at `--duration-fast` to `opacity: 0` / `translateY(-4px)` and is unmounted on the transition's
end. The rows below it take their new positions in the same frame the row mounts or unmounts — the
list's height changes instantly and is never transitioned — so nothing layout-affecting is ever
interpolated and no reflow is animated. The chevron that folds a leg's detail rotates 90° on
`transform` alone. Under `prefers-reduced-motion: reduce` both directions collapse to an instant
mount and unmount with no transition at all. Nothing exceeds 260ms and nothing is linear.

**Tokens.** None missing. The rail is `--color-edge`, the station dot `--color-brand` at rest and
`--color-accent` when its field has focus, both checked at AA against `--color-surface` and
`--color-surface-2` in both themes. Times and offsets carry `tabular-nums`.

### Quota

**No countable row.** A leg is a child of a transport, which is a child of a trip; `USAGE_METRICS`
has no metric for either, and the sold ceiling is `trips`. The 12-leg cap is a frame-size bound,
not a plan entitlement, and it is enforced in the repository rather than in the catalogue. Nothing is
added to `resolveLimits()` or `PLAN_QUOTAS`, and
`src/server/billing/__tests__/limits.test.ts` gains no case.

### Tenant isolation test

Appended as one `describe` block. Covered: `listTransportLegs`, `listTripLegs`,
`replaceTransportChain`.

The cases: A cannot list B's legs by transport id or by trip id; A cannot replace the chain of B's
transport; A cannot write a leg whose `departure_day_id` or `arrival_day_id` is one of B's days,
even when the parent transport is A's own — that one is the parenting case, and it is a
`NotFoundError` from `requireTripDay`, not a silently dropped reference. Because `replaceTransportChain`
deletes before it inserts, the block also asserts the **destructive** direction explicitly: a
cross-tenant call must delete nothing, so B's leg rows are counted before and after and must be
identical.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/modules/transports/__tests__/chain.test.ts` — N stations produce exactly N−1
  legs after an insert, after a removal and after both; inserting carries the service number to
  the second half and leaves the first intact; a one-leg chain built from a record with no rows
  reproduces that record's flat endpoints exactly, which is the compatibility claim above turned into
  an assertion.
- `src/lib/__tests__/timezones.test.ts` — every enumerated zone is accepted by `resolveTimeZone`; the
  offset label of a fixed instant in a known zone is stable; an unknown zone handed to the label
  function falls back rather than throwing.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the block above.

**Browser evidence.** Route `/trips/demo-trip-01-tokyo-and-kyoto/transports`, six frames at 360, 1280
and 2560 in both themes, plus a **declared state**: the chain editor open on a three-station journey,
`--state chain-editor`, reached by `--click '[data-part="edit-leg"]'` then
`--click '[data-part="split-leg"]'`. Both selectors are attributes this stage adds for the purpose and
both are proven to resolve by a `count()` assertion in the spec before any frame is filed — reading
the JSX is not a verification. The invocation is the one quoted in `03-S1`, with `PT_SERVER_TODAY`
pinned to `2026-08-20` so the frames and the baselines are of the same day.

**Console** silent, `fatal` empty, nothing added to `TOLERATED_CONSOLE_WARNINGS`. **Layout shift after
the settle mark** asserted `0` on Chromium and reported as a skip on WebKit.

### Definition of done

The six items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

Per surface:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One, and it is the reason this row lands at `partial`.**

- **An airport and station reference dataset.** `11-boundaries-and-blockers.md`, `11-S3`, lists this
  row by id, by owning plan and by wave, and puts it in the same family as the geocoding, place-search
  and routing decisions: "adjacent decisions of the same kind, taken with it or immediately after it".
  Disposition: **defer**. What is deferred is precisely the lookup — code to name, city, country and
  zone — and nothing else; the editor, the chain, the per-leg fields and the zone selection all
  ship without it. What the follow-on work is, so it can be sized when the decision is taken: one
  server function over a cached dataset, one `Combobox` swap in `chain-editor.tsx`, and a fill of four
  fields from one selection. No package is required for any of it, so this is not a
  `docs/SPEC.md` §3 freeze problem; it is a data-licence and cost decision, and this stage stops at
  it rather than naming a provider.
- No package outside the pinned set, no binding absent from `wrangler.jsonc`, no third-party service
  called at runtime. `Intl.supportedValuesOf` is the platform's, not a dependency.

---

## Stage 03-S3 — A connection the traveller did not have to look up

### Stage id

`03-S3` · Wave 3 · effort **L**. The stage that stopped being a record.

### Reference rows

- `BKG-08` absent → **done**.

Sourced from `wiki: Transport-Flights-Trains-Cars` for the behaviour: a second mode of the
add-transport dialog that searches public-transport connections between two stops on a given date,
filters them by mode, ranks them by a stated preference, expands one into its stop-by-stop detail, and
saves the chosen connection as a first-class record that can later have its route re-searched and
replaced in place while keeping its identity and its booking fields.

**Why this stage was blocked, and what unblocked it.** An earlier draft of this file made `03-S3` a
record rather than a build: it owned no path, shipped no surface, and existed so the largest unbuilt
thing in the area would be visible instead of half-rediscovered. Its blocker was a commercial
decision, and the rule it obeyed — "the plan that needs a provider stops at the decision" — was
right. The decision has since been taken. **ADR 0011** records it: public-transit routing is bought
from HERE, behind our own proxy, and the two terms that decide the real cost are settled there rather
than here.

The reference product answers the same need with a community instance that asks for no key. That
route is closed to us in its own operator's words — commercial use is not allowed, and eligibility
requires the calling project to be open-source and non-commercial — and ADR 0011 quotes it, because a
free endpoint whose terms exclude us is not a cheaper option, it is not an option.

**Why wave 3, one wave later than the row's floor.** A found connection is saved as a station chain,
and the station chain is `03-S2`'s, in wave 2. Two stages in one wave may not depend on each other,
so this stage takes the first wave in which the thing it writes into exists. The edge is materialised
in this file's edge table as `BKG-08 → BKG-07`.

Rows unblocked: none. Nothing in this plan or any sibling names `BKG-08` as a supplier, which was true
when it was blocked and is still true now that it is not.

### Owned paths

- `src/server/transit/here.ts` — new. The provider client and nothing else: it builds one request,
  parses one response into our own shape, and knows nothing about trips, tenants or D1. A module with
  one provider's name in it is a module that can be replaced by another provider's without a search
  through the codebase, which is the only reason the file is named for the vendor.
- `src/server/transit/search.ts` — new. The proxy proper: the cache read, the meter, the client call,
  the cache write. Every caller goes through this and none reaches `here.ts` directly.
- `src/server/transit/meter.ts` — new. The per-tenant ceiling on outbound calls, minted here because
  this is the first stage in the plan set that needs one and `03-S7` needs the same one two waves
  later — see **Quota**, which explains why it cannot be `assertQuota`.
- `src/server/transit/__tests__/search.test.ts` — new. The cache key, the cache hit, the meter's
  refusal, and a provider error surfacing as a typed failure rather than a thrown fetch.
- `src/server/fns/transports.ts` — edit. Two server functions: the search and the save. Wave 3, and
  this plan's other claims on the file are `03-S1` (wave 1) and `03-S2` (wave 2), so no two run
  together.
- `src/server/repos/transports.ts` — edit. One function: saving a searched connection as a transport
  with its legs, in one batch. Wave 3; `03-S1` holds this file in wave 1 and `03-S2` in wave 2.
- `src/components/modules/transports/connection-search.tsx` — new. The second mode of the dialog: the
  two stops, the date, the mode filter, the ranked results and the one that expands.
- `src/components/modules/transports/leg-dialog.tsx` — edit. Mounts the second mode. Wave 3;
  `03-S1` holds it in wave 1 and `03-S2` in wave 2.
- `src/components/modules/transports/index.ts` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/reservations-and-transport.visual.spec.ts` — append. This stage's own `describe` block.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — append. Its own baselines only.

**One binding, and it is a secret rather than a `wrangler.jsonc` entry.** The HERE credential is set
with `wrangler secret`, so this stage adds no binding to `wrangler.jsonc` and does not claim that
shared file. A per-tenant provider credential is not offered and would not be accepted: that is the
exact shape `11-S1` refused for a neighbouring row, and buying the capability centrally is what makes
it refusable here.

### Data and migration

**No schema change at all, and that is the point of waiting for `03-S2`.** A saved connection is a
`transports` row whose mode is already in `TRANSPORT_MODES` — `transit`, `train`, `bus`, `tram`,
`metro` and `ferry` are all there — with its stop-by-stop detail in the `transport_legs` rows `03-S2`
created. The row is not blocked on a data model and never was; it was blocked on where the itinerary
came from.

**A fare, when the provider returns one, is an integer count of minor units beside a `text(3)`
ISO-4217 currency**, on `transports.price_minor` and `transports.currency`, like every other priced
row in this plan and never as a float. When the provider returns no fare, nothing is written: a
guessed price on a money column is worse than an empty one, which is the rule `03-S4` states for the
ledger and this stage does not weaken.

**The cache is not a table.** It is `KV`, already bound, keyed on the normalised query — origin stop,
destination stop, date, mode filter — and on nothing else. It holds no trip id, no day id and no
member id, so it is **shared across tenants by construction rather than by permission**: that two
stops connect on a date is a public fact about a timetable, not a fact about anybody's trip. The
isolation consequence is stated under **Tenant isolation test**, because a cache key is exactly where
that rule is broken by accident.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/transports.ts`.** One function, and it writes through the machinery
`03-S2` already built rather than beside it:

- `saveSearchedConnection(scope, tripId, connection)` — creates the `transports` row and its
  `transport_legs` in one `scope.db.batch()`, by calling `03-S2`'s `replaceTransportChain` for the
  legs rather than inserting them itself. Re-searching an existing connection replaces the chain on
  the **same** `transports` row, so the record keeps its id, its booking fields and its day
  assignment — which is the behaviour the row asks for, and it falls out of reusing the chain writer
  instead of writing a second one.

`assertTripRole(scope, tripId, ['owner', 'editor'])` runs inside the repository, as `03-S2`
established for this file one wave earlier. This stage adds no second guard and no exception to the
first: a search is a read, and a save is a write like any other.

**Server functions — `src/server/fns/transports.ts`.**

- `searchConnectionsFn` — `createServerFn({ method: 'POST' })`. Validator:
  `z.object({ tripId, from: stopSchema, to: stopSchema, date: dateSchema, modes: z.array(z.enum(TRANSPORT_MODES)).max(12).optional() })`,
  with `stopSchema` a bounded trimmed string or a coordinate pair. `appScope()`, then `requireTrip` —
  a search is metered and billed, so it is not an endpoint anyone with a URL may call. Then the meter,
  then `search.ts`. **It writes nothing.** A search that is never saved leaves no row, which is why
  this function is a `POST` that reads: the method is about the body it carries, not about a write.
- `saveConnectionFn` — `createServerFn({ method: 'POST' })`. Validator: the trip, the optional
  existing transport id for a re-search, and the chosen connection as its own bounded shape —
  `z.array(legSchema).min(1).max(12)`, the same cap and the same reason `03-S2` gives for it. It does
  **not** trust the search result the client hands back: the connection is re-validated in full, and
  every day id in it is resolved with `requireTripDay` against the trip, because a payload that came
  from us a minute ago is still a payload from the client.

**Zod, in v4 idiom** throughout, `z.object` with explicit bounds on every string, `z.enum` for the
modes, and the `error` parameter wherever a person reads the message.

**Three contracts on the outbound call, all of them restatements of rules that already bind this
repository.**

1. **The cache answers before the provider does.** `ARCHITECTURE.md` §4 fixes the caching layer, and a
   search is slow, metered and failure-prone. `search.ts` reads `KV` first and calls `here.ts` only on
   a miss.
2. **The credential is a secret**, set with `wrangler secret`, never a checked-in variable and never a
   value a tenant supplies.
3. **The search does not fire per keystroke.** The two stop fields are free text with a submit; there
   is no type-ahead here and this stage adds none. That is a cost decision rather than a UI one, and
   the endpoint type-ahead a person does get is `03-S2`'s, which reads our own catalogue table and
   costs nothing per call.

**Failure is a value, not an exception.** A provider timeout, a 429 and a malformed response are all
returned as a typed failure the dialog renders, because the one thing this surface must never do is
turn a provider's bad afternoon into a stack trace in front of a traveller.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path. The surface is a second mode inside the dialog `03-S1` and `03-S2` already own.

**The second mode appears only when the trip has real dates**, which is the reference behaviour and is
kept for a reason of our own: a connection search without a date is a search against today's timetable
for a journey next spring. On an undated trip the mode is absent rather than disabled — a disabled
affordance for something the reader cannot make available is a promise they can see and cannot take.

- **The search form.** Origin and destination, each the endpoint field `03-S2` built, so the catalogue
  type-ahead is reused rather than rebuilt. A date, defaulted to the day the dialog was opened from.
  A mode filter as the same multi-select chip row `03-S6` uses on the desk, showing only the transit
  modes.
- **The results.** A ranked list, each row carrying departure and arrival in the **local clock of the
  stop it happens at** — `03-S2`'s rule, and the reason this stage did not need to invent one —
  the duration, the number of changes and the fare when there is one. One row expands to its
  stop-by-stop detail; only one is expanded at a time.
- **_Empty._** A search that returns nothing says so in the words of the thing that failed: no
  connection on that date, which is different from no service between those stops, and different
  again from a provider we could not reach. Three sentences, three states, no shared "something went
  wrong".
- **_Loading._** A skeleton in the results area, on `--color-surface-2`, because an outbound call is
  slow enough that a spinner over the whole dialog would hide the form the reader may want to correct.
- **_Error._** The typed failure above, with a retry. A 429 from the provider and a refusal from our
  own meter read differently and say so: one is "try again shortly", the other is "this workspace has
  used its searches for the month", and telling a person to retry something that will refuse them
  again is worse than telling them the truth.
- **_Every control._** Rest, hover, focus-visible, active, disabled and loading on the submit, the
  chips, the result rows and the expander.

**Motion.** The result list fades in at `--duration-fast` on `--ease-out-quint`; the expander animates
its disclosure and nothing else, because a list that reflows while a person is reading it is a list
they lose their place in. Both collapse under `prefers-reduced-motion: reduce`.

**Layout** is designed at 360px, 1280px and 2560px, in both themes. At 360px the result row stacks its
times above its duration rather than shrinking the type.

**No token is needed from `src/styles/tokens.css` and none is filed.** No component is added to
`src/components/ui`.

### Quota

**One ceiling, and it cannot be `assertQuota`.** The four-step quota procedure in `00-foundations.md`
counts rows: step 3 calls `assertQuota(scope, metric, currentUsage)` with usage as a live `COUNT(*)`.
A transit search creates no row on a miss and no row on a hit, so there is nothing to count, and a
metric added to `PLAN_QUOTAS` whose usage is always zero would be a published number that enforces
nothing — the exact drift that procedure exists to prevent.

So the ceiling is a **counter**, not a count: `src/server/transit/meter.ts` keeps a per-organization,
per-calendar-month tally in `KV` and refuses when the tally reaches the limit. The limit itself still
comes from `resolveLimits()` in `src/server/billing/limits.ts`, with every other ceiling, because the
published number must be the enforced number whether the thing being limited is a row or a call.

**And the metric is filed, not edited in.** `README.md` puts quota metrics in wave 0 alongside schema
and bindings, for the reason that governs both: a stage cannot sit in the same wave as the stage that
supplies it. So this stage **files** `transit_searches_per_month` onto the per-wave quota stage of
`00-foundations.md` — this stage is wave 3, so the supplier is the **wave-2** instance — together
with its case in `src/server/billing/__tests__/limits.test.ts`. Neither file appears in this stage's
**Owned paths**, and the meter reads the resolved limit rather than declaring one. In the terms of
that file's own quota procedure: steps 1 and 4 are filed, step 2 does not apply, and step 3 is
replaced by the meter — saying which steps were skipped and which were handed to someone else is the
difference between an exception and an oversight.

**The meter is minted here and used twice.** `03-S7` (wave 5) needs exactly the same thing for its
extraction calls, and a second per-tenant counter written two waves later would be two
implementations of one rule. This stage builds it general enough to take a metric name and no more
general than that.

**The cost this protects against is real and shared.** A metered outbound call a noisy tenant can make
in a loop is a cost inflicted on every other tenant, and the cross-tenant cache makes that better
rather than worse: one workspace's search for a common pair warms the answer for everybody, which is
sound precisely because the answer is a public fact.

### Tenant isolation test

**Two cases appended to `src/server/repos/__tests__/tenant-isolation.test.ts`**, in the
`alpha.tenant.scope` / `beta.tenant.scope` idiom that file already uses:

1. `saveSearchedConnection` under β's scope against α's trip id is a `NotFoundError`, and no
   `transports` row and no `transport_legs` row is written.
2. Re-searching an existing connection under β's scope against α's transport id is a `NotFoundError`,
   and α's chain is byte-identical afterwards. This is the case that exists because a re-search
   _replaces_ rows, so a missing scope check would not fail loudly — it would quietly rewrite another
   tenant's journey.

**And one case that belongs to the cache rather than the repository**, in
`src/server/transit/__tests__/search.test.ts`: the key built for α's search and the key built for β's
identical search are **the same string**. That is asserted rather than assumed, because the failure it
guards against is the opposite of the usual one — here a key that accidentally carried a tenant id
would not leak anything, it would silently multiply our provider bill by the number of workspaces.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests** cover the cache key, the cache hit path with the provider stubbed, the meter's refusal
at the ceiling, and each of the three failure shapes. The provider client is never called for real in
a test; `here.ts` exists as its own module partly so it can be replaced by a stub at the seam rather
than intercepted at `fetch`.

**Browser evidence.** `/trips/<seeded-trip>/transports`, twelve frames: the resting desk, the dialog's
second mode empty, a ranked result list, one result expanded, the empty state and the meter refusal —
each at 360px, 1280px and 2560px is more than twelve, so the set is the six states at 1280px in both
themes. The result list is filled from a **recorded** provider response committed as a fixture, never
from a live call: a baseline that depends on a timetable is a baseline that fails on a Tuesday.

**Console** must be silent, with `watchConsole(page, route)` attached before navigating, and there
must be no layout shift after paint — the result list reserves its height from the skeleton.

### Definition of done

The six items from `docs/SPEC.md` §7, none of them vacuous this time:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, against the fixture above.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code.
6. No file outside **Owned paths** is touched.

Every string a person reads is a key in the 23-locale catalogue and lands in all 23 in this change,
per `docs/SPEC.md` §9 — including the three distinct failure sentences, which is where a stage under
time pressure is most tempted to ship one English string and a `TODO`.

### Blockers

**None.** The commercial decision this stage waited on is taken and recorded in ADR 0011, with the
free tier, the price beyond it, the cache term and the attribution obligation all named there rather
than assumed here. No package outside the pinned set is needed: the client is `fetch` and a Zod parse.
No binding is missing from `wrangler.jsonc`; the credential is a secret, not a binding.

One thing is worth carrying forward rather than leaving implicit: the cross-tenant cache is legal
because ADR 0011 checked the provider's terms for it, and the same question must be asked of any
replacement provider before `here.ts` is swapped. A cache that is fine under one contract is a breach
under another, and this file is the only place a future reader will think to look.

---

## Stage 03-S4 — A booking that knows which stop it is for, and what it cost

### Stage id

`03-S4` · Wave 3 · effort **M**. One of the two wave-3 stages in this plan; `03-S3` is the other, and
the only paths the two have in common are the tenant-isolation test and the e2e spec, which every
stage here appends to rather than owns exclusively.

### Reference rows

- `BKG-02` partial → **done**.

Sourced from `wiki: Reservations-and-Bookings` for two behaviours: a booking can be attached to a
specific stop on a specific day, chosen by searching every stop of the trip with the results gathered
under the day they belong to; and a booking with a price above zero produces a matching line in the
trip's ledger without a second confirmation.

**Agreement with the row, and the behaviour deferred by name.** The row is right that the write path
is complete (`createBookingFn`, `updateBookingFn`, `setBookingStatusFn`, `deleteBookingFn`), that
`src/components/modules/book/booking-form.ts` (487 lines) already carries a per-type field shape and
its validation, and that `reservations.assignment_id` (`src/server/db/schema.ts`) exists with
no UI behind it. It is more finished than the row says: the column is **already** carried by
`reservationFields` (`src/server/repos/reservations.ts:49`) and **already** guarded against the
booking's own trip inside the caller's own tenant (`:204-213`), so the gap is the server function and
the screen, not the repository — measured under **Server**, below, because an earlier draft of this
stage got it wrong in the expensive direction. Of the three things the row names as missing, two are
this stage's and one is not:

- **Attachments** — a file linked to a booking — are `DOC-04`'s, in `06-documents-and-media.md` at
  wave 4. The column already exists (`trip_files.reservation_id`, `:996`, with its index at `:1019`),
  which is why that row's cut kept the edge `DOC-04 → BKG-02`: a reservation must exist before a file
  can be linked to it. This stage adds no attachment UI and no attachment write, and says so here so
  that nobody builds a second one.
- The stop link and the ledger line are this stage's, below.

Rows unblocked: `BKG-03` (`03-S7`), `BKG-05` (`03-S8`), and `DOC-04` (`06-documents-and-media.md`,
wave 4).

### Owned paths

- `src/server/repos/reservations.ts` — edit. Three new exported writers and **no change to any
  existing validator**: the assignment guard an earlier draft of this stage claimed here is already
  on disk (`:49` and `:204-213`, measured below), and the two columns this stage files onto the
  wave-2 schema stage — `expense_id` and `imported_at` — are deliberately kept out of
  `reservationFields` so that no client payload can set either. **This is the plan's only claim on the file, in any wave**, which
  is why the import marker's writer and clearer are minted here rather than in `03-S7` (wave 5) and
  `03-S6` (wave 4), the two stages that call them.
- `src/server/fns/reservations.ts` — edit. The two write validators gain the assignment; the price
  side effect is orchestrated here. Shared with `00-S3` (`00-foundations.md`, wave 0), which adds an
  audit call to the same file three waves earlier; different waves, so the two never run together.
- `src/components/modules/book/booking-form.ts` — edit. The draft gains `assignmentId`; `bookingShape`
  gains the field for the types that can carry it.
- `src/components/modules/book/booking-dialog.tsx` — edit. The stop picker, and the ledger notice.
  `06-S6` (`06-documents-and-media.md`, wave 4) and `03-S8` (wave 6) hold this file in later waves;
  this stage is the first of the three and leaves the file's structure alone for them.
- `src/components/modules/book/index.ts` — edit.
- `src/components/modules/book/__tests__/booking-form.test.ts` — edit. Extended, never rewritten.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/reservations-and-transport.visual.spec.ts` — append.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — append.

**The path this stage must not claim, why that shapes its design, and the defect an earlier draft of
this stage shipped.** `src/server/repos/expenses.ts` is claimed by `00-S1` (wave 0), `04-S1` (wave 1),
`04-S3` (wave 2) and `04-S6` (**wave 3 — this stage's own wave**). Two exclusive claims on that file
in wave 3 is precisely the clobber `check-plan-collisions.mjs` reports, so this stage writes its
ledger line by **calling** `createExpense`, `updateExpense` and `getExpense` exactly as they are
exported today, and edits neither that module nor `src/server/fns/costs.ts`, which carries the same
four claimants.

An earlier draft of this stage accepted that constraint and then broke it in the only way that is
worse than ignoring it: it put the back-link on `expenses.reservation_id`, which requires widening
`createExpenseInput` and `updateExpenseInput` and adding a `findExpenseByReservation` read, and
**filed that widening onto `00-S1`**, which does not carry it. Measured: `00-S1`'s **Owned paths**
entry for that file says "the Zod input for the settlement writer gains the three" currency columns
and nothing else; and `04-S3`, the wave-2 stage that owns the ledger row itself, states in its own
prose that `expenses` "has **no** reservation reference at all … and giving it one is
`03-reservations-and-transport.md`'s column to add, not this stage's." No stage anywhere in the plan
set supplied it. The stage as written could not have executed.

**The link therefore lives on the side this stage owns outright: `reservations.expense_id`.** The
direction is the only thing that changes; the behaviour the row asks for is identical, and the
foreign key does more work pointing this way than it did pointing the other way — see the delete rule
below. Nothing in `04-budget-and-currencies.md` has to change for this stage to execute: `04-S3`'s
deferral of a read-only title on a booking-derived expense stands exactly as written, because the
statement it rests on ("`expenses` has no reservation reference") remains true. The reverse read —
"which booking produced this line" — is available without touching `expenses.ts` at all, because
`listTripReservations` already returns the whole reservation row and the link is one of its columns.

### Data and migration

**Two additive columns, both filed onto the wave-2 schema stage of `00-foundations.md`. No widening
of any file this stage does not own.**

This stage is wave 3, so its supplier is the wave-2 instance of the per-wave schema stage the register
in `00-foundations.md` mints — not `00-S1`, whose closing clause absorbs wave-1 filers only. Both
columns land in that one `pnpm db:generate` run, one wave ahead of this stage, which is what makes the
three writers below compilable the moment this stage opens.

- `reservations.expense_id` — `text`, **nullable**, `REFERENCES expenses(id) ON DELETE SET NULL`, with
  `index('reservations_expense_idx').on(t.expenseId)`, declared beside the eight indexes the table
  already carries (`reservations` in `src/server/db/schema.ts`). It is the back-link that makes the side effect
  idempotent: without it, editing a booking's price three times leaves three ledger lines and the
  trip's total is wrong in a way the reader cannot even see the cause of.
- **`ON DELETE SET NULL` is load-bearing in this direction, and it removes code rather than adding
  it.** A reader who deletes a cost line from the ledger — a screen this plan does not own and cannot
  change — leaves the booking pointing at a row that is gone. With the link on this side, SQLite nulls
  the column as part of that delete and the booking is unlinked with no code in this plan running, no
  cross-module hook, and no scheduled repair. Pointing the other way, that same delete would have
  needed `04-budget-and-currencies.md` to know about bookings.
- **Everything the side effect calls already exists and is exported**: `createExpense` (`:288`),
  `updateExpense` (`:318`), `getExpense` (`:265`) and `deleteExpense` (`:399`) in
  `src/server/repos/expenses.ts`. `createExpenseInput` (`:107`) already accepts every field this stage
  supplies — `tripId`, `title`, `amountMinor`, `currency`, `category`, `dayId`, `placeId`, `spentOn`
  — so not one line of that file changes.
- `reservations.imported_at` — `integer('imported_at', { mode: 'timestamp_ms' })`, **nullable**, with
  `index('reservations_org_imported_at_idx').on(t.organizationId, t.importedAt)` so the desk can find
  the unchecked rows without a scan. It is set when a confirmed import writes a row (`03-S7`, wave 5)
  and cleared the first time a person opens and saves that booking (`03-S6`, wave 4). **It is asked
  for here, in the stage that owns the only repository claim on this table**, because a repository
  function cannot be written in wave 3 against a column that a wave-3 or wave-4 stage files for a
  later migration. `03-S7`'s **Data and migration** section restates the column as already on disk and
  files nothing.
- **Why an instant and not a boolean.** The behaviour the desk needs is "a machine wrote this and
  nobody has checked it", and an instant answers that question _and_ says when, at the same width the
  schema already uses for `read_at`, `onboarded_at` and `onboarding_completed_at`. It also lets a later
  stage sweep or sort by it without a second column. This is a deliberate divergence from the
  reference's boolean, taken in our own idiom, and it is the reason the marker in `03-S6` is worded as
  it is.
- Migration: the next ordinal `pnpm db:generate` mints, carrying both columns. It **backfills
  nothing** — every existing booking keeps a null link, which reads as "this booking has no cost
  line", and a null marker, which reads as "typed by a person"; both are true of every row in the
  database today.

`reservations.assignment_id` needs no schema work **and no validator work**: the column, its FK to
`day_assignments` and its index are already on disk (`:705-707`, `:735`), and so are its Zod field and
its reference guard (`src/server/repos/reservations.ts:49` and `:204-213`).

**Money, on both sides of the side effect.** `reservations.price_minor` and `expenses.amount_minor`
are both **integer counts of minor units**, each beside a `text(3)` ISO-4217 currency column, and the
ledger line is written by copying one integer into the other with no arithmetic in between — no float,
no division, no rounding, and therefore no way for the booking and its cost line to disagree by a cent.
`minorUnitDigits` (`src/lib/format.ts:483`) is what turns either of them into a string, at the edge,
for display only.

**The scoping, said in the column's own name.** Both tables carry `organization_id NOT NULL` and both
lead their composite index with it (`reservations_org_trip_idx`, `expenses_org_trip_idx`), and every
statement either repository issues begins at `tenantFilter()` — `eq(table.organizationId,
scope.ctx.organizationId)` — with callers able only to `AND` predicates onto it. The new
`reservations.expense_id` link is bounded by the tenant at both ends: a reservation belonging to
another organization cannot be reached in order to be linked in the first place, and an expense id
that resolves in another organization does not resolve through `getExpense(scope, …)` at all, because
that read begins at the same `tenantFilter()`.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/reservations.ts`.** Three new exported functions, and **not one
line of change to `reservationFields`, `createReservationInput`, `updateReservationInput` or
`assertReferences`**.

**What an earlier draft of this stage claimed here, and what is on disk.** That draft named two
repository deliverables: adding `assignmentId` to `reservationFields`, and widening
`assertReferences` so an assignment is proved to belong to the booking's own trip. **Both are
already implemented.** Measured: `reservationFields` declares `assignmentId: idSchema.nullish()` at
`src/server/repos/reservations.ts:49`, so the field survives both validators; and
`assertReferences` — declared at `:187`, the line that draft cited — carries its assignment arm at
`:204-213`, selecting `dayAssignments.tripId` under `tenantFilter(scope, dayAssignments, …)` and
raising `NotFoundError('day assignment', …)` when the row's `tripId` is not the booking's. A stop id
from another trip, or from another tenant, is therefore already a `NotFoundError` and this stage
adds nothing to that guard. The repository half of the stop link is finished; **what is missing is
the path from the form to it**, which is the server-function and UI work below, and which is what
`BKG-02` is actually short of. A deliverable that would ship a zero-line diff is restated rather
than left standing, because a stage nobody can fail is a stage nobody can verify.

- One new exported function, `linkReservationExpense(scope, reservationId, expenseId | null)`. It is
  the **only** way `reservations.expense_id` is ever written, and `expenseId` is deliberately **not**
  added to `reservationFields`, so no client payload can set it: the link is a consequence of the
  server's own side effect, never a field a caller supplies. The function resolves the booking through
  `reservationsRepository.requireById(scope, …)`, and when the id is non-null resolves the expense
  through `getExpense(scope, expenseId)` — a read that already exists and needs no widening — and
  requires its `tripId` to equal the booking's before writing. A mismatch is a `NotFoundError`.

- One new exported function, **`markReservationsImported(scope, reservationIds)`**, returning the
  number of rows it marked. It parses its argument with `z.array(idSchema).min(1).max(500)` — the
  same 500-row ceiling the import engine already applies, so the bound is the engine's and not a
  second opinion — and writes through
  `reservationsRepository.updateWhere(scope, inArray(reservations.id, ids), { importedAt: Date.now() })`:
  **one statement for the whole batch**, whose `where` begins at `tenantFilter()` like every other
  statement in the file, so an id belonging to another organization matches no row rather than
  raising, and the returned count is the number of rows that were genuinely the caller's.
  `imported_at` is an epoch-millisecond instant, per this plan's date conventions, and `Date.now()`
  is read once for the batch so every row of one import carries the same instant.
- One new exported function, **`clearReservationImported(scope, reservationId)`**, returning the
  updated row. It writes `{ importedAt: null }` through
  `reservationsRepository.requireUpdate(scope, reservationId, …)`, so a booking id that is not the
  caller's is a `NotFoundError` raised by the same scoped read every other writer in this file uses.
  It is idempotent: clearing a marker that is already null writes null again and returns the row, so
  the caller never has to ask first.

**Why the two marker writers are minted in this stage, whose subject is the stop link and the ledger
line.** `reservations.imported_at` is **this stage's own column**, filed in its **Data and migration**
section above onto the wave-2 schema stage, so it is on disk one wave before this stage opens. It is
set by `03-S7`'s confirm in wave 5 and cleared by `03-S6` in wave 4 — and **neither of those stages
owns `src/server/repos/reservations.ts`. This stage is the only one in the plan set that does, in any
wave.** That is why the column is asked for here rather than by the stage whose behaviour needs it: a
column and the only function that may write it have to reach the same wave, and this is the wave in
which the file is free. Left where they were, both writes were unexecutable in the worst
way available: `createReservationInput` and `updateReservationInput` are `z.object`s, so an
`importedAt` handed to `createReservation` or `updateReservation` is **not** an error — it is
silently **stripped** before the insert. Every imported row would land with a null marker, the desk's
"Unchecked import" badge would never appear on any booking, the clearing interaction would be a
no-op, and every test that asserted on the functions' return values would pass. That is the same
defect `03-S8` records against `day_accommodations.reservation_id`, found the same way; the
difference is that `src/server/repos/itinerary.ts` is genuinely free in `03-S8`'s wave, whereas this
file is free only in wave 3 — so the writers are minted here, three and two waves ahead of their
callers, instead of being claimed twice or filed onto a stage that does not carry the file.

**And why they are functions rather than two more fields.** Putting `importedAt` into
`reservationFields` would put the marker on the public booking payload, and a caller who can set
`imported_at` can also clear it: a hand-typed booking could be marked as machine-written, and an
import could mark its own rows as already checked. The marker is a statement the **server** makes
about its own writes, so it is written by these two functions and by nothing else —
`createReservation` and `updateReservation` never touch it. That is the same argument, for the same
reason, that keeps `expenseId` off `reservationFields` two bullets above.

**Server function — `src/server/fns/reservations.ts`.**

- `bookingInputSchema` and `bookingUpdateSchema` gain `assignmentId` as the same `''`-means-unset
  trimmed string the rest of the form uses, normalised through `orNull`.
- `loadBookingDeskFn` gains the trip's **stops**, as `{ assignmentId, dayId, dayNumber, dayLabel,
placeName, startTime }`, read through `getTripItinerary` — a function that already exists in
  `src/server/repos/itinerary.ts` and is already called by the planner, so this stage adds no
  repository function to that module and does not claim it. That matters twice over: `itinerary.ts` is
  claimed by `07-S9` in wave 3, this stage's own wave.
- **The ledger side effect**, minted here as one exported helper —
  `syncReservationExpense(scope, reservation)` — and **not** written inline in two handlers. It lives
  in this file, beside the writers that call it, and it is exported because three of its four callers
  are in stages that have not started yet: `createBookingFn` and `updateBookingFn` here in wave 3,
  `confirmBookingImportFn` in `03-S7` (wave 5) and `createStayFn` in `03-S8` (wave 6).

  **This is the defect that made it a helper.** An earlier draft described the side effect as two
  paragraphs of handler code, and both later stages then wrote their reservation by calling
  `createReservation` directly — as the dev seeder already does at
  `src/routes/api/dev/-seed/apply-trip.ts:335` — which is exactly how a booking imported from a
  confirmation, or a hotel saved as a stay, would have landed on the desk with a price and left no
  line in the trip's costs. Pushing the side effect down into the repository was considered and
  rejected for that same seeder: `createReservation` has a caller that must **not** produce ledger
  lines, so a repository that always produced them would be wrong for it. One helper, four named
  callers, and a seeder that deliberately does not call it.

  `reservation.expenseId` is the idempotency key for every branch, and it is read from the row that
  was just written rather than from the request:
  - `priceMinor > 0` and `expenseId === null` → `createExpense(scope, { tripId, title, amountMinor:
priceMinor, currency, spentOn, category })`, then `linkReservationExpense(scope, reservation.id,
expense.id)`. Two writes, and the second is what makes the third save of the same booking an update
    rather than a fourth ledger line.
  - `priceMinor > 0` and `expenseId !== null` → `repriceExpense(scope, reservation.tripId, reservation.expenseId, { title,
amountMinor: priceMinor, currency })`. No new row, no new link. A line that has shares has them re-divided in place
    from its stored method and weights in the same batch; one that cannot be (`exact`, or weights the split arithmetic
    refuses) keeps them and the outcome is `split-stale` (#881).
  - `priceMinor` cleared or zero and `expenseId !== null` → `linkReservationExpense(scope,
reservation.id, null)` and **nothing else**. The ledger line is not deleted: deleting it because a
    price was blanked destroys a record the reader may have split with three other people. The
    expense survives, unlinked, and the dialog says so in one sentence before it saves.
  - **Deleting the booking** deletes no expense either, for the same reason, and the row simply goes;
    the ledger keeps a line that no longer says which booking it came from, which is what the reader
    would have got had they typed it by hand.
  - **The three values that are not simply copied**, each with its fallback stated because
    `createExpenseInput` requires two of them:
    - `currency` — the booking's `currency` when it has one, otherwise the trip's. Both are
      `text(3)` ISO-4217 columns and neither is converted; a booking priced in yen produces a ledger
      line in yen, and turning that into the trip's accounting currency is `04-S5`'s subject and not
      this stage's.
    - `spentOn` — `dateSchema` and **required**. The chain is the booking's `start_date`, then the
      linked day's `date` (`days.date`), then the trip's `start_date`. All three are
      nullable, so when every one of them is null **no ledger line is written at all** and the dialog
      says why in the notice under the price: "Give this booking a date and its cost will be added to
      the trip's costs." A guessed date on a money row is worse than no row.
    - `category` — a total mapping over `RESERVATION_TYPES` landing inside `EXPENSE_CATEGORIES`
      (`src/server/db/schema.ts`), which the column's `CHECK` constraint enforces anyway. Total,
      so a type added later is a compile error rather than a silent `other`.

      **It is a default and not a lock, and the plan says so because the word "total" reads like
      one.** The reference product asks the reader to choose the category as they save. This stage
      does not add that field, for a measured reason rather than a stylistic one: `updateExpense`
      already accepts `category` (`src/server/repos/expenses.ts`), so the reader can recategorise the
      line on the costs screen where the rest of their budget is. A second control for one value, on a
      dialog that is already the longest in this plan, would be a second way to say the same thing —
      and the mapping is right in the ordinary case, which is what a default is for.
  - **No arithmetic anywhere in the side effect.** `price_minor` is assigned to `amount_minor` as one
    integer to another, per the money rule stated under **Data and migration** above.

- **The failure rule.** A ledger write that fails must not turn a saved booking into an error the
  reader will retry, producing two bookings. The reservation write is the transaction; the ledger
  write is attempted after it and, on failure, is logged and reported to the client as a
  `ledger: 'failed'` field on the result, which the dialog surfaces as a warning with a "Add it to the
  ledger" retry — the booking is saved, and the reader is told exactly what did not happen.

**Zod.** v4 idiom throughout, `z.object` with bounded strings, `z.enum` for the type and status, the
`error` parameter where the message is read by a person, and `z.array(idSchema).min(1).max(500)` on
the marker writer's id list. Validation is shape; the assignment's ownership is decided in the
repository, inside the tenant scope, by the guard that is already there.

**Authorisation.** `appScope()`, then `requireTrip`, then `assertReferences` inside the repository.
Three layers, and the last one is the only one that can see whether the id the client sent is the
caller's to use. The two marker writers add no fourth layer and need none: one resolves through
`requireUpdate` and the other through a `tenantFilter()`ed `updateWhere`, so both are inside the
same scope.

**And a fourth layer that is new here, in the repository rather than the handler.**
`assertTripRole(scope, tripId, ['owner', 'editor'])` guards every writer in
`src/server/repos/reservations.ts`, the same way `03-S2` guarded the transports repository one wave
earlier and for the same reason: `requireTrip` proves membership and membership is not a role, so at
HEAD a `viewer` on a trip can create, edit and delete bookings while the Durable Object refuses them
the collaborative equivalent. `01-S1` (`01-trips-core.md`, wave 1) mints the guard; this stage, in
wave 3, is the first claim on this file and therefore the only place it can be added.

The two marker writers are the deliberate exception and it is worth stating why, because an
exception discovered later reads as an oversight. `markReservationsImported` is called by the queue
consumer `03-S7` builds, which acts on no member's behalf and has no role to assert;
`clearReservationImported` is called from a booking save that has already passed the guard on the way
in. Both stay inside `tenantFilter()`, so neither can reach another tenant's row — what they skip is
the role check, not the scope.

**Nothing is enqueued.** Both writes are single-row and fast; the room mirror is the existing
`patch('reservation', …)` call, unchanged in shape.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path. `src/routes/_app/trips/$tripId/book.tsx` is **not** claimed — it needs no change, because
the new payload fields travel inside the object it already passes straight through, and because
`03-S6` and `03-S7` need that file in later waves.

**Components.** The stop picker is a `Combobox` from `src/components/ui`, used as shipped: it already
groups options under uppercase headings (`combobox.tsx:20-28`, `:114-120`), so "every stop, gathered
under its day" is a data shape rather than a new component. `Field`, `Alert` and the existing dialog
furniture do the rest. **No new primitive, and no new product component.**

**What changes on screen.**

- A **Linked stop** field in the dialog, between the day link and the dates, offered for every type
  except the stay — a stay covers a run of nights and does not belong to one stop, which is `03-S8`'s
  subject. Options are grouped `Day 3 · Fri 9 Oct` with each stop shown as its place name and its
  time, and filtering matches the place name and the day label together, so typing "kiyo" and typing
  "day 7" both work.
- Choosing a stop that already sits on a day **fills the empty date** from that day rather than
  leaving the reader to retype it, and never overwrites a date they typed themselves.
- A **ledger line** notice under the price, which states the effect _before_ the save, because a side
  effect the reader discovers afterwards is a side effect they did not agree to. Four sentences, one
  per branch of the side effect above: "A £42.00 line will be added to this trip's costs" (above zero,
  no link yet); "This booking's cost line will be updated to £48.00" (above zero, linked); "This
  booking's cost line will stay in the trip's costs, no longer linked to this booking" (price cleared,
  linked); and "Give this booking a date and its cost will be added to the trip's costs" (above zero,
  no date anywhere in the chain). The money in the first two is `formatMoneyMinor` with
  `tabular-nums`, in the booking's own currency.

**States.**

- _Empty._ A trip with no stops at all shows the picker disabled with the reason in its help text —
  "Add a place to a day first, then you can attach this booking to it" — rather than an empty listbox
  that looks broken. On `--color-surface-2`.
- _Skeleton._ The picker's options arrive with the route's loader; there is no second fetch and so no
  skeleton of its own. The desk's existing route-level skeleton covers the cold load, and a
  `RowsSkeleton` is what the desk already shows beneath its header.
- _Error._ A save that fails keeps the dialog open with the draft intact and the message in the
  `Alert`. A **partial** success — booking saved, ledger line refused — is its own state and is
  designed as one, with a warning tone and a retry that only retries the half that failed.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the picker, its clear
  button, the retry and the save button.

**Motion.** The notice under the price appears at `--duration-fast` on `--ease-out-quint`, opacity and
a 2px rise, and does not animate at all under `prefers-reduced-motion: reduce`. The combobox's own
open/close is the primitive's, unchanged.

**Tokens.** None missing. The notice uses `--color-info-soft` with `--color-ink-2`, the warning tone
`--color-warning-soft`, both already declared for both themes with their own dark values. The money in
the notice is `formatMoneyMinor` with `tabular-nums`.

### Quota

**No countable row of this stage's own**, with one deliberate exception worth naming: the ledger line
it creates is an `expenses` row, and `expenses` has no metric in `USAGE_METRICS` either — the eight
`assertQuota` call sites do not include `createExpense`, and this stage does not add one, because
adding a quota call inside `expenses.ts` would mean editing a file it is not allowed to claim. So this stage neither adds a metric nor
bypasses one; it creates at most one ledger row per booking write, bounded by the bookings the trip
already bounds. Nothing is added to `resolveLimits()` or `PLAN_QUOTAS`, and
`src/server/billing/__tests__/limits.test.ts` gains no case.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe` block, built on
the same two-organization `createScope()` fixtures the file already uses. Covered:
`createReservation`, `updateReservation`, `getReservation`, `listTripReservations`,
`setReservationStatus`, `deleteReservation`, `assertReferences` as it already stands, and the three
new writers `linkReservationExpense`, `markReservationsImported` and `clearReservationImported`.

The new cases, each scoped by `organization_id` on both sides of the link:

- A creating a booking whose `assignmentId` is one of B's stops is a `NotFoundError`; A updating its
  own booking to point at B's stop is the same.
- A calling `linkReservationExpense` with **B's reservation id** is a `NotFoundError` from the
  `requireById` that opens the function — it never reaches the expense at all.
- A calling `linkReservationExpense` on **its own booking** with **B's expense id** is a
  `NotFoundError`, because `getExpense(scopeA, …)` filters on A's `organization_id` and returns null.
  This is the case that proves the link cannot be used to reach across tenants, and it is the reason
  the function resolves the expense through a scoped read rather than trusting the id.
- A cannot cause a ledger row to be written into B's organization by any combination of ids, asserted
  by counting B's `expenses` rows before and after every attempt. B's reservations and B's expenses
  are both re-read afterwards and must be unchanged, including `expense_id` on B's bookings.
- A calling `markReservationsImported` with a list that mixes **one of its own booking ids with one
  of B's** marks exactly one row: the return value is `1`, A's booking comes back with an
  `imported_at` set, and B's booking is re-read and still null. This is the case that proves the bulk
  writer filters on the tenant and not merely on the id list, and it is the reason the function
  returns a count rather than `void` — a silent no-op on a foreign id is indistinguishable from
  success without one.
- A calling `clearReservationImported` on **B's** booking is a `NotFoundError` from `requireUpdate`,
  and B's `imported_at` is re-read afterwards and unchanged. A calling it twice on its own booking
  succeeds twice, which is the idempotence the desk relies on when a reader saves the same booking
  again.
- Neither marker function can be reached through a booking payload: `createReservation` and
  `updateReservation` are each called with an `importedAt` in their input and the written row's
  `imported_at` is asserted to be unchanged, which is the regression test for the strip defect this
  stage exists to close.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/modules/book/__tests__/booking-form.test.ts` — the stop field is offered for every
  type except the stay; choosing a stop fills an empty date and never overwrites a typed one; a draft
  with a stop from a day the trip does not have is invalid.
- A new case set in the same file for the ledger notice's copy, one per branch: above zero with no
  link, above zero with a link, price cleared with a link, and above zero with no date anywhere in the
  `start_date` → day `date` → trip `start_date` chain.
- The `RESERVATION_TYPES` → `EXPENSE_CATEGORIES` mapping is total, asserted by iterating
  `RESERVATION_TYPES` and requiring each result to be a member of `EXPENSE_CATEGORIES`.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the block above.

**Browser evidence.** Route `/trips/demo-trip-01-tokyo-and-kyoto/book`, six frames at 360, 1280 and
2560 in both themes, plus the **declared state**: the booking dialog open with the stop picker
expanded and its day groups visible, `--state stop-picker`, reached with
`--click '[data-part="new-booking"]'` then `--click '[data-part="stop-picker"]'`. Both selectors are
proven to resolve by a `count()` assertion in the spec before a frame is filed. The `capture.mjs`
invocation is the one quoted in `03-S1`, `PT_SERVER_TODAY=2026-08-20`.

**Console** silent, `fatal` empty, no addition to `TOLERATED_CONSOLE_WARNINGS`. **Layout shift** after
the settle mark asserted `0` on Chromium — the ledger notice appears on a keystroke, which is
`hadRecentInput` and therefore excluded, and the assertion is made about the resting screen — and
reported as a skip on WebKit.

### Definition of done

The six items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

Per surface:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One dependency on another plan, already satisfied by the wave order.** `MNY-02` is closed by `04-S3`
(`04-budget-and-currencies.md`, wave 2), which is what makes an expense editable from the surface the
reader is looking at; this stage is wave 3 and creates a row that stage can already edit. If `04-S3`
has not landed, this stage does not ship the ledger side effect against a ledger it invented — it
stops, because the alternative is a second opinion about money.

**And one thing this stage explicitly does not ask of any other plan**, stated here because an earlier
draft did ask and the request landed nowhere. It needs **no** change to `src/server/repos/expenses.ts`
and **no** change to `src/server/fns/costs.ts`. It does not need `createExpenseInput` or
`updateExpenseInput` widened, it does not need a `findExpenseByReservation` read, and it does not need
`04-S3` to reverse the deferral it states in its own prose. Both schema requirements,
`reservations.expense_id` and `reservations.imported_at`, are on a table this stage's own repository
owns, and both are filed onto the wave-2 schema stage of `00-foundations.md` — the supplier this
plan's shared-paths table names for a wave-3 filer. Verified by reading every stage of this file:
`src/server/repos/expenses.ts` appears under no stage of this plan, in any wave — re-measurable with
`grep -n "repos/expenses" docs/plans/03-reservations-and-transport.md`, whose every hit is prose
explaining that absence and none of which is an **Owned paths** bullet.

No package outside the pinned set, no binding absent from `wrangler.jsonc`, no third-party service.
The abbreviated-month defect of `12-verification-protocol.md` §7.2 is inherited by every stage that
baselines a trip tab and is repaired for the booking desk's own formatter by `03-S6`, which owns that
file.

---

## Stage 03-S5 — The journey between two places, in the day it happens

### Stage id

`03-S5` · Wave 4 · effort **M**. One wave above this row's floor, for the reason the Area brief's
third disagreement gives; its owned paths and `03-S6`'s, the other wave-4 stage, do not intersect.

### Reference rows

- `BKG-10` absent → **done**.

Sourced from `wiki: Transport-Flights-Trains-Cars` for the behaviours: a movement that belongs to a
day appears in that day's sequence between the places it connects; a movement spanning several days
is labelled by the part of it that each day sees; and a journey broken into legs contributes one
row per leg, each in its own day at its own time.

**Agreement with the row, and the host it plugs into.** The row is right that
`src/routes/_app/trips/$tripId/-server/plan.ts` loads stops and stays only and that
`src/components/planner/types.ts` has no shape for a transport row. The host surface is `TRP-08`,
built by `01-S4` (`01-trips-core.md`, wave 2), whose **UI** section names this seam explicitly:
`PlannerItem` is a union and the merge reads only `{ id, position, time }`, "so a third kind is one
variant in the union, one prefix in the id space and one renderer — and no change to the merge, the
drag adapter or the repository's two-table batch beyond its own table". This stage fills exactly that
seam on the UI side: one variant, one prefix, one renderer.

**Where the repository half turns out not to be free, said plainly rather than discovered.** A day's
sequence is one dense run of positions `0..n-1`, so a third kind that takes part in it wants to be
written in the **same** batch as the other two. That batch lives in `src/server/repos/itinerary.ts`,
and this plan may not claim that file: `01-S4` holds it in wave 2, `07-S9` in wave 3 and `02-S9`
(`02-places-and-maps.md`) in wave 5, and the only wave in which every **other** file this stage needs
is free is wave 4 — where taking `-server/plan.ts` and `-ui/plan-model.ts` would clobber `02-S7`.
The consequence is one design decision and one honest trade-off, both under **Server**. What is
**not** affected is the seam `01-S4` describes: one variant, one prefix, one renderer, exactly as
promised.

Rows unblocked: none. No plan file names `BKG-10` as a supplier — every cross-plan mention
(`grep -rn "BKG-10" docs/plans/`) is the opposite edge, `BKG-10 → TRP-08`, or a host-and-seam note
about it.

### Owned paths

- `src/components/planner/types.ts` — edit. The third variant of `PlannerItem`. Shared with `01-S2`
  (wave 1) and `01-S4` (wave 2) in `01-trips-core.md`, and with `03-S8` (wave 6) in this file; four
  stages, four waves, no concurrency.
- `src/components/planner/ordering.ts` — edit. The `leg:` id prefix and its three helpers, in the same
  shape `IDEA_PREFIX` (`:29`) and the note prefix already use. Shared with `01-S4` (wave 2).
- `src/components/planner/plan-dnd.ts` — edit. The drag adapter recognises the new prefix. Shared with
  `01-S4` (wave 2).
- `src/components/planner/day-section.tsx` — edit. Renders the new variant in the merged sequence.
  Shared with `01-S2` (wave 1), `01-S4` (wave 2), `02-S4` (`02-places-and-maps.md`, wave 3, the
  map-click place creation), `02-S9` (same plan, wave 5, the per-day route pills) and `03-S8`
  (wave 6); six stages, six waves — and it is the most contended file in the whole plan set, which is
  what decided this stage's wave.
- `src/components/planner/transport-row.tsx` — new. The renderer, beside the stop's and the note's.
- `src/components/planner/index.ts` — edit. Shared with `01-S2` (wave 1) and `01-S4` (wave 2).
- `src/components/planner/__tests__/ordering.test.ts` — edit. Extended, never rewritten. Shared with
  `01-S4` (wave 2).
- `src/components/planner/__tests__/transport-rows.test.ts` — new. The phase labels and the leg
  expansion, on their own.
- `src/routes/_app/trips/$tripId/-server/plan-transports.ts` — new. This stage's own loader and its
  own reorder writer, in a route-local `-server/` module rather than inside `-server/plan.ts`. The
  reason is ownership and is stated under **Server**: `-server/plan.ts` is claimed by `07-S1`
  (wave 1), `01-S4` (wave 2), `02-S7` (wave 4 — this stage's own wave) and `02-S9` (wave 5), and this
  stage may not take it in any wave where the rest of its files are free.
- `src/routes/_app/trips/$tripId/-ui/plan-transport-model.ts` — new. Builds the transport rows for a
  day, beside `plan-model.ts` rather than inside it, for the same ownership reason.
- `src/routes/_app/trips/$tripId/plan.tsx` — edit. The route loads the transport rows alongside the
  board. Shared with `01-S2` (wave 1).
- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` — edit. The drag path routes a transport move to
  this stage's writer. Shared with `01-S2` (wave 1), `01-S4` (wave 2), `02-S4` (wave 3) and `01-S9`
  (wave 5); five stages, five waves.
- `src/server/repos/transports.ts` — edit. `listTripDayTransports` and `reorderDayTransports`. Third
  claim by this plan, at wave 4; `03-S1` holds it in wave 1 and `03-S2` in wave 2, and no sibling plan
  claims it at all.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/reservations-and-transport.visual.spec.ts` — append.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — append.

**Three paths this stage deliberately does not claim, each with the sibling that holds it.**
`src/server/repos/itinerary.ts` (`01-S4` wave 2, `07-S9` wave 3, `02-S9` wave 5),
`src/routes/_app/trips/$tripId/-server/plan.ts` (`07-S1` wave 1, `01-S4` wave 2, `02-S7` wave 4,
`02-S9` wave 5) and `src/routes/_app/trips/$tripId/-ui/plan-model.ts` (`01-S2` wave 1, `01-S4`
wave 2, `02-S7` wave 4, `02-S9` wave 5). Between them those three files are claimed in every wave
from 1 to 5 by four other stages in three other plans; there is no wave in which this stage could
take them and also take `day-section.tsx`. The design under **Server** is what that costs, and it is
stated there rather than left for whoever executes this to discover.
`src/server/repos/days.ts` is not claimed either: the note rows are reached through the
`dayNotesRepository` that module already exports, so the merged read still has one home.

### Data and migration

**No schema change and no migration.** Every column this stage reads exists: `transports.day_id`
(`transports` in `src/server/db/schema.ts`) and `transports.arrival_day_id` (`03-S1`) for a whole-record row;
`transport_legs.departure_day_id`, `arrival_day_id` and `sort_order` (`03-S2`) for a leg row;
`transports.sort_order` (`:679`, through the shared `sortOrder()` helper) for the record's own
position. **Nothing is filed for any schema stage on this stage's account**, so the register in
`00-foundations.md` mints nothing for wave 3 because of this stage.

**One number line, three tables, stated once.** For a given day, `day_assignments.order_index`,
`day_notes.sort_order` and — from this stage — `transports.sort_order` or
`transport_legs.sort_order` are read and written as one sequence of positions `0..n-1`. The server
derives every position from array index on each write, so no fractional value survives a move and the
columns cannot drift apart in the ordinary case. A rollback is safe by construction: the previous
Worker reads two of the three and renders the sequence it already knows, because this stage writes no
value any of those columns could not already hold.

**The scoping, and the money this stage renders but never writes.** Both tables this stage writes —
`transports` and `transport_legs` — carry `organization_id NOT NULL` and each leads a composite index
with it (`transports_org_trip_idx`, `transport_legs_org_trip_idx`), so every statement is bounded by
the tenant through `tenantFilter()`. The row shows a fare only where the record already has one, read
from `transports.price_minor` as an **integer count of minor units** beside its `text(3)` ISO-4217
`currency` and formatted by `formatMoneyMinor` with `tabular-nums`; this stage writes no money column
and performs no conversion.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/transports.ts`.**

- `listTripDayTransports(scope, tripId)` — every transport and every leg of the trip that carries
  a day reference, with both ends, so the caller can compute what each day sees. One query per table,
  both `tenantFilter()`-scoped, both ordered by `sort_order` then `id`.
- `reorderDayTransports(scope, { tripId, dayId, items })` — writes `sort_order` for the transport rows
  and the leg rows of one day from array index, in a single `scope.db.batch()`, which on D1 is a
  real transaction: statements run sequentially and a failure rolls the whole sequence back. It drops
  an incoming id that is not on that day rather than rejecting the whole call — a tab one delete
  behind should still be able to reorder the rows that do exist, which is the rule the jsdoc at
  `-server/plan.ts:252-254` already states over `reorderPlanFn` — and appends any known id the
  client omitted at its
  current relative position, so a partial list cannot silently delete a position.

**Server function — `src/routes/_app/trips/$tripId/-server/plan-transports.ts`, a module of its own.**

- `loadPlanTransportsFn` — `createServerFn({ method: 'GET' })`, validator `z.object({ tripId })`,
  returning one entry per covered day: the record or leg id, the mode, the status, the two
  endpoint names, the two times, the two day ids and the position. The plan route calls it beside
  `loadPlanBoard` rather than inside it.
- `reorderDayTransportsFn` — `createServerFn({ method: 'POST' })`, validator
  `z.object({ tripId, dayId, items: z.array(z.object({ kind: z.enum(['transport', 'leg']), id })).max(200) })`.
  It resolves the scope, the trip and the day, calls `reorderDayTransports`, then mirrors one `day`
  upsert into the trip's room so other tabs see the move — the same mirror shape every other writer in
  this plan uses.

**Why a second module and not two more functions in `-server/plan.ts`, since this is the one design
decision in the stage.** That file is claimed by four stages in three other plans, in waves 1, 2, 4
and 5, and this stage's other files are only jointly free in wave 4 — where `02-S7` holds it. A stage
that claimed it anyway would clobber a sibling; a stage that moved to a wave where it is free would
clobber a different sibling on `day-section.tsx`. So the ownership is split at the file boundary
rather than at the wave boundary, and the cost is paid once, here, in the open.

**What that costs, stated rather than discovered: a reorder that interleaves kinds is two calls.**
`reorderPlanFn` writes the stops and the notes; `reorderDayTransportsFn` writes the transport rows.
Each is atomic in itself and neither is atomic with the other, so if the second fails the day's
transport rows keep their previous positions while the stops and notes have moved. Four things bound
that, and all four are properties of code that already exists:

1. Positions are recomputed from array index on **every** successful reorder, so the next successful
   move heals the day completely — the self-healing contract `-server/plan.ts:261-267` already
   documents for the two tables it owns.
2. The merged sequence sorts on `(time, position, id)`, and a transport row almost always carries a
   departure time, so a stale position between two timed rows changes nothing a reader can see.
3. The client issues the two calls together and rolls its optimistic order back if **either** fails,
   which is the contract `plan-screen.tsx` already implements for the single-call case.
4. The two calls are ordered stops-then-transports, so the failure that survives is the one that
   leaves the less visible half stale.

The better shape — one batch over one number line, inside `reorderDayTimeline` — is a small change in
`src/server/repos/itinerary.ts` on the day a wave exists in which this plan may hold that file. It is
written so that making it is a **deletion**, not a redesign: `reorderDayTransports` disappears into
the existing batch and the second server function loses its writer.

**Route data — `src/routes/_app/trips/$tripId/plan.tsx`.** The route's loader resolves
`loadPlanBoard` and `loadPlanTransportsFn` together with `Promise.all`, so the second read costs no
extra round trip on the critical path, and hands both to the screen.

**Authorisation.** `appScope()` then `requireTrip`, then `requireTripDay` for the day, then the
repository resolves every row inside the tenant scope. A reorder is a write and is authorised like
one.

**Nothing is enqueued.** A reorder is one small batch per touched day and per writer.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path.

**The mount, in one sentence, because this stage's ownership is unusual.** `plan.tsx` loads the rows,
`plan-transport-model.ts` turns them into `PlannerItem`s, `plan-screen.tsx` merges those into the day
it hands `DaySection`, and `day-section.tsx` renders the third variant through `transport-row.tsx`.
`plan-model.ts` is untouched, and the merged sort contract `01-S4` owns is read, not re-implemented.

**Components.** `transport-row.tsx` is a renderer beside the existing stop and note renderers,
composing `Badge`, `Chip`, `IconButton` and `DropdownMenu` from `src/components/ui` and the mode glyph
from `src/components/modules/transports/mode-icon.ts` — the same glyph the transports tab uses, so one
journey is one symbol wherever the reader meets it. **No new primitive is proposed.**

**What each day sees, which is the substance of the row.**

- A transport that starts and ends on the same day renders as one row between the places it connects:
  glyph, endpoints as `Tokyo → Hakone-Yumoto`, the two times, the service number when there is one,
  and the status as the same pill vocabulary the transports tab uses.
- A transport that **spans days** renders on every day it covers, and each day says which part of it
  this is. The three-part vocabulary is chosen per mode and stated in our own words: a flight reads
  _Departs / In the air / Lands_; a hire car reads _Pick-up / On hire / Drop-off_; everything else
  reads _Starts / Under way / Ends_. The mapping is a pure function over `TRANSPORT_MODES`, total by
  construction, and it is the thing `transport-rows.test.ts` proves.
- A journey of more than one leg does not render as one spanning row. Each leg renders in its own day at
  its own time, independently positioned and independently draggable, which is the structural
  difference between a two-station journey and a five-station one and is the reason `transport_legs`
  carries its own `sort_order`.
- A **stay** never appears here. An accommodation covers nights rather than moments, it is represented
  on the day header by `03-S8`, and a row for it in the sequence would be a duplicate of a badge.

**Drag.** The `leg:` prefix keeps the id space apart exactly as `idea:` and `note:` do. Two rules,
inherited rather than invented: a transport row cannot be dropped into the ideas column, which is the
trip's unscheduled place inventory and has no meaning for a journey; and a timed row is moved by its
time, so dropping one where its clock contradicts its neighbours is refused with the reason said out
loud — both are `01-S4`'s refusal paths, reused with their own reasons rather than reimplemented.

**States.**

- _Empty._ A day with no stops, no notes and no transport keeps the dashed drop target `01-S4` leaves
  it, on `--color-surface-2`. A transport with no day at all is not lost: it stays on the transports
  tab, and the row's menu offers "Put this on a day".
- _Skeleton._ The planner's existing day-section skeleton covers the cold load; a row with a write in
  flight takes the `pendingItemIds` treatment `DaySection` already applies to stops and notes.
- _Error._ A refused move never mutates the board and states its reason in a toast. A **failed** write
  rolls the optimistic order back to the previous arrangement — and, for the split-write case above,
  rolls back **both** halves, so the board never shows a half-applied reorder even when the server
  achieved one.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the row, its drag
  handle and its menu. The row is keyboard-draggable through the same `src/lib/dnd-keyboard.ts` path
  the stop rows already use.

**Motion.** The row's entrance is the day section's existing stagger, capped at eight items,
20–30ms apart, `--duration` on `--ease-out-quint`, transform and opacity only, collapsed under
`prefers-reduced-motion: reduce`.

**Tokens.** None missing. The row sits on `--color-surface` inside the day's `--color-surface-2`
section with a `--color-edge-faint` hairline; the phase label is `--text-micro` with
`--tracking-label` in `--color-ink-3`; times carry `tabular-nums`. Every pair is one the planner
already checks at AA in both themes.

### Quota

**No countable row.** This stage creates nothing: it reads rows `03-S1` and `03-S2` create and it
updates a `sort_order`. `USAGE_METRICS` gains nothing, `resolveLimits()` gains nothing,
`PLAN_QUOTAS` gains nothing, and `src/server/billing/__tests__/limits.test.ts` gains no case and is
not an owned path.

### Tenant isolation test

Appended as one `describe` block. Covered: `listTripDayTransports` and `reorderDayTransports`.

The cases: A cannot list B's day transports by trip id; A cannot reorder a day belonging to B's trip,
which is a `NotFoundError` from `requireTripDay` and not an empty success; and A passing B's transport
ids or B's leg ids inside a reorder of A's **own** day must move nothing at all — the ids are
dropped as unknown, and B's `sort_order` values on both tables are re-read afterwards and must be
identical. That last case is the one this stage genuinely adds, because a reorder is the one write
shaped like a bulk update over ids the client chose.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/planner/__tests__/transport-rows.test.ts` — the phase vocabulary is total over
  `TRANSPORT_MODES` and picks the right triple for a flight, a hire car and everything else; a
  three-day transport produces exactly three rows with the first, middle and last labels; a
  four-leg journey produces four rows and no spanning row; a stay produces none.
- `src/components/planner/__tests__/ordering.test.ts` — the `leg:` prefix round-trips; a transport row
  dropped into the ideas column is refused with `'not-in-ideas'`; a timed transport row dropped out of
  clock order is refused with `'timed'`.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the block above.

**Browser evidence.** Route `/trips/demo-trip-01-tokyo-and-kyoto/plan`, six frames at 360, 1280 and
2560 in both themes. The **declared state** is the one that is the point of the stage and is not
visible at rest: a day whose sequence interleaves a stop, a transport row and a note, with the
transport row hovered so its drag handle and its menu are showing —
`--hover '[data-part="planner-transport-row"]'`, `--state transport-row-hover`. The selector is an
attribute this stage adds and is proven to resolve by a `count()` assertion in the spec. The planner
carries a live map, so the capture is invoked with `--map` and the two-sided `[data-map-ready]`
predicate is re-checked after every resize and every theme change, which `capture.mjs` already does.
`PT_SERVER_TODAY=2026-08-20`, as `03-S1` quotes in full.

**Console** silent, `fatal` empty. The headless rasteriser's GL advisory is the one tolerated entry on
a route with a live map, it is already in `TOLERATED_CONSOLE_WARNINGS` scoped to exactly that case,
and this stage adds nothing to that list. **Layout shift** after the settle mark asserted `0` on
Chromium and reported as a skip on WebKit.

### Definition of done

The six items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

Per surface:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**Two dependencies on other plans, both satisfied by the wave order, and one of them is a hard
precondition rather than a courtesy.** `01-S4` (`TRP-08`, wave 2) must have landed: this stage renders
a variant of a union that stage creates, and there is nothing to plug into before it. `03-S1` and
`03-S2` must have landed, which wave 1 and wave 2 guarantee inside this file.

The cross-day residual under **Server** is a property of a signature `01-S4` owns, not a blocker: the
stage ships complete with it, and it is stated where a reviewer will meet it.

No package outside the pinned set, no binding absent from `wrangler.jsonc`, no third-party service.

---

## Stage 03-S6 — The desk: what is settled, what is not, and what is nobody else's business

### Stage id

`03-S6` · Wave 4 · effort **M**. The stage that turns the bookings list into a desk a person works
from; it shares wave 4 with `03-S5`, whose owned paths are the planner's and do not intersect these.

### Reference rows

- `BKG-01` partial → **done**.

Sourced from `wiki: Reservations-and-Bookings` for the behaviours: the list separates what is settled
from what is still outstanding and remembers which of those the reader had collapsed; a filter narrows
the list to the kinds of booking the reader is working on; a booking that arrived from an import is
marked until a person has looked at it; and a confirmation code can be kept off the screen until the
reader asks for it, because a shared screen is not a private one.

**Agreement with the row.** It is right that
`src/routes/_app/trips/$tripId/book.tsx` and `bookings-timeline.tsx` render a real desk from
`loadBookingDeskFn`, and right about all four gaps. One correction with its own evidence: the row
records the missing import marker as a missing column, which it is — but this plan does not add the
boolean the reference keeps. See **Data and migration**.

**One deliberate divergence, stated because a critic will notice it.** The reference surfaces a
transport record inside the bookings list as well as on its own tab. We do not duplicate a journey
into two lists: the desk lists `reservations`, the transports tab lists `transports`, and a
reservation of type `transport` that carries a `transport_id` (`reservations` in `src/server/db/schema.ts`) shows a
quiet link to the leg it belongs to. One record, one home, one place to edit it — and the reader can
still walk between them in one click.

Rows unblocked: none. No row lists `BKG-01` in its `dependsOn`.

### Owned paths

- `src/components/modules/book/bookings-timeline.tsx` — edit. Grouping, the filter row, the marker, the
  masked code.
- `src/components/modules/book/grouping.ts` — edit. A second grouping beside the one it already has.
- `src/components/modules/book/__tests__/grouping.test.ts` — edit. Extended, never rewritten.
- `src/components/modules/transports/transports-timeline.tsx` — edit. The transport card's booking code obeys the
  same preference, taking it as a prop; a `components/modules` component never fetches. This plan's
  fourth claim on that file, at wave 4; `03-S1` holds it in wave 1 and `03-S2` in wave 2.
- `src/routes/_app/trips/$tripId/transports.tsx` — edit. The loader reads the preference beside the
  transport desk and hands it to `TransportsTimeline`. Owned here because without it the card's mask has
  no channel: `src/server/fns/transports.ts` and `src/routes/_app/-server/trip.ts` are both held by
  earlier waves of this plan and neither is claimable at wave 4, so the preference reaches the
  transports tab through the route or not at all. This plan's third claim on that file, at wave 4;
  `03-S1` holds it in wave 1 and `03-S2` in wave 2. **No sibling plan claims it in any wave**, which
  is why it does not appear in the collision check's cross-plan list.
- `src/routes/_app/trips/$tripId/book.tsx` — edit. The loader reads the same preference beside the
  desk payload, in one `Promise.all`, and passes it through.
- `src/server/fns/reservations.ts` — edit. The desk payload carries the import marker. Shared with
  `00-S3` (`00-foundations.md`, wave 0) and `03-S4` (wave 3).
- `src/routes/_app/settings/appearance.tsx` — edit. The switch, in the section that already holds the
  reader's display choices. Shared with `02-S2` (`02-places-and-maps.md`, wave 1, the basemap
  catalogue) and `09-S8` (`09-account-and-settings.md`, wave 3); three stages, three waves.
- `src/routes/_app/-server/settings.ts` — edit. The appearance loader and the appearance writer each
  widen by one field, and one small reader — `loadDisplayPreferences` — is added for the two trip tabs.
  Shared with `00-S3` (`00-foundations.md`, wave 0), `02-S2` (wave 1), `09-S7` (wave 2) and `09-S8`
  (wave 3), all earlier.
- `src/server/repos/settings.ts` — edit. Three edits in one file — the write validator, the
  `EffectiveSettings` interface and the object literal `getEffectiveSettings` returns — and no new
  function. Shared with `02-S2` (wave 1) and `09-S8` (wave 3).
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/reservations-and-transport.visual.spec.ts` — append.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — append.

**Where the switch lives, and the disagreement with a sibling plan that decides it.** `09-S8`
(`09-account-and-settings.md`, wave 3) defers exactly this preference and names its destination as
"`BKG-06`, `03-reservations-and-transport.md`, wave 1", on the sound rule that a switch ships in the
same stage as the surface that obeys it. This plan agrees with the rule and disagrees with the
destination, for two measurable reasons: `BKG-01` is the row whose own name carries the masked
confirmation code, and `BKG-06` is a transports row that happens to share a field; and a wave-1 stage
would add a control to `appearance.tsx` in the wave **before** `09-S8` rebuilds that screen's
appearance section, which is the worst possible ordering for the same file. Wave 4 puts the switch in
after the settings shell has settled, in the stage that owns both obeying surfaces. The rule is kept;
only the address changes.

### Data and migration

**One additive column, filed onto the wave-3 schema stage of `00-foundations.md`.** This stage is
wave 4, so its supplier is the wave-3 instance of the per-wave schema stage that file's register mints
— not `00-S1`, whose closing clause absorbs wave-1 filers only and which closed three waves earlier.

- `user_settings.mask_confirmation_codes` — `integer('mask_confirmation_codes', { mode: 'boolean' })
.notNull().default(false)`, in the idiom of `reduce_motion` two lines above it
  (`src/server/db/schema.ts`, the `userSettings` table). Not nullable, because a display preference
  with three states is a bug waiting to be rendered; defaulted to off, because a product that hides
  the reader's own data on first sight has made a decision for them.
- Migration: the next ordinal `pnpm db:generate` mints. It **backfills nothing** — the default is the
  backfill, and a rollback ignores a column it does not know while every existing settings row keeps
  working.

**No money column is added or changed.** The desk keeps rendering `reservations.price_minor` — an
**integer count of minor units** beside its `text(3)` ISO-4217 `currency` — through `formatMoneyMinor`
with `tabular-nums`, and the masking this stage adds covers the confirmation code and never the
price: hiding what a trip costs from the person paying for it would be a different feature and a
worse one.

**The import marker is `03-S4`'s column, read here — and cleared here through `03-S4`'s writer.**
`reservations.imported_at` is declared in that stage's **Data and migration** and filed onto the
wave-2 schema stage, because a column and the only repository that may write it have to reach the same
wave, and wave 3 is the one wave in which `src/server/repos/reservations.ts` is free. It is therefore
already on disk two waves before this stage opens. This stage reads it, renders the marker, and clears
it. **It does not claim `src/server/repos/reservations.ts`** — `03-S4` holds that
file in wave 3 and is the plan's only claimant — and it adds `importedAt` to no validator, because
`updateReservationInput` is a `z.object` that would strip the key without raising and the marker
would simply never clear. The clearing is therefore a named repository function,
`clearReservationImported(scope, reservationId)`, minted by `03-S4` one wave earlier and called from
`updateBookingFn` in `src/server/fns/reservations.ts`, which this stage does own. Both columns are
listed in this plan's shared-paths table with their supplier named: `mask_confirmation_codes` on the
wave-3 schema stage for this stage, `imported_at` on the wave-2 one for `03-S4` — which is what makes
`03-S4` able to mint a writer for a column neither `03-S6` nor `03-S7` may declare.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/settings.ts`. Three edits, none of them optional, and no new
function.**

- `updateUserSettingsInput` gains `maskConfirmationCodes: z.boolean().optional()`, one line beside
  `reduceMotion: z.boolean().optional()` at `:141`. Without it the key never survives the write:
  `updateUserSettings` (`:228-239`) passes its input through `updateUserSettingsInput.parse`, and a
  `z.object` **strips** an unknown key rather than refusing it, so the switch would report success and
  save nothing.
- `EffectiveSettings` gains `readonly maskConfirmationCodes: boolean`, beside
  `readonly reduceMotion: boolean` at `:266`.
- The object literal `getEffectiveSettings` returns gains one more key,
  `maskConfirmationCodes: user?.maskConfirmationCodes ?? false`, in the idiom of
  `reduceMotion: user?.reduceMotion ?? false` at `:300`.

**Why the third edit exists, stated because the sentence it replaces was false.** An earlier revision
of this stage claimed `getEffectiveSettings` "already returns the whole row, so the new field arrives
everywhere the old ones do". It does not, and the difference is the whole feature. Measured at
`src/server/repos/settings.ts:271-304`: the function reads two rows under one `Promise.all` and then
**hand-builds an object literal, field by field** — twelve named keys, no spread of either row, so
every value it exposes is a value someone wrote out. A column added to `user_settings` and to the
write validator therefore reaches **no reader at all** until the interface and that literal both name
it, and this stage would have shipped a switch that writes a boolean nothing can ever read: a dead
masking feature that passes `pnpm typecheck`, `pnpm lint` and a row-level test.

`reduce_motion` is the precedent for the whole chain and shows how many sites a display preference has
to be named in — the column (`reduce_motion` in `src/server/db/schema.ts`), the write validator
(`src/server/repos/settings.ts:141`), the
interface (`:266`), the returned literal (`:300`), the appearance payload type
(`src/routes/_app/-server/settings.ts:269`), the payload literal (`:285`), the writer's validator
(`:297`) and the writer's pass-through (`:305`). Eight, and this preference needs the same eight plus
the one reader below. The regression test is in **Tenant isolation test**, and it asserts through
`getEffectiveSettings` rather than through the stored row for exactly this reason.

The workspace-level default is deliberately **not** added — a workspace cannot decide on a member's
behalf whether their own screen is shoulder-safe — so `organization_settings` is untouched,
`updateOrganizationSettingsInput` gains nothing, and the `?? false` above is the whole precedence
rule.

**Scoping, because this stage does write a row.** `user_settings` carries `organization_id NOT NULL`
(`src/server/db/schema.ts`, through `orgRef()`) and is reached only through
`userSettingsRepository`, built by `createTenantRepository(userSettings, 'user settings')`
(`src/server/repos/settings.ts:57`). So `updateUserSettings` matches on
`organization_id = scope.ctx.organizationId` before the row id can be considered, and the insert
`ensureUserSettings` may make stamps the same value rather than accepting one from the caller. The
row is always located by `(scope.ctx.organizationId, scope.ctx.userId)`; no user id, organization id
or settings row id crosses the wire from the client, and this stage adds no raw `db.select()`
anywhere — SQL stays in `src/server/repos`.

**Server function — `src/routes/_app/-server/settings.ts`. Four edits and one new reader.**

- `AppearancePayload` gains `readonly maskConfirmationCodes: boolean` (`:269` idiom) and
  `loadAppearance` fills it from `userRow.maskConfirmationCodes` (`:285` idiom), which is what puts the
  switch's current position on the appearance screen.
- `saveAppearance`'s validator gains `maskConfirmationCodes: z.boolean().optional()` (`:297` idiom)
  and its handler forwards it into `updateUserSettings` (`:305` idiom). Authorisation is unchanged and
  is the point: the preference is written for the **session's own** user id through `appScope()`,
  never for a user id the client names.
- `loadDisplayPreferences` is added — a `createServerFn({ method: 'GET' })` returning
  `{ readonly maskConfirmationCodes: boolean }` read from `getEffectiveSettings(await appScope())`. It
  is the single channel both trip tabs use, so the precedence rule stays in the repository and no
  screen re-derives it. Its cost is measured rather than assumed: `getEffectiveSettings` runs
  `ensureOrganizationSettings` and `getUserSettings` under one `Promise.all`
  (`src/server/repos/settings.ts:275-278`), two single-row reads on indexes that already exist, and
  `ensureOrganizationSettings` inserts the workspace settings row on a workspace that has never opened
  the settings screen (`:171`) — idempotent, at most once ever, and the same ensure that
  `-server/settings.ts:123` already makes.

**Server function — `src/server/fns/reservations.ts`. The marker, and only the marker.**

- `loadBookingDeskFn` gains `importedAt` per booking row. That is not a new query: the marker rides on
  the reservation row already being selected. It carries **no** masking flag — an earlier draft put
  `maskCodes` on this payload, which would have left the transports tab needing a second,
  differently-shaped copy of one boolean. One value, one reader, one shape.
- `updateBookingFn` calls `clearReservationImported(scope, reservation.id)` **after** the update has
  succeeded and inside the same handler, so that saving a booking is what clears its marker. It is
  called unconditionally rather than behind a "was it set" read: the function is idempotent, a second
  read to avoid a null-to-null write would cost more than the write, and a marker that survives a save
  because of a race is the one failure the reader would notice. If that call throws, the booking is
  still saved and the handler reports `marker: 'failed'` on its result, exactly as the ledger side
  effect `03-S4` adds reports `ledger: 'failed'`; the desk surfaces it as a warning rather than
  turning a saved booking into an error a reader will retry into a duplicate.

**Zod.** v4 idiom, `z.boolean()`, no coercion — a checkbox that posts the string `"false"` is a client
bug and must fail loudly rather than be coerced into `true`.

**Nothing is enqueued.** Every read this stage adds is a single row, by primary key or by an index
that already exists.

### UI (route, components)

**Route.** Two route files are edited in place — `src/routes/_app/trips/$tripId/book.tsx` and
`src/routes/_app/trips/$tripId/transports.tsx` — and each loader gains one parallel server-function
call. **No route file is added, moved or renamed**, so `pnpm generate-routes` is not run and
`src/routeTree.gen.ts` is not an owned path.

**Components.** `Switch`, `Chip`, `Badge`, `Button`, `IconButton`, `Tooltip` and `EmptyState` from
`src/components/ui`; `FilterRow`, `ModulePanel` and `CopyValue` from `src/components/modules/shared`;
`useLocalPreference` from `src/lib/local-preference.ts`, minted by `01-S3` (`01-trips-core.md`,
wave 1) and already reused by `01-S5` and `01-S7`. **No new primitive, and no second preference
store.**

**What changes on screen.**

- **Two groups, not one list.** Settled bookings and outstanding ones, each with its own count and its
  own disclosure, and the date grouping the desk already does stays **inside** each group — a reader
  chasing three unconfirmed hotels should not have to read past nine confirmed ones to find them.
  Which group is collapsed is remembered **per trip**, through `local-preference` under
  `planned.book-groups.<tripId>`, in `localStorage` rather than `sessionStorage`: unlike "which tab
  was I on", this is a working preference a reader expects to survive a lunch break. The trade-off —
  it does not follow them to a second device — is the same one `01-S3` argued and is accepted for the
  same reason.
- **A filter row of type chips**, multi-select, showing only the types this trip actually has, with a
  count on each. It persists for the session only, in `sessionStorage`, because a filter is a lens for
  the next ten minutes and not a setting. On a phone the row scrolls horizontally through the shared
  `FilterRow`, which exists for exactly that; the reference hides its filter on a small screen, and we
  do not — a phone is where a person is most likely to be looking for one booking in a hurry.
- **The import marker**, an amber `Badge` reading "Unchecked import", on any booking whose
  `imported_at` is set. Opening and saving the booking clears it, which is the whole interaction: the
  marker means "a machine wrote this and no person has looked at it yet".
- **The masked confirmation code.** When the preference is on, the code renders as a fixed-width
  masked run of the same character count, revealed on hover, on focus and on tap, and never copied
  into the DOM as plain text before the reveal. It stays copyable through the existing `CopyValue`
  control, which writes from the value the component was handed rather than from the selection,
  because masking is about a shoulder and not about the reader's own clipboard.

  **What it is not is selectable, and an earlier draft claimed both.** A value that is not in the DOM
  cannot be selected out of it; dragging across a masked code selects the mask. That is the cost of
  replacing the characters rather than blurring them, and it is the right cost: the reference blurs,
  which is CSS over text that is still in the document, so the code is still in devtools, still in the
  accessibility tree and still in a screenshot. Replacement means a reader who wants the code presses
  the copy control or reveals it, and a reader who is standing behind them gets neither.

  The same rule applies to a transport's booking code on the transports tab, and the flag gets
  there the same way it gets to the desk: `transports-timeline.tsx` takes `maskCodes` as a required prop —
  a `components/modules` component never fetches and never imports from `server/` — and
  `transports.tsx` supplies it from `loadDisplayPreferences`, called in the same `Promise.all` as the
  transport desk loader so the tab still settles in one round trip. That is why both files, and the
  route, are owned here.

- **What a transport booking says about itself.** A booking of type `transport` carries a
  `transport_id`, and behind it sit the legs `03-S2` writes — each with its own service number,
  platform, seat and times. The desk shows none of that today, so a flight booking on our desk says
  less than the reference's does while the record underneath it says more: the reference models four
  transport reservation types with a fixed field set each, and we model one type pointing at a record
  with twelve modes and a chain. This stage renders the difference. A card whose booking resolves to a
  transport shows, from the **first** leg and the **last**, the service number, the platform and the
  seat where each exists, and nothing where they do not — an empty platform renders as absent, never
  as a label with a dash after it. A chain of more than one leg shows the count and the two outer
  stations rather than every stop; the whole chain is one click away on the transports tab, and the
  desk is a list rather than a second timeline.
- **The source file, where an import left one.** `03-S7` links the confirmation it read to the
  booking it created, on `trip_files.reservation_id` — a column that already exists — and this card is
  where that link becomes visible: a single quiet row naming the file, opening it through the download
  path `06-S6` (`06-documents-and-media.md`, wave 4) owns. Wave 4 closes before `03-S7` runs in wave
  5, so the mechanism is there before anything writes to it; a booking with no linked file shows no
  row at all rather than an empty one. The card renders what the link resolves to and never lists
  files by trip, which is `DOC-04`'s surface and not this one.
- **The switch that turns it on**, on the appearance screen, as a `SettingsRow` whose control is a
  `Switch` labelled "Hide confirmation codes until I ask", with a one-line hint that says what it
  protects and what it does not — codes yes, prices no. It carries
  `data-part="mask-confirmation-codes"` so the capture can reach the preference the way a reader
  would, and it saves in the idiom the reduce-motion row already uses
  (`src/routes/_app/settings/appearance.tsx:178-194`): local state moves first, `saveAppearance`
  follows, and a failure leaves the switch where the reader put it with an inline retry rather than
  snapping back. It joins whichever section `09-S8` leaves behind when it rebuilds that screen one
  wave earlier — today the row would sit in `Motion and maps`, which is a section name this stage
  does not assume will survive.

**States.**

- _Empty._ Three distinct empties, each designed on `--color-surface-2`: no bookings at all (the
  existing `EmptyState`, re-pointed at the new action); a group with nothing in it (a single quiet
  line inside the collapsed header rather than an empty panel); and a filter that matches nothing
  ("No **flights** on this trip yet", with a one-click "Clear filter"). The third is the one products
  usually forget and the one a critic will look for.
- _Skeleton._ The route's `pendingComponent` gains a `RowsSkeleton` beneath its header and stat tiles,
  shaped like the grouped list rather than like a generic table, so the settle does not reflow.
- _Error._ The route's `ErrorPanel` is unchanged. A failed status change rolls the optimistic pill
  back and says why, which `useOptimistic` already contracts. A failed preference save leaves the
  switch where the reader put it and shows an inline retry — never a silent revert.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on every chip, every
  disclosure, the switch and the reveal affordance. The reveal is reachable by keyboard: the code is a
  `button` with an accessible name that says what it does, not a `div` with a mouse handler.

**Motion, and the property it deliberately does not touch.** A collapsing group is the second place
in this plan where the reflex implementation is a height transition, and `DESIGN.md` — "Transform
and opacity only. Never animate layout-affecting properties." — forbids it. The group body is mounted
and unmounted rather than transitioned open: on expand the rows enter from `opacity: 0` /
`translateY(-4px)` to their rest values over `--duration` on `--ease-out-quint`, staggered 24ms and
capped at eight rows so a forty-booking group does not take a second to finish; on collapse they leave
at `--duration-fast` on opacity alone and the body unmounts on the last transition end. The panel's
height changes in the frame the body mounts or unmounts and is never interpolated. The chevron rotates
90° on `transform`. The reveal of a masked confirmation code cross-fades at `--duration-fast` between
two absolutely positioned spans of the same measured width, so revealing a code does not move the row
it sits in. The filter chips do not animate their layout at all, because a row that reflows while it
is being read is worse than one that snaps. Under `prefers-reduced-motion: reduce` the stagger, the
translate and the rotation are all dropped and only opacity remains.

**Tokens.** None missing. The marker is `--color-warning-soft` with `--color-warning` text, the mask
is `--color-ink-4` on `--color-surface-inset`, the group counts are `--color-ink-3` with
`tabular-nums`. Every pair is checked at AA in both themes, and the dark values are the ones already
declared for dark rather than the light ones reused.

### Quota

**No countable row.** This stage creates no row in any table: it reads, groups, filters and masks, and
it writes one boolean into a `user_settings` row that already exists for every member. Nothing is
added to `resolveLimits()` or `PLAN_QUOTAS`, and `src/server/billing/__tests__/limits.test.ts` gains
no case and is not an owned path.

### Tenant isolation test

Appended as one `describe` block, covering the one repository function this stage changes:
`updateUserSettings`.

**The case, respecified against what the repository actually does.** `updateUserSettings`
(`src/server/repos/settings.ts:228-239`) takes no row id from the caller: it resolves its row
through `ensureUserSettings` (`:219-226`), which looks the user id up inside the tenant scope —
`getUserSettings` (`:211-217`) reads through `userSettingsRepository`, so only rows in the caller's
organization are visible — and **inserts a fresh row stamped with the caller's `organization_id`
when none exists**. A user id from B handed to A's write is therefore never rejected; it is ensured
into A's own organization, and B's row is structurally unreachable. The test asserts exactly that,
rather than a `NotFoundError` the function cannot throw:

- B's `user_settings` row is snapshotted whole in `beta.tenant.scope`; then A calls
  `updateUserSettings(alpha.tenant.scope, { maskConfirmationCodes: true }, <B's user id>)`.
- The write lands **only in A's organization**: a `user_settings` row for that user id now exists in
  A's organization and carries the flag.
- B's own row, re-read in `beta.tenant.scope`, is **byte-identical** to the snapshot — a deep
  equality over the whole row, never a single-field check.

The other resolution — a membership guard in which `getMembership`
(`src/server/repos/members.ts:144`) returning `null` maps to a `NotFoundError` before
`ensureUserSettings` runs — was rejected because it would change the ensure-and-insert contract for
every caller while defending a path no production code takes: measured at HEAD, all nine call sites
of `ensureUserSettings` / `updateUserSettings` outside the repo module and its tests
(`src/routes/api/dev/-seed/apply.ts:288-289`, `src/routes/_app/settings/-server/preferences.ts:87`,
`:119`, and `src/routes/_app/-server/settings.ts:122`, `:232`, `:247`, `:279`, `:303`) omit the
optional `userId` and write the session's own row.

`loadBookingDeskFn`'s reservation reads, and
`clearReservationImported` itself, are already covered by the block `03-S4` appends — this stage
calls that function and does not define it — so neither is duplicated here.

**One case in that block is not about isolation, and it belongs there because this is the only test
file this stage owns.** A writes `maskConfirmationCodes: true` through `updateUserSettings`; then
`(await getEffectiveSettings(alpha.tenant.scope)).maskConfirmationCodes` must be `true` and
`(await getEffectiveSettings(beta.tenant.scope)).maskConfirmationCodes` must be `false`, in the
`alpha.tenant.scope` / `beta.tenant.scope` idiom that file's settings block already uses. The assertion is
deliberately made through the **merge** and not through the stored row: a column that reaches
`user_settings` but never reaches the literal at `src/server/repos/settings.ts:285-303` passes a row
assertion and fails this one, which is precisely the defect an earlier revision of this stage was
about to ship. The file already imports `getEffectiveSettings` (`:130`) and already asserts on it for
locale (`:1163`, `:1176-1177`), so the case is one more `expect` in an established idiom rather than
new machinery.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/modules/book/__tests__/grouping.test.ts` — settled and outstanding partition the set
  with no booking in both and none in neither; the date grouping inside each group keeps the
  earliest-first, undated-last contract it already has; a filter matching nothing returns an empty
  group rather than the unfiltered list.
- New cases in the same file for the mask: a code of nine characters masks to nine; an empty code
  masks to nothing rather than to a row of dots that implies a code exists.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the block above, including the
  `getEffectiveSettings` case, which is the one test that would have caught the dead field.

**Browser evidence.** Route `/trips/demo-trip-01-tokyo-and-kyoto/book`, six frames at 360, 1280 and
2560 in both themes, plus **three declared states**, because three of this stage's four behaviours are
invisible at rest:

- `--state groups-collapsed`, reached with `--click '[data-part="group-toggle-settled"]'`;
- `--state filtered`, reached with `--click '[data-part="type-chip-accommodation"]'`;
- `--state code-revealed`, reached with `--hover '[data-part="confirmation-code"]'`, captured with the
  preference on.

Every selector is an attribute this stage adds and every one is proven to resolve by a `count()`
assertion in the spec before a frame is filed. The resting set is still owed: a collapsed group is
judged against the expanded one it came from. `PT_SERVER_TODAY=2026-08-20`, invocation as `03-S1`
quotes it.

**And two frames of the second obeying surface**, route
`/trips/demo-trip-01-tokyo-and-kyoto/transports` at 1280 in both themes with the preference on, as
`--state code-masked`. A frame of the desk says nothing about whether the leg card obeys the switch,
and a preference that half the product ignores is the defect a critic files first. The preference is
set for the seeded reader before the frame is taken, through the appearance screen's own switch
(`--click '[data-part="mask-confirmation-codes"]'` on `/settings/appearance`) rather than by writing
the row from the spec, so the frame is evidence about the whole chain — switch, writer, merge, reader
— and not only about the renderer.

**Console** silent, `fatal` empty, no addition to `TOLERATED_CONSOLE_WARNINGS`. **Layout shift** after
the settle mark asserted `0` on Chromium — the disclosure and the reveal are both `hadRecentInput` and
therefore excluded, and the assertion is about the resting screen — and reported as a skip on WebKit.

### Definition of done

The six items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

Per surface:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One inherited defect, repaired here for this file's own half.** `12-verification-protocol.md` §7.2
lists `src/components/modules/book/bookings-timeline.tsx:89` among the seven call sites that ask the
platform for an abbreviated month, which workerd and WebKit answer differently. This stage owns that
file and replaces its two local formatters with `formatWeekday` and `formatDate` from
`src/lib/format.ts` (`:328`, `:302`), which answer from a CLDR table for exactly this reason.
`src/lib/format.ts` itself is not edited and is not an owned path. Disposition: **substitute**.

**One dependency on another plan, satisfied by the wave order.** `ACC-04` is closed by `09-S8`
(`09-account-and-settings.md`, wave 3), which builds the appearance screen this stage adds a row to;
this stage is wave 4, so it lands on the rebuilt screen. If `09-S8` has **not** landed, this stage
still ships the row on `appearance.tsx` as it stands: the row is additive, the reduce-motion row two
lines above it proves the idiom, and `09-S8` carries it across when it rebuilds. Holding the switch
and shipping the masking would be the same defect this stage was rejected for once already, in
mirror image — a reader that no writer can reach. Disposition: **substitute**, never defer.

No package outside the pinned set, no binding absent from `wrangler.jsonc`, no third-party service.

---

## Stage 03-S7 — The confirmation file that fills the desk in

### Stage id

`03-S7` · Wave 5 · effort **L**. One wave later than the row's floor, for the reason the Area brief
gives: `BKG-01` and this row both land in wave 4 and both need the desk route, and two exclusive
claims on one file in one wave is a clobber rather than a plan. It is the only wave-5 stage in this
file.

### Reference rows

- `BKG-03` partial → **done**. A producer, an entry point, a review step and a bulk confirm, over
  every format a person actually has.
- `BKG-04` absent → **done**, in the hosted shape ADR 0012 defines. The Area brief's exclusion section
  explains why a row `11-S1` refused comes back here rather than in a stage of its own.

**Two deferrals this stage used to carry are closed, and neither closed by being reconsidered.**
Entries 8 and 9 of `11-S2` — mail-message parsing and document text extraction — parked the formats a
traveller actually holds, because reading a PDF or an email meant either a package the dependency
freeze forbids or a service nobody had chosen. ADR 0012 binds Workers AI, and `env.AI.toMarkdown()`
turns a PDF, an HTML page, an image or an Office document into text on the platform we already run
on: no package, no third-party account, no per-tenant credential. The one format it does not know is
the mail message, and that one is answered below without a MIME parser.

Sourced from `wiki: AI-Booking-Import` and `wiki: Reservations-and-Bookings` for the behaviours: a
traveller hands the product a confirmation file rather than retyping it; what was read is shown back
as a list they can prune before anything is written; and what is written is marked until a person has
checked it.

**This stage starts from two absences, not from a blank page.** The engine is finished and this stage
must not build a second one:

- **The missing producer.** `grep -rn "booking-import" src/` returns
  `src/server/queue/types.ts:16` (the kind), `:156` (the payload map), `:181` (the envelope arm),
  `src/server/queue/consumer.ts:37`, `:81` and `:103-104` (the import, the registry and the switch),
  and `src/server/queue/handlers/booking-import.ts` (the handler). **Nothing calls `enqueueTask` with
  that kind, anywhere.** The handler has never run in this product. What is absent is the _call_, and
  only the call: the producer helpers it needs are both already written and already used together.
  `enqueueTask(queue, input)` (`src/server/queue/jobs.ts:66`) builds the envelope, validates it
  through `taskEnvelopeSchema` and sends it; `taskQueue()` (`src/server/auth/env.ts:87`) returns the
  `TASKS` binding. `grep -rn "taskQueue" src/` returns exactly three lines and no more — that
  declaration, its import at `src/server/auth/email.ts:2`, and the repo's one live producer,
  `await enqueueTask(taskQueue(), { kind: 'email', … })` at `src/server/auth/email.ts:289`. **This
  stage therefore adds no queue accessor of its own**, and the earlier draft of it that did was
  wrong: a second accessor beside an exported one that already compiles against `enqueueTask` is a
  duplicate, not a convenience.
- **The missing UI entry point.** No route, dialog, button or drop target in `src/routes` or
  `src/components` mentions an import. There is nothing a reader could click.

**What is reused, and the one part of it that this stage does extend.**
`handleBookingImport` (`src/server/queue/handlers/booking-import.ts:157`) — the R2 read, the 5 MiB
refusal, the calendar parse through `src/server/queue/ics.ts`, the JSON parse, the classification, the
reference extraction, the 500-row cap, the KV staging under `stagedImportKey(jobId)` for
`STAGED_IMPORT_TTL_SECONDS`, and the room notification — is the whole of the engine, and **every one
of those parts is reused rather than rewritten**. `StagedImport`, `StagedReservation` and
`stagedImportKey` are imported from the handler module rather than re-declared, so the staged shape
has exactly one definition.

What this stage adds to the handler is **one branch in front of the parse**, and nothing else: when
the format is not `ics` or `json`, the bytes become text first and the extractor reads the text. The
staged output is the same `StagedImport` either way, so the review list, the confirm, the cap and the
TTL are untouched and untested-again. `bookingImportPayloadSchema`
(`src/server/queue/types.ts:77-85`) widens its `format` union to carry the new formats, which is why
`src/server/queue/types.ts` is an owned path here — claimed in waves 0, 1, 3, 4 and 6 by four sibling
plans, and free in wave 5, which is this stage's.

**The producer half is reused too, and this is the second thing the stage must not reimplement.** The
enqueue is written as `enqueueTask(taskQueue(), …)`, importing `enqueueTask` from
`#/server/queue/jobs` and `taskQueue` from `#/server/auth/env` — the same two symbols, in the same
combination, that `src/server/auth/email.ts:289` already ships. Neither module is an owned path and
neither is edited. That `taskQueue()`'s declared return type (`Queue<unknown>`) satisfies
`enqueueTask`'s `TaskQueue` port is not an assumption: `email.ts:289` makes exactly that call and the
repository typechecks clean, so the compatibility is measured rather than hoped for. Nothing in this
stage reads `env.TASKS` directly, and nothing in it imports `cloudflare:workers`.

Rows unblocked: none. No row lists `BKG-03` in its `dependsOn`.

### Owned paths

- `src/server/fns/booking-import.ts` — new. The producer, the staged read and the confirm. A module of
  its own rather than an edit to `src/server/fns/reservations.ts`, which `03-S6` and `03-S4` hold in
  other waves and which has nothing to do with a queue.
- `src/components/modules/book/import-dialog.tsx` — new. The entry point, the review list and the
  confirm.
- `src/components/modules/book/import-drafts.ts` — new. The pure mapping from a staged row to a review
  draft, and the selection reducer — separate from the component that renders it, because that is the
  part worth testing and it should not need a Worker runtime to do so.
- `src/components/modules/book/__tests__/import-drafts.test.ts` — new.
- `src/server/queue/handlers/booking-import.ts` — edit. The one branch in front of the parse: bytes to
  text, then extraction. Claimed by **no other stage in any plan**, so this is its only claim.
- `src/server/queue/types.ts` — edit. The `format` union widens. Four sibling plans hold this file in
  waves 0, 1, 3, 4 and 6; wave 5 is free.
- `src/server/extract/document.ts` — new. Bytes to text: `env.AI.toMarkdown()` for the formats it
  knows, a direct UTF-8 read for plain text, and the mail-message case below. It returns text and
  never a reservation, so the thing that reads a file and the thing that understands a booking are two
  modules and can be tested apart.
- `src/server/extract/booking.ts` — new. Text to a `StagedReservation[]` through `env.AI.run()`, with
  the field rules under **Server** — including the one about money, which is the rule this module
  exists to enforce rather than to apply loosely.
- `src/server/extract/__tests__/` — new. Fixtures for each accepted format and, most of all, for the
  refusals: an unparseable amount, a date the model invented, a file that yielded no text at all.
- `src/server/fns/file-policy.ts` — edit. The accepted-format table gains the import formats. `06-S1`
  (`06-documents-and-media.md`) holds this file in wave 1 and reshapes that table there; this stage
  extends the shape `06-S1` leaves behind rather than the one at HEAD, which is the ordering wave 5
  guarantees.
- `src/components/layout/app-frame.tsx` — edit. Mounts the import widget, which outlives the dialog
  that started the job. Claimed by **no other stage in any plan** — measured across
  `docs/plans/*.md`, where every other file in `src/components/layout/` is claimed and this one is
  not. `impersonation-bar.tsx` is the precedent for a persistent element mounted there.
- `src/components/modules/book/import-widget.tsx` — new. The widget itself.
- `src/components/modules/book/index.ts` — edit. The new exports. `03-S4` holds this file in wave 3
  and `03-S6` needs no change to it; wave 5 is this plan's third and last claim.
- `src/routes/_app/trips/$tripId/book.tsx` — edit. Mounts the action beside the existing
  `NewBookingAction` in the header the route already renders, and the dialog beside it. `03-S6` holds
  this file in wave 4.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/reservations-and-transport.visual.spec.ts` — append.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — append.

`src/server/queue/consumer.ts`, `src/server/queue/jobs.ts`, `src/server/auth/env.ts` and
`src/server/fns/context.ts` are **not** owned paths and are not edited. The engine is complete and so
is the producer helper; this stage attaches to both. In particular `src/server/fns/context.ts` gains
nothing: `appScope()` is imported from it exactly as every other module in `src/server/fns` imports
it, and the queue binding arrives through `taskQueue()` rather than through a new sibling of
`filesBucket()`.

### Data and migration

**No schema change, and nothing filed onto any schema stage.** The one column this stage's behaviour
turns on is already on disk when it opens.

- `reservations.imported_at` — declared by **`03-S4`** in wave 3 and supplied by the **wave-2** schema
  stage of `00-foundations.md`, two waves before this stage runs. A nullable `timestamp_ms` integer,
  indexed as `reservations_org_imported_at_idx (organization_id, imported_at)`. This stage sets it,
  through the function named below, and never declares it.
- **Why it is asked for there and not here, even though this is the stage that first writes it.**
  This stage owns no repository file, so it can neither widen a validator nor add a writer; `03-S4`
  (wave 3) is the plan's only claimant of `src/server/repos/reservations.ts` in any wave, and a
  repository function cannot be written against a column that has not been migrated yet. Column and
  writer therefore travel together in wave 3, and this stage — three `##` blocks and two waves later —
  finds both waiting for it. `03-S4`'s **Data and migration** section carries the column's full
  specification, its index and the argument for an instant rather than a boolean.

**Money on an imported row.** A staged row carries no amount today — the calendar and JSON shapes the
engine reads do not reliably contain one — so a confirmed import writes `price_minor` null rather than
zero, because "not known" and "free" are different facts. When a source does carry a price it is
written as an **integer count of minor units** beside a `text(3)` ISO-4217 code, parsed at the
boundary by `parseMoneyToMinor` (`src/components/modules/book/booking-form.ts`) and never held as a
float; a source amount that cannot be parsed into minor units is dropped and the row is marked for
review rather than guessed at.

**Nothing else, and in particular no table for the staged import.** The staging is KV with a
24-hour TTL, which the handler already implements and which is the right store: an unreviewed import
is not durable state, and giving it a table would make it something a tenant has to clean up.

### Server (repo, server function, Zod)

**No repository module is added, and no repository file is claimed.** The confirm writes through
`createReservation` (`src/server/repos/reservations.ts:226`), which is where the tenant scope, the
reference guards and the `organization_id` stamp already live, and it stamps the marker through
**`markReservationsImported(scope, ids)`** — an exported function of that same module, minted by
`03-S4` in wave 3 for exactly this call. No SQL is written outside `src/server/repos/**`, and this
stage stays off `03-S4`'s and `03-S6`'s paths entirely.

**Why the marker is a function call and not a field on the insert.** `createReservationInput` is a
`z.object`, so an `importedAt` passed to `createReservation` is not rejected — it is **stripped**, and
every imported row would land with a null marker while this stage's tests, which assert on the
returned rows, went on passing. The column would exist, the badge would never appear, and nothing
would say why. `03-S4`'s **Server** section states the same argument from the owning side and adds the
second half of it: a client that could set the marker could also clear it, so the marker is written by
the server about its own writes and by nothing else.

**Server functions — `src/server/fns/booking-import.ts`.**

- `startBookingImportFn` — `createServerFn({ method: 'POST' })`. Validator:
  `z.object({ tripId: z.string().trim().min(1).max(64), fileId: z.string().trim().min(1).max(64),
format: z.enum(['ics', 'json']) })`.

  **The enqueue site is this handler, and it is the only one.** In order: `appScope()`;
  `requireTrip(scope, data.tripId)`; `getFile(scope, data.fileId)` through the files repository, whose
  row carries the R2 `storage_key` and whose `trip_id` is compared with the trip — this is why the
  client sends a **file id and never a storage key**: a storage key from a client is a path into a
  shared bucket, and the one thing a producer must never do is take one. Then:

  ```ts
  await enqueueTask(taskQueue(), {
    kind: 'booking-import',
    orgId: scope.ctx.organizationId,
    id: `booking-import:${file.id}`,
    payload: {
      tripId: trip.id,
      requestedBy: scope.ctx.userId,
      sourceKey: file.storageKey,
      format: data.format,
    },
  })
  ```

  **The idempotency key is `booking-import:<tripId>:<fileId>`**, and it is deterministic on purpose.
  Three properties follow from that one choice: a double-submit — two clicks, a retried fetch, a flaky
  connection — is one job, because the envelope id is the idempotency key and a completed job's marker
  lives in KV under `task:done:<id>` for 24 hours; a re-import of a **corrected** file is a different
  job, because a corrected file is a new upload with a new id; and the staged result is findable
  without a second identifier, because the handler stages under `stagedImportKey(context.taskId)` and
  `context.taskId` is that same envelope id.

  **The trip id is in the key, and an earlier draft left it out.** Keyed on the file alone, one
  uploaded confirmation could be imported into exactly one trip ever: a traveller who uploads the same
  hotel booking to their own trip and then to the trip they are planning with friends would hit a
  completed job's marker on the second attempt and be told, with no explanation available anywhere in
  the product, that nothing happened. A file belongs to a trip, so the job that reads it is identified
  by both. The key stays inside the envelope's 64-character bound: `booking-import:` is 15, two
  `newId()`s are 50, and the separator is one.

  Returns `{ jobId }` so the client knows what to ask about.

- `getBookingImportFn` — `createServerFn({ method: 'GET' })`. Validator
  `z.object({ tripId, jobId })`. Reads `KV` under `stagedImportKey(jobId)`, parses it with a Zod
  schema built from the handler's exported `StagedImport` shape, and — the check that matters —
  **refuses any staged import whose `orgId` is not the caller's and whose `tripId` is not the trip the
  caller just proved they can reach**. A KV key is a guessable string; the value is the record, and it
  is checked against the scope rather than trusted because it was found.
- `confirmBookingImportFn` — `createServerFn({ method: 'POST' })`. Validator
  `z.object({ tripId, jobId, accept: z.array(z.string().min(1).max(128)).max(500) })`, where each
  entry identifies a staged row by its index-and-external-id pair. It re-reads the staged import,
  re-checks the scope, maps each accepted row into the shape `createReservation` takes, writes them,
  and then marks the whole batch with **one** `markReservationsImported(scope, writtenIds)` call —
  one statement for up to 500 rows rather than one per row, which is also why that function takes a
  list. It asserts the returned count equals the number of rows it wrote; a shortfall means an id it
  had just created did not resolve inside its own scope, which is a bug rather than a user error and
  is logged as one. It then mirrors one `trip` patch into the room so other tabs refresh once rather
  than five hundred times. Rows the reader deselected are simply never written.

  **The KV entry is deleted only when every accepted row was written**, and an earlier draft deleted
  it unconditionally. That draft also promised the reader a partial retry in its Error state, and the
  two cannot both be true: once the staged record is gone there is nothing left to retry from, so the
  reader is offered a button that can only fail. On a partial failure the staged entry **survives**,
  with the ids it did write recorded on it, and a retry writes only the rest. The entry's own TTL
  still expires it, so nothing is kept forever; what changes is that it is not thrown away at the
  exact moment it becomes useful.

  **What the confirm wires up beyond the reservation row**, each through machinery that already
  exists rather than through anything this stage invents:

  - **The ledger line**, through `syncReservationExpense(scope, reservation)` — the helper `03-S4`
    mints in wave 3 for exactly this. Without it a booking imported with a price would sit on the desk
    costing money that never reached the trip's costs, which is what an earlier draft of this stage
    did by calling `createReservation` directly.
  - **The source file**, through `updateFile(scope, fileId, { reservationId })`. The column
    `trip_files.reservation_id` and the `reservationId` field on `updateFileInput` both exist at HEAD,
    so this is one call to an exported function and no schema change at all. `03-S6` renders the
    resulting link on the card; `06-S6` (`06-documents-and-media.md`, wave 4) owns the download path
    it opens, and closes one wave before this stage runs.
  - **The place**, when the extraction produced a name and an address — a hotel, a restaurant, a
    venue. `createPlace` with the name, the address and the trip, and the reservation's `place_id`
    pointing at it. A place is created only when there is no existing place on the trip with that
    name, so importing three nights at one hotel does not produce three pins.
  - **The pin on that place**, through the geocoding proxy `02-places-and-maps.md` mints in `02-S4`,
    its **wave 3**, for `MAP-01` — `src/server/geo/geocode.ts` behind
    `src/routes/_app/trips/$tripId/-server/geocode.ts`. ADR 0013 records the provider and, more to the point here, records the property that
    lets us keep the answer: the data is open, so a coordinate may be stored permanently and a
    resolved address never has to be bought twice. This stage calls that proxy and does not mint one.
    **A failed lookup is not a failed import**: the place is written without coordinates, which the
    schema allows and the map already tolerates by filtering those rows, and the reader can place the
    pin by hand later.

  **A money field is never guessed**, which is ADR 0012's third constraint and the one this stage is
  most likely to be tempted out of. An amount the extractor cannot parse with confidence is **dropped**
  and the row is marked for review — never rounded, never inferred from a currency symbol it half
  recognised, never carried across from another line on the page. A wrong number in a shared trip's
  costs is settled between real people with real money, and a blank the reader fills in is strictly
  better than a plausible number they never checked.

**The mapping, which is where an import becomes our data.** A staged row carries a title, a kind, a
start, an end, an all-day flag, a floating flag, a location, notes and a reference. Our
`RESERVATION_TYPES` are not the handler's `RESERVATION_KINDS`, and the mapping between them is total
and explicit in `import-drafts.ts` — `lodging → accommodation`, `flight`/`transport` → `transport`,
`activity` → `activity`, everything else → `other`. A **floating** time is resolved against the trip's
own timezone, not the reader's browser, because a shared itinerary is discussed in the destination's
wall clock; `src/lib/time.ts` already owns that rule and this stage calls it.

**Authorisation, stated once for all three functions.** `appScope()`, then `requireTrip`, then the
staged record's own `orgId`/`tripId` compared against the scope. A job id from the client is not an
authorised job id, and neither is a file id.

**Nothing slow runs inline.** The producer writes nothing and returns as soon as the message is
accepted; the parse happens on the queue, which is the whole reason the engine exists.

### UI (route, components)

**Route.** `src/routes/_app/trips/$tripId/book.tsx`, edited in place. **No route file is added or
moved, so `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an owned path.**

**Components.** `Dialog`, `Button`, `Alert`, `Badge`, `Checkbox`, `Progress`, `Spinner`,
`EmptyState` and `toast` from `src/components/ui`; `useAction` from `src/components/modules/shared`;
and — the reuse that matters — `uploadFile` from `src/components/modules/files/upload.ts`, which posts
to `uploadTripFileFn` over `XMLHttpRequest` and therefore reports **real** bytes leaving the machine
rather than animating a promise. This stage writes no second uploader.

**The formats it accepts, measured rather than assumed.** `src/server/fns/file-policy.ts` already
accepts `.ics` as `text/calendar` (`:80`, `:104`) and `.json` as `application/json` (`:86`, `:108`).
Those are the two the deterministic engine reads, and they are the two a **machine** exports. The
formats a **person** has are a PDF they saved and an email they were sent, and this stage adds them,
each with the reason it is cheap:

| Format                                         | How the bytes become text                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `.pdf`                                         | `env.AI.toMarkdown()`, which lists `application/pdf`.                                             |
| `.html`, `.htm`                                | `env.AI.toMarkdown()`, which lists `text/html`.                                                   |
| `.jpeg`, `.png`, `.webp`, `.heic` → re-encoded | `env.AI.toMarkdown()`, which lists the raster image types.                                        |
| `.txt`                                         | Read as UTF-8. It is already text and needs no conversion.                                        |
| `.eml`                                         | The mail case below.                                                                              |
| `.ics`, `.json`                                | Unchanged: the deterministic engine, which is better than a model at a format that has a grammar. |

**Images are a capability the reference does not have**, and they are the case worth having: a
photograph of a printed confirmation is what a traveller in a hotel lobby actually holds. It costs
nothing extra, because it is one more row in a table `toMarkdown` already serves.

**The mail message is the one that needed a decision, and it is answered without a MIME parser.** An
`.eml` is a MIME envelope; `toMarkdown` does not list `message/rfc822`, and a parser for it is a
package `docs/SPEC.md` §3 forbids us to add — the freeze says a needed package is a finding to report
and never a `pnpm add`. Writing one by hand is a real cost and a classic source of bugs: quoted
printable, nested multipart, boundary handling. So the stage does none of that. An `.eml` is **mostly
readable text already** — headers and body — and the extractor is not looking for a correct structural
parse, it is looking for a confirmation number, two dates and a place. `document.ts` strips the long
base64 runs with a bounded regex, caps what is left, and hands the remainder to the extractor as text.
What that gives up is an attachment inside the mail, which is stated rather than hidden: a
confirmation that lives only in an attached PDF is imported by uploading that PDF, which is a format
this stage now accepts anyway.

**`.pkpass` is deliberately not accepted.** It is a zip, so it needs central-directory reading and an
inflate before there is anything to look at — our own code, for a format rarer than either the PDF or
the mail this stage does add. It is named here so its absence is a decision rather than a gap.

**The upload policy is edited, and by this stage.** The list above is longer than the two formats
`file-policy.ts` accepts today, so the claim on that file is real. The per-object ceiling is not
raised: 5 MiB is the engine's existing refusal and it stays, because a confirmation that does not fit
in 5 MiB is a scan at a resolution nobody needs. Each file lands in `FILES` with a row in `trip_files`
that `recordFile` has already counted against the plan's `files` and `storage_bytes` ceilings.

**The flow, as behaviour.**

1. **Import** beside **New booking** in the desk header. It is always visible: an entry point that
   appears and disappears based on a server capability is a single-tenant idea, and here the engine is
   always present.
2. A drop target with a click-to-browse fallback, stating the formats it reads and the one it does
   not: a `.pkpass` is refused by name rather than by silence, because a refusal a reader understands
   beats a rejection they have to guess at.
3. **Up to five files at once**, each up to the 5 MiB ceiling, uploaded with a real progress bar and
   then parsed **one at a time** rather than in parallel. Five concurrent model calls from one reader
   is five times the meter for no gain in wall-clock they would notice; a queue of five is one job
   after another and a count that goes down.
4. **The dialog can be closed at this point and the work continues**, which is the reason
   `app-frame.tsx` is an owned path. Progress moves to a widget in the corner of the application
   frame, showing how many files are left. It survives closing the dialog, navigating to another trip
   and reloading the page — the job ids live in `localStorage` under `planned.book-imports`, and the
   widget re-subscribes on mount. A reader who uploads four confirmations should not have to sit and
   watch them, and a modal that must stay open is a modal that will be closed by accident.
5. **The review list**, reached from the widget or from the dialog if it was never closed. One row
   per detected booking, grouped by the file it came from when there is more than one: type, title,
   dates, location, reference — each
   deselectable with a checkbox, with select-all and select-none, and a live count in the confirm
   button ("Add 7 bookings"). A row the parser filled only partially is marked in the list before it
   is written, not after.
6. **Confirm** writes the selected rows, closes the dialog, and lands the reader back on the desk with
   the new rows carrying `03-S6`'s "Unchecked import" marker.

**How the client learns the parse is done, without polling forever.** The handler already pokes the
trip's Durable Object with an `importJobId` on the trip entity; the **widget** subscribes through the
trip-room subscription `07-S1` (`07-collaboration-and-sharing.md`, wave 1) generalises, and calls
`getBookingImportFn` when it hears one of its own job ids. The subscription lives on the widget rather
than on the dialog precisely because the dialog is allowed to close. If nothing arrives within 20
seconds per file it stops waiting and offers an explicit "Check again" — a bounded wait with a manual
escape, never an unbounded poll against a queue.

**A model reads more slowly than a calendar parser**, so the 20-second bound is per file and the
widget says which file it is still on. An extraction that exceeds the handler's own timeout fails that
file and no other: one unreadable scan in a batch of five must not cost the reader the other four.

**States.**

- _Empty._ Two: the drop target itself, which is the resting state and carries the illustration, the
  two formats and the size limit on `--color-surface-2`; and a parse that found nothing, which says
  "We could not find a booking in that file" with the file's name and a way to try another. The second
  is a real outcome — the engine raises it as a permanent error — and it is designed rather than
  surfaced as a stack trace.
- _Skeleton._ The review list renders five placeholder rows while the staged result is being fetched,
  shaped like the rows that will replace them.
- _Error._ Three, each distinct and each recoverable: an upload that failed (retry the upload), a
  parse that failed permanently (the message from the handler, and a way to pick another file), and a
  confirm that partially failed (the rows that were written are listed, the rows that were not are
  kept selected, and the retry writes only those — which works because the staged entry is **not**
  deleted on a partial failure, as **Server** states). Nothing is silently dropped.
- _The widget's own states._ Working, with a count; done, which lingers long enough to be clicked and
  then dismisses itself; and failed, which does not dismiss itself at all, because a failure nobody
  saw is a failure that will be reported as data loss.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the drop target, every
  checkbox, select-all, the confirm and the cancel. The confirm is disabled with a reason while
  nothing is selected, and shows its spinner without changing width while it writes.

**Motion.** The review rows enter with the standard 20–30ms stagger capped at eight, `--duration` on
`--ease-out-quint`, transform and opacity only, collapsed under `prefers-reduced-motion: reduce`. The
progress bar is a real measurement and is not animated beyond its own value.

**Tokens.** None missing. The drop target's active border is `--color-brand` on
`--color-brand-subtle`, the partial-parse marker is `--color-warning-soft`, and the counts carry
`tabular-nums`. All checked at AA in both themes.

### Quota

**This stage creates countable rows, and it is the one stage in this plan where that needs an
argument.**

- **The uploaded file** is already counted: `recordFile` (`src/server/repos/files.ts`) is one of the
  eight `assertQuota` call sites and asserts both `files` and `storage_bytes` **before** it writes the
  row, with the R2 object written first and deleted again if the assertion throws. This stage changes
  none of that and adds no second path to the bucket.
- **The reservations a confirm writes** have no metric, for the same reason as every other row in this
  plan: `USAGE_METRICS` has none for a booking, and the sold ceiling that bounds them is `trips`. What
  is different here is the amplification — one click can write up to five hundred rows — so the bound
  is stated where it is enforced rather than assumed: `MAX_IMPORT_RESERVATIONS = 500` in the handler
  (`booking-import.ts:52`) caps what can ever be staged, `MAX_IMPORT_BYTES = 5 * 1024 * 1024` (`:50`)
  caps what can be read, the confirm validator caps the accepted list at 500, and the staged entry
  expires after `STAGED_IMPORT_TTL_SECONDS` whether it is confirmed or not.
- **The extraction calls are metered, and this is the metric this stage does add.** A model call is
  not a row, so it is not an `assertQuota` and not a `PLAN_QUOTAS` entry — the same argument `03-S3`
  makes at length under its own **Quota**, and the same mechanism: `src/server/transit/meter.ts`,
  minted there in wave 3, keeps a per-organization monthly tally in `KV` and refuses at the ceiling.
  This stage passes a different metric name to the same meter and writes no second one. The ceiling
  itself belongs in `resolveLimits()` with every other ceiling, because the published number must be
  the enforced number whether the thing being bounded is a row or a call — and, as with `03-S3`, it
  is **filed** onto the per-wave quota stage of `00-foundations.md` rather than edited in here. This
  stage is wave 5, so the supplier is the **wave-4** instance, which is also where its `AI` binding
  is filed. `src/server/billing/limits.ts` and its test appear in no stage's **Owned paths** in this
  plan.

  ADR 0012's first constraint is what makes this obligatory rather than prudent: the extraction runs on
  **our** Workers AI binding, not on a credential the tenant supplied, so an unmetered import is a
  workspace spending our money in a loop. The refusal is a first-class state in the widget, worded as
  what it is — this workspace has used its imports for the month — and never as a generic failure.

- **No metric is added for the reservations themselves.** Adding one would publish a ceiling the plan
  catalogue does not sell, and the published number is the enforced number.

### Tenant isolation test

Appended as one `describe` block. The repository functions it covers are `createReservation` and
`getFile`; `markReservationsImported` is covered by the block `03-S4` appends, which is where it is
defined, and is not duplicated here. The cases are about the **three ids this stage takes from a
client**, which is where an import can leak:

- A calling `startBookingImportFn` with a `fileId` belonging to B is a `NotFoundError`, and **no
  message is enqueued** — asserted against a queue double that records sends, because "did not write"
  is not the same as "did not enqueue".
- A calling `startBookingImportFn` with its own file id but B's trip id is a `NotFoundError`.
- A calling `getBookingImportFn` or `confirmBookingImportFn` with a job id whose staged record carries
  B's `orgId` is refused, even though the KV key resolves — this is the case that exists because KV is
  not tenant-scoped by construction the way a repository is.
- A confirm can never write a reservation into B's organization: B's reservation rows are counted
  before and after every attempt and must be identical, and B's `imported_at` values are re-read and
  unchanged — a refused confirm must not leave a marker behind on a row it was not allowed to touch.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/modules/book/__tests__/import-drafts.test.ts` — the kind mapping is total over the
  handler's `RESERVATION_KINDS` and lands only in `RESERVATION_TYPES`; a floating time resolves
  against the trip's zone and not the runtime's; deselecting a row removes it from the accepted set and
  from the count and from nothing else; a staged row with no title falls back without throwing.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the block above, including the
  enqueue-was-not-called assertion.

**Browser evidence.** Route `/trips/demo-trip-01-tokyo-and-kyoto/book`, six frames at 360, 1280 and
2560 in both themes, plus **two declared states**, both of which are the point of the stage:

- `--state import-drop`, the dialog at rest on its drop target, reached with
  `--click '[data-part="import-bookings"]'`;
- `--state import-review`, the review list populated, reached by the spec itself: it uploads a small
  fixture calendar through the real upload path, waits for the staged result, and then takes the
  frame. A review list cannot be reached by hovering anything, so it is reached the way the product
  reaches it.

Both selectors are attributes this stage adds and both are proven to resolve by a `count()` assertion
before a frame is filed. The **error state** is reached with `page.route()` returning a failure for
the staged read, per `12-verification-protocol.md` §3, rather than being skipped as unreachable.
`PT_SERVER_TODAY=2026-08-20`, invocation as `03-S1` quotes it.

**Console** silent, `fatal` empty, no addition to `TOLERATED_CONSOLE_WARNINGS`. **Layout shift** after
the settle mark asserted `0` on Chromium and reported as a skip on WebKit.

### Definition of done

The six items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

Per surface:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**No blocker, and one requirement filed on another plan.**

The two deferrals this stage used to carry — entries 8 and 9 of `11-S2`, mail-message parsing and
document text extraction — are closed by ADR 0012 and by the mail decision under **Data and
migration**. Neither is planned around and neither is hand-rolled beyond the base64 strip, which is a
regex rather than a parser.

**The `AI` binding is required and is not this stage's to add.** `wrangler.jsonc` is on
`README.md`'s list of shared paths no feature stage may claim, and `00-foundations.md` gives it to
"one bindings stage per wave". This stage is wave 5, so its supplier is the **wave-4** bindings stage
of that register, and the requirement is filed there in the same ritual the schema requirements use:
the `AI` binding, in production and in staging.

Two things about that filing are worth stating rather than leaving to be rediscovered. First,
`00-foundations.md` currently carries an `AI` row in its bindings table with a disposition of **report
only**, justified by `BKG-04` being out of scope — **that justification is superseded by ADR 0012**
and the row needs updating by whoever owns that file; this plan does not edit it. Second, the cost
model genuinely changes shape rather than size: `ARCHITECTURE.md` §8 has no line for per-inference
pricing, which is exactly why the meter under **Quota** is part of this stage rather than a follow-up.

**One dependency on another plan, satisfied by the wave order.** `DOC-01` (`06-documents-and-media.md`,
wave 1) owns the file library. This stage depends only on behaviour already on disk — `uploadTripFileFn`,
`recordFile`, `updateFile`, the storage key — so it is not blocked on that plan being written; the row
edge is recorded, and the entry point uses the upload path that exists today.

**One dependency on a plan that must land first, and it is real rather than nominal.** The geocoding
proxy this stage calls when it creates a place is minted by `02-places-and-maps.md`'s `02-S4` in its
**wave 3**, two waves before this stage runs. If that plan ships without it, this stage still ships: a place with
no coordinates is legal and is the stated fallback, so the dependency degrades rather than blocks.

No package outside the pinned set is required for anything this stage ships. `TASKS`, `FILES`, `KV`
and `TRIP_ROOM` are all declared and all already read by non-test code; `AI` is the one addition and
it is filed above.

---

## Stage 03-S8 — A stay that covers the nights it actually covers

### Stage id

`03-S8` · Wave 6 · effort **L**. The last stage in this plan.

### Reference rows

- `BKG-05` partial → **done**.

Sourced from `wiki: Accommodations` for the behaviours: a stay is its own record covering a run of
nights rather than a point in time; it is created together with the booking that pays for it; each day
it covers says what that day is — arriving, staying, leaving; and it is shown on the day's header
rather than as a row inside the day's sequence, because a stay is not something that happens between
two places.

**Agreement with the row.** It is right that `day_accommodations` is complete —
`start_day_id`, `end_day_id`, `check_in_time`, `check_in_end_time`, `check_out_time`,
`confirmation_number`, `price_minor` and `currency` on `day_accommodations` in `src/server/db/schema.ts` — that
`src/server/repos/itinerary.ts` has a full repository for it (`createAccommodation`,
`updateAccommodation`, `deleteAccommodation`, `listTripAccommodations`, `countAccommodationNights`),
that `-server/plan.ts:218` surfaces only the name, and that `grep -rn createAccommodation src/`
reaches the writer (`src/server/repos/itinerary.ts:389`) from the seeder
(`src/routes/api/dev/-seed/apply-trip.ts:280`) alone. **The gap is a write path and a surface, not a
model** — which is why this stage is `L` for its UI and trivial for its data.

Rows unblocked: none. No row lists `BKG-05` in its `dependsOn`.

### Owned paths

- `src/routes/_app/trips/$tripId/-server/stays.ts` — new. The stay's four writes and its read, in a
  route-local `-server/` module of its own, following the convention
  `src/routes/_app/trips/$tripId/-server/` already establishes.
- `src/components/modules/book/stay-dialog.tsx` — new. The stay branch of the booking dialog.
- `src/components/modules/book/booking-dialog.tsx` — edit. Choosing the stay type swaps in the stay
  branch. `03-S4` (wave 3) and `06-S6` (`06-documents-and-media.md`, wave 4) hold this file in earlier
  waves; this stage is the last of the three.
- `src/components/modules/book/booking-form.ts` — edit. The stay draft and its rules. `03-S4` holds
  this file in wave 3.
- `src/components/modules/book/bookings-timeline.tsx` — edit. A stay card reads as a stay: nights, not
  a start time. `03-S6` holds this file in wave 4.
- `src/components/modules/book/index.ts` — edit.
- `src/components/modules/book/__tests__/stays.test.ts` — new. The night arithmetic and the per-day
  labels.
- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` — edit. The day panel's **Add a stay** entry
  point, which opens the same dialog the booking desk opens. `01-S2` (wave 1), `01-S4` (wave 2),
  `02-S4` (`02-places-and-maps.md`, wave 3), `03-S5` (wave 4) and `01-S9` (`01-trips-core.md`,
  wave 5) hold this file in earlier waves; **wave 6 is the first in which it is free**, which is where
  this stage already sits.
- `src/server/fns/booking-import.ts` — edit, and only to add one branch. `03-S7` (wave 5) mints this
  file and owns its confirm path; this stage adds the accommodation branch of that confirm, described
  under **Server** below. No sibling plan claims the path in any wave, so the two claims are this
  file's own and sit two waves apart.
- `src/components/planner/day-section.tsx` — edit. The day header's stay badge. `01-S2` (wave 1),
  `01-S4` (wave 2), `02-S4` (`02-places-and-maps.md`, wave 3), `03-S5` (wave 4) and `02-S9` (wave 5)
  hold this file in earlier waves; six stages, six waves, and this is the last of them.
- `src/components/planner/types.ts` — edit. `PlannerDay.stays` becomes a shape rather than a list of
  names. Same earlier claimants: `01-S2` (wave 1), `01-S4` (wave 2) and `03-S5` (wave 4).
- `src/routes/_app/trips/$tripId/-ui/plan-model.ts` — edit. Builds it. `01-S2` (wave 1), `01-S4`
  (wave 2), `02-S7` (`02-places-and-maps.md`, wave 4) and `02-S9` (same plan, wave 5) hold this file
  in earlier waves; wave 6 is the first in which it is free, which is where this stage already sits.
- `src/routes/_app/trips/$tripId/-server/plan.ts` — edit. The board carries the stay's dates, times and
  link instead of only its name. `07-S1` (wave 1), `01-S4` (wave 2), `02-S7` (wave 4) and `02-S9`
  (`02-places-and-maps.md`, wave 5) hold this file in earlier waves; `03-S5` deliberately does not,
  and its **Owned paths** heading says why.
- `src/server/repos/itinerary.ts` — edit, and **only** to let the new column through the two
  accommodation validators. `createAccommodationInput` (`:93-107`) and `updateAccommodationInput`
  (`:110-123`) each gain one line, `reservationId: idSchema.nullish()`, and `createAccommodation`
  (`:389`) gains the reference guard that matches the ones already beside it: when the id is set, the
  reservation is resolved through `reservationsRepository.requireById(scope, …)` and its `tripId` must
  equal the stay's, exactly as `requireTripDay` and `requirePlaceOfTrip` already do for the day range
  and the place. Nothing else in the file is touched, and **no accommodation function is added** — a
  second `createAccommodation` beside a working one would be a defect, not a plan. `01-S4` (wave 2),
  `07-S9` (`07-collaboration-and-sharing.md`, wave 3) and `02-S9` (`02-places-and-maps.md`, wave 5)
  hold this file in earlier waves; **wave 6 is the first in which it is free**, which is where this
  stage already sits — established by reading those three stages' **Owned paths** lists, since the
  collision script this file used to cite is not present at `HEAD` (see **Cross-plan collisions**).
  The same claim also carries this plan's third and last `assertTripRole` call, described under
  **Server** below; it is one guard in one file, not a second concern.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/reservations-and-transport.visual.spec.ts` — append.
- `e2e/__screenshots__/reservations-and-transport.visual.spec.ts/` — append.

**Why that one-line widening is claimed here rather than filed elsewhere.** Both validators are
`z.object`s, so an unknown `reservationId` is not an error — it is silently **stripped** before the
insert, and the stay would be written with a null link while every test that only checked the return
value passed. A column supplied by a schema stage that no validator will carry is a column that does
nothing.
An earlier draft of this plan made exactly that mistake one stage away, on
`src/server/repos/expenses.ts`, and `03-S4`'s **Owned paths** section records it; the difference here
is that `itinerary.ts` is genuinely free in this stage's wave, so the fix is to own the two lines
rather than to route around them.

### Data and migration

**One additive column, filed onto the wave-5 schema stage of `00-foundations.md`.** This stage is
wave 6, so its supplier is the wave-5 instance of the per-wave schema stage that file's register mints
— not `00-S1`, whose closing clause absorbs wave-1 filers only. It is the last requirement this plan
files, and the only one filed after wave 3.

- `day_accommodations.reservation_id` — `text`, **nullable**,
  `REFERENCES reservations(id) ON DELETE SET NULL`, with
  `index('day_accommodations_reservation_idx').on(t.reservationId)`. It is the link that makes the two
  records one thing to the reader: the booking carries the confirmation code, the status and the price;
  the stay carries the nights and the times. Nullable because a stay recorded straight from the day
  view has no booking yet, and `SET NULL` because deleting the booking must not delete the nights.
- Migration: the next ordinal `pnpm db:generate` mints. It **backfills nothing** — the four seeded
  stays keep a null link, which reads as "recorded without a booking", which is true.

Everything else exists. In particular `reservations.end_day_id` (`:703`) is already the column a stay's
booking needs for its own end, and `RESERVATION_TYPES` already contains `accommodation` (`:176`), so no
enum is widened and no `CHECK` constraint changes.

**Money and scoping, stated for both records this stage writes.** `day_accommodations.price_minor` and
`reservations.price_minor` are both **integer counts of minor units**, each beside a `text(3)`
ISO-4217 `currency` (`:626-627`, `:721-722`), and the stay's nightly figure is never derived by
dividing one by the other — a total split by a count of nights is a number nobody was charged, so the
total is what is stored and the per-night figure is not stored at all. Both tables carry
`organization_id NOT NULL` and both lead their composite index with it
(`day_accommodations_org_trip_idx`, `reservations_org_trip_idx`), so every read and write this stage
makes is bounded by `tenantFilter()` on the leading column.

### Server (repo, server function, Zod)

**No repository function is added, and one existing pair of validators is widened by one line each.**
`createAccommodation` (`src/server/repos/itinerary.ts:389`), `updateAccommodation` (`:406`),
`deleteAccommodation` (`:425`), `listTripAccommodations` (`:166`) and `countAccommodationNights`
(`:433`) are all present, all `tenantFilter()`-scoped, and all already guard the day range:
`createAccommodation` resolves both days with `requireTripDay` against the stay's own trip and raises a
`NotFoundError` when the end day precedes the start. This stage calls them. Adding a second
`createAccommodation` beside a working one would be a defect, not a plan.

The one change inside that file is the `reservationId` field on `createAccommodationInput` and
`updateAccommodationInput` plus its reference guard, described under **Owned paths** above with the
reason it cannot be left to another stage: a `z.object` strips the unknown key rather than rejecting
it, so without those two lines the co-created stay is written with a null link and no error is raised
anywhere.

**Server functions — `src/routes/_app/trips/$tripId/-server/stays.ts`.**

- `createStayFn` — `createServerFn({ method: 'POST' })`. Validator: a `z.object` carrying the trip, the
  two day ids, an optional place id, the name, the address, the three times as `HH:MM` refinements, the
  confirmation number, the price in minor units with its ISO-4217 code, the status and the notes.

  **The co-creation, and the order that makes it safe.** The stay and its booking are one action to the
  reader and two rows in the database. The booking is written first through `createReservation`, then
  the stay through `createAccommodation` with `reservationId` set, and if the second write fails the
  first is deleted again — the same compensating shape `src/server/fns/files.ts` already uses for the
  R2 object and its row, and for the same reason: a stay with no booking is recoverable by hand, a
  booking that claims nights nobody is staying is a lie the reader cannot see. Both writes are D1 and
  both go through repositories, so `db.batch()` is not available across two repository functions
  without claiming a file this stage may not claim; the compensation is stated rather than hidden.

- `updateStayFn` — updates both records, and does not create a booking for a stay that never had one.
- `deleteStayFn` — deletes the stay and asks, in the confirm dialog rather than in the handler, whether
  the booking goes with it. Two records, one question, answered by the reader.
- `loadStaysFn` — the trip's stays with their bookings, for the desk and for the planner.

**Zod.** v4 idiom. `z.iso.date()` is **not** used for the day references, because they are ids and not
dates; the dates come from the days themselves, which is the whole point of a day-referenced stay.

**Authorisation.** `appScope()`, then `requireTrip`, then the repository's own `requireTripDay` and
`requirePlaceOfTrip` guards, which are already written and already refuse a day or a place from
another trip, and then the new `reservationId` guard beside them, which refuses a booking from another
trip on the same terms. The stay's `reservationId` is never taken from the client payload in
`createStayFn` — it is the id of the booking the same handler has just written — and in `updateStayFn`
it is only ever cleared, never re-pointed, so the guard exists for the repository's own contract
rather than for a path this stage exercises.

**And the role guard, which is this plan's third and last.** `assertTripRole(scope, tripId,
['owner', 'editor'])` goes into `createAccommodation`, `updateAccommodation` and `deleteAccommodation`
in `src/server/repos/itinerary.ts`, the same shape `03-S2` put into the transports repository in
wave 2 and `03-S4` into the reservations repository in wave 3, and for the same reason those two
state: `requireTrip` proves membership, membership is not a role, and at HEAD a `viewer` can write a
stay while `trip-room.ts` refuses them the collaborative equivalent. `01-S1` (`01-trips-core.md`,
wave 1) mints the guard. Wave 6 is the first wave in which this file is free, so this stage is the
only place it can be added, and with it the three write surfaces this plan touches are guarded
uniformly rather than two out of three.

**The accommodation branch of the import confirm.** `03-S7` builds the confirm that turns a parsed
document into records, and its engine already recognises a hotel: `RESERVATION_TYPES` contains
`accommodation` and the extraction returns it like any other type. What `03-S7` does with it is write
a reservation, which is right and incomplete — a hotel confirmation names nights, and nights are a
stay. This stage adds the one branch that closes that: when the confirmed type is `accommodation` and
the parsed dates resolve to two days of the trip, the confirm writes the reservation as it already
does, then calls `createAccommodation` with `reservationId` set, so the reader gets both records from
one confirmation instead of a booking with no nights on the board. The ledger line is unchanged — it
is `syncReservationExpense`'s, minted by `03-S4`, called once for the reservation and never for the
stay, because the stay is not a second thing anybody paid for.

Three refusals keep that branch small. If the parsed dates do not resolve to two days of the trip the
stay is **not** written and the reservation is, with the same "recorded, needs review" reading a
missing field already gets — a stay hung on the wrong nights is worse than no stay. If the type is
anything other than `accommodation` the branch does not run. And the branch adds no new server
function, no new validator and no new queue message: it is a conditional inside the confirm handler
`03-S7` owns, reached two waves later, which is why this stage claims that file for an edit rather
than filing a request on `03-S7`.

**Realtime.** One `mirrorToRoom` patch per action, on the `trip` entity, carrying the stay id and its
day range — not the whole record, because the room is a notification channel and D1 is the store.

**Nothing is enqueued.** Two small writes.

### UI (route, components)

**Route.** None added or moved; `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not an
owned path.

**Components.** `Dialog`, `Field`, `Input`, `SimpleSelect`, `Combobox`, `Textarea`, `Badge`, `Chip`,
`Alert` and `Button` from `src/components/ui`; `ConfirmDialog`, `FactList` and `useAction` from
`src/components/modules/shared`. **No new primitive.** `DateRangePicker` exists in
`src/components/ui` and is deliberately **not** used: a stay is chosen as a run of **days of this
trip**, not as two calendar dates, and offering a calendar would invite a reader to pick a date the
trip does not have.

**What changes on screen.**

- **The stay branch of the booking dialog.** Choosing the accommodation type replaces the start/end
  date and time block with: the property (a `Combobox` over the trip's places, which fills the name
  and the address when it is empty and never overwrites what the reader typed), the first night and
  the last night as day selects, a check-in **window** as two times, a check-out time, and then the
  ordinary confirmation code, status, price and notes. The field order is the order a person reads a
  hotel confirmation in.
- **The nights are stated, not implied.** "3 nights · Fri 9 Oct → Mon 12 Oct" under the two day
  selects, updating as they change, with `tabular-nums` so the number does not shift the line. The
  arithmetic is `countAccommodationNights`'s rule — the difference between the two day numbers — and it
  is computed once in `stays.test.ts`'s pure function, not twice.
- **The day header badge.** Each covered day's header in the planner shows the property with a word for
  what that day is: the first says _Check in_, the last says _Check out_, and the nights between say
  the property's name alone. On the first day the badge also carries the check-in window when one is
  set, because that is the day the reader needs it. Clicking the badge opens the linked place when
  there is one.
- **A stay is started from the day, not only from the desk.** The day panel gains an **Add a stay**
  action beside the ones that add a place and a transport, and it opens the same dialog the desk
  opens, with that day pre-selected as the first night and the last night left for the reader to
  choose. The reference product offers the same entry point from the day view (`wiki: Accommodations`),
  and the reason it is worth copying is that the reader who is looking at Friday and thinking about
  where they sleep on Friday should not have to leave the board to say so. It is one action opening
  one dialog: no second form, no second write path, and the pre-selection is a default the reader can
  change like any other.
- **A stay never appears in the day's sequence**, which is the rule `03-S5` states from the other side.
  One representation per fact.
- **The desk card** for a stay shows nights and the check-in window rather than a start time, and shows
  its confirmation code through the same masked control `03-S6` builds.

**States.**

- _Empty._ A trip with no stays shows nothing on the day headers — an empty badge row would be noise —
  and the desk's own empty state already covers the list. The stay dialog's property combobox on a trip
  with no places shows the reason inline and lets the reader type a name instead of blocking them.
- _Skeleton._ The planner's day header reserves the badge row's height while the board loads, so the
  headers do not jump when the stays arrive. This is the one place in this plan where a skeleton exists
  purely to prevent layout shift, and it is why the shift assertion below can be zero.
- _Error._ A failed co-creation states which half failed and what was rolled back, in the dialog's
  `Alert`, and keeps the draft. A failed delete leaves both records and says so.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on every field, the badge
  (which is a link and looks like one on focus), the day panel's **Add a stay** action, the save and
  the delete.

**Motion.** The badge row fades and rises 2px at `--duration-fast` on `--ease-out-quint` when the board
settles; the dialog's branch swap cross-fades at `--duration-fast` rather than animating height, so
switching type does not make the dialog jump. Both collapse under `prefers-reduced-motion: reduce`.

**Tokens.** None missing. The check-in badge is `--color-success-soft` with `--color-success` text, the
check-out badge `--color-info-soft` with `--color-info`, and the nights between are `--color-ink-3` on
`--color-surface-2` — three tones that read as a sequence rather than as a traffic light, and all six
pairs checked at AA in both themes with the dark values already declared for dark.

### Quota

**No countable row.** A stay is a child of a trip and `USAGE_METRICS` has no metric for one; the sold
ceiling is `trips`. The co-created booking is a `reservations` row, which has no metric either, for the
reason `03-S1` states once for the whole plan. Nothing is added to `resolveLimits()` or `PLAN_QUOTAS`,
and `src/server/billing/__tests__/limits.test.ts` gains no case and is not an owned path.

### Tenant isolation test

Appended as one `describe` block. Covered: `createAccommodation`, `updateAccommodation`,
`deleteAccommodation`, `listTripAccommodations`, `countAccommodationNights`.

The role guard is asserted here too, on the same terms `03-S2` and `03-S4` state: a `viewer` on their
**own** trip is refused by `createAccommodation`, `updateAccommodation` and `deleteAccommodation`, and
an `editor` on the same trip is allowed — one case each way, so the guard is proven to discriminate
rather than merely to throw.

The cases: A cannot read, list, update or delete B's stays by id; A cannot create a stay whose
`startDayId` or `endDayId` is one of B's days, nor whose `placeId` is one of B's places — both are
`NotFoundError` from the guards already in `itinerary.ts`; and the case this stage genuinely adds, A
cannot create a stay linked to **B's reservation** through the new `reservation_id`, which must be
refused rather than written as a dangling cross-tenant link. B's stays and B's reservations are both
re-read afterwards and must be unchanged.

### Verification

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/modules/book/__tests__/stays.test.ts` — nights are the difference between the two day
  numbers and a one-day stay is zero nights, not one; the per-day label is _check in_ on the first,
  _check out_ on the last, neither in between, and both on a single-day stay; a stay whose last night
  precedes its first is invalid before it is submitted.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the block above.

**Browser evidence.** Two surfaces, twelve frames: `/trips/demo-trip-01-tokyo-and-kyoto/book` and
`/trips/demo-trip-01-tokyo-and-kyoto/plan`, each at 360, 1280 and 2560 in both themes. Plus the
**declared state**: the stay branch of the dialog open with a three-night range selected,
`--state stay-branch`, reached with `--click '[data-part="new-booking"]'` then
`--click '[data-part="type-accommodation"]'`. Both selectors are attributes this plan adds and both are
proven to resolve by a `count()` assertion in the spec. The planner surface is captured with `--map`.
`PT_SERVER_TODAY=2026-08-20`, invocation as `03-S1` quotes it.

**Console** silent, `fatal` empty; on the planner route the rasteriser's GL advisory is the one
tolerated entry and nothing is added to `TOLERATED_CONSOLE_WARNINGS`. **Layout shift** after the settle
mark asserted `0` on Chromium — the reserved badge row is what makes that achievable, and it is the
assertion this stage most needs — and reported as a skip on WebKit.

### Definition of done

The six items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

Per surface:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**Two dependencies on other plans, both satisfied by the wave order.** `TRP-06` is closed by `01-S9`
(`01-trips-core.md`, wave 5), which is the planner workspace this stage puts a badge into; `BKG-02` is
closed by `03-S4` (wave 3) inside this file. Wave 6 sits after both.

**Two more inside this file, and one of them is soft.** `assertTripRole` comes from `01-S1`
(`01-trips-core.md`, wave 1), five waves earlier. And `src/server/fns/booking-import.ts` must exist
before this stage can add a branch to it, which `03-S7` does in wave 5 — but the dependency degrades
rather than blocks: if that stage has not landed, this one ships everything except the accommodation
branch of the confirm, and the branch is then filed as the first thing `03-S7` adds when it does. The
stay dialog, the day-panel entry point, the badge and the column do not depend on the importer at
all.

No package outside the pinned set, no binding absent from `wrangler.jsonc`, no third-party service, and
no schema change beyond the one nullable column above.

---

## Cross-plan collisions

Required by this plan's acceptance criteria. This is the one heading in this file that is neither a
stage block nor part of the Area brief; `TEMPLATE.md` asks for no appendix and no status log, and this
is neither.

**Read the first sentence of this section before the output below it.** Both scripts were real when
this section was first written and their output was pasted verbatim so a reader could re-run them and
get the same findings. **Neither script exists at `HEAD`.** There is no `scripts/ultrabuild/`
directory, `find . -name 'check-plan-*.mjs'` returns nothing, and `package.json` declares no script
that would run one. So the two fenced blocks below are a **record of a past measurement, not a
reproducible one** — they are kept because their findings are still the argument for how this plan's
ownership is arranged, and deleting them would delete the reasoning with them, but nobody should read
them as a check they can re-run.

That has one practical consequence, stated here and honoured everywhere else in this file: **every
ownership claim in this plan is established by reading the sibling stages' own Owned paths lists**, and
where a stage says "wave _n_ is the first wave in which this file is free" it means that reading and
not a script's verdict. Where an earlier revision cited the script as the proof, the citation has been
replaced by the reading. An agent executing a stage of this file does the same — it reads the plans it
shares a path with, in the waves at or below its own — and treats a same-wave exclusive overlap it
finds there as a blocker. If either script is restored, that reading becomes a cross-check rather than
the only evidence.

The findings themselves were last measured against a plan set that has moved since: the numbers below
are a snapshot, the two claims this file's final revision added (`plan-screen.tsx` and
`src/server/fns/booking-import.ts`, both `03-S8`, both wave 6) post-date it, and both are named in the
table that follows rather than in the fence.

### `node scripts/ultrabuild/check-plan-collisions.mjs 03`

```
plans 13 · stages 91 · owned paths 544

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (17) — legal; each plan must name the other:
  src/server/fns/reservations.ts
      00-foundations.md  00-S3  wave 0  (edit)
      03-reservations-and-transport.md  03-S4  wave 3  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
  src/routes/_app/-server/settings.ts
      00-foundations.md  00-S3  wave 0  (edit)
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
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
  src/server/repos/settings.ts
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/settings/appearance.tsx
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/-server/trip.ts
      03-reservations-and-transport.md  03-S2  wave 2  (edit)
      05-packing-and-todos.md  05-S1  wave 3  (edit)
      05-packing-and-todos.md  05-S5  wave 5  (edit)
      07-collaboration-and-sharing.md  07-S2  wave 1  (edit)
  src/components/modules/book/booking-dialog.tsx
      03-reservations-and-transport.md  03-S4  wave 3  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
      06-documents-and-media.md  06-S6  wave 4  (edit)
```

### `node scripts/ultrabuild/check-plan-refs.mjs 03`

```
plan 03: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
```

Two things that output has to say, and does: **zero dangling stage references** — every `NN-Sn` token
cited anywhere in this file is `DEFINED` by a `## Stage` heading in the plan whose prefix it carries,
including the fourteen citations of stages in `00`, `01`, `02`, `04`, `05`, `06`, `07`, `09` and `11`
— and **no missing Playwright invocation**, which for an area plan means every stage's **Verification**
block reaches the runner named in `12-verification-protocol.md` rather than describing a screenshot in
prose.

**The three findings of the collision check, read in order.**

**1. No same-wave exclusive collision involving this plan.** That is the line which decides whether
two agents can be sent out at once, and it is the one this file is accountable for. It was not free.
Two stages state a wave above their row's floor to get it, and one of them — `03-S5` — also gave up
three files it would rather have owned and split its server work into a route-local module instead.
The Area brief's third disagreement records both moves with the sibling stage that forced each.

It is also the line that decided the **direction of one foreign key**. `03-S4` needs a link between a
booking and the ledger line its price produces. `src/server/repos/expenses.ts` carries an exclusive
claim in every wave from 0 through 3 — `00-S1`, `04-S1`, `04-S3`, `04-S6` — and `03-S4` is wave 3, so
putting the column on `expenses` would have meant either a same-wave clobber with `04-S6` or a
widening filed onto a stage that does not carry it. An earlier draft did the second of those, and it
was a defect: no stage in the plan set supplied it, and `04-S3` states in its own prose that it will
not. The link is therefore `reservations.expense_id`, on a table this plan's own repository owns, and
`src/server/repos/expenses.ts` appears under **no stage of this plan in any wave** — which is what the
absence of that path from the output above says.

**2. Every cross-wave path the check lists is named in the stage that owns it, with the sibling stage
id and its wave.** The table gathers the same information; the authority is each stage's own **Owned
paths** list.

| Path                                                | This plan              | Sibling claims, all in other waves             |
| --------------------------------------------------- | ---------------------- | ---------------------------------------------- |
| `src/server/fns/reservations.ts`                    | `03-S4` w3, `03-S6` w4 | `00-S3` w0                                     |
| `src/routes/_app/-server/settings.ts`               | `03-S6` w4             | `00-S3` w0, `02-S2` w1, `09-S7` w2, `09-S8` w3 |
| `src/routes/_app/trips/$tripId/plan.tsx`            | `03-S5` w4             | `01-S2` w1                                     |
| `src/routes/_app/trips/$tripId/-ui/plan-model.ts`   | `03-S8` w6             | `01-S2` w1, `01-S4` w2, `02-S7` w4, `02-S9` w5 |
| `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` | `03-S5` w4, `03-S8` w6 | `01-S2` w1, `01-S4` w2, `02-S4` w3, `01-S9` w5 |
| `src/components/planner/day-section.tsx`            | `03-S5` w4, `03-S8` w6 | `01-S2` w1, `01-S4` w2, `02-S4` w3, `02-S9` w5 |
| `src/components/planner/types.ts`                   | `03-S5` w4, `03-S8` w6 | `01-S2` w1, `01-S4` w2                         |
| `src/components/planner/index.ts`                   | `03-S5` w4             | `01-S2` w1, `01-S4` w2                         |
| `src/components/planner/ordering.ts`                | `03-S5` w4             | `01-S4` w2                                     |
| `src/components/planner/plan-dnd.ts`                | `03-S5` w4             | `01-S4` w2                                     |
| `src/components/planner/__tests__/ordering.test.ts` | `03-S5` w4             | `01-S4` w2                                     |
| `src/server/repos/itinerary.ts`                     | `03-S8` w6             | `01-S4` w2, `07-S9` w3, `02-S9` w5             |
| `src/routes/_app/trips/$tripId/-server/plan.ts`     | `03-S8` w6             | `07-S1` w1, `01-S4` w2, `02-S7` w4, `02-S9` w5 |
| `src/server/repos/settings.ts`                      | `03-S6` w4             | `02-S2` w1, `09-S8` w3                         |
| `src/routes/_app/settings/appearance.tsx`           | `03-S6` w4             | `02-S2` w1, `09-S8` w3                         |
| `src/routes/_app/-server/trip.ts`                   | `03-S2` w2             | `07-S2` w1, `05-S1` w3, `05-S5` w5             |
| `src/components/modules/book/booking-dialog.tsx`    | `03-S4` w3, `03-S8` w6 | `06-S6` w4                                     |

Two rows of that table post-date the fenced output above and were verified by reading, in the way this
section's opening paragraph describes. `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` is claimed
by `03-S8` in wave 6 for the day panel's stay entry point; the five earlier claims on it — `01-S2` w1,
`01-S4` w2, `02-S4` w3, `03-S5` w4, `01-S9` w5 — occupy waves 1 through 5 and leave wave 6 free, which
is where `03-S8` already sat. `src/server/fns/booking-import.ts` is claimed twice, both times by this
file — `03-S7` mints it in wave 5, `03-S8` adds one branch in wave 6 — and by no sibling plan in any
wave, so it belongs in the "no sibling claims them at all" group below rather than in the table.

Two further entries appeared in that table only in the final pass and are worth naming as such,
because both arrived from outside this file. `src/server/repos/itinerary.ts` is claimed by `03-S8` for the two
lines that let `day_accommodations.reservation_id` through `createAccommodationInput` and
`updateAccommodationInput`; wave 6 is the first wave in which that file is free, which is where the
stage already sat. And `src/components/modules/book/booking-dialog.tsx` became a cross-plan path when
`06-documents-and-media.md` claimed it for `06-S6` in wave 4 while this file was being revised — the
three claims are in three different waves, so it is legal, and all three now name the other two.

Four paths this plan claims are absent from the list because **no sibling plan claims them at all**:
`src/server/repos/transports.ts` (`03-S1` w1, `03-S2` w2, `03-S5` w4),
`src/routes/_app/trips/$tripId/transports.tsx` (`03-S1` w1, `03-S2` w2, `03-S6` w4),
`src/server/repos/reservations.ts` (`03-S4` w3) and `src/server/fns/booking-import.ts` (`03-S7` w5,
`03-S8` w6). The second of those is worth reading twice, because
its absence from the collision list is also a **constraint**: `03-S4` is the only stage in the plan
set that may edit it, in any wave, so every write to a `reservations` column that any later stage of
this file needs — `expense_id` for `03-S4` itself, `imported_at` for `03-S6` and `03-S7` — has to be
minted there as an exported function. A stage that cannot claim a repository file cannot widen the
`z.object` in front of it either, and an unknown key handed to a `z.object` is stripped rather than
refused. Two more are absent because every claim on them is an
`append`, which is the documented cooperative pattern rather than a collision:
`src/server/repos/__tests__/tenant-isolation.test.ts`, appended by every stage here and by some thirty
across the other plans, and `e2e/reservations-and-transport.visual.spec.ts` with its baseline
directory, which `03-S1` creates and every later stage appends.

**3. Four stages state no parseable wave, and none of them is this file's.** `11-S1`, `11-S2` and
`11-S3` belong to the register plan and carry their wave in prose rather than in the parsed form. The
fourth, reported as `04-S2`, is **not** `04-budget-and-currencies.md`'s real `04-S2`, which states
`Wave 1` and parses: it is the illustrative `## Stage 04-S2` heading inside the code fence at
`12-verification-protocol.md:26`, which the script reads as a stage because it cannot tell a fenced
example from a real heading. This file's acceptance criteria anticipated five such stages; the
measurement is four. A fifth existed for part of this file's writing and was **this file's own
fault**: an Area-brief heading beginning `## Stage order, …` parsed as a stage called `order` with no
wave. It is now `## The order of the stages, …`, and the general rule it produced is worth stating
once — **no heading outside a stage block may begin with the word "Stage"**.

All eight stages of this file state their wave in the parsed form, so none is invisible to the check:

| Stage   | Wave | Effort |
| ------- | ---- | ------ |
| `03-S1` | 1    | M      |
| `03-S2` | 2    | XL     |
| `03-S3` | 3    | L      |
| `03-S4` | 3    | M      |
| `03-S5` | 4    | M      |
| `03-S6` | 4    | M      |
| `03-S7` | 5    | L      |
| `03-S8` | 6    | L      |

**What the output cannot tell anyone, said here instead.** The header counts are a snapshot of a set
several runs are still writing. While this file was being written the check reported, in order,
`plans 8 · stages 48`, `plans 9 · stages 56`, `plans 13 · stages 80`, `plans 13 · stages 84`,
`plans 13 · stages 87`, `plans 13 · stages 91 · owned paths 550`, `plans 13 · stages 91 · owned
paths 538`, `plans 13 · stages 91 · owned paths 544`, `plans 13 · stages 91 · owned paths 543`,
`plans 13 · stages 91 · owned paths 545` and, on the revision that produced the section you are
reading, `plans 13 · stages 91 · owned paths 544`.
The unique-path count moved by fifteen between two runs minutes apart, and three times more on
revisions that added **no unique owned path to this file at all** — one of them is the revision
that repaired `03-S6`, which added one owned-path bullet,
`src/routes/_app/trips/$tripId/transports.tsx`, on a path `03-S1` had already claimed, so it added
nothing to `byPath` and the total still rose by two. The `544` → `543` step was measured the same way:
the check was re-run against this file's own previous revision, unmodified, and returned `543` as
well, so the drop came from a sibling plan and not from anything here. Sibling plans were dirty in the
working tree throughout.

**The last step, `545` → `544`, is the one exception: it is this file's own doing and can be
attributed exactly.** This revision deleted a single owned-path bullet — `src/server/fns/context.ts`
under `03-S7`, which was there to add a second `TASKS` accessor beside `filesBucket()`. That helper
already exists as `taskQueue()` (`src/server/auth/env.ts:87`) and is already used with `enqueueTask`
at `src/server/auth/email.ts:289`, so the bullet was a duplicate rather than a claim, and `03-S7`
now reuses both symbols instead. No other plan claimed that path, which is why removing it moved the
unique-path total by exactly one and changed nothing else in the output: the seventeen cross-wave
entries and the `no same-wave exclusive collisions` line are byte-identical to the previous run. The
general lesson is the one `03-S7` now states in its own prose — **before a stage lists a helper as a
new file or a new export, grep for the helper, not only for the feature**. Grepping for
`booking-import` found the engine and correctly found no producer; only grepping for `taskQueue`
found the accessor that made half the producer unnecessary.
So the header will not reproduce, and it is not the part that matters. The findings under it are
properties of **this** file's ownership and hold only until a sibling changes what it claims. Any
agent executing a stage of this file therefore **re-checks its own owned paths against the sibling
plans before it writes a line** — by hand while the scripts are absent, with them if they are restored
— and treats a same-wave exclusive overlap or a dangling stage reference as a blocker rather than as a
note. That re-check is part of this plan's gate, not a courtesy, and this section is the evidence that
the failure mode it guards against is real, because it happened four times during the writing of this
one file.
