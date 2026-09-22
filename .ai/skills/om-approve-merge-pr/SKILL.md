---
name: om-approve-merge-pr
description: planned.travel extension of the installed om-approve-merge-pr skill. Checks unresolved review threads and preserves main/develop ancestry with a base-aware merge method.
---

Extends the installed skill: read `.claude/skills/om-approve-merge-pr/SKILL.md` and follow it. The following additions override the installed skill where necessary:

- Step 2: run **list-review-threads**. Any thread that is unresolved and not outdated makes the PR not mergeable here, even with `APPROVED` and green checks: report the threads by path and author and offer `om-auto-fix-pr <number>`, which replies in and resolves the ones it handles. Never resolve a thread from this skill: it merges, it does not answer review feedback.

- Step 1: request `baseRefName` as well as `headRefName`. An unreadable or missing base
  blocks merging; do not infer it from the source branch or the configured feature base.
- Before approval and again at step 4, reject an explicitly requested squash or rebase
  when `baseRefName` is `main`: "Cannot squash or rebase a PR targeting main: a merge
  commit is required to preserve develop/main ancestry (ADR 0003)." Do not issue that
  request and wait for the GitHub ruleset to reject it.
- Step 4: run the base-aware **merge-pr** operation in `.ai/trackers/github.md`.
  For a PR targeting `main`, it selects `--merge`; every other base keeps `--squash`.
  Re-read the base through that operation immediately before merging. Never replace
  the selected method with the generic skill's former unconditional squash default.
  Keep the merge-queue exception: enqueue without a strategy or branch deletion and
  report **queued**, not merged. The queue's configured method remains authoritative.
