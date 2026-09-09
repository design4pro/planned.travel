# Checkpoint 1 — Steps 1.1..2.2

**Recorded:** 2026-09-09T10:22:00Z
**Steps covered:** 1.1, 1.2, 1.3, 2.1, 2.2
**SHA range:** `4962ba4b..9f54edb6` (run folder at `d4f42b85`)

## Touched areas

- `src/server/metering/` — the lifted rate meter and its own test file.
- `src/server/transit/` — three import rewrites and three prose references the move invalidated.
- `src/server/billing/` — the third rate metric, its per-plan ceilings, and the `limits.test.ts`
  case the new metric's shape required splitting.
- `src/server/db/`, `src/server/fns/console/`, `src/server/catalog/` — the `geoapify` slug moving
  from `PLANNED_PROVIDERS` to `METERED_PROVIDERS`, its doc comments and its two fixtures.
- `src/server/geo/` — new: the proxy and 24 cases against it.

## Checks

| Check                                                                          | Result     | Notes                                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                               | ✅ pass    | Clean at every Step, not only at the checkpoint.                                                                                                                                               |
| `pnpm lint`                                                                    | ✅ pass    | Clean.                                                                                                                                                                                         |
| `pnpm vitest --project server` (geo, metering, transit, billing, catalog, fns) | ✅ pass    | 696 passed / 26 files.                                                                                                                                                                         |
| `pnpm db:generate`                                                             | ✅ pass    | "No schema changes, nothing to migrate" — the spec's claim that adopting the slug needs no SQL, verified rather than assumed.                                                                  |
| `git diff -M` records the meter as a rename                                    | ✅ pass    | `src/server/{transit/meter.ts => metering/rate.ts}`.                                                                                                                                           |
| UI verification                                                                | ⏭️ skipped | Backend-only work by design — the spec's own "Visual change expected: **None**". No route, component or locale key is touched, so there is no screen to photograph. `--no-ui` was also passed. |

## Full-suite observation, not a regression

`pnpm test` in full reports two or three failures whose set **changes between runs**. They were
each run in isolation, on this branch and on a clean `origin/develop` worktree, to tell a
regression from noise:

- `.claude/hooks/__tests__/hooks.test.ts > guard-generated.sh … fails closed when the base ref is
missing` — **fails on clean `develop` too**, in isolation. Pre-existing, and untouched by this
  change.
- `scripts/__tests__/build-airports.test.mjs > the committed artefact …` and
  `src/components/map/__tests__/markers.test.tsx > PlaceMarkers …` — **pass in isolation on both
  branches**, and only fail under the full suite's parallel load. Flaky under contention, not
  caused by this work.

None of the three is in an area this change touches. They are recorded here rather than fixed:
neither belongs to this spec, and the pre-existing one deserves its own issue.

## Artifacts

None. No browser session ran and no command output was worth retaining beyond the counts above.
