# planned.travel

Multi-tenant SaaS travel planner on Cloudflare Workers (TanStack Start + React 19, D1/Drizzle, KV, R2, Durable Objects, Queues). Package manager: pnpm. Stack is pinned — see docs/SPEC.md §3 before adding or changing any dependency.

## Commands

- `pnpm worktree:bootstrap` — **run this first in a fresh checkout or worktree.** Secrets, local D1, basemap, demo workspace, dev server. Without it `/login` answers 500 and the whole app behind it is unreachable
- `pnpm dev` — dev server on :3000
- `pnpm typecheck` / `pnpm lint` / `pnpm test` — the fast feedback loop; run these before committing
- `pnpm build` — production build
- `pnpm e2e` — Playwright critical journeys + i18n parity (needs local D1 migrations; no basemap, ADR 0016)
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

Configuration for the skills in `.claude/skills/` — the project's own, plus the two vendored from mattpocock/skills (see docs/agents/ATTRIBUTION.md):

- **Issue tracker**: GitHub Issues on `design4pro/planned.travel` — see docs/agents/issue-tracker.md
- **Triage labels**: see docs/agents/triage-labels.md
- **Domain docs**: see docs/agents/domain.md
- **Reference product** (feature and quality benchmark; clean-room rule applies): see docs/agents/reference.md
- **Cezar orchestration** (workflows, automations, hooks in agent mode, housekeeping, host cutover): see docs/agents/cezar.md
- **Pipeline runtime documents** read by every `om-*` skill: `.ai/agentic.config.json`, `SDLC.md` (labels, Definition of Ready, QA gate), `CODE_REVIEW.md`, `BACKWARD_COMPATIBILITY.md`; repo-specific rules for a skill live in `.ai/skills/om-<name>/SKILL.md`

Sentry findings enter the backlog through `pnpm sentry-triage` (report-only; `--file-issues` writes) as `bug` + `priority-high`, and are then groomed like any other issue.

New work flows (ADR 0018): issue form → the cezar `issue-groom` run adds SDLC labels, a Definition of Ready check and implementation notes (`om-auto-manage-issues`; re-run with the `groom` label) → a human adds `autofix` → the `issue-autofix` run (`om-auto-fix-issue`: verify, root cause, fix, PR, review, QA for UI; locally `/om-auto-fix-issue <issue>`) ends with a ready PR on `develop` carrying `Closes #n` → a human reviews and merges from the cockpit (`om-approve-merge-pr`; `needs-qa` needs `qa-approved`) → `housekeeping` closes the issue. A feature is specified first: `spec` on the issue → `om-auto-write-spec` lands `.ai/specs/<date>-<slug>.md` on a design-only PR → a human merges it → `implement-spec` from the cockpit (`om-auto-implement-spec`). Thinking before an issue exists is `/om-brainstorm`. Verification ladder: see the `verifying-changes` skill; the gate the skills run is `validation.commands` in `.ai/agentic.config.json`.
