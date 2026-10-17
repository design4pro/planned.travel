# A person's data can be erased across workspaces on request

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #811  |
| **Spec PR**        | #1002 |
| **Implementation** | none  |

## 📝 TLDR

The product has no path that reaches everything a person leaves in workspaces when they ask for their data to be
deleted. Console account deletion (`deletePlatformUser`) removes the Better Auth `user` row and lets the `member`,
`session`, `account`, `two_factor`, `passkey` and `invitation.inviter_id` rows cascade. The 47 `userRef()` columns across
the domain tables (trips, expenses, chat, files, journeys, audit) keep ids that now point at nothing, no R2 object is
touched, the person's personal workspace is left with no members, and the privacy page promises that "deleting your
account deletes your content".

This spec designs **one erasure engine** and fixes, for every place a person's data lives, exactly one outcome and a
reason: **remove**, **anonymise** (the row stays, the id becomes a per-workspace "Former member" id), **null** (an optional
reference is cleared), **revoke** (a credential that cannot be deleted) or **keep** (with the reason, and the person who owns the retention decision). The
shape in one paragraph: the erasure is a resumable queue job entered from the console's existing `user:delete`
permission; it finds the workspaces that hold the person's rows through a participation anchor that survives
departure; it scrubs each workspace through tenant-scoped repository functions driven by a registry that a test keeps
complete; it deletes a workspace the person was the last member of (the personal workspace included) together with its
R2 objects and trip-room state; it sweeps the stores outside D1; and it deletes the `user` row last. #807's refusal of a
sole owner of a team stays exactly as it is, and a live subscription blocks the erasure of a workspace it would delete.
Self-service stays with plan stage `09-S3`, which then calls the same engine.

The spec changes no code, schema or migration. It lands one note in `docs/plans/09-account-and-settings.md` (its R2
sweep prefix cannot reach today's keys) and two glossary entries in `CONTEXT.md`. Retention periods, the deletion window,
the legal basis for keeping anything and the privacy wording are **owner confirms** items, listed at the end and not
decided here.

## 📝 Problem Statement

Measured at HEAD (`86841140`), by reading the code.

### How deletion works today (nothing in this section changes in this spec)

- **The only deletion path is the console's.** `deletePlatformUser` (`src/server/fns/console/users.ts`) runs, in this
  order: `refuseSoleOwner` (#807: refuses a sole owner of a workspace other people belong to), `clearSessionCache` (the
  KV session blobs), `platformApi().removeUser`, `endSessionIndex` (`active-sessions-<userId>`), then one
  `platform.user.deleted` row in `platform_audit_log` whose `changes.before` holds the person's **name and email**
  (`auditUserState`). Self-service `user.deleteUser` is not enabled. `src/server/auth/index.ts` has no delete hook and no `organizationHooks`;
  it does have `user.create.after` (personal-workspace provisioning), a `user.update` ban tripwire and
  `session.create.before`, which provisions a personal workspace for a signed-in person who has none (see the engine's
  step 2: the ban must stop that hook before the personal workspace is deleted).
- **What cascades from `user`:** `session`, `account`, `two_factor`, `passkey`, `member` (all `ON DELETE CASCADE`) and
  `invitation.inviter_id`, so every invitation the person sent disappears in every workspace. Not cascading:
  `verification` (rows keyed by email, by token, or holding the user id in `value`, such as the app's
  `passkey-challenge:<challenge>` rows whose JSON value carries `userId`) and `session.impersonated_by` (plain text).
- **Dangling ids.** Every domain column that names a user is `userRef()`: a plain `text` column with no foreign key.
  There are **47** of them (48 matches of `userRef(` in `schema.ts`, one being the helper itself), in 41 tables (38 tenant tables and
  3 global ones); the three global ones are (`staff_api_tokens`, `platform_audit_log`, `provider_registry`, SPEC §5). After a deletion
  these ids point at nothing, nothing removes them, and nothing rewrites them. The comment above `userRef()` says user
  rows are removed "through the account-deletion flow, which fans out through the repositories"; no such flow exists.
- **The personal workspace.** Every signup gets one (`provisionPersonalOrganization`, `src/server/auth/provisioning.ts`).
  When its owner is deleted it keeps all its trips, files, journeys and its `subscriptions` row, with no member left.
  `deleteWorkspace` does not exist (plan 09 designs it). The console does not delete workspaces.
- **No R2 sweep.** The only object deletion is per trip (`trip-purge`, keys captured before the rows go) and per file.
  `exports/**` and `dead-letter/**` objects have no deleter; the weekly retention slot of `src/server/worker.ts` logs
  "cron half has no handler yet" for the R2 half. Journey deletion never touches R2.
- **Departure is not deletion.** A person leaves a workspace through Better Auth's organization endpoints or the console;
  only their `member` row goes (`removeMember` has no production caller). Their rows in that workspace stay under a live
  id, and nothing records that they were ever there once the `member` row is gone.
- **Audit.** The tenant `audit_log` has `pruneAuditLog`, which **nothing calls**: it has no retention. `platform_audit_log`
  is pruned at 400 days by the weekly cron and is append-only (`docs/ACCESS.md` §4.3).
- **Soft deletes keep text.** `deleteMessage` in `src/server/repos/collab.ts` only sets `deleted_at`; the message body
  stays in the row.
- **Other people's inboxes.** `notifications.title_params` / `body_params` carry `actorName` (the sender's display name,
  `src/server/notifications/dispatch.ts`) and `preview` (the first characters of a chat message,
  `src/server/fns/collab-thread-writes.ts`). A deleted person's name and words therefore sit in rows other people own.
