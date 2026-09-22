# Put a stay on the board and create it from an import

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #180 |
| **Spec PR**        | none |
| **Implementation** | none |

`03-S8b` · FR #180 · Parent PRD #167 · the board and import half of `BKG-05` in `docs/plans/03-reservations-and-transport.md`.

## 📝 TLDR

A stay already has one authoritative write path: `createStay` writes its reservation and the run of nights together. This change puts that same fact in every covered day header, opens the existing booking dialog from a day with the first night selected, and makes a confirmed accommodation import create the linked stay when its dates identify a valid range of trip days.

The board remains a single sequence of stops, notes, and transports. A stay is never a sequence row: it is a header fact belonging to every day it covers. No migration, dependency, binding, or second write path is introduced.

## 📝 Problem Statement

The current plan loader deliberately reduces each `DayAccommodation` to its name (`readPlanBoard` in `src/routes/_app/trips/$tripId/-server/plan.ts`), and `PlannerDay.stays` consequently holds only strings. A reader cannot distinguish checking in, sleeping at a property, and checking out, nor see the time window or reservation link that the stay already owns.

The booking desk can create a stay through `BookingDialog` and `createStayFn`, but the plan day offers no equivalent entry point. The import confirm creates an accommodation reservation and optionally its place, but stops before it creates `day_accommodations`; imported lodging therefore never reaches the board as nights.

## 📝 Proposed Solution

Extend the board read model with a `PlannerStay` shape carrying the stay identity, property name, first and last day ids, check-in window, check-out time, and reservation id/link. `readPlanBoard` maps the scoped itinerary accommodation rows into that shape and `plan-model.ts` passes it unchanged to `DaySection`.

`DaySection` derives words with the existing total `stayDayWords` rule: the first day says check in, the last says check out, intermediate days show the property name, and a one-day stay renders both check-in and check-out. It renders those facts only in the header badge list, outside `SortableContext`, so a stay never becomes a planner item.

`PlanScreen` adds a day-local action for an editable, non-archived trip. It opens `BookingDialog` in its accommodation branch with the clicked day as `startDayId`; saving still calls `createStayFn`. The dialog remains the sole owner of validation, reservation creation, stay creation, compensation, notices, and retry behaviour.

During `confirmBookingImport`, an accommodation row first creates the reservation exactly as it does today. The new branch resolves the imported start and end dates against this trip's loaded day run. When both resolve and are ordered, it calls the existing scoped accommodation writer with the new reservation id and the imported title and times. When neither date resolves, only one resolves, or the range is reversed, it leaves the reservation intact and records the existing import-review outcome rather than inventing a partial stay.

## 📝 Architecture

| Concept | Owner | Change |
| --- | --- | --- |
| Board stay projection | `src/routes/_app/trips/$tripId/-server/plan.ts` | Enrich `PlanBoardDay.stays` from `DayAccommodation`. |
| Client planner stay shape | `src/components/planner/types.ts` | Add `PlannerStay`; replace name-only stays. |
| Planner projection | `src/routes/_app/trips/$tripId/-ui/plan-model.ts` | Preserve the enriched shape. |
| Day-header presentation | `src/components/planner/day-section.tsx` | Derive and render the per-day badges, outside the sequence. |
| Day-panel entry point | `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` | Open the shared stay dialog with a selected first day. |
| Shared dialog initial draft | `src/components/modules/book/booking-dialog.tsx` | Accept an opt-in initial stay draft without changing desk behaviour. |
| Imported stay creation | `src/server/fns/booking-import.ts` | Add the one post-reservation accommodation branch. |

The existing owners remain unchanged: `src/server/fns/stay-writes.ts` owns the reservation-plus-stay write semantics, `src/server/repos/itinerary.ts` owns tenant-scoped accommodation access, and `BookingDialog` owns the user-facing stay form. No route queries a repository directly.

### Board contract

`PlannerStay` is a projection, not a database type. It contains only the fields needed by the header: `id`, `name`, `startDayId`, `endDayId`, `checkInTime`, `checkInEndTime`, `checkOutTime`, `reservationId`, and the existing safe reservation URL when one is already exposed by the board. It does not duplicate a reservation record or load extra fields.

The header labels are deterministic:

| Covered day | Rendered fact |
| --- | --- |
| First only | Check in, with its window when present. |
| Middle | Property name. |
| Last only | Check out, with its time when present. |
| First and last | Both check in and check out. |

### Import contract

The imported accommodation branch does not call a server function from another server-function handler. It imports and calls the existing plain, scoped write helper at the appropriate boundary, keeping Zod validation at the public `confirmBookingImportFn` entry. It resolves dates only from the already authorized trip's day collection, never from client input or an unscoped lookup.

A failed range resolution is deliberately not an error for the reservation: the reservation is written and remains available to review, while no `day_accommodations` row is created. A failure after a valid reservation write is logged with the import row and organization context and follows the existing per-row confirm isolation, so one malformed document does not abandon its neighbours.

## 📝 Data Model

