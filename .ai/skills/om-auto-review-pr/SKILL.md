---
name: om-auto-review-pr
description: planned.travel extension of the installed om-auto-review-pr skill. Every INHERITED finding ends with a reply in its thread, and only a disagreement leaves it open; the develop ruleset merges nothing with an open thread.
---

Extends the installed skill: read `.claude/skills/om-auto-review-pr/SKILL.md` and follow it. The `develop` and `main` rulesets require every review thread to be resolved before a merge, and the threads other reviewers leave (a human, an on-demand reviewer, an earlier agent pass) are resolved by nobody unless this skill does it. Three additions to step 2 and step 11:

- Step 2, collecting `INHERITED` findings: take the open set from **list-review-threads** (unresolved and not outdated), not from **list-review-comments** alone; keep each thread's `id` and its first comment's `id` with the finding.
- Step 11, accounting: a finding **fixed** in this run ends with **reply-review-comment** (what changed, in which commit) followed by **resolve-review-thread**. A finding **filed as a follow-up** ends with a reply naming the follow-up issue, then resolve. A finding **declined** ends with a reply giving the reason and the thread stays open, the verdict stays `changes-requested`, and the report names it: a human, not the pipeline, closes a disagreement. Never resolve a thread without replying in it first, and never resolve one this run did not act on.
- Step 11, the fourth outcome: **agreed but out of the run's reach.** Declining is for a
  disagreement, and only a disagreement. A finding you agree with but cannot act on - a hook
  refuses the file, the change belongs upstream, the fix needs a credential a run does not hold -
  ends with a reply that carries **the exact edit as a diff block**, the verdict `changes-requested`
  on the PR, and the thread **resolved**. Resolving is what makes the state terminal: an open
  thread blocks the merge and nothing but a human clicking will ever clear it, so a run that agrees
  and walks away has converted a one-line correction into a permanent stall. `changes-requested` is
  what says a human still owes something; the resolved thread carries what they owe.
  Before you use this outcome, try the edit: since ADR 0025 a cezar run is refused no path at all,
  so the reach that is actually missing is a credential, an upstream repository or a repository
  setting - not a file the run is forbidden to open. A write outside the worktree is still refused,
  and that one really is out of reach: it belongs in the other repository, as its own pull request.
- On a pass without autofix (another author's PR, no `--autofix`) the threads are left as found; the report lists them by path so the autopilot's next chain can pick them up.

## Independent review and validation reuse

Run review in a separate context from implementation. Capture the PR head SHA before reading the diff and include `Reviewed SHA: <full SHA>` in the submitted report. Re-read the head before publishing; a changed head invalidates the verdict and requires reviewing the new diff.

Before starting, inspect completed independent reviews for the current head. Reuse the existing report and validation for that exact SHA, unless the user explicitly requests another opinion or there is a concrete unresolved concern. Missing validation or a changed code SHA requires the applicable gate; unchanged SHA alone does not justify another full suite. A reused report is not a new review. Never count an implementation self-check as the independent review.

Additional opinions are on demand through Cezar or `@codex review`. No bot finding starts an automatic repair loop. Preserve unresolved findings for assessment; removal of a bot integration never resolves its threads.
