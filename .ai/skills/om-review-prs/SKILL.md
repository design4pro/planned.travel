---
name: om-review-prs
description: planned.travel extension of the installed om-review-prs skill. The sweep ends by releasing any claim one of its own reviews left behind, and never reports a released PR as reviewed (#551).
---

Extends the installed skill: read `.claude/skills/om-review-prs/SKILL.md` and follow it. On top:

`om-auto-review-pr` must release the lock it opened on every exit path, and its own step 12 says so
in a `trap`/finally. On PR #549 a housekeeping sweep claimed, reviewed nothing, and ended `done`
with `in-progress` still on the PR - so the same run's `om-merge-buddy` step skipped it, and every
other actor would have backed off for the 24-hour stale window. That rule lives in prompt prose,
and nothing checked it. `scripts/agents/release-leaked-claims.mjs` is the deterministic half; these
two additions are what call it.

- **Step 5, before dispatching the first review:** record the sweep's start as
  `SWEEP_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)` and keep the list of PR numbers you dispatch
  `om-auto-review-pr` at. Both are bounds the reconciler requires, and both exist to avoid the
  opposite defect (#490, a live claim released while a run still holds it): `--since` limits it to
  claims this sweep could have opened, `--prs` to the PRs this sweep dispatched. A PR the queue
  filters skipped was never dispatched and never goes in the list.

- **Step 6, as the sweep's last act, on every exit path** - the clean finish, an early stop, a
  delegated review that failed, and the branch where you claim a PR and then decide not to review
  it - run

  ```bash
  node scripts/agents/release-leaked-claims.mjs --since "$SWEEP_START" --prs <comma-separated dispatched PRs>
  ```

  and copy its output verbatim into the session summary. Skip the call only when the list is empty,
  because the sweep dispatched nothing: both bounds are mandatory and the script exits 2 rather
  than widening an unbounded window.

  Report a released PR by what the script actually said about it, never by a blanket assumption.
  The reconciler releases two different situations and distinguishes them in its own output: a
  claim that produced nothing ends `no review submitted`, while a claim whose review landed but
  whose release comment did not ends `<STATE> review submitted at <time>` - `planRelease` looks for
  a review by this account after the claim precisely so the second case is not mislabelled. Give
  every released PR its own row carrying that outcome verbatim. Only a PR the script reported as
  `no review submitted` may be described as unreviewed; for the other, report the verdict it names,
  because calling it unreviewed would contradict both the script and GitHub. That is the in-repo
  half of the second acceptance criterion on #551; what the cezar runner records as the step's
  status is its contract, not this repository's.

Before dispatching each PR, read its current head SHA and completed independent review reports. Skip another review when the same SHA already has a completed report, preserving its verdict and unresolved findings. Record the reused report and SHA in the sweep summary. Only dispatch on a changed SHA, missing report or an explicit request for another opinion. Do not add skipped PRs to the leaked-claim reconciler's dispatch list.
