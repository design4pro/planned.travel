# Day detail over the planner map

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #124  |
| **Spec PR**        | #1333 |
| **Implementation** | none  |

## TLDR

Proposed: a traveller opens a Day's details over the planner map without leaving the board. The panel reuses existing Day, Stay, Note and Reservation readers and the existing add-Stay flow. This document is design-only; the independent undo capability is specified in [Planner undo](2026-10-16-planner-undo.md).

## Problem and evidence

Issue #124 promises a nonmodal Day detail and undo. Its latest Agent Brief explicitly requests specifications before implementation. The current `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` composes the map, itinerary and dialogs, but Day activation only focuses a Day. `src/components/planner/selection.ts` keeps `dayId` and `placeId` simultaneously; `dayId` is also changed by hover and Place selection. It cannot itself mean that a detail panel is open.

The board's `PlanBoardStay` has windows and a `reservationId`, but no confirmation number. `loadBookingDeskFn` in `src/server/fns/reservations.ts` returns `BookingRow.confirmationNumber`. The screen already mounts `BookingDialog` with `initialStayDayId`. Searches of planner server functions found no Day-title writer. These are checked premises at authoring HEAD, not assumptions inherited from the frozen `01-S9b` plan. Weather already has its own badge and fuller reading under #631; the old claim that no weather exists is obsolete.

## Scope and reviewed decisions

This panel is independently shippable. It does not depend on undo or require new server functions, SQL, migrations, packages or public routes. Day title is read-only: no pencil or local-only rename. A future rename needs its own validated write design. This explicitly narrows the reference screenshot's refinement, not the original panel promise.

Reservations are included as read-only details using the existing reader. The weather spec’s former “When #124 lands” migration is explicitly deferred to a separate integration slice after product/UX review. That slice moves the existing `DayWeatherPanel`, removes its Popover and routes badge activation/focus to the Day weather region without extra provider requests. Until then keep the current Popover; the integration slot renders no empty section. Weather-provider work stays with #631; retain the current weather control and declare a named integration slot without a duplicate request, fake badge or permanent loading state. No source change or new follow-up issue is part of this design run. A person merges the design PR, using `Refs #124`; the spec-to-tickets workflow slices implementation after merge.

## Architecture and ownership

The screen owns composition and fetch lifetimes. New route-local `-ui/day-detail.tsx` owns the nonmodal view, while `-ui/day-detail-model.ts` owns the pure join of existing payloads. Reuse `plan-board.ts` for ordering and existing locale formatters; do not create a second timeline merger. A route-local `-ui/planner-detail-state.ts` owns a discriminated detail state: closed, Day expanded, Day minimised, or Place. Map emphasis remains `selectionReducer`'s responsibility. Hover never opens a panel.

All panel-opening actions use the one detail state: Day header opens Day expanded, Place row or pin replaces Day, and opening Day replaces Place. Minimise retains the Day identifier; expand does not change selection or refetch solely because of the toggle. Repeated Day activation expands its minimised panel. Closing clears detail state without manufacturing a Place selection. Any consumer added to shared selection actions lands with those consumers in one slice (SPEC §8).

The screen calls existing `loadBookingDeskFn({ data: { tripId } })` on first detail open, caches only for the current mounted Trip and invalidates alongside the board after a relevant write. Loading and rejection are guarded by request generation and Trip identity; late responses never populate another Trip or a closed/replaced detail. No fetch in `components/ui`, no direct repository call from the client, and no server function calling another server function. Existing route-local planner server functions remain untouched.

## Read contract

| Content         | Existing source                                    | Presentation and missing-data rule                                                                                                                                                                            |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day identity    | `PlanBoardPayload.days`                            | Key by `dayId`, never by ordinal or date. Always show localized Day N and optional stored title.                                                                                                              |
| Date            | `PlanBoardDay.date`                                | Localized full weekday and calendar date for dated Trips; undated shows “Dates not set”, never today's date.                                                                                                  |
| Stays           | `PlanBoardDay.stays`                               | Show every covering Stay, including overlap, in start-Day order then id. Show actual name, available check-in start/end and check-out; use the existing Stay formatter. Do not infer a missing endpoint.      |
| Confirmation    | `BookingRow` matched by exact `Stay.reservationId` | Show the actual nonblank number. Missing match or blank number gets “No confirmation number”; reader failure is an error, not that empty state. No match by name.                                             |
| Notes           | Existing `loadDayNotes` payload                    | Filter by `dayId`, order through existing board logic; render body, detail, icon and available time as text through existing safe renderer.                                                                   |
| Reservations    | `BookingDeskPayload.bookings`                      | Include exact `dayId` matches, Stop `assignmentId` matches for this Day, and Stay `reservationId` matches. Dedupe by Reservation id. Never infer a relationship solely from names, Place similarity or dates. |
| Reservation row | Existing `BookingRow`                              | Category/status via existing registries, actual title, available location and time. Status has text as well as tint; link to existing Book route.                                                             |
| Weather         | Existing #631 feature                              | Keep current reading behavior and accessible control; integration slot has no new provider or fabricated value.                                                                                               |

