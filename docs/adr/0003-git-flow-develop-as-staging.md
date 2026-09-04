# 0003. Git Flow with develop-as-staging

Status: accepted (backfill — the decision predates this record)
Date: 2026-08-26

## Context

The project deploys two long-lived environments from one repository and needs agent branches to land somewhere continuously verifiable before production.

## Decision

Feature branches (`feat/*`, `fix/*`, `claude/*`, `sandcastle/*`) target `develop` via PR. Merging `develop` auto-deploys staging. Promotion is a PR `develop` → `main`, which deploys production. CI runs the full gate (lint, typecheck, unit, build, visual e2e) on every PR; _ADR 0016 replaced the visual e2e half with the critical journeys, which compare no pixels;_ database migrations are additive so a running Worker survives the migrate-then-deploy window.

## Consequences

Agents always cut from and target `develop`. Staging is the human-QA surface; QA findings return to the backlog as GitHub issues. `main` only ever receives what staging has already run.
