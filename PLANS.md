# planned.travel — Master Plan

> Single source of truth for phases and tasks. Progress is tracked with `[ ]` / `[x]` checkboxes; this file is updated after every planning round. **Bugs are filed as GitHub issues**, not here.
>
> Reference product: [`mauriceboe/TREK`](https://github.com/mauriceboe/TREK) (AGPL-3.0) — used as a **feature/UX reference only**. planned.travel is a **clean-room rebuild** with its own proprietary license.

---

## 1. Context

**planned.travel** is a professional SaaS for travel planning, built greenfield in this repo (`github.com/design4pro/planned.travel`). The target is a responsive **Astro** website hosted fully on **Cloudflare**, with an **Expo** mobile app to follow. All infrastructure — database, AI, vector search, image CDN, compute, realtime — runs on Cloudflare services.

TREK defines the feature bar we are reimplementing (behavior, not code): a self-hosted, real-time collaborative travel planner with maps, budgets, packing lists, a journal, and AI built in.

---

## 2. Decisions locked

- ✅ **Clean-room rebuild.** Reimplemented from scratch; TREK is a feature/UX/market reference only. planned.travel keeps a proprietary license. *Rationale:* TREK is AGPL-3.0 with a network-use clause — reusing its code in a hosted SaaS would force open-sourcing the entire product. The stack changes wholesale (NestJS/SQLite/WS → Astro/D1/Workers), so a code port saves little anyway.
- ✅ **Consumer B2C + collaboration, freemium; extensible to B2B/white-label later.** Primary users: individual travelers + friends/family groups. Data model and auth are designed so an organization/B2B layer can be added without rework.
- ✅ **Primary DB: D1 (SQLite) for v1, schema Postgres-portable via Drizzle.** Realtime = Durable Objects + Hibernation WebSockets; semantic search = Vectorize. Migrate to Postgres-via-Hyperdrive *only if* PostGIS / heavy FTS / write-hot scale demands it. Honors "all on Cloudflare."
- ✅ **Auth: Better Auth** — official Astro + Expo (`@better-auth/expo`) support; D1 via Drizzle. Plugins: organizations, admin (RBAC), bearer + expo for mobile (token in SecureStore), passkey, TOTP, social Google+Apple. CF Workers gotchas handled: `nodejs_compat` flag, instantiate per-request, migrate via `@better-auth/cli generate` → `wrangler d1 migrations apply`. **Cloudflare Access** guards staff/admin surface only.
- ✅ **ORM: Drizzle** (D1 + Postgres + edge-compatible).
- ✅ **UI stack:** Web = Astro + **Tailwind v4 + shadcn/ui** islands. Mobile (later) = **Expo + React Native Reusables/shadcn-style components**. Maps = **MapLibre GL JS** (web) + **maplibre-react-native** (Expo). Shared: one token set, zod schemas, business logic, typed API client, map style/GeoJSON.
- ✅ **Content & admin: internal, role-gated admin panel (not an external CMS).** Marketing/blog → Astro Content Collections. Staff routes also behind Cloudflare Access.
- ✅ **MVP scope: full TREK parity at v1.** Every module reimplemented before public GA. Internal build sequenced in waves (Phases 1–3) converging on one v1 GA. *Large build — assumes sufficient team/runway.*
- ✅ **Monetization: Free / Pro / Team.** Quotas gate AI usage, collab seats, exports, storage.
- ✅ **Maps & places:** MapLibre + free OSM baseline (Overpass/Nominatim or Geoapify/Pelias); Google Places as an optional Pro/on-demand enhancement.
- ✅ **Notifications:** **Resend** via a swappable `EmailSender` adapter (send; Cloudflare Email Workers remains a documented alt) + Email Routing (receive booking emails, Phase 2) + Expo Notifications (mobile push, later) + in-app center. Async delivery via a Cloudflare **Queue (JOBS)** with a direct-delivery fallback for local dev.
- ✅ **PLANS.md working language: English.**
- ✅ **Payments: Stripe** — Checkout + Customer Portal + webhooks → Workflows.
- ✅ **Repo: pnpm + Turborepo** monorepo — `apps/web` (Astro), `apps/mobile` (Expo, future), `packages/{shared,db,ui-tokens,api-client}`.
- ✅ **CI/CD: Cloudflare Workers Builds** — push to `main` deploys; per-branch previews.
- ✅ **Domain:** `planned.travel` (prod) + `staging.planned.travel` + per-branch previews.
- ✅ **AI provider mix: Workers AI only (all-Cloudflare)** for all inference; Vectorize for semantic search; AI Gateway in front for caching/fallback/observability; MCP server (OAuth 2.1). *Caveat: AI Gateway lets us route specific calls to OpenAI/Anthropic later if evals show quality gaps — no rewrite.*
- ✅ **i18n launch languages: Polish + English** (Astro i18n + Paraglide), extensible toward TREK's 20.

---

## 3. What we're porting from TREK (the feature spec)

- **Trip planning** — drag-&-drop day planner; interactive map (3D/terrain, clustering, route viz); place search; import of Google/Naver lists + GPX/KML/KMZ/GeoJSON; timestamped/icon day notes; route optimization; weather; category filters.
- **Travel management** — reservations (flight/hotel/restaurant, status, confirmation #, files) **auto-parsed from booking emails & PDFs** (KDE Itinerary-style); **expense splitting** (Splitwise-style, multi-currency, settle-up); packing lists + bag-weight tracking; document manager; full-trip **PDF export**.
- **Collaboration** — real-time sync; multi-user trips w/ roles; invite links (one-time/reusable/expiry); SSO (Google/Apple/OIDC); 2FA (TOTP); Passkeys (WebAuthn); group chat/notes/polls/check-ins.
- **Add-on modules** — Lists, Costs, Documents, Collab, **Vacay** (vacation planner + country holidays), **Atlas** (visited-countries map, bucket list, stats/streaks), **Journey** (photo journal), **AirTrail** (flight sync), **MCP server** (OAuth 2.1, AI-assistant integration).
- **Platform** — admin panel; i18n; dark mode; notifications (email/webhook/in-app); auto-backups; per-user preferences (units, time formats, tile sources).

---

## 4. Architecture

### 4.1 Cloudflare service map (feature → service)

| Concern | Cloudflare service | Notes |
|---|---|---|
| Host Astro SSR app | **Workers + Static Assets** + `@astrojs/cloudflare` | 2025/26 recommendation over Pages. |
| API layer | **Workers + Hono** | Typed routing, Zod, middleware. Bindings via `runtime.env`. |
| Primary relational DB | **D1** (SQLite) for v1 — Postgres-portable via Drizzle | Migrate to Postgres/Hyperdrive only if needed. |
| Real-time collaboration | **Durable Objects + Hibernation WebSockets** | One DO per trip (`TripRoom`); hibernate when idle. |
| Background jobs | **Queues** | Email, PDF render, notifications. |
| Durable multi-step flows | **Workflows** | AI itinerary-gen pipeline, booking-email ingestion, refunds. |
| Semantic search | **Vectorize** | "Trips like this", destination discovery, NL POI search. |
| AI features | **Workers AI** + **AI Gateway** | Generation, summaries, embeddings, vision. |
| Media (photos, PDFs, exports) | **R2** | Zero egress; S3-compatible. |
| Image optimization/CDN | **Images** | On-demand resize/AVIF/WebP; R2 origin. |
| PDF / OG-image / scraping | **Browser Rendering** | Trip-to-PDF, dynamic social cards. |
| Bot protection | **Turnstile** | Auth/booking forms. |
| Scheduled jobs | **Cron Triggers** | Reminder digests, weather/price refresh, backup rotation. |
| Secrets | **Secrets Store** | API keys, DB creds, OAuth secrets. |
| Transactional email | **Email Workers** (send) / **Email Routing** (receive) | Confirmations, reminders, booking inbox. |
| Sessions / flags / rate-limit | **KV** | Short-TTL data, flags, idempotency. |
| Staff/admin access control | **Cloudflare Access** (Zero Trust) | Verify `Cf-Access-Jwt-Assertion`. Not for consumer auth. |
| Observability | **Workers Observability + Logpush + Analytics Engine + Web Analytics** | Logs, traces, custom metrics, RUM. |

### 4.2 Frontend / UI strategy

- **Web (now):** Astro (SSR via `@astrojs/cloudflare`) + **Tailwind v4** + **shadcn/ui** React islands.
- **Mobile (later):** **Expo** + React Native Reusables/shadcn-style components.
- **Shared across web+mobile:** one Tailwind `@theme` token file; zod schemas; business logic; typed API client; MapLibre style JSON + GeoJSON.
- **Maps:** **MapLibre GL JS** (web) + **maplibre-react-native** (Expo dev build).

### 4.3 Auth

- **Better Auth** (Astro + Expo; D1 via Drizzle). Plugins: organizations, admin (RBAC), bearer + `@better-auth/expo` (mobile), passkey, TOTP, Google+Apple.
- `compatibility_flags = ["nodejs_compat"]`; instantiate per-request; `better-auth/cli generate` → `wrangler d1 migrations apply`.
- **Cloudflare Access** protects staff/admin only.

### 4.4 Content & admin

- **Internal role-gated admin panel** for app data (destinations, POIs, curated lists, packing templates) with typed forms + AI assist.
- **Astro Content Collections** (git-based) for marketing/blog.
- Staff routes behind Cloudflare Access + role checks.

---

## 5. Competitive landscape & differentiation

- **Consumer planners:** Wanderlog, Sygic Travel, TripIt, Roadtrippers, Kayak Trips, Atlas Obscura, Rome2Rio. *(Inspirock, Google Trips — shut down.)*
- **AI-native entrants (2023–25):** Mindtrip, Vacay, iplan.ai, Wonderplan, Skoot; AI features inside Booking/Expedia/Wanderlog.
- **Table stakes:** itinerary builder, map+pins, reservations/doc upload, sharing, offline, collaboration, budget, packing.
- **Our moat (Cloudflare/AI-native):** AI itinerary generation + **conversational editing**; **semantic search** (Vectorize); **real-time multi-traveler collaboration** (DO+WS — most rivals are async/share-only); **smart reminders** (Cron + AI); auto-organized photo journals (vision); group voting; **offline-first mobile**; an **MCP server** so AI assistants manage a user's trips.

---

## 6. Roadmap (checkbox-tracked)

### Phase 0 — Foundation & decisions
- [x] Lock all planning decisions
- [x] Monorepo scaffold (pnpm + Turborepo): `apps/{web,mobile}`, `packages/{shared,db,ui-tokens,api-client}` — installs clean, Astro build verified
- [x] `apps/web` core: Astro + `@astrojs/cloudflare` adapter, Tailwind v4 + React islands, `/api/health` smoke route, landing page
- [x] Drizzle schema (10 domain tables) + first D1 migration (`0000`); Better Auth factory (organizations, admin, twoFactor[+passkey], bearer) mounted at `/api/auth/*`
- [x] `wrangler.jsonc` full binding map (D1/KV/R2/Vectorize/AI/Images active; DO/Queues/Workflows/Email documented for later phases); `nodejs_compat`
- [x] Git remote `origin` → `design4pro/planned.travel` + initial commit (`3831bc8`)
- [x] Hono API mount — typed `/api/*` (Better Auth at `/api/auth/*`, `/api/health`, auth-gated **trips CRUD** over D1/Drizzle); Astro build verified
- [x] shadcn/ui baseline — `components.json`, `cn()`, local primitives, demo island; semantic tokens mapped to brand palette; `@/` alias.
- [x] i18n (PL+EN) — Astro i18n routing + typed message catalog (`/` = EN, `/pl` = PL); Paraglide-ready key structure
- [x] **Provisioned** D1/KV(×2)/R2/Vectorize on DESIGN4PRO, IDs pasted into `wrangler.jsonc`; migrations applied to **local + remote** D1; `pnpm --filter @planned/web dev` verified (`/api/health` → `bindings:{db,ai,vectorize:true}`)
- [x] Better Auth CLI migration generated (`@better-auth/cli` via `auth.cli.ts` introspection instance → drizzle-kit `0001_better_auth.sql`) and applied to local + remote D1
- [x] `git push -u origin main` (all commits pushed; tracking set)
- [x] First deploy → `https://planned-travel-web.design4pro.workers.dev` (`.assetsignore` excludes `_worker.js/` from static assets; `BETTER_AUTH_SECRET` set; live signup → remote D1 verified)
- [ ] **Remaining (Phase 0 → prod hardening):** CI via Workers Builds on `main` (connect repo in CF dashboard, build cmd `pnpm --filter @planned/web run deploy`); `APP_URL` → custom domain `planned.travel` when wired. **Done since last round:** `planned-travel-jobs` queue provisioned; Phase 1 deployed to `planned-travel-web` (worker live, signup→remote D1 + auth gating smoke-verified); notifications **queue deferred** (see Phase 1) — delivering via the direct fallback for now; **eslint configured repo-wide** (`pnpm lint` green across all 4 workspaces; `lint` gate now runs).

### Phase 1 — Core MVP (consumer)
- [x] Auth UI — login/signup (email + social Google/Apple), session gating on `/app`, sign-out (Better Auth React client)
- [x] Trip data model + dashboard (list/create) wired to `/api/trips`; trip detail route
- [x] Day-plan model + planner UI (days/items, add-place) — drag-&-drop reordering deferred
- [x] MapLibre map + POI pins (key-free OSM tiles) on trip page; place search + route visualization — later
- [x] Reservations + document manager (R2); PDF export (Browser Rendering) — manual reservations CRUD (type/status/confirmation/dates/notes, inline edit), R2 document uploads (50 MB cap, attach to reservation, download/delete), trip-to-PDF via Browser Rendering (`@cloudflare/puppeteer`, Pro-gated, graceful 503). **Follow-up:** Browser Rendering can't run in local dev/miniflare — verify the PDF path on the deployed Worker; booking-email/PDF *auto-parsing* is Phase 2.
- [x] Costs / expense splitting (multi-currency)
- [x] Real-time collaboration (DO + Hibernation WS); invite links; roles — TripRoom Durable Object (one per trip, hibernation WS) is a presence + change-bus with **last-write-wins** (DB is source of truth); mutations still go through REST, then `broadcastTripChange()` fans a `change` event to every connected client which refetches (debounced). Roles: owner / editor (mutate) / viewer (read-only, 403 on writes) enforced across reads + writes; trip pages + dashboard open to members. Invite links (`trip_invitation`): opaque token, role, optional expiry/maxUses, revocable; `/invite/<token>` preview + accept. Wired via `@astrojs/cloudflare` `workerEntryPoint` (custom `src/worker.ts` re-exports the fetch handler + the `TripRoom` class). **Verified E2E** (local miniflare, 2 authed sessions): live presence, cross-session change broadcast, invite accept, viewer→403.
- [x] Notifications (email); in-app center — in-app center (reused `notification` table; `/api/notifications` + bell + `/app/notifications` page; en+pl). Async delivery via **JOBS queue** with a direct-delivery fallback for local dev (consumer added as a `queue()` export on `worker.ts` alongside `TripRoom`). Transactional email via **Resend** behind a swappable `EmailSender` adapter (`NoopEmailSender` default — sending gated by `EMAIL_ENABLED` until `RESEND_API_KEY` + a verified domain). Triggers wired into collab/reservations/costs/Stripe via pure, unit-tested builders; **all trigger types now carry a recipient-email block** (resolved in `notifyAll`), not just `invite_sent`. Bell rolled out to every `/app` page. **Verified:** 71 tests + typecheck + build + live API smoke (wrangler dev) + deployed-worker smoke (health/auth-gating/signup→D1). **Queue deviation (prod):** the JOBS queue is provisioned but the consumer is DISABLED — `@astrojs/cloudflare` 12.6.x emits `const queue = _exports['queue']` and workerd's static handler-detection won't register it (`queue_handler_missing` [11001]); DOs work only because they're DECLARED in `durable_objects.bindings`. Notifications therefore use the **direct-delivery fallback** in prod (still deliver in-app + email; synchronously). Candidate fix to restore async: postbuild patch to a static `export function queue`, or an adapter upgrade. **Follow-up:** activate `RESEND_API_KEY` + verified domain + flip `EMAIL_ENABLED`; per-user locale preference (defaults `en`); restore the async queue.
- [x] Stripe billing (Free/Pro) — Checkout + Customer Portal + signature-verified webhook → subscription state; 3-trip Free quota (test mode, Product + 2 Prices created, webhook live). **Follow-up:** Customer Portal dashboard config, rotate `sk_test_` → restricted `rk_` key, set `APP_URL` to prod domain before going live

### Phase 2 — AI-native differentiators
- [ ] Workers AI + AI Gateway + Vectorize wiring
- [ ] AI itinerary generation + conversational edit
- [ ] Semantic destination/POI search
- [ ] Booking-email/PDF ingestion (Workflows + reimpl. KDE Itinerary logic)
- [ ] MCP server (OAuth 2.1)

### Phase 3 — Depth modules
- [ ] Packing lists + templates; Vacay; Atlas; Journey (photo journal, vision AI); AirTrail sync
- [ ] i18n expansion; admin panel; Cloudflare Access for staff

### Phase 4 — Mobile
- [ ] Expo app (React Native Reusables/shadcn-style components + maplibre-react-native); shared tokens/logic/API client; push notifications; offline-first

---

## 7. Verification (how we know each phase works)
- **Local dev:** `wrangler dev` runs `apps/web` with all bindings live locally; `pnpm dev` at root via Turborepo.
- **Per-change gates (CI):** `pnpm typecheck && pnpm lint && pnpm test` (Vitest); `wrangler d1 migrations apply --local`; `@better-auth/cli generate` → migrate auth schema; `@astrojs/cloudflare` build succeeds.
- **Deploy:** push to `main` → Workers Builds → production; feature branches → preview hostnames; verify on `staging.planned.travel`.
- **E2E smoke (per phase):** sign-up / Google+Apple / passkey → create trip → add places via MapLibre → invite 2nd user → realtime edit via `TripRoom` DO → AI itinerary gen (Workers AI) → semantic search (Vectorize) → upload doc (R2 + Images) → PDF export (Browser Rendering) → Stripe Checkout + webhook → Workflow updates subscription. Phase 4: Expo build on iOS/Android with offline trip access.
- **Observability:** Workers Observability + Logpush; Analytics Engine (AI cost/trip, search CTR); Web Analytics (Core Web Vitals); Cloudflare Access on admin.

---

## 8. How we work
- **This file (`PLANS.md`)** tracks phases & tasks via checkboxes; updated after each planning round.
- **Bugs** → GitHub issues on `design4pro/planned.travel`.
- **Deploys** → Cloudflare Workers Builds from `main`.

> **Implementation-level decisions to resolve as we build:** ~~realtime conflict strategy (LWW via DO vs CRDT/Yjs for rich text)~~ — **resolved Phase 1: LWW via the TripRoom DO** (presence + change-bus; DB is source of truth, clients refetch on `change`). CRDT/Yjs remains on the table for future rich-text editing. Remaining: offline-first sync (web PWA Workbox; Expo SQLite + background sync); file-upload caps (docs ≤50 MB, backups ≤500 MB); D1 primary region for data residency/GDPR; design-system/tokens kickoff.
