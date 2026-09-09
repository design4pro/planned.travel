# Execution plan — a day note you can write

Source doc: .ai/specs/2026-09-08-writable-day-note.md
Tracker: FR #113 (stage `01-S2b` of `docs/plans/01-trips-core.md`), spec PR #336 (merged).
Engine: om-auto-create-pr (steps: 10, --loop: no)

## Goal

Close the unguarded-write hole on day notes and make a note writable: a composed write guard, an
icon vocabulary, a markdown detail, a time, a position, the row that shows them and the editor that
writes them.

## Scope

The ticket's Owned paths plus the three additions the spec justifies (the 23 locale files, the
route-module test file, and `planner/index.ts`/`types.ts`, which the ticket already lists):

- `src/server/repos/days.ts` — `requireTripDay` on `createDayNote`, the icon enum, `detail`.
- `src/routes/_app/trips/$tripId/-server/day-notes.ts` (new) — the guard, the two pure helpers and
  the five server functions.
- `src/routes/_app/trips/$tripId/plan.tsx` — loader only.
- `src/routes/_app/trips/$tripId/-ui/plan-model.ts`, `-ui/plan-screen.tsx`, `-ui/note-dialog.tsx` (new).
- `src/components/planner/{types.ts,index.ts,day-section.tsx,note-row.tsx (new)}`.
- Tests: `src/server/repos/__tests__/{day-notes.test.ts (new),tenant-isolation.test.ts,member-isolation.test.ts}`,
  `src/routes/_app/trips/$tripId/-server/__tests__/day-notes.test.ts` (new),
  `src/components/planner/__tests__/notes.test.tsx` (new), `e2e/trips-core.spec.ts` (append).
- `src/lib/i18n/messages/*/trips.ts` — all 23 locales.

## Non-goals

- The merged day sequence and draggable notes (`01-S4b`, #116) — no `useSortable`, no `ordering.ts` change.
- Widening `AUTHORED_ERROR_NAMES` in `src/server/errors/public.ts` (spec Q5, follow-up 1).
- A role term on `loadPlanBoard`'s `editable` (`-server/plan.ts` belongs to `07-S1`, follow-up 2).
- Deleting `PlanBoardDay.notes`' dead projection (`01-S4b`, follow-up 3).
- Any migration, any dependency, any generated file.

## Implementation Plan

Taken from the spec's Implementation Plan, unchanged in substance.

### Phase 1 — the guard

- **Step 1 — Red first.** The `day notes` block in `src/server/repos/__tests__/tenant-isolation.test.ts`:
  `createDayNote` with B's trip and B's day is a `NotFoundError`; A's own trip with B's day is a
  `NotFoundError`; B's rows are byte-identical afterwards. Both cases fail before Step 2.
- **Step 2 — Green.** `createDayNote` opens with `requireTripDay(scope, values.tripId, values.dayId)`.

### Phase 2 — the note

- **Step 3 — The vocabulary.** `DAY_NOTE_ICONS` / `DayNoteIcon` in `planner/types.ts`, re-exported
  from `days.ts` and exported from `planner/index.ts`; `createDayNoteInput.icon` narrows to the enum
  and gains `detail: longTextSchema.nullish()`; `repos/__tests__/day-notes.test.ts`.
- **Step 4 — The sequencing, pure.** `noteSlotOrder` and `nextNotePosition` in `-server/day-notes.ts`,
  unit-tested against literals.
- **Step 5 — The server functions.** `writableTripDay`, `loadDayNotes` and the four writes, with the
  route-module tests (non-member, viewer, owner, archived, insert position, move).
- **Step 6 — The loader and the model.** `plan.tsx`'s `Promise.all`; `notesByDay` in `plan-model.ts`;
  `PlannerDay.notes` widens.
- **Step 7 — The copy.** Every key from the spec's Copy section in all 23 locales.
- **Step 8 — The row.** `note-row.tsx` with the icon registry, the disclosure and the actions cluster;
  `day-section.tsx` renders the run and the add control; `planner/__tests__/notes.test.tsx`.
- **Step 9 — The editor.** `-ui/note-dialog.tsx` and its wiring in `plan-screen.tsx`.
- **Step 10 — The gate and the evidence.** The `e2e/trips-core.spec.ts` block, then the full
  validation gate and the blind A/B pair.

## Risks

- `createDayNote` becomes stricter for the seed: `apply-trip.ts` writes ten icon names, all inside
  the nineteen-name vocabulary. The seed run in Step 3 proves it rather than assuming it.
- The role guard is a user-visible behaviour change: a viewer who could edit notes yesterday cannot
  today (PRD #104 decision 6). It belongs in the PR description.
- `reorderDayTimeline` stays the only writer of the day's position line; a second writer would be the
  defect this plan exists to avoid.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the guard

- [ ] 1.1 Red first — the tenant-isolation cases for `createDayNote`
- [ ] 1.2 Green — `requireTripDay` on `createDayNote`

### Phase 2: the note

- [ ] 2.1 The vocabulary — `DAY_NOTE_ICONS`, the icon enum and `detail`
- [ ] 2.2 The sequencing, pure — `noteSlotOrder` and `nextNotePosition`
- [ ] 2.3 The server functions — `writableTripDay`, the read and the four writes
- [ ] 2.4 The loader and the model — `Promise.all` and `notesByDay`
- [ ] 2.5 The copy — every key in all 23 locales
- [ ] 2.6 The row — `note-row.tsx` and the day's note run
- [ ] 2.7 The editor — `note-dialog.tsx` and its wiring
- [ ] 2.8 The gate and the evidence — the e2e block, the full gate, the A/B pair
