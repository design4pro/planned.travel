# planned.travel

Multi-tenant SaaS travel planner on Cloudflare Workers (TanStack Start + React 19, D1/Drizzle, KV, R2, Durable Objects, Queues). Package manager: pnpm. Stack is pinned — see docs/SPEC.md §3 before adding or changing any dependency.

## Commands

- `pnpm worktree:bootstrap` — **run this first in a fresh checkout or worktree.** Secrets, local D1, basemap, demo workspace, dev server. Without it `/login` answers 500 and the whole app behind it is unreachable
- `pnpm dev` — dev server on :3000
- `pnpm typecheck` / `pnpm lint` / `pnpm test` — the fast feedback loop while you work. They are **not** the gate: the gate is `validation.commands` in `.ai/agentic.config.json`, and every PR passes it in full
- `pnpm build` — production build
- `pnpm e2e` — Playwright critical journeys + i18n parity (needs local D1 migrations; no basemap, ADR 0016)
- `pnpm generate-routes` — regenerate the route tree; `src/routeTree.gen.ts` is generated, never hand-edit
- `pnpm db:generate` — generate Drizzle migrations; `drizzle/` is generated, never hand-edit
- `pnpm generate-spec-index` — regenerate `.ai/specs/README.md` from the metadata table in each spec; generated, never hand-edit

## Rules

- All SQL lives in `server/repos` and goes through the tenant-scoped base repository; `server/catalog` is the single stated exception. Full contract: docs/SPEC.md §6.
- `components/ui` never fetches data and never imports from `server/`.
- Validate every server-function input with Zod. Named exports only (route modules excepted).
- Definition of done for any task: docs/SPEC.md §7. Decomposition rule ("one concept, one owner"): docs/SPEC.md §8.
- User-facing copy is never hardcoded — it lives in the 23-locale catalogue, and a new key lands in every locale in the same change (the parity test enforces this; procedure: the `i18n-messages` skill, contract: docs/SPEC.md §9).
- A spec's directory is its state — `.ai/specs/` waiting, `implemented/`, `archived/` — and the table under its `H1` names the issue and the pull requests behind it. Move with `git mv`, change `Status` in the same commit, regenerate the index. Rules: `.ai/specs/AGENTS.md`; the guard: `scripts/specs/__tests__/spec-registry.test.ts`.
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

New work flows (ADR 0018): issue form → the cezar `issue-groom` run adds SDLC labels, a Definition of Ready check and implementation notes (`om-auto-manage-issues`; re-run with the `groom` label) → a human adds `autofix` → the `issue-autofix` run (`om-auto-fix-issue`: verify, root cause, fix, PR, review, QA for UI; locally `/om-auto-fix-issue <issue>`) ends with a ready PR on `develop` carrying `Closes #n` → a human reviews and merges from the cockpit (`om-approve-merge-pr`; `needs-qa` needs `qa-approved`) → `housekeeping` closes the issue. A feature is specified first: `spec` on the issue → `om-auto-write-spec` lands `.ai/specs/<date>-<slug>.md` on a design-only PR → a human merges it → the same issue is implemented. No second issue is filed for the implementation: the spec PR carries `Refs #n`, never a closing keyword, so the FR stays open and is the implementation ticket, and `om-auto-write-spec` leaves the spec path and this next step in a comment on it. The trigger is the ordinary one - a human adds `autofix`, and `om-auto-fix-issue`'s feature route resolves the merged spec and hands it to `om-auto-implement-spec`; running `implement-spec` from the cockpit with the issue number is the same skill started by hand. Thinking before an issue exists is `/om-brainstorm`. Verification ladder: see the `verifying-changes` skill; the gate the skills run is `validation.commands` in `.ai/agentic.config.json`.

**A second, unattended intake ladder runs beside that one** (`SDLC.md` § Intake labels, § Trigger labels; the `afk-*` skills in `.ai/skills/`). Where `autofix` is a human handing one issue to the pipeline, the intake labels are the pipeline's own state for an issue: `needs-triage` starts the `triage` run (`afk-triage` writes an Agent Brief, checks the SLC scoping rule, and sets exactly one of `needs-info` / `ready-for-agent` / `ready-for-human`), and `ready-for-agent` starts `implement-ticket`, which implements test-first and ends at a reviewed PR. Neither ladder merges anything, and both share one cap: implementation stops when three agent PRs already wait in `review`. Two things to know before you rely on it: **grooming applies no `needs-triage` yet** — it records `READY_STATUS` and stops, so an issue from the issue form is idle until a human labels it, and the one skill that does set the label, `afk-architecture-review`, only ever sets it on candidates it raised itself (the missing edge is specified in cezar's `.ai/specs/2026-09-17-afk-intake-bridge.md`) — and **`risk-high` and `security` work is unreachable from it by filter**, not merely by convention.

Every `afk-*` skill runs with no one to ask, so where a person would be consulted it picks the most reversible option and records it in a **Resolved assumptions** table (`# | Question | Applied default | Why`) in the brief, spec or PR body it writes. Overturning one of those rows is an ordinary review finding.

The agent layer — the `afk-*` skills, `.ai/cezar/`, `.ai/scripts/`, `.claude/hooks/`, `.claude/settings.json`, `.ai/trackers/github.md`, `scripts/ci/`, the three Claude `.github/workflows/` — used to be rendered here from `design4pro/agent-kit` and hashed in a lock file, so a correction to any of it was a two-repository round trip. **It is vendored now** (ADR 0025): every one of those files is an ordinary file, editable on the branch that needs it, and the check that enforced the hashes is gone from the validation gate. Nothing detects a hand edit any more — review does. The same files are also in `money-tracker.online`, which runs the same pipeline; when a fix belongs in both, apply it in both.
