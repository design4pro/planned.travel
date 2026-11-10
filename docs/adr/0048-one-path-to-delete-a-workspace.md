# ADR 0048: One path to delete a workspace

- Status: accepted
- Date: 2026-11-03
- Issue: #1737
- Design: `.ai/specs/2026-10-17-delete-a-workspace-you-own.md`

Workspace cascades must not erase the state needed to finish a deletion. Add the global
`workspace_deletions` ledger to the existing global-table carve-out in SPEC §5. Its organization
id is attribution without a foreign key. No tenant content is retained except temporary receipt
name/email, cleared on accepted receipt enqueue or after accepted refusal notice, confirmed
audit and terminal refusal CAS. Erasure initiators carry neither.

The catalog module owns all ledger SQL. Its eventual sole production writer is the durable driver,
reached through the owner-authorized, step-up-protected request or authorized erasure/queue/cron
paths. Platform configuration permission and one audit per checkpoint are inapplicable; the driver
will audit deletion itself. This slice supplies no driver, producer, destructive endpoint or
system-scope factory. Better Auth organization deletion remains disabled.

A partial unique index permits one non-refused row per workspace. All such states, including done,
fence membership additions, invitation creation/acceptance, checkout and plan changes. Refusal
lifts that fence. Atomic repository inserts include the catalog-owned anti-exists predicate, a narrow exception
to tenant statements reaching a global table that returns no ledger projection; Better Auth hooks and
external billing calls have a check/write window. The future guarded deletion and late billing
handling remain mandatory before activating a producer. Ordinary reads gain no lookup.

Every reserved-driver destructive statement binds the catalog-owned
`workspaceDeletionAuthorityPresent` EXISTS beside its existing tenant/member/subscription guard.
It requires matching organization/deletion/token/initiator/requester, no refusal intent and a strictly
live lease at SQLite execution time (equality/null deny); drain permits only `requested`, final
organization DELETE only `drained`. The trusted catalog authority travels beside scope, outside
request input. `workspaceDeletionAuthorityCurrent` is only a boolean diagnostic for empty reads or
zero-row writes: authority loss returns `lost-lease` without touching replacement state. Real missing
organization recovery and empty-table success require current authority. No ledger projection,
tenant-factory registration, general global join or second deletion path is introduced.

State transitions and checkpoint updates require both the expected state and a live lease token.
Expired workers cannot release a replacement lease. Bounded stale discovery excludes terminal
rows; bounded retention removes only done/refused rows after 30 days, never unfinished recovery.
The erasure registry explicitly retains requester attribution and temporary receipt fields until
their documented cleanup. Tooling pins actual readers and forbids production writers until the
driver lands; the catalog import graph still cannot reach tenant repositories.

Reserve `system:workspace-deletion` for that later driver's scope bound to its leased ledger row.
A request may never fabricate it. The later implementation needs a transitive import guard.
This reservation changes no existing request authorization or payment policy.

Phase 6 implements the reserved scope and the transitive request-import fence in
`src/server/workspace-deletion/`. Recovery selects five unfinished rows older than fifteen minutes;
same-state checkpoints retain the first-sweep timestamp. Erasure verification has an atomic,
envelope-scoped consumer with winner-redelivery recovery. The deletion audit append throws and
verifies one durable row per deletion id; its vocabulary and retention remain owned by ACCESS §4.
Public request and webhook producers remain a separate activation slice.

The queue adapter accepts only a deletion id, gives every continuation a fresh envelope id and a
30-second delay, and retries a held lease without writing a completion marker. Persistence and R2
effects derive their scope from the leased ledger row. Receipt/refusal delivery, erasure resume,
room operations and trusted audit-actor resolution remain explicit ports; the reserved tenant scope
does not supply a platform actor. Post-cascade billing validates the complete bounded provider list
before any cancellation patch and confirms period-end cancellation. Failed reads or patches leave
the driver recoverable. Consumer registry and Worker scheduler composition must be completed before
this Phase 6 candidate is deployable; no public producer is enabled by these adapters.

The weekly retention branch invokes the driver ledger adapter's bounded terminal-row prune in
the same `Promise.allSettled` group as the existing retention work. The erasure handshake exposes
state only, parks before `rows_deleted` without consuming an envelope, and re-reads after the atomic
consume so a winning redelivery can recover. A refusal returns `workspace-refused:<deletionId>`;
it does not implement or activate the erasure engine. Registered booking imports check that the
workspace exists before reading an R2 source, and billing follow-ups tolerate a missing workspace.
Room-eviction acknowledgements and post-deletion object cleanup keep their existing handlers.

The Phase 6 refusal correction persists a nullable validated `refusal_reason` under the live
lease before any fallible follow-up. The row remains requested/drained and fenced until delivery
and audit succeed. No destructive transition may follow durable refusal intent. Audit insertion
predicates on persisted state/outcome and current lease; retries retain one audit id. Owner refusal
notice is a separate awaited, fail-closed activation port; erasure uses its wake port only.
Runtime sanitizes outgoing errors before consumer diagnostics/dead-letter storage while preserving
retry classification. Production erasure wake still needs the separately owned #1060 consumer;
erasure-initiated inserts remain forbidden. AC9 separately stages strict immutable delivery
requests and matching-id acceptance before CAS for local contract verification. Canonical
nonterminal erasure resumes are retryable, original deliveries park without consuming, and cron
reissues the same id after audit/CAS failure or exhaustion. This internal contract needs independent
acceptance; it neither supplies the production consumer nor waives its activation hold.
