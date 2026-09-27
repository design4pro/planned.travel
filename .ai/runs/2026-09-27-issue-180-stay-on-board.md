# Execution plan — 03-S8b: the stay on the board, and the stay the import creates

Issue: #180
Source doc: .ai/specs/2026-09-22-stay-on-board-and-import.md
Spec PR: #708 (merged)
Branch: feat/issue-180-stay-on-board

## Goal

Every day a stay covers says what that day is in its header (check in with its window, the property
between, check out), the plan's day panel opens the booking desk's own dialog with that day selected,
and a confirmed accommodation import creates the linked stay when its dates resolve to an ordered pair
of this trip's days.

## Scope

- `src/routes/_app/trips/$tripId/-server/plan.ts` — `PlanBoardDay.stays` carries the stay shape; the
  payload adds `currency` and `bookingDays` (`BookingDayOption`).
- `src/components/planner/types.ts` — `PlannerStay`; `PlannerDay.stays` widened to it.
- `src/routes/_app/trips/$tripId/-ui/plan-model.ts` — formats the stay's times, passes it through.
- `src/components/planner/day-section.tsx` — the header badges, outside `SortableContext`.
- `src/components/modules/book/booking-form.ts` — `stayDayWords` becomes generic over the day's
  identity so the header reuses the one rule (it had no production caller yet).
- `src/components/modules/book/booking-dialog.tsx` — creation-only `initialStayDayId` (spec
  assumption 3, operator-confirmed 2026-09-22).
- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` and `planner-day-tools.tsx` — the day-panel
  entry point mounting the one `BookingDialog`.
- `src/server/fns/booking-import.ts` — one branch after the reservation is written and settled.
- Copy in all 23 locales; `e2e/journeys.spec.ts` appended.

## Non-goals

- The itinerary repository (#179 owns it), the import's producer and staged read (#178).
- A booking-conflict policy for overlapping stays.
- A second stay form or write path.

## Risks

- `plan-screen.tsx` is the most contended file of the plan set; touch only the entry point.
- The import branch must never turn a written reservation into a retryable failure (duplicates).

## Implementation Plan

### Phase 1: Carry stays to the board

- 1.1 `PlannerStay` and the enriched server and client projections.
- 1.2 Header facts in `DaySection`, with unit coverage of first, middle, last and single-day.

### Phase 2: Create stays from the plan and the import

- 2.1 Plan payload `currency` + `bookingDays`; `BookingDialog.initialStayDayId`; the day-panel entry.
- 2.2 The accommodation branch of `confirmBookingImport` with the three refusals and a write refusal.
- 2.3 Copy in 23 locales, the e2e journey, the full gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Carry stays to the board

- [x] 1.1 PlannerStay and the enriched server and client projections — 997c5b85
- [x] 1.2 Header facts in DaySection — 997c5b85

### Phase 2: Create stays from the plan and the import

- [x] 2.1 Plan payload, dialog initialStayDayId, day-panel entry — ae4bf3b6
- [x] 2.2 Import accommodation branch — 25b068bd
- [x] 2.3 Copy, e2e journey, full gate — 4e8e726c
