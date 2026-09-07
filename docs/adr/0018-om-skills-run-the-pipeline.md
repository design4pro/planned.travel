# 0018. The om-* skills run the pipeline; the repository stops orchestrating itself

Status: accepted
Date: 2026-09-06
Supersedes: ADR 0015 (the label protocol), ADR 0006 (auto-promotion), ADR 0017 (the plan-area workflow).
Amends: ADR 0014 (cezar stays, its workflows change), ADR 0008 (the labels a Sentry finding carries), ADR 0016 (who reads the blind pair).

## Context

ADR 0014 replaced sandcastle with cezar and kept everything around it in the repository: three
process skills (`triage-ticket`, `plan-feature`, `implement-ticket`, then `plan-area` in ADR
0017), twenty-three scripts under `scripts/agent/`, a sweeper on launchd with ten invariants, a
closed vocabulary of nineteen labels (ADR 0015), body schemas (`ticket/v2`, `spec/v1`, `prd/v1`),
a PRD with native sub-issues and `blocked_by`, and three cezar workflows whose agent steps reach
GitHub only through those scripts behind a `bashAllowlist`. It works, and it is ours alone: every
rule is enforced by code only this repository runs, every improvement is ours to write, and a
change to how work flows is a change to shell scripts nobody else reviews.

Meanwhile the thirty-seven `om-*` skills from `open-mercato/skills` were installed here and never
configured (dangling symlinks, no `.ai/agentic.config.json`). They encode the same shape of
process - claim, isolated worktree, validation gate, review loop, QA gate, housekeeping - as
versioned playbooks that read one config file, one tracker descriptor and three documents at the
repo root (`SDLC.md`, `CODE_REVIEW.md`, `BACKWARD_COMPATIBILITY.md`), and cezar's own automations
and workflow builder are written against them. The question is not whether the two pipelines can
coexist; PR A (`feat/om-pipeline-foundations`) showed they can. It is which one the repository
develops with.

## Decision

**Development runs on the `om-*` skills and cezar automations, and on nothing the repository
orchestrates itself.** In three pull requests: the foundations (config, descriptors, runtime
documents, test-env scripts, overrides, hooks) are additive and already merged with PR A; this
ADR ships the cutover (PR B); the old pipeline is deleted once the new one has closed a real issue
end to end (PR C).

- **One config, one descriptor, three documents.** `.ai/agentic.config.json` is the authority for
  base branch (`develop`, never `auto`: the default branch is `main` and `om-close-fixed-issues`
  judges "merged into base" by this key), validation commands, label taxonomy, QA gate and paths.
  Every skill reaches GitHub through `.ai/trackers/github.md` and the browser through
  `.ai/browsers/playwright.md`. `SDLC.md` is the label authority and the Definition of Ready;
  `CODE_REVIEW.md` carries the blocker floor (suppressions, skipped or deleted tests, generated
  files, the pinned stack) and the layering contract; `BACKWARD_COMPATIBILITY.md` names the
  protected surfaces. Repo specifics that a skill must honour live in `.ai/skills/om-<name>/`
  as extensions; an extension can never relax a skill's safety rules.
- **Labels are the SDLC taxonomy, plus three commands.** Pipeline (`review`,
  `changes-requested`, `qa`, `qa-failed`, `merge-queue`, `blocked`, `do-not-merge`), category
  (`bug`, `feature`, `refactor`, `security`, `dependencies`, `documentation`), meta (`needs-qa`,
  `skip-qa`, `qa-approved`, `qa-self-verified`, `in-progress`, `ci-monitoring`), one `priority-*`,
  one `risk-*`, and `do-not-close` for a human hold. Three labels are commands a human gives and
  the run consumes as its first mutation: `groom` (re-run the issue manager), `autofix` (fix or
  implement this issue), `spec` (write the spec for this feature). A command still on an issue is
  a command nobody took. There is no `status:` axis: an unlabeled open issue is the backlog,
  `in-progress` is the claim, `blocked` is the human hold, and a PR's pipeline label is the only
  "review" state. `needs-e2e` stays outside the taxonomy as ci.yml's escape hatch.
- **Specs are files, one PR per spec.** A feature is specified in `.ai/specs/<date>-<slug>.md` on
  a design-only PR (`spec/<slug>`, `documentation`, `skip-qa`) that a human merges, then built on
  one implementation PR by `om-auto-implement-spec` (the loop variant past twenty steps). The PRD
  as a parent issue, `ticket/v2` sub-issues, native `blocked_by` and `auto-advance` are given up:
  decomposition happens inside the spec and the run's `PLAN.md`, not in the tracker.
