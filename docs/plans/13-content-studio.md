# planned.travel - Content Studio

## Area brief

Every other plan in this directory closes rows of the 89-row feature matrix. This one adds a
capability the matrix never asked for because the reference product never had it in this shape:
an operator content plane - **Studio** - that lets editorial staff change what the public site
says, publish legal documents with reviewed translations and enforced re-acceptance, and speak
to the application's users through banners, what's-new panels and materialised notifications,
all without a deploy. It is a thirteenth area because the work is real product surface with its
own routes, stores and quota-shaped questions, not a sprinkling of edits across the other twelve.

**Clean-room note.** Nothing in this plan derives from the reference product; it manages *our*
site and *our* users. No stage in this file cites a `wiki:` page, and none may: a citation here
would claim a lineage that does not exist.

### What this area is on disk, measured at HEAD

- **Public copy is compiled, not managed.** The landing page's FAQ is a literal array at
  `src/routes/index.tsx:84`, its plans lede is assembled at module scope from the catalogue at
  `src/routes/index.tsx:148-162`, and its structured data at `:38`. The feature spotlights are a
  module-scope array inside the component file (`src/components/marketing/features.tsx:37`), as
  are the module grid (`:216`, data at `:170`) and the proof panels
  (`src/components/marketing/proof.tsx:74`). `MarketingHero` takes zero props
  (`src/components/marketing/hero.tsx:36`). Only `FaqList` (`faq.tsx:17`), `ClosingCta`
  (`cta.tsx:21`) and `LegalPage` (`legal.tsx:18`) accept their content as props. Changing one
  sentence anywhere on the marketing surface is a pull request and a deploy.
- **The legal documents are templates waiting for an owner.** `src/routes/legal/privacy.tsx`
  and `terms.tsx` declare `VERSION = '1.0 (template)'` and carry `LegalPlaceholder` marks - "a
  gap a lawyer must fill before launch" (`src/components/marketing/legal.tsx:46-49`). The
  rendering component is already data-shaped: `LegalDocumentProps` takes sections, an updated
  date and a version (`legal.tsx:17-28`). There is no acceptance record anywhere in the schema:
  nothing stores which user accepted which terms version, and `docs/SPEC.md` §8 rule 8
  excludes `src/routes/legal/**` from localisation "for now" precisely because no review gate
  existed to make a translated legal text safe.
- **The notification inbox has readers and no writer.** `notifications`
  (`src/server/db/schema.ts:1722`) stores i18n keys plus params rather than rendered sentences,
  `createStoredTranslator` exists to render exactly such runtime keys
  (`src/lib/i18n/catalogue.ts:180`), and `00-foundations.md` supplies `notify()` as a wave-0
  write path - but nothing broadcasts. There is no banner surface, no what's-new, no changelog,
  no help centre, and no way to tell every user anything.
- **The operator substrate exists and is idle.** `app_settings` is the one deliberately
  non-tenant table (`schema.ts:1862-1878`), reached through `appSettingsStore` which takes a
  plain `Database` rather than a `TenantScope` (`src/server/repos/settings.ts:324`) - the
  documented precedent for deployment-scoped stores. `FILES_PUBLIC_BASE` names a public bucket
  domain (`wrangler.jsonc:48`) that only the thumbnail job reads. The tiles route demonstrates
  the anonymous-read caching discipline (`src/routes/api/tiles/-lib/serve.ts:210-232`).
- **The staff plane is installable but not installed.** `better-auth@1.7.1` ships the `admin`
  plugin (a deployment-wide `user.role`, orthogonal to the organization plugin's `member.role`)
  and the `access` plugin for custom permission statements - both already in
  `node_modules`, neither configured in `src/server/auth/index.ts`. The tenant-side audit trail
  cannot host operator actions: `audit_log.organization_id` is `NOT NULL` (`schema.ts:1787`).

### The rows this plan closes

None. Every stage below records `No gap row` under **Reference rows**: this capability sits
outside the 89-row matrix, exactly as the wave-0 concerns of `README.md` do. Where a stage
borders an existing row it cites the row without closing it: `ADM-01`/`ADM-04` (the workspace
console, which stays tenant-scoped and untouched), `ACC-05` (notification channels - this plan
adds producers, not channels), and the `ADD-01` exclusion in `11-boundaries-and-blockers.md`,
whose reasoning is the foundation of this plan's authorisation design rather than a thing it
re-argues.

### Decisions every stage inherits

Stated once, cited by stage id, never re-derived.

1. **Two permission planes, disjoint by construction.** `/admin` remains the workspace console:
   `member.role` from the organization plugin, one tenant, owned by `10-administration.md`.
   `/studio` is the deployment console: `user.role` from the admin plugin, roles
   `user | editor | publisher | legal_reviewer | platform_admin`, granted only by a
   `platform_admin`, audited in the new `platform_audit_log`. `user.role` is never read by a
   tenant repository, and `member.role` never opens Studio. `11-boundaries-and-blockers.md`
   (ADM-05, ADD-01) is why: on one deployment serving every tenant, a workspace owner who could
   grant Studio access would be escalating across the tenant boundary into every customer's
   public site and inbox. The disjointness is an assertion in a test (`13-S1`), not a
   convention.
2. **The store decides, and it decides on fresh data.** Every Studio assertion -
   `assertStaff(db, session, permission)` - runs inside the store function, before the query,
   and reads `user.role` from D1, never from the session: the session cookie cache holds a
   snapshot for five minutes (`SESSION_COOKIE_CACHE_SECONDS`, `src/server/auth/index.ts:33`)
   and the KV secondary-storage snapshot for the session's life, so a revoked role would
   otherwise keep working. The repo's own precedent is `requireOrg`, which re-reads
   `member.role` from D1 "so a revoked or downgraded membership takes effect immediately"
   (`src/server/auth/session.ts:63-66`). A Studio route's loader may skip a call it knows will
   be refused - the `10-S2` pattern; a non-staff visitor gets the router's 404 and no payload -
   but the skip is never the decision.
3. **Content stores are deployment stores.** Every store this plan adds takes a `Database`,
   never a `TenantScope`, in the exact shape of `appSettingsStore`. A content store that could
   accept a scope would invite tenant-shaped reasoning about operator data. The negative case -
   these stores are not reachable through any tenant path, and no tenant filter applies - is a
   test obligation carried by each stage's **Tenant isolation test** heading.
4. **Published content is served from a persistent KV snapshot, never from D1.**
   `docs/ARCHITECTURE.md` §9 (failure mode 1) promises the marketing pages never touch D1;
   this plan keeps that promise under management. Publishing writes D1 (the version pointer,
   the audit row) and then overwrites one snapshot blob per locale in the `KV` binding -
   `content:site:<locale>`, **no TTL**: the snapshot is permanent and only ever replaced by the
   next publish, because an expiring snapshot would eventually leave the anonymous path with
   nothing to read and no permissible way to rebuild it. The anonymous read is an isolate memo
   (30 s, the `src/lib/i18n/catalogue.ts` pattern) over one KV read and zero D1 statements.
   There is **no shared edge caching of HTML**: the Worker always runs on a Workers route (the
   cache API sits behind the Worker, not in front of it), the document is locale-negotiated
   and `src/routes/__root.tsx:99` already sends `vary: accept-language, cookie` - a URL-keyed
   shared cache would hand one visitor's language to the next. Publishing is serialised (KV
   allows one write per second per key). Worst-case publish-to-visible latency is ~90 s
   (30 s memo + KV propagation), and the free tier's 1000 KV writes/day - shared with queue
   idempotency markers and the billing cache - caps publishing at roughly 30-40 publishes a
   day, which is ample and is stated rather than discovered.
5. **Translation policy is a property of the collection.** `fallback` collections (marketing,
   blog, help, announcements) render the source locale where a translation is missing, with
   `lang="en"` stamped on the fallen-back block - WCAG 2.2 SC 3.1.2, not decoration. The
   fallback lives in exactly one module (`src/server/content/resolve.ts`); the message
   catalogue, `createTranslator` and the parity gate are untouched. `explicit` collections
   (legal) have **no fallback**: a locale without a reviewed translation gets a designed
   notice linking to the source-locale document, because showing a consumer terms in a
   language they did not choose, inside a site otherwise in their language, is a legal
   exposure and not a cosmetic one. Frozen vocabularies stay frozen: country names remain in
   `src/lib/atlas/country-names.ts` (`SPEC` §8 rule 5 - workerd and WebKit disagree on
   `Intl.DisplayNames`).
6. **The editor is block-based and never touches `contentEditable`.** A document is a list of
   typed blocks; a text block is an autosizing `textarea` with a toolbar that wraps the
   selection in a three-construct inline syntax (`**bold**`, `[text](target)`,
   `{{placeholder|param}}`) via `selectionStart`/`selectionEnd`. The native `textarea` supplies
   IME composition (we ship `ja`, `ko`, `zh-Hans`, `zh-Hant`), bidi for `ar`, undo, mobile and
   accessibility for free; pasting from Word arrives as plain text so junk formatting has no
   door. The canonical format is our own marks model in `body(json)` - parser and renderer are
   one tested module - so a future inline-WYSIWYG (Lexical) would be a field-component swap
   behind a `SPEC` §3 amendment, not a migration. Any drift toward `contentEditable` during
   implementation is a plan change, not an implementation detail.
