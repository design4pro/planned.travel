# planned.travel — Master Build Spec

The single source of truth for every agent on this build. Read fully before writing code.

## 1. What we are building

A **multi-tenant SaaS travel planner** — collaborative trip planning with interactive maps,
budgets, packing lists, reservations, a travel journal and a world-map tracker.

Deployed on **Cloudflare Workers** at **planned.travel**. Paid subscriptions via **Polar.sh**.
First release provisioned for **10 users**, architected so that scaling to thousands is a
config change, never a rewrite.

> **Vendor correction of record.** Stripe was **superseded** as the billing provider by Polar.sh,
> which is Merchant of Record and therefore carries the VAT and sales-tax liability on our
> behalf, and phase A removed it from the repository entirely (§3). This is a correction of a
> factual statement about a third-party vendor and nothing more. It does not touch, soften, or
> create an exception to the clean-room rule below, which stands unchanged and non-negotiable.

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
| Billing | Polar.sh (Checkout + Customer Portal + webhooks) |
| Email | Resend-compatible REST: `EMAIL_API_URL` var + `EMAIL_API_KEY` secret. Nine React Email templates in `src/server/email/templates/**`, the message contract and subject lines in `src/server/auth/email.ts`, delivery in `src/server/queue/handlers/email.ts` |
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

**Named exception: two packages, once — spent.** Exactly two packages could ever be added, by
name: `@react-email/components` and `react-email`. Phase A installed them and the exception is
now closed. `@react-email/components` is a **dependency**, `react-email` a **devDependency**;
both are in `package.json` and in `pnpm-lock.yaml`, and no third name went in beside them. They
exist so the transactional templates are authored as React components instead of concatenated
HTML strings, and they change nothing about where those templates live: `@react-email/components`
re-exports the renderer, so `render()` and `toPlainText()` come from that one import and the
`{ subject, html, text }` shape below is unchanged. `react-email` is the preview CLI and stays a
devDependency — a template that imports from `react-email` rather than `@react-email/components`
pulls the CLI into the Worker bundle, which is a defect. This was a list of two names, not a
policy: any package outside these two is still a finding you report in your result and never a
`pnpm add`, and nothing here grants a precedent, a category, or a "while we are in there"
install.

**Email path, as built.** Transactional mail is wired end to end and needs no new integration.
Phase A rewrote the bodies as React components and left the transport untouched, so the pipeline
now has three parts and one seam between each:

1. **Nine templates** under `src/server/email/templates/`, one file each, all re-exported from
   `src/server/email/index.ts`. Five carry the account lifecycle - `verify-email`,
   `reset-password`, `email-changed`, `delete-account`, `organization-invitation` - and four are
   phase A's billing set: `subscription-confirmed`, `plan-changed`, `payment-failed`,
   `pack-purchased`. Nothing in that directory touches a Worker binding; product identity arrives
   as an `EmailBrand` prop, which is what lets every template render under plain Node in a test.
2. **`renderEmailBody()`** in `src/server/email/render.ts` turns one element into
   `{ html, text }`. Both halves come from `@react-email/components`, which re-exports
   `@react-email/render`'s `render()` and `toPlainText()`; nothing imports the `react-email` CLI,
   which is a devDependency and has no business in a Worker bundle. The plain-text half is derived
   from the rendered HTML rather than authored a second time, so a URL cannot appear in one body
   and be missing from the other - which is how **every template ships a plain-text alternative**
   rather than by nine separate promises. The queue payload carries `text`; a template without one
   delivers an empty message to any client that does not render HTML.
   The renderer is reached through a dynamic `import()` on purpose: its workerd build statically
   pulls `prettier/standalone`, `prettier/plugins/html` and `html-to-text`, about 540 kB that would
   otherwise land on the cold start of every authenticated request, because this module is
   reachable from Better Auth.
3. **`src/server/auth/email.ts`** owns the message union, the subject lines and the analytics tags,
   and `src/server/queue/handlers/email.ts` POSTs the rendered message to the Resend-compatible
   endpoint named by `EMAIL_API_URL` using the `EMAIL_API_KEY` secret, with an idempotency key.
   The handler fails loudly when the key is unset.

