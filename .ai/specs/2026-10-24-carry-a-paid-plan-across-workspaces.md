# A paid plan's unlimited trips follow the owner into the workspaces they create

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #998  |
| **Spec PR**        | none  |
| **Implementation** | none  |

## 📝 TLDR

A workspace created from the account menu starts on Free (2 trips), whatever the creator pays for the workspace they
created it from. `createWorkspace` reads only the active workspace's plan, so a paying owner who creates a second
workspace lands in a Free one and, from there, is told to upgrade before they may create a third (#988 fixed the
copy around that, not the behaviour).

This spec designs the **first slice** of carrying the plan: a workspace created by an **owner** of a workspace that has
its own entitling paid subscription is recorded, by the server, in the same batch that creates it, as **carried** by
that subscription (the **sponsoring subscription**, held by the **sponsor workspace**). While the sponsor stays
entitling and the person who made the link is still an owner of both workspaces, the carried workspace has **unlimited
trips**. It inherits nothing else: not the plan's identity, not its modules, not its metered-call ceilings, not its
seats, storage or `quota_overrides`. The create gate then stops sending a paying owner to pay again from a workspace they
created.

The link is a row in a new server-only table (`workspace_carries`), never a column or a key in the organization's
editable metadata. One new `…Unscoped` function reads the sponsor's standing; one pure function applies it; the
repository guard (`resolveQuotas`) and the billing plan-state loader both end in them, so the screen and the guard
cannot disagree. Going back to Free (cancel, unpaid, demotion, a sponsor that is deleted) deletes and locks nothing:
trips over the Free cap stay readable and exportable and only new creates are refused.

Plan identity, metered-call ceilings and the pooled seats-and-storage are **not** in this spec: they are #1012 and
#1013, and the cost section below says why a person should decide them separately. Three tickets, in order.

## 📝 Problem Statement

Measured at `HEAD` (`e11cbac3`) by reading the code.

### What happens today

- **A created workspace has no subscription.** `createWorkspace` (`src/server/fns/workspace-writes.ts:106`) writes the
  organization, its participation anchor and the creator's `owner` membership in one `db.batch`
  (`createOrganizationFor`, `src/server/auth/provisioning.ts:99`). No `subscriptions` row exists, so
  `resolveQuotas` (`src/server/repos/base.ts:516`) feeds `limitInputsFromRow(null)` and gets `FREE_INPUT` (2 trips,
  1 seat, 100 MB).
- **The gate reads one workspace.** `createWorkspace` refuses with `upgrade-required` when
  `resolveQuotas(scope).planId === 'free'` (`:127`), where `scope` is the workspace the caller is in. After a paying owner
  creates workspace B from workspace A and the dialog activates B, a second create from B is refused. The
  `workspace.createUpgrade` copy tells them to switch back to A, and `workspace.createDescription` says the new
  workspace "does not share the plan of the workspace you are in" (both added by #988; en text in
  `src/lib/i18n/messages/en/shell.ts:126-130`).
- **Two readers, one resolver.** The guard reads the active workspace's own `subscriptions` row in D1 on every call
  and ends in `resolveLimitsFromRow` (`src/server/billing/limits.ts:416`). The billing screen goes
  `entitlements()` -> `loadPlanState()` (`src/server/billing/entitlements.ts:145`), which caches a `CachedPlanState` in
  KV for 60 s under `billing:plan:v5:<organization>` (`planStateCacheKey`, `:69`) and ends in `resolveLimits`
  through `effectiveLimitsFor`. A second caller of the cached state enforces something: `transitCeiling`
  (`src/server/fns/transports.ts:523`) reads it to set the transit-search ceiling.
- **Nothing links two workspaces.** No table, column or function relates a workspace to another; the only
  cross-workspace billing reads are the `…Unscoped` webhook lookups in `src/server/repos/billing.ts`, which take an id
  they were given and return billing rows only.
- **Only the billing webhook writes `subscriptions`.** A workspace cannot get a row by any other path
  (`upsertSubscriptionUnscoped`, `attachCustomer` in `src/server/billing/store.ts`).

### Premises of the brief checked and corrected

The Agent Brief was written before the code below was re-read for this spec. Each correction is recorded in the PR body.

