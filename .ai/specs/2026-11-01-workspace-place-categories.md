# Manage workspace place categories

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1369 |
| **Spec PR**        | none  |
| **Implementation** | none  |

## TLDR

Owners and admins will manage the workspace's place categories from Settings. Members will read
and select them. Once-only defaults and a bounded, shared taxonomy quota must ship before the
editor. This is a design-only deliverable: its PR uses `Refs #1369`, a person merges it, and
`afk-to-tickets` produces implementation slices. No feature code ships with this document.

## Problem and evidence at HEAD

`src/server/repos/categories.ts` provides reads, usage counts and CRUD, but its product management
screen and server functions are absent. `ensureDefaultCategories` is called only by the development
seeder and repository tests; it fills missing default slugs each time, not once. Calling it on
ordinary reads would undo intentional deletion. `deleteCategory` currently allows `isSystem` rows
and returns `Promise<void>`. Renaming through `updateCategoryInput` cannot change a slug.
`places.category_id` and `collection_places.category_id` both use `ON DELETE SET NULL` in the initial
migration; ADR 0044's ADD COLUMN caveat does not apply to them.

The categories-only scope is create, rename, recolour, move up/down, usage counts and deletion.
Keep existing CategoryIcon values; no new icon picker is needed. Tags UI/picker, inline creation
from place forms, expense categories, collection labels, global/public categories, restore defaults
and realtime protocol changes are excluded. Shared quota enforcement necessarily reaches existing
tag writers; this does not introduce tag functionality.

Verified coordination sources: `docs/plans/02-places-and-maps.md` 02-S10, `00-foundations.md` quota
ownership, `repos/base.ts`, `repos/tags.ts`, `billing/limits.ts`, `db/types.ts`, `auth/provisioning.ts`,
`fns/workspace-writes.ts`, `repos/context.ts`, and BACKWARD_COMPATIBILITY.md. Existing waiting specs
for public discovery and editable saved routes do not own workspace taxonomy management.
Reference research uses only the supplied plan's functional account; this agent did not browse the
reference product, per `docs/agents/reference.md`. We retain explicit move controls and usage counts,
without importing instance-administrator semantics into a multi-tenant workspace.

## Resolved assumptions (autonomous defaults)

| #   | Question                          | Applied default                                                                                                          | Why                                                                                                                                                                    |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Who may manage categories?        | Organization owner/admin writes; member reads/selects.                                                                   | Triage product-owner verdict, high confidence; existing `assertCanAdminister` is the guard.                                                                            |
| 2   | Initialization or restoration?    | Once-only initialization for new and existing empty workspaces; preserve nonempty lists and later intentional emptiness. | Triage verdict, confirmed by independent security and tenancy specialist, high confidence.                                                                             |
| 3   | Durable state?                    | Separate tenant-owned initialization marker, generated additive migration.                                               | Independent security and tenancy/architecture specialist APPROVE, high confidence: avoids mutating the shared settings JSON or extending provisioning's SQL exception. |
| 4   | What quota and owner?             | Foundations/billing prerequisite owns combined `taxonomy`, 256 for every tier.                                           | Independent specialist APPROVE, high confidence: new reversible operational policy, not an existing paid-plan promise; eight defaults leave 248 additional entries.    |
| 5   | Can system categories be deleted? | Yes; `isSystem` means provenance only.                                                                                   | Independent specialist verified current repo behavior; forbidding deletion contradicts intentional-empty acceptance.                                                   |
| 6   | Split capability?                 | One categories spec with mandatory foundations prerequisite and implementation phases.                                   | Triage chose categories-only; quota and initialization are prerequisites for safely exposing creation, not optional sibling features.                                  |

Pre-claim security verdict: **APPROVE**, confidence high, ESCALATE no. Conditions are incorporated
below. Every later schema/billing/auth implementation slice is independently `risk-high`, requires
specialist approval before claiming and approval on its diff before merge. This docs-only PR changes
no runtime authority. No unresolved design question remains.

## Ownership and boundaries

| Concept                          | Single owner and affected surfaces                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared taxonomy ceiling          | Foundations/billing slice: `db/schema.ts` metric enum and generated migration, `db/types.ts` PLAN_QUOTAS, `billing/limits.ts`, `repos/base.ts` seam, `repos/taxonomy-quota.ts` guarded inserts, category/tag writers and all direct bulk writers/seeder callers, resolver and repository tests. |
| Initialization lifecycle         | Category repository and new tenant marker table in `db/schema.ts`; generated migration; authenticated workspace preparation and its callers/tests. No new SQL in auth provisioning.                                                                                                             |
| Category identity and operations | `repos/categories.ts`, `fns/taxonomy.ts` plus binding-free handler module for Node tests.                                                                                                                                                                                                       |
| Settings presentation            | `routes/_app/settings/places.tsx`, `routes/_app/-ui/taxonomy-editor.tsx`, `settings-nav.tsx`, all 23 locale catalogues.                                                                                                                                                                         |
| Presentation refresh             | Existing planner loader/category selector, CategoryFilterBar, MapLegend, marker/popover consumers; change their refresh integration only if required, not their category models.                                                                                                                |

