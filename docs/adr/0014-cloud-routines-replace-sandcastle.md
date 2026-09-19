# 0014. Cezar replaces the sandcastle orchestrator

Status: accepted
Date: 2026-09-02
Supersedes: ADR 0004 (orchestrator), ADR 0009 (run coordination).

## Context

ADR 0004 adopted `@ai-hero/sandcastle` for AFK implementation and ADR 0009 gave it a Durable Object
registry so two runs could not build the same ticket twice. The loop became the slowest part of the
development process, and the slowness is structural: one long-lived process on one machine runs a
fleet of Docker sandboxes through one subscription. Measured in its own instrumentation, better
than 95% of a run is waiting on the usage limit (up to 6 h per wait, `usage-limit.ts`), every
sandbox pays a `pnpm install`, e2e is 60% of the ladder and two ladders share a semaphore across
four pipelines, and the planner sends ~84k tokens per iteration to re-derive an order the
sub-issue graph already holds. Two Opus pipelines and the auditor drain a five-hour window in
about 94 minutes, which is the throughput ceiling whatever the orchestrator.

An earlier draft of this ADR proposed Claude Code cloud routines. They were rejected on
documented limits: no `issues` trigger, a clone of the default branch (`main`, while integration is
`develop`), the user's personal GitHub identity, no interactive step, research-preview status.
GitHub Actions with `claude-code-action` was rejected as the orchestrator because the account's
Actions are broken by a phantom workflow, a job cannot resume the same session after a usage
limit, and there is no live view of a run. Managed Agents were rejected as beta with API billing.

`open-mercato/cezar` 0.10.0 was chosen by the maintainer: a local cockpit, a worktree per task,
automatic resume of the same session after a usage limit, YAML workflows whose last agent step is
interactive without a timeout, GitHub polling automations, and an HTTP API. Its limits were read
from the source: the engine never writes to GitHub, only the last agent step of a workflow may ask
a question or run unbounded, an autonomous nudge overrides a question, a parked session closes
after 15 minutes idle, and there is no port allocation, dependency ordering or per-step timeout.

## Decision

**GitHub labels are the state machine (ADR 0015), cezar is a stateless worker on worktrees, CI is
the deterministic gate, and a sweeper on the cezar host is the only writer besides the claim,
apply and handback scripts.** This is not full autonomy: three workflows, each with a human at a
defined point.

- `triage` runs on every issue that enters as `status: triage` and on `run: triage`. It reproduces
  the claim at HEAD, then a script applies the verdict: `ready` only with a quoted reproduction,
  otherwise `needs-info`, `backlog` (needs a plan) or `needs-human`. It never closes and never
  starts work.
- `plan` is started by a human from the cockpit on an issue, in one of three modes: `spec` grills
  the request into a `spec/v1` body, `prd` turns a spec into a `prd/v1` body, `tickets` turns a PRD
  into sub-issues with native `blocked_by` relations. Every mode ends at `status: review`; the next
  mode is the human's acceptance. It runs with `autonomous: false` so its questions reach the
  cockpit, and the same skill uses `AskUserQuestion` when run in a local `claude` session.
- `implement-ticket` runs on `run: implement`. Two command steps (claim, setup) cost no tokens: the
  claim swaps the label under a per-issue lock and refuses a PRD, a blocked ticket or a ticket with
  an open PR; setup takes a port from a pool, installs, migrates, seeds and starts a dev server
  bound to loopback. The single agent step implements with TDD, runs the ladder through a script
  (route tree, typecheck, lint, tests, build, chromium only when UI was touched; at most three
  passes), and always ends by calling the handback script, which pushes `claude/issue-<n>-<run>`,
  opens a draft PR to `develop` with `Refs #n` and `agent-pr`, and moves the issue to `review` or
  `needs-human`. The full Playwright matrix stays in `ci.yml` behind `needs-e2e`. _Amended by ADR
  0016: the journeys run on every PR and the label is retired._ _ADR 0021 narrows that to every PR
  whose diff reaches past documentation._

**Trust model.** Everything on a `claude/*` branch is untrusted until a human reviews the PR. The
agent's shell is an allow-list of command prefixes; every GitHub write goes through a script; a
hook confines `Read`/`Glob`/`Grep` to the worktree; repository code (install, tests, dev server)
runs under `env -i`; a diff touching `.github/`, `.claude/`, `.husky/`, `.ai/cezar/`,
`scripts/agent/`, `.npmrc` or `pnpm-workspace.yaml` is refused at push and at branch adoption;
worktrees run with `core.hooksPath /dev/null`; the host identity has no `workflow` scope; the
cezar service carries no `GH_TOKEN` and no Cloudflare token; every text sent to GitHub has
`@claude` neutralised.

## Consequences

A ticket's wall clock is bounded by its own ladder, not by the slowest sibling and a shared
semaphore; a usage limit pauses and resumes one session instead of killing a pipeline; the planner,
the merger and the Durable Object registry are gone, because the unit of work is one ticket claimed
exactly once under a lock and ordered by the graph GitHub already holds. What does not improve is
throughput under the subscription cap.

The output is one PR per ticket into `develop`; conflicts between siblings surface at PR time. The
human gate of ADR 0003 is unchanged and gains three more: every planning artefact, every `run:`
command, and every PR. Deep review and pixel critique lose their place on the critical path and
return, if at all, as an optional `audit-pr` workflow. Sandcastle's per-stage token attribution is
replaced by the cockpit's per-run cost.

The migration lands in phases, each a PR to `develop` verified before the next: the label
protocol; the scripts, hooks and skills with no behaviour change; `plan` on a test issue;
`implement-ticket` with automations enabled; `triage` and the removal of `.sandcastle/`; then the
optional audit, a VPS host and the Durable Object cleanup.
