# Execution plan — the confirmation file that fills the desk in

Source doc: .ai/specs/2026-09-11-booking-confirmation-import.md
Issue: #178 · Spec PR: #433 · Stage `03-S7`

## Goal

Attach a producer, a model-backed branch and a review surface to the booking-import
queue handler that already exists, so a reader can drop a confirmation file on a
trip's booking desk, watch it being read from anywhere in the app, review what was
read, prune it, and confirm it into the desk in one action.

## Scope

The spec's Owned paths, exactly:

- `src/server/extract/document.ts`, `src/server/extract/booking.ts` and their tests (new)
- `src/server/queue/types.ts`, `src/server/queue/handlers/booking-import.ts` (edit)
- `src/server/fns/file-policy.ts` (edit), `src/server/fns/booking-import.ts` (new) and its tests
- `src/server/repos/__tests__/tenant-isolation.test.ts` (append)
- `src/components/modules/book/import-drafts.ts`, `import-dialog.tsx`, `import-widget.tsx`,
  `index.ts` (edit) and the drafts tests
- `src/routes/_app/route.tsx` (widget mount), `src/routes/_app/trips/$tripId/book.tsx` (entry point)
- `src/lib/i18n/messages/*/modules.ts` — 41 keys under `modules.book.import.*`, 23 locales
- `e2e/journeys.spec.ts` (append)

## Non-goals

No schema change and no migration. No second parsing engine and no MIME parser.
No `.pkpass`. No dependency added, removed or upgraded. `src/server/metering/rate.ts`,
`src/server/billing/limits.ts`, `src/server/geo/**`, `src/server/repos/**`,
`src/server/queue/consumer.ts`, `src/server/queue/jobs.ts`, `src/server/auth/env.ts`,
`src/server/fns/context.ts` and `src/components/layout/app-frame.tsx` are used and
never edited. Generalising the trip-room subscription is `07-S1`'s.

## Risks

- `src/server/queue/types.ts` is a shared file: the change must stay additive (one union
  member, one payload field) so every existing envelope arm keeps parsing.
- The model is non-deterministic: both extraction modules take their binding as an
  injected port so no test touches the network.
- A partial confirm must never duplicate a booking: `written` on the staged record,
  and a KV delete only on full success.
- KV is not tenant-scoped: both job-id paths re-check the staged record's `orgId`
  and `tripId` against the caller's proven scope.

## Implementation Plan

### Phase 1 — Bytes become text, and text becomes bookings

The two extraction modules and their fixtures. Shippable and inert: nothing imports them.

### Phase 2 — The engine reads a document

The payload widening, the handler branch, the meter spend, the upload-policy answer.
Shippable and inert: nothing enqueues a `document` job, because nothing enqueues anything.

### Phase 3 — The three verbs

The server functions and the tenant-isolation block. Shippable and inert: no UI calls them.

### Phase 4 — The reader can see it

The drafts module, the dialog, the widget, the shell mount, the route wiring, the copy
and the e2e block. The capability lands here.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Bytes become text, and text becomes bookings

- [x] 1.1 `src/server/extract/document.ts` — `DocumentConverter`, `IMPORT_TEXT_MAX_CHARS`, `documentToText`, plus its tests — 0307e306
- [x] 1.2 `src/server/extract/booking.ts` — `BookingModel`, `EXTRACTION_MODEL`, the answer schema and `textToReservations`, plus its tests — 0307e306

### Phase 2: The engine reads a document

- [x] 2.1 `src/server/queue/types.ts` — `format` gains `'document'`, the payload gains `sourceName` — b9310ec8
- [x] 2.2 `src/server/queue/handlers/booking-import.ts` — `extractFromDocument`, the meter spend and the branch in front of the parse — b9310ec8
- [x] 2.3 `src/server/fns/file-policy.ts` — `IMPORT_ACCEPT_ATTRIBUTE`, `MAX_IMPORT_FILES`, `importFormatFor`, `text/html` and `message/rfc822` — b9310ec8

### Phase 3: The three verbs

- [x] 3.1 `startBookingImportFn` — the only enqueue site, with the deterministic id and the stagger — d05384dd
- [x] 3.2 `getBookingImportFn` — the KV read, the scope re-check and the typed refusal codes — d05384dd
- [x] 3.3 `confirmBookingImportFn` — the per-row write chain, the marker, `written` and the delete only on full success — d05384dd
- [x] 3.4 The tenant-isolation block appended to `src/server/repos/__tests__/tenant-isolation.test.ts` — d05384dd

### Phase 4: The reader can see it

- [x] 4.1 `src/components/modules/book/import-drafts.ts` and its tests — b9c22e96
- [x] 4.2 The forty-one locale keys, `en` first and then all 23 — d6ff14de (48 keys, per the spec's own tables)
- [x] 4.3 `src/components/modules/book/import-dialog.tsx` — d6ff14de
- [x] 4.4 `src/components/modules/book/import-widget.tsx` — d6ff14de
- [x] 4.5 `src/routes/_app/route.tsx` mounts the widget — d6ff14de
- [x] 4.6 `src/routes/_app/trips/$tripId/book.tsx` mounts the action and the dialog; `index.ts` gains the exports — d6ff14de
- [ ] 4.7 The e2e block appended to `e2e/journeys.spec.ts`
- [ ] 4.8 The blind A/B pair on the five declared states
- [ ] 4.9 The full validation gate, in order
