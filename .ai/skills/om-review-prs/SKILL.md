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

  A PR the script released was **not** reviewed by this sweep. Never report it as reviewed: give it
  its own row whose outcome states that no review was submitted and the lock was released, so the
  summary distinguishes a review that ran from a claim that produced nothing. That is the in-repo
  half of the second acceptance criterion on #551; what the cezar runner records as the step's
  status is its contract, not this repository's.
