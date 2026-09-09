# Execution plan — one owner for the member-trip population

Source doc: `.ai/specs/2026-09-09-member-trip-population.md`
Tracker: FR #133 (spec landed as PR #368, commit `1a28035d`)
Base: `develop` at `b0caaca7`

## Goal

Give "the trips this person is a member of" one owner. `recomputeTravelStats` reads that
population through a private `memberOfTrip` helper in `atlas.ts`; the spec replaces it with a
single exported expression in `trips.ts`, `memberTripIds(scope, userId)`, rendered as a scalar
sub-select, and deletes the helper with the three imports only it used.

## Scope

- `src/server/repos/trips.ts` — add the exported `memberTripIds` under the `Guards` banner.
- `src/server/repos/atlas.ts` — rewire the two call sites, delete `memberOfTrip` and the
  `exists` / `SQL` / `SQLiteColumn` imports, re-point the two `{@link}` references.
- `src/server/repos/__tests__/repositories.test.ts` — the year-boundary characterization test
  the spec asks for, plus tenant-isolation coverage for the new repository export.
- `.ai/specs/2026-09-09-member-trip-population.md` — correct the plan names in its Trip-quota
  row, a correction PR #374 recorded as owed to this implementation PR.

Backend only. No route renders differently, no copy, no migration, no schema change.

## Non-goals

- Narrowing `listTripsForUser` to membership (spec Q1) — needs an ADR 0007 amendment.
- Chunking the four year-cohort aggregates under D1's 100-bound-parameter ceiling (spec Q5) —
  filed as its own issue in Step 1 and linked from the PR.
- Year-scoping `regionCount`, or an `is_archived` term on the stat population.

## Risks

- **A figure on a stat row moves.** The change is behaviour-preserving by construction — the
  same population, `IN (sub-select)` instead of `EXISTS`. The nine existing assertions across
  `tenant-isolation.test.ts` and `repositories.test.ts` must stay green **without being
  edited**; a test that needs an edit is the signal the refactor changed behaviour.
- **`atlas.ts → trips.ts` closes an import cycle.** Re-verified on `b0caaca7`: `trips.ts`
  reaches `base`, `batch`, `categories`, `context`, `days`, `itinerary`, `places`, `validation`
  and none of those reaches `atlas.ts`; only `dashboard.ts` and `index.ts` import `atlas.ts`.
  `pnpm typecheck` and `pnpm build` are the mechanical check.
- **The query planner picks a worse plan.** Both indexes exist and the sub-select drives from
  the more selective `trip_members_org_user_idx (organization_id, user_id)`.

## Implementation Plan

### Phase 1: one owner, two call sites

**Step 1 — file the Q5 follow-up.** Open the issue named by the spec, labelled `bug` +
`priority-medium`, and link it from this PR's body.
_Verify:_ the issue exists and the PR body references it.

**Step 2 — add `memberTripIds` to `trips.ts`.** Exported under the `Guards` banner after
`favouritedTripFilter`, with the docblock the spec's Architecture section describes. No call
site yet.
_Verify:_ `pnpm typecheck`, `pnpm lint`, `pnpm test` green and unchanged.

**Step 3 — the year-boundary characterization test, written first.** A trip starting
30 December of year Y−1 with a transport departing 2 January of year Y, asserting year Y's row
carries the distance and year Y−1's does not. Plus the tenant-isolation test the repo's own
gate requires for a new repository export.
_Verify:_ the new tests pass on HEAD **before** Step 4 — they characterize, they do not go red.

**Step 4 — rewire both call sites and delete `memberOfTrip`.** Both `where` clauses, the helper
and its docblock, the `exists` / `SQL` / `SQLiteColumn` imports, the `memberTripIds` import, and
the two `{@link}` references.
_Verify:_ `pnpm typecheck`, `pnpm lint`, `pnpm test`. Every existing assertion passes without
an edit; `grep -n 'memberOfTrip\|SQLiteColumn' src/server/repos/atlas.ts` returns nothing.

**Step 5 — correct the spec's Trip-quota row.** The spec names the unlimited-trip plans
`starter`, `pro` and `business`; this repository sells `free`, `solo` and `crew`
(`src/lib/plans.ts:242`, `:273`, `:326`). PR #374 recorded the correction as owed here.
_Verify:_ the row names the shipped plan ids and its line references still resolve.

**Step 6 — the full validation gate.** Every command in `validation.commands`, in order.
_Verify:_ all green. No screenshots — the spec's Visual change expected is "none", so `skip-qa`.

## Progress

PR: #382

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: one owner, two call sites

- [x] 1.1 File the Q5 follow-up issue — #381
- [x] 1.2 Add `memberTripIds` to `trips.ts` — 02b4576c
- [x] 1.3 Write the year-boundary and tenant-isolation tests — af8d41cb
- [x] 1.4 Rewire both call sites and delete `memberOfTrip` — 74dcc534
- [x] 1.5 Correct the spec's Trip-quota row — 19d2c522
- [x] 1.6 Run the full validation gate — all seven commands green
