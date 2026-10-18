# One link that puts the people you send it to on your trip

| Field              | Value                                               |
| ------------------ | --------------------------------------------------- |
| **Status**         | ready                                               |
| **Issue**          | none                                                |
| **Spec PR**        | #984                                                |
| **Implementation** | none                                                |
| **Plan**           | 07-S10 (docs/plans/07-collaboration-and-sharing.md) |

## 📝 TLDR

Plan stage `07-S10` closes reference row `COL-11` (the trip invite link) **as narrowed below**. A trip owner mints
**one rotating link** for a trip, copies it as often as they like, sends it to the people who should be on the
trip, changes the role it grants, switches it off, and replaces it (the old one stops working on the next
request). Someone who opens `/join/<secret>` sees the invite, signs in and comes back to the same URL, and a
member of the trip's workspace is put on the trip. It is a different object from the workspace invitation
(`src/routes/(auth)/accept-invitation.$invitationId.tsx`): different table, different route, different token
space, and it never grants workspace membership.

The stage as the plan wrote it does not survive contact with the code, and this spec departs from it (each
departure is a Resolved assumptions row): the owner controls live on the **people screen**, not in a share dialog
nobody will build; the join cannot go "through `addTripMember`" because that function demands an owner and a
readable trip; the secret is **derived**, so the owner can copy it again (the plan's "shown once" contradicts its
own owner panel); the anonymous read is a **`src/server/public/**` projection**, not a route-local resolver; a link
grants **editor or viewer** (default viewer), never owner; the anonymous card shows **less** than the plan said;
and the plan's "registers, verifies and lands back" is **false for email registration** today, which Phase 1
repairs (it also repairs the workspace invitation).

It is cut into **four tickets**: **1** carry `?redirect=` through email registration (a standalone fix), **2** the
table, the repository, the shared secret and rate-limit modules, the `insertTripMember` extraction and the
contract amendments (infrastructure, no UI, nothing visible), **3** the visitor slice
(`/join/$token` with every state, the join, the sign-in round trip, the redaction; nothing in the product can mint a
link before Phase 4, so Phase 3 is exercised with a seeded token and is the second, stated, exception to the SLC
rule), **4** the owner's panel on the
people screen, the browser journey and the A/B pair (**the ticket that turns the feature on**). It describes the
work **left** at HEAD (`ee99d50d`).

**What this slice delivers, and what it does not.** The link adds people who are **already members of the trip's
workspace**. Every account is provisioned with its own personal workspace (`provisioning.ts:71`), so a friend who
merely has an account is not in this workspace and lands on a state that tells them to ask the inviter to add
them to the workspace first. That is a decision, not an oversight (Resolved assumptions 1 and 14): a trip link
that grants workspace membership takes a seat and is the one outcome the plan names as unacceptable. The plan's
"adds an existing account to the trip" is narrowed to "adds an existing member of the trip's workspace", the
anonymous card says so **before** anyone signs in, and the narrowed half is tracked as a follow-up for a person
to decide (Phasing, last row).

## 📝 Problem Statement

Measured at HEAD (`ee99d50d`):

- **No such object exists.** `grep -rn "trip_invite\|/join" src` returns nothing; `src/routes/` has no `join`
  directory; `CONTEXT.md` has no term for it. The only things called an invitation are the workspace invitation
  (Better Auth organization invitations: `accept-invitation.$invitationId.tsx`, `(auth)/-server/invitation.ts`)
  and the people screen's owner-only "add a workspace member" control (`-server/people.ts` `addTripMemberFn`).
- **An owner can only add a person they can pick from a list.** `readTripPeople`
  (`src/routes/_app/trips/$tripId/-server/people.ts`) returns `invitable`: the workspace roster minus the trip's
  members, and `[]` for a non-owner. There is no way to say "everyone in this group chat, join".
- **`addTripMember` cannot be reused by a joiner.** `src/server/repos/trips.ts:1815` runs
  `requireTrip(scope, tripId)`, then `assertTripRole(scope, tripId, ['owner'])`, then `getMembership(scope,
values.userId)`, and inserts with `invitedBy: scope.ctx.userId`. In a joiner's own context it fails twice: the
  joiner is not an owner, and on a `private` trip (ADR 0007) `requireTrip` raises `NotFoundError` for a non-member.
  The plan's line "never through an insert of this stage's own" (citing `trips.ts:434-441`, which is now
  `TripArchivedError` and `requireWritableTrip`) cannot hold.
- **Nothing 07-S6 was to supply exists, and nothing will write it.** There is no `src/server/fns/sharing.ts`, no
  `share-dialog.tsx`, no `src/routes/shared/`, no `hashShareToken`, no `src/server/public/` directory and no public
  rate limiter. `share_links.token` is stored in plaintext (`schema.ts:1762`). The stage-picker marks `07-S4` to
  `07-S9` covered because other specs name them in prose, so no spec for `07-S6` will be written by this
  pipeline. The ready calendar-feed spec (`2026-10-04-a-calendar-that-keeps-up-with-the-trip.md`, plan stage
  `06-S5`) plans its own `src/server/calendar/secret.ts` and `src/server/public/rate-limit.ts` and the
  unscoped-lookup shape (`unscoped-shape.test.ts`). None exists yet.
- **A registered visitor does not come back to the link.** `src/routes/(auth)/register.tsx:169-178` signs up with
  `callbackURL: '/verify-email'` and hands off to `/verify-email` for **email** registration; only the social path
  uses `target`. `verify-email.tsx` has no `redirect` search param and its pending-state continue link goes to
  `DEFAULT_REDIRECT` (`/dashboard`). Email verification is **not required** (`requireEmailVerification: false`,
  `auth/index.ts:252`) and Better Auth signs the user in on sign-up, so the pending screen's "Continue anyway" is
  the real exit. The workspace invitation's `/register?redirect=` link
  (`accept-invitation.$invitationId.tsx:188`) has the same defect today.
- **A joiner's active workspace is usually not the trip's.** `appScope()` (`src/server/fns/context.ts:26`) builds its scope
  from `requireOrg()` (`src/server/auth/session.ts:90`), which resolves `session.activeOrganizationId` while its membership survives, otherwise the oldest surviving membership; `requireOrg({ organizationId })` throws `not-a-member` on a mismatch instead
  of switching (`tenant.ts:171-178`). A user in several workspaces (`#939`, `workspace-switcher.tsx`) therefore
  cannot be joined with `appScope()`, and after joining must switch workspace
  (`authClient.organization.setActive`) before the trip exists for them.
