# Copy a trip: the dialog, the two-phase write, and the copier registry

Source plan: `docs/plans/01-trips-core.md`, stage `01-S1d` — the fourth and last slice of `01-S1`.
Tracker: FR #111, parent PRD #104, decisions 3, 4a, 4b, 6 and 9. Reference row `TRP-02`.

## 📝 TLDR

A traveller who has planned Lisbon once cannot plan it again without retyping it. This spec builds
the copy: a dialog that takes a title and a date range, a synchronous half that mints the trip and
returns inside one round trip, and a `trip-copy` queue handler that duplicates the source's
inventory afterwards. A copy reproduces the **plan** — days, places, place tags, day assignments and
day notes — and never the **record**: reservations, transports, expenses, files, conversations,
share tokens and people all stay behind. Other areas extend the copy through a registry rather than
by editing this stage. The column that marks a copy in flight, `trips.copy_pending_at`, already
shipped in `drizzle/0006_mighty_nehzno.sql`, so there is no migration.

## 📝 Problem Statement

Nothing copies a trip. Every claim below was read on `develop` at `67808732`, not taken from the
plan:

| Piece                                    | State at HEAD                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `trips.copy_pending_at`                  | **Exists.** `src/server/db/schema.ts:728`, landed in `drizzle/0006_mighty_nehzno.sql:25`. Read by nothing.                            |
| `startTripCopy`                          | Absent from `src/server/repos/trips.ts`.                                                                                              |
| `copyTripContents`                       | Absent.                                                                                                                               |
| `registerTripCopier`                     | Absent.                                                                                                                               |
| `copyObject`                             | Absent from `src/server/storage/objects.ts`, which exports `R2_DELETE_MAX_KEYS` (`:35`) and `deleteObjects` (`:45`) and nothing else. |
| `'trip-copy'` task kind                  | Absent from `TASK_KINDS` (`src/server/queue/types.ts:14-33`), which carries `trip-purge` and nine others.                             |
| `src/server/queue/handlers/trip-copy.ts` | Absent. The five handlers on disk are `booking-import`, `email`, `pdf-export`, `travel-stats`, `trip-purge`.                          |
| `copyTripFn`                             | Absent from `src/routes/_app/-server/trip-lifecycle.ts`, which exports seven other write paths.                                       |
| The Copy menu item                       | Absent from `src/routes/_app/-ui/trip-actions.tsx`, whose menu offers favourite, edit, archive, restore and delete.                   |

