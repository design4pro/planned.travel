# 0031. No merge gate

Status: accepted
Date: 2026-09-25
Amends: ADR 0018 (`pr-autopilot` runs with `--allow-merge`), ADR 0021 (the rulesets require three
checks, not four: `merge-gate` is gone), ADR 0027 (the `gate` runner slot is folded into `ci`).

## Context

Around the three CI checks that ADR 0021 makes the merge authority, the repository grew a layer of
merge machinery of its own:

- `merge-gate` (`.github/workflows/merge-gate.yml`, `scripts/ci/merge-gate.mjs`), a required check
  that read the pull request's labels and failed on `do-not-merge`, `blocked`, `qa-failed`, and
  `needs-qa` without `qa-approved`.
- `auto-merge-develop` (`.github/workflows/auto-merge-develop.yml`,
  `scripts/agents/auto-merge-develop.mjs`, `docs/agents/auto-merge.md`), a controller meant to merge
  eligible low- and medium-risk pull requests into `develop`. It only ever ran `--dry-run`;
  `AUTO_MERGE_DEVELOP_APPLY` was never set.
- A `gate` slot in the VPS pool (ADR 0027) so those seconds-long jobs never queued behind an e2e
  shard.
- Tests that pinned the text of workflows, prompts and documents rather than any behaviour: a regex
  over a YAML file or a sentence in a `SKILL.md` goes red on a rewording and stays green on a real
  regression that keeps the wording.

The merge skills (`om-merge-buddy`, `om-approve-merge-pr`) already read the same labels before
they merge, and `om-pr-autopilot --allow-merge` is the native way to let a cezar run end in that
merge. The reference setup this pipeline follows, Open
Mercato, has none of this layer.

## Decision

1. `merge-gate` is removed. The `develop` and `main` rulesets require only `lint · typecheck · build`,
   `unit tests` and `e2e · merged report`.
2. The label rules in `SDLC.md` - the hard blocks, and `needs-qa` until `qa-approved` - stay as a
   convention. The merge skills read them; no CI check enforces them.
3. `auto-merge-develop` is removed. Merging into `develop` is cezar's `pr-autopilot` workflow,
   which now runs `om-pr-autopilot --allow-merge`: the chain ends in `om-approve-merge-pr`, which
   refuses on `do-not-merge`, `blocked`, `qa-failed`, and `needs-qa` without `qa-approved`. It
   starts on a pull request a maintainer opens (**Autopilot new pull requests**) and on an agent
   pull request reviewed into `merge-queue` (**Merge reviewed agent pull requests**,
   `pull_request.reviewed`, author `design4pro-agent`). The `develop` → `main` promotion is authored
   by a maintainer and opened carrying `merge-queue`, so neither automation matches it: a person
   merges it. `parseCloseLinks` stays in `scripts/agents/close-fixed-issues.mjs`, where it always lived.
4. The `gate` runner slot is folded into `ci`: `promote-develop.yml`, the last job on it, defaults
   to `["self-hosted","linux","X64","ci"]` through `vars.RUNNER_CI` like every other CI job.
5. Tests that pinned document, prompt or workflow text are removed, and so is the one-off
   `.ai/scripts/labels-cutover.sh`. `scripts/__tests__/ci-deploy-gate.test.mjs` stays: it caught a
   real regression (#531).

## Consequences

- No longer enforced by CI: a pull request carrying `do-not-merge`, `blocked`, `qa-failed`, or
  `needs-qa` without `qa-approved` can be merged by hand once the three checks are green. Reading
  the labels before merging is the merger's job, and the merge skills do it.
- A pull request into `develop` can merge with no person in the loop. What stands between it and
  staging is the review `om-pr-autopilot` runs, the label and QA checks in `om-approve-merge-pr`,
  and the three required checks. To stop it, `cez automation pause <id>`, or add `do-not-merge`.
- No longer pinned by a test: the `merge-queue` label on the standing promotion pull request, the
  reconciler call in `.ai/skills/om-review-prs/SKILL.md`, the launchd `__PATH__` instruction, the
  values in `.ai/cezar/config.json`, the step order in the cezar workflows, the e2e artifact policy
  in `ci.yml` and `e2e-webkit.yml`, the absence of a `wranglerVersion` pin, and the squash-on-main
  wording in the approval skill. A change to any of them is caught in review, or not at all.
- The `gate` container on the VPS host now receives no job; retiring it is a host change, outside
  this repository.
- Bringing any of this back is a new ADR, not a revert.

## Amendment (2026-10-01)

The owner retired the `design4pro-agent` account: every agent action runs as `rafalwolak`, and the
pipeline decides its own open questions through specialist sub-agents (`.ai/skills/afk-decide`).
That changes how decision 3 tells pull requests apart, not what it decides:

- **Merge reviewed agent pull requests** swaps its `authors` filter, which named the retired
  account and so never fired, for `rafalwolak`; `merge-queue` is the signal, and dependabot and
  outsider PRs stay out of the unattended merge.
- `implement-ticket` no longer stops at an open PR: its last step runs
  `om-pr-autopilot --allow-merge`, so a ticket goes from `ready-for-agent` to `develop` in one run.
- The promotion PR can no longer be told apart by author. `promote-develop.yml` opens it with
  `promotion` as well as `merge-queue`, every PR automation excludes `promotion`, and
  `om-approve-merge-pr` merges unattended only into `develop`. A person still merges the
  promotion, and spec-only PRs (`om-pr-autopilot` stops them at merge-ready).
- QA below `risk-high` is signed off by the run on a specialist's verdict (`SDLC.md`, QA gate);
  `risk-high` QA stays with the owner.
- The scope guard ADR 0018 placed on the bot's token moves to the cockpit's own token
  (`docs/agents/cezar.md`, Host identity).
- Known gap: both rulesets list the organisation and repository Admin role as `bypass_actors`
  (`bypass_mode: always`), and the owner is an admin, so with one identity a run could push or merge
  past the ruleset. Nothing in the repository closes this: the owner sets the bypass mode to
  `pull_request`, or a supervised run adds a `PreToolUse` hook (a protected path) that blocks
  `gh pr merge` off `develop` and a `git push` to `main` or `develop` while `CEZ_TASK_ID` is set.
