# Execution plan — 03-S8a: a stay that covers the nights it actually covers

Issue: #179
Source doc: docs/plans/03-reservations-and-transport.md (Stage 03-S8, the record half named by #179)
Branch: feat/issue-179-stay-nights

## Goal

Give the accommodation record a write path: a stay is created together with the booking that pays
for it (booking first, compensating delete when the stay write fails), counted in nights as the
difference between two day numbers, and read on the booking desk as nights rather than a start time.

## Scope

- `src/server/repos/itinerary.ts` — only: `reservationId: idSchema.nullish()` on both accommodation
  validators, the reservation-of-the-same-trip reference guard, and `assertTripRole(['owner',
'editor'])` on the three accommodation writers.
- `src/server/fns/stays.ts` (new) — `createStayFn`, `updateStayFn`, `deleteStayFn`, each a thin
  wrapper over a plain, testable function.
- `src/server/fns/reservations.ts` — the desk payload carries each booking's linked stay (the read).
- `src/components/modules/book/` — the stay draft and its rules (`booking-form.ts`), the stay branch
  (`stay-dialog.tsx`), the swap in `booking-dialog.tsx`, the stay card in `bookings-timeline.tsx`,
  `index.ts`, and `__tests__/stays.test.ts`.
- Copy in all 23 locales (`src/lib/i18n/messages/*/modules.ts`).
- Tests: `src/server/fns/__tests__/stays.test.ts`, `src/server/repos/__tests__/tenant-isolation.test.ts`,
  `e2e/journeys.spec.ts`.

## Decisions (human-approved on the issue run)

1. No new spec PR: the frozen plan's Stage 03-S8 plus issue #179 are the source doc. `docs/plans/` is
   not edited.
2. The stay's server functions live in `src/server/fns/stays.ts`, beside `fns/reservations.ts`, not
   in the route-local `-server/stays.ts` the ticket names: `components/modules/book` must not import a
   route-private module, and #180 reuses these writes from the plan board.

## Non-goals

- The plan board (day-header badge, `PlannerDay.stays`, `plan-model.ts`, `-server/plan.ts`,
  `plan-screen.tsx`'s "Add a stay") — that is `03-S8b`, #180.
- The accommodation branch of the booking-import confirm (`fns/booking-import.ts`) — not an owned
  path of #179.
- A property picker over the trip's places — the name and address fields already carry it.
- A stay recorded without a booking from the desk; the seeder's null-link stays stay as they are.

## Implementation Plan

### Phase 1: Repository guards

- 1.1 Widen both accommodation validators with `reservationId`, add the reference guard and the role
  guard; tenant-isolation block (cross-tenant reservation link refused, role guard both ways).

### Phase 2: Stay server functions

- 2.1 `fns/stays.ts`: create (booking → stay, compensating delete), update (both records, stay must
  belong to the trip and the booking), delete (stay and its booking); ledger and room mirror.
- 2.2 Desk payload carries the linked stay per booking.
- 2.3 Server-seam tests: compensation leaves no orphan, booking delete clears the link and keeps the
  nights, no per-night division, cross-trip refusal.

### Phase 3: The stay on the desk

- 3.1 `booking-form.ts`: `stayNights`, `stayDayWord`, the stay draft fields and `validateStayDraft`;
  `__tests__/stays.test.ts`.
- 3.2 Copy in all 23 locales.
- 3.3 `stay-dialog.tsx` (the stay branch) and the swap in `booking-dialog.tsx`.
- 3.4 The stay card and the "remove with the stay" action in `bookings-timeline.tsx`; `index.ts`.
- 3.5 e2e block in `e2e/journeys.spec.ts`.

### Phase 4: Gate

- 4.1 Full `validation.commands` gate.

## Risks

- Two D1 writes across two repositories cannot share a batch; the compensating delete is the stated
  mitigation, and the update path is two ordered writes without compensation (a failed second write
  is reported, the first is left as the reader asked for it).
- 22 translations authored in one change; the parity test is the guard.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Repository guards

- [x] 1.1 Widen both accommodation validators with `reservationId`, add the reference guard and the role guard; tenant-isolation block — 5151ce875

### Phase 2: Stay server functions

- [x] 2.1 `fns/stays.ts`: create, update, delete — 1e8afb638
- [x] 2.2 Desk payload carries the linked stay per booking — 1e8afb638
- [x] 2.3 Server-seam tests — 1e8afb638

### Phase 3: The stay on the desk

- [ ] 3.1 `booking-form.ts` stay rules and `__tests__/stays.test.ts`
- [ ] 3.2 Copy in all 23 locales
- [ ] 3.3 `stay-dialog.tsx` and the swap in `booking-dialog.tsx`
- [ ] 3.4 The stay card and the remove-with-stay action; `index.ts`
- [ ] 3.5 e2e block in `e2e/journeys.spec.ts`

### Phase 4: Gate

- [ ] 4.1 Full `validation.commands` gate
