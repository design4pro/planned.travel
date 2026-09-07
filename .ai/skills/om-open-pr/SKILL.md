---
name: om-open-pr
description: planned.travel extension of the installed om-open-pr skill. PR body carries the repo's Definition of Done checklist; target develop.
---

Extends the installed skill: read `.claude/skills/om-open-pr/SKILL.md` and follow it. On top:

- Target `develop` (the config's `baseBranch`); never `main`.
- Linkage: `Closes #{issueId}` for an implementing PR, `Refs #{issueId}` for a spec-only PR. GitHub ignores the keyword on `develop`; `om-close-fixed-issues` closes the issue after merge, so the keyword is the contract.
- Append to the unified body, after `## 💥 Breaking Changes`, the two sections from `.github/pull_request_template.md`: `## Definition of done (docs/SPEC.md §7)` with its checkboxes ticked only for items actually verified, and `## Noticed but not touching` listing anything outside the change's ownership that deserves an issue (`nothing` when empty).
- `needs-qa` whenever the diff touches `src/routes`, `src/components`, `src/styles`, `src/server/email` or a locale file; `skip-qa` otherwise. `risk-high` when the diff touches `src/server/auth`, `src/server/repos/base.ts`, `src/server/billing`, `src/server/db/schema.ts`, `drizzle/` or `src/server/public`.
- Commits follow Conventional Commits in English. Branch prefixes: `fix/`, `feat/`, `spec/`, `chore/`.
