---
name: om-auto-qa-pr
description: planned.travel extension of the installed om-auto-qa-pr skill. Evidence is the blind A/B pair from scripts/visual/capture.mjs; a panel of specialist sub-agents judges it, and the run signs off on every PR, risk-high included.
---

Extends the installed skill: read `.claude/skills/om-auto-qa-pr/SKILL.md` and follow it. On top:

- The environment comes from `sh .ai/scripts/test-env-up.sh` (the `om-prepare-test-env` entrypoint); read `baseUrl` from `.ai/qa/test-env.json`. Sign in with the demo credential reference in the descriptor, never with a literal password.
- Evidence is the **blind A/B pair** docs/SPEC.md §7 requires: run `node scripts/visual/capture.mjs` for each affected route against base and head, light and dark, at 1440x900 and 360x800, writing into `$ARTIFACTS_DIR` (`.ai/qa/artifacts_<runId>/`). Attach both frames of every pair via **attach-image-evidence**. Read `node scripts/visual/capture.mjs --help` for the flags; it refuses signed-in screens it must not photograph, and that refusal is a finding, not something to work around.
- `ar` is RTL: when the change touches layout, capture one route in `ar` as well.
- Sign-off follows the installed skill's `--self-qa-signoff` rules, and an unattended run always passes that flag. The installed `risk-high` limit does not apply here: the unattended run is the QA reviewer for every PR (owner decision 2026-10-06, ADR 0035). Before applying `qa-approved` + `qa-self-verified`, hand the attached pairs through `.ai/skills/afk-decide/SKILL.md` to a panel, one sub-agent each, none of them shown another's verdict:
  - `persona-manual-tester`, always;
  - `persona-accessibility-auditor`, when the change touches layout or copy;
  - `persona-workspace-owner` (security and tenancy), when the PR is `risk-high` (labelled, or inferred per `SDLC.md` from the diff) or `security`. It judges the diff as well as the evidence: auth, tenancy, money and migrations break silently, so a screenshot cannot clear them.
    Sign off only when every member approves, and quote each verdict in the evidence comment. The persona agents can read files but not run `git`: write the diff to `$TMPDIR` and give its path in each brief. When one does not approve, post its findings in a 🤖 comment that starts `🤖 QA-PANEL: FAIL head=<sha>` (the PR's current head) as the fix list, remove `qa-approved` if the PR still carries one, apply `qa-failed` (the `--apply-failure` path) and return: `om-pr-autopilot` routes the PR to `om-auto-fix-pr` with that list, and QA runs again on the new head (the repo override of `om-pr-autopilot` says how many times).
- A PR that carries `needs-qa` beside `skip-qa` is a `needs-qa` PR: remove `skip-qa` (**unlabel-pr**) before the sign-off, since the installed skill signs off only `needs-qa` without `skip-qa` and the pair would otherwise route here again on every run (`om-approve-merge-pr` treats it the same way).
- Screenshots go under `.ai/qa/` only, never into the repo root (a stray image there has already broken the clean-room boundary once, docs/SPEC.md §2).
