# 0043. Erasure outcomes, the participation anchor and a third catalog member

Status: accepted
Date: 2026-10-18
Issue: #1054 (parent #1053, spec `.ai/specs/2026-10-08-erase-a-persons-data.md`, phases 1 and 2)
Amends: SPEC §5/§6 (the catalog exception grows from two members to three), ADR 0034

## Context

Console account deletion removes the Better Auth `user` row and lets the auth tables cascade. The
49 `userRef()` columns across the domain tables keep ids that now point at nothing, and nothing
finds the workspaces a person took part in once they have left them, because `member` no longer says
so. An erasure needs a fixed outcome for every place a person's data lives, a way to find the
workspaces, and a promise that a new column cannot be added without a decision. This ticket ships the
contract and the anchor; it ships no erasure, no deletion and no producer.

## Decision

**1. Five outcomes, in one registry.** `src/server/erasure/registry.ts` is data and no SQL. Each entry
names a table and column, where it came from (`user-ref`, `auth`, or `embedded` for a user id held
inside another column), one of **remove**, **anonymise**, **null**, **revoke** or **keep**, a reason, the
module that will own the scrub and the engine step. A drift test parses `src/server/db/schema.ts` and
`auth-schema.ts` and fails on a column the registry misses or names without a schema column behind it,
and a fixture that adds a column proves the failure. The platform audit ledger is the one `keep`.

Outcomes the spec predates, decided here:

- `trip_invite_links.created_by` (ADR 0042) is **revoke** and anonymise: the link stops resolving
  once its creator is gone, and the id must not remain on the row.
- `calendar_feeds.user_id` is **remove**: the feed is the person's own.
- `staff_api_tokens.user_id` is **revoke** and `staff_api_tokens.created_by` is **anonymise** only:
  the credential cannot be deleted, and attribution is all `created_by` holds.

**2. The Former member.** A row another person's record needs stays, attributed to `erased_<nanoid>`:
one id per workspace per erasure, held in the anchor row until the job ends. This amends ADR 0034: a
journey whose owner is erased stays with the Former member as its owner, still readable only by that
owner id, which no session can hold.

**3. The participation anchor.** `workspace_participants` (organization id, user id, and nullable
job-state columns `erasure_id`, `tombstone_id`, `scrubbed_at`) is a tenant table with a composite key,
written wherever a `member` row is created and **never removed by departure**. The term "participation
anchor" is used in prose because "participant" already names trip people. It is written before, or in
the same D1 batch as, every membership insert, never after:

- `createOrganizationFor` puts the anchor insert in its batch between the organization and the owner;
- `addMember` writes the anchor first, so a failed anchor write leaves no membership;
- Better Auth's `organizationHooks.beforeAddMember` writes it before direct member creation;
  recipient acceptance instead includes the anchor in its atomic membership transfer (#1009);
- the dev seed writes it before its direct membership insert.

An anchor left behind by a join that then fails is harmless: erasure finds the workspace and scrubs
nothing. A test lists every membership insert in the source and fails on one with no anchor write.

Issue #1009 amends the original auth-layer restriction: recipient invitation consumption reaches only
`repos/workspace-invitation-acceptance.ts` and its base/batch/context primitives (SPEC §5). Acceptance
writes membership, anchor and accepted invitation in one required atomic batch. Other auth writes
retain the write-only `auth/participation.ts`; their organization id comes from minted ids or resolved
hook data, never a request body. The source and console graph tests pin these closed exceptions.

**4. A third catalog member.** `src/server/catalog/erasure.ts` holds `listWorkspacesHoldingUser` and
`listOrganizationIds`. Both take a plain `Database` and have four properties that stand in for the
repository rule: ids only (an organization id, and the erasure id for the first), keyset-paged with a
fixed maximum page size, read-only, and reached only from the backfill handler in this change (a test
pins the importers; `listWorkspacesHoldingUser` has no production caller until the engine). The registry
names this module as the owner of the global-table and auth-row scrubs (phase 3), which are writes: the
pull request that ships them amends SPEC §5 again first. SPEC §5/§6 and every document that stated "two catalog members" are amended. Every
scrub runs afterwards through a `TenantScope` bound to one workspace. ADR 0041 and ADR 0042 keep their
"closed list of two" sentences as the record of their own day.

**5. The backfill.** People who left before the anchor existed are found by a queue task,
`participant-backfill`, not by a migration (a registry-driven insert is not something
`pnpm db:generate` emits). It is a chain: each message handles the next workspace after a keyset
cursor, which the catalog read finds, then enqueues the next message with the id
`participant-backfill:<runId>:<cursor>`; the message that finds no workspace left writes the KV
marker `erasure:participants-backfilled` (run id and time). The payload carries a run id and a cursor
and no user or organization id; the envelope's `orgId` is `system`, and the work runs under a scope
whose user id is reserved (`system:participant-backfill`). The run keeps its progress in KV (the
last workspace visited), and a message that does not continue it does nothing, so the marker is
written only by a chain that visited every workspace from the start. A message that arrives ahead of its run fails and retries (KV is not read-after-write consistent), and a run that stalls or is dead-lettered is recovered by starting a new run id. A forged envelope can therefore
start a chain but cannot aim it at a person or a workspace, nor finish a run early, and the scope
reads only the registered user columns of the workspace the catalog named. A chain that fails part-way leaves no
marker, and the engine refuses to run until the marker exists. The kind and its handler ship in this
release and nothing enqueues it; the producer comes in a later one (`BACKWARD_COMPATIBILITY.md` §6).

**6. Audit actions are named here and not yet written.** The engine will record `platform.user.erased`
and `platform.user.erase_refused`. `docs/ACCESS.md` §4.2 edits its action list in the commit that
writes an action, so neither the table nor `PLATFORM_AUDIT_ACTIONS` changes in this ticket.

## Consequences

- A new column that names a user fails a unit test until it has an outcome and an owner.
- A person's workspaces can be found after they leave. A missed anchor write costs a later erasure the
  rows in that workspace, which is why the write precedes the member and the backfill also reads
  `member`.
- The migration is additive (`CREATE TABLE`, `CREATE INDEX`); the queue kind is inert until a producer
  lands, so a Worker that predates it never receives one.
- `workspace_participants` has no tenant-facing read.


## Amendment - phase 3b (#1059)

The two discovery reads retain their four original properties. SPEC §5/§6 now explicitly admits
four additional system-actor-only cleanup/count primitives in the same catalog module: scoped
incoming invitations, global verification/impersonation cleanup, platform credential/provider
anonymisation, and counts for the sweep. They have no production caller. The engine must amend
the importer pin and provide its permission/audit boundary and durable session-cache cleanup.
The platform ledger is untouched; a token issuer's erasure never revokes another holder's token.
