# Execution plan — the day as one sequence on screen (`01-S4b`)

Source doc: .ai/specs/2026-09-10-day-as-one-sequence.md
FR: #116 · Spec PR: #403 · Parent PRD: #104 · Stage `01-S4b` of `docs/plans/01-trips-core.md` (frozen)
Engine: om-auto-create-pr (steps: 17, --loop: no)

## Goal

Render a day in the planner rail as **one** sequence of stops and notes, make a note
draggable against a stop by pointer and by keyboard, and turn the engine's existing
`'timed'` refusal into a dialog that asks whether to drop the item's time — confirming
sends exactly one reorder call carrying that time in `clearTime`.

## Scope

The client half only. `01-S4a` (#115) landed the engine (`mergeDayTimeline`, the
`note:` id space, the `'not-in-ideas'` / `'timed'` refusals) and the write path
(`reorderPlanFn` taking `items: Array<{ kind, id }>` plus `clearTime`,
`reorderDayTimeline` writing both tables in one batch). Nothing below the route
boundary is added here.

Owned surface:

- `src/routes/_app/trips/$tripId/-server/plan.ts` — `PlanBoardStop.position`, delete `PlanBoardDay.notes`
- `src/components/planner/{types,index,ordering,day-section,note-row,drag-preview,plan-dnd}.ts(x)`
- `src/routes/_app/trips/$tripId/-ui/{plan-model.ts,plan-screen.tsx,plan-actions.tsx}` and the new `-ui/plan-move.ts`
- tests: `planner/__tests__/{ordering,rails,keyboard-drag,notes}`, `-ui/__tests__/{plan-model,plan-move,plan-actions}`
- copy: `src/lib/i18n/messages/*/trips.ts` — 23 locales
- `e2e/trips-core.spec.ts` — one appended block

## Non-goals

- The engine and the write path (`01-S4a`, landed).
- A note-relocation verb so a note could change day — a repository slice; the screen
  refuses the drag instead (spec A2).
- The third item kind (transport rows) — arrives from `BKG-10` through the extension
  point this change declares.
- Translating `plan-dnd.ts`'s four pre-existing hardcoded drag announcements.
- Removing the now-callerless `reorderDayNotesFn` (spec A6).

## Risks

- **Regression over `TRP-10`** (keyboard drag-and-drop), which is closed on disk in the
  exact modules this change edits. Mitigation is the mechanical rule in the spec's
  Definition of Done: every assertion in `ordering.test.ts`, `keyboard-drag.test.tsx`,
  `rails.test.tsx` and `notes.test.tsx` still passes, with exactly two named exceptions
  (`rails.test.tsx:281`, `notes.test.tsx:157`). A third is a regression, not an adjustment.
- **The widened dialog changes stop-drag behaviour.** Supplying `timeOfItem` arms the
  clock rule for every item, so a timed stop dragged against the clock now asks instead
  of reordering silently. Deliberate — PRD #104 decision 9 reaching the screen — and the
  first thing the QA pass looks at.
- **Copy parity.** 18 keys across 23 locales; the parity test is the gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the day renders as one sequence

- [x] 1.1 Publish the stop's position, delete the dead board projection — 3f4418b1
- [x] 1.2 The item union in `types.ts` — 3f4418b1
- [x] 1.3 The adapter merges in `plan-model.ts` — 3f4418b1
- [x] 1.4 `ordering.ts`'s two half-truths — 3f4418b1
- [x] 1.5 One list in the day section — 3f4418b1
- [x] 1.6 Phase 1 copy — `plan.day.empty` in 23 locales — 3f4418b1
- [x] 1.7 Wire the screen to the merged model — 3f4418b1

### Phase 2: the note becomes draggable

- [x] 2.1 The drag decision, extracted and pure — `-ui/plan-move.ts` — 4678f317
- [x] 2.2 `NoteRow` becomes sortable — 4678f317
- [x] 2.3 The adapter speaks about notes — `plan-dnd.ts` — 4678f317
- [x] 2.4 A note's drag preview — 4678f317
- [x] 2.5 Phase 2 copy — eleven keys in 23 locales — 4678f317

### Phase 3: the "drop its time?" dialog

- [x] 3.1 The dialog — `DropTimeDialog` in `plan-actions.tsx` — 7f3db779
- [x] 3.2 The `'timed'` path, for stops as well as notes — 7f3db779
- [x] 3.3 The chevrons join the merged path — 7f3db779
- [x] 3.4 Phase 3 copy — five keys in 23 locales — 7f3db779

### Phase 4: end to end

- [x] 4.1 The appended journey in `e2e/trips-core.spec.ts` — ff436784