- **Cezar workflows call the skills as slash commands** (`prompt: '/om-… {{task}}'`, never
  `skill:`, because cezar resolves `.ai/skills/<name>` before `.claude/skills/<name>` and would
  load the thin override alone), with no `bashAllowlist`: the tracker descriptor is shell
  functions and `jq`, and a prefix allowlist would silently drop every label mutation. The gate
  is the hooks in `.claude/hooks/` (destructive git, environment dumps, the pinned stack,
  protected paths, secrets), a fine-grained PAT without the Workflows and Administration scopes
  (held by the dedicated `design4pro-agent` account and reached through `GH_CONFIG_DIR` in the
  cockpit's service environment; amended 2026-09-07, `docs/agents/cezar.md`, Host identity),
  one worktree per run, and `maxParallel: 2`. The eight workflows: `issue-groom`, `issue-autofix`,
  `spec`, `implement-spec`, `pr-autopilot`, `pr-review`, `housekeeping`, `brainstorm`.
- **Automations are the schedule; launchd is the clock.** `issue.opened` by a maintainer grooms
  the issue; `issue.labeled` with `groom`, `autofix` or `spec` starts the matching run;
  `pull_request.opened` by a human maintainer starts `pr-autopilot` without `--allow-merge`.
  Every trigger is gated on who can produce it: an author filter on the open events, and on the
  label events the fact that only a collaborator can set a label. An issue from anyone else is
  data until a maintainer adds `groom`, because the run's prompt is the issue body and its agent
  step holds an unrestricted shell. Cezar has no cron, so
  `housekeeping` (`om-review-prs`, `om-merge-buddy`, `om-close-fixed-issues`) is a POST to the
  cockpit from launchd three times a day on weekdays. The sweeper and its invariants retire.
- **Nothing autonomous merges, and no automation approves QA.** `om-approve-merge-pr` runs from
  the cockpit by a human. The maintainer is the QA reviewer; `om-auto-qa-pr` supplies the blind
  A/B pair from `node scripts/visual/capture.mjs` (ADR 0016) and never `qa-approved`.
- **`Closes #n` returns.** GitHub ignores it on merge into `develop`; `om-close-fixed-issues` in
  housekeeping reads it and closes the issue. Spec-only and partial PRs say `Refs #n`.
- **Sentry findings** enter as `bug` + `priority-high` + `groom` (ADR 0008 amended; the sweep
  files as the Actions bot, so the label is what starts its groom run), and wait for a human's
  `autofix`. Nothing auto-promotes: ADR 0006's "reproduce, then
  ready" becomes the groom run's read-only implementation notes and a human's decision.
- **An area still in `docs/plans/`** goes through `spec` on its issue with the plan file named in
  the body, once `plan-area` retires with the scripts it calls (PR C); the panel of project
  subagents from ADR 0017 is not carried over.

## Alternatives

- Keep the repository's pipeline and only vendor the skills for hand use. Rejected: two label
  vocabularies and two claim protocols on one tracker, and every om skill's label mutation would
  either be blocked by the hook or contradict the sweeper.
- Wrap each om skill in a `bashAllowlist` of the exact commands the tracker descriptor runs.
  Rejected: the descriptor is functions, pipes and process substitution; the allowlist matches
  command prefixes and would pass or fail by accident.
- Load the skills from `skillsRepos` at run time instead of vendoring them. Rejected: chained
  skills run through the Skill tool in a fresh headless worktree and must be on disk and in git;
  the pin (`skills-lock.json`, `skillsRepos[0].ref`) is one SHA in both places.

## Consequences

What the repository stops owning: twenty-three scripts, three process skills and a panel, a
sweeper, ten invariants, three body schemas, and a label migration tool. What it starts owning:
the config, twelve short overrides, five shell scripts under `.ai/scripts/`, eight workflow files
and the pin. The rules that were code become documents the skills read, so a rule change is a
review of prose, and an upgrade of the skills is a PR read with `om-apply-upgrade-notes`.

What is given up knowingly: the sub-issue graph and `auto-advance` (a spec decomposes on paper),
the three-hour heartbeat that turned a dead run into `needs-human` (the claim is released by the
skill's `trap`, and `om-review-prs` reports a stale claim), `needs-info` and `backlog` as labels
(a not-ready issue gets a Definition of Ready comment instead), and the sweeper's report of a
`status:` that contradicts the tracker (there is no `status:` to contradict). The cost is tokens:
a fix chain runs the full validation gate two to four times, and grooming runs on every new
issue; `maxRecords`, `lookbackDays: 3` and `maxParallel: 2` bound a mistake, and
`om-pipeline-retro` after two weeks decides whether `pnpm build` and e2e stay in every checkpoint
or only in the final gate.

The cutover order is fixed by the labels: the taxonomy must exist before the automations switch
(done in PR A), and the old automations must be disabled before `status:*` is stripped and the
surviving labels renamed. The host sequence is in docs/agents/cezar.md; the label snapshot is
committed under `docs/agents/migration/` before the rename runs.
