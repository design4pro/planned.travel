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

## Automated pre-triage

An open issue that carries `type: bug` or `type: maintenance` and not `ready-for-agent` is pre-triaged by Claude following `.sandcastle/triage-prompt.md` — once per issue, marked by `<!-- sandcastle-triage -->` in the comment (and in the body when promoted):

- `.github/workflows/triage.yml` runs it when such an issue is opened or the label is added (this is how the sandcastle auditor's follow-ups get picked up); `workflow_dispatch` takes one issue number.
- `pnpm sandcastle:triage [n ...]` sweeps the backlog locally in the Docker sandbox.

The claim is reproduced at HEAD. A confirmed, non-redundant finding with a fix direction settled by SPEC/ADRs is **promoted automatically**: an `## Agent Brief` (Owned paths, Definition of Done, Verification) is appended to the body, `ready-for-agent` replaces `status: pending`, and the notes say so — remove the label to hold it. Refuted, insufficient, redundant or judgment-heavy findings get triage notes with the recommended state named, never applied; decide those with `/triage` (ADR 0006).
