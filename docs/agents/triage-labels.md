# Triage labels

Canonical triage roles mapped onto this repository's existing label set. Do not create new labels for these roles.

| Canonical role  | Label in this repo      |
| --------------- | ----------------------- |
| needs-triage    | `status: pending`       |
| needs-info      | `status: on hold`       |
| ready-for-agent | `ready-for-agent`       |
| ready-for-human | `status: review needed` |
| wontfix         | `status: abandoned`     |

Supporting vocabulary already present and in use: `priority: critical/high/medium/low`, `type: bug/feature/enhancement/maintenance/security/documentation`, `qa`, `qa-failed`, `status: blocked`, and the `wayfinder:*` family (`wayfinder:map`, `wayfinder:grilling`, `wayfinder:prototype`, `wayfinder:research`, `wayfinder:task`) for exploratory mapping efforts.

QA findings from staging are filed as new issues with `qa-failed` (bugs) or `type: enhancement` (taste).

Labels the automation itself reads and writes: `agent-blocked` (sandcastle swaps it in for `ready-for-agent` when an issue exhausts its fix budget - `markBlocked()` in `.sandcastle/main.ts`; a human re-queues it), `visual-change-expected` (declares an intended pixel change so the loop re-records baselines instead of failing the diff - equivalent to a `## Visual change expected` section in the body), and `needs-e2e` (a PR label: runs the CI e2e job on that PR, the escape hatch in `ci.yml`).

Two rules govern where `ready-for-agent` may sit:

- **It is a per-slice gate, never a PRD label.** A PRD is an issue with open sub-issues and is never
  workable on its own; `resolveOnlyIssues` in `.sandcastle/main.ts` expands `--issues <PRD>` to its
  open children and filters those by this label. On a parent the label is not merely inert: it puts
  the PRD into `readyForAgentIds()`, so a bare `pnpm sandcastle` claims and plans the PRD itself.
  `/to-tickets-project` applies it to every ticket it publishes and verifies the wave afterwards.
- **It is orthogonal to `status: blocked`.** `ready-for-agent` says a human specified and cleared the
  slice; `status: blocked` is a human's note that some other issue must land first. Execution order
  comes from the dependency graph the planner builds, not from either label, and the loop never reads
  `status: blocked`. A cleared slice with an open blocker keeps both.

## Automated pre-triage

An open issue that carries `type: bug` or `type: maintenance` and not `ready-for-agent` is pre-triaged by Claude following `.sandcastle/triage-prompt.md` — once per issue, marked by `<!-- sandcastle-triage -->` in the comment (and in the body when promoted):

- `.github/workflows/triage.yml` runs it when such an issue is opened or the label is added (this is how the sandcastle auditor's follow-ups get picked up); `workflow_dispatch` takes one issue number.
- `pnpm sandcastle:triage [n ...]` sweeps the backlog locally in the Docker sandbox.

A third source files into the same queue. `pnpm sandcastle:sentry` (and `.github/workflows/sentry-triage.yml`, weekly) reads Sentry for recurring, high-impact production and staging errors and files the ones that clear its thresholds as `type: bug` + `status: pending` — never `ready-for-agent`, because it has reproduced nothing and promotion is earned by a reproduction. Each carries a `<!-- sentry-issue: SHORT-ID -->` marker in the body, and dedup is keyed on that across **open and closed** issues: a closed ticket means the bug was fixed, and a re-file would be the routine's worst failure. A recurrence more than a day after the fix shipped is filed as a separate regression ticket rather than reopening the original, so the record of the first attempt survives. It is report-only by default locally; `--file-issues` writes. Thresholds live in `.sandcastle/sentry-triage/policy.ts` — one diffable file, which is the first lever if it gets noisy.

The claim is reproduced at HEAD. A confirmed, non-redundant finding with a fix direction settled by SPEC/ADRs is **promoted automatically**: an `## Agent Brief` (Owned paths, Definition of Done, Verification) is appended to the body, `ready-for-agent` replaces `status: pending`, and the notes say so — remove the label to hold it. Refuted, insufficient, redundant or judgment-heavy findings get triage notes with the recommended state named, never applied; decide those with `/triage` (ADR 0006).
