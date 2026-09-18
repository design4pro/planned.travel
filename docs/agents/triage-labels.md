# Labels

The label vocabulary is the SDLC taxonomy in `SDLC.md` (ADR 0018), read by every `om-*` skill from
`.ai/agentic.config.json`. This page adds only what is specific to this repository: the four
command labels, the intake ladder, the human holds, the escape hatch, and the map from the retired
ADR 0015 vocabulary.

Two vocabularies start work here and they are not the same thing. A **command** is a human's lever:
adding it runs one skill now, and the run removes it. An **intake** label is the pipeline's own
state for an issue: it says who acts next, and two of the four also start a run. `SDLC.md`
§ Intake labels and § Trigger labels are the contract; this page is the local map.

## Vocabulary

| Group    | Labels                                                                                     | Written by                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Pipeline | `review`, `changes-requested`, `qa`, `qa-failed`, `merge-queue`, `blocked`, `do-not-merge` | PRs only; skills move the first five, humans set `blocked` and `do-not-merge`, only a QA reviewer sets `qa` |
| Category | `bug`, `feature`, `refactor`, `security`, `dependencies`, `documentation`                  | issue forms, Sentry sweep, `om-auto-manage-issues`, PR skills                                               |
| Meta     | `needs-qa`, `skip-qa`, `qa-approved`, `qa-self-verified`, `in-progress`, `ci-monitoring`   | skills; `qa-approved` by a human (or self-QA with evidence)                                                 |
| Priority | `priority-low`, `priority-medium`, `priority-high`, `priority-extreme`                     | issue grooming, Sentry sweep (`priority-high`), PR skills                                                   |
| Risk     | `risk-low`, `risk-medium`, `risk-high`                                                     | issue grooming, PR skills                                                                                   |
| Intake   | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`                         | issues only, one at a time; humans and `afk-architecture-review` add `needs-triage`, `afk-triage` the rest  |
| Outside  | `do-not-close`                                                                             | humans; housekeeping never closes such an issue                                                             |
| Command  | `groom`, `autofix`, `spec`, `review-threads`                                               | humans, except `review-threads` (the review job); the run consumes it in its claim step                     |

There is no `status:` axis. An open issue carries an **intake** label once it has been groomed, and
the state of work in flight is the pipeline label on its PR; an open issue with neither, and without
`in-progress` or `blocked`, is the ungroomed backlog. `in-progress` on an issue or PR is the
claim protocol of `SDLC.md` (assignee + label + 🤖 comment); a claim that outlives its run is
reported by `om-review-prs`, not repaired by a sweeper.

## Intake

An intake label is a state, and it is the ladder the pipeline walks by itself.

- `needs-triage` - the issue is groomed and passes the Definition of Ready, and nobody has decided
  yet whether an agent may take it. **Today a maintainer adds it, and `afk-architecture-review`
  adds it to its own `Strong` candidates** - nothing else does, which is why this ladder has
  launched almost nothing: grooming records `READY_STATUS` and stops. The edge that would make
  the loop self-feeding - a groom ending `READY_STATUS=ready` applies `needs-triage` as its last
  mutation - is designed and not yet wired (cezar `.ai/specs/2026-09-17-afk-intake-bridge.md`).
  **Triage new issues** reacts to the label and runs `afk-triage`.
- `needs-info` - waiting on the reporter. `afk-triage` sets it; a human moves it back to
  `needs-triage` once the answer lands.
- `ready-for-agent` - briefed, scoped by the SLC rule, and safe to implement unattended.
  **Implement ready-for-agent issues** reacts to it and runs `implement-ticket`. The automation's
  `excludeLabels` stands down on `risk-high`, `security`, `blocked`, `do-not-merge`, `needs-info`,
  `ready-for-human` and `in-progress`, so the reserved categories are unreachable from this trigger.
- `ready-for-human` - briefed, but it needs a person: security, `risk-high`, a spec, a duplicate, a
  decline, or a judgement call. Nothing reacts to it; it is a queue a human reads.

Exactly one at a time, and re-triaging a decided issue means removing `ready-for-agent` or
`ready-for-human` first, then adding `needs-triage`.

## Commands

A command is not a state. Adding one starts a cezar run (docs/agents/cezar-automations.json); the
skill's repo-local override removes it first, so a command still present is a run nobody took.

- `groom` - run `om-auto-manage-issues` on this issue (labels, Definition of Ready check,
  implementation notes). An issue a maintainer opens is groomed once without it; an issue from
  anyone else waits for a maintainer to add it, because the groom run reads the issue body as its
  prompt with an unrestricted shell. The Sentry sweep files with it.
- `autofix` - `om-auto-fix-issue`: a bug goes verify → root cause → fix → PR → review → QA (UI);
  a feature goes spec → implement. Excluded while `in-progress`, `blocked`, `do-not-merge` or `spec`.
- `spec` - `om-auto-write-spec` on a `feature` issue: the spec lands in `.ai/specs/` on a
  design-only PR. Implementation is a separate, human-started run once that PR merges.
- `review-threads` - the one command on a PR, and the one no human adds: the `claude-review` job
  applies it when it leaves review threads the merge gate will hold, and `om-auto-fix-pr` clears
  them. Once per head SHA, never while `in-progress`, `blocked` or `do-not-merge`
  (docs/agents/cezar.md).

## Flow

```
issue form ─► category;  Sentry sweep ─► bug + priority-high + groom
      ─(issue.opened by a maintainer, or the groom label)─► + priority, risk, Definition of Ready comment, implementation notes

  the ladder (today: a human adds needs-triage; the dashed edge is designed, not wired):
      groom ends READY_STATUS=ready ┄┄► needs-triage  ◄── human
            ─(Triage new issues)─► afk-triage: Agent Brief + SLC scope check
                  ├─► needs-info      ─► reporter answers ─► human: back to needs-triage
                  ├─► ready-for-human ─► a person picks it up (security, risk-high, spec, judgement)
                  └─► ready-for-agent ─(Implement ready-for-agent issues)─► implement-ticket
                              ─► PR (review, category, needs-qa|skip-qa, priority, risk) ─► human review

  the express lane (a human labels one issue):
