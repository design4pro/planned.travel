# Autonomous pipeline rollout

Implementation branches: `chore/pin-open-mercato-skills` (isolated skills update),
`feat/autonomous-pipeline` (integration worktree including that prerequisite) in planned.travel and
`fix/reconciler-runner-isolation` in the Cezar host checkout. The original checkout's
uncommitted merge-outcome changes were copied into the isolated worktree and preserved in place.

## Activation gates

1. Verify the effective host crontab, service environment (`TZ=UTC`), project registry and
   global/project capacity. Local config reports 4 global slots, 2 monitoring slots and 2 for
   this project; the service API and crontab were inaccessible from the implementation sandbox.
   Do not install duplicate schedules. Replace the legacy hourly closure and three daily
   housekeeping calls with the existing ten-minute Reconciler's closure pass.
2. Review the pinned skills update separately: upstream
   `75cf3146fd31aa6fa53af0866c076e5b7a3d9179`, all 74 skills and their helper files. The manifest
   and compatibility test verify bytes, folder hashes and symlinks, including three explicit local helper repairs. Local `.ai/skills` overlays,
   REST mutations, hold labels, merge strategy and prohibition of protection bypass remain.
   No harness, interactive triage or second merge-buddy scheduler is installed or activated.
3. Pass the configured validation gate and inspect independent security review. Exercise two
   competing ticks, a restart after push/merge, inaccessible GitHub pages and a failed runner
   in a test project. Cezar's Reconciler change is a separate host-repository change.
4. Provision a dedicated English-language test account belonging to exactly one workspace
   named `Release smoke…`, with one readable trip. In each GitHub environment configure
   `SMOKE_EMAIL`, `SMOKE_PASSWORD` secrets, `SMOKE_WORKSPACE_ID`, `SMOKE_TRIP_ID` variables and
   existing Cloudflare Access credentials. Never use an ordinary customer account. The smoke
   signs in, reads that trip, changes the isolated workspace's name and restores it, verifying
   both writes. Missing credentials or cleanup failure produce no passing receipt.
5. Verify production environment protections and token permissions, including `PROMOTE_PR_TOKEN` (required so a merge triggers production CI and a recovery draft triggers PR CI). Ruleset requirements must be readable. Classic protection may be absent only when a 404 is accompanied by confirmed repository administrator visibility; other inaccessible requirements are not treated as empty protection. Enable `RELEASE_OBSERVATION=true` to collect staging/production receipts without automatic
   promotion or rollback. Run the staging observation and `node scripts/ci/promote-release.mjs` without `--apply` first. Confirm the actual Worker
   version and SHA through `/api/version`, seven successful samples spanning thirty minutes,
   complete current-head develop push CI (the promotion PR intentionally skips duplicate jobs), promotion-tree equality and whole-range risk. A high-risk range
   needs a trusted native approval on the promotion PR's current head, or an exact comment
   `/approve-release <40-character SHA>` by a configured trusted author (who may also be the PR
   author). `/revoke-release <SHA>` withdraws it; the latest trusted decision wins. An unreadable gate stops
   the release. The separate release workflow preserves the promotion's `do-not-merge` label;
   agent workflows continue to refuse that PR.
6. Only after that test enable `AUTONOMOUS_RELEASES=true`. This enables receipts, authenticated
   production smoke and deterministic promotion. A failed production verification opens one
   release-lock incident before any rollback attempt. All future production deploys and
   promotions must respect that incident until recovery is complete. Rollback requires a
   previously successful production receipt, a known currently serving failed version and no
   schema/resource-config changes. It runs once, does not migrate data backwards, and does not
   move main. After a verified rollback, it prepares a draft revert PR against develop using the
   first-parent release range. Conflicts or a moved main leave the incident open for manual repair.
   Merge the reviewed repair and verify staging before an operator closes the incident to permit
   a monitored production release; otherwise a later deployment could restore the bad code. Missing or incompatible evidence needs manual
   recovery. No live rollback was exercised during local implementation.
7. After the existing queue stabilizes, enable the three new weekly automation definitions and
   `pipeline.productDiscovery`. Cadence is UTC: architecture Monday 06:00, skills Tuesday 05:00,
   radar Wednesday 06:00, lessons/retro Friday 16:00, context rotation Sunday 04:00. Existing
   daily Sentry 06:00 and WebKit 03:30 remain. Radar uses the approved product scope and existing
   backlog; it does not implement features directly. Unknown active-minute telemetry blocks
   discovery only. The rolling seven-day 20% gate checks admission: at the limit, radar may
   report but cannot start another feature. An already running turn is not interrupted, so
   its final minutes can exceed the admission threshold; inspect the measured share before
   admitting subsequent work.

## Evidence and recovery

