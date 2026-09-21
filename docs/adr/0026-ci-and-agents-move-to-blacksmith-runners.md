# 0026. CI and the agents leave the self-hosted pool for Blacksmith ARM runners

Status: accepted
Date: 2026-09-21
Supersedes: ADR 0023 (CI and the agents run on the self-hosted pool). Its decisions 1 and 4 survive
verbatim - the variable indirection, and shipping on a hosted default - and this record keeps them.
What it reverses is decision 2's two defaults.
Amends: ADR 0021 (its recovery path inverts: the variables now move jobs _onto_ the pool, and the
half that was never whole - `e2e` - is repaired here).

## Context

ADR 0023 moved every CI and agent job onto a pool of self-hosted containers on the machine that
runs cezar. The argument was cost, and it was measured: over the four days from 2026-09-10,
`ci.yml` alone was 1,634 minutes across 144 runs, the organisation's second-largest Actions line
item. ADR 0016 makes the critical journeys run on every pull request event, so the bill grows with
the rate of work, and the agents are what set that rate.

That decision is two days old. Reversing it this quickly is only honest if something is being paid
for that was not on the invoice, and there are two such things.

**One machine sits on the merge path of two repositories.** ADR 0023 stated this plainly under its
own consequences - _"The host's durability is a requirement, not a nicety. Every merge in this
repository passes through it"_ - and again: when the host is down, no pull request in either branch
can merge through its checks, because both rulesets require four checks on `RUNNER_CI` and one on
`RUNNER_AGENT`. The mitigation was phase 6: `pool.sh` supervising, a LaunchAgent, `pmset`, OrbStack
starting at login. That is a durability argument built on a laptop not sleeping.

**The documented escape hatch was never whole, and the gap was exactly the check that matters.**
ADR 0023 says it in its own words: setting `RUNNER_CI` and `RUNNER_AGENT` to `["ubuntu-latest"]`
brings back everything _except_ the browsers, because the `e2e` job lost its `container:` in phase 3
and `.github/actions/e2e-env` assumed a runner that already carried them. So the recovery path
recovered the documentation-only pull request and the promotion, and left a code pull request into
`develop` needing an admin bypass - which skips the checks rather than running them. A recovery path
that cannot recover the gate on code is a recovery path for the wrong failure.

The second point is what decides that the pool cannot stay the default. Cost is a number that can be
paid or renegotiated; a gate that only opens from one machine is a structural dependency, and it was
accepted on the strength of a fallback that did not work.

**Where it goes instead was decided by measurement, and the first measurement was wrong.** The
obvious destination was `ubuntu-latest`, and that is what this record proposed first, priced by
extrapolating ADR 0023's figures to about 12,000 minutes a month and $80-120. That estimate was
wrong twice over: it used a suite that no longer exists - e2e is sharded now and the unit suite has
grown - and it counted only `ci.yml`, while `RUNNER_AGENT` moves too. Measured properly over the
seven days to 2026-09-21, and proven end to end on a full green run of this repository's gate
(run 35583369840), GitHub-hosted is **~71,000 minutes a month, on the order of $550**. See the first
consequence for the derivation. That is a real invoice for what is, on this workload, a slow
machine: the same suite measured 2.1x the job-minutes it takes on ARM.

So the choice is not pool-versus-GitHub. It is: which hosted runner, given that the pool must stop
being the default and that GitHub's own is both the slowest and the most expensive of the options?

## Decision

**1. The defaults move to Blacksmith ARM runners.** The expression is untouched, the three variables
are untouched, and no workflow names a runner literally:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_CI || '["blacksmith-4vcpu-ubuntu-2404-arm"]') }}
```

| Variable        | Default before   | Default now                            | Jobs                                                                                                         |
| --------------- | ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RUNNER_CI`     | the `ci` pool    | `["blacksmith-4vcpu-ubuntu-2404-arm"]` | every job in `ci.yml`, `merge-gate.yml`, `e2e-webkit.yml`, `promote-develop.yml`, `rearm-review-threads.yml` |
| `RUNNER_AGENT`  | the `agent` pool | `["blacksmith-2vcpu-ubuntu-2404-arm"]` | `claude.yml`, `claude-code-review.yml`'s `claude-review`, `sentry-triage.yml`'s `sweep`                      |
| `RUNNER_DEPLOY` | hosted           | hosted (unchanged)                     | `deploy.yml`, `deploy-staging.yml`, `rollback.yml`                                                           |

