# The day as one sequence on screen: `PlannerItem`, draggable notes, the "drop its time?" dialog

`01-S4b` · FR #116 · Parent PRD #104 · Stage `01-S4` of `docs/plans/01-trips-core.md` (frozen), second slice. `01-S4a` (#115) landed the engine and the write path; this is the screen over them.

## 📝 TLDR

A day in the planner rail renders two lists today: a sortable list of stops, and a separate, undraggable run of notes beneath it. This change makes the day **one** sequence. Stops and notes interleave in merged order, a note is dragged against a stop by pointer and by keyboard alike, and when a drop would put a timed item out of clock order the engine's existing `'timed'` refusal opens a dialog asking whether to drop the time — confirming sends **one** reorder call with that time cleared.

Everything below the screen already exists. `ordering.ts` has `noteItemId`, `mergeDayTimeline`, and the `'not-in-ideas'` / `'timed'` refusals; `reorderPlanFn` takes `items: Array<{ kind, id }>` and `clearTime`; `reorderDayTimeline` writes both tables in one batch. This spec is the client half and nothing else.

## 📝 Problem Statement

**Who has it.** Anyone planning a day that mixes places and instructions — "Check out by 10:00" belongs _above_ the 11:00 museum, not in a footer under all six stops.

**The evidence, measured in the tree at `0fd575c1`:**

- `day-section.tsx:156-196` renders one `SortableContext` over `day.rows` — stops only. `day-section.tsx:198-214` renders `day.notes` in a plain `<ul>` underneath. A note has no `useSortable`, no drag handle, and no way to be picked up.
- The empty-day drop target is gated on `day.rows.length === 0` (`day-section.tsx:167`). A day holding three notes and no stops still renders "Nothing planned — drop a place here" **above its own three notes**. That is a visible bug today, not a hypothetical.
- There is no union type for "a thing in a day's sequence". `PlannerDay` carries `rows` and `notes` as two separate arrays (`types.ts:65`, `:68`), so nothing downstream can add a third kind — and `BKG-10` (transport rows, `03-reservations-and-transport.md`) is specified to arrive through exactly that seam.
- The server already knows the day is one number line. `reorderDayNotesFn`'s own doc comment (`-server/day-notes.ts:355-359`) says the client "cannot build the day's merged sequence, **because the board publishes no stop positions**", and rebuilds it server-side to compensate. That workaround exists because this slice had not landed.

**What it costs.** A note's ordering is expressed only through two chevrons that walk it among _notes_, so a reader cannot say "this instruction comes before that stop" at all. The clock rule PRD #104 decision 8 specifies — a timed row is moved by its time, and the reader is asked before that changes — is implemented in the engine and unreachable from the screen, because the screen never passes `timeOfItem`.

## 📝 Proposed Solution

Introduce `PlannerItem`, a discriminated union of `{ kind: 'stop'; row }` and `{ kind: 'note'; note }`, and a merged `items` list on `PlannerDay` beside the `rows` it already has. `rows` stays: `routeDaysOf` (`plan-model.ts:351-364`) draws the map's per-day route line from stop coordinates and must never learn about notes.

One `SortableContext` renders `items` through the two renderers that already exist — `StopRow` and `NoteRow`, neither rewritten. The drag adapter widens to the `note:` id space `ordering.ts` already declares. The screen supplies `timeOfItem`, which switches on the clock rule, and turns the `'timed'` refusal into a dialog whose confirm re-issues the move with `clearTime`.

**The union is an extension point and is written as one.** `mergeDayTimeline` reads `{ id, position, time }` and nothing else; a third kind is one variant, one id prefix and one renderer, with no change to the merge, the drag adapter, or the repository's two-table batch. This is stated in the union's doc comment so `BKG-10` does not open `types.ts` and find a design that assumed two.

**Alternatives considered and why they lost:**

