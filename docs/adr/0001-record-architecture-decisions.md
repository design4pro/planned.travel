# 0001. Record architecture decisions

Status: accepted
Date: 2026-08-26

## Context

Architectural decisions in this repository were spread across docs/SPEC.md prose, PR descriptions and orchestrator state. Agents working in fresh contexts re-derive (or contradict) them.

## Decision

We record architecture decisions as ADRs in `docs/adr/NNNN-slug.md`. An ADR is written only when a decision is all three of: hard to reverse, surprising without context, and the result of a real trade-off. Everything else stays in code or in docs/SPEC.md.

## Consequences

Fresh-context agents and new contributors can read the "why" without archaeology. ADRs are append-only; a superseded ADR is marked superseded, never deleted.
