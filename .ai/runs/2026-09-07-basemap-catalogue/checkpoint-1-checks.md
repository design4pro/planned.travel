# Checkpoint 1 — Phase 1 closed

**When:** 2026-09-07T18:30:00Z
**Steps covered:** 1.1 → 1.4 (`076095bf`..`ce04f734`, four code commits on `602a3571`'s run folder)
**Why it fired:** Phase 1 closed and it carries ≥3 Steps.

## Touched areas

| Area        | Files                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Map logic   | `src/lib/map/basemap.ts` (new), `src/lib/map/__tests__/basemap.test.ts` (new), `src/lib/map/index.ts` |
| Map surface | `src/components/map/map-canvas.tsx`                                                                   |
| App shell   | `src/routes/_app/-server/shell.ts`, `src/routes/_app/route.tsx`                                       |

## Checks

| Check                        | Result                  | Notes                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`             | ✅ pass                 | Clean, no suppressions added.                                                                                                                                                                                                                                                                    |
| `pnpm lint`                  | ✅ pass                 | ESLint clean over the whole tree.                                                                                                                                                                                                                                                                |
| `pnpm test`                  | ✅ pass                 | 5589 tests / 231 files, including the 8 new `basemap.test.ts` cases.                                                                                                                                                                                                                             |
| `pnpm generate-routes` drift | ✅ pass                 | Exit 0, `src/routeTree.gen.ts` unchanged — no route file was added. `tsr generate` prints a pre-existing **warning** about `src/routes/api/sandcastle/__tests__/coordinator.test.ts` not exporting a Route; it is on `develop`, it is not an error, and CI is green with it. Noted, not touched. |
| `pnpm db:generate` drift     | ⏭️ not run here         | No schema change is in scope; the final gate runs `check-generated.sh` in full.                                                                                                                                                                                                                  |
| `pnpm build`                 | ⏭️ deferred             | Nothing in this window changes the bundle's shape; the final gate runs it.                                                                                                                                                                                                                       |
| Integration / browser        | ⏭️ skipped, with reason | See below.                                                                                                                                                                                                                                                                                       |

## Step review (`engine.stepReview: checkpoint`)

Reviewed `602a3571..ce04f734` against the `om-code-review` checklist. **No blocker or major findings.**
Two decisions worth a reviewer's eye, both recorded rather than silently taken:

- **`poiLabels` precedence in `buildStyle`.** The spec's `resolveBasemap` returns `theme`,
  `roadLabels` and `poiLabels`, but `MapCanvasProps.poiLabels` is an existing prop of a shipped
  component. Applying the entry's value would have made that prop inert. Every catalogue entry sets
  `poiLabels: false`, which is already `MapCanvas`'s own default, so reading it from the entry would
  change no pixel today and would quietly retire a prop that belongs to the screen rather than to the
  basemap. Resolved: the entry supplies `theme` and `roadLabels`; `poiLabels` stays the caller's. Quiet
  still delivers its promise, because POI labels are off everywhere already. Stated in a comment at
  the call site so the next reader does not re-derive it.
- **The `Commit` column is filled one Step late.** A row cannot name the SHA of the commit that
  contains it. See the note under the Tasks table and the NOTIFY entry of 18:23:40Z.

Minor, deferred to the final review: none recorded.

## Integration / browser verification — skipped this checkpoint

Two Steps in this window touch UI files (`map-canvas.tsx`, `route.tsx`), but **Phase 1 ships no
user-visible change by design**: the settings screen still writes only `planned-light` and
`planned-dark`, and both already resolved to the palettes they resolve to now. The visible proof of
this seam — Charcoal painting a dark canvas under a light chrome — needs the picker, which is Phase 2.

The environment was also not ready: `pnpm worktree:bootstrap` found an 11-hour-old `vite dev` process
holding `:3001` from an earlier session in this worktree, so its own dev server failed with
`Port 3001 is already in use` and the demo-workspace seed answered 500 on a query against the `user`
table. The stale process was stopped and bootstrap re-run: it now reports `ready`, the app answers on
`http://localhost:3001`, the demo workspace is seeded and the basemap archive is being served. The
environment is therefore in place for Step 2.6 and the final gate, where the browser evidence
actually belongs.

Per the checkpoint contract this does not block development, and it is logged in `NOTIFY.md`.