All SQL remains in tenant-scoped repositories. Server functions derive TenantScope from the session;
no client organization ID becomes authority. Routes call functions, functions call handlers/repos,
and never another server function. `components/ui` stays presentational. No dependency changes.
Add the glossary term in CONTEXT.md in this design change; no separate vocabulary for tags is needed.

## Foundations prerequisite: quota

The authoritative default is **256 live categories plus tags per workspace**, for free, starter,
pro and business in PLAN_QUOTAS. It is an operational safeguard, not a sold catalogue entitlement;
keep it out of catalogue quotas/pricing. Add `taxonomy` to USAGE_METRICS and the existing quota seam,
so `resolveLimits` / `resolveQuotas` remain the sole resolver. Preserve subscription status handling,
carry behavior and existing valid `quota_overrides`; no client control or new paid allowance.
A finite override resolves normally; the existing UNLIMITED sentinel is handled explicitly, never
as an arithmetic negative ceiling. The UI displays the resolved limit, not a hardcoded 256.

Schema work expands the usage metric CHECK without narrowing old writes or deleting usage history.
Only generated additive migration output is acceptable. Inspect any generated table rebuild for
preserved rows, indexes, FKs and old-Worker compatibility; if the generator cannot produce a safe
expansion, redesign before enabling the feature, never hand-edit migration SQL. Do not write taxonomy
usage_records merely to maintain a separate counter: live rows are the count authority.

`assertQuota(scope, 'taxonomy', current, additional)` gives the standard refusal, but its separate
read is insufficient for concurrency. Every actual growing write must enforce the same resolved
ceiling inside its INSERT statement with tenant-scoped counts of categories and tags. Use guarded
`INSERT ... SELECT ... WHERE count + additional <= limit`; distinguish slug conflicts from quota
refusal. An error or zero inserted rows never reports success. Existing rows above their resolved
ceiling are preserved: read, edit, reorder and delete still work; additional creation is refused.

Cover `createCategory`, `createTag`, `resolveTags`, default initialization and all direct inserts
found by caller search. `resolveTags` retains its existing maximum of 50 supplied names, deduplicates
normalized slugs, counts only missing rows, and inserts the entire missing set or none. Pass that
bounded input as one validated JSON parameter and expand with SQLite JSON table functions, rather
than binding five columns for each of 50 rows. Resolve current existing slugs within the guarded
statement; concurrent equivalent requests reuse existing rows, not consume extra allowance. A failed
statement rolls back the whole missing set. Test its SQL on the migrations-built local D1 adapter.
No KV locks, Worker-local counters or separate counter increments.

## Once-only initialization

Add tenant table `category_initializations`: ordinary id, unique organization_id with organization
cascade deletion, and initialized_at. It has no user-editable payload. Every access uses TenantScope
and the repository base; no unscoped discovery/backfill query is needed.

A repository initializer performs one transactional D1 batch:

1. If no marker and no categories exist for this tenant, insert the complete eight-row starter set
   already defined in categories.ts, preserving its slugs/icons/colours/order/isSystem values.
   One INSERT SELECT over the eight candidate rows gates the whole set; do not check emptiness once
   per row after an earlier row has been inserted.
2. Insert the tenant marker if absent. A preexisting nonempty taxonomy gets only the marker.
3. Commit both or neither. A second batch sees the marker and changes nothing. Retry after an
   aborted batch starts from unchanged state; retry after a lost response sees completed state.

Initialization precedes every normal category/tag creation, so a racing create cannot steal a
starter slot. Existing empty-category workspaces whose tags already fill the ceiling get one bounded
bootstrap exception of exactly eight starter rows. Those rows count normally thereafter; further
creation is refused until usage permits it. Existing nonempty taxonomies are never filled out,
renamed or pruned, even above the ceiling. The marker remains after the last category is deleted.

