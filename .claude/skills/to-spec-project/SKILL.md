---
name: to-spec-project
description: Turn the current conversation (usually a finished grilling session) into a PRD published as a GitHub issue on design4pro/planned.travel. Use after /grill-with-docs, before /to-tickets-project.
disable-model-invocation: true
---

Take the current conversation context and codebase understanding and produce a spec (PRD). Do NOT interview the user — synthesize what you already know. If alignment is missing, say so and suggest a grilling session first.

## Before writing

1. Explore the relevant code using the domain glossary (CONTEXT.md). Challenge fuzzy terms against it.
2. **Sketch the test seams**: name the module boundaries the work will be tested at. Prefer existing seams (the tenant repository boundary is the archetype — see docs/adr/0002); the fewer seams, the better. Confirm the seams with the user before writing.
3. Check overlap: if the feature touches a concept another open PRD or a remaining `docs/plans` stage owns, stop and resolve ownership first (docs/SPEC.md §8 — one concept, one owner). Name the overlap in the PRD.

## The PRD

Sections, in order: **Problem Statement** · **Solution** · **User Stories** (a LONG, numbered list: `As an <actor>, I want <feature>, so that <benefit>`) · **Implementation Decisions** · **Testing Decisions** (the confirmed seams) · **Out of Scope** · **Further Notes**.

Rules:

- The PRD is a _spec_, not a sketch — concrete enough that a sub-issue agent implements against it without re-deriving decisions.
- Do NOT include file paths or code snippets — they go stale. One exception: a prototype-derived shape (state machine, reducer, schema, type).
- Which SPEC sections does this touch? Cite them (e.g. "quota: SPEC §5").

## Publish

```bash
gh issue create --title "PRD: <feature>" --label "ready-for-agent" --label "type: feature" --body-file <tmpfile>
```

Tracker contract: docs/agents/issue-tracker.md. Finish by telling the user to run `/to-tickets-project <issue-number>` next.
