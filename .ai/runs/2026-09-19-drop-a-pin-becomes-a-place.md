# Execution plan — 02-S4: drop a pin on the map and it becomes a place

Issue: #554
Source doc: .ai/specs/2026-09-18-drop-a-pin-becomes-a-place.md (merged on spec PR #583)
Branch: feat/drop-a-pin-becomes-a-place

## Goal

A traveller creates a place from the planner map — a context-click, a long-press, or a keyboard
arm-and-drop — and the existing place form opens with the coordinates and a reverse-looked-up
address filled in. The stage also installs the three route-local seams the rest of area 02 extends
and adds the geocoder's credit to the map's one credit line.

## Scope

As the spec's **Architecture → Owner modules** table lists it, and nothing else:

- new: `-server/geocode.ts`, `-ui/planner-map-layer.tsx`, `-ui/planner-add-place.tsx`,
  `-ui/planner-day-tools.tsx`, `src/lib/geo/credits.ts`
- edit: `src/components/planner/day-section.tsx` (one optional `dayTools` prop),
  `src/components/map/map-attribution.tsx` (second credit segment), `src/server/geo/geoapify.ts`
  (imports the credits), `-ui/plan-screen.tsx` (the six-item edit list in the spec, nothing else)
- copy in all 23 locales (`trips`, `atlas`)
- tests: the unit tests the spec's Implementation Plan names, `tenant-isolation.test.ts`, the
  `02-S4` describe in `e2e/places-and-maps.spec.ts`, and `src/server/geo/__tests__/seam.test.ts`
  (its named-importer list gains the new route module, which is that case's purpose)
- the spec's metadata table (`Status: in-progress`) and the regenerated spec index

## Decisions

The spec's Resolved assumptions 1-9 apply as written. Two execution details:

1. `reverseGeocodeFn` is a thin handler over a plain `reverseLookup(scope, input, ports)` that takes
   the geocoding runtime factory as a port, the shape `fns/booking-import.ts` already uses — outside
   a Start build a handler's return value is discarded, so the answer is tested through the plain
   function.
2. The local branch is the cezar worktree branch `cez/0355452c`, pushed as
   `feat/drop-a-pin-becomes-a-place`.

## Non-goals

- `searchPlacesFn` and any search UI (`02-S13`).
- `plan-actions.tsx`, `plan-model.ts`, `-server/plan.ts` (`02-S5` / contended).
- `src/components/map/index.ts`, `fit-bounds.tsx`, `src/lib/map/**`, `src/lib/atlas/layout.ts`, the
  camera, `MapBehaviour` and the reposition flow.
- Localising strings the screen already hardcodes; only the strings this stage adds or replaces.

## Risks

- Money: the lookup spends a metered allowance — authorisation runs before the meter, and a test pins
  that the provider port has zero calls on a refused trip.
- Shared surface: `plan-screen.tsx` — the six edits in the spec are the whole budget.

## Implementation Plan

### Phase 1: Seams and the day's add control

- 1.1 `day-section.tsx` `dayTools` render prop + test.
- 1.2 `planner-day-tools.tsx` + `addPlace.forDay` / `forDayNamed` copy + test.
- 1.3 `planner-add-place.tsx` pill + options-driven menu + `addPlace.label` / `more` copy + test.
- 1.4 `placeWriteMessage` + `addPlace.quota` / `quotaAction` copy + tests (code survives serialisation).
- 1.5 `plan-screen.tsx` edits 1, 4, 5, 6.

### Phase 2: Attribution

- 2.1 `src/lib/geo/credits.ts`; `geoapify.ts` imports it.
- 2.2 `MapAttribution` geocoder segment + `atlas.map.attribution.geocoder` copy + tests.

### Phase 3: The drop

- 3.1 `-server/geocode.ts` `reverseGeocodeFn` + server test.
- 3.2 `planner-map-layer.tsx` state machine and listeners + unit test.
- 3.3 Provisional pin, arming banner, empty-map hint, `drop.*` / `addPlace.option.map` copy, the menu's
  `map` option.
- 3.4 `plan-screen.tsx` edits 2 and 3.
- 3.5 `tenant-isolation.test.ts` coordinate-carrying `createPlace` cases.
- 3.6 `e2e/places-and-maps.spec.ts` `02-S4` describe.
- 3.7 Spec metadata `in-progress`, spec index regenerated, full validation gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Seams and the day's add control

- [x] 1.1 `day-section.tsx` `dayTools` render prop + test — 37323db35
- [x] 1.2 `planner-day-tools.tsx` + copy + test — 37323db35
- [x] 1.3 `planner-add-place.tsx` pill + menu + copy + test — 37323db35
- [x] 1.4 `placeWriteMessage` + copy + tests — 37323db35
- [x] 1.5 `plan-screen.tsx` edits 1, 4, 5, 6 — 37323db35

### Phase 2: Attribution

- [x] 2.1 `src/lib/geo/credits.ts`; `geoapify.ts` imports it — 1d47fff5c
- [x] 2.2 `MapAttribution` geocoder segment + copy + tests — 1d47fff5c

### Phase 3: The drop

- [ ] 3.1 `-server/geocode.ts` `reverseGeocodeFn` + server test
- [ ] 3.2 `planner-map-layer.tsx` state machine and listeners + unit test
- [ ] 3.3 Provisional pin, arming banner, empty-map hint, copy, the menu's `map` option
- [ ] 3.4 `plan-screen.tsx` edits 2 and 3
- [ ] 3.5 `tenant-isolation.test.ts` coordinate-carrying `createPlace` cases
- [ ] 3.6 `e2e/places-and-maps.spec.ts` `02-S4` describe
- [ ] 3.7 Spec metadata, spec index, full validation gate

## Deviations found during the build

- **1.4 — the quota code does not reach the client.** `QuotaExceededError` is not in
  `AUTHORED_ERROR_NAMES`, so `failureRedactionMiddleware` sends `{ kind: 'unexpected', reference }`
  and no code; Resolved assumption 8's `code === 'QUOTA_EXCEEDED'` can never match in production.
  Carrying it would change the global failure envelope (`src/lib/errors.ts`,
  `src/server/errors/`), which is outside this stage. `placeWriteMessage` therefore decodes the
  envelope (an authored refusal as written, otherwise the fallback), the `addPlace.quota` /
  `quotaAction` keys are not added, and the gap goes to a follow-up issue and a spec Amendment.
- **2.2 — no geocoder credit without an archive.** `map-canvas.test.tsx` pins that the
  no-archive notice names only Natural Earth, because naming OpenStreetMap beside "basemap
  unavailable" credits a source the reader cannot see. The geocoder segment follows the same rule:
  it is appended only while the basemap is available, and OpenStreetMap is deduplicated by link, so
  the line gains exactly one `Geoapify` credit.
