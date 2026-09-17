# Reservations and transport, what remains: a stay that covers its nights, and the day that says where you sleep

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #167  |
| **Spec PR**        | none  |
| **Implementation** | none  |

PRD #167 · `docs/plans/03-reservations-and-transport.md` (frozen) · the **two stage issues of wave 6
that have not shipped**: `03-S8a` (#179) and `03-S8b` (#180), the two halves of stage `03-S8`, row
`BKG-05`.

This spec is written at the PRD's own altitude and is **not** a fourteenth stage. Eleven of the
thirteen stage tickets under #167 are closed and their work is on `develop`; what is left is one
stage, split across two tickets for file contention rather than for concept. The per-stage detail —
owned paths, statement-by-statement server work, frame lists — stays in the frozen plan and in the
two tickets. Each phase below is one stage issue, built on its own pull request.

## 📝 TLDR

`day_accommodations` is a complete table. It carries the day range, the check-in window, the
check-out time, the confirmation number and the price, it has a full repository beside it, and the
column that links it to the booking that paid for it shipped with `00-S9` (#177). **Nothing in the
product writes one.** `createAccommodation` is reached from the development seeder and from the
tenant-isolation test, and from nowhere else; `updateAccommodation`, `deleteAccommodation` and
`countAccommodationNights` have no caller anywhere in `src/` outside their own module.

So a traveller cannot say where they are sleeping. The planner's day header already has a badge row
for a stay — it renders the property's **name** and nothing else — and the trip has no way to put a
stay into it.

Two phases close that. **Phase 1** (`03-S8a`, #179) gives the stay a write path: the two validator
lines that let the booking link through, the reference guard beside them, the role guard the other
two repositories in this area already carry, and one dialog branch that records a run of nights and
the booking that paid for them as one action. **Phase 2** (`03-S8b`, #180) puts it on the board:
the day header says _check in_, the property's name, _check out_; the day panel opens the same
dialog with that day pre-selected; and the import's confirm creates the stay a hotel confirmation
names.

The design turns out smaller than the ticket text implies, because two things the frozen plan asked
for already exist and were measured rather than assumed: the board's read needs **no new repository
work** (`getTripItinerary` already spreads every accommodation across every day it covers, and
`-server/plan.ts:238` throws the record away), and the badge row's chrome is already on screen.

## 📝 Problem Statement

**Who has it.** Anyone who books a hotel. Lodging is the single largest line in most trip budgets
and the one commitment that shapes every other day — and it is the one thing this product's plan
board cannot be told about.

**The evidence, measured in the tree at `dc909a80`.** (Source files are byte-identical to
`521d329b`; the three files that differ between them are spec metadata.)

- **The table is complete and unwritten.** `src/server/db/schema.ts:1078-1123` declares
  `day_accommodations` with `start_day_id`, `end_day_id`, `check_in_time`, `check_in_end_time`,
  `check_out_time`, `confirmation_number`, `price_minor`, `currency`, `notes`, `place_id` — and
  `reservation_id` at `:1101`, `ON DELETE SET NULL`, indexed at `:1120`. The column that `03-S8`'s
  whole design rests on **shipped two waves ago** with `00-S9` (#177).
- **The repository is complete and unreachable.** `createAccommodation`
  (`src/server/repos/itinerary.ts:590`), `updateAccommodation` (`:607`), `deleteAccommodation`
  (`:633`), `listTripAccommodations` (`:201`) and `countAccommodationNights` (`:641`) are all
  written and all `tenantFilter()`-scoped. Grepping `src/` for the four writers returns the
  development seeder (`src/routes/api/dev/-seed/apply-trip.ts:288`) and
  `src/server/repos/__tests__/tenant-isolation.test.ts`. **`updateAccommodation`,
  `deleteAccommodation` and `countAccommodationNights` have zero callers of any kind.**
- **The link cannot be written even by a caller that tries.** `createAccommodationInput`
  (`:128-142`) and `updateAccommodationInput` (`:145-159`) are `z.object`s and neither carries
  `reservationId`. An unknown key handed to a `z.object` is **silently stripped**, so a co-created
  stay would be inserted with a null link, no error raised anywhere, and every test that checked the
  return value passing. This is PRD decision 26 in its exact predicted form.
- **A viewer can write a stay.** None of the three writers calls `assertTripRole`, though the symbol
  is imported into that very module at `:30` and used at `:470`. `requireTrip` proves membership;
  membership is not a role. `03-S2` put the guard into the transports repository and `03-S4` into
  the reservations repository — this is the third and last of the three, and the only one still
  open. `deleteAccommodation` is the sharper case: it calls `requireRemove` alone and does not
  resolve the trip at all.
- **The board truncates a record it already holds.** `getTripItinerary`
  (`src/server/repos/itinerary.ts:235`) reads `listTripAccommodations` in its existing
  `Promise.all` (`:244`) and spreads each stay across every day between its two day numbers
  (`:292-301`). `-server/plan.ts:238` then reduces the whole record to
  `entry.accommodations.map((stay) => stay.name)`, typed `ReadonlyArray<string>` at `:143` and
  carried as such into `PlannerDay.stays` (`src/components/planner/types.ts:103`) via
  `plan-model.ts:320`.
- **The badge row already exists.** `src/components/planner/day-section.tsx:173-185` renders one
  pill per covering stay — a `BedDouble` glyph on `bg-info-soft` with `text-info` — and can say
  nothing but the name. It is also keyed `key={stay}`, on the name, so two stays of the same name
  covering one day collide in React's reconciler.
- **The import knows it is looking at a hotel and writes half of it.**
  `src/server/fns/booking-import.ts:752` already branches on `draft.type === 'accommodation'` to
  resolve a place through the geocoding proxy. It then writes a reservation and stops. A hotel
  confirmation names nights, and nights are a stay.
- **There is no entry point from the day.** `plan-screen.tsx` offers **Add a place** (`:1437`) and
  nothing else. A reader looking at Friday and thinking about where they sleep on Friday has to
  leave the board.

**What it costs, stated as the failure.** The product tells a traveller what they are doing at 09:00
and cannot tell them where they are sleeping that night — while holding, in the row it just read,
the check-in time, the confirmation number and the price. And the gap is not only a surface: for as
long as the write path does not exist, the role guard does not exist either, so the one place in
this area where a viewer can still write is the one nobody can reach yet. Building the surface
without the guard would ship the hole rather than close it.

## 📝 Proposed Solution

**Two phases, two stage issues, two pull requests.** The order is a dependency order: Phase 2
consumes the write path Phase 1 builds, from two callers. Nothing here reorders them, and Phase 1
ships a complete, usable capability on its own.

**Four decisions, fixed once here, binding on both.**

1. **The stay's writes live in `src/server/fns/stays.ts`, not in a route-local `-server/` module.**
   This is the one place this spec departs from the frozen plan's owned-paths list, and it is
   measured rather than preferred. Every server reach from `src/components/modules/book/**` today
   goes through `#/server/fns/**` — ten call sites across five files, zero exceptions — and exactly
   one file in the whole of `src/components/` imports `#/routes/` at all
   (`atlas/country-search.tsx`). The stay dialog is a `components/modules/book` component and the
   day panel is a route module, so the write path has **two first-class callers in different trees**
   from Phase 2 onward; a route-private module serving a shared component would make the shared
   component depend on one route's private directory. `fns/reservations.ts` is already what
   `booking-dialog.tsx` imports, and `fns/stays.ts` sits beside it.

2. **No repository function is added, and the board gets no new read.** `createAccommodation` and
   its three siblings are called, not re-minted — a second `createAccommodation` beside a working
   one is a defect, not a plan. And because `getTripItinerary` already spreads every stay across
   every day it covers, Phase 2's board work is **widening a projection**, not adding a query:
   `-server/plan.ts:238` stops calling `.name` on a record it already has. The board costs zero
   additional D1 reads.

3. **A stay is on the day's header and never in the day's sequence.** One fact, one representation.
   `03-S5` shipped the transport row into `PlannerItem` and states this rule from the other side —
   its own Edge Cases table says "A stay covering the day → No row. The stay is the day header's, in
   `03-S8b` (#180)". Phase 2 honours that and adds no union variant, no id prefix and no ordering
   rule.

4. **Nights are the difference between two day numbers, and no per-night figure is ever derived.**
   `countAccommodationNights` already encodes the rule — `Math.max(end - start, 0)` at `:653` — so a
   one-day stay is **zero** nights, not one. The total is what is stored; a total divided by a night
   count is a number nobody was charged. The same arithmetic is written once as a pure function and
   shared by the dialog's live count and the server, never implemented twice.

**What this spec deliberately does not do.**

- **It does not restate the frozen plan.** `docs/plans/03-reservations-and-transport.md`, stage
  `03-S8` (`:3228-3585`), carries the owned paths, the per-surface checklist and the wave argument,
  and #179 and #180 carry the ticket text. A second copy here would drift on its first edit.
- **It adds no decision the PRD did not already take.** Where it differs from the frozen plan it is
  because the tree moved after the freeze — the write path's home, the e2e file, the copy
  namespace, the already-spreading read — and each difference is named in Resolved assumptions.
- **It is not the implementation ticket.** #167 is a PRD. The implementation tickets are **#179 and
  #180**.

## 📝 Architecture

```
                                    Phase 1                         Phase 2
src/server/repos/itinerary.ts       2 validator lines               (untouched)
                                    + reference guard
                                    + assertTripRole ×3
                                          │
src/server/fns/stays.ts  (new)      createStayFn                    (untouched)
                                    updateStayFn
                                    deleteStayFn
                                          │
                          ┌───────────────┴────────────────┐
components/modules/book   stay-dialog.tsx (new)            │
                          booking-dialog.tsx (branch)      │
                          bookings-timeline.tsx (card)     │
                                                           │
routes/…/-ui/plan-screen.tsx                               └──→ "Add a stay", same dialog
routes/…/-server/plan.ts                                        stays: name → shape
routes/…/-ui/plan-model.ts                                      passes the shape through
components/planner/types.ts                                     PlannerStay
components/planner/day-section.tsx                              the badge says the word
src/server/fns/booking-import.ts                                one branch in the confirm
```

**One guard, in one file, covering three writers.** `assertTripRole(scope, tripId,
['owner', 'editor'])` goes into `createAccommodation`, `updateAccommodation` and
`deleteAccommodation`. `deleteAccommodation` needs the trip resolved first — today it calls
`requireRemove` and nothing else — so it reads the row through `dayAccommodationsRepository`
(already `tenantFilter()`-scoped) and asserts the role on the `tripId` it finds there. The pattern
is `03-S2`'s and `03-S4`'s, unchanged.

**The reference guard matches the two already beside it.** `createAccommodation` resolves both days
with `requireTripDay` against the stay's own trip and the place with `requirePlaceOfTrip`. When
`reservationId` is set it resolves the reservation through the scoped
`reservationsRepository.requireById` and requires its `tripId` to equal the stay's — the same shape,
in the same function, refusing a cross-tenant link rather than writing a dangling one.

**The compensating write, and why it is ordered this way.** A stay and its booking are one action to
the reader and two rows in D1, in two repositories, so `db.batch()` is not reachable across them.
The booking is written first through `createReservation`, then the stay through
`createAccommodation` with `reservationId` set; if the second write fails the first is deleted
again. The order is not arbitrary: **a stay with no booking is recoverable by hand and visible on
the board; a booking claiming nights nobody is staying is a lie the reader cannot see.** The same
shape `src/server/fns/files.ts` already uses for the R2 object and its row.

**The ledger line is the reservation's alone.** `syncReservationExpense`
(`src/server/fns/reservations.ts:279`) is called for the booking exactly as
`createBookingFn` (`:400`) calls it today, and **never** for the stay. The stay is not a second
thing anybody paid for, and a second call would double the trip's committed total.

**Phase 2 adds no authorization decision.** The day panel's entry point opens the dialog Phase 1
built and calls the server function Phase 1 wrote. The import branch calls `createAccommodation`
inside a handler that has already resolved the trip. Both are behind guards that exist by then.

## 📝 Data Model

**No schema change, no migration, in either phase.** `day_accommodations.reservation_id` shipped
with `00-S9` (#177) and is on disk at `schema.ts:1101` with its index. This is the rarer of the two
failure shapes PRD decision 26 describes — the column exists and the validator does not carry it —
and it is what Phase 1's two lines fix.

| Column                                                              | Read for                                   | Written by       |
| ------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| `day_accommodations.start_day_id`, `end_day_id`                     | the run of nights, and the days it covers  | Phase 1          |
| `day_accommodations.reservation_id`                                 | the booking that paid for it               | Phase 1          |
| `day_accommodations.check_in_time`, `check_in_end_time`             | the window, on the day the reader needs it | Phase 1          |
| `day_accommodations.check_out_time`                                 | the last day's badge                       | Phase 1          |
| `day_accommodations.name`, `address`, `place_id`                    | the badge's text and its link              | Phase 1          |
| `day_accommodations.confirmation_number`, `price_minor`, `currency` | the desk card                              | Phase 1          |
| `reservations.*`                                                    | the booking half of the co-creation        | existing writers |

**`SET NULL` and never `CASCADE`, and the delete question belongs to the reader.** Deleting a
booking must not delete the nights — the column's own docblock (`schema.ts:1095-1100`) says a stay
"outlives the reservation that held it". Deleting the **stay** is the other direction, and there the
dialog asks whether the booking goes too: two records, one question, answered by the reader rather
than by the handler.

**Money is an integer count of minor units beside a `text(3)` ISO-4217 code**, on both tables
(`day_accommodations.price_minor` at `:1107`, `reservations.price_minor`), rendered with
`tabular-nums`. The nightly figure is **not stored and not derived** — see decision 4 above.

**Nothing is backfilled.** The four seeded stays keep a null link, which reads as "recorded without
a booking", which is true.

**Quota: no metric, in either phase.** A stay is a child of a trip and `USAGE_METRICS` has no metric
for one; the sold ceiling is the trip (PRD decision 24). `resolveLimits()` and `PLAN_QUOTAS` are
untouched and `src/server/billing/__tests__/limits.test.ts` gains no case. The import branch creates
no place of its own — `placeFor(row)` already runs for an accommodation draft
(`booking-import.ts:752`) and already consumes the existing places metric at the existing assertion
point.

## 📝 API Contracts

**No new repository function. No new endpoint in Phase 2.** Three server functions are added in
Phase 1, one existing validator pair widens, and one existing payload widens.

### Repository — `src/server/repos/itinerary.ts` (edit, Phase 1)

```ts
// createAccommodationInput and updateAccommodationInput each gain one line:
reservationId: idSchema.nullish()
```

Plus the reference guard in `createAccommodation` and `assertTripRole(scope, tripId,
['owner', 'editor'])` in all three writers. **Nothing else in the file is touched** — the ticket is
explicit about this, and `01-S4` (wave 2), `07-S9` (wave 3) and `02-S9` (wave 5) each hold this file
in an earlier wave.

### Server functions — `src/server/fns/stays.ts` (new, Phase 1)

```ts
/** A stay as the desk and the board read it. */
export interface StayRow {
  readonly id: string
  readonly reservationId: string | null
  readonly placeId: string | null
  readonly name: string
  readonly address: string | null
  readonly startDayId: string
  readonly endDayId: string
  readonly checkInTime: string | null
  readonly checkInEndTime: string | null
  readonly checkOutTime: string | null
  readonly confirmationNumber: string | null
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly notes: string | null
}

export const createStayFn // POST — the stay, and optionally the booking that pays for it
export const updateStayFn // POST — both records; never creates a booking for a stay that had none
export const deleteStayFn // POST — the stay, and the booking only when the reader said so
```

`createStayFn`'s validator is a Zod v4 `z.object` carrying the trip id, the two **day ids**, an
optional place id, the name, the address, the three times as `HH:MM` refinements, the confirmation
number, the price in minor units with its ISO-4217 code, the status, the notes, and
`withBooking: z.boolean()`. `z.iso.date()` is **not** used for the day references: they are ids, not
dates, and the dates come from the days themselves — which is the whole point of a day-referenced
stay.

**`reservationId` is never taken from the client.** In `createStayFn` it is the id of the booking the
same handler has just written. In `updateStayFn` it is only ever **cleared**, never re-pointed. The
repository guard therefore exists for the repository's own contract rather than for a path these
functions exercise, which is the right place for it: the next caller does not get to skip it.

`deleteStayFn` takes `withBooking: z.boolean()` and deletes the reservation only when it is true.

**Realtime.** One `mirrorToRoom` patch per action on the `trip` entity, carrying the stay id and its
day range — not the whole record, because the room is a notification channel and D1 is the store.
The posture `-server/plan.ts:249-255` records: `#/server/fns/context` is reached **inside** the
function.

**Nothing is enqueued.** Two small writes.

### Desk payload — `src/server/fns/reservations.ts` (edit, Phase 1)

`bookingDeskPayload` (`:633`) gains `stays: ReadonlyArray<StayRow>` from the `getTripItinerary` read
it **already performs** (`:642`), so the desk can render a stay card with nights rather than a start
time, and can resolve which booking a stay belongs to. Additive output; no new query. The day
selects in the stay branch reuse `BookingDayOption` (`:584`) exactly as `03-S4`'s stop picker does.

### Board payload — `src/routes/_app/trips/$tripId/-server/plan.ts` (edit, Phase 2)

```ts
// :143 — was: readonly stays: ReadonlyArray<string>
readonly stays: ReadonlyArray<PlanStay>

interface PlanStay {
  readonly id: string
  readonly name: string
  readonly placeId: string | null
  readonly startDayId: string
  readonly endDayId: string
  readonly checkInTime: string | null
  readonly checkInEndTime: string | null
  readonly checkOutTime: string | null
}
```

`:238` stops mapping to `.name`. **This is a widened projection over a record the loader already
holds** — `getTripItinerary` returns the whole `DayAccommodation` and already filters it to the
covering days (`repos/itinerary.ts:292-301`). No repository change, no extra read, no new round
trip.

### Import confirm — `src/server/fns/booking-import.ts` (edit, Phase 2)

**One branch, and no new server function, validator or queue message.** Inside the existing
per-row loop of `confirmBookingImport` (`:693`), after `written.push({ index, reservationId })` and
beside `settle` (`:656`): when `draft.type === 'accommodation'` and both parsed dates resolve to
days of this trip, call `createAccommodation` with `reservationId` set.

Placing it **after** `written.push` is the whole of its failure design and costs no new bookkeeping:
the reservation is already recorded as written, so a retry skips the row and cannot duplicate the
booking, and a stay that could not be written simply is not there. The failure is logged and stepped
over exactly as `settle`'s own `updateFile` failure already is (`:663-672`), and the reservation
keeps its `imported_at` stamp — so the outcome of a refusal is "recorded, needs review", which is
the reading any thin document already gets.

## 📝 UI/UX

**No new primitive.** `Dialog`, `Field`, `Input`, `SimpleSelect`, `Combobox`, `Textarea`, `Badge`,
`Chip`, `Alert` and `Button` from `src/components/ui`; `ConfirmDialog`, `FactList` and `useAction`
from `src/components/modules/shared`.

**`DateRangePicker` exists and is deliberately not used.** A stay is a run of **days of this trip**,
not two calendar dates: offering a calendar invites a reader to pick a date the trip does not have,
and an undated trip still has days it can sleep through. The two day selects are the third pairing
of that shape in the codebase — the transport dialog's departure/arrival day selects are the second.
**A fourth makes it a control worth owning**; this spec notes that and does not mint it, because
neither phase owns `components/ui`.

### Phase 1 — the stay branch

Choosing the accommodation type in the booking dialog replaces the start/end date-and-time block
with, in the order a person reads a hotel confirmation:

1. **The property** — a `Combobox` over the trip's places that fills the name and the address when
   they are empty and **never overwrites what the reader typed**.
2. **The first night and the last night** — two day selects over the trip's days.
3. **The nights, stated rather than implied** — "3 nights · Fri 9 Oct → Mon 12 Oct" under the two
   selects, updating as they change, `tabular-nums` so the number does not shift the line.
4. **The check-in window** as two times, **the check-out time**, then the ordinary confirmation
   code, status, price and notes.

**The branch swap cross-fades** at `--duration-fast` rather than animating height, so switching type
does not make the dialog jump.

**The desk card** for a stay reads as a stay: nights and the check-in window, not a start time, with
the confirmation code behind the masked control `03-S6` shipped.

### Phase 2 — the day, and the import

**The day header badge.** The pill that exists today gains the word for what that day is: the first
covered day reads **Check in** (with the window when one is set, because that is the day the reader
needs it), the last reads **Check out**, and the days between carry the property's name alone. On a
**single-day stay the badge carries both words** — the reader arrives and leaves the same day, and
saying only one of them would be wrong. Clicking the badge opens the linked place when there is one.

**The React key moves from the name to the id**, fixing the collision two same-named stays on one
day cause today.

**Add a stay, from the day.** The day panel gains the action beside **Add a place**, opening the
same dialog the desk opens with that day pre-selected as the first night and the last night left for
the reader. One action, one dialog, **no second write path**, and the pre-selection is a default the
reader can change like any other.

**A stay contributes no row to the day's sequence**, which is the rule `03-S5` already states from
the other side.

**States.**

- _Empty_ — a trip with no stays shows nothing on the day headers; an empty badge row is noise, and
  the desk's own empty state already covers the list. The property combobox on a trip with no places
  says so inline and lets the reader type a name instead of blocking them.
- _Skeleton_ — the day header **reserves the badge row's height** while the board loads. This is the
  one place in this stage where a skeleton exists purely to prevent layout shift, and it is what
  makes the zero-shift assertion below achievable.
- _Error_ — a failed co-creation says which half failed and what was rolled back, in the dialog's
  `Alert`, and **keeps the draft**. A failed delete leaves both records and says so.
- _Every control_ — rest, hover, focus-visible, active, disabled and loading on every field, on the
  badge (which is a link and looks like one on focus), on **Add a stay**, on save and on delete.

**Motion.** The badge row fades and rises 2px at `--duration-fast` on `--ease-out-quint` when the
board settles. Both this and the branch cross-fade collapse under `prefers-reduced-motion: reduce`.

**Tokens, contrast.** None missing. Check-in is `--color-success-soft` with `--color-success` text,
check-out `--color-info-soft` with `--color-info`, and the nights between `--color-ink-3` on
`--color-surface-2` — three tones that read as a sequence rather than as a traffic light. All six
pairs checked at AA in both themes, with dark values re-declared rather than reused.

**Accessibility.** The badge's accessible name says the day's part and the property — "Check in,
Park Hyatt Tokyo" — so a reader who hears three days of one stay hears three different sentences
rather than the same name three times. Keyboard end to end, WCAG 2.2 AA.

**Mockups: not produced.** This repository has no `om-prepare-test-env` descriptor, so the browser
provider could not be booted to capture current-app screenshots or render proposed-UI statics. The
day-header badge, the one surface where a static would have earned its place, is described against
the element that renders it today (`day-section.tsx:173-185`) rather than drawn.

## 📝 Edge Cases & Failure Scenarios

| Case                                                       | Behaviour                                                                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A one-day stay                                             | **Zero** nights, and the badge carries **both** _check in_ and _check out_. `countAccommodationNights` already returns `max(end − start, 0)`.               |
| A last night before the first                              | Invalid in the dialog before it is submitted, and `createAccommodation` already raises `NotFoundError` on it (`itinerary.ts:597-599`).                      |
| The booking write succeeds, the stay write fails           | The booking is deleted again and the dialog says which half failed, keeping the draft.                                                                      |
| The stay write succeeds, the compensating delete fails     | Both rows stand. The stay is correct and the booking is real; nothing is lost, and the reader sees the pair they asked for.                                 |
| Deleting the booking                                       | `ON DELETE SET NULL` clears the link and the nights are untouched. This is the column's declared meaning.                                                   |
| Deleting the stay                                          | The confirm dialog asks whether the booking goes with it; the handler obeys the answer and never decides for itself.                                        |
| A stay recorded with no booking                            | Legal and ordinary — the day-panel entry point produces one. `reservation_id` is null, which reads as "recorded without a booking".                         |
| Two stays of the same name covering one day                | Two badges, keyed by id. Today they collide in React's reconciler.                                                                                          |
| A stay whose place was deleted                             | `place_id` is `ON DELETE SET NULL`; the badge renders the stored `name` and is not a link.                                                                  |
| A viewer attempting any of the three writes                | `NotFoundError` from `assertTripRole`, on their **own** trip. Asserted in both directions, so the guard is proven to discriminate rather than merely throw. |
| A stay linked to another tenant's reservation              | Refused by the new reference guard rather than written as a dangling cross-tenant link. The case the tenant-isolation block genuinely adds.                 |
| The import's dates do not resolve to two days of this trip | The reservation is written, the stay is not, the row keeps its `imported_at` stamp. A stay hung on the wrong nights is worse than no stay.                  |
| The import's range runs backwards, or one end resolves     | The same refusal, by the same branch. Three named cases, one rule.                                                                                          |
| The import's stay write throws                             | Logged and stepped over, exactly as `settle`'s `updateFile` failure is. The reservation is already in `written`, so a retry cannot duplicate it.            |
| A retry after a partial import failure                     | Writes only what is not in `written`. Unchanged by this branch, because the branch sits after the push.                                                     |
| A stay covering a day the reader scrolls to                | A badge, never a row. `03-S5`'s union is untouched.                                                                                                         |
| An undated trip                                            | Its days still exist and are still selectable; the nights line states the count and omits the dates it does not have.                                       |
| A trip with no places                                      | The property combobox says so inline and accepts a typed name.                                                                                              |

## 📝 Risks & Impact Review

**Blast radius.** Phase 1 touches one repository file for four small edits and adds one server-function
module plus one dialog branch. Phase 2 widens one projection, one type and one renderer, and adds one
branch to an import handler. **No schema change, no migration, in either phase.**

**Backward compatibility** (`BACKWARD_COMPATIBILITY.md`): §1 — no D1 change at all. §2 — the two
validator lines are `nullish()`, so every existing caller is unaffected; the three new server
functions are additive; `bookingDeskPayload` and the plan payload widen their **output**, which §2
permits. §6 — no queued or persisted shape changes; the import envelope is untouched. A rollback to
the previous Worker reads rows it already understands: a `reservation_id` it never set is a column it
already ignores.

**The one breaking-shaped change, and why it is not one.** `PlannerDay.stays` goes from
`ReadonlyArray<string>` to a shape. It is an internal view model with two producers and one consumer,
all three in this repository and all three changed in the same commit; `grep` names them
(`-server/plan.ts:143,238`, `plan-model.ts:320`, `types.ts:103`, `day-section.tsx:173`). Nothing
outside `src/` reads it.

**The role guard changes behaviour for somebody.** A viewer who can write a stay today will be
refused tomorrow. That is the **point** — it closes the last of the three gaps this area was opened
to close, and `trip-room.ts` already refuses them the collaborative equivalent. Named here so it is
not discovered as a regression.

**The real contention risk is `plan-screen.tsx`, and it is not this spec's to resolve.** The module
is **1923 lines** at `dc909a80`. Phase 2 edits it for one action; `01-S9a` (#123, PRD #104, still
unbuilt) plans to extract its chrome into `plan-workspace.tsx`. Whichever lands second will rebase
across the other. The conflict is small in Phase 2's direction — one button and one dialog case — so
the recommendation is to let #123 go first if both are in flight, and this spec does not reorder
either plan to force it.

**One adjacent finding, reported and not fixed.** `plan-screen.tsx:1437` renders the literal string
`Add a place`, and the rail footer beside it is hardcoded English too. That contradicts
`docs/SPEC.md` §9 and predates both phases. **Phase 2 does not follow the local precedent** — its
own **Add a stay** lands as a catalogue key in all 23 locales — and does not fix the neighbours,
which belong to whoever owns that file's copy.

**A stale label, named rather than removed.** #179 and #180 both carry a human-set `blocked` label.
Every blocker either ticket named is satisfied at `dc909a80`: `assertTripRole` shipped with `01-S1`,
`day_accommodations.reservation_id` with `00-S9` (#177), `src/server/fns/booking-import.ts` with
`03-S7` (#178), and `TRP-06`/`BKG-02` with their own stages. Clearing the label is a human's call and
this run does not touch it.

**Rollback.** Revert either PR. Nothing to un-migrate; a stay row written by Phase 1 and then rolled
back is a row the previous code reads as it always did.

## 📋 Resolved assumptions (autonomous defaults)

Written by `om-auto-write-spec` without a human in the loop. Each is the most reversible answer to a
question #167 left open; override any of them on this PR before it merges.

| #       | Question                                                                                                                                | Resolution                                                                                                                                                               | Rationale                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1**  | #167 is a PRD covering thirteen stage tickets, eleven of which are closed. What is one spec for it?                                     | One spec at the PRD's altitude, scoped to the **two that remain** (#179, #180) — the two halves of stage `03-S8`. **⚠ NEEDS HUMAN CONFIRMATION**                         | Re-specifying eleven shipped stages would duplicate merged work; specifying all thirteen at stage depth would duplicate the frozen plan. The remainder is the only scope that is neither. Exactly the shape #104's own "what remains" spec took the same day. Gated because it decides what the document _is_.                                                                         |
| **Q2**  | The repo convention is that the FR issue is the implementation ticket for its merged spec. Applied to #167 that means building the PRD. | It does not apply here. The implementation tickets are **#179 and #180**, one per phase. Adding `autofix` to #167 is **not** the trigger. **⚠ NEEDS HUMAN CONFIRMATION** | #167 is a PRD whose sub-issues already exist and already carry the stage text; the 2026-09-11 grooming comment on #167 says in terms that this repository's spec granularity is the stage ticket. Gated because it changes how the pipeline is driven for this issue.                                                                                                                  |
| **Q3**  | One spec for both halves of `03-S8`, or one each?                                                                                       | **One**, two phases.                                                                                                                                                     | The a/b split is a wave-contention artefact inside one stage, not two concepts: the nights arithmetic, the day-header vocabulary and the one dialog are one design, and #180's own text says its entry point and its import branch call "the write path `03-S8a` built". Splitting would put the vocabulary in one document and its only consumer in the other.                        |
| **Q4**  | Where do the stay writes live — the frozen plan says `routes/…/-server/stays.ts`.                                                       | **`src/server/fns/stays.ts`**, beside `fns/reservations.ts`.                                                                                                             | Measured, not preferred: all ten server reaches from `components/modules/book/**` go through `#/server/fns/**`, and one file in all of `src/components/` imports `#/routes/`. Phase 2 gives the write path a second caller in a different tree, so a route-private home would make a shared component depend on one route's private directory. #179's own verification pass concurred. |
| **Q5**  | Does Phase 2 need a new repository read for the board?                                                                                  | **No.** `-server/plan.ts:238` stops truncating a record the loader already holds.                                                                                        | `getTripItinerary` reads `listTripAccommodations` in its existing `Promise.all` and spreads each stay across every covered day (`itinerary.ts:292-301`). The board's gap is a projection, not a query. Zero additional D1 reads.                                                                                                                                                       |
| **Q6**  | Which e2e file, given the frozen plan names `e2e/reservations-and-transport.visual.spec.ts`?                                            | One behaviour-asserting `test.describe` per phase appended to **`e2e/journeys.spec.ts`**; console `fatal` empty; no screenshot baselines.                                | ADR 0016 retired the visual gate after the plan froze, and both #179 and #180 already name `e2e/journeys.spec.ts`. The same resolution `03-S5`'s spec took.                                                                                                                                                                                                                            |
| **Q7**  | Where does the copy go? Earlier runs of #179 recorded "no catalogue keys — there is no `book` namespace".                               | **`modules.book.*` and `trips.plan.*`**, all 23 locales, in the change that introduces each key. That disposition is **void**.                                           | It was true when it was written and is not now: `src/lib/i18n/messages/en/modules.ts` carries **179** `book.*` keys at `dc909a80`, and `src/lib/i18n/messages/` holds 23 locales. `docs/SPEC.md` §9 applies with no exemption.                                                                                                                                                         |
| **Q8**  | A prior run reported that a `Select` inside a `Dialog` paints under the scrim, making the stay dialog pointer-unusable.                 | **Already fixed**; nothing to do.                                                                                                                                        | Checked rather than inherited: `tokens.css:739` declares `--z-popover: 75`, above `--z-modal`, with a docblock citing issue #201 and describing this exact defect. The finding is closed.                                                                                                                                                                                              |
| **Q9**  | Does deleting a stay delete its booking?                                                                                                | The **confirm dialog asks**, and `deleteStayFn` takes the answer as a validated boolean.                                                                                 | The frozen plan puts the question "in the confirm dialog rather than in the handler". Two records, one question, answered by the reader; a handler that decided would be guessing about money.                                                                                                                                                                                         |
| **Q10** | Does the badge on a single-day stay say _check in_ or _check out_?                                                                      | **Both.**                                                                                                                                                                | The reader arrives and leaves that day; naming one of the two would be false. Asserted as its own unit case in both phases, and the case both #179 and #180 call out by name.                                                                                                                                                                                                          |

## 📋 Visual change expected

| Route                          | State                                                                  | Themes      | Viewports       | Phase |
| ------------------------------ | ---------------------------------------------------------------------- | ----------- | --------------- | ----- |
| `/trips/$tripId/book` (dialog) | Stay branch open, a three-night range selected, the nights line stated | light, dark | 360, 1280, 2560 | 1     |
| `/trips/$tripId/book` (dialog) | Stay branch with a one-day range — "0 nights"                          | light, dark | 1280            | 1     |
| `/trips/$tripId/book` (dialog) | Property combobox open over the trip's places                          | light, dark | 1280            | 1     |
| `/trips/$tripId/book` (dialog) | Co-creation failed — the `Alert` naming the half that failed           | light, dark | 1280            | 1     |
| `/trips/$tripId/book`          | Desk card for a stay: nights and the check-in window, not a start time | light, dark | 360, 1280       | 1     |
| `/trips/$tripId/plan`          | A multi-night stay across its days — check in, the name, check out     | light, dark | 360, 1280, 2560 | 2     |
| `/trips/$tripId/plan`          | A single-day stay, both words on one badge                             | light, dark | 1280            | 2     |
| `/trips/$tripId/plan`          | Day panel with **Add a stay** beside **Add a place**                   | light, dark | 360, 1280       | 2     |
| `/trips/$tripId/plan`          | Day header skeleton with the badge row's height reserved               | light, dark | 1280            | 2     |

Judged by the blind A/B pair (`scripts/visual/capture.mjs`), which `docs/SPEC.md` §7.4 makes the
whole of the visual judgement since ADR 0016. Every declared state above is non-resting and must be
reached through a published selector verified against the running server. **Layout shift after the
settle mark is asserted `0` on Chromium** for the plan route — the reserved badge row is what makes
that achievable, and it is the assertion this stage most needs.

No other route changes. `/trips/$tripId/transports`, the day's sequence, the note editor and the
import review sheet are untouched by either phase.

## 📋 Copy

Every key lands in **all 23 locales** in the change that introduces it (`docs/SPEC.md` §9, procedure
in the `i18n-messages` skill). Namespace `modules` (`src/lib/i18n/messages/<locale>/modules.ts`),
beside the existing 179 `book.*` keys, except the two planner keys, which go to `trips`
(`.../trips.ts`) beside the existing `plan.*` keys.

**Phase 1 — the stay branch and its card:**

| Key                                | `en`                                                             |
| ---------------------------------- | ---------------------------------------------------------------- |
| `book.stay.property`               | Property                                                         |
| `book.stay.firstNight`             | First night                                                      |
| `book.stay.lastNight`              | Last night                                                       |
| `book.stay.checkInWindow`          | Check-in window                                                  |
| `book.stay.checkOut`               | Check-out                                                        |
| `book.stay.nights`                 | {count, plural, =0 {Same day} one {# night} other {# nights}}    |
| `book.stay.nightsRange`            | {nights} · {from} → {to}                                         |
| `book.stay.noPlaces`               | This trip has no places yet — type the property's name instead.  |
| `book.stay.error.backwards`        | The last night is before the first                               |
| `book.stay.error.rollback`         | The stay was not saved                                           |
| `book.stay.error.rollbackBody`     | The booking was removed again, so nothing was left half-written. |
| `book.stay.delete.title`           | Delete this stay?                                                |
| `book.stay.delete.withBooking`     | Delete the booking too                                           |
| `book.stay.delete.withBookingHint` | The nights and the booking are separate records.                 |

**Phase 2 — the day header and the entry point:**

| Key                        | `en`               |
| -------------------------- | ------------------ |
| `trips.plan.stay.addStay`  | Add a stay         |
| `trips.plan.stay.checkIn`  | Check in           |
| `trips.plan.stay.checkOut` | Check out          |
| `trips.plan.stay.bothDay`  | Check in · out     |
| `trips.plan.stay.label`    | {part}, {property} |

`book.status.*`, `shell.bookingType.accommodation` and the masked-code vocabulary `03-S6` shipped are
reused as they stand; neither phase adds to them or changes them.

## 📋 Phasing

**Phase 1 — `03-S8a` (#179): the stay has a write path.** The validators, the two guards, the server
functions, the dialog branch and the desk card. Shippable and complete on its own: a reader can
record a run of nights and the booking that paid for it, and a viewer can no longer write one. The
board is unchanged.

**Phase 2 — `03-S8b` (#180): the day says where you sleep.** The widened projection, the badge
vocabulary, the day-panel entry point and the import branch. The board and the importer catch up
with the record Phase 1 made writable.

Each phase leaves the validation gate green and leaves every surface it does not name behaving
exactly as it does today.

## 📋 Implementation Plan

### Phase 1 — `03-S8a`, the stay has a write path (#179)

1. **`src/server/repos/itinerary.ts` — the two validator lines and the reference guard.**
   `reservationId: idSchema.nullish()` on `createAccommodationInput` (`:128`) and
   `updateAccommodationInput` (`:145`); in `createAccommodation`, when the id is set, resolve the
   reservation through the scoped `reservationsRepository.requireById` and require its `tripId` to
   equal the stay's, beside the `requireTripDay` and `requirePlaceOfTrip` guards already there.
   _Verify:_ `pnpm typecheck`, plus a repository case asserting the link round-trips instead of being
   stripped.
2. **The role guard, in the same file, on all three writers.** `assertTripRole(scope, tripId,
['owner', 'editor'])` in `createAccommodation`, `updateAccommodation` and `deleteAccommodation`;
   `deleteAccommodation` reads the row first to learn its `tripId`. **Nothing else in the file is
   touched** — confirm with `git diff -w`. _Verify:_ `pnpm typecheck`, `pnpm lint`.
3. **The tenant-isolation block**, one `describe` appended to
   `src/server/repos/__tests__/tenant-isolation.test.ts`, covering the five accommodation functions:
   A cannot read, list, update or delete B's stays by id; A cannot create a stay whose start day, end
   day or place is B's; **A cannot create a stay linked to B's reservation** — the case this stage
   genuinely adds — and B's stays and reservations are both re-read afterwards and unchanged. The
   role guard **in both directions**: a viewer on their **own** trip refused by all three writers, an
   editor on the same trip allowed. _Verify:_
   `pnpm exec vitest run src/server/repos/__tests__/tenant-isolation.test.ts`.
4. **`src/components/modules/book/stay-form.ts` (new) — the arithmetic, once.** `nightsBetween(from,
to)` as `max(to − from, 0)`, the per-day word for a covered day (both words on a single-day stay),
   and `validateStayDraft`. Pure; no import from `#/server` or `#/routes`. _Verify:_
   `__tests__/stays.test.ts` (new): a three-night range is 3; a one-day stay is **0**; a backwards
   range is invalid before submit; the first covered day is _check in_, the last _check out_, neither
   between, **both** on a single day.
5. **`src/server/fns/stays.ts` (new)** — `StayRow`, the three server functions, their Zod v4
   validators, `appScope()` → `requireTrip` → the repository guards, the compensating delete, the
   `syncReservationExpense` call for the booking **and not for the stay**, and one `mirrorToRoom`
   patch per action reached inside the function. _Verify:_ `__tests__/stays.test.ts` at the
   server-function seam — the compensating delete fires when the second write fails and leaves no
   orphan; `syncReservationExpense` is called once and never for the stay; `deleteStayFn` deletes the
   booking only when told to; a stay updated never gains a booking it did not have.
6. **`bookingDeskPayload` carries the stays** from the `getTripItinerary` read it already performs.
   _Verify:_ `pnpm typecheck`; a case asserting no second query is issued.
7. **`stay-dialog.tsx` (new), and the branch in `booking-dialog.tsx`.** The field order above, the
   property combobox that never overwrites typed text, the two day selects over `BookingDayOption`,
   the live nights line on `tabular-nums`, the cross-fading branch swap, the full state set, and
   `data-part="type-accommodation"` so the declared state is reachable. _Verify:_ `pnpm lint`,
   `pnpm typecheck`, and the component cases in `stays.test.ts`.
8. **The stay card in `bookings-timeline.tsx`** — nights and the check-in window rather than a start
   time, code behind `03-S6`'s masked control. _Verify:_ appended cases in the module's existing
   tests.
9. **The fourteen locale keys**, `en` first and then all 23, per the `i18n-messages` skill.
   _Verify:_ the i18n parity test in `pnpm test`.
10. **The e2e block**, appended to `e2e/journeys.spec.ts`: open the book tab, open the stay branch
    with a three-night range, assert the stated night count, assert `tabular-nums` on it, assert a
    silent console. _Verify:_ `bash .ai/scripts/e2e.sh e2e/journeys.spec.ts`.
11. **The blind A/B pair** on Phase 1's five declared states, per `docs/SPEC.md` §7.4 and the
    `verifying-changes` skill. _Verify:_ `scripts/visual/capture.mjs` at the stated viewports in both
    themes, the critic's verdict attached to the PR.
12. **The full gate**, in order: `node .ai/scripts/agent-kit-check.mjs`, `pnpm typecheck`,
    `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`,
    `bash .ai/scripts/e2e.sh`. _Verify:_ every command green, nothing skipped or waived.

### Phase 2 — `03-S8b`, the day says where you sleep (#180)

13. **`PlanStay` and the widened projection.** `-server/plan.ts:143` and `:238`,
    `components/planner/types.ts:103`, `plan-model.ts:320` — the shape threaded through, **no new
    read**. _Verify:_ `pnpm typecheck`; a case asserting the loader issues the same queries it did
    before.
14. **`day-section.tsx` says the word.** The badge takes the per-day vocabulary from Phase 1's pure
    module, keys on the stay's **id**, carries the check-in window on the first day, links to the
    place when there is one, and reserves its row's height in the skeleton. _Verify:_ appended cases
    in `__tests__/rails.test.tsx` — a three-day stay renders check-in, name, check-out across its
    days; a single-day stay renders both words on one badge; two same-named stays on one day render
    as two badges; a day with no stay reserves nothing visible.
15. **`plan-screen.tsx` — Add a stay.** One action beside **Add a place**, one dialog case, the day
    pre-selected as the first night, calling `createStayFn`. **No second write path.** _Verify:_
    `pnpm lint`, `pnpm typecheck`, `pnpm test`.
16. **The import branch in `src/server/fns/booking-import.ts`.** One conditional after
    `written.push`, guarded on `draft.type === 'accommodation'` and on both parsed dates resolving to
    days of this trip; failures logged and stepped over as `settle`'s already are. _Verify:_ unit
    cases — the stay is created when the dates resolve; in each of the three named refusal cases the
    reservation is written and the stay is not; a throw inside the branch leaves the reservation in
    `written` so a retry does not duplicate it.
17. **The five locale keys**, all 23 locales. **`trips.plan.stay.addStay` is a catalogue key, not a
    literal** — `plan-screen.tsx:1437`'s hardcoded `Add a place` is not the precedent to follow.
    _Verify:_ the i18n parity test.
18. **The e2e block**, appended to `e2e/journeys.spec.ts`: the plan tab over a multi-night stay,
    asserting the three day headers' words and a silent console, and **layout shift asserted `0`
    after the settle mark** on Chromium. _Verify:_ `bash .ai/scripts/e2e.sh e2e/journeys.spec.ts`.
19. **The blind A/B pair** on Phase 2's four declared states. _Verify:_ as step 11.
20. **The full gate**, as step 12. _Verify:_ every command green, nothing skipped or waived.
