# 0042. The trip invite link: a second Unscoped repos read and a derived, not stored, secret

Status: accepted
Date: 2026-10-17
Issue: #1020

## Context

A trip invite link is a bearer credential in a `/join/<secret>` path. A visitor who holds it has
no session and no tenant until its digest resolves a row, exactly like a calendar feed (ADR 0041).
Two questions needed a decision before the table could ship.

1. Where does the digest lookup live? SPEC §5 calls its exception list closed, and ACCESS §3.7
   gives `src/server/public/**` no SQL and no scope. ADR 0041 and ACCESS FU-3 already name a
   bounded `…Unscoped` shape for a credential lookup.
2. The owner must be able to copy the same link again, so a stored digest alone is not enough, and
   storing the secret in D1 would make a database dump a set of working links.

## Decision

**The lookup is the second function of the FU-3 shape.** `findLiveTripInviteByDigestUnscoped(db,
digest, key)` lives in `src/server/repos/invites.ts`, takes a plain `Database`, performs a unique
point lookup on the digest and returns only `{ id, organizationId, tripId, role, rotation, createdBy }`
for a live link, never content, secret or digest. Its sole production caller is
`src/server/public/trip-invite.ts` (`resolveTripInvite`), which holds no SQL and builds no scope.
Every other function in `invites.ts` takes a `TenantScope` through the tenant-scoped base
repository. Catalog keeps its closed list of two members; this is not a third.

**The secret is derived.** `subkey = HKDF-SHA256(key, salt = empty, info = purpose)` and
`secret = base64url(HMAC-SHA256(subkey, "<id>:<rotation>"))`, 43 characters. Only
`hex(SHA-256(secret))` is stored, in `token`. Replacing a link bumps `rotation`, so the old secret
no longer hashes to the stored digest. The `purpose` is drawn from a closed list in
`src/server/security/secret.ts`, a pure leaf with no SQL, binding or environment read: the key is
an argument. It sits outside `src/server/public/**` because repositories may import it (SPEC §6)
and may never import the session-less path. The key is `BETTER_AUTH_SECRET`; a dedicated binding
would be one more secret to deploy and rotate, and a leaked `BETTER_AUTH_SECRET` together with D1
already forges sessions, so coupling exposes nothing new.

**A key rotation fails closed in the finder, not in the digest.** After the key is rotated the
stored digest still matches a copy that was already sent. `findLiveTripInviteByDigestUnscoped(db,
digest, key)` therefore derives the secret again from the link id, its rotation and the current key
and returns the link only if its hash equals the presented digest. The check lives in the finder,
not in the resolver, so the visitor slice's join, which reaches the finder without the loader,
fails closed too. The owner's panel reports the same condition as `stale`.

**Liveness is re-checked on every read, with no revocation write.** A link is live only while its
creator is still an owner of the trip, still a workspace member and not banned, the trip is not
archived, the link is enabled, its role is `editor` or `viewer`, and its workspace is the trip's.
`rotated_at` arms the link: it must be at least the creator's `member.created_at` and
`trip_members.created_at`, so a creator who is removed and added again does not revive copies sent
before. Only `replace` and switch-on change `created_by` and `rotated_at`, and they bump the
rotation and the digest together, which is the takeover rule: another owner can take a link whose
creator is gone only by issuing a new secret.

**Accepted, and documented here:** an owner who is demoted and promoted again, without leaving the
trip, revives copies of their own link, because nothing records the demotion.

**Writes are compare-and-set.** D1 has no interactive transactions, so `replace` and `update`
carry the rotation the caller read in the `UPDATE`'s `WHERE` and report `changed`, with the state
that won, when it moved; creation is insert-if-absent on the unique `trip_id`. A switch-off also
moves the rotation (it issues no secret), so a panel loaded before it cannot replace the link and
quietly switch it on again.

**`insertTripMember` is extracted from `addTripMember`.** The join in a later phase writes a
membership as the joiner, in the link's workspace, where the three guards of `addTripMember` (an
owner of the trip, an organization member, an unarchived trip) do not apply. The extracted
function keeps the insert and the unique-violation translation; `addTripMember` keeps its guards
and calls it.

## Consequences

`unscoped-shape.test.ts` maps the new function to its one caller and a second check keeps SQL and
scope construction out of `public/trip-invite.ts`. Review greps every `Unscoped` caller; an
additional caller is a blocker. `/join/$token` is the finder's production caller (through
`src/server/public/trip-invite.ts`); the same module also calls `readInvitePreviewUnscoped`, a
read-only projection that the same map pins to the same single caller. Rotating `BETTER_AUTH_SECRET` now also invalidates every invite link, which
`docs/DEPLOY.md` says beside the existing rotation warning. Moving to a dedicated binding later
would invalidate the links once, and the purpose list is what keeps a later credential kind from
sharing a sub-key with an invite.

## Amendment (#1023)

The join lands as a fourth function of the same kind, `joinTripByInviteUnscoped(db, digest, key,
joiner)`, and it is the one **write**. It takes a plain `Database` because the joiner is not an owner
of the trip and cannot read a private trip yet, so no tenant scope exists until the function has
resolved the link and read the joiner's role in the link's workspace from `member`. Its single
production caller is `src/routes/join/-lib/join.ts`, for `joinTripFn` (POST, session required, rate
limited per user and per address); `unscoped-shape.test.ts` pins that. It refuses a banned joiner and
an impersonated session before it reads or writes anything, writes only through `insertTripMember`,
and counts a use only on a real join.
