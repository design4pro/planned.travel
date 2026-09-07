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

## 2026-09-07T20:36:00Z — Step 2.1 decision: the appearance validator is piped, not a bare union

- The spec's API contract writes `saveAppearance`'s field as
  `z.union([z.literal(''), z.enum(BASEMAP_IDS)]).optional()`. Landing that literally makes
  `pnpm typecheck` red at `appearance.tsx:211`: the screen's `SimpleSelect` hands `onValueChange` a
  `string`, and `persist` is typed from the validator's _input_, so a narrowed input rejects the
  call. `appearance.tsx` belongs to Step 2.5 and this Step may not touch it.
- Resolution: `z.string().trim().pipe(z.union([z.literal(''), z.enum(BASEMAP_IDS)])).optional()` —
  the same input-wide / output-narrow shape `localeOverride` already uses on this module. The runtime
  contract is exactly what the spec states; only the declared input type stays `string`.
- Step 2.5 replaces the select with the typed picker, at which point the `z.string().trim()` prefix
  can be dropped and the field written as the spec has it.

## 2026-09-07T20:58:00Z — Step 2.4 decisions: one forced Catalan wording, one neutral swatch

- `ca` cannot render `settings.appearance.map.paper` as `Paper`: Catalan writes the word exactly as
  English does, and `parity.test.ts` reads a byte-identical value as untranslated copy. The
  `LOANWORDS` allow-list would exempt it, but this Step may not touch that file, so `ca` reads
  `Paper clar` — which is also what its retiring `appearance.map.light` already said (`Paper — clar`).
  Every other locale names the entry with its own single noun.
- The workspace entry's swatch is the `Building2` workspace glyph on a neutral `bg-surface-2` tile,
  not a cartography sketch. The picker is never told which id the workspace holds — the payload
  carries the member override and nothing else — so any painted tile would be a guess that goes stale
  the moment an owner changes the workspace default.
- Both swatches paint an opaque `size-9` tile, because `RadioCard`'s icon wrapper turns `bg-brand`
  while checked (`radio-group.tsx:178`) and would otherwise report the brand colour as the map's.

## 2026-09-07T21:00:00Z — Step 2.4 correction: `ca` reads `Paper`, exempted as a loanword

- Reversal of the Catalan wording decision logged at 20:58:00Z. `Paper clar` makes the catalogue
  worse to make a check pass, which is precisely what the `LOANWORDS` docblock in `parity.test.ts`
  says not to do ("the alternative was to invent a second word a native speaker would not use").
- It is also a semantic regression against the spec: the two entries were renamed from `Paper — light`
  and `Charcoal — dark` _because they are no longer theme-bound_ — Paper stays paper in the dark
  theme. `Paper clar` re-attaches the light theme to the name in the one locale.
- Resolution: `ca` now reads `Paper`, and `settings.appearance.map.paper` is added to `LOANWORDS.ca`.
  Catalan spells the word exactly as English does through the shared Latin root, which is the case
  that list exists for — an addition to it is a visible decision, and this is that decision.
- `npx vitest run src/lib/i18n` — 10 files, 258 tests, green.

## 2026-09-07T21:12:00Z — Step 2.5 decisions: the row wrapper, and one field left dead on purpose

- The picker is **not** wrapped in `SettingsRow`. That row clamps its control to `shrink-0 sm:w-64`
  (`settings-nav.tsx:219`) — correct for a switch or a select, impossible for a five-card grid. The
  label and hint keep the row's own type scale and vertical rhythm and the grid takes the section's
  full width beneath them; the motion switch above it stays a real `SettingsRow` and keeps its
  divider.
- `AppearancePayload.workspaceMapStyle` now has **no reader**: `appearance.tsx` was its only one, and
  both call sites (`:82` deriving the follow-the-workspace state, `:213` writing the workspace id
  back) are gone — the raw `mapStyleOverride` answers the first and `''` answers the second.
- It is deliberately **not deleted**. The field predates this run, the merged spec enumerates the
  payload shape and keeps it, and removing a field from a spec-defined contract is a call for the
  reviewer rather than for an unattended run. Flagged here and in checkpoint 2 so it is a decision on
  the record, not an oversight. If the reviewer wants it gone it is a two-line follow-up.
- `AppearancePending`'s second card now renders five `h-22` tiles on the picker's own
  `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`, sized to `RadioCard`'s `p-4` + two-line description, so
  the section does not jump when the loader resolves.

## 2026-09-07T21:06:00Z — Checkpoint 2 (Steps 2.1..2.5)

- Typecheck, lint, `pnpm test` (5601 / 232 files) and `pnpm build` green. Full record:
  `checkpoint-2-checks.md`.
- Browser evidence captured against `.ai/scripts/test-env-up.sh` on `http://127.0.0.1:3034` and
  posted to PR #308: four resting frames of `/settings/appearance` (1440 and 360, light and dark),
  the Charcoal-selected frame, and the A/B pair on `/atlas` in the light theme with and without the
  override. `captureValid: true` on every run.