The sizes differ on purpose. Blacksmith prices a runner linearly in its vCPU count, so 4 vCPU costs
exactly twice 2 vCPU per minute and is free on anything that parallelises - which the CI jobs do,
vitest across workers and Playwright across its own - while buying back the wall clock on a merge
gate a human waits for. The agent jobs parallelise across nothing: they spend their minutes waiting
on the Claude API, so extra cores would be billed for idling, and they take the smallest size.

**The pool is not dismantled, and neither is the GitHub-hosted path. Each is one variable away** -
`["self-hosted","linux","ARM64","ci"]` for the pool, `["ubuntu-latest"]` for GitHub - which is the
whole point of keeping the indirection ADR 0023 built rather than deleting it now that the default
has changed again. Three destinations, one setting, no pull request.

**2. The e2e environment installs its browsers unconditionally.** `.github/actions/e2e-env` gains a
`browsers` input (default `chromium`; `e2e-webkit.yml` passes `chromium webkit`, because
`mobile-safari` depends on the `setup` project and `setup` signs in through Desktop Chrome) and runs
`playwright install --with-deps` on every runner.

The first draft of this record gated that step on `runner.environment == 'github-hosted'`, and that
was a latent bug rather than an optimisation. Exactly one image in play carries the browsers - the
pool's, built `FROM mcr.microsoft.com/playwright` - and `runner.environment` cannot see that: it
reports `self-hosted` for a Blacksmith microVM just as it does for the pool, because Blacksmith
registers as an organisation self-hosted runner. The condition would therefore have skipped the
install on the very runner this record adopts, and failed the whole e2e gate. Capability is not
ownership, and the install is idempotent, costs seconds against a store that already holds the right
build, and repairs a stale one instead of failing mid-suite. Running it everywhere is both cheaper
to reason about and strictly safer than any condition that infers what an image contains from who
owns the machine.

This is what makes decision 1 safe on any of the three destinations, and it repairs the fallback in
the direction ADR 0023 left broken. It also removes a manual coupling: `host/runner/Dockerfile` in
design4pro/cezar no longer has to be kept in step with the `@playwright/test` devDependency by hand,
because a drifted image is now corrected at the start of the job rather than trusted.

**3. `RUNNER_DEPLOY` stays a variable of its own, and stays on `ubuntu-latest`.** It is now the only
one pointing at GitHub, which is deliberate rather than an oversight. Deploying is the one path that
ships production, it fits inside the minutes GitHub Team already includes, and it is the path with
the longest unbroken record of working. Leaving it where it is keeps a known-good route to
production while a new provider earns its place on the gate; moving it later is one line. ADR 0023's
two reasons for the split are untouched: a deploy must not queue behind a few slots shared with
another repository, and a deploy has to run when the machine does not.

## Consequences

