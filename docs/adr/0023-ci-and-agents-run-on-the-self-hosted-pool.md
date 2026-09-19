# 0023. CI and the agents run on the self-hosted pool; shipping stays on GitHub-hosted runners

Status: accepted
Date: 2026-09-19
Records: the runner migration of #495, #497, #498 and #563, which was decided in workflow comments
and pull request descriptions and never written down as a decision.
Amends: ADR 0021 (the variable half of its recovery path: `vars.RUNNER_CI` alone does not bring
back the required `claude-review` check; `vars.RUNNER_AGENT` is needed too).

## Context

Until 2026-09-14 every workflow in this repository named `ubuntu-latest`. Actions minutes were the
cost that moved it: measured over the four days from 2026-09-10, `ci.yml` alone was the
organisation's second largest Actions line item - 1,634 minutes across 144 runs (#495). ADR 0016 had
already made that suite run on every pull request event, so the cost grew with the rate of work,
and the agents are what set that rate.

The organisation already had a machine that could carry it: the host that runs cezar. agent-kit's
`host/runner` turned it into a pool of self-hosted runners - containers built `FROM` the Playwright
image this repository pins, registered with GitHub under labels rather than names. The migration
moved onto it in phases, each merged and green before the next:

| Phase | Where                          | What moved                                                                                        |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1     | agent-kit, `render-parity.yml` | the kit's own check                                                                               |
| 2     | money-tracker.online #287      | three browser legs and a full axe scan on arm64: 539 tests passed, none skipped, no new violation |
| 3     | #495                           | all of `ci.yml`, and the `container:` block on `e2e`, since the runner already is that image      |
| 4     | #497 (agent-kit 35)            | `claude.yml`, `claude-code-review.yml`, `merge-gate.yml`                                          |
| 5     | #498                           | `deploy.yml`, `deploy-staging.yml`, `promote-develop.yml`, `rollback.yml`, `sentry-triage.yml`    |
| 6     | the host (agent-kit, operator) | durability: `pool.sh` supervising, a LaunchAgent, `pmset`, OrbStack starting at login             |

Phase 5 left no workflow on a GitHub-hosted runner, and production deploying from one local machine.
Three days later #563 moved the deploys back out, for reasons recorded under the decision below.
The rule that holds today is therefore not "everything runs on the pool", and this record states
the one that does.

## Decision

**1. Every job selects its runner through an organisation variable, and no workflow names a runner
literally.** The expression is the same everywhere:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_CI || '["self-hosted","linux","ARM64","ci"]') }}
```

The variable is deliberately unset, so each job's own default decides. Setting it at organisation
level moves every job that reads it, in every repository, without a pull request. That is the point
of the indirection: a pull request is not a recovery path when the host that runs the merge gate is
the host that is down.

**2. Three variables, three defaults.**

| Variable        | Default                  | Jobs                                                                                                                                    |
| --------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNNER_CI`     | the pool's `ci` label    | every job in `ci.yml`, `merge-gate.yml`, `e2e-webkit.yml`, `promote-develop.yml`, and `claude-code-review.yml`'s `rearm-review-threads` |
| `RUNNER_AGENT`  | the pool's `agent` label | `claude.yml`, `claude-code-review.yml`'s `claude-review`, `sentry-triage.yml`'s `sweep`                                                 |
| `RUNNER_DEPLOY` | `["ubuntu-latest"]`      | `deploy.yml`, `deploy-staging.yml`, `rollback.yml`                                                                                      |

**3. The pool is two pools, and a job that spends tokens goes to `agent`.** The `ci` pool mounts
shared caches (the pnpm store) and is sized for throughput. The `agent` pool mounts nothing, takes
one job per container, registers `--ephemeral`, and recreates the container from an unmodified
image before the next job. Each of the three token-spending jobs needs that for a reason of its
own:

- **`sentry-triage.yml`'s `sweep` installs into `$HOME` on every run.** `claude.ai/install.sh`
  writes to `$HOME/.local/bin`; on a runner that outlived its job those installs would accumulate.
- **`claude-review` runs with `bypassPermissions`, which is only safe on a runner that does not
  outlive its job.** The permission mode was argued for on the grounds that "the runner is
  disposable". On `ubuntu-latest` that was a property of GitHub's platform; on the pool it is a
  property of two lines in `host/runner`, and only the `agent` pool has them.
- **`claude.yml` holds `contents: write` for forty turns** - nothing it leaves behind may reach the
  next job.

`rearm-review-threads` sits in `claude-code-review.yml` but runs on `ci`: it runs one repository
script and spends no tokens.

