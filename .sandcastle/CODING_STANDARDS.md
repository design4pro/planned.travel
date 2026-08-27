# Coding standards (pushed to the reviewer)

Distilled from docs/SPEC.md §6–§7. The repo overrides this file where they disagree.

## Layering (contract, not style)

- All SQL lives in `src/server/repos` and passes through the tenant-scoped base repository — the tenant filter must not be removable. `server/catalog` is the single stated exception (global tables, guarded by `requirePermission` + platform audit log).
- Routes call server functions (`server/fns`); server functions call repos. No SQL anywhere else.
- `components/ui` never fetches data and never imports from `server/`.
- `server/public` returns only named, column-whitelisted read-only projections.
- Validate every server-function input with Zod. Never trust the client.
- Generated files are never hand-edited: `src/routeTree.gen.ts` (`pnpm generate-routes`), `drizzle/` (`pnpm db:generate`).
- Database migrations are additive — a running Worker must survive the migrate-then-deploy window.

## Style

- TypeScript strict. No `any`, no non-null `!` on values that can genuinely be null.
- Named exports, no default exports (route modules excepted — TanStack requires them).
- `cn()` for class merging.
- No nested ternaries — prefer switch or if/else chains. Clarity over brevity.
- No TODOs, placeholder copy, `console.log`, or commented-out code left behind.

## Tests

- New logic has tests, written at the seams the ticket names — not implementation-coupled, not tautological.
- The tenant boundary is the primary test surface: any new tenant-scoped data path needs a tenant-isolation case.

## Commits

- Conventional Commits, in English (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`). The `RALPH:` prefix is reserved for sandcastle in-loop commits.
