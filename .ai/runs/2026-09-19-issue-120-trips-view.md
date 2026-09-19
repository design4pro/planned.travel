# Execution plan — 01-S7: reading the trip list two ways, the prominent card's strip, and the folded archive

Issue: #120
Source doc: docs/plans/01-trips-core.md (Stage 01-S7), as amended by the body of #120
Branch: feat/issue-120-trips-view

## Goal

Let a reader read the trip index as a grid or as a list, with the mode in the URL and a remembered
default for in-app navigation; give the dashboard's prominent card a progress bar and a
nights / places / companions strip; and fold the archived trips away behind a real disclosure at the
foot of the index.

## Scope

- `src/routes/_app/-lib/view-mode.ts` (new) — the vocabulary, the `planned.trips-view` declaration
  (`area: 'local'`; mode plus the archive fold), the URL-wins rule, and the clock-free elapsed
  fraction. Tests in `src/routes/_app/-lib/__tests__/view-mode.test.ts` (new).
- `src/server/repos/trip-guests.ts` — `countTripPeople(scope, tripIds)`: members plus guests per
  readable trip, two grouped queries, no entry for a foreign or unreadable id.
- `src/routes/_app/-server/overview.ts` — `TripCard.peopleCount`; `loadTrips` returns
  `archivedTrips` beside `trips`; `loadDashboard` returns `elapsed` for the hero trip.
- `src/routes/_app/trips/index.tsx` — `view` in `validateSearch`, the `beforeLoad` seed, `loaderDeps`
  narrowed to `status`/`q`/`scope`, the mode switch, list mode, the archived disclosure, the
  mode-aware skeleton.
- `src/routes/_app/-ui/trip-list-row.tsx` (new) — the list mode's row, the list and its skeleton.
- `src/routes/_app/-ui/trip-card.tsx` — the grid exports what the index needs to hide it below `md`.
- `src/routes/_app/dashboard.tsx` — the hero only: progress while under way, the three figures.
- Copy in all 23 locales (`src/lib/i18n/messages/*/shell.ts`).
- Tests: `src/server/repos/__tests__/tenant-isolation.test.ts` and `member-isolation.test.ts`
  (append), `e2e/trips-core.spec.ts` (append one `01-S7` block).

## Decisions (resolved assumptions, autonomous run)

| #   | Question                                                                                                   | Applied default                                                                                                                                                           | Why                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Write a new spec PR first?                                                                                 | No. The frozen plan's Stage 01-S7 plus #120 are the source doc; `docs/plans/` is not edited.                                                                              | Same route #179 took; PR #559 (a "what remains" spec for this plan) was closed by design.                                                                                       |
| 2   | The plan names `e2e/trips-core.visual.spec.ts` and screenshots; the ticket names `e2e/trips-core.spec.ts`. | The ticket wins: one behavioural block in `e2e/trips-core.spec.ts`, no baselines.                                                                                         | ADR 0016 retired the visual gate; the ticket is the later word.                                                                                                                 |
| 3   | What does the companion figure count?                                                                      | Members plus guests on the trip (the caller included), labelled "Travellers".                                                                                             | That is `countTripPeople`'s contract in the plan; "companions" excluding the reader would disagree with the list row's count.                                                   |
| 4   | The list row's "avatar stack of companions"                                                                | A people icon with the count.                                                                                                                                             | The payload carries a count per card, as the ticket's interfaces say; an `AvatarStack` needs names, and a second participants read per card is exactly what the ticket forbids. |
| 5   | Does the archived fold honour the search and status filters?                                               | Yes: it reads with the same `status`, `q` and favourites scope as the list above it, and is not rendered under the archived scope, where the list already is the archive. | A search that narrows the list but not the fold under it reads as broken.                                                                                                       |
| 6   | The hero's existing four tiles                                                                             | Kept as four: the countdown stays, "Trip dates" becomes Nights (the range moves to its hint), Places stays, the workspace-wide "Travellers" becomes the trip's own count. | Extend, never recreate; the workspace member count was the only figure on the card that was not about the trip.                                                                 |
| 7   | Elapsed fraction                                                                                           | Inclusive days: day k of an n-day trip is k/n; 0 before the start, 1 after the end, `null` without both dates.                                                            | The last day of a trip is still under way, and a one-day trip should read as full on its day.                                                                                   |

## Non-goals

- The trip lifecycle writes the archived rows call (`01-S1`); the guest record (`01-S6b`).
- Chunking the per-card reads for pages past D1's 100 bound parameters: `countPlacesPerTrip` and
  `tripRolesFor` already bind one parameter per id at the same page size, and `countTripPeople`
  follows them. Each list is read with its own call so neither grows past today's page.
- Visual baselines (ADR 0016).

## Risks

- The `beforeLoad` redirect must never fire on the Worker; it reads the preference only under the
  `typeof window` guard, as `01-S3` does.
- The grid is kept in the DOM below `md` only as the row list; both are rendered and CSS picks one
  in grid mode, so the first paint never depends on a media query.

## Implementation Plan

### Phase 1: The pure module

- 1.1 `view-mode.ts` and its unit tests.

### Phase 2: Server

- 2.1 `countTripPeople` with tenant- and member-isolation cases.
- 2.2 `loadTrips` archived array and per-card count; `loadDashboard` elapsed fraction.

### Phase 3: UI

- 3.1 Copy in all 23 locales.
- 3.2 `trip-list-row.tsx`: the row, the list, the skeleton.
- 3.3 Trips index: search param, seed, narrowed deps, switch, list mode, archived disclosure.
- 3.4 Dashboard hero: progress and the three figures.

### Phase 4: Browser evidence

- 4.1 The `01-S7` block in `e2e/trips-core.spec.ts`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The pure module

- [x] 1.1 view-mode.ts and its unit tests — 86b70e930

### Phase 2: Server

- [x] 2.1 countTripPeople with tenant- and member-isolation cases — ee2eec479
- [x] 2.2 loadTrips archived array and per-card count; loadDashboard elapsed fraction — e07482dff

### Phase 3: UI

- [ ] 3.1 Copy in all 23 locales
- [ ] 3.2 trip-list-row.tsx: the row, the list, the skeleton
- [ ] 3.3 Trips index: search param, seed, narrowed deps, switch, list mode, archived disclosure
- [ ] 3.4 Dashboard hero: progress and the three figures

### Phase 4: Browser evidence

- [ ] 4.1 The 01-S7 block in e2e/trips-core.spec.ts