| Alternative                                                                           | Why not                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep two lists, add a second `SortableContext` for notes with cross-list dropping     | Two contexts means two sort strategies and two keyboard walks over one visual list. The reader sees one list; the code would model two. It also cannot express "note above stop" at all, which is the whole ask.                                                                                                                                      |
| Reconstruct stop positions from array index in `day.stops` instead of publishing them | Provably wrong before a day's first merged reorder: `nextOrderIndex` (`itinerary.ts:343-346`) numbers `day_assignments` independently of the `sortOrder()` default on `day_notes`, so the two arrays' indices are not points on one line. The merge would render an order the loader then contradicts on `router.invalidate()` — a visible snap-back. |
| Land the note-relocation verb so a note can change day                                | A repository slice (`days.ts` / `itinerary.ts`), out of scope per the ticket. See Resolved assumption A2.                                                                                                                                                                                                                                             |

## 📝 Architecture

Nothing new is created below the route boundary. The change is four seams:

**1. The payload publishes the stop's stored position.** `PlanBoardStop` gains `position: number` from `stop.assignment.orderIndex`, which `getTripItinerary` already returns. One additive field on a read payload. In the same edit, `PlanBoardDay.notes` — the superseded three-field projection at `-server/plan.ts:145-149` — is **deleted**: it has had no reader since `01-S2b` moved notes to `-server/day-notes.ts` (verified: no `PlanBoardDay.notes` consumer anywhere in `src/`), and two projections of one record is how they start to disagree. Narrowing a payload type makes `pnpm typecheck` the proof that no reader is left.

**2. The view model gains the union.** In `src/components/planner/types.ts`:

```ts
export type PlannerItem =
  | { readonly kind: 'stop'; readonly row: PlannerRow }
  | { readonly kind: 'note'; readonly note: PlannerNote }
```

and `PlannerDay` gains `readonly items: ReadonlyArray<PlannerItem>` beside `rows`. A `stopsOf(items)` helper keeps the two derivable from one another for any caller that wants stops only.

**3. The adapter merges.** `plan-model.ts`:

