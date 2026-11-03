# ADR 0048: One path to delete a workspace

- Status: accepted
- Date: 2026-11-03
- Issue: #1737
- Design: `.ai/specs/2026-10-17-delete-a-workspace-you-own.md`

Workspace cascades must not erase the state needed to finish a deletion. Add the global
`workspace_deletions` ledger to the existing global-table carve-out in SPEC §5. Its organization
id is attribution without a foreign key. No tenant content is retained except temporary receipt
name/email, cleared on receipt enqueue or refusal. Erasure initiators carry neither.

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

State transitions and checkpoint updates require both the expected state and a live lease token.
Expired workers cannot release a replacement lease. Bounded stale discovery excludes terminal
rows; bounded retention removes only done/refused rows after 30 days, never unfinished recovery.
The erasure registry explicitly retains requester attribution and temporary receipt fields until
their documented cleanup. Tooling pins actual readers and forbids production writers until the
driver lands; the catalog import graph still cannot reach tenant repositories.

Reserve `system:workspace-deletion` for that later driver's scope bound to its leased ledger row.
A request may never fabricate it. The later implementation needs a transitive import guard.
This reservation changes no existing request authorization or payment policy.
