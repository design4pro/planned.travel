# om-check-and-commit repository policy

Always apply `.agents/policies/security.md` and the atomic ownership protocol in `.ai/trackers/github.md`.

Extends the installed skill: read `.agents/skills/om-check-and-commit/SKILL.md` and follow it. On top:

- Push rule, replacing "Push the current branch" in step 5 (the same rule as the `om-open-pr`, continue, fix-pr and review-pr overrides, money-tracker.online #447, 2026-09-24). It applies only to the push the user asked for; the skill still pushes nothing else. The current branch can be the head of an open PR, and GitHub deletes a merged PR's head branch, so a push to it recreates that branch on the remote. **search-prs** searches open PRs only, so it cannot see the merged PR. Therefore, before the push, take the branch from `git symbolic-ref --short HEAD`: a detached HEAD has no branch, so do not push, report the commit as unpushed and stop. Then look up every PR for the branch in every state: `gh pr list --head "<branch>" --state all --json number,state`.
  - No PR for the branch: the normal first push, go ahead.
  - A PR exists and none is `OPEN` (`MERGED` or `CLOSED`): do not push. There is no claim to release. Report the commit as unpushed with the PR number and its state, in the "When blocked" line of the final report, and stop. There is no new output shape.
  - An `OPEN` PR exists: run **get-pr** and read `state` in the same command as the push, so a merge in between cannot slip through, and stop as above on anything other than `OPEN`: `[ "$(gh pr view <number> --json state -q .state)" = OPEN ] && git push origin HEAD:refs/heads/<branch>`. The retry after a network error repeats the whole command, check included.
  - The refspec is always explicit (`HEAD:refs/heads/<branch>`): without `:<dst>`, `push.default = upstream` lets the push land on the upstream branch instead of the named one. Read the answer: `[new branch]` for a branch that has a PR, or `Bypassed rule violations`, means the push did something it should not have, so stop and report it.
