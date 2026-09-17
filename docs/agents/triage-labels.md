# Labels

The label vocabulary is the SDLC taxonomy in `SDLC.md` (ADR 0018), read by every `om-*` skill from
`.ai/agentic.config.json`. This page adds only what is specific to this repository: the three
command labels, the human holds, the escape hatch, and the map from the retired ADR 0015 vocabulary.

## Vocabulary

| Group    | Labels                                                                                     | Written by                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Pipeline | `review`, `changes-requested`, `qa`, `qa-failed`, `merge-queue`, `blocked`, `do-not-merge` | PRs only; skills move the first five, humans set `blocked` and `do-not-merge`, only a QA reviewer sets `qa` |
| Category | `bug`, `feature`, `refactor`, `security`, `dependencies`, `documentation`                  | issue forms, Sentry sweep, `om-auto-manage-issues`, PR skills                                               |
| Meta     | `needs-qa`, `skip-qa`, `qa-approved`, `qa-self-verified`, `in-progress`, `ci-monitoring`   | skills; `qa-approved` by a human (or self-QA with evidence)                                                 |
| Priority | `priority-low`, `priority-medium`, `priority-high`, `priority-extreme`                     | issue grooming, Sentry sweep (`priority-high`), PR skills                                                   |
| Risk     | `risk-low`, `risk-medium`, `risk-high`                                                     | issue grooming, PR skills                                                                                   |
| Hold     | `do-not-close`                                                                             | humans; housekeeping never closes such an issue                                                             |
| Command  | `groom`, `autofix`, `spec`, `review-threads`                                               | humans, except `review-threads` (the review job); the run removes it as its first mutation                  |
| Outside  | `needs-e2e`                                                                                | humans on a PR: ci.yml runs the full e2e matrix (ADR 0016)                                                  |

There is no `status:` axis. An open issue without `in-progress` or `blocked` is the backlog; the
state of work in flight is the pipeline label on its PR. `in-progress` on an issue or PR is the
claim protocol of `SDLC.md` (assignee + label + 🤖 comment); a claim that outlives its run is
reported by `om-review-prs`, not repaired by a sweeper.

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
human: autofix ─► in-progress ─► PR (review, category, needs-qa|skip-qa, priority, risk) ─► human review
human: spec (feature) ─► spec PR (documentation, skip-qa, Refs #n) ─► human merges ─► the same issue is the implementation ticket
      ─► human: autofix on it ─► om-auto-fix-issue's feature route ─► om-auto-implement-spec (cockpit: implement-spec is the same skill by hand)
PR opened by a human ─(pull_request.opened: Autopilot new pull requests)─► review / fix / QA, never merge
claude-review leaves open threads ─► review-threads ─(Resolve blocking review threads)─► om-auto-fix-pr replies and resolves
housekeeping (07:00, 12:00, 17:00 weekdays): om-review-prs, om-merge-buddy (report), om-close-fixed-issues
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

The cutover script is `.ai/scripts/labels-cutover.sh` (dry-run by default); snapshots of the
labels and open issues before it ran live under `docs/agents/migration/`.

The retired names are gone from GitHub as of 2026-09-08: the eight `status: *` labels, `prd`,
`auto-advance` and `agent-pr` were deleted once the live automations
(docs/agents/cezar-automations.json) no longer read them, leaving the 32 labels of the table above
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