1. **"Returns status, product id and the creator's owner role" is too narrow.** Whether a sponsor is on a _paid_ plan is
   not decidable from the status and the product id alone: `planIdFromRow` (`limits.ts:268`) falls back to the `plan`
   tier column and `seats` when the product id maps to no catalogue plan, and an `active` row can be a Free one. The
   read returns `status`, `plan`, `seats` and `providerProductId` (billing columns, the same four the resolver already
   reads) plus the two ownership booleans, and the pure function requires `planId !== 'free'` after
   `limitInputsFromRow`. It still returns no tenant content.
2. **"One named function" has two callers, not one.** FU-3 asks for one named production caller per `…Unscoped`
   function. The guard (`resolveQuotas`, repos) and the loader (`createSubscriptionStore().findByOrganization`,
   billing) are two ends of the one resolution and are in different layers, so the function has exactly **two** named
   callers and the amendment says so (below). The create gate is not a third: it goes through `resolveQuotas`.
3. **"Written only inside the creation batch" is SQL in the auth layer.** `createOrganizationFor` is in
   `src/server/auth/provisioning.ts`, and SPEC §5 lets the auth layer reach the tenant graph through closed leaves
   only. The carry write is one more statement in that batch, from a write-only sibling of `participation.ts`
   (`auth/carry.ts`); SPEC §5 is amended to name it and a source test pins it.
4. **The second cached caller (`transitCeiling`) must not see the carry.** A design that raised `planId` would raise the
   transit-search ceiling with it. The carry is a trips-only overlay and `planId`, `rates` and the modules stay Free's.
5. **"A trip-limit refusal in a carried workspace names the sponsor's plan" cannot be built as written.** A carried
   workspace has unlimited trips, so it never refuses a trip create while the carry holds; once it lapses the workspace
   is plainly Free. And naming the sponsor's plan, name or status to the carried workspace's members would tell people
   who may not belong to the sponsor what another workspace pays for or whether its card failed. The refusal after a
   lapse says that the plan which carried this workspace has ended, with no sponsor detail (Copy).
