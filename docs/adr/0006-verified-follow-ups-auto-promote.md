# 0006. Verified triage findings are promoted without a human

Status: accepted
Date: 2026-08-28

## Context

The sandcastle auditor files incidental findings as `type: bug|maintenance` + `status: pending` and deliberately never marks them `ready-for-agent`, so that the loop cannot generate and consume its own work unsupervised (ADR 0004 made the loop the AFK implementer; the planner reads only `ready-for-agent`). In practice the follow-ups pile up untriaged, and the work of triage is mostly mechanical: reproduce the claim, check it is not already implemented, write the brief.

## Decision

A pre-triage agent (`.sandcastle/triage-prompt.md`, run by `.github/workflows/triage.yml` on issue events and by `pnpm sandcastle:triage` on demand) verifies every such issue against HEAD. It promotes to `ready-for-agent` — brief in the body, `status: pending` removed — only when all three hold:

1. the claim is **reproduced** (a failing test or a failing command, quoted in the notes);
2. it is **not redundant** with existing code or a `.out-of-scope/` record;
3. the fix direction is **settled** by SPEC, an ADR or the code, not a product or API choice.

Anything else stays at `status: pending` with the recommended state named in the notes for a human to apply.

## Consequences

The human gate moves from "every follow-up" to "every ambiguous or unverified one". What still keeps the loop supervised: `pnpm sandcastle` is operator-started and prints its plan before working; a promotion is always announced in a comment and undone by removing one label; every AI comment carries the triage disclaimer and the `<!-- sandcastle-triage -->` marker, so a run is idempotent and auditable. If auto-promoted issues turn out to reach the planner with poor briefs, the first lever is the prompt's promotion criteria, not a return to manual triage.

### Amendment, 2026-09-02 - promotion ends at `status: ready`

ADR 0015 separates state from command. The three conditions above are unchanged and a reproduction
is still the price of promotion, but the promoted state is now `status: ready`, which no run acts
on by itself: a human's `run: implement`, or `auto-advance` on the PRD, starts the work. The
pre-triage runs as the cezar `triage` workflow (ADR 0014) rather than through `triage.yml`, and
follow-ups enter as `status: triage` instead of `status: pending`.