7. **Prices never enter the CMS.** `src/lib/plans.ts` stays the single source of truth. Text
   that mentions a price carries a computed token (`{{cheapestMonthly}}`) resolved from the
   catalogue at render, exactly because `src/routes/index.tsx:148-162` derives that figure
   today rather than hard-coding it.
8. **`src/server/db/auth-schema.ts` is treated as a seventh shared path.** It is not on
   `README.md`'s list of six, but it has the same failure mode as `schema.ts` - two stages
   adding columns in parallel corrupt each other - and this plan's Better Auth columns are
   therefore stated as wave-0 requirements, never owned by a stage here.

### Wave-0 requirements this plan sends to `00-foundations.md`

Per `README.md`'s shared-file protocol these are stated here and minted as foundations stages;
no stage below owns any of them. Consolidated so foundations can cut them in one pass:

- **Schema (`src/server/db/schema.ts`), additive, one `pnpm db:generate` series.** Nine new
  tables, none tenant-scoped unless noted, all on the file's conventions (`newId()` text PKs,
  epoch-ms timestamps, `enumCheck`, every lookup column indexed):
  `content_entries` (unique `(collection, slug)`; status check
  `draft|in_review|scheduled|published|archived`; index `(collection, status)`),
  `content_versions` (unique `(entry_id, version)`; immutable rows; `meta` json for
  title/description/og-image asset; `effective_from`, `requires_reacceptance`,
  `change_summary_key`, `reviewed_by`, `reviewed_at`),
  `content_translations` (unique `(version_id, locale)`; `body`, `meta`, `change_summary`
  json; `translated_by`, `reviewed_by`, `reviewed_at`),
  `content_redirects` (unique `(collection, old_slug)`),
  `content_assets` (`storage_key`, `checksum`, `width`, `height`, `alt_text` json),
  `navigation_items` (`menu`, `parent_id`, fractional `sort_order`, typed `target_kind`
  check `route|slug|url`, `labels` json, `visibility` json),
  `announcements` (kind check `banner|whatsnew|actionable`; `audience` json; `starts_at`,
  `ends_at`, `status`, `sent_at`),
  `announcement_reads` (unique `(announcement_id, user_id)`; carries `organization_id`),
  `legal_acceptances` (unique `(subject_ref, version_id)`; `user_id` nullable; `ip`,
  `user_agent` nullable; `erased_at`; index on `user_id`),
  `platform_audit_log` (indexes on `created_at` and `actor_user_id`; **no**
  `organization_id` - that absence is the point, `audit_log.organization_id` is `NOT NULL`
  at `schema.ts:1787`).
  Plus one alteration: a **partial unique index** on the existing `notifications` table,
  `(recipient_user_id, entity_type, entity_id) WHERE entity_type IN ('legal','announcement')`
  (Drizzle indexes support `.where()`). Partial, because a blanket unique would break
  legitimate repeat notifications about one entity from other producers; without it, fan-out
  idempotency rests only on the queue's 24 h KV done-marker
  (`TASK_DONE_TTL_SECONDS`, `src/server/queue/jobs.ts:30`), which does not survive a second
  fan-out enqueued under a fresh envelope id. The migration backfills nothing.
- **Auth schema (`src/server/db/auth-schema.ts`), additive.** The admin plugin's columns, with
  camelCase property keys because the Drizzle adapter addresses columns by property key
  (`auth-schema.ts:4-6`): `user.role`, `user.banned`, `user.banReason`, `user.banExpires`;
  `session.impersonatedBy` (required by the plugin's schema even though impersonation stays
  disabled).
- **`wrangler.jsonc`.** A `*/5 * * * *` cron trigger in **both** production and staging
  (staging's trigger list is currently only `"0 3 * * *"` at `wrangler.jsonc:174`, which would
  make scheduled publishing untestable there; the weekly retention cron that the acceptance
  minimisation below relies on is likewise absent from staging).
- **`src/server/worker.ts`** (shared path): a `case` for the `*/5` cron in the `scheduled()`
  switch (`worker.ts:56-68`) delegating to `runContentCron` exported from
  `src/server/content/schedule.ts` (owned by `13-S6`).
- **Queue contract (`src/server/queue/types.ts`, `consumer.ts` - both append-shaped).** Two
  kinds with payload schemas and handler registration: `announcement-fanout` and
  `legal-reacceptance-fanout`. Handlers themselves are owned by `13-S6` / `13-S7`.
- **Secret.** `LEGAL_SUBJECT_SALT` - `wrangler secret put`, an entry in `.dev.vars.example`,
  a loud-failure accessor like every other secret, and a runbook sentence stating it is
  **never rotated**: rotation severs the evidential link and the
  `(subject_ref, version_id)` uniqueness that §13-S7 depends on.
