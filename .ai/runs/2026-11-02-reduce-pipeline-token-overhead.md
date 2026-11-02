# Reduce pipeline token overhead

## Goal and scope

Avoid model invocations for no-op implementation runs, centralize read-only PR/CI polling, and execute the configured validation gate with bounded jobs and concise evidence. Reuse existing readiness, workflow graph, and attestation contracts. No application changes, dependencies, permission changes, automatic issue closure, or changes outside this repository.

## Implementation plan

1. Extend backlog readiness with verified spec-deliverable completion and add deterministic workflow preflight/STOP branches using native Cezar graph nodes.
2. Add one paginated PR/CI snapshot and bounded wait command, wire tracker/skill consumers, and retain unknown/changed-head/external-check safeguards.
3. Add one configured validation executor with project/shard timeouts, local log summaries and safe local resumption; share it with fresh attestation and workflow gates.
4. Run regressions, the configured validation gate, documentation consistency searches and independent review; publish the completed PR.

## Risks

- `Refs #n` and spec metadata alone never imply runtime implementation is complete.
- Current-run filtering must not hide other claims, trust restrictions, blockers, or WIP limits.
- Unknown CI and missing external checks cannot be reported green.
- Resume receipts are local convenience; attestation always runs fresh and verifies the checkout remained unchanged.
- The host's `/tmp` inode quota is exhausted; worktree and task artifacts use the project disk.

## Resolved assumptions

| # | Question | Applied default | Why |
| --- | --- | --- | --- |
| 1 | Change repository workflows or the external orchestrator? | Use repository scripts and native v2 graph branches. | Independent configuration guardian: high confidence; Cezar already supports check/if/end nodes, no broader permissions needed. |
| 2 | May local cached results become CI evidence? | Attestation always runs a fresh full gate through the shared executor. | Independent guardian: cache authenticity and complete environment provenance are not established. |

## Progress

PR: #1727

### Phase 1: Pipeline helpers

- [x] 1.1 Add deterministic readiness and STOP routing with regressions. — e34519da
- [x] 1.2 Add shared PR/CI snapshot and bounded waiting with regressions and consumers. — e34519da
- [x] 1.3 Add shared validation execution, logs, resumption and fresh attestation integration. — e34519da

### Phase 2: Verification and publication

- [ ] 2.1 Run the configured gate, docs search and independent review; publish the PR.
