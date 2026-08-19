# planned.travel — Master Build Spec

The single source of truth for every agent on this build. Read fully before writing code.

## 1. What we are building

A **multi-tenant SaaS travel planner** — collaborative trip planning with interactive maps,
budgets, packing lists, reservations, a travel journal and a world-map tracker.

Deployed on **Cloudflare Workers** at **planned.travel**. Paid subscriptions via **Stripe**.
First release provisioned for **10 users**, architected so that scaling to thousands is a
config change, never a rewrite.

### Clean-room rule (non-negotiable)

We use the open-source project TREK as a **feature and data-model reference only**, and its
public demo as a **visual quality bar**. TREK is AGPL-3.0 with an asserted trademark.

- **Never** copy TREK source code, comments, strings, or assets into this repo.
- **Never** use the name "TREK", its wordmark, or its logo anywhere.
- Our product is **planned.travel**, with its own branding and its own implementation.
- A reference clone may exist under the session scratchpad. Read it to understand *what*
  a feature does. Write our own code to do it.

## 2. Quality bar

Every screen is judged by an adversarial critic that compares it **blind, side by side**
against the reference demo and must independently choose ours as the better-looking product.
"It works" is not done. "It looks as good" is not done. It must look *better*.

Specifically:
- Pixel-honest spacing on an 4px grid. No eyeballed one-off margins.
- Every interactive element has hover, focus-visible, active, disabled and loading states.
- Every list has a designed empty state, skeleton loading state, and error state.
- Motion is purposeful: 150–260ms, `--ease-out-quint`. Nothing linear. Nothing over 400ms.
- Full parity in light **and** dark theme. Dark is not an inverted afterthought.
- Responsive 360px → 2560px. Mobile is a designed layout, not a squeezed desktop.
- Keyboard navigable end to end. WCAG 2.2 AA contrast minimum.
- Zero console errors or warnings. Zero layout shift after paint.

## 3. Stack (pinned — do not change, do not add deps)

| Concern | Choice |
|---|---|
| Framework | TanStack Start (React 19, file-based routing, server functions) |
| Build | Vite 8 + `@cloudflare/vite-plugin` (`viteEnvironment.name = 'ssr'`) |
| Runtime | Cloudflare Workers (`nodejs_compat`) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), tokens in `src/styles/tokens.css` |
| Primitives | `radix-ui` (unified pkg) + our own wrappers in `src/components/ui` |
| Data (relational) | Cloudflare D1 + Drizzle ORM |
| Cache / sessions | Workers KV |
| Files / tiles | R2 |
| Realtime | Durable Objects + WebSockets (`partysocket` client) |
| Background work | Queues + Cron Triggers |
| Auth | Better Auth on D1 (email+password, social, passkeys, TOTP) |
| Billing | Stripe (Checkout + Billing Portal + webhooks) |
| Maps | MapLibre GL + Protomaps `.pmtiles` from R2 |
| Server state | TanStack Query + Start server functions |
| Forms | TanStack Form + Zod v4 |
| Icons | `lucide-react` |
| Motion | `motion` |
| Drag & drop | `@dnd-kit` |
| Toasts | `sonner` |
| Tests | Vitest (unit) + Playwright (e2e/visual) |

**Dependency freeze.** The dependency set is complete. Do **not** run `pnpm add`, and do not
edit `package.json` or `pnpm-lock.yaml`. If you genuinely need a package that is absent, stop
and report it in your result instead of installing it.

## 4. Design language

Confident editorial-modern. Warm neutral canvas, soft-cornered cards, oversized display
numerals, tiny uppercase tracked labels, one near-black accent, generous whitespace.

**Type.** Display = `MuseoModerno` (geometric, rounded, friendly — headings, wordmark, hero
numerals). UI/body = `Geist Sans` (crisp at small sizes, excellent tabular numerals). Load
both from Google Fonts with `display=swap` and a real fallback stack. Always
`font-variant-numeric: tabular-nums` on any number that can change.

