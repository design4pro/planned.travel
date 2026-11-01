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
- A reference clone may exist under the session scratchpad. Read it to understand _what_
  a feature does. Write our own code to do it.

## 2. Quality bar

Every screen is judged by an adversarial critic that compares it **blind, side by side**
against the reference demo and must independently choose ours as the better-looking product.
"It works" is not done. "It looks as good" is not done. It must look _better_.

### Where the reference demo actually is

Recorded in Faza B. There are **three** reference surfaces and they answer different questions;
confusing them cost this phase a malformed decision and three agents blocked by a safety
classifier.

1. **The public demo, `https://demo.liketrek.com/dashboard`** - populated with sample data, and
   the surface a ticket means when it names no other. It is what the blind critic has compared
   against since the first visual round, whether or not anyone said so out loud. The URL and the
   rules of engagement for all three surfaces are recorded in docs/agents/reference.md. Its content
   **resets every hour**, so it is a pristine read-only exhibit: nothing you create there sticks,
   and nothing you created a moment ago is guaranteed to still exist.
2. **A clean local instance with administrator access** - see below. Use it for the authenticated
   surfaces the public demo cannot show, above all the admin console.
3. **The source clone** - use it to see _which_ solution the reference reached for and _where_,
   never to copy it.

A decision about "introducing a live reference" is meaningless unless it says **which of the
three**. The operator's local setup:

- **Live instance:** `https://app.trek.orb.local/`, served by OrbStack. Two things break a naive
  capture and both are quiet failures rather than errors. The certificate is self-signed, so a
  client without `--insecure` (or the Playwright equivalent) gets a connection error that reads
  like the host being down; and the hostname resolves through OrbStack's own resolver, so a plain
  `host`/`dig` lookup returns NXDOMAIN while `curl` succeeds. Neither means the instance is
  unavailable. If the Orb hostname is unreachable anyway, the same instance answers on plain
  `http://localhost:3900/login` — try that before concluding it is down.
- **Source clone:** `/Users/rafalwolak/dev/test/trek`. §1 governs it: read it to learn _what_ a
  feature does, never to copy how it does it. Where the clone is absent — a cloud or CI agent —
  the public repository `https://github.com/liketrek/TREK` is the same source under the same §1
  rules.
- **Authenticated screens need a session.** The admin surface is at `/admin` behind an
  `adminRequired` guard, and the product's own screens are behind a login, so an unauthenticated
  capture photographs a sign-in form and compares _that_ to our console - a verdict that looks
  real and means nothing. The first-boot credentials are environment variables in the clone's
  `docker-compose.yml`; read them from there rather than from anywhere else, and never copy them
  into this repo.

**Capture hygiene, and it is not a nicety.** Reference captures are written **outside this
repository**. Faza B round 10 left a 743 KB reference screenshot untracked at the repo root, which
§1 forbids anywhere in this repo - untracked is still in the repo. `/*.png` is gitignored now,
but the rule is the point: the clean-room boundary survived ten rounds of comparing and was broken
by the mechanics of comparing, not by anyone copying anything.

**What the reference cannot settle.** Its admin surface is a tabbed users table with modals, and
it has no per-account detail screen at all. Everything `docs/ACCESS.md` requires of
`/_app/console/users/$userId` - the organizations an account belongs to and the role it holds in
each, the audit timeline read from `platform_audit_log`, the subscription - is ours by contract
rather than by parity. Asking the reference about those panels returns nothing, so a round that
treats a missing panel as "the reference doesn't have it either" has misread which document it is
building against.

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

| Concern           | Choice                                                                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | TanStack Start (React 19, file-based routing, server functions)                                                                                                                                                                                                              |
| Build             | Vite 8 + `@cloudflare/vite-plugin` (`viteEnvironment.name = 'ssr'`)                                                                                                                                                                                                          |
| Runtime           | Cloudflare Workers (`nodejs_compat`)                                                                                                                                                                                                                                         |
| Styling           | Tailwind CSS v4 (CSS-first `@theme`), tokens in `src/styles/tokens.css`                                                                                                                                                                                                      |
| Primitives        | `radix-ui` (unified pkg) + our own wrappers in `src/components/ui`                                                                                                                                                                                                           |
| Data (relational) | Cloudflare D1 + Drizzle ORM                                                                                                                                                                                                                                                  |
| Cache / sessions  | Workers KV                                                                                                                                                                                                                                                                   |
| Files / tiles     | R2                                                                                                                                                                                                                                                                           |
| Realtime          | Durable Objects + WebSockets (`partysocket` client)                                                                                                                                                                                                                          |
| Background work   | Queues + Cron Triggers                                                                                                                                                                                                                                                       |
| Auth              | Better Auth on D1 (email+password, social, passkeys, TOTP)                                                                                                                                                                                                                   |
| Billing           | Polar.sh (Checkout + Customer Portal + webhooks)                                                                                                                                                                                                                             |
| Email             | Resend-compatible REST: `EMAIL_API_URL` var + `EMAIL_API_KEY` secret. Ten React Email templates in `src/server/email/templates/**`, the message contract and subject lines in `src/server/auth/email.ts`, delivery in `src/server/queue/handlers/email.ts`                  |
| Maps              | MapLibre GL + Protomaps `.pmtiles` from R2                                                                                                                                                                                                                                   |
| Server state      | TanStack Query + Start server functions                                                                                                                                                                                                                                      |
| Forms             | TanStack Form + Zod v4                                                                                                                                                                                                                                                       |
| Icons             | `lucide-react`                                                                                                                                                                                                                                                               |
| Motion            | `motion`                                                                                                                                                                                                                                                                     |
| Drag & drop       | `@dnd-kit`                                                                                                                                                                                                                                                                   |
| Toasts            | `sonner`                                                                                                                                                                                                                                                                     |
| Observability     | Structured logs to Workers Observability (`src/server/observability`) + Sentry (`@sentry/cloudflare` in the Worker, `@sentry/react` in the browser): errors, logs, tracing, metrics and masked session replay. One project, environments told apart by the `environment` tag |
| Tests             | Vitest (unit) + Playwright (critical journeys, no screenshots — ADR 0016)                                                                                                                                                                                                    |

**Dependency freeze.** The dependency set is complete. Do **not** run `pnpm add`, and do not
edit the `dependencies` or `devDependencies` blocks of `package.json`, or `pnpm-lock.yaml`. If
you genuinely need a package that is absent, stop and report it in your result instead of
installing it.

**What the freeze does not cover.** The `scripts` block. The freeze exists so the deployed
bundle's contents stay a decision rather than an accident; a task runner that shells out to a
committed script adds nothing to the bundle and installs nothing, so it was never the subject.
This is a narrowing of an earlier reading, not a loosening of the rule: the sentence above used
to say "do not edit `package.json`" without qualification, and was read as freezing the whole
file — which is why `pnpm worktree:bootstrap` did not exist and the local setup lived only in
prose. Adding a script that runs code already in the repository is ordinary work. Adding,
removing, renaming or re-pinning a package is not, and no script entry may install one.

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

**Second named exception: three packages, once — spent.** `@sentry/cloudflare` and `@sentry/react`
are **dependencies**; `@sentry/vite-plugin` is a **devDependency**. `@sentry/cli` is added to
`pnpm.onlyBuiltDependencies` because the plugin's binary arrives through its postinstall, and
without that approval the upload silently has nothing to run. No fifth name went in beside them.

They exist because the application had no way to learn that it was failing. Workers Observability
carries the structured logs `src/server/observability/logger.ts` emits, and that is a live tail: it
answers "what is happening now" for somebody already looking, and nothing at all for a recurring
error at 3am. A browser-side crash was invisible outright — `RootErrorBoundary` rendered a panel and
told nobody. The stack is otherwise complete, and no package already in it reports errors.

