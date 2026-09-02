# Cezar on this repository

[open-mercato/cezar](https://github.com/open-mercato/cezar) is the only orchestrator of agent work here
(ADR 0014, label protocol in ADR 0015). It runs on a developer host, checks out one `cez/<id8>` worktree per
run under `.ai/cezar/worktrees/`, and never writes to GitHub itself: every label, comment and pull request
comes from a script in `scripts/agent/`, and the sweeper below is the only writer that is not a run.

## Install and configure

- Pinned version: `@open-mercato/cezar@0.10.0` (`npx @open-mercato/cezar@0.10.0 serve`). The project entry
  in `~/.cezar/config.json` points at the main checkout; the versioned part is `.ai/cezar/config.json`
  (`baseBranch: develop`, `worktreeRetention: 10`, `maxParallel: 2`, `reviewGate: false`, `skillsRepos: []`).
  Cezar's own `.ai/cezar/.gitignore` keeps run state, worktrees and automations out of git; only
  `config.json` is tracked, so a checkout that already has an untracked `config.json` must remove it first.
- Service environment: `CEZ_AUTOMATIONS=1` from phase 4 on, `CEZ_AUTONOMOUS_DEFAULT=0`, and never
  `GH_TOKEN`, `CLOUDFLARE_*` or `CEZ_ENV_PASSTHROUGH`. Cezar copies its own env into the agent's, so a
  token in the service env is a token in every run.
- Host identity: a dedicated `HOME` whose `gh` holds a fine-grained PAT (Contents, Issues and Pull requests
  read/write, no Workflows), over HTTPS. Commits carry `user.name planned-travel-agent` (set by
  `cez-setup.sh`).
- Basemap: the e2e archive comes from the operator cache, filled once per host with
  `scripts/agent/fetch-basemap.sh` (needs the R2 token on the operator's shell, never in cezar);
  `setup-e2e.sh` links `.e2e-tiles/basemap.pmtiles` from
  `${PLANNED_TRAVEL_CACHE:-~/.cache/planned-travel}/e2e-tiles/`.

## Agent mode

A Claude Code session is an agent run when `CEZ_TASK_ID` (cezar) or `GITHUB_ACTIONS` is set. The hooks in
`.claude/hooks/` then tighten:

- `git-guardrails.sh` also blocks `git add -A|.`, closing keywords (`Closes #n`), every `gh issue|pr`
  mutation, non-GET `gh api`, `pnpm dlx|exec|run`, `npx`, `printenv` and `env` dumps.
- `guard-read.sh` (Read, Glob, Grep) confines reads to the worktree and denies `.dev.vars`, `.env*`,
  `.e2e-tiles/`, cezar run state and `.agent/handoff*`.
- `guard-generated.sh` also refuses edits under `.github/`, `.claude/`, `.husky/`, `.ai/cezar/`,
  `scripts/agent/`, `.npmrc` and `pnpm-workspace.yaml`.

Workflows give the agent a `bashAllowlist` of prefixes; every entry must be safe for any suffix, which is why
the scripts below have closed argument spaces and why repo code always runs under `env -i` with an explicit
variable list (`cez-lib.sh: clean_env`). Every string that reaches GitHub passes `neutralise`
(`@claude` gets a zero-width space) so a run can never summon the claude-code-action.

## Scripts (`scripts/agent/`)

| script                                          | who runs it             | what it does                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cez-lib.sh`                                    | sourced                 | repo/worktree/run identity, `mkdir` locks (macOS has no flock), marker-comment upsert, heartbeat, `clean_env`                                                                                                                                   |
| `cez-port.sh acquire\|release\|current`         | setup, handback         | one port per worktree from 3010-3020, pinned in `.agent/port`                                                                                                                                                                                   |
| `cez-setup.sh [--no-e2e]`                       | workflow `setup` step   | hooks off, agent identity, `pnpm install --frozen-lockfile --prefer-offline`, routes, then `setup-e2e.sh` on the pinned port (dev server on `127.0.0.1`, pid in `.agent/dev-server.pid`)                                                        |
| `cez-ladder.sh [--skip-e2e] [--no-build]`       | agent (allowlist)       | up to 3 passes: floor guard, `validate.sh --build --e2e-projects chromium`, narrowed rerun from pass 2 that can only stay red, heartbeat, digest `.agent/ladder-digest.md` (≤ 20 kB)                                                            |
| `cez-test.sh <files>`                           | agent (allowlist)       | vitest on named files under `env -i`; paths only, no flags                                                                                                                                                                                      |
| `cez-reseed.sh`                                 | agent (allowlist)       | `seed.mjs --force` + `verify.mjs` on the pinned port                                                                                                                                                                                            |
| `gh-ro.sh <path> [--paginate] [--jq]`           | agent (allowlist)       | GET-only window onto `repos/design4pro/planned.travel/{issues,pulls,labels,commits,compare,contents,git/ref,search}`                                                                                                                            |
| `cez-plan-claim.sh`                             | workflow `plan` (claim) | refresh onto `origin/develop`, `status: * → in-progress`, claim comment with heartbeat, `.agent/issue`                                                                                                                                          |
| `cez-plan-handback.sh --blocked --reason`       | agent (allowlist)       | `status: needs-human` plus `<!-- agent-result: needs-human -->` when a plan run cannot finish (autonomy nudge, unmet precondition, human gone)                                                                                                  |
| `publish-spec.sh`, `publish-prd.sh` `[--check]` | agent (allowlist)       | validate `.agent/plan/{spec,prd}.md` against `spec/v1` / `prd/v1`, write the body (original request kept in `<details>`), grilling log as `<!-- agent-grilling -->`, `status: review`                                                           |
| `publish-tickets.sh [--check\|--dry-run]`       | agent (allowlist)       | `plan.mjs`: DAG, disjoint owned paths for parallel tickets, sizes, protected paths, no `Closes`; create as `queued` → `sub_issues` → `blocked_by` → verify → first wave `ready` → PRD `in-progress`; resumable through `<!-- agent-tickets -->` |
| `cez-docs-pr.sh`                                | agent (allowlist)       | cherry-picks the run's `CONTEXT.md` / `docs/adr/` commits onto `claude/docs-<n>-<run8>` off `origin/develop` and opens a draft PR labelled `agent-docs`                                                                                         |
| `floor-guard.mjs [--base]`                      | ladder                  | refuses added `@ts-*` / eslint suppressions, skipped or focused tests, deleted test files                                                                                                                                                       |
| `state.mjs`                                     | sweeper, tests          | the invariants I-1…I-10 and the PR-driven transitions as a pure function of a snapshot and `now`                                                                                                                                                |
| `sweep.mjs [--fix] [--json] [--strict]`         | launchd on the host     | gathers GitHub + `GET /api/v1/p/planned-travel/runs`, reports, applies the mechanical fixes with `--fix`                                                                                                                                        |
| `validate.sh`, `setup-e2e.sh`, `narrow-e2e.ts`  | ladder                  | the deterministic ladder inherited from sandcastle; `--build` is the cezar addition                                                                                                                                                             |
| `labels-migrate.sh`, `fetch-basemap.sh`         | operator                | one-off label migration (ADR 0015); basemap cache                                                                                                                                                                                               |

The implement claim and handback, triage-\* and `cez-automations.sh` land with their workflows (phases 4-5 of
the migration plan).

## Workflow `plan`

`.ai/cezar/workflows/plan.yml` turns one issue into a spec, then a PRD, then tickets, one mode per run and a
human at the cockpit throughout. Start it from the GitHub tab: issue → "Hand this to the agent" → workflow
`plan`, prompt `spec`, `prd` or `tickets` (the issue number and link are always sent), **Autonomous off**.
The steps are `claim` (command), `setup --no-e2e` (command) and the interactive `/plan-feature {{task}}`
(opus), which is last because only the last agent step may park on `CEZ:ASK`.

- The skill (`.claude/skills/plan-feature/`, one mode file each) grills one question per round with a
  recommended option, logs the rounds, and publishes only through the scripts above; each artefact ends at
  `status: review`, and the human starts the next mode by handing the issue over again.
- A run that receives the autonomous nudge refuses: `cez-plan-handback.sh --blocked` marks the issue
  `needs-human`. The same skill runs locally in `claude` (`/plan-feature <issue> spec`) with
  AskUserQuestion instead of `CEZ:ASK`; write `.agent/issue` first.
- Tickets are created as `status: queued` and become `ready` only after `sub_issues` and `blocked_by` are
  verified on GitHub, so no implement run can start ahead of its blockers. `.ai/skills/plan-feature/` is a
  thin wrapper so the cockpit lists the skill.

## Sweeper

`node scripts/agent/sweep.mjs` runs every 15 minutes on the cezar host with the host's `gh` identity. It
reads GitHub (issues, PRs, claim comments, label timeline) and cezar's run list; when cezar is unreachable
it reports and never escalates. Report mode prints violations and the actions `--fix` would take; `--strict`
exits 1 when anything is off (the phase gate is "0 violations").

Install (template in `scripts/agent/launchd/`):

```bash
sed -e "s|__REPO_ROOT__|$PWD|g" -e "s|__PATH__|$(dirname "$(command -v node)"):$(dirname "$(command -v gh)"):/usr/bin:/bin|g" \
  scripts/agent/launchd/dev.planned-travel.sweeper.plist > ~/Library/LaunchAgents/dev.planned-travel.sweeper.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.planned-travel.sweeper.plist
```

Remove with `launchctl bootout gui/$(id -u)/dev.planned-travel.sweeper`. Log: `.ai/cezar/tmp/sweeper.log`.

## Markers

Comments the scripts edit in place rather than repeat: `<!-- agent-claim: <runId> -->` with
`<!-- agent-heartbeat: ISO -->` inside it (written by `cez-setup.sh`, `cez-ladder.sh`, `cez-reseed.sh`),
`<!-- agent-result: ok|needs-human|refused -->`, `<!-- agent-triage -->`, `<!-- agent-grilling -->`,
`<!-- agent-noticed -->`, `<!-- sweeper: <code> -->`; in a PR body `<!-- agent-run: <runId> -->`.
