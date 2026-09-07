# Notify — 2026-09-07-basemap-catalogue

> Append-only log. Every entry is UTC-timestamped. Never rewrite prior entries.

## 2026-09-07T18:17:12Z — run started

- Brief: implement the spec at `.ai/specs/2026-09-07-basemap-catalogue.md` — the basemap catalogue,
  the missing consumption seam, and the "Follow the workspace" override-clear defect.
- Routed here by `om-auto-implement-spec` → `om-auto-create-pr` with `--loop` forwarded, so the loop
  engine was selected before any plan was drafted: `Engine: om-auto-create-pr-loop (steps: n/a, --loop: yes)`.
- `--force` was passed. It changed nothing: the slot (`feat/basemap-catalogue`, the run folder and
  any referencing PR) was free, so no override comment was owed and none was posted.
- External skill URLs: none.

## 2026-09-07T18:17:12Z — planning decision: the spec's 11 Steps land as 10

- The spec splits copy (its Step 8), the picker (9) and the mount (10). Landing its Step 8 alone is
  red: `src/lib/i18n/__tests__/coverage.test.ts` enforces an exact `DEAD_KEYS = 9` budget and nine
  reader-less keys break it. Landing its Step 9 alone is red the other way: `MessageKey` is derived
  from the `en` catalogue, so a component cannot name a key that does not exist yet.
- Resolution: copy + picker land together as Step 2.4, and the mount absorbs the removal of the two
  retired theme-bound keys as Step 2.5. Same files, same diff, every Step green.

## 2026-09-07T18:23:40Z — Step 1.1 delegated, and a convention corrected

- Step 1.1 ran in an executor subagent at the default (`standard`) tier and landed `076095bf`.
- It escalated a real defect in the per-Step procedure: the prescribed "write the SHA, then
  `git commit --amend`" cannot converge, because writing a hash into the commit changes that hash.
  It had recorded `73efbcf9`, the pre-amend hash, which names no object in the pushed history.
- Convention adopted and written into the Tasks table's note: a Step's own commit flips `Status` to
  `done` and writes `pending`; the next commit touching `PLAN.md` replaces it with the real short
  SHA. `Status` — the field `om-auto-continue-pr-loop` actually resumes from — stays correct inside
  its own commit. Row 1.1 was corrected to `076095bf` in Step 1.2's commit.

## 2026-09-07T18:33:00Z — checkpoint 1 (Steps 1.1..1.4, Phase 1 closed)

- Typecheck, lint and the full suite (5589 tests / 231 files) are green. Route-tree and schema drift
  are clean. Full log: `checkpoint-1-checks.md`.
- Step review at `checkpoint` granularity over `602a3571..ce04f734` found no blocker and no major.
- UI verification deliberately skipped: Phase 1 ships no user-visible change, and the visible proof
  of the seam needs the picker that Phase 2 builds.
- Environment repaired along the way — an 11-hour-old `vite dev` from an earlier session in this
  worktree held `:3001`, so the first `pnpm worktree:bootstrap` died on `Port 3001 is already in use`
  and the demo seed answered 500 on a query against `user`. The stale process was stopped and
  bootstrap re-run; it now reports `ready` on `http://localhost:3001`.
- Decision recorded for review: in `buildStyle`, the catalogue entry supplies `theme` and
  `roadLabels`, and `poiLabels` stays `MapCanvas`'s own prop. Applying the entry's value would have
  made a shipped prop inert while changing no pixel, because every entry already sets it to the
  component's default.