The same two-halves rule as `react-email` applies and for the same reason: `@sentry/vite-plugin`
uploads source maps at build time and must never reach the Worker bundle. Its `errorHandler` is set
to rethrow, so a bad token fails the build instead of shipping a release whose every future stack
trace is unreadable. Source maps are generated only when there is a token to upload them with, are
emitted `hidden`, and the client half is deleted after upload — a map that ships is this
application's source published to anyone who asks.

This is again a list of names and not a policy. Any package outside these three and the two above is
still a finding you report in your result and never a `pnpm add`, and nothing here grants a
precedent, a category, or a "while we are in there" install. That the freeze has now been reopened
twice is not evidence that it reopens easily; both times it was reopened for a capability the stack
could not express at all, by an explicit decision recorded here.

**A replacement, not an addition: `oxlint` for `eslint` and `@tanstack/eslint-config`.** ADR 0028.
The linter is tooling that never reaches the bundle, and the swap removes two names for one; it was
made to take the gate's heaviest process off the agents' VPS and to unblock TypeScript 7. Like the
two exceptions above it is a decision about these names, not a category.

**An upgrade, not a new name: TypeScript 7.** ADR 0029. `typescript` moves from 6 to 7, the native
compiler, which the `oxlint` swap unblocked. The one test that parsed source with the compiler API
now reads `worker-configuration.d.ts` itself.

**Email path, as built.** Transactional mail is wired end to end and needs no new integration.
Phase A rewrote the bodies as React components and left the transport untouched, so the pipeline
now has three parts and one seam between each:

