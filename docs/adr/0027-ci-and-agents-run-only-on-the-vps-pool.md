# 0027. CI, the agents and shipping run only on the VPS pool

Status: accepted
Date: 2026-09-24
Supersedes: ADR 0023 and ADR 0026 (where each job runs, and the exception for shipping).
Amends: ADR 0021 (its runner operations: the pool it names, its slot count and its recovery lever).

## Context

ADR 0023 put CI and the agents on a pool of ephemeral containers on the Mac that runs cezar; ADR
0026 kept shipping on GitHub-hosted runners and weighed Blacksmith, and did not take it. Two things
changed in September 2026.

**GitHub's artifact storage ran out.** The organisation is on GitHub Team: 2 GB of Actions storage,
measured in GB-hours over the month. September reached 1488 GBh against an allowance of about 1440 -
1110 of them from this repository's Playwright reports - and from then on every
`actions/upload-artifact` failed with `Artifact storage quota has been hit`. Where a job runs does not
change where `upload-artifact` stores; only a store on the runner's own host does.

**The Mac pool went down and took the merge path with it.** On 2026-09-23 no `gha-ci-*` runner was
registered and both `gha-agent-*` were offline. CI, the merge gate and promotion queued for more than a
day. That is the risk #692 named - one machine on the merge path of two repositories - arriving.

## Decision

1. **Every job in this repository runs on the VPS pool** (OVH, 8 KVM vCPU, 22 GB; runner group `vps`,
   scoped to this repository and money-tracker.online). It is the same image and the same `pool.sh` as
   the Mac pool, from design4pro/cezar `host/runner/`, under systemd: one job per container, the
   container discarded afterwards. Three kinds of slot:

   | Slot    | Labels                        | Size             | Workflows                                                                      |
   | ------- | ----------------------------- | ---------------- | ------------------------------------------------------------------------------ |
   | `ci`    | `self-hosted,linux,X64,ci`    | 2 × 4 CPU / 8 GB | `ci.yml`, `e2e-webkit.yml`, `deploy.yml`, `deploy-staging.yml`, `rollback.yml` |
   | `gate`  | `self-hosted,linux,X64,gate`  | 1 × small        | `merge-gate.yml`, `promote-develop.yml`, `auto-merge-develop.yml`              |
   | `agent` | `self-hosted,linux,X64,agent` | 1 × small        | `sentry-triage.yml`                                                            |

   `gate` exists so that a check which takes seconds never waits behind a fifteen-minute e2e shard.

2. **Artifacts stay on the VPS.** The CI slots mount `/srv/ci-artifacts` at `/ci-artifacts`, and
   `design4pro/.github/actions/artifact-upload` / `artifact-download` write there instead of to GitHub.
   On any runner without the mount they fall back to the upstream actions, so the kill switch below
   still produces artifacts. A systemd timer on the host deletes runs older than 14 days.

3. **Shipping runs on the pool too.** ADR 0026 decision 2 kept deploys off the pool because it shared
   a pnpm store, a Node toolcache and a restarted container with pull request code. The VPS pool
   shares none of them: nothing survives a job, and the one mount is the artifact store, which no
   deploy reads. `RUNNER_DEPLOY` defaults to the `ci` labels.

4. **The Mac pool and Blacksmith are retired.** Their runner groups and registrations are removed
   from the organisation and no workflow default names `ARM64` or a Blacksmith label.

5. **The kill switch is unchanged in shape.** `vars.RUNNER_CI`, `vars.RUNNER_DEPLOY` and
   `vars.RUNNER_AGENT` are repository variables, deliberately unset. Setting one to
   `["ubuntu-latest"]` moves its jobs to GitHub-hosted runners without a pull request - the path
   for when the VPS is down. Artifacts produced there count against GitHub storage again.

6. **Time budgets are sized for the slower machine.** The VPS vCPUs are Intel Haswell under KVM,
   about a third of a Mac core. The first run there cut both e2e shards off at the 900 s
   `globalTimeout` and timed out the markdown linearity test at 7.1 s. With the pool at two 4-CPU CI
   slots and the budgets doubled (#729), run 35968476152 was green: e2e shards 12.4 and 10.6 min,
   unit tests 532 s, lint · typecheck · build 258 s. Per-test Playwright timeouts are unchanged.

## Consequences

- One machine is still on the merge path; it is a server with no login session, no FileVault and no
  sleep, which removes the ways the Mac pool actually failed. Its failure mode is the kill switch.
- Feedback is slower: a full CI event takes about twice as long as it did on the Mac pool, and two
  CI slots queue a busy afternoon. More slots need more cores, not more oversubscription.
- The artifact store is shared by every job of both repositories in the group. It holds data, never
  tools, and no job executes what it reads from it; but a pull request's job can overwrite another
  run's diagnostics. Acceptable for two private repositories with one owner.
- Artifacts are not in the GitHub UI. The step summary of each upload names the path on the host.
