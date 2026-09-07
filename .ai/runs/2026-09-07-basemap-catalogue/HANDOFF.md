# Handoff — 2026-09-07-basemap-catalogue

**Last updated:** 2026-09-07T23:12:00Z
**Branch:** feat/basemap-catalogue
**PR:** https://github.com/design4pro/planned.travel/pull/308
**Current phase/step:** complete — every Tasks row `done`, including the Phase 3 review round
**Last commit:** 2d85569f — test(e2e): budget the basemap write for the suite it runs in

## What just happened

- **The run is finished.** Phase 1 built the catalogue, the store and the `MapCanvas` read; Phase 2
  narrowed the write path, fixed the "Follow the workspace" defect, landed nine keys in 23 locales,
  built and mounted the picker and added the browser evidence; Phase 3 is the
  `om-auto-review-pr 308 --autofix` round — seven Steps, one per finding.
- **The review's one major was real.** `styleKey()` — the seam that decides whether a saved
  preference repaints a mounted map — had no test at any level, and the e2e spec claimed to be its
  guard when its fresh-document design cannot exercise the swap effect at all. Three unit cases now
  cover it, mutation-checked in both directions. Details: `review-round-checks.md`.
- Full gate green on `2d85569f`: typecheck, lint, 5610 tests, check-generated, build, and the
  Playwright suite **twice consecutively** at 30 passed / 1 skipped / 0 failed.

## Next concrete action

- None for the implementation. Remaining is human: read CI (this run's token cannot — 403), then
  merge from the cockpit. `needs-qa` is on the PR and `qaGate` requires `qa-approved` before merge.

## Blockers / open questions

- **CI is unreadable from this run.** `403 Resource not accessible by personal access token` on
  branch protection, `gh pr checks` and the check-runs API. Nothing here claims CI is green — only
  that the local gate is.

## Open for the reviewer, not blocking

- **Issue #311** carries the deferred cleanup: `AppearancePayload.mapStyle` and `.workspaceMapStyle`
  have no reader left, and `BACKWARD_COMPATIBILITY.md` §2 keeps them populated for one release.
- **Two findings were declined, with reasons on the record** (`review-round-checks.md`): splitting
  the catalogue ids into a fourth module so the server graph's isolation is structural rather than
  conditional — worth doing, but it reshapes the map library rather than this feature — and the
  Polish "gender inconsistency", which is not one.
- **`journeys.spec.ts:907` is contention collateral, not a defect.** With the new spec excluded the
  suite is 28 passed, 0 failed. Two atlas-heavy specs now share one dev server across parallel
  workers; if this starts flaking in CI the answer is to serialise the atlas specs, not to loosen
  either one's assertions.

## Environment caveats

- Test env: `.ai/scripts/test-env-up.sh` on `http://127.0.0.1:3034` (descriptor `.ai/qa/test-env.json`,
  teardown `sh .ai/scripts/test-env-down.sh`). `playwright.config.ts` refuses any port outside
  3030-3040 outside CI, which is what stops a run from photographing another checkout's app.
- Playwright storage state at `e2e/.auth/demo.json` exists.
- Local D1 has `user_settings.map_style` `NULL` for every row — the suite's own teardown leaves it
  that way, and now annotates the run when it cannot.
- **This machine cannot be trusted for a single e2e run in isolation.** Two independent sources of
  contention were measured during this round: a concurrent `om-auto-fix-pr` session on PR #310, and
  Spotlight indexing the `test-results/` artifacts every red run writes (load peaked at 126.76).
  Clear `test-results/` and wait for load average under 6 before reading an e2e result as a signal.
- Database/migration state: clean. No schema change was in scope and `drizzle/` is untouched.
- `pnpm generate-routes` prints a pre-existing warning about
  `src/routes/api/sandcastle/__tests__/coordinator.test.ts` not exporting a Route. Exits 0, no drift,
  already on `develop`. Not this run's to fix.

## Worktree

- Path: /Users/rafalwolak/dev/cloudflare/planned.travel/.ai/cezar/worktrees/eb498a6d-d728-46c9-96c9-ee2e6fb7f147
- Created this run: no (reused the cezar linked worktree; branch switched from `cez/eb498a6d`)