human: autofix ─► in-progress ─► PR (review, category, needs-qa|skip-qa, priority, risk) ─► human review
human: spec (feature) ─► spec PR (documentation, skip-qa, Refs #n) ─► human merges ─► the same issue is the implementation ticket
      ─► human: autofix on it ─► om-auto-fix-issue's feature route ─► om-auto-implement-spec (cockpit: implement-spec is the same skill by hand)
PR opened by a human ─(pull_request.opened: Autopilot new pull requests)─► review / fix / QA, never merge
claude-review leaves open threads ─► review-threads ─(Resolve blocking review threads)─► om-auto-fix-pr replies and resolves
housekeeping (NO automation - started by hand): om-review-prs, om-merge-buddy (report), om-close-fixed-issues
      ─► issue closed when its `Closes #n` PR merged into develop
human: om-approve-merge-pr from the cockpit; needs-qa merges only with qa-approved
```

## Map from the ADR 0015 vocabulary

| Retired                                                 | Now                                                  |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `status: triage`, `needs-info`, `backlog`, `ready`      | no label; the groom comment says what is missing     |
| `status: queued`, `status: needs-human`                 | `blocked`                                            |
| `status: in-progress`                                   | `in-progress`                                        |
| `status: review`                                        | `review` on the PR                                   |
| `run: triage`                                           | `groom`                                              |
| `run: implement`                                        | `autofix`                                            |
| `type: bug` / `feature` / `enhancement` / `maintenance` | `bug` / `feature` / `feature` / `refactor`           |
| `prd`, `auto-advance`, `agent-pr`                       | gone (a spec file decomposes; PRs carry SDLC labels) |
| `agent-docs`                                            | `documentation`                                      |
| `needs-e2e`                                             | gone; the journeys run on every PR (ADR 0016, #552)  |

The cutover script is `.ai/scripts/labels-cutover.sh` (dry-run by default); snapshots of the
labels and open issues before it ran live under `docs/agents/migration/`.

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
  `bug` + `priority-high` + `groom` with `<!-- sentry-issue: SHORT-ID -->` in the body; dedup is keyed on the
  marker across open and closed issues. Never `autofix`: a human decides.
- **Follow-ups** from `om-followup-issue-from-pr` and `om-review-prs`, groomed like any other.