Invoke this preparation after a verified TenantScope is available and before planner/settings
category data is served, including the first activation of a newly created workspace. Use the category repository initializer itself as the shared preparation operation; do not assume
an existing workspace-preparation service. Await it in the authenticated handlers in
`src/routes/_app/-server/trip.ts` and `src/routes/_app/trips/$tripId/-server/plan.ts` before their
category reads, and in the new taxonomy handler before its read or write. The normal category/tag
writer paths await that same operation. Newly activated workspaces are prepared at their first
category consumer, not by changing identity provisioning. Test these callers, including reopening
a new workspace. `src/server/places/download.ts` remains a pure export of saved data and does not
initialize a taxonomy merely to download it. This lazy backfill needs no cross-tenant job. The read helpers
`listCategories` and `listCategoriesWithUsage` remain pure. The preparation may run for a member
because it can only perform the fixed once-only bootstrap, never arbitrary category mutation.
Do not add tenant SQL to `auth/provisioning.ts` or assume a Better Auth hook runs for every path.
If preparation fails, category consumers show unavailable/retry, not a misleading empty list.

[D1 batch documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
was fetched on 2026-11-01: batches run transactionally and a statement failure rolls back the sequence.
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/) specify 100 bound parameters per
query, including each statement within a batch. Keep the eight-row seed under 100 bindings; the
50-name tag path uses the single JSON binding above. Tests assert generated statement bindings and
run failure injection at the marker write. No interactive BEGIN/COMMIT assumption.

## API and data semantics

`loadTaxonomy` GET validates an empty Zod object and returns category rows with placeCount and a
meter `{used, limit}`; no tag list is exposed. Reuse listCategoriesWithUsage: placeCount means trip
places in this workspace, not saved collection places. All authenticated organization members read.
Each POST handler calls `assertCanAdminister(scope.ctx, action)` at execution time. Trip owner/editor
and platform roles grant no extra organization write permission. Check impersonation using existing
workspace mutation policy; do not invent a bypass.

New functions: `createCategoryFn`, `updateCategoryFn`, `moveCategoryFn`, `deleteCategoryFn`.
Use Zod strict objects with existing name, colour and ID bounds; icon values, if accepted, are the
existing CategoryIcon allowlist. A create derives a slug once using existing collision handling;
unique `(organization_id, slug)` is final authority and conflict retries are bounded. Rename never
accepts a slug field. Updating another tenant's ID yields NotFoundError; same slug in another tenant
is allowed. Omitted optional values keep existing defaults. Existing function input/return shapes
remain compatible; any fields added to existing inputs are optional.

Move takes a category ID and direction `up|down`, never an unbounded client ordering list. Read the
current neighbor, then perform normalization and movement in **one** tenant-filtered UPDATE using
materialized CTEs: capture the current deterministic order `(sortOrder, name, id)` with row_number,
check that the two observed IDs/sort orders are still adjacent in the requested direction, compute
the final dense ranks with those two ranks exchanged, then update from that immutable result. If
the pair predicate fails, update no rows and return stale-state refusal. There is no preliminary
normalization write and no two-statement swap that can half-succeed. This also normalizes ties
without a race between normalization and movement. Assert the affected row count matches the
captured tenant list; any database error rolls back the single statement. Keep bindings constant
(the tenant and observed pair), not one per category. Test this exact strategy on local D1 before
shipping it. Refreshed lists use the same deterministic ordering. No giant bound CASE list.

Keep existing `deleteCategory(...): Promise<void>` for existing callers. Confirmation shows the
latest placeCount and says it can change while others edit. The deletion applies to the category's
current references, leaving all trip and collection places intact with null categoryId. It is
irreversible; cancelling changes nothing. No exact-count snapshot promise or silent delete retry.

## UI/UX

`/settings/places` adds one settings navigation entry and one categories section. Each row shows
name, CategoryIcon, bordered colour swatch and numeric usage; owners/admins get rename, recolour,
move up/down and delete. Inline create uses name and colour with the existing default icon. Members
see the list and usage with a read-only explanation, no write controls. Use house Card, Field,
Input, Button/IconButton, Dialog, Alert, Skeleton and EmptyState components; no fetching in primitives.

Explicit labelled move buttons work without dragging; first/last moves are disabled and row names
are included in accessible labels. Swatch colour never carries the only identity. A row edit retains
its draft on failure and exposes field errors and a focusable retry. Row pending state leaves other
independent rows usable. Successful save invalidates the settings loader and keeps the confirmed
value until refreshed data arrives; a delayed response cannot overwrite a later edit or workspace.

