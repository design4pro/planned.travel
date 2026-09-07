# Handoff — 2026-09-07-basemap-catalogue

**Last updated:** 2026-09-07T18:33:00Z
**Branch:** feat/basemap-catalogue
**PR:** https://github.com/design4pro/planned.travel/pull/308 (draft, claimed)
**Current phase/step:** Phase 2 Step 2.1
**Last commit:** ce04f734 — feat(app): carry the effective basemap id on the shell payload

## What just happened

- **Phase 1 is complete and checkpoint 1 passed.** The catalogue module, its store and its tests
  landed (`076095bf`), the lib barrel re-exports them (`668b41f1`), `MapCanvas` reads the store and
  folds the resolver into `buildStyle` and `styleKey` (`55810e74`), and the shell carries the merged
  effective id which `AppShell` publishes after hydration (`ce04f734`).
- Typecheck, lint and the full 5589-test suite are green. Details and the two recorded decisions:
  `checkpoint-1-checks.md`.
- The seam is live but still invisible: the settings screen writes only the two ids it always wrote.
  Phase 2 is what a traveller sees.

## Next concrete action

- Step 2.1 — narrow `mapStyleSchema` to `z.enum(BASEMAP_IDS)` in `src/server/repos/settings.ts`, add
  the `.catch('auto')` on the `getEffectiveSettings` read, and route `saveAppearance`'s handler
  through `overrideOrNull` so `''` clears the member override to `NULL` instead of being dropped.

## Blockers / open questions

- none

## Environment caveats

- Dev runtime runnable: **yes.** `pnpm worktree:bootstrap` reports `ready`; the app answers on
  `http://localhost:3001`, the demo workspace is seeded (`rafal@planned.travel`, fixture password in
  `scripts/seed/README.md`) and the basemap archive is being served.
- Getting there needed one intervention: an 11-hour-old `vite dev` from an earlier session in this
  worktree was holding `:3001`, so the first bootstrap died on `Port 3001 is already in use` and the
  seed answered 500. The stale process was stopped and bootstrap re-run clean.
- Browser / UI checks: enabled from Step 2.6 onward. Skipped at checkpoint 1 because Phase 1 ships no
  user-visible change by design.
- Database/migration state: clean. No schema change is in scope and `drizzle/` is untouched.
- `pnpm generate-routes` prints a pre-existing warning about
  `src/routes/api/sandcastle/__tests__/coordinator.test.ts` not exporting a Route. It exits 0, causes
  no drift, is on `develop`, and CI is green with it. Not this run's to fix.

## Worktree

- Path: /Users/rafalwolak/dev/cloudflare/planned.travel/.ai/cezar/worktrees/eb498a6d-d728-46c9-96c9-ee2e6fb7f147
- Created this run: no (reused the cezar linked worktree; branch switched from `cez/eb498a6d`)