- **The bill falls by roughly two thirds against GitHub-hosted, and the comparison is measured
  rather than extrapolated.** GitHub-hosted was priced at ~71,000 minutes a month:

  | Workflow                                 | Runs a month | Minutes a month, GitHub-hosted |
  | ---------------------------------------- | ------------ | ------------------------------ |
  | `ci.yml`                                 | ~2,100       | ~50,700                        |
  | `claude-code-review.yml`                 | ~2,500       | ~16,300                        |
  | `claude.yml` (almost all of them no-ops) | ~3,900       | ~3,900                         |
  |                                          |              | **~71,000**                    |

  `ci.yml`'s figure is 11.5 job-minutes per run on the pool, averaged over a sample of twenty,
  multiplied by 2.1 - the overhead measured by running this repository's own suite on both. The
  agent workflows carry no such multiplier, because those jobs wait on the Claude API rather than on
  the processor; `claude.yml` is almost entirely runs that gate themselves out in seconds, but a
  started job is billed rounded up to the minute, so they are not free. Against the ~1,100 minutes
  still included on GitHub Team once the deploys have taken theirs, that is on the order of **$550 a
  month**.

  On Blacksmith ARM the same gate was then run for real (run 35587121453, green, every job
  including both e2e shards), and the result is worth stating against the expectation, because the
  expectation was wrong again - this record first estimated $175 a month on the assumption that ARM
  job-minutes would land near the pool's:

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
  every job that is not. The e2e shards dominate this suite and they are dominated in turn by setup
  - `playwright install --with-deps` over apt, `pnpm install` against a store no cache restores
    here, migrations, a dev server - so four fast cores buy almost nothing there. The saving is
    therefore a price saving rather than a speed saving: **$0.005 per minute against $0.008, on
    roughly the same number of minutes**, or about 39% a run.

  Carried across the workload at the same ratio of partial and cancelled runs the pool sample
  showed, that is on the order of **$285 a month against ~$550** - a halving, not the two thirds
  first written here. The decision stands on that, and on the durability argument that is the real
  reason for it, but the number is half as good as the estimate and this is the second estimate in
  this record to have been optimistic. Nothing about CI cost is worth writing down here until it has
  been run.

  **Two measured follow-ups, neither taken here.** The e2e shards are setup-bound, not CPU-bound, so
  a 2-vCPU shard would likely cost meaningfully less than a 4-vCPU one at close to the same wall
  clock - that is a per-job size, not a per-variable one, and it needs its own measurement. And
  Blacksmith's own cache and sticky disks target exactly the setup minutes that dominate the shard.
  Each is a separate change with a number attached.

- **A third party joins the merge path.** This is the honest counterweight: the laptop leaves, and a
  vendor arrives. Blacksmith runs each job in an ephemeral Firecracker microVM with a just-in-time
  registration token, is SOC 2 Type 2, and holds no persistent access to the repository - but it can
  still have an outage, and when it does the gate stops. The difference from the pool is that the
  fallback is real and proven this time: `vars.RUNNER_CI` and `vars.RUNNER_AGENT` set to
  `["ubuntu-latest"]` move everything back to a path that ran this exact suite green, decision 2
  removes the browser gap that made the old fallback fictional, and neither needs a pull request.
- **The architecture stays ARM64.** Unlike a move to `ubuntu-latest`, this one changes nothing about
  the instruction set: it is what the pool already ran, what the WebKit suite of ADR 0022 was sized
  against, and what `e2e-env` installs the right Playwright binaries for either way. One fewer
  variable moves in this change than in the alternative it replaces.
- **`bypassPermissions` rests on hardware isolation.** ADR 0023's decision 3 argued the `agent` pool
  was needed because `claude-review` runs with that permission mode and it is only safe on a runner
  that does not outlive its job - noting that _"on `ubuntu-latest` that was a property of GitHub's
  platform; on the pool it is a property of two lines in `host/runner`"_. On Blacksmith it is a
  property of KVM and a microVM destroyed with all its state when the job ends, which is the
  strongest of the three footings, not a compromise.
- **An e2e shard pays for its browsers on every run, on every runner.** `--with-deps` is apt, not a
  tarball, so it is the half no cache restores; that is why the step is a plain install and not
  `actions/cache`. Decision 2 accepts that cost on the pool as well, where it used to be skipped, in
  exchange for a condition that cannot be wrong. If the measured per-shard cost justifies caching
  the browser binaries alone, that is a separate change with a number attached.
- **The pnpm store keeps no cache here, and that is the measured choice.** `.github/actions/setup`
  enables `actions/setup-node`'s `cache: pnpm` only on GitHub-hosted runners, so on Blacksmith an
  empty store is filled from the registry - 13-18 s, against the 60 s the ~209 MB GitHub cache
  tarball took to cross the network from outside GitHub. Blacksmith sells a faster cache of its own
  and a sticky-disk option; adopting either is a separate change with a measurement attached, not a
  side effect of moving the runner.
- **The single machine leaves the merge path.** A host outage now costs the cezar runs it hosts and
  nothing in CI.
- **This is written here only.** `money-tracker.online` carries a copy of this agent layer that is
  no longer kept in step with this one (ADR 0025). If the same move belongs there, it is a second
  ordinary change in that repository, with its own measurement.
