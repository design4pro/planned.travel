---
name: om-approve-merge-pr
description: planned.travel extension of the installed om-approve-merge-pr skill. Reads the review threads before merging, because the develop ruleset rejects a merge with an open thread whatever the review decision says.
---

Extends the installed skill: read `.claude/skills/om-approve-merge-pr/SKILL.md` and follow it. One addition to step 2 (pre-merge checks):

- Run **list-review-threads**. Any thread that is unresolved and not outdated makes the PR not mergeable here, even with `APPROVED` and green checks: report the threads by path and author and offer `om-auto-fix-pr <number>`, which replies in and resolves the ones it handles. Never resolve a thread from this skill: it merges, it does not answer review feedback.
