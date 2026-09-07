---
name: om-auto-review-pr
description: planned.travel extension of the installed om-auto-review-pr skill. Every INHERITED finding ends with a reply in its thread and, when handled, the thread resolved; the develop ruleset merges nothing with an open thread.
---

Extends the installed skill: read `.claude/skills/om-auto-review-pr/SKILL.md` and follow it. The `develop` and `main` rulesets require every review thread to be resolved before a merge, and the threads other reviewers leave (a human, the `claude[bot]` review job, an earlier agent pass) are resolved by nobody unless this skill does it. Two additions to step 2 and step 11:

- Step 2, collecting `INHERITED` findings: take the open set from **list-review-threads** (unresolved and not outdated), not from **list-review-comments** alone; keep each thread's `id` and its first comment's `id` with the finding.
- Step 11, accounting: a finding **fixed** in this run ends with **reply-review-comment** (what changed, in which commit) followed by **resolve-review-thread**. A finding **filed as a follow-up** ends with a reply naming the follow-up issue, then resolve. A finding **declined** ends with a reply giving the reason and the thread stays open, the verdict stays `changes-requested`, and the report names it: a human, not the pipeline, closes a disagreement. Never resolve a thread without replying in it first, and never resolve one this run did not act on.
- On a pass without autofix (another author's PR, no `--autofix`) the threads are left as found; the report lists them by path so the autopilot's next chain can pick them up.
