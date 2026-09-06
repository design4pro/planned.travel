# 0017. A subagent panel plans a docs/plans area without a human in the loop

Status: accepted
Date: 2026-09-06
Amends: ADR 0014 (the human gate of the `plan` workflow), ADR 0004 (how an area migrates).

## Context

ADR 0014 gave the `plan` workflow a human at the cockpit: `/plan-feature` grills one question per
round and refuses cezar's autonomous nudge. That is right for a request that arrives as an issue,
where the requester owns the decisions and the skill owns the facts. The thirteen un-migrated area
plans in `docs/plans/` are a different input. Each is a 100 to 330 kB stage sequence that was
written against the code, audited (`OPEN-FINDINGS.md`), and grilled against the reference product
before ADR 0004; it already carries its decisions, its obligations from other plans and its
conventions. Migrating one through fifteen cockpit rounds per mode re-asks a human what the plan
already answers, which is why the two migrated areas (#104, #167) were written by hand instead.

What a human still adds at the cockpit is judgement: is a claim about the code still true, does
this concept collide with an open PRD, is that a product decision or a plan detail, would a reviewer
send this back. Each of those is a check with one job, and a fresh context does it better than the
context that wrote the draft.

## Decision

A second planning workflow, `plan-area` (`.ai/cezar/workflows/plan-area.yml`), runs
`/plan-area <issue> <plan>` without a human: spec, then PRD, in one run. The human's seat is taken
by a panel of six project subagents in `.claude/agents/plan-*.md`, one job each: digest the plan,
verify its claims at HEAD, recommend the domain and architecture answer, answer as the product
owner, recommend the test seams, review the draft adversarially. The orchestrator dispatches them
per round, decides by the rule that exists (SPEC, an ADR, CONTEXT.md, the plans README) and logs
every round with the panel's recommendations to the same `<!-- agent-grilling -->` comment the
human flow uses.

Nothing is asked and nothing is invented. A decision that is a human's (money and commercial terms
no ADR has taken, a clean-room risk, removing or narrowing something that ships, anything the plan
leaves to the operator) stays an open question; the run publishes the spec with it, ends at
`status: review`, and `/plan-feature … prd` grills exactly those. Every artefact still ends at
`status: review`, tickets stay with `/plan-feature`, and the same scripts, allowlist and hooks
apply: the panel reaches tools only through the agent step's `allowedTools`, which a test keeps in
agreement with the agents' declared tools.

## Alternatives

- Teach `/plan-feature` a "panel" transport beside `CEZ:ASK`. Rejected: the skill's refusal of
  autonomy is its contract (ADR 0014), and one skill with two opposite postures is two concepts
  under one owner (SPEC §8).
- Let the orchestrator plan alone with the whole plan in context. Rejected: a context that reads
  250 kB and then writes the draft checks its own work; the panel exists so every decision is
  checked by a context whose only job is that check, and so the plan is read in full once.
- Create the area's issue from the run as well. Deferred: the cockpit hands over an existing
  issue, and the Idea form creates one in seconds; a script that creates issues is a wider write
  surface than this needs.

## Consequences

An area migrates in one run instead of two cockpit sessions, and the reviewer reads one PRD and one
log that shows, beside each decision, who recommended what and why. What is given up is the human's
judgement between rounds; it returns only where the panel stops. The cost is the panel's tokens:
one digest and one fact-check per run plus one to three specialists per round, bounded by the
digest (at most 15 kB) standing in for the plan wherever a specialist does not need the stage text.
The freeze of a migrated plan file (ADR 0004, amendment) stays a human edit after the tickets are
published.
