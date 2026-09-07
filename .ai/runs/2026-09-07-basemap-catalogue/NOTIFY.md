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
