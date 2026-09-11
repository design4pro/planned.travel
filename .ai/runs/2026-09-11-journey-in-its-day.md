# Execution plan — the journey in its day

Source doc: .ai/specs/2026-09-11-journey-in-its-day.md
Issue: #175 (FR `03-S5`, parent PRD #167)
Spec PR: #426 (merged, design-only)
Branch: `feat/journey-in-its-day`
Base: `develop`

## 🎯 Goal

Put a journey on the plan board, in the day it happens, as the third variant of the
planner's single ordered sequence: a transport row rendered between the places it
connects, labelled by the part each day sees on a multi-day journey, one row per leg
on a chained one, and draggable on its departure day alone.

## Scope

Everything the spec's Implementation Plan names, and nothing else:

- `src/server/repos/transports.ts` — `listTripDayTransports`, `reorderDayTransports`,
  and the one `replaceTransportChain` line that stops discarding a leg's day position.
- `src/routes/_app/trips/$tripId/-server/plan-transports.ts` (new) — the route-local
  loader and reorder writer, so `-server/plan.ts` stays untouched.
- `src/components/planner/` — the `transport` union variant, the `leg:` id space, the
  pure `transport-rows.ts` arithmetic, the `TransportRow` renderer, the `day-section`
  branch, the drag preview variant.
- `src/routes/_app/trips/$tripId/-ui/plan-transport-model.ts` (new) plus the
  `plan-screen.tsx` and `plan-move.ts` wiring, including `journeyWrites`, the three
  refusals and their copy.
- The nineteen new keys in all 23 locales.
- Tests: repository cases, tenant- and member-isolation blocks, planner unit tests, the
  route-local model's tests, and one appended e2e block.

## Non-goals

- The stay's representation on the board (`03-S8b`, #180).
- Any edit to `src/server/repos/itinerary.ts`, `src/server/repos/days.ts`,
  `src/routes/_app/trips/$tripId/-server/plan.ts` or `-ui/plan-model.ts` — the spec's
  central trade-off, and the ticket forbids all four.
- Any schema change or migration; any dependency change (the stack is pinned).
- Offering the "drop its time?" dialog for a journey — `'timed'` stays a refusal (Q4).

## Risks

- **Two writers on one number line.** A day's order is written by `reorderPlanFn` and
  by the new `reorderDayTransportsFn`, and the two are not atomic with each other. The
  spec's four bounds make it survivable and `journeyWrites` keeps the restatement in
  one tested pure function rather than in prose.
- **`day-section.tsx` is the most contended planner file.** The edit is one `switch`
  branch and nothing else.
- **`replaceTransportChain` is the single writer of `transport_legs`.** Carrying
  `sort_order` forward by `position` is a heuristic; a mid-chain insertion hands a leg
  its neighbour's fraction, which the next restatement of that day re-places.
- **23-locale parity.** Nineteen keys land in every locale in this change or the parity
  test goes red.

## Implementation Plan

### Phase 1 — The day can be asked what it carries

The repository read and write, the chain-rewrite fix, the isolation blocks and the two
server functions. Shippable and inert: nothing calls them yet.

1. `listTripDayTransports` in `src/server/repos/transports.ts`.
2. `reorderDayTransports` in the same module — the gap-splitting writer.
3. `replaceTransportChain` carries `sort_order` forward by `position`.
4. The tenant-isolation and member-isolation blocks.
5. `-server/plan-transports.ts` — the payload types, `loadPlanTransports`,
   `reorderDayTransportsFn` and its Zod validator.

### Phase 2 — The board has a shape for a journey

The union variant, the id space, the arithmetic, the renderer and the copy. Shippable
and inert: nothing produces a `leg:` id yet.

6. `PlannerTransport` and the third `PlannerItem` variant in `types.ts`.
7. The `leg:` id space in `ordering.ts` and the widened `'not-in-ideas'` clause.
8. `transport-rows.ts` — `transportPhases` and `expandJourneyRows`.
9. `transport-row.tsx` — the renderer.
10. The nineteen locale keys, in all 23 locales.
11. `day-section.tsx`, `drag-preview.tsx` and `index.ts`.

### Phase 3 — The board draws it

The route loader, the route-local model, the restating writer, the screen wiring, the
refusals and the browser evidence. The capability lands here.

12. `-ui/plan-transport-model.ts` — `transportRowsOf`, `withTransports`,
    `withTransportItems`, `timeOfTransports`, `journeyWrites`.
13. `plan.tsx` loads the third read.
14. `plan-screen.tsx` wires the model, the writer branch and the follow-up.
15. `plan-move.ts` takes the three refusals and their words.
16. The e2e block appended to `e2e/journeys.spec.ts`.
17. The blind A/B pair on the three declared states.
18. The full validation gate.

## Progress

PR: #438

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The day can be asked what it carries

- [x] 1.1 `listTripDayTransports` in `src/server/repos/transports.ts` — e1026be1
- [x] 1.2 `reorderDayTransports` — the gap-splitting writer — e1026be1
- [x] 1.3 `replaceTransportChain` carries `sort_order` forward by `position` — e1026be1
- [x] 1.4 The tenant-isolation and member-isolation blocks — e1026be1
- [x] 1.5 `-server/plan-transports.ts` — loader, reorder writer and validator — e1026be1

### Phase 2: The board has a shape for a journey

- [x] 2.1 `PlannerTransport` and the third `PlannerItem` variant — 4fc80a80
- [x] 2.2 The `leg:` id space and the widened `'not-in-ideas'` clause — 4fc80a80
- [x] 2.3 `transport-rows.ts` — `transportPhases` and `expandJourneyRows` — 97265716
- [x] 2.4 `transport-row.tsx` — the renderer — fa2b2249
- [x] 2.5 The nineteen locale keys, in all 23 locales — 3d33c012
- [x] 2.6 `day-section.tsx`, `drag-preview.tsx` and `index.ts` — 80839ec5

### Phase 3: The board draws it

- [x] 3.1 `-ui/plan-transport-model.ts` — the route-local model and `journeyWrites` — a9e134fa
- [x] 3.2 `plan.tsx` loads the third read — 091fcbcb
- [x] 3.3 `plan-screen.tsx` wires it — 091fcbcb
- [x] 3.4 `plan-move.ts` takes the refusals and their words — 7e51030e
- [x] 3.5 The e2e block appended to `e2e/journeys.spec.ts` — 35b71fd1
- [x] 3.6 The blind A/B pair on the three declared states — d1acdca3
- [ ] 3.7 The full validation gate
