---
name: om-auto-create-pr
description: planned.travel extension of the installed om-auto-create-pr skill. Adds the repo's layering, localisation and generated-file gate steps; the installed workflow applies unchanged.
---

Extends the installed skill: read the installed `SKILL.md` of the same name under `.claude/skills/` and follow it. Repo gate steps, applied to every change (they are blockers in `CODE_REVIEW.md`):

1. **Copy**: every new user-facing string is a key in `en` and in every other locale under `src/lib/i18n/messages/` in the same change (procedure: the `i18n-messages` skill; the parity test enforces it). No hardcoded copy, ever.
2. **SQL**: only in `src/server/repos`, through the tenant-scoped base repository; `src/server/catalog` is the single exception. Every new or changed repo method ships a tenant-isolation test (rows of another organisation are invisible).
3. **Layering**: `src/components/ui` never fetches data and never imports from `src/server`; routes call server functions in `src/server/fns`; a server function never calls another server function.
4. **Inputs**: Zod on every server-function input.
5. **Generated files**: `src/routeTree.gen.ts` only via `pnpm generate-routes`, `drizzle/` only via `pnpm db:generate`; never edit them by hand. D1 migrations are additive (`BACKWARD_COMPATIBILITY.md`).
6. **Stack**: never `pnpm add|remove|update`; a change that needs a dependency ends as `Status: blocked`.
7. **Style**: TypeScript strict, no `any`, named exports (route modules excepted), `cn()` for classes, no nested ternaries, no `console.log`/TODO/commented-out code. Conventional Commits in English.

Before touching code read `AGENTS.md`, `CODE_REVIEW.md` and `BACKWARD_COMPATIBILITY.md`; the layout and ownership rules are docs/SPEC.md §6 to §8. The fast loop is `pnpm typecheck && pnpm lint && pnpm test`; the full gate is `validation.commands` in `.ai/agentic.config.json` (the e2e step needs a provisioned checkout: `scripts/worktree/bootstrap.sh --profile worktree --no-seed`).

**Protected writes are declared up front, and a refusal is handed over once.** Check the intended write paths before diagnosis or implementation. ADR 0025 removes upstream ownership, not runtime permissions: protected configuration (`.claude/**`, `.husky/*`) can still require supervision. Declare known protected writes in Cezar `writePaths` (or `cezar task --write-path`) before bootstrap or diagnosis, when the dispatch mechanism allows it, so preflight can stop before expensive work. After a denial, stop the unattended run once and hand the exact diff, the worktree and the paths, with the configuration guardian verdict from `.ai/skills/afk-decide/SKILL.md`, to a supervised run with approval limited to those paths. Never enable global `bypassPermissions`, switch tools to evade denial, or repeat diagnosis and tests for the same refusal. Changes outside this repository belong in their own pull request.
