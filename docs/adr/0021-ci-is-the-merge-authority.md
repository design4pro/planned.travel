# 0021. CI is the merge authority, and the local gate is the fast loop

Status: accepted
Date: 2026-09-15
Amends: ADR 0016 (decision 6: which pull requests run the journeys, and where they run before one opens), ADR 0003 (staging and production deploy only behind a green CI run).

## Context

Every change was verified twice on one machine, and neither verification decided anything.

**The local gate ran the whole journey suite, and so did CI, on the same host.** `validation.commands`
ended in `bash .ai/scripts/e2e.sh`, so every cezar run started a dev server and walked the suite
before it pushed, and CI walked it again on the self-hosted pool - three 3-CPU containers
(`GHA_RUNNER_CI_COUNT=3`) inside the OrbStack VM on the same Mac. With up to four cezar runs in
parallel the host measured a load of 165-190 on 16 cores. PR #518, which changed a spec and the spec
index and nothing else, went red twice on Playwright's 15 min `globalTimeout`, and the push run on
`develop` failed the same way at the same time.

**CI gated nothing.**

- The `develop` and `main` rulesets required `claude-review` and no other check. #524 merged with
  both e2e shards cancelled.
- `e2e · merged report` was green over failed shards, because `playwright merge-reports` exits 0
  whatever the shards found (run 34956377809, PR #518: both shards failed, the report passed).
- `deploy-staging.yml` and `deploy.yml` ran on `push`, started by the same push as CI and reading
  nothing from it, so a red commit deployed exactly like a green one.

**What CI caught that the local gate did not.** Over the 50 pull requests merged into `develop` from
#429 to #527, CI failed on 24 run attempts across 10 of them:

| Cause                                                           | Attempts | Pull requests                |
| --------------------------------------------------------------- | -------- | ---------------------------- |
| A defect in the diff, fixed by a later commit                   | 10       | #435, #438, #453             |
| The merge result: base moved, or `develop` itself was broken    | 4        | #431, #468, #475             |
| Infrastructure or flake (timeouts, lost runner, green on rerun) | 9        | #435, #442, #497, #519, #522 |
| Unknown (`startup_failure`, no log)                             | 1        | #468                         |

Seven of the ten real failures were in the journeys. Two of them are classes the local gate cannot
see at all: a mobile-safari layout failure (#438, run 34652512129) - `e2e.sh` runs
`--project=chromium` only - and a fixture the new test borrowed and did not give back (#435), which
shows up only against a clean database. _Amended by ADR 0022: the first of those two classes is no
longer caught here either. `mobile-safari` came off the pull-request path and runs nightly, so a
WebKit layout failure of #438's shape now surfaces against `develop` within a day rather than on the
branch that caused it. The rest of this ADR's argument stands - CI is still the merge authority, and
still tests the merge commit against a clean database - but its evidence is one class lighter, and
that class was traded for runner time knowingly._ The four merge-result failures are what testing a
branch instead of the merge commit misses by construction; one of them was `develop` broken by #463
and #465 landing together. Many of the failures were on intermediate checkpoint pushes, and nothing records
whether the local gate ran on those, so this measures what CI catches, not exactly what the gate
missed.

**The unit suite was sharded for a machine it no longer runs on.** Three shards and a merge job were
sized on a 2-vCPU GitHub-hosted runner, where one job took 361 s. In a pool container (3 CPUs, 6 GB)
the whole suite with coverage measures 139 s, and one shard 43 s against 42 s in CI. The shards took
42/50/56 s plus about 19 s of fixed cost each and a 36 s merge job: about 45 s less wall clock when
three slots are free, for three more jobs on a pool that has three.

## Decision

**1. The local gate is the fast loop.** `validation.commands` is `agent-kit-check`, `typecheck`,
`lint`, `test`, `check-generated`, `build`. _Amended by ADR 0025: `agent-kit-check` is gone with the
kit that needed it, so the gate now starts at `typecheck`. Nothing else in this decision moves._ The
full journeys leave it. A run whose diff reaches a screen still runs the journeys that screen is in,
`bash .ai/scripts/e2e.sh e2e/<file>.spec.ts`, as the `verifying-changes` ladder says.

**2. CI is the merge authority.** Both rulesets require `lint · typecheck · build`, `unit tests`,
`e2e · merged report` and `merge-gate`, next to `claude-review`. A job skipped by its `if` reports
success to a required check, so neither a develop→main pull request (which defers to the push run)
nor a documentation-only one (decision 4) is held by a check that did not run.

**3. `e2e · merged report` is the journeys' verdict.** It fails unless `needs.e2e.result` is
`success`, the aggregate over the matrix, so a failed, cancelled or missing shard fails it. The ruleset
names this job and not the shards, whose check names move with the shard count.

**4. The journeys run on every pull request that can change what a browser sees.** A diff that stops
at `docs/`, `.ai/`, `.claude/` or Markdown outside `src/`, `e2e/` and `public/` skips them
(`scripts/ci/change-scope.mjs`, #527); anything the classifier does not recognise runs them. A push to
`develop` or `main` always does. This narrows ADR 0016's "every PR" to the PRs it was about.

**5. Deploys run behind a green CI run.** `ci.yml` calls `deploy-staging.yml` (push to `develop`) and
`deploy.yml` (push to `main`) as its last jobs, behind `verify`, `test` and `e2e-report`. CI no longer
cancels a push run, so a later merge cannot interrupt a deploy mid-migration; push runs queue, one
running and one pending per branch. `workflow_dispatch` stays on both deploys and waits on nothing -
for a redeploy, or for shipping while CI is down.

**6. The unit suite runs as one job**, `unit tests`, and the coverage thresholds apply to it directly.
`VITEST_SHARDED` and the blob merge go.

## Consequences

- **A merge waits for CI, and stalls when the pool does.** The recovery paths are the ones that
  already existed: `vars.RUNNER_CI` set to `["ubuntu-latest"]` moves every job to GitHub-hosted
  runners without a pull request, and organisation and repository admins bypass both rulesets.
  _Amended by ADR 0023: `vars.RUNNER_CI` alone brings CI back but not the required `claude-review`
  check, which runs on `vars.RUNNER_AGENT`; the variable path needs both set._
  _Amended by ADR 0023 (#563): beyond the `RUNNER_AGENT` jobs above, `vars.RUNNER_CI` also does not
  move the three shipping workflows - `deploy.yml`, `deploy-staging.yml` and `rollback.yml` - which
  read `vars.RUNNER_DEPLOY` and already default to GitHub-hosted runners. The lever in the other
  direction is `RUNNER_DEPLOY` set to `["self-hosted","linux","ARM64","ci"]`._
  _Amended by ADR 0026: that lever now points the other way. `RUNNER_DEPLOY` defaults to the pool
  like the other two, so the setting that matters during a host outage is `["ubuntu-latest"]`, and
  it has to be set on all three to move everything - the gate, the agents and shipping. Since the
  same record makes `.github/actions/e2e-env` install the browsers on any runner, that path now
  brings back a green `e2e` too, which it did not under ADR 0023._
- **Production ships a CI run later.** Merging the promotion pull request now deploys after the push
  run on `main`, about the length of the e2e shards, not at the moment of the push.
- **A flake on `develop` holds that commit's staging deploy** until a rerun or the next merge. A
  timeout with no assertion diff is still load, not a defect (`verifying-changes`, "Reading
  failures"): rerun it.
- **An agent pull request opens without full-journey evidence.** CI supplies it before the merge, and
  `om-auto-fix-pr` already waits on CI and fixes what it finds.
- **The host budget is not in this repository.** cezar's `maxParallel` (4 in `~/.cezar/config.json`,
  2 in `.ai/cezar/config.json`), the OrbStack VM's CPUs and the pool size are operator settings; this
  decision lowers the load they have to carry, it does not set them.
- **Rollout order.** The rulesets are changed after this merges, because `unit tests` is a check name
  only from then on; a ruleset entry that matches no check silently requires nothing.