Deletion confirms count and preservation of places, then returns focus to the next surviving row's
control or the section heading if the list is empty. Cancellation returns to the trigger. Pending
controls hand focus to a stable status target; retry is tested too. Announce changes and move result
with a polite live region. An unknown write outcome triggers a current-state reload before offering
retry; especially a lost create response must not invite duplicate creation. Failed reconciliation
keeps the draft and offers Reload, not another blind mutation. Role refusal reloads permission and
removes now-forbidden controls with an explanation and useful focus.

States: initial row skeleton; load failure with Retry; intentionally empty list with inline create
for permitted roles and read-only explanation for members; quota reached shows usage and keeps edit/
delete available; validation error; pending row; write refusal; unknown result/reconciliation failure;
delete-confirm. Empty after deleting the last starter is a valid lasting state.

On success refresh route data through existing invalidation. A newly opened/refreshed place selector,
map legend, CategoryFilterBar, pins and popovers consume current category data without a new socket
protocol. A different open tab updates on its next data refresh/reopen. A deleted selected filter is
cleared when refreshed category IDs no longer contain it; uncategorised places stay visible under
the existing filter rules. A stale place form saving a deleted category gets the existing validated
refusal and reloads options while preserving unrelated draft fields, never resurrecting the category.

## Visual change expected

Future implementation changes `/settings/places` and its navigation: resting, editing, confirmation,
read-only, skeleton, empty, quota and failure states at 360px and desktop in light/dark. Use existing
tokens, tabular counts, visible focus and wrapped controls without horizontal page overflow.
Publish `data-part="taxonomy-row"`, `taxonomy-edit`, `taxonomy-delete` for category rows/controls.
Browser evidence includes place selection and planner legend/filter/pins after refresh. Capture the
repository's blind A/B pairs for the UI implementation. This design-only diff changes no screen and
requires no fabricated screenshots or app behavior claim.

## Copy

Proposed English catalogue entries below are design text, not rendered literals. Reuse existing
common Save/Cancel/Retry/Reload and name/colour labels where semantics match. Implementation adds
every new key with matching placeholders/plurals to all 23 locales in the same change.

| Proposed en key                | Text                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| settings.placeCategories       | Place categories                                                                                                                  |
| taxonomy.categoriesDescription | Organize the places in this workspace.                                                                                            |
| taxonomy.addCategory           | Add category                                                                                                                      |
| taxonomy.readOnly              | Workspace owners and admins can manage categories.                                                                                |
| taxonomy.empty                 | No categories yet. Places can stay uncategorized.                                                                                 |
| taxonomy.placeCount            | ICU plural over `count`: one = {count} place; other = {count} places                                                              |
| taxonomy.moveUp                | Move {name} up                                                                                                                    |
| taxonomy.moveDown              | Move {name} down                                                                                                                  |
| taxonomy.moved                 | Moved {name}.                                                                                                                     |
| taxonomy.rename                | Rename {name}                                                                                                                     |
| taxonomy.recolour              | Change color for {name}                                                                                                           |
| taxonomy.delete                | Delete {name}                                                                                                                     |
| taxonomy.deleteTitle           | Delete category {name}?                                                                                                           |
| taxonomy.deleteImpact          | ICU plural over `count`: one = {count} place will become uncategorized.; other = {count} places will become uncategorized.        |
| taxonomy.deletePreserves       | Places will be kept. The affected count may change while others edit. Saved places using this category also become uncategorized. |
| taxonomy.loadFailed            | Categories could not be loaded. Try again.                                                                                        |
| taxonomy.saveFailed            | Changes could not be saved. Review them and try again.                                                                            |
| taxonomy.unknownOutcome        | Checking whether your change was saved.                                                                                           |
| taxonomy.reconcileFailed       | Could not confirm the saved state. Reload before trying again.                                                                    |
| taxonomy.stale                 | Categories changed while you were editing. Review the latest list.                                                                |
| taxonomy.permissionChanged     | Your workspace permission changed. You can still view categories.                                                                 |
| taxonomy.usage                 | {used} of {limit} category and tag slots used                                                                                     |
| taxonomy.limitReached          | Category and tag limit reached. Remove an unused entry before adding another.                                                     |
| taxonomy.saved                 | Category saved.                                                                                                                   |
| taxonomy.deleted               | Category deleted. Places were kept.                                                                                               |
| taxonomy.categoryRemoved       | This category was removed. Choose another category or leave the place uncategorized.                                              |

Starter names remain workspace data with stable slugs; their existing stored names are preserved,
not silently translated on rename/read. New UI never hardcodes default names as catalogue labels.

## Test strategy and failure cases

This spec adds no runtime logic to test-first. Implementation begins each slice with a failing test
through its public seam, observes failure, then implements. No test mirrors private SQL strings alone.

