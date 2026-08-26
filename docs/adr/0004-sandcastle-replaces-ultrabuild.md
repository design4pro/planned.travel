# 0004. Sandcastle replaces the ultrabuild orchestrator

Status: accepted
Date: 2026-08-26

## Context

The repository had a homegrown autonomous loop (`/ultrabuild`: a 16 KB command protocol plus a 1,393-line orchestrator) working off a Markdown backlog in `docs/plans/` (16 area plans, 101 stages). It was monolithic, its run state was machine-local (gitignored), the backlog could not be shared across machines or agents, and the planning discipline (grilling, PRDs, vertical slices) lived nowhere.

## Decision

We adopt the Matt Pocock workflow end to end and retire ultrabuild:

- **Backlog** moves to GitHub Issues: PRD = parent issue (`ready-for-agent`), tickets = vertical-slice sub-issues with native `blockedBy` dependencies; sub-issue order is execution order; issues are closed after merge (no doc rot). `docs/plans/` is migrated area by area through grilling → `/to-spec-project` → `/to-tickets-project`, and each migrated plan file is deleted.
- **AFK implementation** runs on `@ai-hero/sandcastle` (`.sandcastle/`): planner → parallel Docker-sandboxed implementers → reviewer → merger, driven by open GitHub issues.
- **The visual gate stays.** Playwright visual suites, the committed baselines and the CI `e2e` job are independent of ultrabuild and unchanged. The `pixel-critic` agent is kept and invoked during review of UI-touching changes. Retiring ultrabuild retires an orchestrator, not pixel checking.
- Durable operational facts from ultrabuild's knowledge store are distilled into the `verifying-changes` skill before the directory is deleted.

Considered and deferred: a GitHub Actions label state machine (`agent:queued` → `agent:implement` → draft PR) running sandcastle in CI, per mattpocock/course-video-manager. Revisit once the local loop has settled; requires an `AGENT_PAT`.

## Consequences

One orchestrator (sandcastle) instead of two; the backlog is shared, dependency-aware and visible; planning quality is enforced by skills rather than by a fixed protocol. The 8-phase ultrabuild pipeline, its adversarial auditor and its cross-run knowledge store are given up — CI, code review skills and the review stage of the loop must carry that weight.
