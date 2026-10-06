---
name: om-auto-review-pr
description: planned.travel extension of the installed om-auto-review-pr skill. Every INHERITED finding ends with a reply in its thread, and a specialist settles a disagreement; the develop ruleset merges nothing with an open thread.
---

Extends the installed skill: read `.claude/skills/om-auto-review-pr/SKILL.md` and follow it. The `develop` and `main` rulesets require every review thread to be resolved before a merge, and the threads other reviewers leave (a human, an on-demand reviewer, an earlier agent pass) are resolved by nobody unless this skill does it. Three additions to step 2 and step 11:

- Step 2, collecting `INHERITED` findings: take the open set from **list-review-threads** (unresolved and not outdated), not from **list-review-comments** alone; keep each thread's `id` and its first comment's `id` with the finding.
- Step 11, accounting: a finding **fixed** in this run ends with **reply-review-comment** (what changed, in which commit) followed by **resolve-review-thread**. A finding **filed as a follow-up** ends with a reply naming the follow-up issue, then resolve. A finding **declined** goes to an independent specialist through `.ai/skills/afk-decide/SKILL.md` (picked by what the finding is about), with the finding and the reason to decline: when it sides with the finding, fix it as above; when it sides with the decline, reply with the reason and its verdict, then resolve. The pipeline, not a person, closes a disagreement on a PR into `develop` (owner decision 2026-10-06, ADR 0035). Never resolve a thread without replying in it first, and never resolve one this run did not act on.
- Step 11, the fourth outcome: **agreed but out of the run's reach.** Declining is for a
  disagreement, and only a disagreement. A finding you agree with but cannot act on - a hook
  refuses the file, the change belongs upstream, the fix needs a credential a run does not hold -
  ends with a reply that carries **the exact edit as a diff block**, the verdict `changes-requested`
  on the PR, and the thread **resolved**. Resolving is what makes the state terminal: an open
  thread blocks the merge and nothing but a human clicking will ever clear it, so a run that agrees
  and walks away has converted a one-line correction into a permanent stall. `changes-requested` is
  what says something is still owed, and on a PR into `develop` the run that finds it adds `blocked` and the `🤖 HUMAN-ONLY:` comment of the `om-pr-autopilot` override at once, since no agent can act on it; the resolved thread carries what a person owes.
  Check intended write paths before implementation. ADR 0025 removes upstream ownership, not
  runtime permissions: protected configuration can still require supervision. Declare known
  protected writes in Cezar `writePaths` (or `cezar task --write-path`) so preflight can stop
  before expensive work. After a denial, stop the unattended run once and hand the exact diff
  and worktree to a supervised run with approval limited to those paths. Never enable global
  `bypassPermissions`, switch tools to evade denial, or repeat diagnosis and tests for the same
  refusal. Changes outside this repository belong in their own pull request.
- On a pass without autofix (another author's PR, no `--autofix`) the threads are left as found; the report lists them by path so the autopilot's next chain can pick them up.

## Independent review and validation reuse

Run review in a separate context from implementation. Capture the PR head SHA before reading the diff and include `Reviewed SHA: <full SHA>` in the submitted report. Re-read the head before publishing; a changed head invalidates the verdict and requires reviewing the new diff.

Before starting, inspect completed independent reviews for the current head. Reuse the existing report and validation for that exact SHA, unless the user explicitly requests another opinion or there is a concrete unresolved concern. Missing validation or a changed code SHA requires the applicable gate; unchanged SHA alone does not justify another full suite. A reused report is not a new review. Never count an implementation self-check as the independent review.

Additional opinions are on demand through Cezar or `@codex review`. No bot finding starts an automatic repair loop. Preserve unresolved findings for assessment; removal of a bot integration never resolves its threads.

## Re-read the PR state before every push

The claim step stops on a merged or closed PR only at the start. Immediately before each `git push` of an autofix commit or a conflict-resolution merge to the PR head, run **get-pr** and read `state`, in the same command as the push. Anything other than `OPEN` stops the run: do not push, release the claim, post one comment saying why the run stopped, and report the commits that were not pushed. A push to a merged PR's head recreates the branch GitHub deleted on merge (money-tracker.online #447, 2026-09-24).
