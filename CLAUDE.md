# planned.travel

Multi-tenant SaaS travel planner on Cloudflare Workers (TanStack Start + React 19, D1/Drizzle, KV, R2, Durable Objects, Queues). Package manager: pnpm. Stack is pinned — see docs/SPEC.md §3 before adding or changing any dependency.

## Commands

- `pnpm dev` — dev server on :3000
- `pnpm typecheck` / `pnpm lint` / `pnpm test` — the fast feedback loop; run these before committing
- `pnpm build` — production build
- `pnpm e2e` — Playwright visual + i18n suites (needs local D1 migrations and the basemap)
- `pnpm generate-routes` — regenerate the route tree; `src/routeTree.gen.ts` is generated, never hand-edit
- `pnpm db:generate` — generate Drizzle migrations; `drizzle/` is generated, never hand-edit

## Rules

- All SQL lives in `server/repos` and goes through the tenant-scoped base repository; `server/catalog` is the single stated exception. Full contract: docs/SPEC.md §6.
- `components/ui` never fetches data and never imports from `server/`.
- Validate every server-function input with Zod. Named exports only (route modules excepted).
- Definition of done for any task: docs/SPEC.md §7. Decomposition rule ("one concept, one owner"): docs/SPEC.md §8.
- User-facing copy is never hardcoded — it lives in the 23-locale catalogue, and a new key lands in every locale in the same change (the parity test enforces this; procedure: the `i18n-messages` skill, contract: docs/SPEC.md §9).
- Commits: Conventional Commits, in English.

## Domain

Domain vocabulary lives in CONTEXT.md — a glossary and nothing else. Architecture decisions live in docs/adr/.

## Agent skills

Configuration for the mattpocock-skills plugin and project skills:

- **Issue tracker**: GitHub Issues on `design4pro/planned.travel` — see docs/agents/issue-tracker.md
- **Triage labels**: see docs/agents/triage-labels.md
- **Domain docs**: see docs/agents/domain.md
- **Reference product** (feature and quality benchmark; clean-room rule applies): see docs/agents/reference.md

Sentry findings enter the backlog through `pnpm sandcastle:sentry` (report-only; `--file-issues` writes) as `type: bug` + `status: pending`, and are then pre-triaged like any other bug.

New work flows: grilling → `/to-spec-project` (PRD issue) → `/to-tickets-project` (vertical-slice sub-issues) → `/implement-project` per ticket in a fresh context. Verification ladder: see the `verifying-changes` skill.
