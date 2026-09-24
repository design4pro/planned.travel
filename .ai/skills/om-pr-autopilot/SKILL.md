---
name: om-pr-autopilot
description: planned.travel extension of the installed om-pr-autopilot skill. The PR state is re-read before every push, because a human may merge or close the PR mid-run.
---

Extends the installed skill: read `.claude/skills/om-pr-autopilot/SKILL.md` and follow it. One addition applies.

Diagnosis reads the PR state once, at the start, but a human may merge or close the PR while the run works. This rule covers every push the run makes, including those of the chained skills that push to the PR head (`om-auto-continue-pr`, `om-auto-continue-pr-loop`, `om-auto-fix-pr`, `om-auto-review-pr` in autofix), whether or not their own overrides were read:

- Immediately before each `git push` to the PR head, run **get-pr** and read `state`. Keep the check and the push in one command so nothing runs between them.
- Anything other than `OPEN` stops the run: do not push, release the claim, post one comment saying why the run stopped, and report the commits that were not pushed.

GitHub deletes a merged PR's head branch, and a push to it recreates that branch on the remote. It happened on money-tracker.online #447 (2026-09-24): the PR was merged while the base-merge gate ran, and the push that followed brought the deleted head branch back.