**Two follow-ups this path owes, named here rather than left to be rediscovered.** Neither is a
defect in a template and neither is fixed by the round that wrote this paragraph; both belong to
whichever round next owns `src/server/auth/**` and `src/server/billing/**`.

- **F1 - rendering runs inline on the request path.** `queueAuthEmail()`
  (`src/server/auth/email.ts`) awaits `renderAuthEmail()` *before* it enqueues, so React's
  streaming renderer and that 540 kB chunk are evaluated inside the request that triggered the
  mail - a sign-up, a password reset, an invitation. Only *delivery* is queued. §5 says heavy or
  slow work goes to Queues and never inline, and rendering an email is the heavier half of sending
  one. The fix is to enqueue the message *description* and render inside
  `src/server/queue/handlers/email.ts`; the cost of the fix is that the handler then needs the
  brand and the catalogue the producer has today, which is why it is a follow-up and not a
  one-line move.
- **F2 - the four billing templates have no dispatch site.** `BillingEmailMessage` declares
  `billing.subscription-confirmed`, `billing.plan-changed`, `billing.payment-failed` and
  `billing.pack-purchased`, and `describe()` renders all four, but the only caller of
  `queueAuthEmail()` in the product is `src/server/auth/index.ts`, which sends the five auth kinds.
  No path in `src/server/billing/**` sends a billing email, so the four templates are exercised by
  `src/server/email/__tests__/templates.test.tsx` and by nothing else. They are written and unsent.

**The `stripe` package is gone, and so is every line that imported it.** The phase-A dependency
round ran `pnpm remove stripe` in the same edit that installed the two React Email packages, so
the dependency entry and its lockfile block are both absent: `grep -c stripe pnpm-lock.yaml`
returns `0`, and nothing transitive pulls it back. The code followed over two further rounds, and
`grep -ril stripe src/` now returns nothing at all - thirty-one files at the low point, none
today. The Polar client is `src/server/billing/polar.ts`, the mounted webhook route is
`src/routes/api/polar/webhook.ts`, and the four build-time ids `src/lib/plans.ts` reads are
`VITE_POLAR_PRODUCT_SOLO_MONTHLY`, `…_SOLO_YEARLY`, `…_CREW_MONTHLY` and `…_CREW_YEARLY`. Both CI
workflows and `.dev.vars.example` carry that set and no other.

`grep -ril stripe src/` is the check, not the type checker. A git worktree nested inside another
checkout of this repository resolves `stripe` from the **parent** checkout's `node_modules`,
because Node's lookup walks up past the worktree root, so `pnpm typecheck` can pass with imports
still in place. The manifest is the authority and the resolver is not. That sentence is kept for
the next dependency removal, not because this one is open.

**The three provider columns were renamed in migration `0002`.** `stripe_customer_id`,
`stripe_subscription_id` and `stripe_price_id` in `src/server/db/schema.ts` became
`provider_customer_id`, `provider_subscription_id` and `provider_product_id`, and the two indexes
moved with them: `subscriptions_stripe_subscription_unq` →
`subscriptions_provider_subscription_unq`, `subscriptions_stripe_customer_idx` →
`subscriptions_provider_customer_idx`. `docs/ARCHITECTURE.md` §6 and `docs/DEPLOY.md` §9.10 carry
the same decision, and §9.10 now also carries what the rename **cost**: a rename is not an
additive migration, so a `wrangler rollback` past the phase-A release meets a Worker whose SQL
names columns the schema no longer has. `docs/DEPLOY.md` §5 and §12 record that as a bounded,
named exception rather than as a promise the schema cannot keep.

**The user-visible copy moved with the provider, and one string did not.**
`src/routes/legal/terms.tsx` and `src/routes/pricing.tsx` told the reader that Stripe *calculates
and shows sales tax*, which under Polar is false, because §1 records Polar as Merchant of Record
carrying that liability on our behalf. Both were rewritten; the legal pages went first, because
they are a representation to a customer and not a label on a button. The string that did not move
is `src/components/marketing/plans.tsx`, which still renders `14-day free trial, no card needed`
on the Solo and Crew cards of both `/` and `/pricing` - contradicted, on the same pricing page, by
the FAQ's "Polar takes a payment method when the trial starts and charges it the day the trial
ends". No phase-A work item owned that file. It is the third exhibit in §8 and the reason §8
exists.

