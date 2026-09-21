# 0026. Every runner variable defaults to the self-hosted pool, shipping included

Status: accepted
Date: 2026-09-21
Amends: ADR 0023. Its decision 4 is reversed - shipping no longer defaults to GitHub-hosted runners

- and the consequence it recorded and left standing, that the variable recovery path still leaves
  `e2e` red, is repaired here. Decisions 1, 2 and 3 survive verbatim.
  Amends: ADR 0021 (its recovery note inverts for one of the three variables: `RUNNER_DEPLOY` no
  longer needs setting to reach the pool, it needs setting to leave it).

## Context

ADR 0023 moved CI and the agents onto a pool of self-hosted containers on the machine that runs
cezar, and deliberately kept one exception. `RUNNER_DEPLOY` - `deploy.yml`, `deploy-staging.yml`
and `rollback.yml` - stayed on GitHub-hosted runners for two reasons, neither of them budget: a
deploy must not queue behind a pool of a few slots shared with money-tracker.online, and a deploy
has to run when the machine does not.

Two days later the pool's own place was questioned rather than the exception's. #692 proposed
moving CI and the agents _off_ the pool to Blacksmith ARM runners, on two arguments: one laptop sits
on the merge path of two repositories, and the escape hatch documented for exactly that was never
whole - with `vars.RUNNER_CI` set to `["ubuntu-latest"]` both e2e shards died on a missing browser
executable, so a code pull request could only reach `develop` through an admin bypass, which skips
the checks rather than running them.

That proposal was measured end to end, on green runs of this repository's own gate, and it is not
taken. The numbers are under Alternatives rejected; the short of it is that Blacksmith is roughly
half the price of GitHub-hosted and roughly the same speed, which buys about $285 a month of
invoice for a workload a machine the organisation already owns runs for electricity, and puts a
third party on the merge path to do it. Its first argument is answered by ADR 0023's phase 6 - the
supervision, the LaunchAgent, `pmset`, OrbStack at login - and its second is a real defect, not an
argument about hosting. It is repaired here, in decision 2, in the one place that fixes it on every
destination at once.

What that leaves is the exception. If CI and the agents stay on the pool because a machine we own is
cheaper than any invoice and answers to nobody, the same argument reaches shipping, and ADR 0023's
two reasons for holding it back are worth re-reading rather than inheriting. Both are about the pool
being unavailable or busy, and both were written when the way off the pool did not work.

## Decision

