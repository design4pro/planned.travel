---
name: om-auto-fix-issue
description: planned.travel extension of the installed om-auto-fix-issue skill. Repo-specific rules only; the installed skill's workflow and safety rules apply unchanged.
---

Extends the installed skill: read `.claude/skills/om-auto-fix-issue/SKILL.md` and follow it. On top:

- `autofix` is the human "start" label a Cezar automation reacts to. Remove it from the issue as the **first** tracker mutation of the run (via `remove_issue_label`), before triage, so a still-present `autofix` always means "nobody picked this up". Never add `autofix`, `spec` or `groom` to any issue.
- The implementing PR body carries `Closes #{issueId}`. GitHub will not close the issue on merge because PRs target `develop`, not the default branch; `om-close-fixed-issues` (the housekeeping workflow) closes it. Keep the keyword anyway: that is what housekeeping reads.
- Never add, remove or upgrade a dependency (`pnpm add|remove|update`): the stack is pinned (docs/SPEC.md §3). A fix that needs one ends as `Status: blocked` naming the dependency.
- A diff touching `src/routes`, `src/components`, `src/styles`, `src/server/email` or a locale file under `src/lib/i18n/messages` is UI-touching: step 10 (`om-auto-qa-pr`) is mandatory and the PR keeps `needs-qa`.
- Read `CLAUDE.md`, `CODE_REVIEW.md` and `BACKWARD_COMPATIBILITY.md` before delegating; the chain skills inherit their rules through their own overrides in `.ai/skills/`.
