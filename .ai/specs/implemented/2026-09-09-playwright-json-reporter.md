# Declare the JSON reporter unconditionally in playwright.config.ts

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #144        |
| **Spec PR**        | #376        |
| **Implementation** | #395        |

Source issue: [#144](https://github.com/design4pro/planned.travel/issues/144) — "Declare the JSON
reporter in playwright.config.ts and delete the `--reporter` flag entirely". Filed by the sandcastle
deep-review (run 12177) while reviewing [#97](https://github.com/design4pro/planned.travel/issues/97).
Every claim below was re-verified against `develop` at `944b4103` rather than carried over from the
issue, and **one of its two halves did not survive that check** — see **Problem Statement**.

## 📝 TLDR

`playwright.config.ts` declares `['json', { outputFile: 'test-results/results.json' }]`, but only
inside the `isCI` branch — and no committed path reaches that branch, because both places that run
the suite under CI replace the config's reporter list with `--reporter` on the command line. The file
the config promises is written by nothing this repository runs. This spec hoists the JSON reporter out
of the ternary so every run that reaches the config's reporter list — that is, every non-CI run,
including the gate's — emits `test-results/results.json`, leaving only the one genuinely
CI-shaped reporter (`github` versus `list`) behind the condition. Tooling only: one config field, no
route, no schema, no locale key, no user-facing pixel.

**The central decision — hoist, or delete instead? — was taken to a human and answered "hoist".** See
Q1 under **Resolved assumptions**.

## 📝 Problem Statement

### What is actually broken today

`playwright.config.ts:133-139` reads:

```ts
reporter: isCI
  ? [
      ['github'],
      ['html', { open: 'never' }],
      ['json', { outputFile: 'test-results/results.json' }],
    ]
  : [['list'], ['html', { open: 'never' }]],
```

No committed path reaches the `json` entry:

- **CI never uses this list.** `.github/workflows/ci.yml:364` runs
  `pnpm exec playwright test --shard=… --reporter=blob`. A `--reporter` on the command line
  _replaces_ the config's list rather than adding to it — the workflow's own comment says so
  ("`--reporter=blob` replaces the config's reporters with the one `merge-reports` consumes"). The
  merge job at `ci.yml:407` then runs `playwright merge-reports --reporter html,github`, again on the
  command line. So under CI the config contributes no reporter at all. No other workflow runs
  Playwright.
- **No local or agent run reaches it either**, because `isCI` is false there. `.ai/scripts/e2e.sh` —
  the last rung of the gate in `.ai/agentic.config.json` — runs `pnpm e2e --project=chromium` with no
  `--reporter`, so it gets the `else` branch: `list` and `html`, no JSON.

The precise claim, since the config is being criticised for over-claiming: **no committed invocation
writes that file.** A hand-run `CI=true pnpm e2e` would reach the branch and write it; nothing in the
repository does that, and no reader depends on it. Outside `playwright.config.ts` and this spec, a
grep for `results.json` returns nothing — the file has no writer and no reader.

### The half of the issue that is already done

The issue asks to "delete the `--reporter` flag entirely" from `.sandcastle/validate.sh`, along with
`PLAYWRIGHT_JSON_OUTPUT_NAME`, a hand-written WARN, and a test that greps the script's source. **None
of those exist any more.** `.sandcastle/` was deleted in its entirety by `e55697f6`
("feat(agents): triage workflow replaces sandcastle; remove .sandcastle", phase 5 of the cezar
migration behind ADR 0014 and ADR 0015). The fragile flag form, the environment variable, the warning
and the source-grepping test all left with it.

So the issue's second half needs no work, and this spec does none. What remains is its first half,
which is still exactly true: the JSON declaration sits in a branch nothing reaches.

### Why it is worth doing — and what is not claimed

A configuration that declares an artifact nobody produces is a lie a reader has to disprove. The next
person who wants a machine-readable e2e verdict will read `playwright.config.ts`, look for
`test-results/results.json`, and not find it — the same hour #97 already paid once, in a different
file. Hoisting makes the declaration true, and gives a red gate run a verdict that can be walked with
one `jq`. Measured on a scratch project at `@playwright/test` 1.62.1 with this repository's
`outputDir`:

```
$ jq -c '[.suites[] | .. | objects | select(has("specs")) | .specs[]?
         | select(.ok|not)
         | {title, file, line, error: (.tests[0].results[0].error.message // "" | split("\n")[0])}]' \
    test-results/results.json
[{"title":"a failing probe","file":"probe.spec.ts","line":3,"error":"Error: expect(received).toBe(expected)…"}]
```

**What is deliberately not claimed:** nothing in the repository reads that file, this spec adds no
reader (Q2), and the `list` reporter already prints failing spec names to the stdout the gate
captures — so no agent is blind today. This is an artifact made available, not a broken pipeline
repaired. That honesty is why Q1 went to a human rather than being decided here.

## 📝 Proposed Solution

**Hoist `json` (and `html`, which is identical in both branches) out of the ternary, leaving only the
one reporter that genuinely differs between CI and a terminal.**

```ts
reporter: [
  // `github` writes GitHub annotations and is noise in a terminal; `list` is the
  // progressive output a human or an agent reads while the suite runs. That is the
  // only difference a CI run makes to the reporter list.
  isCI ? ['github'] : ['list'],
  ['html', { open: 'never' }],
  // Written on every run that reaches it, so a red suite leaves a machine-readable
  // verdict beside the HTML report. CI overrides the whole list with `--reporter=blob`
  // and never gets here. Absent means "the run did not finish", never "nothing failed".
  ['json', { outputFile: 'test-results/results.json' }],
],
```

Three facts settle this shape, each verified rather than assumed:

- **`outputFile` inside `outputDir` survives.** `outputDir` is `./test-results` and Playwright wipes
  it before the run, which raises a real question about a JSON file written into it. Measured: a
  `test-results/leftover.txt` planted before the run was gone afterwards and `results.json` (7192
  bytes) was present, because the JSON reporter writes in `onEnd`, after the clean.
- **stdout is unchanged.** With `outputFile` set, the JSON reporter writes to the file rather than to
  stdout, so the `list` output the gate reads is byte-for-byte what it is today. Verified in the same
  run.
- **The type checks.** `isCI ? ['github'] : ['list']` as an element of `reporter` narrows to
  Playwright's `ReporterDescription` without a cast or a `satisfies` clause; `tsc --strict` against
  the installed `@playwright/test` reports no error on the shape above.

### Alternatives considered

- **Delete the `json` reporter instead of hoisting it (one line).** Strictly smaller, and defensible
  on the evidence: nothing reads the file, no reader is planned, and the two reasons #144 gave for
  hoisting ("harmless locally, it restores html's `open: 'never'`" and "the ladder reads a path the
  config owns") both described `.sandcastle/validate.sh`, which no longer exists. Deleting also makes
  the config stop lying, and does it without leaving a file written on every gate run that nobody
  opens. **This was the live alternative; a human settled Q1 in favour of hoisting** — see Q1.
- **Add a consumer — teach `.ai/scripts/e2e.sh` to print failing spec names from the JSON.** This is
  what #97 wanted. It loses because `list` already prints those names to the same stdout, so the
  script would restate on one channel what it already says on another — the exact "two declarations
  of one fact" shape #144 opens by objecting to.
- **Restore a `--reporter` flag somewhere in `.ai/scripts/e2e.sh`.** Rejected on the issue's own
  reasoning: a CLI flag replaces the config's list rather than extending it, cannot carry reporter
  options (which is how `html`'s `{ open: 'never' }` got silently dropped in the sandcastle era), and
  re-creates the second declaration the issue exists to remove.

## 📝 Architecture

One concept, one owner (docs/SPEC.md §8): **the e2e reporter list is declared in exactly one place,
`playwright.config.ts`, and every other runner either accepts it or replaces it wholesale on the
command line for a stated reason.** That concept lives in one file after this change, which is why it
is one work item and cannot be usefully split.

| Surface                     | Today                                                                           | After                                                               |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `playwright.config.ts`      | `html` duplicated across a ternary; `json` in the `isCI` branch only, unreached | `html` and `json` unconditional; only `github`/`list` behind `isCI` |
| `ci.yml` shards / merge job | `--reporter=blob`, then `merge-reports --reporter html,github`                  | unchanged — still replaces the list, still the right mechanism      |
| `.ai/scripts/e2e.sh`        | no flag; gets `list` + `html`                                                   | no flag; gets `list` + `html` + `json`                              |
| `test-results/`             | already gitignored (`.gitignore:31`)                                            | unchanged — the new file is never committed                         |

**No data model, API contract, server function, Zod schema, D1 migration or tenant-scoped path is
involved, and nothing under `src/`, `server/`, `drizzle/` or the locale catalogue is touched.** The
one file that appears — `test-results/results.json` — is a build artifact holding test titles, timings
and error strings from a seeded demo fixture, rewritten on every run.

## 📝 Visual change expected

**None.** No route, component, token, layout or piece of copy changes, in either theme or at any
viewport. The blind A/B pair (`scripts/visual/capture.mjs`) has nothing to photograph and no baseline
may move; `verifying-changes` step 4 does not apply, which is why the implementation PR carries
`skip-qa`.

## 📝 Copy

**None.** No user-facing string is added, changed or removed, so no key enters the 23-locale catalogue
and the i18n parity test is unaffected. The only prose in the change is a TypeScript comment, in
English, never rendered to a user.

## 📝 Edge Cases & Failure Scenarios

- **A CI run.** `--reporter=blob` replaces the whole list, so the hoisted `json` never fires there and
  no shard writes a stray `results.json`. The merged HTML report is unchanged.
- **A stale `results.json` from a previous run can survive.** `outputDir` is wiped at the _start_ of a
  run, but anything that throws while the config is being evaluated — most realistically the port
  guard at `playwright.config.ts:29-41`, also a config syntax error or a rejected CLI argument —
  aborts before the wipe, leaving the previous run's file in place. A reader must therefore check the
  file's mtime against the run it thinks produced it. This is the sharpest edge here: a week-old
  verdict read as today's is worse than no file at all.
- **A run that dies before `onEnd`** — an OOM, or a CI job-level `timeout-minutes` kill — writes no
  `results.json`. A `globalTimeout` stop does not belong here: Playwright ends the run with
  `FullResult.status === 'timedout'` and still calls `onEnd`, so the JSON is written and describes
  whatever finished before the cutoff — which is exactly what `globalTimeout: isCI ? 15 * 60_000`
  buys ("leaves a retry-heavy shard room to finish and report", `playwright.config.ts:126-132`). A
  reader must treat absence as "unknown", never as "no failures", which is the trap #97 fell into.
- **A second Playwright run in the same worktree destroys the first one's file.** An ad-hoc
  `pnpm e2e -g "…"` started while the gate's suite is running wipes `outputDir`, taking
  `results.json`, traces and videos with it. Since the artifact's entire value is "`jq` it after a red
  gate run", this is the way it most plausibly goes missing in practice.
- **A filtered run.** `pnpm e2e -g "…"` produces a JSON describing only the selected tests. Correct
  and expected, but never a full-suite verdict.
- **Residual `--reporter` exposure, accepted.** `.ai/scripts/e2e.sh:10` ends in
  `pnpm e2e --project=chromium "$@"`, so any caller can still pass `--reporter=…` and replace the whole
  list, options included — the same last-wins mechanism #144 exists because of. This spec closes the
  duplication in the config and does not close that hole; the script is out of scope (Q2), and no
  committed caller passes the flag.
- **Disk cost.** The file lands in a gitignored directory that already holds traces, videos and
  failure screenshots. It is smallest on the green runs nobody opens and largest on red ones (the JSON
  reporter inlines per-test stdout/stderr, and this suite asserts on the console), which is the right
  way round.

## 📝 Risks & Impact Review

- **Blast radius: the `reporter` field of one config file.** No runtime code, no bundle, no deployed
  artifact — the production build never loads `playwright.config.ts`.
- **Compatibility:** nothing in `BACKWARD_COMPATIBILITY.md` covers a test-runner config, and no
  external consumer reads `test-results/`. There is no protected surface here.
- **Rollback:** revert the commit. Because no code reads `results.json`, reverting cannot orphan a
  consumer or leave a half-migrated state — the file simply stops appearing.
- **The one thing to watch:** that the merged CI report is unchanged. The implementation PR's own CI
  run is the proof, since it exercises both the sharded blob path and the merge job.
- **Risk rating: low** on all three axes — reversibility, blast radius, and the absence of any runtime
  path.

## 📝 Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                                                   | Resolution                                                             | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Hoist the `json` reporter, or delete it, given that nothing reads `test-results/results.json` and no reader is planned?                                    | **Hoist** — proposed autonomously, **confirmed by a human on the PR.** | The issue's title and suggested direction both ask for the hoist, and the artifact is a precondition for any future reader. But both reasons it gave described `.sandcastle/validate.sh`, which is gone, so the brief argued from a premise that no longer holds — and "nothing reads it" cut toward deleting the entry outright, which is one line and equally makes the config stop lying. That made the call a product decision rather than a review finding, so it was put to a human, who chose the hoist. Deletion is recorded under **Alternatives** as the rejected option. |
| Q2  | Should this spec also add a consumer that turns `results.json` into a named failing-spec list on a red gate run, or otherwise change `.ai/scripts/e2e.sh`? | **No — defer.**                                                        | Least new surface. The `list` reporter already names failing specs on the same stdout the gate captures, so a consumer would restate one fact twice. The `jq` walk is written into this spec so a future consumer costs minutes.                                                                                                                                                                                                                                                                                                                                                    |
| Q3  | The issue's second half targets `.sandcastle/validate.sh`, which no longer exists. Does this spec still cover it?                                          | **No.**                                                                | Re-creating a deleted script to delete a flag from it is not work; the spec records that the flag, `PLAYWRIGHT_JSON_OUTPUT_NAME`, the WARN and the source-grepping test all left with `e55697f6`.                                                                                                                                                                                                                                                                                                                                                                                   |
| Q4  | Should the change be documented outside the config — in `verifying-changes` or `docs/plans/12-verification-protocol.md`?                                   | **No.**                                                                | The TypeScript comment in `playwright.config.ts` states why the file exists and when it is absent, in the file that owns the concept. `.claude/` is additionally a guarded prefix in `.claude/hooks/guard-generated.sh:65`, so a cezar run implementing this spec cannot edit `verifying-changes/SKILL.md` at all — a step that named it would have blocked the run. Recorded here so the idea is not re-proposed.                                                                                                                                                                  |

## 📋 Phasing

One phase: the change is a single config field, and the concept it owns is indivisible under
docs/SPEC.md §8.

## 📋 Implementation Plan

**Phase 1 — the reporter list tells the truth**

1. **Hoist `html` and `json` out of the `isCI` ternary in `playwright.config.ts`**, leaving
   `isCI ? ['github'] : ['list']` as the only conditional element, in the shape given under
   **Proposed Solution**. Keep the file's existing comment density: one comment on why `github`
   versus `list` is the only CI-shaped difference, one on why the JSON file is unconditional, why CI
   never reaches it, and what its absence means. Touch nothing else in the file.
   _Verify:_ `pnpm typecheck` and `pnpm lint` are clean, and `git diff playwright.config.ts` shows the
   `reporter` field and nothing else.

2. **Prove the artifact appears on the gate's own path.** Run `bash .ai/scripts/e2e.sh` (a single
   journey via `-g` is enough) and confirm `test-results/results.json` exists afterwards and parses,
   while the `list` output on stdout is unchanged. Paste into the PR: the
   `ls -la test-results/results.json` line, the tail of the run showing the list summary, and the
   `jq` walk from **Problem Statement** returning `[]` on a green run.
   _Verify:_ the file exists, `jq . test-results/results.json` succeeds, and stdout still carries the
   progressive list output.

3. **Prove CI is untouched.** Read the implementation PR's own `e2e · critical journeys` shards and
   `e2e · merged report` job: both shards still upload a blob, the merge job still produces the single
   `playwright-report` artifact, and no shard uploads or references a `results.json`.
   _Verify:_ the PR's CI is green and the `playwright-report` artifact is present, as on any other PR.

4. **Run the full gate** — `validation.commands` from `.ai/agentic.config.json`, in order:
   `node .ai/scripts/agent-kit-check.mjs`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
   `bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh`.
   _Verify:_ every command exits zero. No new test is written: the change has no branch a test could
   reach without asserting the config's source text, which is exactly the source-grepping shape #144
   complains about. Step 2's artifact is the evidence instead.

**Out of scope**

- `.github/workflows/ci.yml` — the blob-plus-merge mechanism is correct and deliberately overrides the
  config; do not add a JSON reporter, an artifact upload, or a `results.json` reader to CI.
- Any consumer of `test-results/results.json`, in `.ai/scripts/`, an `om-*` skill, or elsewhere (Q2).
- `.ai/scripts/e2e.sh` — it passes no reporter flag today and must keep passing none.
- Documentation outside the config comment (Q4), and anything under `.claude/`.
- The rest of `playwright.config.ts`: the port guard, the clock pin, `workers`, the timeouts, the
  projects and the `webServer` block are all untouched.
- Recreating anything under `.sandcastle/`.
