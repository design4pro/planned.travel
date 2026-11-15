# Cezar and Codex

The supported project runtime is the official [open-mercato/cezar](https://github.com/open-mercato/cezar)
with Codex as the default runner. `.ai/cezar/config.json` keeps `baseBranch: develop`,
`maxParallel: 2`, `skillsRepos: []` and the chosen Codex model. This migration prepares the
repository; it neither installs a global CLI nor starts or reconfigures a host service.
The former fork-specific patches and service instructions are historical, not prerequisites.

## Instructions and skills

`AGENTS.md` is the entry point for Cezar and Codex. Only `.agents/skills/om-*` are installed
project skills. The collection is pinned to
`open-mercato/skills@a90b091d27141a6cd12f363e94ebd0f5f84ba615`.
`scripts/agents/skills-upstream.json` records every upstream blob and three reviewed local repairs;
`skills-lock.json` hashes complete skill directories. Local policies live in `.agents/policies/`,
workflow contracts in `.agents/workflows/`, and independent reviewer briefs in `.agents/reviewers/`.
They are ordinary project documentation, not a second skill installation.

Before each skill, including nested calls, read its matching policy as routed by `AGENTS.md`.
An upstream instruction to look for an optional `.ai/skills` override does not replace this router.
Use fresh generic sub-agents with the relevant reviewer brief instead of Claude-specific types.
The optional upstream multi-model harness requires a Claude conductor; it remains vendored as
part of the complete collection but is not configured or used by this Codex delivery pipeline.

`pnpm install-skills` restores the current reviewed pin. To prepare an update, run
`pnpm install-skills -- --ref <full-reviewed-SHA>`, inspect the complete diff, apply
`om-apply-upgrade-notes`, and run the configured gate. A changed upstream base for a local repair
stops the updater before installation. Keep automatic skill updates disabled on the host.
Never recreate another tool's skill directory as a compatibility alias.

## Local execution

Use the official CLI's `cezar run "<task>" --workflow <name>` in this repository, or invoke a
named Open Mercato skill from Codex. The project default selects Codex. No workflow fixes a
model from another provider. Agents read `AGENTS.md` and follow the named skill instructions;
workflow prompts do not rely on Claude slash commands or a Claude `Skill` tool.

A fresh checkout needs `pnpm worktree:bootstrap`. Workflows use the retrying
`.ai/scripts/bootstrap.sh`; those needing the application select `--profile worktree --no-seed`.
There is no implicit Claude SessionStart hook. The configured gate is
`node scripts/ci/validation.mjs`; `--resume` is local interruption recovery, never CI evidence.

Codex does not enforce Claude `allowedTools` or permission settings. The restrictions in
`.agents/policies/security.md` and `.agents/policy.json` are repository policy and static tests,
not an OS sandbox. Host credentials and runner permissions remain an operator responsibility.
This migration grants no production writes, main promotion or permission bypass.

## Retained workflows

| Workflow              | Purpose                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `backlog`             | Deterministic read-only readiness report; use the main checkout for local run visibility. |
| `brainstorm`          | Interactive product discussion with `om-brainstorm`.                                      |
| `triage`              | Verify one issue and write its durable Agent Brief under atomic ownership.                |
| `unblock`             | Resolve an agent-owned hold on independent evidence; preserve human holds.                |
| `spec`                | Write a design-only specification with `om-auto-write-spec`.                              |
| `plan-to-spec`        | Specify one already approved plan stage; specialist review remains mandatory.             |
| `spec-to-tickets`     | Slice one merged specification into bounded implementation tickets.                       |
| `implement-spec`      | Implement a merged specification with Open Mercato.                                       |
| `implement-ticket`    | Implement a ready brief, run the gate, review, QA, CI wait and guarded merge.             |
| `issue-autofix`       | Explicit issue delivery through `om-auto-fix-issue`.                                      |
| `pr-autopilot`        | One PR owner coordinates review/QA/fixes and native CI waiting.                           |
| `pr-review`           | Explicit review through `om-auto-review-pr`.                                              |
| `pr-fix`              | Address assessed review findings with `om-auto-fix-pr`.                                   |
| `housekeeping`        | Report merged-issue candidates, then use `om-close-fixed-issues` with atomic claims.      |
| `lessons`             | Evidence-based `om-pipeline-retro`; at most one draft repair PR.                          |
| `skills-update`       | One deliberately pinned, reviewed skills update.                                          |
| `context-maintenance` | Archive completed contexts with active-run protection.                                    |

`issue-groom` was consolidated into issue preparation/triage. Scheduled architecture review and
product radar were removed: they create additional speculative work and duplicate manual review
or discovery skills. Their live automation records are audit findings, not silently deleted state.

## Ownership, validation and publication

GitHub item writes use the descriptor's `get-lock`, `acquire-lock` and `release-lock` with
`refs/om-locks/{issue|pr}-N`. The lock binds the item, run and unique owner; a shared login is not
ownership. Verify `in-progress` as an additional gate, re-read after acquisition, recompute the
change and release on every exit. Transport errors never fall back to comment-only ownership.
Release is compare-and-delete of the exact SHA, not REST DELETE. See the narrowly scoped lease
exception in `.agents/policies/security.md`.

New issue creation in the spec/plan workflows uses `pipeline-control.mjs reserve-creation` and
`release-creation`: a resumable, exact-run lease in the shared Cezar store. It serializes creation
on the one configured host and never replaces the remote lock acquired after an issue has an ID.
Foreign or crashed reservations are never automatically removed.

Legacy `release-leaked-claims.mjs` is report-only and refuses mutation. The deterministic
`close-fixed-issues.mjs` remains a report/library but refuses `--apply`; the upgraded skill owns
writes. Merge confirmation does not run the legacy mutator. A separate graph stage applies the upgraded skill to this merged PR only and verifies eligible issue closures before success.

Keep full validation, executed required CI, current head/base/policy evidence, unresolved-thread
checks, human holds and the QA gate. `needs-qa` requires current-head sign-off by independent
reviewers; security/high-risk work also requires an independent security verdict. Rejections get
at most three fix rounds. Agents merge only into `develop`; the `do-not-merge` promotion remains
protected. `node .ai/scripts/pr-state.mjs <pr> [--wait]` provides compact paginated evidence;
unknown or incomplete checks never pass. Native wait nodes release the agent execution slot.

## Automation cutover

See [the automation audit](automation-audit.md) for observed records and recommendations.
`docs/agents/cezar-automations.json` contains paused candidate definitions, not proof of the live
host state. Do not apply it automatically. The local `.ai/cezar/automations.json`, Codex schedules,
cron, launchd services and GitHub settings were not changed by this migration.

Before enabling a new owner, inspect and drain existing workers, preserve their claims and
reconcile their handoffs. Do not run old comment-only claimers alongside atomic claimers or run
multiple allocators for the same issue. The old Paperclip pilot integration and its alternative
review/publication rules are removed from the repository; its host services require a separate
operator cutover. No scheduler is assumed active merely because its configuration file exists.
