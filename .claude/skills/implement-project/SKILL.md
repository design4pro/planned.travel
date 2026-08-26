---
name: implement-project
description: Implement one ticket (GitHub sub-issue) end to end in this repo, TDD-first, ending with code review and a PR to develop. Use one fresh context per ticket.
disable-model-invocation: true
argument-hint: "<issue number>"
---

Implement the single ticket the user names. Read it with `gh issue view <n> --comments`; read its parent PRD too. Respect the ticket's **Owned paths** — work you discover outside them is reported in an issue comment, never edited.

1. Work on a branch cut from `develop` (in a worktree when available).
2. Use the `tdd` skill at the seams the ticket names — red before green, one slice at a time.
3. Fast loop while working: `pnpm typecheck`, `pnpm lint`, single test files; full `pnpm test` once at the end.
4. Never hand-edit generated files (`src/routeTree.gen.ts` → `pnpm generate-routes`; `drizzle/` → `pnpm db:generate`).
5. Before the PR: `pnpm build`, then `pnpm generate-routes && git diff --exit-code src/routeTree.gen.ts` (route-tree freshness), and `pnpm e2e` if the ticket touched UI — see the `verifying-changes` skill.
6. Use the `code-review` skill to review the work (Standards + Spec axes, fresh eyes).
7. Commit (Conventional Commits, English), push, open a PR targeting `develop`. Do not close the issue — that happens on merge.
