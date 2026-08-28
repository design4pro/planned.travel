# 0007. A trip is private to its members unless it says otherwise

Status: accepted
Date: 2026-08-28

## Context

`trips.visibility` (`private` / `organization` / `public`, default `private`) has existed since the schema was laid down and nothing reads it: `requireTrip` resolves any trip inside the caller's organization and `listTrips` lists every trip in it, so today every organization member sees every trip. The trips plan (`docs/plans/01-trips-core.md`) added a per-trip role guard on writes while leaving reads organization-wide, which made the `viewer` role meaningless and the `visibility` column a trap. The reference product scopes a trip to its owner and members and answers a non-member with "not found".

## Decision

Trip reads are scoped by membership and visibility, not by the organization alone. A trip is readable by its members always, by every organization member when `visibility = 'organization'`, and by nobody else; a trip the caller may not read raises `NotFoundError`, exactly as a foreign tenant's does, so the answer never reveals that the trip exists. `private` stays the default. `public` is reserved for session-less sharing (share tokens, gallery) and grants nothing to a signed-in reader on its own.

Considered and rejected: keeping reads organization-wide and deleting `visibility`. Cheaper, but it diverges from the reference on the one axis a customer notices first (who can see my trip), collapses the role model to owner/editor, and would be the harder change to make after tenants have data.

## Consequences

Every trip-scoped read — `requireTrip`, the trip lists, the dashboard loaders, the per-trip counts — must apply the membership-or-visibility predicate, and a member-isolation test class sits beside the tenant-isolation one: in A's own organization, a non-member of a private trip gets `NotFoundError` and sees no row, count or aggregate of it. `viewer` is a real role again: a member who reads and is reminded but does not write. Whether the reader can change `visibility` from the trip form, and when, is decided by the plan, not by this record.