**The contract documents describe the system that now exists.** `docs/ARCHITECTURE.md` was written
while the superseded path was still mounted, and four places in it said so: the preamble above §1,
the billing-webhook bullet in §2.4, rows 8 and 9 of the §9 failure table, and the note beneath
that table describing the mounted handler. All four are now corrected to the present tense,
because the handler they described no longer exists on disk. An earlier revision of this section
instructed later rounds to leave them alone; that instruction was correct while the cutover was
pending and is retired here, in the same document that issued it, rather than being quietly
disobeyed. `docs/DEPLOY.md` is the runbook for what is deployed, so it is corrected on the same
schedule as the code it documents - which is now.

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

> **Reading the paths in this section.** `src/server/catalog/**`, `src/server/mcp/**`,
> `src/server/public/**`, `src/server/repos/packs.ts` and `src/server/auth/guard.ts` are named
> here as the contract for where that code goes. None of them is on disk yet; each lands with its
> phase (`docs/ARCHITECTURE.md` §2.5). Everything else this section names exists today.

### Multi-tenancy
Every domain row is scoped by `organization_id`. A user belongs to one or more organizations
through `member`. **Every** query goes through a scoped repository in `src/server/repos/**`
that takes an explicit tenant context — never a raw `db.select()` from a route or component.
Tenant isolation is enforced in the repository layer and covered by tests.

#### Global-catalogue carve-out

"Every domain row is scoped by `organization_id`" has exactly one exception, and this is it.
Eight tables are platform content rather than tenant data and carry no `organization_id`:

`catalog_sources` · `catalog_runs` · `catalog_ingest` · `catalog_places` ·
`catalog_place_sources` · `place_packs` · `place_pack_places` · `staff_api_tokens`

That list is closed. A ninth global table is a change to this contract, not a schema decision a
builder makes on the way past.

These tables must **never** be reached through `src/server/repos/base.ts` or
`createTenantRepository()`. That layer exists so that forgetting the tenant filter is not
expressible, and handing it a fabricated, empty, or placeholder tenant context in order to reach
global rows destroys the single guarantee it was built to give. Reaching for
`createTenantRepository()` here is a defect, not a shortcut.

Their isolation invariant is different and equally mandatory. All access goes through
`src/server/catalog/repo.ts`, where every mutation takes an explicit platform actor
(`{ userId, actorKind, role }`), passes `requirePermission` before it touches a row, and writes a
`platform_audit_log` entry in the same call: actor, action, entity type, entity id, and a
before/after `changes` payload. Reads go through the same door: a row that is not `published`
needs a platform permission, a `published` row is readable by an entitled tenant and, without a
session, only through the column-whitelisted projections in `src/server/public/**`. Tests cover
this boundary the way tenant-isolation tests cover the repository boundary - a `curator` may not
act outside its statements, and an unaudited mutation is a failing test.

`pack_entitlements` is **not** in that list. Which workspace bought which pack is tenant data:
it is scoped by `organization_id`, lives in `src/server/repos/packs.ts`, and stays on the
existing `createTenantRepository()`. The pack is global; the right to use it is not.

### Platform roles

