# The day as one sequence on screen: `PlannerItem`, draggable notes, the "drop its time?" dialog

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #116        |
| **Spec PR**        | #403        |
| **Implementation** | #404        |

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
- The server already knows the day is one number line. `reorderDayNotesFn`'s own doc comment (`-server/day-notes.ts:354-359`) says the client "cannot build the day's merged sequence, **because the board publishes no stop positions**", and rebuilds it server-side to compensate. That workaround exists because this slice had not landed.
- **PRD #104 decision 9 is implemented and unreachable.** `movePlanItem`'s clock rule fires only when the caller supplies `timeOfItem` (`ordering.ts:409-420`); `plan-screen.tsx` never does. So a stop dragged against another stop's clock reorders silently today, and the question decision 9 specifies is dead code.

**What it costs.** A note's ordering is expressed only through two chevrons that walk it among _notes_, so a reader cannot say "this instruction comes before that stop" at all.

## 📝 Proposed Solution

Introduce `PlannerItem`, a discriminated union of `{ kind: 'stop'; row }` and `{ kind: 'note'; note }`, and a merged `items` list on `PlannerDay` **replacing** the separate `notes` array while keeping `rows`. `rows` stays: `routeDaysOf` (`plan-model.ts:351-364`) draws the map's per-day route line from stop coordinates and must never learn about notes.

One `SortableContext` renders `items` through the two renderers that already exist — `StopRow` and `NoteRow`, neither rewritten. The drag adapter widens to the `note:` id space `ordering.ts` already declares. The screen supplies `timeOfItem`, which switches on the clock rule, and turns the `'timed'` refusal into a dialog whose confirm re-issues the move with `clearTime`.

**The drag decision becomes a pure function.** Today `commitMove` (`plan-screen.tsx:632-671`) holds the refusal policy, the optimistic apply and the write in one closure inside a 1636-line screen that needs a map, a router and a trip to mount — so none of it is reachable from a test. This change moves the _decision_ into a new pure module, `-ui/plan-move.ts`, leaving `commitMove` as glue. See **Architecture 5**; it is what makes the three riskiest behaviours in this change verifiable rather than merely asserted.

**The union is an extension point and is written as one.** `mergeDayTimeline` reads `{ id, position, time }` and nothing else; a third kind is one variant, one id prefix and one renderer, with no change to the merge, the drag adapter, or the repository's two-table batch. This is stated in the union's doc comment so `BKG-10` does not open `types.ts` and find a design that assumed two.

**Alternatives considered and why they lost:**

| Alternative                                                                           | Why not                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep two lists, add a second `SortableContext` for notes with cross-list dropping     | Two contexts means two sort strategies and two keyboard walks over one visual list. The reader sees one list; the code would model two. It also cannot express "note above stop" at all, which is the whole ask.                                                                                                                                      |
| Reconstruct stop positions from array index in `day.stops` instead of publishing them | Provably wrong before a day's first merged reorder: `nextOrderIndex` (`itinerary.ts:343-346`) numbers `day_assignments` independently of the `sortOrder()` default on `day_notes`, so the two arrays' indices are not points on one line. The merge would render an order the loader then contradicts on `router.invalidate()` — a visible snap-back. |
| Test the refusal/dialog behaviour by mounting `plan-screen.tsx` with mocks            | A test that stands up a map, a router and a trip to assert "one call carried `clearTime`" is slower than the feature and fails for reasons unrelated to it. Extracting the decision is cheaper and makes the policy readable on its own.                                                                                                              |
| Land the note-relocation verb so a note can change day                                | A repository slice (`days.ts` / `itinerary.ts`), out of scope per the ticket. See Resolved assumption A2.                                                                                                                                                                                                                                             |

## 📝 Architecture

Nothing new is created below the route boundary. The change is five seams:

**1. The payload publishes the stop's stored position.** `PlanBoardStop` gains `position: number` from `stop.assignment.orderIndex`, which `getTripItinerary` already returns. One additive field on a read payload. In the same edit, `PlanBoardDay.notes` — the superseded three-field projection at `-server/plan.ts:148-152`, populated at `:219-223` — is **deleted**: it has had no reader since `01-S2b` moved notes to `-server/day-notes.ts` (verified: `plan-model.ts` is `PlanBoardDay`'s only consumer and reads `stops`, `stays`, `dayNumber` and `title`), and two projections of one record is how they start to disagree. Narrowing a payload type makes `pnpm typecheck` the proof that no reader is left.