No schema change is required. `day_accommodations.reservation_id`, its index, and `ON DELETE SET NULL` already landed with #177. The implementation only consumes the current `DayAccommodation` fields and writes through the existing tenant-scoped itinerary repository.

## 📝 API Contracts

`confirmBookingImportFn` retains its existing Zod-validated input and result. Its successful count still means reservations written; a stay range that cannot be resolved does not turn a recorded reservation into a failed import row. The observability warning distinguishes an unresolved or reversed stay range from a reservation write failure.

`BookingDialog` gains an optional, internal initial-stay input. When absent, its booking-desk behaviour and empty draft are unchanged. When supplied by the planner, it selects accommodation and the requested check-in day before the reader edits or saves anything.

## 📝 UI/UX

The day header badge group is visible in light and dark themes, wraps without horizontal overflow at 360 px, and retains the existing compact rail hierarchy. Each badge has text as well as its bed icon; check-in/check-out timing is never colour-only. Reservation links, when exposed, have an accessible property-name label and preserve normal focus-visible treatment.

The day-panel action is available only where the existing plan write controls are available. Its accessible name includes the selected day. It opens the same modal, preserves Escape, focus return, validation summaries, pending state, and error handling already supplied by `BookingDialog`.

## Visual change expected

`/trips/$tripId/plan` changes on desktop and mobile in light and dark themes. A multi-night stay shows check-in on its first header, the property name on intermediate headers, and check-out on its last header; a one-day stay shows both boundary facts. The editable day panel adds a stay action that opens the existing booking dialog with that day selected. No other route changes.

## Copy

| Key | English text |
| --- | --- |
| `trips.plan.stay.checkIn` | Check in |
| `trips.plan.stay.checkOut` | Check out |
| `trips.plan.day.addStay` | Add a stay for {day} |
| `trips.plan.stay.nights` | {count, plural, one {# night} other {# nights}} |

The implementation adds each accepted key to all 23 locale catalogues in the same change. Existing `modules.book.*` stay vocabulary is reused when it expresses the same user-facing fact.

## 📝 Edge Cases & Failure Scenarios

- A stay beginning and ending on the same day renders both boundary labels and no sequence row.
- A stay with no check-in or check-out time still renders its semantic label without an empty separator or time placeholder.
- Multiple overlapping stays each remain a separate header fact; this feature does not impose a booking-conflict policy.
- A viewer or archived trip sees neither the day-panel stay action nor an attempted write path.
- An imported accommodation with dates outside the trip, only one matching date, or an end before its start writes its reservation only and is left for review.
- An imported stay write rejected after reservation creation does not erase the reservation; it is logged and the import batch continues.

## 📝 Risks & Impact Review

This is a user-facing, medium-risk change with no protected schema, route-path, public projection, configuration, or dependency contract change. It must preserve tenant scope by using existing scoped itinerary and stay helpers; no new repository method means no new tenant-isolation seam.

Rollback is a normal code rollback: rows already created are valid reservations and valid stays through existing reads. A rollback only removes their new presentation/import creation behaviour; it does not strand an unreadable schema value.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
| --- | --- | --- | --- |
| 1 | What does a one-day stay say? | Render both check-in and check-out facts. | `stayDayWords` already defines both boundaries; suppressing either would lose a stated fact. |
| 2 | Should the board add a second stay form? | No; reuse `BookingDialog` with an opt-in initial stay draft. | One dialog preserves one validation and write path. |
| 3 | May the implementation edit the shared dialog although FR #180's owned-path list omits it? | Yes, minimally add the optional initial-stay input. ⚠ NEEDS HUMAN CONFIRMATION | The current dialog has no API that can preselect a day. Satisfying the requested same-dialog behaviour without this small shared-component change is not technically possible. |
| 4 | What does import success count mean if the stay range is rejected? | Count the recorded reservation as written and leave it for review. | This preserves the existing confirm contract and the ticket explicitly requires the reservation to remain. |

## 📋 Phasing

### Phase 1 - carry stays to the board

Project the existing accommodation data into a typed planner shape and render complete day-header labels with unit coverage.

### Phase 2 - create stays from the plan and import

Reuse the booking dialog from the day panel, then add the valid-range import branch and its refusal cases with server and e2e coverage.

## 📋 Implementation Plan

1. Add `PlannerStay` and enrich the plan server/client projections. Verify typecheck and a plan-model test prove the shape reaches each covered day.
2. Add a pure header-fact helper and render its badges in `DaySection`. Verify first, middle, last, and single-day labels; assert stays are absent from `PlannerDay.items` and `rows`.
3. Extend `BookingDialog` with its optional initial stay draft and mount that one dialog from the editable day panel. Verify the desk's empty booking behaviour is unchanged and the planner opens accommodation with the clicked day selected.
4. Add the accommodation branch to `confirmBookingImport`, resolving both dates against the authorized trip days before writing the stay. Verify valid creation plus all three refusal paths, each retaining the reservation.
5. Add the specified `e2e/journeys.spec.ts` journey for booking a multi-night stay and reading its plan headers with no console errors. Add approved copy to all 23 locales, then run the validation gate and UI evidence in light/dark, desktop/mobile.
