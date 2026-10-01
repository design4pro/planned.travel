---
name: om-auto-qa-pr
description: planned.travel extension of the installed om-auto-qa-pr skill. Evidence is the blind A/B pair from scripts/visual/capture.mjs; a specialist sub-agent judges it, and the run signs off below risk-high.
---

Extends the installed skill: read `.claude/skills/om-auto-qa-pr/SKILL.md` and follow it. On top:

- The environment comes from `sh .ai/scripts/test-env-up.sh` (the `om-prepare-test-env` entrypoint); read `baseUrl` from `.ai/qa/test-env.json`. Sign in with the demo credential reference in the descriptor, never with a literal password.
- Evidence is the **blind A/B pair** docs/SPEC.md §7 requires: run `node scripts/visual/capture.mjs` for each affected route against base and head, light and dark, at 1440x900 and 360x800, writing into `$ARTIFACTS_DIR` (`.ai/qa/artifacts_<runId>/`). Attach both frames of every pair via **attach-image-evidence**. Read `node scripts/visual/capture.mjs --help` for the flags; it refuses signed-in screens it must not photograph, and that refusal is a finding, not something to work around.
- `ar` is RTL: when the change touches layout, capture one route in `ar` as well.
- Sign-off follows the installed skill's `--self-qa-signoff` rules, and an unattended run always passes that flag. Before applying `qa-approved` + `qa-self-verified`, hand the attached pairs to the `persona-manual-tester` sub-agent (with `persona-accessibility-auditor` when the change touches layout or copy) through `.ai/skills/afk-decide/SKILL.md`, and sign off only on its approving verdict, quoted in the evidence comment. A `risk-high` PR keeps the installed skill's rule: post the evidence and the verdict, withhold the sign-off, and leave `qa-approved` to the owner (a security specialist's verdict, 2026-10-01: auth, tenancy, money and migrations break silently, and those PRs are few).
- Screenshots go under `.ai/qa/` only, never into the repo root (a stray image there has already broken the clean-room boundary once, docs/SPEC.md §2).
