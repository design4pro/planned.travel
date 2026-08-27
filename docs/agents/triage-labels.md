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