So the column is a promise nothing keeps. Three slices of `01-S1` have already landed around it —
`01-S1a` the read predicate and the role guard (#108), `01-S1b` the per-person favourite (#109),
`01-S1c` the terminal delete and its `trip-purge` sweep (#110) — and this is the one that is left.

**Why it cannot be one synchronous write.** `places` is `UNLIMITED` on every paid tier
(`PLAN_QUOTAS.business`, `src/server/db/types.ts:63-69`, where `UNLIMITED` is
`Number.POSITIVE_INFINITY` at `:20`), so a twenty-thousand-place trip is a legal trip and copying it
is an unbounded write. `src/server/repos/batch.ts`'s own header states the rule this obeys — a batch
that rewrites a whole itinerary belongs in a queue consumer, not in a request path — and
`docs/plans/TEMPLATE.md` says anything slow is enqueued on `TASKS` and never run inline.

**Why it cannot be one asynchronous write either.** The reader needs a trip id and a destination
inside one round trip, and the quota refusal has to land where the reader is looking rather than in
a consumer they cannot see. So the split is by bound: what is O(1) in the source's size stays in the
POST, and what scales with the source's inventory is enqueued.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written by an unattended `om-auto-write-spec` run. Each question below was resolved
with the most reversible, smallest-scope answer. Override any of them on this PR before it merges.

| #   | Question                                                                                                                           | Resolution                                                                                                                                                                                                                 | Why                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Does this ship as one spec, or does the synchronous half deploy separately from the handler?                                       | One spec.                                                                                                                                                                                                                  | The halves are not independently deployable. The synchronous half alone stamps `copy_pending_at` with nothing to clear it, so every copied trip is a tile stuck on "Copying" for ever. `docs/SPEC.md` §8: one concept, one owner.                                                                                  |
| Q2  | Where do later plans call `registerTripCopier`, and what fixes the order?                                                          | At module top level in the repository module that owns the table. The handler imports the existing `src/server/repos/index.ts` barrel, so every module is loaded before the registry is read; order is registration order. | Reuses a shipped primitive instead of inventing a manifest. `04-budget-and-currencies.md` and `05-packing-and-todos.md` then add one call each in the stage that owns the table, with no edit here — which is the whole point of the seam.                                                                         |
| Q3  | On success, does the dialog navigate into the new trip or stay on the list?                                                        | Stay on `/trips`. Invalidate the list; the new tile appears in its copying state.                                                                                                                                          | Navigating into a planner whose days have not landed shows the reader an empty trip and calls it theirs. The tile is deliberately not a link while `copy_pending_at` is set, and navigating there anyway would contradict that in the same interaction.                                                            |
| Q4  | Does the completion notification enumerate the modules that came across with no copier registered (budget lines, packing, to-dos)? | No. It carries the counts of what was copied and the dropped-note count.                                                                                                                                                   | What never comes across is told to the reader **before** they commit, in the dialog, where it can change their mind. A second inventory afterwards is a list that goes stale the moment plan `04` registers its copier.                                                                                            |
| Q5  | Which of the source's own fields does the new trip inherit?                                                                        | `destination`, `summary`, `currency` and `country_codes` come across. `visibility` resets to `private` and the reminder offset resets to the column default.                                                               | Carrying `visibility = 'organization'` across would republish a trip to the whole workspace on the copier's behalf, as a side effect of an action whose subject is the plan. The conservative direction is the safe one here, so this is a default and not a `⚠`.                                                  |
| Q6  | A cover object that fails to copy in R2 — transient (retry), permanent (delete the target), or tolerated?                          | Tolerated. Logged once with `serializeError`; the copy completes without a cover and the tile falls back to the shipped `CoverArt` placeholder.                                                                            | A missing cover is cosmetic. Deleting a fully copied trip over it, or retrying an entire inventory copy for it, are both larger harms than the loss. The two genuinely fatal classes — source gone, requester no longer a member, ceiling crossed — keep the permanent path the ticket's Definition of Done names. |
| Q7  | Where does `MAX_BOUND_PARAMETERS` live, given that the limit binds `insertMany` in `src/server/repos/base.ts`?                     | Top of `src/server/repos/trips.ts`, with the D1 limit cited beside it — the plan's placement.                                                                                                                              | `base.ts` is one of `README.md`'s six shared paths and this stage owns none of them. A constant there would also read as a promise that `insertMany` chunks, which it does not (`base.ts:219-237`) — the divisor belongs at the call site that applies it.                                                         |
| Q8  | Does the copying tile poll for completion?                                                                                         | No. It clears on the route's next load; the trip list already revalidates on focus.                                                                                                                                        | A poll is a second source of truth about the same row and a request loop on a screen that may hold twenty tiles. The completion notification `00-S2`'s write path delivers is the active signal.                                                                                                                   |
| Q9  | Can the reader change anything besides title and dates in the dialog?                                                              | No.                                                                                                                                                                                                                        | PRD #104 decision 4a fixes the field set at title and date range. Every other field is editable on the copy the moment it exists, through the edit sheet `01-S1a` already shipped.                                                                                                                                 |

None of these carries `⚠ NEEDS HUMAN CONFIRMATION`. None weakens tenant scoping, authorisation, a
`BACKWARD_COMPATIBILITY.md` surface, or an active decision of PRD #104 — Q5 tightens the first of
those rather than relaxing it.

## 📝 Proposed Solution

Split the copy on the bound, not on the table.

**The synchronous half — `startTripCopy(scope, tripId, input)`** — does only work that is O(1) in the
source's size: resolve the source through `requireTrip` (which since `01-S1a` _is_ the read check,
so any reader may copy per decision 6), assert the `trips` quota and the projected `places` quota,
reserve a slug, insert the trip row through the path `createTrip` already uses so a dated copy gets
its day run from `syncTripDays` exactly as a new trip does, stamp `copy_pending_at`, and insert the
caller's `owner` membership. It returns the new trip's id. Nothing here reads the source's place
count row by row, which is the property that lets it stay in a POST handler at all.

**The asynchronous half — `copyTripContents(scope, sourceTripId, targetTripId)`** — runs in a new
`trip-copy` queue handler and duplicates the inventory in passes: the day run when the target has
none, the day map, places, place tags, day assignments, day notes, then every registered copier in
order, then the cover object, and `copy_pending_at` last.

**The registry — `registerTripCopier(name, fn)`** — is the seam that keeps a table in one plan while
the copy still reproduces the whole plan. This stage registers nothing; its own four passes are
`copyTripContents`'s own code, because those tables are this plan's. Until a module registers a
copier the copy simply omits it.

### Alternatives considered

- **One synchronous copy inside a transaction.** Loses on the unbounded write above, and D1 has no
  interactive transaction to hold one open across twenty thousand rows anyway.
- **A Durable Object driving the copy.** The trip room is invalidation-only and every write in
  `-server/plan.ts` already behaves that way; giving the room a job would make it the second place
  that knows how a trip is built.
- **Copying by `INSERT … SELECT`.** Would be one statement per table and no chunking at all, but it
  needs raw SQL outside the tenant-scoped repositories, which `docs/SPEC.md` §6 forbids, and it
  cannot remap day ids and place ids in flight.
- **A single generic "clone rows for trip" helper over the schema.** Reflection over Drizzle tables
  would be shorter and would silently copy the record along with the plan the day a table is added.
  The point of decision 4b is that the boundary is declared, not derived.

## 📝 Architecture

```
Reader                    Request path                         Queue consumer
──────                    ────────────                         ──────────────
TripCopyDialog ─POST──►  copyTripFn
                          ├─ startTripCopy  (trip row, owner row,
                          │                  day run, copy_pending_at)
                          ├─ enqueueTask  'trip-copy'  ──────►  handleTripCopy
                          ├─ travel-stats envelopes               ├─ rebuild scope from envelope
                          └─ { tripId, copyPending: true }        ├─ copyTripContents
                                                                  │   days → places → tags
                                                                  │   → assignments → notes
                                                                  │   → registered copiers
                                                                  │   → cover object
                                                                  │   → clear copy_pending_at
                                                                  ├─ travel-stats envelopes
                                                                  └─ notify(requester, counts)
```

### `src/server/repos/trips.ts` — edit

Gains `MAX_BOUND_PARAMETERS`, `startTripCopy`, `copyTripContents`, `registerTripCopier` and the
copier types. It already owns `requireTrip` (`:319`), `assertTripRole` (`:374`), `createTrip`
(`:606`), `deleteTrip` (`:717`), `listTripMembers` (`:741`) and the module-private `reserveTripSlug`
(`:416`), which is why the two halves live here rather than in a new module: `reserveTripSlug` is not
exported and must not become so for this.

`copyTripContents` writes through repositories the owning modules already export —
`daysRepository` (`src/server/repos/days.ts:26`), `dayNotesRepository` (`:27`), `placesRepository`
(`src/server/repos/places.ts:43`), `placeTagsAccess` (`:44`) and `dayAssignmentsRepository`
(`src/server/repos/itinerary.ts:56`). SQL stays in `src/server/repos`, per `docs/SPEC.md` §6, and the
multi-table write has exactly one home.

**Neither half calls `assertTripRole`.** `startTripCopy` is open to any reader (decision 6) and
`requireTrip` is its check. `copyTripContents` is not role-checked either: by the time the handler
runs, the target is the caller's own trip and the source has already been read-checked, and
re-checking a membership the acting member may have lost in the meantime would abandon a copy the
product already promised.

### The chunk bound, and where its divisor comes from

D1 refuses a statement carrying more than **100 bound parameters**. `insertMany`
(`src/server/repos/base.ts:219-237`) sends `rows × columns` parameters in one statement and does not
chunk — measured, it is a single `.values(records).returning()`. So every pass chunks at

```ts
const chunk = Math.max(1, Math.floor(MAX_BOUND_PARAMETERS / columnsInPayload))
```

where `columnsInPayload` is the number of keys the pass actually writes, **not** the table's column
count — Drizzle binds only the keys present in the values object, and `insertMany` adds
`organizationId` itself. The worst case is `places`: 27 columns on the table
(`src/server/db/schema.ts:882-933`), of which the copy writes 24 plus the stamped tenant column, so
25 keys and **4 rows per statement**. `place_tags` writes 3 and takes 33. The constant is declared at
the top of `trips.ts` with the limit's source written beside it, and the loop is held by a unit test
that copies more rows than one chunk can carry — not by a comment.

Where several statements go together — the assignment remap — they go through `runBatch(scope,
statements)` (`src/server/repos/batch.ts:35`). `scope.db` has no `batch()` of its own: it is
`readonly db: Database` (`src/server/repos/base.ts:43`) where `Database` is
`BaseSQLiteDatabase<'async', unknown>` (`src/server/db/types.ts:14`), and `batch()` is a D1 driver
method that abstract type does not carry. Nothing in this stage names `scope.db.batch`.

### `src/server/queue/handlers/trip-copy.ts` — new

Modelled on `travel-stats`, which is the handler that already needs D1. Its scope is **rebuilt, never
carried**: the envelope names the organization and the requesting user, the role is read with
`getMembership` (`src/server/repos/members.ts:144`) through a lowest-privilege probe scope, and
`createScope` (`src/server/repos/base.ts:51`) builds the real one. Every statement the handler then
runs is `tenantFilter()`-bound to that organization, so a forged envelope can only copy rows its own
tenant already holds. `TaskBindings.DB` is `D1Database | undefined`
(`src/server/queue/types.ts:398`); an absent binding is the same hard error `travel-stats` raises at
`handlers/travel-stats.ts:211-215`.

### `src/server/storage/objects.ts` — edit

Gains `copyObject(store, sourceKey, targetKey)`. The two trip handlers then share one R2 surface —
`trip-purge` deletes through `deleteObjects`, `trip-copy` duplicates through `copyObject` — and
neither opens the bucket itself. The target key is minted by the same `storageKeyFor`
(`src/server/fns/file-policy.ts:187`) the rest of the product uses, so it carries the organization id
in its second segment and stays inside the boundary `trip-purge` checks.

**This widens `ObjectStore`, which today declares one method.** Measured, the interface is
`{ delete: (keys: string | Array<string>) => Promise<void> }` (`objects.ts:22-24`) — a purge needs
nothing else. A copy needs to read and write, so the interface gains `get` and `put` as **optional**
members and `copyObject` raises a typed error when they are absent. Optional rather than required is
what keeps every existing fake in `src/server/storage/__tests__/` and in the `trip-purge` tests
compiling unchanged; a required member would make this a breaking edit to a shared type for the sake
of a caller half the handlers do not have.

### `src/routes/_app/-server/trip-lifecycle.ts` — edit

Gains `copyTripInputSchema` and `copyTripFn`. It already declares `QUEUE_BATCH_MAX = 100` (`:79`) for
the travel-statistics fan-out and `DELETE_CONFIRM_THRESHOLD` (`:93`); the copy reuses the first.

### Files this spec does **not** touch

`src/server/db/schema.ts` (the column exists), `drizzle/**` (no migration), `wrangler.jsonc` (the
`DB` binding is already on the Worker the consumer runs in), `src/components/ui/**` (every primitive
is shipped), `src/styles/tokens.css` (no token is missing), `src/routeTree.gen.ts` (no route),
`src/server/repos/base.ts` (see Q7), `src/server/queue/reminders.ts`, `src/server/do/protocol.ts`,
`package.json` and `pnpm-lock.yaml`.

## 📝 Data Model

**No migration.** `trips.copy_pending_at` is `integer('copy_pending_at', { mode: 'timestamp_ms' })`,
nullable with no default (`src/server/db/schema.ts:728`), landed in `drizzle/0006_mighty_nehzno.sql`.
This stage is its first reader and its first writer.

**What is copied, and what is not.** The boundary is PRD #104 decision 4b and the `CONTEXT.md`
glossary entry for _Trip copy_, not this spec's invention:

| Table                                 | Copied | Note                                                                                        |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `trips`                               | ✅     | New row; see Q5 for the inherited field set.                                                |
| `trip_members`                        | ➖     | One row: the copier as `owner`. The source's people do not come across.                     |
| `days`                                | ✅     | From `syncTripDays` when dated; copied numbered and dateless when not.                      |
| `places`                              | ✅     | Whole inventory, new ids.                                                                   |
| `place_tags`                          | ✅     | Remapped onto the new place ids; `tag_id` is workspace-level and is reused, not duplicated. |
| `day_assignments`                     | ✅     | Remapped onto new day ids **and** new place ids.                                            |
| `day_notes`                           | ✅     | Remapped onto new day ids.                                                                  |
| `trip_favourites`                     | ❌     | A bookmark on one person's row; `01-S1b` made it per person.                                |
| `reservations`, `stays`, `transports` | ❌     | The record.                                                                                 |
| `expenses`, `expense_shares`          | ❌     | The record.                                                                                 |
| `trip_files`                          | ❌     | The record. The **cover** is not a `trip_files` row and is copied.                          |
| `share_links`                         | ❌     | A token is a grant, and a grant is not a plan.                                              |
| conversations, polls                  | ❌     | The record.                                                                                 |
| budget lines, packing, to-dos         | ⏳     | Through the registry, in `04-*` and `05-*`. Absent until registered.                        |

**The day map is by `day_number`, in both directions.** For a dated copy the run already exists from
`startTripCopy`, and the first pass only builds source-day-id → target-day-id. For an undated copy
`syncTripDays` (`src/server/repos/days.ts:149-172`) takes its `wanted.length === 0` branch and
creates **no days at all** — measured, it only clears stale dates on days that already exist — so
`copyTripContents` inserts the run itself: `day_number` `1..n` from the source's own run,
`date: null`, `title` and `notes` carried across.

**A shorter range truncates rather than fails.** A five-day source into a three-day range yields
three days. An assignment whose source day has no target is written **unscheduled**, so its place
sits in the ideas column and nothing is lost. A note whose source day has no target has nowhere to
go — a note is bound to its day — so it is **dropped and counted**, and the count reaches the reader
in the completion notification.

## 📝 API Contracts

### `src/server/repos/trips.ts`

```ts
/** D1 refuses a statement carrying more than this many bound parameters. */
export const MAX_BOUND_PARAMETERS = 100

export interface StartTripCopyInput {
  title: string
  startDate?: string // ISO date; both dates present or both absent
  endDate?: string
}

export async function startTripCopy(
  scope: TenantScope,
  tripId: string,
  input: StartTripCopyInput,
): Promise<string> // the new trip's id

export interface CopierMaps {
  dayIds: ReadonlyMap<string, string>
  placeIds: ReadonlyMap<string, string>
}

export interface CopierReport {
  name: string
  rows: number
}

export type TripCopier = (
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
  maps: CopierMaps,
) => Promise<CopierReport>

export function registerTripCopier(name: string, fn: TripCopier): void

export interface TripCopyResult {
  days: number
  places: number
  assignments: number
  unscheduled: number // assignments whose source day had no target
  notes: number
  droppedNotes: number // notes whose source day had no target
  extras: ReadonlyArray<CopierReport>
}

export async function copyTripContents(
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
): Promise<TripCopyResult>
```

`registerTripCopier` is idempotent on `name` — re-registering the same name replaces the function
rather than queueing a second pass, so a module imported twice in a test run cannot double-copy.

### `src/routes/_app/-server/trip-lifecycle.ts`

```ts
export const copyTripInputSchema = z
  .strictObject({
    tripId: tripIdSchema,
    title: z.string().trim().min(1, { error: /* shell.copyTrip.titleRequired */ }),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
  })
  .refine((v) => (v.startDate === undefined) === (v.endDate === undefined), {
    error: /* shell.copyTrip.datesTogether */,
  })

export const copyTripFn = createServerFn({ method: 'POST' })   // → { tripId, copyPending: true }
```

Zod v4, `z.strictObject`, `z.iso.date()`, every input validated at the boundary — the contract
`docs/SPEC.md` §6 states and the seven functions already in this file follow. Dates are both present
or both absent: a half-open range is what the clear-dates control produces if it is allowed to clear
one side, and an undated copy is a template rather than a mistake.

### The envelope

```ts
{
  kind: 'trip-copy',
  orgId,
  id: `trip-copy:${targetTripId}`,
  payload: { sourceTripId, targetTripId, requestedBy },
}
```

Declared as one more member of `TASK_KINDS` and one more `z.strictObject()` in the payload map, with
the `error` parameter. `runHandler` (`src/server/queue/consumer.ts:107-155`) gains the matching
`case` **and** `taskHandlers` (`:82-88`) gains the module. Both, because a `case` without a registry
entry falls through to `unhandled()` and dead-letters every message on first delivery. This is not a
hypothetical: measured, `taskHandlers` registers five of the ten declared kinds, and `thumbnail`,
`backup` and the three `billing.*` kinds all have a `case` and no entry — which is exactly the defect
issue #304 is open on. This stage does not add a sixth.

The id is deterministic on the **target** id, which this call mints and which cannot repeat, so a
redelivered message is one job and a second Copy click on the same source is a different trip and a
different envelope. One message, so `enqueueTask` (`src/server/queue/jobs.ts:66`) is the producer and
there is nothing to chunk on this side.

### Travel statistics (decision 9)

`copyTripFn` and the handler each change `tripCount`, `dayCount`, `placeCount` and `cityCount`, so
each enqueues the `travel-stats` envelopes `00-S4` defined, with its deterministic `(user, year)` ids
so repeats collapse. **The recipient set is the trip's members**, read with `listTripMembers`
(`src/server/repos/trips.ts:741`) — not the workspace, because after decision 1 a private trip is
invisible to a non-member and its statistics must be too. For a fresh copy that set is one person,
which is why the fan-out is cheap here; the chunk loop at `QUEUE_BATCH_MAX = 100` is still used,
because the producer's shape and not its current cardinality is what the bound is for. A queue
failure never fails the write: caught, logged once with `serializeError`, and the trip still returns.

## 📝 UI/UX

### `src/routes/_app/-ui/trip-copy-dialog.tsx` — new

`TripCopyDialog`. Every primitive it needs is shipped and reused by name, because a second
implementation of one is a defect: `Dialog`, `Field`, `Input`, the shipped `DateRangePicker`
(`src/components/ui/date-range-picker.tsx:81`), `Button` with its `loading` prop, `Alert`, and
`toast` from `sonner`.

- **Prefilled** from the source: the title with the source's title, the range with the source's
  dates. The reader edits both.
- **Clear dates** turns the copy into an undated template. It clears both ends at once — a
  half-open range is refused by the schema, so the control never produces one.
- **The short-range note** is a single line below the picker, shown only when the chosen range is
  shorter than the source's run: the extra days' places will land in ideas and their notes will be
  dropped. It is a hint, not an `Alert`: nothing is wrong, and a warning colour on a legitimate
  choice trains the reader to ignore warnings.
- **What does not come across** is one line of standing text, always shown. This is where the
  boundary is told, per Q4.
- **Submit** shows `loading`, the dialog cannot be dismissed mid-flight, and on success it closes,
  invalidates the trip list and raises a toast. It does not navigate (Q3).
- **Failure** is a form-level `Alert` on `--color-surface-2` carrying the server's message, with the
  submit button re-armed. The quota refusal arrives here, which is the whole reason both quotas are
  asserted in the synchronous half.

### `src/routes/_app/-ui/trip-actions.tsx` — edit

One `DropdownMenuItem`, **Copy**, above Favourite. It is offered to every reader, because every
reader may copy (decision 6) — so it is the first item in a viewer's two-item menu. Items a role
cannot exercise are not rendered rather than disabled, which is the pattern this file already
follows.

### `src/routes/_app/-ui/trip-card.tsx` — edit

The third resting state, designed rather than implied. While `copy_pending_at` is non-null:

- a `Chip` on the cover reading **Copying** with an inline `Spinner`;
- the cover and the counts behind the shipped `Skeleton` at `--color-surface-2`;
- **the tile is not a link.** A trip whose places have not landed is a planner with an empty day
  list, and handing that to a reader is worse than making them wait;
- `aria-busy` on the tile and an accessible name on the chip, so the state is announced and not only
  drawn;
- the action menu offers **Delete** alone; every other item is `disabled` with a `Tooltip` naming the
  reason.

The tile clears itself on the route's next load — the list already revalidates on focus — and the
completion notification is the second, quieter signal (Q8).

**Copy failed** shows nothing on the grid. When the permanent path has run the trip is gone and the
requester has a notification carrying the reason. The notification centre is where an asynchronous
failure belongs; inventing a second inbox on the trip grid is how two places come to disagree about
what happened.

### Motion and tokens

The dialog uses `Dialog`'s own entrance. `prefers-reduced-motion: reduce` collapses it to opacity,
which the primitive already honours. The chip's spinner is the shipped `Spinner`, which stops
animating under the same query. No token is missing: colour, spacing, radius, shadow and easing all
resolve from `src/styles/tokens.css` as it stands, so nothing is filed for a token stage. Every count
the dialog and the notification print carries `tabular-nums`.

## 📝 Visual change expected

Light and dark, 360 px and 1440 px, for every row.

| Route    | State                       | What changes                                                                                                                                                              |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/trips` | menu open, reader is owner  | A **Copy** item appears at the top of the actions menu. The menu grows by one row; nothing else in it moves.                                                              |
| `/trips` | menu open, reader is viewer | The menu is two items — Copy, Favourite — where it was one.                                                                                                               |
| `/trips` | copy dialog open            | New `Dialog`: title `Input`, `DateRangePicker`, clear-dates control, the standing "what does not come across" line, and the short-range hint when the range is shortened. |
| `/trips` | a tile copying              | One tile shows the **Copying** chip on its cover, skeletonised counts, no link affordance, and a one-item menu. Every other tile is unchanged.                            |
| `/`      | a tile copying              | The dashboard's trip tiles share `TripCard`, so the same state renders there.                                                                                             |
| `/trips` | copy failed                 | **No visual change.** The tile is gone and the notification bell carries the reason. Recorded here so the absence is deliberate, not forgotten.                           |

No change to the trip grid's layout, the search field, the filter row, the archived section, the
empty state (`src/routes/_app/trips/index.tsx:262-290`) or the `CardsSkeleton` (`:317`) — `01-S7`
owns their redesign and this stage is checked against them re-rendered, not against new ones.

Frames of `/trips` as it stands today, and static mockups of both proposed surfaces in light and
dark at both viewports, are in `.ai/specs/assets/copy-a-trip/` — see its `README.md` for how each was
made and what in them is illustrative rather than measured.

Per ADR 0016 the visual judgement is the blind A/B pair, not a pixel baseline: run
`node scripts/visual/capture.mjs --url /trips --out <dir> --label <A|B> --viewports 360x800,1440x900 --themes light,dark --auth`
for `/trips` and `/`, with a fixture seeding one trip with a non-null `copy_pending_at` so the
copying tile renders rather than being a state the pair never sees.

## 📝 Copy

Namespace `shell` (`src/lib/i18n/messages/<locale>/shell.ts`) — where `tripActions.*`,
`editTrip.*`, `deleteTrip.*`, `trips.card.*` and `notification.trip.*` already live. Every key below
lands in all 23 locales in the same change, per the `i18n-messages` skill and `docs/SPEC.md` §9.
English text is the source; each translation is authored from **our** English, never from the
reference product's catalogues, which are AGPL-licensed source.

**New keys — `en` text:**

| Key                                        | Text                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `shell.tripActions.copy`                   | `Copy`                                                                                                  |
| `shell.copyTrip.title`                     | `Copy “{title}”`                                                                                        |
| `shell.copyTrip.nameLabel`                 | `Name the copy`                                                                                         |
| `shell.copyTrip.titleRequired`             | `Give the copy a name.`                                                                                 |
| `shell.copyTrip.datesLabel`                | `Dates`                                                                                                 |
| `shell.copyTrip.datesTogether`             | `Set both dates, or clear them both.`                                                                   |
| `shell.copyTrip.clearDates`                | `Copy without dates`                                                                                    |
| `shell.copyTrip.carries`                   | `Days, places and notes come across. Bookings, money, files and people do not.`                         |
| `shell.copyTrip.shorter`                   | `That is shorter than the original. The extra days’ places move to ideas, and their notes are dropped.` |
| `shell.copyTrip.submit`                    | `Copy trip`                                                                                             |
| `shell.copyTrip.copying`                   | `Copying the trip`                                                                                      |
| `shell.copyTrip.cancel`                    | `Cancel`                                                                                                |
| `shell.copyTrip.started`                   | `Copying “{title}”`                                                                                     |
| `shell.copyTrip.errorTitle`                | `That did not copy`                                                                                     |
| `shell.copyTrip.error`                     | `The trip could not be copied. Try again in a moment.`                                                  |
| `shell.trips.card.copying`                 | `Copying`                                                                                               |
| `shell.trips.card.copyingLabel`            | `{title} is still being copied`                                                                         |
| `shell.trips.card.copyingReason`           | `Wait for the copy to finish.`                                                                          |
| `shell.notification.trip.copied.title`     | `{tripTitle} is ready`                                                                                  |
| `shell.notification.trip.copied.body`      | `{days} days and {places} places came across.`                                                          |
| `shell.notification.trip.copied.dropped`   | `{dropped} note` / `{dropped} notes` (plural)                                                           |
| `shell.notification.trip.copyFailed.title` | `{tripTitle} could not be copied`                                                                       |
| `shell.notification.trip.copyFailed.body`  | `Nothing was left behind. Try again from the original.`                                                 |

`copied.body` and `copied.dropped` are two messages, joined by the renderer with the middle dot,
because that join is a **list and not grammar** — the convention `src/lib/i18n/messages/en/trips.ts`
states in its own header and `collab.count.*` already follows. `copied.dropped` carries plural
branches; `pl`, `ru`, `uk` and `cs` need branches `en` does not have, and `ar` needs six.

`notify()` (`src/server/repos/notifications.ts:129`) is handed a `titleKey`/`bodyKey` pair and a
params record — never a rendered sentence, which is the contract that module's own docstring states.

**No key is removed.** No copy is hardcoded in a component, and no string is composed from
fragments.

## 📝 Edge Cases & Failure Scenarios

| Case                                                           | Behaviour                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copying a trip in another organization                         | `requireTrip` raises `NotFoundError` — the same error a private trip in the caller's own workspace raises, so the answer never reveals that a trip exists.                                                                                |
| Copying a private trip the caller is not a member of           | `NotFoundError`, from the same predicate (`01-S1a`, decision 1).                                                                                                                                                                          |
| Copying a workspace-visible trip the caller is not a member of | Succeeds. The copy is the caller's own and they own it, which is the point of `visibility = 'organization'`.                                                                                                                              |
| The `trips` quota is already full                              | `startTripCopy` refuses before any insert — its first write-path statement, copying `createTrip`'s call at `trips.ts:613`. The dialog shows the refusal.                                                                                  |
| The source's places would cross the `places` ceiling           | Refused synchronously on `<live tenant count> + <source count>`. Asserting current usage alone would admit a copy that crosses on its four-hundredth row, in a consumer, hours later.                                                     |
| The ceiling is crossed by a **concurrent** write after enqueue | The handler re-asserts `places` with the live count before each chunk. Failing there is the permanent path: the target is deleted and the requester notified. Re-asserting per chunk rather than once is what makes a retried chunk safe. |
| The source is deleted mid-copy                                 | Permanent. `deleteTrip` on the target (which cascades), then notify.                                                                                                                                                                      |
| The requester is removed from the workspace mid-copy           | Permanent, at `getMembership`. Same cleanup.                                                                                                                                                                                              |
| A D1 or network error mid-copy                                 | Transient. The handler throws, the queue retries, and the copy is idempotent per chunk because each chunk re-reads the target's current row count before it writes.                                                                       |
| The message is redelivered after success                       | `copy_pending_at` is already null; `copyTripContents` returns without writing a second time. This is the assertion that proves the copy cannot double.                                                                                    |
| The cover object fails to copy                                 | Tolerated (Q6). Logged once; the copy completes and the tile falls back to `CoverArt`.                                                                                                                                                    |
| The source has no cover                                        | The pass is skipped. Not an error.                                                                                                                                                                                                        |
| A registered copier throws                                     | Transient by default — the queue retries the whole handler, and each copier is required to be idempotent, which is stated in `TripCopier`'s docstring and is the price of registering one.                                                |
| An undated source copied into a dated range                    | `startTripCopy` builds the run from the range; the target has days, so the first pass only maps by `day_number` and the source's `1..n` map onto the target's first n.                                                                    |
| A dated source copied with dates cleared                       | The target has no run, so `copyTripContents` inserts one: numbered `1..n`, `date: null`, titles and notes carried.                                                                                                                        |
| A longer target range than the source                          | The extra days exist and are empty. Nothing is dropped and nothing is counted.                                                                                                                                                            |
| A place with tags whose `tag_id` was deleted mid-copy          | The `place_tags` insert fails its foreign key; transient, retried, and the tag is simply absent on the next pass because the source row is gone too.                                                                                      |
| Two readers copy the same source at once                       | Two targets, two ids, two envelopes. The deterministic id is on the target, so they never collide.                                                                                                                                        |
| The `DB` binding is missing from the consumer                  | The same hard error `travel-stats` raises. It is a deployment defect, and failing loudly is what makes it one.                                                                                                                            |

## 📝 Risks & Impact Review

**Blast radius.** Six edited files and three new ones, all inside `01-S1d`'s owned paths. The two
shared-ish surfaces are `src/server/queue/types.ts` (one union member, one payload schema) and
`src/server/queue/consumer.ts` (one `case`, one registry entry) — additive, and the pattern
`trip-purge` set two slices ago.

**The riskiest edit is `trips.ts`.** It is the module `01-S1a` reshaped and every trip reader in the
product goes through it. This stage only adds to it: no existing export changes signature, and
`requireTrip`, `assertTripRole`, `createTrip` and `deleteTrip` are called, not edited.

**Backward compatibility.** Nothing here is a protected surface. The task-kind union widens, which is
additive: an old consumer meeting a `trip-copy` envelope dead-letters it rather than mis-handling it,
and producer and consumer deploy in the same Worker.

**Rollback.** Remove the menu item and the copy is unreachable; the handler and the kind can stay
because nothing produces envelopes. A copy already made is an ordinary trip and needs no undo. The
one state that would survive a mid-flight rollback is a trip stamped `copy_pending_at` with no
consumer to clear it — a tile stuck on "Copying". `pnpm wrangler d1 execute` clearing the stamp is
the manual remedy, and it is recorded here rather than discovered.

**What has no undo.** Nothing. The copy creates; it never mutates the source. This is the rare write
in this area whose reversibility story is "delete the thing it made", which the shipped delete
already does.

**Tenant isolation is the security surface**, and it is where a two-phase copy can leak in a way a
one-phase copy cannot — the handler's scope comes from an envelope rather than from a request. The
tests below assert both directions of that, twice: once with a request-shaped scope and once with a
scope built the way the handler builds one.

## 📋 Phasing

Two phases. Phase 1 leaves the app working and shipping nothing user-visible; Phase 2 turns it on.

- **Phase 1 — the two halves and the handler.** Repository, storage helper, queue kind, handler,
  server function, and every unit and isolation test. No UI, so no user can reach it.
- **Phase 2 — the dialog and the tile.** The menu item, the dialog, the copying state, the 23-locale
  copy, and the e2e block.

## 📋 Implementation Plan

Each step leaves the application working and is verified by
`pnpm typecheck && pnpm lint && pnpm test` at minimum; the steps that name a browser add
`pnpm build && pnpm e2e`.

### Phase 1 — the two halves and the handler

1. **`copyObject` in `src/server/storage/objects.ts`.** Add it beside `deleteObjects`, using the same
   `ObjectStore` interface. → _Test:_ a unit case in `src/server/storage/__tests__/` proving the
   target key differs from the source's and that a missing source is an error rather than a silent
   no-op.
2. **`MAX_BOUND_PARAMETERS` and the chunk helper in `trips.ts`.** The constant with D1's limit cited
   beside it, and the small `chunkFor(columns)` the passes share. → _Test:_ `chunkFor(25) === 4`,
   `chunkFor(3) === 33`, `chunkFor(200) === 1`.
3. **`startTripCopy`.** Both quota assertions, the slug, the trip row through `createTrip`'s path,
   the `copy_pending_at` stamp, the owner membership. → _Test:_ after it runs, the target has exactly
   the trip row, one member and — when dated — the day run, with zero places, zero assignments, zero
   notes and a non-null stamp. This is the assertion that fails if anyone moves inventory work into
   the request path.
4. **The copier registry.** `registerTripCopier`, `TripCopier`, `CopierReport`, and the ordered list.
   → _Test:_ two fakes registered in a known order run in that order and both reports reach the
   result; re-registering a name replaces rather than appends.
5. **`copyTripContents`.** The seven passes, in order, with the chunk loop and `runBatch` for the
   assignment remap. → _Test:_ the copy is plan and not record — day, place, tag, assignment and note
   counts equal the source's, and zero expenses, files, reservations and share links; the copy is
   independent of its source, proved by deleting the source and re-reading the copy whole; the chunk
   bound holds, asserted as an `insertMany` call count over a source with more rows than one chunk
   carries; a five-day source into a three-day range gives three days with the overflow's places
   unscheduled and its notes counted; an undated copy gets a numbered dateless run and a dated one
   gets `syncTripDays`'s, asserted by the day rows' `date`; the stamp is cleared exactly once and a
   re-run copies nothing.
6. **The `trip-copy` kind and payload** in `src/server/queue/types.ts`, and the `case` **plus** the
   registry entry in `consumer.ts`. → _Test:_ **a new case in
   `src/server/queue/__tests__/consumer.test.ts` that walks `TASK_KINDS` and asserts every kind
   resolves to a registered handler.** Measured, that test does not exist: the eleven cases in that
   file (`:128-320`) cover redelivery, dead-lettering and backoff, and the closest one — "dead-letters
   a kind with no registered handler" (`:230`) — proves the _fallback_ works rather than that no kind
   needs it. That gap is how five of the ten declared kinds came to dead-letter every message they
   are sent (issue #304). Adding the walk here costs four lines and closes it for every future kind,
   not only this one. It will fail on the six that are already broken, so it ships with an explicit
   allow-list naming those five and citing #304 — a red test nobody can merge past is the point, and a list
   that shrinks to empty when #304 lands is the receipt.
7. **`src/server/queue/handlers/trip-copy.ts`.** Scope rebuilt from the envelope, the permanent and
   transient classification, the cleanup, the notification, the travel-stats fan-out. → _Test:_ a
   handled message copies the inventory, clears the stamp and writes one notification; a second
   delivery finds the stamp null and returns without writing; a requester who is no longer a member
   is permanent with the target gone; a crossed ceiling is permanent; a transient D1 error throws and
   leaves the target in place; a cover failure is tolerated and the copy still completes.
8. **`copyTripFn` and its Zod input.** Including the both-or-neither date refinement and the
   travel-stats envelopes. → _Test:_ a half-open range is refused by the schema; the fan-out chunks at
   `QUEUE_BATCH_MAX`, asserted with 250 envelopes and three calls; a queue failure is logged and the
   write still returns.
9. **Tenant and member isolation.** Append the `trip lifecycle` cases to
   `src/server/repos/__tests__/tenant-isolation.test.ts`: in A's scope, `startTripCopy` on B's trip is
   `NotFoundError`; `copyTripContents(scopeA, bTripId, aTargetTripId)` is `NotFoundError` and writes
   nothing into A's target; `copyTripContents(scopeA, aSourceTripId, bTripId)` is `NotFoundError` on
   the target. Each case is run again with a scope built the way the handler builds one, so the
   rejection is shown to come from the tenant filter and not from a server function the consumer does
   not have. Append the copy cases to `member-isolation.test.ts` as well: `alpha-2`, a workspace
   member on none of the trips, gets `NotFoundError` from `startTripCopy` on a private trip and
   succeeds once its `visibility` is `organization`.

### Phase 2 — the dialog and the tile

10. **The 23-locale copy.** Every key in the **Copy** section, `en` first, then all 22 others per the
    `i18n-messages` skill. → _Test:_ the i18n parity test — no missing key, no orphan, no non-`en`
    value byte-identical to `en` outside the proper-noun allow-list.
11. **`TripCopyDialog`.** The form, the prefill, the clear-dates control, the short-range hint, the
    standing boundary line, the loading and error states. → _Test:_ a component test proving the hint
    appears only for a shortened range, that clearing dates clears both ends, and that the dialog
    cannot be dismissed while the submit is in flight.
12. **The Copy menu item** in `trip-actions.tsx`, offered to every reader. → _Test:_ a viewer's menu
    renders exactly Copy and Favourite.
13. **The copying tile state** in `trip-card.tsx`: chip, skeletons, `aria-busy`, no link, one-item
    menu. → _Test:_ a component test on a tile with a non-null `copyPendingAt` asserting the tile is
    not a link, carries `aria-busy`, and offers Delete alone.
14. **The e2e block.** One `test.describe` appended to `e2e/trips-core.spec.ts` — the two blocks
    already there are `01-S3` and `01-S1` — covering the dialog and the copying tile, with a silent
    console. Behaviour is the assertion; ADR 0016 retired the visual gate.
15. **The blind A/B pair** for `/trips` and `/`, per **Visual change expected**, with the fixture that
    seeds a copying trip.

### Out of scope, recorded so it is not re-derived

Copying the record — reservations, transports, expenses, files, conversations, share links and
people — stays behind by design (decision 4b). The budget-line, cost-category, packing and to-do
copiers arrive through the registry in `04-budget-and-currencies.md` and `05-packing-and-todos.md`,
in the stages that own those tables, and not through this ticket. Copying across workspaces is not a
capability this product has. `trips.is_favourite`, retired by `01-S1b`, is issue #206's to remove and
is not touched here.
