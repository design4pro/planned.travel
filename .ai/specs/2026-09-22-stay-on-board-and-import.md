# Put a stay on the board and create it from an import

| Field              | Value |
| ------------------ | ----- |
| **Status**         | in-progress |
| **Issue**          | #180 |
| **Spec PR**        | #708 |
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

`PlanScreen` adds a day-local action for an editable, non-archived trip. The plan payload supplies the trip currency and `BookingDayOption`-compatible days, including each stop's name and time, so it can mount the existing `BookingDialog` without a second loader. It opens that dialog in its accommodation branch with the clicked day as `initialStayDayId`; saving still calls `createStayFn`. The dialog remains the sole owner of validation, reservation creation, stay creation, compensation, notices, and retry behaviour.

During `confirmBookingImport`, an accommodation row first creates, records, and settles the reservation exactly as it does today. Only then does the new best-effort branch resolve the imported start and end dates against this trip's loaded day run. When both resolve and are ordered, it creates the linked accommodation with the new reservation id and the imported title and times. When neither date resolves, only one resolves, the range is reversed, or the accommodation write itself fails, the durable reservation remains recorded and is left for review rather than becoming a retryable failure or an invented partial stay.

## 📝 Architecture

| Concept | Owner | Change |
| --- | --- | --- |
| Board and dialog projection | `src/routes/_app/trips/$tripId/-server/plan.ts` | Enrich `PlanBoardDay.stays`; supply currency and `BookingDayOption`-compatible days. |
| Client planner stay shape | `src/components/planner/types.ts` | Add `PlannerStay`; replace name-only stays. |
| Planner projection | `src/routes/_app/trips/$tripId/-ui/plan-model.ts` | Preserve the enriched shape. |
| Day-header presentation | `src/components/planner/day-section.tsx` | Derive and render the per-day badges, outside the sequence. |
| Day-panel entry point | `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` | Open the shared stay dialog with a selected first day. |
| Shared dialog initial draft | `src/components/modules/book/booking-dialog.tsx` | Accept creation-only `initialStayDayId` without changing desk behaviour. |
| Imported stay creation | `src/server/fns/booking-import.ts` | Add the one post-reservation accommodation branch. |

The existing owners remain unchanged: `src/server/fns/stay-writes.ts` owns the reservation-plus-stay write semantics, `src/server/repos/itinerary.ts` owns tenant-scoped accommodation access, and `BookingDialog` owns the user-facing stay form. No route queries a repository directly.

### Board contract

`PlannerStay` is a projection, not a database type. It contains only the fields needed by the header: `id`, `name`, `startDayId`, `endDayId`, `checkInTime`, `checkInEndTime`, `checkOutTime`, `reservationId`, and the existing safe reservation URL when one is already exposed by the board. It does not duplicate a reservation record or load extra fields.

The same payload adds `currency` and emits each day as the exact `BookingDayOption` shape: `id`, `dayNumber`, `date`, `title`, and stops with `assignmentId`, `placeName`, and `startTime`. Its existing board stop projection keeps `placeId` for planner behaviour; the dialog projection includes the name because the dialog's stop combobox renders names. This is one authorized plan read, not a second booking-desk fetch.

The header labels are deterministic:

| Covered day | Rendered fact |
| --- | --- |
| First only | Check in, with its window when present. |
| Middle | Property name. |
| Last only | Check out, with its time when present. |
| First and last | Both check in and check out. |

### Import contract

The imported accommodation branch does not call a server function from another server-function handler. It imports and calls the existing plain, scoped itinerary writer at the appropriate boundary, keeping Zod validation at the public `confirmBookingImportFn` entry. It resolves dates only from the already authorized trip's day collection, never from client input or an unscoped lookup.

Immediately after `createReservation`, the branch appends the row to `written` and calls `settle`. It then attempts the accommodation work separately. A rejected range or accommodation write is deliberately not an error for the reservation: it has already been stamped and persisted in staged state, no `day_accommodations` row is created, and the warning carries the import row and organization context. It neither increments `failed` nor remains pending for another confirmation, so one malformed document does not create duplicate reservations on retry.

## 📝 Data Model

No schema change is required. `day_accommodations.reservation_id`, its index, and `ON DELETE SET NULL` already landed with #177. The implementation only consumes the current `DayAccommodation` fields and writes through the existing tenant-scoped itinerary repository.

## 📝 API Contracts

`confirmBookingImportFn` retains its existing Zod-validated input and result. Its successful count still means reservations written; a stay range that cannot be resolved or a best-effort accommodation write that fails does not turn a recorded reservation into a failed import row. The observability warning distinguishes an unresolved/reversed range and an accommodation-write refusal from a reservation write failure.

`BookingDialog` gains optional `initialStayDayId`. It is applied only when creating a new booking, selects accommodation plus the requested check-in day on every dialog open, and is ignored for edits. When absent, the booking desk keeps its existing empty draft. `PlanScreen` passes the plan payload's `currency` and `BookingDayOption` list explicitly; it does not reconstruct partial dialog data from `PlannerDay`.

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

The implementation adds each accepted key to all 23 locale catalogues in the same change. Existing `modules.book.*` stay vocabulary is reused when it expresses the same user-facing fact.