- Repository/local SQLite adapter: cross-tenant category/marker reads and writes invisible; forged
  ID and reorder neighbor refused; same slug across tenants succeeds; rename preserves slug; usage
  count scoped; collisions bounded; ordering survives reload and stale races do not half-swap.
- Migrations-built D1: preserve trip and collection places on deletion; defaults and custom category
  deletion both supported; all marker and metric migrations preserve old data and old Worker writes.
- Initialization: fresh empty, existing empty, existing nonempty and over-limit workspaces; repeated
  calls, concurrent initializers, seed-vs-create and marker-write failure rollback; delete one default
  and all defaults then refresh/retry never restores them; marker deleted only with its workspace.
- Quota: resolver tiers/status/overrides/carry; exactly-at-limit refusal; two creates racing for one
  slot, category-vs-tag race, resolveTags all-or-none and existing-slug reuse; bootstrap exception
  exactly eight once then no further growth above ceiling. Assert <=100 bindings per statement.
- Binding-free handlers: owner/admin success; member, trip-role-only and platform-role-only refusal;
  malformed fields, forged organization scope, stale IDs, Zod strictness and current session role.
- UI: deferred responses across edits/workspace changes; draft retention, refusal recovery, unknown
  outcome without duplicate retry, keyboard focus after cancel/delete/retry, all non-happy states.
- Browser: owner adds/renames/recolours/moves category, selects it for a place, refreshes planner and
  checks legend/filter/pin; member reads but direct write fails; delete warns and places remain
  uncategorised, including deleting the last default and reopening. Light/dark, mobile/desktop,
  accessible labels, keyboard-only move, parity across 23 locales.

## Compatibility, rollback and reconciliation with 02-S10

The plan's perpetually nonempty assumption is false: intentional emptiness is supported. Its
no-migration assumption is superseded here by the durable marker and metric CHECK expansion.
Its undeletable-system-category test is superseded by provenance-only isSystem. Its standalone
assertQuota is strengthened by an atomic insert predicate. Its category-delete return-count change
is unnecessary: retain void and use explicitly advisory counts. Tags UI remains the unsliced part
of 02-S10, not an implementation dependency beyond shared writer quota enforcement.

No existing protected API/route is removed. Deploy additive schema before code; old code tolerates
the new marker table and expanded metric values. Rolling back the editor/preparation leaves stored
categories and markers intact; never delete markers or starter rows during rollback. An old seeder
must not be run as a repair path because its refill semantics restore deleted defaults. Operational
ceilings can later be raised through the sole resolver; lowering never prunes existing data.

Docs grep terms: `taxonomy`, `categories`, `ensureDefaultCategories`, `PLAN_QUOTAS`, `02-S10`,
`isSystem`, `resolveTags`, `category_initializations`. The original plan remains a historical design;
these supersessions are explicit rather than silently changing another stage's scope. Implementation
updates every active statement it changes, including repo comments, tests and quota vocabulary.

## Implementation Plan

### Phase 1: Foundations prerequisite (risk-high)

1. Own the complete taxonomy metric contract: additive schema/metric expansion and generated
   migration, PLAN_QUOTAS/resolver/overrides, guarded insertion helper and all category/tag/bulk
   writer callers. Add failing resolver and concurrent repository tests first. No editor exposed.
   Prove migrations on local D1 and old-Worker compatibility; review security/tenancy on the diff.
2. Add marker schema and atomic initializer, replace old refill semantics and update seeder/tests;
   wire the named authenticated category-consumer preparation for new and existing workspaces without expanding auth
   provisioning SQL. Test rollback, retry, concurrent seed/create and intentional deletion. Depends
   on step 1. The application remains usable with defaults and no management screen.

### Phase 2: Category operations (risk-high tenancy/authorization)

3. Add binding-free category handlers and Zod server functions; reuse admin guard and repository
   CRUD, add atomic move behavior and preserve deletion contracts. Test isolation, direct role refusal,
   slug identity and migrations-built deletion before exposing controls. Depends on phase 1.

### Phase 3: Settings and consumer refresh (needs-qa)

4. Build category-only settings/editor/nav, locale catalogue and failure/focus states; generate route
   tree with `pnpm generate-routes` and stage it. Tests cover permission and unknown-outcome behavior.
   Depends on step 3; publish no tag controls or restore-defaults entry point.
5. Verify refreshed selector/legend/filter/pins and stale deleted-category recovery; add only needed
   integration changes, browser journeys and visual evidence. Run full configured validation gate,
   all three test projects and locale parity. Depends on step 4. Update implementation metadata and
   regenerate spec index as each phase ships; each ticket owns its whole concept and affected callers.
