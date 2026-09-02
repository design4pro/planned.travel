# planned.travel

Collaborative trip planning on Cloudflare Workers: TanStack Start (React 19),
D1 + Drizzle, R2, Durable Objects, Queues, MapLibre with a self-hosted PMTiles
basemap.

## Quickstart

```bash
pnpm worktree:bootstrap   # fresh checkout or worktree: everything below, once
pnpm dev                  # http://localhost:3000
pnpm test                 # unit tests (Vitest)
pnpm e2e                  # e2e + visual regression (Playwright)
```

Four fixtures are gitignored and per-checkout: `node_modules`, `.dev.vars`, a
migrated local D1 and the basemap in the local R2 bucket. Without the second,
Better Auth returns 500 on `/login` and the whole application behind it is
unreachable. `pnpm worktree:bootstrap` provisions all four, seeds the demo
workspace and prints the sign-in; it is idempotent, and `--check` reports what
is missing without writing. Details in `scripts/worktree/README.md`, the
dataset in `scripts/seed/README.md`, the basemap in `docs/DEPLOY.md` §7. In
cloud sessions and CI the same steps are automated (see below).

Doing it by hand instead: copy `.dev.vars.example` to `.dev.vars` and fill it
in, then `pnpm db:migrate:local`, load the basemap, and seed.

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
