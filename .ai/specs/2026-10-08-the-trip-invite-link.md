# One link that puts the people you send it to on your trip

| Field              | Value                                               |
| ------------------ | --------------------------------------------------- |
| **Status**         | ready                                               |
| **Issue**          | none                                                |
| **Spec PR**        | none                                                |
| **Implementation** | none                                                |
| **Plan**           | 07-S10 (docs/plans/07-collaboration-and-sharing.md) |

## 📝 TLDR

Plan stage `07-S10` closes reference row `COL-11` (the trip invite link). A trip owner mints **one rotating
link** for a trip, copies it as often as they like, sends it to the people who should be on the trip, changes
the role it grants, switches it off, and replaces it (the old one stops working on the next request). Someone
who opens `/join/<secret>` sees an invitation, signs in (or registers) and comes back to the same URL, and a
member of the trip's workspace is put on the trip. It is a different object from the workspace invitation
(`src/routes/(auth)/accept-invitation.$invitationId.tsx`): different table, different route, different token
space, and it never grants workspace membership.

The stage as the plan wrote it does not survive contact with the code, and this spec departs from it in seven
places, each a Resolved assumptions row: the owner controls live on the **people screen**, not in a share
dialog nobody will build; the join cannot go "through `addTripMember`" because that function demands an
owner and a readable trip; the link's secret is **derived**, so the owner can copy it again (the plan's
"shown once" contradicts its own owner panel); the anonymous read is a **`src/server/public/**` projection**,
not a route-local resolver; the roles a link may grant are **editor and viewer** (default viewer), never
owner; the anonymous card shows **less** than the plan said; and the return to the link after **email
registration** does not work today and is fixed first.

It is cut into **six phases** (six tickets for `afk-to-tickets`): **1** carry `?redirect=` through email
registration and verification (a fix that stands alone and also repairs the workspace invitation), **2** the
table, the repository, the shared secret and rate-limit modules and the docs they amend (no UI), **3** the
anonymous landing, **4** the join, **5** the owner's panel (the ticket that turns the feature on), **6** the
states, the motion and the browser journey. It describes the work **left** at HEAD (`ee99d50d`).

**What this slice delivers, and what it does not.** The link adds people who are **already members of the
trip's workspace**. Every account is provisioned with its own personal workspace (`provisioning.ts:71`), so a
friend with no account who follows the link registers into their own workspace and lands on the
"ask whoever shared this to add you to their workspace" state. That is a decision, not an oversight (Resolved
assumptions 1 and 14): a trip link that grants workspace membership takes a seat and is the one outcome the
plan names as unacceptable. The sentence "adds an existing account to the trip" in the plan's reference row is
narrowed to "adds an existing member of the trip's workspace".

## 📝 Problem Statement

Measured at HEAD (`ee99d50d`):

- **No such object exists.** `grep -rn "trip_invite\|/join" src` returns nothing; `src/routes/` has no `join`
  directory; `CONTEXT.md` has no term for it. The only things called an invitation are the workspace
  invitation (Better Auth organization invitations: `accept-invitation.$invitationId.tsx`,
  `(auth)/-server/invitation.ts`) and the people screen's owner-only "add a workspace member" control
  (`-server/people.ts` `addTripMemberFn`).
- **An owner can only add a person already visible to them in a list.** `readTripPeople`
  (`src/routes/_app/trips/$tripId/-server/people.ts`) returns `invitable`: the workspace roster minus the
  trip's members, and `[]` for a non-owner. There is no way to say "everyone in this group chat, join".
- **`addTripMember` cannot be reused by a joiner.** `src/server/repos/trips.ts:1815` runs
  `requireTrip(scope, tripId)`, then `assertTripRole(scope, tripId, ['owner'])`, then
  `getMembership(scope, values.userId)`, and inserts with `invitedBy: scope.ctx.userId`. Called in a joiner's
  own context it fails twice: the joiner is not an owner, and on a `private` trip (ADR 0007) `requireTrip`
  raises `NotFoundError` for a non-member. The plan's line "never through an insert of this stage's own"
  (citing `trips.ts:434-441`, which is now `TripArchivedError` and `requireWritableTrip`) cannot hold.
- **Nothing 07-S6 was to supply exists, and nothing will write it.** There is no `src/server/fns/sharing.ts`,
  no `share-dialog.tsx`, no `src/routes/shared/`, no `hashShareToken`, no `src/server/public/` directory and no
  public rate limiter. `share_links.token` is stored in plaintext (`schema.ts:1762`). The stage-picker marks
  `07-S4` to `07-S9` covered because other specs name them in prose, so no spec for `07-S6` will be written by
  this pipeline. The ready, unbuilt calendar-feed spec (`2026-10-04-a-calendar-that-keeps-up-with-the-trip.md`,
  plan stage `06-S5`, tickets #899 to #902) plans `src/server/public/rate-limit.ts` (this stage is its second
  caller) and `src/server/calendar/secret.ts` (a digest helper), and the unscoped-lookup shape
  (`unscoped-shape.test.ts`). None exists yet.
- **A registered visitor does not come back to the link.** `src/routes/(auth)/register.tsx:169-178` signs up with
  `callbackURL: '/verify-email'` and hands off to `/verify-email` for **email** registration; only the social
  path uses `target`. `verify-email.tsx` links to `DEFAULT_REDIRECT` (`/dashboard`) and has no `redirect`
  search param. The plan's "registers, verifies and lands back on the invitation" is false at HEAD, and the
  workspace invitation's `/register?redirect=` link (`accept-invitation.$invitationId.tsx:188`) has the same
  defect today.
- **A joiner's active workspace is usually not the trip's.** `appScope()` uses
  `session.activeOrganizationId` (`src/server/auth/session.ts:95`); `requireOrg({ organizationId })` throws
  `not-a-member` on a mismatch instead of switching (`tenant.ts:171-178`). A user in several workspaces
  (`#939`, `workspace-switcher.tsx`) therefore cannot be joined with `appScope()`, and after joining must
  switch workspace (`authClient.organization.setActive`) before the trip exists for them.
- **Access rules for session-less reads are written down and this is a new surface.** `docs/ACCESS.md` §3
  ("Three surfaces are reachable without a session") lists `/share/$token` and `/packs`; §3.5 (noindex), §3.6
  (identical 404, three rate budgets) and §3.7 (`src/server/public/**` is the only session-less read path, holds
  no SQL, constructs no tenant scope) all name only those. `/join/$token` is a fourth.
- Trip-member isolation, the unique `trip_members_trip_user_unq` index, `TripMemberExistsError`,
  `TRIP_MEMBER_ROLES = ['owner','editor','viewer']` (`schema.ts:265`), `membershipRoleFor`
  (`provisioning.ts:119`), `mirrorToRoom` (`src/server/fns/context.ts`) and the tenant audit trail
  (`src/server/audit/trail.ts`) all exist and are reused.

