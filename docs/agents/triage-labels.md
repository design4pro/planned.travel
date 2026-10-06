# Labels

The label vocabulary is the Open Mercato SDLC taxonomy in `SDLC.md` (ADR 0018), read by every
`om-*` skill from `.ai/agentic.config.json`, plus `do-not-close`. It is the whole vocabulary: no
label says an issue is ready, and no label starts a run (ADR 0032). This page adds only what is
specific to this repository: who writes each group, the holds, the flow, and the map from the
retired vocabularies.

## Vocabulary

| Group    | Labels                                                                                     | Written by                                                                                               |
| -------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Pipeline | `review`, `changes-requested`, `qa`, `qa-failed`, `merge-queue`, `blocked`, `do-not-merge` | skills move the first five on PRs, only a QA reviewer sets `qa`; the holds are below                     |
| Category | `bug`, `feature`, `refactor`, `security`, `dependencies`, `documentation`                  | issue forms, Sentry sweep, Dependabot (`dependencies`), `om-auto-manage-issues`, `afk-triage`, PR skills |
| Meta     | `needs-qa`, `skip-qa`, `qa-approved`, `qa-self-verified`, `in-progress`, `ci-monitoring`   | skills; `qa-approved` by the unattended sign-off (a specialist panel), `risk-high` included (ADR 0035)   |
| Priority | `priority-low`, `priority-medium`, `priority-high`, `priority-extreme`                     | issue grooming, Sentry sweep (`priority-high`), PR skills                                                |
| Risk     | `risk-low`, `risk-medium`, `risk-high`                                                     | issue grooming, PR skills                                                                                |
| Outside  | `do-not-close`                                                                             | humans; housekeeping never closes such an issue                                                          |

There is no `status:` axis and no intake ladder. Where an open issue stands is computed by
`node .ai/scripts/backlog-status.mjs` from what is already on it: the holds, the claim, an open PR,
its `Blocked by` list, its author and its Agent Brief (`SDLC.md` § Readiness). `in-progress` on an
issue or PR is the claim protocol of `SDLC.md` (assignee + label + 🤖 comment); a claim that
outlives its run is reported by `om-review-prs`, not repaired by a sweeper.

## Holds

- `blocked` - nothing starts while it is there. A person sets it, or a skill does with a comment that
  starts `🤖 HUMAN-ONLY:` and names the one thing a person must do: `afk-triage` for what only the
  reporter or the owner can supply, `implement-ticket` when the security and tenancy specialist does
  not approve `risk-high` work. A person removes that one, and the issue, still without an Agent Brief,
  is triaged again by the Reconciler. A `blocked` an agent set without `HUMAN-ONLY:` is offered
  to `afk-unblock`, which lifts it on a specialist's verdict (`🤖 RESOLVED:`) or marks it
  `HUMAN-ONLY:`; a hold a person set or commented on last is never lifted by an agent (ADR 0033).
- `do-not-merge` - a PR never merges unattended while it is there. The `develop` -> `main`
  promotion carries it from the moment `.github/workflows/promote-develop.yml` opens it, and every
  PR automation excludes it; `set_pipeline_label` never removes it (`.ai/trackers/github.md`).
- `do-not-close` - housekeeping never closes the issue, and no automation starts on it.

## Flow

```
issue form ─► category;  Sentry sweep ─► bug + priority-high (EXTERNAL: a person reads it first)
      ─(Reconciler: backlog-status.mjs --plan, issue by a maintainer)─► triage
            afk-triage: + category, priority, risk, Agent Brief + SLC scope check
                  ├─► Agent Brief ─► ready once its Blocked by issues close
                  └─► blocked + 🤖 HUMAN-ONLY comment ─► a person answers and removes blocked ─► triage again
agent-set blocked or STOP ─(Reconciler: backlog-status.mjs --plan)─► unblock ─► 🤖 RESOLVED (lifted) | 🤖 HUMAN-ONLY
plan stage nothing covers ─(Reconciler)─► plan-to-spec ─► specialist panel ─► spec PR ─► merged by the pipeline
                                                        └─► already delivered ─► `Delivered:` line in the plan (docs-only PR)
merged spec ─(Reconciler)─► afk-to-tickets: tickets whose body is their Agent Brief

ready issue ─(Reconciler: backlog-status.mjs --next, WIP limit 3 PRs waiting for a person)─► implement-ticket
      ─► PR (review, category, needs-qa|skip-qa, priority, risk) ─► om-pr-autopilot --allow-merge ─► develop

a person, from the cockpit, on any issue: issue-groom · issue-autofix · spec · implement-ticket · triage
PR opened by a human ─(pull_request.opened: Autopilot new pull requests)─► review / fix / QA / merge into develop
agent PR in merge-queue ─(pull_request.reviewed: Merge reviewed agent pull requests)─► om-pr-autopilot --allow-merge ─► merged into develop
housekeeping (no CEZAR automation; launchd runs it 07:30/12:30/17:30 on weekdays): om-review-prs, om-merge-buddy (report), om-close-fixed-issues
      ─► issue closed when its `Closes #n` PR merged into develop
