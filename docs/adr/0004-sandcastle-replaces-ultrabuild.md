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

### Amendment, 2026-08-30 — a migrated plan file is frozen, not deleted

The Decision above says "each migrated plan file is deleted (history stays in git)". After two areas migrated — trips core as PRD #104 and reservations and transport as PRD #167 — that half of the decision is **suspended**, and neither file was deleted. The migration itself stands; only the deletion does not.

What was measured. Deleting `01-trips-core.md` would orphan **~112 references across 15 files**; deleting `03-reservations-and-transport.md`, **~86 across 10**. They are not decorative. `docs/plans/README.md` fixes exclusive file ownership per wave, so a stage proves it may write a file by naming the sibling stages that hold it in other waves — and those siblings live in other plans. `06-documents-and-media.md:2659` is an ownership table citing `01-S6` to justify its own claim on `src/server/repos/index.ts`; `09-account-and-settings.md:2649` reads `03-S6`'s stated wave to establish that it does not collide on `appearance.tsx`. Deleting the referent does not make those claims wrong, it makes them **uncheckable** — which is worse, because an agent executing the surviving plan cannot then tell a safe claim from a stale one.

This repository has already paid that price once, at smaller scale: `scripts/ultrabuild/check-plan-*.mjs` were deleted while 117 citations of their output remained, and issue #99 exists to clean up after it. Repeating it deliberately, across two of the most heavily cited files in the directory, is not a tidy-up.

So: **a migrated plan file is frozen.** It carries a banner naming its PRD, it takes no further edits, the tracker is the authority for its area, and it is kept as the evidence its un-migrated siblings cite. `docs/plans/README.md` lists which areas are in that state.

Deletion becomes safe again for a given file when **no un-migrated plan cites it** — either because every remaining area has migrated, or because the citations have been rewritten to name tickets instead of stages. The second is real work with its own risk and is not assumed here; if it is ever done it is its own change with its own review, not a side effect of migrating the next area.