6. **The deletion path is not what the brief assumes.** `deleteWorkspace` exists (`src/server/repos/members.ts:164`,
   #1057), requires a sole member and refuses a live paid subscription; the broader owner-facing path is
   `.ai/specs/2026-10-17-delete-a-workspace-you-own.md` (#1000, `ready`). A sponsor can be deleted while still entitling
   only when its subscription is set to cancel at period end. The conclusion the design draws (the link cascades away)
   holds either way.

### Who has the problem

A person who pays for Solo or Crew and uses workspaces to separate a family holiday from a client's itinerary
(`.ai/specs/implemented/2026-09-20-multiple-workspaces.md`). They bought "unlimited trips" and receive two.

## 📝 Proposed Solution

### Vocabulary (`CONTEXT.md` gains three entries and a corrected one in this spec's PR)

- **Sponsoring subscription** - the paid subscription of one workspace (the **sponsor workspace**) when it also carries
  workspaces its owner created.
- **Carried workspace** - a workspace created by an owner of a sponsor workspace, recorded as such at creation. It has
  unlimited trips while the carry holds and is otherwise exactly as it was.
- **Carry** - the record, and the state it yields. Not a second subscription and not a plan. _Avoid_: "shared plan",
  "inherited plan", "team plan".
- **Organization (tenant)** - corrected: still the unit of isolation and of the subscription, but no longer the only unit
  of billing, because a subscription can carry the unlimited trips of workspaces its owner created.

### The rule in one sentence

A workspace's trip ceiling is unlimited when **its own row** is not an entitling paid plan, **and** it has a recorded
carry, **and** the sponsor's own row resolves to a paid catalogue plan in an entitling status, **and** the person who
recorded the carry is still an owner of the sponsor **and** of the carried workspace; otherwise it is what it is today.

"Owner" is the repository's composite-role-aware predicate (a role of `admin,owner` is an owner,
`docs/ACCESS.md` §6.4; `isOwnerRole`, `src/server/fns/console/last-owner.ts:56`), never `role = 'owner'`. It is
evaluated on every read; it is never inferred from a role at request time for a different person, and never cached
beyond the 60 s below.

### Data model (additive)

One new table, in `src/server/db/schema.ts`, created by `pnpm db:generate` (never by hand):

| Column                    | Type                       | Notes                                                                                                 |
| ------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `organization_id`         | text, **primary key**      | The carried workspace. `orgRef()` shape: `NOT NULL`, `REFERENCES organization(id) ON DELETE CASCADE`. |
| `sponsor_organization_id` | text, not null             | `REFERENCES organization(id) ON DELETE CASCADE`. Index `workspace_carries_sponsor_idx`.               |
| `created_by`              | text (`userRef`), not null | The owner who made the carry. Erasure registry entry, outcome **remove**.                             |
| `created_at`              | `createdAt()`              |                                                                                                       |

Why a table and not a column. `organization` is Better Auth's table: a foreign key added to it by `ALTER TABLE ADD
COLUMN` is enforced as `NO ACTION` on D1 (ADR 0044), so a sponsor's deletion would fail instead of cascading, and a
key inside `organization.metadata` is editable by an admin through the workspace settings write. A new table has real
`ON DELETE CASCADE` on both sides: deleting the sponsor, deleting the carried workspace and the withdrawal in
`createOrganizationWithinLimit` (which deletes `member` then `organization`) each remove the link with no extra code.
The migration is a `CREATE TABLE` and an index: additive, no backfill (`BACKWARD_COMPATIBILITY.md`). Dropping the
feature later is dropping a table.

**Workspaces created before the change have no row and stay Free.** There is no backfill: whom to link would be a guess
about who "meant" to pay for what.

No tenant-facing path writes this table. `organization/update` does not (it writes name, logo and metadata), no
server function takes a sponsor id, and `createWorkspaceInput` stays `z.strictObject({ name })`.

### The read: one `…Unscoped` function, two named callers

`findSponsorStandingUnscoped(db, organizationId)` in `src/server/repos/billing.ts` (or a sibling the build ticket
names, with the header justification FU-3 asks for) returns, for the carried workspace `organizationId` only:

```ts
interface SponsorStanding {
  status: string
  plan: string
  seats: number
  providerProductId: string | null // the sponsor's own subscription row
  createdBy: string // the owner who recorded the carry; the create gate compares it to the caller
  creatorOwnsSponsor: boolean // createdBy is an owner of the sponsor today
  creatorOwnsCarried: boolean // createdBy is an owner of this workspace today
}
```

`createdBy` is a member of the carried workspace's own tenant and is used only by the create gate; it is dropped before
anything reaches a client (`Entitlements.carry` is the closed value below and nothing else). The workspace's own
subscription row is not in the projection: the caller already has it and passes it to the pure function.

It is one statement over `workspace_carries`, the sponsor's `subscriptions` row and two `member` rows, keyed by the
carried organization's primary key. It returns `null` when there is no link, one row at most otherwise, and it **cannot
list**: no function enumerates "the workspaces S carries", because that would be a cross-tenant listing nobody needs.
It never returns the sponsor's id, name, members, trips or any other content. The argument is always the caller's own
active organization id (from `scope.ctx.organizationId`, or from the billing context), never a request value.

Its two named production callers are the two ends of one resolution: `resolveQuotas` (`src/server/repos/base.ts`) and
`createSubscriptionStore().findByOrganization` (`src/server/billing/store.ts`). A source test lists the importers and
fails on a third. SPEC §5 FU-3 is amended to allow that pair for this function by name (it is the single exception to
"one caller", and it exists because the guard and the loader are different layers that must give one answer).

The decision is **one pure function**, `applyCarry(limits, own, standing)` in `src/server/billing/limits.ts`, next to
`resolveLimits`: given the workspace's resolved limits, its own row's entitlement and the standing, it returns the same
limits with `trips` unlimited (`limits.trips = null`, `metrics.trips = UNLIMITED`) and a `carry` field, and touches
nothing else. Both callers feed it the standing; neither re-derives the rule. `planId`, `tier`, `limits.seats`,
`limits.storageBytes`, the module switches and `rates` are Free's, byte for byte (a test compares a carried workspace's
`rates` and modules to Free's).

The resolver never follows the sponsor's own link: it reads the sponsor's `subscriptions` row and nothing else about it.
A sponsor that has a link of its own and no subscription of its own is not entitling.

`carry` is a closed value, the only thing the screen learns about the link: `none` (no row), `carried` (holds),
`lapsed` (a row, and the rule above no longer holds). It carries no sponsor id, name, plan, status or period.

### The write: inside the creation batch, conditional

`createOrganizationFor` gains one statement in its existing `db.batch`, after the organization and before the member:
`recordCarry` (below) from the new write-only module
`src/server/auth/carry.ts`, sibling of `participation.ts` (SPEC §5 is amended to name it; a source test pins its
writers and that it has no select, update or delete of its own). It is an `INSERT … SELECT … WHERE` that inserts a row
only if, at the moment of the batch, `userId` is an owner of the sponsor (composite-role-aware, `',' || role || ','
LIKE '%,owner,%'`) and the sponsor has a `subscriptions` row in an entitling status. If either stopped being true between the gate and the batch, no row is
written and the new workspace is created exactly as today: Free. The read-time rule re-checks everything anyway, so the
statement is defence in depth, not the only guard.

The sponsor is decided **inside the statement**, so its id never travels through TypeScript or a request:
`recordCarry(db, { organizationId, sourceOrganizationId, userId })` takes the workspace the caller is in
(`scope.ctx.organizationId`, never a payload field) and inserts a row whose sponsor is the source when the source has
its own entitling `subscriptions` row and `userId` is an owner of it, and otherwise the sponsor of the source's own carry
where `created_by = userId`, `userId` still owns that sponsor and the sponsor has an entitling row. If neither holds, no
row is written. The gate (`createWorkspace`, TypeScript) decides only whether to allow the create:

| The active workspace (where the caller is) | The caller                   | Gate               | Sponsor recorded for the new workspace |
| ------------------------------------------ | ---------------------------- | ------------------ | -------------------------------------- |
| Own entitling paid subscription            | `owner`                      | allowed            | the active workspace                   |
| Own entitling paid subscription            | `admin` (not owner)          | allowed (as today) | none: the new workspace is Free        |
| Carried, carry holds                       | the carry's recorded creator | allowed            | the active workspace's sponsor         |
| Carried, carry holds                       | any other person             | `upgrade-required` | n/a                                    |
| Carried, carry lapsed; Free, no row        | anyone                       | `upgrade-required` | n/a                                    |

The "sponsor recorded" column is what the statement's `WHERE` yields, not a value the gate passes in. So the link **always points at the workspace that holds the subscription** and its depth is one by construction: a
workspace created from a carried workspace is carried by the same sponsor, never by the carried workspace, and chaining
(#989) is impossible because no row can name a carried workspace as a sponsor (a test inserts one and asserts the
resolver ignores it).

`createWorkspace` keeps its order (role, impersonation, the 20-workspace limit, plan) and its refusals. The plan step
asks `resolveQuotas` for a third answer: `planId === 'free'` **and** no valid carry for this caller is
`upgrade-required`. The 20-workspace limit, the `admin` role floor, the impersonation refusal and the withdrawal on
overshoot keep their behaviour; their existing tests pass unchanged.

### Cache and lag

`CachedPlanState` gains the resolved `carry`, so the cache version in `entitlements.ts` (`PLAN_STATE_CACHE_VERSION`,
`v5`) is bumped. **The lag is stated, not removed:** after a cancel, an unpaid status, a demotion, a departure or a
sponsor deletion, the billing screen and `transitCeiling` keep showing the carry for at most **60 s**
(`PLAN_STATE_CACHE_TTL_SECONDS`). The repository guard reads D1 on every call, so **new trips are refused on the next
call**: what lags is the screen, never the enforcement. The billing webhook's eviction (`invalidateEntitlements`) does
not reach carried workspaces, because evicting them would need "the workspaces this sponsor carries", a listing this
design refuses to have; and a role change or a departure never passes through the webhook at all. This is the same
"one stale minute" every plan change already has (`checkout.ts`, `evictPlanState`).

### What changes on lapse, and what does not

Back to Free on the next uncached read, in every case: the sponsor's status stops entitling (`canceled`, `unpaid`,
`paused`, `incomplete…`, the same set as step 0 of the resolver), the recorded creator is demoted or leaves the sponsor
or the carried workspace, the account is erased, or the sponsor is deleted (the row cascades). **Cancel at period end
keeps the carry until the period ends** (the sponsor's status stays entitling); a **scheduled downgrade** carries over
when it takes effect (the sponsor's row then resolves to whatever it resolves to). Nothing is deleted or locked: trips over
the Free cap stay readable and exportable, and only new creates are refused (`assertQuota` already behaves so).

### The create-workspace dialog and the billing screen

The dialog copy stops saying the plan does not carry over; for a caller whose create will be carried it says the new
workspace gets unlimited trips from the paid plan they hold, and nothing else (Copy). The billing screen of a carried
workspace shows a quiet line that its trips are carried by a paid plan of another workspace of the person who created
it; a lapsed carry shows that the plan which carried it has ended. **Neither shows the sponsor's name, plan, status,
period or `past_due` state.** A member of the carried workspace who is not in the sponsor reads a flag, and nothing of the
sponsor.

### Alternatives considered

- **Carry the whole plan (identity, modules, metered ceilings).** The product owner's reading of the issue. Cut: it multiplies
  per-call provider cost by up to 19 workspaces per owner, a pricing term for a person (#1012).
- **A column on `organization`, or a key in its metadata.** Rejected above (ADR 0044; editable by an admin).
- **Infer the sponsor at read time from "the workspace's oldest owner's paid workspace".** Rejected: a workspace can have
  several owners and roles change, so a promotion would put a workspace on someone else's bill.
- **Evict carried workspaces' caches from the webhook.** Rejected: needs the listing this design refuses, and misses role
  changes.
- **Allow creating a Free workspace from a carried one (no link).** Rejected: it quietly breaks "Free keeps the one
  workspace it was provisioned with" (`docs/ACCESS.md` §2.7).

## 📝 Cost and pricing consequences (for the person merging this spec)

- Unlimited trips cost rows, which cost little. **Seats and storage stay Free's in every carried workspace** (1 seat,
  100 MB), so the marginal storage cost of a carry is bounded by 100 MB per workspace.
- **Free's metered allowances are not zero**, so each carried workspace has its own: `geocode_lookups_per_month` 200 and
  `weather_lookups_per_month` 300 (the two desk metrics are 0 on Free). One owner can carry up to
  `WORKSPACE_LIMIT - 1 = 19` workspaces and **each owner of the sponsor can do the same**, so one subscription fans out to
  `owners x 19` Free allowances. The geocoding provider is billed per call. This is accepted by this spec because it is
  what Free already means per workspace; a person who wants a cap on it needs an issue of its own.
- **Giving a carried workspace the sponsor's plan identity, metered-call ceilings or a pooled seats-and-storage would
  multiply the sponsor's ceilings by up to 20 workspaces** (Crew: 8 000 geocode and 12 000 weather lookups a month each).
  Those are the follow-ups **#1012** (plan identity and ceilings) and **#1013** (pooled seats and storage), each blocked
  by this spec's implementation, and out of scope here.
- The pure function is the single place the carry is decided, so #1012 and #1013 extend `applyCarry`; they do not add a
  second path.

## 📝 Architecture

- `src/server/db/schema.ts`: the `workspaceCarries` table. Owner: `src/server/repos/workspace-carries.ts` (read-side
  helpers for tests and the seed) - one concept, one owner (SPEC §8).
- `src/server/repos/billing.ts`: `findSponsorStandingUnscoped` (two named callers, FU-3 amended).
- `src/server/billing/limits.ts`: `applyCarry`, `Carry`; the only place the rule is written.
- `src/server/repos/base.ts` (`resolveQuotas`), `src/server/billing/store.ts` + `entitlements.ts` (`loadPlanState`,
  `CachedPlanState.carry`, cache version bump): the two callers.
- `src/server/auth/carry.ts` (`recordCarry`, write-only) and `src/server/auth/provisioning.ts` (the batch).
- `src/server/fns/workspace-writes.ts` (`createWorkspace`: the gate and the sponsor decision).
- `src/server/erasure/registry.ts`: `workspace_carries.created_by`, **remove**.
- UI: `src/components/layout/create-workspace-dialog.tsx` and the billing screen under `src/routes/_app/settings/`.

No server-function input gains a field. The billing `Entitlements` response gains an optional `carry`
(`BACKWARD_COMPATIBILITY.md`: additive; a tab loaded before the deploy ignores it).

## 📝 Edge cases and failure scenarios

| Case                                                                        | Behaviour                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| The carried workspace buys its own subscription                             | Its own entitling row wins; the link stays and is ignored (`applyCarry` returns `none` for a paid own row). |
| The creator is demoted to `admin`, leaves or is removed from the sponsor    | Free on the next uncached read; no re-link; the new owner of the sponsor gets nothing.                      |
| The creator is demoted, leaves or is removed from the **carried** workspace | Free: the sponsor's subscription does not pay for a workspace its payer can no longer see.                  |
| The sponsor is deleted, or the carried workspace is                         | The row cascades. Free (sponsor) / row gone (carried).                                                      |
| The sponsor's status becomes `past_due`                                     | Still entitling (same set as the resolver's step 0); the carry holds.                                       |
| The creator's account is erased                                             | The row is removed by the erasure registry; their memberships are already gone, so the carry had stopped.   |
| Two creates race past 19 carried workspaces                                 | `createOrganizationWithinLimit` withdraws the loser; the link cascades with the organization.               |
| Gate says yes, sponsor lapses before the batch                              | The conditional insert writes nothing; the workspace is created Free.                                       |
| An admin edits `organization.metadata` to name a sponsor                    | Nothing reads metadata for the carry; ignored.                                                              |
| A forged row naming a carried workspace as a sponsor                        | The resolver reads only the sponsor's own subscription row: no row, not entitling, nothing granted.         |
| Impersonated session                                                        | `createWorkspace` still refuses before it reads the plan (`docs/ACCESS.md` §6.4).                           |

## 📝 UI/UX

The create dialog (`create-workspace-dialog.tsx`) is the one place that changes shape: one paragraph, three states
(carried, not carried but allowed, refused). The billing screen gains one `text-caption text-ink-3` line for `carried`
and one for `lapsed`. No new route, no new component.

## 📝 Visual change expected

Two screens, both existing, light and dark, desktop and mobile:

- The create-workspace dialog (account menu): the description paragraph, and the refusal paragraph for a Free caller.
- `/settings/billing` for a carried workspace: one caption line under the plan header ("carried" and "lapsed" states).

Backend-only otherwise.

## 📝 Copy

The implementation lands every key in all 23 locales per the `i18n-messages` skill; the `en` text is the contract.
`workspace.createUpgrade` and `workspace.createDescription` are **revised** (they say the plan does not carry over).

| Key                           | `en` text                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace.createDescription` | A separate space for its own trips, places and people. It starts on the Free plan; if you own a paid workspace, trips are unlimited here too.                   |
| `workspace.createUpgrade`     | Only a workspace on a paid plan can create another. “{workspace}” is on the Free plan: upgrade it, or create from a workspace you own on a paid plan.           |
| `workspace.createCarried`     | This workspace will have unlimited trips, carried by your paid plan. Everything else about the plan stays with the workspace that holds it.                     |
| `billing.carried.note`        | Unlimited trips here are carried by a paid plan on another workspace of the person who created this one. Seats, storage and modules are the Free plan’s.        |
| `billing.carried.lapsed`      | The paid plan that carried this workspace’s trips has ended, so it is on the Free plan again. Nothing was deleted; you can read and export every trip.          |
| `trips.quota.carriedLapsed`   | The plan that carried this workspace has ended, so only {limit} trips fit. Your trips are still here. Upgrade this workspace, or ask the person who created it. |

## ✅ Acceptance criteria

The conditions of the security and tenancy verdict on the brief, as ticket criteria (each ticket below carries its own):

- [ ] The link lives in `workspace_carries` only, is written only by `recordCarry` inside the creation batch and cannot be
      changed by a tenant (no server function, `organization/update` and metadata are ignored).
- [ ] It is recorded only when the creator is an **owner** (not only `admin`) of the sponsor, and the sponsor has its own
      entitling subscription; one hop: a carried workspace never sponsors another.
- [ ] It is checked on every read: sponsor entitling **and** paid **and** the recorded creator still an owner of the sponsor
      **and** of the carried workspace. Each lapse and ownership change returns the workspace to Free on the next
      uncached read; the 60 s lag of the cached screen is stated, the guard is immediate.
- [ ] A carried workspace inherits nothing but unlimited trips: not modules, not `rates`, not seats, storage or overrides.
- [ ] `resolveQuotas` and `loadPlanState` get the carry from the same function; the billing screen and the guard show the same
      numbers for a carried workspace.
- [ ] Nothing but the billing webhook writes `subscriptions`; the `admin` floor, the impersonation refusal and the 20-workspace
      limit keep their behaviour and their existing tests pass unchanged.
- [ ] Going back to Free deletes and locks nothing.
- [ ] Workspaces created before the change have no row and stay Free.
- [ ] The tenant-isolation tests listed in the tickets pass.

## 📝 Risks and impact review

| Risk                                                                          | Severity | Mitigation                                                                                                                        |
| ----------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A cross-workspace read leaks sponsor content to a carried workspace's members | High     | Closed projection (billing columns and two booleans), keyed by the caller's own id, no listing, no ids returned; isolation tests. |
| A tenant forges a sponsor                                                     | High     | Server-only table, no writer but `recordCarry` in the creation batch, owner and entitlement checked in SQL and again at read.     |
| A promoted or transferred owner pays for someone else's workspaces            | High     | The carry is valid only while its recorded creator is an owner of both; never inferred from current roles.                        |
| The cached screen disagrees with the guard for up to 60 s                     | Low      | Stated; enforcement is immediate; same lag as every plan change.                                                                  |
| Free's metered allowance multiplies (19 per owner)                            | Medium   | Stated above for a person; unchanged per workspace from Free today.                                                               |
| Chaining                                                                      | High     | The link always names the subscription holder; the resolver reads the sponsor's own row only; a forged chain row is ignored.      |

### Out of scope

- Plan identity beyond unlimited trips (modules, metered-call ceilings): #1012.
- A shared seats and storage pool per sponsoring subscription: #1013.
- Trial eligibility and trial chaining, and deleting a created workspace: #989 (decided: trials stay per workspace).
- The copy and check order around the create gate: #988.
- Any change to what the billing webhook writes, or a second subscription per workspace.
- A backfill for workspaces created before the change.

## 📋 Phasing

Three tickets, in order. Each is one complete slice that passes the gate on its own; the first changes no behaviour a
user can see, because no row can be written until the second.

## 📋 Implementation plan

### Ticket 1 - The carry table, the read and the resolver

- Add `workspaceCarries` to `schema.ts`, run `pnpm db:generate`, stage `drizzle/`. `CREATE TABLE` plus the index only.
- Add `workspace_carries.created_by` to `src/server/erasure/registry.ts` as **remove** (the drift test enforces it).
- Add `findSponsorStandingUnscoped` with its header justification, its two named callers and a source test that fails on a
  third importer. Amend SPEC §5 FU-3 as this spec's PR already drafts (the ticket confirms the wording against the code).
- Add `applyCarry` and `Carry` to `limits.ts`; call it from `resolveQuotas` and from the store/loader path; add `carry` to
  `CachedPlanState` and `Entitlements` (optional); bump `PLAN_STATE_CACHE_VERSION` to `v6`; fix the stale docblock on
  `findSubscriptionByOrganizationUnscoped` that says only the webhook and checkout may call it.
- Tests first, at the resolver seam over the in-memory harness (`createHarness({ ddl: 'migrations' })` for the cascade
  cases): a carried workspace has unlimited trips and Free's `rates`, modules, seats and storage; every lapse (cancel,
  unpaid, paused, incomplete), demotion, departure and erasure of the creator in the sponsor **and** in the carried
  workspace, and a deleted sponsor, returns it to Free on the next `resolveQuotas`; cancel-at-period-end keeps it; a
  workspace that buys its own plan ignores the link; a link naming a carried workspace as sponsor grants nothing; a row
  written through the organization update path is not a row; a member of the carried workspace who is not in the sponsor
  reads nothing of the sponsor (the projection has no field that could); the guard and `entitlements()` agree.
