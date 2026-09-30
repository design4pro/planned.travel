---
name: om-pr-autopilot
description: planned.travel extension of the installed om-pr-autopilot skill. The PR state is re-read before every push, because a human may merge or close the PR mid-run.
---

Extends the installed skill: read `.claude/skills/om-pr-autopilot/SKILL.md` and follow it. The following additions apply.

Diagnosis reads the PR state once, at the start, but a human may merge or close the PR while the run works. This rule covers every push the run makes, including those of the chained skills that push to the PR head (`om-auto-continue-pr`, `om-auto-continue-pr-loop`, `om-auto-fix-pr`, `om-auto-review-pr` in autofix), whether or not their own overrides were read:

- Immediately before each `git push` to the PR head, run **get-pr** and read `state`. Keep the check and the push in one command so nothing runs between them.
- Anything other than `OPEN` stops the run: do not push, release the claim, post one comment saying why the run stopped, and report the commits that were not pushed.

GitHub deletes a merged PR's head branch, and a push to it recreates that branch on the remote. It happened on money-tracker.online #447 (2026-09-24): the PR was merged while the base-merge gate ran, and the push that followed brought the deleted head branch back.

Three more rules cover the run and every chained skill, whether or not their own overrides were read:

- **A lesson stays in the worktree.** A lesson worth keeping goes in a `## Lessons` section of the PR body or the run's handoff file, where `afk-lessons` collects it. Never write it to `~/.claude/CLAUDE.md` or any other file outside the worktree: the write is refused under `dontAsk` and fails the run (runs b9d6b3a5, c9625ca3).
- **A fix Claude Code refuses to write is handed over, not forced.** When the fix needs a file the run may not write (`.husky/*`, `.claude/settings.json`, `.claude/hooks/*`), stop trying after the first refusal: never retry through `cp`, `sed`, `tee` or another path. Get a configuration guardian verdict through `.ai/skills/afk-decide/SKILL.md`, and end with the exact patch and that verdict in the PR body or the report, so applying it is one step for a human (run a9e39d80).
- **Find the dev server from the descriptor.** Read `baseUrl` from `.ai/qa/test-env.json` (`sh .ai/scripts/test-env-up.sh` writes it); never grep `.dev.vars*`, which the deny rules refuse. Quote every path that holds a variable, and never `cd` into a route path such as `src/routes/_app/trips/$tripId` unquoted: the shell expands `$tripId` to nothing.