**4. Shipping runs on GitHub-hosted runners by default** (#563). `RUNNER_DEPLOY` inverts the
convention for the three jobs that change what users are served, for two reasons, neither of them
budget:

- **A deploy must not queue behind the pool.** The pool is a few CI slots (four on 2026-09-17) on
  one machine shared with money-tracker.online, and an agent's browser suite holds one for twenty
  minutes. The slot a deploy waits for is how long production stays on the old bundle.
- **A deploy has to run when the machine does not.** Phase 5 made `RUNNER_CI` "the recovery path
  for shipping", which made recovery a variable somebody has to remember to set, under exactly the
  conditions that make it hard to remember. A hosted default retires that lever.

`promote-develop.yml` stays on `ci`: it opens a pull request and deploys nothing.

## Consequences

- **CI and the agents stop costing hosted minutes, and start costing one machine's availability.**
  When the host is down, no pull request in either branch can merge through its checks: both the
  `main` and `develop` rulesets require `lint · typecheck · build`, `unit tests`,
  `e2e · merged report` and `merge-gate` (on `RUNNER_CI`) **and** `claude-review` (on
  `RUNNER_AGENT`). The admin bypass ADR 0021 names is the other way through, and it skips the checks
  rather than running them.
- **Recovering the checks during a host outage needs both pool variables.** Set `RUNNER_CI` and
  `RUNNER_AGENT` to `["ubuntu-latest"]`. With `RUNNER_CI` alone CI comes back and the promotion
  pull request opens green, and it still cannot merge, because the required `claude-review` check is
  queued against a dead `agent` pool. Unset both once the host is back.
- **A merged commit still reaches production through the pool.** `ci.yml` calls `deploy.yml` and
  `deploy-staging.yml` as its last jobs, behind `verify`, `test` and `e2e-report` (ADR 0021), which
  run on `RUNNER_CI`. The hosted default keeps a deploy from queueing and lets `workflow_dispatch` on
  `deploy.yml` or `rollback.yml` ship with the host down; the ordinary merge-to-deploy path still
  needs the pool, or the recovery above.
- **The host's durability is a requirement, not a nicety.** Every merge in this repository passes
  through it. Docker's `--restart always` handles a dying container, not a reboot, a sleeping Mac or
  an OrbStack that never came up - which is what phase 6 exists for. #498's own description asked
  for phase 6 to land before it; the move of the deploys in #563 lowered the stake from "production
  cannot ship" to "nothing can merge", and did not remove it.
- **The hosted default for deploys is plan-dependent.** Verified 2026-09-17 on the organisation's
  billing page: GitHub Team, 3,000 Actions minutes included. The deploy jobs across both repositories
  cost ~850 min of pool time over the preceding 30 days, ~1,900 hosted minutes at the ~2.2x a 2-core
  hosted runner costs against these containers. That fits Team and does not fit GitHub Free's 2,000.
  If the organisation is ever downgraded, set `RUNNER_DEPLOY` to `["self-hosted","linux","ARM64","ci"]`
  before the next deploy. The premise was wrong once already: the API reported `plan: free` while
  #563 was being written, and the split was reverted and re-applied on the billing page's word.
- **A job moved to another runner assumes nothing from the image.** Phase 4 died on `unzip` and `gh`,
  two binaries `ubuntu-latest` ships and the pool image did not. `CODE_REVIEW.md` now asks that a
  `runs-on` change show a run of the job on its new runner, and that every tool it calls is installed
  by the workflow rather than inherited; for a required check or a shipping job a gap blocks.
- **A `runs-on` change in the Claude workflows is half exercised by the pull request that makes it.**
  GitHub evaluates `runs-on` when it schedules the job, so the job lands on its new runner on the
  proposing branch - which is how phase 4 found `unzip` and `gh` missing (#497).
  `claude-code-action`'s OIDC exchange refuses a workflow that differs from the default-branch copy,
  so the review work itself settles only once the change reaches `main`.
- **Where the reasoning lives.** This record owns the why. The workflow comments keep only what an
  operator needs at the `runs-on` line - which variable, what unset means, what to set in an outage -
  and point here. `claude.yml`, `claude-code-review.yml` and `merge-gate.yml` are rendered by
  agent-kit, so their comments change there. How the host and the pool are run is agent-kit's README,
  "The runner pool".

## Alternatives rejected

- **Stay on GitHub-hosted runners.** No machine to keep up, and a cost that scales with every agent
  pull request. The suite ADR 0016 put on every event, run by agents that open pull requests
  unattended, is the workload hosted minutes price worst.
- **A self-hosted pool in the cloud.** It would remove the single machine, and it would bring back a
  bill that grows with the work, plus an image, a fleet and credentials to operate. The local host
  already exists and already runs the agents that produce the load; the durability it lacks is
  cheaper to add (phase 6) than a fleet is to run.
- **One pool without the `ci`/`agent` split.** Either every CI job pays for a fresh container and
  loses the pnpm store, or the token-spending jobs run with `bypassPermissions` and `contents: write`
  on a runner that carries state into the next job. Neither is acceptable, and two labels on one
  host cost almost nothing.
- **Everything on the pool, deploys included** - phase 5 as merged. Rejected by #563 for the two
  reasons under decision 4: a deploy queued behind an agent's suite, and a shipping path that needs
  an operator to remember a variable during an outage.
- **Literal label arrays in `runs-on`.** Simpler to read, and a revert then needs a pull request,
  which needs the merge gate, which needs the runners that are missing.
