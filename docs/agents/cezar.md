# Cezar on this repository

[open-mercato/cezar](https://github.com/open-mercato/cezar) is the only orchestrator of agent work
here (ADR 0014); the work itself is done by the vendored `om-*` skills from
[open-mercato/skills](https://github.com/open-mercato/skills) (ADR 0018). Cezar runs on a developer
host, checks out one `cez/<id8>` worktree per run under `.ai/cezar/worktrees/`, polls GitHub for
the events in docs/agents/cezar-automations.json, and runs the workflow the event names. Every
label, comment and pull request comes from a skill acting through `.ai/trackers/github.md` under
the rules of `SDLC.md`.

## Install and configure

- Pinned version: `@open-mercato/cezar@0.10.1` (`npx -y @open-mercato/cezar@0.10.1 serve`). The
  project entry in `~/.cezar/config.json` points at the main checkout; the versioned part is
  `.ai/cezar/config.json` (`baseBranch: develop`, `worktreeRetention: 10`, `maxParallel: 2`,
  `reviewGate: false`, `skillsRepos[0].ref` pinned to the same SHA as `skills-lock.json`).
  Cezar's own `.ai/cezar/.gitignore` keeps run state, worktrees and its automations store out
  of git; `config.json` and `workflows/` are tracked.
- Skills: `.claude/skills/om-*` are vendored files, byte-identical to the pinned upstream SHA.
  `pnpm install-skills` re-installs and updates them; the diff is a PR, read with
  `/om-apply-upgrade-notes`, and the pin in `.ai/cezar/config.json` moves in the same commit.
  Repo specifics live in `.ai/skills/om-<name>/SKILL.md` as extensions of the installed skill.
- Language: `systemPrompt` in `.ai/cezar/config.json` (Settings → Agents edits the same key) is
  appended to the system prompt of every agent step and tells the run to talk to the developer in
  Polish while everything that leaves the session (code, comments, commits, GitHub) stays English.
  `scripts/agent/__tests__/cezar-config.test.ts` fails when the key is cleared.
- Service environment: `CEZ_AUTOMATIONS=1`, `CEZ_AUTONOMOUS_DEFAULT=0`, and never `GH_TOKEN`,
  `CLOUDFLARE_*` or `CEZ_ENV_PASSTHROUGH`. Cezar copies its own env into the agent's, so a token in
  the service env is a token in every run.
- Host identity: a dedicated `HOME` whose `gh` holds a fine-grained PAT (Contents, Issues and
  Pull requests read/write; **no Workflows, no Administration**: a run cannot push under
  `.github/workflows/` or delete a label), over HTTPS. `user.name planned-travel-agent` and
  `core.hooksPath` (husky off) are set in that HOME's global git config, not per run. The main
  checkout's `.dev.vars` holds sandbox values only: `scripts/worktree/bootstrap.sh` copies it into
  every worktree.
- Basemap: CI needs none since ADR 0016, and `pnpm e2e` does not either. `bootstrap.sh` clones the
  operator cache (`${PLANNED_TRAVEL_CACHE:-~/.cache/planned-travel}`) when it is there.

## Agent mode

A Claude Code session is an agent run when `CEZ_TASK_ID` (cezar) or `GITHUB_ACTIONS` is set. The
hooks in `.claude/hooks/` then tighten:

- `git-guardrails.sh` also blocks `pnpm add|remove|update` (the stack is pinned, docs/SPEC.md §3),
  `printenv` and `env` dumps. Under cezar, GitHub mutations, `git add -A`, closing keywords and
  `pnpm exec` are open: the om-* skills perform them through `.ai/trackers/github.md` and `SDLC.md`
  governs them. Under GitHub Actions every `gh issue|pr` mutation, `gh label|release|repo|secret|
variable|workflow|run` and non-GET `gh api` stays blocked, because `claude-code-review.yml` reads
  untrusted pull-request content with a write token under `--permission-mode bypassPermissions` and
  this hook is its only gate; `CLAUDE_REVIEW_PR_COMMENT=1` opens `gh pr comment` for that one job.
- `guard-read.sh` (Read, Glob, Grep) confines reads to the worktree and denies `.dev.vars`, `.env*`,
  `.e2e-tiles/`, cezar run state and `.ai/qa/test-env.env`.
- `guard-generated.sh` also refuses edits under `.github/`, `.claude/`, `.husky/`, `.ai/cezar/`,
  `.ai/agentic.config.json`, `.ai/trackers/`, `.ai/browsers/`, `.ai/skills/`, `.ai/scripts/` (a run
  must not rewrite its own validation gate), `scripts/agent/`, `.npmrc` and `pnpm-workspace.yaml`.

Agent steps of the om workflows carry no `bashAllowlist` (ADR 0018): the tracker descriptor is
shell functions and `jq`, and a prefix allowlist would drop label mutations silently. The hooks,
the PAT scopes, one worktree per run and `maxParallel: 2` are the gate. After the first ten runs,
read the transcripts for rules the hooks should learn.

## Workflows (`.ai/cezar/workflows/`)

Every om workflow is a `command` step that provisions the worktree, then one agent step whose
prompt is the skill as a slash command (`/om-… {{task}}`; never `skill:`, which would load the
thin `.ai/skills/` override alone). `allowedTools` is the full set for skills that write code and
drops `Edit`/`Write` for the ones that must not.

| Workflow         | Agent step                                                               | Model                | Started by                                                                 |
| ---------------- | ------------------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------- |
| `issue-groom`    | `/om-auto-manage-issues {{task}} --prep-impl`                            | sonnet               | automation `issue-groom` (`issue.opened`), `issue-regroom` (label `groom`) |
| `issue-autofix`  | `/om-auto-fix-issue {{task}}`                                            | opus                 | automation `issue-autofix` (label `autofix`)                               |
| `spec`           | `/om-auto-write-spec {{task}}`                                           | opus                 | automation `issue-spec` (label `spec` on a `feature`)                      |
| `implement-spec` | `/om-auto-implement-spec {{task}}`                                       | opus                 | a human, from the cockpit, after the spec PR merged                        |
| `pr-autopilot`   | `/om-pr-autopilot {{task}}` (no `--allow-merge`)                         | opus                 | automation `pr-autopilot` (`pull_request.opened` by a human maintainer)    |
| `pr-review`      | `/om-auto-review-pr {{task}} --autofix`                                  | opus                 | a human, from the cockpit, on a PR number                                  |
| `housekeeping`   | `/om-review-prs`, `/om-merge-buddy`, `/om-close-fixed-issues --limit 50` | opus, sonnet, sonnet | launchd via `.ai/scripts/housekeeping.sh`, or a human                      |
| `brainstorm`     | `/om-brainstorm {{task}}`, **Autonomous off**                            | opus                 | a human, from the cockpit, with the idea as the task                       |

The task text an automation sends is the issue or PR number alone (`{{github.number}}`); a second
token would read as a brief to `om-auto-fix-issue`. From the cockpit type the same: a number, a
spec path, or for `brainstorm` the idea.

Provisioning is `scripts/worktree/bootstrap.sh --profile worktree --no-seed` (deps, route tree,
`.dev.vars`, local D1 with airports, basemap when cached; no server), or only `pnpm install` and
`pnpm generate-routes` for the read-only workflows. The validation gate the skills run is
`validation.commands` in `.ai/agentic.config.json`; its e2e entry starts the app through
`.ai/scripts/test-env-up.sh` on a free port from 3030-3040 (`om-prepare-test-env` contract).

Three older workflows (`triage`, `plan`, `plan-area`, `implement-ticket`) and the scripts in
`scripts/agent/` they call stay in the tree until PR C deletes them; their automations are disabled
in the cutover below and nothing starts them.

## Automations (`docs/agents/cezar-automations.json`)

Registered with the running cockpit by `.ai/scripts/cez-automations.sh` (idempotent: update in
place or create enabled; it lists definitions the cockpit holds that the file no longer names).
Five definitions: `issue-groom` on `issue.opened`; `issue-regroom`, `issue-autofix`, `issue-spec`
on `issue.labeled` with `changedLabels` `groom` / `autofix` / `spec`; `pr-autopilot` on
`pull_request.opened` with `authors` naming the human maintainers, so agent PRs
(`planned-travel-agent`, already reviewed inside their chain) and dependabot never enter the
autopilot. Every filter excludes `in-progress`; `lookbackDays: 3` and `maxRecords` 5-10 bound a
mistaken mass relabel to a handful of runs. The three command labels are the only things that
start code-writing work, and no skill adds them (the overrides say so), so no run can start
another.

## Housekeeping

Cezar has no scheduler. `.ai/scripts/housekeeping.sh` POSTs one `housekeeping` run to the cockpit
(`/api/v1/p/planned-travel/runs`) and falls back to a headless `cezar run` when the cockpit is
down; launchd calls it at 07:00, 12:00 and 17:00 on weekdays. Install (template in
`.ai/scripts/launchd/`):

```bash
sed -e "s|__REPO_ROOT__|$PWD|g" -e "s|__PATH__|$(dirname "$(command -v node)"):$(dirname "$(command -v gh)"):/usr/bin:/bin|g" \
  .ai/scripts/launchd/dev.planned-travel.housekeeping.plist > ~/Library/LaunchAgents/dev.planned-travel.housekeeping.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.planned-travel.housekeeping.plist
```

Remove with `launchctl bootout gui/$(id -u)/dev.planned-travel.housekeeping`. Log:
`.ai/cezar/tmp/housekeeping.log`. Run it by hand any time: `bash .ai/scripts/housekeeping.sh`.

## Host cutover (operator, once, after PR B merges)

The order is fixed by the labels: the SDLC taxonomy already exists (PR A); the old automations
must stop before `status:*` is stripped and the surviving labels renamed.

1. Unload the sweeper: `launchctl bootout gui/$(id -u)/dev.planned-travel.sweeper` and delete
   `~/Library/LaunchAgents/dev.planned-travel.sweeper.plist`.
2. In the cockpit (Automations) disable `triage-opened`, `triage-relabel` and `implement`. Leave
   them disabled until PR C; do not delete yet.
3. Snapshot: `gh label list --limit 200 --json name,color,description > docs/agents/migration/labels-$(date +%F).json`
   and `gh issue list --state open --limit 500 --json number,labels > docs/agents/migration/issues-$(date +%F).json`;
   commit both.
4. `bash .ai/scripts/labels-cutover.sh` (dry run), read it, then `--apply`: holds move to
   `blocked`, `status:*` leaves every open issue, `run:*`, `type:*` and `agent-docs` move to their
   SDLC names. `prd`, `auto-advance`, `agent-pr` and the empty `status:*` labels wait for PR C.
5. The cockpit service already runs 0.10.1 (`~/Library/LaunchAgents/dev.cezar.cockpit.plist`);
   confirm `.ai/cezar/config.json` in the main checkout is the merged one and restart the service
   so it reloads the workflows.
6. `bash .ai/scripts/cez-automations.sh --dry-run`, then without the flag: the five new automations
   are created enabled.
7. Install the housekeeping plist (above) and run `bash .ai/scripts/housekeeping.sh` once by hand.
8. Verify end to end on a test issue: open it with the Bug form → within two minutes an
   `issue-groom` run adds priority and risk and posts the Definition of Ready and implementation
   notes → add `autofix` → the run removes the label, claims with `in-progress`, opens a draft PR on
   develop and ends with it ready, labelled `review` + category + `needs-qa|skip-qa` + priority +
   risk, with a run-summary comment and the `PR: #n` line in the cezar run → merge it → the next
   housekeeping closes the issue. Then open a PR by hand: `pr-autopilot` reviews it and does not
   merge.

## Local use

Every workflow's skill runs the same way in a local `claude` session, with the developer's `gh`:
`/om-auto-fix-issue <n>`, `/om-auto-write-spec <n>`, `/om-auto-implement-spec <spec>`,
`/om-auto-review-pr <pr> [--autofix]`, `/om-pr-autopilot <pr>`, `/om-review-prs`,
`/om-merge-buddy`, `/om-close-fixed-issues`, `/om-brainstorm`. Hand-worked branches go through
`/om-check-and-commit` and `/om-open-pr`. The hooks are the project's, so nothing depends on the
host's user-level configuration.
