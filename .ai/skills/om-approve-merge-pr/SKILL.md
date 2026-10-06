---
name: om-approve-merge-pr
description: planned.travel extension of the installed om-approve-merge-pr skill. Checks unresolved review threads and preserves main/develop ancestry with a base-aware merge method.
---

Extends the installed skill: read `.claude/skills/om-approve-merge-pr/SKILL.md` and follow it. The following additions override the installed skill where necessary:

- Step 2: run **list-review-threads**. Any thread that is unresolved and not outdated makes the PR not mergeable here, even with `APPROVED` and green checks: report the threads by path and author and offer `om-auto-fix-pr <number>`, which replies in and resolves the ones it handles. Never resolve a thread from this skill: it merges, it does not answer review feedback.

- Step 3: an approving review is required only when the base branch's ruleset asks for one. Read it before approving: `gh api "repos/{owner}/{repo}/rules/branches/<baseRefName>" --jq '[.[] | select(.type == "pull_request") | .parameters] | {approvals: (map(.required_approving_review_count) | max // 0), codeOwners: (map(.require_code_owner_review) | any)}'`. When it answers `approvals: 0` and `codeOwners: false` (true for `develop` today), an approval is not a merge requirement: submit it when GitHub accepts it, and when GitHub rejects self-approval (the run uses the PR author's account), go straight to step 4 without asking. Never report "needs an approving review from someone other than the author" as a blocker then - that is not what the ruleset says, and it stalled #770. Only when the ruleset requires approvals or code-owner review and none exists is a missing approval a real blocker: report it and stop.
- Step 1: request `baseRefName` as well as `headRefName`. An unreadable or missing base
  blocks merging; do not infer it from the source branch or the configured feature base.
- An unattended run (`CEZ_TASK_ID` is set, or no person is in the session) merges only a PR
  whose `baseRefName` is `develop`. Any other base - above all the `develop` -> `main`
  promotion, which carries `do-not-merge` - is reported as merge-ready and left for the owner:
  merging it deploys production. The `main` rules below apply when the owner drives the merge.
- In that unattended run into `develop`, a gate that would ask a person routes back to
  `om-pr-autopilot`'s agents instead (owner decision 2026-10-06, ADR 0035), overriding the
  installed "never resolve a merge gate autonomously" and "the QA gate never routes to
  automation" rules: report the PR not mergeable now and name the route. `needs-qa` without
  `qa-approved`, a stale `QA head:`, and `needs-qa` beside `skip-qa` route to
  `om-auto-qa-pr <number> --self-qa-signoff` on the current head (treat the pair as `needs-qa`);
  `changes-requested` and a `qa-failed` the QA panel set (a `🤖 QA-PANEL: FAIL head=<sha>` comment for the current head marks it) route to `om-auto-fix-pr <number>`. A `risk-high` or `security` PR without an approving security verdict on the current head (`om-pr-autopilot` override) routes back to `om-pr-autopilot <number> --allow-merge`. Never
  merge past one of them in this run. A `qa-failed` without that comment (a person set it), an active `qa`, `blocked` and
  `do-not-merge` still stop and report.
- Before approval and again at step 4, reject an explicitly requested squash or rebase
  when `baseRefName` is `main`: "Cannot squash or rebase a PR targeting main: a merge
  commit is required to preserve develop/main ancestry (ADR 0003)." Do not issue that
  request and wait for the GitHub ruleset to reject it.
- Step 4: run the base-aware **merge-pr** operation in `.ai/trackers/github.md`.
  For a PR targeting `main`, it selects `--merge`; every other base keeps `--squash`.
  Re-read the base through that operation immediately before merging. Never replace
  the selected method with the generic skill's unconditional squash default.
  Keep the merge-queue exception: enqueue without a strategy or branch deletion and
  report **queued**, not merged. The queue's configured method remains authoritative.
- Step 6: report the actual selected method (`merge commit` for `main`, `squash`
  elsewhere), overriding the generic report template's unconditional `merged (squash)`.
