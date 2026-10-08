# 0037. A green pull request merges without "Update branch", and the report is a comment

Status: accepted
Date: 2026-10-07
Amends: ADR 0021 (the three required checks stay the merge authority, but no longer have to be green
on the latest `develop`), ADR 0031 (no merge gate: the comment below is evidence, not a gate).

## Context

The `develop` ruleset had `strict_required_status_checks_policy: true`. Every merge into `develop`
turned the green checks of every other open pull request stale, so each needed "Update branch" and a
second full pass through `lint · typecheck · build`, `unit tests` and the journeys, with nothing in the
pull request changed. Draft pull requests ran the same gates, and a reader had to open the run to learn
what passed.

## Decision

1. **`strict_required_status_checks_policy` is `false` on the `develop` ruleset**, changed in the
   repository settings on 2026-10-07 (the ruleset is not kept in this repository). A pull request whose
   required checks are green and which has no conflicts merges as it is.
2. **CI skips draft pull requests.** `ci.yml` runs on `ready_for_review` too, and every job a pull
   request starts carries `!github.event.pull_request.draft`. A skipped required check counts as
   passed, and a draft cannot be merged, so no verdict is lost.
3. **`e2e · merged report` writes one comment per pull request**, found by the marker
   `<!-- ci-test-report -->` and updated in place: the result of `lint · typecheck · build` and
   `unit tests`, the journey totals summed from the shards (`scripts/ci/test-report.mjs`), the head
   SHA and the run. It is green only when every gate that ran succeeded and the journeys reported
   numbers with nothing failed. It never fails the job; the required check still decides the merge.

## Consequences

- Two pull requests that are each green alone can break `develop` together, since neither ran on top
  of the other. The push run on `develop` catches it, and `deploy-staging` needs that run's green
  `verify`, `test` and `e2e-report`, so a broken combination does not ship. The fix is a normal pull
  request.
- `e2e-report` now waits for `verify` and `test` as well, so the comment can name them. It starts when
  the slowest of the three finishes, not when the shards do.
- Rolling back is one setting: `strict_required_status_checks_policy` back to `true`.