- **Access rules for session-less reads are written down and this is a new surface.** `docs/ACCESS.md` §3 ("Three
  surfaces are reachable without a session") lists `/share/$token` and `/packs`; §3.5 (noindex), §3.6 (identical
  404, three rate budgets) and §3.7 (`src/server/public/**` is the only session-less read path, holds no SQL,
  constructs no tenant scope) name only those. `SPEC.md` §5 calls its list of unscoped exceptions **closed** ("a
  third one is a change to this contract"). `/join/$token` is a fourth surface and its lookup a new exception.
- **Secrets in paths are not redacted.** `src/lib/sentry-scrub.ts` strips query strings but deliberately keeps the
  path, and `referer` is not in `FORBIDDEN_HEADERS`. A secret in `/join/<secret>` reaches Sentry today.
- Trip-member isolation, the unique `trip_members_trip_user_unq` index, `TripMemberExistsError`,
  `TRIP_MEMBER_ROLES = ['owner','editor','viewer']` (`schema.ts:265`) and the tenant audit trail
  (`src/server/audit/trail.ts`) all exist and are reused. **There is no live people list to piggyback on:** the
  people screen opens no socket (`useTripRoom` is mounted only by `PresenceBar`, on the collab screen, behind `live`),
  and `addTripMemberFn` mirrors nothing, so a join is shown on the next load, like every other membership write.

Missing, from the traveller's side: _I made a trip with six friends who are all in our workspace. I do not want to
find each of them in a list; I want to paste one link into the chat._ And from the invitee's side: _I tapped a
link, I have an account, now what?_

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Not owned (read only, or left alone)                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/server/db/schema.ts` - edit: table `trip_invite_links`; `drizzle/` - one generated migration (`pnpm db:generate`, never hand-edited); `src/server/db/types.ts` - edit                                                                                                                                                                                                                                                                                                                                                                  | `share_links` and the share-link functions in `trips.ts` (07-S6's)                                 |
| `src/server/repos/invites.ts` - new: the record, its owner-side writers, the unscoped resolver, the preview projection and `joinTripByInviteUnscoped`; `src/server/repos/index.ts` - one export line                                                                                                                                                                                                                                                                                                                                        | `src/server/repos/members.ts` (`addMember`, workspace seats), `assertTripRole`, `removeTripMember` |
| `src/server/repos/trips.ts` - edit: extract and **export** `insertTripMember` (Phase 2, no behaviour change)                                                                                                                                                                                                                                                                                                                                                                                                                                | `src/routes/(auth)/accept-invitation.$invitationId.tsx`, `(auth)/-server/invitation.ts`            |
| `src/server/security/secret.ts` (pure leaf: derive, digest, shape guard - a neutral directory, so that `repos` never imports the session-less `public/**`), `src/server/public/rate-limit.ts` (budgets are parameters), `public/trip-invite.ts` (the anonymous projection) - new                                                                                                                                                                                                                                                            | `src/server/calendar/**` (06-S5's; re-pointed only if it exists, see Architecture)                 |
| `src/routes/join/$token.tsx`, `join/-server/join.ts`, `join/-ui/join-card.tsx` - new (**`pnpm generate-routes`**, the regenerated `routeTree.gen.ts` travels in the diff)                                                                                                                                                                                                                                                                                                                                                                   | `src/routeTree.gen.ts` (generated, never hand-edited)                                              |
| `src/components/marketing/chrome.tsx` - edit: `MarketingHeader` gains a `minimal` prop (logo only, no sign-in / start-free / pricing); the guest shell sets `scroll-padding-top` for the sticky header                                                                                                                                                                                                                                                                                                                                      | `src/components/ui/**` (no primitive and no token is added), `package.json`, `pnpm-lock.yaml`      |
| `src/routes/_app/trips/$tripId/-server/invite.ts`, `-ui/invite-link-panel.tsx` - new; `-server/people.ts` - edit (`TripPeoplePayload.invite`); `-ui/people-screen.tsx` - edit: one mount point and the local `ConfirmDialog` exported (it gains an optional `pendingLabel` prop for its loading label and an optional `confirmVariant` prop, `'danger'` by default and `'primary'` for the editor upgrade, whose confirm button is not destructive); `readTripPeople` gains the derivation key as a third parameter (see the owner's panel) | `src/server/do/**` (no new entity kind and no patch: the people screen opens no socket)            |
| `src/routes/(auth)/register.tsx`, `verify-email.tsx` - edit (Phase 1); `login.tsx`, `register.tsx` and `verify-email.tsx` gain a `head` entry `<meta name="referrer" content="strict-origin">` (Phase 3; there is no `(auth)` layout route and no per-route `headers` today, and a new layout would change the route tree)                                                                                                                                                                                                                  | `src/server/billing/**` (no metric; see Quota)                                                     |
| `src/lib/sentry-scrub.ts` - edit: secret redaction (Phase 3); `src/client.tsx` and `src/server/observability/sentry.ts` - edit: today only `beforeSend: scrubEvent` is wired in each, and the breadcrumb, transaction and span redaction below needs `beforeBreadcrumb` / `beforeSendTransaction` / `beforeSendSpan` hooks there; `src/lib/sentry-replay.ts` - edit: the replay network and navigation URL filters; `src/server/fns/context.ts` - edit: `scopeFor(context)` (see the join); `src/lib/__tests__/sentry-scrub.test.ts`        | `e2e/places-and-maps.spec.ts`, `e2e/trips-core.spec.ts`, `e2e/journeys.spec.ts`                    |
| `src/server/audit/trail.ts` - edit: three action names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | The plan file (the `Delivered:` line is added by whoever closes the last ticket)                   |
| `src/lib/i18n/messages/<locale>/trips.ts` - edit, **all 23 locales**                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `src/lib/i18n/messages/<locale>/auth.ts` (no new key; see Phase 1)                                 |
| `docs/ACCESS.md` §3, §3.5, §3.6, §3.7, new §3.8, §6.4; `docs/SPEC.md` §5 and §6; `docs/DEPLOY.md` (rotation note); `CONTEXT.md` (two terms); a new ADR (next free number, 0037 or later) for the unscoped exception                                                                                                                                                                                                                                                                                                                         |                                                                                                    |
| Tests: `src/server/repos/__tests__/invites.test.ts`, `tenant-isolation.test.ts` (append), `unscoped-shape.test.ts` (extend), `src/server/public/__tests__/`, `src/server/security/__tests__/`, `-server/__tests__/invite.test.ts`, `join/-server/__tests__/join.test.ts`, component tests, `e2e/collaboration-and-sharing.spec.ts` (append the `describe`, or create the file)                                                                                                                                                              |                                                                                                    |

The plan's `e2e/collaboration-and-sharing.visual.spec.ts` and `e2e/__screenshots__/...` are **struck**: ADR 0016
removed screenshot baselines; the visual judgement is the blind A/B pair (`scripts/visual/capture.mjs`).

### The object, and its vocabulary

A **trip invite link** (UI: "invite link") is the single secret URL a trip owner can hand out to put workspace
members on the trip. A **workspace invitation** is the Better Auth email invitation that makes someone a workspace
member. `CONTEXT.md` records both; the entry for the trip invite link says "Avoid: invitation" (that noun is the
workspace invitation), and **all copy in this spec says "invite link"** for the trip object and reserves
"workspace invitation" for the other. "Share link" (read-only, session-less, one named projection) is a third
thing and stays as it is.

### Data: `trip_invite_links` (Phase 2)

One table, one migration, additive. Columns:

- `id` from `pk()`; `organization_id` from `orgRef()` (cascade); `trip_id` not null referencing `trips`, cascade
  delete.
- `token` text not null: the **SHA-256 hex digest** of the secret, never the secret.
- `rotation` integer not null default 0: the counter the secret is derived from (Secret, below).
- `role` text not null default `'viewer'`: the trip role a joiner receives. **No `CHECK`** (a later change to a
  `CHECK` is a table rebuild, `00-foundations.md`); the narrowed Zod enum `z.enum(['editor','viewer'])` guards every
  write and the join re-parses the stored value.
- `created_by` `userRef('created_by')` not null: the owner who last **created, replaced or switched on** the link.
- `disabled_at` nullable epoch ms; `last_used_at` nullable epoch ms; `use_count` integer not null default 0 with
  `nonNegativeCheck`; the standard `timestamps()`.
- Indexes: unique on `token`; unique on `trip_id` (one rotating link per trip, enforced by the database); and
  `(organization_id, trip_id)` as the tenant-convention composite.

A new table, not a scope on `share_links`: a public read token and a membership grant differ in lifecycle,
authorisation, cost of a leak and meaning of revocation, and one query between the two is where the first mistake
becomes a stranger on a trip.

### The secret (Phase 2)

The owner must be able to copy the same link again (a link is sent to friends over several days; "replace to
re-copy" would make replacing a daily habit and kill the link the second friend has not used yet). The secret is
therefore **derived, not stored**:

- `subkey = HKDF-SHA256(key, salt = empty, info = purpose)` through `crypto.subtle`. `key` is an **argument**:
  `src/server/security/secret.ts` is a pure, SQL-free, binding-free leaf and never reads `BETTER_AUTH_SECRET` itself
  (the auth env module imports `cloudflare:workers`, which the plain-Node `server` test project forbids). The
  server functions pass the secret read by `src/server/auth/env.ts`; tests pass a literal.
- `info` comes from a **closed list of purposes** (`'trip-invite-link/v1'` today), so the calendar feed or any later
  token kind can never share a subkey with an invite.
- `secret = base64url(HMAC-SHA256(subkey, linkId + ":" + rotation))`, the full 32 bytes (43 characters).
- Stored `token = hex(SHA-256(secret))`; the shape guard (`/^[A-Za-z0-9_-]{43}$/`) rejects anything else before any
  query.
- **A new `rotation` always accompanies a new digest.** Replace, switch-on and any takeover bump it.
- The module exports **generic** names (`deriveSecret(purpose, key, id, rotation)`, `hashSecret`,
  `isSecretShape(kind, value)`), because the calendar stage mints a 32-character `nanoid` secret and the shapes
  differ.
- **Coupling to `BETTER_AUTH_SECRET` is a conscious choice.** The repo has a precedent for a dedicated pepper
  (`MCP_TOKEN_PEPPER`, `DEPLOY.md` §14.3); a dedicated binding would be a deployment change and one more secret to
  rotate. The cost of coupling is that **rotating `BETTER_AUTH_SECRET` invalidates every invite link and fails
  closed** (the derived secret no longer hashes to the stored digest). `docs/DEPLOY.md` says so beside the existing
  rotation warning, and the owner's panel treats "derived digest differs from stored digest" as the **stale** state.
- **Leak model.** A D1 dump alone yields SHA-256 digests of 256-bit values - no usable link. D1 plus
  `BETTER_AUTH_SECRET` yields every live link, but that pair already forges sessions, so nothing new is exposed.
  The secret also appears, by design, in the URL the owner sends, in `/login`, `/register` and `/verify-email`
  `?redirect=` queries while a visitor signs in, and in Cloudflare's own request logs (which the app cannot redact).
  **The bound:** only an existing member of the trip's workspace can use a leaked link, and only until an owner
  replaces it. The redaction work (Phase 3) covers everything the app controls.
- Only a trip **owner** may read the secret: `revealTripInviteSecret(scope, tripId)` behind `requireTrip` and
  `assertTripRole(['owner'])`. `readTripInvite` and every other read return **no secret field** (a test pins it).
  The server function that returns the URL answers `Cache-Control: private, no-store`.
- **Tests** run on Node's WebCrypto (HKDF is available there); that workerd's `crypto.subtle` supports HKDF is
  relied on and checked once in a `pnpm dev` run in Phase 2 (a one-line note in the PR).

### Repository: `src/server/repos/invites.ts` (Phase 2, extended in Phases 3 and 4)

Built on `createTenantRepository`; exports:

- `readTripInvite(scope, tripId, key)` - the row's non-secret fields plus the derived panel state, or `null`.
  `requireTrip` first. It takes the derivation `key` because the `stale` state is "the derived digest differs from
  the stored one"; `-server/people.ts` passes the secret read by `src/server/auth/env.ts`. The secret itself is
  never returned.
- `revealTripInviteSecret(scope, tripId, key)` - owner only (above).
- `createTripInvite(scope, tripId, { role, key })` - owner only, `requireWritableTrip`; **insert-if-absent**: the id
  is generated in application code, the secret and digest computed, and the row inserted; a unique violation on
  `trip_id` (a double tap, a second owner) returns the existing row **unchanged**. Create never bumps a rotation.
- `replaceTripInvite(scope, tripId, { role, expectedRotation, key })` - owner only; **compare-and-set**: read the
  row, compute rotation + 1 and the new digest, then `UPDATE ... WHERE id = ? AND rotation = :expectedRotation`
  (D1 has no interactive transactions). Zero rows means someone else changed it: the call returns
  `{ ok: false, reason: 'changed' }` with the current state and no write. It sets `created_by` to the actor and
  clears `disabled_at`. The previous secret stops resolving on the next request with no grace period.
- `updateTripInvite(scope, tripId, { role?, enabled?, expectedRotation })` - owner only. Role change and switch-off
  touch **neither** `created_by` nor `rotation`. Switch-on is a replace (new rotation, new digest, `created_by` =
  the actor), so a switched-off link cannot revive copies already sent.
- **Takeover rule.** Any write that changes `created_by` to a different user bumps `rotation` and the digest in the
  same compare-and-set `UPDATE`. A link whose creator is gone therefore never returns with its old secret.
- `touchTripInvite(scope, inviteId)` - increments `use_count`, sets `last_used_at`; called only by a successful
  join, never by a read.
- `findLiveTripInviteByDigestUnscoped(db, digest)` - **the one unscoped function**, named with the `Unscoped`
  suffix and following the shape the calendar spec fixes (`unscoped-shape.test.ts`: a plain `Database`, a narrow
  projection). It takes the **digest**, so hashing stays in `security/secret.ts`. Its only importer outside this
  module is `public/trip-invite.ts`, the single named caller the shape test registers. It returns
  `{ id, organizationId, tripId, role, createdBy }` or `null` for: unknown digest, disabled row, role outside the
  narrowed enum, archived trip, a creator who is no longer an **owner** of the trip, a creator who is no longer a
  **member of the link's workspace**, and a banned creator - **all in one statement**, with `trips` and
  `trip_members` matched on the invite row's own `organization_id` (not only `trip_id`, because that foreign key is
  not composite). A dead link of any kind is the same `null`.
- `readInvitePreviewUnscoped(db, digest, viewer: { id, banned } | null)` - builds the read scope **inside `src/server/repos`**
  (`createScope(db, { organizationId, userId: createdBy, role: 'member' })`) and returns the discriminated
  projection (below). The viewer's workspace membership is read through the passed `db` from the `member` table,
  as `members.ts` does; repos call neither `authDb()` nor `membershipRoleFor`. `src/server/public/**` never
  constructs a scope (ACCESS §3.7 rule 2).
- `joinTripByInviteUnscoped(db, digest, viewer: { id, banned, impersonated })` - below. `join/-server/join.ts` fills
  `viewer` from the session (`impersonated` is true when `session.impersonatedBy` is set; it is not on `AuthUser`).
  `join.ts` is the **named caller** of `joinTripByInviteUnscoped`, and `join.ts` and `public/trip-invite.ts` (the anonymous call, `viewer = null`) are the named callers of `readInvitePreviewUnscoped`, in the `unscoped-shape.test.ts` map, beside `public/trip-invite.ts` for the finder.

### Liveness: when a link is honoured

A link is **live** only while all of these hold, evaluated at render **and again at submit**:

1. its digest matches and `disabled_at` is null;
2. its `created_by` is still an **owner** of the trip, still a **member of the link's workspace** and not banned;
3. its trip is not archived (a new membership is a write; `requireWritableTrip` refuses writes to an archived
   trip). Archiving does **not** rotate: restoring the trip brings the same link back, and the panel says so;
4. its stored `role` passes the narrowed enum.

A failure of any of these is the same `null`, the same 404, the same "unavailable" card with no reason shown. The
**owner's** panel is the one place that says why.

### The anonymous read: `src/server/public/trip-invite.ts` (Phase 3)

`docs/ACCESS.md` §3.7 and `docs/SPEC.md` §6 make `src/server/public/**` the only session-less read path, with
column-whitelisted projections, no SQL and no fabricated scope. It is also **sessionless**, so it yields only the
**anonymous** projection and the dead-link answer, which it gets by calling the repository (`findLiveTripInviteByDigestUnscoped`, then `readInvitePreviewUnscoped(db, digest, null)`; it holds no SQL itself). The loader's server function (`join/-server/join.ts`) adds the
viewer from the session and calls the repo-level `readInvitePreviewUnscoped` with the user id to get the signed-in variants.

**Order** (a per-link budget needs the link id, which exists only after the lookup): per-IP check -> shape guard ->
hash -> `findLiveTripInviteByDigestUnscoped` -> per-link check -> projection. **`loadInvite` always calls
`resolveTripInvite` first**, for an anonymous and a signed-in visitor alike (budgets, shape guard, hash, miss count),
so a dead link is the same 404 and counts against the miss budget either way. A signed-in viewer then adds exactly
one more `readInvitePreviewUnscoped` call (with the viewer's `{ id, banned }`; a banned viewer gets `unavailable`), and the
per-link budget is applied once.

| Visitor                                             | Projection                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                                           | `{ state: 'invited', tripTitle, inviterName, inviterImage, role }` - **nothing else**                                                       |
| Signed in, member of the link's workspace           | `{ state: 'invited', ...above, startDate, endDate, destination }` or `{ state: 'member', tripId, organizationId }` when already on the trip |
| Signed in, **not** a member of the link's workspace | `{ state: 'needs-workspace', tripTitle, inviterName }` (the page also shows the viewer's own signed-in email)                               |
| Anything else (all dead links, banned viewer)       | `{ state: 'unavailable' }`, HTTP **404**, one identical body                                                                                |

**Never visible, anywhere on this surface:** the workspace's name, slug, id or logo; the inviter's email or user id;
`use_count`, `created_by`, the digest, the secret; the trip's id and organization id (except in `member`, and in a
successful join's answer, to a verified workspace member); dates, destination and cover before sign-in as a
workspace member. The lists are written into `docs/ACCESS.md` §3.8 (new) with the code, which also states that
`src/server/public/**` stays read-only and that the **only write** is `joinTripFn`, behind `requireUser`.
§3 intro's "Three surfaces" becomes "Four".

Why the anonymous card is reduced: ADR 0007 keeps a private trip invisible to non-members, and a forwarded URL
reaches people the owner never picked. Name plus dates plus destination plus a real name is the most sensitive
combination on the page, and it is shown only to someone already in the workspace.

**Route behaviour.** `/join/$token` is a top-level route outside `_app` (no auth guard runs; an anonymous visitor
is never bounced), default SSR. The loader reads the route param in-process on the server; any client-side
re-fetch is a **POST** server function (a GET server function would put the secret in a query string that
Cloudflare logs and Sentry breadcrumbs record), and every response, found or not, carries
`Cache-Control: private, no-store`. `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` come from the route's
`headers` option (the shape `__root.tsx:100` already uses), the same for a found and a dead link, so they need no
loader data; the route's `head` carries `robots: noindex, nofollow`. The POST server function sets its own
`Cache-Control: private, no-store` with `setResponseHeader`. **A dead link throws `notFound()`** from the loader and
the route's `notFoundComponent` renders the one body; the document status comes from router state (no route loader in
the repo calls `setResponseStatus`, so the spec does not rely on it), and a Phase 3 test asserts the status and the
headers of the document response, not only the e2e. The document `<title>` and meta description are **generic** (no
trip title, no inviter name) and there are **no trip-specific Open Graph or Twitter tags**: `__root.tsx:122-137`
already emits site-level, generic `og:*` / `twitter:*` tags and a canonical link on every route, which name no trip
and stay; the route overrides the title and description pairs with its own generic copy. A chat unfurler therefore
shows the product, never the trip. `robots.txt` does not disallow `/join/` (ACCESS §3.5: a disallowed path is never fetched,
so the directive would never be read). A GET **never writes**: no `use_count`, no `last_used_at`.

**Redaction (Phase 3).** `src/lib/sentry-scrub.ts` redacts `/join/<secret>` in `request.url`,
the `referer` header (added to `FORBIDDEN_HEADERS`), navigation / fetch / xhr breadcrumbs, and transaction and span
names (the template `/join/$token` is used), and the URL-encoded secret inside `redirect=` and `callbackURL=`
values; `src/client.tsx` and `src/server/observability/sentry.ts` wire it into the breadcrumb, transaction and span
hooks, and `src/lib/sentry-replay.ts` into the replay integration's `beforeAddRecordingEvent` (and its network URL options), so no replay event carries the path. The server logger is not changed: `join.ts` logs the
link id and the outcome, never the path or the secret (a test pins it). The three sign-in pages send
`<meta name="referrer" content="strict-origin">` so same-origin requests from them do not carry the query string.
A test pins each redaction in `src/lib/__tests__/sentry-scrub.test.ts`.

**Amendment (#1021).** The Phase 3 ticket found two premises out of date. `beforeSend`, `beforeSendTransaction`,
`beforeSendSpan` and `beforeSendLog` were already wired in both setups (`scrubTelemetry` redacted the calendar
feed path); only `beforeBreadcrumb` and the replay hooks were missing. And `beforeAddRecordingEvent` sees only the
SDK's custom events: the DOM recorder's Meta `href` and link attributes cannot be redacted, so the replay
residual is closed by `/join/$token` (#1022) not being recorded, on the join path and on the sign-in pages that
carry a join `redirect`, rather than by the scrub. The route parameter the TanStack Router integration copies
into span attributes (`url.path.params.token`) is redacted by key.
The placeholder is one fixed `/join/[redacted]` (and `%2Fjoin%2F[redacted]`) on every channel, transaction and span names included, rather than the route template: Sentry groups them the same way and the secret never survives in any shape. Feedback and `replay_event` events bypass every `beforeSend*` hook, so the browser entry routes them through the scrub with a client event processor.
`/two-factor` also receives the `redirect` (login hands over to it after a password sign-in), so it carries the `strict-origin` referrer meta with the other three sign-in pages.

**i18n of the surface.** `/join` needs no new locale work: the root loader already negotiates it (`__root.tsx:86`) server-side, before
first paint, from `Accept-Language` for an anonymous visitor and the stored preference for a signed-in one, with
`<html lang dir>` set. The `ar` card is designed in RTL (only the URL element is forced `dir="ltr"`).

### Rate limiting (Phase 2, used in Phases 3 and 4)

`src/server/public/rate-limit.ts` is written to the `RateCounterStore` shape of `src/server/metering/rate.ts` and
the key scheme of ACCESS §3.6 (`public:rl:<v>:...`). **Budgets are parameters**, not constants, because the calendar
spec exempts a live feed from the per-IP 120/min and this stage applies it.

| Budget                                    | Limit          | Key                                                            |
| ----------------------------------------- | -------------- | -------------------------------------------------------------- |
| per IP, all public routes                 | 120 per minute | `ip:<ip>` (IP from `cf-connecting-ip` only, as `trail.ts`)     |
| per IP, **failed resolutions** ("misses") | 20 per minute  | `miss:<ip>`                                                    |
| per resolved link                         | 60 per minute  | `tok:<digest>` (the digest is not the secret; the §3.6 scheme) |
| the authenticated join submit, per user   | 10 per minute  | `join:u:<userId>`                                              |
| the authenticated join submit, per IP     | 30 per minute  | `join:ip:<ip>`                                                 |

Over budget is `429` with `Retry-After`. **Every dead link counts against the miss budget**, whatever killed it.
KV unavailable **fails open**; token resolution **never** does. Cost, stated: every `/join` request makes one to
three KV writes. ACCESS §3.6's table gains these rows.

### The join (Phase 3)

**Why not `addTripMember`.** It is the owner's verb: `requireTrip` (readability), the owner assert, and the target
must be a workspace member. A joiner satisfies none of the first two. So the stage adds **one writer next to the
shared insert** and **extracts the part that must not exist twice**:

- **Phase 2 (no behaviour change):** extract the `tripMembersRepository.insert(...)` plus the
  unique-violation-to-`TripMemberExistsError` translation out of `addTripMember` into one **exported**
  `insertTripMember(scope, values)` in `trips.ts`; `addTripMember` keeps its three guards and calls it. The existing
  `addTripMember` tests run unchanged and must stay green.
- **Phase 3:** `joinTripByInviteUnscoped(db, digest, viewer)` lives in **`invites.ts`** (so `invites.ts` imports `trips.ts`,
  never the reverse; no cycle), takes the **digest** (nothing from the render is trusted) and calls
  `findLiveTripInviteByDigestUnscoped` in-module. Its order is fixed:
  1. the joiner is not banned (`viewer.banned`) and the session is not impersonated (`viewer.impersonated`): either is
     `{ outcome: 'unavailable' }` and nothing is written;
  2. re-resolve the link by digest (Liveness applies again) - a rotated, switched-off or orphaned link is
     `{ outcome: 'unavailable' }`;
  3. the joiner's role in the **link's** workspace is read from the `member` table through `db` for
     `invite.organizationId`, narrowed with `isOrganizationRole`; none is `{ outcome: 'needs-workspace' }`, no
     write. **The session's `activeOrganizationId` and any request-supplied id are never used;**
  4. build the scope `createScope(db, { organizationId: invite.organizationId, userId: user.id, role })`;
  5. read the trip by `invite.tripId` under the tenant filter (**not** the readability predicate: a joiner cannot
     read a private trip yet); not archived;
  6. `insertTripMember(scope, { tripId, userId: user.id, role: invite.role, joinedAt: now })` with
     `invitedBy = invite.createdBy`; a unique violation is `{ outcome: 'member' }`;
  7. `touchTripInvite` - only on `joined`, never on `member`.
- **The role is the row's, never the request's.** The request carries the secret and nothing else; the stored role is
  re-parsed against the narrowed enum, so a hand-edited row can never grant `owner`.
- **The race.** Between step 2 and step 6 a rotation can land (milliseconds). The membership written is the one the
  link's holder legitimately held a moment earlier and it escalates nothing; the window is accepted and stated.
- **Impersonation.** `/join` sits outside `_app`, so the impersonation warning bar (ACCESS §6.1) never renders there,
  yet a join is a lasting access grant. An impersonated session (`session.impersonatedBy`) is therefore **refused**
  (`unavailable`), and ACCESS §6.4 is amended to name it.
- `joinTripFn({ secret })` in `join/-server/join.ts` (POST): session required (`requireUser`), rate limited, hashes the
  secret with `hashSecret` and calls the repository, which returns the `TenantContext` (`{ organizationId, userId, role }`) it
  already built beside the outcome; the function turns it into a scope with `scopeFor(context)` (a new export of
  `src/server/fns/context.ts`, beside `appScope`; routes do not call `createScope` themselves, and the repository cannot
  call `trail`, which imports `repos`) and writes `trail(scope, ...)`. It does **not** mirror to the room (see Problem
  Statement). It returns
  `{ outcome: 'joined' | 'member', tripId, organizationId }` **only** after the workspace-membership check, and
  `{ outcome: 'needs-workspace' }` or `{ outcome: 'unavailable' }` with no ids.
- **Audit.** `trail.ts` gains `trip_invite.rotated` (create, replace, switch-on), `trip_invite.updated` (role,
  switch-off) and `trip.member_joined` (joiner, link id, role; **never the secret or the digest**). These are
  tenant **security records**, not owner-facing feedback.
- **Bans** are enforced at session creation; immediate effect may lag up to 60 s (`session.ts:60-69`). The explicit
  `banned` check above is the second guard. **Email verification is not required** and adds no protection here,
  because the joiner must already be a workspace member.

**Amendment (#1023).** The join landed with three differences from the text above, none of which
changes what a visitor or an attacker can do. The named caller of `joinTripByInviteUnscoped` is
`src/routes/join/-lib/join.ts` (the handler that takes its bindings as arguments, as `-lib/view.ts`
does), and `-server/join.ts` is the wiring around it; the audit write takes the joiner's
`TenantContext` from the repository result and turns it into a scope with `scopeFor(context)`. The
answer gains `switchWorkspace`, computed on the server from the session's active workspace, so the
card needs no extra read to choose between "Open the trip" and "Open the trip and switch
workspace", and a fourth outcome `busy` for the per-user and per-address budgets. A submit that
comes back `needs-workspace` reloads the page (`router.invalidate`), so the card that replaces the
invited one is the loader's own, with the same focus move to its heading; one that comes back
`unavailable` shows the unavailable card in place with that focus move, because the loader cannot
see an impersonated session and a reload would hand the invited card back. A session that ended while the card was open is a fifth answer, `signed-out`, not a
thrown `requireUser` 401: the card redirects to sign-in and back, as the workspace switch already
does. `busy` is a 200 answer
of the server function, not a 429 (only the document carries a status), and the join counts its
misses against the per-user and per-address submit budgets, not the page's miss budget.

### The sign-in round trip (Phases 1 and 3)

- The anonymous card has **one** action: **Sign in** (`loginHrefFor('/join/<secret>')`, the `?redirect=` contract
  of `(auth)/-lib/redirect.ts`), and a line saying the link works for people already in the inviter's workspace.
  There is no "Create an account" button: a workspace member already has an account, and registering from this card
  could only end in the `needs-workspace` state. The secret is never put in a cookie or local storage.
- **Phase 1 repairs the registration leg for every `?redirect=` link.** `register.tsx` passes `target` into the
  in-app hand-off for the email path (`handOff('/verify-email?redirect=<target>')`); `callbackURL` **stays**
  `/verify-email` (Better Auth appends `?error=<code>` to it by string concatenation, so a query in `callbackURL`
  would corrupt the failure redirect, and would also put a secret into the emailed link). `verify-email.tsx` gains
  `redirect` in its `searchSchema`; the pending screen's "Continue anyway" link uses `safeRedirect(search.redirect)` as an `<a href>`, not a typed
  `<Link to>` (the target is a dynamic path with a query string and would fail the route typing).
  The verified-by-email panel is reached from the email link, cannot carry `redirect`, and keeps `/dashboard`.
  Verification is not required, so "returns to the target after registration" is the honest wording.
- Signed in, the card is the same URL rendered again with the session: `invited` with the full preview, `member`, or
  `needs-workspace`. "Join this trip" calls `joinTripFn`.
- **After a join (or `member`) the client switches workspace and then navigates**, on the explicit "Open the trip"
  action, which names the target: `authClient.organization.setActive({ organizationId })` (the call
  `useWorkspaceSwitch` makes) with `router.clearCache()`, then `router.navigate({ to: '/trips/$tripId', params:
{ tripId } })`. If the joiner is already in the trip's workspace, no switch is made. A failed switch shows a
  message and keeps the button.
- **What a rotation does to an open tab.** `/join/<secret>` is a rendered page with no socket. The secret is
  re-resolved when the join is submitted, so a link replaced or switched off while someone was reading fails that
  submission and the card swaps to **unavailable** in place - no membership is written. Nothing already granted is
  taken back: a person who joined before the replacement stays on the trip.

### The workspace boundary (decision, not accident)

A joiner who is not a member of the link's workspace is **not** added to the trip. The `needs-workspace` state is
shown **only for a live link** (dead links stay `unavailable`), shows no workspace name, slug, id, member count or
inviter email, creates no workspace invitation and no request-to-join, notifies nobody and uses no seat. Its copy
tells the person to ask the inviter to add them to the workspace first (and, if they already hold a workspace
invitation email, to accept it and open this link again), shows the email they are signed in with so they can tell
the inviter which address to use, and offers **Sign in with another account** (a friend may be in the workspace
under a work address; it **signs the current session out first**, then navigates to
`loginHrefFor('/join/<secret>')`, because `login.tsx` redirects an already signed-in visitor straight back) and a way
to their own trips. The plan's pointer to `accept-invitation.$invitationId` is
dropped: that route needs an invitation id this card does not have. Whether a trip link may ever lead into the
workspace, and on what seat terms, is a product call, tracked as a follow-up (Phasing, last row).

### The owner's panel: `invite-link-panel.tsx` on the people screen (Phase 4)

Owner-only, mounted by `people-screen.tsx` (one mount point; the file is 1305 lines and does not grow by a feature).
A non-owner - including a workspace admin who is not on the trip - sees nothing, not a disabled control. The loader
payload `TripPeoplePayload` gains `invite: InvitePanel | null` (`null` for a non-owner; an additive field of a
payload type, checked against `BACKWARD_COMPATIBILITY.md`), carrying the non-secret fields plus the derived
**state**. Deriving `stale` needs the derivation key, and the `node` test project cannot import the auth env module, so
`readTripPeople(scope, tripId, inviteKey)` gains the key as a **third parameter**, read and passed by its server
function (the existing `people.test.ts` call sites gain a literal):

- `none` - never minted: an `EmptyState` on `--color-surface-2`, primary action "Create link", and the existing
  `people.invite.emptyHint` pointer for friends who are not in the workspace yet.
- `active` - the URL (revealed by `revealInviteLinkFn`), shown in a read-only `Input`, a **Copy** button, the role as
  a `SimpleSelect` (editor, viewer - never owner), a `SwitchField` "Anyone in this workspace with the link can join",
  "Replace link" behind a `ConfirmDialog` (says plainly that everyone holding the old link loses it immediately, and
  that people who already joined stay on the trip), and the number who joined with the last-joined time (or the
  never-used line).
- `off` - the switch is off; the URL is hidden; switching on issues a **new** secret.
- `stale` - "This link no longer works. Replace it." (the secret no longer matches its digest).
- `creator-gone` - the owner-facing sentence, with **Replace link only** (the role select and the switch are not
  shown: a link whose creator left must be replaced, not tweaked back to life).
- `archived` - the trip is archived: no create or replace; the panel says the link stops working while the trip is
  archived and resumes when it is restored (archiving does not rotate it).

Server functions in `-server/invite.ts`: `revealInviteLinkFn` (**POST**, so the URL is never in a GET query),
`createInviteLinkFn`, `replaceInviteLinkFn` (carries `expectedRotation`), `updateInviteLinkFn` (role / enabled,
carries `expectedRotation`). Zod v4 `z.strictObject`, the `error` parameter naming the field, the role as
`z.enum(['editor','viewer'])`. The guards (`assertTripRole` owner, `requireWritableTrip`) live **in the repository**.
`TripArchivedError` and `TripRoleError` are caught in `invite.ts` and returned as `reason` codes
(`archived`, `notOwner`, `changed`) that map to `invite.refusal.*`; the authored-English error messages never reach
a locale. **Pending behaviour:** the role select and the switch ignore input while a request is in flight
(`aria-disabled`, not `disabled`, so focus stays); Create, Join and Replace's confirm use the `Button` `loading`
state (which sets the native `disabled`), and focus is placed explicitly when the request settles (the focus map).
A double tap or a second owner returns the current state rather than a dead URL.

**Upgrading the role** from viewer to editor applies to **every copy already sent**: it asks for a confirmation that
says so, through the same `ConfirmDialog` with `confirmVariant="primary"` (its confirm button is `danger` by
default, which would mislabel "Make editors"). Downgrading and switching **off** do not confirm; the switch shows its `onHint` while on (switching off kills
every copy immediately, including those already sent).

Feedback after someone joins: the new member appears in the people list on the next load, with the link's creator as
the inviter, and the panel's joined count and last-joined time move on the next read; nothing updates live.

### Quota

- **The link** is one row per trip, structurally capped by the unique index on `trip_id`. It is not sold and not
  metered; nothing is added to `resolveLimits()`, `PLAN_QUOTAS` or `src/server/billing/__tests__/limits.test.ts`.
- **The trip membership** goes through `insertTripMember`, the same single insert path `addTripMember` uses, so a
  future `assertQuota` placed there covers both. Today `addTripMember` asserts no quota and there is no
  `trip_members` metric. The join consumes **no seat**: a joiner must already be a member of the link's workspace, so
  `addMember` (`src/server/repos/members.ts:152`, the `members` metric) already counted them. A trip can never hold
  more members than the workspace has seats. A metered `trip_members` ceiling is a catalogue change, not this stage's.
- **The per-IP bucket** on the public resolution is this stage's real ceiling and bounds unauthenticated cost.

## 📝 Architecture

| Concept                                | Owner module                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| The invite link record and its writers | `src/server/repos/invites.ts`                                                                                     |
| Trip membership rows (one insert path) | `src/server/repos/trips.ts` (`insertTripMember`; `addTripMember` and `joinTripByInviteUnscoped` call it)          |
| Secret derivation and digest           | `src/server/security/secret.ts` - a pure, SQL-free leaf that repos **may import** (stated in SPEC §6)             |
| Per-IP public rate limits              | `src/server/public/rate-limit.ts`                                                                                 |
| What a stranger may see of an invite   | `src/server/public/trip-invite.ts` (anonymous projection only, no SQL, no scope)                                  |
| The signed-in variants and the join    | `readInvitePreviewUnscoped`, `joinTripByInviteUnscoped` in `repos/invites.ts`; composed by `join/-server/join.ts` |
| The unscoped digest lookup             | `findLiveTripInviteByDigestUnscoped` in `repos/invites.ts`, single named caller `public/trip-invite.ts`           |
| The landing                            | `src/routes/join/**`                                                                                              |
| The owner's controls                   | `-server/invite.ts`, `-ui/invite-link-panel.tsx` on the people screen                                             |

Dependencies run route -> server function -> repository; `components/ui` fetches nothing; `src/server/public/**`
constructs no `TenantScope` and calls no auth helper (a test asserts it, as ACCESS §3.7 requires); all SQL stays in
`src/server/repos`. **Contract amendment, a Phase 2 deliverable and not optional:** `docs/SPEC.md` §5 and §6 and
`docs/ACCESS.md` §3.7 name `findLiveTripInviteByDigestUnscoped`, `readInvitePreviewUnscoped` and `joinTripByInviteUnscoped` as an
exception of the same kind as the calendar feed's (all take a plain `Database`), generalise "the share record" to
"the token record (share link or trip invite link)", and state that repos may import `security/secret.ts`. A new ADR
(next free number at write time, 0037 or later; `0035` and `0036` exist) records the exception. All three functions
carry the `Unscoped` suffix, so the suffix-based `unscoped-shape.test.ts` guards each of them. If the calendar stage
landed first, this stage only adds its functions and its named caller to the map in `unscoped-shape.test.ts`.

**Relation to the ready calendar spec.** That spec plans `src/server/calendar/secret.ts` with a 32-character
`nanoid`. This stage does not change it. Re-pointing is **one-directional**: if `calendar/secret.ts` already exists
when Phase 2 is implemented, the digest helper moves to `security/secret.ts` and the calendar module re-exports it in
the same PR; if the calendar stage lands later, its ticket imports `security/secret.ts` (noted in this PR's body, not by
editing that spec). The calendar spec's reference to ADR 0035 is already taken (`0035-agents-take-every-pr-to-develop`); that is a
follow-up for that spec, noted in the PR body.

## 📝 Data Model

See "Data: `trip_invite_links`". No other table changes. `trip_members` gains no column; `invited_by` already exists
and records the link's creator.

## 📝 API Contracts

| Function                                                                                                             | Method | Auth            | Input (Zod v4 `strictObject`)                   | Answer                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ------ | --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `loadInvite` (join loader, session-less; the **client re-fetch** path - the first render reads the param in-process) | POST   | none (optional) | `{ secret: string(43) }`                        | one of the closed projections above; 404 for `unavailable`; 429 over budget                                  |
| `joinTripFn`                                                                                                         | POST   | session         | `{ secret: string(43) }`                        | `{ outcome: 'joined'\|'member', tripId, organizationId }` or `{ outcome: 'needs-workspace'\|'unavailable' }` |
| `revealInviteLinkFn`                                                                                                 | POST   | trip owner      | `{ tripId }`                                    | `{ url }`, `no-store`                                                                                        |
| `createInviteLinkFn`                                                                                                 | POST   | trip owner      | `{ tripId, role: 'editor'\|'viewer' }`          | `{ ok: true, url }` (the existing link if one exists) or `{ ok: false, reason }`                             |
| `replaceInviteLinkFn`                                                                                                | POST   | trip owner      | `{ tripId, role, expectedRotation }`            | `{ ok: true, url }` or `{ ok: false, reason: 'changed'\|'archived'\|'notOwner' }`                            |
| `updateInviteLinkFn`                                                                                                 | POST   | trip owner      | `{ tripId, role?, enabled?, expectedRotation }` | `{ ok: true, url? }` (a new url on switch-on) or `{ ok: false, reason }`                                     |

## 📝 UI/UX

- **Landing card.** Presentations, each designed: **invited** (anonymous: trip title, the inviter's name, the role
  offered, the requirement line, one action - Sign in; signed in: plus dates and destination, one primary action
  "Join this trip"), **joining** (the action in its loading state), **joined** (visible title and body, "Open the
  trip" or "Open the trip and switch workspace"), **already a member** (shown only when the viewer was a member
  **before** tapping; a retry or double-submit that comes back `member` straight after their own tap shows
  **joined**), **needs workspace** (with its actions), **unavailable** (on `--color-surface-2`; for a signed-in
  visitor the exit is "Go to your trips", otherwise "Sign in"), loading skeleton, error. Guest chrome:
  `SkipToContent`, the `minimal` `MarketingHeader` (logo only - the marketing "Sign in", "Start free" and "See
  pricing" links would drop `?redirect=` and show "Sign in" to someone already signed in), and `MarketingFooter` in
  the same `minimal` variant (no "Start free" or "See pricing": its `/register` link is the same dead end). On the
  anonymous `invited` card, `join.newHere` sits directly under the `join.requirement` line, above the Sign in action.
  At 360px the card is the whole screen with the primary action above the fold; the URL field scrolls its own text
  and the page never scrolls sideways.
- **Owner's panel.** As specified under "The owner's panel". Every control has rest, hover, focus-visible, active,
  disabled and loading states. Skeleton: the card outline with a title bar and a button-sized block. Error: an
  `Alert` variant `danger` with "Try again". After a Replace or a switch-on the panel confirms on screen ("New link
  ready - copy it and send it again") because the URL changes.
- **Reused primitives:** `Card`, `Button`, `Avatar`, `Badge`, `Alert`, `EmptyState`, `Skeleton`, `Separator`,
  `Input`, `SwitchField`, `SimpleSelect` from `#/components/ui`; the people screen's `ConfirmDialog` (exported, with
  `onCloseAutoFocus` and an optional `pendingLabel`, so `invite.replace.pending` is shown and announced). **`CopyValue` is not used**: it builds English strings in code, upper-cases the value, is
  about 16px tall and cannot select the URL. No primitive and no token is added.
- **Motion.** The card enters at 220 ms on `--ease-out-quint` with a 6px rise; a state change cross-fades at 150 ms
  with the outgoing state `inert`; transform and opacity only; `prefers-reduced-motion: reduce` collapses both to
  opacity.
- **Focus map.**

  | Moment                                | Focus goes to                                                         |
  | ------------------------------------- | --------------------------------------------------------------------- |
  | Join page load                        | nowhere (no autofocus); `<main id="main">` is the skip link target    |
  | Join -> joined / member               | the new state's `h1` (`tabIndex={-1}`)                                |
  | Join -> unavailable                   | the unavailable `h1`                                                  |
  | Join submit error                     | returned to the Join button (a ref); an `Alert` `danger` appears      |
  | Create link                           | the Copy button (Create unmounts)                                     |
  | Replace from `active`                 | back on "Replace link"                                                |
  | Replace from `stale` / `creator-gone` | the Copy button (`onCloseAutoFocus`, the `people-screen.tsx` pattern) |
  | Switch toggle                         | stays on the switch                                                   |
  | Panel retry                           | the panel heading                                                     |

- **Accessibility.** WCAG 2.2 AA in both themes. One `h1` on the join page (the state title); trip, role, dates and
  destination as a `dl`; the inviter `Avatar` is `aria-hidden` (the name is in the `h1`). The owner panel is a
  `<section aria-labelledby>` with an `h2` at the same level as the members heading. The URL is a read-only `Input`
  labelled by `invite.link.label` with `dir="ltr"`, monospaced, no text transform; Copy is a `Button` size sm (32px)
  and, on success, announces `invite.copied` through the panel's status region; on failure it shows
  `invite.copyFailed` and selects the field. The switch is a `SwitchField` (the label row is the 24px target) with
  `aria-describedby` on its hint; the role is a `SimpleSelect` with a visible label. **Live regions:** one polite
  `role="status"` per surface, mounted before text is written; failures use `Alert` `danger` next to the failing
  control, linked with `aria-describedby`. The join card uses the focus move **or** a live announcement, not both.
  The sticky guest header sets `scroll-padding-top` so focus is not obscured (2.4.11). Colour is never the only
  signal of `off` / `stale`. **Non-text contrast:** the unchecked switch track is measured by hand at about 2.2:1
  (light) and 2.4:1 (dark) against 3:1 (1.4.11); Phase 4 measures it and, if it fails, files a follow-up for the
  primitive (the off state text stays visible as the second signal).

## 📝 Visual change expected

| Route                        | States that change on screen                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/join/$token` (new)         | invited (anonymous), invited (signed in), joining, joined, already a member, needs workspace, unavailable (404, signed-in and anonymous), loading skeleton, error, rate limited |
| `/trips/$tripId/people`      | the owner's "Invite link" panel: none, active, off, stale, creator-gone, archived, loading, error, confirm dialogs; unchanged for a non-owner                                   |
| `/register`, `/verify-email` | no visual change; the destination of "Continue anyway" changes when a redirect is present                                                                                       |

Each is captured in **light and dark**, at **360px (mobile), 1280px (desktop) and 2560px**, by the blind A/B pair
(`scripts/visual/capture.mjs`), the anonymous frames **without** the cached session, including one `ar` (RTL) frame.

## 📝 Copy

Keys land in `src/lib/i18n/messages/en/trips.ts` and, in the same change, in **all 23 locales** (`i18n-messages`
skill; the parity test enforces it). Namespaces `join.*` and `invite.*`; the role words reuse `people.invite.role`
("They join as"), `people.role.editor` and `people.role.viewer`, and the empty-state pointer reuses
`people.invite.emptyHint`. No sentence is composed by concatenation. Dates and `{when}` go through
`src/lib/format.ts` (SPEC §9 rule 5). Plurals use the catalogue's `{ one, few, many, other }` object shape, not ICU.

| Key                                | Text (`en`)                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `join.page.title`                  | `Trip invite link` (generic: no trip title, no inviter)                                                                                           |
| `join.page.description`            | `Open this link to join a shared trip on planned.travel.` (generic: no trip title, no inviter)                                                    |
| `join.title.invited`               | `{inviter} invited you to a trip`                                                                                                                 |
| `join.requirement`                 | `This link works for people who are already in {inviter}'s workspace.`                                                                            |
| `join.newHere`                     | `New here? Ask {inviter} to add you to their workspace first.`                                                                                    |
| `join.trip.label`                  | `Trip`                                                                                                                                            |
| `join.role.label`                  | `You would join as`                                                                                                                               |
| `join.dates.label`                 | `Dates`                                                                                                                                           |
| `join.destination.label`           | `Destination`                                                                                                                                     |
| `join.action.signIn`               | `Sign in`                                                                                                                                         |
| `join.action.join`                 | `Join this trip`                                                                                                                                  |
| `join.action.joining`              | `Joining the trip`                                                                                                                                |
| `join.action.open`                 | `Open the trip`                                                                                                                                   |
| `join.action.openIn`               | `Open the trip and switch workspace`                                                                                                              |
| `join.action.openIn.pending`       | `Switching workspace`                                                                                                                             |
| `join.joined.title`                | `You are on the trip`                                                                                                                             |
| `join.joined.body`                 | `Open it to see the plan.`                                                                                                                        |
| `join.member.title`                | `You are already on this trip`                                                                                                                    |
| `join.needsWorkspace.title`        | `This trip is in a workspace you are not part of`                                                                                                 |
| `join.needsWorkspace.body`         | `Ask {inviter} to add you to their workspace first, then open this link again.`                                                                   |
| `join.needsWorkspace.signedInAs`   | `You are signed in as {email}. Tell {inviter} to use this address.`                                                                               |
| `join.needsWorkspace.acceptFirst`  | `If you already have a workspace invitation email, accept it first, then open this link again.`                                                   |
| `join.needsWorkspace.otherAccount` | `Sign in with another account`                                                                                                                    |
| `join.unavailable.title`           | `This invite link is not available`                                                                                                               |
| `join.unavailable.body`            | `The link may have been replaced or switched off. Ask whoever sent it for a new one.`                                                             |
| `join.unavailable.signIn`          | `Sign in`                                                                                                                                         |
| `join.unavailable.trips`           | `Go to your trips`                                                                                                                                |
| `join.error.title`                 | `We could not load this invite link`                                                                                                              |
| `join.error.retry`                 | `Try again`                                                                                                                                       |
| `join.error.busy`                  | `This page is busy. Try again in a minute.`                                                                                                       |
| `join.error.join`                  | `Could not join. The link still works - try again.`                                                                                               |
| `join.error.switch`                | `Could not switch workspace. Try again.`                                                                                                          |
| `invite.title`                     | `Invite link`                                                                                                                                     |
| `invite.description`               | `Anyone in this workspace who opens the link joins the trip.`                                                                                     |
| `invite.empty.title`               | `No invite link yet`                                                                                                                              |
| `invite.empty.body`                | `Make one link, paste it into your group chat, and people in this workspace who open it can join.`                                                |
| `invite.action.create`             | `Create link`                                                                                                                                     |
| `invite.link.label`                | `Invite link`                                                                                                                                     |
| `invite.copy`                      | `Copy link`                                                                                                                                       |
| `invite.copied`                    | `Link copied`                                                                                                                                     |
| `invite.copyFailed`                | `Could not copy. Select the link and copy it yourself.`                                                                                           |
| `invite.switch.label`              | `Anyone in this workspace with the link can join`                                                                                                 |
| `invite.switch.onHint`             | `Switching off stops the link working for everyone, including copies already sent.`                                                               |
| `invite.switch.offHint`            | `Switching it back on makes a new link. Links you sent earlier stay dead.`                                                                        |
| `invite.off.body`                  | `The link is switched off. Nobody can join with it.`                                                                                              |
| `invite.uses`                      | plural object: `{count} joined through this link` (CLDR categories per locale)                                                                    |
| `invite.uses.never`                | `Nobody has joined through this link yet.`                                                                                                        |
| `invite.lastUsed`                  | `Last joined {when}`                                                                                                                              |
| `invite.role.upgrade.title`        | `Make people editors?`                                                                                                                            |
| `invite.role.upgrade.body`         | `This applies to every copy of the link already sent, for anyone who joins from now on.`                                                          |
| `invite.role.upgrade.confirm`      | `Make editors`                                                                                                                                    |
| `invite.replace.action`            | `Replace link`                                                                                                                                    |
| `invite.replace.title`             | `Replace this link?`                                                                                                                              |
| `invite.replace.body`              | `Everyone holding the old link loses it immediately. People who already joined stay on the trip; remove them from the list below if you need to.` |
| `invite.replace.deadBody`          | `The old link no longer works. People who already joined stay on the trip.`                                                                       |
| `invite.replace.confirm`           | `Replace link`                                                                                                                                    |
| `invite.replace.pending`           | `Replacing the link`                                                                                                                              |
| `invite.stale`                     | `This link no longer works. Replace it.`                                                                                                          |
| `invite.creatorGone`               | `This link stopped working because the person who created it is no longer an owner. Replace it.`                                                  |
| `invite.archived`                  | `This trip is archived. The link does not work while it is, and works again when the trip is restored.`                                           |
| `invite.announce.created`          | `Invite link created`                                                                                                                             |
| `invite.announce.roleEditor`       | `People who join will become editors`                                                                                                             |
| `invite.announce.off`              | `Invite link switched off`                                                                                                                        |
| `invite.announce.newLink`          | `New invite link ready. Copy it and send it again.`                                                                                               |
| `invite.announce.roleViewer`       | `People who join will become viewers`                                                                                                             |
| `invite.error.title`               | `The invite link did not load`                                                                                                                    |
| `invite.error.retry`               | `Try again`                                                                                                                                       |
| `invite.refusal.archived`          | `This trip is archived.`                                                                                                                          |
| `invite.refusal.notOwner`          | `Only a trip owner can change the invite link.`                                                                                                   |
| `invite.refusal.changed`           | `Someone else changed the link. Showing the current one.`                                                                                         |
| `invite.refusal.saveFailed`        | `The change was not saved. Try again.`                                                                                                            |

The register and verify screens add no key: the destination of the existing "Continue anyway" changes, not a sentence.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                                                         | Behaviour                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Secret malformed, unknown, rotated away, switched off, trip archived, creator no longer an owner / in the workspace / banned | One 404 "unavailable" card, identical body; every one counts against the per-IP miss budget                              |
| KV unavailable                                                                                                               | The limiter fails open; resolution is unaffected and never fails open                                                    |
| Over budget (page or submit)                                                                                                 | `429` with `Retry-After`; neutral `join.error.busy` (a shared NAT or hotel wifi can spend the miss budget; no blame)     |
| Signed in as a member of the trip already                                                                                    | `member` state; `use_count` unchanged; no write                                                                          |
| Signed in, not in the link's workspace                                                                                       | `needs-workspace`; no write; no ids in the answer                                                                        |
| Joiner's active workspace is another one                                                                                     | Joined correctly (membership checked against the link's workspace); "Open the trip and switch workspace"                 |
| Two taps / two tabs submit the join together                                                                                 | The unique index makes the second `member`, shown as **joined** after the viewer's own tap; `use_count` counts one       |
| Create tapped twice, or two owners create together                                                                           | The second returns the existing link unchanged; no dead URL                                                              |
| Replace with a stale `expectedRotation`                                                                                      | `reason: 'changed'`; the panel shows the current link and `invite.refusal.changed`                                       |
| Link replaced while a join tab is open                                                                                       | Submit re-resolves, the card swaps to unavailable in place, nothing is written                                           |
| Owner demoted / removed / left the workspace / banned                                                                        | Their links go dead (`creator-gone`); another owner's Replace takes it over with a new secret; **no revival**            |
| Role changed after sending                                                                                                   | Applies to people who join **after** the change; nobody already on the trip is changed; viewer -> editor asks to confirm |
| Trip archived, then restored                                                                                                 | The link is unavailable meanwhile and works again, with the same secret, after restore                                   |
| `BETTER_AUTH_SECRET` rotated                                                                                                 | Every link fails closed; the panel shows `stale`; `docs/DEPLOY.md` says so                                               |
| Banned joiner / impersonated session                                                                                         | Both: `unavailable`, nothing written                                                                                     |
| Email registration with a redirect                                                                                           | "Continue anyway" on the verify screen goes to the target (Phase 1)                                                      |
| A crawler or unfurl bot GETs the URL                                                                                         | No write, generic `<title>`, no trip-specific Open Graph, `noindex`, `no-store`                                          |
| Workspace switch fails after joining                                                                                         | `join.error.switch`; the button stays                                                                                    |

## 📝 Observability

The tenant audit trail gets `trip_invite.rotated`, `trip_invite.updated` and `trip.member_joined`. Resolution misses
and 429s are logged with the **redacted** path (never the secret) and the hashed IP bucket; no log line, Sentry event
or analytics URL carries the secret; the audit metadata carries the link id and never the secret or the digest.

## ✅ Acceptance criteria

1. An owner with no link sees "No invite link yet"; "Create link" shows a copyable URL. A viewer or editor of the same
   trip - and a workspace admin who is not on the trip - sees no panel at all.
2. Copying the URL twice, on different days, gives the same URL. Replacing the link gives a different URL and the old
   one answers 404 on its next request. Creating twice returns the same link.
3. Switching the link off makes its URL answer 404. Switching it back on shows a **new** URL, and the old URL stays 404.
4. Changing the role changes the role of people who join **after** the change, and of nobody already on the trip.
5. Opening the URL in a fresh context shows the trip title, the inviter's name and avatar, the role offered and the
   requirement line - and no dates, destination, workspace name, ids or email. The response carries `noindex`,
   `no-referrer` and `no-store`, the `<title>` is generic, and there is no trip-specific Open Graph or Twitter tag (the site-level generic ones remain).
6. A visitor with an account who taps **Sign in** on the card comes back to the same `/join/<secret>` URL after signing
   in.
7. A signed-in member of the trip's workspace who is not on the trip joins in one action and appears in the people list on
   the next load, with the link's creator as the inviter and the link's role.
8. Opening a live link while already on the trip shows the `member` state and does not change the joined count.
9. A member of two workspaces whose active workspace is the other one joins correctly and opens the trip after the
   explicit workspace switch.
10. A signed-in non-member of the workspace sees the `needs-workspace` card with its actions, and no `trip_members` row
    exists.
11. A rotated, switched-off, orphaned, banned-creator or archived-trip link shows the identical 404 card, writes
    nothing, and counts against the miss budget.
12. Registering with email from any `?redirect=` link leads, through "Continue anyway", to that target (Phase 1).
13. No query, response, log or Sentry event returns the secret except `revealInviteLinkFn` / `createInviteLinkFn` /
    `replaceInviteLinkFn` to a trip owner; a test pins it.
14. `owner` can never be granted by a link: not by the input, not by a hand-edited row. A link whose creator left never
    returns with its old secret.
15. Tenant isolation: A cannot read, replace, switch off or reveal B's invite, and B's row is byte-identical
    afterwards.
16. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `bash .ai/scripts/check-generated.sh` and `pnpm build` are green; the
    23-locale parity test is green; the browser journey passes; zero console errors, zero layout shift after paint.

## 📝 Risks & Impact Review

- **A forwarded link grants membership.** Mitigated by: editor/viewer only (default viewer), workspace-member
  requirement, creator-liveness without revival, owner-only mint, one-click replace, no write on GET, rate budgets.
- **A stranger learns a trip exists.** Mitigated by the reduced anonymous card, the generic title and the identical 404.
- **Derived secret.** A leaked `BETTER_AUTH_SECRET` plus D1 reveals live links; that pair already forges sessions.
  Rotation fails closed and is documented. The secret travels in `?redirect=` while a visitor signs in: redacted in
  Sentry and logs, bounded by the workspace-membership requirement.
- **A closed contract is reopened.** SPEC §5's exception list grows by one function family, with an ADR and the
  amendment in the same phase as the function.
- **Backward compatibility.** Additive table, additive routes, additive audit names, an additive payload field; the
  `addTripMember` refactor changes no signature and no behaviour (`BACKWARD_COMPATIBILITY.md` checked per ticket).
- **Ratings** (`SDLC.md` § This repository, "Risk here": a diff touching `src/server/db/schema.ts`, `drizzle/` or
  `src/server/public` is `risk-high`): see the Phasing table. The security and tenancy specialist's conditions are
  recorded in Resolved assumptions.

## 📋 Phasing

| #   | Phase                                                                                                                                                                                                                                | Labels                    | Visible when it merges                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Carry `?redirect=` through email registration (a standalone fix)                                                                                                                                                                     | `risk-medium`             | Registering from a `?redirect=` link continues to it                                |
| 2   | Table, repository, shared secret and rate-limit modules, `insertTripMember` extraction, contract amendments and ADR, docs, CONTEXT, audit names                                                                                      | `risk-high`, `security`   | Nothing - the **infrastructure exception** (no UI, no route); a layer no user meets |
| 3   | The visitor slice: `/join/$token` with every state, the sign-in round trip, the join, workspace switch, audit, redaction, ACCESS §3.8                                                                                                | `risk-high`, `security`   | Joinable by a seeded token only                                                     |
| 4   | The owner's panel on the people screen, with its states, motion and accessibility, the browser journey and the A/B pair                                                                                                              | `risk-medium`, `security` | **The feature is on end to end**; `COL-11` is counted done here, as narrowed        |
| -   | Follow-up (not a ticket of this stage): `afk-to-tickets` files an issue for a person - may a trip link ever lead into the workspace, and on what seat terms - and the parent says `COL-11` is closed "as narrowed" with a link to it | -                         | -                                                                                   |

Phase 3 ships with its loading, error and skeleton states, its motion and its accessibility pass; Phase 4 ships the
same for the panel. Nothing is deferred to a polish ticket.

## 📋 Implementation Plan

### Phase 1 - Return to the target after email registration (a standalone fix)

Nothing in Phases 2 to 4 depends on this phase (the invite card has no register button); it serves the workspace
invitation's `/register?redirect=` link, which has the same defect, and is shipped first because it is small.

1. `register.tsx`: for the email path, the in-app hand-off carries `target` whenever it is not `DEFAULT_REDIRECT`
   (`handOff('/verify-email?redirect=<encoded target>')`); `callbackURL` stays `/verify-email`.
2. `verify-email.tsx`: add `redirect: z.string().optional()` to `searchSchema`; the pending screen's "Continue anyway"
   link uses `safeRedirect(search.redirect)`. The email-link verified panel keeps `/dashboard`.
3. Tests: the three cases (no redirect, a safe path, an unsafe path that falls back to `/dashboard`); the
   workspace-invitation round trip is exercised by the same change.
4. Grep: `grep -rn "verify-email" src docs` and update every document that states the registration flow.

### Phase 2 - The record, the repository and the shared modules

1. `schema.ts`: `tripInviteLinks`; `pnpm db:generate` (one `CREATE TABLE`, three indexes, no rebuild, no `DROP`, one
   journal entry; review it, never hand-edit); `types.ts`.
2. `src/server/security/secret.ts` and `src/server/public/rate-limit.ts` (or import them if the calendar stage landed; re-point
   `calendar/secret.ts` in the same PR if it exists). Tests: the derivation is deterministic for one
   `(purpose, key, id, rotation)` and differs for another, distinct purposes give distinct subkeys, the digest is hex
   SHA-256, the shape guard rejects 42 and 44 characters; budgets are parameters.
3. `repos/invites.ts` (all functions above except the preview and join, which land in Phase 3) and the export line;
   the `insertTripMember` extraction in `trips.ts` (the existing `addTripMember` tests are the proof).
4. `unscoped-shape.test.ts`; the `docs/SPEC.md` §5/§6 and `docs/ACCESS.md` §3.7 amendments and the ADR (this phase,
   with the function); `docs/DEPLOY.md` rotation note; `CONTEXT.md` terms; `trail.ts` names (and the action-name test).
5. Tests (Tenant isolation, below), including the concurrent create / replace cases and the takeover case.
6. A one-line `pnpm dev` check that workerd `crypto.subtle` supports HKDF, recorded in the PR.
7. Grep (CODE_REVIEW "Docs and CI"): `grep -rn "share_links\|accept-invitation\|addTripMember\|Three surfaces\|closed" docs src CONTEXT.md`.

### Phase 3 - The visitor slice

1. `public/trip-invite.ts` (anonymous projection, order above); `repos/invites.ts` `readInvitePreviewUnscoped` and
   `joinTripByInviteUnscoped`.
2. `src/routes/join/$token.tsx`, `-server/join.ts` (`loadInvite`, `joinTripFn`), `-ui/join-card.tsx`: every state in
   UI/UX with loading, error, motion, focus map and live region; the headers (`headers` option) and the `notFound()` 404 with a
   test of the document status and headers; the generic `<title>` and meta overrides; the `minimal` `MarketingHeader`;
   the sign-in pages' `strict-origin` referrer meta; the `ar` frame; `scopeFor` in `fns/context.ts` for the join's trail.
3. Redaction in `sentry-scrub.ts`, wired through `src/client.tsx`, `observability/sentry.ts` and `sentry-replay.ts`,
   with `sentry-scrub.test.ts`.
4. `pnpm generate-routes`; inspect the regenerated tree in the diff.
5. i18n: the `join.*` keys in all 23 locales.
6. Docs: `docs/ACCESS.md` §3 intro ("Four"), §3.5, §3.6 (the new rows), §3.8 (visible / never-visible lists, the single
   write), §6.4 (impersonation refused).
7. Tests: the projections' columns are exactly the whitelist; every dead-link kind yields the same body and status; a
   GET writes nothing; the rate-limit cases; no `TenantScope` is constructed and no auth helper called under
   `src/server/public/**`; a member of A only using B's link writes no row; a member of A and B with A active joins
   B's trip and the row carries B's `organization_id`; the request body's role is ignored; `owner` in a hand-edited
   row is refused; already-a-member is `member` and does not touch `use_count`; a banned user and an impersonated
   session are `unavailable`; a demoted, removed, departed or banned creator kills the link; an archived trip kills
   it; a rotation between resolve and submit fails the submit; the answer carries no ids except for
   `joined` / `member`; the audit row has the link id and no secret.
8. Component tests query controls by role and name, assert the status text after each action and the focused element
   after join.

### Phase 4 - The owner's panel, the journey and the visual pair

1. `-server/invite.ts`, `-ui/invite-link-panel.tsx`, `TripPeoplePayload.invite`, the mount point, the exported
   `ConfirmDialog`; every state with loading, error, motion, focus map and live region.
2. i18n: the `invite.*` keys in all 23 locales.
3. Tests: owner-only reveal (an editor, a viewer, a workspace admin who is not on the trip, and another workspace are
   refused or `NotFoundError`; `invite` is `null` for each); the read has no secret field; the old secret stops
   resolving right after replace and after switch-on; role cannot be `owner`; the takeover (owner A mints, A is
   demoted: the old secret resolves to `null`; it still resolves to `null` after B's role change; B's Replace issues a
   new secret and the old one stays `null`; B's role change on a `creator-gone` link is not offered); every panel state renders; component tests as in Phase 3.
4. `e2e/collaboration-and-sharing.spec.ts`: one `test.describe('07-S10 - ...')`. The owner (cached demo session)
   creates a link using only the keyboard, copies it, opens it in the same context and sees the **already a
   member** state with the joined count unchanged, a **fresh anonymous context** opens it and sees the invite with a
   Sign in action carrying `?redirect=`, the owner replaces the link, and the old URL shows the unavailable card with
   status 404; an axe pass in light and dark. The completed `joined` path needs a second workspace member whose
   credentials the e2e environment does not carry and is covered by Phase 3's handler-level tests.
5. The switch-track contrast measurement (1.4.11); the A/B visual pair at 360/1280/2560, light and dark, including
   `ar`; layout shift after the settle mark; console silent.

## Verification

- Gate, in order (`validation.commands`): `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `bash .ai/scripts/check-generated.sh`, `pnpm build`; plus `pnpm exec vitest run --project=tooling scripts/specs` for this spec.
- `pnpm generate-routes` in Phase 3 (a route file is added); the tree is inspected, not edited.
- `pnpm generate-spec-index` after any change to this spec.
- Migration review (Phase 2): one `CREATE TABLE`, three indexes, no rebuild.
- The 23-locale parity test per the `i18n-messages` skill.
- Browser: Phase 4's journey, anonymous half in a fresh context rather than `AUTH_STATE`; console silent.

### Tenant isolation test

`trip_invite_links` joins the `cases` table of `tenant-isolation.test.ts` so it inherits the five standing
assertions. A new `describe` in A's scope: reading B's trip invite by B's trip id is `NotFoundError`; replacing,
updating, revealing B's invite is `NotFoundError`, with B's row **byte-identical afterwards** (`token`, `rotation`,
`use_count` included); touching B's invite id is `NotFoundError`. `invites.test.ts` covers the unscoped resolver: a
valid digest resolves to its own organization and trip and no other; every kind of dead link (disabled, rotated away
(asserted by replacing and then resolving the old value in the same test), archived trip, creator demoted, creator
removed from the trip, creator removed from the workspace, creator banned, role outside the narrowed enum, and a
hand-made row whose `organization_id` disagrees with its trip's) resolves to `null`; `readInvitePreviewUnscoped` reads only the
trip the digest points at (never another trip of the same or another organization); a joiner who is not a member of the row's organization is
refused and no `trip_members` row is written. Functions covered: `readTripInvite`, `revealTripInviteSecret`,
`createTripInvite`, `replaceTripInvite`, `updateTripInvite`, `touchTripInvite`, `findLiveTripInviteByDigestUnscoped`,
`readInvitePreviewUnscoped`, `joinTripByInviteUnscoped`.

## Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, and:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled (`aria-disabled` on the select and switch while pending; `loading` on buttons) and loading on the join action, the copy
      button, the role select, the switch and the replace confirmation.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`, including the never-minted owner state and the
      unavailable landing.
- [ ] Motion 150-260 ms on `--ease-out-quint`, transform and opacity only, `prefers-reduced-motion` honoured, the
      outgoing state `inert` during a cross-fade.
- [ ] Light and dark parity with dark shadows re-declared; the landing is designed in dark, not inherited; one `ar`
      (RTL) frame.
- [ ] 360px, 1280px and 2560px; at 360 the landing card is the whole screen with the action above the fold; focus is
      not obscured by the sticky header.
- [ ] Keyboard reachable end to end, skip link, the focus map above, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint.
- [ ] The grep of CODE_REVIEW "Docs and CI" is run and the terms searched are in the PR body.

## Out of scope

- A trip link that adds the person **to the workspace** (a seat decision; a person's call - whether it may ever be
  offered, and on what seat terms). Until then a friend without a seat in the workspace needs a workspace invitation
  first. Tracked as the follow-up in Phasing.
- An owner-facing notification or activity entry on each join (the people list and the joined count are the
  feedback; the tenant audit-trail row is a security record, not feedback); expiry dates; a use cap; more than one
  link per trip; guests (`trip_guests`); a QR code, share sheet or `mailto:`; a pending-approval step; the `owner`
  role as a link grant; email-verification gating; removing someone who joined (the people screen already does it).
- A `trip_members` quota metric (`TRP-11`'s, a catalogue change).
- `07-S6` (the public share link and the guest viewer): untouched; it may later add a share dialog that links to this
  panel.
- This stage adds no caller of `closeTripRoom`: evicting a socket is what a role change, a removal and the trip lifecycle need, and #1050 gave them their callers (`closeRoomFor`, `closeRoom` in `src/server/fns/context.ts`).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                      | Applied default                                                                                                                                                                                                                           | Why                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is the stage one complete slice, and who does the link add?                   | Existing members of the trip's **workspace**; everyone else gets an honest dead-end naming the inviter and offering other accounts; `COL-11` narrowed; the card says so before sign-in                                                    | Decided by product owner sub-agent (confidence medium): a link that grants workspace membership takes a seat and is the outcome the plan names unacceptable; every new account has its own workspace.                                          |
| 2   | Depend on `07-S6` or build the shared infrastructure?                         | Own neutral modules, **first-lander creates**: `security/secret.ts`, `public/rate-limit.ts`, the unscoped-shape test; re-pointing is one-directional (no cross-spec claim)                                                                | Decided by software architect sub-agent (confidence high): waiting blocks a stage nothing will unblock; a test claiming one digest implementation would be false against the ready calendar spec.                                              |
| 3   | Where do the owner's controls live?                                           | An owner-only panel on the people screen (`invite-link-panel.tsx`), not `share-dialog.tsx`                                                                                                                                                | Decided by software architect (confidence medium) and product owner (confidence high): the people screen is the trip's membership surface; the dialog's trigger belongs to `07-S6`.                                                            |
| 4   | How does the join write the membership?                                       | Extract and export `insertTripMember`; `joinTripByInviteUnscoped` lives in `invites.ts` and calls it; the invite row is the authorisation                                                                                                 | Decided by software architect (confidence high): `addTripMember` demands an owner and a readable trip; `invites.ts` importing `trips.ts` (never the reverse) avoids a cycle; one insert path keeps a future quota covering both.               |
| 5   | Where does the unscoped resolver live, and is the contract amended?           | `repos/invites.ts`, `...Unscoped(db, digest)`, single named caller `public/trip-invite.ts`; SPEC §5/§6, ACCESS §3.7 and an ADR amend the closed list **in Phase 2**, not optionally                                                       | Decided by software architect (confidence high) and security and tenancy sub-agent (confidence medium): ACCESS §3.7 gives `public/**` no SQL and no scope; SPEC §5 calls its list closed.                                                      |
| 6   | Which roles may a link grant?                                                 | `editor` and `viewer`; default **viewer** (the plan said editor); never `owner`; Zod plus a re-parse at join; viewer -> editor asks for confirmation                                                                                      | Decided by security and tenancy sub-agent (confidence high): an address-less link is forwarded; a viewer default makes a mistaken click cheapest; an upgrade reaches every copy already sent.                                                  |
| 7   | Is a link honoured after its creator stops being an owner, and can it return? | Only while `created_by` is an owner of the trip, a workspace member and not banned; `created_by` moves only on create / replace / switch-on, each of which bumps the rotation                                                             | Decided by security and tenancy sub-agent (confidence medium): no signed credential outlives its signer, and a retired link never revives; role change and switch-off never take a link over.                                                  |
| 8   | Archived trips; what the anonymous card shows                                 | Archived: unavailable, and the same link works again after restore; anonymous: title, inviter name and avatar, role and the requirement line only                                                                                         | Decided by security and tenancy sub-agent (confidence medium): ADR 0007; name plus dates plus destination is the most sensitive combination. The restore behaviour is stated in the panel copy.                                                |
| 9   | Who does the join act as?                                                     | The joiner, with their role in the **link's** workspace read from `member` through `db`; never the active workspace; banned and impersonated sessions are `unavailable`; no email-verification gate                                       | Decided by security and tenancy sub-agent (confidence high/medium): `requireOrg` binds to the active workspace; `/join` renders no impersonation bar, so a join under impersonation is refused (ACCESS §6.4 amended).                          |
| 10  | A joiner whose active workspace differs                                       | Return `{tripId, organizationId}` only after the membership check; the client calls `setActive` on the explicit "Open the trip" action                                                                                                    | Decided by security and tenancy sub-agent (confidence high): no leak beyond a workspace the person belongs to.                                                                                                                                 |
| 11  | Dead-link status, headers, redaction                                          | 404 with one body; `noindex` (meta and `X-Robots-Tag`), `no-referrer`, `no-store`, generic `<title>`, no trip-specific Open Graph (the site-level tags remain); GET never writes; POST for any client re-fetch; Sentry / logger redaction | Decided by security and tenancy sub-agent (confidence high): the secret is in the path; chat unfurlers fall back to `<title>`; ACCESS §3.5 and §3.6 on the sibling surface.                                                                    |
| 12  | Signed-in non-member of the workspace                                         | A distinct `needs-workspace` state for live links only, naming nothing and creating nothing, with other-account and trips exits and the viewer's own email                                                                                | Decided by security and tenancy sub-agent (confidence medium) and traveller sub-agent: collapsing it into "unavailable" would send legitimate friends to support; a card with no action is a dead end.                                         |
| 13  | Can the owner copy the link again, and how is it derived?                     | Yes: HKDF subkey (closed purpose list, key passed in as an argument) of `BETTER_AUTH_SECRET`, HMAC over `linkId:rotation`; only the digest is stored; compare-and-set on rotation                                                         | Decided by product owner (confidence medium) and security and tenancy sub-agent (confidence medium): a D1 dump alone yields nothing usable; no new binding (the `MCP_TOKEN_PEPPER` precedent was weighed and declined); rotation fails closed. |
| 14  | Does the registration leg return to the link, and is there a register button? | Phase 1 fixes the in-app hand-off for every `?redirect=` link (`callbackURL` untouched); the card has **no** "Create an account" button                                                                                                   | Decided by product owner (confidence medium) and architect: Better Auth appends `?error=` to `callbackURL` by concatenation; a workspace member already has an account, and registering could only end in `needs-workspace`.                   |
| 15  | Scope fences                                                                  | Owner notification / activity on join, expiry, use cap, multiple links, guests, QR, approval, owner grant, verification gate: all out                                                                                                     | Decided by product owner (confidence high): each is a separate feature; the people list and the joined count are the feedback.                                                                                                                 |
| 16  | Slicing                                                                       | Four tickets; infrastructure (Phase 2) and the seeded-token-only visitor slice (Phase 3) the two stated exceptions; the visitor slice and the panel each ship their states, motion and accessibility                                      | Decided by software architect and product owner (round 1): SDLC scoping rule (SLC) and SPEC §7 forbid deferring loading, error and accessibility to a polish ticket.                                                                           |
| 17  | Is the "may a trip link lead into the workspace" question filed?              | Yes, as a follow-up issue for a person, filed by `afk-to-tickets`; the parent says `COL-11` is closed "as narrowed"                                                                                                                       | Decided by product owner (round 1): the headline use case is exactly what this slice does not serve; a file nobody re-reads is not tracking.                                                                                                   |
| 18  | Does the join write a tenant audit row?                                       | Yes: `trip.member_joined`, `trip_invite.rotated`, `trip_invite.updated`; a security record, not owner feedback; never the secret or digest                                                                                                | Required by the security and tenancy sub-agent's conditions; `trail.ts` names tenant-security events in the stage that ships their writes.                                                                                                     |
| 19  | The plan's e2e visual spec and baselines                                      | Struck; one browser journey kept                                                                                                                                                                                                          | ADR 0016 removed screenshot baselines. Applied by the writer.                                                                                                                                                                                  |
| 20  | The completed join in a browser                                               | Covered by handler-level tests with seeded members; the browser covers the owner's already-a-member state and the anonymous half                                                                                                          | The e2e environment carries one demo credential (the product owner asked the already-a-member state be added to the journey).                                                                                                                  |
| 21  | Which controls does the panel use?                                            | Read-only `Input` + `Button` instead of `CopyValue`; `SwitchField`; `SimpleSelect`; the exported people-screen `ConfirmDialog`; `aria-disabled` while pending                                                                             | Decided by accessibility sub-agent (confidence medium): `CopyValue` hardcodes English, upper-cases the value and is under the 24px target; a disabled focused control drops focus to `body`.                                                   |
| 22  | Risk labels                                                                   | Per phase: Phases 2 and 3 `risk-high` + `security`; Phases 1 and 4 `risk-medium` (Phase 4 + `security`)                                                                                                                                   | Fact from `SDLC.md` "Risk here" (schema, `drizzle/`, `src/server/public`), confirmed by the architect and security reviews.                                                                                                                    |
| 23  | Marketing chrome on `/join`                                                   | `MarketingHeader` gains a `minimal` prop (logo only)                                                                                                                                                                                      | Decided by traveller sub-agent: the header's sign-in / start-free links drop `?redirect=` and offer sign-in to someone already signed in.                                                                                                      |

## Panel verdicts

**Round 1** (on the first written draft): architect - approve with conditions (confidence high); product owner -
approve with conditions (medium); security and tenancy - approve with conditions (medium); accessibility - approve
with conditions (medium); traveller / manual tester - **revise** (medium). Every condition was applied in the
revision (commit `e48f9376`); none escalated (ESCALATE: no from all five).

**Round 2** (on the revision): product owner - **approve** (high), no conditions; software architect - approve with
conditions (high); security and tenancy - approve with conditions (high); accessibility - approve with conditions
(high); traveller / manual tester - approve with conditions (high). Every round 2 condition was a text edit and was
applied in the next commit: the viewer object carrying `banned` and `impersonated` into the preview and the join,
`readTripInvite` taking the derivation key, the signed-in `loadInvite` path running the same budgets and miss
accounting, `join.ts` registered as the named caller in the unscoped-shape map, the takeover test wording (no
revival), `aria-disabled` limited to the select and switch with `loading` buttons and explicit focus, the dialog's
`pendingLabel`, the URL field scrolling its own text, sign-out before "Sign in with another account", the minimal
footer, whole-sentence role announcements, the generic meta description key and the placement of `join.newHere`.
No specialist asked for a third round and none escalated (ESCALATE: no from all five). Not checked by any reviewer:
anything that needs the running app, a real screen reader or computed colours - those are Phase 3 and 4 evidence.
