# 0033. The Reconciler starts the work

Status: accepted
Date: 2026-10-02
Amends: ADR 0032 (the schedule that starts implementation, the WIP limit, and who clears a hold),
ADR 0031 (a spec PR `afk-plan-to-spec` wrote merges without a person; every other spec PR is still merged by a person).

## Context

After ADR 0032 the pipeline had one clock per job - an implement run every two hours, a slice run on
weekdays - and one rule for everything else: a person notices. That left five places where work stopped
and nothing started it again:

- **The cap counted the wrong thing.** Three open agent PRs stopped `--next`, but most agent PRs are on
  their way to `om-pr-autopilot --allow-merge` and need nobody. A queue that the pipeline drains itself
  held back the next implementation, while the PRs that really wait for a person (`needs-qa` with no
  `qa-approved`, `risk-high`) were the same count as any other.
- **A hold had no exit.** An agent put `blocked` on an issue, or `implement-ticket` left a `STOP:`, and
  the only way out was a person reading a comment. `SDLC.md` § Unattended decisions already says a state
  with that exit is a defect; `afk-decide` handled it for questions asked mid-run but not for the ones
  already left on the tracker.
- **A merged spec could wait for nothing.** `afk-to-tickets` looked at specs added in the last
  fourteen days, so one that merged just after a quiet fortnight was never sliced.
- **A plan stage had no spec.** `docs/plans/` is the backlog source, and nothing turned a stage into a
  design: a person started `spec` by hand, one feature at a time.
- **A run that failed stayed failed.** A transient registry error in a leading `pnpm install`, an OAuth
  refresh, a provider's usage limit: the run ended `failed` and waited for a person to press Continue.

The cause is the same each time: the work is the difference between what the repository wants and what
exists, and a trigger per event cannot see a difference.

## Decision

