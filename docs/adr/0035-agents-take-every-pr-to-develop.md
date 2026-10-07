# 0035. Agents take every PR to develop

Status: accepted
Date: 2026-10-06
Amends: ADR 0031 (`risk-high` QA no longer stays with the owner), ADR 0032 (the owner's
`qa-approved` on `risk-high` is no longer a brake), ADR 0033 (the WIP limit counts `blocked` PRs and
parked `changes-requested` only)

## Context

A PR into `develop` could wait for a person in seven places: the QA gate (`needs-qa` without
`qa-approved`), the QA skill withholding its sign-off on `risk-high`, `om-pr-autopilot` ending a
`risk-high` PR at merge-ready, `om-approve-merge-pr` asking about a stale `QA head:`, a
`needs-qa` + `skip-qa` pair or `changes-requested`, a declined review finding left for a human,
`afk-decide` listing `risk-high` QA as a person's, and the Reconciler and `backlog-status.mjs`
treating `needs-qa`, `risk-high` and `security` as a person's queue. Nobody came: #798 (`risk-high`)
and #880 (`risk-high`, `security`) sat green and behind `develop`, and the Reconciler stopped
updating them because they "waited for a person".

The owner's decision (2026-10-06): development is autonomous until the merge into `develop`. Where a
person judged, specialist sub-agents judge, from different sides, and send the work back for fixes.

## Decision

- **QA is a panel, on every PR.** `om-auto-qa-pr --self-qa-signoff` signs off `risk-high` and
  `security` PRs too. `persona-manual-tester` always judges the evidence,
  `persona-accessibility-auditor` joins for layout or copy, and `persona-workspace-owner` (security
  and tenancy) joins for `risk-high` or `security` and judges the diff as well. Every member must
  approve.
- **`risk-high` and `security` merge on a security verdict.** Before merging one, UI or not,
  `om-pr-autopilot` asks the security and tenancy reviewer to judge the diff at the current head.
- **A rejection goes back to the agents.** A failed check, `changes-requested`, the panel's
  `qa-failed` and a refused security verdict route to `om-auto-fix-pr`, then review, QA and the
  verdict again. A declined review finding is settled by an independent specialist, not left open
  for a person.
- **Three rounds, then a person.** Each round is a 🤖 `Autopilot round <n>/3` comment on the PR.
  After the third failed round the PR gets `blocked` and a `🤖 HUMAN-ONLY:` comment: the one way the
  loop hands a PR into `develop` to a person.
- **Only `blocked` (and a parked `changes-requested`) waits for a person.** `backlog-status.mjs`
  counts only those against the WIP limit, and the Reconciler (cezar `host/reconciler`) updates and
  merges every other open PR whatever its QA or risk labels.

## Consequences

- No person reads an auth, tenancy, billing or migration diff before it reaches `develop`. The
  `develop` -> `main` promotion, which a person merges (`do-not-merge`, ADR 0032), is now the one
  place a person sees those changes before production.
- More runs and CI per PR: the panel is up to three sub-agents, and a rejected PR runs the chain up
  to three times.
- What still stops: `do-not-merge`, `blocked`, an active `qa` label or a `qa-failed` a person set,
  spec-only PRs other than `afk-plan-to-spec`'s (ADR 0033), and the `afk-decide` § 5 list, which
  keeps a security reviewer's refusal to let an agent _implement_ `risk-high` work.
