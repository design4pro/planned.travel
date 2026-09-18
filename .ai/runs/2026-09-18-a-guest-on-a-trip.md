# Execution plan — a guest on a trip: the record, the refusal of duplicates, the bound, and the merge into a member

`Source doc: .ai/specs/2026-09-17-a-guest-on-a-trip.md`
`Tracking plan: .ai/runs/2026-09-18-a-guest-on-a-trip.md`

Issue: #119 (`01-S6b`). Spec PR: #553 (merged). This run implements **both phases** of the spec on one
pull request, which carries `Closes #119` and `Refs #553`.

## Goal

Give a trip its guests — people travelling on it without an account — through one new repository
module, `src/server/repos/trip-guests.ts`: the record and its four owner-only writes, the two rules
(a duplicate name is refused inline after trimming and case folding; a trip holds at most fifty
guests), the filled `guest` branch of `listTripParticipants`, and the irreversible guest-into-member
merge with the relinker registry later plans register into. The people screen gains the guest list,
its add field, and the rename, remove and merge dialogs.

## Scope

- `src/server/repos/trip-guests.ts` — new: the module, the errors, the registry, the merge, and
  `listTripParticipants` moved here from `trips.ts`.
- `src/server/repos/trips.ts` — `listTripParticipants` removed; `TripParticipant` stays.
- `src/server/repos/index.ts` — one export line.
- `src/routes/_app/trips/$tripId/-server/people.ts` — four writes, three refusal codes, the payload.
- `src/routes/_app/trips/$tripId/-ui/people-screen.tsx` — the guest list and its dialogs.
- `src/lib/i18n/messages/*/trips.ts` — the `people.guest*` keys in all 23 locales.
- Tests: `trip-guests.test.ts` (new), `trip-people.test.ts`, `tenant-isolation.test.ts`,
  `member-isolation.test.ts`, `-server/__tests__/people.test.ts`, `e2e/trips-core.spec.ts`.
- `.ai/specs/2026-09-17-a-guest-on-a-trip.md` and `.ai/specs/README.md` — the lifecycle bookkeeping.

## Non-goals

- Any schema change or migration: `trip_guests` shipped in #463. The folded-name column the spec
  files as a requirement is the next foundations schema stage's.
- A colour picker, a notification, a quota, or a relinker of any real table.

## Risks

- `risk-high`: an irreversible multi-table merge and an extension point two later plans build on.
  The relinker contract is `GuestRelinkPlan` (spec Q1, confirmed by merging #553).
- Moving `listTripParticipants` touches shipped code; the barrel keeps every import unchanged.

## Implementation Plan

### Phase 1: the guest record

- Step 1.1 — the module and its reads (`listTripGuests`, errors, `MAX_TRIP_GUESTS`, fold).
- Step 1.2 — `createTripGuest` with both rules.
- Step 1.3 — `renameTripGuest` and `removeTripGuest`.
- Step 1.4 — `listTripParticipants` moves and fills the guest branch.
- Step 1.5 — the tenant and member isolation cases.
- Step 1.6 — the three guest server functions and the payload.
- Step 1.7 — the copy in all 23 locales.
- Step 1.8 — the guest list on the people screen, and its e2e block.

### Phase 2: the merge

- Step 2.1 — the relinker registry and `mergeTripGuest`.
- Step 2.2 — `mergeTripGuestFn`.
- Step 2.3 — the merge dialog, and its e2e block.
- Step 2.4 — the full gate and the spec bookkeeping.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the guest record

- [ ] 1.1 the module and its reads
- [ ] 1.2 createTripGuest with both rules
- [ ] 1.3 renameTripGuest and removeTripGuest
- [ ] 1.4 listTripParticipants moves and fills the guest branch
- [ ] 1.5 the tenant and member isolation cases
- [ ] 1.6 the three guest server functions and the payload
- [ ] 1.7 the copy in all 23 locales
- [ ] 1.8 the guest list on the people screen, and its e2e block

### Phase 2: the merge

- [ ] 2.1 the relinker registry and mergeTripGuest
- [ ] 2.2 mergeTripGuestFn
- [ ] 2.3 the merge dialog, and its e2e block
- [ ] 2.4 the full gate and the spec bookkeeping
