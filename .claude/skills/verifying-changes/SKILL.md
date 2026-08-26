---
name: verifying-changes
description: The canonical verification ladder for this repo and how to read its feedback loops (vitest, Playwright visual diffs, dev-server pitfalls). Use before claiming any change works, and when a test failure looks confusing.
---

## The ladder

1. Fast loop while working: `pnpm typecheck`, `pnpm lint`, single vitest files.
2. Before committing: full `pnpm test`.
3. Before a PR: `pnpm build`, then `pnpm generate-routes && git diff --exit-code src/routeTree.gen.ts` (CI rejects a stale route tree). Run this **even when you never touched a route**: `pnpm build`'s vite plugin rewrites the file with a different tail than bare `tsr generate`, so a blanket `git add -A` after a build commits a variant the CI gate rejects.
4. UI touched: `pnpm e2e` locally (darwin baselines) — and remember the visual gate also runs in CI on the PR (linux baselines). Baselines change only via `pnpm e2e:update` (darwin) or the update-snapshots.yml workflow (linux), never by hand.
5. In a sandcastle Docker sandbox: `bash .sandcastle/setup-e2e.sh` once (dev.vars, D1 migrations, basemap into the local R2 sim, server on :3010, seed), then `PLAYWRIGHT_BASE_URL=http://localhost:3010 pnpm e2e`. The sandbox image is CI's Playwright image, so `-linux` baselines compare directly; each container has its own network namespace, so :3010 never collides between parallel sandboxes.

## Reading failures (hard-won facts — trust them)

- A Playwright or vitest failure whose message is a **TIMEOUT, with no pixel count and no assertion diff**, is evidence about machine load, not about the code. Rerun; never change code in response to one.
- A **whole route suite failing on one repeated error shape** (e.g. HTTP 504 "Outdated Optimize Dep", or every authenticated spec skipping) is a statement about the dev server, never about the diff. Clear `node_modules/.vite`, restart the server, rerun.
- Authenticated specs hold the demo session in `e2e/.auth/demo.json`. A stale session does not fail — it **redirects to /login and specs skip**. Refresh with `pnpm exec playwright test --project=setup`.
- `.dev.vars` is gitignored, so a fresh `git worktree add` lacks it; without it Better Auth returns 500 on /login and every authenticated spec skips. Copy it from the main checkout first.
- `playwright.config.ts` refuses to run non-CI against ports outside 3010–3020 — that guard exists because rounds have photographed the wrong worktree. Don't fight it.
- When probing an open Radix Select, read `aria-expanded`/option counts via raw DOM queries in `page.evaluate` — Radix marks the rest of the document `aria-hidden` while open, so role locators stop matching.

## Reading a visual diff

Open the Playwright HTML report (`playwright-report/`): the diff view shows expected/actual/diff triplets. A diff that is a uniform shift of a whole region usually means layout (spacing, font swap); scattered speckle on the map region means rendering nondeterminism, not your change. If the change is intended, re-record baselines through the sanctioned paths above and say so in the PR.
