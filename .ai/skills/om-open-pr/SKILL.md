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
- Push rule, replacing the push of step 4 (the same rule as the continue, fix-pr and review-pr overrides, money-tracker.online #447, 2026-09-24). GitHub deletes a merged PR's head branch, and a push to it recreates that branch on the remote, after which step 5 would open a second PR. **search-prs** searches open PRs only, so it cannot see the merged PR. Therefore, before the step 4 push, look up every PR for the head branch in every state: `gh pr list --head "<branch>" --state all --json number,state`.
  - No PR for the head: the normal first push, go ahead.
  - A PR exists and none is `OPEN` (`MERGED` or `CLOSED`): do not push. Release the lock (step 8), post one comment saying why the run stopped, list the commits that were not pushed, and end with `Status: blocked` and no `PR:` / `Issue:` lines. There is no new output shape.
  - An `OPEN` PR exists: run **get-pr** and read `state` in the same command as the push, so a merge in between cannot slip through, and stop as above on anything other than `OPEN`: `[ "$(gh pr view <number> --json state -q .state)" = OPEN ] && git push origin HEAD:refs/heads/<branch>`. The retry after a network error repeats the whole command, check included.
  - The refspec is always explicit (`HEAD:refs/heads/<branch>`), never `-u origin "<branch>"`: without `:<dst>`, `push.default = upstream` lets the push land on the upstream branch instead of the named one. Read the answer: `[new branch]` for a head that has a PR, or `Bypassed rule violations`, means the push did something it should not have, so stop and report it.
- Chains that attest open the PR with `--draft` and mark it ready after their last push (SDLC.md § Draft until the last push); a standalone call keeps the installed default, a ready PR.