No Stay is a designed empty state with “Add stay” for an editable board. Invoke the screen's existing `BookingDialog`, passing `initialStayDayId` and existing Trip days/currency. Keep the Day detail underneath and restore focus to Add stay when that modal closes; reuse existing ownership arbitration. After successful save invalidate board and Reservation cache together. Read-only or archived boards still show details, but no Add stay action. A missing Day disables the action before it can submit.

An empty Notes section says “No notes for this day”; an empty Reservation section says “No reservations for this day”. The overall panel still describes what a Day can hold. A Reservation read failure keeps known Day/Notes/Stay content and offers Retry for the failed section, never a false “none”. Joining data from multiple read generations must not show a previous Day's details as current.

## UI/UX

Use the existing workspace glass surface, tokens and responsive rail bounds. Expanded panel is bottom-docked inside the map viewport, with a shared max-width and responsive inline margins, header always visible and body scrolling internally. At 360px and 200% zoom it fits available inline size without horizontal scroll. Reserve a usable map area above it; expanded height is at most half the available map height, respecting safe areas and workspace chrome. Do not use a full-screen mobile modal. RTL uses logical properties. Light and dark use semantic tokens, reduced motion removes slide animation.

Expanded header carries calendar icon, Day N, optional title, full date (or undated label), Minimise and Close. The minimised bar remains at the bottom map edge with the same identification plus Expand and Close, without body content taking focus. Loading reserves the final header and section geometry with skeleton rows inside the same scroll container; sections do not collapse during invalidation. Test layout shifts attributed to this panel, excluding unrelated shell/font shifts.

Render a named `section`/region with heading `tabIndex=-1`, not `role=dialog` or `aria-modal`. On explicit open or switching Days focus the heading after mount. Tab and Shift+Tab leave the panel; map and rail remain operable. Minimising while focus is in the body transfers focus to Expand; expanding focuses the heading. Opening a Place replaces Day without returning focus to the old trigger.

Close restores focus to the originating Day header if connected, otherwise that Day's current header, then the itinerary heading. Escape dismisses only while focus is inside the panel, after an active modal/popover, text editor or drag has had its own Escape handling; handle the innermost owner first and prevent duplicate dismissal. Escape on the map or rail does not dismiss the panel. No focus trap or global scroll lock. A background refresh never steals focus. If an authoritative board response no longer contains the Day, announce “This day is no longer available”, close it, and focus the itinerary heading only when focus was inside the disappearing panel. An error response alone is not proof of deletion.

## Visual change expected

Route: existing Trip Plan workspace, no path change. States: Day open, minimised, switching Day/Place, dated/undated, multiple/empty Stays, add-Stay dialog, Notes/Reservations empty/loading/error, disappearing Day, viewer and archived Trip. Verify desktop and 360px mobile, light/dark, RTL, 200% zoom and reduced motion. The existing map remains interactive in every nonmodal state. Implementation QA captures the blind A/B pair required by SPEC §7/§8 and ADR 0016; this design-only run does not claim browser verification of an unbuilt panel.

## Copy

Proposed new `en` keys and text; implementation adds each in all 23 locales in the same slice. Reuse existing Day/date/status/BookingDialog keys after checking their actual text and placeholders. No catalogue changes occur in this design PR.