- Behaviour change visible to a user: none (no writer yet). Workspaces created before stay Free; say so in the PR body.

### Ticket 2 - Creating a carried workspace

- Add `src/server/auth/carry.ts` (`recordCarry`, write-only, conditional `INSERT … SELECT … WHERE`) and the statement in
  `createOrganizationFor`'s batch; amend SPEC §5 to name the module and add a source test pinning its importers and that
  it has no read. Add the ADR 0046 reference to `docs/ACCESS.md` §2.7 and amend §2.7 to the gate table above.
- `createWorkspace` decides the sponsor server-side (table above) and refuses a caller who is not the carry's creator.
  `createWorkspaceInput` stays `z.strictObject({ name })`.
- Update `workspace.createDescription`, `workspace.createUpgrade` and add `workspace.createCarried` in all 23 locales;
  `workspace-switcher.test.tsx` and `workspace-access.test.ts` follow the new wording.
- Tests: an owner of a paid workspace creates one and it is carried by it; an `admin` of a paid workspace still creates a
  Free one; an owner of a carried workspace creates a second, carried by the same sponsor (depth one); a non-creator owner
  of the carried workspace is refused `upgrade-required`; the 20-workspace limit, the `admin` floor, the impersonation
  refusal and the overshoot withdrawal (the link cascades) keep their tests unchanged; a forged `sponsorOrganizationId`, `sourceOrganizationId` or
  `organizationId` on the payload is rejected by the strict schema; a sponsor that lapses between the gate and the batch
  yields a Free workspace with no row.

