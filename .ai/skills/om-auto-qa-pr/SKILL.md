---
name: om-auto-qa-pr
description: planned.travel extension of the installed om-auto-qa-pr skill. Evidence is the blind A/B pair from scripts/visual/capture.mjs; automation never approves QA.
---

Extends the installed skill: read `.claude/skills/om-auto-qa-pr/SKILL.md` and follow it. On top:

- The environment comes from `sh .ai/scripts/test-env-up.sh` (the `om-prepare-test-env` entrypoint); read `baseUrl` from `.ai/qa/test-env.json`. Sign in with the demo credential reference in the descriptor, never with a literal password.
- Evidence is the **blind A/B pair** docs/SPEC.md §7 requires: run `node scripts/visual/capture.mjs` for each affected route against base and head, light and dark, at 1440x900 and 360x800, writing into `$ARTIFACTS_DIR` (`.ai/qa/artifacts_<runId>/`). Attach both frames of every pair via **attach-image-evidence**. Read `node scripts/visual/capture.mjs --help` for the flags; it refuses signed-in screens it must not photograph, and that refusal is a finding, not something to work around.
- `ar` is RTL: when the change touches layout, capture one route in `ar` as well.
- Evidence-only mode always; never apply `qa-approved` or `qa-self-verified` from automation. The maintainer is the QA reviewer and signs off from the attached pair.
- Screenshots go under `.ai/qa/` only, never into the repo root (a stray image there has already broken the clean-room boundary once, docs/SPEC.md §2).