- **`docs/SPEC.md` §8, three amendments.** (a) §8.2: the no-English-fallback rule gains a
  named exception for editorial content from `content_translations` in `fallback`-policy
  collections - never for the message catalogue. (b) Rule 8: the `src/routes/legal/**`
  exclusion is deleted; its stated reason ("translated legal text needs review this build
  cannot give it") is discharged by the `in_review` state, `reviewed_by`/`reviewed_at`
  columns and the `legal_reviewer` role. (c) The namespace contract: `marketing` (one of the
  "exactly these ten", absent on disk at HEAD) is declared to hold marketing *chrome* -
  nav labels, aria strings, buttons - while long-form marketing copy lives in the CMS, so the
  parity gate and the CMS cannot come into conflict.
- **`docs/DEPLOY.md` runbook.** Bootstrap of the first `platform_admin` by one
  `wrangler d1 execute`, including the step production would otherwise teach the hard way:
  with `secondaryStorage`, the `{session, user}` snapshot lives in KV for the session's full
  life and is refreshed only through Better Auth's own `updateUser` - a direct SQL `UPDATE`
  bypasses it, so **the bootstrapped admin must sign out and back in**. Later grants go
  through the plugin's `setRole`, which refreshes the snapshot. Also: the content snapshot
  seed step at first deploy (decision 4's "miss only before first publish"), and the
  data-deletion runbook entry for acceptance-record minimisation (13-S7).

### What this plan does not own

None of the six shared paths, nor `auth-schema.ts` (decision 8). The workspace console and the
organization roles are `10-administration.md`'s and are not edited. Files owned by other plans
that stages here must touch are taken **cross-wave and named**, with the owning stage cited in
the stage's Owned paths: `src/server/auth/index.ts` (09-S3 wave 1, 10-S1 wave 3),
`src/lib/auth/client.ts` (09-S1 wave 1), `src/routes/_app/-server/shell.ts` and
`src/routes/_app/route.tsx` (02-S2 wave 1, 08-S10 wave 3), `src/server/repos/notifications.ts`
(00-foundations wave 0), `src/server/queue/types.ts` / `consumer.ts` (00 wave 0, 01-S1 wave 1,
07-S8 wave 4). All eight stages sit in **waves 7-11**, above the existing set's waves 0-6, so
no stage here can same-wave-collide with any existing owner; the collision check at the end of
this file is the measurement. Deliberately out of scope entirely: impersonation (no role
carries `impersonate`), web push (a WebCrypto VAPID implementation is a separate decision),
Cloudflare Access in front of `/studio/*` (optional hardening, later), a responsive `srcset`
pipeline, locale-prefixed URLs for `/` and `/pricing` (13-S8 introduces per-locale paths for
blog/help and records the mechanism; extending it is a later call), and the retention figure
for minimised acceptance records (a config key with a 6-year default; the number belongs to
counsel).

## Stage 13-S1 - The staff plane: roles, the console shell, and the operator audit trail

### Stage id

`13-S1` · Wave 7 · effort **M**. Turns on the deployment-wide role column, defines the Studio
permission model, builds the `/studio` shell with its team and people screens, and gives every
operator action a place to be recorded.

### Reference rows

No gap row - this capability is outside the 89-row matrix (see Area brief). It borders
`ADM-01`/`ADM-04` (the tenant-scoped console, untouched) and stands on the ADM-05/ADD-01
exclusions in `11-boundaries-and-blockers.md`, which it cites rather than re-argues.

### Owned paths

- `src/server/auth/access.ts` - new. Access-control statements and the five platform roles.
- `src/server/repos/staff.ts` - new. `assertStaff`, `getPlatformRole`, `listStaff`,
  `setPlatformRole`, `listPeople`, `banUser`, `revokeSessions` - all `Database`-typed.
- `src/server/repos/platform-audit.ts` - new. `recordPlatformAudit`, `listPlatformAudit`
  (keyset-paged).
- `src/server/repos/index.ts` - append. Barrel exports for the two new modules.
- `src/server/auth/index.ts` - append. Registers the `admin` plugin. Cross-wave with
  `09-S3` (wave 1) and `10-S1` (wave 3), both named here; this stage only appends the plugin
  entry and its options.
- `src/server/auth/tenant.ts` - edit. `normaliseSession` starts surfacing `role` and `banned`
  on the session user.
- `src/lib/auth/client.ts` - append. Adds the `adminClient` plugin. Cross-wave with `09-S1`
  (wave 1), named.
- `src/routes/studio/route.tsx` - new. The Studio layout: its own shell (not `_app` - no
  `TenantScope` exists here), a `beforeLoad` that 404s non-staff without fetching a payload.
- `src/routes/studio/index.tsx` - new. The dashboard: published-surface summary, recent
  operator actions.
- `src/routes/studio/team.tsx` - new. Platform roles: who, which role, granted by whom, when.
- `src/routes/studio/people.tsx` - new. Deployment accounts: search by email, ban, revoke
  sessions. Shows accounts, never workspace contents.
- `src/routes/studio/-server/staff.ts` - new. The server functions behind the three screens.
- `src/routes/studio/-ui/shell.tsx` - new. Studio nav, header, section labels.
- `src/server/repos/__tests__/staff.test.ts` - new. Role plane disjointness and audit
  coverage (see Tenant isolation test).

### Data and migration

Everything this stage reads and writes is a wave-0 foundations requirement, restated from the
Area brief and not owned here: the four `user` columns and one `session` column in
`auth-schema.ts`, and the `platform_audit_log` table in `schema.ts`. The migration backfills
nothing; every existing user resolves to the plugin's default role `user`, which grants
nothing.

### Server (repo, server function, Zod)

- **Access control.** `src/server/auth/access.ts` builds the statement set by **merging the
  plugin's `defaultStatements`** with ours - this is load-bearing, not style: every admin-plugin
  endpoint checks the `user` and `session` resources (`listUsers` checks `{ user: ["list"] }`,
  ban `{ user: ["ban"] }`, revoke `{ session: ["revoke"] }` - `admin/routes.mjs:351-356` in the
  installed 1.7.1), so custom-only statements would fail every `hasPermission` call on the
  plugin's own routes. Our resources: `content`, `navigation`, `announcement`, `media`,
  `legal`, `settings`. Roles: `user` (nothing - the plugin's `user.create.before` hook stamps
  it on every new signup, so it must exist in the roles map or `setRole` could never restore
  it), `editor` (content create/update, media upload), `publisher` (editor plus
  content publish/unpublish, announcement all), `legal_reviewer` (legal all, nothing else),
  `platform_admin` (everything, plus the plugin's `user`/`session` actions **minus
  `impersonate`**). Plugin config `admin({ roles, adminRoles: ['platform_admin'] })` - the
  plugin throws `BetterAuthError` at init if `adminRoles` names a role absent from `roles`.
- **Repository.** `assertStaff(db, session, permission)` reads `user.role` from D1 on every
  call (decision 2) and throws the repo's `ForbiddenError` shape. `setPlatformRole` goes
  through the plugin's `setRole` API so the KV session snapshot refreshes;
  `recordPlatformAudit` is called by every mutating staff function in the same request as the
  mutation - grant, ban, revoke, and every later publish/send in stages that build on this.
  These stores are `Database`-typed by decision 3; `tenantFilter()` does not appear because
  there is no tenant column to filter - the **Tenant isolation test** heading carries the
  proof obligation the TEMPLATE normally assigns to `tenantFilter`.
- **Server functions.** In `src/routes/studio/-server/staff.ts`:
  `loadStudioShell` (GET - role, nav, dashboard counts), `loadTeam` (GET), `grantRole` (POST),
  `loadPeople` (GET, paged, email search), `banAccount` (POST), `revokeAccountSessions`
  (POST). Every input `z.strictObject`; role values `z.enum` over the roles map; email search
  `z.string().trim().min(3).max(254)`.
- **Authorisation.** Decided in `staff.ts` store functions, before the query, on D1-fresh
  role. The route's `beforeLoad` skip (session-role hint) changes what renders, never what is
  permitted - the server functions remain reachable without the route and still end in
  `ForbiddenError`.

### UI (route, components)

- **Routes.** `/studio` (layout), `/studio/` (dashboard), `/studio/team`, `/studio/people` -
  all SSR default. New route files mean `pnpm generate-routes`; `routeTree.gen.ts` is never
  hand-edited. Non-staff: router 404 (the product's existing not-found), zero payload.
- **Components.** Reuses `PageHeader`, `Card`, `Table`/`TableRow`, `Badge`, `Avatar`,
  `Button`, `EmptyState`, `Alert`, `SectionLabel` from `src/components/ui` and
  `src/components/layout` - no second implementation of any of them. New: the Studio shell in
  `-ui/shell.tsx` (nav rail + header on existing primitives).
- **States.** Team list empty state: "Nobody but you has a Studio role yet" with the grant
  affordance; people search empty state: "No account matches that address"; both lists get
  row-shaped skeletons and an `ErrorPanel`-based error state with retry. Grant/ban/revoke are
  confirm dialogs with loading states on the confirm button.
- **Tokens.** None missing; the shell is built from existing `--space-*`, `--radius-*`,
  `--shadow-card` tokens.

### Quota

No tenant-countable row is created: `platform_audit_log` and the role column are operator
data, deliberately outside `resolveQuotas`/`PLAN_QUOTAS`, and unbounded growth is governed by
the audit prune pattern (`pruneAuditLog` precedent), not by plan ceilings.

### Tenant isolation test

`src/server/repos/__tests__/staff.test.ts`, over a real database: (1) a user who is `owner` of
an organization but `user` on the platform gets `ForbiddenError` from every `staff.ts`
mutation and from `loadTeam` - `member.role` never opens Studio; (2) a `platform_admin` with
**no** organization membership at all can run every staff function - `user.role` never passes
through a tenant repository, and no `TenantScope` is constructible for these calls (asserted
by the module's types: the functions accept `Database`); (3) after a grant is revoked, the
very next `assertStaff` fails even while the old session cookie is fresh (D1-fresh role,
decision 2); (4) every mutation left exactly one `platform_audit_log` row naming the actor.

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests: `staff.test.ts` (the four invariants above); an `access.ts` test asserting the
  merged statement set still contains the plugin's `user`/`session` actions and that no role
  carries `impersonate`.
- Browser evidence: `/studio/team` and `/studio/people` at 360px and 2560px, light and dark;
  the interaction that is the point - granting a role, then revoking it and watching the
  grantee's next navigation 404 - captured as a sequence. A signed-in workspace owner without
  a platform role navigating to `/studio` and receiving the 404 page, with the network panel
  showing no Studio payload.
- Console silent in every capture.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: build, lint+typecheck,
tests, real-browser verification in both themes at both ends, no placeholder debris, no files
outside ownership. On top, the `docs/SPEC.md` §2 clauses ticked for every surface this stage
ships:

- [ ] Spacing on the 4px grid from `--space-*`; no one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading states on the grant select, the ban
      and revoke confirms, and the people search input.
- [ ] Team and people lists each have a designed empty state, skeleton and error state.
- [ ] Motion 150-260ms on `--ease-out-quint` or sibling, transform/opacity only,
      `prefers-reduced-motion` honoured.
- [ ] Light and dark parity, dark shadows re-declared.
- [ ] Responsive 360px → 2560px; the 360px team list is a designed stacked list.
- [ ] Keyboard navigable end to end; accessible names say whom a control acts on; WCAG 2.2 AA
      contrast in both themes.
- [ ] Zero console errors/warnings, zero layout shift, `tabular-nums` on counts and dates.

### Blockers

None. The `admin` and `access` plugins ship inside the already-pinned `better-auth@1.7.1`; no
package, binding or third-party service is missing. Depends only on this plan's wave-0
foundations requirements (Area brief), which close before wave 7 by construction.

## Stage 13-S2 - Content as data: stores, versions, translations, and the publish pipeline

### Stage id

`13-S2` · Wave 8 · effort **L**. The server half of the CMS: entries, immutable versions,
per-locale translations, redirects, the marks model with its parser and renderer, the
publish-to-KV snapshot pipeline, and the public read path for SSR and SPA navigation alike.

### Reference rows

No gap row - outside the 89-row matrix (see Area brief).

### Owned paths

- `src/server/content/collections.ts` - new. The collection registry: Zod body schema per
  collection, allowed block set, public path, translation policy (`fallback` | `explicit`),
  review policy, acceptance mode (`none` | `acknowledge` | `accept`). The slug `accept` is
  reserved (collides with the `/legal/accept` route added in 13-S7).
- `src/server/content/richtext.ts` - new. The marks model, the three-construct inline parser
  (~150 lines, rejects everything else), and the renderer onto the legal prose classes
  (`src/components/marketing/legal.tsx:35`) - one module so parse and render cannot drift.
- `src/server/content/publish.ts` - new. Snapshot builder (batched D1 reads per locale),
  serialised KV writes (`content:site:<locale>`, no TTL), `content:legal:required`,
  the platform-audit row, and the re-acceptance fan-out trigger consumed in 13-S7.
- `src/server/content/resolve.ts` - new. Snapshot reads with the isolate memo; the
  source-locale fallback for `fallback` collections and the designed-notice result for
  `explicit` ones. The only module in the product where editorial fallback exists.
- `src/server/repos/content.ts` - new. Entries, versions, translations, redirects:
  `createEntry`, `saveDraftVersion`, `saveTranslation`, `submitForReview`, `reviewTranslation`,
  `publishVersion`, `rollbackToVersion`, `renameSlug` (writes a `content_redirects` row),
  `listEntries`, `getEntryWithVersions`, `coverageMatrix`. All `Database`-typed; mutations
  assert through `13-S1`'s `assertStaff` and write `platform_audit_log`.
- `src/server/fns/content.ts` - new. `getPublishedSurface` (GET server function) - the one
  read path public route loaders call, on the server during SSR and over the wire on SPA
  navigation, so hydration and client navigation read the same snapshot.
- `src/server/repos/index.ts` - append. Barrel export.
- `docs/ARCHITECTURE.md` - append. The §4 cache-table rows for `content:site:<locale>` (no
  TTL, invalidated by publish), `content:legal:required` (no TTL), and the isolate memo -
  and **no** row claiming edge caching of documents (decision 4 records why such a row would
  be false).
- `src/server/content/__tests__/richtext.test.ts` - new.
- `src/server/content/__tests__/publish-resolve.test.ts` - new.
- `src/server/repos/__tests__/content-store.test.ts` - new.

### Data and migration

Wave-0 requirements (Area brief, not owned here): `content_entries`, `content_versions`,
`content_translations`, `content_redirects` with the uniques and checks listed there. All
additive; the migration backfills nothing. Ids from `newId()`; instants epoch-ms; version
bodies and metas are `text({ mode: 'json' })` holding the marks model and never HTML.

### Server (repo, server function, Zod)

- **Repository.** As listed under Owned paths. Two invariants the store enforces rather than
  trusts: versions are immutable (no update path exists for a `content_versions` row - publish
  moves a pointer, rollback moves it back), and an `explicit`-policy collection refuses
  `publishVersion` for any locale whose translation lacks `reviewed_at`.
- **Server function.** `getPublishedSurface({ surface, locale })` returns the resolved blob
  for one surface and locale; GET, cacheable by the router, zero D1 - it reads only
  `resolve.ts`. Studio mutations are **not** here; they arrive with the editor in 13-S3
  under `src/routes/studio/-server/`.
- **Zod.** `z.strictObject` everywhere; locale `z.enum` over the 23 tags from
  `src/lib/i18n/locales.ts`; slugs `z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96)`
  with the reserved-slug refusal; body payloads validated by the collection's own schema from
  the registry - validation is shape, the store's `assertStaff` is permission.
- **Authorisation.** Every mutation asserts inside the store on D1-fresh role (decision 2).
  The public read function requires nothing: it serves published data only.

### UI (route, components)

None - this stage is deliberately headless; 13-S3 (editor), 13-S5 (public pages) and later
stages are its consumers. Stating that is this heading's answer: shipping a screen here would
couple the pipeline's correctness to an editor that has its own stage.

### Quota

No tenant-countable row. Content rows are operator data outside `resolveQuotas`; growth is
bounded by the staff permission model, and the snapshot-size alarm (5 MiB per locale blob,
logged at warn well under KV's 25 MiB value cap) is an operational guard, not a plan ceiling.

### Tenant isolation test

`content-store.test.ts`: (1) every exported store function is `Database`-typed - no overload
accepts a `TenantScope`, asserted at the type level with `@ts-expect-error` cases and at
runtime by the module exposing no tenant-filtered query; (2) rows written by these stores are
invisible to every tenant repository (a scan over `content_*` from a tenant scope has no path
to them); (3) a session whose user is `publisher` can publish and one whose user is `editor`
cannot - and the refusal happened in the store, not in a route.

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `richtext.test.ts`: round-trip text ↔ model for every block type; the parser rejects
  unknown constructs (raw HTML, images-by-URL, nested emphasis) byte-for-byte rather than
  half-parsing them; placeholder params survive the trip.
- `publish-resolve.test.ts` (Miniflare KV): publish writes one blob per locale with no TTL;
  a second publish overwrites; `fallback` resolution merges source-locale under the target
  and marks fallen-back blocks (the `lang` stamp travels as data); `explicit` resolution
  returns the designed-notice result, never source text; the **zero-D1 proof** - resolution
  of a published surface runs with `env.DB` replaced by a throwing proxy (a `wrangler tail`
  assertion would prove nothing: the Drizzle client is constructed without a logger at
  `src/server/db/client.ts:25` and invocation logs do not enumerate D1 subrequests).
- `content-store.test.ts`: the three isolation invariants; version immutability; the
  `explicit`-publish refusal; `renameSlug` leaves a redirect row and the old slug resolving.
- No browser evidence: headless stage (see UI).
- Console silent in test output.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged. The §2 visual checklist
is vacuous for a headless stage and is recorded as such deliberately - every box below is
"not applicable: no surface shipped", which is an answer, not an omission:

- [ ] No surface shipped; §2 clauses attach to 13-S3/13-S5, which mount this stage's output.

### Blockers

None. Depends on 13-S1 (wave 7) for `assertStaff` and the audit store, and on wave-0 schema;
both close before wave 8. No package, binding or service is missing.

## Stage 13-S3 - The Studio editor: blocks, translations, versions and preview

### Stage id

`13-S3` · Wave 9 · effort **L**. The screens where content is written: the entry list, the
block editor (palette, textarea-with-toolbar text blocks, reorder), the 23-locale translation
matrix, version history with rollback, and a live preview that renders the product's real
components.

### Reference rows

No gap row - outside the 89-row matrix (see Area brief).

### Owned paths

- `src/routes/studio/content/index.tsx` - new. Entries by collection: status, locale
  coverage, last publish.
- `src/routes/studio/content/$entryId.tsx` - new. The editor screen.
- `src/routes/studio/-server/content.ts` - new. The mutation server functions the editor
  calls (draft save, submit, review, publish, rollback, translation save) - thin Zod-validated
  fronts over `13-S2`'s store.
- `src/routes/studio/content/-ui/entry-list.tsx` - new.
- `src/routes/studio/content/-ui/translation-matrix.tsx` - new. 23 locales × entry: present,
  reviewed, fallen-back; the `explicit` publish blocker renders here.
- `src/routes/studio/content/-ui/version-history.tsx` - new. Immutable list, effective dates,
  rollback affordance.
- `src/components/studio/editor/block-list.tsx` - new. The document as a reorderable list
  (`@dnd-kit`, the planner's own dependency), add-from-palette, delete-with-confirm.
- `src/components/studio/editor/text-block.tsx` - new. Autosizing `textarea`; toolbar buttons
  and `Ctrl/Cmd+B`, `Ctrl/Cmd+K` wrapping the selection via `selectionStart`/`selectionEnd`.
- `src/components/studio/editor/block-forms.tsx` - new. The typed forms for non-text blocks
  (TanStack Form + Zod from the collection schema), including single-line fields with
  computed-token support.
- `src/components/studio/editor/preview.tsx` - new. Side-by-side live preview rendering real
  components through the registry (legal prose via `13-S2`'s renderer; marketing blocks via
  `13-S5`'s registry once it lands - until then the preview renders the marks model, and the
  stage says so instead of faking it).
- `src/components/studio/editor/__tests__/` - new, owned wholly. Selection-wrapping unit
  tests, block reorder model tests.

### Data and migration

Nothing new: this stage writes exclusively through `13-S2`'s store into wave-0 tables. Stating
that is the answer; a data change appearing during implementation is a plan error.

### Server (repo, server function, Zod)

- **Repository.** None added; the editor is a client of `src/server/repos/content.ts`.
- **Server functions.** `saveDraft`, `saveTranslation`, `submitForReview`, `reviewTranslation`,
  `publish`, `rollback` in `src/routes/studio/-server/content.ts` - POST, `z.strictObject`
  inputs, body validated against the collection's registry schema before the store sees it.
- **Authorisation.** In the store (13-S2), on D1-fresh role. The editor UI additionally hides
  affordances the session-role hint says will be refused - a render decision, cited as such.

### UI (route, components)

- **Routes.** `/studio/content` and `/studio/content/$entryId`, SSR default, children of
  13-S1's Studio layout. `pnpm generate-routes` travels with the diff.
- **Components.** Reuses `Card`, `Button`, `Badge`, `Table`, `Tabs`/`PillNav`, `EmptyState`,
  `Alert`, `Tooltip`, `Dialog` primitives from `src/components/ui`; drag-and-drop via the
  same `@dnd-kit` patterns as the planner (`src/components/planner/plan-dnd.ts` is the
  reference implementation for keyboard-accessible reordering). New components as listed.
- **States.** Entry list: empty ("Nothing in this collection yet" + create), skeleton rows,
  error with retry. Editor: per-block save state, publish button disabled-with-reason when an
  `explicit` collection lacks reviews (the reason names the missing locales), version history
  empty state for a never-published entry. Translation matrix: fallen-back cells visibly
  marked - the same signal the public `lang` stamp encodes.
- **Tokens.** None missing.

### Quota

No tenant-countable row: editor writes are operator data through 13-S2's stores (see that
stage's Quota).

### Tenant isolation test

No new repository functions, so no new isolation case - the obligation this heading normally
carries is discharged by 13-S2's cases, cited here. What this stage adds instead is the
role-plane case at the function layer: an `editor` session calling `publish` through the
server function receives the store's `ForbiddenError`; a `publisher` succeeds.

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit: selection-wrapping around collapsed and non-collapsed selections, at field start/end,
  with multi-byte text (CJK, Arabic) - the toolbar must not split surrogate pairs; reorder
  model keeps block identity under moves.
- Browser evidence: the editing sequence that is the point - type a paragraph, bold a
  selection with `Ctrl+B`, add a list, drag blocks into a new order, save, reload Studio, and
  the document returns from the model losslessly with the preview matching; paste a Google
  Docs fragment and watch plain text arrive. The `explicit` publish blocker naming missing
  locales. At 360px and 2560px, light and dark; the 360px editor is a designed single-column
  flow.
- Console silent throughout, including during drag.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged. §2 clauses, ticked for
the editor surfaces:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading states on every toolbar button,
      palette item, drag handle, and the publish/rollback confirms.
- [ ] Entry list, version history and translation matrix each have designed empty, skeleton
      and error states.
- [ ] Motion 150-260ms on `--ease-out-quint` or sibling; reduced-motion honoured (drag
      previews included).
- [ ] Light and dark parity, dark shadows re-declared.
- [ ] Responsive 360px → 2560px; keyboard-accessible reordering, not pointer-only.
- [ ] Keyboard navigable end to end; toolbar buttons have accessible names; AA contrast.
- [ ] Zero console errors/warnings, zero layout shift, `tabular-nums` on version numbers and
      dates.

### Blockers

None. Depends on 13-S1 and 13-S2 (waves 7-8). The full-fidelity marketing-block preview
depends on 13-S5's registry, same wave - the preview therefore renders the marks model for
those blocks until 13-S5 lands, and that degraded mode is designed, not accidental.

## Stage 13-S4 - The media library: upload, browse, edit, choose, delete

### Stage id

`13-S4` · Wave 9 · effort **M**. Operator media on R2: the `content_assets` store, the
`/studio/media` screen, the picker dialog other Studio surfaces open, thumbnails through the
existing queue, and public content-hashed URLs.

### Reference rows

No gap row - outside the 89-row matrix (see Area brief).

### Owned paths

- `src/server/repos/content-assets.ts` - new. `recordAsset` (R2-first, compensating delete on
  failure - the `repos/files.ts` order), `listAssets` (cursor-paged), `updateAsset` (name,
  description, per-locale alt), `deleteAsset` (reference check first), `findUsages`.
- `src/server/repos/index.ts` - append. Barrel export.
- `src/routes/studio/media.tsx` - new. The library screen.
- `src/routes/studio/-server/media.ts` - new. Upload/list/update/delete server functions.
- `src/components/studio/media/asset-grid.tsx` - new. Thumbnail grid, search, type filter.
- `src/components/studio/media/upload-drop.tsx` - new. Drag-and-drop + picker, multi-file.
- `src/components/studio/media/asset-picker.tsx` - new. The grid as a selection dialog;
  returns `assetId`. Consumed by 13-S3's image block and 13-S5's og-image fields.
- `src/components/studio/media/__tests__/` - new, owned wholly.
- `src/server/repos/__tests__/content-assets.test.ts` - new.

### Data and migration

Wave-0 requirement (not owned here): the `content_assets` table from the Area brief.
Backfills nothing. Storage keys are content-hashed - `cms/<sha256-prefix>/<filename>` -
published and never overwritten, so the public domain (`FILES_PUBLIC_BASE`,
`wrangler.jsonc:48`) can serve them `Cache-Control: immutable` under the same key promise the
tiles archives already keep ("immutable is a promise about the key",
`docs/ARCHITECTURE.md` §4). Replacing an image is a new key plus a republish.

### Server (repo, server function, Zod)

- **Repository.** As listed. `recordAsset` measures and stores `width`/`height` at upload -
  13-S5's renderer requires them, because an image without dimensions is a layout shift.
  `deleteAsset` refuses while any **published** version references the asset and returns the
  usage list (entry, version, locale); requires `media:delete`.
- **Server functions.** Upload accepts up to `MAX_FILES_PER_UPLOAD` (12) per request and
  enforces the allow-list and `MAX_FILE_BYTES` (25 MiB) from `src/server/fns/file-policy.ts`
  on the server regardless of the client's pre-flight - the policy module is pure and is
  reused, not re-implemented. Thumbnails are enqueued on the existing `thumbnail` task kind,
  never generated inline.
- **Zod.** `z.strictObject`; filenames trimmed and length-capped; alt text a partial record
  over the 23 locale tags; content types refined through the policy's `isAccepted`.
- **Authorisation.** `media:upload` for writes, `media:delete` for deletion, asserted in the
  store on D1-fresh role.

### UI (route, components)

- **Route.** `/studio/media`, SSR default, child of the Studio layout; `pnpm generate-routes`.
- **Components.** Reuses `Dialog`, `Card`, `Badge`, `EmptyState`, `Progress`, `Input`
  primitives; the upload queue borrows the established client pattern from
  `src/components/modules/files/upload-queue.ts` conceptually (per-file progress, failure
  retained in the list) without importing tenant code. New components as listed.
- **States.** Empty library ("No media yet - drop files anywhere on this screen"), grid
  skeletons, upload rows with per-file progress/error/retry, delete-blocked dialog listing
  usages by entry and locale. Alt-text matrix marks locales falling back to `en` (policy
  `fallback` - an image caption is not a legal text).
- **Tokens.** None missing.

### Quota

No tenant-countable row: operator media is deliberately outside `resolveQuotas` and
`PLAN_QUOTAS` - the bound is the staff permission model plus the per-object and per-request
caps from `file-policy.ts`. R2 write order is object first, assert/validate second,
compensating delete on throw - stated here because the TEMPLATE demands the order and the
store implements it.

### Tenant isolation test

`content-assets.test.ts`: the store is `Database`-typed (type-level cases as in 13-S2); asset
rows are unreachable from any tenant scope; an `editor` can upload but not delete; deletion
of a referenced asset throws with the usage list and deletes nothing - and afterwards the R2
object still exists (the compensating-delete path never fires on refusal).

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit: content-hash key derivation is stable and collision-namespaced; upload failure paths
  delete the object they wrote; reference check catches usage in `body` blocks and in `meta`
  og-image fields.
- Browser evidence: upload three files at once and watch three progress rows; edit alt in
  `pl` and `en`; open the picker from a dialog context and select; attempt to delete a
  referenced asset and read the usage list; delete an unreferenced one. 360px and 2560px,
  light and dark.
- Console silent, including during drag-over.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged. §2 clauses for the
library and picker:

- [ ] Spacing on the 4px grid.
- [ ] Hover, focus-visible, active, disabled and loading states on grid cells, upload
      controls, and the delete confirm.
- [ ] Grid, upload queue and picker each have designed empty, skeleton and error states.
- [ ] Motion 150-260ms, reduced-motion honoured.
- [ ] Light/dark parity, dark shadows re-declared.
- [ ] Responsive 360px → 2560px; the picker is full-screen on mobile by design.
- [ ] Keyboard navigable: grid cells focusable, picker selectable without a pointer; AA
      contrast.
- [ ] Zero console errors/warnings, zero layout shift (thumbnails reserve aspect boxes),
      `tabular-nums` on sizes and dates.

### Blockers

None. Depends on 13-S1/13-S2 and wave-0 schema. The public asset domain
(`files.planned.travel`) is existing configuration (`FILES_PUBLIC_BASE`), not a new binding.

## Stage 13-S5 - The public site as data: prop-driven marketing, blocks registry, navigation, SEO

### Stage id

`13-S5` · Wave 9 · effort **L**. The landing page and `/pricing` stop compiling their copy:
four marketing components become prop-driven, the block registry maps stored blocks onto
them, marketing navigation comes from `navigation_items`, head/JSON-LD generate from stored
meta, and a seed captures today's copy verbatim so the visual bar moves nowhere.

### Reference rows

No gap row - outside the 89-row matrix (see Area brief).

### Owned paths

- `src/components/marketing/hero.tsx` - edit. `MarketingHero` becomes prop-driven (heading,
  lede, CTA labels, trust notes); the embedded `AppPreview` mount becomes a prop-selected
  visual.
- `src/components/marketing/features.tsx` - edit. `FeatureSpotlights` and `ModuleGrid` take
  their arrays as props; the `SPOTLIGHTS`/`MODULES` literals move to the seed.
- `src/components/marketing/proof.tsx` - edit. `HonestProof` takes panels and promises as
  props.
- `src/components/marketing/chrome.tsx` - edit. `MarketingHeader`/`MarketingFooter` render
  navigation from data instead of `LANDING_ANCHORS`-style constants.
- `src/components/marketing/index.ts` - edit. Exports the new prop types.
- `src/server/content/blocks.ts` - new. The registry: block type → component + prop schema;
  non-serialisable members become name enums (`visual: 'planner' | 'costs' | 'reservations'`
  mapping to `PlannerVisual`/`CostsVisual`/`ReservationsVisual`, a finite icon-name set
  mapping to `lucide-react` components); link targets a typed enum of routes plus CMS slugs -
  never a free string.
- `src/server/content/seo.ts` - new. `head()` meta and JSON-LD generation from version/
  translation `meta`, with computed tokens (`{{cheapestMonthly}}` resolved from
  `src/lib/plans.ts`, the derivation `src/routes/index.tsx:148-162` performs today).
- `src/server/repos/navigation.ts` - new. `listMenu`, `saveMenu` (fractional `sort_order`,
  typed targets, visibility as data). `Database`-typed; mutations assert `navigation:update`.
- `src/server/repos/index.ts` - append. Barrel export.
- `src/routes/studio/navigation.tsx` - new. Menu editing screen.
- `src/routes/studio/-server/navigation.ts` - new. Its server functions.
- `src/routes/index.tsx` - edit. A loader over `getPublishedSurface` (13-S2); the page
  renders registry blocks; `head()` comes from `seo.ts`. Locale is the existing per-request
  negotiation (`src/routes/__root.tsx:85`) - decision 4 records why no shared HTML caching
  may be layered on top.
- `src/routes/pricing.tsx` - edit. Same shape; `PlanCardGrid` keeps reading
  `src/lib/plans.ts` directly (decision 7).
- `src/routes/api/dev/-seed/dataset/content.ts` - new. Today's copy, verbatim, as the seed
  dataset: entries, versions, translations (`en`), navigation.
- `src/routes/api/dev/-seed/apply.ts` - append. Registers the content dataset.
- `src/components/marketing/__tests__/` - append. Prop-driven render cases beside the
  existing tests.
- `src/server/content/__tests__/blocks.test.ts` - new.

### Data and migration

Wave-0 tables only (`navigation_items` from the Area brief); nothing else. The **seed is the
migration of copy**: it writes today's literals into `content_entries`/`content_versions`
via the store, so the first published snapshot reproduces the current site byte-for-byte in
`en`. First-deploy snapshot seeding is the `docs/DEPLOY.md` runbook step named in the Area
brief.

### Server (repo, server function, Zod)

- **Repository.** `navigation.ts` as listed. No other repository: content flows through
  13-S2's store and read function.
- **Server functions.** Navigation load/save under `src/routes/studio/-server/navigation.ts`;
  public pages call 13-S2's `getPublishedSurface`.
- **Zod.** Block payloads validated against the registry's per-block schemas - the same
  schemas the editor forms (13-S3) render from, so the two cannot disagree; visibility and
  target enums are closed sets.
- **Authorisation.** `navigation:update` in the store; public reads assert nothing.

### UI (route, components)

- **Routes.** `/` and `/pricing` keep their paths and SSR; `/studio/navigation` is new
  (`pnpm generate-routes`).
- **Components.** The four refactored marketing components, the registry, and the navigation
  editor built from `ui` primitives plus `@dnd-kit` for ordering. The refactor's contract:
  today's rendered output is the default seed data's rendered output - the blind-pair
  screenshot comparison below is the acceptance instrument, because `SPEC` §2's bar is judged
  on screens and a copy migration must not move a pixel.
- **States.** Fallback-rendered blocks carry `lang="en"` (decision 5). Navigation editor:
  empty menu state, skeleton, error. The published pages themselves have no new async states -
  the loader resolves before render, and a missing snapshot (pre-first-publish only) renders
  the seeded default.
- **Tokens.** None missing; the refactor forbids introducing any.

### Quota

No tenant-countable row (operator data; see 13-S2's Quota).

### Tenant isolation test

Navigation store: `Database`-typed, type-level cases as in 13-S2; an `editor` cannot save a
menu (`navigation:update` is `platform_admin`'s), and the refusal is the store's.

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit: `blocks.test.ts` proves every registered block's props are JSON-serialisable
  (the enum mapping catches a component or icon leaking into data), and that every enum name
  resolves to a component; `seo.ts` token resolution matches the catalogue-derived figure.
- Browser evidence: the point of the stage is invisibility - `/` and `/pricing` before and
  after, light and dark, at 360/768/1440/2560, pixel-compared; then the visible half: edit a
  heading in Studio, publish, and see it on `/` within ~90 s; switch to `pl` with no
  translation and read English inside `lang="en"`; SPA-navigate `/pricing` → `/` and back
  with content intact and no hydration mismatch.
- The zero-D1 anonymous proof re-runs here over the real routes (Miniflare, throwing `env.DB`
  proxy - 13-S2's instrument).
- Console silent on every public page in every capture.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged. §2 clauses, ticked for
the refactored public pages and the navigation editor:

- [ ] Spacing unchanged on the public pages (the comparison proves it) and on-grid in the
      editor.
- [ ] Interactive states intact on every refactored CTA and nav item; full set on the editor.
- [ ] Navigation editor list has empty, skeleton and error states.
- [ ] Motion unchanged on public pages; editor motion 150-260ms, reduced-motion honoured.
- [ ] Light/dark parity everywhere.
- [ ] Responsive 360px → 2560px on all touched surfaces.
- [ ] Keyboard navigation and AA contrast preserved on public pages, delivered on the editor.
- [ ] Zero console errors/warnings, zero layout shift; `tabular-nums` where numbers change.

### Blockers

None. Depends on 13-S2 (wave 8) and, for og-image picking, 13-S4's picker (same wave -
consumed as a component, and the og-image field degrades to an asset-id input until the
picker lands in the same wave's integration). Cross-wave file shares are named in Owned
paths.

## Stage 13-S6 - The app shell reads Studio: banners, what's-new, announcements, scheduled publishing

### Stage id

`13-S6` · Wave 10 · effort **M**. Campaigns targeted by plan, locale, role and account age; a
banner surface and what's-new panel in the authenticated shell; actionable announcements
materialised into the notification inbox through the queue; app navigation from data; and the
`*/5` cron's content duties.

### Reference rows

No gap row - outside the 89-row matrix (see Area brief). Borders `ACC-05` (channels): this
stage adds producers into the existing `in_app`/`email` channels and cites `ACC-05` for the
channel model itself.

### Owned paths

- `src/server/repos/announcements.ts` - new. Campaign CRUD, audience evaluation input shape,
  `dismiss` (writes `announcement_reads` - the one **tenant-scoped** write in this plan, it
  takes a `TenantScope`), `listDismissals`.
- `src/server/repos/notifications.ts` - append. `insertNotificationsUnscoped(db, rows)` -
  the queue handler has no session and writes across organizations; `notify()` requires a
  scope and stamps `senderUserId` from it (`notifications.ts:129-132`), so an unscoped
  variant on the `upsertSubscriptionUnscoped` precedent (`repos/billing.ts`) is required.
  Inserts use `onConflictDoNothing` against the wave-0 partial unique index. Cross-wave with
  00-foundations (wave 0), named.
- `src/server/repos/index.ts` - append. Barrel export.
- `src/server/content/schedule.ts` - new. `runContentCron`: scheduled publishes
  (`publish_at`), campaign activation windows (`starts_at`/`ends_at`), and the
  `effective_from` transition consumed by 13-S7. Exported for the wave-0 `worker.ts` case.
- `src/server/queue/handlers/announcement-fanout.ts` - new. 500-recipient pages,
  deterministic envelope ids, `notification_preferences` respected, per-locale child `email`
  tasks of ≤50 recipients each (the email payload carries one shared `html` and caps `to` at
  50 - `src/server/queue/types.ts:31-33` - so one 500-recipient page must group by locale
  and enqueue children rather than call the provider 500 times inline).
- `src/server/queue/types.ts` - append. The `announcement-fanout` payload schema beside its
  wave-0 kind. Cross-wave with 00 (wave 0), 01-S1 (wave 1), 07-S8 (wave 4), all named.
- `src/server/queue/consumer.ts` - append. Handler registration. Cross-wave as above.
- `src/routes/studio/announcements.tsx` - new. Campaign list and composer (kind, audience,
  window, linked entry).
- `src/routes/studio/-server/announcements.ts` - new. Its server functions.
- `src/routes/_app/-server/shell.ts` - append. `ShellPayload` gains `planId` (via
  `resolvePlanState` - KV-warm, D1 on miss; one extra KV read per document, stated as a cost,
  not waved away), the user's `createdAt`, the active campaign slice for the negotiated
  locale, and navigation items. Cross-wave with 02-S2 (wave 1) and 08-S10 (wave 3), named.
- `src/routes/_app/route.tsx` - append. Mounts the banner surface. Cross-wave with 02-S2
  (wave 1), named.
- `src/components/layout/announcement-banner.tsx` - new. The banner + what's-new entry point.
- `src/components/layout/nav-model.ts` - edit. App navigation entries resolve from
  `navigation_items` data (13-S5's store) with the existing model as fallback shape.
- `src/server/queue/__tests__/announcement-fanout.test.ts` - new.
- `src/server/repos/__tests__/announcements.test.ts` - new.

### Data and migration

Wave-0 tables (`announcements`, `announcement_reads`, the `notifications` partial unique
index) and the wave-0 cron/queue contract - all stated in the Area brief, none owned here.
Backfills nothing.

### Server (repo, server function, Zod)

- **Repository.** As listed. Audience targeting is computed server-side in the shell loader
  from data that request already resolves - plan id, role, locale, account age - never
  trusted from the client. `banner`/`whatsnew` kinds materialise **no rows**: they are read
  from the campaign snapshot (`content:campaigns:<locale>`, no TTL, overwritten on status
  change); only `actionable` reaches `notifications`, and only through the queue.
- **Server functions.** Campaign CRUD + send under `-server/announcements.ts`
  (`announcement:*` permissions); `dismiss` as a POST from the banner (tenant-scoped).
- **Zod.** Audience as a `z.strictObject` of closed enums (plan ids from `PLAN_IDS`, roles,
  locale tags) plus optional account-age bounds; windows as epoch-ms with
  `starts_at < ends_at` refinement.
- **Authorisation.** Send requires `announcement:send`, asserted in the store on D1-fresh
  role; dismissal requires only the member's own scope.

### UI (route, components)

- **Routes.** `/studio/announcements` (SSR, `pnpm generate-routes`); the banner mounts in the
  existing `_app` shell.
- **Components.** Banner on `Alert`/`Card` primitives with the dismiss affordance;
  what's-new as a panel reachable from the banner; composer from `ui` primitives with the
  entry picker (13-S3's list) and the audience form.
- **States.** No active campaign renders nothing (the banner's absence is its empty state -
  deliberate); composer has skeleton/error; the send confirm names the audience size estimate
  and is a loading-state button.
- **Tokens.** None missing.

### Quota

No tenant-countable row from campaigns themselves; `announcement_reads` rows are one per
user per campaign, bounded by campaign count, and deliberately outside plan quotas - stated
per the TEMPLATE's "no countable row" clause. Fan-out writes to `notifications` are bounded
by recipients and deduplicated by the partial index.

### Tenant isolation test

`announcements.test.ts`: `dismiss` is tenant-scoped - organization A's scope cannot read,
list or delete B's `announcement_reads` rows by id (each a `NotFoundError`, B untouched
after); campaign stores are `Database`-typed with the 13-S2 type-level cases; an `editor`
cannot send.

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit: audience evaluation truth table (plan × role × locale × age windows); fan-out pages
  deterministically and enqueues per-locale email children of ≤50; **double fan-out of one
  announcement leaves exactly one notification row per recipient** - the test forces the
  conflict path, because the KV done-marker alone cannot guarantee this (Area brief).
- Browser evidence: a campaign targeted `free` shows on a free workspace and not on a crew
  one; dismissal survives reload; what's-new opens from the banner. 360px and 2560px, light
  and dark.
- Console silent.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged. §2 clauses for the
banner, what's-new and composer:

- [ ] Spacing on the 4px grid.
- [ ] Interactive states on dismiss, what's-new trigger, composer controls and the send
      confirm.
- [ ] Composer lists and what's-new have designed empty, skeleton and error states.
- [ ] Motion 150-260ms; the banner's entrance is transform/opacity and reduced-motion aware.
- [ ] Light/dark parity.
- [ ] Responsive 360px → 2560px; the banner never overlaps the app's primary nav on 360px.
- [ ] Keyboard: dismiss and what's-new reachable and labelled; AA contrast.
- [ ] Zero console errors/warnings, zero layout shift (the banner reserves its space),
      `tabular-nums` on counts.

### Blockers

None. Depends on 13-S2/13-S3 (entries to link), 13-S5 (navigation store), the wave-0 queue
contract and cron case. Cross-wave file shares named in Owned paths.

## Stage 13-S7 - Legal documents under management: review, versions, acceptance and re-acceptance

### Stage id

`13-S7` · Wave 11 · effort **L**. The `legal` collection with its `explicit` translation
policy and enforced review; terms acceptance recorded at registration against a concrete
version; the graded re-acceptance path (notify → banner → decision screen) when counsel
flags a version; the public version history; and identity minimisation that survives account
deletion.

### Reference rows

No gap row - outside the 89-row matrix (see Area brief). Discharges the reason for
`docs/SPEC.md` §8 rule 8's legal-content exclusion (a wave-0 amendment; Area brief) and
depends on `09-S3` (wave 1) for the account-deletion flow it hooks into.

### Owned paths

- `src/server/repos/legal.ts` - new. `recordAcceptance` (computes
  `subject_ref = HMAC(LEGAL_SUBJECT_SALT, user_id)` **at insert**), `acceptanceState`,
  `eraseAcceptanceIdentity(db, userId)` (nulls `user_id`/`ip`/`user_agent`, stamps
  `erased_at`, one `runBatch` - D1 has no interactive transactions and the batch is the
  repo's atomic primitive), `listVersionsPublic`.
- `src/server/content/legal-state.ts` - new. Required-versions vs a user's acceptances: two
  KV reads with the isolate memo (`content:legal:required`, `legal:accepted:<userId>` at
  1 h TTL with explicit invalidation on accept), D1 authoritative on miss.
- `src/server/repos/index.ts` - append. Barrel export.
- `src/server/queue/handlers/legal-reacceptance.ts` - new. Fan-out on
  `requires_reacceptance` publish: notification rows via `insertNotificationsUnscoped`
  (title/body as i18n keys + params - the design `notifications` was built for,
  `schema.ts:1722`) and per-locale email children carrying the reviewed `change_summary`.
- `src/routes/legal/$slug.tsx` - new. CMS-rendered document with the public version history
  (effective dates, summaries, prior versions reachable). The literal `privacy.tsx`/
  `terms.tsx` coexist during migration - a literal route beats `$slug` - and are retired by
  this stage once their content is seeded; the reserved slug `accept` cannot collide.
- `src/routes/legal/accept.tsx` - new. The decision screen: what changed (reviewed summary,
  reader's locale), accept, or leave via the account-closure path.
- `src/routes/legal/-server/legal.ts` - new. Its server functions.
- `src/routes/studio/legal.tsx` - new. The counsel view: review queue, effective dating, the
  `requires_reacceptance` flag (its own audited permission, irreversible once published),
  acceptance coverage report.
- `src/routes/studio/-server/legal.ts` - new. Its server functions.
- `src/routes/(auth)/register.tsx` - append. The consent checkbox bound to the concrete
  `version_id` effective at render - never to a slug. No other plan owns this file.
- `src/routes/_app/-server/shell.ts` - append. The legal-state read (cross-wave: 02-S2 wave
  1, 08-S10 wave 3, 13-S6 wave 10 - all named; this append is the state flag only).
- `src/routes/_app/route.tsx` - append. The persistent pre-`effective_from` banner and the
  post-date gate mount (same cross-wave owners, named).
- `src/server/auth/index.ts` - append. `eraseAcceptanceIdentity` is called from the
  `beforeDelete` hook that `09-S3` (wave 1) adds with `user.deleteUser` - this stage appends
  the call, and cites `09-S3` as the flow's owner.
- `src/server/repos/__tests__/legal.test.ts` - new.

### Data and migration

Wave-0: `legal_acceptances` (unique `(subject_ref, version_id)` - sound after erasure because
`subject_ref` is computed at insert from a never-reused id), the `notifications` partial
unique index, the `LEGAL_SUBJECT_SALT` secret, and the retention config key
(`legal.acceptance-retention-days` in `app_settings`, default 6 years, enforced by the
existing weekly retention cron; the figure is counsel's - Area brief). Backfills nothing.

### Server (repo, server function, Zod)

- **Repository.** As listed. Publication of an `explicit`-policy version requires every
  shipped locale reviewed (13-S2's store enforces it); a `requires_reacceptance` version
  additionally requires a reviewed `change_summary` per locale - the one text a user will
  actually read, so it is never generated and never skipped. `acceptanceState` distinguishes
  `accept` (terms - an affirmative act, recorded with ip/user-agent/locale) from
  `acknowledge` (privacy notice - a record that it was shown; forcing a checkbox onto an
  information document masquerades as a consent that does not exist).
- **Server functions.** `acceptVersion` (POST), `loadAcceptScreen` (GET),
  `loadVersionHistory` (GET, public); counsel functions under `studio/-server/legal.ts`
  guarded by `legal:*` permissions.
- **Zod.** `version_id` as id schema; mode as the two-value enum; the accept input carries
  nothing else - identity comes from the session, never the client.
- **Authorisation.** Counsel actions assert `legal:review` / `legal:publish` /
  `legal:require-reacceptance` in the store; acceptance requires only an authenticated
  session. The graded gate never blocks sign-out, data export or account deletion - refusing
  consent routes to closure-with-export, because holding a user's data hostage behind a
  consent wall is a portability violation, not a stronger UX.

### UI (route, components)

- **Routes.** `/legal/$slug`, `/legal/accept` (both SSR), `/studio/legal`;
  `pnpm generate-routes`. Delivery is graded: on flagged publish, a notification row and an
  email (both keyed i18n + summary); until `effective_from`, a persistent shell banner with
  the diff summary and the accept affordance; after it, the decision screen on app entry.
  The notification is a courtesy, not the mechanism - the inbox is tenant-filtered, so a user
  active in another workspace would never see it; the shell state is tenant-independent and
  is the mechanism.
- **Components.** `LegalPage` finally receives its `updated`/`version` props as data; the
  history list, the accept screen and the counsel queue build on `ui` primitives; the
  `explicit` no-translation notice is a designed surface with a link to the source document,
  never substituted English body text.
- **States.** History empty state (never-published document), review queue empty state,
  skeletons and error states on all three screens; the accept button is a loading-state
  control; the banner reserves space (zero shift).
- **Tokens.** None missing.

### Quota

No tenant-countable row: acceptances are per-person legal records outside plan quotas, one
row per `(subject, version)` by uniqueness.

### Tenant isolation test

`legal.test.ts`: `legal_acceptances` carries no `organization_id` and is unreachable from any
tenant scope (type-level and runtime cases per 13-S2); a member of organization A and one of
B accepting the same version produce two rows distinguishable only by subject; the counsel
stores refuse `editor`/`publisher` roles. Plus the erasure invariant: after
`eraseAcceptanceIdentity`, `user_id`/`ip`/`user_agent` are null, `erased_at` is stamped,
and `version_id`/`accepted_at`/`mode`/`subject_ref` survive - in one batch.

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit: the acceptance state machine (no acceptance / accepted old / accepted current /
  version without the flag); publish-with-flag refuses without reviewed summaries; double
  fan-out leaves one row per recipient (index conflict forced); erasure batch atomicity.
- Browser evidence: register with the checkbox and find the row bound to the exact
  `version_id`; publish an unflagged version - no notification, no banner, history grows;
  publish a flagged version with future `effective_from` - notification + email (grouped per
  locale), banner up, app fully usable; accept on `/legal/accept` - banner gone; move
  `effective_from` into the past for a non-accepting account - decision screen appears while
  sign-out, export and deletion remain reachable; `/legal/privacy` in `pl` without a
  reviewed translation shows the `explicit` notice, not English body. 360px/2560px, light
  and dark.
- Console silent.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged. §2 clauses for the
document page, history, accept screen, banner and counsel view:

- [ ] Spacing on the 4px grid.
- [ ] Interactive states on accept, history links, review controls and the flag toggle
      (which is also a confirm - it is irreversible).
- [ ] History, review queue and coverage report have designed empty, skeleton and error
      states.
- [ ] Motion 150-260ms, reduced-motion honoured.
- [ ] Light/dark parity.
- [ ] Responsive 360px → 2560px; legal prose line length stays readable at both ends.
- [ ] Keyboard end to end; the decision screen is focus-trapped correctly and escapable to
      sign-out; AA contrast.
- [ ] Zero console errors/warnings, zero layout shift, `tabular-nums` on dates and versions.

### Blockers

- Depends on `09-S3` (wave 1) for the `user.deleteUser` flow whose `beforeDelete` hook this
  stage appends to; if 09-S3 has not landed, the erasure function still ships and the hook
  append moves with 09-S3's landing - stated, not discovered.
- The retention figure for minimised records is counsel's decision; the config default (6
  years) ships so nothing blocks, and the open item lives in the `docs/DEPLOY.md` data-
  deletion runbook (wave-0).
- No package, binding or service is missing.

## Stage 13-S8 - Blog, changelog and help: public collections with per-locale paths and SEO

### Stage id

`13-S8` · Wave 11 · effort **M**. Three `fallback`-policy collections with public routes on
per-locale paths, feeds and sitemaps, slug-change redirects served as 301s, and contextual
help surfaced inside the app from the same content.

### Reference rows

No gap row - outside the 89-row matrix (see Area brief).

### Owned paths

- `src/routes/blog/index.tsx` - new. `/blog` - the source-locale listing.
- `src/routes/blog/$locale.index.tsx` - new. `/blog/<locale>` listing (per-locale paths:
  one URL per language, the shape hreflang requires; the negotiated-locale landing pages
  record in 13-S5 why they stay un-prefixed for now).
- `src/routes/blog/$locale.$slug.tsx` - new. The post, with 301 handling through
  `content_redirects` when a slug has moved.
- `src/routes/help/index.tsx`, `src/routes/help/$locale.index.tsx`,
  `src/routes/help/$locale.$slug.tsx` - new. Same shape for help; the changelog is a blog
  category, not a fourth route family.
- `src/routes/blog/-server/blog.ts`, `src/routes/help/-server/help.ts` - new. Loader server
  functions over 13-S2's read path.
- `src/routes/sitemap[.]xml.ts` - new. Sitemap with hreflang alternates from the coverage
  matrix.
- `src/routes/feed[.]xml.ts` - new. RSS for blog/changelog.
- `public/robots.txt` - new. Names the sitemap; nothing at HEAD ships one.
- `src/components/marketing/article.tsx` - new. The article surface: rich-text render
  (13-S2's renderer), image figures with reserved dimensions, category badges - built on
  `Section`/`Card`/`SectionLabel`.
- `src/routes/_app/-ui/help-hint.tsx` - new. Contextual help entry point reading the help
  collection by key.
- `src/server/content/__tests__/seo-routes.test.ts` - new.

### Data and migration

Nothing new: three registry entries in `collections.ts` (a 13-S2-owned file; the registry is
designed for append) and wave-0 tables already in place. Stating that is the answer.

### Server (repo, server function, Zod)

- **Repository.** None added - reads flow through `resolve.ts`, redirects through the 13-S2
  store's lookup.
- **Server functions.** Listing and article loaders (GET), paged by the entries' time-sortable
  ids; 301s issued when the slug resolves only via `content_redirects`.
- **Zod.** Locale params validated against the 23-tag enum - an unknown locale is a 404, not
  a fallback; slugs by the shared slug schema.
- **Authorisation.** None: published data only.

### UI (route, components)

- **Routes.** As listed; SSR; `pnpm generate-routes`. Canonical URLs, `hreflang` alternates
  and per-locale `og:` tags generate from `seo.ts` (13-S5) plus the coverage matrix -
  a locale existing only as fallback is **not** announced as an alternate, because
  advertising a URL that serves English under a `pl` tag is worse for indexing than not
  advertising it.
- **Components.** `article.tsx` plus existing marketing chrome; images render
  `<figure><img width height loading="lazy" decoding="async">` from 13-S4's stored
  dimensions - zero layout shift by construction.
- **States.** Empty listing per locale ("Nothing here yet in this language" with the
  source-locale link), skeletons, error states; the article 404 is the product's designed
  not-found.
- **Tokens.** None missing.

### Quota

No tenant-countable row.

### Tenant isolation test

No new repository functions; the obligation is discharged by 13-S2's cases, cited here. The
stage adds instead the public-path case: an unpublished entry's slug 404s on every locale
path, and a tenant session grants no access an anonymous request lacks.

### Verification

- Command gate in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `seo-routes.test.ts`: sitemap lists only published entries; hreflang sets exclude
  fallback-only locales; feed validates; slug rename produces a 301 whose target serves 200;
  unknown locale 404s.
- Browser evidence: a published post on `/blog/pl/...` and its `en` sibling; the changelog
  category listing; a help hint opening in-app; the redirect following a rename. 360px and
  2560px, light and dark.
- Console silent on every public page.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged. §2 clauses for the
listing, article and help surfaces:

- [ ] Spacing on the 4px grid.
- [ ] Interactive states on cards, category filters, feed/history links and the help hint.
- [ ] Listings have designed empty (per-locale), skeleton and error states.
- [ ] Motion 150-260ms, reduced-motion honoured.
- [ ] Light/dark parity.
- [ ] Responsive 360px → 2560px; article measure stays readable at both ends.
- [ ] Keyboard end to end, AA contrast.
- [ ] Zero console errors/warnings, zero layout shift (image dimensions reserved),
      `tabular-nums` on dates.

### Blockers

None. Depends on 13-S2 (pipeline), 13-S4 (image dimensions), 13-S5 (`seo.ts`, chrome) - all
earlier waves. No package, binding or service is missing.

## Cross-plan collisions

Run at the time of writing and pasted verbatim, per the convention `10-administration.md`
records - a judgement re-made by hand each round is eventually made wrong. This plan's stages
occupy waves 7-11, above the existing set's 0-6, so no same-wave exclusive collision with an
earlier plan is possible by construction; the cross-plan shares listed are the deliberate,
named, cross-wave appends of the stages above. `node scripts/ultrabuild/check-plan-collisions.mjs 13`:

```
plans 14 · stages 99 · owned paths 629

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (7) — legal; each plan must name the other:
  src/server/queue/types.ts
      00-foundations.md  00-S4  wave 0  (edit)
      01-trips-core.md  01-S1  wave 1  (edit)
      07-collaboration-and-sharing.md  07-S8  wave 4  (edit)
      13-content-studio.md  13-S6  wave 10  (append)
  src/server/queue/consumer.ts
      00-foundations.md  00-S4  wave 0  (edit)
      01-trips-core.md  01-S1  wave 1  (edit)
      07-collaboration-and-sharing.md  07-S8  wave 4  (edit)
      13-content-studio.md  13-S6  wave 10  (append)
  src/server/repos/index.ts
      01-trips-core.md  01-S6  wave 4  (edit)
      06-documents-and-media.md  06-S3  wave 2  (append)
      06-documents-and-media.md  06-S5  wave 3  (append)
      07-collaboration-and-sharing.md  07-S10  wave 5  (edit)
      13-content-studio.md  13-S1  wave 7  (append)
      13-content-studio.md  13-S2  wave 8  (append)
      13-content-studio.md  13-S4  wave 9  (append)
      13-content-studio.md  13-S5  wave 9  (append)
      13-content-studio.md  13-S6  wave 10  (append)
      13-content-studio.md  13-S7  wave 11  (append)
  src/routes/_app/-server/shell.ts
      02-places-and-maps.md  02-S2  wave 1  (edit)
      08-product-modules.md  08-S10  wave 3  (edit)
      13-content-studio.md  13-S6  wave 10  (append)
      13-content-studio.md  13-S7  wave 11  (append)
  src/routes/_app/route.tsx
      02-places-and-maps.md  02-S2  wave 1  (edit)
      13-content-studio.md  13-S6  wave 10  (append)
      13-content-studio.md  13-S7  wave 11  (append)
  src/lib/auth/client.ts
      09-account-and-settings.md  09-S1  wave 1  (edit)
      13-content-studio.md  13-S1  wave 7  (append)
  src/server/auth/index.ts
      09-account-and-settings.md  09-S3  wave 1  (edit)
      10-administration.md  10-S1  wave 3  (edit)
      13-content-studio.md  13-S1  wave 7  (append)
      13-content-studio.md  13-S7  wave 11  (append)
```