### Ticket 3 - The billing screen and the refusal

- `/settings/billing` renders `billing.carried.note` for `carried` and `billing.carried.lapsed` for `lapsed`, never the
  sponsor; the trip create refusal in a `lapsed` workspace uses `trips.quota.carriedLapsed`. All 23 locales.
- Tests: the screen and the guard show the same trip numbers; a member of the carried workspace who is not in the sponsor
  sees the flag and nothing of the sponsor in the DOM or the payload; light/dark and mobile visual check by the QA step.

## Verification

Per ticket: `pnpm typecheck && pnpm lint && pnpm test` (per vitest project), the gate in `.ai/agentic.config.json`,
`bash .ai/scripts/check-generated.sh`. Ticket 1 also runs the schema/migration suite and the erasure drift test.

## Human decides

Items for the person merging this spec. Each has the default this spec assumed; overturning one is a review comment.

1. **What a carried workspace resolves to when its sponsor workspace is deleted or its owner changes (overlaps #989,
   #1000).** The only decision this spec does not settle for good. **Default: back to Free in both cases, nothing
   re-linked.** The link cascades away with the sponsor; a transfer or demotion makes the recorded creator no longer an
   owner of the sponsor, so the carry stops, and the new owner of the sponsor gets nothing. A sold or transferred
   sponsor therefore leaves the new payer with nothing, which may be overturned later as a product choice (an "adopt"
   write path was rejected here because it would let a new owner attach other people's workspaces to their bill). The
   creator should be told, before they hand over ownership of the sponsor or leave it, that their carried workspaces fall
   to Free; that warning belongs to the ownership-change screens and is a follow-up, not part of these tickets.
2. **The fan-out of Free's metered allowance** (cost section): accepted as is.
3. **Not naming the sponsor's plan to the carried workspace** (premise 5): the brief asked for the plan name; this spec
   withholds it.

## Resolved assumptions

| #   | Question                                                      | Applied default                                                                                                            | Why                                                                                                                                         |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | May a paying owner create from a carried workspace?           | Yes; the new workspace is carried by the same sponsor (never by the carried workspace); only the carry's recorded creator. | Decided by security and tenancy sub-agent (confidence medium): refusing sends the owner back to pay, creating Free breaks ACCESS §2.7.      |
| 2   | Where is the link stored?                                     | A new `workspace_carries` table keyed by the carried workspace, `ON DELETE CASCADE` to both organizations.                 | Decided by security and tenancy sub-agent (confidence high): ADR 0044 makes a column's foreign key `NO ACTION`; metadata is admin-editable. |
| 3   | Cache lag                                                     | The cache holds the resolved carry; the lag (60 s on the screen and `transitCeiling`, none on the guard) is stated.        | Decided by security and tenancy sub-agent (confidence high): a webhook eviction needs a cross-tenant listing and misses role changes.       |
| 4   | Sponsor deleted or owner changed                              | Back to Free, nothing re-linked.                                                                                           | Decided by security and tenancy sub-agent (confidence medium): no new write path; reversible later by adding adoption.                      |
| 5   | The carry also needs the creator to own the carried workspace | Yes: owner of both, on every read.                                                                                         | Raised by the same sub-agent: otherwise the sponsor pays for a workspace its payer can no longer see.                                       |
| 6   | Does the carried workspace see the sponsor's plan?            | No: a flag (`none` / `carried` / `lapsed`) only.                                                                           | Same sub-agent: members of the carried workspace may not belong to the sponsor. This overrides the brief's "names the sponsor's plan".      |
| 7   | Two callers of one `…Unscoped` function                       | Allowed by name in SPEC §5 FU-3; a source test lists them.                                                                 | Same sub-agent: the guard and the loader are different layers and one-caller-per-function cannot hold without a third copy of the rule.     |
