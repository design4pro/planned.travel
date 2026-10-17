# A workspace owner can delete a workspace they own

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1000 |
| **Spec PR**        | none  |
| **Implementation** | none  |

## 📝 TLDR

Nothing in the product deletes a workspace. Better Auth's `organization/delete` is closed on purpose (#999,
`disableOrganizationDeletion: true`), `deleteWorkspace(scope)` is designed in plan 09 for account deletion and in the
erasure spec (#811) for memberless workspaces and exists nowhere, and a workspace made from the account menu (#804) keeps
one of the account's `WORKSPACE_LIMIT` slots for ever.

This spec designs **one deletion path** for a workspace and fixes, for every place a workspace's data lives, what happens
to it. In one paragraph: the **owner** of a workspace in which **they are the only member** confirms on the server (the typed
workspace name, a re-authentication, a session that is not impersonated) and the workspace is deleted: a **deletion ledger**
row is written first (a global table, so it survives the cascade), rooms are closed, trips are drained in bounded chunks,
the `organization` row is deleted by one guarded statement (every tenant row cascades), one append-only
`platform.workspace.deleted` audit row is written, the workspace's R2 prefixes are swept twice, and the owner gets a receipt
email. Every step is idempotent and is driven by the same function from three places (the request, a queue message, the
quarter-hourly cron), so no failure needs a person. The product **never cancels or refunds a subscription**: a workspace
with a live paid subscription is refused until the owner has cancelled it in the billing portal; the one automatic Polar
write is an undoable cancel-at-period-end for a subscription that appears after a workspace was deleted.

A workspace that **other people belong to** cannot be deleted by this path, so no one's private trip (ADR 0007) is ever
destroyed by another person's click; the owner removes the members first (#1008). The erasure engine (#811) deletes the
workspace of an erased person through the same path.

The spec changes no code, schema or migration. It lands notes in plans 09 and 10, an amendment in the erasure spec, and two
`CONTEXT.md` entries. The refund and cancellation terms, what the deletion record holds and for how long are **human
decides** items, listed at the end with the default this spec assumed.

## 📝 Problem Statement

Measured at HEAD (`4cf1faed`) by reading the code.

### How workspaces are removed today (nothing in this section changes in this spec)

- **No path deletes one.** `deleteWorkspace` is named in `docs/plans/09-account-and-settings.md` (stage `09-S3`),
  `docs/plans/10-administration.md` and the erasure spec; `rg 'deleteWorkspace' src` finds no definition. The Better Auth
  `organization/delete` endpoint answers `404 ORGANIZATION_DELETION_DISABLED` to everyone (docs/ACCESS.md §2.6, pinned by
  `src/server/auth/__tests__/auth-handler-closure.test.ts`), and the comment in `src/server/auth/index.ts` says the flag
  stays "until the product owns it (#1000)". The console deletes accounts, not workspaces.
- **The cascade is wide and complete in D1.** 61 `orgRef()` columns in `src/server/db/schema.ts` carry
  `ON DELETE CASCADE` to `organization`; plan 09's "fifty-seven" is stale. Deleting the one `organization` row removes
  trips (other members' private trips included), file rows, expenses, journeys, share links, calendar feeds, notifications,
  the tenant `audit_log`, `subscriptions`, `member` and `invitation` rows.
- **Not cascaded:** the R2 objects (`trips/<org>/`, `exports/<org>/`, `avatars/<org>/`; journey photo keys are
  caller-chosen with no org segment but have no production writer), the Polar subscription (the workspace is the Polar
  customer, `external_id` = the organization id), the KV plan-state entry `billing:plan:v5:<org>` (60 s), the `TripRoom`
  Durable Objects, queue messages in flight.
- **A Polar webhook for a deleted organization fails.** `organizationForSubscription` in `src/server/billing/webhook.ts`
  returns the id from the payload without checking it exists; the upsert then violates the `subscriptions.organization_id`
  foreign key, the endpoint answers 500, and Polar retries ten times. This is a bug the deletion would expose, not one it
  creates.
- **A session that names a deleted workspace is not recovered.** `requireOrg` (`src/server/auth/session.ts`) provisions a
  personal workspace only when `session.activeOrganizationId` is null; `resolveActiveWorkspace` falls back to the oldest
  remaining membership, and when there is none the request ends in `not-a-member` until the next sign-in.
- **The audit logs.** The tenant `audit_log` cascades with the workspace. `platform_audit_log` survives, is append-only, is
  pruned at 400 days, and has closed `entity_type` and `action` lists narrowed in TypeScript only (no `CHECK`), so a new
  value is an amendment to docs/ACCESS.md §4.1 and §4.2 and no migration.
- **No export exists** (#1063: the privacy page promises one). A per-trip **Trip export** (PDF or HTML) does.
- **`assertCanAdminister` admits `admin`** (`src/server/repos/context.ts`). Plan 09 stage `09-S3` writes the isolation case
  "a scope whose role is not `owner` is refused", plan 10 stage `10-S4` names the discrepancy and leaves it to the stage that
  mints the function. This is that stage.

### Premises of the brief checked and corrected

| Brief says                                                           | At HEAD                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The deletion function is "designed" only in plan 09                  | The erasure spec (#811, merged, unsliced) also designs it as its Phase 4, for memberless workspaces. This spec owns it; see Amendment there.                                                                    |
| The cascade removes "57 tables"                                      | 61 `orgRef()` columns. Count from the schema, never from a plan.                                                                                                                                                |
| The warning key from #989 sits next to `workspace.createDescription` | Not on this base (#989 is open). The UI slice removes it and is blocked by that change.                                                                                                                         |
| Deleting frees a slot "for every member"                             | True of the cascade, but this path deletes only a workspace with one member, so it frees the owner's slot.                                                                                                      |
| A session of another member "fails closed or moves"                  | It moves to the oldest remaining membership; with none it fails closed until sign-in. A person always has a personal workspace to move to unless they deleted it themselves, which this spec handles (§ Slots). |

### Who has the problem

A person who made a workspace by mistake or for a trip that is over and cannot get rid of it; an owner who pays for a
workspace they no longer use; the next engineer who has to delete one and finds three documents each describing a different
function.

## 📝 Proposed Solution

### Vocabulary (CONTEXT.md gains two entries in this spec's PR)

- **Workspace deletion** - the removal of a workspace and everything in it, on its owner's request, when the owner is its
  only member. It is complete: tenant rows, stored files, the record of it. It is not leaving a workspace and not erasing
  a person (_Erasure_).
- **Deletion ledger** - the platform's own record that a workspace deletion was requested and how far it got. It outlives the
  workspace it names and carries no workspace content.

### The rule in one sentence

A workspace is deleted only by its owner, only when nobody else belongs to it, only once no paid subscription is live, and
then completely.

### Who can delete (settled)

**Owner only, on the server.** The server function and `deleteWorkspace` both assert `assertRole(ctx, 'workspace.delete',
'owner')`; every other role is refused with `ForbiddenError` however the request arrives, and `assertCanAdminister` is not
used. This resolves the `09-S3` / `10-S2` discrepancy: workspace deletion is outside the access catalogue (plan 10), has a
fixed floor, and the floor is `owner`. The caller never supplies a workspace id as the target: it is `scope.ctx.organizationId`, and the request only carries the
id it believes it is in as a precondition (§ The confirmation).

**Only when the owner is the only member** (decided by the panel, Resolved assumption 1). `deleteWorkspace` deletes with
`DELETE FROM organization WHERE id = <scope> AND (SELECT count(*) FROM member WHERE organization_id = <scope>) <= 1`, so the
guard is one atomic statement and not a read followed by a write, and `<= 1` admits the memberless workspaces #1062 lists.
A workspace with other members is refused (`has-other-members`). Why:

- ADR 0007 gives the owner no read access to a private trip of another member, and no "count or aggregate" of it. The only
  honest warning to the owner is therefore "everything, including what only others can see". Destroying that on one click,
  with the other people never asked, is the silent destruction the ticket forbids.
- Removing a member already goes through the flow that keeps their private trips (stranded trips, #810 / #812; the removal
  screen is #1008, open). The rule here needs **no amendment to ADR 0007** and no second owner of stranded-trip resolution.
- The erasure engine's deletion (the person is the last member), plan 09's rule 3 ("not the sole member: only the `member`
  row goes") and #807's refusal all state the same predicate, so there is one guard and one place that holds it.

Until #1008 lands, a team workspace cannot be deleted from the product and the owner has no product way to remove its members
either (`removeMember` has no production caller; the members table is read-only), so the refusal copy states the fact and
does not tell the owner to do something they cannot do yet; Phase 8 is blocked by #1008 for the link to the members list. A
**notice window** that would let an owner delete a team workspace (every member told at once, any owner can cancel, the cron
executes when due) is a follow-up this design leaves room for: the ledger's `requested` state is where a `due_at` would go,
additively. The slicing run files it as a ticket (§ Follow-ups the slicing run files), so the part of #1000's promise this spec
narrows has an owner.

### One path

| Piece                                          | Owner                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The D1 delete of the workspace                 | `deleteWorkspace(scope)` in `src/server/repos/members.ts`: the only function that deletes a workspace that has been in use |
| The sequence around it (steps, retries, order) | `advanceWorkspaceDeletion` in `src/server/workspace-deletion/` (new), driven by the request, a queue handler and the cron  |
| The ledger                                     | `src/server/catalog/workspace-deletions.ts` (new; the thirteenth global table, § Data model)                               |
| The R2 prefix sweep                            | `deletePrefix` in `src/server/storage/objects.ts`, prefixes from `WORKSPACE_R2_PREFIXES` beside it                         |
| Whether a subscription blocks                  | `subscriptionBlocksWorkspaceDeletion` in `src/server/billing/` (the rule of the erasure spec, written once)                |
| The confirmation proof                         | `verifyStepUp` in `src/server/auth/` (new; extracted from the passkey-delete endpoint, which then calls it)                |
| The request entry                              | `deleteWorkspaceFn` in `src/server/fns/workspace-delete.ts`, rules in `workspace-delete-writes.ts`                         |

The callers are: the owner's screen (this spec), the erasure engine for a workspace whose last member is the erased person
(`initiator: 'erasure'`; it has its own authorisation at `user:delete`, so it skips the typed name and the step-up, and
nothing else), `09-S3` through that engine, and the #1062 cleanup of memberless workspaces. **There is no second deletion
path**; a ticket that deletes an `organization` row anywhere else fails review. The one existing exception stays:
`createOrganizationWithinLimit` (`src/server/auth/provisioning.ts`) withdraws the organization it has just created when the
limit is exceeded; it never touches a workspace that has been in use. `disableOrganizationDeletion: true` stays,
and docs/ACCESS.md §2.6 is amended to say the product-owned deletion exists and goes through repository SQL.

**Does the sole-member guard stay for account deletion?** Yes, unchanged: the predicate is the same one. Plan 09's rule 4
(the last owner of a workspace that still has other members is refused) and #807 are untouched; this spec adds nothing to
them.

### The confirmation, verified on the server

`deleteWorkspaceFn` accepts `{ expectedOrganizationId, name, password? }` (`z.strictObject`; no `userId`) and refuses, in this
order, writing nothing on a refusal until step 5:

1. no session, or a role other than `owner` (`forbidden`);
2. an **impersonated** session (`impersonated`): a platform operator wearing an account does not delete its workspace, as
   they do not create one (docs/ACCESS.md §2.7, §6.4);
3. an `expectedOrganizationId` that is not the scope's organization (`workspace-changed`). The id is a **precondition, never
   the target**: after tab 1 deletes the workspace and the person is given a fresh personal one, tab 2 resolves to that new
   workspace, whose name is deterministic and may equal the name typed in tab 2, and would otherwise delete it;
4. a `name` that is not the workspace's name, compared as typed after `trim()` and Unicode NFC, case-sensitive, against the
   name read on the server (`name-mismatch`);
5. a failed **step-up** (`verifyStepUp`): the **password** when the account has one (a missing and a wrong one are distinct
   refusals), a session younger than Better Auth's `freshAge` when it has none (`session-not-fresh`; `freshAge` is unset in
   `src/server/auth/index.ts`, so the library default of 24 hours from the session's `createdAt` applies). This is the rule of
   `/passkey/delete` (`src/server/auth/passkey/plugin.ts`), extracted so there is one definition. A fresh passkey assertion
   (`/passkey/authenticate/*` exists) is **not** required for a passkey-only account: that is a choice, made so that one step-up
   rule serves both deletions, and it is listed under Human decides. **Password guesses are rate limited per user, not per
   IP:** `/passkey/delete` gets 5 attempts per 300 seconds from Better Auth's `DELETE_RATE_LIMIT`, a server function has none,
   so `verifyStepUp` keeps a KV counter keyed by user id with the same numbers and answers `rate-limited` past it (tested);
6. the ledger row is inserted (idempotent: an existing live row for the organization is returned, § The sequence), which raises
   the fence, and **then**, with nothing able to join, the checks that read mutable state: another member (`has-other-members`,
   with the count, which the owner may know), a live subscription (`live-subscription`, § Billing) or an unreadable Polar answer
   (`billing-unavailable`). A refusal here moves the row to `refused` (the fence is lifted, nothing was deleted) and returns
   the reason. Inserting before these checks closes the window in which a member could join between the check and the
   insert.

The button being hidden is not a control; every refusal above is reached by a test that calls the function directly.

### Billing

**The product never cancels or refunds.** A workspace whose subscription would keep billing cannot be deleted:

- `subscriptionBlocksWorkspaceDeletion(row)` (one pure function; the erasure spec's rule written once): blocks when the row
  has a `provider_subscription_id`, a status of `trialing`, `active`, `past_due`, `unpaid` or `paused`, and no cancel at
  period end. A Free row (`plan = 'free'`, no provider id), `canceled`, `incomplete`, `incomplete_expired` and a
  subscription already set to end at the period end do not block.
- The mirror in D1 is fed by webhooks and can lag, so the gate also reads Polar: `GET /v1/subscriptions/` with
  `external_customer_id=<organizationId>` through the existing `PolarClient` (GET is allowed), applying the same predicate to
  what Polar returns. A Polar failure refuses with `billing-unavailable`; nothing is deleted and the owner tries again.
- The refusal names the action: manage billing (`/settings/billing`) and cancel there. A subscription cancelled at period
  end stops renewing and never bills again, so the deletion may then proceed; what remains of the paid period is lost and is not
  refunded by the product, and the screen says so before the owner cancels (§ Copy). A `past_due` subscription already set to
  cancel at the period end can still be retried by Polar after the workspace is gone; that is a Human decides item.
- **The race.** A checkout started before the gate can complete after it. From the moment a ledger row exists,
  `createCheckout` and `changePlan` refuse for that organization, and the webhook, for an organization that has a live ledger
  row (not `refused`) or no row at all, writes nothing and answers 200; when a row moves to `refused` the webhook writes again,
  so the mirror is not left stale. If the payload carries a subscription that is not ending, the webhook
  enqueues `workspace-late-subscription` (the webhook itself makes no outbound call, `webhook.ts` property 3): its handler
  calls `PATCH /v1/subscriptions/{id}` with `{ cancel_at_period_end: true }` (an undoable write the `PolarClient` already
  allows; never `DELETE`, never a refund), treats 403 and 404 as done, retries 409, 429 and 5xx, and logs at `error` so a
  person sees it. This is the single Polar write this spec adds. The handler needs Polar credentials, which the queue
  consumer does not carry today: `TaskBindings` and `TaskSecrets` (`src/server/queue/types.ts`) gain the `POLAR_*` fields, the
  billing task union that the webhook enqueues through gains the new member and its envelope mapping, and the call goes
  through `context.callProvider` like every outbound provider call. The guard that makes the webhook answer 200 for an
  organization that does not exist fixes a bug that exists today and ships on its own, before any of this.
- The Polar customer record and its email are kept (the erasure spec's decision; tax records).

Immediate cancellation, a refund or proration, and cancelling on the owner's behalf as part of the deletion are **human
decides** (end of this spec). The default is the most reversible one: the product does nothing irreversible with money.

### The sequence

The ledger row is written first (after the authentication checks and before the checks that read mutable state, § The
confirmation) and every later step is read from it, so a crash at any point resumes. A step is idempotent and moves the row to
the next state with a compare-and-set that also takes a **lease** (`lease_until`, five minutes) and clears it on the
transition, so the request, the queue handler and the cron never run the same step together. A run that outlasts its lease
cannot corrupt anything: every step is safe to run twice and the audit append is one `INSERT … WHERE NOT EXISTS`.

| State          | Work, in order                                                                                                                                                                                                                                                                                                                                                                               | Next state     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `requested`    | The row is inserted with a snapshot (plan, subscription status, trip and file-row counts) and the receipt address and name; the post-fence checks pass; delete the pending invitations; **drain** (below), in bounded runs                                                                                                                                                                   | `drained`      |
| `drained`      | `deleteWorkspace(scope)`: the guarded statement. Then delete `billing:plan:v5:<org>` from KV                                                                                                                                                                                                                                                                                                 | `rows_deleted` |
| `rows_deleted` | Append `platform.workspace.deleted` (`INSERT … WHERE NOT EXISTS` on the deletion id; the state advances only when the row is there); queue the receipt email (`eventId` = the deletion id) and clear the receipt address and name from the ledger                                                                                                                                            | `audited`      |
| `audited`      | Sweep `WORKSPACE_R2_PREFIXES` for `<org>/`: list, delete 1,000 keys, repeat (at most 20 batches a run); when a pass finds nothing, record `swept_at`                                                                                                                                                                                                                                         | `swept`        |
| `swept`        | Only when `swept_at` is at least 15 minutes old, sweep again and confirm nothing is left (an upload that raced the cascade, put before its row, is caught here); a run before that returns without work. Then `done_at`                                                                                                                                                                      | `done`         |
| `refused`      | Terminal. Another member, a live subscription or an unreadable Polar answer found after the fence went up, or (a window of a few milliseconds, between a hook's ledger read and the library's member write) a member who joined during the drain. Fence lifted, logged at `error`; the owner is emailed and `platform.workspace.deletion_refused` is appended when anything had been drained | none           |

Why **this order**: the guard and the cascade are one statement, so nothing is deleted outside the checks; the audit row is
written after the cascade (docs/ACCESS.md §4.3: "after the mutation commits") but the ledger holds every fact it needs until
the row is confirmed, so a failed append is retried and never lost; R2 is swept after the cascade because the prefixes are
derived from the organization id (no D1 read needed), and after it nothing can start a new upload (the upload path needs the
caller's membership). The drain exists because one `DELETE` that cascades over 61 tables can pass D1's per-statement limits
for a very large workspace and then fail the same way on every retry, so the final statement must find little left to cascade.
**The drain** is a loop of bounded steps, each guarded by the sole-member predicate (a step never runs once the guard is false)
and each selecting its rows with a `LIMIT` subselect, never a list of bound ids (D1 accepts 100 bound parameters,
`MAX_BOUND_PARAMETERS` in `repos/batch.ts`): per step, the next 100 trips are selected, their rooms are closed and the trips
are deleted (the room closing is therefore as bounded as the delete, and stays under the Workers subrequest limit); then the
other large organization tables (the tenant `audit_log` first, which is unbounded, then `notifications`, `usage_records`,
`places`, `collections`, `journeys`) are emptied the same way. The list of tables is a constant in `repos` pinned by the
cascade-completeness test, so a table that grows large is added deliberately. A run does at most 20 steps and returns; the
next run (the queue hop or the cron) continues.

**The fence.** From the moment a ledger row exists for an organization, no one can join it: the Better Auth `organizationHooks`
(`beforeAddMember`, `beforeCreateInvitation`, `beforeAcceptInvitation`, present in the pinned 1.7.1) throw when
`workspaceDeletionPending(db, organizationId)` (a read in `catalog/workspace-deletions.ts`, a catalog function and not an
`…Unscoped` repo function, so SPEC §5 FU-3's one-caller shape does not apply) is true; `createCheckout`, `changePlan` and
`addMember` in `src/server/repos/members.ts` (which writes a `member` row without going through the Better Auth hooks) do the
same. Its callers are exactly: the three hooks, `addMember`, `createCheckout`, `changePlan` and the webhook, pinned by a test
that fails on a seventh. The fence reads the ledger only on those rare paths; no per-request read is added.

**Where the driver runs.** The request runs it inline for about ten seconds and enqueues `workspace-deletion` (payload: the
deletion id only, never a user id, because dead letters keep bodies) before it answers. The queue consumer writes a
`task:done:<envelope.id>` marker for 24 hours after any handler success, so every hop is a **new envelope** with its own id
(`workspace-deletion:<deletionId>:<n>`) and a `delaySeconds`, and a handler that finds the lease held throws
`TaskRetryableError` instead of returning success. The cron `*/15 * * * *` (the reminder sweep's slot; no new trigger,
`wrangler.jsonc` is unchanged) calls the driver **directly**, not through the queue, for every row not in `done` or `refused`
whose `updated_at` is older than 15 minutes, five rows a tick, with `Promise.allSettled` as the retention slot does. The cron
is the guarantee in production: a queue message can be swallowed by the done-marker or dead-lettered after five deliveries,
and the cron depends on neither. (Staging's cron list is `0 3 * * *` only, so staging relies on the queue and on the next
owner request.) A row older than seven days that is still not `done` is logged at `error` on every tick. The
queue handler and the cron build a **reserved system owner scope** for the organization (minted by this spec's Phase 6, which is its one owner;
the erasure spec's engine phases are blocked by it and import it, and a test lists the importers; this is a fabricated
tenant context of the kind SPEC §5 forbids for a request, allowed here because it is built only inside the driver, as
`scopeForWorkspace` is for the reminder sweep); the request passes the owner's own scope.

### What survives the cascade, and for how long

Two records, with two different jobs:

- **The ledger** (`workspace_deletions`) is state: it exists so a half-done deletion resumes. It holds the organization id,
  who asked, the state, the lease, the attempt count, a code for the last error, and the snapshot. It holds **no workspace
  content**. It holds the workspace's name and the owner's address (`receipt_name`, `receipt_to`) only until the receipt
  email is queued, then clears them (an erasure never sets them). `done` and `refused` rows are deleted 30 days after
  `done_at` / `updated_at` by the weekly retention slot (`17 4 * * 1`); a row in any other state is never pruned. The email
  task carries the same two values, so a dead-lettered receipt keeps them in R2 until that bucket's own retention (a stated
  residual, as for every email task).
- **The audit row** is evidence: `platform.workspace.deleted` in `platform_audit_log`, `entity_type: 'workspace'`,
  `entity_id` = the organization id (so the timeline query of docs/ACCESS.md §4.4 reads a workspace's history), `actor_kind`
  `human`, `actor_user_id` the requester, `actor_role` their platform role (`user` for an ordinary account), `changes`
  `{ before: { plan, subscriptionStatus, trips, fileRows }, after: { r2ObjectsDeleted, initiator, deletionId } }`. For an
  erasure the actor is `system` and `initiator` is `erasure`: **no user id, name or email** (the erasure spec's rule). It is
  kept the table's 400 days. The tenant `audit_log` is not used: it dies with the workspace, and docs/ACCESS.md §4.5 keeps it
  as it is.

The audit append here is **not** the swallow-everything `appendPlatformAudit`: the driver needs to know the row exists, so it
uses a variant that throws, and the state advances only on success. `platform.workspace.deleted` and
`platform.workspace.deletion_refused` are added to docs/ACCESS.md §4.2's closed list (the prefix `platform.workspace` maps to
`entity_type` `workspace`; the action count and the "eighteen / sixteen" sentence are updated) and to
`PLATFORM_AUDIT_ACTIONS` / `PLATFORM_AUDIT_ENTITY_TYPES` in the commit that writes them (Phase 6). What the record holds and how long it is kept are **human decides** (the defaults above).

### Slots, sessions and the owner's only workspace

`WORKSPACE_LIMIT` counts `member` rows, so the cascade frees the owner's slot with no further code.

**An owner may delete their only workspace.** Refusing would send them to account deletion, which has no self-service yet;
and an empty personal Free workspace is an existing invariant (no screen copes with no workspace). The screen says so:
"You will get a new, empty workspace on the Free plan." For this to be true for **every** session of the person (other tabs,
other devices), two callers change, and the change is one shared function in `src/server/auth/`: `requireOrg` and `loadShell`
(`src/routes/_app/-server/shell.ts`, which calls `resolveActiveWorkspace` itself and throws `membershipRemoved` / `noWorkspace`
when it returns null) both call it. When `resolveActiveWorkspace` finds no membership for the session's `activeOrganizationId`
**and** the person has no other membership, it provisions their personal workspace instead of answering `not-a-member`.
Provisioning must be **atomic**: `resolveOrProvisionOrganization` reads the first membership and then inserts, so parallel
loaders after the delete would each create a workspace; the insert becomes `INSERT … WHERE NOT EXISTS (member of this user)`,
or the recount-and-withdraw shape of `createOrganizationWithinLimit`. It is **skipped for a banned user** (a session can stay
live in KV for up to 60 seconds after a ban; the erasure spec's step 2 requires that a banned person is never given a
workspace). A session whose workspace was deleted and who has another membership already moves to the oldest one; a test pins
both, and a test runs parallel requests and counts one new workspace.

### What is left behind

Each is a D1 row that cascades or a consumer that must tolerate the missing workspace; each has a test.

| What                            | Outcome                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending invitations             | Deleted at `requested`. An accept link answers not-found (the `/accept-invitation/<id>` loader is tested against a deleted workspace).                                                                                                                                                                                                                                                             |
| Share links, calendar feeds     | Cascade. `/share/<token>` and `/api/feed/<secret>.ics` answer not-found / 404 for a deleted workspace; no KV copy exists.                                                                                                                                                                                                                                                                          |
| The plan-state cache            | `billing:plan:v5:<org>` deleted at `rows_deleted`; it would expire in 60 s anyway.                                                                                                                                                                                                                                                                                                                 |
| Trip rooms                      | Sockets closed per drain step, with the trips; a reconnect fails the connect handler (the trip and the membership are gone). Room storage is erased by the room's own idle alarm, at most seven days after the last socket drops (a stated residual). The erasure initiator additionally resets every room (`deleteAll`) from trip ids it captured before the drain, as the erasure spec requires. |
| Queue messages in flight        | Every handler tolerates an organization that no longer exists as a no-op, not a dead letter. Phase 6 runs each task kind against a deleted organization and fixes the ones that do not.                                                                                                                                                                                                            |
| Polar customer and subscription | Customer kept. A subscription that appears late is set to end at the period end (§ Billing). Webhooks for the organization are acknowledged and write nothing.                                                                                                                                                                                                                                     |
| Other members                   | None by construction (sole-member rule). A person who left earlier lost access when they left.                                                                                                                                                                                                                                                                                                     |
| Their trips' files in R2        | The prefix sweep. `trip-purge` is not used: the sweep covers `trips/<org>/` whole, and the drain deletes trip rows without that side effect.                                                                                                                                                                                                                                                       |

R2 key families must keep the organization in the second path segment (`trip-purge`'s existing rule). `WORKSPACE_R2_PREFIXES`
(`trips/`, `exports/`, `avatars/`) is the single list; a drift test builds a key from every key-minting function in the repo
and fails when one does not start with a listed prefix followed by the organization id. The journey photo writer, when it
ships, mints `journeys/<org>/…` and adds the prefix; today there is nothing to capture.

### Private trips of other members, export, #999

- **Private trips:** one rule, above: a workspace other people belong to is not deleted by this path. No trip of another
  member is ever destroyed, shown or counted to the owner, and nothing here decides stranded-trip resolution (#810 / #812).
- **Export:** none exists (#1063). The deletion screen says so ("There is no export. Download what you need from each trip
  first"; a per-trip Trip export exists) rather than offering one. A workspace export is #1063's.
- **#999 stays closed:** `disableOrganizationDeletion: true` is not touched; a test keeps asserting that
  `POST /api/auth/organization/delete` answers 404 for an owner, and docs/ACCESS.md §2.6 is amended to name this path.

### Alternatives considered

- **Cancel the subscription for the owner as part of the deletion** (at the period end, undoable). It matches "the Polar
  subscription is cancelled" most literally, and two of the three specialists preferred to keep money out of an unattended
  path; it also needs no `DELETE` on the port either way. Rejected as the default, listed as a human-decides item: switching
  is one step in the driver and a gate removal.
- **Delete a team workspace with a notice window.** More useful to a team owner, but a scheduled state, a cancel flow and a
  surface that every member sees; left as the follow-up named above.
- **A platform-audit row only, no ledger.** A deletion that stops half way would have no durable state to resume from;
  rejected.
- **A ledger only, no audit row.** The ledger is pruned 30 days after completion and holds state, not evidence; rejected.
- **Capturing trip ids and R2 keys before the cascade.** Needs an unbounded store for the owner's path; replaced by prefix keys
  that name the organization and by closing each chunk's rooms from a live read just before that chunk is deleted. (The erasure
  initiator, which owes a `deleteAll` per room, captures its own bounded list.)
- **Sweeping R2 before the cascade.** It would delete the files of a workspace that the next step may refuse to delete.

## 📝 Architecture

Owners (docs/SPEC.md §8, one concept, one owner) are in the table under "One path". Layering is unchanged: `components/ui`
fetches nothing; the route calls `deleteWorkspaceFn`; a server function never calls another server function (the function
calls the driver in `src/server/workspace-deletion/`, which is not a server function); every input is Zod-validated; SQL for
tenant tables is in `src/server/repos`, SQL for the ledger is in `src/server/catalog` (the thirteenth global table, § Data
model); the driver takes its D1 handle, bucket, rooms, Polar client, KV and logger as ports and imports no
`cloudflare:workers` module, so the Node `server` test project can run it.

## 📝 Data Model

One new global table, additive (one `CREATE TABLE`; no existing table changes; `pnpm db:generate` writes the migration):

`workspace_deletions` - `id` (pk), `organization_id` (text, not null, **no foreign key**: attribution only, as
`provider_usage.organization_id` is, so the cascade cannot reach it), `requested_by` (`userRef`, nullable: null for an
erasure), `initiator` (`owner` or `erasure`, `enumCheck`), `state` (`requested`, `drained`, `rows_deleted`, `audited`,
`swept`, `done`, `refused`, `enumCheck`), `lease_until`, `attempts`, `last_error` (a short code), `snapshot` (JSON: plan,
subscription status, counts, objects deleted), `receipt_to` and `receipt_name` (nullable, cleared when the receipt is queued),
`requested_at`, `updated_at`, `swept_at`, `done_at`. Indexes: a **partial
unique index** on `organization_id` where `state <> 'refused'` (one live deletion per workspace, and an idempotent re-request
returns the existing row), and `(state, updated_at)` for the cron. The `CHECK`s are in the `CREATE TABLE` (adding one later is
a recreate). The table joins docs/SPEC.md §5's carve-out by amendment (the "twelve names" become thirteen, the argument being
the one `platform_audit_log` made: it carries no tenant content and cannot be reached through a tenant scope). §5 lets a write to a
global table skip the tenant layer through a platform actor, `requirePermission` and an audit row in the same call; that clause
is **inapplicable** here, as it was for the cron's read, and the amendment says what guards the ledger instead: only the driver
writes it, the driver is reachable only through `deleteWorkspaceFn` (owner, step-up, impersonation refused), the queue handler
and the cron, and a test pins the importers of the catalog module. The deletion itself is audited by
`platform.workspace.deleted`. The erasure spec's registry lists `requested_by` as `keep` until the 30-day prune.

`platform_audit_log` gains an `entity_type` and two `action` values in TypeScript only (no migration).

## 📝 API Contracts

- `deleteWorkspaceFn` (`POST`, new, so its required fields break no tab loaded before the deploy): input
  `z.strictObject({ expectedOrganizationId: z.string().min(1), name: z.string().min(1).max(60), password: z.string().min(1).optional() })`;
  output `{ ok: true, complete: boolean }` or `{ ok: false, reason }` with `reason`
  in `workspace-changed`, `name-mismatch`, `password-required`, `password-invalid`, `rate-limited`, `session-not-fresh`,
  `has-other-members`, `live-subscription`, `billing-unavailable`; `forbidden` and `impersonated` are thrown as `AuthRequirementError` / `ForbiddenError`, as
  `createWorkspace` does. `complete: false` means the deletion is recorded and finishing in the background.
- Queue kinds `workspace-deletion` and `workspace-late-subscription`, **two releases in this order** (BACKWARD_COMPATIBILITY):
  the kinds and handlers first (Phases 5 and 6, with nothing that enqueues them), then the producers (Phase 7: the request's
  enqueue and the webhook's). The `taskEnvelopeSchema` union only gains kinds.
- `verifyStepUp` is a pure rule over the session and the account; `/passkey/delete` keeps its behaviour and error codes.

## 📝 UI/UX

The owner's screen is a **Danger zone** card at the bottom of `/settings/organization`, shown to an owner only (the server
refuses everyone else regardless). It states what is deleted, that it cannot be undone, that there is no export, what happens
to the owner's workspace list, and opens a dialog: the typed name (labelled, with the expected name shown), the password
(only when the account has one; otherwise a line that a recent sign-in is required), a destructive button that stays disabled
until the name matches, and a pending state. Refusals are inline and name the way out: another member (a link to the members
list, once #1008 gives the owner a way to remove a member), a live subscription (a link to billing), a wrong password, an old session (sign in again). The dialog follows
`passkey-delete-dialog.tsx` for focus and refusal handling. On success the person is taken to the dashboard with a toast; the
workspace switcher no longer lists the workspace.

## 📝 Visual change expected

`/settings/organization`, owner only, light and dark, desktop and mobile: one new **Danger zone** card and one dialog with the
states above (idle, name mismatch, submitting, each refusal, success). The dialog is a bottom sheet on a phone as the other
dialogs are. No other screen changes; the account menu loses nothing. A Playwright journey (`e2e/`) covers the owner's happy
path on a sole-member workspace and the two refusals a person can fix on the screen (another member, a live subscription).

## 📝 Copy

New keys in `src/lib/i18n/messages/en/settings.ts`, each added to all 22 other locales in the same change (the
`i18n-messages` skill; the parity test enforces it):

| Key                                            | `en`                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.workspace.delete.title`              | Delete this workspace                                                                                                                                   |
| `settings.workspace.delete.description`        | Deletes {name} and everything in it: every trip, place, file, journal and cost. This cannot be undone and there is no export.                           |
| `settings.workspace.delete.replacement`        | You will get a new, empty workspace on the Free plan. (Shown only when this is your only workspace.)                                                    |
| `settings.workspace.delete.action`             | Delete workspace                                                                                                                                        |
| `settings.workspace.delete.confirmTitle`       | Delete {name}?                                                                                                                                          |
| `settings.workspace.delete.nameLabel`          | Type the workspace name to confirm                                                                                                                      |
| `settings.workspace.delete.passwordLabel`      | Password                                                                                                                                                |
| `settings.workspace.delete.freshHint`          | You need to have signed in recently to do this.                                                                                                         |
| `settings.workspace.delete.confirm`            | Delete this workspace for good                                                                                                                          |
| `settings.workspace.delete.pending`            | Deleting…                                                                                                                                               |
| `settings.workspace.delete.done`               | Workspace deleted                                                                                                                                       |
| `settings.workspace.delete.finishing`          | {name} is deleted. Its files are being removed in the background.                                                                                       |
| `settings.workspace.delete.nameMismatch`       | That is not the workspace name.                                                                                                                         |
| `settings.workspace.delete.passwordInvalid`    | That password is not right.                                                                                                                             |
| `settings.workspace.delete.notFresh`           | Sign in again, then delete the workspace.                                                                                                               |
| `settings.workspace.delete.hasMembers`         | Other people belong to this workspace, so it cannot be deleted from here.                                                                               |
| `settings.workspace.delete.rateLimited`        | Too many attempts. Try again in a few minutes.                                                                                                          |
| `settings.workspace.delete.workspaceChanged`   | The workspace you are in has changed. Reload the page.                                                                                                  |
| `settings.workspace.delete.liveSubscription`   | This workspace has an active subscription. Cancel it in billing first. Cancelling stops renewal; the rest of the paid period is not refunded.           |
| `settings.workspace.delete.billingUnavailable` | We could not check the subscription. Try again in a moment.                                                                                             |
| `settings.workspace.delete.failed`             | Could not delete the workspace                                                                                                                          |
| `auth.workspaceDeletedNotice.subject`          | Your workspace was deleted                                                                                                                              |
| `auth.workspaceDeletedNotice.body`             | The workspace {name} was deleted from your account. If this was not you, secure your account now: sign in and review your sessions and sign-in methods. |

The #989 warning ("no way to delete a workspace yet", next to `workspace.createDescription`) is removed from all 23 locales by
Phase 8, which is blocked by the #989 change that adds it. The receipt email carries the workspace name and goes to the owner's
address, both read from the ledger until the receipt is queued. (The email keys follow the existing `auth.passkeyNotice.*`
pattern used by `src/server/auth/email.ts`.)

## 📝 Edge Cases & Failure Scenarios

Each failure point has an automatic recovery and a test case; no row of this table needs a person.

| Point                                                  | What happens                                                                                        | Recovery                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Polar unreadable at the gate                           | `billing-unavailable`; nothing written                                                              | The owner retries                                                                                                 |
| Worker dies after the ledger insert                    | Ledger row at `requested`, workspace intact                                                         | The cron resumes it within 15 minutes; the owner sees it complete                                                 |
| Dies or errors mid-drain                               | Some trips gone, rest remain                                                                        | The next run lists what is left and continues                                                                     |
| `deleteWorkspace` times out or errors                  | Row may or may not be deleted                                                                       | The step re-checks existence: absent means done, present means retry                                              |
| Another member found after the fence went up           | `refused`; fence lifted; `error` log; nothing was drained when it is found by the post-fence checks | Owner told on screen; a member joining during the drain (a window of milliseconds) gets an email and an audit row |
| Audit append fails or is lost                          | State stays `rows_deleted`; the ledger holds every fact                                             | Retried until the read-back finds the row                                                                         |
| R2 list or delete fails, or the run hits its batch cap | State stays `audited`; deleted keys are gone from the next listing                                  | Retried; resumes by listing again                                                                                 |
| An upload raced the cascade                            | An object under the prefix after the first pass                                                     | The second pass at least one tick later deletes it                                                                |
| Queue message lost, swallowed or dead-lettered         | Nothing drives the row                                                                              | The cron drives it directly                                                                                       |
| Two drivers at once (request, queue, cron)             | Both try the same step                                                                              | The lease and compare-and-set: one runs, the other returns                                                        |
| Owner double-clicks, or two tabs                       | Second request                                                                                      | The partial unique index returns the existing ledger row; same answer, no second deletion                         |
| Late Polar webhook for the deleted workspace           | Acknowledged, nothing written; a subscription not ending is set to end at the period end            | `workspace-late-subscription` retries; an `error` log reaches a person                                            |
| Receipt email fails                                    | The email queue retries it (its own idempotency key)                                                | None needed; the deletion does not wait for it                                                                    |

## 📝 Observability

Structured lines through `src/server/observability` (never a name, email or file name): `workspace-deletion.state` (deletion
id, organization id, state, attempts, duration), `workspace-deletion.stuck` at `error` for a row older than seven days,
`workspace-deletion.refused`, `workspace-late-subscription` at `error`, and the object counts per sweep.

## ✅ Acceptance criteria

Mapped to the brief of #1000 (every box is met by the slices below and has a test):

- [ ] **Who can delete:** `deleteWorkspace` and the server function assert `owner`; admin, member, an impersonated session and
      a request that bypasses the screen are refused; `assertCanAdminister` is not used.
- [ ] **One function:** a single `deleteWorkspace` (and one driver) that the owner's path, the erasure engine and `09-S3` use;
      the sole-member guard stays for account deletion; plans 09 and 10 and the erasure spec say so.
- [ ] **Scope and isolation:** the target is the caller's scope; SQL is in `src/server/repos` and `src/server/catalog`;
      deleting workspace A leaves B's organization row, members, trips, subscription, audit rows, R2 objects and ledger row
      untouched (tenant-isolation test in Phase 2, with a fake bucket for the R2 half in Phase 4).
- [ ] **Confirmation:** the typed name, the step-up (rate limited per user), the precondition id and the non-impersonated
      session are checked in the server function; a request without any one of them is refused with the reason.
- [ ] **Other members' private trips:** a workspace with another member is refused and nothing changes; no ADR amendment; no
      second owner of stranded-trip resolution.
- [ ] **Order, idempotency, failure:** the sequence and the failure table above; each row has a test that kills the driver at
      that point and resumes it, through the interface of `advanceWorkspaceDeletion` with in-memory ports.
- [ ] **Deletion record:** the ledger plus `platform.workspace.deleted`, decided and justified above; the actions and the
      entity type land in docs/ACCESS.md §4.1 and §4.2 in the commit that writes them (Phase 6); content and retention are
      human decides.
- [ ] **Billing terms:** the issue's "the Polar subscription is cancelled" is **replaced** by a gate (refuse while a paid
      subscription is live, cancel in billing first), no refund, and one undoable write for a late subscription; a person
      confirms this (Human decides 1).
- [ ] **Slots:** the owner's membership count falls by one and nobody else's changes; deleting the only workspace gives the
      person a fresh Free workspace on their next request, from every session.
- [ ] **What is left behind:** the table above, each row tested (a share token of a deleted workspace answers not-found; a
      session with the deleted workspace active moves or recovers).
- [ ] **Export:** the screen warns that none exists.
- [ ] **#999 stays closed:** `organization/delete` answers 404 for an owner after the change.
- [ ] **Warning key:** removed from all 23 locales by Phase 8, blocked by the #989 change.
- [ ] Every ticket the slicing yields is `risk-high` and needs its own security and tenancy verdict before an unattended run
      claims it.

## 📝 Risks & Impact Review

`risk-high`: authentication (the step-up, impersonation), tenant scoping (the cascade), money (the gate, the late
subscription), a schema addition, shared contracts (the queue envelope, the Better Auth hooks, `requireOrg`).

- **Backward compatibility** (BACKWARD_COMPATIBILITY.md): the migration is one new table; the queue union only gains kinds,
  producers ship a release after the handlers, and the one new server function is new, so its required fields break no old tab; the `requireOrg` change widens what a request survives; no D1 table is recreated.
- **Data loss is the feature**, so every slice's refusals are tested before its happy path, and the guard is one statement.
- **Cost:** one Polar `GET` per deletion attempt, R2 list and delete calls proportional to the workspace's objects, two cron
  reads a tick (an indexed `state, updated_at` query that returns nothing in the steady state).
- **Residuals stated:** trip-room storage up to seven days (idle alarm); Workers logs and Sentry keep ids until their own
  retention; the Polar customer and tax records are kept; a refund is a person's decision.

### Out of scope

Leaving a workspace (plan 10 stage `10-S1`, ADM-02); the #999 closure itself; account deletion beyond reusing this path
(`09-S3`); erasing a person (#811); the stranded-private-trip mechanism (#810, #812); promoting another owner (#995);
removing a member (#1008); a platform administrator deleting a workspace from the console; a workspace export (#1063);
cancelling or refunding a subscription on the owner's behalf; a notice window and deleting a team workspace (a follow-up).

## 📋 Phasing

| Phase | Slice                                                                                                                                                                                                                                          | Blocked by                     | Usable when it merges                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| 1     | Contract: the ledger table and its catalog module, SPEC §5 and ACCESS §2.6 amendments, an ADR                                                                                                                                                  | none                           | A deletion can be recorded and resumed; nothing user-visible     |
| 2     | `deleteWorkspace` and the drain in `repos`, with the isolation and slot tests                                                                                                                                                                  | none                           | A workspace row can be removed safely (no caller yet)            |
| 3     | The shared resolve-or-provision (atomic, skips a banned user) used by `requireOrg` and `loadShell`                                                                                                                                             | none                           | Deleting a workspace can no longer strand a person               |
| 4     | `deletePrefix` (the `ObjectStore` port gains `list`), `WORKSPACE_R2_PREFIXES` and the key-family drift test                                                                                                                                    | none                           | A workspace's objects can be swept and the list cannot drift     |
| 5     | Billing: the webhook guard for an unknown organization (ships on its own, fixes a live bug), the gate, the Polar `GET`, the fence hooks, `addMember` and checkout refusal, the `workspace-late-subscription` handler and its Polar credentials | 1 (the fence reads the ledger) | A deleting workspace can no longer be billed or joined           |
| 6     | The driver, the `workspace-deletion` handler, the cron branch, the system scope, the retention prune, the audit vocabulary and its ACCESS §4 amendments, tolerance of deleted workspaces                                                       | 1, 2, 4, 5                     | A recorded deletion completes by itself, from a test entry point |
| 7     | `deleteWorkspaceFn`, `verifyStepUp` (extracted, rate limited, passkey delete unchanged), the receipt email, and the producers (the request's enqueue, the webhook's `workspace-late-subscription`)                                             | 3, 6                           | An owner can delete a workspace through the server function      |
| 8     | The Danger zone card, the dialog, copy in 23 locales, the e2e journey, removal of the #989 warning key                                                                                                                                         | 7, #989, #1008                 | An owner can delete a workspace from the product                 |

Phases 1 to 4 can start at once (the webhook guard of Phase 5 can start at once too). The producers ship in Phase 7, a release
after the handlers of Phases 5 and 6. The erasure spec's engine phases are blocked by Phase 6, which mints the system scope.

## 📋 Implementation Plan

Each phase is its own ticket and carries its own `risk-high` verdict.

### Phase 1 - Contract and ledger

`workspace_deletions` in `src/server/db/schema.ts` and its migration (`pnpm db:generate`), `src/server/catalog/workspace-deletions.ts`
(insert-or-return, compare-and-set with a lease, list stale, `workspaceDeletionPending`, prune), the docs/ACCESS.md §2.6
amendment, the SPEC §5 amendment (thirteenth global table, the inapplicable platform-actor clause and what guards the ledger), an ADR "One path to delete a workspace". **Test seam:** the catalog functions through their
interface (a second insert returns the first; a stale lease is takeable and a live one is not; `done` rows older than 30 days are
pruned and others are not; a `refused` row is pruned after 30 days and a `swept` one never); the module-graph guard still passes and a
test pins the importers of the catalog module.

### Phase 2 - `deleteWorkspace`

In `src/server/repos/members.ts`: `deleteWorkspace(scope)` (owner assertion, the guarded statement, returns whether it deleted)
and the drain (§ The sequence): bounded steps selected by `LIMIT` subselect with the same sole-member predicate, trips first
(the room closing is a callback the driver passes in, so `repos` stays free of the room client), then the table list. **Test seam:** through
the repository interface: owner deletes, others (`admin`, `member`) are refused; a second member makes it refuse and delete
nothing, including mid-drain; A's deletion leaves B's rows untouched and counts of both; a cascade-completeness test that
enumerates every table with an `organization_id` column from the schema and asserts each is empty for A and unchanged for B (it
fails when a future table forgets `orgRef()`); a volume case with more trips than one step, and one with more `audit_log` rows
than one step.

### Phase 3 - Stale session recovery

One shared function beside `resolveActiveWorkspace`, called by `requireOrg` and `loadShell`. **Test seam:** a session naming a
deleted workspace moves to the oldest remaining membership; with none it provisions one personal workspace, once, under
parallel requests; a banned user is given none.

### Phase 4 - R2 sweep

`deletePrefix` beside `deleteObjects` (the `ObjectStore` port widens with `list`), `WORKSPACE_R2_PREFIXES`. **Test seam:** a fake bucket: 1,000-key batches, the run cap,
resumability, another workspace's prefix untouched (a prefix ends in `/`, so `<org>1` is not `<org>10`); the drift test.

### Phase 5 - Billing and the fence

`subscriptionBlocksWorkspaceDeletion`, the Polar list read, the webhook guard (unknown or ledgered organization: 200, nothing
written), the `workspace-late-subscription` handler with `POLAR_*` in `TaskBindings` / `TaskSecrets` and the billing task union
member, `organizationHooks`, `addMember` and the checkout refusal (no producer yet). **Test seam:** the pure gate per status;
the webhook for a deleted organization (no 500, no row); the late subscription cancelled at period end and never revoked; a member
add, an invitation create and an accept refused while a ledger row exists.

### Phase 6 - Driver

`src/server/workspace-deletion/`, the `workspace-deletion` handler (a new envelope id per hop, `delaySeconds`, `TaskRetryableError`
on a held lease), the cron branch, the system scope (and a test that no route or server function imports it), the retention
prune, the audit actions and entity type with their ACCESS §4.1 / §4.2 amendments, and a deleted-workspace test for every task
kind. **Test seam:** the driver
through `advanceWorkspaceDeletion` with in-memory ports, killed and resumed at every state; two drivers at once; the cron path
without a queue; a hop chain longer than the 24-hour done-marker would allow with a reused id; the `swept` second pass not
running before 15 minutes; the audit append written once under a lease overrun.

### Phase 7 - Request entry

`deleteWorkspaceFn`, `workspace-delete-writes.ts`, `verifyStepUp` (with the per-user KV rate limit), the receipt email, the
producers of both queue kinds. **Test seam:** every refusal of "The confirmation" called directly, including the precondition
id (a second tab that now resolves to the replacement workspace deletes nothing) and the rate limit; the passkey-delete tests
unchanged; a passkey-only account with a stale session refused.

### Phase 8 - Screen

The card, the dialog, the 23-locale copy, the e2e journey, removal of the warning key. **Test seam:** the component states; the
journey; the i18n parity test.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json`, run on the last commit of every ticket's PR. This spec's own PR
changes documents only: `bash .ai/scripts/check-generated.sh` and `pnpm exec vitest run --project=tooling scripts/specs` prove
the index and the registry guard. The docs-grep rule (`CODE_REVIEW.md` "Docs and CI") was run for the terms
`deleteWorkspace`, `organization/delete`, `disableOrganizationDeletion`, `workspace deletion`, `WORKSPACE_LIMIT`, `#1000`.

## Human decides

Open items a person decides. This spec does not decide them and records the default it assumed.

1. **Cancellation and refund.** Assumed: the product cancels and refunds nothing; the owner cancels in the billing portal before
   deleting; a late subscription is set to end at the period end. The owner forfeits the rest of a paid period. A `past_due`
   subscription already set to cancel at the period end can still be retried by Polar after the workspace is gone.
   Alternatives: cancel at the period end for the owner as part of the deletion, or revoke at once for `past_due` and
   `unpaid`; any refund or proration.
2. **What the deletion record holds and for how long.** Assumed: the audit row holds ids, the actor, counts and the plan, no
   workspace name or email, for 400 days (the table's prune); the ledger holds no content, and the workspace name and owner's
   address only until the receipt is queued, and is pruned 30 days after completion.
3. **A notice window and team workspaces.** Assumed: none; a workspace with other members is not deletable until they are
   removed (#1008), which narrows the issue; the slicing run files the follow-up.
4. **Whether the receipt email is wanted** (assumed yes: it is the owner's out-of-band warning if a borrowed session deleted the
   workspace).
5. **Whether a passkey-only account must make a fresh passkey assertion** instead of a session younger than the library's
   `freshAge` (assumed no: one step-up rule serves both deletions; the stronger check is one change in `verifyStepUp`).

### Follow-ups the slicing run files

Not part of the phases above: a ticket for deleting a team workspace through a notice window (blocked by #1008), and a ticket
that lists and removes the memberless workspaces of #1062 through the same `deleteWorkspace`.

## Resolved assumptions

| #   | Question                                                   | Applied default                                                                                                                                                                                                                                                                                                                                                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | May an unattended run take this `risk-high` issue?         | Yes, as a spec-writing task; every implementation ticket gets its own security and tenancy verdict.                                                                                                                                                                                                                                                                                 | Decided by the security and tenancy sub-agent (confidence high, the brief): the run produces a document a person merges.                                                                                                                                                                                                                                                                                                         |
| 2   | One spec or split now?                                     | One spec; slicing is `afk-to-tickets`' job.                                                                                                                                                                                                                                                                                                                                         | Decided by the product owner sub-agent (confidence high, the brief): one operation's order is one invariant (SPEC §8).                                                                                                                                                                                                                                                                                                           |
| 3   | Owner only, or owner and admin?                            | Owner only, on the server, by `assertRole`.                                                                                                                                                                                                                                                                                                                                         | Decided by the product owner sub-agent (confidence high, the brief); confirmed by the security sub-agent (confidence medium) against `context.ts`: `assertCanAdminister` admits admin.                                                                                                                                                                                                                                           |
| 4   | When does it take effect, and who may be in the workspace? | Immediately, and only when the owner is the only member; no notice window.                                                                                                                                                                                                                                                                                                          | Decided by the security, product and architect sub-agents (all medium): all three chose the sole-member rule (ADR 0007, one guard shared with plan 09 and the erasure engine). The security sub-agent also wanted a seven-day cancellable window; the other two judged it a scheduled state with nothing else needing it, so the more reversible direction is recorded as a follow-up and as a human-decides item.               |
| 5   | The confirmation proof                                     | Typed name, then password when the account has one or a session younger than `freshAge` when it has none; no impersonation.                                                                                                                                                                                                                                                         | Decided by the product owner (confidence high) and architect (medium) sub-agents; the security sub-agent (medium) agreed on A and asked for a fresh passkey assertion for passkey-only accounts; the `/passkey/authenticate/*` endpoints could provide it, but one step-up rule for both deletions was chosen and the stronger check is a Human decides item (5). Round 2 added the per-user rate limit and the precondition id. |
| 6   | Cancel the subscription, or refuse while it is live?       | Refuse while it is live (the erasure spec's rule); the one automatic write is cancel-at-period-end for a late subscription.                                                                                                                                                                                                                                                         | Decided by the product owner (high) and security (medium) sub-agents; the architect (medium) preferred cancelling by status. Applied the more reversible option (nothing irreversible with money); billing terms stay a human-decides item. The architect's webhook point (no outbound call there) is why the late cancel is a queue task.                                                                                       |
| 7   | The deletion record                                        | A ledger for state plus one `platform.workspace.deleted` audit row (ids, counts, plan; no name); the audit append is idempotent and verified.                                                                                                                                                                                                                                       | Decided by all three sub-agents (high, high, medium): the erasure spec's shape; the ledger alone is pruned and the audit alone cannot resume. Retention is human decides.                                                                                                                                                                                                                                                        |
| 8   | The owner deletes their only workspace                     | Allowed; every session recovers by provisioning a fresh Free workspace; the screen says so.                                                                                                                                                                                                                                                                                         | Decided by the product owner (medium) and architect (high) sub-agents; the security sub-agent (medium) preferred refusing. All three found that the brief's "the next request provisions one" was false as the code stood, so Phase 3 makes it true. Refusing would send the person to an account deletion that has no self-service yet.                                                                                         |
| 9   | Holes in the proposed order                                | Added: lease and compare-and-set, the fence on membership and checkout, a bounded drain, the throwing audit with read-back, a second R2 pass, the cron calling the driver directly.                                                                                                                                                                                                 | Decided by the three sub-agents' independent reads of `consumer.ts`, `worker.ts`, `webhook.ts` and `store.ts`; the security sub-agent's call to `deleteAll` every room was not applied (the architect found the room's idle alarm erases it; a stated residual) because capturing trip ids needs an unbounded store.                                                                                                             |
| 10  | Does the spec edit anything but itself?                    | Notes in plans 09 and 10, an amendment in the erasure spec, two `CONTEXT.md` entries.                                                                                                                                                                                                                                                                                               | Default applied: the brief asks for the cross-plan notes, and the repo's docs rule asks every document that states what this changes to be updated.                                                                                                                                                                                                                                                                              |
| 11  | Round 2 findings                                           | Applied all: a per-user password rate limit, a precondition `expectedOrganizationId`, the ledger inserted before the mutable-state checks (closes the join window), a bounded drain with `LIMIT` subselects over the large tables, new envelope ids per queue hop, a shared atomic provisioning used by `requireOrg` and `loadShell`, the producers one release after the handlers. | Decided by the three round 2 reviews, each verified against the code by its author. Where two reviewers differed on the receipt name (the ledger holds none vs the email needs it) the more reversible reading was taken: held until queued, then cleared, and listed under Human decides 2.                                                                                                                                     |

## Panel verdicts

| Specialist                    | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security and tenancy reviewer | Round 1 on the decision brief: approve under the sole-member rule, no automatic cancel or refund, and the listed conditions. Round 2 on this spec: changes (nine findings: password rate limit, ledger vs SPEC §5, erasure room reset, banned user and atomic provisioning, the fence and `addMember`, receipt name, the `organization` delete exception, audit append under a lease overrun, passkey and webhook-after-refusal); every one applied in this spec. Escalates the money terms and the retention to a person (Human decides 1, 2) |
| Product owner                 | Round 1 on the decision brief: sole-member, name plus step-up, refuse while a subscription is live. Round 2 on this spec: changes (ten findings: Phase 3 before Phase 7, receipt name, #1008 and the refusal copy, billing copy, vocabulary landing phase, one owner of the system scope, Trip export, copy, the several-owners sentence); applied. Escalates the money terms and the narrowing to sole-member workspaces to a person (Human decides 1, 3)                                                                                     |
| Software architect            | Round 1 on the decision brief: state machine sound with seven changes (applied). Round 2 on this spec: changes (ten findings: queue hop ids and the done-marker, `loadShell` and atomic provisioning, the precondition id, the drain's bounds and the 100-parameter ceiling, Polar credentials in the queue, the two-release split, the `organization` delete exception, the receipt payload, the SPEC §5 clauses, staging cron and `ObjectStore.list`); applied. No escalation                                                                |

Two rounds ran (the limit of `afk-plan-to-spec` §5); the round 2 changes were applied by the author and not re-reviewed by the
same specialists, which the spec PR says plainly.
