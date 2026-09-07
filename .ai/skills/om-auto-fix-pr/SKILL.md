---
name: om-auto-fix-pr
description: planned.travel extension of the installed om-auto-fix-pr skill. The loop is not done while a review thread is open; the develop ruleset blocks the merge on it even after an approving review.
---

Extends the installed skill: read `.claude/skills/om-auto-fix-pr/SKILL.md` and follow it. One addition to the stabilization loop's exit criteria:

- Before declaring the review approvable, run **list-review-threads** and require zero threads that are unresolved and not outdated. An open thread that the `om-auto-review-pr --autofix` stage fixed but did not resolve is closed here with **reply-review-comment** and **resolve-review-thread** (the repo override of `om-auto-review-pr` says how). An open thread the stage declined stays open and ends the loop with `changes-requested`, never `merge-queue`; the final report names the thread and its reason so a human can settle it.