1. **A level-triggered Reconciler starts the work.** A cron on the cezar host runs every ten minutes. It
   starts something only when there is something to do and a free `maxParallel` slot, and it repairs a
   failed run by continuing it. It decides nothing itself: it asks
   `node .ai/scripts/backlog-status.mjs --plan`, which prints `{ wip, actions }` with at most one action
   per kind - implement, unblock, triage, slice, write-spec, in that order - each carrying the workflow
   and the task text to send. No Cezar engine change: the cron, the cockpit API, and the scripts and
   workflows in this repository are all there is. The three schedules in
   `docs/agents/cezar-automations.json` (implement, slice and the issue pair) are left as they are
   until the Reconciler has run alone for a while.
   Amended 2026-10-04: `--plan` ranks up to three candidates each of implement, unblock and triage, best first, and
   keeps at most one of slice and write-spec. On 2026-10-04 the single implement candidate sat in the six-hour
   cooldown after a finished run while a ready issue behind it never started; the Reconciler now hands the turn to
   the next candidate of a kind when the first cannot start (design4pro/cezar#55).
2. **WIP counts what only a person can clear.** Open PRs by a trusted author, except the `do-not-merge`
   promotion, that are `needs-qa` without `qa-approved`, or `risk-high`, `security` or `blocked`, or
   `changes-requested` and untouched for 24 hours (an autopilot that stopped there is parked on a decision
   only a person takes; a fresh one is a run still fixing the review). The limit stays three. A PR the
   pipeline merges by itself is not inventory.
3. **An agent lifts what an agent set, on a specialist's verdict.** `afk-unblock` takes a `blocked`
   hold, or an unanswered not-ready or `STOP:` comment, and asks an independent specialist
   (`afk-decide`) whether it can be lifted; it lifts it with a `🤖 RESOLVED:` comment, which
   `backlog-status.mjs` reads as the answer, or hands it back with `🤖 HUMAN-ONLY:` and leaves it.
   What stays with a person is what `afk-decide` § 5 lists, any hold a person set or took over, and
   everything marked `HUMAN-ONLY:`. Whoever sets a label is not recoverable - every run acts as the
   maintainer - so the evidence of ownership is the comment: a hold whose last word is a person's is
   theirs, a hold no comment explains is handed back with `HUMAN-ONLY:` rather than lifted, and
   `do-not-merge` and `do-not-close` are never offered. `afk-triage` and `afk-decide` write
   `🤖 HUMAN-ONLY:` on every hold that is a person's, so the Reconciler does not spend a run on it.
4. **An agent writes the spec for a plan stage, and a panel reviews it.** `afk-plan-to-spec` takes the
   first stage of `docs/plans/` that no spec and no issue mentions and that its plan does not mark
   `Delivered:`, verifies it against the code, settles
   every open question through a specialist, writes a `ready` spec, and has a panel (product owner,
   software architect, and the security, accessibility, UX and configuration specialists where the spec
   touches them) approve it before the PR is opened. The pipeline merges the design-only PR once CI is
   green. The spec PR of the `om-auto-write-spec` flow and the one `implement-ticket` writes for a spec task
   keep their human merge: neither carries a `Plan` row. A spec so written has no issue yet, so the spec registry accepts a `Plan` row
   (`<stage> (docs/plans/<file>.md)`) in place of the `Issue` a `ready` spec otherwise needs. The next tick
   slices it. A stage the code already delivers is no spec: the skill writes `Delivered: <date> - <evidence>`
   under its heading, and under every other delivered uncovered stage of the same plan file, on a docs-only
   PR, and `--plan` treats a marked stage as covered. A stage the skill can only end on would stay the first
   candidate, be named every six hours (the Reconciler's cooldown after a finished run) and keep every stage
   behind it from ever being reached. A plan the `docs/plans/README.md` table lists as migrated is skipped
   by `--plan` itself, so it needs no mark and takes no edit. Until the docs PR merges, its stages are
   still uncovered on the base branch, so `write-spec` also waits while an open PR comes from a branch
   `docs/plan-delivered-*`, as it does while a PR adds a spec; the prefix names that one PR, so a person's
   edit to `docs/plans/` does not stall the queue.
5. **Slicing has no age window.** The oldest `ready` spec directly in `.ai/specs/` that no issue, open or
   closed, opens with `Spec: <path>` is sliced.
6. **The retired agent account is trusted.** `design4pro-agent` can file nothing new (ADR 0031,
   amendment of 2026-10-01), and every issue it filed came out of an agent run the maintainer launched.
   Its issues count as the maintainer's for readiness, triage and WIP.
7. **The leading install retries.** `.ai/scripts/bootstrap.sh` runs `pnpm install --frozen-lockfile` up
   to three times, thirty and sixty seconds apart, and is the step every workflow that installs
   dependencies calls. A check step cannot retry itself, so one registry error used to fail a run before
   any agent started.

## Consequences

- A merged spec is the product of one agent and a panel, with no person reading it before it lands. It is
  design-only and changes no behaviour, the panel's verdicts are Resolved assumptions rows in the PR and
  the spec, and overturning one is an ordinary review finding; a panel that does not approve leaves the PR
  `blocked` for a person, and a security reviewer that does not approve always does.
- Only a spec `afk-plan-to-spec` wrote merges by itself (a `Plan` row, panel verdicts in the PR body). The
  spec task `implement-ticket` writes for a request too large for a few slices has an `Issue` row and no
  `Plan` row, so its PR still ends at merge-ready and a person merges it; while it is open it also holds
  `write-spec` (`addsSpec`), like any open PR that adds a spec.
- A hold lifted wrongly costs one `implement-ticket` run that ends in `STOP:` or in review. `risk-high`
  and `security` work still needs the security and tenancy specialist's approving verdict before any run
  claims it, whoever lifted the hold.
- WIP no longer bounds the number of open agent PRs; `maxParallel` and the free-slot rule do. A burst
  of low-risk PRs merges as fast as CI allows.
- `.ai/specs/README.md` does not record the parent issue a spec was sliced into. The next slice step
  finds it by its first line, `Spec: <path>`, never by the spec's own `Issue` row.
- A plan stage id is not unique: `13-S1` to `13-S4` are in two files, so a mention of one of them covers
  the stage only when it also names the plan file. A migrated plan is frozen, and `afk-plan-to-spec`
  refuses its stages.
- Until the three schedules (implement, slice and the issue pair) are removed, `implement-ticket`
  and `spec-to-tickets` can be started by a schedule and by the Reconciler. Both check what holds an issue before they claim it, and the
  Reconciler drops a candidate a live run already holds, so the worst case is a run that stops.
  Amended 2026-10-03: the implement and slice schedules are removed from `docs/agents/cezar-automations.json`, and the
  two issue-event automations that ran `issue-groom` are kept with `"enabled": false` only for their `authors` gates,
  which `backlog-status.mjs` and `afk-unblock` read as the trusted authors, so the trust gate is unchanged.
