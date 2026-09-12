# Execution plan — the membership writers hold, and there is one read model

`Source doc: .ai/specs/2026-09-11-who-is-on-this-trip.md`
`Tracking plan: .ai/runs/2026-09-12-issue-118-membership-guards.md`

Issue: #118 (`01-S6a`). Spec PR: #436 (merged). This run implements **Phase 1 only** — Steps 1-8 of
the spec's Implementation Plan. Phase 2 (the people route, the copy, the screen, the e2e block)
ships on its own pull request, which is the one that carries `Closes #118`.

## Goal

Move the three membership guards inside the writers in `src/server/repos/trips.ts`, give
`listTripMembers` a total order, and add `listTripParticipants` as the one participant read model —
so the guards hold for a route, a queue consumer and a seed script alike, and `01-S8`/`01-S9` can
call the writers without re-adding a guard at each call site.

No user-visible change: no route, no screen, no new copy. This pull request carries `Refs #118` and
`skip-qa`.

## Scope

- `src/server/repos/trips.ts` — the four guards, the total order, `listTripParticipants`, the
  `TripParticipant` union.
- `src/routes/_app/-server/trip-lifecycle.ts` — one exported wrapper (`enqueueTripStatsFor`) over the
  module's own private fan-out; no behaviour change.
- `src/server/repos/__tests__/trip-people.test.ts` — new, the unit invariants.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append, plus two existing cases edited
  (`:3311`, `:3341`) so they no longer demote a sole owner incidentally.
- `src/server/repos/__tests__/member-isolation.test.ts` — append.
- `src/server/queue/__tests__/reminders.test.ts` — edit, test-only: the `dropTripMember` helper
  stops routing through `removeTripMember`.

## Non-goals

- The people route, the screen, the server module, the sub-navigation destination, the 33 copy keys
  and the e2e block. All of them are Phase 2.
- `trip_guests`, the guest writers, the guest-into-member merge: `01-S6b` (#119). The union's `guest`
  variant is declared here and never produced.
- Any schema change, migration, or new dependency.

## Implementation Plan

### Phase 1: free the fixtures that depend on the states the guards make unreachable

Both land **before** the guard they make room for, so the suite is never red between two steps.

- Step 1.1 — `reminders.test.ts`'s `dropTripMember` deletes the membership row through the harness
  database rather than through `removeTripMember`, with the reason written beside it. The two cases
  that assert the reminder sweep's behaviour on an ownerless trip keep asserting exactly that.
- Step 1.2 — `tenant-isolation.test.ts:3311` and `:3341` add a second `owner` membership before
  demoting the first. What each case asserts is unchanged.

### Phase 2: the ordering and the four guards

- Step 2.1 — `listTripMembers` breaks the `created_at` tie on `id`. Proved by a case that inserts two
  memberships with an identical `created_at` and ids in the opposite order to their insertion, and
  which must be shown to fail with the tie-break removed.
- Step 2.2 — the workspace guard on `addTripMember`: resolve `values.userId` through `getMembership`
  and raise a `RepositoryError` subclass coded `TRIP_MEMBER_NOT_IN_WORKSPACE` when it is absent.
- Step 2.3 — the last-owner guard on both verbs: `removeTripMember` refuses the trip's last `owner`,
  `updateTripMember` refuses to demote them. One `RepositoryError` subclass coded `TRIP_LAST_OWNER`,
  because from the reader's side it is one rule.
- Step 2.4 — the owner assert on all three writers, with the self-removal exemption inside
  `removeTripMember` rather than beside it, plus the `requireTrip` that resolves the trip id from the
  membership row on the two verbs that lack it.

### Phase 3: the read model and the fan-out wrapper

- Step 3.1 — `listTripParticipants`: `requireTrip` **first**, then `listTripMembers`, then
  `listUserProfiles` for the member ids, projected to `{ name, image }`, ordered owner-first over the
  total order from Step 2.1; the `guest` variant declared and never produced.
- Step 3.2 — `enqueueTripStatsFor` exported from `trip-lifecycle.ts`, delegating to the module's
  private `enqueueTravelStats` + `affectedStatYears` and adding no arithmetic of its own.

### Phase 4: the gate

- Step 4.1 — every command in `.ai/agentic.config.json`'s `validation.commands`, in order.

## Risks

- **Three existing writers tighten.** Signatures are unchanged, so nothing fails to compile; the
  refusals change. The one non-test caller is `src/routes/api/dev/-seed/apply-trip.ts:158,165`, which
  calls them with an `owner`-scoped seed principal inside one organization and is therefore
  unaffected by both the role assert and the workspace guard. `pnpm worktree:bootstrap` and the e2e
  fixtures exercise it, so a mistake fails loudly.
- **A4 is an autonomous default.** The demotion guard in `updateTripMember` is not one of the three
  guards FR #118 names; the spec argues it in and pays for it with two edited test cases. Recorded so
  a reviewer reads it as a decision rather than as drift.
- **Ordering tests that pass either way.** Step 2.1's case is only worth having if it is shown to
  fail with the tie-break removed; that check is part of the step.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: free the fixtures

- [ ] 1.1 `reminders.test.ts` — `dropTripMember` stops routing through `removeTripMember`
- [ ] 1.2 `tenant-isolation.test.ts` — the two demotion cases gain a second owner

### Phase 2: the ordering and the four guards

- [ ] 2.1 `listTripMembers` breaks the `created_at` tie on `id`
- [ ] 2.2 the workspace guard on `addTripMember` (`TRIP_MEMBER_NOT_IN_WORKSPACE`)
- [ ] 2.3 the last-owner guard on `removeTripMember` and `updateTripMember` (`TRIP_LAST_OWNER`)
- [ ] 2.4 the owner assert on all three writers, with the self-removal exemption

### Phase 3: the read model and the fan-out wrapper

- [ ] 3.1 `listTripParticipants` and the `TripParticipant` union
- [ ] 3.2 `enqueueTripStatsFor` exported from `trip-lifecycle.ts`

### Phase 4: the gate

- [ ] 4.1 every command in `validation.commands`, in order