- `orderFromPayload(payload, notes)` zips the day's stops (`{ id: assignmentId, position, time: startTime }`) and its notes (`{ id: noteItemId(note.id), position: sortOrder, time }`) through `mergeDayTimeline`, and `DayOrder.itemIds` becomes the merged sequence. This is the one place the two sources meet.
- `planModel` builds `items` per day by walking `entry.itemIds` and resolving each id through `rowsByItem` or the note index. `rows` keeps being built from the same walk, skipping note ids — so `routeDaysOf` and `mapPlacesOf` are untouched, mechanically.
- Two new indices the screen needs: `notesByItem` (note item id → `PlannerNote`, for naming a note out loud) and `timeByItem` (item id → `HH:MM | null`, which is `movePlanItem`'s `timeOfItem`).
- **`scheduledCount` counts stops, not sequence length.** `ordering.scheduledCount(order)` sums `itemIds.length`, which now includes notes. `PlanModel.scheduledCount` is derived from the resolved rows instead, so "N stops" stays a count of places.

**4. The screen decides, the hook speaks.** `PlanDndOptions.onMove` currently returns `void`, so a refused move is silent to a keyboard reader. It widens to return `string | null`: the sentence to announce, or `null` when the move was accepted. The hook stores it and reads it from its `onDragEnd` announcement.

This keeps `src/components/planner/` free of the refusal vocabulary and of i18n plumbing for it — the screen owns `useTranslate` and the product statements, the hook owns the live region. `plan-dnd.ts` additionally takes `notesByItem` so `nameOfItem` can name a note rather than falling back to "the stop".

### Boundaries respected

- `src/components/planner/**` still imports nothing from `src/server` or `src/routes`; it takes view models with every time already formatted (`types.ts:1-11`).
- All SQL stays in `src/server/repos`; this change adds no repository function and no server function. It calls `reorderPlanFn`, which `01-S4a` landed and validated.
- Every server-function input is already Zod-validated; no validator changes.

## 📝 Data Model

**No schema change and no migration.** Both position columns exist and both are `real`: `day_assignments.order_index` and `day_notes.sort_order`. The merged position space is not a new column — it is the agreement, already implemented in `reorderDayTimeline`, that for one day the two columns are read and written as one sequence of positions `0..n-1`.

Rollback is safe by construction: the previous Worker reads `order_index` for stops and `sort_order` for notes and renders two lists, exactly as it does today, because this change writes no value either column could not already hold.

## 📝 API Contracts

**Nothing added.** Two existing contracts change shape on the read side only:

| Surface         | Change                                  | Kind                                    |
| --------------- | --------------------------------------- | --------------------------------------- |
| `PlanBoardStop` | `+ position: number`                    | Additive                                |
| `PlanBoardDay`  | `- notes` (dead three-field projection) | Narrowing a read payload with no reader |

Neither is a `BACKWARD_COMPATIBILITY.md` protected surface: no D1 schema, no server-function _input_, no session-less read, no route path, no persisted shape. Both are internal loader payload types consumed only by this route's own `-ui/` layer, and the compiler names every reader of both.

`reorderPlanFn`'s input is unchanged and already carries what this needs:

```ts
days: Array<{
  dayId
  items: Array<{ kind: 'stop' | 'note'; id }>
  clearTime?: Array<{ kind; id }>
}>
```

`applyChange`'s `'reorder'` branch stops hard-coding `kind: 'stop'` (`plan-screen.tsx:582-593`, whose comment explicitly names `01-S4b` as the change) and discriminates each id with `isNoteItemId`, mapping a note id back through `noteIdOfNoteItem`.

**One known naming debt, reported not fixed.** `PlanChange`'s `reorder` variant still spells its ids `assignmentIds` (`ordering.ts:118`) while now carrying both kinds. `ordering.ts` is `01-S4a`'s owned path and carries the `TRP-10` no-regression protection; renaming a field there is a rewrite of a file this slice is told not to rewrite. The wire format is correct because `applyChange` discriminates. The rename belongs to whoever next owns that file.

## 📝 UI/UX

### The merged day

One `<ul>`, one `SortableContext` over `day.items`, `verticalListSortingStrategy` unchanged. A `StopRow` for a stop, a `NoteRow` for a note, in merged order.

**Stop numerals count stops.** `StopRow`'s `position` is the 1-based index among the day's _stops_, not the sequence. A note sitting between stop 2 and stop 3 does not make the next place "stop 4" — it is still the third place of the day, and a screen reader hearing "stop 3" must be able to count three places.

**The empty state moves its condition.** The dashed drop target renders when `day.items.length === 0`, not when `day.rows.length === 0`. That closes the bug where a day of notes announces itself as empty above its own content. Its copy widens from "drop a place here" to name both kinds, and moves into the catalogue.

### The note as a draggable

`NoteRow` gains the opt-in props `StopRow` already has — `draggable`, and `useSortable` on `noteItemId(note.id)`, disabled while `pending`. It cannot be wrapped in a sortable `<li>` from `day-section.tsx` because it renders its own `<li>`; nesting one inside another is invalid HTML and breaks the list semantics a screen reader counts by.

The drag handle mirrors `StopRow`'s: its own control, its own accessible name, `setActivatorNodeRef` — which is what gives keyboard drag for free through `@dnd-kit`'s keyboard sensor. It joins the existing floating action cluster rather than adding a sixth column to a 340px rail.

**The chevrons and the drag become one code path.** `NoteRow`'s move up / move down now walk the **merged** sequence via `commitMove`, so "move up" past a stop moves past that stop. Today they call `reorderDayNotesFn`, which walks notes only — in a merged list that would jump a note over a stop invisibly and contradict the list the reader is looking at. `position` / `count` on `NoteRow` become the merged index and the merged length.

### The refusals

| Reason                      | Where it comes from | What the reader gets                                                      |
| --------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `'duplicate'`               | engine              | Toast, as today (its copy moves into the catalogue)                       |
| `'not-in-ideas'`            | engine              | Toast + spoken sentence: a note has no meaning outside a day              |
| `'not-in-another-day'`      | **the screen**      | Toast + spoken sentence: a note stays on its day (Resolved assumption A2) |
| `'timed'`                   | engine              | **The dialog below** — a question, not an end                             |
| `'unknown'` / `'unchanged'` | engine              | Silent, as today                                                          |

Every one of them is announced in the live region as well as toasted, so a keyboard reader hears _why_ nothing moved instead of watching nothing happen. That is the single accessibility gap this slice closes beyond the drag itself.

### The "drop its time?" dialog

Opens on the `'timed'` refusal, by pointer drop and by keyboard drop alike, built on the shipped `Dialog` primitive — no new `components/ui` member.

- **Title** names the item and its time: _"Move Café Sacher and drop its 14:30?"_
- **Body** states the consequence: this position contradicts that time, and the order and the cleared time are saved together.
- **Confirm** takes initial focus. It issues **one** `reorderPlanFn` call whose day entry carries the item in `clearTime` as well as in `items`, so there is never a frame in which the row has a time and the wrong position.
- **Escape / Cancel** declines: no call, no optimistic change, the board is exactly as it was.
- A **failed** write rolls the optimistic `PlanOrder` back to the arrangement before the move — the contract `commitMove` already implements (`plan-screen.tsx:649-658`) and which this must not weaken.

### The drag preview

`DragPreviewProps` becomes a union: `{ row, category }` or `{ note }`. A note's preview carries its icon glyph, its time and its headline — and no thumbnail, because there is no place to picture.

### Accessibility, states, motion

- Keyboard: pick up, walk, drop, cancel — the same four events the stop already has, now over the merged list. The refusal sentences reach the same live region. The dialog opens on a keyboard drop with focus on confirm and `Escape` declining.
- Every control keeps rest / hover / focus-visible / active / disabled / loading. A note with a write in flight takes the `pendingItemIds` treatment `DaySection` already applies, which now covers note ids.
- Motion: transform only, on the existing `@dnd-kit` configuration, `prefers-reduced-motion` honoured as today. No new animation is introduced.
- Light and dark, 360 / 1280 / 2560 — the rows and the dialog are existing primitives on existing tokens; no token is added and none is missing.

## 📝 Visual change expected

| Route                 | State                                    | What changes                                                                                                                           |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/trips/$tripId/plan` | A day with stops **and** notes           | One list instead of a stop list plus a note footer. Notes appear interleaved at their merged position. Light + dark, desktop + mobile. |
| `/trips/$tripId/plan` | A day with notes but **no** stops        | The dashed "nothing planned" target disappears (it is currently drawn above the notes).                                                |
| `/trips/$tripId/plan` | Hovering / focusing a note row           | The action cluster gains a drag handle.                                                                                                |
| `/trips/$tripId/plan` | Mid-drag, holding a note                 | A new drag-overlay preview shaped for a note (icon + time + headline, no thumbnail).                                                   |
| `/trips/$tripId/plan` | Dropping a timed item out of clock order | A dialog that does not exist today.                                                                                                    |
| `/trips/$tripId/plan` | A refused drop                           | A toast that does not exist today for `not-in-ideas` and `not-in-another-day`.                                                         |

No other route changes. The map is unaffected: it reads `rows`, which is unchanged.

## 📝 Copy

Every key lands in all 23 locales in the same change, per the `i18n-messages` skill and docs/SPEC.md §9. Namespace `trips`, which exists.

| Key (`en`)                              | Text                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `plan.day.empty`                        | `Nothing planned — drop a place or a note here`                                                                                     |
| `plan.note.drag`                        | `Reorder note`                                                                                                                      |
| `plan.move.dropTime.title`              | `Move {name} and drop its {time}?`                                                                                                  |
| `plan.move.dropTime.body`               | `This position contradicts the time on it. Moving it here clears the time — the new order and the cleared time are saved together.` |
| `plan.move.dropTime.confirm`            | `Move and drop the time`                                                                                                            |
| `plan.move.dropTime.cancel`             | `Keep it where it is`                                                                                                               |
| `plan.move.refused.duplicate`           | `{name} is already on that day`                                                                                                     |
| `plan.move.refused.duplicateBody`       | `A place can only appear once per day. Move it to another day instead.`                                                             |
| `plan.move.refused.notInIdeas`          | `A note stays in the day`                                                                                                           |
| `plan.move.refused.notInIdeasBody`      | `Ideas are places waiting for a day. A note belongs to the day it was written on.`                                                  |
| `plan.move.refused.notInAnotherDay`     | `A note stays on its own day`                                                                                                       |
| `plan.move.refused.notInAnotherDayBody` | `Notes cannot be moved between days yet. Edit the note, or write it on the other day.`                                              |
| `plan.move.error.save`                  | `That move did not save`                                                                                                            |
| `plan.move.error.retry`                 | `Try it again in a moment.`                                                                                                         |
| `plan.move.spoken.notInIdeas`           | `{name} was not moved. A note stays in the day.`                                                                                    |
| `plan.move.spoken.notInAnotherDay`      | `{name} was not moved. A note stays on its own day.`                                                                                |
| `plan.move.spoken.duplicate`            | `{name} was not moved. That day already has it.`                                                                                    |
| `plan.move.spoken.timed`                | `{name} carries {time}. Asking whether to drop it.`                                                                                 |

`plan.move.error.save` / `.retry` and `plan.move.refused.duplicate*` replace hardcoded English at `plan-screen.tsx:640-644` and `:656-658`; `plan.day.empty` replaces the hardcoded string at `day-section.tsx:176`. Those lines are being changed by this work, so their copy becomes this change's responsibility.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                    | Behaviour                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A day whose two tables have never been merged (stop positions `0,1`, note position `0`) | `mergeDayTimeline` sorts by position and breaks ties by arrival order — a stable, defined sequence. The first drag renumbers the day `0..n-1` across both tables and the ambiguity is gone for good. |
| A note dragged into the ideas column                                                    | `'not-in-ideas'`, engine-side. Board unchanged, toast, spoken.                                                                                                                                       |
| A note dragged onto another day                                                         | `'not-in-another-day'`, screen-side, **before** the optimistic apply — so the board never claims a move the write would discard.                                                                     |
| A stop dragged onto a day that already holds its place                                  | `'duplicate'`, as today.                                                                                                                                                                             |
| Confirming the dialog and the write fails                                               | `PlanOrder` rolls back to the pre-move arrangement; the time is untouched, because the batch is one transaction and a failure rolls both halves back.                                                |
| Declining the dialog                                                                    | No call, no optimistic change, no pending marker.                                                                                                                                                    |
| Two drags overlapping                                                                   | Unchanged: the rollback restores the arrangement captured before _this_ move rather than recomputing an inverse — the property `commitMove` already documents.                                       |
| A note id in `itemIds` with no matching note (a delete one tab behind)                  | `planModel` skips ids it cannot resolve, as it already does for rows. The next `router.invalidate()` reconciles.                                                                                     |
| A viewer, or an archived trip                                                           | `editable` is false, `commitMove` returns early, no drag handle is rendered — unchanged.                                                                                                             |
| `timeOfItem` absent                                                                     | Never, on this screen — but the engine's contract keeps the clock rule dormant without it, which is what lets `ordering.test.ts`'s existing cases stay green untouched.                              |

## 📝 Risks & Impact Review

**Blast radius:** one route's `-ui/` layer, `src/components/planner/**`, and two additive/narrowing lines in one loader payload. No repository, no schema, no queue, no Durable Object, no route path.

**The named risk is regression, not breakage.** `TRP-10` (keyboard drag-and-drop) is closed on disk and this change edits the exact modules that closed it. The mitigation is mechanical and non-negotiable: **every test that passes in `ordering.test.ts`, `keyboard-drag.test.tsx` and `rails.test.tsx` before this change passes after it, unchanged rather than adjusted.** What may change in the two owned test files is fixtures (a `PlannerDay` literal now supplies `items`) plus appended cases. `ordering.test.ts` is not touched at all — `ordering.ts` is not edited.

**Rollback:** revert the PR. No migration to unwind, no value written that the previous Worker cannot read.

**Compatibility:** no `BACKWARD_COMPATIBILITY.md` surface. See API Contracts.

**Performance:** `mergeDayTimeline` is two sorts over a day's items — a few dozen at most — and runs inside the existing `planModel` memo. `orderFromPayload` runs once per loader answer. No new fetch, no new render pass.

## 📝 Resolved assumptions (autonomous defaults)

Every one of these was an Open Question; each is the most reversible answer, and each can be overridden before this spec merges.

**A1 — Publish the stop's stored position rather than reconstruct it.** `PlanBoardStop` gains `position`. Reconstructing from array index is provably wrong before a day's first merged reorder, because `nextOrderIndex` and the `day_notes` sort-order default number the two tables independently — the merge would render an order the loader contradicts on the next `router.invalidate()`. `-server/plan.ts` is outside FR #116's Owned paths but inside the frozen plan's `01-S4` Owned paths (`docs/plans/01-trips-core.md:2080`); the a/b split left this half undone. One additive field.

**A2 — A note cannot change day; the screen refuses the drag.** `reorderDayTimeline` takes one `dayId` and `day_notes` carries no relocation verb, so a cross-day note drop cannot be persisted. Landing the verb needs `days.ts` / `itinerary.ts` — a repository slice, which FR #116's _Out of scope_ assigns elsewhere and `01-S4a`'s own hand-off named as the alternative to refusing. The refusal is declared in the screen (owned) rather than in `ordering.ts` (not owned, and `TRP-10`-protected), and is toasted **and** spoken, so the limitation is stated rather than silent.

**A3 — Delete the dead `PlanBoardDay.notes` projection in the same change.** It has no reader anywhere in `src/` (verified), the frozen plan assigns its deletion to `01-S4` (`:2199-2204`), and `plan-model.ts:62` names `01-S4b` as its owner in a comment already in the tree. We are editing that file for A1 anyway. Narrowing a read payload; `pnpm typecheck` is the proof.

**A4 — Add sortable wiring to `note-row.tsx` rather than wrap it.** `NoteRow` renders its own `<li>`, so wrapping it in a sortable `<li>` produces nested list items — invalid HTML that breaks the count a screen reader reads out. The props added are the opt-in ones `StopRow` already carries, so the renderer is extended, not rewritten. `note-row.tsx` is outside FR #116's Owned paths (`01-S2b` created it) but is named by the plan as one of the stage's two renderers (`:2263-2264`).

**A5 — Stop numerals count stops, not sequence positions.** A note between stop 2 and stop 3 must not make the next place "stop 4".

**A6 — The note's move chevrons go through the merged `commitMove`.** In a merged list, chevrons that walk notes-only would move a note past a stop invisibly. `reorderDayNotesFn` stays on the server with its tests; it simply has no caller on this screen afterwards. Removing it is a follow-up on whoever owns `-server/day-notes.ts`, not a UI slice's call.

**A7 — `onMove` returns the sentence to announce, not a refusal enum.** Keeps the refusal vocabulary and its 23 translations in the screen, and leaves `src/components/planner/` a presentation directory that takes formatted strings — the posture `types.ts:1-11` already states for times and durations.

**A8 — This ships as one spec, not two.** The merged render and the dialog are one capability: the dialog exists only because the merged drag can produce a `'timed'` refusal. Neither is independently useful.

## 📋 Phasing

- **Phase 1 — the day renders as one sequence.** Shippable alone: the interleaved list and the fixed empty state, with notes still moved by their chevrons. Closes the visible empty-day bug on its own.
- **Phase 2 — the note becomes draggable.** Pointer and keyboard, with every refusal announced.
- **Phase 3 — the "drop its time?" dialog.** Decision 8, reachable from the screen at last.
- **Phase 4 — copy and end-to-end.** The 23-locale catalogue and the appended journey.

Each phase leaves `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.

## 📋 Implementation Plan

### Phase 1 — the day renders as one sequence

1. **Publish the stop's position, delete the dead note projection.** `-server/plan.ts`: `PlanBoardStop` gains `position: number` from `stop.assignment.orderIndex`; `PlanBoardDay.notes` and its projection at `:220-224` are removed. _Verify:_ `pnpm typecheck` is clean, proving no reader of the removed field remains.
2. **The item union.** `types.ts`: `PlannerItem`, `PlannerDay.items`, `stopsOf(items)`, with the third-kind extension point stated in the union's doc comment. `index.ts` exports both. _Verify:_ `pnpm typecheck`.
3. **The adapter merges.** `plan-model.ts`: `orderFromPayload(payload, notes)` builds merged `itemIds` through `mergeDayTimeline`; `planModel` builds `items` and keeps `rows` stops-only; `notesByItem` and `timeByItem`; `PlanModel.scheduledCount` counts resolved rows. _Verify:_ new cases in `-ui/__tests__/plan-model.test.ts` — a day with times interleaves by clock; a day with none keeps position order; `rows` never contains a note; `scheduledCount` ignores notes.
4. **One list in the day section.** `day-section.tsx`: one `SortableContext` over `day.items`, `StopRow` / `NoteRow` under it, `pendingItemIds` covering note item ids, stop numerals counting stops, the dashed target gated on `day.items.length === 0`. _Verify:_ extended `rails.test.tsx` — interleaved render in merged order; the empty target absent for a day of notes and present for a truly empty day; **every pre-existing case in the file still passes unchanged**.
5. **Wire the screen to the merged model.** `plan-screen.tsx` passes the merged `order` and drops the separate `onMoveNote`/notes wiring from `DaySection`. _Verify:_ `pnpm test`, `pnpm build`.

### Phase 2 — the note becomes draggable

6. **`NoteRow` becomes sortable.** `note-row.tsx`: opt-in `draggable`, `useSortable` on `noteItemId(note.id)` disabled while pending, a drag handle mirroring `StopRow`'s with `setActivatorNodeRef` and its own accessible name. _Verify:_ extended `notes.test.tsx` — the handle exists and is named when `draggable`, absent when not.
7. **The adapter speaks about notes.** `plan-dnd.ts`: takes `notesByItem`; `nameOfItem` names a note; `onMove` returns `string | null` and a non-null return is announced from `onDragEnd`. _Verify:_ extended `keyboard-drag.test.tsx` — a note is picked up, walked and dropped by keyboard, and its name is spoken.
8. **The screen commits a note's move.** `plan-screen.tsx`: `commitMove` refuses a cross-day note drop before the optimistic apply (`not-in-another-day`), supplies `timeOfItem`, maps every refusal to its toast and its spoken sentence, and `applyChange` discriminates `stop` from `note` by `isNoteItemId`. _Verify:_ extended `keyboard-drag.test.tsx` — `not-in-ideas` and `not-in-another-day` are refused, the board is unchanged, and each is announced.
9. **A note's drag preview.** `drag-preview.tsx`: a `row | note` union; the note variant renders icon, time and headline and no thumbnail. `index.ts` exports the widened props. _Verify:_ `rails.test.tsx` or `notes.test.tsx` renders the note preview; `pnpm typecheck`.

### Phase 3 — the "drop its time?" dialog

10. **The dialog.** `plan-actions.tsx`: `DropTimeDialog` on the shipped `Dialog`, confirm taking initial focus, `Escape` declining. _Verify:_ new `-ui/__tests__/plan-actions.test.tsx` (collected by the `ui` vitest project, which includes `src/routes/**/*.test.tsx`) — confirm is focused on open, `Escape` calls the decline handler, confirm calls the confirm handler once.
11. **The `'timed'` path.** `plan-screen.tsx`: the refusal opens the dialog naming the item and its time; confirming issues exactly **one** `reorderPlanFn` carrying the item in `clearTime` and in `items`; declining is a no-op; a failed write rolls `PlanOrder` back. _Verify:_ extended `keyboard-drag.test.tsx` / screen-level test — one call with `clearTime` on confirm, zero on decline, rollback on rejection, and the `timed` sentence reaching the live region.
12. **The chevrons join the merged path.** `note-row.tsx` / `plan-screen.tsx`: move up / move down walk the merged sequence through `commitMove`; `position` and `count` are the merged index and length. _Verify:_ extended `notes.test.tsx` — moving a note up past a stop produces the merged order, and the chevrons are disabled at the sequence ends rather than the note-run ends.

### Phase 4 — copy and end-to-end

13. **The catalogue.** Every key in the Copy table lands in all 23 locales via the `i18n-messages` skill, and the hardcoded strings named there are replaced. _Verify:_ `pnpm test` (the i18n parity test) and `pnpm e2e`'s i18n-runtime-parity spec.
14. **The journey.** One block appended to `e2e/trips-core.spec.ts` walking a merged day and a note drag, asserting behaviour with a silent console (ADR 0016 retired the visual gate). _Verify:_ `pnpm e2e`.

**The gate, in this order:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.

**The added, non-negotiable item in this change's definition of done:** every test that passed in `ordering.test.ts`, `keyboard-drag.test.tsx` and `rails.test.tsx` before it passes after it, unchanged rather than adjusted. That is what carrying `TRP-10` means.

## 📝 Out of scope

- The engine and the write path — `01-S4a` (#115) landed them.
- A note-relocation verb, so a note could change day. A repository slice; see A2.
- The third item kind (transport rows), which arrives from `BKG-10` through the extension point this change declares.
- Renaming `PlanChange.reorder`'s `assignmentIds`; `ordering.ts` is not this slice's to rewrite.
- Removing the now-callerless `reorderDayNotesFn`; see A6.