Missing, from the traveller's side: _I made a trip with six friends who are all in our workspace. I do not want
to find each of them in a list; I want to paste one link into the chat._ And from the invitee's side: _I tapped
a link, I have an account, now what?_

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                            | Not owned (read only, or left alone)                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/db/schema.ts` - edit: table `trip_invite_links`; `drizzle/` - one generated migration (`pnpm db:generate`, never hand-edited)                                                                                                                                                                                               | `share_links`, `src/server/repos/trips.ts` share-link functions (07-S6's, untouched)                                                            |
| `src/server/db/types.ts` - edit: `TripInviteLink`, `NewTripInviteLink`                                                                                                                                                                                                                                                                  | `src/routes/(auth)/accept-invitation.$invitationId.tsx`, `(auth)/-server/invitation.ts` (the workspace invitation)                              |
| `src/server/repos/invites.ts` - new: the invite repository, the owner-side writers and the unscoped resolver; `src/server/repos/index.ts` - edit: one export line                                                                                                                                                                       | `src/server/repos/members.ts` (`addMember`, workspace seats)                                                                                    |
| `src/server/repos/trips.ts` - edit: extract `insertTripMember` (Phase 2), add `joinTripByInvite` (Phase 4)                                                                                                                                                                                                                              | `assertTripRole`, `anotherOwnerExists`, `removeTripMember`, `updateTripMember` (read only)                                                      |
| `src/server/public/secret.ts` - new (or imported if the calendar stage landed first, see Phase 2): mint, derive, digest. `src/server/public/rate-limit.ts` - new if absent: the per-IP buckets. `src/server/public/trip-invite.ts` - new: the whitelisted projections                                                                   | `src/server/calendar/**` (06-S5's; `calendar/secret.ts` is re-pointed only if it exists, see Phase 2)                                           |
| `src/routes/join/$token.tsx` - new route (**`pnpm generate-routes`**, the regenerated `routeTree.gen.ts` travels in the diff); `src/routes/join/-server/join.ts`; `src/routes/join/-ui/join-card.tsx`                                                                                                                                   | `src/routeTree.gen.ts` (generated, never hand-edited)                                                                                           |
| `src/routes/_app/trips/$tripId/-server/invite.ts` - new: the owner's server functions; `-server/people.ts` - edit: `TripPeoplePayload` gains `invite`; `-ui/invite-link-panel.tsx` - new; `-ui/people-screen.tsx` - edit: one mount point                                                                                               | `src/components/ui/**`, `src/styles/**` (no primitive and no token is added), `package.json`, `pnpm-lock.yaml`                                  |
| `src/routes/(auth)/register.tsx`, `verify-email.tsx` - edit (Phase 1); `(auth)/-lib/redirect.ts` - read only                                                                                                                                                                                                                            | `src/server/do/**` (no new entity kind; the signal is a patch on the existing `trip` kind)                                                      |
| `src/server/audit/trail.ts` - edit: three action names                                                                                                                                                                                                                                                                                  | `src/server/billing/**` (no metric; see Quota)                                                                                                  |
| `src/lib/i18n/messages/<locale>/trips.ts` - edit, **all 23 locales**                                                                                                                                                                                                                                                                    | `e2e/places-and-maps.spec.ts`, `e2e/trips-core.spec.ts`, `e2e/journeys.spec.ts` (other plans' declarations)                                     |
| `docs/ACCESS.md` §3, §3.5, §3.6, §3.7 - amend; `docs/SPEC.md` §6 `server/public` bullet; `docs/DEPLOY.md` (the `BETTER_AUTH_SECRET` rotation note); `CONTEXT.md` - two terms                                                                                                                                                            | The plan file `docs/plans/07-collaboration-and-sharing.md` (the `Delivered:` line is added by whoever closes the last ticket, not by this spec) |
| Tests: `src/server/repos/__tests__/invites.test.ts`, `tenant-isolation.test.ts` (append), `src/server/public/__tests__/`, `-server/__tests__/invite.test.ts`, `src/routes/join/-server/__tests__/join.test.ts`, component tests, `e2e/collaboration-and-sharing.spec.ts` (append the `describe`, or create the file if `07-S2` has not) |                                                                                                                                                 |

**The plan's file-ownership reasoning no longer binds** (tickets are implemented one at a time). Its
`e2e/collaboration-and-sharing.visual.spec.ts` and `e2e/__screenshots__/...` are **struck**: ADR 0016 removed
screenshot baselines; the visual judgement is the blind A/B pair (`scripts/visual/capture.mjs`).

### The object, and its vocabulary

A **trip invite link** is the single secret URL a trip owner can hand out to put workspace members on the
trip. A **workspace invitation** is the Better Auth email invitation that makes someone a workspace member.
`CONTEXT.md` records both, with "Avoid: invite link for the workspace invitation, and invitation for the trip
link". "Share token" (read-only, session-less, one named projection) is a third thing and stays as it is.

### Data: `trip_invite_links` (Phase 2)

One table, one migration, additive. Columns:

- `id` from `pk()`; `organization_id` from `orgRef()` (cascade); `trip_id` not null referencing `trips` with
  cascade delete.
- `token` text not null: the **SHA-256 hex digest** of the secret, never the secret.
- `rotation` integer not null default 0: the counter the secret is derived from (Secret, below).
- `role` text not null default `'viewer'`: the trip role a joiner receives. **No `CHECK`**, as the plan says
  (and for the reason `00-foundations.md` gives: a later change to a `CHECK` is a table rebuild); the narrowed
  Zod enum `z.enum(['editor','viewer'])` guards every write and the join re-parses the stored value.
- `created_by` `userRef('created_by')` not null: the owner who last minted, replaced, re-enabled or re-roled the
  link (it moves with every such write, see Liveness).
- `disabled_at` nullable epoch ms; `last_used_at` nullable epoch ms; `use_count` integer not null default 0 with
  `nonNegativeCheck`; the standard `timestamps()`.
- Indexes: unique on `token`; unique on `trip_id` (one rotating link per trip, enforced by the database); and
  `(organization_id, trip_id)` as the tenant-convention composite.

Backfills nothing. A new table is a new table, not a scope on `share_links`: a public read token and a membership
grant differ in lifecycle, authorisation, cost of a leak and meaning of revocation, and one query between the two
is where the first mistake becomes a stranger on a trip.

### The secret (Phase 2)

The owner must be able to copy the same link again (a link is sent to friends over several days; "regenerate to
re-copy" would make regeneration a daily habit and kill the link the second friend has not used yet). The secret
is therefore **derived, not stored**:

- `subkey = HKDF-SHA256(BETTER_AUTH_SECRET, info = "planned.travel/trip-invite-link/v1")`, via `crypto.subtle`
  (HMAC is already used in the Worker at `src/server/billing/polar.ts:301`; the first test proves HKDF in the
  workerd test pool). The raw auth secret is never used as an HMAC key directly: a token-forging key stays apart
  from Better Auth's signing. No new Worker secret and no new binding: this is not a deployment change.
- `secret = base64url(HMAC-SHA256(subkey, linkId + ":" + rotation))`, the full 32 bytes (43 characters).
- Stored `token = hex(SHA-256(secret))`.
- **Regenerate bumps `rotation` in the same `UPDATE` as the new digest**, so a value is never reused. Re-enabling
  a disabled link **also** bumps it: switching a link off and on must not revive copies already sent.
- `src/server/public/secret.ts` exports `deriveInviteSecret(linkId, rotation)`, `hashInviteSecret(secret)` and
  the 43-character shape guard. If `src/server/calendar/secret.ts` exists when this phase is implemented, the
  shared digest becomes `public/secret.ts` and the calendar module is reduced to a re-export (or its callers
  re-pointed) **in the same PR**; if it does not, only `public/secret.ts` is created and the calendar stage
  imports it. Never two digest implementations.
- **Leak model, for the spec's reader:** a D1 dump alone yields SHA-256 digests of 256-bit values - no usable
  link. D1 plus `BETTER_AUTH_SECRET` yields every live link, but that pair already forges sessions, so nothing
  new is exposed. **Rotating `BETTER_AUTH_SECRET` invalidates every invite link and fails closed**: the derived
  secret no longer hashes to the stored digest. `docs/DEPLOY.md` gets a line beside the existing rotation
  warning, and the owner's panel treats "derived digest differs from stored digest" as the **stale** state
  ("This link no longer works. Replace it.").
- Only a trip **owner** may read the secret: a separate repository function `revealTripInviteSecret(scope, tripId)`
  behind `requireTrip` and `assertTripRole(['owner'])`. `readTripInvite` and every other read return **no secret
  field**, and a test pins that. The server function that returns the URL answers
  `Cache-Control: private, no-store`.

### Repository: `src/server/repos/invites.ts` (Phase 2)

Built on `createTenantRepository`; exports:

- `readTripInvite(scope, tripId)` - the row's non-secret fields, or `null`. `requireTrip` first.
- `revealTripInviteSecret(scope, tripId)` - owner only, derives the secret (above).
- `rotateTripInvite(scope, tripId, role)` - owner only, `requireWritableTrip`; **mint and regenerate are one
  verb**: an upsert on the unique `trip_id` that sets `rotation = rotation + 1` (or 0 on insert), the new digest,
  `role`, `created_by = scope.ctx.userId`, `disabled_at = null`. The previous secret stops resolving on the
  next request with no grace period.
- `updateTripInvite(scope, tripId, { role?, enabled? })` - owner only; switching off sets `disabled_at`; switching
  on clears it **and bumps `rotation`/digest**; any call sets `created_by` to the actor.
- `touchTripInvite(scope, inviteId)` - increments `use_count`, sets `last_used_at`; called only by a successful
  join, never by a read.
- `findLiveTripInviteByDigestUnscoped(db, digest)` - **the one unscoped function**. Named with the `Unscoped`
  suffix and following the shape the calendar spec fixes (`unscoped-shape.test.ts`: a plain `Database`, a narrow
  projection, a single named caller registered in the test's map). It takes the **digest**, not the secret, so
  hashing stays in `public/secret.ts`. It returns `{ id, organizationId, tripId, role, createdBy }` or `null`
  for: an unknown digest, a disabled row, a role outside the narrowed enum, an archived trip, a creator who is no
  longer an owner of the trip, and a creator who is no longer a workspace member - **all in one statement**, so a
  dead link of any kind is the same `null` (Liveness, below). A point lookup on the unique `token` index plus
  two indexed `EXISTS`.
- `readInvitePreview(db, invite, { details })` - builds the read scope **inside `src/server/repos`**
  (`createScope(db, { organizationId: invite.organizationId, userId: invite.createdBy, role: 'member' })`) and
  returns the named projection (below). `src/server/public/**` never constructs a scope (ACCESS §3.7 rule 2).

### Liveness: when a link is honoured

A link is **live** only while all of these hold, evaluated at render **and again at submit**:

1. its digest matches and `disabled_at` is null;
2. its `created_by` is still an **owner** of the trip and still a **member of the link's workspace** (so a
   demoted, removed or departed owner's links stop granting access without anyone remembering to rotate them;
   any owner's replace, re-enable or role change takes the link over by setting `created_by` to themselves);
3. its trip is not archived (a new membership is a write; `requireWritableTrip` already refuses writes to an
   archived trip);
4. its stored `role` passes the narrowed enum.

A failure of any of these is the same `null`, the same 404, the same "unavailable" card with no reason shown. The
**owner's** panel is the one place that says why: "This link stopped working because the person who created it is
no longer an owner. Replace it."

### The anonymous read: `src/server/public/trip-invite.ts` (Phase 3)

`docs/ACCESS.md` §3.7 and `docs/SPEC.md` §6 make `src/server/public/**` the only session-less read path, with
column-whitelisted projections, no SQL and no fabricated scope. So the route's loader does not resolve a token
itself: it calls `resolveTripInvite(secret, request)` in `public/trip-invite.ts`, which (1) applies the rate
limit, (2) shape-checks and hashes the secret, (3) calls `findLiveTripInviteByDigestUnscoped`, (4) calls
`readInvitePreview`, and returns one of the closed set of projections:

| Visitor                                             | Projection                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                                           | `{ state: 'invited', tripTitle, inviterName, inviterImage, role }` - **nothing else**                                                       |
| Signed in, member of the link's workspace           | `{ state: 'invited', ...above, startDate, endDate, destination }` or `{ state: 'member', tripId, organizationId }` when already on the trip |
| Signed in, **not** a member of the link's workspace | `{ state: 'needs-workspace', tripTitle, inviterName }`                                                                                      |
| Anything else (all dead links)                      | `{ state: 'unavailable' }`, HTTP **404**, one identical body                                                                                |

**Never visible, anywhere on this surface:** the workspace's name, slug, id or logo; the inviter's email or user
id; `use_count`, `created_by`, the digest, the secret; the trip's id and organization id (except in `member`,
and in a successful join's answer, to a verified workspace member); dates, destination and cover before sign-in
as a workspace member. The visible and never-visible lists are written into `docs/ACCESS.md` §3.8 (new) in the
same change as the code, and §3 intro's "Three surfaces" becomes "Four".

Why the anonymous card is reduced: ADR 0007 keeps a private trip invisible to non-members, and a forwarded URL
reaches people the owner never picked. Name plus dates plus destination plus a real name is the most sensitive
combination on the page, and it is shown only to someone already in the workspace.

**Route behaviour.** `/join/$token` is a top-level route outside `_app` (no auth guard runs; an anonymous visitor
is never bounced), default SSR, with `head` meta `robots: noindex, nofollow` and **no Open Graph or Twitter tags**
(a link unfurled in a chat channel would show the trip title to everyone there). Every response, found or not,
carries `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` (the secret is in the path and the page
links out) and `Cache-Control: private, no-store`; `robots.txt` does not disallow `/join/` (ACCESS §3.5: a
disallowed path is never fetched, so the directive would never be read). The `/join/` path segment is redacted
from logs and Sentry URLs. A GET **never writes**: no `use_count`, no `last_used_at`, so a crawler or a
link-preview bot costs no D1 write.

### Rate limiting (Phase 2, used in Phases 3 and 4)

`src/server/public/rate-limit.ts` is the one implementation, written to the `RateCounterStore` shape of
`src/server/metering/rate.ts` and the key scheme of ACCESS §3.6 (`public:rl:<v>:...`). **If the calendar stage
landed it first, import it and add only what is missing; never a second copy.**

- per IP, all public routes: 120 per minute; per IP, **failed resolutions** ("misses"): 20 per minute, then the IP
  budget is spent; per resolved link (keyed by the link id, never its digest): 60 per minute. Over budget is `429`
  with `Retry-After`.
- **Every dead link counts against the miss budget**, whatever killed it, so the status and body never say
  which kind it was.
- **The authenticated join submit is rate limited too** (per user and per IP).
- KV unavailable **fails open**; token resolution **never** does (an unresolvable secret is a 404 whatever KV is
  doing).

### The join (Phase 4)

**Why not `addTripMember`.** It is the owner's verb: `requireTrip` (readability), the owner assert, and the target
must be a workspace member. A joiner satisfies none of the first two. So the stage adds **one writer next to it**
and **extracts the part that must not exist twice**:

- **Phase 2 (no behaviour change):** extract the `tripMembersRepository.insert(...)` plus the
  unique-violation-to-`TripMemberExistsError` translation out of `addTripMember` into one internal
  `insertTripMember(scope, values)` in `trips.ts`; `addTripMember` keeps its three guards and calls it. The
  existing `addTripMember` tests run unchanged and must stay green.
- **Phase 4:** `joinTripByInvite(db, invite, user)` in `trips.ts`. Its order is fixed:
  1. re-resolve the link by digest (`findLiveTripInviteByDigestUnscoped`, so Liveness applies again) - a rotated,
     disabled or orphaned link is `{ outcome: 'unavailable' }` and nothing is written;
  2. `role = membershipRoleFor(authDb(), { userId: user.id, organizationId: invite.organizationId })`,
     narrowed with `isOrganizationRole`; `null` is `{ outcome: 'needs-workspace' }`, no write. **The session's
     `activeOrganizationId` and any request-supplied id are never used;**
  3. the joiner is not banned (`user.banned` is false);
  4. build the scope `createScope(db, { organizationId: invite.organizationId, userId: user.id, role })`;
  5. read the trip by `invite.tripId` under the tenant filter (**not** the readability predicate: a joiner
     cannot read a private trip yet); not archived;
  6. `insertTripMember(scope, { tripId, userId: user.id, role: invite.role, joinedAt: now })` with
     `invitedBy = invite.createdBy` (the joiner is not the inviter); a unique violation is
     `{ outcome: 'member' }`;
  7. `touchTripInvite` - only on `joined`, never on `member`.

  It returns `{ outcome, scope }` so the server function can mirror and audit with the same scope.

- **The role is the row's, never the request's.** The request carries the secret and nothing else; the stored
  role is re-parsed against the narrowed enum, so a hand-edited row can never grant `owner`.
- **The race.** Between step 1 and step 6 a rotation can land (milliseconds). The membership written is the one
  the link's holder legitimately held a moment earlier and it escalates nothing; the window is accepted and
  stated, not engineered away.
- `src/routes/join/-server/join.ts` holds the POST server function `joinTripFn({ secret })`: session required
  (`requireUser`), rate limited, calls the repository, then `mirrorToRoom(scope, tripId, [patch('trip', tripId,
{ people: <token> })])` (reached inside the handler from `#/server/fns/context`, as `plan.ts` does) so anyone
  with the trip open sees the new member, and `trail(scope, ...)` (audit, below). It returns
  `{ outcome: 'joined' | 'member', tripId, organizationId }` **only** after the workspace-membership check, and
  `{ outcome: 'needs-workspace' }` or `{ outcome: 'unavailable' }` with no ids.
- **Audit.** `src/server/audit/trail.ts` gains three names (its docblock says tenant-security events get names in
  the stage that ships their writes): `trip_invite.rotated`, `trip_invite.updated` (disable, enable, role change)
  and `trip.member_joined` (joiner, link id, role). An impersonated session may join (ACCESS §6.4) and the
  impersonator's id goes into the row's metadata.
- **Bans.** A ban is enforced when a session is created; immediate effect depends on the console deleting the KV
  session key and may lag up to 60 s (`session.ts:60-69`). The explicit `banned` check above is the second guard;
  the lag is acceptable.
- **Email verification is not required** (`requireEmailVerification` is false, `auth/index.ts:252`) and adds no
  protection here, because the joiner must already be a workspace member.

### The sign-in round trip (Phases 1, 3, 4)

- The anonymous card has two actions that return to this exact URL: **Sign in** (`loginHrefFor('/join/<secret>')`,
  the `?redirect=` contract of `(auth)/-lib/redirect.ts`) and **Create an account**
  (`/register?redirect=<same>`). The secret is never put in a cookie or local storage; it stays in the URL.
- **Phase 1 repairs the registration leg.** `register.tsx` passes `target` into the verification landing for the
  email path (`handOff('/verify-email?redirect=<target>')`, the `callbackURL` carrying it too), `verify-email.tsx`
  gains `redirect` in its `searchSchema`, and its "Continue" link and the post-verification landing go to
  `safeRedirect(search.redirect)` instead of `DEFAULT_REDIRECT`. This also repairs the workspace-invitation
  round trip.
- Signed in, the card is the same URL rendered again with the session: `invited` with the full preview, `member`,
  or `needs-workspace`. "Join this trip" calls `joinTripFn`.
- **After a join (or `member`) the client switches workspace and then navigates**: `authClient.organization
.setActive({ organizationId })` (the call `useWorkspaceSwitch` makes) with `router.clearCache()`, then
  `router.navigate({ to: '/trips/$tripId', params: { tripId } })`. It happens on the explicit "Open the trip"
  action, which names the target; nobody's workspace changes silently. If the joiner is already in the trip's
  workspace, no switch is made.
- **What a rotation does to an open tab.** `/join/<secret>` is a rendered invitation with no socket. The secret is
  re-resolved when the join is submitted, so a link replaced or switched off while someone was reading it fails
  that submission and the card swaps to **unavailable** in place - no membership is written and no error page
  is shown. Nothing already granted is taken back: a person who joined before the replacement stays on the
  trip, and removing them is the people screen's path; the panel says so in one line.

### The workspace boundary (decision, not accident)

A joiner who is not a member of the link's workspace is **not** added to the trip. The `needs-workspace` state
is shown **only for a live link** (dead links stay `unavailable`), shows no workspace name, slug, id, member
count or inviter email, creates no workspace invitation and no request-to-join, notifies nobody and uses no
seat. Its copy: ask the person who invited you to add you to their workspace first. The plan's pointer to
`accept-invitation.$invitationId` is dropped: that route needs an invitation id this card does not have, and a
pointer without an identifier is a dead end. Whether a trip link may ever lead into the workspace, and on what
seat terms, is a product call recorded under Out of scope.

### The owner's panel: `invite-link-panel.tsx` on the people screen (Phase 5)

Owner-only, mounted by `people-screen.tsx` (one mount point; the file is 1305 lines and does not grow by a
feature). A non-owner sees nothing, not a disabled control. The loader payload `TripPeoplePayload` gains
`invite: InvitePanel | null` (`null` for a non-owner), carrying the non-secret fields plus the derived
**state**:

- `none` - never minted: an `EmptyState` on `--color-surface-2`, "No invite link yet", primary action "Create link".
- `active` - the URL (revealed by `revealInviteLinkFn`, `Cache-Control: private, no-store`), a `CopyValue`
  control, the **role** as a `Select` (editor, viewer - never owner), a `Switch` "Anyone with the link can
  join", "Replace link" behind a `ConfirmDialog` (says plainly that everyone holding the old link loses it
  immediately, and that people who already joined stay on the trip), and the use count (`tabular-nums`) with
  the last-used time.
- `off` - the switch is off; the URL is hidden; switching on issues a **new** secret (bumped rotation).
- `stale` - "This link no longer works. Replace it." (the secret no longer matches its digest, e.g. after a
  `BETTER_AUTH_SECRET` rotation).
- `creator-gone` - the owner-facing sentence from Liveness above, with "Replace link".
- `archived` - the trip is archived: no mint, the panel says so (a link on an archived trip resolves as
  unavailable and cannot be minted).

Server functions in `src/routes/_app/trips/$tripId/-server/invite.ts` (the module owning the panel's verbs; the
repository `invites.ts` owns the concept): `revealInviteLinkFn` (GET), `rotateInviteLinkFn`,
`updateInviteLinkFn` (role / enabled). Zod v4 `z.strictObject`, the `error` parameter naming the field, the role
as `z.enum(['editor','viewer'])`. The guards (`assertTripRole` owner, `requireWritableTrip`) live **in the
repository**, not in the handler, so a queue consumer or a later route cannot skip them. Refusals the panel has
copy for cross the wire as a code (`attempted`'s idiom in `people.ts`), never as a sentence.

Feedback after someone joins: the new member appears live in the people list (room mirror) with the link's
creator as the inviter, and the panel's use count and last-used time move on the next read.

### Quota

Two countable rows and the honest accounting is short.

- **The link** is one row per trip, structurally capped by the unique index on `trip_id`. It is not sold and not
  metered; nothing is added to `resolveLimits()`, `PLAN_QUOTAS` or `src/server/billing/__tests__/limits.test.ts`.
- **The trip membership** goes through `insertTripMember`, the same single insert path `addTripMember` uses, so a
  future `assertQuota` placed there covers both. Today `addTripMember` asserts no quota and there is no
  `trip_members` metric. The join consumes **no seat**: a joiner must already be a member of the link's
  workspace, so `addMember` (`src/server/repos/members.ts:152`, the `members` metric) already counted them. A
  trip can never hold more members than the workspace has seats; that derived bound is what this stage relies on.
  Adding a metered `trip_members` ceiling is a catalogue change (key, resolver arm, published number, equivalence
  case, `assertQuota` in `insertTripMember`) and not this stage's to make.
- **The per-IP bucket** on the public resolution is this stage's real ceiling and bounds unauthenticated cost.

## 📝 Architecture

| Concept                                  | Owner module                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| The invite link record and its writers   | `src/server/repos/invites.ts`                                                                 |
| Trip membership rows (one insert path)   | `src/server/repos/trips.ts` (`insertTripMember`; `addTripMember`, `joinTripByInvite` call it) |
| Secret derivation and digest             | `src/server/public/secret.ts` (shared with the calendar stage)                                |
| Per-IP public rate limits                | `src/server/public/rate-limit.ts` (shared with the calendar stage)                            |
| What a stranger may see of an invitation | `src/server/public/trip-invite.ts` (projections only, no SQL, no scope)                       |
| The unscoped digest lookup               | `findLiveTripInviteByDigestUnscoped` in `repos/invites.ts`, single named caller               |
| The landing                              | `src/routes/join/**`                                                                          |
| The owner's controls                     | `-server/invite.ts`, `-ui/invite-link-panel.tsx` on the people screen                         |

Dependencies run route -> server function -> repository; `components/ui` fetches nothing; `src/server/public/**`
constructs no `TenantScope` (a test asserts it, as ACCESS §3.7 requires); all SQL stays in `src/server/repos`.
`docs/SPEC.md` §5 and §6 and `docs/ACCESS.md` §3.7 gain `findLiveTripInviteByDigestUnscoped` as a named
exception of the same kind as the calendar feed's, **by the same amendment if the calendar stage landed it**
(then this stage only adds its function and its named caller to the map in `unscoped-shape.test.ts`); otherwise
this stage writes the amendment and the test, and the calendar stage adds its own function to them. The
decision record (ADR) for that amendment, if one is needed, takes the next free number at write time (0037 or
later; `0035` and `0036` exist).

## 📝 Data Model

See "Data: `trip_invite_links`". No other table changes. `trip_members` gains no column; `invited_by` already
exists and records the link's creator.

## 📝 API Contracts

| Function                                 | Method | Auth            | Input (Zod v4 `strictObject`)          | Answer                                                                                                       |
| ---------------------------------------- | ------ | --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `loadInvite` (join loader, session-less) | GET    | none (optional) | `{ secret: string(43) }`               | one of the closed projections above; 404 for `unavailable`; 429 over budget                                  |
| `joinTripFn`                             | POST   | session         | `{ secret: string(43) }`               | `{ outcome: 'joined'\|'member', tripId, organizationId }` or `{ outcome: 'needs-workspace'\|'unavailable' }` |
| `revealInviteLinkFn`                     | GET    | trip owner      | `{ tripId }`                           | `{ url } `, `no-store`                                                                                       |
| `rotateInviteLinkFn`                     | POST   | trip owner      | `{ tripId, role: 'editor'\|'viewer' }` | `{ ok: true, url }` or `{ ok: false, reason }`                                                               |
| `updateInviteLinkFn`                     | POST   | trip owner      | `{ tripId, role?, enabled? }`          | `{ ok: true, url? }` (a new url on switch-on) or `{ ok: false, reason }`                                     |

## 📝 UI/UX

- **Landing card.** Five presentations, each designed: **invited** (anonymous: trip title, the inviter's avatar and
  name, the role offered, two actions - Sign in, Create an account; signed in: plus dates and destination, one
  primary action "Join this trip"), **joining** (the action in its loading state), **already a member** (a quiet
  confirmation and "Open the trip"), **needs a workspace invitation**, **unavailable** (on `--color-surface-2`,
  sign-in and marketing links as the exit). Guest chrome: `SkipToContent`, `MarketingHeader`, `MarketingFooter`
  from `src/components/marketing/chrome.tsx` (the same shell the share page will use). At 360px the card is the
  whole screen with the primary action above the fold.
- **Owner's panel.** As specified under "The owner's panel". Every control has rest, hover, focus-visible, active,
  disabled and loading states. Skeleton: the card outline with a title bar and a button-sized block. Error: an
  `Alert` variant `danger` with "Try again".
- **Reused primitives:** `Card`, `Button`, `Avatar`, `Badge`, `Alert`, `EmptyState`, `Skeleton`, `Separator`,
  `Switch`, `Select`, `Tooltip` from `#/components/ui`; `CopyValue` from `components/modules/shared`; the
  people screen's local `ConfirmDialog` pattern for "Replace link". No primitive and no token is added
  (`--color-surface-2`, `--color-canvas`, `--radius-xl`, `--shadow-card` with its re-declared dark counterpart,
  `--space-4`/`--space-6` exist).
- **Motion.** The card enters at 220 ms on `--ease-out-quint` with a 6px rise; the state change after joining
  cross-fades at 150 ms; transform and opacity only; `prefers-reduced-motion: reduce` collapses both to opacity.
- **Accessibility.** WCAG 2.2 AA in both themes; one focus target for the primary action; the skip link; the state
  changes are announced through a polite live region; the switch, select and copy control have names; the
  secret URL is shown in a monospaced, selectable element and is never the only way to copy it (the copy control
  announces "Copied"); colour is never the only signal of `off` / `stale`.

## 📝 Visual change expected

| Route                        | States that change on screen                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/join/$token` (new)         | invited (anonymous), invited (signed in), joining, already a member, needs a workspace invitation, unavailable (404), loading skeleton, error |
| `/trips/$tripId/people`      | the owner's "Invite link" panel: none, active, off, stale, creator-gone, archived, loading, error; unchanged for a non-owner                  |
| `/register`, `/verify-email` | no visual change; the destination after verification changes when a redirect is present                                                       |

Each is captured in **light and dark**, at **360px (mobile), 1280px (desktop) and 2560px**, by the blind A/B pair
(`scripts/visual/capture.mjs`), the anonymous frames **without** the cached session.

## 📝 Copy

Keys land in the source locale `src/lib/i18n/messages/en/trips.ts` and, in the same change, in **all 23 locales**
(`i18n-messages` skill; the parity test enforces it). Namespaces `join.*` and `invite.*`. No sentence is composed
by concatenation.

| Key                         | Text (`en`)                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `join.title.invited`        | `{inviter} invited you to a trip`                                                                                                                 |
| `join.trip.label`           | `Trip`                                                                                                                                            |
| `join.role.label`           | `You would join as`                                                                                                                               |
| `join.role.editor`          | `Editor - can change the plan`                                                                                                                    |
| `join.role.viewer`          | `Viewer - can read the plan`                                                                                                                      |
| `join.action.signIn`        | `Sign in to join`                                                                                                                                 |
| `join.action.register`      | `Create an account`                                                                                                                               |
| `join.action.join`          | `Join this trip`                                                                                                                                  |
| `join.action.joining`       | `Joining...`                                                                                                                                      |
| `join.action.open`          | `Open the trip`                                                                                                                                   |
| `join.action.openIn`        | `Open the trip and switch workspace`                                                                                                              |
| `join.member.title`         | `You are already on this trip`                                                                                                                    |
| `join.needsWorkspace.title` | `This trip is in a workspace you are not part of`                                                                                                 |
| `join.needsWorkspace.body`  | `Ask {inviter} to add you to their workspace first, then open this link again.`                                                                   |
| `join.unavailable.title`    | `This invitation is not available`                                                                                                                |
| `join.unavailable.body`     | `The link may have been replaced or switched off. Ask whoever sent it for a new one.`                                                             |
| `join.unavailable.home`     | `Back to planned.travel`                                                                                                                          |
| `join.error.title`          | `We could not load this invitation`                                                                                                               |
| `join.error.retry`          | `Try again`                                                                                                                                       |
| `join.error.rateLimited`    | `Too many attempts. Wait a minute and try again.`                                                                                                 |
| `join.joined.announce`      | `You joined {trip}`                                                                                                                               |
| `invite.title`              | `Invite link`                                                                                                                                     |
| `invite.description`        | `Anyone in this workspace who opens the link joins the trip.`                                                                                     |
| `invite.empty.title`        | `No invite link yet`                                                                                                                              |
| `invite.empty.body`         | `Make one link, paste it into your group chat, and the people you send it to can join.`                                                           |
| `invite.action.create`      | `Create link`                                                                                                                                     |
| `invite.link.label`         | `Invite link`                                                                                                                                     |
| `invite.copy`               | `Copy link`                                                                                                                                       |
| `invite.copied`             | `Link copied`                                                                                                                                     |
| `invite.role.label`         | `People who join become`                                                                                                                          |
| `invite.role.editor`        | `Editors`                                                                                                                                         |
| `invite.role.viewer`        | `Viewers`                                                                                                                                         |
| `invite.switch.label`       | `Anyone with the link can join`                                                                                                                   |
| `invite.switch.offHint`     | `Switching it back on makes a new link. Links you sent earlier stay dead.`                                                                        |
| `invite.uses`               | `{count, plural, one {Used # time} other {Used # times}}`                                                                                         |
| `invite.lastUsed`           | `Last used {when}`                                                                                                                                |
| `invite.replace.action`     | `Replace link`                                                                                                                                    |
| `invite.replace.title`      | `Replace this link?`                                                                                                                              |
| `invite.replace.body`       | `Everyone holding the old link loses it immediately. People who already joined stay on the trip; remove them from the list below if you need to.` |
| `invite.replace.confirm`    | `Replace link`                                                                                                                                    |
| `invite.stale`              | `This link no longer works. Replace it.`                                                                                                          |
| `invite.creatorGone`        | `This link stopped working because the person who created it is no longer an owner. Replace it.`                                                  |
| `invite.archived`           | `This trip is archived. Restore it to make an invite link.`                                                                                       |
| `invite.error.title`        | `The invite link did not load`                                                                                                                    |
| `invite.error.retry`        | `Try again`                                                                                                                                       |
| `invite.refusal.archived`   | `This trip is archived.`                                                                                                                          |
| `invite.refusal.notOwner`   | `Only a trip owner can change the invite link.`                                                                                                   |

The register/verify screens add no key: the destination changes, not a sentence.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                                                 | Behaviour                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Secret malformed, unknown, rotated away, switched off, trip archived, creator no longer an owner or in the workspace | One 404 "unavailable" card, identical body; every one counts against the per-IP miss budget                                 |
| KV unavailable                                                                                                       | The limiter fails open; resolution is unaffected and never fails open                                                       |
| Over budget                                                                                                          | `429` with `Retry-After`; the card shows `join.error.rateLimited`                                                           |
| Signed in as a member of the trip already                                                                            | `member` state; `use_count` unchanged; no write                                                                             |
| Signed in, not in the link's workspace                                                                               | `needs-workspace`; no write; no ids in the answer                                                                           |
| Joiner's active workspace is another one                                                                             | Joined correctly (membership checked against the link's workspace); "Open the trip and switch workspace"                    |
| Two tabs submit the join together                                                                                    | The unique index makes the second `member`; `use_count` counts one                                                          |
| Link replaced while a tab is open                                                                                    | Submit re-resolves, the card swaps to unavailable in place, nothing is written                                              |
| Owner demoted / removed / left the workspace                                                                         | Their links go dead (`creator-gone` in the owner panel); another owner's "Replace link" takes it over                       |
| Role changed after sending                                                                                           | Applies to people who join **after** the change; nobody already on the trip is changed                                      |
| `BETTER_AUTH_SECRET` rotated                                                                                         | Every link fails closed; the panel shows `stale`; `docs/DEPLOY.md` says so                                                  |
| Banned or impersonated joiner                                                                                        | Banned: refused (`needs-workspace`-free, treated as `unavailable`); impersonated: allowed, impersonator id in the audit row |
| Email registration with a redirect                                                                                   | Returns to the link after verification (Phase 1)                                                                            |
| A crawler or unfurl bot GETs the URL                                                                                 | No write, no Open Graph, `noindex`, `no-store`                                                                              |

## 📝 Observability

The tenant audit trail gets `trip_invite.rotated`, `trip_invite.updated` and `trip.member_joined`. Resolution
misses and 429s are logged with the **redacted** path (never the secret) and the hashed IP bucket; no log line,
Sentry event or analytics URL carries the secret.

## ✅ Acceptance criteria

1. An owner with no link sees "No invite link yet"; "Create link" shows a copyable URL. A viewer or editor of the
   same trip sees no panel at all.
2. Copying the URL twice, on different days, gives the same URL. Replacing the link gives a different URL and
   the old one answers 404 on its next request.
3. Opening the URL in a fresh context shows the trip title, the inviter's name and avatar and the role offered
   - and no dates, destination, workspace name, ids or email. The response carries `noindex`, `no-referrer`
     and `no-store`, and there is no Open Graph tag.
4. A signed-in member of the trip's workspace who is not on the trip joins in one action and appears in the
   people list of everyone who has the trip open, with the link's creator as the inviter and the link's role.
5. A member of two workspaces whose active workspace is the other one joins correctly and opens the trip after
   the explicit workspace switch.
6. A signed-in non-member of the workspace sees the `needs-workspace` card, and no `trip_members` row exists.
7. A rotated, switched-off, orphaned or archived-trip link shows the identical 404 card, writes nothing, and
   counts against the miss budget.
8. Registering with email from the link returns to the link after verification.
9. No query, response or log returns the secret except `revealInviteLinkFn` / `rotateInviteLinkFn` to a trip owner;
   a test pins it.
10. `owner` can never be granted by a link: not by the input, not by a hand-edited row.
11. Tenant isolation: A cannot read, replace, switch off or reveal B's invite, and B's row is byte-identical
    afterwards.
12. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `bash .ai/scripts/check-generated.sh` and `pnpm build` are green;
    the 23-locale parity test is green; the browser journey passes; zero console errors, zero layout shift after
    paint.

## 📝 Risks & Impact Review

- **A forwarded link grants membership.** Mitigated by: editor/viewer only (default viewer), workspace-member
  requirement, creator-liveness, owner-only mint, one-click replace, no write on GET, three rate budgets.
- **A stranger learns a trip exists.** Mitigated by the reduced anonymous card and the identical 404.
- **Derived secret.** A leaked `BETTER_AUTH_SECRET` plus D1 reveals live links; that pair already forges sessions.
  Rotation fails closed and is documented.
- **Two stages write the same shared helper.** First-lander-creates with an explicit re-point rule; a test pins
  that `src/server/public/**` constructs no scope and that exactly one digest implementation exists.
- **Backward compatibility.** Additive table, additive routes, additive audit names; the `addTripMember` refactor
  changes no signature and no behaviour. `TripPeoplePayload` gains an optional field (`BACKWARD_COMPATIBILITY.md`
  contract surface checked per ticket).
- **Security/tenancy rating:** `risk-medium`, `security`. The spec was approved by the security and tenancy
  specialist under the conditions recorded in the Resolved assumptions table.

## 📋 Phasing

| #   | Phase                                                                                                                     | Visible when it merges                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Carry `?redirect=` through email registration and verification                                                            | Registering from any `?redirect=` link returns to it       |
| 2   | Table, repository, shared secret + rate-limit modules, `insertTripMember` extraction, docs, CONTEXT, audit names          | Nothing (no UI, no route)                                  |
| 3   | The anonymous `/join/$token` landing: invited and unavailable, headers, rate limit                                        | A seeded token renders; nothing can mint one yet           |
| 4   | The join: sign-in round trip, `joinTripByInvite`, member and needs-workspace states, workspace switch, room mirror, audit | Joinable by a seeded token only                            |
| 5   | The owner's panel on the people screen: create, copy, role, switch, replace                                               | **The feature is on end to end**                           |
| 6   | States, motion, accessibility pass, the browser journey and the A/B visual pair                                           | Polish; `COL-11` is not counted done before Phase 5 merged |

## 📋 Implementation Plan

Each phase is one tracer-bullet ticket. A phase never leaves the product half-built: Phases 3 and 4 are unreachable
until Phase 5 can mint a link, which is why the panel is last of the functional phases.

### Phase 1 - Return to the target after email registration (a standalone fix)

1. `register.tsx`: for the email path, `callbackURL` and the hand-off carry `target` whenever it is not
   `DEFAULT_REDIRECT` (`/verify-email?redirect=<encoded target>`).
2. `verify-email.tsx`: add `redirect: z.string().optional()` to `searchSchema`; the "Continue" link and the
   post-verification landing use `safeRedirect(search.redirect)`.
3. Tests: `register`/`verify-email` unit tests for the three cases (no redirect, a safe path, an unsafe path that
   falls back to `/dashboard`); the workspace-invitation round trip is exercised by the same change.
4. Grep: `grep -rn "verify-email" src docs` and update every document that states the registration flow.

### Phase 2 - The record, the repository and the shared modules

1. `schema.ts`: `tripInviteLinks`; `pnpm db:generate` (one `CREATE TABLE`, three indexes, no rebuild, no `DROP`,
   one journal entry; review it, never hand-edit); `types.ts`.
2. `src/server/public/secret.ts` and `rate-limit.ts` (or import them if the calendar stage landed; re-point
   `calendar/secret.ts` in the same PR if it exists). Tests: the derivation is deterministic for one
   `(linkId, rotation)`, differs for another, HKDF works in the workerd pool, the digest is hex SHA-256.
3. `repos/invites.ts` and the export line in `repos/index.ts`; the functions above; `insertTripMember`
   extraction in `trips.ts` (no behaviour change; the existing `addTripMember` tests are the proof).
4. `unscoped-shape.test.ts` and the `docs/SPEC.md` §5/§6, `docs/ACCESS.md` §3.7 amendments **if absent**;
   otherwise add the function and its caller to the map. `docs/ACCESS.md` §3 gains §3.8 (the `/join/$token`
   lists), §3.5 and §3.6 name the route. `docs/DEPLOY.md`: the rotation note. `CONTEXT.md`: two terms.
5. `trail.ts`: the three names (and the action-name test).
6. Tests (Tenant isolation, below).
7. Grep (CODE_REVIEW "Docs and CI"): `grep -rn "share_links\|accept-invitation\|addTripMember\|Three surfaces" docs src CONTEXT.md`.

### Phase 3 - The anonymous landing

1. `public/trip-invite.ts` (`resolveTripInvite`, the projections), `repos/invites.ts` `readInvitePreview`.
2. `src/routes/join/$token.tsx`, `-server/join.ts` (`loadInvite`), `-ui/join-card.tsx`: invited (anonymous and
   signed-in) and unavailable; the headers; the 404; the redaction of the path from logs and Sentry; `noindex`.
3. `pnpm generate-routes`; inspect the regenerated tree in the diff.
4. i18n: the `join.*` keys in all 23 locales.
5. Tests: the projections' columns are exactly the whitelist; every dead-link kind yields the same body and
   status; a GET writes nothing; the rate-limit cases; no `TenantScope` is constructed under
   `src/server/public/**`.

### Phase 4 - The join

1. `joinTripByInvite` in `trips.ts`; `joinTripFn`; the `member` and `needs-workspace` states; "Open the trip"
   with the workspace switch; the room mirror; the audit row; the per-user and per-IP rate limit.
2. Tests (handler level and repository): a member of A only using B's link writes no row; a member of A and B
   with A active joins B's trip and the row carries B's `organization_id`; the request body's role is ignored;
   `owner` in a hand-edited row is refused; already-a-member is `member` and does not touch `use_count`; a banned
   user is refused; a demoted, removed or departed creator kills the link; an archived trip kills the link; a
   rotation between resolve and submit fails the submit; the answer carries no ids except for `joined`/`member`.

### Phase 5 - The owner's panel

1. `-server/invite.ts`, `-ui/invite-link-panel.tsx`, the `invite` field of `TripPeoplePayload`, the mount point.
2. i18n: the `invite.*` keys in all 23 locales.
3. Tests: owner-only reveal (an editor, a viewer, a workspace admin who is not on the trip and another workspace
   are refused or `NotFoundError`); the digest-only read has no secret field; the old secret stops resolving
   right after replace; role cannot be `owner`; every state of the panel renders.

### Phase 6 - States, motion and the journey

1. Loading and error states, the motion and the live-region announcements; the A/B visual pair, 360/1280/2560,
   light and dark.
2. `e2e/collaboration-and-sharing.spec.ts`: one `test.describe('07-S10 - ...')`. The owner (cached demo session)
   creates a link, a **fresh anonymous context** opens it and sees the invitation with a sign-in action that
   carries `?redirect=`, the owner replaces the link, and the old URL shows the unavailable card with status 404.
   The completed join needs a second workspace member whose credentials the e2e environment does not carry; it is
   covered by Phase 4's handler-level tests with seeded members, not by a browser.
3. Layout shift after the settle mark; console silent.

## Verification

- Gate, in order (`validation.commands`): `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `bash .ai/scripts/check-generated.sh`, `pnpm build`; plus `pnpm exec vitest run --project=tooling scripts/specs`
  for this spec.
- `pnpm generate-routes` in Phase 3 (a route file is added); the tree is inspected, not edited.
- `pnpm generate-spec-index` after any change to this spec.
- Migration review (Phase 2): one `CREATE TABLE`, three indexes, no rebuild.
- The 23-locale parity test per the `i18n-messages` skill.
- Browser: Phase 6's journey, anonymous half in a fresh context rather than `AUTH_STATE`; console silent.

### Tenant isolation test

`trip_invite_links` joins the `cases` table of `tenant-isolation.test.ts` so it inherits the five standing
assertions. A new `describe` in A's scope: reading B's trip invite by B's trip id is `NotFoundError`; replacing,
updating, revealing B's invite is `NotFoundError`, with B's row **byte-identical afterwards** (`token`,
`rotation`, `use_count` included); touching B's invite id is `NotFoundError`. `invites.test.ts` covers the
unscoped resolver: a valid digest resolves to its own organization and trip and no other; every kind of dead
link (disabled, rotated away - asserted by replacing and then resolving the old value in the same test -,
archived trip, creator demoted, creator removed from the trip, creator removed from the workspace, role outside
the narrowed enum) resolves to `null`; `readInvitePreview` can read that trip and raises `NotFoundError` for any
other trip id; a joiner who is not a member of the row's organization is refused and no `trip_members` row is
written. Functions covered: `readTripInvite`, `revealTripInviteSecret`, `rotateTripInvite`, `updateTripInvite`,
`touchTripInvite`, `findLiveTripInviteByDigestUnscoped`, `readInvitePreview`, `joinTripByInvite`.

## Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, and:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on the join action, the copy control, the role select,
      the switch and the replace confirmation.
- [ ] Empty, skeleton and error states designed on `--color-surface-2`, including the never-minted owner state
      and the unavailable landing.
- [ ] Motion 150-260 ms on `--ease-out-quint`, transform and opacity only, `prefers-reduced-motion` honoured.
- [ ] Light and dark parity with dark shadows re-declared; the landing is designed in dark, not inherited.
- [ ] 360px, 1280px and 2560px; at 360 the landing card is the whole screen with the action above the fold.
- [ ] Keyboard reachable end to end, skip link, one focus target for the primary action, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint.
- [ ] The grep of CODE_REVIEW "Docs and CI" is run and the terms searched are in the PR body.

## Out of scope

- A trip link that adds the person **to the workspace** (a seat decision; a person's call - whether it may ever
  be offered, and on what seat terms). Until then a friend without a seat in the workspace needs a workspace
  invitation first.
- A notification or audit entry for the owner on each join (the live people list and the use count are the
  feedback); expiry dates; a use cap; more than one link per trip; guests (`trip_guests`); a QR code, share sheet
  or `mailto:`; a pending-approval step; the `owner` role as a link grant; email-verification gating;
  removing someone who joined (the people screen already does it).
- A `trip_members` quota metric (`TRP-11`'s, a catalogue change).
- `07-S6` (the public share link and the guest viewer): untouched; it may later add a share dialog that links to
  or embeds this panel.
- `closeTripRoom` still has no caller after this stage (it evicts a socket on **removal**, `TRP-11`'s path).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                             | Applied default                                                                                                                                         | Why                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is the stage one complete slice, and who does the link add?                          | Existing members of the trip's **workspace**; everyone else gets an honest dead-end naming the inviter; narrowing of `COL-11` stated                    | Decided by product owner sub-agent (confidence medium): a link that grants workspace membership takes a seat and is the outcome the plan names unacceptable; every new account has its own workspace, so the slice serves people already in the workspace and says so. |
| 2   | Depend on `07-S6` or build the shared infrastructure?                                | Own neutral modules, **first-lander creates**: `public/secret.ts`, `public/rate-limit.ts`, the unscoped-shape test; import if the calendar stage landed | Decided by software architect sub-agent (confidence high): waiting blocks a stage nothing will unblock; three copies break SPEC §8; two real callers justify the shared module and a later move is a one-file rename.                                                  |
| 3   | Where do the owner's controls live?                                                  | An owner-only panel on the people screen (`invite-link-panel.tsx`), not `share-dialog.tsx`                                                              | Decided by software architect (confidence medium) and product owner (confidence high): the people screen is the trip's membership surface; a one-tab dialog has no reason to exist and its trigger belongs to `07-S6`.                                                 |
| 4   | How does the join write the membership?                                              | Extract `insertTripMember` from `addTripMember`; add `joinTripByInvite` beside it; the invite row is the authorisation                                  | Decided by software architect (confidence high): `addTripMember` demands an owner and a readable trip; faking the inviter's identity is rejected; one insert path keeps a future quota covering both.                                                                  |
| 5   | Where does the unscoped resolver live?                                               | `repos/invites.ts`, `...Unscoped(db, digest)`, single named caller; the preview scope is built inside repos                                             | Decided by software architect (confidence high): ACCESS §3.7 gives `public/**` no SQL and no scope; the `billing.ts` and calendar precedent.                                                                                                                           |
| 6   | Which roles may a link grant?                                                        | `editor` and `viewer`; default **viewer** (the plan said editor); never `owner`; Zod plus a re-parse at join                                            | Decided by security and tenancy sub-agent (confidence high): an address-less link is forwarded; a viewer default makes a mistaken click cheapest; owner is added by an existing owner.                                                                                 |
| 7   | Is a link honoured after its creator stops being an owner?                           | Only while `created_by` is an owner of the trip and a workspace member; any owner's replace/re-enable/role change takes it over                         | Decided by security and tenancy sub-agent (confidence high): no signed credential outlives its signer; the owner panel says why.                                                                                                                                       |
| 8   | Archived trips; what the anonymous card shows                                        | Archived: unavailable. Anonymous: title, inviter name and avatar, role only; dates and destination after sign-in as a workspace member                  | Decided by security and tenancy sub-agent (confidence medium): ADR 0007; name plus dates plus destination is the most sensitive combination.                                                                                                                           |
| 9   | Who does the join act as?                                                            | The joiner, with their role in the **link's** workspace via `membershipRoleFor`; never the active workspace; banned check; no email-verification gate   | Decided by security and tenancy sub-agent (confidence high/medium): `requireOrg` binds to the active workspace; verification is off globally and adds nothing for a workspace member.                                                                                  |
| 10  | A joiner whose active workspace differs                                              | Return `{tripId, organizationId}` only after the membership check; the client calls `setActive` on the explicit "Open the trip" action                  | Decided by security and tenancy sub-agent (confidence high): no leak beyond a workspace the person belongs to.                                                                                                                                                         |
| 11  | Dead-link status and headers                                                         | 404 with one body; `noindex` (meta and `X-Robots-Tag`), `no-referrer`, `no-store`, no Open Graph; GET never writes; path redacted in logs               | Decided by security and tenancy sub-agent (confidence high): the secret is in the path; ACCESS §3.5 and §3.6 on the sibling surface.                                                                                                                                   |
| 12  | Signed-in non-member of the workspace                                                | A distinct `needs-workspace` state for live links only, naming nothing and creating nothing                                                             | Decided by security and tenancy sub-agent (confidence medium): collapsing it into "unavailable" would send legitimate friends to support.                                                                                                                              |
| 13  | Can the owner copy the link again?                                                   | Yes: the secret is **derived** (HKDF subkey of `BETTER_AUTH_SECRET`, HMAC over `linkId:rotation`); only the digest is stored                            | Decided by product owner (confidence medium, "show once" breaks the promise) and security and tenancy sub-agent (confidence medium): a D1 dump alone yields nothing usable; no new binding; rotation fails closed.                                                     |
| 14  | Does the registration leg return to the link?                                        | Not today; Phase 1 fixes it (also repairs the workspace invitation)                                                                                     | Decided by product owner (confidence medium) after reading `register.tsx:169-178`: the plan's "registers, verifies and lands back" is false at HEAD.                                                                                                                   |
| 15  | Scope fences                                                                         | Notification/audit-on-join feedback, expiry, use cap, multiple links, guests, QR, approval, owner grant, verification gate: all out                     | Decided by product owner (confidence high): each is a separate feature; the live list and use count are the feedback.                                                                                                                                                  |
| 16  | Slicing                                                                              | Six tickets, panel last of the functional phases                                                                                                        | Decided by product owner (confidence medium): each merge leaves the product working; the feature turns on in Phase 5.                                                                                                                                                  |
| 17  | Is the "whether a trip link may lead into the workspace" question filed as an issue? | Not filed; recorded under Out of scope                                                                                                                  | A product call, not a defect; no run is blocked by it. Applied by the writer.                                                                                                                                                                                          |
| 18  | Does the join write a tenant audit row?                                              | Yes: `trip.member_joined`, `trip_invite.rotated`, `trip_invite.updated`                                                                                 | Required by the security and tenancy sub-agent's conditions; `trail.ts` names tenant-security events in the stage that ships their writes.                                                                                                                             |
| 19  | The plan's e2e visual spec and baselines                                             | Struck; one browser journey kept                                                                                                                        | ADR 0016 removed screenshot baselines. Applied by the writer.                                                                                                                                                                                                          |
| 20  | The completed join in a browser                                                      | Covered by handler-level tests with seeded members, not by e2e                                                                                          | The e2e environment carries one demo credential. Applied by the writer.                                                                                                                                                                                                |

## Panel verdicts

_Recorded after the review round (afk-plan-to-spec step 5)._