develop ─(promote-develop.yml)─► promotion PR to main, do-not-merge ─► merged by the owner
```

## Map from the retired vocabularies

| Retired                                                 | Now                                                  |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `status: triage`, `needs-info`, `backlog`, `ready`      | no label; the groom comment says what is missing     |
| `status: queued`, `status: needs-human`                 | `blocked`                                            |
| `status: in-progress`                                   | `in-progress`                                        |
| `status: review`                                        | `review` on the PR                                   |
| `run: triage`                                           | none; the Reconciler triages it (ADR 0033)           |
| `run: implement`                                        | none; the Reconciler implements it (ADR 0033)        |
| `type: bug` / `feature` / `enhancement` / `maintenance` | `bug` / `feature` / `feature` / `refactor`           |
| `prd`, `auto-advance`, `agent-pr`                       | gone (a spec file decomposes; PRs carry SDLC labels) |
| `agent-docs`                                            | `documentation`                                      |
| `needs-e2e`                                             | gone; the journeys run on every PR (ADR 0016, #552)  |
| `needs-triage`, `ready-for-agent`                       | none; an Agent Brief makes an issue ready (ADR 0032) |
| `needs-info`, `ready-for-human`                         | `blocked` + a 🤖 comment (ADR 0032)                  |
| `groom`, `autofix`, `spec`                              | none; a workflow started from the cockpit (ADR 0032) |
| `promotion`                                             | `do-not-merge` (ADR 0032)                            |

Snapshots of the labels and open issues before the one-off cutover ran live under
`docs/agents/migration/`.

`needs-e2e` was deleted on 2026-09-17, later than the rest and for its own reason. It was never a
state: it was `ci.yml`'s escape hatch from the days when the e2e suite was demoted to a post-merge
net because it cost ~60 min of runner per event. ADR 0016 put the journeys back on every pull
request in two shards, and #552 removed the last condition that read the label — but the label
itself outlived both, still described on GitHub as switching on a matrix that no longer consults it.
Two merged pull requests carried it, #128 and #84, and deletion strips it from their history as
well; `docs/agents/migration/labels-2026-09-17.json`, `issues-2026-09-17.json` and
`prs-2026-09-17.json` are the snapshot taken immediately before, and the PR snapshot exists
precisely because this was a pull-request label and the earlier snapshots only covered issues.
Nothing gates the journeys now: they run on every PR, a documentation-only diff skips them on the
`scope` job's word, and WebKit runs nightly (ADR 0022).

The retired names are gone from GitHub as of 2026-09-08: the eight `status: *` labels, `prd`,
`auto-advance` and `agent-pr` were deleted once the live automations
(docs/agents/cezar-automations.json) no longer read them, leaving the 35 labels of the table above
and nothing else. Deleting a label strips it from history too, so a closed issue or a merged PR
that carried one now shows one label fewer; `docs/agents/migration/labels-2026-09-08.json` and
`issues-2026-09-08.json` are the snapshot taken immediately before. The four superseded skills
(`triage-ticket`, `plan-feature`, `plan-area`, `implement-ticket`) and their `.ai/cezar/workflows/`
YAMLs spelled the old vocabulary; PR C deleted them, so nothing in the tree reads a retired name.

## Sources of issues

- **People**, through the issue forms (`.github/ISSUE_TEMPLATE/`); blank issues are off so every
  issue enters with a category.
- **Sentry** findings (`.github/workflows/sentry-triage.yml`, ADR 0008 as amended by ADR 0018) as
  `bug` + `priority-high` with `<!-- sentry-issue: SHORT-ID -->` in the body; dedup is keyed on the
  marker across open and closed issues. The body quotes production error data, so no automation
  grooms one and the Reconciler never starts one: a person reads it first (ADR 0032).
- **Follow-ups** from `om-followup-issue-from-pr`, `om-review-prs`, `afk-triage` (a split) and
  `afk-architecture-review`, triaged like any other.
