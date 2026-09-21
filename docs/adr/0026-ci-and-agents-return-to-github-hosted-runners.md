# 0026. CI and the agents return to GitHub-hosted runners

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

The second point is the one that decides it. Cost is a number that can be paid or renegotiated; a
gate that only opens from one machine is a structural dependency, and it was accepted on the
strength of a fallback that did not work.

## Decision

**1. The two pool defaults invert.** The expression is untouched, the three variables are untouched,
and no workflow names a runner literally:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_CI || '["ubuntu-latest"]') }}
```

| Variable        | Default before   | Default now         | Jobs                                                                                                         |
| --------------- | ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RUNNER_CI`     | the `ci` pool    | `["ubuntu-latest"]` | every job in `ci.yml`, `merge-gate.yml`, `e2e-webkit.yml`, `promote-develop.yml`, `rearm-review-threads.yml` |
| `RUNNER_AGENT`  | the `agent` pool | `["ubuntu-latest"]` | `claude.yml`, `claude-code-review.yml`'s `claude-review`, `sentry-triage.yml`'s `sweep`                      |
| `RUNNER_DEPLOY` | hosted           | hosted (unchanged)  | `deploy.yml`, `deploy-staging.yml`, `rollback.yml`                                                           |

Setting `RUNNER_CI` to `["self-hosted","linux","ARM64","ci"]` puts CI back on the pool in every
repository without a pull request, and `RUNNER_AGENT` does the same for the three token-spending
jobs. **The pool is not dismantled. It is one variable away**, which is the whole point of keeping
the indirection rather than deleting it now that the default no longer needs it.

**2. The e2e environment brings its own browsers.** `.github/actions/e2e-env` gains a `browsers`
input (default `chromium`; `e2e-webkit.yml` passes `chromium webkit`, because `mobile-safari`
depends on the `setup` project and `setup` signs in through Desktop Chrome) and installs them with
`playwright install --with-deps` when `runner.environment == 'github-hosted'`. The condition is on
the environment rather than on a label, matching `.github/actions/setup`, so a job put back on the
pool skips a download the image already has.

This is what makes decision 1 safe, and it repairs the fallback in the direction ADR 0023 left
broken: after this, both defaults work on both kinds of runner, and the variable is a preference
rather than a gamble.

**3. `RUNNER_DEPLOY` stays a variable of its own, with the same default it had.** It now points at
the same side as the other two, which makes it look redundant; it is not. Keeping it separate is
what lets CI go back onto the pool for cost without dragging shipping with it. ADR 0023's two
reasons for the split are untouched by this record: a deploy must not queue behind a few slots
shared with another repository, and a deploy has to run when the machine does not.

## Consequences

- **Hosted minutes are a cost again, and measured on this change it is roughly four times what ADR
  0023's own figures suggested.** That record's 1,634 minutes per 144 runs extrapolates to about
  12,000 minutes a month, and that is the number this record carried when it was drafted. It is
  wrong, because the suite is not the one that was measured: e2e is sharded now and the unit suite
  has grown. Measured instead:

  | Measured                                                    |                                                                                       |
  | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
  | `ci.yml` runs, 7 days to 2026-09-21                         | 488, so ~2,100 a month                                                                |
  | average per run on the pool, sample of 20                   | 11.5 job-minutes                                                                      |
  | the same run hosted (PR #691) against a comparable pool run | 33.6 against 16 job-minutes, ~2.1x - matching the ~2.2x ADR 0023 stated independently |
  | hosted minutes a month at that rate                         | ~50,000                                                                               |
  | included on GitHub Team, less what the deploys already take | ~1,100                                                                                |

  At the Linux 2-core rate that is on the order of **$400 a month**, not the $80-120 first written
  here. It is the price of removing one machine from the merge path, it is a real invoice, and if it
  stops being worth paying the lever is one variable rather than a pull request. Decision 2 is what
  makes that lever safe to pull in either direction, so the cheap configuration remains reachable
  without re-opening this record.

- **A hosted e2e shard pays for its browsers on every run.** `--with-deps` is apt, not a tarball, so
  it is the half no cache restores; that is why the step is a plain install and not
  `actions/cache`. If the measured cost per shard turns out to justify caching the browser
  binaries alone, that is a separate change with a number attached.
- **The architecture goes back from ARM64 to x64.** That is not a new configuration: it is the one
  every workflow in this repository ran on until 2026-09-14, and the one ADR 0022's nightly WebKit
  suite was sized against before the migration. The pool remains ARM64 for anyone who sets the
  variable, and `e2e-env` installs the right binaries either way.
- **`bypassPermissions` rests on the platform again, which is the stronger footing.** ADR 0023's
  decision 3 argued the `agent` pool was needed because `claude-review` runs with that permission
  mode and it is only safe on a runner that does not outlive its job - noting that _"on
  `ubuntu-latest` that was a property of GitHub's platform; on the pool it is a property of two
  lines in `host/runner`"_. Those two lines are no longer what the guarantee depends on.
- **The single machine leaves the merge path.** A host outage now costs the cezar runs it hosts and
  nothing in CI. What replaces it as a dependency is GitHub's own availability, which is the
  dependency every other part of this pipeline already has.
- **The pnpm store changes shape, and the action already knew.** `.github/actions/setup` selects the
  pool's mounted store or `actions/setup-node`'s `cache: pnpm` from `runner.environment`; nothing
  there needs editing, and the hosted path is the one it measured at 13-18 s from an empty store.
- **This is written here only.** `money-tracker.online` carries a copy of this agent layer that is
  no longer kept in step with this one (ADR 0025). If the same move belongs there, it is a second
  ordinary change in that repository, with its own measurement.