- **Outside D1** (inventory in "Where a person's data lives"): session blobs and the `active-sessions-<userId>` index in
  KV, staged booking imports carrying `requestedBy`, queue envelope ids embedding user ids, dead-letter R2 objects with
  whole message bodies (auth emails with token URLs, `requestedBy`), `trips/` objects whose metadata holds `uploadedBy`,
  trip-room Durable Object storage stamped `by: <userId>`, recipient emails in `logAuth` console lines, and the Polar
  customer (the workspace; the purchaser's email).
- **Privacy page** (`src/routes/legal/privacy.tsx`): "deleting your account deletes your content" and "close your account
  and take the whole thing with it", with placeholders for the deletion window, the backup window and the log retention.
- **#807's refusal** (merged) keeps a team without an owner from happening through the console. It does not deal with a
  data-subject request, and its brief is not reopened here.

### Who has the problem

A person who asks for their data to be deleted and is not served; a workspace owner whose workspace keeps another
person's chat text, location history and expense shares under an id nobody can resolve; the operator who has no
procedure and no tool for an emailed request; and the next engineer who adds a `userRef()` column with no one telling
them it has to be erased.

## 📝 Proposed Solution

### Vocabulary (CONTEXT.md gains two entries in this spec's PR)

- **Erasure** - the removal, anonymisation or documented keeping of everything a person left, on request, across every
  workspace they ever took part in. _Avoid_ "account deletion" for it (that is only the `user` row), and "departure".
- **Former member** - the placeholder that stands for an erased person wherever their contribution to a shared record
  stays. One per workspace per erasure; it carries no name and cannot be traced to the person. Distinct from a member who
  merely left.

### The rule in one sentence

Erasure takes everything that is only the person's, keeps what other people's records need in order to stay true
(attributed to a Former member), and never takes a row another person wrote.

### Outcomes

| Outcome       | Meaning                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **remove**    | The row (or the person's part of it) is deleted. R2 keys it names are collected first and swept.                    |
| **anonymise** | The row stays; the person's id is replaced by the workspace's Former member id. Free text the person wrote is kept. |
| **null**      | An optional reference to the person is cleared.                                                                     |
| **revoke**    | A credential or link is switched off and its owner field anonymised, because it cannot be deleted or must not live. |
| **keep**      | Nothing changes, for a stated reason, until a retention rule owned by a person ends it.                             |

### The Former member id

`erased_<nanoid>`, one **per workspace per erasure**, no mapping stored once the job ends. Why not the alternatives:

- one global constant would break `expense_shares_expense_user_unq`, `collab_poll_votes` (unique on poll, user **and**
  option) and the vacay owner index as soon as two erased people share a record;
- an HMAC of the user id is reversible by whoever holds the key, so it is still personal data;
- one id for all workspaces would let anyone with access to two workspaces link the rows.

The id is held on the participation anchor row (below) until the job ends, so a resumed job reuses it. Readers render it
through one shared helper as the localised **Former member**.

### Where a person's data lives, and the outcome for each

#### 1. The participation anchor (new, the one schema addition the slices make)

A person's rows survive their departure, so finding workspaces through `member` misses them. A new tenant table
`workspace_participants` (`organization_id` through `orgRef()`, `user_id`; unique on organization and
user; an index on `user_id`; plus the job-state columns `erasure_id`, `tombstone_id`, `scrubbed_at`, all nullable) records
"this person took part in this workspace" and is **not removed on departure**. It is written wherever a `member` row is
created: Better Auth's organization plugin (create, accept invitation, add member) and the one direct insert in
`provisioning.ts`. A test lists every `insert(member)` call site and fails on one with no anchor write. The erasure removes the
person's anchor rows at the very end; the table keeps no user id once the job is done.

**Backfill.** People who left before the anchor existed are found by a one-off, idempotent **backfill job**, not by a
migration (a registry-driven `INSERT OR IGNORE` over the 38 tenant tables is not something `pnpm db:generate` emits, and a
hand-written `drizzle/*.sql` is a blocker, BACKWARD_COMPATIBILITY §1). It is a queue task, `participant-backfill`, one
message per organization, paged: the organization ids come from a second session-less catalog read of the same shape as
the discovery read (organization ids only, paged), and each message runs through a `TenantScope` bound to that one
organization, where it reads the distinct user ids of every registered `userRef` column and of `member`, and inserts the
anchor rows with `INSERT OR IGNORE`. Its cost is one read per table per organization, scanning rows in proportion to that organization's data (many tables
index only `(organization, trip)`), once; it is resumable and a
rerun is a no-op. **Ordering:** the anchor writes ship and deploy first, and the backfill runs after, so a `member` row
that an older Worker inserts during the window is still found because the backfill reads `member` too. **The engine fails
closed until the backfill has completed:** a completion record (a KV key set when the last organization page finishes,
recomputable by running the job again) is checked by discovery, and an erasure started before it is refused with a named
reason rather than run against an incomplete anchor.

The reads that list a person's workspaces and, for the backfill, all workspaces are **cross-tenant** and return
organization ids only. SPEC §5/§6 state that
the two stated exceptions to "all SQL goes through the tenant repository" are closed and that a third is a change to the
contract. This spec asks for that change explicitly: the read lives in `src/server/catalog/erasure.ts`, session-less in
shape (organization ids and the erasure id, paged; the backfill's listing returns organization ids and nothing else), guarded by its shape the way `listDueTripReminders` is, and **every
scrub then runs through a `TenantScope` bound to one workspace**. Merging this spec is the acceptance of that amendment;
the first slice writes it into SPEC §5/§6 and an ADR.

#### 2. Domain tables - all 47 `userRef()` columns

"Shared trip" = a trip with at least one other **trip member** (guests are not accounts and do not count). "Solo trip" =
no other trip member.

| Table.column                                                                                | Outcome                                                                                | Reason                                                                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `trips.created_by`                                                                          | anonymise (shared); row deleted with the trip (solo private)                           | The trip is the collaborators' record; a solo private trip is only the person's.                     |
| `trip_members.user_id`                                                                      | remove the row                                                                         | Membership is the person.                                                                            |
| `trip_members.invited_by` (other people's rows)                                             | null                                                                                   | Optional reference; nothing depends on it.                                                           |
| `trip_guests.created_by`                                                                    | anonymise                                                                              | The guest is a companion of the trip, not of the person.                                             |
| `trip_favourites.user_id`                                                                   | remove                                                                                 | Private bookmark.                                                                                    |
| `assignment_participants.user_id`                                                           | remove                                                                                 | A participant chip; others' stops are unaffected.                                                    |
| `day_notes.created_by`                                                                      | anonymise                                                                              | Plan content collaborators rely on.                                                                  |
| `packing_lists.owner_user_id` (not null)                                                    | remove the list and its items                                                          | A personal list is only the person's. `null` (shared list) is untouched.                             |
| `packing_items.assigned_to`                                                                 | null                                                                                   | The item stays, unassigned.                                                                          |
| `packing_templates.created_by`                                                              | remove (not shared); anonymise (`is_shared`)                                           | A shared template is workspace content.                                                              |
| `trip_files.uploaded_by`                                                                    | anonymise; the object stays; its `uploadedBy` R2 metadata is rewritten                 | The file is trip content. R2 metadata cannot be edited, so the object is re-put under the same key.  |
| `share_links.created_by`                                                                    | revoke (`revoked_at`) and anonymise                                                    | A session-less read link with no accountable creator must not stay valid; a trip owner can re-issue. |
| `expenses.paid_by`, `expenses.created_by`                                                   | anonymise                                                                              | Who owes whom must keep adding up (`paid_by` is never nulled).                                       |
| `expense_shares.user_id`                                                                    | anonymise                                                                              | Same.                                                                                                |
| `settlements.from_user_id`, `to_user_id`, `created_by`                                      | anonymise                                                                              | Same. A test proves balances are equal before and after.                                             |
| `collab_messages.user_id`                                                                   | anonymise, **clear `body`**, set `deleted_at`                                          | Keeps reply threads intact; the person's words go. Soft-deleted bodies are cleared in every case.    |
| `collab_message_reactions.user_id`                                                          | remove                                                                                 | A personal expression others do not rely on.                                                         |
| `collab_notes.created_by`, `collab_polls.created_by`                                        | anonymise                                                                              | Shared content.                                                                                      |
| `collab_poll_votes.user_id`                                                                 | anonymise                                                                              | The result must not change.                                                                          |
| `check_ins.user_id`                                                                         | remove                                                                                 | Location history.                                                                                    |
| `collections.owner_user_id`                                                                 | remove (no other contributor); anonymise the owner (places saved by others remain)     | Same rule as journeys, below.                                                                        |
| `collection_places.saved_by`                                                                | remove (own collection); anonymise (someone else's)                                    | The collection belongs to its owner.                                                                 |
| `visited_countries`, `visited_regions`, `travel_stats`, `bucket_list_items` (`user_id`)     | remove                                                                                 | Atlas data is only the person's.                                                                     |
| `vacay_plans.owner_user_id`                                                                 | remove (no invited member); anonymise the owner (the plan has invited members)         | Other members' entries must survive.                                                                 |
| `vacay_plan_members`, `vacay_user_years`, `vacay_entries`, `vacay_user_colours` (`user_id`) | remove the person's rows                                                               | Only the person's own days.                                                                          |
| `user_settings.user_id`, `notification_preferences.user_id`                                 | remove                                                                                 | Preferences.                                                                                         |
| `notifications.recipient_user_id`                                                           | remove                                                                                 | The person's inbox.                                                                                  |
| `notifications.sender_user_id`                                                              | remove the notification row                                                            | Its params carry `actorName` and a message `preview`; they cannot be recovered any other way.        |
| `journeys.owner_user_id`                                                                    | delete the journey when no other author's entry remains; otherwise anonymise the owner | See "Journeys".                                                                                      |
| `journey_entries.author_user_id`                                                            | remove the person's entries (and their photos), in every journey                       | The person's words and pictures.                                                                     |
| `journey_photos.uploaded_by`                                                                | remove; `storage_key` and `thumbnail_key` swept from R2                                | Collected before the row goes; nothing sweeps them today.                                            |
| `audit_log.actor_user_id`                                                                   | anonymise; `ip`, `user_agent` set to null; email and name keys dropped from `metadata` | The trail stays useful; the personal fields go. Filenames stay, the files stay.                      |
| `audit_log.entity_id` / `notifications.entity_id` equal to the person's id                  | anonymise                                                                              | Not `userRef` columns, so the verification sweep names them.                                         |

Three global tables, reached through `src/server/catalog` with a `system` actor:

| Table.column                                     | Outcome                             | Reason                                                                                                                              |
| ------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `staff_api_tokens.user_id`, `created_by`         | revoke (`revoked_at`) and anonymise | A hard delete is impossible: `platform_audit_log.token_id` points at the row `ON DELETE RESTRICT`.                                  |
| `provider_registry.updated_by`                   | anonymise                           | A mutable configuration row; the ceiling stays.                                                                                     |
| `platform_audit_log.actor_user_id` / `entity_id` | **keep** until the 400-day prune    | Append-only security ledger (`docs/ACCESS.md` §4.3), and its `CHECK`s forbid nulling an actor. Retention is an owner-confirms item. |

#### 3. Trips, by classification

- **Solo private trip** (no other trip member and `visibility` of `private` or `public`, or the workspace has no other
  member): `public` is reserved for session-less sharing and grants a signed-in reader nothing on its own (CONTEXT.md, ADR
  0007), so it is treated as private; its share links go with the trip. Deleted as
  `deleteTrip` does, including the `trip-purge` of its R2 keys and its trip-room reset. The person is the only reader.
- **Solo trip with `visibility = 'organization'` in a workspace that has other members:** kept and anonymised; the
  workspace's longest-standing owner becomes its trip owner (a `trip_members` row), because colleagues already read and rely on it.
- **Shared trip where the person is the only trip owner:** the longest-standing remaining editor (else viewer), ordered by
  `joined_at`, then `created_at`, then id, is promoted to owner. Several trip owners are allowed (CONTEXT.md), so this
  can be undone by a demotion. The promoted member and the workspace owners get a notification; an `audit_log` row records
  it without personal fields.
- **Shared trip, otherwise:** collaborators lose no rows. The person's contribution is anonymised or removed per the table above.

#### 4. Journeys (reuses ADR 0034; does not touch #799's quota)

The person's own entries and photos are removed everywhere, with their R2 objects swept. A journey the person owns is
**deleted** when no other author's entry remains in it, and otherwise **stays under the Former member as owner** with the
read rule unchanged: a journey tied to a readable trip stays readable to that trip's readers, and an orphaned journey
becomes unreadable by everybody, which is ADR 0034's existing "owner leaves" outcome. "A journey stays with its owner"
holds; no other member's entry is destroyed (the reason ADR 0034 rejected cascading with a trip). A short ADR amends 0034
to record the Former member owner. Journey creation has one production writer (`createJourneyFn` in `src/routes/_app/-server/library.ts`, which sets
`owner_user_id`); entries and photos are written only by the dev seed today. The rule is settled now so the entry and
photo writers do not decide it later.

#### 5. Auth tables and the account

The `user` row is deleted **last**; `account`, `session`, `two_factor`, `passkey` and `member` go with it through the
existing cascade. Also: pending and accepted `invitation` rows addressed **to** the person's email are deleted;
`verification` rows that name the person are deleted, by `identifier` and by `value`: the identifier equal to the email,
and the user id inside the identifier or the value (Better Auth's reset-password and OTP rows, and the app's
`passkey-challenge:` rows, whose JSON value carries `userId`; the Phase 3 ticket lists the key shapes from the installed
Better Auth source); sessions with `impersonated_by` = the person are ended;
`user.image` goes with the row and the future `avatars/<org>/<user>` object is swept. Invitations the person **sent**
cascade (changing that foreign key would be a table recreate and is not additive); the workspace owners are told how many
pending invitations disappeared.

#### 6. Stores outside D1

| Store                                                                                 | Holds                                                                                   | Outcome                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2 `trips/<org>/<trip>/…` (files, covers)                                             | Trip files; metadata `uploadedBy`                                                       | Removed with a deleted trip (`trip-purge`) and with a deleted workspace (prefix sweep). Kept for shared trips, metadata rewritten.                                                                                           |
| R2 `exports/<org>/<trip>/…`                                                           | Plan exports                                                                            | Swept with the workspace prefix. The `pdf-export` handler writes them (and a KV `export:<taskId>` record) but no producer enqueues it today, and nothing deletes them; whatever starts producing them ships its deleter.     |
| R2 journey photo keys                                                                 | Journey photos (no production writer; keys are caller-chosen, no org segment)           | Collected from `journey_photos` before the rows go; swept by key.                                                                                                                                                            |
| R2 `avatars/<org>/<user>`                                                             | Portrait (plan 09; not written today)                                                   | Swept by key when it exists.                                                                                                                                                                                                 |
| R2 `dead-letter/<date>/<id>.json`                                                     | Whole failed message bodies (emails with token URLs, `requestedBy`), **no org segment** | Not scanned per person. A date-prefixed retention deleter is a **prerequisite slice**; the erasure's own envelopes carry no user id.                                                                                         |
| KV `SESSIONS`: session blobs, `active-sessions-<userId>`                              | User row, ip, user agent                                                                | Purged by key before anything else (the console's `clearSessionCache` / `endSessionIndex`).                                                                                                                                  |
| KV `KV`: `billing:discount-attempts:u:<userId>`                                       | A counter                                                                               | Purged by key.                                                                                                                                                                                                               |
| KV `KV`: `import:booking-import:…` (24 h), `task:done:…` (24 h), `task:dead:…` (14 d) | `requestedBy`; envelope ids embedding user ids                                          | Left to expire. **Residual stated:** at most 14 days.                                                                                                                                                                        |
| KV rate-limit counters `<ip>                                                          | <path>`                                                                                 | An IP, no user                                                                                                                                                                                                               | Left to expire. |
| Durable Object `TripRoom` (one per trip)                                              | Entity fields and commit log stamped `by: <userId>`; presence in socket attachments     | Reset for every trip the person touched, shared or deleted alike: close sockets, `deleteAll`; D1 is the record and the room rebuilds. An active room never clears itself, so waiting for the 7-day idle erase is not enough. |
| Logs (Workers Observability, Sentry with `enableLogs`)                                | `logAuth` writes recipient emails; many lines carry `userId`                            | Not erasable per person. **Residual stated** until the log retention period (owner confirms). A slice stops logging recipient emails.                                                                                        |
| Resend delivery logs                                                                  | Recipient emails of auth and notification mail                                          | **keep**, third party: not erasable by this job. **Residual stated** until the provider's retention (owner confirms).                                                                                                        |
| Polar                                                                                 | The purchaser's email, name, keyed to the workspace                                     | **keep**: the erasure makes no Polar call. Tax records are kept as tax law requires (privacy page). Owner confirms.                                                                                                          |

#### 7. A workspace with no member left

Decided with the product specialist. After the person's data is scrubbed, a workspace whose **only member was the
person** is deleted **in the same erasure, immediately** (`deleteWorkspace`, one `organization` row; every tenant table
cascades through `orgRef()`). The personal workspace is the common case. There is no warning and no grace period: a
grace state would need an exit that runs without a person, and the retention handler it would need does not exist.
Before the row goes, the job captures the workspace's trip ids (for the room resets), then sweeps R2 by the **real**
prefixes (`trips/<org>/`, `exports/<org>/`, `avatars/<org>/`) plus the journey photo keys it collected, in batches of up
to 1,000 keys, resumably. Plan 09's sweep prefix `<organizationId>/` matches none of today's keys and would delete nothing;
the note this spec adds to plan 09 says so.

**Billing.** Only a paid subscription counts: a free workspace's `subscriptions` row has `plan = 'free'`, `status =
'active'` and no `provider_subscription_id` (the column defaults in `schema.ts`), and must not block. A workspace the
erasure would delete, with a row that has a `provider_subscription_id`, a status of `trialing`, `active`, `past_due`,
`unpaid` or `paused` and no cancel at period end, **blocks the erasure**: the console refuses, names the
workspace, and says to cancel in the billing portal or in Polar first. A subscription that is `canceled`, already
cancelling at period end, `incomplete` or `incomplete_expired`, and a free row, does not block. The code never cancels or refunds anything,
and a Polar webhook that arrives for a deleted organization id is accepted and does not recreate the `subscriptions` row.
Cancel-versus-refund policy, Polar customer retention and the cost effects are **owner confirms**.

#### 8. The sole owner of a team (#807)

#807's `refuseSoleOwner` stays unchanged and runs first. An erasure request against the sole owner of a workspace other
people belong to is **refused with the same message** and waits until ownership is handed over; the data subject cannot
force it, and nobody is promoted to owner for them (that would silently move billing ownership). The refusal changes
nothing, writes a `platform.user.erase_refused` audit row (request reference, no personal fields) and names the workspace
and the way out. If the operator wants the account switched off meanwhile they use the existing ban. Whether waiting on a
handover can exceed a statutory response deadline is a legal question and an **owner confirms** item.

### The engine

One idempotent, resumable queue job. The envelope carries an opaque `erasureId` (and per-workspace work carries the
anchor id), **never a user id**: dead letters keep whole bodies indefinitely.

1. **Refusals**, all before any change: self-target (existing); #807's sole-owner refusal (existing); a live subscription on a
   workspace that would be deleted (new). A refusal leaves rows, KV blobs and ledger exactly as they were.
2. **Make the account inert:** purge the session KV (existing `clearSessionCache`), revoke sessions, ban, so no write
   arrives during the job. The ban must also stop `session.create.before`, which provisions a personal workspace for a
   signed-in person who has none: an erasure test signs in as the banned person after their personal workspace is deleted
   and asserts no workspace is created. Notices go to trip owners and workspace owners (promotion, removed invitations, "a member's
   data was erased").
3. **Discover** the workspaces from the anchor (catalog read), set `erasure_id` on the anchor rows.
4. **Per workspace**, through a `TenantScope` bound to it. The job has no signed-in person, so the scope carries a
   reserved system user id and the `owner` role, the way `scopeForWorkspace` in `queue/handlers/billing.ts` builds a probe
   scope. Authorisation was decided once, at `user:delete`; the scrubs do not re-check the erased person's trip
   membership, so the trip deletion calls the purge body of `deleteTrip` without `requireOwnedTrip`, and `deleteWorkspace`
   passes `assertCanAdminister` through the owner role. A test runs both for a person who has already left and is banned, and asserts they succeed.
   The steps: classify trips; collect R2 keys; scrub D1 per module in a
   `runBatch`; enqueue `trip-purge`; record the room resets; set `tombstone_id` on first use and `scrubbed_at` at the end.
   A workspace left with no member is deleted instead of scrubbed, after the subscription check passed in step 1.
5. **Sweep** R2, KV and the rooms.
6. **Delete the `user` row** (`removeUser`), then `endSessionIndex`.
7. **Verify:** for every registered column, zero occurrences of the user id in every affected workspace and in the auth
   tables; the non-`userRef` places named above (`audit_log.entity_id`, `notifications.entity_id`, `invitation.email`,
   `verification.identifier` and `verification.value`, `session.impersonated_by`); `head` of the rewritten R2 keys; `active-sessions-<userId>` absent.
   `platform_audit_log` is the one registered exception.
8. **Finish:** delete the anchor rows (and with them every `tombstone_id`), write `platform.user.erased` with the request
   reference and per-table counts - **no name, email or user id** (its `entity_id` is the erasure id). From the first
   engine slice on, the console writes this row instead of the PII-bearing `platform.user.deleted`.

A failure at any step leaves the account banned and retries (the queue allows 5 deliveries, `wrangler.jsonc`); after the
last one the consumer dead-letters and acks the message, which leaves a banned account and an incomplete erasure. The
owner of that state is the operator. A resume is keyed by the `erasure_id`, never by the user, because after step 6 the
`user` row (and with it the console user detail and `readTargetUser`) no longer exists: the console lists **incomplete
erasures** from a catalog read of the anchor rows that still carry an `erasure_id` (erasure id, request reference, the step
reached, workspaces left; no name or email), and `resumeErasureFn({ erasureId })` re-enqueues the job, which reads the
user id from those anchor rows. The dead letter
also raises through `src/server/observability`. "Done" means the `user` row is gone **and** the verification
sweep passes. Collect-before-delete is the `trip-purge` rule, and R2 `delete` of an absent key succeeds, so a redelivery
finishes. Billing is not multiplied: one bounded job per erasure plus R2 delete calls.

### The registry, and keeping it complete

`src/server/erasure/registry.ts` is data only (no SQL): one entry per `userRef` column - table, column, outcome, reason,
owner module - and per non-`userRef` place. Each repository module owns the scrub of its own tables
(`eraseUser…(scope, userId, tombstoneId)` beside its other writers), so the SQL stays in `src/server/repos` behind the
tenant filter, and the orchestrator in `src/server/erasure/` holds none. A test reads `src/server/db/schema.ts`, extracts
every `userRef('<column>')` with its enclosing table, and **fails when the schema gains a column the registry does not
list, or the registry lists one the schema no longer has**. That test is the answer to "the next engineer who adds a
`userRef()` column".

### Tables that are specified but not built yet

Two other documents will add a place a person's data lives, and both are covered by the same drift test the moment they
land: `calendar_feeds.user_id` (`.ai/specs/2026-10-04-a-calendar-that-keeps-up-with-the-trip.md`, a `userRef()` column;
its outcome is **remove**, since a feed token for an erased person must not outlive them), and the legal acceptance
records of `docs/plans/13-content-studio.md` (no `organization_id`, reached by `eraseAcceptanceIdentity`; its own
minimisation is registered as a global-table entry that the engine calls, not reimplemented). Whichever ships second
adds its registry entry in the same change; the drift test fails otherwise.

### Entry points

- **Console (this spec's slices):** `user:delete` stays the only permission that may erase someone else's account, refused
  on the server for anyone else; `deletePlatformUser` stays exported and callable for
  one release and delegates to the engine's entry function with its old input and result shape (BACKWARD_COMPATIBILITY §2: a
  browser tab that loaded the previous bundle still calls it); `eraseUserFn` is additive, the console client switches to
  it, and a follow-up PR removes `deletePlatformUser`. The dialog requires the operator to
  type the target's email and a **request reference** (an opaque ticket id, max 280 characters like the ban reason, never
  personal data because it lands in `platform_audit_log`). No second reviewer (a pending-approval state would need an exit
  with no automatic route; whether to require one is an owner-confirms item).
- **Email requests:** a documented operator procedure (`docs/` page, a slice): confirm the request from the account's own
  address, record the ticket id, run the console action, answer with the result. The privacy contact address, response
  period and identity verification are owner confirms.
- **Self-service stays with plan stage `09-S3`.** It enables `user.deleteUser` (email confirmation, then password, then
  typing "delete") and its `beforeDelete` calls **this engine** instead of carrying its own workspace logic; plan 09's
  rules 2 to 4 are superseded by this spec (a note lands in plan 09 in this PR). The engine has one entry function and
  both callers get the same refusals.

### Export before deletion

Mentioned, neither offered nor enforced. The "Take it" promise on the privacy page (PDF itinerary, calendar file, GeoJSON)
is not backed by the product today, and enforcing an export would block a legitimate request on a feature that does not
exist. The deletion warning says the data cannot be recovered and does not link to an export. The gap is filed as a
finding, below.

### Alternatives considered

- **Discover workspaces through `member` only.** Misses every workspace the person already left; their expense shares,
  chat and check-ins would survive under a live id. Rejected.
- **Scan every workspace with scoped queries over 47 columns.** Still a cross-tenant read, and far larger. Rejected.
- **Leave dangling ids and only delete the `user` row (today).** The ids stay linkable to the platform ledger and to each
  other. Rejected for "an id outliving the account is still a personal identifier".
- **One Former member constant, an HMAC, or one id for all workspaces.** Rejected above.
- **Rewrite `platform_audit_log`.** Contradicts its append-only contract and its `CHECK`s; kept until the 400-day prune and
  listed as owner confirms.
- **Refuse or auto-promote on a sole-owner request.** Refusing the erasure is #807's rule and stays; auto-promotion moves billing.
- **A grace period before the job runs.** Adds a state without an exit and keeps the person's email for the warning.
  Reversible later: a grace window can be added in front of step 1, a shipped immediate deletion cannot be undone. The
  length is the privacy page's deletion-window placeholder (owner confirms).

## 📝 Architecture

Owners (docs/SPEC.md §8, one concept, one owner):

| Concept                                              | Owner                                                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The outcome of every place a person's data lives     | `src/server/erasure/registry.ts` (new, data only) and this spec                                                               |
| Scrubbing one module's tables                        | that module in `src/server/repos` (`eraseUser…`), through the tenant filter                                                   |
| Finding the person's workspaces; global-table scrubs | `src/server/catalog/erasure.ts` (new; the stated third exception)                                                             |
| Orchestration, ordering, resumption, verification    | `src/server/erasure/` (new) and the `person-erasure` handler in `src/server/queue/handlers/`                                  |
| Deleting a workspace                                 | `deleteWorkspace` in `src/server/repos/members.ts` (plan 09 minted the design; this spec's slice builds it, `09-S3` consumes) |
| Deleting a trip's and a workspace's R2 objects       | `src/server/storage/objects.ts` (adds a prefix sweep beside `deleteObjects`)                                                  |
| Resetting a trip room                                | `src/server/do/trip-room-client.ts` (adds a reset beside `closeTripRoom`)                                                     |
| The Former member label                              | one shared helper in `src/lib`, used by every list that shows a person                                                        |
| Session KV                                           | `src/server/fns/console/session-keys.ts` (reused)                                                                             |
| Who may erase someone else                           | the console `user:delete` permission only, enforced on the server                                                             |

Layering is unchanged: `components/ui` fetches nothing; routes call server functions in `src/server/fns`; a server function
never calls another server function (the console function calls the engine in `src/server/erasure`, which is not a server
function); every server-function input is Zod-validated.

## 📝 Data Model

Additive only (`BACKWARD_COMPATIBILITY.md` §1); this spec itself changes nothing.

- New table `workspace_participants` (above). `CREATE TABLE` and `CREATE INDEX` are additive. Rolling back means no longer
  reading it. Generated through `pnpm db:generate`, never by hand.
- No change to any existing column, foreign key or `ON DELETE` rule. The `invitation.inviter_id` cascade stays because
  changing it would be a table recreate.
- New queue task kinds `person-erasure` and `participant-backfill` (envelope: `erasureId` or anchor id, or an organization
  id; no user id). A Worker that predates a kind rejects it in `taskEnvelopeSchema`, dead-letters it and acks it, so the
  job would be lost without a trace. BACKWARD_COMPATIBILITY §6 therefore fixes the order: the kind and its handler ship
  and deploy in one release, inert, and the producer (the engine entry, the backfill trigger) ships in a later one.
- The tenant `audit_log` header says "rows are never updated" (`repos/audit.ts`). The erase function is the one updater,
  limited to `actor_user_id`, `entity_id`, `ip`, `user_agent` and the `metadata` keys named above; the Phase 3 ticket edits
  that header in the same change.
- New platform audit actions
  `platform.user.erased` and `platform.user.erase_refused`, added to `docs/ACCESS.md` §4.2's closed list in the same
  change that writes them.

## 📝 API Contracts

- `eraseUserFn` (console, `user:delete`): input `{ userId, confirmEmail, requestRef }`, Zod-validated; returns `{ erasureId }`;
  refusals reuse `ConsoleActionError` with new codes for the subscription gate and for an incomplete backfill.
  `deletePlatformUser` stays for one release as a delegating wrapper (see "Entry points"): the old input has no
  `requestRef` or `confirmEmail`, so the wrapper records the fixed request reference `legacy-console-delete` and takes the
  target from the user id alone (the old dialog's own confirmation stays in force), and its result now means "accepted, erasure queued", not
  "deleted"; the old client shows the existing success copy.
- `resumeErasureFn` (console, `user:delete`): input `{ erasureId }`; re-enqueues an incomplete erasure.
- The console reads the incomplete erasures through a catalog read of the anchor rows (see "The engine").
- `person-erasure` task: idempotent; a redelivery finishes.
- No public route. Self-service is `09-S3`'s.

## 📝 UI/UX

Console, user detail: the "Delete the account" action becomes **Erase the account**, a dialog that states what is removed,
what stays as a Former member and what cannot be recovered, asks for the target's email and a request reference, and
shows the refusals (sole owner of a team: existing text; live subscription: names the workspace and how to cancel). After
confirm it shows a progress/result state (running, done, blocked and retried). In the product, every place that shows a
person (expenses, settlements, polls, notes, files, chat, trip members, activity) renders the Former member through the
shared helper in the reader's locale instead of a blank or an id. Accessibility: the dialog is a labelled modal with focus
managed, the refusal is announced, the typed-email field has a visible label and a named error.

## 📝 Visual change expected

Console user detail (the erase dialog, three states: confirm, refused, done) at `/console/users/<id>`, light and dark,
desktop and mobile. In the app, the Former member label in the trip expense list, settlements, polls and chat, light and
dark, desktop and mobile. The slices that touch these screens capture them with the blind A/B pair (`verifying-changes`).

## 📝 Copy

New `en` keys (each lands in all 23 locales per the `i18n-messages` skill; names are indicative, the slice fixes them):

- `console:action.erase.item` - "Erase the account"
- `console:action.erase.confirm` - "Erase account"
- `console:action.erase.body` - "This removes what only this person owns, keeps what other people's records need under a Former member, and cannot be undone."
- `console:action.erase.emailLabel` - "Type the account's email to confirm"
- `console:action.erase.refLabel` - "Request reference (a ticket id, never personal data)"
- `console:action.erase.subscription` - "This would delete {workspace}, which has an active subscription. Cancel it in the billing portal or in Polar first."
- `console:action.erase.done` - "Account erased"
- `console:audit.action.erased` - "Account erased"
- `shell:person.former` - "Former member"
- `shell:notification.trip.owner_promoted.title` / `.body` - "{tripTitle} has a new owner", "A member's data was erased."
- `shell:notification.workspace.invitations_removed.title` / `.body` - "Pending invitations disappeared", "{count} pending invitations disappeared because a member's data was erased."

The existing sole-owner refusal text (a literal authored in the console target code, #807, beside the dialog hint
`console:action.delete.owners`) is reused
unchanged, and so are the other refusals of `deletePlatformUser`. The `action.delete.*` and `audit.action.deleted` keys
stay while `deletePlatformUser` exists and go with it in the follow-up PR. The privacy page wording
is not changed here (owner confirms).

## 📝 Edge Cases & Failure Scenarios

- **The person already left a workspace.** Found through the anchor; scrubbed like any other. Without a backfill that
  covers pre-anchor departures they would be missed, so the backfill job ships with the anchor and discovery fails closed until it has completed.
- **Two erased people on one expense or poll.** Distinct Former member ids; unique indexes hold. Tested.
- **The person is the only member of a team workspace.** It is deleted like the personal one; pending invitations go with it.
- **A job exhausts its deliveries.** The account stays banned, the erasure is listed as incomplete in the console, and the
  operator resumes it by `erasure_id` (see "The engine").
- **A job step fails half-way.** The account stays banned; the job resumes from `scrubbed_at` per workspace and reuses the
  `tombstone_id`. R2 deletes are idempotent.
- **`user` row deleted but verification fails.** The anchor rows are kept, so the job can be resumed by its `erasure_id`
  from the console's incomplete-erasures list; the account is inert.
- **A trip has no remaining owner and no eligible member.** Then it has no other member, which is the solo case.
- **A message is replied to.** The row stays (body cleared, `deleted_at` set) so `reply_to_id` keeps pointing at it.
- **An R2 object cannot be re-put (too large, missing).** Logged, retried; the verification sweep fails until it is fixed.
- **Free text the person wrote that names them** (an expense title, a place note) is content on a shared record and is not
  scanned. Stated residual.
- **Another workspace's rows.** A scope bound to workspace A cannot touch B (tested).
- **A concurrent write by the banned person.** The session KV is purged and sessions revoked first; a write that races
  the purge is caught by the verification sweep, which fails and retries.
- **Backups.** Routine backups hold the person's data until they expire (the privacy page's backup window, owner confirms).

## 📝 Observability

One structured log line per step with counts and the `erasureId`, never a user id, name or email. `platform.user.erased`
carries per-table counts. A failed step is raised through `src/server/observability` and visible in Workers
Observability.

## ✅ Acceptance criteria

The spec is met when this PR is merged by a person; the criteria below are what the sliced tickets must satisfy, and the
spec-level ones are checked now.

- [x] Every place a person's data lives is listed with one outcome and a reason: all 47 `userRef()` columns table by table,
      the auth tables including `invitation.inviter_id`, every R2 key family, the KV keys, trip-room storage, the audit
      tables including the catalog rows and `actor_user_id`.
- [x] How deletion works today is described without changing any of it.
- [x] A workspace with no member left is deleted immediately, billing is a gate rather than an action, and cost and billing
      effects are owner-confirms items.
- [x] #807's refusal and an erasure against a sole owner of a team fit together without reopening #807; ADR 0034's rule is
      reused; #799's quota is untouched.
- [x] For shared trips the spec says what happens to entries, expenses, settlements, messages, poll votes and uploads;
      private trips under ADR 0007 are covered; collaborators lose no rows.
- [x] The self-service path follows plan 09 and calls this engine; only console `user:delete` may erase someone else,
      refused on the server.
- [x] The spec does not enable `deleteUser` and changes no code, schema or migration; it uses CONTEXT.md vocabulary.
- [x] Retention periods, the deletion window, the legal basis and the privacy wording are listed as owner confirms and not decided.
- [x] `Issue` names #811, `Status` is `ready`, and the spec index is regenerated.
- [ ] (Sliced tickets) Every sliced ticket ships a cross-workspace tenant-isolation test (rows of another organisation are
      untouched) and states its own test seam.
- [ ] (Sliced tickets) After an erasure the verification sweep finds the user id nowhere except in the one registered
      `keep` row set.

## 📝 Risks & Impact Review

| Risk                                                                             | Mitigation                                                                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Irreversible deletion of the wrong rows (`risk-high`: tenancy, data loss)        | Every scrub runs through one `TenantScope`; collect-before-delete; per-slice isolation tests; the account is made inert first.     |
| A cross-tenant discovery read widens the tenancy contract                        | Organization ids only, paged, guarded by shape, in `src/server/catalog`; SPEC §5/§6 amended explicitly and accepted by the merge.  |
| The registry drifts from the schema                                              | The drift test fails on any `userRef` column added or removed without an entry.                                                    |
| A user id leaks through the erasure's own envelopes or logs                      | Envelopes carry an opaque id; the dead-letter deleter (Phase 7) is a prerequisite of the engine (Phase 6); logs carry counts only. |
| Anonymising money rows changes balances                                          | A balance-equality test before and after, with two erased people on one expense.                                                   |
| Deleting a workspace with a live subscription strands a paying customer          | The subscription gate blocks it; no code cancels or refunds.                                                                       |
| Plan 09's `beforeDelete` would sweep a prefix that matches no key                | Superseded by this spec; a note lands in plan 09.                                                                                  |
| Memberless workspaces already left by past console deletions                     | Listed as a finding, not fixed silently; a tool lists them and the same `deleteWorkspace` removes them.                            |
| The engine is lost on a Worker that predates `person-erasure`                    | Handler first, producer one release later (BACKWARD_COMPATIBILITY §6); the same order for `participant-backfill`.                  |
| Residual copies (logs, backups, 14-day KV, dead letters until the deleter ships) | Stated in the table; the periods are owner confirms.                                                                               |

### Out of scope

Implementation (sliced from this spec), the last-owner guard (#807), orphaned-journey handling and its quota (#799), the
overview meter (#809), stranded private trips (#810), enabling `user.deleteUser` or any self-service UI (`09-S3`),
changing the privacy page, building an export, cancelling or refunding a subscription, rewriting `platform_audit_log`,
and any change made by this PR to code, schema or migrations.

### Findings the slicing run files as issues (not part of the slices below)

- **F1. Memberless workspaces already exist** from past console deletions; they keep rows, files and a subscription row.
  A listing and a cleanup through the same `deleteWorkspace`.
- **F2. The privacy "Take it" promise** (PDF, calendar, GeoJSON export) has no product behind it.
- **F3. `dead-letter/` and `exports/` have no deleter**; the weekly retention slot is a logged no-op
  (`BACKUP_RETENTION_DAYS` is read and unused).
- **F4. `logAuth` writes recipient emails to console** on `email.queued` / `email.queue_failed`, against `logger.ts`'s "never log a raw email".
- **F5. Soft-deleted chat messages keep their body** (`collab.ts` `deleteMessage`).
- **F6. Tenant `audit_log` has `pruneAuditLog` and no caller**; the period is owner confirms.
- **F7. Presence falls back to the email as display name** when the name is empty (`api/trip-room/-lib/connect.ts`).
- **F8. Trip-purge's `belongsTo` comment is wrong for `dead-letter/`** (no org segment).

## 📋 Phasing

| Phase | Slice                                                                                                                     | Blocked by    | Usable when it merges                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------- |
| 1     | Registry, drift test, SPEC §5/§6 amendment, ADRs (erasure outcomes, ADR 0034 amendment), CONTEXT                          | none          | The contract exists and cannot drift; no behaviour changes |
| 2     | Participation anchor: table, writes, backfill job, catalog reads, isolation test                                          | 1             | Every workspace a person ever took part in can be listed   |
| 3     | Scrub functions per module (trips and money; collaboration; personal modules; journeys, vacay, collections; tenant audit) | 1, 2          | Each module can erase a person inside one workspace        |
| 4     | `deleteWorkspace`, R2 prefix sweep, trip-room reset, subscription gate                                                    | 1             | A memberless workspace can be deleted completely           |
| 5     | Non-D1 stores and the verification sweep as functions (KV keys, R2 metadata rewrite, DO resets, the sweep)                | 1, 2          | "Done" can be proven, not assumed                          |
| 6     | The engine job, console entry and dialog, refusals, notices, `platform.user.erased`, Former member label                  | 2, 3, 4, 5, 7 | An operator can erase an account end to end                |
| 7     | Prerequisites: dead-letter retention deleter, stop logging recipient emails, soft-delete body clear                       | none          | Residuals shrink; independent of the rest                  |
| 8     | Operator procedure page and the `09-S3` amendment                                                                         | 6             | An emailed request has a written procedure                 |

Phase 6 is the first one a person can see, and it does not start before the stores, the sweep (5) and the dead-letter
deleter (7) exist: a destructive console action must not ship without proof that it finished. Phases 1 and 7 can start
at once.

## 📋 Implementation Plan

Each phase is its own ticket and carries its own `risk-high` verdict from the security and tenancy specialist.

### Phase 1 - Contract

`src/server/erasure/registry.ts` (47 columns plus the non-`userRef` places), the drift test, the SPEC §5/§6 amendment and
ADR "Erasure outcomes", the ADR 0034 amendment (Former member owner), `docs/ACCESS.md` §4.2 actions. **Test seam:** the
drift test (add a `userRef` column in a fixture, see it fail).

### Phase 2 - Anchor

`workspace_participants`, the `participant-backfill` job (same two-release order as the engine's kind), writes at every `member` insert (the plugin's organization hooks if Better Auth 1.7.1 exposes
them for create, accept and add; the direct insert in `provisioning.ts`), the `insert(member)` call-site test,
`listWorkspacesHoldingUser` and the organization listing for the backfill in `src/server/catalog/erasure.ts`. **Test seam:** the catalog function through its interface
(returns organization ids only; a person who left is still found); tenant-isolation test.

### Phase 3 - Scrubs

One `eraseUser…` per repository module, `(scope, userId, tombstoneId)`. **Test seam:** each function at the repository
interface, per outcome row; a volume case with more rows than one D1 batch and its bound-parameter limit holds (chunked, no
truncation); the tenant `audit_log` header edit; cross-workspace tenant-isolation test per function (rows of another organisation are
invisible and unchanged); balance equality; two erased people on one record; a reply to an erased message. Phase 3 also owns the scrubs that are
not a tenant repository module: the auth-table cleanup (`verification`, `invitation` addressed to the email,
`session.impersonated_by`) and the global-table scrubs (`staff_api_tokens`, `provider_registry`) in
`src/server/catalog/erasure.ts`. The reserved-id `owner` scope is minted in one function in `src/server/erasure/` that
nothing on a request path imports, and a test asserts that no route or server function can obtain it. Phase 6 registers
the two new notification kinds (`trip.owner_promoted`, `workspace.invitations_removed`) in `NOTIFICATION_EVENTS` with
their default channels.

### Phase 4 - Workspace deletion

`deleteWorkspace` (organization-id predicate, `assertCanAdminister`, member count), `deletePrefix` in `storage/objects.ts`,
the room reset, the subscription gate. **Test seam:** `deleteWorkspace` (A's call leaves B untouched; refused with two
members); the prefix sweep with a fake bucket, 1,000-key batches, resumable; a Polar webhook for a deleted organization.

### Phase 5 - Stores and verification

KV key purges, R2 metadata rewrite, room resets, the verification sweep, as functions the engine calls. **Test seam:** the
sweep finds a planted id in each registered place and in each non-`userRef` place, and reports none after a full run.

### Phase 6 - Engine

`src/server/erasure/` orchestration, `eraseUserFn`, `resumeErasureFn` and the incomplete-erasures list, the console dialog, `refuseSoleOwner` first, notices, audit actions,
`deletePlatformUser` as a delegating wrapper. Two releases, in this order (BACKWARD_COMPATIBILITY §6): the `person-erasure`
kind and its handler, with nothing that enqueues it; then the producer. **Test seam:** the engine with in-memory stores
through its entry function: refusal leaves everything; a failure at each step resumes (and a dead-lettered job resumes
from the console); the job never puts a user id in an envelope; a banned person's sign-in provisions no workspace.

### Phase 7 - Prerequisites

The dead-letter retention deleter, removing recipient emails from `logAuth`, clearing soft-deleted bodies.

### Phase 8 - Procedure

The operator page in `docs/`, the `09-S3` amendment.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json`, run on the last commit of every ticket's PR. This spec's
own PR changes documents only: `bash .ai/scripts/check-generated.sh` and `pnpm exec vitest run --project=tooling scripts/specs`
prove the index and the registry guard. The docs-grep rule (`CODE_REVIEW.md` "Docs and CI") was run for the terms below.

## Owner confirms

Open items a person decides. This spec does not decide them and records the default it assumed.

1. The **deletion window** placeholder on the privacy page, and whether a **grace window** is wanted before the job runs
   (assumed: none; the job starts at once).
2. The **backup window** and the **log retention period** (including Sentry and dead letters).
3. How long **tenant audit rows** and their personal fields are kept (the prune has no caller), and whether the 400-day
   `platform_audit_log` may keep **name and email** in `platform.user.*` rows after an erasure (assumed: yes, until the prune).
4. The **legal basis** for keeping anything: settlements and expenses as shared records, the platform ledger, invoices and tax records.
5. Whether **organization-visible solo trips** in a team belong to the company or the person (assumed: the company; they stay
   and are handed to the longest-standing owner).
6. **Billing:** cancel versus refund policy, whether Polar is asked to delete the purchaser's email after the tax period, and
   the cost of R2 deletes and of the job.
7. Whether **waiting on a handover** (the #807 refusal) can exceed a statutory response deadline.
8. The **privacy contact address**, response period, how identity is verified for an emailed request, and whether a second
   reviewer is ever required.
9. Whether the **privacy wording** changes ("deleting your account deletes your content" versus contributions kept as Former member).

## Amendment (#1000)

`.ai/specs/2026-10-17-delete-a-workspace-you-own.md` owns the one `deleteWorkspace` and its driver
(`advanceWorkspaceDeletion`, the `workspace_deletions` ledger, the R2 prefix sweep, the fence, the late-subscription
rule). Phase 4 above builds **its slices**, not a second function: the erasure engine calls the driver with
`initiator: 'erasure'` for a workspace whose last member is the erased person, and the reserved system-owner scope is
minted by #1000's driver phase, which the engine phases here are blocked by. The erasure keeps its own obligations on top of
the driver: it captures the workspace's trip ids first (a bounded list) and resets every room with `deleteAll` (§ 7: waiting
for the seven-day idle erase is not enough), and its verification step waits until the ledger row has reached `rows_deleted`
(the workspace row is gone) before it counts the workspace as deleted. The subscription gate in § 7 is the same pure function
(`subscriptionBlocksWorkspaceDeletion`). Where the two disagree, #1000 wins.

## Resolved assumptions (autonomous defaults)

| #   | Question                                     | Applied default                                                                                                                                                                                                                                                     | Why                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How are the person's workspaces found?       | A participation anchor that survives departure, read through a catalog function that returns organization ids; SPEC §5/§6 amended explicitly.                                                                                                                       | Decided by the security and tenancy sub-agent (confidence medium): `member`-only misses departed workspaces; scanning is also cross-tenant; the anchor is additive and reversible. Corrected: a plugin hook alone would miss the direct insert in `provisioning.ts`.        |
| 2   | Solo and shared trips, and a sole trip owner | Solo private trip deleted; solo organization-visible trip kept and handed to the longest-standing workspace owner; sole trip owner on a shared trip replaced by promotion.                                                                                          | Decided by the security and tenancy sub-agent (confidence medium): refusing blocks a data subject on someone else's action; leaving no owner has no exit (SDLC.md). Company-versus-person is owner confirms (item 5).                                                       |
| 3   | Column outcomes                              | The table above, with these outcomes settled by the specialist: tokens revoked and anonymised (no hard delete), vacay plan with invited members kept, `saved_by` anonymised in others' collections, share links revoked, chat bodies cleared, `paid_by` anonymised. | Decided by the security and tenancy sub-agent (confidence medium) against the code: `platform_audit_log.token_id` is `RESTRICT`; `share_links.revoked_at` exists; nulling `paid_by` changes balances.                                                                       |
| 4   | Collections shared with others, and journeys | Delete when no other contributor remains, otherwise keep under the Former member owner.                                                                                                                                                                             | Default applied for collections, by analogy to the journey verdict (decided by the security and tenancy sub-agent, confidence medium, reusing ADR 0034's "owner leaves" outcome); journeys have one production writer (`createJourneyFn`) and no entry or photo writer yet. |
| 5   | `provider_registry.updated_by`               | Anonymise.                                                                                                                                                                                                                                                          | Default applied: a mutable configuration row the verdict did not address; the ceiling must stay.                                                                                                                                                                            |
| 6   | Audit rows                                   | Tenant rows anonymised and stripped of ip/user agent; platform ledger kept; a PII-free `platform.user.erased` row replaces the PII-bearing `platform.user.deleted`.                                                                                                 | Decided by the security and tenancy sub-agent (confidence medium): rewriting the platform ledger contradicts its append-only rule and `CHECK`s. Retention is owner confirms.                                                                                                |
| 7   | What replaces the id                         | `erased_<nanoid>` per workspace per erasure, no stored mapping after the job.                                                                                                                                                                                       | Decided by the security and tenancy sub-agent (confidence high): a constant breaks unique indexes, an HMAC is reversible, one id links workspaces.                                                                                                                          |
| 8   | Auth leftovers                               | Delete the `user` row last; delete invitations to the email and the `verification` rows that name the person (by identifier and value); end impersonated sessions; let the sent-invitation cascade stand.                                                           | Decided by the security and tenancy sub-agent (confidence high): changing the `inviter_id` key is a table recreate and not additive.                                                                                                                                        |
| 9   | Non-D1 stores and order                      | One resumable job: make inert, discover, scrub per workspace, sweep, delete the user last, verify; KV/DO/R2 purged or left to expire with the residual stated.                                                                                                      | Decided by the security and tenancy sub-agent (confidence medium): D1 is the record; an active room never clears itself; dead letters need a retention deleter first.                                                                                                       |
| 10  | The sole owner of a team (#807)              | The refusal stays; the request waits for a handover; no auto-promotion; an audit row records the refusal.                                                                                                                                                           | Decided by the security and tenancy sub-agent (confidence medium): doing nothing is the most reversible, auto-promotion moves billing. The statutory-deadline question is owner confirms (item 7).                                                                          |
| 11  | A workspace with no member left, and billing | Deleted at once with an R2 prefix sweep; a live subscription blocks the erasure; no Polar call; the Polar customer is kept.                                                                                                                                         | Decided by the product owner sub-agent (confidence medium): a grace state needs an exit the missing retention handler cannot give; money stays out of code; Polar is Merchant of Record. Gap closed: plan 09's rules never mentioned a subscription.                        |
| 12  | Is self-service offered here?                | No: console only; one engine entry; `09-S3` calls it and plan 09's rules 2 to 4 are superseded; a documented operator procedure; type-the-email plus a request reference.                                                                                           | Decided by the product owner sub-agent (confidence medium): plan 09 owns self-service (SPEC §8, one owner); a second reviewer adds a state with no exit.                                                                                                                    |
| 13  | Export before deletion                       | Mentioned only; neither offered nor enforced.                                                                                                                                                                                                                       | Decided by the product owner sub-agent (confidence high): the export does not exist, enforcing it would block a legal request.                                                                                                                                              |
| 14  | A grace window before the job                | None; the job starts at once; the window is owner confirms.                                                                                                                                                                                                         | Default applied after the two verdicts disagreed (the security sub-agent suggested a window as a mitigation, the product sub-agent warned a grace state needs an exit): the more reversible direction is immediate, since a window can be added in front later.             |
| 15  | Does the spec edit anything but itself       | A note in `docs/plans/09-account-and-settings.md` and two `CONTEXT.md` entries.                                                                                                                                                                                     | Default applied: plan 09's sweep prefix is wrong against today's keys and the repo's docs rule asks every document that states what this changes to be updated.                                                                                                             |

## Panel verdicts

| Specialist                    | Verdict                | What decided it                                                                                                                                                                 |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security and tenancy reviewer | conditions met in spec | The anchor and the third catalog exception stated openly; share links revoked; chat bodies cleared; tokens revoked not deleted; balance and isolation tests required per slice. |
| Product owner                 | conditions met in spec | Immediate workspace deletion with a subscription gate; self-service stays with `09-S3` behind one engine; export mentioned only; memberless workspaces filed as a finding.      |
