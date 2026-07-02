# CLAUDE.md

Guidance for Claude Code working in this repository. Read this before making changes.

## What this is

**planned.travel** — an AI-native, collaborative travel-planning SaaS. Web-first (Astro SSR on Cloudflare Workers), with an Expo mobile app to follow. All infrastructure runs on Cloudflare (D1, KV, R2, Durable Objects, Queues, Workflows, Vectorize, Workers AI, AI Gateway, Images, Email).

**The roadmap, phases, and task checkboxes live in [`PLANS.md`](./PLANS.md).** The design system lives in [`DESIGN.md`](./DESIGN.md). Keep both updated as you work (PLANS.md after each planning round; DESIGN.md whenever tokens change).

## Critical constraints (do not violate)

- **Clean-room rebuild.** [`mauriceboe/TREK`](https://github.com/mauriceboe/TREK) is **AGPL-3.0** and is a **feature/UX reference only**. Never copy TREK source into this repo — reimplement behaviour from scratch. planned.travel is proprietary. If you're ever tempted to port TREK code, stop.
- **Everything on Cloudflare.** Compute, data, AI, media, realtime all use Cloudflare services (see `apps/web/wrangler.jsonc`). External Postgres (Neon/Supabase) is only acceptable later via Hyperdrive if D1 hits a wall.
- **`nodejs_compat` is required** (`compatibility_flags` in `wrangler.jsonc`) — Better Auth needs Node builtins on the edge.
- **Bindings are runtime-only.** The D1 binding does not exist at module init. Instantiate Better Auth and the Drizzle client **per request** from `Astro.locals.runtime.env` (see `src/server/app.ts`). Never cache them at module scope.
- **Commit/push:** commit when the user asks; branch off `main` for feature work. Pushing is the user's call (needs their credentials).

## Tech stack (locked — see PLANS.md §2 for the full decision log)

| Layer | Choice |
|---|---|
| Web | Astro 5 (SSR) + `@astrojs/cloudflare` + Hono API |
| Styling/UI | Tailwind v4 + **HeroUI v3** (`@heroui/react`, web) · **HeroUI Native** (mobile, later) |
| Data | Cloudflare D1 + **Drizzle** (schema kept Postgres-portable) |
| Realtime | Durable Objects + Hibernation WebSockets (`TripRoom`, Phase 1) |
| Search | Vectorize (semantic) |
| AI | Workers AI + AI Gateway + MCP server |
| Auth | **Better Auth** (Astro + Expo; organizations, admin, twoFactor[+passkey], bearer) |
| Media | R2 + Images · Browser Rendering (PDFs) |
| Notifications / billing | Email Workers · Stripe |
| i18n | PL + EN at launch (Astro i18n + typed catalog; Paraglide-ready) |

## Monorepo layout

```
apps/
  web/        Astro SSR Worker — UI, API (Hono), auth
  mobile/     Expo app (Phase 4 — not yet scaffolded)
packages/
  shared/     zod schemas, types, pure business logic (web + mobile)
  db/         Drizzle schema + D1 client + migrations (generated into apps/web/migrations)
  ui-tokens/  Tailwind v4 @theme tokens (brand palette) — mirrors DESIGN.md
  api-client/ typed fetch client (web + mobile)
```

## Common commands

```bash
pnpm install
pnpm dev                          # all workspaces (Turborepo)
pnpm --filter @planned/web dev    # web only (needs `npx wrangler login` for AI binding)
pnpm --filter @planned/web build  # production build → dist/_worker.js
pnpm typecheck                    # astro check + per-package tsc
pnpm db:generate                  # drizzle-kit generate → apps/web/migrations
pnpm db:migrate:local             # wrangler d1 migrations apply --local
pnpm db:migrate                   # wrangler d1 migrations apply --remote
pnpm --filter @planned/web deploy # build + wrangler deploy
```

**Provision Cloudflare resources (one-time, needs `wrangler login`):** see the header comment in `apps/web/wrangler.jsonc`, then replace the `<REPLACE_*>` IDs.

## Where things live (quick map)

- **API routes:** `apps/web/src/server/app.ts` (Hono, mounted at `/api/*` via `src/pages/api/[...path].ts`). Better Auth under `/api/auth/*`, app routes alongside.
- **Auth config:** `apps/web/src/lib/auth.ts` (`createAuth(env)` factory).
- **DB access:** `packages/db` (`createDb(d1)`), used via `apps/web/src/lib/db.ts`.
- **Realtime collaboration:** `apps/web/src/server/trip-room.ts` (`TripRoom` Durable Object + `broadcastTripChange`); WebSocket upgrade at `/api/trips/:id/sync`. The DO class is exported via the custom worker entry `apps/web/src/worker.ts` (`@astrojs/cloudflare` `workerEntryPoint`). Trip access (owner/editor/viewer) helpers: `apps/web/src/lib/trip.ts` (SSR) + `getAccessibleTrip` in `app.ts` (API).
- **Schema:** `packages/db/src/schema/index.ts` (domain tables; auth tables owned by Better Auth via CLI).
- **Bindings/env types:** `apps/web/src/lib/env.ts` + `src/env.d.ts`.
- **UI tokens / components:** `packages/ui-tokens/src/theme.css` (brand palette) + `apps/web/src/styles/global.css` (imports `@heroui/styles`; maps brand → HeroUI theme vars + legacy shadcn semantic tokens during the transition). HeroUI primitives via `@heroui/react`; legacy shadcn primitives in `apps/web/src/components/ui/*` (only `Button` remains — interim).
- **i18n:** `apps/web/src/i18n/{ui,utils}.ts`; locales `en` (default, no prefix) + `pl` (`/pl`).

## Conventions

- **Schema portability:** text PKs (`crypto.randomUUID()`), epoch-ms integer timestamps — no SQLite-only types in hot paths.
- **Tokens:** change brand values in `DESIGN.md` first, mirror into `packages/ui-tokens/src/theme.css`, keep `global.css` mapping in sync (HeroUI theme vars + legacy shadcn tokens map onto the brand palette).
- **HeroUI (the UI standard):** new UI uses `@heroui/react` (Tailwind v4 + React Aria, provider-less — no `<HeroUIProvider>`). Consult component docs via the `heroui-react` skill or the `AGENTS.md` doc-index (`.heroui-docs/react`). Mobile (Phase 4) uses **HeroUI Native** (Tailwind v4 via Uniwind). `@/*` = `apps/web/src/*`.
- **shadcn (deprecated, interim):** config in `apps/web/components.json`; only `Button` remains. Do not add new shadcn primitives — use HeroUI instead. Removed once the last primitive migrates.
- **i18n:** add keys to both `en` and `pl` in `src/i18n/ui.ts`; translate UI text via `useTranslations(lang)`.
- **Secrets:** never hardcode — use `.dev.vars` (local) and `wrangler secret put` (prod). `.dev.vars.example` documents the list.
- **Bug tracking:** GitHub issues on `design4pro/planned.travel`, not PLANS.md.

## Notes & gotchas

- **Local dev needs `wrangler login`** — the Workers AI binding proxies remotely even in `wrangler dev`/`astro dev`. `astro build` works without login.
- **Better Auth + D1 migrations:** `@better-auth/cli generate` produces SQL → apply via `wrangler d1 migrations apply` (can't run the CLI against the binding directly).
- **Passkey** in better-auth 1.6 is part of the `twoFactor` plugin (no standalone `passkey` export).
- **Astro Sessions:** the Cloudflare adapter requires a `SESSION` KV binding (declared in `wrangler.jsonc`); we use Better Auth DB sessions for app auth.
