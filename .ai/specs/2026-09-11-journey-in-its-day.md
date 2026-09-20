# The journey in its day: a transport row in the planner's one sequence

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | in-progress |
| **Issue**          | #175        |
| **Spec PR**        | none        |
| **Implementation** | none        |

`03-S5` · FR #175 · Parent PRD #167 · Stage `03-S5` of `docs/plans/03-reservations-and-transport.md` (frozen), row `BKG-10`.

Source plan: `docs/plans/03-reservations-and-transport.md`, stage `03-S5` — "The journey between two places, in the day it happens". The stage's hard precondition, `01-S4`'s `PlannerItem` union, landed on `develop` in #404 (`.ai/specs/implemented/2026-09-10-day-as-one-sequence.md`), so the seam this spec fills now exists on disk.

## 📝 TLDR

A trip can hold journeys — `transports` and `transport_legs` have been on disk since #171 — and the planner board, the screen whose whole job is to say what a day looks like, does not draw a single one of them. This spec puts a journey into its day's sequence, between the places it connects, as the **third variant** of the `PlannerItem` union `01-S4` wrote as an extension point and documented as one.

A journey that spans days renders on each day it covers, labelled by the part that day sees — _Departs / In the air / Lands_ for a flight, _Pick-up / On hire / Drop-off_ for a hire car, _Starts / Under way / Ends_ for everything else. A journey broken into legs contributes one row per leg, each in its own day at its own time, and no spanning row beside them. A stay renders no row at all: an accommodation covers nights rather than moments, and it reaches the board as a day-header badge in `03-S8b` (#180).

## 📝 Problem Statement

**Who has it.** Anyone planning a trip that involves getting anywhere. The planner rail is where a traveller reads their day, and today it can tell them "Sensō-ji at 09:00, then the fish market at 11:00" and cannot tell them "…and the 14:05 Shinkansen to Kyoto" — the single most time-critical thing on the day.

**The evidence, measured in the tree at `74f5ff57`:**

- `src/components/planner/types.ts:72` declares `PlannerItem` as a two-variant union of `stop` and `note`, with a doc comment that names this exact third kind (`BKG-10`) and states the shape it must take.
- `src/routes/_app/trips/$tripId/-server/plan.ts` loads itinerary, places, unscheduled places and categories. Neither it nor `-ui/plan-model.ts` contains the substring `transport` (zero matches in either file).
- `src/server/repos/transports.ts:162` exports `listDayTransports(scope, dayId)` — one day at a time, whole records only, no legs. Nothing calls it from the planner, and it cannot answer "every journey this trip's board must draw" in one read.
- `src/components/planner/ordering.ts` declares exactly two prefixed id spaces, `idea:` (`:34`) and `note:` (`:57`), and `movePlanItem`'s `'not-in-ideas'` refusal (`:390`) is keyed on `isNoteItemId` alone.
- The data is real and reachable: `transports.day_id` / `arrival_day_id` and `transport_legs.departure_day_id` / `arrival_day_id` are populated by the chain editor, by a saved connection, and by the dev seeder (`src/routes/api/dev/-seed/apply-trip.ts:312-318`).

**What it costs.** The board claims to be the day, and silently is not. A reader who plans a travel day on this screen gets an itinerary with a hole in the middle of it, and the only place the journey exists is a separate tab they have to remember to check.

## 📝 Proposed Solution

One variant, one prefix, one renderer — exactly the seam `01-S4` promised, and nothing wider.

1. **`PlannerItem` gains `{ kind: 'transport'; transport: PlannerTransport }`.** `PlannerTransport` is a view model in the same idiom as `PlannerRow` and `PlannerNote`: everything locale-dependent arrives already formatted.
2. **`ordering.ts` gains the `leg:` id space** and its three helpers, in the same shape `IDEA_PREFIX` and `NOTE_PREFIX` already use, and its `'not-in-ideas'` refusal widens to cover it.
3. **`transport-rows.ts` (new) holds the arithmetic** — the phase vocabulary, total over `TRANSPORT_MODES`, and the expansion of one journey into the rows each covered day sees. Pure, and the module the ticket's own owned test file is named for.
4. **`transport-row.tsx` (new) renders one row**, beside `StopRow` and `NoteRow`, and `day-section.tsx` grows one branch of the `switch` its doc comment already predicts.
5. **A route-local loader and writer** — `-server/plan-transports.ts` and `-ui/plan-transport-model.ts` — reach the repository without touching `-server/plan.ts`, `-ui/plan-model.ts`, `repos/itinerary.ts` or `repos/days.ts`, all four of which are claimed by sibling stages in every wave this one could occupy.

### The position on the number line, and the writer that keeps it honest

A day is one number line: `day_assignments.order_index` and `day_notes.sort_order` are renumbered `0..n-1` together by `reorderPlanFn`, which this stage may not touch and whose validator (`-server/plan.ts:281`) accepts `kind: 'stop' | 'note'` only. A journey therefore cannot be _inside_ that renumbering, and its own column has to express where it sits **between** two of those positions.

That is precisely what the column was declared for. `sortOrder()` is `real('sort_order').notNull().default(0)` with the comment "**Fractional sort key so reordering a list never has to rewrite its siblings**" (`schema.ts:161`), and `transport_legs`'s own docblock (`schema.ts:1177-1181`) says `sort_order` is "**the fractional key that places a leg among everything else happening on a day**, which is the shared idiom every other timeline row in this file uses". `schedulePlaceFn` already uses the same idiom for `order_index` (`-server/plan.ts:411`: "`reorderPlanFn` folds the fraction back to an integer"). This spec adopts it rather than inventing a second convention.

**The server derives the fraction; the client never sends a number.** `reorderDayTransports` receives the day's **whole resulting run** — stops, notes and journeys, in order — and takes from it only which stop or note each journey follows. The numbers come from the day as stored: a journey whose preceding stop or note sits at `a`, where the next stored position strictly greater than `a` is `b`, is the `j`-th of the `m` journeys sharing that gap and is written `a + (j + 1) × (b − a) / (m + 1)`. An open end is one unit wide — `b − 1` ahead of the day's first stop or note in stored order, `a + 1` behind its last, `0` and `1` on a day with neither. Between stops at `0` and `1` one journey is `0.5` and two are `0.333…` and `0.666…`; ahead of a first stop at `0` a journey is `-0.5`.

**Neighbours' stored positions, not array indices**, because a day's positions are `0..n-1` only straight after `reorderPlanFn` renumbers it. `schedulePlaceFn` stores a new stop at the midpoint of its neighbours (`indexBetween`, `-server/plan.ts:413-425`) and `unschedulePlaceFn` deletes one without renumbering, so a count of entries names the wrong gap: on a day of stops at `0` and `2` after an unschedule, a journey behind the second stop is `k = 2` and an index formula writes `1.5`, _ahead_ of it. Every value derived this way lies strictly between `a` and the next position above it, so it ties with no stop or note — the relation `indexBetween` already keeps for a place scheduled between two stops. The one arrangement it cannot express is a journey _between_ two rows that share a position, which `schedulePlaceFn` can produce because `indexBetween` sees stops alone (a place scheduled at a note's integer): such a journey lands behind both until the next drag renumbers the day. On any tie that reaches a reader — the client's merge, and the server's rebuild of the current run below — a journey follows the stop or note sharing its number.

**A stored fraction is a relation to a numbering, so it is restated whenever that numbering changes — from one pure function, at two call sites, both tested.** This is the honest cost of not owning `repos/itinerary.ts`, and the frozen plan states it in the same terms. `journeyWrites(order, dayIds)` in `-ui/plan-transport-model.ts` takes the _resulting_ board and the days a change touched, and returns one `reorderDayTransportsFn` payload per touched day that a journey **departs** from. `applyChange` issues them after the primary write; the delete path issues them after `removePlanItem`. Two call sites, one rule, stated in the function's own docblock and covered by unit tests rather than by prose.

**A journey's `sort_order` belongs to its departure day, and to no other day it covers.** It is one number, and a number on a day's line means something only against that day's stops and notes. A journey is therefore written only by a reorder of the day it departs from — a record with no legs whose `day_id` is that day, or a leg whose `departure_day_id` is — and `journeyWrites` restates nothing on its arrival day or the days between, however those days change. Computing it from the arrival day's run would overwrite the departing day's position with a number measured against a different ruler, and each day's restatement would undo the other's.

**The rows a journey shows on its other days are placed, never stored.** `withTransports` gives them a position on the client: a `travelling` row, which carries no time, takes `-Infinity`, ahead of every position on the day — stops, notes and the journeys departing from it — where it inherits no clock and lends none; an `arriving` row that carries its arrival time takes `+Infinity`, behind them all, where `mergeDayTimeline` (`ordering.ts:260-286`) places it by that time alone and it lends its clock to no untimed row; an `arriving` row with no time takes `-Infinity`, like a `travelling` one. Nothing reads or writes the stored fraction for any of them. The accepted cost: an untimed stop dropped directly above a `travelling` row or below an `arriving` one snaps back beside its timed neighbours, because neither row lends it a clock.

**Three existing paths change with the journey**, and each is named here because each would fail quietly:

- `reorderPayload` (`plan-move.ts:131-136`) maps every id that is not a note to `kind: 'stop'`. It drops `leg:` ids instead, because they are `reorderDayTransportsFn`'s. Without the filter both id shapes fail, each in its own way. A leg's `leg:leg:{dayId}:{id}` — the ordinary, chained shape — is 59 characters, passes `reorderPlanFn`'s `id.max(64)` (`-server/plan.ts:72`), and is silently dropped as a stop the day does not hold. A leg-less record's `leg:transport:{dayId}:{id}` is 65 characters, so it fails validation for the whole payload and every drag on its departure day is refused.
- `movePlanItem`'s `schedule` change counts its `index` over the day's ids (`ordering.ts:398-401`), and `schedulePlaceFn` applies it to stops alone. The index counts every id but a `leg:` one, or a place dropped between two stops on a day that opens with a `travelling` row lands one slot late.
- The order `movePlanItem` returns for a schedule names the new stop by its `idea:` id (`ordering.ts:436-437`), which `reorderDayTransports` would drop as unknown. `applyChange` substitutes the `assignmentId` `schedulePlaceFn` returns (today discarded, `plan-screen.tsx:640-649`) before `journeyWrites` reads the order, so the restatement measures the journey against the stop that was actually written.

**Four bounds on the two writes not being atomic with each other**, quoted from the frozen plan because each is a property of code that already exists:

1. Positions are recomputed on every successful reorder, so the next successful move heals the day completely — the self-healing contract `-server/plan.ts:328-331` already documents.
2. The merged sequence sorts on time before position, and a journey almost always carries a departure time, so a stale fraction between two timed rows changes nothing a reader can see.
3. The client issues the calls together and rolls its optimistic order back if **either** fails, which is the contract `plan-screen.tsx` already implements for the single-call case.
4. The calls are ordered stops-then-journeys, so the failure that survives leaves the less visible half stale.

**Alternatives considered.**

| Approach                                                              | Why it lost                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fold the journey into `reorderPlanFn`'s batch (`repos/itinerary.ts`)  | The right end state, and unreachable in this wave: `itinerary.ts` is claimed by `01-S4` (wave 2), `07-S9` (wave 3) and `02-S9` (wave 5), and `-server/plan.ts` by four stages across waves 1, 2, 4 and 5. Named in Risks as the **deletion** this design is written to make easy.                                                                                 |
| An integer "gap index" — how many stops-and-notes precede the journey | Rejected after being written and tested against the tree. It survives a renumbering as a _number_ but not as a _relation_: on a day of three untimed stops with a journey at gap 1, dragging the third stop to the top moves the journey from after the first stop to before it, because the slot is absolute. It also contradicts the column's declared meaning. |
| Two new anchor columns (`after_kind`, `after_id`)                     | Genuinely stable, and a schema change plus a migration in a stage whose frozen Data section says "**No schema change and no migration**". Recorded here so it is not re-proposed without that being the change it is.                                                                                                                                             |
| A parallel `transports` array on `PlannerDay`                         | Two projections of one day is the design `PlannerDay.items` replaced, and its doc comment says so.                                                                                                                                                                                                                                                                |

## 📝 Architecture

```
plan.tsx (route loader)
  ├── loadPlanBoard          (untouched)
  ├── loadDayNotes           (untouched)
  └── loadPlanTransports     ← new, -server/plan-transports.ts
                                    │
PlanScreen                          │
  ├── orderFromPayload(board, notes)         (untouched)
  ├── withTransports(order, rows)            ← new, -ui/plan-transport-model.ts
  ├── planModel(board, order, …)             (untouched — skips ids it cannot resolve)
  ├── withTransportItems(model, order, idx)  ← new, re-inserts the variants
  └── applyChange → journeyWrites(order, …)  ← new, the restating follow-up
                                    │
DaySection → switch (item.kind)     │
  ├── 'stop'      → StopRow         (untouched)
  ├── 'note'      → NoteRow         (untouched)
  └── 'transport' → TransportRow    ← new
```

**Why the model is a post-pass rather than an argument.** `planModel` walks `order.days[].itemIds` and skips any id the payload cannot resolve (`plan-model.ts:298-299`) — so a `leg:` id passes through it harmlessly and is simply absent from `items`. `withTransportItems` then rebuilds each day's `items` by walking the same `itemIds` and taking either the transport variant from its index or the item `planModel` already produced, keyed by id. Two map lookups per row, no second ordering rule, and `plan-model.ts` is not edited.

**`transport-rows.ts` — the two pure things.**

- `transportPhases(mode)` — total over `TRANSPORT_MODES` **imported from `src/components/modules/transports/vocabulary.ts`, never from `src/server/db/schema.ts`**, which would pull Drizzle into the browser bundle; `types.ts:127-133` records that exact boundary for `DAY_NOTE_ICONS`. Returns the `{ departing, travelling, arriving }` triple of message keys. `flight` takes the air triple, `car` takes the hire triple, the other ten take the generic one. Totality is a `{ readonly [K in TransportMode]: … }` mapped type, not a `switch` with a `default`.
- `expandJourneyRows(journey, dayNumbers)` — one journey in, one row per day it covers out, each carrying its phase, its time (departure on the first, arrival on the last, `null` in between) and whether it is the departing row. A single-day journey yields one row with **no** phase label: naming a part only makes sense when there is more than one. A journey with legs yields nothing itself; each leg is expanded in its place.

**Boundary discipline.** `src/components/planner/**` keeps importing nothing from `src/server` or `src/routes`. `transport-row.tsx` composes `Badge` from `src/components/ui` and the existing `modeIcon` glyph from `src/components/modules/transports/mode-icon.ts`, so one journey wears one symbol wherever the reader meets it. No new primitive.

## 📝 Data Model

**No schema change and no migration.** Every column already exists.

| Column                                                                            | Read for                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------- |
| `transports.day_id`, `arrival_day_id`                                             | which days a whole-record journey covers       |
| `transports.mode`, `status`, `service_number`                                     | the glyph, the pill, the ticket line           |
| `transports.departure_name/time`, `arrival_name/time`                             | the endpoints and the two clocks               |
| `transports.sort_order`                                                           | the fractional day position — **written** here |
| `transport_legs.departure_day_id`, `arrival_day_id`                               | which days a leg covers                        |
| `transport_legs.from_name`, `to_name`, `departure/arrival_time`, `service_number` | the leg's own endpoints, clocks and ticket     |
| `transport_legs.position`                                                         | chain order — read, never written here         |
| `transport_legs.sort_order`                                                       | the fractional day position — **written** here |

`position` and `sort_order` stay the two different questions `schema.ts:1177-1181` says they are: `position` is a leg's 0-based index inside its own chain and belongs to `replaceTransportChain`; `sort_order` is where that leg sits among everything else happening on a day and belongs to this stage.

**What changes about `sort_order`'s meaning: nothing.** It was declared as a fractional day-timeline key and is used as one. What changes is that it becomes **read** by the planner, and therefore load-bearing — which is why two existing behaviours are now this stage's business (see Risks): a chain rewrite must stop discarding it, and the transports tab's own list order now follows the board whenever `departure_date` and `departure_time` tie (`listTripTransports`, `transports.ts:146-151`).

**Tenant scoping.** Both tables carry `organization_id NOT NULL` and each leads a composite index with it (`transports_org_trip_idx`, `schema.ts:1144`; `transport_legs_org_trip_idx`, `:1238`). Every statement goes through `createTenantRepository` / `tenantFilter()`, so the tenant column is in the `WHERE` clause of every read and every write. Tenant scoping is not trip visibility, though: a workspace member who is not a member of a private trip passes the tenant filter (ADR 0007, `readableTripFilter`, `trips.ts:268-293`). So the read resolves the trip with `requireTrip` before it reads a row, as `loadPlanBoard` (`-server/plan.ts:184`) and `readDayNotes` (`-server/day-notes.ts:247`) do, and the reorder resolves the trip with `requireTrip` and the day with `requireTripDay` before it writes anything.

**Money is rendered, never written.** Where the record already carries `price_minor` beside its `text(3)` `currency`, the row shows it through `formatMoneyMinor` with `tabular-nums`. This stage performs no conversion and writes no money column.

## 📝 API Contracts

### Repository — `src/server/repos/transports.ts` (edit)

```ts
/** Every journey of the trip, with its legs, for the board to place into days. */
export async function listTripDayTransports(
  scope: TenantScope,
  tripId: string,
): Promise<{
  readonly records: Array<Transport>
  readonly legs: Array<TransportLeg>
}>
```

It resolves the trip with `requireTrip` first — a private trip's journeys are endpoints, times, service numbers and fares, and a workspace member who cannot open the trip gets `NotFoundError`, not an empty list — and only then runs both halves `tenantFilter()`-scoped. The guard lives in the repository function rather than in the loader so no later caller can read the trip's journeys without it. Records ordered by `sort_order` then `id`; legs by `transport_id`, `position`, `id`, so chain order is preserved and the day position is applied by the caller. The **records** half answers every transport of the trip rather than only those naming a day, because a chained journey's day references live on its legs while its mode, status and title live on the record — a read that filtered the parent by `day_id` would draw every leg of an ordinary chain with the generic glyph and no status. The filter belongs to the payload, not to the query.

```ts
/** Places one day's journey rows between the stops and notes the run names. */
export async function reorderDayTransports(
  scope: TenantScope,
  input: {
    readonly tripId: string
    readonly dayId: string
    readonly items: ReadonlyArray<{
      readonly kind: 'stop' | 'note' | 'transport' | 'leg'
      readonly id: string
    }>
  },
): Promise<void>
```

Resolves the trip and the day, then reads the day as it stands through the existing readers — `listDayAssignments` (`repos/itinerary.ts`) and `listDayNotes` (`repos/days.ts`), imported and not edited — plus the journeys that **depart** from it: records with no legs whose `day_id` is this day, and legs whose `departure_day_id` is. It then rebuilds the run the way `reorderDayTimeline` (`repos/itinerary.ts`) rebuilds one: the payload's order for every id the day holds, an id the day does not hold dropped — a tab one delete behind must still be able to reorder the rows that do exist, the rule `-server/plan.ts:334-337` already states over `reorderPlanFn` — and an entry the client omitted spliced back in behind the entry it currently follows — a journey behind a journey the payload moved goes with it. The current run it splices from is sorted by stored position with a journey after the stop or note it ties with, the client's rule, rather than `reorderDayTimeline`'s id tiebreak. Only then does it split each gap by the rule above, so a journey the client left out is counted among the journeys sharing its gap and rewritten with them, rather than kept at a value a recomputed sibling could land on. Every write goes in one `scope.db.batch()`, a real transaction on D1.

**The stop and note ids in that list are resolved against this day's own rows, and never written.** They are the ruler and nothing else: an id the day does not hold is dropped before it can name a gap, so a forged one moves nothing, and a real one placed out of order can only misposition the caller's **own** journey inside the caller's **own** day — an arrangement the caller could have sent directly — which the next reorder heals. Every read is `tenantFilter()`-scoped, so no id from the payload reaches a tenant-crossing lookup. The tenant-isolation block asserts the half that matters: B's journey ids move nothing on either table.

```ts
// replaceTransportChain — one changed line, and the reason it is this stage's
```

`replaceTransportChain` is documented as "**The only writer of `transport_legs`**" (`transports.ts:498`) and rewrites the chain by delete-and-reinsert with `sortOrder: leg.sortOrder ?? index` (`:550`) — the chain index, not the day position. Nothing wrote the chain editor's `sortOrder`, so today that is harmless. From this stage it is not: editing a service number would throw every leg of the journey to the head of its day. The writer carries the previous row's `sort_order` forward by `position` when the caller supplies none **and** the previous row at that position departed from the same day; a leg that is new, or now departs from another day, takes the chain index as it does today, because a fraction measured against one day's ruler means nothing on another's. This stage makes the column load-bearing, so it owns the consequence; the module keeps its single-writer property.

### Server functions — `src/routes/_app/trips/$tripId/-server/plan-transports.ts` (new)

```ts
export interface PlanTransport {
  readonly kind: 'transport' | 'leg'
  readonly id: string
  readonly mode: string // as stored; the renderer's registry falls back
  readonly status: string
  readonly serviceNumber: string | null
  readonly fromName: string | null
  readonly toName: string | null
  readonly departureDayId: string | null
  readonly arrivalDayId: string | null
  readonly departureTime: string | null // HH:MM, as stored
  readonly arrivalTime: string | null
  readonly priceMinor: number | null
  readonly currency: string | null
  /** `sort_order` — the fractional position among the day's stops and notes. */
  readonly position: number
}

export interface PlanTransportsPayload {
  readonly tripId: string
  readonly canWrite: boolean
  readonly transports: ReadonlyArray<PlanTransport>
}

export const loadPlanTransports // GET,  z.object({ tripId })
export const reorderDayTransportsFn // POST, z.object({ tripId, dayId, items })
```

`loadPlanTransports` drops a record that has legs (the legs are its rows) and a record that names no day at all (it lives on the transports tab). `reorderDayTransportsFn` validates `items` as `z.array(z.strictObject({ kind: z.enum(['stop','note','transport','leg']), id })).max(400)`, refined so the stops and notes among them number at most 200 — `reorderPlanFn`'s per-day cap (`-server/plan.ts:305`) counts stops and notes alone, so the follow-up counts them by the same rule and gives the day's journeys their own 200 rather than taking them out of it — refuses an archived trip through the same `writableTrip` shape the sibling modules use, calls the repository, then mirrors one `day` upsert into the trip's room, reaching `#/server/fns/context` **inside the function**, the posture `-server/plan.ts:249-255` records and for the same reason.

### Route — `src/routes/_app/trips/$tripId/plan.tsx` (edit)

One more entry in the loader's existing `Promise.all`, so the third read costs no extra round trip, and one more prop onto `PlanScreen`.

## 📝 UI/UX

- [A day that interleaves a stop, a note and a journey row, light and dark](assets/journey-in-its-day/mockup-01-day-sequence.html)
- [One journey across three days, each labelled by the part that day sees](assets/journey-in-its-day/mockup-02-multi-day-journey.html)

Both are illustrative statics, not app code: dependency-free HTML that opens in any browser, whose colour and type values are copied from `src/styles/tokens.css` so the proportions are honest. Their rendered frames are attached to the spec PR as evidence and are not committed — `.ai/specs/AGENTS.md` keeps PNGs out of this directory. Current-state screenshots of `/trips/$tripId/plan` could not be taken — see the note under Visual change expected.

**The row.** Glyph (the mode's, from the shipped registry), the two endpoints, the time or time range, the service number when there is one, and the status as the pill vocabulary the transports tab already uses. On a multi-day journey a `--text-micro` / `--tracking-label` phase label in `--color-ink-3` sits above the endpoints; on a single-day journey there is none.

**Phases.** A journey covering days _d₁ … dₙ_ renders on each, with `departing` on _d₁_, `arriving` on _dₙ_ and `travelling` on everything between. `n = 1` means no label. The triple is chosen by mode and is total by construction.

**Drag — and the one row that is not draggable.** The `leg:` prefix keeps the id space apart exactly as `idea:` and `note:` do, and the draggable id is **day-qualified** — `leg:{kind}:{dayId}:{id}` — because a journey covering three days is three rows on the board and `@dnd-kit` needs three distinct ids.

Only the **departing** row carries a drag handle. A journey has one `sort_order`, and it belongs to the day the journey leaves. It is not that the server could not tell which days a journey covers: the days between departure and arrival are not named by any column, but they are arithmetic over day numbers the server already resolves — `requireChainDays` (`transports.ts:460-496`) compares exactly those. It is that the number has one ruler. A position written against day 2's stops would overwrite the one the departing row reads against day 1's, and a drag on either day would silently move the journey on the other. The travelling and arriving rows are read-only rows placed on the client and never stored — a `travelling` row, which has no time, ahead of the day's stops and notes; an `arriving` row by its arrival time, behind them (see _A journey's `sort_order` belongs to its departure day_ above) — and the journey's position in the day is edited where it is meaningful. A reader who wants the journey on a different day changes its dates on the Transports tab — the same place they already set them.

Three refusals for the departing row, all reusing rules that exist:

- **Into the ideas column: `'not-in-ideas'`.** The ideas column is the trip's unscheduled _place_ inventory; a journey has no meaning in it. One clause added to the guard `movePlanItem` already applies to notes.
- **Into another day: `'not-in-another-day'`.** A journey's day is its departure and arrival dates' to say. The same screen-owned rule in `plan-move.ts` that refuses a note, widened by one clause.
- **Out of clock order: `'timed'`, and it stays a refusal.** A journey takes part in `movePlanItem`'s clock rule with no change to the rule. The existing "move this and drop its 14:05?" dialog is **not** offered — a departure time belongs to a timetable, not to the board — so the refusal is reported as one.

**All three say so in words, and the words are new.** `refusalCopy` (`plan-move.ts:180-202`) today maps a reason to copy written about a _note_ — "A note stays on its own day. Notes cannot be moved between days yet." Showing that to someone who dragged a Shinkansen is worse than showing nothing, so it takes a second, **required** argument, the draggable id, and answers from the journey's own sentences for a `leg:` id. Required rather than optional so no caller can forget it and show a note's sentence for a journey: its one caller, `plan-screen.tsx`, already holds the id, and the one-argument calls in `-ui/__tests__/plan-move.test.ts` change with it. `'timed'` gains copy at all: it has none today, because until now it was never a refusal a reader saw (the docblock at `:178` says exactly that), and a journey refused silently would snap back with no toast and nothing spoken.

**States.**

- _Empty_ — unchanged: a day with nothing on it keeps `01-S4`'s dashed drop target.
- _Skeleton_ — unchanged: the day-section skeleton covers the cold load.
- _Pending_ — a row with a write in flight takes the `pendingItemIds` treatment `DaySection` already applies, keyed by the same day-qualified id.
- _Error_ — a refused move never mutates the board and says why in a toast and out loud; a failed write rolls the optimistic order back, through the same `runMove` path every other row uses, and rolls back both halves of the split write.
- _Every control_ — rest, hover, focus-visible, active, disabled and loading on the row and its drag handle, and keyboard-draggable through the same `src/lib/dnd-keyboard.ts` path the stop rows use.

**Motion, tokens, contrast.** The day section's existing stagger; `--color-surface` inside the day's `--color-surface-2` with a `--color-edge-faint` hairline; times on `tabular-nums`. Every pair is one the planner already checks at AA in both themes. No new token.

**Accessibility.** The row's accessible name is the journey said in words — "Tokyo to Kyoto" — so the drag announcements `usePlanDnd` already composes name a journey the way they name a stop. `plan-dnd.ts` gains one lookup map for that, beside `notesByItem`. The travelling and arriving rows are not focusable as draggables and carry their phase in their accessible name, so a reader hears "In the air, Tokyo to Kyoto" rather than an unexplained repeat.

## 📝 Visual change expected

| Route                 | State                                                             | Themes       | Widths            |
| --------------------- | ----------------------------------------------------------------- | ------------ | ----------------- |
| `/trips/$tripId/plan` | A day whose sequence interleaves a stop, a note and a journey row | light + dark | 360 / 1280 / 2560 |
| `/trips/$tripId/plan` | The departing journey row hovered, drag handle showing            | light + dark | 1280              |
| `/trips/$tripId/plan` | A multi-day journey, the phase label on each of its days          | light + dark | 1280              |

Judged by the blind A/B pair (`scripts/visual/capture.mjs`), which docs/SPEC.md §7.4 makes the whole of the visual judgement since ADR 0016. The declared state is the first row — an interleaved day is the point of the change and is not visible at rest. No other route changes.

**Current-state screenshots were not captured, and the reason is environmental rather than a judgement.** `.ai/scripts/test-env-up.sh` binds a port from 3030-3040 only, because `playwright.config.ts` refuses anything else outside CI so an automated run can never photograph another checkout's app; at the time of writing all eleven ports were held by other worktrees' dev servers, and killing another session's server is not this run's to do. The two mockups above are therefore the whole of this spec's visual evidence. Nothing about the design depends on that gap: the "before" is a planner rail with no journey row in it, which is exactly the Problem Statement.

## 📝 Copy

Nineteen new keys, in the `trips` namespace beside `trips.plan.*`, landing in all 23 locales in the same change (docs/SPEC.md §9, procedure in the `i18n-messages` skill).

The nine phase labels:

| Key                                             | `en`       |
| ----------------------------------------------- | ---------- |
| `trips.plan.transport.phase.flight.departing`   | Departs    |
| `trips.plan.transport.phase.flight.travelling`  | In the air |
| `trips.plan.transport.phase.flight.arriving`    | Lands      |
| `trips.plan.transport.phase.hire.departing`     | Pick-up    |
| `trips.plan.transport.phase.hire.travelling`    | On hire    |
| `trips.plan.transport.phase.hire.arriving`      | Drop-off   |
| `trips.plan.transport.phase.journey.departing`  | Starts     |
| `trips.plan.transport.phase.journey.travelling` | Under way  |
| `trips.plan.transport.phase.journey.arriving`   | Ends       |

The row's name, and the three refusals said in the journey's own words rather than the note's:

| Key                                                  | `en`                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `trips.plan.transport.label`                         | {from} to {to}                                                                                |
| `trips.plan.move.refused.journeyNotInIdeas`          | A journey stays in the day                                                                    |
| `trips.plan.move.refused.journeyNotInIdeasBody`      | Ideas are places waiting for a day. A journey belongs to the day it happens on.               |
| `trips.plan.move.refused.journeyNotInAnotherDay`     | A journey stays on its own day                                                                |
| `trips.plan.move.refused.journeyNotInAnotherDayBody` | A journey's day comes from its dates. Change them on the Transports tab.                      |
| `trips.plan.move.refused.journeyTimed`               | {name} leaves at {time}                                                                       |
| `trips.plan.move.refused.journeyTimedBody`           | A departure time is the timetable's, not the plan's. Put the journey where its clock belongs. |
| `trips.plan.move.spoken.journeyNotInIdeas`           | {name} was not moved. A journey stays in the day.                                             |
| `trips.plan.move.spoken.journeyNotInAnotherDay`      | {name} was not moved. A journey stays on its own day.                                         |
| `trips.plan.move.spoken.journeyTimed`                | {name} was not moved. It leaves at {time}.                                                    |

Mode names (`modules.transports.mode.*`) and status names (`modules.transports.status.*`) are reused as they stand; this spec adds none, and changes none of the note's six existing refusal sentences.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                     | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A stay covering the day                                                                  | No row. The stay is the day header's, in `03-S8b` (#180).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| A journey with no day at all                                                             | Not on the board. It stays on the Transports tab, which is where a day is given to it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A chained journey whose record names no day but whose legs do                            | The ordinary shape, not the exotic one — nothing that writes a chain writes the parent's `day_id`. The legs render, carrying the parent's mode, status and title; the parent does not.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A chained journey whose record _also_ names a day                                        | The record is still dropped. A journey drawn as its legs is never also drawn whole; there is no spanning row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| A leg whose departure and arrival days differ                                            | Expanded like any multi-day journey, over the days it covers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| A stop moved on a journey's arrival day, or a day between                                | Nothing is written to the journey. Its `sort_order` belongs to its departure day, and the rows it shows elsewhere are placed on the client: `travelling` ahead of the day's stops and notes, `arriving` by its arrival time behind them, or ahead when it has none.                                                                                                                                                                                                                                                                                                                                                          |
| A record with an arrival day and no departure day                                        | One row, on its arrival day, placed as an `arriving` row and never draggable: `requireDayPair` allows the shape, and with no departure day its `sort_order` has no ruler to be measured against, so no reorder ever writes it.                                                                                                                                                                                                                                                                                                                                                                                               |
| A journey no restatement has placed yet — every journey on disk today, and every new one | `transports.sort_order` holds its default `0` and a leg its chain index (`sortOrder: leg.sortOrder ?? index`), integers that can equal a stop's position; `createTransport` writes the same default, a new or re-dayed leg takes its chain index, and a record whose `day_id` an edit changes keeps a number measured against its old day. Read as it stands: its departure time places it (bound 2), a tie with a stop or note sharing its number puts the journey after that row, and the first write that restates its departure day gives it a place between two neighbours. No backfill — the stage takes no migration. |
| A journey arriving on a day _before_ it departs                                          | `requireChainDays` (`transports.ts:460-496`) already refuses to write it. A row that reaches the client anyway expands to the departure day alone rather than to an empty range.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| A mode the registry does not know                                                        | The generic glyph (`modeIcon`'s fallback, `mode-icon.ts:41`) and the generic phase triple. The read never narrows a stored string to the enum.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A reorder naming ids from another tenant                                                 | Dropped as unknown; nothing on either table moves. Asserted in the tenant-isolation block.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A reorder whose write fails                                                              | The optimistic order rolls back and a toast says so. When the primary write succeeded and the journey follow-up failed, both are rolled back on the client and the next successful drag heals the day.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A stop dragged, scheduled, unscheduled or deleted on a day holding a journey             | `journeyWrites` restates the journeys departing from that day in the same `applyChange` (or the same delete handler), so each keeps its place relative to the rows around it. A drag renumbers the day and a schedule inserts a stop among stops alone, so without the restatement the journey would drift across a neighbour; an unschedule or a delete leaves a gap the stored fraction already sits in, and restating it there changes its value but not its neighbours.                                                                                                                                                  |
| A place dropped into the gap between a stop and a journey                                | `schedulePlaceFn` positions the new stop among stops alone (`indexBetween`, `-server/plan.ts:413-425`) and cannot see the journey. The follow-up restates the journey against the resulting run — with the new stop named by the `assignmentId` the write returned, not its `idea:` id — which is what puts it back on the side it was dropped on.                                                                                                                                                                                                                                                                           |
| A chain edited on the Transports tab                                                     | The legs keep their day positions: `replaceTransportChain` carries the previous `sort_order` forward by `position` while the leg still departs from the same day. Without that one change, renaming a service number would throw the journey to the head of its day.                                                                                                                                                                                                                                                                                                                                                         |
| Two journeys in the same gap                                                             | Split `(j+1)/(m+1)` of the way across the gap between their neighbours, so their order is stored rather than left to a tie-break, and it is the order the client sent. A journey the payload omitted is spliced back in behind the entry it currently follows before any gap is split, and counted in the `m` of the gap it lands in, so every journey sharing a gap is rewritten together and none can land on a sibling's value.                                                                                                                                                                                           |
| A day deleted while a journey names it as its arrival day                                | Fails at D1 today, and this stage does not change that: `transports.arrival_day_id` carries `NO ACTION` on the deployed database because SQLite's `ADD COLUMN` takes no `ON DELETE` clause (`schema.ts:1103-1111`). Pre-existing, reported rather than fixed — this stage reads the column and does not write it.                                                                                                                                                                                                                                                                                                            |
| A day with more than 200 stops and notes, or more than 200 journeys                      | More than 200 stops and notes: `reorderPlanFn` rejects the primary write first, the client shows the save-failed toast and rolls back, and no follow-up is issued — today's behaviour. More than 200 journeys departing one day: the primary write succeeds and the follow-up is rejected, which is the split-write failure above — both halves roll back on the client. The two validators count stops and notes by one rule, so a day `reorderPlanFn` accepts is never refused for its journeys below that second bound.                                                                                                   |
| The Transports tab's own list order                                                      | Now follows the board for two journeys whose `departure_date` and `departure_time` tie, because `listTripTransports` breaks that tie on `sort_order`. A tab that lists journeys in the order the day shows them is the better of the two answers; recorded because it is a visible change nobody asked for.                                                                                                                                                                                                                                                                                                                  |

## 📝 Risks & Impact Review

**Blast radius.** Three shared planner files are edited and each edit is additive: one union variant (`types.ts`), one id space plus one clause of one guard (`ordering.ts`), one `switch` branch (`day-section.tsx`). A caller that has no journeys produces no `leg:` ids, so every existing path behaves exactly as it does today — which is what the existing ordering, drag and rails tests assert, unchanged.

**Backward compatibility** (`BACKWARD_COMPATIBILITY.md`): no D1 schema change, no migration, no change to any existing server-function input or to any `server/public` projection, no route added or moved, no queue or Durable Object shape changed. The two new server functions are additive. `transports.sort_order` and `transport_legs.sort_order` keep the meaning their own docblocks give them; what changes is that a second reader now depends on them. A rollback to the previous Worker reads a `real` column holding a finite number, which is what `sortOrderSchema` has always allowed, and renders the board it already knows.

**The one behaviour change outside the board**, and it is deliberate: `replaceTransportChain` stops discarding a leg's day position on a chain rewrite. No caller passes `sortOrder` today, so no current write changes its result; what changes is that a rewrite preserves a value the planner now depends on.

**Rollback.** Revert the PR. Nothing to un-migrate, no stored row left in a shape the previous code cannot read.

**The residual, stated where a reviewer meets it.** A day's number line is written by two server functions rather than one, and neither is atomic with the other; the four bounds above are what makes that survivable, and `journeyWrites` is what keeps it from being an invariant enforced only by prose. The better end state — one batch over one number line inside `reorderDayTimeline` — remains a **deletion** rather than a redesign on the day a wave exists in which this plan may hold `src/server/repos/itinerary.ts`: `reorderDayTransports`, `journeyWrites` and the second server function all disappear into the existing batch.

## 📝 Owned paths, and the eight this spec adds

From the ticket, unchanged: `src/components/planner/{types.ts, ordering.ts, plan-dnd.ts, day-section.tsx, transport-row.tsx (new), index.ts}`, `src/components/planner/__tests__/{ordering.test.ts, transport-rows.test.ts (new)}`, `src/routes/_app/trips/$tripId/-server/plan-transports.ts` (new), `src/routes/_app/trips/$tripId/-ui/plan-transport-model.ts` (new), `src/routes/_app/trips/$tripId/{plan.tsx, -ui/plan-screen.tsx}`, `src/server/repos/transports.ts`, `src/server/repos/__tests__/tenant-isolation.test.ts`, `e2e/journeys.spec.ts` (in place of the frozen plan's `e2e/reservations-and-transport.visual.spec.ts` and its screenshot directory, both retired by ADR 0016), plus the 23 locale files under `src/lib/i18n/messages/`.

Eight paths are added, each measured against the frozen plan set (`grep -rn <path> docs/plans/`) rather than assumed free:

| Path                                                                             | Why, and who else claims it                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/planner/transport-rows.ts` (new)                                 | The phase vocabulary and the expansion — the module the ticket's own owned test file, `transport-rows.test.ts`, is named for. Claimed by no stage; it does not exist.                                                                                                                           |
| `src/components/planner/drag-preview.tsx` (edit)                                 | One variant of a union that is already a union. Claimed by `01-S2` (wave 1) and `01-S4` (wave 2), both merged.                                                                                                                                                                                  |
| `src/routes/_app/trips/$tripId/-ui/plan-move.ts` (edit)                          | The refusals and their copy belong in the module whose docblock says the whole drag policy is one function. Created by #404, after the plan froze; claimed by no stage.                                                                                                                         |
| `src/components/planner/__tests__/rails.test.tsx` (append)                       | `DaySection` grows a branch and must be asserted where its branches are asserted. Claimed by `01-S2` and `01-S4` (merged) and `01-S9` (wave 5, above this one).                                                                                                                                 |
| `src/routes/_app/trips/$tripId/-ui/__tests__/plan-transport-model.test.ts` (new) | The route-local model's own seam; a test under `src/components/**` may not import a route module. Claimed by no stage.                                                                                                                                                                          |
| `src/components/planner/__tests__/transport-row.test.tsx` (new)                  | The renderer's rendering cases are JSX, and every rendering test in this directory is a `.tsx` file; `transport-rows.test.ts` stays the pure arithmetic's. Claimed by no stage; it does not exist.                                                                                              |
| `src/routes/_app/trips/$tripId/-ui/__tests__/plan-move.test.ts` (edit)           | `refusalCopy` takes the draggable id as a **required** second argument, so its existing one-argument calls here change with it, and Step 15's refusal cases land beside them. Created by #404, after the plan froze; claimed by no stage.                                                       |
| `src/server/repos/__tests__/member-isolation.test.ts` (append)                   | `listTripDayTransports` and `reorderDayTransports` are new trip-scoped repository functions, and the file's header asks each for a case under its append-only rule. Claimed by `01-S1` (which created it) and `01-S6`, each for one appended `describe` — the same terms this stage appends on. |

Untouched, as the ticket requires: `src/server/repos/itinerary.ts`, `src/server/repos/days.ts`, `src/routes/_app/trips/$tripId/-server/plan.ts`, `src/routes/_app/trips/$tripId/-ui/plan-model.ts`.

## 📝 Resolved assumptions (autonomous defaults)

`om-spec-writing --autonomous` resolved these, and an adversarial fresh-context review falsified the first draft's answer to Q1 against the tree before this one was written. Each is reversible; say the word on the spec PR and the answer changes before anything is built.

| #   | Question                                                                                                                                                       | Answer                                                                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | How does a journey take its place on a number line renumbered by a writer this stage may not touch?                                                            | The **fractional key the column was declared to be**, derived server-side, restated by one pure function at two tested call sites.              | The first draft answered "an integer gap index, stable under renumbering, so no restating writer is needed". That is false: on a day of three untimed stops with a journey at gap 1, dragging the third stop to the top moves the journey from after the first stop to before it. It also contradicts `schema.ts:161` and `:1177-1181`, which declare the column a fractional day-timeline key. Restating is the cost of not owning `itinerary.ts`, and the frozen plan says so.                                                                                                                                 |
| Q2  | Is a journey draggable on every day it covers, or only on the day it departs?                                                                                  | **Only the departing row.**                                                                                                                     | A journey has one `sort_order`, and a number on a day's line has one ruler: the departure day's stops and notes. The server could tell that day 2 of 3 is one of the journey's days — `requireChainDays` already compares day numbers — but a position written on day 2 would overwrite the one day 1 reads, so a drag on either day would move the journey on the other. The other rows are placed on the client — `travelling` ahead of the day's entries, `arriving` by its arrival time behind them — and never stored. Smallest surface, one ruler per number, and no mirror problem on the untouched days. |
| Q3  | A journey refused into the ideas column or into another day — reuse the note's copy, or write the journey's own?                                               | **Its own**, six new keys.                                                                                                                      | The shipped sentences say "A note stays on its own day. Notes cannot be moved between days yet." Reusing them shows a reader who dragged a Shinkansen a paragraph about notes, in 23 languages. The refusal _reasons_ are still reused; only the words are new.                                                                                                                                                                                                                                                                                                                                                  |
| Q4  | Does `'timed'` offer the "drop its time?" dialog for a journey, as it does for a stop and a note?                                                              | **No** — it stays a refusal, and gains the copy it has never had.                                                                               | A departure time belongs to a timetable; clearing it from a drag would silently rewrite a booked fact. `refusalCopy` has no `'timed'` case today because the reason has always become the dialog, so without new copy a refused journey would snap back in silence. Offering the dialog later is additive.                                                                                                                                                                                                                                                                                                       |
| Q5  | Where do the phase vocabulary and the expansion live, given the ticket owns `transport-row.tsx` (singular) and a test named `transport-rows.test.ts` (plural)? | **A new `transport-rows.ts`** beside the renderer, plus seven other paths, all listed and measured above.                                       | The owned test file names it. Every added path was checked against the frozen plan set: none is claimed by an unmerged stage, so nothing a sibling holds is disturbed.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Q6  | What is the browser evidence, given ADR 0016 retired the screenshot comparison?                                                                                | **The blind A/B pair** (`scripts/visual/capture.mjs`) on the three declared states, **plus** one e2e block asserting the loader-to-screen path. | ADR 0016 retired the pixel diff and made the A/B critic the whole of the visual judgement — docs/SPEC.md §7.4 — it did not remove the requirement. The e2e block covers what no jsdom test reaches: route loader, server function, hydration, silent console.                                                                                                                                                                                                                                                                                                                                                    |
| Q7  | Is this one independently deployable capability, or should "see the journey" and "drag the journey" be two specs?                                              | **One**, on §8 grounds.                                                                                                                         | `sort_order`'s becoming a read column is a concept, not a file: shipping the render alone would place journeys by a number nothing maintains, and the writer would then change how every existing day reads. Half of this cannot land and leave the repository self-consistent, which is §8's test verbatim.                                                                                                                                                                                                                                                                                                     |

## 📋 Phasing

**Phase 1 — The day can be asked what it carries.** The repository read and write, the chain-rewrite fix, the tenant-isolation block, and the two server functions. Shippable and inert: nothing calls them yet, and the board is unchanged.

**Phase 2 — The board has a shape for a journey.** The union variant, the `leg:` id space, the pure arithmetic, the renderer and the copy. Shippable and inert: nothing produces a `leg:` id yet.

**Phase 3 — The board draws it.** The route loader, the route-local model, the restating writer, the screen wiring, the refusals, and the e2e block. The capability lands here.

Each phase leaves the validation gate green and leaves the planner behaving exactly as it does today until Phase 3's final step.

## 📋 Implementation Plan

### Phase 1 — The day can be asked what it carries

1. **`listTripDayTransports` in `src/server/repos/transports.ts`.** `requireTrip`, then two `tenantFilter()`-scoped reads: records by `sort_order`, `id`; legs by `transport_id`, `position`, `id`. The records half is unfiltered by day and its docblock says why. _Verify:_ `pnpm typecheck`, plus a repository case asserting a chained journey whose record names no day still returns the record for its legs' lookup.
2. **`reorderDayTransports` in the same module.** `requireTrip` → `requireTripDay` → read the day's stops, notes and the journeys departing from it → rebuild the run (unknown ids dropped, omitted entries spliced back behind the entry they follow) → split each gap between its neighbours' stored positions, `a + (j + 1) × (b − a) / (m + 1)` → one `scope.db.batch()`. _Verify:_ repository cases on a seeded day — a journey between two stops lands strictly between their stored positions; a journey ahead of everything lands below 0; two journeys in one gap land in the order sent and neither collides with an integer; an id belonging to another day is dropped and nothing moves; a journey behind a stop scheduled at a midpoint, and behind a stop left alone by an unschedule's gap, lands strictly between its stored neighbours; a journey the payload omitted is spliced back behind the entry it follows and ties with no sibling rewritten beside it; a journey tied with a stop in the stored run is rebuilt after that stop; a journey that only arrives on the day is not written.
3. **`replaceTransportChain` carries `sort_order` forward** by `position` when the caller supplies none and the leg at that position still departs from the same day. Identity by `position` is a heuristic — a station inserted mid-chain hands a leg its neighbour's fraction — and what it mis-carries, the next restatement of that day re-places. _Verify:_ a case asserting that rewriting a chain's service numbers leaves every leg's `sort_order` unchanged, that a leg whose departure day changed takes its chain index, and that an explicit `sortOrder` still wins.
4. **The tenant-isolation and member-isolation blocks**, one `describe` appended to each. `tenant-isolation.test.ts`: A listing B's day transports by trip id is a `NotFoundError` from `requireTrip`; A reordering a day of B's trip is a `NotFoundError` from `requireTripDay` and not an empty success; A passing B's transport ids **and** B's leg ids inside a reorder of A's own day moves nothing — B's `sort_order` re-read on both tables afterwards and identical. `member-isolation.test.ts`, whose header asks every new trip-scoped reader for a case: `alpha-2`, a workspace member who is not a member of the trip, listing a private trip's day transports or reordering one of its days gets `NotFoundError`. _Verify:_ `pnpm exec vitest run src/server/repos/__tests__/tenant-isolation.test.ts src/server/repos/__tests__/member-isolation.test.ts`.
5. **`src/routes/_app/trips/$tripId/-server/plan-transports.ts`** — the payload types, `loadPlanTransports` (drops a record that has legs and a record that names no day), and `reorderDayTransportsFn` with its Zod validator, its `writableTrip` guard and its room mirror reached inside the function. _Verify:_ `pnpm typecheck`, `pnpm lint`, and validator cases: a run with 201 stops and notes is rejected, a run with 200 stops and notes plus journeys is accepted, an unknown `kind` is rejected, a well-formed run is accepted.

### Phase 2 — The board has a shape for a journey

6. **`PlannerTransport` and the third variant** in `src/components/planner/types.ts`, the doc comment updated to record that the extension point was used as written. _Verify:_ `pnpm typecheck`; the existing planner tests still pass untouched.
7. **The `leg:` id space** in `src/components/planner/ordering.ts` — `LEG_PREFIX`, `legItemId(kind, dayId, id)`, `isLegItemId`, `legRefOfLegItem` — plus the one clause widening `'not-in-ideas'`. _Verify:_ cases appended to `__tests__/ordering.test.ts`: the prefix round-trips for both kinds including a day id containing no separator ambiguity, a journey dropped into the ideas column is refused with `'not-in-ideas'`, and a place scheduled between two stops on a day holding `leg:` ids carries the index it would have without them.
8. **`src/components/planner/transport-rows.ts`** — `transportPhases(mode)` over `TRANSPORT_MODES` from `modules/transports/vocabulary.ts`, and `expandJourneyRows(journey, dayNumbers)`. _Verify:_ `__tests__/transport-rows.test.ts` (new): the vocabulary is total over `TRANSPORT_MODES` and picks the air triple for a flight, the hire triple for a hire car and the generic triple for the other ten; a three-day journey produces exactly three rows carrying the first, middle and last labels and only the first marked departing; a single-day journey produces one row with no label; a four-leg journey produces four rows and no spanning row; a stay produces none; a journey arriving before it departs produces one row.
9. **`src/components/planner/transport-row.tsx`** — the renderer, composing `Badge`, the shipped `modeIcon` glyph and `formatMoneyMinor`, with `data-part="planner-transport-row"`, the full state set, and a drag handle only when the row is the departing one. _Verify:_ `__tests__/transport-row.test.tsx` (new) — a rendering test is JSX and lives in a `.tsx` file, as `rails.test.tsx` and `keyboard-drag.test.tsx` do, while `transport-rows.test.ts` stays the pure arithmetic's: a departing row exposes a drag handle, a travelling row does not and carries its phase in its accessible name.
10. **The nineteen locale keys**, in `en` first and then all 23, per the `i18n-messages` skill. _Verify:_ the i18n parity test in `pnpm test`.
11. **`day-section.tsx` grows the third branch**, `drag-preview.tsx` the third variant, `index.ts` the new exports. _Verify:_ cases appended to `__tests__/rails.test.tsx` — a day whose items interleave a stop, a note and a journey renders all three in the order given, and the stop numerals still count places alone.

### Phase 3 — The board draws it

12. **`src/routes/_app/trips/$tripId/-ui/plan-transport-model.ts`** — `transportRowsOf(payload, days)`, `withTransports(order, rows)`, `withTransportItems(model, order, index)`, `timeOfTransports(rows)`, and `journeyWrites(order, dayIds)`. _Verify:_ `__tests__/plan-transport-model.test.ts` (new): a journey is threaded into the gap its fraction names; one below 0 sits ahead of every stop; one past the last stop sits last; two in one gap keep their stored order; a journey whose stored value equals a stop's position follows that stop; a `travelling` row sits ahead of the day's stops and an `arriving` row is placed by its arrival time; a day with journeys and no stops and a day with stops and no journeys both render; `journeyWrites` emits a payload for a journey's departure day and none for its arrival day; and — **the case that measures the design** — after a day's stops are renumbered by a simulated `reorderPlanFn`, `journeyWrites` produces the payload that restores the journey to the same neighbours it had before.
13. **`plan.tsx` loads the third read** in the existing `Promise.all` and hands it to `PlanScreen`. _Verify:_ `pnpm typecheck`, `pnpm build`, and the e2e block in step 16.
14. **`plan-screen.tsx` wires it** — the order and model wrappers, the time index, the journey name lookup for `plan-dnd.ts`, the `reorderDayTransportsFn` branch of `applyChange` selected by `isLegItemId`, and the `journeyWrites` follow-up at its two call sites (`applyChange` and the delete handler), rolled back together with the primary write; a schedule substitutes the returned `assignmentId` for the `idea:` id before the follow-up reads the order. _Verify:_ `pnpm typecheck`, `pnpm lint`, `pnpm test`.
15. **`plan-move.ts` takes the refusals and their words** — a journey refused into another day as `'not-in-another-day'`, `'timed'` returned as a refusal rather than as `ask-drop-time` for a `leg:` id, `refusalCopy` answering from the journey's sentences for a `leg:` id and the note's for a `note:` id, and `reorderPayload` dropping `leg:` ids. _Verify:_ cases in the plan-move tests: each of the three refusals returns copy rather than `null`, a note's copy is unchanged, a reorder of a day holding a journey sends `reorderPlanFn` its stops and notes alone, and a timed journey out of clock order is refused with `'timed'` and offers no dialog.
16. **The e2e block**, appended to `e2e/journeys.spec.ts`: open `/trips/<demo>/plan`, find the day that holds a stop, a note and a journey, assert the three render in the order the loader gives them, assert the journey's accessible name resolves, and assert a silent console. _Verify:_ `bash .ai/scripts/e2e.sh e2e/journeys.spec.ts`.
17. **The blind A/B pair** on the three declared states, per docs/SPEC.md §7.4 and the `verifying-changes` skill. _Verify:_ `scripts/visual/capture.mjs` at 360, 1280 and 2560 in both themes, with the critic's verdict attached to the PR.
18. **The full gate**, in order: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh`. _Verify:_ every command green, nothing skipped or waived.