Claims live in the primary checkout's `.ai/cezar/claims/`, keyed by subject and owned by run ID.
They survive restarts. Never delete a claim solely because an agent is waiting on CI. A failed
owner's claim requires inspection and explicit recovery; another run cannot steal it. Reviews
and QA carry exact head/base SHAs, policy digest and report URL in the existing run store.
These records select evidence to read; they never override revoked approvals or new findings.

Closure checkpoints retain unfinished PRs and rotate deferred work. An unavailable page is an
error, never an empty queue. Issues close after a runtime merge to develop, not after a spec PR
or a merge into another branch. Epics still require acceptance and child completion review.

Business outcomes are separate from engine status. The handoff records `no-op`, `blocked`, validated `implemented` and
confirmed `merged`; Actions receipts distinguish deployed versions from verified smoke tests.
A green workflow without a receipt is not proof of deployment.

Measure ready-to-merge, merge-to-production, CI waiting time, reviews per head/policy, retries,
duplicate owners and active agent minutes per verified task. Establish a complete baseline
before claiming a 25% median improvement. Historical engine `done` counts are not deployments.
The saved local baseline records missing evidence explicitly; live host and production checks
remain rollout gates, not assumptions.

## Local implementation checks

- `pnpm typecheck`, `pnpm lint`, generated-file verification and `pnpm build` passed. Lint reports
  the existing `cancelled` shadowing warning in `src/lib/room-refresh.ts`.
- Focused pipeline/closure/skills/release tests: 284 passed before the additional classic-protection regression check. The isolated skills branch also
  passes its complete 74-skill manifest check, including retained local helper repairs.
- Cezar Reconciler: 71 tests passed. The Claude access regression was also run against the
  original source and failed as expected (one unwanted retry); the updated source passes.
- Server suite: 287 files passed in the full run; the two files that timed out under load
  passed separately (627 tests). Together these cover all 6407 server tests.
- The full tooling run did not pass: subprocess/socket operations return `EPERM`, with worker
  startup and test timeouts as well. Three vendored helper regressions found during that run
  were repaired by preserving the existing local versions; executable criterion checks remain
  blocked by `spawnSync git EPERM`. This is not a green configured validation gate.
- The UI suite reached the repository's 540-second foreground limit before completing. It had
  already reported a timeout in expense-dialog and a subprocess-based world-map check failure.
  Its remaining results are unknown; the full UI suite needs a clean rerun outside this sandbox.
- Both Cezar graphs pass the installed engine schema and graph validation. Changed Actions
  workflows parse as YAML; their live token permissions and environment gates remain untested.
- Standalone `gh` access works and has repository administration permission. Skills PR
  [#1823](https://github.com/design4pro/planned.travel/pull/1823) and Cezar PR
  [#77](https://github.com/design4pro/cezar/pull/77) are published with `do-not-merge`.
  Skills CI [41731611516](https://github.com/design4pro/planned.travel/actions/runs/41731611516) passed lint/typecheck/build, the full unit suite and both E2E shards on head 64dc0119.
- Both main/develop rulesets require `lint · typecheck · build`, `unit tests` and
  `e2e · merged report`. Classic main protection returns 404, "Branch not protected".
  The production environment currently has no protection rules or deployment branch restriction.
  Repository and environment queries found no release flags, SMOKE_EMAIL/SMOKE_PASSWORD secrets or SMOKE_WORKSPACE_ID/SMOKE_TRIP_ID variables. PROMOTE_PR_TOKEN exists; its runtime permissions remain untested.
- Cezar workflow dispatch returns HTTP 422, "Actions has been disabled for this repository",
  although the repository permissions API reports enabled=true. No CI run was created.
- Crontab and live cockpit inspection remain inaccessible. No schedules, production flags,
  merges or deployments were activated. The original checkout's diff remains unchanged.

The staging observation currently occupies one Actions runner for thirty minutes. Measure that
queue cost before increasing release frequency. New weekly definitions remain disabled until
host schedule reconciliation and the staged rollout above are complete.

The integration branch's normal pre-commit validation failed: 233 files / 6119 tests passed,
15 files / 56 tests failed, 19 tests skipped and three localhost-listen EPERM errors. No commit
or full-gate attestation was produced. The run also exposed inherited Git variables in the
existing skill-repair fixture: its scratch bundle commit changed the integration branch and
shared core.bare setting. The branch/index and non-bare setting were restored, and all original
checkout changes were verified byte-for-byte. The fixture now clears Git environment variables
using the existing pre-commit test's isolation pattern. Its four non-git cases pass; seven
criterion cases remain blocked by spawnSync git EPERM. Publication of this integration awaits
successful normal hook validation in an environment that permits these processes and sockets.

The share-bundle fixture regression also passes with deliberately invalid inherited GIT_DIR and GIT_INDEX_FILE. The original checkout diff still matches its pre-task snapshot.