**2. The view model gains the union.** In `src/components/planner/types.ts`:

```ts
export type PlannerItem =
  | { readonly kind: 'stop'; readonly row: PlannerRow }
  | { readonly kind: 'note'; readonly note: PlannerNote }
```

`PlannerDay` gains `readonly items: ReadonlyArray<PlannerItem>` and **loses** `notes`. Losing it is the same argument as seam 1: after the merge every note reaches the screen through `items`, and a second array holding the same records is a projection waiting to disagree with the one that renders. `stopsOf(items)` and `notesOf(items)` derive either view for a caller that wants one.

**3. The adapter merges.** `plan-model.ts`:

- `orderFromPayload(payload, notes)` zips the day's stops (`{ id: assignmentId, position, time: startTime }`) and its notes (`{ id: noteItemId(note.id), position: sortOrder, time }`) through `mergeDayTimeline`, and `DayOrder.itemIds` becomes the merged sequence. This is the one place the two sources meet.
- `planModel` builds `items` per day by walking `entry.itemIds` and resolving each id through `rowsByItem` or the note index. `rows` keeps being built from the same walk, skipping note ids — so `routeDaysOf` and `mapPlacesOf` are untouched, mechanically.
- Two new indices the screen needs: `notesByItem` (note item id → `PlannerNote`, for naming a note out loud) and `timeByItem` (item id → `HH:MM | null`, which is `movePlanItem`'s `timeOfItem`).

**4. `ordering.ts`'s two half-truths are closed.** Both are the a/b split's leftovers, both are one line, and both are silently wrong the moment `itemIds` carries a note:

- `PlanChange.reorder`'s field is renamed `assignmentIds` → `itemIds` (`ordering.ts:118`, `:462`). It already carries note ids in the engine's own test (`ordering.test.ts:395` passes `noteItemId('n2')` into a field called `assignmentIds`), which is exactly the half-landed concept docs/SPEC.md §8 forbids. Two production sites; one of them (`plan-screen.tsx:589`) this change edits anyway.
- `scheduledCount(order)` (`ordering.ts:204-206`, re-exported at `index.ts:48`) sums `itemIds.length` and so starts counting notes as stops. It is narrowed to skip note ids. No production caller reads it today, which is precisely why it would go wrong silently for the next one.

**5. The drag decision moves into `-ui/plan-move.ts`, pure.** One exported function is the whole policy:

```ts
/** The engine's refusals, plus the one this screen decides for itself (A2). */
export type PlanMoveReason = PlanMoveRefusal | 'not-in-another-day'

export type PlanMoveOutcome =
  | { readonly kind: 'refused'; readonly reason: PlanMoveReason }
  | {
      readonly kind: 'ask-drop-time'
      readonly itemId: string
      readonly time: string
    }
  | {
      readonly kind: 'commit'
      readonly order: PlanOrder
      readonly change: PlanChange
    }

export function planMoveOutcome(
  order: PlanOrder,
  itemId: string,
  target: PlanTarget,
  options: { placeOfItem; timeOfItem; dropTime?: boolean },
): PlanMoveOutcome
```

It refuses a cross-day note drop _before_ delegating to `movePlanItem` (so the board never claims a move the write would discard), maps the engine's `'timed'` refusal to `ask-drop-time`, and — when `dropTime` is set, which is what the dialog's confirm passes — re-runs the move with that item's time treated as absent, yielding a `commit`. Two smaller pure helpers live beside it: `reorderPayload(tripId, change, clearTime?)`, which builds `reorderPlanFn`'s input and discriminates each id with `isNoteItemId`; and `refusalCopy(reason)`, which maps a reason to its toast and spoken message keys.

`commitMove` becomes glue: call `planMoveOutcome`, then either toast + announce, open the dialog, or `setOrder` + write + roll back on rejection. The rollback stays in the screen — it is three lines around a promise and there is nothing to extract — but everything it is rolling back _from_ is now decided in a tested function.

**6. The screen decides, the hook speaks.** `PlanDndOptions.onMove` currently returns `void`, so a refused move is silent to a keyboard reader. It widens to return `string | null`: the sentence to announce, or `null` when the move was accepted. The hook stores it and reads it from its `onDragEnd` announcement. This keeps `src/components/planner/` free of the refusal vocabulary and of i18n plumbing for it. `plan-dnd.ts` additionally takes `notesByItem` so `nameOfItem` can name a note rather than falling back to "the stop".

### Boundaries respected

- `src/components/planner/**` still imports nothing from `src/server` or `src/routes`; it takes view models with every time already formatted (`types.ts:1-11`).
- `-ui/plan-move.ts` imports the engine and the server function's input type — the direction `-ui/` already runs in — and imports no React, so it is a plain unit test.
- All SQL stays in `src/server/repos`; this change adds no repository function and no server function.

## 📝 Data Model

**No schema change and no migration.** Both position columns exist and both are `real`: `day_assignments.order_index` and `day_notes.sort_order`. The merged position space is not a new column — it is the agreement, already implemented in `reorderDayTimeline`, that for one day the two columns are read and written as one sequence of positions `0..n-1`.

Rollback is safe by construction: the previous Worker reads `order_index` for stops and `sort_order` for notes and renders two lists, exactly as it does today, because this change writes no value either column could not already hold.

## 📝 API Contracts

**No server contract added or changed.** Three internal shapes change:

| Surface              | Change                                  | Kind                                     |
| -------------------- | --------------------------------------- | ---------------------------------------- |
| `PlanBoardStop`      | `+ position: number`                    | Additive                                 |
| `PlanBoardDay`       | `- notes` (dead three-field projection) | Narrowing a read payload with no reader  |
| `PlanChange.reorder` | `assignmentIds` → `itemIds`             | Rename of a client-internal union member |
| `PlannerDay`         | `- notes`, `+ items`                    | View model, this change's own subject    |

None is a `BACKWARD_COMPATIBILITY.md` protected surface: no D1 schema, no server-function input, no session-less read, no route path, no persisted shape. All are internal types the compiler names every reader of.

`reorderPlanFn`'s input is unchanged and already carries what this needs:

```ts
days: Array<{
  dayId
  items: Array<{ kind: 'stop' | 'note'; id }>
  clearTime?: Array<{ kind; id }>
}>
```

## 📝 UI/UX

Two illustrative mockups, rendered from static HTML beside this spec. Every colour, radius and type step in them is copied from `src/styles/tokens.css`, so they depict the real screen rather than proposing a second design language.

- **The merged day, against today's two lists, and the empty-day bug** — `assets/day-as-one-sequence/mockup-01-merged-day.png`
- **The "drop its time?" dialog, the three refusal toasts, and what the live region says** — `assets/day-as-one-sequence/mockup-02-drop-time-dialog.png`

Current-state screenshots of the running planner were **not** captured: every port in the 3030-3040 range `playwright.config.ts` permits was held by another checkout, and `test-env-up.sh` correctly refuses to photograph an app it did not start. The left-hand column of mockup 01 depicts today's layout instead.

### The merged day

One `<ul>`, one `SortableContext` over `day.items`, `verticalListSortingStrategy` unchanged. A `StopRow` for a stop, a `NoteRow` for a note, in merged order.

**Stop numerals count stops.** `StopRow`'s `position` is the 1-based index among the day's _stops_, not the sequence. A note sitting between stop 2 and stop 3 does not make the next place "stop 4" — it is still the third place of the day, and a screen reader hearing "stop 3" must be able to count three places.

**The empty state moves its condition.** The dashed drop target renders when `day.items.length === 0`, not when `day.rows.length === 0`. That closes the bug where a day of notes announces itself as empty above its own content. Its copy widens from "drop a place here" to name both kinds, and moves into the catalogue.

### The note as a draggable

`NoteRow` gains the opt-in props `StopRow` already has — `draggable`, and `useSortable` on `noteItemId(note.id)`, disabled while `pending`. It cannot be wrapped in a sortable `<li>` from `day-section.tsx` because it renders its own `<li>`; nesting one inside another is invalid HTML and breaks the list semantics a screen reader counts by.

The drag handle mirrors `StopRow`'s: its own control, its own accessible name, `setActivatorNodeRef` — which is what gives keyboard drag for free through `@dnd-kit`'s keyboard sensor. It joins the existing floating action cluster rather than adding a sixth column to a 340px rail.

**The chevrons and the drag become one code path.** `NoteRow`'s move up / move down now walk the **merged** sequence via `commitMove`, so "move up" past a stop moves past that stop. Today they call `reorderDayNotesFn`, which walks notes only — in a merged list that would jump a note over a stop invisibly and contradict the list the reader is looking at. `position` / `count` on `NoteRow` become the merged index and the merged length, so a note that is last among notes but not last in the day keeps a live "move down".

### The refusals

| Reason                      | Where it comes from                   | What the reader gets                                         |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `'duplicate'`               | engine                                | Toast, as today (its copy moves into the catalogue)          |
| `'not-in-ideas'`            | engine                                | Toast + spoken sentence: a note has no meaning outside a day |
| `'not-in-another-day'`      | **`plan-move.ts`**, before the engine | Toast + spoken sentence: a note stays on its day (A2)        |
| `'timed'`                   | engine                                | **The dialog below** — a question, not an end                |
| `'unknown'` / `'unchanged'` | engine                                | Silent, as today                                             |

Every one of them is announced in the live region as well as toasted, so a keyboard reader hears _why_ nothing moved instead of watching nothing happen. That is the single accessibility gap this slice closes beyond the drag itself.

### The "drop its time?" dialog

Opens on the `'timed'` refusal, by pointer drop and by keyboard drop alike, built on the shipped `Dialog` primitive — no new `components/ui` member.

- **Title** names the item and its time: _"Move Café Central and drop its 14:30?"_
- **Body** states the consequence: this position contradicts that time, and the order and the cleared time are saved together.
- **Confirm** takes initial focus. It issues **one** `reorderPlanFn` call whose day entry carries the item in `clearTime` as well as in `items`, so there is never a frame in which the row has a time and the wrong position.
- **Escape / Cancel** declines: no call, no optimistic change, the board is exactly as it was.
- A **failed** write rolls the optimistic `PlanOrder` back to the arrangement captured before the move (`plan-screen.tsx:648`) — a contract this must not weaken.

**This dialog also changes how a stop drag behaves, and that is deliberate.** Supplying `timeOfItem` arms the clock rule for _every_ item, not just notes. Dragging a 14:30 stop above an 11:00 stop reorders silently today; afterwards it asks the same question. That is decision 9 finally reaching the screen — the reason the rule was built — and it is the largest behaviour change here for a reader who never writes a note. It is called out in the PR body and is what the QA pass looks at first.

### The drag preview

`DragPreviewProps` becomes a union over its subject while keeping `className` and `category`: `{ row, category?, className? }` or `{ note, className? }`. A note's preview carries its icon glyph, its time and its headline — and no thumbnail, because there is no place to picture.

### Accessibility, states, motion

- Keyboard: pick up, walk, drop, cancel — the same four events the stop already has, now over the merged list. The refusal sentences reach the same live region. The dialog opens on a keyboard drop with focus on confirm and `Escape` declining.
- Every control keeps rest / hover / focus-visible / active / disabled / loading. A note with a write in flight takes the `pendingItemIds` treatment `DaySection` already applies, which now covers note ids.
- Motion: transform only, on the existing `@dnd-kit` configuration, `prefers-reduced-motion` honoured as today. No new animation is introduced.
- Light and dark, 360 / 1280 / 2560 — the rows and the dialog are existing primitives on existing tokens; no token is added and none is missing.

## 📝 Visual change expected

| Route                 | State                                                                   | What changes                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/trips/$tripId/plan` | A day with stops **and** notes                                          | One list instead of a stop list plus a note footer. Notes appear interleaved at their merged position. Light + dark, desktop + mobile. |
| `/trips/$tripId/plan` | A day with notes but **no** stops                                       | The dashed "nothing planned" target disappears (it is currently drawn above the notes).                                                |
| `/trips/$tripId/plan` | Hovering / focusing a note row                                          | The action cluster gains a drag handle.                                                                                                |
| `/trips/$tripId/plan` | Mid-drag, holding a note                                                | A new drag-overlay preview shaped for a note (icon + time + headline, no thumbnail).                                                   |
| `/trips/$tripId/plan` | Dropping a timed item out of clock order — **a stop as well as a note** | A dialog that does not exist today.                                                                                                    |
| `/trips/$tripId/plan` | A refused drop                                                          | A toast that does not exist today for `not-in-ideas` and `not-in-another-day`.                                                         |

No other route changes. The map is unaffected: it reads `rows`, which is unchanged.

## 📝 Copy

Every key lands in all 23 locales **in the phase that introduces it**, per the `i18n-messages` skill and docs/SPEC.md §9. Namespace `trips`, which exists.

| Key (`en`)                              | Text                                                                                                                                | Phase |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `plan.day.empty`                        | `Nothing planned — drop a place or a note here`                                                                                     | 1     |
| `plan.note.drag`                        | `Reorder note`                                                                                                                      | 2     |
| `plan.move.refused.duplicate`           | `{name} is already on that day`                                                                                                     | 2     |
| `plan.move.refused.duplicateBody`       | `A place can only appear once per day. Move it to another day instead.`                                                             | 2     |
| `plan.move.refused.notInIdeas`          | `A note stays in the day`                                                                                                           | 2     |
| `plan.move.refused.notInIdeasBody`      | `Ideas are places waiting for a day. A note belongs to the day it was written on.`                                                  | 2     |
| `plan.move.refused.notInAnotherDay`     | `A note stays on its own day`                                                                                                       | 2     |
| `plan.move.refused.notInAnotherDayBody` | `Notes cannot be moved between days yet. Edit the note, or write it on the other day.`                                              | 2     |
| `plan.move.error.save`                  | `That move did not save`                                                                                                            | 2     |
| `plan.move.error.retry`                 | `Try it again in a moment.`                                                                                                         | 2     |
| `plan.move.spoken.notInIdeas`           | `{name} was not moved. A note stays in the day.`                                                                                    | 2     |
| `plan.move.spoken.notInAnotherDay`      | `{name} was not moved. A note stays on its own day.`                                                                                | 2     |
| `plan.move.spoken.duplicate`            | `{name} was not moved. That day already has it.`                                                                                    | 2     |
| `plan.move.spoken.timed`                | `{name} carries {time}. Asking whether to drop it.`                                                                                 | 3     |
| `plan.move.dropTime.title`              | `Move {name} and drop its {time}?`                                                                                                  | 3     |
| `plan.move.dropTime.body`               | `This position contradicts the time on it. Moving it here clears the time — the new order and the cleared time are saved together.` | 3     |
| `plan.move.dropTime.confirm`            | `Move and drop the time`                                                                                                            | 3     |
| `plan.move.dropTime.cancel`             | `Keep it where it is`                                                                                                               | 3     |

`plan.move.error.save` / `.retry` and `plan.move.refused.duplicate*` replace hardcoded English at `plan-screen.tsx:640-644` and `:656-658`; `plan.day.empty` replaces the hardcoded string at `day-section.tsx:176`. Those lines are being changed by this work, so their copy becomes this change's responsibility.

**Known debt, named not fixed:** `plan-dnd.ts`'s four existing announcements (`:218`, `:225-234`) and its `'the stop'` fallback (`:127`) are hardcoded English and stay that way — they are not lines this change rewrites. The result is a live region mixing translated refusal sentences with untranslated drag narration. Translating the hook is its own slice: it needs `useTranslate` inside `src/components/planner/`, which no module there takes today.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                    | Behaviour                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A day whose two tables have never been merged (stop positions `0,1`, note position `0`) | `mergeDayTimeline` sorts by position and breaks ties by arrival order — a stable, defined sequence. The first drag renumbers the day `0..n-1` across both tables and the ambiguity is gone for good. |
| **A stop dragged against another stop's clock**                                         | The dialog, same as a note. New behaviour for a reader who never writes a note; see the UI/UX call-out.                                                                                              |
| A note dragged into the ideas column                                                    | `'not-in-ideas'`, engine-side. Board unchanged, toast, spoken.                                                                                                                                       |
| A note dragged onto another day                                                         | `'not-in-another-day'`, decided in `plan-move.ts` **before** the engine and before the optimistic apply.                                                                                             |
| A stop dragged onto a day that already holds its place                                  | `'duplicate'`, as today.                                                                                                                                                                             |
| Confirming the dialog and the write fails                                               | `PlanOrder` rolls back to the pre-move arrangement; the time is untouched, because the batch is one transaction and a failure rolls both halves back.                                                |
| Declining the dialog                                                                    | No call, no optimistic change, no pending marker.                                                                                                                                                    |
| An untimed item dropped anywhere                                                        | The clock rule never fires — `timeOfItem` answers `null` — so untimed drags behave exactly as today.                                                                                                 |
| Two drags overlapping                                                                   | Unchanged: the rollback restores the arrangement captured before _this_ move rather than recomputing an inverse.                                                                                     |
| A note id in `itemIds` with no matching note (a delete one tab behind)                  | `planModel` skips ids it cannot resolve, as it already does for rows. The next `router.invalidate()` reconciles.                                                                                     |
| A viewer, or an archived trip                                                           | `editable` is false, `commitMove` returns early, no drag handle is rendered — unchanged.                                                                                                             |

## 📝 Risks & Impact Review

**Blast radius:** one route's `-ui/` layer, `src/components/planner/**`, and two additive/narrowing lines in one loader payload. No repository, no schema, no queue, no Durable Object, no route path.

**The named risk is regression, not breakage.** `TRP-10` (keyboard drag-and-drop) is closed on disk and this change edits the exact modules that closed it. The mitigation, stated as a mechanical rule in the Definition of Done below.

**The second risk is the widened dialog.** Arming the clock rule changes stop-drag behaviour for every trip that uses times, and no test today covers "a stop dragged against the clock" from the screen. Step 11's test is what closes that, and it is why the dialog is its own phase rather than a rider on the note drag.

**Rollback:** revert the PR. No migration to unwind, no value written that the previous Worker cannot read.

**Performance:** `mergeDayTimeline` is two sorts over a day's items — a few dozen at most — and runs inside the existing `planModel` memo. `orderFromPayload` runs once per loader answer. No new fetch, no new render pass.

## 📝 Resolved assumptions (autonomous defaults)

Every one of these was an Open Question; each is the most reversible answer, and each can be overridden before this spec merges.

**A1 — Publish the stop's stored position rather than reconstruct it.** `PlanBoardStop` gains `position`. Reconstructing from array index is provably wrong before a day's first merged reorder, because `nextOrderIndex` and the `day_notes` sort-order default number the two tables independently. `-server/plan.ts` is outside FR #116's Owned paths but inside the frozen plan's `01-S4` Owned paths (`docs/plans/01-trips-core.md:2080`); the a/b split left this half undone.

**A2 — A note cannot change day; the screen refuses the drag.** `reorderDayTimeline` takes one `dayId` and `day_notes` carries no relocation verb, so a cross-day note drop cannot be persisted. Landing the verb needs `days.ts` / `itinerary.ts` — a repository slice, which FR #116's _Out of scope_ assigns elsewhere and `01-S4a`'s own hand-off named as the alternative to refusing. The refusal is toasted **and** spoken, so the limitation is stated rather than silent.

**A3 — Delete the two dead note projections in the same change: `PlanBoardDay.notes` and `PlannerDay.notes`.** The first has no reader anywhere in `src/`; the second loses its only renderer at Step 4. The frozen plan assigns the first's deletion to `01-S4` (`:2199-2204`) and `plan-model.ts:62` already names `01-S4b` as its owner. Keeping either would leave exactly the second projection this spec argues against.

**A4 — Add sortable wiring to `note-row.tsx` rather than wrap it.** `NoteRow` renders its own `<li>`, so wrapping it in a sortable `<li>` produces nested list items — invalid HTML that breaks the count a screen reader reads out. The props added are the opt-in ones `StopRow` already carries. `note-row.tsx` is outside FR #116's Owned paths but is named by the plan as one of the stage's two renderers (`:2263-2264`).

**A5 — Stop numerals count stops, not sequence positions.**

**A6 — The note's move chevrons go through the merged `commitMove`.** In a merged list, chevrons that walk notes-only would move a note past a stop invisibly. `reorderDayNotesFn` stays on the server with its tests; it simply has no caller on this screen afterwards. Removing it is a follow-up on whoever owns `-server/day-notes.ts`.

**A7 — `onMove` returns the sentence to announce, not a refusal enum.** Keeps the refusal vocabulary and its 23 translations in the screen, and leaves `src/components/planner/` a presentation directory that takes formatted strings — the posture `types.ts:1-11` already states for times and durations.

**A8 — This ships as one spec, not two.** The merged render and the dialog are one capability: the dialog exists only because the merged drag can produce a `'timed'` refusal.

**A9 — Close `ordering.ts`'s two half-truths (`assignmentIds`, `scheduledCount`) here rather than defer them.** Deferring was the first answer and it was wrong: both are one line, both are already carrying notes or about to, and `ordering.test.ts:395` already passes a note id into a field named `assignmentIds`. Shipping that is the half-landed concept docs/SPEC.md §8 forbids. `ordering.ts` is `01-S4`-owned in the frozen plan (`:2063`) — the same standing as A1's file — and the `TRP-10` obligation is that its _assertions_ keep passing, which a field rename in fixtures does not touch.

**A10 — Extract the drag decision into `-ui/plan-move.ts` rather than test the screen.** The cross-day refusal, the "exactly one call carrying `clearTime`", and the decline-is-a-no-op are the three behaviours most likely to be got wrong and the three least reachable from `plan-screen.tsx`. Extracting the decision is a smaller diff than a screen harness and gives the policy one owner (§8).

## 📋 Phasing

- **Phase 1 — the day renders as one sequence.** Shippable alone: the interleaved list and the fixed empty state, with notes still moved by their chevrons. Closes the visible empty-day bug on its own.
- **Phase 2 — the note becomes draggable.** Pointer and keyboard, with every refusal announced.
- **Phase 3 — the "drop its time?" dialog.** Decision 9 reaching the screen, for stops as well as notes.
- **Phase 4 — end to end.** The appended journey.

Each phase lands its own copy in all 23 locales and leaves `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.

## 📋 Implementation Plan

### Phase 1 — the day renders as one sequence

1. **Publish the stop's position, delete the dead board projection.** `-server/plan.ts`: `PlanBoardStop` gains `position: number` from `stop.assignment.orderIndex`; `PlanBoardDay.notes` (`:148-152`) and its projection (`:219-223`) are removed. _Verify:_ `pnpm typecheck` is clean, proving no reader of the removed field remains.
2. **The item union.** `types.ts`: `PlannerItem`, `PlannerDay.items`, `PlannerDay.notes` removed, `stopsOf` / `notesOf`, with the third-kind extension point stated in the union's doc comment. `index.ts` exports them. _Verify:_ `pnpm typecheck`.
3. **The adapter merges.** `plan-model.ts`: `orderFromPayload(payload, notes)` builds merged `itemIds` through `mergeDayTimeline`; `planModel` builds `items` and keeps `rows` stops-only; `notesByItem` and `timeByItem`. _Verify:_ `-ui/__tests__/plan-model.test.ts` today covers **only** `notesByDay` and holds no `PlanBoardPayload` fixture — this step writes the repository's first one, then asserts: a day with times interleaves by clock; a day with none keeps position order; `rows` never contains a note; `scheduledCount` ignores notes; an unresolvable note id is skipped.
4. **`ordering.ts`'s two half-truths.** Rename `PlanChange.reorder`'s `assignmentIds` to `itemIds` (`:118`, `:462`, and the four fixture sites in `ordering.test.ts`); narrow `scheduledCount` to skip note ids. _Verify:_ `ordering.test.ts` passes with **every assertion unchanged** — including `:97`'s `toBe(5)`, and `:395`, which stops lying about what it is passing.
5. **One list in the day section.** `day-section.tsx`: one `SortableContext` over `day.items`, `StopRow` / `NoteRow` under it, `pendingItemIds` covering note item ids, stop numerals counting stops, the dashed target gated on `day.items.length === 0` and its copy read from `plan.day.empty`. _Verify:_ extended `rails.test.tsx` — interleaved render in merged order; the empty target absent for a day of notes and present for a truly empty day.
6. **Phase 1 copy.** `plan.day.empty` in all 23 locales via the `i18n-messages` skill. _Verify:_ the i18n parity test; `rails.test.tsx:281`'s literal assertion is updated to the new key's `en` text — the one and only assertion this change is permitted to rewrite (see the Definition of Done).
7. **Wire the screen to the merged model.** `plan-screen.tsx` passes the merged `order` and drops the separate note wiring from `DaySection`. _Verify:_ `pnpm test`, `pnpm build`.

### Phase 2 — the note becomes draggable

8. **The drag decision, extracted and pure.** New `-ui/plan-move.ts`: `planMoveOutcome`, `reorderPayload`, `refusalCopy` (Architecture 5). `commitMove` is rewritten as glue over it, `applyChange`'s `reorder` branch delegates to `reorderPayload`. _Verify:_ new `-ui/__tests__/plan-move.test.ts` — a cross-day note drop is `refused` with `not-in-another-day` and the engine is never reached; a note into ideas is `not-in-ideas`; a duplicate place is `duplicate`; a plain note move within its day is a `commit` whose payload carries `{ kind: 'note', id }` for the note and `{ kind: 'stop', id }` for each stop; `refusalCopy` returns a distinct key triple per reason.
9. **`NoteRow` becomes sortable.** `note-row.tsx`: opt-in `draggable`, `useSortable` on `noteItemId(note.id)` disabled while pending, a drag handle mirroring `StopRow`'s with `setActivatorNodeRef` and its own accessible name from `plan.note.drag`. _Verify:_ extended `notes.test.tsx` — the handle exists and is named when `draggable`, absent when not, absent for a reader with no write.
10. **The adapter speaks about notes.** `plan-dnd.ts`: takes `notesByItem`; `nameOfItem` names a note; `onMove` returns `string | null` and a non-null return is announced from `onDragEnd`. _Verify:_ extended `keyboard-drag.test.tsx` — a note is picked up, walked and dropped by keyboard, its name is spoken, and a harness whose `onMove` returns a refusal sentence puts that sentence in the live region.
11. **A note's drag preview.** `drag-preview.tsx`: a union over the subject keeping `className` and `category`; the note variant renders icon, time and headline and no thumbnail. `index.ts` exports the widened props. _Verify:_ `notes.test.tsx` renders the note preview; `pnpm typecheck`.
12. **Phase 2 copy.** The eleven Phase-2 keys in all 23 locales; the hardcoded strings at `plan-screen.tsx:640-644` and `:656-658` replaced. _Verify:_ the i18n parity test.

### Phase 3 — the "drop its time?" dialog

13. **The dialog.** `plan-actions.tsx`: `DropTimeDialog` on the shipped `Dialog`, confirm taking initial focus, `Escape` declining. _Verify:_ new `-ui/__tests__/plan-actions.test.tsx` (collected by the `ui` vitest project, `vitest.config.ts:72`) — confirm is focused on open, `Escape` calls decline, confirm calls confirm exactly once, the title names the item and its time.
14. **The `'timed'` path, for stops as well as notes.** `plan-screen.tsx` supplies `timeOfItem`; `planMoveOutcome` returns `ask-drop-time`; the screen opens the dialog; confirming re-enters `planMoveOutcome` with `dropTime` and issues **one** `reorderPlanFn` carrying the item in `clearTime` and in `items`; declining is a no-op; a failed write rolls `PlanOrder` back. _Verify:_ extended `plan-move.test.ts` — a timed note dropped against the clock is `ask-drop-time`; the same call with `dropTime` is a `commit` whose payload carries that item in `clearTime` **and** in `items`, exactly once; an untimed item is never `ask-drop-time`; **a timed stop dropped above an earlier stop is `ask-drop-time` too** — the behaviour change this phase introduces for readers who never write a note.
15. **The chevrons join the merged path.** `note-row.tsx` / `plan-screen.tsx`: move up / move down walk the merged sequence through `commitMove`; `position` and `count` are the merged index and length. _Verify:_ extended `notes.test.tsx` — moving a note up past a stop produces the merged order. `notes.test.tsx:157` ("disables the move a note at the end of the run cannot make") is re-expressed against the end of the _sequence_: this is the second of the two assertions this change is permitted to rewrite.
16. **Phase 3 copy.** The five Phase-3 keys in all 23 locales. _Verify:_ the i18n parity test.

### Phase 4 — end to end

17. **The journey.** One block appended to `e2e/trips-core.spec.ts` walking a merged day, a note drag, and a timed drop that opens and declines the dialog, with a silent console (ADR 0016 retired the visual gate). _Verify:_ `pnpm e2e`.

**The gate, in this order:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.

### Definition of Done — the no-regression rule, stated precisely

Every test in `ordering.test.ts`, `keyboard-drag.test.tsx`, `rails.test.tsx` and `notes.test.tsx` passes after this change. Fixtures may be adjusted where a type changed (a `PlannerDay` literal now supplies `items`; `PlanChange.reorder` now spells its field `itemIds`); **assertions may not**, with exactly two exceptions, both named in the plan above because both assert something this change deliberately redefines:

1. `rails.test.tsx:281` — asserts the literal `'Nothing planned — drop a place here'`, which Step 6 rewrites and moves into the catalogue.
2. `notes.test.tsx:157` — asserts a chevron disabled at the end of the _note run_, which Step 15 redefines as the end of the _sequence_.

Any third assertion that needs changing is a regression, not an adjustment, and stops the phase.

## 📝 Out of scope

- The engine and the write path — `01-S4a` (#115) landed them.
- A note-relocation verb, so a note could change day. A repository slice; see A2.
- The third item kind (transport rows), which arrives from `BKG-10` through the extension point this change declares.
- Translating `plan-dnd.ts`'s four existing drag announcements; see the Copy section's debt note.
- Removing the now-callerless `reorderDayNotesFn`; see A6.

## 🔧 Amendment

**`reorderDayTimeline` was replaced by `reorderDayTimelines` (#212, PR #922).** A2 above, and the spec bodies that name the old verb, describe the one-day writer. It now takes every day a drag touched (`{ tripId, days: [{ dayId, items, clearTime }] }`), reads the whole trip's stops and notes, and writes each row's `day_id` with its position in one batch, so a note or a stop that changes day is persisted by the same write that numbers it; `moveAssignment` and the route's pre-move loop are gone. What A2 refuses on the screen is unchanged: lifting the `not-in-another-day` refusal is #801.