- The defect fix is proved at the column, not only at the pixel: after pressing Follow the workspace,
  `user_settings.map_style` is `NULL` for every row. Under the old handler that press wrote nothing.
- Two tests caught this change and both were right — the Catalan parity case (`1007e46e`) and the
  settings copy-gate orphan check (`b5f86ff6`). Neither gate was relaxed; the change was corrected to
  meet them.
- No blocker. Next: Step 2.6, `e2e/basemap-preference.spec.ts`.

## 2026-09-07T21:52:00Z — Final gate: the new e2e spec needed a document budget, not a weaker claim

- `e2e/basemap-preference.spec.ts` passed 8+ consecutive standalone runs but failed the **full** suite
  twice, and took `e2e/journeys.spec.ts:907` ("the click surface never takes the reader's input")
  down with it — both on Playwright's flat 30 s timeout, neither on an assertion.
- Isolated rather than guessed: the full suite run with `--grep-invert "the basemap a member picks"`
  is **28 passed, 0 failed**, so `journeys:907` was collateral from contention and not a defect this
  change introduced in the product.
- Two fixes, both to the new spec only:
  1. the teardown's `page.goto(..., { waitUntil: 'networkidle' })` dropped to a plain `load` — a
     document still prefetching sibling routes never goes idle while the rest of the suite has the
     dev server busy, and the `waitFor` on the very next line is the stronger signal anyway;
  2. `test.setTimeout(120_000)` on the round-trip test, in the idiom `journeys.spec.ts` already uses
     (`WALK_TIMEOUT_MS = 180_000`, "a ceiling and not an expectation"). Four documents, two of them a
     live map, plus two writes that must land in D1 — that is not one document's budget.
- **No assertion was weakened and no gate was relaxed.** Measured under contention the test now runs
  in 34.1 s; a preference that is never read still fails on `expectGround`, not on the clock.
- Two consecutive full-suite runs green afterwards: 30 passed, 1 skipped (mobile-safari), 0 failed.

## 2026-09-07T22:05:00Z — `om-auto-review-pr 308 --autofix` claimed the chain lock

- Review run with fresh eyes rather than the run's own, so the verdict was not the author grading
  themselves. Metadata: base `develop`, head `bfaeb7da`, `MERGEABLE`, 0 prior reviews.
- **CI is unreadable from this run:** `403 Resource not accessible by personal access token` on branch
  protection, `gh pr checks` and the check-runs API. Disclosed in the review body rather than treated
  as a blocker; required checks still gate the merge.

## 2026-09-07T22:20:00Z — Verdict: request changes, 1 major

- GitHub refuses `REQUEST_CHANGES` on a self-authored PR, so the full report was posted as a review
  comment, verbatim and in the `om-code-review` structure.
- **The major was real and the review was right about the mechanism.** The consumption seam
  (`styleKey()` in `map-canvas.tsx`) had no test at any level, and the new e2e spec claimed in its own
  docblock to be that guard when its fresh-document design cannot exercise the swap effect at all.
  Deleting the basemap from the key left both `pnpm test` and `bash .ai/scripts/e2e.sh` green.

## 2026-09-07T23:05:00Z — Review round closed: 7 Steps, every actionable finding answered

- Phase 3 rows 3.1-3.7 in `PLAN.md`. Full write-up: `review-round-checks.md`.
- The seam is guarded and the guard is **mutation-checked in both directions** — dropping the basemap
  from the key fails 3 cases, dropping the applied-key comparison fails the over-eager case.
- Two findings declined with reasons on the record (the `server/repos` import shape, the Polish
  gender); one filed rather than fixed (issue #311, the two orphaned `AppearancePayload` fields,
  which `BACKWARD_COMPATIBILITY.md` §2 keeps alive for one release).
- **One decision worth naming: the `.trim()` removal.** `''` is the sentinel that clears the column,
  so trimming turned `' '` into "follow the workspace" and silently dropped a member's override. The
  accepted set is now exactly the spec's.

## 2026-09-07T23:10:00Z — Full gate re-run green on `2d85569f`

- typecheck, lint, 5610 tests / 232 files, check-generated, build, and `bash .ai/scripts/e2e.sh`
  **twice consecutively** at 30 passed / 1 skipped / 0 failed. `detect.mjs` exit 0 on both screens.
- **The e2e round cost real time and only one cause was ours**, recorded rather than buried: a fixed
  15s write wait inside a 120s test (fixed in `2d85569f`), a concurrent `om-auto-fix-pr` run on PR
  #310 holding load average above 70, and Spotlight indexing the `test-results/` artifacts each red
  run wrote — load peaked at **126.76**. One bisect result (the barrel re-export) was a false
  positive and is recorded as one: the confirmation run refuted it.