Two role vocabularies coexist and must never be conflated. **Organization roles** (`owner`,
`admin`, `member`, from Better Auth's `organization` plugin) describe standing inside one
workspace and keep exactly their present meaning. **Platform roles** describe standing on the
product itself, and they are new.

Platform roles come from Better Auth's `admin` plugin, which ships inside the pinned
`better-auth@1.7.1`. Registering it adds no dependency and does not touch §3's freeze. Three
roles, and no fourth:

| Role | Authority |
|---|---|
| `admin` | Full platform authority: user management, roles, bans, session revocation, impersonation, MCP token issuance, everything a `curator` may do. |
| `curator` | The catalogue, packs, sources and share moderation. Nothing that touches users or sessions. |
| `user` | Everyone else, which is nearly everyone. No platform surface at all. |

`defaultRole: 'user'` - a platform role is only ever raised deliberately. The plugin adds five
columns and they are the whole storage cost of the model: `user.role`, `user.banned`,
`user.ban_reason`, `user.ban_expires` and `session.impersonated_by`. All five are non-writable
from the client.

Authorisation is decided in exactly one place, `requirePermission` in
`src/server/auth/guard.ts`, used identically by console server functions and by the MCP server,
so "may this actor do this" never grows a second implementation. A session with
`session.impersonated_by` set carries a persistent warning bar with an "end impersonation"
action on every screen; entering and leaving impersonation are both audited.

### Billing surface

Settled once, so no later round re-argues it. `/settings/billing` offers a **Manage billing**
action that mints a customer session server-side and redirects the browser to the hosted Polar
Customer Portal it returns, alongside a **read-only** list of orders and invoices for the active
organization. We do **not** build an in-app invoice-details form. Polar is Merchant of Record:
it determines the tax and issues the legal invoice, so billing name, VAT number and billing
address have to be edited where the invoice is produced, or our copy and the legal document
disagree at precisely the moment an accountant reads them. Payment-method changes are
portal-only for the same class of reason - it is what keeps card data outside our PCI scope.

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

Non-secret configuration lives in the `vars` block; secrets never appear in `wrangler.jsonc`,
and the complete list with its acquisition steps lives in `.dev.vars.example`. Six secrets are
new, spelled exactly this way everywhere:

| Secret | What it is |
|---|---|
| `POLAR_ACCESS_TOKEN` | Organization Access Token for every server-side Polar call. It never reaches the browser. |
| `POLAR_WEBHOOK_SECRET` | Signing secret for the billing webhook endpoint. |
| `POLAR_SERVER` | `sandbox` or `production`. Selects the API base URL. It sits with the secrets rather than in `vars` so one file switches the whole billing environment, and because sandbox and production are separate accounts with separate tokens and separate product ids. |
| `FIRECRAWL_API_KEY` | Bearer token for the scrape and crawl calls behind the catalogue pipeline. |
| `FIRECRAWL_WEBHOOK_SECRET` | HMAC secret verifying crawl callbacks. It is one account-wide value, not one per endpoint. |
| `MCP_TOKEN_PEPPER` | Hashing pepper for `staff_api_tokens`. Rotating it invalidates every issued MCP token at once, the way rotating `BETTER_AUTH_SECRET` logs everyone out. |

**Cron.** The weekly catalogue scrape is `0 4 * * 1`. It is registered in `wrangler.jsonc` - in
the top-level `triggers.crons` list *and* in the `env.staging` override, since a deploy replaces
the whole list - and given its `switch (controller.cron)` branch in `src/server/worker.ts` in
**phase D**. Until that phase it is inert and deliberately absent from both files: registering a
schedule ahead of its handler makes the next deploy invoke a branch that does not exist. It is
unrelated to the `17 4 * * 1` retention prune that runs seventeen minutes later the same
morning; neither depends on the other's ordering.

## 6. Repo conventions

```
src/
  routes/            file-based routes ONLY (TanStack Router)
    __root.tsx       document shell
    index.tsx        marketing landing
    (auth)/          login, register, reset, 2fa  — owned by auth
    _app/            authenticated app shell + all product modules
    api/             server route handlers (auth, billing + scrape webhooks, tiles, MCP)
  components/
    ui/              design-system primitives (no product logic, no data fetching)
    layout/          app shell, nav, headers
    <module>/        product components for one module
  server/
    db/              drizzle schema + client
    auth/            Better Auth setup, tenant context, permission guard, email rendering
    repos/           tenant-scoped data access (every tenant query and its SQL)
    catalog/         global catalogue access - the single stated exception to the SQL rule
    public/          session-less reads - read-only, column-whitelisted projections only
    mcp/             JSON-RPC 2.0 tool server - transport and tool schemas, no data layer
    billing/         Polar client, webhook handling, entitlements, quota resolution
    queue/           queue producer, envelopes and handlers
    observability/   structured logging, health probes
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
- The single stated exception is `server/catalog`, and it exists only because the eight global
  tables in §5 carry no `organization_id` and therefore cannot pass through the tenant
  repository at all. It is the one exception; a second one is a change to this contract. Its
  SQL is guarded instead by an explicit platform actor, `requirePermission`, and a
  `platform_audit_log` write in the same call.
- `server/public` is the only path that reads without a session, and it holds no SQL of its own.
  Every response is a named read-only projection - an explicit column whitelist of what a
  stranger may see, so leaking a field is unexpressible - executed through `server/repos` for
  token-resolved tenant resources and `server/catalog` for published global rows. The tenant
  scope it passes is always the one derived from the share record it resolved, never fabricated.
- `server/mcp` owns transport and tool schemas only. Every tool authorises through the same
  `requirePermission` the console uses and reaches data through `server/catalog`; it never grows
  a second authorisation path or a second query layer.
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
6. You did not touch files outside your assigned ownership. Work you discover elsewhere is
   reported, never edited — and if that work is a *concept* rather than a file, §8 governs how
   the next round draws the item that owns it.

## 8. Decomposition rule: one concept, one owner

**A change whose blast radius is a concept rather than a file must be owned by exactly one work
item, and that item must own every file the concept touches.**

A concept, for this rule, is anything that is true in more than one place at once and has to stay
true in all of them: a shared exported type or its field names, a dependency in `package.json`, a
vocabulary (`stripe_*` → `provider_*`), a claim repeated across pages, a cache key's shape, a
column and every mapper that crosses it. The test is not "how many lines change" but "can half of
this land and leave the repository self-consistent?" If the answer is no, the change is one item.

Three corollaries, because each is a mistake this repository has actually made:

- **A rename of a shared export lands with all of its consumers or not at all.** Deferring a
  consumer to a later item does not defer the breakage.
- **Removing a dependency is a global operation.** It is finished when the last import is gone,
  not when the manifest entry is.
- **A claim is a file.** If the same sentence is rendered from a component none of the items
  owns, the item that owns the claim owns that component too — otherwise the claim is corrected
  everywhere the round looked and nowhere it did not.

### Why this is a rule and not advice

Phase A paid for it three times, in three separate rounds, and each one is on the record:

| Round | The concept | What it cost |
| --- | --- | --- |
| 1 | `PlanPrice.priceId` renamed to `productId`, and `planForPriceId` dropped, in `src/lib/plans.ts` | All five consumers — `checkout.ts`, `mapping.ts`, `store.ts`, `limits.ts` and the demo seed — sat in items the round had deferred under a three-item cap. Eight typecheck errors, 338 failing tests, and a `MISSING_EXPORT` at build. |
| 1 | `pnpm remove stripe` | The manifest entry left while **31 files** under `src/` still imported it, so those files could not compile at all. It took rounds 2 and 3 to finish, 31 → 12 → 0. |
| 3–4 | "14-day free trial, no card needed" | Item 6 owned `billing.tsx`, `pricing.tsx` and `terms.tsx`, so the trial copy was corrected in all three. The string is rendered from `src/components/marketing/plans.tsx`, which no item owned, and it is still on `/` and `/pricing` today — beside the same page's FAQ saying Polar takes a card. |

The third row also records how a fix gets *reported* as done when it is not. The evidence offered
was `curl … /pricing | grep -c 'no card needed'` returning `0`. Run today against the dev server
that same command returns `1`, and the page contains the string **twice** — once on the Solo card
and once on the Crew card, with `/` the same. Whatever produced the zero, the check was never
capable of proving the claim, because it was run on a surface the fix did not own. A grep is
evidence about a file; a page is evidence about a render.

### How to apply it when drawing a round

1. Before splitting, list the concepts the round changes. For each, run the grep that enumerates
   every file it appears in — not a shortlist from memory, which has been wrong every time.
2. Give each concept exactly one owner, and give that owner the whole grep result. If two items
   need the same file, one of them is drawn wrong.
3. Tests belong to the owner of the code they test.
4. A concept whose file set exceeds one item's reasonable size is not a reason to split it. It is
   a reason to make that item the whole round.