| Key                                   | English text                             |
| ------------------------------------- | ---------------------------------------- |
| `trips.plan.dayDetail.label`          | Details for {day}                        |
| `trips.plan.dayDetail.minimise`       | Minimise day details                     |
| `trips.plan.dayDetail.expand`         | Expand day details                       |
| `trips.plan.dayDetail.close`          | Close day details                        |
| `trips.plan.dayDetail.undated`        | Dates not set                            |
| `trips.plan.dayDetail.stays`          | Stays                                    |
| `trips.plan.dayDetail.addStay`        | Add stay                                 |
| `trips.plan.dayDetail.noStay`         | No stay for this day                     |
| `trips.plan.dayDetail.noConfirmation` | No confirmation number                   |
| `trips.plan.dayDetail.notes`          | Notes                                    |
| `trips.plan.dayDetail.noNotes`        | No notes for this day                    |
| `trips.plan.dayDetail.reservations`   | Reservations                             |
| `trips.plan.dayDetail.noReservations` | No reservations for this day             |
| `trips.plan.dayDetail.readError`      | Reservation details could not be loaded. |
| `trips.plan.dayDetail.retry`          | Retry                                    |
| `trips.plan.dayDetail.gone`           | This day is no longer available.         |

## Resolved assumptions (autonomous defaults)

| #   | Question                                                         | Applied default                                                                                              | Why                                                                                                                                                                              |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One spec or two capabilities?                                    | Separate Day detail and undo specifications, both linked to #124.                                            | Independent product/UX specialist, high confidence: each ships independently; undo's contract gate must not delay Day value.                                                     |
| 2   | Rename and Stay empty action?                                    | Read-only title; existing BookingDialog with supported `initialStayDayId`.                                   | Product/UX specialist, high confidence; checked screen already supplies the Day argument and no Day-title writer exists.                                                         |
| 3   | Reservation details and confirmation?                            | Existing reader, exact identifiers, explicit loading/error/empty.                                            | Product/UX and security/tenancy specialists, high confidence: board projection has no number; no guessing relationships or persistent Reservation cache.                         |
| 4   | Nonmodal and undated behavior?                                   | Heading focus, no trap, restore trigger, scoped Escape ownership; undated retains Day identity and sections. | Product/UX specialist, high confidence; workspace must remain usable. Final product/UX review requires panel-local Escape so keyboard work in the map or rail cannot dismiss it. |
| 5   | Does Day detail immediately absorb the existing weather Popover? | Defer to a separate integration slice; amend the weather spec’s timing.                                      | Independent product/UX specialist: changing trigger/focus is real weather UI work outside this brief; keep the working Popover and no empty slot.                                |

## Risks and compatibility

No schema, server contract or persisted state change. Cache contains tenant data and is discarded on workspace, Trip, user or permission change; no localStorage/sessionStorage for Reservation content. Existing server readers enforce access; client `editable` controls visibility and cannot grant permission. The security/tenancy specialist approved existing-reader reuse conditional on exact Trip-scoped identifier joins. The existing frozen plan remains historical; these checked interface differences belong in the PR body rather than rewriting it.

## Design review evidence

Independent architecture review approved both documents after checking scope cohesion and the cited read/ordering contracts. Independent security/tenancy review approved **design-only**, conditional on preserving the live-undo gate, access-scoped cache and exact joins; it does not approve the future server contract. Product/UX review approved after its panel-local Escape correction was applied. These are design verdicts, not runtime QA evidence.

## Implementation Plan

One complete SLC slice: readable Day detail with its full states and existing add-Stay action. No partial empty shell release.

1. Test first through the pure detail-model and detail-state interfaces: opening/replacing/minimising, hover does not open, exact id joins, no fake confirmation, duplicate/overlapping Stays, undated data and out-of-order fetch results. Implement the model and screen-owned loading/cache lifetime.
2. Add panel and connect all Day/Place entry points, existing BookingDialog, all 23 locale keys and read-only gating in the same slice. Component tests assert heading focus, Tab exit, Close restoration, nested Escape arbitration and no dismissal from map/rail Escape, minimising, geometry retained on reload, read failure distinct from empty, and disappearance only after authoritative success.
3. Add browser journeys through the real workspace: open from keyboard, use map with panel open, minimise/reopen/close, dated and undated, add Stay then see its real confirmation, viewer/archive without writes, disappearing Day and switching to Place. Assert silent console and panel-attributed layout stability. Run the configured gate and required visual evidence before review.

Each test starts red against the missing feature and runs through public interfaces, not snapshots of implementation wiring. No runtime regression tests are added by this design-only change; the existing spec registry validates this document's lifecycle metadata.
