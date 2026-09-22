# 0026. The way off the pool runs the whole gate; shipping stays off the pool

Status: accepted
Date: 2026-09-21
Amends: ADR 0023. The consequence it recorded and left standing, that the variable recovery path
still leaves `e2e` red, is repaired here (decision 1). Its decision 4 was reconsidered and stands,
on a reason it did not give (decision 2). Decisions 1, 2 and 3 are untouched.
Amends: ADR 0021 (its recovery note: `vars.RUNNER_CI` set to `["ubuntu-latest"]` now brings back a
green `e2e` as well).

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
argument about hosting. It is repaired here, in decision 1, in the one place that fixes it on every
destination at once.

What that left was the exception. If CI and the agents stay on the pool because a machine we own is
cheaper than any invoice, the same argument seemed to reach shipping, and #701 first moved
`RUNNER_DEPLOY`'s default onto the pool's `ci` label. Review stopped it on a reason neither ADR 0023
nor that first draft weighed: the `ci` pool is not a trust boundary, and a deploy holds production
credentials. Decision 2 records why the exception stays.

## Decision

**1. The e2e environment installs its browsers unconditionally.** `.github/actions/e2e-env` gains a
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

This is what makes the hosted fallback a path rather than documentation: `vars.RUNNER_CI` and
`vars.RUNNER_AGENT` set to `["ubuntu-latest"]` now run the whole gate green (run 35583369840).

**2. `RUNNER_DEPLOY` keeps its GitHub-hosted default.** ADR 0023's decision 4 stands, and the
expression is unchanged:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_DEPLOY || '["ubuntu-latest"]') }}
```

ADR 0023's two reasons still hold, but they are about availability, and decision 1 makes both a
setting away. The reason that does not become a setting away is what a deploy would share with the
code it has not vetted. The `ci` pool runs every pull request's code, and a job there can write to
three things the next job on the pool reads:

- **The `gha-pnpm-store` volume**, mounted read-write into every `ci` container
  (`host/runner/pool.sh` in design4pro/cezar) and wired into `pnpm install` by
  `.github/actions/setup`. A package or a side-effects-cache entry planted there is installed into
  the next deploy's `node_modules` and run.
- **The `gha-toolcache` volume** at `/opt/hostedtoolcache`, where `actions/setup-node` finds the
  `node` binary every later step runs - `wrangler` included, with the Cloudflare and Sentry
  credentials in its environment.
- **The container itself.** `--ephemeral` ends the runner after one job, but `--restart always`
  restarts the _same_ container, and a restart keeps its writable layer. What a job leaves in
  `$HOME` or on the image's paths is there for the next one.

On a GitHub-hosted runner none of the three exists: each job gets a fresh VM, and `cache: pnpm` is
a tarball restored per job and keyed on the lockfile. Skipping the pnpm store for deploys alone
would close the first of the three and leave the other two, so there is no change inside this
repository that puts shipping on the pool safely. That is a pool with no shared volumes and a
container recreated rather than restarted, which is work in design4pro/cezar.

## Consequences

- **`e2e` is green on any runner.** The hosted escape hatch for the gate stops being fiction:
  `vars.RUNNER_CI` and `vars.RUNNER_AGENT` set to `["ubuntu-latest"]` bring back every required
  check, without an admin bypass, during a host outage.
- **An e2e shard pays for its browsers on every run, on the pool as well.** It used to inherit them
  from the image. That is seconds against a warm store, and the apt half is skipped exactly where
  there is no sudo, which is the pool. The exchange is a condition that cannot be wrong for a cost
  that is measured in seconds.
- **The version coupling between `host/runner/Dockerfile` and `@playwright/test` is retired.** A
  drifted image is corrected at the start of the job rather than kept in step by hand, and a
  mismatch stops being reported as a missing executable.
- **Shipping keeps spending hosted minutes.** ~850 minutes of pool time across both repositories
  over the 30 days to 2026-09-17, about 1,900 hosted minutes at the ~2.2x a 2-core hosted runner
  costs against these containers. That still fits GitHub Team's 3,000 included minutes and not
  GitHub Free's 2,000, and the three workflow headers keep saying so.
- **Moving shipping onto the pool has a precondition now, not only a measurement.** Before
  `RUNNER_DEPLOY` may point at a self-hosted label, that label has to name containers that mount
  nothing and are recreated from the image after every job. For the same reason the lever ADR 0021
  and ADR 0023 name in the other direction, `RUNNER_DEPLOY` set to
  `["self-hosted","linux","ARM64","ci"]`, is withdrawn: it is a production deploy from the pool that
  runs pull requests.
- **Written here only.** `money-tracker.online` carries a copy of this agent layer that is no longer
  kept in step with this one (ADR 0025). If the same repair belongs there, it is a second ordinary
  change in that repository.

## Alternatives rejected

- **`RUNNER_DEPLOY` defaulting to the pool's `ci` label** - the first draft of #701. It would have
  made the steady state electricity and kept one runner environment instead of two. Rejected on
  decision 2's grounds: the deploy would inherit a pnpm store, a Node toolcache and a container
  that pull request code had write access to, while holding production credentials.
- **Deploys on the `agent` pool.** It mounts no volume, which closes two of the three channels, but
  its containers are restarted rather than recreated like the `ci` pool's, and it runs `claude.yml`
  with `contents: write` on untrusted input. It would also queue a deploy behind forty-turn agent
  runs on two slots.
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
  argument was correct and is fixed in decision 1, which fixes it for every destination rather than
  for one.

- **GitHub-hosted runners for everything.** Measured over the seven days to 2026-09-21 at **~71,000
  minutes a month, on the order of $550** - `ci.yml` ~50,700, `claude-code-review.yml` ~16,300,
  `claude.yml` ~3,900, against the ~1,100 minutes Team still includes once the deploys have taken
  theirs. ADR 0016 puts the journeys on every pull request event and the agents set the rate of
  those events, so this is the workload hosted minutes price worst.
