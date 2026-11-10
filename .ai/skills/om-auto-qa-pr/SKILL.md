---
name: om-auto-qa-pr
description: planned.travel QA evidence from blind A/B captures. Enrolled Paperclip pilot work returns evidence to independent Quality; outside the pilot, the specialist panel owns unattended sign-off, risk-high included.
---

## Enrolled Paperclip pilot: evidence only

Resolve explicit enrollment from the PM-owned pilot control record before selecting
this branch. If pilot enrollment is claimed but cannot be verified, stop and
return to the PM. For an enrolled task, read `docs/agents/paperclip-delivery-pilot.md`
and execute only the source skill's read-only evidence workflow: prepare the
isolated environment, inspect the changed flows, capture the required blind
base/head pairs and Playwright evidence, and return the exact head/base and report
to the PM and independent Quality & Trust Reviewer.

Use local, tracker-less evidence-only mode on the assigned frozen worktree; omit
the PR number so the source skill does not acquire a competing claim or launch
its PR review-first gate. Return artifacts through the independent QA handoff.
Refuse `--self-qa-signoff` for enrolled work, regardless of
who requested it. This skill applies no `qa-approved`, `qa-self-verified` or other
QA labels in pilot mode, starts no persona panel or review-first/autofix chain,
and never merges. Only the independent Quality & Trust Reviewer may apply the
current-head QA approval after inspecting the evidence through the policy's
separate acceptance handoff. The implementer cannot hold that reviewer role.
Stop at that handoff; do not fall through to the unattended sign-off rules below.

## Outside the pilot

The workflow below applies unchanged to tasks that are not enrolled. All evidence
capture, safety and freshness requirements also apply to the pilot branch above.

Extends the installed skill: read `.claude/skills/om-auto-qa-pr/SKILL.md` and follow it. On top:

- The environment comes from `sh .ai/scripts/test-env-up.sh` (the `om-prepare-test-env` entrypoint); read `baseUrl` from `.ai/qa/test-env.json`. Sign in with the demo credential reference in the descriptor, never with a literal password.
- Evidence is the **blind A/B pair** docs/SPEC.md §7 requires: run `node scripts/visual/capture.mjs` for each affected route against base and head, light and dark, at 1440x900 and 360x800, writing into `$ARTIFACTS_DIR` (`.ai/qa/artifacts_<runId>/`). Attach both frames of every pair via **attach-image-evidence**. Read `node scripts/visual/capture.mjs --help` for the flags; it refuses signed-in screens it must not photograph, and that refusal is a finding, not something to work around.
- Only for SPEC's base-absent unmounted-screen exception, the explicitly non-comparative head fixture package defined there may replace the base/head pair. Require every condition in that exception and retain all existing sign-off, failure and revision-binding rules. Explicitly enrolled Paperclip pilot issues are excluded from this exception and retain required blind base/head comparative evidence and independent Quality rules. An absent-base frame is not comparative evidence. In the panel instructions below, “pairs” includes this authorized evidence package only for that exception; require all three specialist roles for it.
- `ar` is RTL: when the change touches layout, capture one route in `ar` as well.
- **Restart the test environment on every new head before a frame counts.** A dev server that is already running does not reliably reload an edited component or any Worker (server) code, so a frame taken from it can show the previous head; a run on #1209 read a stale module as a failed check, and the QA of #1204 had to restart the environment and clear the local KV `wx:*` keys before the weather figures changed. Run `sh .ai/scripts/test-env-up.sh --force` after each push or edit (without `--force` a running environment is reused while its descriptor is younger than the TTL and no file under `src/` is newer) and read `git rev-parse HEAD` beside the frames.
- Outside the pilot, sign-off follows the installed skill's `--self-qa-signoff` rules, and an unattended run always passes that flag. The installed `risk-high` limit does not apply here: the unattended run is the QA reviewer for every PR (owner decision 2026-10-06, ADR 0035). Before applying `qa-approved` + `qa-self-verified`, hand the attached pairs through `.ai/skills/afk-decide/SKILL.md` to a panel, one sub-agent each, none of them shown another's verdict:
  - `persona-manual-tester`, always;
  - `persona-accessibility-auditor`, when the change touches layout or copy;
  - `persona-workspace-owner` (security and tenancy), when the PR is `risk-high` (labelled, or inferred per `SDLC.md` from the diff) or `security`. It judges the diff as well as the evidence: auth, tenancy, money and migrations break silently, so a screenshot cannot clear them.
    Sign off only when every member approves, and quote each verdict in the evidence comment. The persona agents can read files but not run `git`: write the diff to `$TMPDIR` and give its path in each brief. When one does not approve, post its findings in a 🤖 comment that starts `🤖 QA-PANEL: FAIL head=<sha>` (the PR's current head) as the fix list, remove `qa-approved` if the PR still carries one, apply `qa-failed` (the `--apply-failure` path) and return: `om-pr-autopilot` routes the PR to `om-auto-fix-pr` with that list, and QA runs again on the new head (the repo override of `om-pr-autopilot` says how many times).
- A PR that carries `needs-qa` beside `skip-qa` is a `needs-qa` PR: remove `skip-qa` (**unlabel-pr**) before the sign-off, since the installed skill signs off only `needs-qa` without `skip-qa` and the pair would otherwise route here again on every run (`om-approve-merge-pr` treats it the same way).
- Screenshots go under `.ai/qa/` only, never into the repo root (a stray image there has already broken the clean-room boundary once, docs/SPEC.md §2).

## Evidence bound to the reviewed revision

Inside Cezar (`CEZ_RUN_ID` is set), before repeating this stage, run `node .ai/scripts/pipeline-control.mjs evidence qa <pr>`.
A reusable record is a pointer to the existing report, not an approval by itself: read that report
and current findings/revocations. Reuse only completed passing coverage for its exact head, base
and policy. Missing evidence or new concrete findings require fresh work. After publishing a
passing report for the head actually inspected, verify the head and base have not moved and run
`node .ai/scripts/pipeline-control.mjs record-evidence qa <pr> <report-url> <reviewed-head-sha> <reviewed-base-sha>`.
Never record a failed, partial or waived stage as passed.

Outside Cezar, use the published report and exact current head/base/policy checks directly; the local run-store commands require a Cezar run identity.
