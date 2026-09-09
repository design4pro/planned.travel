# A day note you can write: the guard, the detail, the icon and the editor

Source plan: `docs/plans/01-trips-core.md`, stage `01-S2b` — the second and last slice of `01-S2`.
Tracker: FR #113, parent PRD #104, decisions 6, 9 and 10. Reference row `TRP-09`.
Measured on `develop` at `3ec86e74`.

## 📝 TLDR

A day note can be read and cannot be written. There is no editor, no icon, no detail body and no
ordering control, and — the part that is a defect rather than a gap — `createDayNote` writes a
client-chosen `dayId` without ever asking whether that day belongs to the trip, and no note write
asks the reader's trip role, so a `viewer` may add, rewrite and delete every note on a trip they are
only allowed to read.

This spec closes both holes, gives a note an icon from a fixed vocabulary and an optional markdown
detail rendered through the module `01-S2a` already shipped, and builds the row and the editor that
show them.

**The ticket was groomed before `01-S4a` (#115) merged, and four of its instructions are now wrong.**
Correcting them is the substance of this document: there is **no migration** (the `detail` column
already ships); the note reorder **must not renumber notes to `0..n-1`** and in fact needs no new
repository verb at all, because `reorderDayTimeline` already owns the day's number line;
`deleteDayNote` **does** need a guard the plan says it does not; and the composed guard **cannot live
in `src/server/repos/days.ts`** without closing an import cycle.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written by an unattended `om-auto-write-spec` run. Each question below was resolved
with the most reversible, smallest-scope answer. Override any of them on this PR before it merges.

| #   | Question                                                                                                                                                                                                                                                                                                  | Resolution                                                                                                                                                                                                                                                                                                                                | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | The ticket says `reorderDayNotes` "renormalises to a dense `0..n-1` run". Still correct?                                                                                                                                                                                                                  | **No — it is a defect.** There is no new repository verb. The note reorder is expressed as a full day sequence and written by the shipped `reorderDayTimeline`.                                                                                                                                                                           | `01-S4a` (#115, merged) made `day_assignments.order_index` and `day_notes.sort_order` two halves of **one** sequence: `reorderDayTimeline` (`src/server/repos/itinerary.ts:472`) sorts both tables onto one line and writes the array index back into whichever column the row came from (`:537-559`). Renumbering notes `0..n-1` would land note _k_ on top of stop _k_. Sending the whole day through the shipped verb is the same user-visible behaviour with none of that blast radius — and it inherits that function's dedupe (`:506-512`), its "drop what this day does not hold" rule, and its single `runBatch`. |
| Q2  | Then how does the client express "move this note up" without knowing the day's merged positions?                                                                                                                                                                                                          | **It does not — the server builds the sequence.** `reorderDayNotesFn` takes `{ tripId, dayId, noteIds }`, reads the day's stops and notes through the two repository readers, rebuilds the merged sequence with the stops left in their slots and the note slots refilled in the requested order, and hands that to `reorderDayTimeline`. | The client cannot build the merged sequence: `PlanBoardStop` publishes no `orderIndex` (`-server/plan.ts:130-138`) and `-server/plan.ts` belongs to `07-S1` in this wave. Doing the merge in the new owned server module needs no widening of anything, and the slot-refill is a pure function that unit-tests against literals.                                                                                                                                                                                                                                                                                          |
| Q3  | Where does a newly created note land?                                                                                                                                                                                                                                                                     | **At the end of the day's merged line.** The server function computes `max(order_index ∪ sort_order) + 1` for the day and passes it as `sortOrder`; `createDayNoteInput` already accepts the field.                                                                                                                                       | `day_notes.sort_order` is `real NOT NULL DEFAULT 0` (`schema.ts:161`, `:1031`), and `listTripDayNotes` orders by `(sort_order, id)` (`days.ts:225`). The moment any day is reordered — which densifies it — a new note taking `0` sorts **above every older note in the run the reader is looking at**. Mirroring `nextOrderIndex` (`itinerary.ts:337`) over notes alone would still collide with stops, so the max is taken over both tables.                                                                                                                                                                            |
| Q4  | Where does the composed write guard live?                                                                                                                                                                                                                                                                 | **Split by layer.** The repository (`days.ts`) gains `requireTripDay` on `createDayNote` — the structural refusal. The route module gains `writableTripDay`: `requireTrip` → archived refusal → `assertTripRole(['owner','editor'])` → `requireTripDay`, and every one of the four writes opens with it.                                  | The plan wanted the whole composition in `days.ts`. It cannot go there: `trips.ts:45` already does `import { syncTripDays } from './days'`, so `days.ts` importing `requireTrip`/`assertTripRole` closes a cycle. Every module that composes both today (`itinerary.ts`, `reservations.ts`, `transports.ts`) is a **leaf consumer** of the two. `-server/plan.ts` draws the same line in the same place: `writableTrip` (`:100`) plus `assertTripRole` (`:365`) in the route module, `requireTripDay` in the repository. See Risks for the residue and the follow-up that removes it.                                     |
| Q5  | The archived-trip and `FORBIDDEN` refusals never reach the reader — `classifyFailure` puts every `RepositoryError` in `unexpected` (`errors/public.ts:33`, `:110`), so `failureRedactionMiddleware` redacts the sentence and files a Sentry event for a refusal that is the product working. Fix it here? | **No — refuse before offering.** `PlanNotesPayload` carries `canWrite`, and the note affordances are absent when it is false. The `classifyFailure` widening is a filed follow-up.                                                                                                                                                        | This removes the **reachable** case inside Owned paths: `loadPlanBoard` computes `editable: !trip.isArchived` with no role term (`-server/plan.ts:189`), so a viewer on an organization-visible trip is offered controls the repository then refuses. What is left is the stale-tab backstop, which `writableTrip`'s own docblock already calls a backstop. Widening `AUTHORED_ERROR_NAMES` touches a file outside Owned paths and changes what every repository error in the product says to a browser.                                                                                                                  |
| Q6  | Does `updateDayNote` gain a `dayId`, so a patch can move a note between days?                                                                                                                                                                                                                             | **No.** `updateDayNoteInput` keeps its shape and a note stays on its day.                                                                                                                                                                                                                                                                 | No caller in this slice moves a note between days, and `01-S4b` owns cross-day movement. Adding the field now is a public contract written for a caller that does not exist — and with no client-chosen `dayId` there is no cross-day patch left to guard. The isolation case the ticket wanted from it moves to `01-S4b` with the field.                                                                                                                                                                                                                                                                                 |
| Q7  | How large is the icon vocabulary, given the enum rejects everything outside it?                                                                                                                                                                                                                           | **Nineteen** — the ten names the seed already writes, plus nine a traveller reaches for.                                                                                                                                                                                                                                                  | **This is a blocker the ticket does not see.** `src/routes/api/dev/-seed/apply-trip.ts:191-198` writes day pins through `createDayNote`, passing `pin.icon` straight from `dataset/flagship.ts`, which carries `alarm-clock`, `clock`, `flashlight`, `footprints`, `info`, `luggage`, `package`, `ticket`, `train-front` and `wifi`. A narrower enum makes `pnpm worktree:bootstrap`, the demo workspace and `bash .ai/scripts/e2e.sh` fail at the first pin. The vocabulary is therefore the union of what the picker offers and what the fixture already stores.                                                        |
| Q8  | Where does `DAY_NOTE_ICONS` live, given both the Zod enum and the picker read it?                                                                                                                                                                                                                         | **`src/components/planner/types.ts`**, re-exported from `src/server/repos/days.ts`.                                                                                                                                                                                                                                                       | The picker needs the **value**, and importing `days.ts` from a dialog pulls Drizzle and the whole schema into the browser bundle. `src/server/errors/public.ts` already imports a client-safe constant from `src/components/layout/session` — the same seam in the same direction. Both files are owned here.                                                                                                                                                                                                                                                                                                             |
| Q9  | Does the planner's presentational directory call `useTranslate()` directly?                                                                                                                                                                                                                               | **Yes**, for this slice's own strings.                                                                                                                                                                                                                                                                                                    | `eslint.config.js:44-76` fences `src/components/ui` off from `#/server/*` and `drizzle-orm` and says nothing about i18n — four `components/ui` modules import it today. No boundary is crossed. `planner/types.ts`'s "arrives already formatted" docblock is about locale-dependent **data** — a weekday, a duration — which stays in the route adapter. The strings `day-section.tsx` hardcodes today are issue #198's and are not touched.                                                                                                                                                                              |

## 📝 Problem Statement

Every claim below was read on `develop` at `3ec86e74`.

| Piece                                                                          | State at HEAD                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `day_notes.detail`                                                             | **Exists.** `schema.ts:1027`, landed in `drizzle/0006_mighty_nehzno.sql`. Written by nothing, read by nothing.                                                                                                                                                                |
| `src/lib/markdown/parse.ts`, `render.tsx`                                      | **Exist**, shipped by `01-S2a` (#112). `parse()` returns a readonly discriminated node tree; `Markdown` renders it. Imported by nothing in the planner.                                                                                                                       |
| `createDayNote` (`repos/days.ts:229`)                                          | Parses and inserts. **No `requireTripDay`, no membership check, no role check, no archived check, no position.**                                                                                                                                                              |
| `updateDayNote` (`:240`)                                                       | `requireUpdate` and nothing else. A `viewer` may rewrite any note of a trip they may only read.                                                                                                                                                                               |
| `deleteDayNote` (`:252`)                                                       | `requireRemove` and nothing else. Same hole. The plan says this verb needs no guard; it is wrong about the role.                                                                                                                                                              |
| `requireTripDay` (`:104`)                                                      | Exists, raises `NotFoundError` when the day is not the trip's. **Called by `itinerary.ts`, never by the note writers.**                                                                                                                                                       |
| `requireTrip`, `assertTripRole` (`repos/trips.ts:319`, `:374`)                 | Exist. `assertTripRole` throws `TripRoleError` under code `FORBIDDEN`. `trips.ts:45` imports `./days`, so `days.ts` cannot import them back.                                                                                                                                  |
| `DAY_NOTE_ICONS`                                                               | Absent. `createDayNoteInput.icon` is `shortTextSchema.min(1).optional()` (`days.ts:55`) — any string up to the short-text cap is stored and rendered as a name that resolves to nothing.                                                                                      |
| `src/routes/_app/trips/$tripId/-server/day-notes.ts`                           | Absent. The directory holds `plan.ts` and `__tests__/`.                                                                                                                                                                                                                       |
| `src/components/planner/note-row.tsx`, `-ui/note-dialog.tsx`                   | Absent.                                                                                                                                                                                                                                                                       |
| The note render                                                                | `day-section.tsx:172-196` — a separate `<ul>` after the stop list: `StickyNote` + optional time + `body`, from `PlanBoardDay.notes` (`{ id, body, time }`, `-server/plan.ts:148-152`, projected at `:219-223`). No icon, no detail, no controls.                              |
| `reorderDayTimeline` (`itinerary.ts:472`)                                      | **Ships.** Merges `day_assignments` and `day_notes` onto one position line, dedupes, drops unknown ids, splices omissions back behind their predecessor (`:519-533`), writes one `runBatch`. Guarded `requireTrip` → `assertTripRole(['owner','editor'])` → `requireTripDay`. |
| `reorderPlanFn` (`-server/plan.ts:357`)                                        | **Ships**, accepts `{ kind: 'note' }` items, opens with `writableTrip` then `assertTripRole`, mirrors the result to the trip room.                                                                                                                                            |
| `mergeDayTimeline`, `noteItemId` (`components/planner/ordering.ts:246`, `:68`) | **Ship**, client-side and pure. The reader's order within a day is inherited-time first, position as tiebreak.                                                                                                                                                                |
| `loadPlanBoard`'s `editable` (`-server/plan.ts:189`)                           | `!trip.isArchived`. **No role term** — a viewer is offered every write control on an organization-visible trip.                                                                                                                                                               |
| `classifyFailure` (`errors/public.ts:87`)                                      | `AUTHORED_ERROR_NAMES` holds three names, none of them a `RepositoryError`. Every repository refusal is classified `unexpected`, redacted, and files a Sentry event.                                                                                                          |
| `src/lib/i18n/messages/en/trips.ts`                                            | **Exists**, 133 lines. All 23 locales carry the namespace.                                                                                                                                                                                                                    |
| `e2e/__screenshots__/`                                                         | **Does not exist**, and no `visual.spec.ts` is in the repo. ADR 0016 retired the pixel gate.                                                                                                                                                                                  |
| `scripts/visual/capture.mjs`                                                   | **Exists.** `docs/SPEC.md` §7 item 4 makes the blind A/B pair the whole of the visual judgement.                                                                                                                                                                              |

### The defect, stated exactly

`createTenantRepository().insert` stamps `organization_id` from the caller's scope. A POST from
tenant A carrying tenant B's `dayId` therefore does not fail — it writes a row **owned by A** whose
`day_id` points at **B's day**. The row is invisible to B and corrupt for A. `requireTripDay` was
written for exactly this and is never called from the note writers. The same call also refuses A's
own day taken from a different trip of A's, which the tenant filter alone lets through.

The second half is authorization. PRD #104 decision 6 says a `viewer` reads the plan and writes none
of it, and a non-member of a private trip sees none of it. No note write asks either question, and
the screen offers the controls to a viewer because `editable` carries no role term.

## 📝 Proposed Solution

Four moves, in dependency order.

1. **Refuse the write that must not happen, at the boundary that owns it.** `createDayNote` opens
   with `requireTripDay(scope, values.tripId, values.dayId)` — a function already local to `days.ts`,
   so no import edge changes.

2. **Decide who may act, one layer up.** `writableTripDay(scope, tripId, dayId)` in the new
   `-server/day-notes.ts`: `requireTrip` (tenancy and the `01-S1a` read predicate) → refuse
   `trip.isArchived` → `assertTripRole(scope, tripId, ['owner','editor'])` → `requireTripDay`. In
   that order, because a caller who may not _see_ the trip must learn only `NotFoundError`, and
   `FORBIDDEN` is safe only after they have proved they may — the order `requireOwnedTrip`
   (`trips.ts:400`) and `reorderDayTimeline` already use. All four writes open with it.

3. **The note gains the three fields it was always specified to have.** `icon` narrows from free text
   to `z.enum(DAY_NOTE_ICONS)` over the nineteen names; `detail` becomes `longTextSchema.nullish()`,
   with blank mapped to `null` at the route boundary; the position is computed rather than defaulted.

4. **The row, the editor and the move.** `NoteRow` renders icon, headline, tabular time, an actions
   cluster and — only when there is a detail — a disclosure that reveals it through
   `src/lib/markdown`. `NoteDialog` puts the text area and a live preview side by side above 640px and
   behind tabs below it. Move up and move down rebuild the day's sequence server-side and write it
   through `reorderDayTimeline`.

### Alternatives considered

- **A new `reorderDayNotes` in the repository, renumbering notes `0..n-1`, as the ticket says.**
  Rejected: it corrupts the merged line (Q1). This is the most consequential correction here.
- **A note-local permutation that writes back only the positions the notes already hold.** Considered
  and rejected: it is a no-op whenever two notes share a position — which is the default state, since
  `sort_order` defaults to `0` — and it has to re-derive dedupe and omission rules that
  `reorderDayTimeline` already has right.
- **Route the reorder through `reorderPlanFn` from the client.** Rejected: the client cannot build the
  merged sequence without stop positions, and the file that would publish them is `07-S1`'s (Q2).
- **Put the whole composed guard in `days.ts`.** Rejected: import cycle (Q4).
- **Widen `AUTHORED_ERROR_NAMES` so refusal sentences reach the reader.** Deferred (Q5).

## 📝 Architecture

```
plan.tsx (loader)
  └─ Promise.all([ loadPlanBoard, loadDayNotes ])        ← both server functions, both server-side
       └─ PlanScreen({ payload, notes })
            ├─ plan-model.ts   → PlannerNote[] per day   ← pure adapter
            ├─ DaySection      → NoteRow[] + add control
            │    └─ NoteRow    → Markdown(detail)        ← src/lib/markdown, shipped by 01-S2a
            └─ NoteDialog      → create / update         ← new, mounted by plan-screen.tsx

-server/day-notes.ts  (new, route-local, a leaf consumer of repos/days + repos/trips + repos/itinerary)
  writableTripDay · nextNotePosition · noteSlotOrder (pure)
  loadDayNotes · createDayNoteFn · updateDayNoteFn · deleteDayNoteFn · reorderDayNotesFn
       └─ contains no SQL                                 (docs/SPEC.md §6)

repos/days.ts (edit)
  requireTripDay on createDayNote · icon enum · detail · DAY_NOTE_ICONS re-export
```

**Boundaries.** Every statement this change runs is a repository call; the module under `-server/`
holds no SQL (`docs/SPEC.md` §6). `src/components/planner` imports nothing from `server/`.
`src/lib/markdown` is imported, never re-implemented — the register in
`docs/plans/11-boundaries-and-blockers.md` calls a second implementation a defect. No import cycle is
created (Q4).

**Concept ownership (`docs/SPEC.md` §8).**

| Concept                                                | Owner                                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| The day's position line, and every write to it         | `src/server/repos/itinerary.ts` — unchanged, and this change adds no second writer |
| Structural validity of a note row                      | `src/server/repos/days.ts`                                                         |
| Who may write a note, and the position a new one takes | `src/routes/_app/trips/$tripId/-server/day-notes.ts`                               |
| The icon vocabulary (value)                            | `src/components/planner/types.ts`; `days.ts` re-exports it for the enum            |
| The note view model                                    | `src/routes/_app/trips/$tripId/-ui/plan-model.ts`                                  |
| The note's copy                                        | the `trips` message namespace                                                      |

**Nothing enqueued, no Durable Object patch.** A note write invalidates the router like every other
planner write. `reorderDayNotesFn` does **not** mirror to the trip room: `reorderPlanFn` mirrors
because the drag is a live collaborative gesture, and `01-S4b` folds the note move into that gesture.
Mirroring here would publish a `day` patch the collaborative client does not yet read for notes.

## 📝 Data Model

**No migration.** `day_notes.detail` is `text` and nullable already (`schema.ts:1027`,
`drizzle/0006_mighty_nehzno.sql`), which was the whole of this stage's filed schema requirement.
`icon` keeps `NOT NULL DEFAULT 'sticky-note'` and gains no `CHECK`: drizzle-kit emits a full table
rebuild for a constraint change on SQLite, a poor trade for an invariant the Zod enum holds exactly.
No index is added — `day_notes_org_trip_idx` and `day_notes_day_sort_idx` already exist
(`schema.ts:1035-1036`) and `detail` is not a filter.

`pnpm db:generate` must report no drift. If it does, something touched `schema.ts` and the change is
wrong.

### The position line

`day_assignments.order_index` and `day_notes.sort_order` are both `real NOT NULL DEFAULT 0` and, since
`01-S4a`, are two halves of one sequence per day. Two operations follow, and neither is a new writer.

**Insert.** `nextNotePosition(scope, dayId)` reads both tables through `listDayAssignments` and
`listDayNotes` and returns `max(order_index ∪ sort_order) + 1`, or `0` for an empty day.
`createDayNoteFn` passes it as `sortOrder`, which `createDayNoteInput` already accepts.

**Move.** `reorderDayNotesFn` rebuilds the day and hands it to `reorderDayTimeline`:

```
current = [ ...stops  → { kind: 'stop', id, position: orderIndex },
            ...notes  → { kind: 'note', id, position: sortOrder } ]
          .sort(by position, then id)                        ← the sort reorderDayTimeline itself uses

ordered = dedupe(noteIds ∩ ids(notes))                       ← foreign and repeated ids dropped
for each note of current, in order, that ordered does not name:
    splice it into ordered directly behind its predecessor
    note in current, or at the front when it has none        ← an omission moves nothing

items   = current.map(entry => entry.kind === 'stop' ? entry : ordered.shift())

reorderDayTimeline(scope, { tripId, dayId, items })
```

Because `items` names every row of the day, `reorderDayTimeline`'s dedupe and splice branches are
no-ops and it simply writes `position = index`. That is also why `ordered` splices the omitted notes
back itself, with the rule `reorderDayTimeline` applies at `itinerary.ts:519-533`: appending them to
the end would move every omitted note into the day's last note slots, and no downstream branch is
left to rescue them. The consequences are the point:

- **Stops never move.** Each stop keeps the slot index it held in `current`.
- **Ties are resolved, permanently.** A day whose notes all sit at the default `0` comes out dense
  and distinct, so the next move is a real move. A permutation that wrote back only the positions the
  notes already held would be a no-op on exactly that day — the common one.
- **One owner.** The only code that writes the position line is still `reorderDayTimeline`.

Worked example, day `d1` holding `s1@0`, `n1@0`, `s2@1` and `n2@2` — a stop and a note tied at `0`,
so the id breaks it — and the reader moves `n2` above `n1`:

|                                    | before                   | after                    |
| ---------------------------------- | ------------------------ | ------------------------ |
| `current` (sorted by position, id) | `n1@0, s1@0, s2@1, n2@2` | —                        |
| `ordered`                          | —                        | `[n2, n1]`               |
| `items`                            | —                        | `n2, s1, s2, n1`         |
| written positions                  | `0, 0, 1, 2`             | `n2=0, s1=1, s2=2, n1=3` |

The stops keep their relative order and their slots; the notes swap; nothing is left tied.

## 📝 API Contracts

### Repository — `src/server/repos/days.ts` (edit)

```ts
export async function createDayNote(scope, input): Promise<DayNote>
// gains, as its first statement:
//   const values = createDayNoteInput.parse(input)
//   await requireTripDay(scope, values.tripId, values.dayId)

createDayNoteInput // icon: z.enum(DAY_NOTE_ICONS).optional()   ← was shortTextSchema.min(1).optional()
// detail: longTextSchema.nullish()          ← new
updateDayNoteInput // unchanged shape; inherits both through .omit({tripId,dayId}).partial()

export { DAY_NOTE_ICONS, type DayNoteIcon } from '#/components/planner/types'
```

`icon` is `.optional()` and never `.nullish()`: the column is `NOT NULL` with a default, so an
omitted icon takes the default and an explicit `null` is a rejection, not a reset. `updateDayNote`
and `deleteDayNote` are **not** changed — with no client-chosen `dayId` (Q6) there is no structural
refusal left for them to make, and their missing term is the role, which the layer above supplies.

### Server functions — `src/routes/_app/trips/$tripId/-server/day-notes.ts` (new)

| Function            | Method | Input                                              | Returns             |
| ------------------- | ------ | -------------------------------------------------- | ------------------- |
| `loadDayNotes`      | GET    | `{ tripId }`                                       | `PlanNotesPayload`  |
| `createDayNoteFn`   | POST   | `{ tripId, dayId, body, detail, time, icon }`      | `{ noteId }`        |
| `updateDayNoteFn`   | POST   | `{ tripId, noteId, body?, detail?, time?, icon? }` | `{ noteId }`        |
| `deleteDayNoteFn`   | POST   | `{ tripId, noteId }`                               | `{ deleted: true }` |
| `reorderDayNotesFn` | POST   | `{ tripId, dayId, noteIds }`                       | `{ dayId }`         |

```ts
export interface PlanNote {
  readonly id: string
  readonly dayId: string
  readonly body: string
  readonly detail: string | null
  readonly time: string | null
  /** As stored. Narrow at the render boundary, never here — see below. */
  readonly icon: string
  readonly sortOrder: number
}

export interface PlanNotesPayload {
  readonly tripId: string
  /** The acting user may write notes: owner or editor, and the trip is not archived. */
  readonly canWrite: boolean
  readonly notes: ReadonlyArray<PlanNote>
}
```

- **The read** resolves the trip with `requireTrip`, so a non-member of a private trip gets
  `NotFoundError` and learns nothing, then `listTripDayNotes` — one indexed query for the whole trip
  rather than one per day: `day_notes_org_trip_idx` leads with `organization_id`, so D1 charges for
  the trip's notes rather than for a scan. `canWrite` is `!trip.isArchived && role ∈ {owner, editor}`.
- **Every write** opens with `writableTripDay`, so a note cannot be written onto an archived trip,
  onto a day of another trip, by a non-member, or by a viewer. `updateDayNoteFn` and
  `deleteDayNoteFn` resolve the note row first and guard the trip and day **that row names** — the
  client's `tripId` addresses the note, it never chooses what is guarded.
- **`PlanNote.icon` is a `string`, not `DayNoteIcon`.** The enum is a **write** constraint: it lands
  in Step 3 and no migration or `CHECK` narrows what is already stored, so every row written while
  `icon` was `shortTextSchema.min(1).optional()` (`days.ts:55`) may hold any short string. Typing the
  read as `DayNoteIcon` would make the loader lie about its own rows and force an unsound cast to
  produce the case the Step 8 test names. The fallback belongs where it already lives in this
  codebase — the render registry, exactly as `categoryIcon(name: string | null | undefined)` takes it
  (`map/category-icon.tsx:86`). `DayNoteIcon` stays the type of what the picker sends.
- **`reorderDayNotesFn`** additionally bounds its input at `z.array(idSchema).max(200)`, matching
  `reorderDayTimelineInput` (`itinerary.ts:123`), so one request cannot ask for an unbounded batch.
- **Blank means "no value".** `detail` and `time` arrive as trimmed strings and are mapped through a
  local `blankToNull`, the shape `-server/plan.ts` already uses (`:84-86`) — otherwise
  `longTextSchema`'s trim yields `''`, `definedOnly` treats it as defined (`days.ts:248`), and an
  emptied detail is stored as an empty string rather than cleared.
- **Zod v4**, `z.strictObject()` with the `error` parameter, one repository call deep. The
  blank-tolerant `HH:MM` union is re-declared here: `-server/plan.ts`'s `timeOrBlank` (`:76`) is
  module-private and exporting it means editing a file this stage does not own. `01-S4b` owns both
  modules and may lift it into a shared one.
- **The archived refusal is a plain `Error` carrying the same sentence as `writableTrip`
  (`-server/plan.ts:103`).** It classifies as `unexpected` and is redacted, exactly as the planner's
  existing archived refusal already is — this adds no new class of problem, and Q5's follow-up fixes
  both at once. It is reachable only from a stale tab, because `canWrite` removes the affordance.

**The board's own note projection is not extended, and it is not left to rot.** `loadPlanBoard` keeps
projecting `{ id, body, time }` (`-server/plan.ts:148-152`) for one wave, because `07-S1` holds that
file. From this change nothing reads it — `plan-model.ts` builds every note from `PlanNotesPayload` —
and `01-S4b` deletes it as part of the merged read. One wave of a dead field, stated here so it is
not found as a surprise.

## 📝 UI/UX

**Route.** None added, moved or renamed, so `src/routeTree.gen.ts` does not change and
`pnpm generate-routes` is not a step. `plan.tsx` changes in its `loader` only: it awaits
`loadPlanBoard` and `loadDayNotes` with `Promise.all` and hands both to `PlanScreen`. Both are server
functions, so neither pulls D1 into the browser bundle, and the second adds one indexed read to the
server render and no client round trip.

**`NoteRow`** (`src/components/planner/note-row.tsx`, new) — one note in a day section:

- the icon from a curated static registry of the nineteen names, in a `--color-surface-inset` tile. A
  registry rather than `lucide-react`'s dynamic loader, for the reason
  `src/components/map/category-icon.tsx` already records: the dynamic loader ships a chunk per icon
  and resolves after paint. An unrecognised stored name falls back to `sticky-note`, never to nothing;
- the headline in the UI face, the optional time in `tabular-nums`;
- a disclosure **only when `detail` is non-empty** — a real `button` with an accessible name, never a
  present-and-disabled control. Open, the detail renders through `Markdown`, clamped to two lines with
  the rest revealed; long content scrolls its own container rather than growing the day rail;
- an actions cluster: move up, move down, edit, delete. The first note's up and the last note's down
  are `disabled`, not hidden, so the control count does not change as a note moves;
- the cluster and the add control are **absent** when `canWrite` is false. A viewer reads every note
  and is offered no write.

**`DaySection`** (edit) renders the run of `NoteRow`s in place of its current list and an add-note
control in the day. A day with stops and no notes shows one dashed `--color-edge` affordance reading
_Add a note for this day_ on `--color-surface-2`; a day with neither keeps the existing
_Nothing planned — drop a place here_ target (`day-section.tsx:141-151`) and puts the note affordance
beneath it.

**`NoteDialog`** (`-ui/note-dialog.tsx`, new) reuses `Dialog`, `Field`, `Input`, `Textarea`, `Button`,
`IconButton`, `Alert`, `Spinner`, `Tooltip` and `Tabs` from `src/components/ui`, plus a radio group of
icon buttons on the shipped `RadioGroup` so the picker is **one tab stop with arrow-key movement**
rather than nineteen tab stops. Nothing is added to `src/components/ui`.

The text area and a live rendered preview sit side by side above 640px and behind a two-item `Tabs`
below it, so 360px is a designed layout rather than two crushed panes. The preview renders the same
`Markdown` the row does.

> **A trap worth writing down.** `Tooltip` renders its trigger `asChild`, so a `RadioGroup` item used
> _as_ the trigger has the tooltip's `data-state="closed"` merged over its own `checked`/`unchecked`
> — and swatch styling keyed on `data-[state=checked]` then renders the chosen glyph identically to
> the eighteen that are not. Anchor the tooltip to a wrapper element, and let the dialog render its
> own `TooltipProvider` as `-costs/expense-list.tsx` does. This cost a previous implementation attempt
> a full iteration (#113, comment of 2026-08-31).

**The markdown subset** is `01-S2a`'s and is not reinterpreted: block level — paragraph, headings one
to three, unordered and ordered list, fenced code, block quote, thematic break, simple pipe table;
inline — emphasis, strong, code span, hard break, and a link whose scheme is on the
`http`/`https`/`mailto` allow-list. Anything else renders as its own characters. `parse()` emits a
node tree and `Markdown` emits React elements; there is no HTML in the path and this change adds no
`dangerouslySetInnerHTML`.

**Editing is note-local.** Drag repositioning and interleaving with stops are `01-S4b`'s: this change
adds no `useSortable` and no change to `ordering.ts`. The note run keeps its own `<ul>` after the stop
list, exactly where `day-section.tsx` renders it today.

**States.**

- _Saving._ The row renders at 60% opacity with a `Spinner` in place of its icon until the router
  invalidation lands. The day rail is server-rendered through the loader, so the note run needs no
  independent pending state; the day section's existing skeleton covers first paint.
- _Error._ A failed write leaves the dialog open with an `Alert` on `--color-surface-2` and a retry,
  through the shipped `runWrite` helper (`plan-screen.tsx:781`). A failed move rolls the run back to
  its previous order and says so in a toast — the rollback contract `commitMove` already applies to
  `PlanOrder` (`plan-screen.tsx:608-637`).
- _Empty detail._ One line tall: no empty prose block, no placeholder, no disclosure.
- _Every control_ gets rest, hover, focus-visible, active, disabled and loading: the add control, the
  two chevrons, the icon radios, the disclosure, the preview tabs, save and delete.

**Motion.** A note entering the run fades and lifts 4px over 220ms on `--ease-out-quint`; a run
staggers by 24ms capped at eight rows; a move animates transform only; reduced motion collapses to
opacity.

**Accessibility.** WCAG 2.2 AA in both themes. The icon group is one tab stop; the disclosure is a
`button` with an accessible name; the move controls carry names, not glyph-only labels; `ar` is RTL,
so every offset is a logical property and the chevrons mirror.

**Tokens.** None missing. Time carries `tabular-nums`; spacing is `--space-*` on the 4px grid.

## 📝 Visual change expected

| Route                 | State                                  | Change                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/trips/$tripId/plan` | resting, day with notes                | The note run changes from a flat `StickyNote` + time + text list to `NoteRow`s: a tiled icon from the vocabulary, the headline in the UI face, the time in tabular figures, an actions cluster, and a disclosure chevron on notes that carry a detail. |
| `/trips/$tripId/plan` | resting, day with stops and no notes   | New: a dashed add-note affordance in the day.                                                                                                                                                                                                          |
| `/trips/$tripId/plan` | resting, empty day                     | New: the add-note affordance beneath the existing drop target.                                                                                                                                                                                         |
| `/trips/$tripId/plan` | non-resting — detail disclosed         | New: the note's markdown detail rendered under the row.                                                                                                                                                                                                |
| `/trips/$tripId/plan` | non-resting — editor open              | New: `NoteDialog`, two panes ≥640px, tabs below.                                                                                                                                                                                                       |
| `/trips/$tripId/plan` | viewer on an organization-visible trip | The add control, the actions cluster and the move chevrons are absent where today they are present and refused.                                                                                                                                        |

Light and dark, 360 / 1280 / 2560. The judgement is the blind A/B pair (`scripts/visual/capture.mjs`,
`docs/SPEC.md` §7 item 4), not a screenshot in a comment. No recorded baseline is affected because
none exists: `e2e/__screenshots__/` is absent and ADR 0016 retired the pixel gate.

Evidence in `assets/writable-day-note/`. Today, captured from the demo workspace:
`current-01-planner-light.png`, `current-02-planner-dark.png`, `current-03-planner-mobile.png` — the
flat note run this spec replaces. Proposed, as static illustrative HTML rendered to PNG (not app
code, and not a pixel contract): `mockup-01-note-row.png` for the row and its disclosed detail, and
`mockup-02-note-dialog.png` for the editor. The shipped surface takes its colour, spacing and radius
from `src/styles/tokens.css`; the mockups only fix the layout and the affordances.

## 📝 Copy

Namespace `trips` (`src/lib/i18n/messages/en/trips.ts`), addressed as `trips.plan.note.*`. Every key
below lands in **all 23 locales** in the implementation change, per the `i18n-messages` skill and
`docs/SPEC.md` §9; the parity test fails the suite otherwise.

### The row and the day

| Key                   | English                 |
| --------------------- | ----------------------- |
| `plan.note.add`       | Add a note              |
| `plan.note.addForDay` | Add a note for this day |
| `plan.note.showMore`  | Show more               |
| `plan.note.showLess`  | Show less               |
| `plan.note.moveUp`    | Move up                 |
| `plan.note.moveDown`  | Move down               |
| `plan.note.edit`      | Edit note               |
| `plan.note.delete`    | Delete note             |

### The editor

| Key                            | English                                             |
| ------------------------------ | --------------------------------------------------- |
| `plan.note.dialog.createTitle` | Add a note                                          |
| `plan.note.dialog.editTitle`   | Edit note                                           |
| `plan.note.field.body`         | Note                                                |
| `plan.note.field.bodyHint`     | One line. This is what the day shows.               |
| `plan.note.field.detail`       | Details                                             |
| `plan.note.field.detailHint`   | Headings, lists, links, quotes, code and tables.    |
| `plan.note.field.time`         | Time                                                |
| `plan.note.field.timeHint`     | Optional, 24-hour.                                  |
| `plan.note.field.icon`         | Icon                                                |
| `plan.note.tab.write`          | Write                                               |
| `plan.note.tab.preview`        | Preview                                             |
| `plan.note.previewEmpty`       | Nothing to preview yet                              |
| `plan.note.save`               | Save note                                           |
| `plan.note.cancel`             | Cancel                                              |
| `plan.note.confirmDelete`      | Delete this note?                                   |
| `plan.note.confirmDeleteBody`  | The note and its details are removed from this day. |

### Outcomes

| Key                       | English                   |
| ------------------------- | ------------------------- |
| `plan.note.toast.created` | Note added                |
| `plan.note.toast.updated` | Note saved                |
| `plan.note.toast.deleted` | Note deleted              |
| `plan.note.error.save`    | The note did not save     |
| `plan.note.error.delete`  | The note was not deleted  |
| `plan.note.error.move`    | That move did not save    |
| `plan.note.error.retry`   | Try it again in a moment. |

### The nineteen icons

The first ten are the names `dataset/flagship.ts` already writes through `createDayNote` (Q7); the
last nine are the picker's additions. `sticky-note` is the column default, so it is the pre-selected
radio and the icon every note written before this change already carries.

| Key                            | Icon name        | English   |
| ------------------------------ | ---------------- | --------- |
| `plan.note.icon.alarmClock`    | `alarm-clock`    | Reminder  |
| `plan.note.icon.clock`         | `clock`          | Time      |
| `plan.note.icon.flashlight`    | `flashlight`     | Torch     |
| `plan.note.icon.footprints`    | `footprints`     | Walk      |
| `plan.note.icon.info`          | `info`           | Info      |
| `plan.note.icon.luggage`       | `luggage`        | Luggage   |
| `plan.note.icon.package`       | `package`        | Package   |
| `plan.note.icon.ticket`        | `ticket`         | Tickets   |
| `plan.note.icon.trainFront`    | `train-front`    | Train     |
| `plan.note.icon.wifi`          | `wifi`           | Wi-Fi     |
| `plan.note.icon.stickyNote`    | `sticky-note`    | Note      |
| `plan.note.icon.utensils`      | `utensils`       | Food      |
| `plan.note.icon.bus`           | `bus`            | Transport |
| `plan.note.icon.bedDouble`     | `bed-double`     | Stay      |
| `plan.note.icon.camera`        | `camera`         | Photo     |
| `plan.note.icon.mapPin`        | `map-pin`        | Place     |
| `plan.note.icon.wallet`        | `wallet`         | Money     |
| `plan.note.icon.umbrella`      | `umbrella`       | Rain      |
| `plan.note.icon.triangleAlert` | `triangle-alert` | Warning   |

Every name was verified to resolve in the pinned `lucide-react`.

**Server validator messages stay English**, following the shipped precedent in `-server/plan.ts`
(`'must be a 24-hour time'`, `:78`): a Zod message is authored where no locale is in scope. The client
validates the same rules with catalogue copy before it submits, so the reader normally sees the
localised sentence; the English one is the backstop for a request the form did not produce. Moving
server validator messages into the catalogue is product-wide work and is not this change's.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                   | Behaviour                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `dayId` from another tenant                                          | `requireTripDay` raises `NotFoundError`; nothing is written. The case that fails today.                                                                                                                                                                                                                                       |
| A `dayId` of another trip in the **same** tenant                       | `NotFoundError`. This is why the guard is a day check and not a tenant check — the tenant filter alone passes it.                                                                                                                                                                                                             |
| A non-member of a private trip, on any note verb                       | `requireTrip` raises `NotFoundError`; they learn nothing.                                                                                                                                                                                                                                                                     |
| A `viewer` calls any note write                                        | `TripRoleError` (`FORBIDDEN`) from `assertTripRole`. The screen does not offer the control, because `canWrite` is false.                                                                                                                                                                                                      |
| An archived trip, stale tab                                            | Refused before the write. The reader sees the generic failure envelope, not the sentence — the same behaviour every planner write on an archived trip has today (Q5).                                                                                                                                                         |
| `icon` outside the nineteen                                            | Rejected by the Zod enum before any SQL runs.                                                                                                                                                                                                                                                                                 |
| `icon` explicitly `null`                                               | Rejected. The column is `NOT NULL` with a default; omission is how you take the default.                                                                                                                                                                                                                                      |
| A note whose stored `icon` is not in the registry                      | The registry falls back to `sticky-note`, the posture `category-icon.tsx` already takes.                                                                                                                                                                                                                                      |
| An emptied `detail`                                                    | `blankToNull` at the route boundary makes it `null`, so the disclosure disappears rather than a `''` being stored.                                                                                                                                                                                                            |
| `noteIds` with an id that is not the day's                             | Dropped by the intersection; the rest of the move still applies.                                                                                                                                                                                                                                                              |
| `noteIds` with a repeated id                                           | Deduped; the day still names every row exactly once, so no position is left unassigned.                                                                                                                                                                                                                                       |
| `noteIds` omitting one of the day's notes                              | The omitted note is spliced back directly behind the note it currently follows — at the front when it follows none — so an omission moves nothing.                                                                                                                                                                            |
| A day whose notes all sit at the default `0`                           | The move still works: `reorderDayTimeline` rewrites the day densely, so the tie is gone after the first move and never returns.                                                                                                                                                                                               |
| A day with one note                                                    | The sequence is unchanged; `reorderDayTimeline` writes the same positions back.                                                                                                                                                                                                                                               |
| A `reorderDayNotesFn` racing a concurrent drag through `reorderPlanFn` | Both go through `reorderDayTimeline`, which re-reads the day inside the call and writes one `runBatch` — one D1 transaction. Last write wins on a dense line; no day is left half-permuted and no tie can result. The loser's router invalidation shows them the winner's order.                                              |
| `noteIds` longer than 200                                              | Rejected by the input bound, matching `reorderDayTimelineInput`.                                                                                                                                                                                                                                                              |
| `detail` with `javascript:` or `data:` links, or raw `<script>`        | Literal text. `01-S2a`'s parser has no HTML path at all; there is nothing to sanitise.                                                                                                                                                                                                                                        |
| A 20 000-character `detail` (the `longTextSchema` cap)                 | Parses and renders; the row clamps to two lines and the disclosure scrolls its own container.                                                                                                                                                                                                                                 |
| A new note on a day whose merged line runs `0..7`                      | Lands at `8`. Without `nextNotePosition` it would take `0` and sort above every older note in the run.                                                                                                                                                                                                                        |
| `loadDayNotes` fails in the loader                                     | `Promise.all` rejects and the route renders `PlanError`, the same outcome `loadPlanBoard` failing has today. Both are one indexed read of the same trip in the same request, so a failure of one is very nearly always a failure of both; a partial-render fallback would be a second loading contract for no realistic gain. |
| D1 rejects the batch                                                   | The write throws, the optimistic order rolls back, the toast says the move did not save.                                                                                                                                                                                                                                      |

## 📝 Risks & Impact Review

- **Blast radius.** One repository module, one new route-local server module, one route loader, the
  four planner files this stage owns, two new components, and 23 catalogue files. No migration, no
  binding, no dependency, no generated file, no third-party call, no new writer of the position line.
- **The role guard is a behaviour change for existing data.** A viewer who could edit notes yesterday
  cannot today. That is decision 6 landing, not a regression — but it is user-visible and belongs in
  the PR description.
- **`createDayNote` becomes stricter for every caller**, including the seed. `apply-trip.ts` passes
  `pin.icon` and a `sortOrder`, and the nineteen-name vocabulary was chosen to keep it valid (Q7);
  the gate must prove it, which is why the seed is a verification step rather than an assumption.
- **Compatibility.** `BACKWARD_COMPATIBILITY.md`'s protected surfaces are untouched: no public route,
  no queue envelope, no config format. `PlanBoardDay.notes` keeps its shape for one wave.
- **Rollback.** Revert the commit. There is no migration to unwind and no column to drop; a `detail`
  written before the revert stops being displayed and is still there when the change lands again.
  Positions densified by a note move stay densified, which is a state `reorderPlanFn` already
  produces.
- **Known residue, each to be filed as a follow-up issue** — this change routes around them rather
  than reaching outside its ownership:
  1. `classifyFailure` classifies every `RepositoryError` as `unexpected`, so refusals are redacted
     and file Sentry events (Q5).
  2. `loadPlanBoard`'s `editable` carries no role term (`-server/plan.ts:189`). `canWrite` fixes the
     note controls only, so on one screen a viewer sees hidden note controls beside visible-and-
     refused stop controls. That inconsistency is deliberate and temporary, and follow-up 2 removes
     it by giving `editable` the role term.
  3. `-server/plan.ts`'s dead `{ id, body, time }` note projection, which `01-S4b` deletes.
  4. Issue #210's unification of the trip-role guards. The clean end state is a leaf repository module
     `src/server/repos/day-notes.ts` holding the note table, its inputs and the full composed guard —
     the move `days.ts`'s position in the import graph forbids today (Q4).

## 📋 Phasing

**Phase 1 — Refuse the write that must not happen.** The repository guard and its isolation cases.
Independently deployable: it changes no screen, adds no copy, and closes a live cross-trip write hole
on its own. It ships first and does not wait behind the feature.

**Phase 2 — A note you can write.** Everything else. It depends on Phase 1 and is not deployable
without it: the editor's whole job is to send the write the guard exists to refuse when it is wrong.

## 📋 Implementation Plan

Each step leaves the application working, and each is verifiable.

### Phase 1 — the guard

**Step 1 — Red first.** Append the `describe('day notes')` block to
`src/server/repos/__tests__/tenant-isolation.test.ts`: in A's scope, `createDayNote` with B's `tripId`
and B's `dayId` raises `NotFoundError`; **`createDayNote` with A's own `tripId` and B's `dayId` raises
`NotFoundError`** — the case that fails today; B's `day_notes` rows are byte-identical afterwards.
_Verify:_ `pnpm test` — the second case fails.

**Step 2 — Green.** `createDayNote` opens with
`await requireTripDay(scope, values.tripId, values.dayId)`.
_Verify:_ `pnpm test` — the new cases pass and every existing case still does.

### Phase 2 — the note

**Step 3 — The vocabulary.** `DAY_NOTE_ICONS` (the nineteen-name readonly tuple) and `DayNoteIcon` in
`src/components/planner/types.ts`; re-export from `days.ts`; export from `planner/index.ts`. Narrow
`createDayNoteInput.icon` to `z.enum(DAY_NOTE_ICONS)` and add `detail: longTextSchema.nullish()`.
New `src/server/repos/__tests__/day-notes.test.ts`: an icon outside the tuple is rejected, an omitted
one takes the column default, an explicit `null` is rejected, and a detail round-trips byte for byte
including newlines — because a rendering decision must never become a storage decision.
_Verify:_ `pnpm test`, then `node scripts/seed/seed.mjs --force` — **every seeded pin icon must still
be accepted**. A rejection here means the tuple is short a name (Q7).

**Step 4 — The sequencing, pure.** `noteSlotOrder(current, noteIds)` and `nextNotePosition` in
`-server/day-notes.ts`, unit-tested against literals: stops keep their slot indices; a foreign id is
dropped; a repeated id appears once; an omitted note keeps its relative place; a day whose notes all
sit at `0` comes out with distinct positions; a one-note day is the identity.
_Verify:_ `pnpm test`.

**Step 5 — The server functions.** `writableTripDay`, `loadDayNotes` (with `canWrite`) and the four
writes, each `.validator()`-guarded and one repository call deep, with `blankToNull` on `detail` and
`time`. Tests with the async-local context installed and the scope mocked, the pattern
`-server/__tests__` already uses: a non-member gets `NotFoundError` from the read and from every
write; a viewer gets `FORBIDDEN` from every write and the full list with `canWrite: false` from the
read; an owner gets `canWrite: true`; an archived trip refuses; a new note lands at the end of the
merged line; a move leaves every stop's `order_index` where the merge put it.
_Verify:_ `pnpm test`, `pnpm typecheck`.

> The viewer assertions live here rather than in `member-isolation.test.ts`, which the ticket names:
> the role term is in the route module (Q4), so the repository test cannot see it. When follow-up 4
> moves the note writers into their own leaf repository module, the cases move with them.

**Step 6 — The loader and the model.** `plan.tsx`'s loader awaits both server functions with
`Promise.all`; `plan-model.ts` gains a pure `notesByDay(payload)` building `PlannerNote` per day and
stops reading `PlanBoardDay.notes`; `PlannerDay.notes` widens in `planner/types.ts`.
_Verify:_ `pnpm test` — `notesByDay` is unit-tested (grouping, `(sortOrder, id)` order, a day with no
notes) rather than eyeballed.

**Step 7 — The copy.** Every key from **Copy** into `src/lib/i18n/messages/en/trips.ts` and all 22
other locales, authored translations, plural branches per locale where a key needs them.
_Verify:_ `pnpm test` — the parity test names any locale or key that is missing.

**Step 8 — The row.** `note-row.tsx` with the icon registry, the disclosure and the actions cluster;
`day-section.tsx` renders the run and the add control; `planner/index.ts` exports the new symbols.
New `src/components/planner/__tests__/notes.test.tsx`: the up control is disabled on the first note
and the down on the last, the disclosure is a real `button` with an accessible name, a note with no
detail renders no disclosure, an unknown stored icon falls back to `sticky-note`, and `canWrite:
false` renders no control at all.
_Verify:_ `pnpm test`.

**Step 9 — The editor.** `-ui/note-dialog.tsx` with the two-pane/tabs layout, the live preview and the
`RadioGroup` picker anchored so the tooltip cannot swallow its `data-state`; `plan-screen.tsx` mounts
it and wires the four writes through the existing `runWrite` and the existing rollback contract.
Tests: the icon group is one tab stop and moves with arrow keys, and the selected swatch is
distinguishable from the eighteen that are not.
_Verify:_ `pnpm test`.

**Step 10 — The gate and the evidence.** Append one
`test.describe('01-S2 — A day note you can write', …)` to `e2e/trips-core.spec.ts` with its own route
table, covering the editor and the detail disclosure, `watchConsole` attached before navigation and
`fatal` asserted empty. It writes a note, discloses it and sweeps it away again, so the shared fixture
is left as it was found even when a retry re-runs it. Then capture the blind A/B pair with
`scripts/visual/capture.mjs` over `/trips/$tripId/plan` — resting, editor open, detail disclosed — in
both themes at 360, 1280 and 2560, which `docs/SPEC.md` §7 item 4 makes the whole of the visual
judgement.
_Verify:_ the full gate in order — `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh` — plus the A/B pair.

### Definition of done

`docs/SPEC.md` §7's six items, item 4 read as the blind A/B pair and not as "looked at it", plus:
`pnpm db:generate` reports no drift and no generated file is touched; the seed runs clean; and the §2
visual clauses are ticked per surface — 4px grid from `--space-*`, five states per interactive
element, designed empty/skeleton/error drawn on `--color-surface-2`, 150–260ms motion on
`--ease-out-quint` honouring `prefers-reduced-motion`, full light and dark parity with dark shadows
re-declared, 360/1280/2560 with the small layout designed rather than squeezed, keyboard navigable end
to end with accessible names and WCAG 2.2 AA contrast, zero console errors or warnings, zero layout
shift after paint.

**Owned paths**, as the ticket lists them, plus three additions each with its reason:
`src/routes/api/dev/-seed/**` is **not** edited — the vocabulary was widened to fit the fixture
instead (Q7); `src/components/planner/index.ts` and `types.ts` are already on the ticket's list; the
23 files under `src/lib/i18n/messages/*/trips.ts` are added because `docs/SPEC.md` §9 makes the copy
contract part of the same change; and `src/routes/_app/trips/$tripId/-server/__tests__/day-notes.test.ts`
is added because the role assertions cannot live in the repository test (Step 5).
