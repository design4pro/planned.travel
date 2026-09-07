---
name: om-auto-fix-pr
description: planned.travel extension of the installed om-auto-fix-pr skill. The loop is not done while a review thread is open; the develop ruleset blocks the merge on it even after an approving review.
---

Extends the installed skill: read `.claude/skills/om-auto-fix-pr/SKILL.md` and follow it. Two additions.

**The `review-threads` label is a trigger, and the run consumes it.** When the PR carries it, remove it as the run's **first** tracker mutation, before the claim - the same contract `autofix` has on an issue, so a label still present is a run nobody took. The `claude-review` job applies it when it leaves live threads (`scripts/ci/review-threads-label.mjs`), and the `pr-review-threads` automation turns it into this run; leaving it on would let the next poll start a second run beside this one. Removing it is also what re-arms the trigger: the job re-applies it on the next head that still has open threads.

One addition to the stabilization loop's exit criteria:

- Before declaring the review approvable, run **list-review-threads** and require zero threads that are unresolved and not outdated. An open thread that the `om-auto-review-pr --autofix` stage fixed but did not resolve is closed here with **reply-review-comment** and **resolve-review-thread** (the repo override of `om-auto-review-pr` says how). An open thread the stage declined stays open and ends the loop with `changes-requested`, never `merge-queue`; the final report names the thread and its reason so a human can settle it.
