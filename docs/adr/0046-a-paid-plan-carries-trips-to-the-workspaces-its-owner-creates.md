# 0046. A paid plan carries unlimited trips to the workspaces its owner creates

Status: accepted
Date: 2026-10-24
Issue: #998 (spec `.ai/specs/2026-10-24-carry-a-paid-plan-across-workspaces.md`)
Amends: SPEC §5/§6 (a cross-workspace billing read and a third closed auth write), ADR 0043

## Context

A workspace created from the account menu has no subscription and resolves to Free, so a paying owner who creates a
second workspace lands in a Free one. Carrying the owner's plan needs a workspace to be entitled by a subscription it
does not own. That touches three contracts at once: the tenant boundary (a read across two workspaces), the auth layer's
closed list of writes (the link is written when the workspace is created) and the rule that the organization is the
only unit of billing. The security and tenancy specialist approved a first slice, on conditions, and rejected any wider
one.

## Decision

**1. The first slice carries unlimited trips and nothing else.** A carried workspace keeps Free's plan identity,
modules, metered-call ceilings, seats, storage and `quota_overrides`. Carrying those would multiply the sponsor's ceilings
by up to 20 workspaces, a pricing term for a person; they are #1012 (plan identity and ceilings) and #1013 (pooled seats
and storage).

**2. The link is a row in a new table, never a column or a metadata key.** `workspace_carries` is keyed by the carried
workspace and references both organizations with `ON DELETE CASCADE`. A foreign key added to Better Auth's `organization`
by `ALTER TABLE ADD COLUMN` is enforced as `NO ACTION` on D1 (ADR 0044), and `organization.metadata` is editable by an
admin. The row is written only inside the creation batch and no tenant-facing path writes it. Workspaces created before
the change have no row and stay Free.

**3. The link is the sponsor workspace's, always.** The sponsor is the workspace that holds the subscription. A workspace
created from a carried workspace is carried by the same sponsor, never by the carried one, so depth is one by
construction and chaining (#989) cannot occur. The sponsor is chosen inside the `INSERT … SELECT`, not passed in.

**4. The carry holds only while all of this is true, on every read:** the workspace's own row is not an entitling paid
plan; a link exists; the sponsor's own row resolves to a paid catalogue plan in an entitling status; and the person who
recorded the carry is still an owner of the sponsor and of the carried workspace (the composite-role-aware owner
predicate). Nothing is inferred from the roles of other people. Each lapse returns the workspace to Free and deletes and
locks nothing.

**5. One cross-workspace read.** `findSponsorStandingUnscoped(db, organizationId)` in `src/server/repos/billing.ts`
takes a plain `Database` under SPEC §5 FU-3 and returns the sponsor's `status`, `plan`, `seats` and `providerProductId`,
the carry's `createdBy`, and two booleans (the creator owns the sponsor, the creator owns the carried workspace). It
returns no sponsor id, name, member, trip or other content, takes only the caller's own active organization id, and cannot
list. It has **two** named production callers, `resolveQuotas` and `createSubscriptionStore().findByOrganization`: the
guard and the loader are different layers that must give one answer, and a source test fails on a third. FU-3's
"one named production caller per function" gains this single, named exception. The decision itself is one pure function,
`applyCarry`, in `src/server/billing/limits.ts`.

**6. One auth write.** `src/server/auth/carry.ts` is a write-only sibling of `auth/participation.ts` (no select, update
or delete of its own) that puts one conditional statement into `createOrganizationFor`'s batch. SPEC §5 names it as a
third closed leaf of the auth layer and a source test pins its writers.

**7. The screen learns a flag, not the sponsor.** `Entitlements.carry` is `none`, `carried` or `lapsed`. Members of the
carried workspace may not belong to the sponsor, so the sponsor's name, plan, status, period and `past_due` state never
reach them.

**8. The cache lag is stated.** `CachedPlanState` gains the resolved carry (the cache version moves `v5` -> `v6`). After a
lapse or an ownership change the cached screen and the transit-search ceiling lag at most 60 s; the repository guard reads
D1 on every call, so new trips are refused immediately. The webhook does not evict carried workspaces, which would need a
"workspaces this sponsor carries" listing this design refuses to have.

**9. A sponsor that is deleted, or whose owner changes, puts the carried workspace back on Free.** The row cascades with
the sponsor; a transfer or demotion makes the recorded creator no longer an owner, so the carry stops. Nothing is
re-linked and no one adopts it. This is the one decision the spec leaves for the person merging it (it overlaps #989 and
#1000); it is the most reversible choice, because an adoption path can be added later and cannot be taken back.

## Consequences

- SPEC §5 (FU-3 and the auth-layer paragraph), SPEC §6 and `CONTEXT.md` are amended in the spec's pull request. The
  "organization is the only unit of billing" sentence is no longer true.
- Free's metered allowance (geocoding 200, weather 300 a month) multiplies by the number of carried workspaces: up to 19
  per owner of the sponsor. Accepted, and stated in the spec for a person.
- The implementation tickets add tests for tenant isolation: a member of the carried workspace who is not in the sponsor
  reads nothing of the sponsor, a forged or unrelated link grants nothing, a link written through the organization update
  endpoint is ignored, each lapse and ownership change returns the workspace to Free, and the screen and the guard agree.
- `workspace_carries.created_by` joins the erasure registry as **remove**.