## 📝 Edge Cases & Failure Scenarios

- A stay beginning and ending on the same day renders both boundary labels and no sequence row.
- A stay with no check-in or check-out time still renders its semantic label without an empty separator or time placeholder.
- Multiple overlapping stays each remain a separate header fact; this feature does not impose a booking-conflict policy.
- A viewer or archived trip sees neither the day-panel stay action nor an attempted write path.
- An imported accommodation with dates outside the trip, only one matching date, or an end before its start records, settles, stamps, and persists its reservation only, then is left for review.
- An imported stay write rejected after reservation persistence leaves that reservation non-retryable; it is logged and the import batch continues without incrementing `failed`.

## 📝 Risks & Impact Review

This is a user-facing, medium-risk change with no protected schema, route-path, public projection, configuration, or dependency contract change. It must preserve tenant scope by using existing scoped itinerary and stay helpers; no new repository method means no new tenant-isolation seam.

Rollback is a normal code rollback: rows already created are valid reservations and valid stays through existing reads. A rollback only removes their new presentation/import creation behaviour; it does not strand an unreadable schema value.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
| --- | --- | --- | --- |
| 1 | What does a one-day stay say? | Render both check-in and check-out facts. | `stayDayWords` already defines both boundaries; suppressing either would lose a stated fact. |
| 2 | Should the board add a second stay form? | No; reuse `BookingDialog` with an opt-in initial stay draft. | One dialog preserves one validation and write path. |
| 3 | May the implementation edit the shared dialog although FR #180's owned-path list omits it? | Yes, minimally add creation-only `initialStayDayId`; add the plan payload's currency and full `BookingDayOption` data. Confirmed 2026-09-22. | The current dialog has no API that can preselect a day, and the plan payload lacks the currency and stop names it needs. Satisfying the requested same-dialog behaviour without these small changes is not technically possible. |
| 4 | What does import success count mean if the stay range is rejected? | Count the recorded reservation as written and leave it for review. | This preserves the existing confirm contract and the ticket explicitly requires the reservation to remain. |

## 📋 Phasing

### Phase 1 - carry stays to the board

Project the existing accommodation data into a typed planner shape and render complete day-header labels with unit coverage.

### Phase 2 - create stays from the plan and import

Reuse the booking dialog from the day panel, then add the valid-range import branch and its refusal cases with server and e2e coverage.

## 📋 Implementation Plan

1. Add `PlannerStay` and enrich the plan server/client projections. Verify typecheck and a plan-model test prove the shape reaches each covered day.
2. Add a pure header-fact helper and render its badges in `DaySection`. Verify first, middle, last, and single-day labels; assert stays are absent from `PlannerDay.items` and `rows`.
3. Add the plan payload's currency and full `BookingDayOption` data. Extend `BookingDialog` with creation-only `initialStayDayId`, reset it on every open, ignore it for edits, and mount that one dialog from the editable day panel. Verify the desk's empty booking behaviour is unchanged and the planner opens accommodation with the clicked day selected.
4. Add the accommodation branch to `confirmBookingImport`. Immediately persist the new reservation in the written/settled state, then resolve both dates against authorized trip days and attempt the stay. Verify valid creation plus the three range refusals and an accommodation-write refusal: every case retains a non-retryable reservation and only the valid case creates a stay.
5. Add the specified `e2e/journeys.spec.ts` journey for booking a multi-night stay and reading its plan headers with no console errors. Add approved copy to all 23 locales, then run the validation gate and UI evidence in light/dark, desktop/mobile.

## Amendment

What shipped in #757 differs from the design above in these places. Both phases shipped on that one pull request.

1. **`PlannerStay` carries the times formatted, not raw.** The client shape holds `checkIn` (the check-in window, e.g. `15:00 – 18:00`) and `checkOut`, both `string | null`, in place of `checkInTime`, `checkInEndTime` and `checkOutTime`. The planner's contract is that view models arrive formatted, so `plan-model.ts` formats them in the reader's locale. The server payload (`PlanBoardStay`) keeps the three raw fields as designed.
2. **Every covered day names the property, not only the middle ones.** A first day reads "Check in 15:00 – 18:00 · Hotel", a last day "Check out 11:00 · Hotel", and a middle day "Hotel". A boundary badge without the name leaves a reader with two stays on one day unable to tell which one arrives and which one leaves.
3. **No reservation link is rendered.** The board exposes no safe reservation URL today. `reservationId` is carried on `PlannerStay`, but the badge draws no link for it.
4. **`stayDayWords` is generic over the day key.** It compared day numbers. It now accepts any key it can compare for equality, so the header helper passes day ids and `PlannerStay` needs no day numbers.
5. **One extra copy key: `trips.plan.day.addStayShort`** ("Add a stay from this day"). This is the visible label. `trips.plan.day.addStay` ("Add a stay for {day}") is the accessible name, following the pattern of the place control beside it.
6. **The day-panel action lives in `PlannerDayTools`**, the documented owner of a day's footer controls, rather than in `plan-screen.tsx`. `plan-screen.tsx` only mounts the dialog.
7. **An imported stay's name is the booking's written title.** An untitled row therefore gets the same catalogue fallback as its reservation. The stay's address is the imported location. The stay's `placeId` is not set, the same as `createStay`.
