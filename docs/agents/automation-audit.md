# Automation audit - 2026-11-15

Scope: this repository, its local Cezar records, local Codex automation files, the current
user's crontab and relevant launchd entries, plus GitHub's workflow registry and latest 50 runs.
This is a recommendation report. No live automation, service, label or GitHub setting was changed.
A saved `enabled: true` record does not prove its poller is running.

## Cezar saved records

The local `.ai/cezar/automations.json` contains eleven definitions, ten enabled and one disabled.
It diverges from the committed candidates and the documented label vocabulary.

| Saved automation                 | Saved state | Recommendation                                                                                                       |
| -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Groom new issues                 | Enabled     | Replace with the single retained `triage` workflow after cutover; the removed `issue-groom` workflow is redundant.   |
| Re-groom on request              | Enabled     | Remove the `groom` label trigger; explicit triage handles the same request.                                          |
| Fix issues on the autofix label  | Enabled     | Retire this old `autofix` trigger; retain explicit `issue-autofix` and configure any future queue deliberately.      |
| Write a spec for feature issues  | Enabled     | Remove the old `spec` label trigger; the explicit `spec` workflow remains.                                           |
| Autopilot new pull requests      | Enabled     | Useful only as the sole owner for otherwise unowned PRs; verify exclusions and claims before enabling a replacement. |
| Resolve blocking review threads  | Disabled    | Remove; `pr-autopilot` and explicit `pr-fix` already own assessed findings.                                          |
| Triage new issues                | Enabled     | Remove the legacy `needs-triage` trigger and consolidate with one intake owner.                                      |
| Implement ready-for-agent issues | Enabled     | Remove; `ready-for-agent` is not the repository readiness contract. Brief/dependency/hold checks select work.        |
| Spec to tickets                  | Enabled     | Keep the capability, remove a competing daily allocator if the delivery allocator already dispatches it.             |
| Weekly architecture review       | Enabled     | Remove; speculative backlog generation duplicates explicit architecture/code review. Its workflow was removed.       |
| Weekly lessons                   | Enabled     | Optional weekly `om-pipeline-retro`, now backed by the retained `lessons` workflow; one repair PR at most.           |

The five committed candidate definitions are paused: PR autopilot, reviewed-PR recovery,
weekly lessons, skills update and context rotation. They are templates, not a declaration that
the live set was synchronized. Do not apply them until old workers have drained and one allocator
has been chosen. Reviewed-PR recovery must respect a live autopilot owner and must not become
another PR owner. Product radar and architecture-review schedules were removed from candidates.

## Host and Codex

- No `automation.toml` files were found under the current local Codex automation directory.
  This does not inventory other machines or cloud accounts.
- `crontab -l` reported no crontab for the current user. The old ten-minute Reconciler schedule
  in historical documentation is not evidence of a current cron job.
- launchd listed the Cezar application and `com.design4pro.paperclip-pr-monitor` with running PIDs.
  A Paperclip service plist also exists, but its presence alone does not establish liveness.
- The Paperclip PR monitor is redundant after the repository leaves Paperclip. Recommend stopping
  it during the separate host cutover, after handing off its active work. Do not uninstall a
  shared Paperclip service until its use by other projects is known. This migration changed neither.
- The locally linked `cezar` CLI resolves to a separate checkout reporting package version 0.11.1.
  The repository targets the official upstream runtime. Updating that shared executable is a
  separate host operation; no binary or global configuration was changed here.

## GitHub Actions

All eight repository workflow files remain useful. Removing coding-agent skills does not remove
CI, delivery or operational monitoring responsibilities.

| Workflow              | Recommendation and observed evidence                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI                    | Keep. Required validation and browser journeys; a successful run appears in the inspected window.                                                                                                                                   |
| Cancel closed PR runs | Keep. Saves runner capacity; successful runs observed.                                                                                                                                                                              |
| Deploy staging        | Keep. Delivers verified staging through the existing release gate.                                                                                                                                                                  |
| Deploy                | Keep. Production release capability with existing authorization and checks.                                                                                                                                                         |
| Promote develop       | Keep the capability; consider replacing the ten-minute cron with event/manual execution if recovery needs allow it. The latest 50-run window contains 22 promotion runs; the latest was skipped.                                    |
| Rollback production   | Keep. Explicit recovery capability, not redundant automation.                                                                                                                                                                       |
| e2e webkit            | Keep cross-engine coverage. Latest observed run failed; investigate the failure rather than remove coverage.                                                                                                                        |
| Sentry triage         | Keep incident intake. Latest observed run was queued. Its standalone collector still uses Claude CLI and OAuth, independently of project skills; migrating that collector to another provider is separate application/tooling work. |

GitHub also lists a manually disabled `Multica event router` whose YAML is absent locally:
retire that obsolete registration if desired. Dynamic Copilot PR review may duplicate independent
Open Mercato review; disable it only after confirming it is not required by the team's review
policy. Dependabot is a separate dependency service; retain it unless its configured updates
conflict with the pinned-stack maintenance policy. Neither dynamic service was changed.

## Ownership and upgrade conditions

Open Mercato was updated from `75cf3146fd31aa6fa53af0866c076e5b7a3d9179` to
`a90b091d27141a6cd12f363e94ebd0f5f84ba615` (eight commits). GitHub's descriptor now includes atomic
lock operations and preserves the existing REST metadata operations, base-aware merges,
required-CI checks and review-thread helpers. Three local helper repairs remain because their
upstream bases are unchanged. The Playwright provider remains selected.

The old age/login-based claim releaser now permits reports only. The legacy deterministic
issue closer refuses `--apply`; `om-close-fixed-issues` owns writes under the current protocol.
Do not run old claimers alongside the upgraded collection. No live claim was removed or adopted.

| Question                                 | Applied decision                                                                               | Evidence                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| What survives outside `.agents`?         | Runtime `.ai`, CI `.github`, product docs and historical ADR/spec evidence remain.             | Explicit developer answer.                                                      |
| Which skills remain?                     | Complete pinned Open Mercato collection only; necessary project rules become routed documents. | Explicit developer answer.                                                      |
| Who executes project work?               | Official Cezar with Codex; repository Paperclip integration retired.                           | Explicit developer answer.                                                      |
| May the migration change host schedules? | No; audit and recommend only.                                                                  | Explicit developer answer.                                                      |
| How are legacy mutators handled?         | Report-only entrypoints; atomic Open Mercato ownership for writes.                             | Independent configuration/security review identified missing CAS/run ownership. |