**1. `RUNNER_DEPLOY` defaults to the pool's `ci` label.** The expression is the one every other job
already uses, and no workflow names a runner literally:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_DEPLOY || '["self-hosted","linux","ARM64","ci"]') }}
```

| Variable        | Default before      | Default now                            | Jobs                                                                                                     |
| --------------- | ------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `RUNNER_CI`     | the `ci` pool       | the `ci` pool (unchanged)              | every job in `ci.yml`, `merge-gate.yml`, `e2e-webkit.yml`, `promote-develop.yml`, `rearm-review-threads` |
| `RUNNER_AGENT`  | the `agent` pool    | the `agent` pool (unchanged)           | `claude.yml`, `claude-code-review.yml`'s `claude-review`, `sentry-triage.yml`'s `sweep`                  |
| `RUNNER_DEPLOY` | `["ubuntu-latest"]` | `["self-hosted","linux","ARM64","ci"]` | `deploy.yml`, `deploy-staging.yml`, `rollback.yml`                                                       |

`RUNNER_DEPLOY` stays a variable of its own, and that is now the whole of its job. It no longer
routes shipping somewhere different in the steady state; it exists so that shipping can be moved
_alone_, during an outage, without dragging the gate with it - and so that the reverse holds too,
that moving CI for cost never silently moves production with it. Setting it to `["ubuntu-latest"]`
ships the next deploy from a GitHub-hosted runner, with no pull request.

**The `ci` label rather than a new `deploy` one.** The pool has two labels, and adding a third is
work in `design4pro/cezar`'s `host/runner`, not in this repository. Both ADR 0021 and ADR 0023
already name `["self-hosted","linux","ARM64","ci"]` as where this variable points when it points at
the pool, so this makes the documented escape hatch the default instead of inventing a third pool
alongside it. If queueing turns out to be what hurts, a `deploy` label is a separate change with a
measurement attached.

**2. The e2e environment installs its browsers unconditionally.** `.github/actions/e2e-env` gains a
`browsers` input (default `chromium`; `e2e-webkit.yml` passes `chromium webkit`, because its
`mobile-safari` project depends on `setup`, and `setup` signs in through Desktop Chrome) and runs
`playwright install` on every runner, at the version `pnpm install` has just resolved from the
lockfile.

Gating that on the runner would be a latent bug rather than an optimisation. Exactly one image in
play carries the browsers - the pool's, built `FROM mcr.microsoft.com/playwright` - and no context
can see that: `runner.environment` reports `self-hosted` for the pool and for any other non-GitHub
runner alike. Capability is not ownership. The install is idempotent, costs seconds against a store
that already holds the right build, and repairs a drifted one instead of failing mid-suite.

The system libraries are the one part that stays conditional, and on a capability rather than on an
identity: `--with-deps` is apt, and playwright-core runs apt under `sudo` when the process is not
root, falling back to `su root -c`, which cannot work unattended. The pool's container runs as an
unprivileged `runner` with no sudo - and needs none, being built FROM the Playwright image - so the
step asks for the libraries only where `id -u` is 0 or `sudo` exists, and for the browsers
everywhere.

This is what makes decision 1 safe to accept. The hosted fallback stops being documentation and
becomes a path that runs the whole gate green, which matters more now than it did under ADR 0023,
not less: all three variables point at one machine.

## Consequences

- **The two reasons ADR 0023 gave for the exception are now costs paid rather than costs avoided,
  and neither has disappeared.** A deploy queues: the pool was four CI slots on 2026-09-17, shared
  with money-tracker.online, and a browser suite holds one for twenty minutes (ADR 0023). The slot a
  deploy waits for is how long production stays on the old bundle. And a deploy needs the host up -
  recovery is a variable someone has to remember to set, under exactly the conditions that make it
  hard to remember, which is the objection #563 raised and this record accepts. What answers it is
  not an argument but the escape hatch being real: one setting, no pull request, a path proven green
  on this suite (run 35583369840).
- **The host's durability requirement rises from "nothing can merge" to "nothing can merge and
  nothing can ship".** ADR 0023's phase 6 - `pool.sh` supervising, a LaunchAgent, `pmset`, OrbStack
  at login - is what that rests on, and it is now load-bearing for production and not only for the
  gate. `rollback.yml` is the sharp end: it is dispatched during an incident, and the incident may
  be the host. Its header says so at the `runs-on` line.
- **Actions minutes stop being a line item at all.** The deploy jobs were the last ones spending
  them: ~850 minutes of pool time across both repositories over the 30 days to 2026-09-17, about
  1,900 hosted minutes at the ~2.2x a 2-core hosted runner costs against these containers. GitHub
  Team's 3,000 included minutes stop being load-bearing, which also retires the plan-dependence
  those three workflow headers carried - the caveat that the hosted default fits Team and not Free.
  Against the alternatives priced below, the steady state is now electricity.
- **An e2e shard pays for its browsers on every run, on the pool as well.** It used to inherit them
  from the image. That is seconds against a warm store, and the apt half is skipped exactly where
  there is no sudo, which is the pool. The exchange is a condition that cannot be wrong for a cost
  that is measured in seconds.
- **The version coupling between `host/runner/Dockerfile` and `@playwright/test` is retired.** A
  drifted image is corrected at the start of the job rather than kept in step by hand, and a
  mismatch stops being reported as a missing executable.
- **A `runs-on` change still has to be shown running on its new runner** (`CODE_REVIEW.md`), and for
  a shipping job a gap blocks. All three of these workflows carry `workflow_dispatch`, so the
  evidence is a dispatched run rather than a merge.
- **Written here only.** `money-tracker.online` carries a copy of this agent layer that is no longer
  kept in step with this one (ADR 0025). If the same move belongs there, it is a second ordinary
  change in that repository.

## Alternatives rejected

- **Blacksmith ARM runners for CI and the agents (#692), measured and not taken.** The gate was run
  green end to end on 4-vCPU Blacksmith ARM (run 35587121453) and on GitHub-hosted
  (run 35583369840):

  | Job                        | Blacksmith 4 vCPU ARM | GitHub-hosted |
  | -------------------------- | --------------------- | ------------- |
  | `unit tests`               | **5.7**               | 9.3           |
  | `lint · typecheck · build` | 2.9                   | **2.3**       |
  | `e2e` shard 1/2            | 13.1                  | **12.4**      |
  | `e2e` shard 2/2            | 10.1                  | **8.9**       |
  | `e2e · merged report`      | 0.7                   | 0.6           |
  | `change scope`             | 0.1                   | 0.1           |
  | **total job-minutes**      | **32.5**              | 33.6          |

  Blacksmith is 1.6x faster on the one job that is purely processor-bound and slightly slower on
  every job that is not, because the e2e shards dominate this suite and are themselves dominated by
  setup. The saving is a price saving, not a speed saving - $0.005 a minute against $0.008 - which
  across the workload is on the order of **$285 a month against ~$550**. That is the whole case, and
  it is an invoice for a workload the organisation already owns a machine to run, plus a third party
  on the merge path of two repositories. Its durability argument is answered by phase 6; its e2e
  argument was correct and is fixed in decision 2, which fixes it for every destination rather than
  for one.

- **GitHub-hosted runners for everything.** Measured over the seven days to 2026-09-21 at **~71,000
  minutes a month, on the order of $550** - `ci.yml` ~50,700, `claude-code-review.yml` ~16,300,
  `claude.yml` ~3,900, against the ~1,100 minutes Team still includes once the deploys have taken
  theirs. ADR 0016 puts the journeys on every pull request event and the agents set the rate of
  those events, so this is the workload hosted minutes price worst.
- **A dedicated `deploy` label on the pool.** It would stop a deploy queueing behind a browser
  suite, which is the sharper of the two costs accepted above. It also needs a third container class
  in `design4pro/cezar` before this repository can point at it, and nobody has measured what a
  deploy actually waits for. Deferred to its own change, with that measurement.
- **Leaving `RUNNER_DEPLOY` on `ubuntu-latest`** - ADR 0023's decision 4, which is a defensible
  position and was the right one while the way off the pool did not work. Against keeping it: the
  availability argument is now a setting away rather than a broken path, and the steady state
  otherwise keeps a second runner environment alive for the one workflow family no pull request
  exercises - two images and two sets of assumptions about what the runner ships, which is how phase
  4 died on `unzip` and `gh` (ADR 0023).
