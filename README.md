# planned.travel

Collaborative trip planning on Cloudflare Workers: TanStack Start (React 19),
D1 + Drizzle, R2, Durable Objects, Queues, MapLibre with a self-hosted PMTiles
basemap.

## Quickstart

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # unit tests (Vitest)
pnpm e2e            # e2e + visual regression (Playwright)
```

Local secrets go in `.dev.vars` (copy `.dev.vars.example`). The e2e suite needs
a migrated local D1 (`pnpm db:migrate:local`), the basemap loaded into the
local R2 bucket and a seeded demo workspace — `scripts/seed/README.md` and
`docs/DEPLOY.md` §7 cover the details; in cloud sessions and CI this is
automated (see below).

## Branch model

- Feature branches (`claude/*`, `feat/*`, …) → pull request to **`develop`**.
- Merging to `develop` auto-deploys **staging**: https://staging.planned.travel
  (`deploy-staging.yml`).
- Promotion is a pull request `develop` → **`main`**; merging deploys
  **production**: https://planned.travel (`deploy.yml`).
- CI (`ci.yml`) runs lint · typecheck · unit tests · build plus the e2e visual
  gate on every pull request to `develop` and `main`. Screenshot baselines are
  per platform: `-darwin` recorded locally (`pnpm e2e:update`), `-linux`
  re-recorded via the manual **Update e2e baselines** workflow, which opens a
  reviewable PR.

## Working with agents

- Mention `@claude` in a GitHub issue and the `claude.yml` workflow implements
  it on a runner: branch cut from `develop`, pull request back to `develop`.
- Or hand a task to a cloud session: `claude --cloud "Implement issue #123"`
  (or from claude.ai/code). The committed SessionStart hook
  (`scripts/cloud/session-start.sh`) prepares the project automatically.
  `docs/CLOUD.md` is the authoritative guide: environment setup, network
  allowlist, what a cloud session can and cannot do.

## Documentation

- `docs/ARCHITECTURE.md` — system architecture
- `docs/SPEC.md` — product spec
- `docs/DEPLOY.md` — provisioning and deploy runbook (D1, R2, basemap, Stripe)
- `docs/CLOUD.md` — working from the cloud (sessions, `@claude`, baselines)
- `docs/plans/` — implementation plans
