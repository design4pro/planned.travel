# Handoff — 2026-09-07-basemap-catalogue

**Last updated:** 2026-09-07T21:06:00Z
**Branch:** feat/basemap-catalogue
**PR:** https://github.com/design4pro/planned.travel/pull/308 (draft, claimed)
**Current phase/step:** Phase 2 Step 2.6
**Last commit:** b5f86ff6 — test(settings): read the basemap picker in the module copy gate

## What just happened

- **Phase 2 is one Step from done and checkpoint 2 passed.** The write path is narrowed to
  `z.enum(BASEMAP_IDS)` and clears the member override through `overrideOrNull` (`56e41254`), the
  tenant guard covers the new write (`3543cae7`), the payload carries the raw override (`580e6587`),
  the nine catalogue keys and the picker landed together in 23 locales (`872cc0f9`), and the picker
  is mounted with the two theme-bound keys retired (`dedd0c54`).
- Two corrections on top, both from tests that were right: `1007e46e` (Catalan reads `Paper`, added
  to `LOANWORDS.ca` instead of being reworded around the gate) and `b5f86ff6` (the settings copy gate
  now reads the picker, the way it already reads `settings-nav.tsx`).
- Typecheck, lint, the full 5601-test suite and `pnpm build` are green. Browser evidence captured and
  posted to the PR — including the A/B pair on `/atlas` and the `map_style IS NULL` proof that
  "Follow the workspace" now clears the column instead of pinning it. Details:
  `checkpoint-2-checks.md`.

## Next concrete action

- Step 2.6 — write `e2e/basemap-preference.spec.ts`, opening with the selector assertion
  `await expect(page.locator('[data-part="basemap-option"][value="planned-dark"]')).toHaveCount(1)`
  on `/settings/appearance` before anything depends on it, then the two journeys checkpoint 2 proved
  by hand: Charcoal in the light theme paints the planner canvas dark while the chrome stays light,
  and Follow the workspace clears the override so the map returns to the workspace cartography. The
  console stays silent throughout, per `e2e/helpers/console-policy.ts`.
- Then the final gate (full `validation.commands` in order + `om-integration-tests` + the
  design-system pass), the PR body/labels, `om-auto-review-pr 308 --autofix`, the summary comment and
  the ready flip.

## Blockers / open questions

- none

## Open for the reviewer, not blocking

- `poiLabels` precedence in `buildStyle` (checkpoint 1): the catalogue entry supplies `theme` and
  `roadLabels`; `poiLabels` stays `MapCanvasProps.poiLabels`.
- `saveAppearance`'s validator is `z.string().trim().pipe(...)` rather than the spec's bare union;
  the prefix can be dropped now that the typed picker has landed.
- `AppearancePayload.workspaceMapStyle` has no reader left and is deliberately not deleted.

## Environment caveats

- Dev runtime runnable: **yes, two of them.** `pnpm worktree:bootstrap` left a server on
  `http://localhost:3001`; the automated one is `.ai/scripts/test-env-up.sh` on
  `http://127.0.0.1:3034` (descriptor `.ai/qa/test-env.json`, teardown
  `sh .ai/scripts/test-env-down.sh`). Only the second may be photographed — `playwright.config.ts`
  refuses any port outside 3030-3040 outside CI, which is what stops a run from capturing another
  checkout's app.
- The Playwright storage state at `e2e/.auth/demo.json` exists now (`--project=setup` against
  `:3034`); `capture.mjs --auth` needs it and refuses without it.
- Local D1 currently has `user_settings.map_style` `NULL` for every row — checkpoint 2 left it that
  way on purpose, as the proof of the cleared override. Step 2.6's spec should set its own state
  rather than assume this one.
- `/atlas` emits four WebGL `GPU stall due to ReadPixels` performance warnings under capture. They
  are the driver talking to the screenshot, not the app; `captureValid` stayed `true`.
- Database/migration state: clean. No schema change is in scope and `drizzle/` is untouched.
- `pnpm generate-routes` prints a pre-existing warning about
  `src/routes/api/sandcastle/__tests__/coordinator.test.ts` not exporting a Route. It exits 0, causes
  no drift, is on `develop`, and CI is green with it. Not this run's to fix.

## Worktree

- Path: /Users/rafalwolak/dev/cloudflare/planned.travel/.ai/cezar/worktrees/eb498a6d-d728-46c9-96c9-ee2e6fb7f147
- Created this run: no (reused the cezar linked worktree; branch switched from `cez/eb498a6d`)
