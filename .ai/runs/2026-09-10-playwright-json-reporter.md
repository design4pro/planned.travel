# Execution plan — declare the JSON reporter unconditionally

Source doc: .ai/specs/2026-09-09-playwright-json-reporter.md
Tracker: FR #144, spec PR #376 (merged, Q1 answered "hoist" by a human).
Engine: om-auto-create-pr (steps: 4, --loop: no)

## Goal

Make `playwright.config.ts` stop promising an artifact nothing writes: hoist `html` and `json` out
of the `isCI` ternary so the only conditional reporter left is the one that is genuinely CI-shaped
(`github` versus `list`), and every run that reaches the config's list emits
`test-results/results.json`.

## Scope

One field of one file, plus the run plan itself.

- `playwright.config.ts` — the `reporter` field only.
- `.ai/runs/2026-09-10-playwright-json-reporter.md` — this plan.

## Non-goals

Taken verbatim from the spec's **Out of scope**:

- `.github/workflows/ci.yml` — the blob-plus-merge mechanism is correct and deliberately overrides
  the config. No JSON reporter, no artifact upload, no `results.json` reader in CI.
- Any consumer of `test-results/results.json`, in `.ai/scripts/`, an `om-*` skill, or elsewhere (Q2).
- `.ai/scripts/e2e.sh` — it passes no reporter flag today and must keep passing none.
- Documentation outside the config comment (Q4), and anything under `.claude/`.
- The rest of `playwright.config.ts`: the port guard, the clock pin, `workers`, the timeouts, the
  projects and the `webServer` block.
- Recreating anything under `.sandcastle/` — it was deleted in full by `e55697f6` (spec Q3), so the
  issue's second half ("delete the `--reporter` flag entirely") needs no work.

## Implementation Plan

Taken from the spec's Implementation Plan, unchanged in substance.

### Phase 1 — the reporter list tells the truth

- **Step 1 — Hoist `html` and `json` out of the ternary.** `isCI ? ['github'] : ['list']` becomes the
  only conditional element, in the shape the spec gives under **Proposed Solution**. Keep the file's
  comment density: one comment on why `github` versus `list` is the only CI-shaped difference, one on
  why the JSON file is unconditional, why CI never reaches it, and what its absence means.
  _Verify:_ `pnpm typecheck` and `pnpm lint` clean; `git diff playwright.config.ts` shows the
  `reporter` field and nothing else.
- **Step 2 — Prove the artifact appears on the gate's own path.** Run `bash .ai/scripts/e2e.sh` with a
  single journey via `-g`, confirm `test-results/results.json` exists and parses, and that the `list`
  output on stdout is unchanged. Paste into the PR: the `ls -la` line, the tail of the run showing the
  list summary, and the `jq` walk from the spec returning `[]` on a green run.
  _Verify:_ the file exists, `jq . test-results/results.json` succeeds, stdout still carries the
  progressive list output.
- **Step 3 — Prove CI is untouched.** Read this PR's own `e2e · critical journeys` shards and
  `e2e · merged report` job: both shards still upload a blob, the merge job still produces the single
  `playwright-report` artifact, and no shard uploads or references a `results.json`.
  _Verify:_ CI green and the `playwright-report` artifact present, as on any other PR.
- **Step 4 — Run the full gate.** `validation.commands` from `.ai/agentic.config.json`, in order.
  _Verify:_ every command exits zero. **No new test is written** — the change has no branch a test
  could reach without asserting the config's source text, which is exactly the source-grepping shape
  #144 complains about. Step 2's artifact is the evidence instead.

## Risks

Low on all three axes, per the spec's Risks section. The blast radius is the `reporter` field of one
config file; the production build never loads `playwright.config.ts`; no runtime path is involved;
rollback is a revert and cannot orphan a consumer, because nothing reads the artifact. The one thing
to watch is that the merged CI report is unchanged — this PR's own CI run is the proof, since it
exercises both the sharded blob path and the merge job.

The sharpest residual edge, recorded rather than fixed: a `results.json` from a previous run can
survive when something throws while the config is being evaluated (most realistically the port guard
at `playwright.config.ts:29-41`), because `outputDir` is wiped at the _start_ of a run. A reader must
check the file's mtime against the run it thinks produced it, and must treat absence as "unknown",
never as "no failures".

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the reporter list tells the truth

- [x] 1.1 Hoist `html` and `json` out of the ternary — eb9ca3a7
- [x] 1.2 Prove the artifact appears on the gate's own path — eb9ca3a7
- [ ] 1.3 Prove CI is untouched
- [ ] 1.4 Run the full gate
