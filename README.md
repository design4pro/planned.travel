# planned.travel

AI-native, collaborative travel-planning SaaS. Web-first (Astro on Cloudflare), with an Expo mobile app to follow. All infrastructure runs on Cloudflare.

> **Reference, not fork.** [`mauriceboe/TREK`](https://github.com/mauriceboe/TREK) (AGPL-3.0) is used as a **feature/UX reference only**. This codebase is a clean-room rebuild under a proprietary license — no TREK code is used.

## Stack

- **Frontend:** Astro (SSR, `@astrojs/cloudflare`) + Tailwind v4 + shadcn/ui islands; Hono API.
- **Mobile (later):** Expo + NativeWind + react-native-reusables + maplibre-react-native.
- **Data:** Cloudflare D1 (Drizzle ORM) · Durable Objects (realtime) · Vectorize (semantic search).
- **AI:** Workers AI + AI Gateway · MCP server.
- **Auth:** Better Auth (Astro + Expo; organizations, RBAC, passkey, TOTP, Google+Apple).
- **Media:** R2 + Images · Browser Rendering (PDFs). **Notifications:** Email Workers.
- **Billing:** Stripe. **Hosting:** Workers + Static Assets. **CI/CD:** Workers Builds.

## Monorepo layout

```
apps/
  web/        Astro SSR app (Cloudflare Worker + Static Assets)
  mobile/     Expo app (future)
packages/
  shared/     zod schemas, types, business logic (shared web+mobile)
  db/         Drizzle schema + migrations (D1)
  ui-tokens/  Tailwind v4 @theme design tokens (shared web+mobile)
  api-client/ typed fetch client (shared web+mobile)
```

## Getting started

```bash
pnpm install
pnpm dev            # run all workspaces (Turborepo)
pnpm --filter @planned/web dev   # just the web app (wrangler dev, bindings local)
```

Provision Cloudflare resources (one-time, requires `wrangler login`):

```bash
pnpm --filter @planned/web exec wrangler d1 create planned-travel
pnpm --filter @planned/web exec wrangler kv namespace create KV
pnpm --filter @planned/web exec wrangler r2 bucket create planned-travel-media
pnpm dlx wrangler vectorize create planned-travel-embeddings --dimensions 768 --metric cosine
```

Then update the generated IDs in `apps/web/wrangler.jsonc`.

See **[PLANS.md](./PLANS.md)** for the full plan, phased roadmap, and task tracking.
