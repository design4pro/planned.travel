---
name: om-auto-fix-pr
description: planned.travel extension of the installed om-auto-fix-pr skill. The loop is not done while a review thread is open; the develop ruleset blocks the merge on it even after an approving review.
---

Extends the installed skill: read `.claude/skills/om-auto-fix-pr/SKILL.md` and follow it. The following additions apply.

Start only from an explicit request in Cezar. Acquire the PR claim before any mutation and release it on every exit. A terminal run must acquire a new claim before resuming writes. An existing review thread never starts or re-arms this workflow by itself.

One addition to the stabilization loop's exit criteria:

- Before declaring the review approvable, run **list-review-threads** and require zero threads that are unresolved and not outdated. An open thread that the `om-auto-review-pr --autofix` stage fixed but did not resolve is closed here with **reply-review-comment** and **resolve-review-thread** (the repo override of `om-auto-review-pr` says how). An open thread the stage declined stays open and ends the loop with `changes-requested`, never `merge-queue`; the final report names the thread and its reason so a human can settle it.

One addition to every push:

- The claim step stops on a merged or closed PR only at the start. Immediately before each `git push` to the PR head (base merge, CI fixes), run **get-pr** and read `state`, in the same command as the push. Anything other than `OPEN` stops the run: do not push, release the claim, post one comment saying why the run stopped, and report the commits that were not pushed. A push to a merged PR's head recreates the branch GitHub deleted on merge (money-tracker.online #447, 2026-09-24).

Three rules for the whole run:

- **A lesson stays in the worktree.** A lesson worth keeping goes in a `## Lessons` section of the PR body or the run's handoff file, where `afk-lessons` collects it. Never write it to `~/.claude/CLAUDE.md` or any other file outside the worktree: the write is refused under `dontAsk` and fails the run (runs b9d6b3a5, c9625ca3).
- **A fix Claude Code refuses to write is handed over, not forced.** When the fix needs a file the run may not write (`.husky/*`, `.claude/settings.json`, `.claude/hooks/*`), stop trying after the first refusal: never retry through `cp`, `sed`, `tee` or another path. Get a configuration guardian verdict through `.ai/skills/afk-decide/SKILL.md`, and end with the exact patch and that verdict in the PR body or the report, so applying it is one step for a human (run a9e39d80).
- **Find the dev server from the descriptor.** Read `baseUrl` from `.ai/qa/test-env.json` (`sh .ai/scripts/test-env-up.sh` writes it); never grep `.dev.vars*`, which the deny rules refuse. Quote every path that holds a variable, and never `cd` into a route path such as `src/routes/_app/trips/$tripId` unquoted: the shell expands `$tripId` to nothing.