**Tokens.** All colour, spacing, radius, shadow, easing and z-index values come from
`src/styles/tokens.css` via Tailwind v4 `@theme`. Never hardcode a hex, px radius, or shadow
in a component. If a value is missing from the token set, add it to the token file.

**Signature patterns** to reuse (defined once in `src/components/ui`):
- `Card` — `--radius-xl`, `--shadow-card`, hairline `--color-edge-faint` border.
- `StatCard` — tiny uppercase tracked label above an oversized display numeral, optional
  inline sparkline, optional inverse (near-black) variant.
- `PillNav` — segmented control on a tinted track, animated active pill.
- `Fab` — floating near-black action button, bottom-right, above content.
- `GlassPanel` — floating translucent panel used over the map (backdrop blur + hairline).
- `SectionLabel` — the 11px/uppercase/0.08em label used on every panel header.

## 5. Architecture

### Request path
Browser → Cloudflare edge → Worker (TanStack Start SSR + server functions) → D1 / KV / R2 / DO.

### Multi-tenancy
Every domain row is scoped by `organization_id`. A user belongs to one or more organizations
through `member`. **Every** query goes through a scoped repository in `src/server/repos/**`
that takes an explicit tenant context — never a raw `db.select()` from a route or component.
Tenant isolation is enforced in the repository layer and covered by tests.

### Scaling posture (10 → thousands of users)
- Stateless Workers; all state in D1/KV/R2/DO. Horizontal scale is automatic.
- **Read path**: cache hot reads in KV with short TTL + explicit invalidation on write.
  D1 is never in the critical path for anonymous marketing pages.
- **Per-trip realtime**: one Durable Object per trip (`TripRoom`), so collaboration load
  shards naturally by trip and never contends globally.
- **Writes**: keep D1 transactions small and single-purpose; batch with `db.batch()`.
- **Heavy/slow work** (PDF export, imports, email, thumbnails) → Queues, never inline.
- **Assets/tiles** → R2 + Cache API with immutable long-lived caching.
- **Quotas** are enforced per plan at the repository boundary so a single tenant cannot
  degrade others.
- Instrument with Workers Observability; every server function emits structured logs.

### Bindings (`wrangler.jsonc`)
`DB` (D1) · `KV` (cache) · `SESSIONS` (KV) · `FILES` (R2) · `TILES` (R2) ·
`TRIP_ROOM` (Durable Object) · `TASKS` (Queue) · secrets via `wrangler secret`.

## 6. Repo conventions

```
src/
  routes/            file-based routes ONLY (TanStack Router)
    __root.tsx       document shell
    index.tsx        marketing landing
    (auth)/          login, register, reset, 2fa  — owned by auth
    _app/            authenticated app shell + all product modules
    api/             server route handlers (auth, stripe webhooks, tiles)
  components/
    ui/              design-system primitives (no product logic, no data fetching)
    layout/          app shell, nav, headers
    <module>/        product components for one module
  server/
    db/              drizzle schema + client
    repos/           tenant-scoped data access (the ONLY place SQL lives)
    fns/             TanStack Start server functions
    do/              Durable Objects
  lib/               isomorphic helpers, formatters, hooks
  styles/            tokens.css, styles.css
drizzle/             generated SQL migrations
docs/                spec + architecture notes
```

Rules:
- `routeTree.gen.ts` is **generated**. Never hand-edit. Run `pnpm generate-routes`.
- Components in `components/ui` never fetch data and never import from `server/`.
- All SQL lives in `server/repos`. Routes call server functions; server functions call repos.
- Validate every server-function input with Zod. Never trust the client.
- Named exports, no default exports (except route modules, which TanStack requires).
- `cn()` from `src/lib/cn.ts` for class merging.
- TypeScript strict. No `any`, no non-null `!` on values that can genuinely be null.

## 7. Definition of done for any task

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.
