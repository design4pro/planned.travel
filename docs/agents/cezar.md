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
- Language: `systemPrompt` in `.ai/cezar/config.json` (Settings → Agents edits the same key) is
  appended to the system prompt of every agent step of every run here, and tells the run to talk to
  the developer in Polish (messages, `CEZ:ASK` questions, the final report) while everything that
  leaves the session (code, comments, commits, files, GitHub) stays English. A per-run system prompt
  from the composer replaces it rather than adding to it, so such a run repeats the language rule;
  `scripts/agent/__tests__/cezar-config.test.ts` fails when the key is cleared.
- Service environment: `CEZ_AUTOMATIONS=1` (the `triage-*` and `implement` automations need it), `CEZ_AUTONOMOUS_DEFAULT=0`, and never
  `GH_TOKEN`, `CLOUDFLARE_*` or `CEZ_ENV_PASSTHROUGH`. Cezar copies its own env into the agent's, so a
  token in the service env is a token in every run.
- Host identity: a dedicated `HOME` whose `gh` holds a fine-grained PAT (Contents, Issues and Pull requests
  read/write, no Workflows), over HTTPS. Commits carry `user.name planned-travel-agent` (set by
  `cez-setup.sh`).
- Basemap: CI needs none since ADR 0016, and `pnpm e2e` does not either. For a local session that
  wants real tiles the archive comes from the operator cache, filled once per host with
  `scripts/agent/fetch-basemap.sh` (needs the R2 token on the operator's shell, never in cezar);
  `setup-e2e.sh` links `.e2e-tiles/basemap.pmtiles` from
  `${PLANNED_TRAVEL_CACHE:-~/.cache/planned-travel}/e2e-tiles/`.

## Agent mode

A Claude Code session is an agent run when `CEZ_TASK_ID` (cezar) or `GITHUB_ACTIONS` is set. The hooks in
`.claude/hooks/` then tighten:

- `git-guardrails.sh` also blocks `git add -A|.`, closing keywords (`Closes #n`), every `gh issue|pr`
  mutation, non-GET `gh api`, `pnpm dlx|exec|run`, `npx`, `printenv` and `env` dumps. One exception:
  `claude-code-review.yml` sets `CLAUDE_REVIEW_PR_COMMENT=1`, which opens `gh pr comment` for the job
  whose purpose is to post a review, because that job runs with `--permission-mode bypassPermissions`
  and this hook is its only gate.
- `guard-read.sh` (Read, Glob, Grep) confines reads to the worktree and denies `.dev.vars`, `.env*`,
  `.e2e-tiles/`, cezar run state and `.agent/handoff*`.
- `guard-generated.sh` also refuses edits under `.github/`, `.claude/`, `.husky/`, `.ai/cezar/`,
  `scripts/agent/`, `.npmrc` and `pnpm-workspace.yaml`.

Workflows give the agent a `bashAllowlist` of prefixes; every entry must be safe for any suffix, which is why
the scripts below have closed argument spaces and why repo code always runs under `env -i` with an explicit
variable list (`cez-lib.sh: clean_env`). Every string that reaches GitHub passes `neutralise`
(`@claude` gets a zero-width space) so a run can never summon the claude-code-action.

## Scripts (`scripts/agent/`)

| script                                          | who runs it                         | what it does                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cez-lib.sh`                                    | sourced                             | repo/worktree/run identity, `mkdir` locks (macOS has no flock), marker-comment upsert, heartbeat, `clean_env`                                                                                                                                                                               |
| `cez-port.sh acquire\|release\|current`         | setup, handback                     | one port per worktree from 3030-3040, pinned in `.agent/port`                                                                                                                                                                                                                               |
| `cez-setup.sh [--no-e2e]`                       | workflow `setup` step               | hooks off, agent identity, `pnpm install --frozen-lockfile --prefer-offline`, routes, then `setup-e2e.sh` on the pinned port (dev server on `127.0.0.1`, pid in `.agent/dev-server.pid`)                                                                                                    |
| `cez-ladder.sh [--skip-e2e] [--no-build]`       | agent (allowlist)                   | up to 3 passes: floor guard, `validate.sh --build --e2e-projects chromium`, narrowed rerun from pass 2 that can only stay red, heartbeat, digest `.agent/ladder-digest.md` (≤ 20 kB)                                                                                                        |
| `cez-test.sh <files>`                           | agent (allowlist)                   | vitest on named files under `env -i`; paths only, no flags                                                                                                                                                                                                                                  |
| `cez-reseed.sh`                                 | agent (allowlist)                   | `seed.mjs --force` + `verify.mjs` on the pinned port                                                                                                                                                                                                                                        |
| `gh-ro.sh <path> [--paginate] [--jq]`           | agent (allowlist)                   | GET-only window onto `repos/design4pro/planned.travel/{issues,pulls,labels,commits,compare,contents,git/ref,search}`                                                                                                                                                                        |
| `cez-claim.sh`                                  | workflow `implement-ticket` (claim) | per-issue lock, refresh onto `origin/develop`, one-call preflight (open, `run: implement`, `ready`/`needs-human`, leaf, no open blocker, no open agent PR); a refusal drops `run:` and comments `refused`; a claim swaps to `in-progress` and adopts a clean `claude/issue-<n>-*` branch    |
| `cez-handback.sh [--blocked --reason]`          | agent (allowlist)                   | green: push `claude/issue-<n>-<run8>`, draft PR `agent-pr`, `status: review`, `CEZ:PR=<n>`; blocked: WIP pushed, digest, `status: needs-human`; protected paths or `package.json` scripts never push; frees the port                                                                        |
| `cez-automations.sh [--dry-run]`                | operator                            | registers `docs/agents/cezar-automations.json` with the running cezar over its API (create enabled or update in place)                                                                                                                                                                      |
| `cez-triage-claim.sh`                           | workflow `triage` (claim)           | per-issue lock, refresh onto `origin/develop`, preflight (open, leaf, not held, not in review); without `run: triage` only `status: triage` without the `<!-- agent-triage -->` marker qualifies, and a stand-down writes nothing; with it a refusal drops the label and comments `refused` |
| `triage-apply.sh [--check]`                     | agent (allowlist)                   | the only writer of a verdict: `.agent/triage.json` + `triage/notes.md` (+ `triage/brief.md`, a `ticket/v2` body, for `promoted`) → the `<!-- agent-triage -->` comment, the brief into the body, `status: ready \| needs-info \| backlog \| needs-human`; never closes                      |
| `triage-batch.sh [--limit N] [--dry-run]`       | operator                            | adds `run: triage` to the oldest `status: triage` issues that lack it, N at a time                                                                                                                                                                                                          |
| `cez-plan-claim.sh`                             | workflow `plan` (claim)             | refresh onto `origin/develop`, `status: * → in-progress`, claim comment with heartbeat, `.agent/issue`                                                                                                                                                                                      |
| `cez-plan-handback.sh --blocked --reason`       | agent (allowlist)                   | `status: needs-human` plus `<!-- agent-result: needs-human -->` when a plan run cannot finish (autonomy nudge, unmet precondition, human gone)                                                                                                                                              |
| `publish-spec.sh`, `publish-prd.sh` `[--check]` | agent (allowlist)                   | validate `.agent/plan/{spec,prd}.md` against `spec/v1` / `prd/v1`, write the body (original request kept in `<details>`), grilling log as `<!-- agent-grilling -->`, `status: review`                                                                                                       |
| `publish-tickets.sh [--check\|--dry-run]`       | agent (allowlist)                   | `plan.mjs`: DAG, disjoint owned paths for parallel tickets, sizes, protected paths, no `Closes`; create as `queued` → `sub_issues` → `blocked_by` → verify → first wave `ready` → PRD `in-progress`; resumable through `<!-- agent-tickets -->`                                             |
| `cez-docs-pr.sh`                                | agent (allowlist)                   | cherry-picks the run's `CONTEXT.md` / `docs/adr/` commits onto `claude/docs-<n>-<run8>` off `origin/develop` and opens a draft PR labelled `agent-docs`                                                                                                                                     |
| `floor-guard.mjs [--base]`                      | ladder                              | refuses added `@ts-*` / eslint suppressions, skipped or focused tests, deleted test files                                                                                                                                                                                                   |
| `state.mjs`                                     | sweeper, tests                      | the invariants I-1…I-10 and the PR-driven transitions as a pure function of a snapshot and `now`                                                                                                                                                                                            |
| `sweep.mjs [--fix] [--json] [--strict]`         | launchd on the host                 | gathers GitHub + `GET /api/v1/p/planned-travel/runs`, reports, applies the mechanical fixes with `--fix`                                                                                                                                                                                    |
| `validate.sh`, `setup-e2e.sh`, `narrow-e2e.ts`  | ladder                              | the deterministic ladder inherited from sandcastle; `--build` is the cezar addition                                                                                                                                                                                                         |
| `labels-migrate.sh`, `fetch-basemap.sh`         | operator                            | one-off label migration (ADR 0015); basemap cache                                                                                                                                                                                                                                           |

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

## Workflow `plan-area`

`.ai/cezar/workflows/plan-area.yml` migrates one un-migrated area of `docs/plans/` into a spec and
then a PRD on one issue, in one run and without a human in the loop (ADR 0017). The human's seat is
a panel of six project subagents in `.claude/agents/plan-*.md`; the orchestrator
(`.claude/skills/plan-area/`) dispatches them per round, decides, and logs every round with the
panel's recommendations to the same `<!-- agent-grilling -->` comment. Start it from the GitHub tab:
open (or create with the Idea form) the issue that will hold the PRD → "Hand this to the agent" →
workflow `plan-area`, prompt template `plan-area` with the plan file filled in. The Autonomous flag
changes nothing: the skill never asks. The steps are `claim` (`cez-plan-claim.sh`), `setup --no-e2e`
and `/plan-area {{task}}` (opus, with `Agent` allowed).

- Prompt template, added once per cockpit under Settings → Prompt templates (they live in
  `~/.cezar/ui-state.json`, not in the repo): label `plan-area`, text `area docs/plans/NN-area.md`.
  Replace `NN-area` before starting; the skill also accepts the two-digit ordinal alone.
- The panel: `plan-reader` (a digest of at most 15 kB, once), `plan-fact-checker` (the plan's claims
  about HEAD), `plan-domain-architect`, `plan-product-owner` (the human's seat), `plan-qa-strategist`,
  `plan-critic` (every draft, at most three passes). Subagents run under the step's `allowedTools`
  and `bashAllowlist`; `scripts/agent/__tests__/plan-area.test.ts` keeps the agents' declared tools
  inside that list.
- The spec publishes first (the issue reads `status: review` while the run continues); the PRD
  publishes only when "Open questions" is `None.`. A decision that is a human's (money, commercial
  terms, a clean-room risk) stays open, the run ends after the spec, and `plan` in mode `prd` grills
  it. Tickets stay with `plan` in mode `tickets`.
- Frozen plans (`01`, `03`) and `README.md`, `TEMPLATE.md`, `OPEN-FINDINGS.md` are refused. Once the
  tickets exist a human freezes the plan file with a "Migrated → PRD #n" banner (ADR 0004,
  amendment).
- Locally: `/plan-area <issue> <plan>` in `claude` with `.agent/issue` written first. Subagents,
  skills and hooks are the project's, so nothing depends on the host's user-level configuration.

## Workflow `implement-ticket`

`.ai/cezar/workflows/implement-ticket.yml` turns one ready ticket into one draft PR without a human in the
loop: `claim` (command), `setup` (command, full e2e environment on a pooled port), then the autonomous
`/implement-ticket {{task}}` (opus). It starts when a human adds `run: implement` to a ticket: the
`implement` automation (`docs/agents/cezar-automations.json`, registered with `scripts/agent/cez-automations.sh`
once the service runs with `CEZ_AUTOMATIONS=1`) polls GitHub every 60 s for that label change and skips
anything `in-progress`, `review` or `prd`. `auto-advance` on a PRD lets the sweeper add the label to children
as they unblock.

- The claim is the only gate and it costs no tokens: a refusal (blocked, queued, a PR already open, not a
  leaf) removes `run: implement`, comments `<!-- agent-result: refused -->` and exits 1, so the sweeper
  never has to escalate a stuck label.
- The skill (`.claude/skills/implement-ticket/`) works inside the ticket's Owned paths, TDD-first, climbs
  `cez-ladder.sh` at most three times, self-reviews, and always leaves through `cez-handback.sh`: green
  means a draft PR with the DoD, the ladder table and the review in its body; a stop condition
  (`ladder-exhausted`, `outside-owned-paths`, `spec-conflict`, `floor`, `dependency`, `security`, `infra`)
  means a pushed WIP branch and `status: needs-human` with the digest.
- The handback refuses a tree the ladder did not see (`.agent/ladder-tree`) and never pushes a diff that
  touches the agent's own configuration or `package.json` scripts. A ticket with a "Visual change expected"
  section gets a note in the PR pointing at `node scripts/visual/capture.mjs`: nothing in CI
  photographs a screen since ADR 0016, so a declared visual change is judged by a human reading the
  blind pair.
- Locally the same skill runs as `/implement-ticket <issue>` on a branch off `origin/develop` with
  `.agent/issue` written by hand; the handback then uses the developer's `gh`.

## Workflow `triage`

`.ai/cezar/workflows/triage.yml` verifies one new issue against HEAD and routes it, without a human in
the loop: `claim` (command), `setup --no-e2e` (command), then the autonomous `/triage-ticket {{task}}`
(sonnet) with a read-mostly allowlist (`cez-test.sh`, the `pnpm` checks, `triage-apply.sh`). Two
automations start it: `triage-opened` (`issue.opened` carrying `status: triage`, which every issue form,
audit follow-up and Sentry finding carries) and `triage-relabel` (`issue.labeled` with `run: triage`,
skipping `in-progress` and `review`). The backlog is fed a few at a time with `triage-batch.sh`.

- The skill reproduces the claim (a temporary vitest case at the seam, or the command the body names),
  checks redundancy across open and closed issues and `docs/agents/out-of-scope.md`, and writes a verdict:
  `promoted` (with a `ticket/v2` agent brief), `needs-info`, `needs-plan` (every feature), `needs-human`,
  `refuted`, `redundant`. Nothing closes an issue; a human does that from `needs-human`.
- `triage-apply.sh` is the only writer: it validates the brief with the same checks as a planned ticket,
  keeps the original report in the body, posts the notes as `<!-- agent-triage -->` (edited in place on a
  repeat) and swaps the status. A promoted bug then looks like any ready ticket to `run: implement`.
- The marker blocks only the `opened` path; `run: triage` from a human re-triages on purpose, so a reply to
  a `needs-info` question is followed by that one label.
- Sentry findings still enter through `pnpm sentry-triage` (`scripts/sentry-triage/`, weekly in
  `sentry-triage.yml`), now as one `claude -p` session with the Sentry MCP server and no write tools; the
  cezar automation picks the filed issues up like any other.

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
