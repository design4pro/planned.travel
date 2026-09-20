# Cezar on this repository

[open-mercato/cezar](https://github.com/open-mercato/cezar) is the only orchestrator of agent work
here (ADR 0014); the work itself is done by the vendored `om-*` skills from
[open-mercato/skills](https://github.com/open-mercato/skills) (ADR 0018). Cezar runs on a developer
host, checks out one `cez/<id8>` worktree per run under `.ai/cezar/worktrees/`, polls GitHub for
the events in docs/agents/cezar-automations.json, and runs the workflow the event names. Every
label, comment and pull request comes from a skill acting through `.ai/trackers/github.md` under
the rules of `SDLC.md`.

## Install and configure

- Version: the cockpit runs the [design4pro/cezar](https://github.com/design4pro/cezar/tree/design4pro)
  fork - its `design4pro` branch is upstream `v0.11.0` plus one commit per fix below - cloned at
  `~/dev/cloudflare/cezar`, linked onto PATH with `npm run install-as-command` (so
  `command -v cezar` keeps its path) and started by the cockpit plist as `cezar serve`. Upstream is
  not a fallback, whether through `npx` or `npm i -g`: it runs without every fix below and reports
  nothing, so the first symptom is pull requests sitting with unresolved threads. The
  cockpit plist is host-wide state and lives in the fork's own repository
  (`design4pro/cezar`, `host/launchd/dev.cezar.cockpit.plist`, with the runbook in its
  `docs/host/README.md`, "The cockpit runs a fork, not npx" and "Taking an upstream release"), not
  here - one service serves both projects. The
  project entry in `~/.cezar/config.json` points at the main checkout; the versioned part is
  `.ai/cezar/config.json` (`baseBranch: develop`, `worktreeRetention: 10`, `maxParallel: 2`,
  `reviewGate: false` so a successful non-autonomous run settles at `done` and the automations
  keep driving themselves, `skillsRepos: []` because the vendored `.claude/skills/om-*` copies are
  the only source and cezar must not clone the upstream repository at run time).
  Cezar's own `.ai/cezar/.gitignore` keeps run state, worktrees and its automations store out
  of git; `config.json` and `workflows/` are tracked.
- Fork commits: each fix below is one commit on `design4pro`, and a rebase onto an upstream release
  drops the ones that release carries. They were string patches on an npm install's `dist/` until
  September 2026 (`.ai/scripts/cezar-host-patch.sh`, since deleted). `GH_CONFIG_DIR` forwarding
  needs no commit: 0.11.0 forwards it.
  - In upstream, `issue.labeled` polls fail as soon as one recently updated issue has a comment or a
    cross-reference (open-mercato/cezar#914), so **Re-groom on request**, **Fix issues on the autofix label** and **Write a spec for feature issues**
    never fire. The fork cherry-picks the fix, upstream PR #916.
  - On every cockpit start the skills coordinator runs `npx skills check <om-*> -p` in each project
    root, and that command re-adds the skills from upstream HEAD: the vendored
    `.claude/skills/om-*` directories become symlinks into an untracked `.agents/skills/`, which
    shows as 400 deleted files in `git status`. `skillsAutoUpdate: false` (kept in
    `~/.cezar/config.json`) gates only the update; the fork makes `CEZ_SKILLS_AUTO_UPDATE=0` skip
    the check too. Recovery: remove the symlinks, `git checkout -- .claude/skills`, delete `.agents/`.
  - Two runs forking their worktree in the same moment lose the `.git/config` lock: `git worktree
add -b` writes the new branch's upstream into the shared config, git's config lock has no
    retry, and the fork happens before cezar takes the repository-root lease, so `maxParallel`
    does not order it. Every loser dies with `worktree creation failed` before its workflow runs -
    three runs here, two of them 26ms apart. The fork retries onto the reattach form, which
    writes no shared config.
  - A label automation pins its poll cursor once the 120s overlap band it re-reads on every poll
    holds `maxRecords` label events (planned.travel#351, reported upstream as
    open-mercato/cezar#982): every poll spends its budget on events it has already seen and
    returns the cursor it was handed. `om-auto-manage-issues` writes three labels per issue in
    the same second, so two groomed issues saturate a five-record window. The automation stays
    enabled, polls on schedule and logs `no-match`, so a pinned one looks exactly like a quiet
    repository. The fork widens the budget of a poll that failed to advance, doubling to the
    100-record search ceiling within that same check, so a saturated band clears without help.
    Recognise a pin from the main checkout:

    ```bash
    jq -r --slurpfile a .ai/cezar/automations.json '$a[0].automations as $d | .states | to_entries[]
      | . as $e | (first($d[] | select(.id == $e.key) | .name) // "?") as $n
      | "\($n) \($e.key) cursor=\($e.value.cursor.timestamp) frozen=\($e.value.frozenHighWatermark.timestamp // "-") exhausted=\($e.value.widenExhaustedAt.timestamp // "-")"' \
      .ai/cezar/automation-state.json
    ```

    A `?` name is state left behind by an automation that no longer exists in `automations.json`.
    A `cursor` that stays behind a label you applied for more than one interval is a pin; `frozen`
    alone is not, since any truncated poll sets it, including one that advanced. `exhausted` means
    the ladder reached 100 at that cursor and gave up until the cursor moves: the band is wider
    than the search API pages. Recovery, in order: confirm the cockpit runs a current build of the
    fork (`readlink -f "$(command -v cezar)"` lands in `~/dev/cloudflare/cezar`), because an
    upstream install drops the widening without a word and brings the pin back; if the cursor
    still does not move, re-baseline the automation with
    `curl -X POST "${CEZ_API:-http://localhost:4321}/api/v1/p/${CEZ_PROJECT:-planned-travel}/automations/<id>/enable"`, which
    moves `baselineAt` and the cursor to now. A baseline launches nothing from before it, so every
    issue labelled between the pinned cursor and the baseline is re-triggered by hand: remove the
    label and add it again.
- Skills: `.claude/skills/om-*` are vendored files, byte-identical to
  `open-mercato/skills@91f11c63721b5f7e17a859940b3e9c55ece698ee` - this line is the pin, because
  `skills-lock.json` records only a per-skill `computedHash` and `.ai/cezar/config.json` no longer
  carries a `skillsRepos` entry to hold a ref. `pnpm install-skills` re-installs and updates them;
  the diff is a PR, read with `/om-apply-upgrade-notes`, and the SHA on this line moves in the same
  commit.
  Repo specifics live in `.ai/skills/om-<name>/SKILL.md` as extensions of the installed skill.
- Language: `systemPrompt` in `.ai/cezar/config.json` (Settings → Agents edits the same key) is
  appended to the system prompt of every agent step and tells the run to talk to the developer in
  Polish while everything that leaves the session (code, comments, commits, GitHub) stays English.
  `.ai/scripts/__tests__/cezar-config.test.ts` fails when the key is cleared.
- Service environment: `CEZ_AUTOMATIONS=1`, `CEZ_AUTONOMOUS_DEFAULT=0`, `CEZ_SKILLS_AUTO_UPDATE=0`,
  `GH_CONFIG_DIR` (below), all four from the plist template in `design4pro/cezar`, and never `GH_TOKEN`,
  `CLOUDFLARE_*` or `CEZ_ENV_PASSTHROUGH`. Cezar
  builds the agent's env from an allowlist (`PATH`, `HOME`, toolchain prefixes such as
  `NODE_*`/`PNPM_*`, `GH_TOKEN`, `GH_CONFIG_DIR`, `ANTHROPIC_*`, `CLAUDE_*`, `CEZ_*`), so a token
  in the service env is a token in every run, and any other variable set there (`HUSKY=0` for
  one) never reaches the agent. Husky is therefore handled in the repo: `HUSKY=0` before
  `pnpm install` in `scripts/worktree/bootstrap.sh` and the workflow setup steps keeps
  `prepare` from rewriting `core.hooksPath` in the host clone's shared config, and
  `.husky/pre-commit` exits at once when `CEZ_TASK_ID` is set; the gate a run passes is
  `validation.commands` in `.ai/agentic.config.json`.
- Host identity: the cockpit acts as `design4pro-agent` (bot@design4.pro), a member of the
  `design4pro` organisation with Write on this repository and on `money-tracker.online`, nothing
  else. Its `gh` login lives in its own config directory, next to the developer's
  (`~/.config/gh-agent`, `GH_CONFIG_DIR=~/.config/gh-agent gh auth login --with-token` with a
  fine-grained PAT owned by that account: resource owner `design4pro`, only the two repositories,
  Contents, Issues and Pull requests read/write; **no Workflows, no Administration**: a run cannot
  push under `.github/workflows/` or delete a label; the organisation approves the token once).
  The cockpit plist sets `GH_CONFIG_DIR` and cezar forwards it, so `gh` inside a run and
  `git push` over HTTPS (the global credential helper is `gh auth git-credential`, which reads
  the same variable) both act as the bot, while `~/.config/gh` and the developer's terminal stay the
  developer's. Commits carry `user.name design4pro-agent` and `user.email bot@design4.pro` from
  the host clone's local git config, which every worktree shares. Re-login the bot only with an
  empty run queue: a run whose `gh` loses its login mid-way stops with a blocked handoff. The
  main checkout's `.dev.vars` holds sandbox values only: `scripts/worktree/bootstrap.sh` copies
  it into every worktree.
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
- There is no third hook. `guard-generated.sh`, which refused agent edits under `.github/`,
  `.claude/`, `.ai/` and a handful of named files, is gone (ADR 0025): it was this repository's own
  invention rather than anything Cezar CLI prescribes, and the one thing it protected alone -
  `worker-configuration.d.ts` drifting from `wrangler.jsonc` - is now a drift check in
  `.ai/scripts/check-generated.sh` and in `ci.yml`, where CI sees it and a hand edit cannot
  outlive the next run. A run may now edit its own gate, its own skills and its own workflows;
  review is what catches that, as it does for every other file in the diff.

  Under GitHub Actions one piece of it survives by other means. `claude-code-review.yml` re-checks
  out `.claude/`, `scripts/ci/` and `.ai/agentic.config.json` from the base ref before the agent
  starts, so a pull request still cannot supply the agent configuration that reads it.

Agent steps of the om workflows carry no `bashAllowlist` (ADR 0018): the tracker descriptor is
shell functions and `jq`, and a prefix allowlist would drop label mutations silently. The hooks,
the PAT scopes, one worktree per run and `maxParallel: 2` are the gate. After the first ten runs,
read the transcripts for rules the hooks should learn.

## Workflows (`.ai/cezar/workflows/`)

Every om workflow is a `command` step that provisions the worktree, then one agent step whose
prompt is the skill as a slash command (`/om-… {{task}}`; never `skill:`, which would load the
thin `.ai/skills/` override alone). `allowedTools` is the full set for skills that write code and
drops `Edit`/`Write` for the ones that must not.

| Workflow              | Agent step                                                                 | Model                | Started by                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `issue-groom`         | `/om-auto-manage-issues {{task}} --prep-impl`                              | sonnet               | automation **Groom new issues** (`issue.opened`), **Re-groom on request** (label `groom`)                                                |
| `issue-autofix`       | `/om-auto-fix-issue {{task}}`                                              | opus                 | automation **Fix issues on the autofix label** (label `autofix`)                                                                         |
| `spec`                | `/om-auto-write-spec {{task}}`                                             | opus                 | automation **Write a spec for feature issues** (label `spec` on a `feature`)                                                             |
| `implement-spec`      | `/om-auto-implement-spec {{task}}`                                         | opus                 | a human, from the cockpit, after the spec PR merged - or `autofix` on the FR issue, which reaches the same skill through `issue-autofix` |
| `pr-autopilot`        | `/om-pr-autopilot {{task}}` (no `--allow-merge`)                           | opus                 | automation **Autopilot new pull requests** (`pull_request.opened` by a human maintainer)                                                 |
| `pr-review`           | `/om-auto-review-pr {{task}} --autofix`                                    | opus                 | a human, from the cockpit, on a PR number                                                                                                |
| `pr-fix`              | `/om-auto-fix-pr {{task}}`                                                 | opus                 | automation **Resolve blocking review threads** (label `review-threads` on a PR)                                                          |
| `housekeeping`        | `/om-review-prs`, `/om-merge-buddy`, `/om-close-fixed-issues --limit 50`   | opus, sonnet, sonnet | launchd via `.ai/scripts/housekeeping.sh`, or a human                                                                                    |
| `brainstorm`          | `/om-brainstorm {{task}}`, **Autonomous off**                              | opus                 | a human, from the cockpit, with the idea as the task                                                                                     |
| `triage`              | skill `afk-triage`                                                         | default              | automation **Triage new issues** (label `needs-triage`)                                                                                  |
| `implement-ticket`    | `om-fix` from the Agent Brief, the gate, `om-open-pr`, `om-auto-review-pr` | default              | automation **Implement ready-for-agent issues** (label `ready-for-agent`)                                                                |
| `spec-to-tickets`     | skill `afk-to-tickets`                                                     | default              | automation **Spec to tickets** (schedule, weekdays 07:00)                                                                                |
| `architecture-review` | skill `afk-architecture-review`                                            | default              | automation **Weekly architecture review** (schedule, Mondays 06:00)                                                                      |
| `lessons`             | skill `afk-lessons`                                                        | default              | automation **Weekly lessons** (schedule, Fridays 16:00)                                                                                  |

The task text an automation sends is the issue or PR number alone (`{{github.number}}`); a second
token would read as a brief to `om-auto-fix-issue`. From the cockpit type the same: a number, a
spec path, or for `brainstorm` the idea.

Provisioning is `scripts/worktree/bootstrap.sh --profile worktree --no-seed` (deps, route tree,
`.dev.vars`, local D1 with airports, basemap when cached; no server), or only `pnpm install` and
`pnpm generate-routes` for the read-only workflows. The validation gate the skills run is
`validation.commands` in `.ai/agentic.config.json`, which leaves the full journeys to CI (ADR 0021).
`bash .ai/scripts/e2e.sh`, which a run uses for the journeys its diff reaches, starts the app through
`.ai/scripts/test-env-up.sh` on a free port from 3030-3040 (`om-prepare-test-env` contract). That
server is deliberately left running for the rest of the run to reuse, so nothing else would ever
stop it: under `E2E=1` `vite.config.ts` therefore has it watch for its own root disappearing and
send itself `SIGTERM` when it does, which is what keeps a removed worktree from leaving a process
holding one of the eleven ports for the life of the host (issue #327).

The four older workflows (`triage`, `plan`, `plan-area`, `implement-ticket`), the scripts in
`scripts/agent/` they called and the four process skills built on them are gone (PR C, ADR 0018).
The automations that used to start them (`triage-opened`, `triage-relabel`, `implement`) had
already been removed from the cockpit. `triage` and `implement-ticket` are names reused by the
kit's unattended intake ladder (the last five rows, `SDLC.md` § Intake labels), not those workflows
restored: `triage` and the three schedule workflows run the `afk-*` skills, `implement-ticket` chains
`om-*` steps from the Agent Brief instead; none of the five name a model, so they run on the
cockpit's default.

## Automations (`docs/agents/cezar-automations.json`)

Registered with the running cockpit by `.ai/scripts/cez-automations.sh` (idempotent: update in
place or create enabled; it lists definitions the cockpit holds that the file no longer names, and
`--prune` deletes them, so this file is the whole truth about what can start a run - it refuses to
delete an enabled stray, which is somebody's deliberate act, not a leftover).
Renaming a definition is the one change that idempotency does not cover: the script matches the
cockpit by `.name`, so a renamed definition is created beside the old one, which it then keeps
because it is still enabled. Rename in lockstep with the cockpit - disable the old name, then
`--prune`, the drill step 2 of the host cutover below walks through.

Eleven definitions, in two kinds. Eight are GitHub polls, started by an event:
**Groom new issues** on `issue.opened` with `authors` naming the human maintainers;
**Re-groom on request**, **Fix issues on the autofix label**, **Write a spec for feature issues** on `issue.labeled` with `changedLabels` `groom` /
`autofix` / `spec`; **Autopilot new pull requests** on `pull_request.opened`, again with `authors`;
**Resolve blocking review threads** on `issue.labeled` with `changedLabels` `review-threads`, the one that reaches
a pull request (next section); and the intake pair, **Triage new issues** and **Implement
ready-for-agent issues**, on `issue.labeled` with `changedLabels` `needs-triage` / `ready-for-agent`.
Three are schedules (`kind: "schedule"`), started by the clock and by nobody's action:
**Spec to tickets** on weekdays at 07:00, **Weekly architecture review** on Mondays at 06:00 and
**Weekly lessons** on Fridays at 16:00. A schedule reads the repository, not an issue body, so it
has no author to gate; what bounds it is its skill - at most one spec sliced, three refactor issues
or one pull request per run. Every event trigger is gated on who can produce it: the open events by
author, the label events because only a collaborator can set a label. This matters because the agent step holds Bash with no allowlist and
the issue body is its prompt: an issue anyone on GitHub can open must not start a run by itself,
so an external report is groomed when a maintainer adds `groom`, and the Sentry sweep (which files
as the Actions bot, a login the poller's author filter cannot express) files with `groom`
already on. Agent PRs (authored by `design4pro-agent`, already reviewed inside their chain) and dependabot
never enter the autopilot. Every filter excludes `in-progress`; `lookbackDays: 3` and
`maxRecords` 5-10 bound a mistaken mass relabel to a handful of runs (the intake pair looks back
`7` days). The three command labels are the only things a human uses to start om code-writing
work, and no skill adds them (the overrides say so), so no om run can start another. The intake
ladder is the deliberate exception: its runs do set its labels - `afk-triage` sets
`ready-for-agent`, `afk-to-tickets` sets it on the ticket frontier, `afk-architecture-review` sets
`needs-triage` on its own issues - and that is how one of them starts the next.
A review or autopilot run checks out the PR's head, hooks and agent layer included: a branch
cut before the om cutover carries the old agent layer, so merge `develop` into such a branch
before opening the PR (money-tracker.online PR #67, 2026-09-07).

## Review threads that block a merge (Resolve blocking review threads)

The `develop` and `main` rulesets refuse a merge while a review thread is unresolved, and nothing
resolves the threads the `claude-review` job opens. Until this automation a maintainer cleared them
by running `om-auto-fix-pr` by hand on every PR the review job had commented on.

It cannot be a webhook. Cezar 0.11.0 knows four automation events - `issue.opened`,
`issue.labeled`, `issue.unlabeled`, `pull_request.opened` - and none of them is a review; worse, the
upstream poller scopes its label source to `is:issue` and then drops any hit carrying
`pull_request`, so even a label on a PR is invisible to it. `pull_request.opened` is the only PR trigger there is, and it
fires minutes before the review job posts anything. So the chain is:

1. `.github/workflows/claude-code-review.yml` ends with `scripts/ci/review-threads-label.mjs`,
   which applies `review-threads` when the PR has live threads opened by the review bot.
2. A commit on the design4pro/cezar fork
   (`feat(automations): filters.includePullRequests polls label events on pull requests`) teaches
   the poller to honour `filters.includePullRequests` on both gates. It is opt-in per automation -
   the fork declares the key in the filter schema and it defaults to false - which is what keeps **Re-groom on request**,
   **Fix issues on the autofix label** and **Write a spec for feature issues** from starting to fire on PRs that happen to carry their label.
   **Without that commit this automation never fires and says nothing**; keep it through every
   rebase onto an upstream release until upstream ships the filter.
3. **Resolve blocking review threads** runs the `pr-fix` workflow, and `om-auto-fix-pr` replies in every thread and
   resolves the ones it settles. A finding it agrees with but cannot act on - a guarded file it is
   still refused, a change that belongs upstream - is **not** a decline: it replies with the exact
   edit as a diff block, leaves `changes-requested`, and resolves the thread anyway
   (`.ai/skills/om-auto-review-pr/SKILL.md`). Only a disagreement leaves a thread open.

The loop is closed at the head, not at the thread. The run's first mutation takes `in-progress`
and only then removes `review-threads` (`.ai/skills/om-auto-fix-pr/SKILL.md`), so the PR is never
both untriggered and unclaimed while the run's own push moves the head (#490), and the labelling
script keeps one marker comment naming the head it last armed, so the same head is never armed
twice. That matters because a thread
the run **declines** stays open on purpose - a disagreement is a human's to settle - and without the
marker the `reopened` and `ready_for_review` triggers would restart the same run to reach the same
conclusion forever. `in-progress`, `blocked` and `do-not-merge` stand the script down, and the
automation excludes them again.

**And the `in-progress` stand-down is why, for its first weeks, this chain never ran at all.**
**Autopilot new pull requests** fires on `pull_request.opened` and takes `in-progress` within a minute; the review
job needs five to eight, so step 1 above was never once asked at a moment when the claim was
absent - `not arming - the PR carries in-progress` on #320, #321 and #322, and zero `pr-fix` runs
in the cockpit's recorded history. The stand-down is right (a run that owns the PR should not have
a second one started beside it); what was missing is a second ask. The workflow now also listens
for `pull_request.unlabeled`, and a separate job re-runs the same script when the label removed is
`in-progress`. Same decision, same head-keyed marker - so a run that declines every thread and
pushes nothing cannot re-arm itself when it drops its own claim - only asked at the first moment
the answer can be anything but "held".

The gate is the same as for `groom` and `autofix`: only a collaborator or the Actions bot can set a
label, so an outsider cannot start a run that holds an unrestricted Bash. A human's review thread is
deliberately not a trigger - the script arms only on the review bot's threads, because a
disagreement with a person is settled by talking. Rehearse the decision against any live PR with
`GH_REPO=… PR_NUMBER=… HEAD_SHA=… node scripts/ci/review-threads-label.mjs --dry-run`.

## Prompt templates (`docs/agents/cezar-prompt-templates.json`)

Installed into the cockpit by `.ai/scripts/cez-prompt-templates.sh` (`--dry-run` lists what it
would write). One template per `om-*` skill, 37 of them: the task text with its argument
placeholder, the flags, and the preconditions the skill's `SKILL.md` and its `.ai/skills/`
override state, phrased as directives because the text is sent as the task. They replace cezar's
five generic built-ins. The installer `PUT`s `promptTemplates` to
`/api/v1/p/planned-travel/ui-state`, which merges shallowly at the top level, so it rewrites that
one array and leaves every other preference alone; the store is `.ai/cezar/ui-state.json`, which
is gitignored because it also accumulates per-developer state (`skillUsage`, `lastTask`,
`appearance`). Edit the tracked JSON and re-run the script - never the ui-state file by hand.

Cezar's normalizer truncates and drops silently, so the script checks the caps first: at most 50
templates, `label` 80 characters, `text` 2000, ids unique and matching an installed skill.
A template whose `skills` array names the skill selected in the composer is applied automatically,
but only while the composer is still pristine. That is why only the 19 skills taking a free-text
brief or no argument carry `skills`; the 18 that take an issue number, a PR number, a spec path or
a URL carry none and are reached through "Insert a template". From the GitHub issue or PR panel an
auto-applied template lands as `<number>` + the template text, and a second token there reads as a
brief to `om-auto-fix-issue` - the same hazard the automations avoid by sending
`{{github.number}}` alone.

## Housekeeping

Cezar has no scheduler. `.ai/scripts/housekeeping.sh` POSTs one `housekeeping` run to the cockpit
(`/api/v1/p/planned-travel/runs`) and falls back to a headless `cezar run` when the cockpit is
down, or exits 1 when `cezar` is not on PATH - there is no npx fallback, since upstream lacks the
fork's fixes; launchd calls it at 07:00, 12:00 and 17:00 on weekdays. Install (template in
`.ai/scripts/launchd/`):

```bash
sed -e "s|__REPO_ROOT__|$PWD|g" -e "s|__PATH__|$(dirname "$(command -v cezar)"):$(dirname "$(command -v node)"):$(dirname "$(command -v gh)"):/usr/bin:/bin|g" \
  .ai/scripts/launchd/dev.planned-travel.housekeeping.plist > ~/Library/LaunchAgents/dev.planned-travel.housekeeping.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.planned-travel.housekeeping.plist
```

launchd gives the job only the substituted PATH, so check `cezar` resolves there, not in your shell:
`env -i PATH="$(plutil -extract EnvironmentVariables.PATH raw ~/Library/LaunchAgents/dev.planned-travel.housekeeping.plist)" /bin/bash -c 'command -v cezar node gh curl'`
must print four paths. The job runs `bash -lc`, whose profile normally only extends that PATH, so this
non-login check is the stricter of the two. `jq` is optional: without it the log omits the run id.

Remove with `launchctl bootout gui/$(id -u)/dev.planned-travel.housekeeping`. Log:
`.ai/cezar/tmp/housekeeping.log`. Run it by hand any time: `bash .ai/scripts/housekeeping.sh`.

A `review-prs` step that claims a PR and exits without releasing it leaves an `in-progress` lock
nobody holds, and the same run's `merge-buddy` step then skips that PR (#551).
`scripts/agents/release-leaked-claims.mjs --since <sweep start> --prs <dispatched PRs>` releases
such a claim and comments whether any review was submitted. It only acts on an `om-auto-review-pr`
claim by the automation account that is the PR's only lock event since `--since`: a take-over, or a
newer claim after a release, belongs to a live run and is left alone. Run it by hand with `--dry-run` to see what it would release.

## Host cutover (operator, once, after PR B merges)

The order is fixed by the labels: the SDLC taxonomy already exists (PR A); the old automations
must stop before `status:*` is stripped and the surviving labels renamed.

1. Unload the sweeper: `launchctl bootout gui/$(id -u)/dev.planned-travel.sweeper` and delete
   `~/Library/LaunchAgents/dev.planned-travel.sweeper.plist`.
2. In the cockpit (Automations) disable `triage-opened`, `triage-relabel` and `implement`, then
   delete them with `bash .ai/scripts/cez-automations.sh --dry-run --prune` and the same without
   the flag. All three are superseded: `implement` by **Fix issues on the autofix label**, and the triage pair by the
   groom layer - a Sentry finding reaches it because the sweep files `groom` on creation and
   GitHub records that as a `labeled` timeline event, which is what the poller reads.
3. Snapshot: `gh label list --limit 200 --json name,color,description > docs/agents/migration/labels-$(date +%F).json`
   and `gh issue list --state open --limit 500 --json number,labels > docs/agents/migration/issues-$(date +%F).json`;
   commit both.
4. `bash .ai/scripts/labels-cutover.sh` (dry run), read it, then `--apply`: holds move to
   `blocked`, `status:*` leaves every open issue, `run:*`, `type:*` and `agent-docs` move to their
   SDLC names. `prd`, `auto-advance`, `agent-pr` and the empty `status:*` labels waited for
   PR C, and were deleted on 2026-09-08 (docs/agents/triage-labels.md).
5. The cockpit service already runs the design4pro/cezar fork
   (`~/Library/LaunchAgents/dev.cezar.cockpit.plist`, set up per `design4pro/cezar`'s
   `docs/host/README.md`);
   confirm `.ai/cezar/config.json` in the main checkout is the merged one, then restart the service
   while it has no active runs (`launchctl bootout gui/$(id -u)/dev.cezar.cockpit`, then
   `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.cezar.cockpit.plist`) so it reloads
   the workflows.
6. `bash .ai/scripts/cez-automations.sh --dry-run`, then without the flag: the five new automations
   are created enabled.
7. Install the housekeeping plist (above) and run `bash .ai/scripts/housekeeping.sh` once by hand.
8. Verify end to end on a test issue: open it with the Bug form (as a maintainer) → within two minutes an
   **Groom new issues** run adds priority and risk and posts the Definition of Ready and implementation
   notes → add `autofix` → the run removes the label, claims with `in-progress`, opens a draft PR on
   develop and ends with it ready, labelled `review` + category + `needs-qa|skip-qa` + priority +
   risk, with a run-summary comment and the `PR: #n` line in the cezar run → merge it → the next
   housekeeping closes the issue. Then open a PR by hand: **Autopilot new pull requests** reviews it and does not
   merge.

## Local use

Every workflow's skill runs the same way in a local `claude` session, with the developer's `gh`:
`/om-auto-fix-issue <n>`, `/om-auto-write-spec <n>`, `/om-auto-implement-spec <spec>`,
`/om-auto-review-pr <pr> [--autofix]`, `/om-pr-autopilot <pr>`, `/om-review-prs`,
`/om-merge-buddy`, `/om-close-fixed-issues`, `/om-brainstorm`. Hand-worked branches go through
`/om-check-and-commit` and `/om-open-pr`. The hooks are the project's, so nothing depends on the
host's user-level configuration.