1. **Ten templates** under `src/server/email/templates/`, one file each, all re-exported from
   `src/server/email/index.ts`. Five carry the account lifecycle - `verify-email`,
   `reset-password`, `email-changed`, `delete-account`, `organization-invitation` - and four are
   phase A's billing set: `subscription-confirmed`, `plan-changed`, `payment-failed`,
   `pack-purchased`. `passkey-changed` serves both account passkey notices (#1186). Nothing in that
   directory touches a Worker binding; product identity arrives as an `EmailBrand` prop, which is what lets every template render under plain Node in a test.
2. **`renderEmailBody()`** in `src/server/email/render.ts` turns one element into
   `{ html, text }`. Both halves come from `@react-email/components`, which re-exports
   `@react-email/render`'s `render()` and `toPlainText()`; nothing imports the `react-email` CLI,
   which is a devDependency and has no business in a Worker bundle. The plain-text half is derived
   from the rendered HTML rather than authored a second time, so a URL cannot appear in one body
   and be missing from the other - which is how **every template ships a plain-text alternative**
   rather than by separate promises. The queue payload carries `text`; a template without one
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
  (`src/server/auth/email.ts`) awaits `renderAuthEmail()` _before_ it enqueues, so React's
  streaming renderer and that 540 kB chunk are evaluated inside the request that triggered the
  mail - a sign-up, a password reset, an invitation. Only _delivery_ is queued. §5 says heavy or
  slow work goes to Queues and never inline, and rendering an email is the heavier half of sending
  one. The fix is to enqueue the message _description_ and render inside
  `src/server/queue/handlers/email.ts`; the cost of the fix is that the handler then needs the
  brand and the catalogue the producer has today, which is why it is a follow-up and not a
  one-line move.
- **F2 - six of the eleven message kinds have no dispatch site.** `describe()` in
  `src/server/auth/email.ts` maps eleven kinds of `TransactionalEmailMessage` onto a subject,
  analytics tag and template element (the two passkey kinds share one template).
  `queueAuthEmail()` has six dispatch sites: Better Auth's `sendResetPassword`,
  `sendVerificationEmail` and `sendInvitationEmail` hooks in `src/server/auth/index.ts`, and
  successful registration and actual removal in `src/server/auth/passkey/plugin.ts` (#1186), and
  workspace invitation creation/resend in `src/server/fns/workspace-invitations.ts` (#1009).
  These send `auth.reset-password`, `auth.verify-email`, `auth.organization-invitation`,
  `auth.passkey-added` and `auth.passkey-removed`. The other six remain rendered but unsent:
  `auth.email-changed`, `auth.delete-account`, `billing.subscription-confirmed`,
  `billing.plan-changed`, `billing.payment-failed` and `billing.pack-purchased`.
  Search `queueAuthEmail(` outside its definition and tests to recount dispatch sites.
  Passkey notices carry a random per-mutation delivery identity so a subsequent notice is not
  suppressed by matching recipient and subject; redelivery retains that identity. Old email
  envelopes without it retain their previous deduplication behavior.

**The `stripe` package is gone, and so is every line that imported it.** The phase-A dependency
round ran `pnpm remove stripe` in the same edit that installed the two React Email packages, so
the dependency entry and its lockfile block are both absent - `/usr/bin/grep -c stripe pnpm-lock.yaml`
returns `0` - and nothing transitive pulls it back. The code followed over two further rounds, and
`/usr/bin/grep -ril stripe src/` now returns nothing at all: thirty-one files at the low point,
none today. The Polar client is `src/server/billing/polar.ts`, the mounted webhook route is
`src/routes/api/polar/webhook.ts`, and the four build-time ids `src/lib/plans.ts` reads are
`VITE_POLAR_PRODUCT_SOLO_MONTHLY`, `…_SOLO_YEARLY`, `…_CREW_MONTHLY` and `…_CREW_YEARLY`. Both CI
workflows and `.dev.vars.example` carry that set and no other.

`/usr/bin/grep -ril stripe src/` is the check, not the type checker. The absolute path is written
out on purpose: a plain `grep` here is a shell function, it is right about a tracked path and wrong
about other inputs, and §8 records the round that was lost to trusting it. A git worktree nested inside another
checkout of this repository resolves `stripe` from the **parent** checkout's `node_modules`,
because Node's lookup walks up past the worktree root, so `pnpm typecheck` can pass with imports
still in place. The manifest is the authority and the resolver is not. That sentence is kept for
the next dependency removal, not because this one is open.

**The three provider columns were renamed in migration `0003`.** `stripe_customer_id`,
`stripe_subscription_id` and `stripe_price_id` in `src/server/db/schema.ts` became
`provider_customer_id`, `provider_subscription_id` and `provider_product_id`, and the two indexes
moved with them: `subscriptions_stripe_subscription_unq` →
`subscriptions_provider_subscription_unq`, `subscriptions_stripe_customer_idx` →
`subscriptions_provider_customer_idx`. `docs/ARCHITECTURE.md` §6 and `docs/DEPLOY.md` §9.10 carry
the same decision, and §9.10 now also carries what the rename **cost**: a rename is not an
additive migration, so a `wrangler rollback` past the phase-A release meets a Worker whose SQL
names columns the schema no longer has. `docs/DEPLOY.md` §5 and §12 record that as a bounded,
named exception rather than as a promise the schema cannot keep.

**The user-visible copy moved with the provider, and one string took three rounds to follow.**
`src/routes/legal/terms.tsx` and `src/routes/pricing.tsx` told the reader that Stripe _calculates
and shows sales tax_, which under Polar is false, because §1 records Polar as Merchant of Record
carrying that liability on our behalf. Both were rewritten; the legal pages went first, because
they are a representation to a customer and not a label on a button. The string that did not move
with them was minted in `planPriceFootnote()` in `src/components/marketing/plans.tsx`, the one
function that writes the line under each price, and it read `14-day free trial, no card needed`
on the Solo and Crew cards of both `/` and `/pricing` - contradicted, on the same pricing page, by
the FAQ's "Polar takes a payment method when the trial starts and charges it the day the trial
ends". No phase-A work item owned that file, so two rounds corrected the claim on the pages that
show it and never on the function that mints it - which is what §8 exists to prevent, and which
cost the two exhibits in rows 3 and 4 of §8's table. It was closed by a round-6 item drawn around
the claim rather than around the pages. The paid branch now returns
`${plan.trialDays}-day free trial, card up front, charged when it ends`, which renders as
"14-day free trial, card up front, charged when it ends" on Solo and Crew and agrees with both the
FAQ and `src/routes/legal/terms.tsx`. The free plan's line is untouched and was never wrong: it
has no trial, so the function returns `No card, no expiry, no countdown` for it.

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
Tenant isolation is enforced in the repository layer and covered by tests. The bounded
`…Unscoped` shape below, the four closed catalog exceptions and the identity-table SQL of the auth provisioning module (§6) are the explicit exceptions to the tenant-context argument.

Erasure repository primitives use `createErasureScope` (`server/erasure/scope.ts`), the single
factory for the reserved `system:erasure` owner actor. It binds one organization and no session;
a transitive import-graph test forbids routes and server functions from obtaining the factory.
The trip scrub may delete a departed, banned person's trip without that person's membership,
while ordinary `deleteTrip` retains its role check. These primitives have no production caller
until the erasure engine ships (#1056, ADR 0043).

#### FU-3: bounded Unscoped repository functions

An `…Unscoped` function in `src/server/repos` may instead take a plain `Database` under SPEC §5 FU-3: an `Unscoped` suffix, a file-header justification, one named production caller per function, and a narrow projection that cannot return tenant content. Two exceptions return or write tenant content: `readInvitePreviewUnscoped`, whose closed per-visitor projection returns the invite card's content, and `joinTripByInviteUnscoped`, the one authenticated write on the invite surface, which acts as the joiner in the link's workspace (docs/ACCESS.md §3.8). Grep `Unscoped` callers; any caller outside the named one is a blocker.

Billing uses this shape for provider-to-organization resolution and billing rows only; share
moderation uses the §2.4 ACCESS projection. The calendar resolver
`findLiveFeedByDigestUnscoped(db, digest)` in `src/server/repos/calendar-feeds.ts` has exactly one
production caller, `src/server/public/calendar-feed.ts`. Its unique digest point lookup returns only
`{ id, organizationId, userId, scope, tripId, lastServedAt }`, never content, secret or digest, and
returns null for revoked rows. `ResolvedFeed` is branded adjacent to `openFeedScope` in that repo;
only the resolver produces it, and only `openFeedScope` builds the owner-bound tenant scope.
Subsequent content reads are scoped; `readFeedSource` issues nine statements (one trip read and
eight content reads). This is an exception to the scope argument, not a third catalog member
(ADR 0041).

The trip invite link adds a second resolver of the same shape, `findLiveTripInviteByDigestUnscoped(db,
digest, key)` in `src/server/repos/invites.ts`, with exactly one production caller,
`src/server/public/trip-invite.ts`. Its unique digest point lookup returns only `{ id,
organizationId, tripId, role, rotation, createdBy }`, never content, secret or digest, and returns
null for a disabled, rotated-away or role-invalid link, an archived trip, a creator who is no
longer a live owner of the trip and a digest the current key no longer derives (ADR 0042). The resolver builds no scope; the visitor slice
reaches content only through scoped functions.

The page behind it, `/join/$token`, adds a third function of the same kind, `readInvitePreviewUnscoped(db,
digest, key, viewer)` in the same file, with the same single caller. It re-resolves the link in the
same module, reads the trip through a scope built from the resolved coordinates by the repository
itself (the public module builds none), and returns one closed projection per visitor: `invited`,
`member`, `needs-workspace` or `unavailable` (docs/ACCESS.md §3.8). It writes nothing. The viewer is
passed in as data (`{ id, banned }`); `src/server/public/**` reads no session.

The join adds a fourth, `joinTripByInviteUnscoped(db, digest, key, joiner)` in the same file, the
single write on the surface, with exactly one production caller, `src/routes/join/-lib/join.ts`
(for `joinTripFn`, which requires a session). It resolves the link again, reads the joiner's role in
the **link's** workspace from `member`, builds the joiner's scope itself and writes through the
shared `insertTripMember`; it refuses a banned joiner and an impersonated session (docs/ACCESS.md
§3.8, §6.4).

The erasure verification sweep adds a fifth, `countAccountPlacesUnscoped(db, who)` in
`src/server/repos/erasure-sweep.ts`, with exactly one production caller,
`src/server/erasure/verify.ts`. It counts, across every workspace, the Better Auth places that can
still hold the erased person (`invitation.email`, `member.user_id`, the `verification` and
impersonation columns) and returns one number per place and the names of the places it cannot
answer for, never a row, a tenant's content or another person's id. The tenant places of the same
sweep go through the caller's `TenantScope`; the three platform references are counted by
`countPlatformUserReferences` in `src/server/catalog/erasure.ts`, supplied as `platform` to the sweep. This is an exception to the
scope argument, not a fourth catalog member (`.ai/specs/2026-10-08-erase-a-persons-data.md`,
Amendment - phase 5).

The carry of a paid plan's unlimited trips adds a sixth, `findSponsorStandingUnscoped(db, organizationId)` in
`src/server/repos/billing.ts` (ADR 0046, `.ai/specs/2026-10-24-carry-a-paid-plan-across-workspaces.md`). Given the
caller's own active organization id it returns, for that workspace's recorded sponsor only, the sponsor's `status`,
`plan`, `seats` and `providerProductId`, the `createdBy` of the carry and two booleans (the creator is still an owner of
the sponsor, and of the carried workspace). It never returns the sponsor's id, name, members, trips or any other content, takes no
request value and cannot list the workspaces a sponsor carries. It is the one FU-3 function with **two** named production
callers, `resolveQuotas` (`src/server/repos/base.ts`) and a new method of `createSubscriptionStore()`
(`src/server/billing/store.ts`, not `findByOrganization`, whose webhook and checkout callers must not see the carry),
because the repository guard and the billing plan-state loader are different layers that must give one answer; a source
test lists the importers and fails on a third. The decision is made once, by `applyCarry` in
`src/server/billing/limits.ts`. This is an exception to the scope argument, not a fifth catalog member.

#### Global-catalogue carve-out

"Every domain row is scoped by `organization_id`" and "every query goes through a scoped
repository" have a carve-out with exactly four members, and this section states all four. The
first is a set of tables, excepted from both rules and stated immediately below. The second is a
single query over rows that do carry an `organization_id`, excepted from the repository rule alone
and admitted by amendment at the end of this section. The third is the erasure catalog: ids-only discovery and narrowly named system-actor cleanup
primitives, admitted by amendments below.
The fourth discovers only organisation ids for the weekly tenant audit retention sweep.

Twelve tables are platform content rather than tenant data:

`catalog_sources` · `catalog_runs` · `catalog_ingest` · `catalog_places` ·
`catalog_place_sources` · `place_packs` · `place_pack_places` · `staff_api_tokens` ·
`platform_audit_log` · `provider_registry` · `provider_usage` · `airports`

Eleven of them carry no `organization_id` at all. `provider_usage` is the exception and the
paragraph below argues it, because the column there is attribution rather than a tenant
discriminator.

That list is closed. A thirteenth global table is a change to this contract, not a schema decision
a builder makes on the way past.

`platform_audit_log` joined the list in Faza B, by amendment rather than on the way past. The
eight-name form of this sentence contradicted this same section's mandate to write that table on
every platform mutation, and `docs/ACCESS.md` §4.1 recorded the contradiction as FU-2 instead of
resolving it unilaterally. This paragraph closes FU-2. The table's twelve columns, its four
cross-column `CHECK` constraints, its five indexes and its retention prune live in
`docs/ACCESS.md` §4.1 and are deliberately not restated here. Four rather than two because each of
§4.1's two invariants says "exactly when", and a single implication carries only half of that: the
converses are what stop a `human` row carrying an MCP credential and a `human` or `agent` row
carrying no actor at all. Constraining the shipped table more tightly than the prose was read to
mean is an extension of that contract and never a relaxation of it.

`provider_registry` and `provider_usage` joined the list the same way, and the argument has three
parts because the pair stretches this section in two directions at once.

**Why they are platform content.** A provider ceiling is a fact about this deployment's contract
with a third-party vendor, and a usage bucket records a call the _platform_ made. Neither belongs
to a workspace, so neither can pass through `createTenantRepository()`, and handing that layer a
fabricated tenant context to reach them would destroy the single guarantee it exists to give.

**Why `provider_usage.organization_id` exists at all, and is nullable.** It is an attribution
column, not a tenant discriminator, and nothing about it behaves like one: no read is scoped by it,
no authorisation consults it, and `NULL` is the ordinary case rather than an edge — a cron backup
and a platform email belong to no workspace, and inventing one to fill the column would be exactly
the fabricated context forbidden above. It is therefore a bare `text` column in the `userRef()`
style, with no foreign key and no cascade: a cascade would delete the platform's own accounting
when a workspace is deleted, though the calls were made and the money was spent, and `SET NULL`
would be worse still, collapsing a deleted workspace's rows onto the platform bucket and failing
the delete on a unique index the caller never mentioned. The row is platform-owned whatever
happens to the workspace named on it, which is the whole of why it is in this list rather than in
the tenant model.

**Why the metering writer satisfies neither clause below, and what stands in.** The _configuration_
half is held to both in full: `updateProviderLimit` in `src/server/catalog/provider-usage.ts` takes
an explicit platform actor, passes `requirePermission({ provider: ['configure'] })` before it
touches a row, and its caller writes a `platform_audit_log` entry in the same call. The meter tick
does not, and both clauses are _inapplicable_ rather than waived — the distinction ADR 0005 drew
for the reminder scan. There is no session behind a queue handler or a cron, so `requirePermission`
has no subject; and a tick records a call the platform has already made, so there is no change to
platform content for an audit row to describe. One audit row per outbound call would also put a
request-rate stream into a 400-day ledger, making that log a second and worse copy of this table.

What guards it instead is the shape of what it writes, stated as four properties the way the
reminder scan's four are, and changing any of them is a change to this contract rather than a
refactor: **single-writer** — `src/server/catalog/provider-usage.ts` is the only module that writes
either table, except `erasure.ts` anonymises only `provider_registry.updated_by` under the
system-actor erasure exception below; **system-actor-only** — `recordProviderCall` refuses any actor that is not
`actor_kind: 'system'`, as `prunePlatformAuditLog` does on its own delete path;
**monotonic** — the only write is a clamped SQL increment, and no path lowers a counter or changes
a bucket's identity once written; and **unattributable by construction** — a row is a provider
slug, an operation name, a bucket, an organization id and three integers, so no tenant-readable
field crosses the boundary and a cross-tenant count cannot become a cross-tenant read.

`airports` joined the list the same way, in the stage that gave a journey its stations, and the
argument is shorter than the pair above because the table is simpler than either.

**Why it is platform content.** An airport is a fact about the world - a code, a runway, a city and
an IANA zone - built from a public-domain source, identical for every workspace and owned by none.
There is no `organization_id` for `tenantFilter()` to put in a `WHERE` clause, and handing the
tenant layer a fabricated scope to reach a table it cannot filter is exactly the reach the clause
below forbids.

**Why the writer clauses do not bind it, and what stands in.** An explicit platform actor,
`requirePermission` and an audit row bind the _write_ paths of a global table, and this one has no
write path at all: the rows are cut by `scripts/build-airports.mjs` and loaded out of band, and
`src/server/catalog/airports.ts` - the only module that reads them - has no insert, no update and
no delete. There is no authorisation check on the read either, and that is the same fact from the
other side: a table that carries nothing about any workspace cannot hand one workspace's rows to
another. What guards it instead is the shape of that module, stated as three properties: a plain
`Database` rather than a `TenantScope`; **no import from `src/server/repos/**`**, which
`src/server/catalog/__tests__/isolation.test.ts` checks by walking the module graph rather than by
grepping for a spelling; and **read-only**, so the absent writer clauses have nothing to be absent
from. Adding a write path to this table is a change to this contract and not a refactor.

Twelve names, and a thirteenth is an amendment.

These tables must **never** be reached through `src/server/repos/base.ts` or
`createTenantRepository()`. That layer exists so that forgetting the tenant filter is not
expressible, and handing it a fabricated, empty, or placeholder tenant context in order to reach
global rows destroys the single guarantee it was built to give. Reaching for
`createTenantRepository()` here is a defect, not a shortcut.

Their isolation invariant is different and equally mandatory. `platform_audit_log` is one of two
members of the list that `repo.ts` does not own: `repo.ts` appends to it, so it cannot also be
reached through it. Its single writer is `src/server/catalog/audit.ts`, and every other clause
below binds it unchanged - never `createTenantRepository()`, never `base.ts`, always an explicit
platform actor. `airports` is the other, and it is out for the opposite reason - nothing writes it
from the application at all, so there is no mutation for `repo.ts` to carry; its single reader is
`src/server/catalog/airports.ts` and the amendment above states the three properties that stand in
for the clauses a writer would answer. For the other eight, all access goes through
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

The second member is one session-less cron discovery read, joining this carve-out by amendment the
way `platform_audit_log` joined what was then the nine-name list in Faza B. ADR 0005 replaced the
schedule-at-write reminder index with a scan, recorded that this section had still to be reconciled
with it, and left that reconciliation as an amendment rather than taking it on the way past; this
is that amendment. A scan asks a question no tenant scope can ask: which of _every_ workspace's
trips has a reminder falling due at this tick. `listDueTripReminders` in
`src/server/catalog/reminders.ts` is that query, and it is the whole of the member — one function,
in one module, reached only from the quarter-hourly cron.

It satisfies neither clause the tables above are held to, and this paragraph says so rather than
reading those clauses loosely. `trips` carries an `organization_id` and is tenant data: the scan
adds no name to the list above, which is twelve names and still closed. There is no session
behind a cron, so there is no platform actor to authorise with and `requirePermission` has no
subject; the read mutates nothing, so there is no `platform_audit_log` row to write. Both clauses
are _inapplicable_ to this read, which is a different statement from waived — every `server/catalog`
path that mutates or serves platform content is bound by them exactly as before, and an unaudited
mutation is still a failing test.

What guards it instead is the shape of its answer. The scan projects scheduling coordinates only —
trip id, organization id, due instant — so no tenant-readable field crosses the boundary and a
cross-tenant read cannot become a cross-tenant read _of a trip_. Every field a reminder says out
loud is read afterwards by `src/server/queue/reminders.ts` through a `TenantScope` bound to that
one organization, under a real member of that trip. The read is bounded by a `start_date` window
(`REMINDER_SCAN_DAYS`) and walked by keyset pages, so a tick costs rows proportional to trips
departing soon rather than to trips ever created. Session-less, projection-only, windowed,
keyset-paged: those four properties are what stands in for the two clauses above, and changing any
of them is a change to this contract rather than a refactor.

The third member is the erasure catalog, `src/server/catalog/erasure.ts` (ADR 0043,
`.ai/specs/2026-10-08-erase-a-persons-data.md`, phase 3b amendment #1059).
`listWorkspacesHoldingUser` and `listOrganizationIds` remain ids-only, read-only, keyset-paged
with a fixed maximum page size. The participation backfill remains the sole production importer;
the engine must explicitly amend the importer pin when it wires these primitives.

Four additional primitives take a plain `Database` and validate an explicit system `PlatformActor`
(`actorKind: system`, user/role/token null) before any query. `eraseWorkspaceInvitations` deletes
invitations to the exact email with a required organization predicate; invitations they sent wait
for the user cascade. `eraseAccountAuthLeftovers` deletes verification rows by exact identities,
known Better Auth key shapes or a valid JSON userId, and ends sessions impersonated by that person
across all workspaces, after a mandatory durable session-token cleanup callback succeeds.
`erasePlatformUserReferences` revokes and anonymises tokens held by the person, anonymises issuer
attribution without revoking another holder's token, and anonymises provider updated-by.
`countPlatformUserReferences` returns only place names and counts for the three global columns,
for `verifyErasure({ platform })`. The platform audit ledger, user, member and participation anchor
are untouched. These primitives have no production caller yet.

This is an explicit exception for a session-less erasure worker: there is no session for
`requirePermission` at this layer. The engine's future entry must enforce platform permission and
write its platform audit event; its verified job supplies identity, organization and distinct
Former member ids, and durably saves session cache cleanup before D1 deletion. Global auth and
credential isolation protects other identities, since the same person's global credential cannot
be erased in only one workspace. No tenant content table is read or written in the catalog;
per-workspace domain scrubs still require the reserved owner `TenantScope` and tenant repository.
The catalog graph remains forbidden from importing tenant repositories.

The auth layer cannot reach the tenant repository graph except through two closed, auth-runtime-free
leaves (and the write-only statements named below). Recipient invitation consumption (issue #1009): `auth/organization-invitations.ts` imports
`repos/workspace-invitation-acceptance.ts` and its `base`, `batch` and `context` primitives. The
sign-up language seed (issue #1174): `auth/signup-locale.ts` imports `repos/user-locale-seed.ts`,
whose one function inserts the new account's own `user_settings.locale` row if none exists, for the
scope's own user and organization, and imports no repository but `base`. The console graph pins this
closed set; no tenant server-function bootstrap, repository barrel or `settings.ts` is
reachable. `resolveWorkspaceInvitationScopeUnscoped` has that one production caller and returns only
an organization id by matching the invitation with the authenticated user's current email (FU-3).
The recipient scope carries the authenticated user, least-privilege member role and impersonator.
Only the recipient operations use its delegated authority: they recheck the current verified email,
pending state and tenant in SQL. Acceptance additionally rechecks expiry, role and the 100-member
ceiling. One required atomic driver batch inserts a fresh membership, its participation anchor and
the accepted state, tied to the same minted member id. It transfers an existing reservation even
above a downgraded plan's quota; it never releases a seat between statements. Rejection is pending-only.
Session activation still uses Better Auth's internal adapter after commit, preserving KV and audit
hooks. Activation failure never restores pending or removes durable membership; the existing workspace
switcher recovers activation. Repeating acceptance remains a refusal and never restores removed access.

Workspace creation adds one more write-only statement to its batch: `src/server/auth/carry.ts` (`recordCarry`, ADR 0046),
a sibling of `participation.ts` with no standalone select, update or delete (it returns no row; the only read is the
subquery inside its one statement). It is an `INSERT … SELECT … WHERE` into
`workspace_carries` that writes a row only when the creator is an owner of the sponsor (the source workspace if it holds an
entitling subscription, otherwise the sponsor of the source's own carry) and the sponsor has an entitling subscription row.
The source workspace id comes from the caller's tenant scope, never from a request body; the sponsor is chosen inside the
statement. A source test pins its writers.

Other auth membership paths retain `src/server/auth/participation.ts`: a write-only `INSERT OR IGNORE`
of `organization_id` and `user_id`, with no select, update or delete, whose organization id comes from
the id minted in the same batch or hook data, never a request body. A source test pins the anchor's
writers, schema, catalog read and erasure registry.

The fourth member is `catalog/tenant-audit-retention.ts`, reached only from
`audit/retention.ts` in the existing weekly cron. Its discovery query returns organisation ids
only, filters on the derived 400-day cutoff, is read-only and keyset-paged (100 ids per page).
No tenant-readable content leaves discovery. All deletes then use `repos/audit.ts` through a
`TenantScope` with role `member` and reserved placeholder `system:tenant-audit-retention`, never
a real member. Each statement deletes at most 200 ids; one 250-batch budget covers every
workspace together. `created_at` is the only retention criterion, no audit of the prune is
written, and `drained: false` is logged at error level. The catalog module-graph guard forbids
reaching repositories from discovery. `TENANT_AUDIT_RETENTION_DAYS = 400` is owner confirms.

Four members, and that list is closed as firmly as the twelve names are. A fifth exception —
another cross-tenant read, another module handed a plain `Database`, other than an `…Unscoped`
repos function of the FU-3 shape above — is an amendment to this section, not something a builder
takes on the way past.

### Platform roles

Two role vocabularies coexist and must never be conflated. **Organization roles** (`owner`,
`admin`, `member`, from Better Auth's `organization` plugin) describe standing inside one
workspace and keep exactly their present meaning. **Platform roles** describe standing on the
product itself, and they are new.

Platform roles come from Better Auth's `admin` plugin, which ships inside the pinned
`better-auth@1.7.1`. Registering it adds no dependency and does not touch §3's freeze. Three
roles, and no fourth:

| Role      | Authority                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`   | Full platform authority: user management, roles, bans, session revocation, impersonation, MCP token issuance, everything a `curator` may do. |
| `curator` | The catalogue, packs, sources and share moderation. Nothing that touches users or sessions.                                                  |
| `user`    | Everyone else, which is nearly everyone. No platform surface at all.                                                                         |

`defaultRole: 'user'` - a platform role is only ever raised deliberately. The plugin adds five
columns and they are the whole storage cost of the model: `user.role`, `user.banned`,
`user.ban_reason`, `user.ban_expires` and `session.impersonated_by`. All five are non-writable
from the client.

Authorisation is decided in exactly one place, `requirePermission` in
`src/server/auth/guard.ts`, used identically by console server functions and by the MCP server,
so "may this actor do this" never grows a second implementation. A session with
`session.impersonated_by` set carries a persistent warning bar with an "end impersonation"
action on **every screen under `/_app`** - rendered by `AppShell`, which is the only wrapper with
a session in scope, so no route inside it can omit the bar and no route can scroll it away. The
bound is `docs/ACCESS.md` §6.1's, and it is a bound rather than a weakening: the `(auth)` tree and
the public marketing pages render under `RootDocument`, whose router context carries no session at
all, and threading one in would put an auth read in front of every anonymous page to cover a case
that cannot arise. Entering and leaving impersonation are both audited.

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

| Secret                     | What it is                                                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POLAR_ACCESS_TOKEN`       | Organization Access Token for every server-side Polar call. It never reaches the browser.                                                                                                                                                                       |
| `POLAR_WEBHOOK_SECRET`     | Signing secret for the billing webhook endpoint.                                                                                                                                                                                                                |
| `POLAR_SERVER`             | `sandbox` or `production`. Selects the API base URL. It sits with the secrets rather than in `vars` so one file switches the whole billing environment, and because sandbox and production are separate accounts with separate tokens and separate product ids. |
| `FIRECRAWL_API_KEY`        | Bearer token for the scrape and crawl calls behind the catalogue pipeline.                                                                                                                                                                                      |
| `FIRECRAWL_WEBHOOK_SECRET` | HMAC secret verifying crawl callbacks. It is one account-wide value, not one per endpoint.                                                                                                                                                                      |
| `MCP_TOKEN_PEPPER`         | Hashing pepper for `staff_api_tokens`. Rotating it invalidates every issued MCP token at once, the way rotating `BETTER_AUTH_SECRET` logs everyone out.                                                                                                         |

**Cron.** The weekly catalogue scrape is `0 4 * * 1`. It is registered in `wrangler.jsonc` - in
the top-level `triggers.crons` list _and_ in the `env.staging` override, since a deploy replaces
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
    auth/            Better Auth setup, tenant context, permission guard, mail message contract; provisioning.ts is a stated SQL exception
    email/           React Email templates + the HTML/plain-text renderer, no bindings
    repos/           tenant-scoped data access (every tenant query and its SQL)
    catalog/         global catalogue access - a stated exception to the SQL rule
    public/          session-less reads - read-only, column-whitelisted projections only
    security/        pure secret derivation and digest leaf - no SQL, no binding; repos may import it
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
- All SQL lives in `server/repos`, normally through the tenant-scoped base repository; FU-3
  permits the bounded `…Unscoped` shape above with a plain `Database`. Routes call server functions; server functions call repos.
- The stated exceptions are three, and closed: the bounded `…Unscoped` shape above, `server/catalog`
  and the identity-table access of the auth provisioning module. §5 states `server/catalog` as a closed list of four. The
  first member is the twelve global tables: eleven carry no `organization_id` at all and the twelfth,
  `provider_usage`, carries one only as attribution, so none of them can pass through the tenant
  repository, and every path that mutates or serves that platform content is guarded instead by an
  explicit platform actor, `requirePermission`, and a `platform_audit_log` write in the same call —
  unchanged and mandatory, save for the metering tick §5 argues as guarded by its shape instead. The second is one cron discovery read over
  tenant rows, `listDueTripReminders` in `src/server/catalog/reminders.ts`, which has no session
  behind it to authorise and no mutation to audit and is guarded by its shape instead:
  session-less, projection-only (scheduling coordinates, no tenant-readable field), windowed on
  `start_date`, keyset-paged, with every readable field fetched afterwards through a `TenantScope`
  (ADR 0005, amended into §5). The third is the erasure catalog, `catalog/erasure.ts`: two
  ids-only, keyset-paged discovery reads plus the four system-actor cleanup/count primitives
  stated in §5, reached from the backfill handler alone until the engine lands (ADR 0043; the auth layer's write-only anchor insert,
  `auth/participation.ts`, is named there too). The fourth is `catalog/tenant-audit-retention.ts`: a session-less, ids-only,
  cutoff-filtered, read-only, keyset-paged discovery read called only by `audit/retention.ts`.
  Deletes use a member `TenantScope` with the reserved `system:tenant-audit-retention` placeholder,
  through `repos/audit.ts`, by `created_at` alone: 400 days, 200 ids per batch, 250 batches shared
  across the run, no self-audit, error on `drained: false`. Four, and closed; a fifth one changes
  this contract.
- The third stated exception is `src/server/auth/provisioning.ts` (workspace creation and sign-up
  provisioning). It reads `user` and reads and writes `organization` and `member`, all Better Auth
  identity tables imported from `server/db/auth-schema` and never from the tenant schema; a create
  has no tenant scope yet, so there is none to pass.
  `src/server/auth/__tests__/provisioning-boundary.test.ts` pins the named imports and the import
  boundary. The module reaches the tenant layer only through the participation anchor, which it
  writes with `auth/participation.ts` (§5, ADR 0043), as invitation acceptance does in its own batch.
  `createOrganizationWithinLimit` deletes an `organization` row, which cascades over tenant tables,
  and removes only rows that same call wrote (the organization, its membership and its participation
  anchor): the withdrawal is never pointed at an organization that already exists. Adding a table is
  a contract change.
- Better Auth's own tables, reached through the library's adapter (`ctx.context.adapter`), are
  not application SQL and sit outside this contract: this is not a fourth exception and not a
  precedent for SQL. The passkey plugin (`src/server/auth/passkey/plugin.ts`) reads and writes the
  `passkey` table that way; that table is user-keyed and has no `organization_id`, but other
  Better Auth tables do relate to a workspace, so being auth-owned says nothing about tenancy.
  Application queries still pass through the tenant-scoped repository, and raw SQL against an auth
  table stays limited to the provisioning module above.
- `server/public` owns bearer-resolved public reads without a session, and holds no SQL of its own.
  Internal erasure and backfill workers use the bounded catalog reads and workspace scopes described in §5.
  Every response is a named read-only projection - an explicit column whitelist of what a
  stranger may see, so leaking a field is unexpressible - executed through `server/repos` for
  token-resolved tenant resources and `server/catalog` for published global rows. The tenant
  scope it passes is always the one derived from the share, feed or trip invite link record it resolved, never fabricated.
- A workspace's plan can be carried by another workspace's subscription (ADR 0046): the only code that decides it is
  `applyCarry` in `server/billing/limits.ts`, fed by `findSponsorStandingUnscoped` in `server/repos/billing.ts` and written
  by `server/auth/carry.ts`; §5 states the three. Nothing but the billing webhook writes `subscriptions`.
- `server/mcp` owns transport and tool schemas only. Every tool authorises through the same
  `requirePermission` the console uses and reaches data through `server/catalog`; it never grows
  a second authorisation path or a second query layer.
- Transactional mail is three directories, not one, and §3 describes the seams between them.
  `server/email` holds the ten templates and `renderEmailBody()`; it touches no Worker binding
  and takes product identity as a prop, which is what lets it render under plain Node in a test.
  `server/auth/email.ts` owns the message union, the subject lines and the analytics tags.
  `server/queue/handlers/email.ts` delivers. A template that imports a binding, or an `auth/`
  module that renders JSX, has crossed a seam.
- Validate every server-function input with Zod. Never trust the client.
- Named exports, no default exports (except route modules, which TanStack requires).
- `cn()` from `src/lib/cn.ts` for class merging.
- TypeScript strict. No `any`, no non-null `!` on values that can genuinely be null.

## 7. Definition of done for any task

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile — by
   the blind A/B pair (`scripts/visual/capture.mjs`, §8.814), which is the whole of the visual
   judgement since ADR 0016. "Looked at it" is not a mechanism; the pair is.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership. Work you discover elsewhere is
   reported, never edited — and if that work is a _concept_ rather than a file, §8 governs how
   the next round draws the item that owns it.

## 8. Decomposition rule: one concept, one owner

**A change whose blast radius is a concept rather than a file must be owned by exactly one work
item, and that item must own every file the concept touches.**

A concept, for this rule, is anything that is true in more than one place at once and has to stay
true in all of them: a shared exported type or its field names, a dependency in `package.json`, a
vocabulary (`stripe_*` → `provider_*`), a claim repeated across pages, a cache key's shape, a
column and every mapper that crosses it. The test is not "how many lines change" but "can half of
this land and leave the repository self-consistent?" If the answer is no, the change is one item.

Four corollaries, because each is a mistake this repository has actually made:

- **A rename of a shared export lands with all of its consumers or not at all.** Deferring a
  consumer to a later item does not defer the breakage.
- **Removing a dependency is a global operation.** It is finished when the last import is gone,
  not when the manifest entry is.
- **A claim is a file.** If the same sentence is rendered from a component none of the items
  owns, the item that owns the claim owns that component too — otherwise the claim is corrected
  everywhere the round looked and nowhere it did not.
- **A claim is closed by a render, not by a grep.** A concept that reaches the user as words on a
  page is only proved gone when the page is loaded and the words are counted in it. The section
  below is what that costs when it is skipped.

### Why this is a rule and not advice

Phase A paid for it four times, and each one is on the record:

| #   | Round | The concept                                                                                     | What it cost                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 1     | `PlanPrice.priceId` renamed to `productId`, and `planForPriceId` dropped, in `src/lib/plans.ts` | All five consumers — `checkout.ts`, `mapping.ts`, `store.ts`, `limits.ts` and the demo seed — sat in items the round had deferred under a three-item cap. Eight typecheck errors, 338 failing tests, and a `MISSING_EXPORT` at build.                                                                                                                                                      |
| 2   | 1     | `pnpm remove stripe`                                                                            | The manifest entry left while **31 files** under `src/` still imported it, so those files could not compile at all. It took rounds 2 and 3 to finish, 31 → 12 → 0.                                                                                                                                                                                                                         |
| 3   | 3–4   | "14-day free trial, no card needed"                                                             | Item 6 owned `billing.tsx`, `pricing.tsx` and `terms.tsx`, so the trial copy was corrected in all three. The string is minted by `planPriceFootnote()` in `src/components/marketing/plans.tsx`, which no item owned — so it survived both rounds on `/` and `/pricing`, beside the same page's FAQ saying Polar takes a card. It took a round 6 item drawn around the _claim_ to close it. |
| 4   | 4     | The same string, **reported fixed**                                                             | The evidence was `curl … /pricing \| grep -c 'no card needed'` returning `0`. The string was still being served, twice on each page. A measurement was accepted as a fix, so the round closed a finding it had not touched and round 6 had to reopen it.                                                                                                                                   |

Rows 3 and 4 are the same string twice, because they are two different mistakes. Row 3 is a
decomposition failure: the round corrected the claim everywhere it looked and nowhere it did not.
Row 4 is a **measurement** failure, and it is the one worth learning in detail, because the
command looked like proof.

**On a streamed page, a grep of the HTTP response is not evidence. Render it.** Three independent
reasons that pipeline could not have proved anything, each verified here rather than asserted:

1. **`grep -c` counts matching _lines_, not occurrences.** Our SSR document is one line. A capture
   of `/pricing` taken while writing this measures 77,875 bytes and contains **zero** newline
   characters, and today's corrected paid-plan footnote occurs in it twice — once per paid card.
   `/usr/bin/grep -c` over that capture answers `1`; `/usr/bin/grep -o … | wc -l` over the same
   bytes answers `2`. On a file like that `-c` saturates at `1` and is structurally incapable of
   returning a two, whichever `grep` runs it. Count with `/usr/bin/grep -o PATTERN file | wc -l`,
   or in Python with `bytes.count()`.
2. **`curl -s` prints nothing on a connection failure.** Pipe a refused port into
   `/usr/bin/grep -c` and the pipeline prints a clean `0` with no diagnostic at all — a zero
   produced by never reaching the server is indistinguishable from a zero about the page. Always
   assert a non-zero byte count first, and always run a **positive control**: grep for a string you
   know is on the page before you believe a zero about one you hope is gone.
3. **A `grep` is not necessarily `grep`, and this page is not text.** In the shell these rounds run
   in, `type grep` answers "shell function", and that function is `ugrep` invoked with
   `--ignore-files … -I` — `-I` being _skip binary input_. Our served document is binary by that
   test: it carries three NUL bytes, inside the route ids of the streamed router payload. Handed
   those 77,875 bytes **on stdin** the shell function prints nothing and exits `1`, while
   `/usr/bin/grep -c` on the identical bytes prints `1`. Cutting the capture at the byte before the
   first NUL makes the same function answer, and adding that one byte back silences it again, which
   is how the cause was isolated rather than guessed. Spell it `/usr/bin/grep` when the input is a
   response body rather than a tracked file, run `type grep` before trusting a zero, and remember
   that an exit code of `1` is what "no match" and "never looked" have in common.

The general form, which is the rule and not the anecdote: **a grep is evidence about a file; a
page is evidence about a render.** Anything a user reads is a render, so the claim "the user no
longer sees X" is closed by loading the page in a browser and counting in
`document.body.innerText` _and_ `document.body.textContent` — they disagree, and by a lot. On
`/pricing` at a 1440 px viewport the two read 3,706 and 5,199 characters, because seven `<details>`
FAQ items are collapsed. Measured in that browser, the sentence "Polar takes a payment method when
the trial starts" occurs **zero** times in `innerText` and **once** in `textContent`: the first
cannot see a collapsed answer, the second sees text nobody is looking at, and neither is the truth
alone. Report both. `innerText` also moves with the viewport — the same page at 360 px reads 3,666
characters — so a count is only a fact when the width is beside it. §7's fourth condition already
asks for the browser; this is why.

### How to apply it when drawing a round

1. Before splitting, list the concepts the round changes. For each, run the grep that enumerates
   every file it appears in — not a shortlist from memory, which has been wrong every time.
2. Give each concept exactly one owner, and give that owner the whole grep result. If two items
   need the same file, one of them is drawn wrong.
3. Tests belong to the owner of the code they test.
4. A concept whose file set exceeds one item's reasonable size is not a reason to split it. It is
   a reason to make that item the whole round.

## 9. Localisation

The product ships in **23 languages**. The storage layer already exists and is unused for copy:
`organization_settings.locale` is the workspace default, `user_settings.locale` the traveller's
override, and `getEffectiveSettings` already merges them. Making those columns decide what the
screens say is the work.

### Supported locales — the exact set, tagged BCP-47

| Tag  | Native name        | Tag       | Native name        |
| ---- | ------------------ | --------- | ------------------ |
| `ar` | العربية _(RTL)_    | `ko`      | 한국어             |
| `ca` | Català             | `nl`      | Nederlands         |
| `cs` | Čeština            | `pl`      | Polski             |
| `de` | Deutsch            | `pt-BR`   | Português (Brasil) |
| `el` | Ελληνικά           | `ru`      | Русский            |
| `en` | English _(source)_ | `sv`      | Svenska            |
| `es` | Español            | `tr`      | Türkçe             |
| `fr` | Français           | `uk`      | Українська         |
| `hu` | Magyar             | `vi`      | Tiếng Việt         |
| `id` | Bahasa Indonesia   | `zh-Hans` | 简体中文           |
| `it` | Italiano           | `zh-Hant` | 繁體中文           |
| `ja` | 日本語             |           |                    |

A locale is named in **its own language and its own script**, never in English. The tags are
canonical BCP-47; the reference's non-standard `br` and `gr` are not what we ship.

### Rules

1. **In-house.** §3's dependency freeze holds — there is no i18n package and none is to be added.
   The message layer, the plural rules and the interpolation are ours, built on the platform `Intl`.
2. **Source locale is `en`.** Every key exists in every locale. A test proves parity — no missing
   key, no orphan key, no locale silently falling back to English at runtime.
3. **Negotiation happens on the server, once, before first paint**: user setting → workspace
   setting → visitor cookie → `Accept-Language` → `en`. `<html lang>` and `<html dir>` are
   server-rendered. No locale flash, no hydration mismatch, no second render to correct the language.
4. **`ar` is RTL.** Layout uses logical properties, not `left`/`right`. Directional icons mirror.
   RTL is a designed layout, exactly as dark mode is, not a flipped afterthought.
5. **Formatting must agree across runtimes.** `src/lib/format.ts` pins `en-GB` and freezes the
   CLDR month and weekday tables _because_ workerd and WebKit disagree on `Intl` output, and every
   server-rendered September date threw a hydration error in Safari until it did. The multi-locale
   formatter inherits that requirement: any locale-dependent name taken from the platform must be
   proven identical in workerd and WebKit, or frozen in a table. This is the hardest constraint on
   this task — treat a divergence as a defect, never as a tolerance.
6. **No untranslated string reaches a screen.** §7.5's ban on placeholder copy covers an
   English string sitting in a non-English catalogue.
7. **One language picker** lists every locale in its native name and script, shows the active one,
   and persists through a reload. Settings saves a personal override (or follows the workspace);
   signed-out controls reuse this picker and save only the visitor cookie. The visitor cookie
   holds only a language tag for 365 days, is HttpOnly, SameSite=Lax, Path=/ and Secure on HTTPS.
   Registering is the one moment the visitor language reaches an account: a self-registration seeds
   the new account's own `user_settings.locale` with the language the request resolved (cookie, else
   `Accept-Language`) when it is not `en`; signing in never writes a setting.
8. **Scope.** In: `src/routes/(auth)`, `src/routes/_app`, the marketing landing and pricing pages,
   and every component they render. Out, for now: `src/routes/legal/**` long-form terms and privacy
   prose, which stays English and says so on the page — translated legal text needs review this
   build cannot give it.
9. **Copy is authored, not copied.** §1's clean-room rule governs every catalogue file. Our English
   copy is our own, and each translation is made from _our_ English — never from the reference's
   catalogues, which are AGPL-licensed source.
10. **Server refusals are a bounded exception to rule 6.** A refusal whose error class is named in
    `AUTHORED_ERROR_NAMES` (`src/server/errors/public.ts`) reaches the browser as its English
    sentence and is shown in place of the caller's localised fallback, in every locale. That is
    accepted for exactly the classes listed there today — `AuthRequirementError`,
    `ConsoleActionError`, `ConsoleUnattributableError`, `TripArchivedError`, `TripRoleError` —
    including a new sentence thrown through one of them, and the set of classes is closed:
    `src/server/errors/__tests__/public.test.ts` pins it, so growing it is a change to this rule,
    not an edit. A new refusal class travels as a message key the client resolves in the reader's
    locale, the shape `SHELL_STATE_KEYS` (`src/components/layout/session.ts`) already has, or stays
    a diagnostic whose screen shows the localised fallback. The failure envelope's `code` field
    (`PublicFailure.code`, `src/lib/errors.ts`) is another instance of that route: its values are
    the literals in `PUBLIC_FAILURE_CODES` - `QUOTA_EXCEEDED`, which `classifyFailure` attaches to
    an `unexpected` failure for either `QuotaExceededError` class, so a screen can say "your
    plan's limit is reached" in the reader's locale, and five `BILLING_*` codes (forbidden, not
    connected, rate-limited, refused by Polar, order not invoiceable) that the billing screen
    resolves through `src/routes/_app/settings/-lib/billing-failure.ts`. It is a constant, never
    an error's own `code`, and `AUTHORED_ERROR_NAMES` stays as it is. Generalising client-side key resolution to the whole
    `refusal` channel, with the existing sentences moved into the catalogue, is the work that
    retires this exception.

### Catalogue layout (fixed — every i18n item builds against this)

Round 2 rejected a runtime that shipped flat `messages/<tag>.ts` files while fifteen downstream
items owned per-locale directories. The parity test globbed `messages/*.ts`, which does not match
`messages/de/settings.ts`, so it would have reported green while the product rendered English.
The layout is therefore part of the contract, not a builder's choice:

```
src/lib/i18n/messages/<locale>/<namespace>.ts     one flat object of keys, default-exported
```

**Namespaces — exactly these eleven**, and a new one is a contract change, not an edit:

`shell` · `auth` · `trips` · `modules` · `costs` · `atlas` · `journal` · `marketing` ·
`settings` · `console` · `ui`

`console` was the eleventh, added when the platform console landed. It is separate from `settings`
because the two speak different role vocabularies and §5 forbids conflating them: `settings` is one
workspace administering itself in `owner`/`admin`/`member`, `console` is the platform administering
its accounts in `admin`/`curator`/`user`. A shared namespace is precisely where that conflation
would start, in a file holding both scales with nothing to say which `admin` is which.

- `src/lib/i18n/catalogue.ts` aggregates with `import.meta.glob('./messages/*/*.ts')`, so a new
  namespace file is picked up with no shared index for fifteen items to fight over. Measured in
  round 1: an explicit per-locale importer emits 23 separate chunks and inlines none of them into
  the entry — the glob must keep that property for ordinary catalogues. Root recovery bundles only
  a generated projection of existing `shell.error.*`, `shell.session.*`, `shell.feedback.*`,
  `shell.nav.homeLink`, `ui.status.working` and `ui.action.remove` copy for all locales, independently of lazy imports.
  Regenerate it with `pnpm exec tsx scripts/i18n/generate-recovery.ts`; its parity test checks the
  projection against the ordinary catalogues. An empty root loader catalogue still signals a failed
  refresh; only the document provider receives recovery copy, in the negotiated language or English
  when negotiation itself failed.
- `src/lib/i18n/types.ts` derives the key union from `import type` of the eleven **`en`**
  namespace files. English is the only source of truth for what a key is.
- The parity test globs `messages/*/*.ts`. It fails on a key in `en` and missing elsewhere, a key
  present only outside `en`, and a non-`en` value byte-identical to `en` outside a proper-noun
  allow-list.
- **Ownership.** One item owns `messages/en/<namespace>.ts` for its own screens. A translation item
  owns `messages/<tag>/` for its tags, whole. Nothing is shared, so nothing collides.

### Who wires the document shell

`src/lib/fonts.ts` exports the stylesheet href and the preconnect origins **as data**; it does not
render them. `src/routes/__root.tsx` is owned by `locale-negotiation-shell`, and that item is what
imports `fonts.ts`, deletes the second hard-coded copy of the font URL, and sets `<html lang>` and
`<html dir>`. An item is never held to an acceptance criterion it does not own the file to satisfy.

### Who owns the visual judgement

An item is blind-judged on a SCREEN. An item that owns only a library — `src/components/ui/**`,
`src/lib/**` — has no screen of its own, and round 5 rejected `ui-primitives-i18n-rtl` for "no blind
pair" on that basis alone, having found nothing blocking in its actual work. Such an item is judged
on its code, its tests and its stated contract, and the visual judgement of the screens that mount
it belongs to those screens' items. An item never manufactures a route to become photographable.

The reference half can also simply be unavailable: `demo.liketrek.com` puts its screens behind a
sign-in wall, but that wall carries a "Try the demo" button that needs no credentials — the
capture enters through it (`capture.mjs --enter`) and presses away the welcome overlay that
follows on every load (`--dismiss`). A missing reference frame therefore means the demo is down or
its sign-in screen changed, never that a session was unobtainable. When no pair exists, our side is
still captured and the item is judged on our frames plus code, tests and accessibility — never on a
mismatched pair, because a pair of two different surfaces sends the critic after an artefact of the
capture. A missing reference is never grounds to relax §2; it raises the bar, because our side then
has to be defensible with no foil beside it.

### Numbers inside messages

A plural message's `count` selects the CLDR branch and nothing else. Any number a reader SEES goes
through the locale-aware formatter and is interpolated as an already-formatted string — raw
substitution renders ASCII digits with no group separator in all 23 locales. Note what the platform
actually does before asserting on it: `ar` as a bare tag carries the `latn` numbering system, so
Arabic correctly renders `1,234` and never Arabic-Indic digits, which belong to `ar-EG` /
`ar-u-nu-arab` and are not tags we ship.
