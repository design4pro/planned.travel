---
name: om-fix
description: planned.travel extension of the installed om-fix skill. Adds the repo's layering, localisation and generated-file gate steps; the installed workflow applies unchanged.
---

Extends the installed skill: read the installed `SKILL.md` of the same name under `.claude/skills/` and follow it. Repo gate steps, applied to every change (they are blockers in `CODE_REVIEW.md`):

1. **Copy**: every new user-facing string is a key in `en` and in every other locale under `src/lib/i18n/messages/` in the same change (procedure: the `i18n-messages` skill; the parity test enforces it). No hardcoded copy, ever.
2. **SQL**: only in `src/server/repos`, through the tenant-scoped base repository; `src/server/catalog` is the single exception. Every new or changed repo method ships a tenant-isolation test (rows of another organisation are invisible).
3. **Layering**: `src/components/ui` never fetches data and never imports from `src/server`; routes call server functions in `src/server/fns`; a server function never calls another server function.
4. **Inputs**: Zod on every server-function input.
5. **Generated files**: `src/routeTree.gen.ts` only via `pnpm generate-routes`, `drizzle/` only via `pnpm db:generate`; never edit them by hand. D1 migrations are additive (`BACKWARD_COMPATIBILITY.md`). A server-function input schema only gains optional fields: a required one fails every tab loaded before the deploy (#972, #846).
6. **Stack**: never `pnpm add|remove|update`; a change that needs a dependency ends as `Status: blocked`.
7. **Style**: TypeScript strict, no `any`, named exports (route modules excepted), `cn()` for classes, no nested ternaries, no `console.log`/TODO/commented-out code. Conventional Commits in English.
8. **Brief premises**: before building on a sentence of the brief about existing code ("the predicate is shared", "an unchanged value is already a no-op", a column count, an ADR number, "the cleanup is not done"), read the code, `.ai/specs/` and `docs/adr/` at `HEAD`; a brief is written before the code it describes moves. Runs found a wrong premise mid-run in #896 (a security specialist caught it), #1001, #1002, #964 and #1003. Record a premise that was wrong in the PR body.

Before touching code read `AGENTS.md`, `CODE_REVIEW.md` and `BACKWARD_COMPATIBILITY.md`; the layout and ownership rules are docs/SPEC.md §6 to §8. The fast loop is `pnpm typecheck && pnpm lint && pnpm test`; the full gate is `validation.commands` in `.ai/agentic.config.json` (the e2e step needs a provisioned checkout: `scripts/worktree/bootstrap.sh --profile worktree --no-seed`).
