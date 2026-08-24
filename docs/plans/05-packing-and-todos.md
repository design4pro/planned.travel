# Packing and todos

Everything a traveller has to carry, and everything they have to do before they leave. Five rows of
the 89-row matrix sit here — `LST-01` through `LST-05` — and this file carries all five.

The area is unusual in one respect that shapes every stage below: **the schema is already complete.**
Four tables, a 397-line repository and eleven server functions ship today, and a finished screen
renders them. Nothing in this file is a data-model project. What is missing is write paths, two small
records the four tables cannot express, and the surfaces that make the whole thing feel like a
product rather than a checklist.

## What is on disk today

Measured at HEAD, not assumed. Every claim names the file it was read from, because the part of a
plan most often wrong is the part that asserts how existing code behaves.

| Layer      | What exists                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema     | `packing_lists` (`src/server/db/schema.ts:877-902`), `packing_items` (`:905-937`), `packing_templates` (`:941-960`), `packing_template_items` (`:962-980`). `LIST_KINDS` is `packing · todo · shopping · documents` (`:205`) and `ITEM_PRIORITIES` is `low · normal · high` (`:206`); both are CHECK-constrained on their table. |
| Repository | `src/server/repos/lists.ts`, 397 lines. Four `createTenantRepository` handles (`:41-46`), four Zod inputs, four reads and eleven writes. Every query is `tenantFilter()`-built or goes through a repository handle; there is no raw `db.select()` anywhere in the module.                                                        |
| Server     | `src/server/fns/lists.ts`, 336 lines, eleven `createServerFn`s: list create/update/delete/reset (`:86,108,129,143`), item create/update/delete (`:158,184,205`), bulk done (`:223`), reorder (`:250`), template list and template apply (`:290,314`).                                                                            |
| Loader     | `loadTripLists` in `src/routes/_app/-server/trip.ts:462-503` — every list of the trip, each with its items and a progress roll-up, plus the trip's people.                                                                                                                                                                       |
| Route      | `/trips/$tripId/lists` — `src/routes/_app/trips/$tripId/lists.tsx`, 151 lines, with `ListsPending` as `pendingComponent` and `ErrorPanel` as `errorComponent`. Four `StatCard`s and a trip-wide `Progress` sit above the board.                                                                                                  |
| Screen     | `src/components/modules/lists/`: `lists-board.tsx` (1151), `list-dialogs.tsx` (709), `list-utils.ts` (207), `types.ts` (35), `index.ts` (31), and `__tests__/list-utils.test.ts`.                                                                                                                                                |
| Formatting | `src/lib/format.ts` owns `formatDate`, `formatNumber`, `formatWeight`, `formatPercent`, `pluralise` and the frozen CLDR month table. `src/routes/_app/-lib/format.ts` re-exports it and re-implements nothing.                                                                                                                   |
| Realtime   | Every list write already mirrors into the trip's Durable Object as `patch('trip', tripId, { listsChangedAt: Date.now() })` (`src/server/fns/lists.ts:100-102`). `packing-item` is already a declared entity kind (`src/server/do/protocol.ts:57`).                                                                               |

Two measurements that decide how the stages below are shaped:

- **The repository's template half is written and unreached.** `createTemplate` (`:310`),
  `deleteTemplate` (`:332`) and `createTemplateFromList` (`:379`) have no caller anywhere in `src/`
  outside `src/server/repos/__tests__/`. `grep -rn` over `src` for the three names returns
  `repositories.test.ts:63,64,331,340` and `tenant-isolation.test.ts:103,347` and nothing else. The
  work in `05-S2` is therefore three server functions and a surface, not a repository.
- **The lists module constructs no `Intl` formatter.** A `grep -rn` for `Intl.` over
  `src/components/modules/lists/` and the lists route returns nothing. That matters for the gate: the
  seven ad-hoc `month: 'short'` call sites `12-verification-protocol.md` §7.2 defers on all render
  under other trip tabs — costs, transports, collab, book, files — and none of them renders here. Baselining
  this tab does **not** inherit that blocker, and every stage below says so with the same grep.

So this area is not greenfield, and a stage that would write a second `progressOf`, a second grouping
helper or a second list-item writer is a defect rather than a plan.

## The five rows and the stages that close them

| Row      | Wave | Stage   | From → to                                                                     |
| -------- | ---- | ------- | ----------------------------------------------------------------------------- |
| `LST-01` | 3    | `05-S1` | partial → done                                                                |
| `LST-04` | 4    | `05-S2` | partial → done, with one upstream behaviour re-expressed and the reason given |
| `LST-03` | 4    | `05-S3` | partial → done                                                                |
| `LST-05` | 4    | `05-S4` | partial → done                                                                |
| `LST-02` | 5    | `05-S5` | partial → done, with the guest bringer deferred and its follow-up named       |

Waves are read straight off the table in `README.md` and no row is moved. The edge set is what puts
`LST-01` first: `LST-02`, `LST-03`, `LST-04` and `LST-05` each name it in `dependsOn`, so all four sit
behind it, and `LST-02` additionally names `TRP-11`, which is why it is alone in wave 5. `LST-01`'s own
`dependsOn` is `ACC-05`, whose write half is `00-S2` in `00-foundations.md`, wave 0.

Every stage states its wave in its `### Stage id` line in the form
`` `<id>` · Wave <n> · effort **S|M|L** ``, because `scripts/ultrabuild/check-plan-collisions.mjs`
parses exactly that and buckets every wave-less stage into one uncheckable pile.

## Conventions that bind every stage in this file

Stated once here; each stage restates the part it uses.

- **Weight is an `integer` count of grams.** `packing_items.weight_grams` and
  `packing_lists.weight_limit_grams` are both plain integers, both guarded by `nonNegativeCheck`
  (`schema.ts:934,901`), and `formatWeight` (`src/lib/format.ts:552`) is the only renderer. No stage
  stores a decimal kilogram, and no stage adds an imperial unit — the unit is a data decision, and
  changing it later would mean rewriting rows rather than a formatter.
- **Every number that can change carries `font-variant-numeric: tabular-nums`.** Item counts, packed
  counts, gram totals, percentage complete, badge counts on a filter, the weight-limit figure. There
  is no exception, and "it is inside a `StatCard` already" is not one: the stage checks the element
  that prints the digits.
- **SQL lives only in `src/server/repos/lists.ts`.** Every query in this area starts from
  `tenantFilter()` or a `createTenantRepository` handle, and every table carries `organization_id` as
  the leading column of its composite indexes. A well-formed trip, list or item id arriving from the
  browser is not an authorised one: it is re-resolved inside the caller's scope, and a foreign id is a
  `NotFoundError`.
- **Realtime fan-out reuses the `trip` entity kind.** Every stage that writes mirrors with
  `patch('trip', tripId, { listsChangedAt: Date.now() })`, exactly as `createListFn` already does
  (`src/server/fns/lists.ts:100-102`). **No stage in this file edits `src/server/do/protocol.ts`.**
  That is deliberate: adding an entity kind to a shared module is how `04-S2` and `07-S1` collided in
  an earlier round, and the changed-at stamp already causes every peer to invalidate and re-read.
- **No stage adds a route file.** The todo surface in `05-S4` is a validated search parameter on the
  route that already exists, so `pnpm generate-routes` is run by no stage here and
  `src/routeTree.gen.ts` appears in no **Owned paths** list. The alternative — a `/trips/$tripId/todos`
  route — would need an entry in `src/components/layout/trip-sub-nav.tsx`, which `01-S6` holds
  exclusively in wave 4, the same wave as `05-S4`.
- **None of the six shared paths is claimed by any stage in this file.**
  `src/server/db/schema.ts`, `src/server/worker.ts`, `wrangler.jsonc`, `src/styles/tokens.css`,
  `src/components/ui/**` and `src/routeTree.gen.ts` appear in no **Owned paths** list here. Two stages
  need a column or a table; each states the requirement under **Data and migration** for the schema
  stage of its own wave, mint id in `00-foundations.md`, and writes none of it itself.

## Why no stage in this file adds a quota metric

Three of the five stages create rows, so the question is answered once here and re-answered per stage
rather than waved away.

`USAGE_METRICS` (`src/server/db/schema.ts:137-146`) is `trips · places · members · files ·
storage_bytes · exports · collections · journeys`. None of them counts a list, an item, a category, a
bag or a template, and **adding one is not an additive migration**: the tuple is CHECK-constrained on
a shipped table at `schema.ts:323`, `enumCheck('usage_records_metric_chk', t.metric, USAGE_METRICS)`,
and `00-foundations.md`'s migration ritual records — with `drizzle/0001_aspiring_cargill.sql` as its
evidence — that drizzle-kit emits a full table rebuild when a CHECK on an existing SQLite table
changes. A rebuild is exactly what `ARCHITECTURE.md` §9 row 12 forbids, because `wrangler rollback`
has to keep working against the new schema.

So the answer for this area is not "no ceiling", it is **a ceiling in the repository rather than in
the catalogue**. Every stage that inserts states the bound it enforces, where it is enforced, and the
error it raises. The precedent already exists in this module: `createTemplateInput.items` is capped at
500 rows (`src/server/repos/lists.ts:109`), enforced in Zod, with no metric behind it. Packing rows
are small, are already bounded transitively by the `trips` metric — which _is_ sold and _is_ asserted
in `createTrip` — and a tenant that wants a million of them has to buy the trips first.

If the catalogue is ever to sell a list quota, that is one foundations stage: the metric in
`USAGE_METRICS` behind a table rebuild that has been argued, the ceiling in `resolveLimits()`, the
case in `src/server/billing/__tests__/limits.test.ts`, and an `assertQuota` call in the repository. No
stage here does a quarter of that and calls it enforcement.

## Three things this area does differently from the reference product, each with its reason

A plan that quietly diverges is worse than one that diverges loudly, so all three are stated before
any stage assumes them.

**1. A trip has many lists; the reference has one packing list with categories inside it.** Our
`packing_lists` table has existed since the first migration and already carries `kind`, `colour`,
`icon`, an optional owner and a weight limit, and the shipped screen renders several lists per trip
side by side. Categories in `05-S1` therefore become records **inside a list**, not inside a trip. The
consequence lands in `05-S2`: applying a template creates a new list rather than merging into "the"
list, which is the only reading that means anything in a many-list model, and it is additive in the
sense that matters — nothing existing is removed.

**2. Priorities stay a three-value enum, and the unprioritised state is `normal`.** The reference
sorts four integer priorities with the unset one last. `ITEM_PRIORITIES` here is
`low · normal · high` (`schema.ts:206`) and is CHECK-constrained at `schema.ts:935`, so adding a
fourth value is the same non-additive rebuild the quota section rejects. `05-S4` reproduces the
behaviour that matters — explicitly triaged rows first, untriaged last — by sorting `high`, then
`low`, then `normal`, and by drawing a badge for `high` and `low` only. `normal` is the default a row
is born with, so "has anyone triaged this" is exactly the question the sort answers.

**3. There is no instance-wide template library, because there is no instance.** `packing_templates`
carries `organization_id` and a unique `(organization_id, name)` index (`schema.ts:955`), so a
template belongs to a workspace. `05-S2` builds the workspace library and says so; a single-tenant
admin screen that publishes templates to every customer of a hosted product is not a feature, it is a
data leak.

## Clean-room

The upstream project is "the reference product". Its name, wordmark and logo appear nowhere in this
file, its pages are cited as `` `wiki: <Page-Name>` `` with no URL, and no sentence, table name,
column name, enum value, class name or UI string is reproduced from it. Behaviours are described in
planned.travel's vocabulary against the tables that already exist in `src/server/db/schema.ts`. Where
a stage needs new copy — the starter set in `05-S1` is the only place — the copy is authored fresh for
this product and the stage says so under the heading that ships it.

## The two shared files inside this plan, and the rule they follow

`12-verification-protocol.md` §4 fixes one visual spec file per plan file —
`e2e/packing-and-todos.visual.spec.ts` — and says stages within a plan share it, told apart by a
`test.describe` block named for the stage. `README.md` also says two stages in one wave may not name
the same file, and `05-S2`, `05-S3` and `05-S4` are all wave 4.

This plan resolves that the way `04-budget-and-currencies.md` does and
`00-foundations.md` already grants for the isolation suite: **the spec file and its baseline directory
are `new` in `05-S1` and `append` in every later stage.** A stage adds its own `describe` block at the
end and edits nobody else's, so two stages landing together produce a merge resolved by keeping both.
Frame names begin with the stage id, so two stages cannot write the same PNG. The same treatment
applies to `src/server/repos/__tests__/tenant-isolation.test.ts`. Both paths still appear under
**Owned paths** in every stage that touches them, marked `new` or `append`, because an auditor diffs
the actual change set against that list.

`e2e/helpers/shoot.ts` is claimed by **no** stage in this file. Nothing this area renders is a
clock-derived relative string: due dates print through `formatDate` as absolute dates, and the one
place a stage needs the server's calendar day — the overdue filter in `05-S4` — resolves it on the
server and returns a derived boolean rather than a `today` field, so `auditServerClock()` is not
being asked to audit a declaration that a later stage would have to flip.

## How Owned paths are written here, and why the form matters

Every stage's **Owned paths** is a bullet list of `` `path` — mode ``, never a table.
`scripts/ultrabuild/check-plan-collisions.mjs` parses exactly that shape; a plan that writes its
ownership as a table contributes zero paths to the collision check while still reading as though it
had been checked. The last section of this file records what the check said about these five stages.

## Stage 05-S1 — Categories stop being a string, and a new list stops being empty

### Stage id

`05-S1` · Wave 3 · effort **M**. The stage every other stage in this file waits on, and the only one
that changes the shape of a packing item's grouping.

### Reference rows

- `LST-01` partial → **done**.

Sourced from `wiki: Packing-Lists` for the category header's collapse and bulk-check affordances, the
rename and delete of a category, the quantity field on every row, the three-way item filter, the
completion bar and its completed state, and the starter content a new list opens with; and from
`wiki: Packing-Assignment` for the people chips on a category header and the notification that
assignment raises. Both are described in this product's vocabulary against the tables named below;
nothing is carried across.

**What is already done and is not re-done here.** `groupByCategory`, `progressOf`, `selectAllState`,
`matchesFilter` and `knownCategories` all exist in `src/components/modules/lists/list-utils.ts` and
are covered by `__tests__/list-utils.test.ts`; `setListItemsDoneFn` (`src/server/fns/lists.ts:223`)
already performs a bulk tick; `reorderListItemsFn` (`:250`) already reorders. This stage keeps every
one of them and moves the grouping key from a free-text column to a record.

**Why the free-text column is the whole problem.** `packing_items.category` is
`text('category')` (`src/server/db/schema.ts:917`) with no table behind it. A category therefore has
no identity, so it cannot be collapsed and remembered, cannot be renamed without rewriting every row
that spells it, cannot be deleted as a unit, and cannot have people assigned to it. Every missing
behaviour in `LST-01` is a consequence of that one fact.

**Rows unblocked:** `LST-02`, `LST-03`, `LST-04` and `LST-05`, all four of which name `LST-01` in
`dependsOn`.

**The dependency this stage does not own.** `LST-01`'s `dependsOn` is `ACC-05`
(`09-account-and-settings.md`, wave 2), and the write half of `ACC-05` is `00-S2` in
`00-foundations.md`, wave 0 — `dispatch(scope, event)` in `src/server/notifications/dispatch.ts`. This
stage raises a notification when a person is assigned to a category, and it does that by **calling
`dispatch`, never by calling `notify()` directly and never by writing its own recipient resolution**.
Both waves close before wave 3 opens. If `00-S2` has not landed when this stage is scheduled, the
stage is blocked rather than adapted: a second dispatcher is the defect `00-S2` exists to prevent.

### Owned paths

- `src/lib/lists/starter-set.ts` — new. The starter content a new packing list opens with, as data.
- `src/lib/lists/__tests__/starter-set.test.ts` — new.
- `src/server/repos/lists.ts` — edit. Category access, the starter insert, the assignment writer.
  Also held by `05-S3` in wave 4 and `05-S5` in wave 5; different waves, and each edit starts from the
  previous one.
- `src/server/repos/__tests__/lists-categories.test.ts` — new.
- `src/server/fns/lists.ts` — edit. The category write path. Also held by `05-S4` (wave 4) and `05-S5`
  (wave 5).
- `src/routes/_app/-server/trip.ts` — edit. `loadTripLists` returns categories as records. Held by
  `07-S2` (`07-collaboration-and-sharing.md`, wave 1) and `03-S2`
  (`03-reservations-and-transport.md`, wave 2) in earlier waves, and by `05-S5` (wave 5) after this
  one. Four stages across three plans extend this loader module in four different waves; every one of
  them adds fields to its own payload and none of them shares a wave with another.
- `src/routes/_app/-lib/notifications.ts` — edit. One catalogue entry for the new event key. Held by
  `09-S7` (`09-account-and-settings.md`, wave 2) one wave earlier; this stage adds an entry to what it
  leaves.
- `src/components/modules/lists/lists-board.tsx` — edit. Reduced to the panel grid and its states.
  Also held by `05-S3` in wave 4.
- `src/components/modules/lists/list-panel.tsx` — new. One list: header, toolbar slot, categories.
  Also held by `05-S3` in wave 4.
- `src/components/modules/lists/category-section.tsx` — new. Nobody else claims it.
- `src/components/modules/lists/item-row.tsx` — new. Also held by `05-S3` (wave 4) and `05-S5`
  (wave 5).
- `src/components/modules/lists/list-toolbar.tsx` — new. Also held by `05-S2` (wave 4) and `05-S5`
  (wave 5).
- `src/components/modules/lists/list-utils.ts` — edit. Also held by `05-S5` in wave 5.
- `src/components/modules/lists/types.ts` — edit. Also held by `05-S3` (wave 4) and `05-S5` (wave 5).
- `src/components/modules/lists/index.ts` — edit. Also held by `05-S4` in wave 4.
- `src/components/modules/lists/__tests__/list-utils.test.ts` — edit. Also held by `05-S5` in wave 5.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/packing-and-todos.visual.spec.ts` — new. This plan's one spec file.
- `e2e/__screenshots__/packing-and-todos.visual.spec.ts/` — new. Its baseline directory.

`src/routeTree.gen.ts` is not listed and is never hand-edited: this stage adds no route file, so
`pnpm generate-routes` is not one of its steps.

### Data and migration

**One additive table, one additive join table and one additive column, all filed as a requirement for
the wave-3 schema stage in `00-foundations.md`. This stage does not edit `src/server/db/schema.ts`.**

`packing_categories`, following the conventions every existing domain table follows:

| Column            | Type                        | Null     | Notes                                                       |
| ----------------- | --------------------------- | -------- | ----------------------------------------------------------- |
| `id`              | `text` PK                   | not null | `pk()`, `newId()` — time-sortable, doubles as a cursor      |
| `organization_id` | `text`                      | not null | `orgRef()`, `ON DELETE CASCADE`                             |
| `trip_id`         | `text` → `trips.id`         | not null | `ON DELETE CASCADE`, so a deleted trip takes its groups     |
| `list_id`         | `text` → `packing_lists.id` | not null | `ON DELETE CASCADE`; a category belongs to one list         |
| `name`            | `text`                      | not null | Bounded at 60 characters by the repository's Zod input      |
| `colour`          | `text(9)`                   | nullable | `colour()`, the same helper `packing_lists.colour` uses     |
| `is_collapsed`    | `integer` boolean           | not null | Default `false`. Collapse is shared, not per-reader — below |
| `sort_order`      | `real`                      | not null | `sortOrder()`, so fractional reordering works as elsewhere  |
| `created_at`      | `integer` timestamp_ms      | not null | `timestamps()`                                              |
| `updated_at`      | `integer` timestamp_ms      | not null | `timestamps()`, `$onUpdateFn`                               |

Indexes: `packing_categories_org_trip_idx` on `(organization_id, trip_id)` and
`packing_categories_list_sort_idx` on `(list_id, sort_order)`, both leading with the column every
other composite index in this schema leads with. A unique index
`packing_categories_list_name_unq` on `(list_id, name)` is what makes "rename onto an existing name"
a decidable case rather than a silent duplicate. No CHECK constraint: there is no enum column.

`packing_category_members`, the assignment join:

| Column            | Type                             | Null     | Notes                                      |
| ----------------- | -------------------------------- | -------- | ------------------------------------------ |
| `id`              | `text` PK                        | not null | `pk()`                                     |
| `organization_id` | `text`                           | not null | `orgRef()`                                 |
| `category_id`     | `text` → `packing_categories.id` | not null | `ON DELETE CASCADE`                        |
| `user_id`         | `text`                           | not null | `userRef()` — no Drizzle FK, as everywhere |
| `created_at`      | `integer` timestamp_ms           | not null | `timestamps()`                             |

Indexes: `packing_category_members_org_idx` on `(organization_id, category_id)` and a unique
`packing_category_members_unq` on `(category_id, user_id)`, which makes double-assignment impossible
rather than merely unlikely.

`packing_items.category_id` — `text`, **nullable**, referencing `packing_categories.id` with
`ON DELETE SET NULL`, plus an index `packing_items_category_idx` on
`(organization_id, category_id)`.

**`packing_items.category` is not dropped, not renamed and not narrowed by this stage.** That is the
migration ritual's rule and it is also the backfill plan: the generated migration adds the column and
backfills nothing, and the repository's category writer creates one `packing_categories` row per
distinct non-null `category` string in a list the first time that list is read through the new path,
then sets `category_id` on the matching rows. Until then a row with `category_id = null` and a
non-null `category` renders in a read-only group named by the string — so a rollback to the previous
Worker keeps working, which is the entire point. Dropping `category` is a separate migration in a
later wave, after the rollback window, and is not this stage's to schedule.

Migration name is whatever `pnpm db:generate` mints as `0003_*.sql` in the wave-3 schema stage. It
backfills nothing at SQL level; the backfill is the lazy repository path described above, which is
tenant-scoped and therefore cannot be done in a migration anyway.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/lists.ts`, edit.** New exports, all built on `tenantFilter()` or a
new `createTenantRepository(packingCategories, 'list category')` handle:

- `listListCategories(scope, listId)` — ordered by `sort_order` then `id`.
- `listTripCategories(scope, tripId)` — the whole trip in one query, so the loader does not issue one
  per list. Returns each category with its assignee user ids, read from the join in a second query and
  stitched in memory, the same shape `listTripListsWithProgress` (`:145`) already uses for its counts.
- `createListCategory(scope, { listId, name, colour })` — `packingListsRepository.requireById` first,
  so a foreign `listId` is a `NotFoundError` before anything is inserted; then the name check; then
  insert with `sortOrder` one past the current maximum, the same `nextItemSortOrder` idea already at
  `:238-246`.
- `renameListCategory(scope, categoryId, name)` and `deleteListCategory(scope, categoryId)` —
  `requireUpdate` and `requireRemove`, so a foreign id raises rather than doing nothing. Deleting a
  category leaves its items in the list with `category_id = null`, which the schema's
  `ON DELETE SET NULL` guarantees; the items are not deleted with it, and the surface says so.
- `setCategoryCollapsed(scope, categoryId, isCollapsed)`.
- `reorderListCategories(scope, listId, orderedIds)` — one `batch` so a half-applied order is never
  observable, matching how `applyTemplateToTrip` (`:342`) already reasons about partial writes.
- `setCategoryAssignees(scope, categoryId, userIds)` — resolves the category in scope, resolves the
  trip's membership through `listTripMembers` (`src/server/repos/trips.ts:403`), rejects any id that
  is not a member of that trip, then replaces the join rows in one batch. It returns the ids that were
  **added**, because the caller needs to know who to notify and re-deriving that from a diff at the
  call site is how a notification gets sent twice.
- `seedStarterCategories(scope, listId)` — inserts the starter set for a list that has no categories
  and no items. It refuses a list that has either, so it can never be the reason a row disappears.
- `assignItemToCategory(scope, itemId, categoryId | null)`, and `category_id` added to the item
  inputs at `:78-88` alongside the existing `category`.

**The bound this stage enforces, in place of a quota metric.** `MAX_CATEGORIES_PER_LIST = 40` and
`MAX_ITEMS_PER_LIST = 500` are constants in the repository, asserted with a `count()` inside the
caller's scope before every insert, and a breach raises the module's existing validation error rather
than a bare SQL failure. 500 is not arbitrary: it is the ceiling `createTemplateInput.items` already
imposes on a template (`:109`), and a list you cannot save as a template is a worse outcome than a
list you cannot extend. See the plan-level section above for why no `assertQuota` call site exists.

**Server functions — `src/server/fns/lists.ts`, edit.** Six, all `POST`, all opening with
`appScope()` then `requireTrip(scope, data.tripId)`, which is the module's existing shape at `:88-89`:

| Function                  | Returns                            | What it does                                     |
| ------------------------- | ---------------------------------- | ------------------------------------------------ |
| `createListCategoryFn`    | `{ categoryId }`                   | Creates a category on a list                     |
| `renameListCategoryFn`    | `{ categoryId }`                   | Renames it                                       |
| `deleteListCategoryFn`    | `{ categoryId, orphanedItems }`    | Deletes it, reporting how many rows lost a group |
| `setCategoryCollapsedFn`  | `{ categoryId, isCollapsed }`      | Persists the collapse                            |
| `reorderListCategoriesFn` | `{ listId }`                       | Applies an explicit order                        |
| `setCategoryAssigneesFn`  | `{ categoryId, notified: number }` | Replaces assignees and dispatches                |

Each mirrors with `patch('trip', data.tripId, { listsChangedAt: Date.now() })` and nothing else, per
the plan-level convention. `deleteListCategoryFn` returns `orphanedItems` so the toast can say what
actually happened instead of "deleted".

**Zod v4, at the boundary.** `z.strictObject()` for every input, `error` for every message, ids as the
module's existing bounded `rowId` (`:31`), the category name as `z.string().trim().min(1).max(60)`,
the colour reusing the module's hex refinement at `:39-47`, `userIds` as
`z.array(rowId).max(50)`. Validation is shape. It decides nothing about permission.

**Authorisation, decided in the handler and again in the repository.** A server function is a public
endpoint reachable without the route that renders it, so every handler resolves the trip through
`requireTrip` before it touches a child row, and every repository call resolves its own parent through
a `requireById` in the caller's scope. `listTripMembers` returns `[]` rather than raising for a foreign
trip (`src/server/repos/trips.ts:403-411`), which is why `setCategoryAssignees` resolves the trip
first and treats an empty membership as "not your trip" rather than as "a trip with nobody on it".

**The notification, and where it is composed.** `setCategoryAssigneesFn` calls
`dispatch(scope, event)` from `src/server/notifications/dispatch.ts` (`00-S2`) once per write, with
the added user ids as recipients, the actor removed by `dispatch` itself, and the event carrying
`titleKey: 'list.category_assigned.title'`, `bodyKey: 'list.category_assigned.body'` and params
`{ actorName, categoryName, listName, tripTitle }`. The keys are stored, never the sentence — the
notifications table is key-plus-params by design (`src/server/repos/notifications.ts:40-48`) so a row
written a year ago still reads in the reader's language. The English rendering is the one catalogue
entry this stage adds to `src/routes/_app/-lib/notifications.ts`, beside the `list.assigned` entry
already at `:59-62`; `humaniseKey` (`:93`) means an unrendered key degrades to a readable heading
rather than to a blank row. The dispatch call is wrapped the way `mirrorToRoom` is wrapped in
`src/server/fns/context.ts:60-72`: a failure is logged and the assignment still succeeds. Nothing slow
runs inline — the email half is a `TASKS` envelope inside `dispatch`.

**Collapse is shared, not per-reader, and that is a decision rather than an oversight.** A per-reader
collapse would need a row per person per category and would make the state invisible to the person
who arranged the list. Two travellers looking at the same list see the same shape, and the stage says
so in the affordance's tooltip.

### UI (route, components)

**Route.** `/trips/$tripId/lists`, unchanged and still the default SSR. No new route file, so
`pnpm generate-routes` is not run. `src/routes/_app/trips/$tripId/lists.tsx` is **not** edited by this
stage: the four `StatCard`s and the trip-wide `Progress` above the board already read from the items,
and the payload's item shape does not change.

**Components.** `lists-board.tsx` today is 1151 lines holding the grid, the panel, the rows, the
assignee menu and the inline composer. This stage splits it along the seams it already has, because
three later stages need to edit three different parts of it and a single file cannot be owned by three
stages in one wave:

| Module                 | What it renders                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `lists-board.tsx`      | The panel grid, the board-level empty, skeleton and error states, and the new-list affordance    |
| `list-panel.tsx`       | One list: its header, its toolbar slot, its categories, its footer totals                        |
| `category-section.tsx` | One category: header with colour dot, name, counts, collapse toggle, people chips, overflow menu |
| `item-row.tsx`         | One item: checkbox, name, quantity, hover-revealed actions                                       |
| `list-toolbar.tsx`     | The per-list toolbar: the All/Open/Done filter and the slots `05-S2` and `05-S5` add controls to |

The split moves code; it does not rewrite behaviour. `SortableItems`, `SortableItemRow`,
`AssigneeMenu` and `InlineItemComposer` (`lists-board.tsx:751,842,1008,1073`) move into
`item-row.tsx` and `category-section.tsx` with their `@dnd-kit` wiring intact.

**Primitives reused, all from `src/components/ui` and none re-implemented:** `Card`, `Checkbox`,
`Chip` (the filter pills — it already has a `selected` variant, `chip.tsx:39-93`), `Badge` and
`CountBadge` for the per-category counts, `IconButton` for the collapse toggle and row actions,
`DropdownMenu` for the category overflow, `Combobox`/`MultiCombobox` for the people picker,
`AvatarStack` for the assigned chips, `Progress` for completion, `Input` and `Field` for inline
rename, `Tooltip`, `SectionLabel`, `Separator`, `ScrollArea`, `EmptyState`, `Skeleton`,
`SkeletonText`, `Alert`, `Button`, `Dialog` for destructive confirmation, `toast` for the undoable
outcome. No new primitive is needed, so no requirement is filed against `src/components/ui`.

**States, named rather than asserted.**

- **Board empty** (the trip has no lists): `EmptyState` on `--color-surface-2`, a `luggage` glyph from
  `lucide-react`, heading "Nothing to pack yet", body "Start a list, or open one of the templates
  already saved to this workspace.", and two actions — the primary `Button` opening the new-list
  dialog and a `ghost` `Button` opening the template dialog. The second action is present only when at
  least one template exists, which is the same condition `05-S2` uses.
- **List empty** (a list with no categories and no items): an inset panel on `--color-surface-2`
  offering "Add the starter set" as the primary action and "Add a category" as the secondary, with a
  one-line preview of what the starter set contains so the button is not a leap of faith.
- **Category empty** (a category whose items were all moved out): a single muted row reading "Nothing
  in this group yet" with the inline composer focused behind it, not a full empty-state block — a
  category is a row group, and a card-sized empty state inside a list reads as an error.
- **Filtered empty** (Open with everything packed, or Done with nothing packed): distinct copy from
  the two above — "Everything here is packed" with a `success`-toned check glyph for the first,
  "Nothing has been ticked yet" for the second. A filter that hides every row must never be
  indistinguishable from a list that has no rows.
- **Skeleton**: the panel grid's shape, not a spinner — a header bar, three category headers each with
  three item rows, using `Skeleton` and `SkeletonText` at the real row height so nothing moves when
  data arrives. `RowsSkeleton` from `src/routes/_app/trips/$tripId/-ui/scaffold` is already the route's
  `pendingComponent` and is kept; the board's own skeleton is what shows during a client-side
  invalidation.
- **Error**: `Alert` with `tone="danger"` inside the panel, naming what failed and offering "Try
  again" wired to the router's invalidate. The board-level failure keeps using `ErrorPanel`, which the
  route already installs (`lists.tsx:26-30`).
- **Optimistic write and rollback**: a tick, a rename, a collapse and a quantity change all apply
  immediately and roll back with a `toast` carrying the failure reason. The precedent is the plan
  screen's optimistic order with rollback in `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx`.

**Interaction states, on every control.** Hover, `focus-visible`, active, disabled and loading are
required on: the filter chips, the collapse toggle, the category overflow trigger and every item in
its menu, the people picker trigger and each option, the rename input's confirm and cancel, the row
checkbox, the quantity stepper, the delete affordance, the inline composer's submit, and the
starter-set button. A control that is mid-request is `disabled` and shows a `Spinner` in place of its
icon; it never merely stops responding.

**Rename is blocked while an item is ticked**, which is a real rule and not a decoration: a ticked row
is a record of what was packed, and editing its name after the fact silently rewrites that record. The
rename affordance renders `disabled` with a `Tooltip` explaining it, so the state is discoverable
rather than mysterious.

**Motion.** Category collapse animates height via a transform-and-opacity `motion` variant at
`--duration` (220ms) on `--ease-out-quint`; entering item rows stagger 24ms and the stagger caps at
eight rows; the filter chip's selected pill crossfades at `--duration-fast`. Nothing animates a
layout-affecting property, nothing is linear, nothing exceeds 400ms, and
`prefers-reduced-motion: reduce` collapses all three to an opacity change.

**Responsive.** At 360px a list is a full-width panel, the category header wraps its counts under its
name, the people chips become a single `AvatarStack` with an overflow count, and the item row drops
the hover actions in favour of a long-press `ContextMenu` — hover does not exist on touch and
`@media (hover: hover)` is where Tailwind v4 puts `hover:` anyway. At 1280px two panels sit side by
side. At 2560px the grid caps at three columns and the page keeps its measure instead of stretching a
row to 2400px, because a checklist row 2400px wide is unreadable.

**Tokens.** Every colour, space, radius, shadow, easing and z-index value comes from
`src/styles/tokens.css`. Category colours use the same `colour()` values the existing list colours use
and are rendered as a token-derived dot, never as a hard-coded hex in a component. Every figure that
can change carries `tabular-nums` — the per-category counts, the packed-of-total figure, the
percentage on the progress bar and the quantity on every row — so a tick does not shift the digits
beside it. **No token is missing**, so this stage files no requirement against
`src/styles/tokens.css`.

**Copy, authored here.** The starter set in `src/lib/lists/starter-set.ts` is our own writing: five
groups covering documents, clothing, toiletries, tech and health, each with a handful of rows and a
sensible quantity, in the register the rest of the product uses. The existing demo dataset already
groups its rows under names like `Documents` and `Clothing`
(`src/routes/api/dev/-seed/dataset/flagship.ts:2041,2189`), so the vocabulary is already this
product's. The module exports data and a type; it contains no JSX and no server import, which is what
lets `05-S1`'s empty state preview it on the client and the repository insert it on the server from
one source.

### Quota

**No countable row, and no `assertQuota` call site.** A packing category, a packing item and a join
row are none of `USAGE_METRICS` (`src/server/db/schema.ts:137-146`), and the plan-level section above
records with evidence why adding one is a non-additive table rebuild
(`enumCheck('usage_records_metric_chk', …)`, `schema.ts:323`).

What this stage does instead, stated so it is checkable: `MAX_CATEGORIES_PER_LIST = 40` and
`MAX_ITEMS_PER_LIST = 500` are enforced in `src/server/repos/lists.ts` with a scoped `count()` before
each insert, inside the repository and before the write, which is the same position `assertQuota`
occupies. `seedStarterCategories` counts its own insert against both bounds before it starts, so the
starter set can never be the write that breaches one.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block,
`'packing categories'`, following the file's existing shape — organization A acts in A's scope against
B's rows and every attempt is a `NotFoundError`, then B's data is re-read and found untouched. The
existing block at `:847` is the model.

Covered functions, one case each: `listListCategories` and `listTripCategories` return nothing for
B's list and B's trip; `createListCategory` with B's `listId`; `renameListCategory`,
`deleteListCategory` and `setCategoryCollapsed` with B's `categoryId`; `reorderListCategories` with
B's `listId`; `setCategoryAssignees` with B's `categoryId`, and with A's own category but a `userId`
who is only a member of B's trip — that one must reject the id rather than silently drop it, because a
silently dropped assignee is indistinguishable from a successful one on screen;
`assignItemToCategory` with A's item and B's `categoryId`, and with B's item and A's `categoryId`;
`seedStarterCategories` with B's `listId`. Afterwards `packingCategoriesRepository.count(beta.scope)`
is unchanged and B's category names are re-read and compared.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and by invariant.**

- `src/lib/lists/__tests__/starter-set.test.ts` — every group has at least one row; every row has a
  positive integer quantity; group names are unique; no row name is empty or longer than the
  repository's bound; the total row count is under `MAX_ITEMS_PER_LIST`.
- `src/server/repos/__tests__/lists-categories.test.ts` — a category created on a list appears in
  `listListCategories` in `sort_order` position; renaming onto an existing name in the same list is
  rejected and neither row changes; deleting a category sets `category_id` to null on its items and
  deletes no item; `setCategoryAssignees` is idempotent, returns only the added ids on a repeat call,
  and rejects a non-member; `seedStarterCategories` refuses a list that already has items; the two
  bounds raise at the ceiling and not one row before it.
- `src/components/modules/lists/__tests__/list-utils.test.ts` — extended: grouping keys off
  `categoryId` when it is present and off the legacy `category` string when it is not; a legacy group
  sorts after every record group and is marked read-only; `selectAllState` over a collapsed category
  still counts its items.

**Playwright.** `PLAYWRIGHT_BASE_URL` is always passed, because the config otherwise waits on port
3000 until the global timeout:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/packing-and-todos.visual.spec.ts
```

The spec declares its own route table for `/trips/$tripId/lists` with no `relativeTime` flag — the
screen prints no clock-derived relative string, and its due dates go through `formatDate` — and calls
`auditServerClock(page, <its own table>)` once in a `describe` of its own, which is the only check
that reads a declaration against the streamed payload. It attaches `watchConsole(page, route)` before
every navigation and asserts the report's `fatal` list is empty at the end of **every** test,
including the ones that only take a frame. It adds no entry to `TOLERATED_CONSOLE_WARNINGS`; the list
is the gate's own contract and is not widened to make one stage green. It imports `visit`, `settle`,
`shoot`, `applyTheme`, `useSession` and `watchConsole` from `./helpers/shoot.ts` and re-implements
none of them.

**The trip id is not a constant.** `$tripId` is `trips.id`, minted by `newId()` at seed time
(`src/routes/_app/-ui/trip-card.tsx:113` links with `params={{ tripId: trip.id }}`), so neither the
spec nor the capture may hard-code it. Both resolve it once by opening `/trips`, reading the href of
the card whose accessible name is the flagship trip's title, and appending `/lists`.

**Frames.** Light and dark at 360, 1280 and 2560 for the resting board, plus a declared-state set for
the two states that are this stage's point:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/lists" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/05-S1" \
  --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth
```

and again with `--state collapsed --click '[data-part="category-collapse"]'` and with
`--state assignees --click '[data-part="category-people"]'`. `PT_SERVER_TODAY` is not decoration: the
header is attached only when it is set (`scripts/ultrabuild/capture.mjs:168-178`), and `2026-08-20` is
`BASELINE_DAY` from `e2e/helpers/shoot.ts:1014`, the same value the gate sends. A stage that pins the
capture to one day and the gate to another has photographed two products.

The two selectors are `data-part` attributes this stage publishes on the collapse toggle and the
people trigger, chosen over class names because a class does not survive a restyle. **A plan cannot
verify a selector for a surface it has not built**; the executing stage verifies each with
`await page.locator(sel).count()` returning 1 against a running server _before_ it runs
`capture.mjs`, and records the count in its evidence. A selector that resolves to nothing makes
`capture.mjs` throw at `--click`, which costs a round.

The skeleton and error states are not reachable by clicking. The skeleton is photographed in the spec
behind a `page.route()` that delays the loader's response; the error state behind a `page.route()`
that fails it. Both are the stage's own frames and both are named in the evidence.

**Layout shift.** A `PerformanceObserver` for `layout-shift` is installed as an init script, entries
with `hadRecentInput` are excluded, `performance.now()` is read as the mark after `settle()`, and the
sum of entries after the mark must be `0` — measured to be genuinely achievable on this product. The
entry type is Chromium-only and `observe()` does not throw on WebKit, so the assertion is gated on
`PerformanceObserver.supportedEntryTypes` and the `mobile-safari` result is reported as a skip with
its reason, never as a pass.

**Console must be silent.** A warning in the console is this stage's bug.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, for every surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state — and the four distinct empty states named above are distinguishable from one
      another.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **`00-S2` must have landed.** The notification on category assignment goes through
  `dispatch(scope, event)` in `src/server/notifications/dispatch.ts`, which `00-foundations.md` mints
  as a wave-0 stage. Wave 0 closes before wave 3 opens, so this is a sequencing statement rather than
  a risk — but if the stage is scheduled early, it is blocked, not adapted. Writing a second recipient
  resolution here is the outcome `00-S2` exists to prevent.
- **The wave-3 schema stage must have landed**, carrying `packing_categories`,
  `packing_category_members` and `packing_items.category_id`. `00-foundations.md` mints one schema
  stage per wave and this stage files its requirement there rather than editing the module.
- **No package is missing.** Everything named here — `@dnd-kit`, `motion`, `radix-ui`, `lucide-react`,
  `sonner`, `zod` — is in the pinned set of `docs/SPEC.md` §3. No stage in this file installs a
  package, and neither `package.json` nor `pnpm-lock.yaml` is edited by anything here.
- **`12-verification-protocol.md` §7.2 does not apply to this stage**, and the measurement is
  recorded rather than assumed: a `grep -rn` for `Intl.` over `src/components/modules/lists/` and the
  lists route returns nothing, so no abbreviated-month string renders on this tab. The stage adds none either — dates go through `formatDate` in `src/lib/format.ts`, which
  answers from the frozen CLDR table.
- **§7.3 still applies**, as it applies to every stage: nothing in the repository pins the browser
  revisions, so these baselines are a single-machine regression net rather than cross-machine truth. A
  `mobile-safari` difference this stage cannot attribute is reported here and the comparison budget is
  not widened — §5 forbids that shortcut absolutely.

## Stage 05-S2 — A list you can keep, and a workspace library to keep it in

### Stage id

`05-S2` · Wave 4 · effort **S**. The smallest stage in this file, because two thirds of it is already
written and unreached.

### Reference rows

- `LST-04` partial → **done**, with the apply semantics re-expressed for a many-list model and the
  reason given below.

Sourced from `wiki: Packing-Templates` for the shape of the library — a template names itself and
shows how much it will add, applying is additive and never removes anything, saving reuses the list
in front of you, and both affordances appear only when they can do something.

**What is already done.** `applyTemplateToTrip` (`src/server/repos/lists.ts:342`) copies a template's
rows into a trip inside one scope, re-reading rather than trusting `RETURNING`; `loadListTemplatesFn`
(`src/server/fns/lists.ts:290`) already returns each template with its item count and a four-name
sample, which is exactly the "a name alone is not enough to choose between two packing lists"
problem; and `list-dialogs.tsx` consumes both. This stage does not touch any of it.

**What is unreached, and is therefore the stage.** `createTemplate` (`:310`), `deleteTemplate`
(`:332`) and `createTemplateFromList` (`:379`) have no caller in `src/` outside `__tests__`. Measured:
`grep -rn` over `src` for the three names returns `repositories.test.ts:63,64,331,340` and
`tenant-isolation.test.ts:103,347`, and nothing else.

**One defect this stage has to fix rather than inherit.** `packing_templates` carries a unique index
on `(organization_id, name)` (`src/server/db/schema.ts:955`), and `createTemplateFromList` defaults
the template's name to the list's name (`:381-386`). Saving the same list twice therefore raises a
SQLite `UNIQUE` violation, which reaches the browser as a 500 rather than as "you already have a
template called that". The stage resolves the name before it inserts, using the bounded attempt loop
`reserveTripSlug` already establishes in this codebase (`src/server/repos/trips.ts:162-179`), and the
surface offers to overwrite instead when the collision is the user's own template.

**Deliberate divergence, stated loudly.** Upstream, applying a template merges its groups into the
one packing list a trip has, by group name. Here a trip has many lists — `packing_lists` has shipped
since the first migration and the screen renders several side by side — so a template lands as **its
own list**, which is what `applyTemplateToTrip` already does. Applying is additive in the sense that
matters: nothing that exists is removed, and group names carry across so a template's rows land under
the names the template chose (`:361-372`). Merging into a _selected_ list is a different behaviour,
would need a new repository function, and is not planned here; if it is ever wanted it is a stage of
its own and not a footnote on this one.

**Rows unblocked:** none. `LST-04` is a leaf in the edge set.

### Owned paths

- `src/server/fns/list-templates.ts` — new. This stage's three server functions.
- `src/server/fns/__tests__/list-templates.test.ts` — new.
- `src/components/modules/lists/list-dialogs.tsx` — edit. `TemplateDialog` gains the library.
- `src/components/modules/lists/list-toolbar.tsx` — edit. The two template affordances. Created by
  `05-S1` in wave 3 and also held by `05-S5` in wave 5.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/packing-and-todos.visual.spec.ts` — append. Created by `05-S1` in wave 3.
- `e2e/__screenshots__/packing-and-todos.visual.spec.ts/` — append.

**Why the new server functions are not added to `src/server/fns/lists.ts`.** `05-S4` holds that module
exclusively in this wave, and two stages editing one module in parallel clobber each other — the exact
failure `scripts/ultrabuild/check-plan-collisions.mjs` exists to catch. The two template functions
that already ship stay where they are; this stage adds three new ones in a module of its own and
imports the same repository. Nothing is duplicated: `src/server/fns/list-templates.ts` contains no
copy of `loadListTemplatesFn` or `applyListTemplateFn`.

This stage adds no route file, so `pnpm generate-routes` is not one of its steps, and
`src/routeTree.gen.ts` is not listed.

### Data and migration

**None.** All four tables exist, and the three-level structure the reference describes —
template, groups, rows — is expressed by this schema as template plus rows carrying a group name
(`packing_template_items.category`, `src/server/db/schema.ts:970`), which is the same information in
two tables instead of three and is what the shipped `applyTemplateToTrip` already reads. No column, no
index, no CHECK, no migration, nothing filed against `00-foundations.md`.

`packing_templates.is_shared` (`:948`) already exists and already defaults to `true`. This stage gives
it a meaning it has never had: `true` is a workspace template every member may apply, `false` is one
only its creator sees. Both are read through the tenant scope, so neither is visible outside the
workspace under any value.

### Server (repo, server function, Zod)

**Repository.** No new SQL and no edit to `src/server/repos/lists.ts` — this stage does not hold that
module in this wave and does not need it. It composes `createTemplate`, `createTemplateFromList`,
`deleteTemplate`, `listTemplates` (`:296`) and `listTemplateItems` (`:300`), all of which are already
tenant-scoped through `packingTemplatesRepository` and `packingTemplateItemsRepository` (`:43-46`).

**Server functions — `src/server/fns/list-templates.ts`, new**, each opening with `appScope()`:

| Function               | Method | Returns                           | Authorisation                                                                                 |
| ---------------------- | ------ | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `saveListAsTemplateFn` | POST   | `{ templateId, name, itemCount }` | `requireTrip` on the trip, then `createTemplateFromList` resolves the list in the same scope  |
| `deleteListTemplateFn` | POST   | `{ templateId }`                  | `deleteTemplate` → `requireRemove`, so a foreign id is a `NotFoundError` before anything runs |
| `renameListTemplateFn` | POST   | `{ templateId, name }`            | `packingTemplatesRepository.requireUpdate` in the caller's scope                              |

`saveListAsTemplateFn` mirrors with `patch('trip', data.tripId, { listsChangedAt: Date.now() })`; the
other two mirror nothing, because a template is workspace state and not trip state, and firing a trip
patch for it would wake a Durable Object that has nothing to hear.

**Name resolution, in the repository's caller rather than in SQL.** Before inserting,
`saveListAsTemplateFn` counts templates in the caller's scope whose name equals the requested one. If
one exists and `overwrite` is false, it returns `{ conflict: true }` and writes nothing — the surface
then offers "Replace it" or "Save as a copy", and the copy path appends an ordinal until the unique
index accepts it, bounded to eight attempts with a time-suffixed fallback, exactly as
`reserveTripSlug` does. A UNIQUE violation must never reach the browser as a 500.

**Zod v4.** `z.strictObject()` on all three inputs; `tripId` and `listId` as the bounded id shape;
`name` as `z.string().trim().min(1).max(120)` with an `error` message; `overwrite` as `z.boolean()`
defaulting to `false`; `isShared` as `z.boolean()`. Validation is shape. The repository re-parses on
the way in and that redundancy is kept.

**Nothing slow runs inline.** A template save is one read of a list's rows and one batched insert,
both bounded by `MAX_ITEMS_PER_LIST` from `05-S1` and by `createTemplateInput.items`' own cap of 500
(`src/server/repos/lists.ts:109`). There is no export, no email and no external call, so nothing is
enqueued on `TASKS`.

### UI (route, components)

**Route.** None added and none edited. The two affordances live in the per-list toolbar
`05-S1` creates.

**Components.**

- `list-toolbar.tsx` gains two controls, and both are conditional in the way the behaviour requires:
  **Apply a template** renders only when at least one template exists in the workspace, and **Save as
  template** renders only when the list has at least one item. A control that can do nothing is not
  rendered disabled with a tooltip here — an always-present control that is always disabled on a new
  workspace teaches people to ignore that corner of the toolbar.
- `list-dialogs.tsx`'s `TemplateDialog` becomes the workspace library: a list of templates, each row
  showing its name, its row count with `tabular-nums`, its four-name sample and its
  workspace-or-private state, with **Apply**, **Rename** and **Delete** per row. Saving happens in the
  same dialog on a second tab, so "keep this" and "reuse that" are one surface rather than two.

**Primitives reused:** `Dialog`, `Tabs` (its `segmented` variant, `tabs.tsx:189`), `Button`,
`IconButton`, `Input`, `Field`, `Badge`, `Chip`, `Switch` for the workspace-or-private toggle,
`EmptyState`, `Skeleton`, `Alert`, `Tooltip`, `Separator`, `ScrollArea`, `toast`. No new primitive,
so nothing is filed against `src/components/ui`.

**States.**

- **Library empty:** `EmptyState` on `--color-surface-2`, a `package` glyph, heading "No templates
  yet", body "Save a list you have already built and it will be here for the next trip.", and a
  primary action that switches to the save tab with the current list pre-selected.
- **Skeleton:** four template rows at their real height — name bar, count pill, sample line — so the
  dialog does not resize when the list arrives. `loadListTemplatesFn` is a `GET` server function
  called on open, so this state is genuinely reached on every slow connection.
- **Error:** `Alert` with `tone="danger"` inside the dialog body, naming the failure and offering
  "Try again"; the dialog stays open, because closing it would lose the name the user typed.
- **Conflict:** not an error state — an inline `Alert` with `tone="warning"` and two buttons,
  "Replace it" and "Save as a copy", with the copy's resolved name shown before it is committed.
- **Delete confirmation:** a nested confirmation inside the dialog naming the template and its row
  count, because deleting a template is the one action here that cannot be undone.
- **Loading:** the row's own Apply button becomes `disabled` with a `Spinner` in place of its icon;
  the rest of the library stays interactive.

**Interaction states** — hover, `focus-visible`, active, disabled, loading — on all of: the two
toolbar controls, the tab triggers, every per-row action, the save form's submit, the workspace
toggle, and the confirmation's two buttons. The dialog traps focus, restores it to the trigger on
close and closes on Escape, which `Dialog` already provides and this stage does not re-implement.

**Motion.** The dialog's own enter/exit is the primitive's (220ms in, 150ms out, `--ease-out-quint`);
the tab's active pill slides at `--duration-fast`; a saved row enters with a 24ms-staggered fade
capped at eight rows. `prefers-reduced-motion: reduce` reduces all of it to opacity.

**Responsive.** At 360px the dialog is a bottom `Sheet` rather than a centred `Dialog` — `vaul` is
already the `Sheet` implementation and the pattern is already used elsewhere in the product — and each
template row stacks its sample under its name. At 1280px and 2560px it is a centred dialog with a
capped measure; the library does not grow to fill a 2560px viewport.

**Tokens.** Nothing new. Counts and row totals carry `tabular-nums`.

### Quota

**No countable row and no `assertQuota` call site**, for the reason the plan-level section records:
`packing_templates` is none of `USAGE_METRICS`, and adding one is a non-additive rebuild of a shipped
table (`schema.ts:323`).

The bound this stage enforces instead: `MAX_TEMPLATES_PER_WORKSPACE = 100`, checked with a scoped
`count()` in `saveListAsTemplateFn` before the insert, raising the module's validation error. A
template's own row count is already bounded at 500 by `createTemplateInput.items`
(`src/server/repos/lists.ts:109`), so the worst case a workspace can reach is bounded on both axes.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block,
`'packing templates'`. The file already creates a template for each tenant at `:347`, so the fixture
this block needs is present.

Covered: `listTemplates` in A's scope never returns B's template; `listTemplateItems` with B's
`templateId` returns nothing; `deleteTemplate` and the rename path with B's `templateId` are
`NotFoundError`; `createTemplateFromList` with B's `listId` is a `NotFoundError` and writes no
template row; `applyTemplateToTrip` with B's `templateId` onto A's trip, and with A's template onto
B's trip, are both `NotFoundError` and leave both trips' list counts unchanged. Afterwards B's
template is re-read by id in B's scope and its name and row count are unchanged.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/server/fns/__tests__/list-templates.test.ts` — saving a list produces a template
whose row count equals the list's; saving the same list twice without `overwrite` returns
`{ conflict: true }` and writes nothing; with `overwrite` it replaces the rows and keeps one template;
the copy path appends an ordinal and never raises a UNIQUE violation; the eight-attempt bound falls
back to a time-suffixed name rather than looping; `MAX_TEMPLATES_PER_WORKSPACE` raises at the ceiling
and not one row before it.

**Playwright**, with `PLAYWRIGHT_BASE_URL` always passed:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/packing-and-todos.visual.spec.ts
```

The stage's `describe` block is named `05-S2` and appended to the file `05-S1` created; it edits no
other block. `watchConsole` is attached before every navigation and the report's `fatal` list is
asserted empty in every test in the block, including the frame-only ones.
`TOLERATED_CONSOLE_WARNINGS` is not extended.

**Frames.** This stage's outcome is entirely a non-resting state, so the resting board set is owed
_and_ three declared sets are:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/lists" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/05-S2" \
  --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state library --click '[data-part="template-library"]'
```

and again with `--state save --click '[data-part="template-save"]'` and with `--state conflict`,
which the spec reaches by saving twice. The three `data-part` selectors are published by this stage;
each is verified with `await page.locator(sel).count()` returning 1 against a running server before
`capture.mjs` runs, and the counts go in the evidence. The library's empty state is photographed by
pointing the same capture at a workspace with no templates, which the spec produces by deleting the
seeded one inside its own test and restoring it afterwards.

The skeleton is reached in the spec with a `page.route()` that delays `loadListTemplatesFn`'s
response; the error state with one that fails it.

`PT_SERVER_TODAY=2026-08-20` is `BASELINE_DAY` (`e2e/helpers/shoot.ts:1014`) and the same value
`playwright.config.ts` sends. The trip id is resolved at runtime as `05-S1` describes; it is not a
constant.

**Layout shift** after the settle mark must be `0`, measured the way §6 of
`12-verification-protocol.md` fixes: an init-script `PerformanceObserver` for the `layout-shift` entry
type, `hadRecentInput` entries excluded, gated on `PerformanceObserver.supportedEntryTypes` and
reported as a skip on WebKit — where the type is unsupported and `observe()` records nothing without
throwing — rather than as a pass. This
stage opens a dialog, which is exactly the kind of thing that shifts a page behind it, so the reading
is taken with the dialog open as well as at rest.

**Console must be silent.**

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, for every surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **`05-S1` must have landed**, because the toolbar this stage extends is created there and because a
  template's rows carry group names that only mean something once groups are records. Wave 3 closes
  before wave 4 opens.
- **No package is missing**, and none is installed.
- **§7.2 does not apply**, on the same measurement `05-S1` records: the lists module constructs no
  `Intl` formatter, and this stage adds none.
- **§7.3 applies**, as it does everywhere: the baselines are a single-machine net. A `mobile-safari`
  difference this stage cannot attribute is reported and the comparison budget is not widened.

## Stage 05-S3 — Bags, and the weight that is actually in them

### Stage id

`05-S3` · Wave 4 · effort **M**. The one stage in this file that adds a record with arithmetic behind
it.

### Reference rows

- `LST-03` partial → **done**.

Sourced from `wiki: Packing-Bags` for the idea of a named, coloured container with an optional weight
limit, the picker that puts an item into one, the people assigned to carry it, the bucket that holds
whatever has not been assigned, and the totals that recompute as rows move.

**What already exists and is not rebuilt.** `packing_items.weight_grams` and
`packing_lists.weight_limit_grams` both ship (`src/server/db/schema.ts:919,891`), both are guarded by
`nonNegativeCheck` (`:934,901`), `listTripListsWithProgress` (`src/server/repos/lists.ts:145-181`)
already sums weight per list in SQL, and the lists route already renders pack weight and the heaviest
list as `StatCard`s (`src/routes/_app/trips/$tripId/lists.tsx:82-93`). `formatWeight`
(`src/lib/format.ts:552`) is the only weight renderer and stays that way.

**What is missing is the container.** There is no bag entity, so a weight can be totalled per list but
never per case, and nothing can carry a limit that means "this is what the airline will accept".

**One thing this product does differently, and it is not a port decision.** Upstream, bag tracking is
switched on for a whole deployment by an administrator. One deployment here serves every tenant, so an
instance switch would turn a feature on for every customer at once. Bags are therefore **per trip and
implicit**: the Bags panel exists on every trip, and a trip that has created no bag shows the panel's
empty state rather than a hidden feature. Nothing is gated, nothing is configured, and the row count
answers "is this trip using bags" without a flag to keep in sync.

**Rows unblocked:** none. `LST-03` is a leaf in the edge set.

### Owned paths

- `src/server/repos/lists.ts` — edit. Bag access and the assignment writer. Held by `05-S1` in wave 3
  and by `05-S5` in wave 5.
- `src/server/repos/__tests__/lists-bags.test.ts` — new.
- `src/server/fns/list-bags.ts` — new. This stage's write path.
- `src/routes/_app/trips/$tripId/-server/bags.ts` — new. This stage's read path, route-local. Nobody
  else claims it.
- `src/components/modules/lists/bags-panel.tsx` — new.
- `src/components/modules/lists/bag-model.ts` — new. The pure totals, so they are testable without a
  DOM.
- `src/components/modules/lists/__tests__/bag-model.test.ts` — new.
- `src/components/modules/lists/item-row.tsx` — edit. The bag picker and the weight field. Created by
  `05-S1` in wave 3 and also held by `05-S5` in wave 5.
- `src/components/modules/lists/list-panel.tsx` — edit. The Bags trigger in the panel header. Created
  by `05-S1` in wave 3.
- `src/components/modules/lists/lists-board.tsx` — edit. Hosts the panel and passes bags down. Also
  held by `05-S1` in wave 3.
- `src/components/modules/lists/types.ts` — edit. `bagId` on the item shape and the bag shape itself.
  Held by `05-S1` (wave 3) and `05-S5` (wave 5).
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/packing-and-todos.visual.spec.ts` — append.
- `e2e/__screenshots__/packing-and-todos.visual.spec.ts/` — append.

**Why the read path is route-local rather than an edit to `loadTripLists`.** The obvious home for a
bag's data is `src/routes/_app/-server/trip.ts`, and this stage does **not** claim it. An earlier
draft of this stage did, and `node scripts/ultrabuild/check-plan-collisions.mjs 05` reported a
same-wave exclusive collision against `06-S6` (`06-documents-and-media.md`), which was claiming the
same module in wave 4 for `loadTripFiles`. Two stages editing one loader module in parallel clobber
each other, which is the one thing that check exists to catch, and it caught it. Both plans were
being written at the same time and both backed off the file independently, so a later reader running
the check will not see the pair — the repair is recorded here because the reason for the shape has to
outlive the output that produced it. The route-local read path is kept on its own merits: it is
collision-proof against a loader module five stages across four plans want to extend, and a trip with
no bags pays one indexed lookup instead of widening a payload every trip loads. The cost is stated
under **UI** rather than hidden: the bag data arrives on a second request, so the chip's space is
reserved from first paint and nothing reflows when it lands.

No route file is added, so `pnpm generate-routes` is not one of this stage's steps and
`src/routeTree.gen.ts` is not listed.

### Data and migration

**One additive table, one additive join table and one additive column, filed as a requirement for the
wave-4 schema stage in `00-foundations.md`. This stage does not edit `src/server/db/schema.ts`.**

`packing_bags`:

| Column               | Type                   | Null     | Notes                                                      |
| -------------------- | ---------------------- | -------- | ---------------------------------------------------------- |
| `id`                 | `text` PK              | not null | `pk()`, `newId()`                                          |
| `organization_id`    | `text`                 | not null | `orgRef()`, `ON DELETE CASCADE`                            |
| `trip_id`            | `text` → `trips.id`    | not null | `ON DELETE CASCADE`; a bag belongs to a trip, not a list   |
| `name`               | `text`                 | not null | Bounded at 60 characters by the repository's Zod input     |
| `colour`             | `text(9)`              | nullable | `colour()`, the helper every other coloured row uses       |
| `weight_limit_grams` | `integer`              | nullable | Null means no limit, so the limit bar simply does not draw |
| `sort_order`         | `real`                 | not null | `sortOrder()`                                              |
| `created_at`         | `integer` timestamp_ms | not null | `timestamps()`                                             |
| `updated_at`         | `integer` timestamp_ms | not null | `timestamps()`, `$onUpdateFn`                              |

Indexes: `packing_bags_org_trip_idx` on `(organization_id, trip_id)` and `packing_bags_trip_sort_idx`
on `(trip_id, sort_order)`. A unique `packing_bags_trip_name_unq` on `(trip_id, name)`, so "the black
case" is one thing on a trip. No CHECK: there is no enum column, and the non-negative guard on
`weight_limit_grams` is the same `nonNegativeCheck` the two existing weight columns already carry —
which is safe here because the table is new, and adding a CHECK to a _new_ table is not the rebuild
the ritual warns about.

`packing_bag_members` — `id`, `organization_id`, `bag_id` → `packing_bags.id` `ON DELETE CASCADE`,
`user_id` via `userRef()`, `created_at`. Indexes `packing_bag_members_org_idx` on
`(organization_id, bag_id)` and a unique `packing_bag_members_unq` on `(bag_id, user_id)`.

`packing_items.bag_id` — `text`, **nullable**, referencing `packing_bags.id` with
`ON DELETE SET NULL`, indexed as `packing_items_bag_idx` on `(organization_id, bag_id)`. Nullable is
load-bearing rather than lazy: null **is** the unassigned bucket, so the bucket needs no row of its
own and cannot drift out of sync with the items in it, and deleting a bag returns its contents to the
bucket instead of deleting them.

The migration is additive, backfills nothing, and a rollback is safe because the previous Worker reads
neither the new tables nor the new column.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/lists.ts`, edit**, on a new
`createTenantRepository(packingBags, 'bag')` handle:

- `listTripBags(scope, tripId)` — bags in `sort_order`, each with its member user ids from the join,
  read in a second query and stitched in memory, the same shape `listTripListsWithProgress` uses.
- `getTripBagTotals(scope, tripId)` — one grouped SQL aggregate over `packing_items`, `sum` of
  `weight_grams` and `count` per `bag_id`, built through `tenantFilter()` exactly as the existing
  weight roll-up at `:157-166` is. It is one query for the whole trip, not one per bag: D1 bills rows
  read, and a per-bag query would scan the item table once per case.
- `createBag(scope, { tripId, name, colour, weightLimitGrams })` — `requireTrip` first, name
  uniqueness resolved before the insert with the bounded attempt loop, then insert.
- `updateBag(scope, bagId, patch)` and `deleteBag(scope, bagId)` — `requireUpdate` and
  `requireRemove`. Deleting returns a count of the items released to the bucket, so the toast can say
  what happened.
- `setBagMembers(scope, bagId, userIds)` — resolves the bag, resolves the trip's membership through
  `listTripMembers`, rejects any id that is not a member, replaces the join rows in one batch.
- `assignItemToBag(scope, itemId, bagId | null)` — resolves both rows in the caller's scope, and
  additionally checks that the item and the bag belong to the **same trip**. Tenant scoping alone
  would let a workspace put a Kyoto item in a Lisbon suitcase, which is not a security failure but is
  a correctness one, and the repository is where it is cheap to prevent.
- `assignItemsToBag(scope, itemIds, bagId | null)` — the bulk form, one `batch`, bounded at 200 ids.

**Server functions — `src/server/fns/list-bags.ts`, new**, each opening with `appScope()` then
`requireTrip(scope, data.tripId)`:

| Function             | Method | Returns                    |
| -------------------- | ------ | -------------------------- |
| `createBagFn`        | POST   | `{ bagId, name }`          |
| `updateBagFn`        | POST   | `{ bagId }`                |
| `deleteBagFn`        | POST   | `{ bagId, releasedItems }` |
| `setBagMembersFn`    | POST   | `{ bagId, memberCount }`   |
| `assignItemToBagFn`  | POST   | `{ itemId, bagId }`        |
| `assignItemsToBagFn` | POST   | `{ bagId, moved }`         |

Every one mirrors with `patch('trip', data.tripId, { listsChangedAt: Date.now() })` and declares no
new entity kind, per the plan-level convention — `src/server/do/protocol.ts` is not edited.

**Read path — `src/routes/_app/trips/$tripId/-server/bags.ts`, new.** One `GET` server function,
`loadTripBagsFn`, validated on `{ tripId }`, opening with `appScope()` then `requireTrip`. It returns
`{ bags, totals, itemBagIds }` — the trip's bags with their member ids, the grouped totals from
`getTripBagTotals`, and a plain `Record<itemId, bagId>` read with one scoped, indexed query over
`packing_items`. Three reads, one round trip, and a trip with no bags costs one indexed lookup that
returns nothing. The route-local `-server/` directory is the pattern `01-S2` and `07-S2` already use
for a tab's own server module; the reason this stage uses it rather than the shared loader is under
**Owned paths**.

**Zod v4.** `z.strictObject()` throughout; `name` as `z.string().trim().min(1).max(60)` with an
`error`; `weightLimitGrams` as `z.number().int().min(0).max(500_000).nullable()`, matching the bound
`src/server/fns/lists.ts:55` already applies to a list's limit; `colour` reusing the module's hex
refinement; `bagId` nullable to express "back to the bucket"; `itemIds` as `z.array(rowId).max(200)`.

**Authorisation.** Decided in the handler and again in the repository, never in `beforeLoad`. Every
handler resolves the trip in the caller's scope before touching a child row; every repository writer
resolves its own parent by id in the same scope; and the same-trip check on `assignItemToBag` is a
second, narrower gate on top of the tenant filter.

**Nothing slow inline.** All of it is D1. No queue envelope, no external call.

### UI (route, components)

**Route.** None added, none edited. The panel is opened from the list panel header, so
`src/routes/_app/trips/$tripId/lists.tsx` is untouched by this stage — `05-S4` holds it this wave.

**Components.**

- `bags-panel.tsx` — the bags surface. **On viewports ≥ 1280px it is a right-hand rail beside the
  board; below that it is a `Sheet`** opened from the panel header's Bags control. That is not two
  designs, it is one component whose container changes: the same card list, the same actions, the same
  order.
- `bag-model.ts` — pure functions: `bagTotals(items, bags)`, `unassignedTotal(items)`,
  `limitState(total, limit)` returning `under | near | over` with `near` at 90%, and
  `tripTotal(items)`. No React, no server import, so the arithmetic is tested without a DOM and the
  panel renders what the tests prove.
- `item-row.tsx` gains a bag chip that opens a picker, and the gram field beside the quantity field.
  Both appear on every row; there is no mode to switch on, because the empty bucket is a legitimate
  state rather than a disabled feature.
- `list-panel.tsx` gains the Bags control in its header, showing the trip's bag count as a
  `CountBadge`.
- `lists-board.tsx` hosts the rail at wide widths, calls `loadTripBagsFn` once through
  `useServerFn` under a TanStack Query key of the trip id, and passes the bag records down.

**The second request, and why it costs no layout shift.** Because the bag data does not travel in the
route loader's payload — see **Owned paths** — the board renders once before it arrives. Every slot
that will hold bag data therefore reserves its space from first paint: the row's bag chip renders a
`Skeleton` at the chip's exact width and height while the query is pending, and the Bags control
renders its `CountBadge` slot at a fixed width. Nothing grows when the data lands, so the
layout-shift reading after the settle mark is `0` and is asserted rather than assumed. A trip with no
bags settles into the chip slot's empty affordance, which is the same width as the skeleton it
replaces.

**Primitives reused:** `Card`, `Sheet`, `Popover` for the bag picker, `DropdownMenu` for a bag card's
overflow, `Progress` for the weight limit, `AvatarStack` and `MultiCombobox` for bag members, `Chip`
for the bag chip on a row, `CountBadge`, `Input`, `Field`, `Button`, `IconButton`, `Tooltip`,
`SectionLabel`, `Separator`, `ScrollArea`, `EmptyState`, `Skeleton`, `Alert`, `Dialog` for the delete
confirmation, `toast`. `Slider` is deliberately **not** used for the weight limit: a limit is a typed
number a person reads off an airline page, and a slider makes an exact value hard to reach. No new
primitive, so nothing is filed against `src/components/ui`.

**States.**

- **No bags yet:** `EmptyState` on `--color-surface-2` inside the rail or the sheet, a `briefcase`
  glyph, heading "No bags yet", body "Add a case and start dropping items into it — the weight adds up
  as you go.", primary action "Add a bag".
- **Bucket empty** (every item is in a bag): the Unassigned section renders a single success-toned
  line, "Everything has a bag", rather than disappearing — a section that vanishes when it succeeds
  makes people wonder what they broke.
- **Bag empty:** the card shows `0 items · 0 g` with the totals still in `tabular-nums`, and the card
  is a drop target rather than a dead card.
- **Skeleton:** three bag cards at their real height with a name bar, a totals line and a limit bar,
  so opening the rail does not resize it.
- **Error:** `Alert` with `tone="danger"` inside the rail naming the failure, with "Try again" wired
  to the router invalidate. A failed assignment rolls the chip back and raises a `toast` carrying the
  reason.
- **Over limit:** the `Progress` switches to `tone="danger"`, the figure gains a warning glyph, and
  the card states the overage in grams. **Colour is never the only signal** — the overage is written
  out, so the state survives a monochrome reading and a colour-vision difference, which is what WCAG
  2.2 AA asks for and what a red bar alone fails.
- **Near limit** (≥ 90%): `tone="warning"` and the remaining grams stated.

**Interaction states** on: the Bags control, every bag card's overflow trigger and each menu item, the
member picker, the limit field, the row's bag chip and every option in its picker, the gram field, the
add-bag submit, and the delete confirmation. Anything mid-request is `disabled` with a `Spinner`.

**Keyboard.** The bag picker is a `Popover` with a listbox: arrow keys move, Enter assigns, Escape
closes and returns focus to the chip. Assignment is fully reachable without a pointer, which matters
because dragging a row into a bag is the obvious gesture and is not keyboard-operable — so drag is an
addition, never the only path.

**Motion.** The rail slides in on `--ease-drawer` at `--duration`; the sheet uses the `Sheet`
primitive's own motion; a total that changes crossfades its digits at `--duration-fast` rather than
counting up, because a counting number is motion for its own sake and moves the layout on every frame.
`prefers-reduced-motion: reduce` removes the slide and the crossfade.

**Responsive.** 360px: sheet, one bag card per row, the picker as a full-width sheet-inside-sheet.
1280px: a 320px rail beside a single board column. 2560px: the rail keeps its width and the board
takes the extra space up to its three-column cap — the rail does not stretch, because a bag card
2000px wide is a line, not a card.

**Tokens.** Nothing new. Every gram figure, item count and percentage carries `tabular-nums`,
including the ones inside the `Progress` label.

### Quota

**No countable row and no `assertQuota` call site**, for the reason recorded at plan level:
`packing_bags` is none of `USAGE_METRICS`, and adding one is a non-additive rebuild of a shipped table
(`schema.ts:323`).

The bound this stage enforces instead: `MAX_BAGS_PER_TRIP = 30`, asserted with a scoped `count()` in
`createBag` before the insert, raising the module's validation error. Bag members are bounded by trip
membership, which is itself the `members` metric and is asserted in `src/server/repos/members.ts`.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block,
`'packing bags'`.

Covered: `listTripBags` and `getTripBagTotals` in A's scope over B's `tripId` return nothing;
`createBag` with B's `tripId` is a `NotFoundError`; `updateBag`, `deleteBag` and `setBagMembers` with
B's `bagId` are `NotFoundError`; `assignItemToBag` with A's item and B's `bagId`, and with B's item
and A's `bagId`, are both `NotFoundError`; `assignItemsToBag` with a mixed array containing one of B's
item ids rejects the whole call rather than moving the rest, and the check is that A's items are
unmoved afterwards — a partial success here would be a write that half-crossed a tenant boundary;
`setBagMembers` with a `userId` who belongs only to B's trip is rejected rather than silently dropped.
Afterwards `packingBagsRepository.count(beta.scope)` is unchanged and B's bag name and totals are
re-read and compared.

One case that is not about tenancy but belongs beside these because it is the same class of mistake:
`assignItemToBag` with A's item and A's bag **from a different trip in the same workspace** is
rejected. Tenant isolation would allow it; correctness does not.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/components/modules/lists/__tests__/bag-model.test.ts` — totals sum only the items in a bag; an
  item with a null `weightGrams` contributes zero rather than `NaN`; the unassigned total is the
  complement of the assigned ones and the two add to the trip total; `limitState` returns `near` at
  exactly 90% and `over` at exactly 101%, so the boundaries are pinned rather than approximate; a null
  limit returns no state at all.
- `src/server/repos/__tests__/lists-bags.test.ts` — deleting a bag sets `bag_id` to null on its items
  and deletes no item; the same-trip check rejects a cross-trip assignment inside one workspace;
  `setBagMembers` is idempotent; `getTripBagTotals` returns one row per bag with items and a null-bag
  row for the bucket; the `MAX_BAGS_PER_TRIP` bound raises at the ceiling and not one row before it;
  a duplicate bag name resolves to an ordinal rather than raising a UNIQUE violation.

**Playwright**, with `PLAYWRIGHT_BASE_URL` always passed:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/packing-and-todos.visual.spec.ts
```

The stage's `describe` block is named `05-S3` and is appended; it edits no other block. `watchConsole`
is attached before every navigation and `fatal` is asserted empty in every test, including the
frame-only ones. `TOLERATED_CONSOLE_WARNINGS` is not extended. The `mobile-safari` project matters
more here than anywhere else in this file, because the rail-to-sheet switch and the sheet's own
scrolling are exactly what behaves differently on WebKit.

**Frames.** The resting board set, plus three declared sets — the rail open, a bag over its limit, and
the row picker open:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/lists" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/05-S3" \
  --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state bags --click '[data-part="bags-open"]'
```

and again with `--state bag-over-limit` and `--state bag-picker --click '[data-part="item-bag"]'`.
The over-limit set needs data the seed does not carry, so the spec creates a bag with a small limit
and assigns two heavy rows to it inside its own test, then removes them — the state is produced by the
product's own write path rather than by a fixture nobody else can reproduce. The three `data-part`
selectors are published by this stage and each is verified with
`await page.locator(sel).count()` returning 1 against a running server before `capture.mjs` runs.
The 360px set is where the sheet is judged and the 1280/2560 sets are where the rail is; both are
required, because this stage ships two containers.

`PT_SERVER_TODAY=2026-08-20` is `BASELINE_DAY`. The trip id is resolved at runtime, never hard-coded.

**Layout shift.** Zero after the settle mark, including across the rail's open and close and across
the resize that switches container — the switch is the most likely source of a shift in this file.
Gated on `supportedEntryTypes`, reported as a skip on WebKit rather than as a pass.

**Console must be silent.**

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, for every surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes — and the over-limit state is legible without colour.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **`05-S1` must have landed** — the item row and the list panel this stage edits are created there.
  Wave 3 closes before wave 4 opens.
- **The wave-4 schema stage must have landed**, carrying `packing_bags`, `packing_bag_members` and
  `packing_items.bag_id`. The requirement is filed above; the module is not edited here.
- **No package is missing.** `vaul` backs `Sheet`, `radix-ui` backs `Popover`, both are pinned. None
  is installed.
- **§7.2 does not apply**, on the measurement `05-S1` records. This stage adds no `Intl` construction:
  a weight is not a date.
- **§7.3 applies.** The `mobile-safari` half of this stage's baselines carries more risk than
  elsewhere in this file because the sheet is a WebKit-specific surface; an unattributable difference
  is reported here and the comparison budget is not widened.

## Stage 05-S4 — Everything that has to happen before anyone leaves

### Stage id

`05-S4` · Wave 4 · effort **M**. The stage that gives the `todo` list kind a surface of its own
instead of borrowing the packing board's.

### Reference rows

- `LST-05` partial → **done**.

Sourced from `wiki: Trip-Todos` for the three-region layout — a navigation and filter column, the task
list, and a detail region that is a third column on a wide screen and a bottom sheet on a narrow one —
for the set of saved filters and the asymmetry between them, for a sort that puts triaged work first,
and for a create form that sets every field before the row exists rather than after.

**What already exists.** `todo` is a declared list kind (`src/server/db/schema.ts:205`), and
`packing_items` already carries `priority`, `due_date`, `assigned_to` and `description`
(`:920-924,918`), so a to-do list renders through the packing board today. Every write this stage
needs exists too: `createListItemFn`, `updateListItemFn`, `deleteListItemFn` and `setListItemsDoneFn`
(`src/server/fns/lists.ts:158,184,205,223`). **No repository function is added by this stage**, and
`src/server/repos/lists.ts` is not edited here — `05-S3` holds it this wave.

**What is missing** is the surface, and two fields the write path does not accept: `itemFields` in
`src/server/fns/lists.ts:56-63` validates `name`, `category`, `quantity`, `weightGrams`, `assignedTo`
and `priority`, and carries **neither `description` nor `dueDate`** — so the two columns that make a
task a task cannot be written from the browser at all.

**The three-value priority, and why it reproduces the behaviour that matters.**
`ITEM_PRIORITIES` is `low · normal · high` and is CHECK-constrained (`schema.ts:206,935`); adding a
fourth value is the non-additive table rebuild the plan-level quota section rejects on the same
evidence. The sort is therefore `high`, then `low`, then `normal`, and a badge is drawn for `high`
(`danger` tone) and `low` (`info` tone) and for nothing else. `normal` is what a row is born with, so
"untriaged" sorts last exactly as it should, and the badge's absence is the signal. Tone is never the
only signal: each badge carries its word.

**Rows unblocked:** none. `LST-05` is a leaf in the edge set.

### Owned paths

- `src/server/fns/lists.ts` — edit. Two fields on the item inputs and one read. Held by `05-S1` in
  wave 3 and by `05-S5` in wave 5.
- `src/routes/_app/trips/$tripId/lists.tsx` — edit. The validated view parameter and the two hosts.
  Nobody else in this file or any other claims it.
- `src/components/modules/lists/index.ts` — edit. Two exports. Also held by `05-S1` in wave 3.
- `src/components/modules/lists/todo-board.tsx` — new.
- `src/components/modules/lists/todo-detail.tsx` — new.
- `src/components/modules/lists/todo-model.ts` — new. The filters and the sort, as pure functions.
- `src/components/modules/lists/__tests__/todo-model.test.ts` — new.
- `src/routes/api/dev/-seed/dataset/flagship.ts` — edit. One seeded to-do list, so the surface has
  something to photograph. No other plan claims this file.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/packing-and-todos.visual.spec.ts` — append.
- `e2e/__screenshots__/packing-and-todos.visual.spec.ts/` — append.

No route file is added — the surface is a search parameter on the route that already exists — so
`pnpm generate-routes` is not one of this stage's steps and `src/routeTree.gen.ts` is not listed. That
choice is not only about the generated file: a `/trips/$tripId/todos` route would need a tab in
`src/components/layout/trip-sub-nav.tsx`, which `01-S6` holds exclusively in this same wave.

### Data and migration

**None, and that is the finding rather than an omission.** `priority`, `due_date`, `assigned_to` and
`description` all exist on `packing_items`; `todo` is already a valid `kind`; the CHECK constraints
are already in place. This stage files nothing against `00-foundations.md` and edits
`src/server/db/schema.ts` not at all.

The one data change is a **fixture**, not a schema change: `src/routes/api/dev/-seed/dataset/flagship.ts`
gains one list of kind `todo` with roughly nine rows spread across the three priorities, some with due
dates before and after `BASELINE_DAY`, some assigned and some not, one already done. Without it the
stage's own frames would be an empty state, which is not evidence about a three-region layout.

**Whether that fixture moves an existing baseline, measured rather than hoped.**
`grep -rn "packingItems\|packingLists" src/server/repos/dashboard.ts src/routes/_app/-server/overview.ts`
returns nothing, so neither `/dashboard` nor `/trips` — the only two baselined authenticated routes
that could plausibly count list rows — reads a packing row at all. The other eleven baselined routes
are public or are `/atlas`, `/journey`, `/vacay`, `/settings`. The expectation is therefore that no
existing baseline moves; the stage runs the full suite anyway and, if one does, names it and argues
the re-record rather than reaching for `--update-snapshots` reflexively.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/lists.ts`, written through but not edited.** No function is added and
the module is not opened; `05-S3` holds it this wave. This stage composes `listTripLists` (`:121`),
`listItems` (`:131`), `listItemsAssignedTo` (`:187`), `createListItem` (`:229`), `updateListItem`
(`:253`) and `setListItemDone` (`:266`), every one of which is built on a `createTenantRepository`
handle whose queries begin at `eq(table.organizationId, scope.ctx.organizationId)` through
`tenantFilter()` — so the `organization_id` scoping this stage relies on is the module's, unchanged
and re-covered by the isolation cases below rather than assumed.

**Server functions — `src/server/fns/lists.ts`, edit.**

- `itemFields` (`:56-63`) gains `description` as `z.string().trim().max(2000)` and `dueDate` as
  `z.iso.date().or(z.literal(''))`, where `''` means "no date" — the shape a cleared `DatePicker`
  produces, and the same `orNull` convention `createListFn` already uses for an empty owner
  (`src/server/fns/lists.ts:96`). Both flow into `createListItemFn` and `updateListItemFn`, whose
  repository inputs already accept them (`src/server/repos/lists.ts:78-88`): the columns and the
  repository Zod were always ready, and only the boundary schema was not.
- `loadTripTodosFn` — `GET`, validated on `{ tripId }`, opening with `appScope()` then
  `requireTrip`. It returns the trip's `todo`-kind lists with their rows, each row carrying its
  `description`, and each row carrying **`isOverdue` as a boolean the server computed** from
  `serverToday()` (`src/server/clock.ts:73`) against `due_date`.

**Why a derived boolean and not a `today` field, stated because it is the kind of decision a later
stage would otherwise undo.** `auditServerClock()` in `e2e/helpers/shoot.ts` compares a route's
`relativeTime` declaration against the presence of a `today:"…"` string in the streamed document and
fails in both directions. Returning `today` would make the lists route a `relativeTime` route, which
means the plan's spec route table — created by `05-S1` in an earlier wave in a file later stages only
append to — would have to be edited by this stage. Returning `isOverdue` keeps the clock pinned (the
computation is server-side and honours `x-pt-server-today` in development, which is what
`PT_SERVER_TODAY` sets) while adding no declaration anyone has to flip. The field is named
`isOverdue` precisely so no substring of it reads as a clock field.

**Authorisation.** Every handler resolves the trip through `requireTrip` in the caller's scope before
touching a child row; `updateListItemFn` already re-resolves the item through
`packingItemsRepository.requireUpdate`, so a foreign item id is a `NotFoundError` rather than a no-op.
A well-formed id from the browser is not an authorised id, and `beforeLoad` decides nothing here.

**Zod v4.** `z.strictObject()` on the new input, `z.iso.date()` rather than a hand-rolled regex, the
`error` parameter for every message. Validation is shape, not permission.

**Nothing slow inline**, nothing enqueued, and the existing `patch('trip', …)` mirror is reused
unchanged.

### UI (route, components)

**Route.** `/trips/$tripId/lists`, edited, still the default SSR. It gains
`validateSearch` for `view: 'packing' | 'todo'` defaulting to `packing`, and a `task` parameter
carrying the open row's id so a detail pane is linkable and survives a refresh. The switch between the
two views is a `Tabs` control in the `segmented` variant, placed in the module header beside the
existing title — the route already renders `TripModuleHeader` with an `actions` slot
(`lists.tsx:54-60`), so the control has a home. The four `StatCard`s above the board become
view-aware: in the todo view they count open tasks, overdue tasks, tasks assigned to the reader and
completion, with `tabular-nums` on every figure.

**Components.**

- `todo-board.tsx` — the three regions. **≥ 1280px:** a 240px filter column, a fluid task list, and a
  360px detail column that appears only when a task is open. **768–1279px:** filter column plus list,
  detail as a `Sheet`. **< 768px:** the filter column collapses to a horizontal scrolling rail of
  `Chip`s carrying `CountBadge`s, and the detail is a bottom `Sheet`. Three layouts, one component
  tree; the small one is designed, not the wide one with columns removed.
- `todo-detail.tsx` — the editable record: name, description, due date, assignee, priority, done
  state, delete. Every field saves on blur with an optimistic update and a rollback `toast`. The pane
  is a `<form>` with a real submit path so Enter works and so a screen reader announces it as a form.
- `todo-model.ts` — pure: `PRIORITY_ORDER`, `sortTasks(rows)`, `filterTasks(rows, filter, viewerId)`
  and `filterCounts(rows, viewerId)`. The five filters, with the asymmetry made explicit because it is
  the part a re-implementation always gets wrong:

  | Filter         | Selects                                               |
  | -------------- | ----------------------------------------------------- |
  | `open`         | Rows that are not done                                |
  | `mine`         | Rows that are not done and are assigned to the reader |
  | `overdue`      | Rows that are not done and carry `isOverdue`          |
  | `done`         | Rows that are done                                    |
  | `group:<name>` | **Every** row in that group, done and not done alike  |

  The first three are open-only, `done` is done-only, and a group is both. That asymmetry is the
  behaviour; a uniform filter set would be a different feature that happens to have the same labels.

**Primitives reused:** `Tabs` (segmented), `Chip`, `CountBadge`, `Checkbox`, `Sheet`, `Dialog` for the
new-task form, `DatePicker`, `Select` for priority, `Combobox` for the assignee, `Textarea` for the
description, `Input`, `Field`, `Button`, `IconButton`, `Badge`, `Avatar`, `Tooltip`, `SectionLabel`,
`Separator`, `ScrollArea`, `Progress`, `EmptyState`, `Skeleton`, `SkeletonText`, `Alert`, `toast`. No
new primitive, so nothing is filed against `src/components/ui`. `DateRangePicker` is not used: a task
has one date.

**States.**

- **No to-do list on the trip:** `EmptyState` on `--color-surface-2`, a `list-checks` glyph, heading
  "Nothing to do yet", body "Add a to-do list and everything that has to happen before you leave lands
  here.", primary action creating one through the list dialog that already exists.
- **Filter empty, one message per filter, never a shared one:** "Nothing open — everything here is
  done" for `open`; "Nothing is assigned to you" for `mine`, with a secondary action clearing the
  filter; "Nothing is overdue" with a success tone for `overdue`; "Nothing has been ticked yet" for
  `done`; "This group is empty" for a group. Five filters that all say "no results" is how a person
  concludes the product is broken.
- **No task open** (wide viewports, detail column): a designed resting panel — the completion figure,
  the next due date, and a line of instruction — rather than a blank third of the screen.
- **Skeleton:** the three regions at their real widths, with five task rows at their real height, so
  the columns do not resize when data lands.
- **Error:** `Alert` with `tone="danger"` in the list region with "Try again" wired to the router
  invalidate; a failed field save rolls that field back and raises a `toast` naming what failed.
- **Loading:** a row mid-save shows its checkbox as a `Spinner`; the detail pane's field shows a
  quiet inline indicator and stays editable, because locking a field mid-save loses keystrokes.

**Interaction states** — hover, `focus-visible`, active, disabled, loading — on every filter chip,
every task row, the row checkbox, the sort toggle, every field in the detail pane, the new-task
trigger and its form's submit and cancel, and the delete affordance with its confirmation.

**Keyboard.** The task list is a `listbox`-shaped region: arrow keys move the active row, Enter opens
the detail, Space toggles done, Escape closes the detail and returns focus to the row it came from.
The filter rail is reachable by Tab and its chips by arrow keys. A task is fully manageable without a
pointer.

**Motion.** The detail column enters at `--duration` on `--ease-out-quint` as an opacity-and-transform
change; the sheet uses `--ease-drawer`; a row leaving a filter fades out over `--duration-fast` rather
than snapping, so a tick does not make the list jump under the cursor. `prefers-reduced-motion:
reduce` collapses all three to opacity.

**Responsive.** 360px: header switch, chip rail, list, bottom sheet. 1280px: three regions. 2560px:
the filter column keeps its width, the detail column keeps its width, and the task list caps its
measure at a readable line length rather than stretching a task name across 1800px.

**Tokens.** Nothing new. Priority tones come from `--color-danger` / `--color-danger-soft` and
`--color-info` / `--color-info-soft` through the existing `Badge` tone variants; no component
hard-codes a hex. Counts, due dates and completion percentages carry `tabular-nums`.

### Quota

**No countable row and no `assertQuota` call site.** A to-do row is a `packing_items` row and is none
of `USAGE_METRICS`; the plan-level section records why adding a metric is a non-additive rebuild.

The bound is the one `05-S1` already enforces in the repository: `MAX_ITEMS_PER_LIST = 500`, asserted
with a scoped `count()` before every insert. This stage adds no second bound and no second call site;
it writes through the same repository function and inherits the ceiling.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block,
`'trip todos'`. This stage adds no repository function, so the block covers the **existing** functions
it writes through, which is the point: a new caller of an old function is a new way to reach it.

Covered: `listTripLists` and `listItems` in A's scope over B's `tripId` and B's `listId` return
nothing; `createListItem` with B's `listId` and a description and a due date is a `NotFoundError` and
writes no row; `updateListItem` with B's `itemId` setting `description`, `dueDate` or `priority` is a
`NotFoundError` and B's row is re-read unchanged in all three columns; `setListItemDone` with B's
`itemId` is a `NotFoundError`; `listItemsAssignedTo` with B's `tripId` and A's own `userId` returns
nothing. Afterwards `packingItemsRepository.count(beta.scope)` is unchanged.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.** `src/components/modules/lists/__tests__/todo-model.test.ts` —
`sortTasks` puts `high` first, `low` second and `normal` last, and is stable within a priority so a
re-render never reorders equal rows; each of the five filters selects exactly the set in the table
above, and the `done` and group filters are asserted **against** the open-only three so the asymmetry
is a test rather than a comment; `filterCounts` matches `filterTasks(...).length` for every filter over
the same fixture, because a badge that disagrees with its list is worse than no badge; a row with a
null `dueDate` is never overdue; `mine` with no viewer id returns nothing rather than everything.

**Playwright**, with `PLAYWRIGHT_BASE_URL` always passed:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/packing-and-todos.visual.spec.ts
```

The `describe` block is named `05-S4` and appended. The route table still declares no `relativeTime`
flag and `auditServerClock()` still passes, which is the whole reason `loadTripTodosFn` returns
`isOverdue` rather than `today`; the stage states that result in its evidence rather than assuming it.
`watchConsole` is attached before every navigation and `fatal` is asserted empty in every test.
`TOLERATED_CONSOLE_WARNINGS` is not extended. Because the fixture changes, the **full** suite is run,
not just this spec, and the pass/fail count of both is reported.

**Frames.** The todo view is itself a non-resting state — the route opens on `packing` — so every set
here is a declared one:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/lists?view=todo" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/05-S4" \
  --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --state todo
```

and again with `--state todo-detail --click '[data-part="task-row"]'`, with
`--state todo-overdue --click '[data-part="filter-overdue"]'`, and with
`--state todo-new --click '[data-part="task-new"]'`. The resting packing set is still owed, because a
view switch is judged against the view it switches from. The four `data-part` selectors are published
by this stage and each is verified with `await page.locator(sel).count()` returning 1 against a
running server before `capture.mjs` runs; the counts go in the evidence.

`PT_SERVER_TODAY=2026-08-20` is `BASELINE_DAY` (`e2e/helpers/shoot.ts:1014`) and is what makes the
overdue set reproducible: the seeded due dates straddle that day deliberately, so the overdue filter
selects a fixed set on every run and on every calendar day. The trip id is resolved at runtime.

**Layout shift.** Zero after the settle mark, including across the view switch and across opening the
detail region — a third column appearing is the most likely shift this stage could introduce. An
init-script `PerformanceObserver` for the `layout-shift` entry type, `hadRecentInput` entries
excluded, gated on `PerformanceObserver.supportedEntryTypes`; the WebKit result is reported as a
skip, never as a pass, because the type is unsupported there and `observe()` records nothing without
throwing.

**Console must be silent.**

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, for every surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state — and the five filter-empty messages are distinct from one another.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes — and a priority is legible without its colour.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **`05-S1` must have landed**: the module barrel, the shared list types and the grouping helpers this
  surface reads are created there, and a to-do row's group is a category record after that stage.
  Wave 3 closes before wave 4 opens.
- **No package is missing**, and none is installed. `vaul`, `radix-ui`, `date-fns` and `motion` are
  all pinned.
- **§7.2 does not apply**, and this stage is the one in the file where it would have if anything did,
  because it is the one that prints dates. The measurement stands — a `grep -rn` for `Intl.` over
  `src/components/modules/lists/` and the lists route returns nothing — and this stage adds no `Intl`
  construction: every due date goes through `formatDate` in
  `src/lib/format.ts`, which answers from the frozen CLDR table for exactly this reason.
- **§7.1 does not apply either**, and the check is worth stating because it is close: that section is
  blocking for a stage baselining a screen that prints a `formatRelative` string, and
  `grep -rn formatRelative src/` returns only `/notifications`, `/admin` and the definition. This
  stage prints absolute dates and a server-computed boolean, and no `formatRelative` call site.
- **§7.3 applies**, as everywhere.
- **The fixture edit is the one risk this stage carries into other people's work.** It changes seeded
  data every other spec runs against. The measurement above says no baselined route reads a packing
  row; the stage still runs the full suite and reports both counts, and treats an unexpected
  difference as a finding rather than as something to absorb with `--update-snapshots`.

## Stage 05-S5 — Who a row is for, and who else said they would bring it

### Stage id

`05-S5` · Wave 5 · effort **L**. The last stage in this file, and the only one whose correctness
depends on another plan's record.

### Reference rows

- `LST-02` partial → **done**, with the guest bringer deferred and its follow-up named below.

Sourced from `wiki: Packing-Sharing` for the three audiences a row can have, the two counted views
that separate the group's pool from the reader's own, the rule that a row inherits the audience of the
view it was created in, the rule that only the person bringing a row may change who it is for, the
badge that says who is bringing something, the pledge another traveller can make against a pooled row,
and the copy that lifts a pooled row onto a reader's own list as a private duplicate.

**What exists.** `packing_lists.owner_user_id` is nullable and is documented in the schema itself as
"`null` means the list is shared by the whole trip rather than owned by one traveller"
(`src/server/db/schema.ts:888-889`), and `matchesOwner` in
`src/components/modules/lists/list-utils.ts:66` already filters a board by
`everyone | shared | mine`. That is the same idea one level too coarse: it is a property of a **list**,
and the thing a traveller wants to keep private is a **row**.

**What is missing** is the row-level audience, the explicit audience membership, the pledge, the two
counted views and the copy action.

**The dependency on trip membership, named because this stage cannot be scheduled ahead of it.**
`TRP-11` — the trip members panel and guest participants — is `01-S6` in
`docs/plans/01-trips-core.md`, **wave 4**, and it is in `LST-02`'s own `dependsOn` alongside `LST-01`.
This stage is wave 5 and therefore sits behind it, which is not a coincidence: an audience is a set of
trip members, `01-S6` is where `listTripParticipants` is defined as the one read model every
participant picker in the product consumes, and building a second membership read here would be the
duplicate that read model exists to prevent. This stage consumes `listTripParticipants` and adds no
membership query of its own. If `01-S6` has not landed, this stage is blocked rather than adapted.

**The guest bringer, deferred with its reason.** `01-S6` hands three plans the job of linking guest
participants into their own surfaces and names this file for packing. A guest has no account and no
session, so a guest can never be an **audience** member — there is nobody to show the row to — but a
guest can perfectly well be the person **bringing** something. The additive shape is one nullable
`assigned_guest_id` column on `packing_items` with a repository rule that at most one of
`assigned_to` and `assigned_guest_id` is set. This stage **does not** ship it: the audience model is
about visibility, the guest link is about attribution, and folding a second concept into an already-L
stage is how both arrive half-done. It is filed as a follow-up row against `01-S6`'s hand-off, and the
picker this stage builds takes its options from `listTripParticipants`, which already returns guests,
so the surface will not need re-shaping when the column lands.

**Rows unblocked:** none. `LST-02` is the last row in this area.

### Owned paths

- `src/server/repos/lists.ts` — edit. The audience writers and the visibility read. Held by `05-S1`
  (wave 3) and `05-S3` (wave 4) before this.
- `src/server/repos/__tests__/lists-sharing.test.ts` — new.
- `src/server/fns/lists.ts` — edit. Four server functions and the inherited audience on create. Held
  by `05-S1` (wave 3) and `05-S4` (wave 4) before this.
- `src/routes/_app/-server/trip.ts` — edit. The audience fields and the two view counts. Held by
  `07-S2` (`07-collaboration-and-sharing.md`, wave 1), `03-S2` (`03-reservations-and-transport.md`,
  wave 2) and `05-S1` (wave 3) before this, each in its own wave.
- `src/components/modules/lists/share-audience-popover.tsx` — new.
- `src/components/modules/lists/item-row.tsx` — edit. The audience control, the bringer badge, the
  pledge and the copy action. Created by `05-S1` (wave 3), also held by `05-S3` (wave 4).
- `src/components/modules/lists/list-toolbar.tsx` — edit. The two counted view pills. Created by
  `05-S1` (wave 3), also held by `05-S2` (wave 4).
- `src/components/modules/lists/list-utils.ts` — edit. The bucketing, beside `matchesOwner`. Also
  held by `05-S1` in wave 3.
- `src/components/modules/lists/__tests__/list-utils.test.ts` — edit. Also held by `05-S1` in wave 3.
- `src/components/modules/lists/types.ts` — edit. Held by `05-S1` (wave 3) and `05-S3` (wave 4).
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/packing-and-todos.visual.spec.ts` — append.
- `e2e/__screenshots__/packing-and-todos.visual.spec.ts/` — append.

No route file is added, so `pnpm generate-routes` is not one of this stage's steps and
`src/routeTree.gen.ts` is not listed.

### Data and migration

**One additive column and two additive join tables, filed as a requirement for the wave-5 schema stage
in `00-foundations.md`. This stage does not edit `src/server/db/schema.ts`.**

`packing_items.audience` — `text`, **not null, default `'everyone'`**, holding one of
`everyone · only_me · chosen`. Three notes, all of them decisions rather than details:

1. **The enum is enforced in the repository's Zod input, not by a CHECK.** Adding a table-level CHECK
   to a shipped SQLite table makes drizzle-kit emit a full rebuild — `drizzle/0001_aspiring_cargill.sql`
   is the standing evidence — and the migration ritual in `00-foundations.md` explicitly prefers the
   Zod guard for exactly this case. Every other enum column in this schema was CHECK-constrained at
   creation, which is why they could be.
2. **The default makes the backfill unnecessary.** Every existing row becomes `everyone`, which is
   what every existing row already is in practice, so the migration backfills nothing and a rollback
   is safe: the previous Worker never reads the column.
3. **The generated SQL is read before it is applied.** The wave-5 schema stage confirms it is
   `ALTER TABLE … ADD COLUMN` and not a `__new_*` rebuild, per step 2 of the ritual.

`packing_item_viewers` — the explicit audience of a `chosen` row: `id`, `organization_id`, `item_id`
→ `packing_items.id` `ON DELETE CASCADE`, `user_id` via `userRef()`, `created_at`. Indexes
`packing_item_viewers_org_idx` on `(organization_id, item_id)` and a unique
`packing_item_viewers_unq` on `(item_id, user_id)`.

`packing_item_helpers` — the pledges: the same five columns, `packing_item_helpers_org_idx` on
`(organization_id, item_id)` and a unique `packing_item_helpers_unq` on `(item_id, user_id)`. A
person can pledge once; the unique index is what makes that true rather than hoped.

**`assigned_to` is the bringer, and no second owner column is added.** `packing_items.assigned_to`
already exists (`schema.ts:922`) and already means "the person this row is on". Adding an `owner`
beside it would create two columns that answer the same question and would immediately disagree. The
consequence is stated rather than hidden: **re-assigning a row transfers the right to change its
audience**, which is the correct reading — the person carrying the thing decides who it is for — and
a row whose `assigned_to` is null (every row created before this stage) has no bringer, shows no
bringer badge, and its audience is changeable by any trip editor. That null case is the legacy shape
and the surface tolerates it by design.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/lists.ts`, edit**, two new `createTenantRepository` handles for the
join tables plus:

- `listVisibleItems(scope, listId, viewerUserId)` — the visibility query, and the one piece of SQL in
  this stage that has to be exactly right. A row is visible when its `audience` is `everyone`; or its
  `assigned_to` is the viewer; or its `audience` is `chosen` and a `packing_item_viewers` row pairs it
  with the viewer. Built with `tenantFilter()` and an `or()` over those three, with the viewer
  membership resolved before the query runs.
- `itemViewBuckets(scope, tripId, viewerUserId)` — the two counts the view pills show, as one grouped
  aggregate over the trip rather than one query per bucket. **Pool** is rows whose audience is
  `everyone`. **Mine** is rows the viewer brings, rows shared explicitly with the viewer, and the
  viewer's own `only_me` rows. A row can be in both, and the pills say so rather than pretending the
  two partition the list.
- `setItemAudience(scope, itemId, audience, userIds)` — resolves the item in the caller's scope,
  applies the bringer rule below, validates every id in `userIds` against the trip's participants via
  `listTripParticipants` (`01-S6`), then replaces the `packing_item_viewers` rows in one batch.
  Moving away from `chosen` deletes the viewer rows in the same batch, so a row that returns to
  `chosen` later never inherits a stale audience.
- `toggleItemHelper(scope, itemId, isHelping)` — inserts or deletes one pledge row for the caller.
  The caller is always `scope.ctx.userId`; **the function takes no user id from its caller**, so
  pledging on someone else's behalf is not expressible rather than merely forbidden.
- `copyItemToViewer(scope, itemId, listId)` — reads the source row, then inserts a **new** row with a
  new id, `audience: 'only_me'`, `assigned_to` set to the caller, `is_done` false and `done_at` null,
  and no viewer or helper rows. It is a duplicate, not a reference: the source is untouched and
  nothing links the two, which is what makes the source's later deletion harmless.

**The bringer rule, decided in the repository.** `setItemAudience` succeeds when the caller is the
row's `assigned_to`, **or** when `assigned_to` is null. Any other case raises the repository's
authorisation error. A viewer of a `chosen` row may tick it done and may pledge against it; they may
not re-share it. That is a second, row-level check on top of the trip-level one, and the repository is
the only place it lives — a check in the handler alone would be reachable around.

**Server functions — `src/server/fns/lists.ts`, edit.** Four, all `POST`, all opening with
`appScope()` then `requireTrip`:

| Function             | Returns                              | Notes                                                    |
| -------------------- | ------------------------------------ | -------------------------------------------------------- |
| `setItemAudienceFn`  | `{ itemId, audience, viewerCount }`  | The bringer rule is enforced in the repository, not here |
| `toggleItemHelperFn` | `{ itemId, helperCount, isHelping }` | Takes no user id; the caller is the pledger              |
| `copyItemToMyListFn` | `{ itemId }` — the **new** row's id  | Returns the copy so the surface can scroll to it         |
| `setItemBringerFn`   | `{ itemId, assignedTo }`             | Validated against `listTripParticipants`                 |

All four mirror with `patch('trip', data.tripId, { listsChangedAt: Date.now() })` and declare no new
entity kind; `src/server/do/protocol.ts` is not edited.

**Audience inheritance on create, at the boundary.** `createListItemFn` gains an `audience` field
defaulting to `everyone`, and the board sends the audience of the **view the row was created in** —
a row added while reading the pool is pooled, a row added while reading the reader's own list is
`only_me` with the reader as its bringer. The inheritance is a client-supplied value and is therefore
validated like any other input and constrained by the same repository rules; the server never trusts
it to imply a permission.

**No notification.** Category assignment notifies (`05-S1`); changing a row's audience does not, and
the separation is deliberate: an audience is a visibility decision the reader discovers when they next
look at their list, and a notification for every audience change would make the packing screen the
loudest surface in the product. `dispatch` is not called by this stage.

**Zod v4.** `z.strictObject()` on every input; `audience` as `z.enum(['everyone','only_me','chosen'])`
with an `error`; `userIds` as `z.array(rowId).max(50)`; `isHelping` as `z.boolean()`. Validation is
shape. The bringer rule is authorisation and lives in the repository.

**Loader — `src/routes/_app/-server/trip.ts`, edit.** `loadTripLists` returns each item's `audience`,
its bringer, its viewer ids when the reader is entitled to see them, and its helper count and helper
names; and the payload gains the two bucket counts. The viewer ids of a `chosen` row are returned only
to the bringer — a viewer sees "shared with you", not the whole audience, because the list of who else
was chosen is not theirs to read.

### UI (route, components)

**Route.** None added, none edited by this stage.

**Components.**

- `list-toolbar.tsx` gains the two counted view pills, `Chip`s in their `selected` variant with
  `CountBadge`s, both figures in `tabular-nums`. The existing `matchesOwner` list filter
  (`list-utils.ts:66`) stays and is not duplicated: it filters **lists**, the pills filter **rows**,
  and the toolbar keeps them visually distinct so the two are never read as one control.
- `item-row.tsx` gains, in this order: the bringer's `Avatar` with a "+N" when there are pledges; an
  audience control that is a share glyph for the bringer and a lock glyph for an `only_me` row; and,
  on a pooled row somebody else brings, two actions in place of the audience control — a pledge toggle
  and a copy action.
- `share-audience-popover.tsx` — the audience chooser: the three options as a `RadioGroup`, and, when
  `chosen` is selected, a `MultiCombobox` of trip participants underneath. **When the reader is the
  only person on the trip, `chosen` renders a one-line explanation and the picker is not shown** — an
  empty member picker is a dead end that looks like a bug.

**Primitives reused:** `Popover`, `RadioGroup`, `MultiCombobox`, `Chip`, `CountBadge`, `Badge`,
`Avatar`, `AvatarStack`, `Button`, `IconButton`, `Tooltip`, `Separator`, `ScrollArea`, `Sheet` for the
360px form of the popover, `EmptyState`, `Skeleton`, `Alert`, `toast`. No new primitive, so nothing is
filed against `src/components/ui`.

**States.**

- **Pool empty** (every row is personal): `EmptyState` on `--color-surface-2`, heading "Nothing in the
  shared pool", body "Rows you add here are visible to everyone on the trip.", with a secondary action
  switching to the reader's own view.
- **Mine empty:** heading "Nothing on your list yet", body "Add something private, or pick up
  something from the shared pool.", with an action switching to the pool.
- **Solo trip:** inside the audience popover, a single line — "Invite someone to the trip and you can
  share a row with them" — with a link to the trip's people surface, which `01-S6` ships. Not an
  error, not a disabled control with no explanation.
- **Skeleton:** the two pills render their counts as `Skeleton` pills at the real width so the toolbar
  does not resize when the payload lands.
- **Error:** a failed audience change rolls the control back and raises a `toast` naming the reason;
  a `403`-shaped failure says "Only the person bringing this can change who it is for" rather than
  "Forbidden".
- **Loading:** the audience control is `disabled` with a `Spinner` while its write is in flight; the
  pledge toggle shows its pending state in place of its icon and keeps its label, so its width does
  not change and the row does not reflow.
- **Legacy row** (no bringer): no badge, and the audience control is available to any trip editor with
  a `Tooltip` saying nobody has claimed the row yet. Tolerating null is a designed state here, not a
  fallback.

**Interaction states** — hover, `focus-visible`, active, disabled, loading — on both view pills, the
audience control, all three radio options, the participant picker and each of its options, the pledge
toggle, the copy action, and the bringer picker.

**Keyboard.** The popover traps focus, is closed by Escape and returns focus to the control that
opened it; the radio group is arrow-navigable; the participant picker is a combobox with the
`aria-activedescendant` behaviour `MultiCombobox` already implements. The pledge toggle is a real
button with `aria-pressed`, so its state is announced rather than implied by its label.

**Motion.** The popover uses the primitive's 220ms enter and 150ms exit on `--ease-out-quint`; a row
leaving the current view because its audience changed fades over `--duration-fast` rather than
vanishing; the pledge badge's "+N" crossfades. `prefers-reduced-motion: reduce` reduces all three to
opacity.

**Responsive.** 360px: the popover becomes a bottom `Sheet`, and the row's three trailing controls
collapse into a `ContextMenu` reached by long press, because three tap targets plus a checkbox plus a
quantity do not fit a 360px row without shrinking every one of them below the 24×24 CSS-pixel target
size WCAG 2.2 AA asks for. 1280px and 2560px: all controls inline, revealed on hover and always
present to the keyboard — a control that only exists on hover is invisible to a keyboard user, so the
hover treatment is opacity, never mounting.

**Tokens.** Nothing new. Every count carries `tabular-nums`.

### Quota

**No countable row and no `assertQuota` call site**, for the reason recorded at plan level. Audience
and pledge rows are join rows in tables that are none of `USAGE_METRICS`.

Two bounds are enforced in the repository instead: an audience is capped at 50 viewers per row, which
is the same `z.array(rowId).max(50)` the input carries and is re-asserted on the repository side; and
`copyItemToViewer` counts against `MAX_ITEMS_PER_LIST` from `05-S1` before it inserts, because a copy
is a real row and a copy loop is the cheapest way to fill a list.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block,
`'packing item sharing'`.

Covered: `listVisibleItems` and `itemViewBuckets` in A's scope over B's `listId` and B's `tripId`
return nothing; `setItemAudience` with B's `itemId` is a `NotFoundError`; `setItemAudience` on A's own
item with a `userId` who is only a member of B's trip is rejected, and no `packing_item_viewers` row
is written — a silently dropped viewer is indistinguishable on screen from a successful share;
`toggleItemHelper` with B's `itemId` is a `NotFoundError`; `copyItemToViewer` with B's `itemId` is a
`NotFoundError` and writes no row into A's list, and with A's item into B's `listId` is a
`NotFoundError` and writes no row into B's list; `setItemBringer` with B's `itemId`, and with A's item
and a `userId` belonging only to B, are both rejected. Afterwards
`packingItemsRepository.count(beta.scope)` is unchanged and B's item's `audience` is re-read and found
`everyone`.

The bringer rule gets its own cases in `src/server/repos/__tests__/lists-sharing.test.ts` rather than
here, because it is authorisation **within** a tenant and belongs with the other same-tenant rules.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests.**

- `src/server/repos/__tests__/lists-sharing.test.ts` — the visibility query returns exactly the three
  cases and nothing else, asserted from both a bringer's and a viewer's point of view over the same
  fixture; a non-bringer cannot change an audience; a bringer can; a row with a null `assigned_to` can
  be changed by any trip editor; moving from `chosen` to `everyone` deletes the viewer rows; a pledge
  is idempotent and `toggleItemHelper` never writes a second row; a copy is a new row with a new id,
  `only_me`, the copier as bringer, not done, and the source is byte-for-byte unchanged; the two
  bucket counts add up to more than the row count when a row is both pooled and the reader's, which is
  asserted deliberately so a later "simplification" into a partition fails the test.
- `src/components/modules/lists/__tests__/list-utils.test.ts` — extended: the bucketing helper agrees
  with the repository's rule for every combination of audience, bringer and viewer membership, so the
  client's pills can never disagree with the server's rows.

**Playwright**, with `PLAYWRIGHT_BASE_URL` always passed:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/packing-and-todos.visual.spec.ts
```

The `describe` block is named `05-S5` and appended. `watchConsole` is attached before every navigation
and `fatal` is asserted empty in every test. `TOLERATED_CONSOLE_WARNINGS` is not extended. The route
table's declarations are unchanged, and `auditServerClock()` still runs once.

**Frames.** The resting board set, plus three declared sets:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/lists" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/05-S5" \
  --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth \
  --state audience --click '[data-part="item-audience"]'
```

and again with `--state my-list --click '[data-part="view-mine"]'` and with
`--state pledged --click '[data-part="item-pledge"]'`. The 360px audience set is the one that judges
the sheet form and the collapsed row controls, and it is required rather than optional. The three
`data-part` selectors are published by this stage and each is verified with
`await page.locator(sel).count()` returning 1 against a running server before `capture.mjs` runs;
the counts go in the evidence.

The solo-trip empty state inside the popover is reached in the spec against a trip with one member,
which the seeded dataset already contains; the stage names which trip it used.

`PT_SERVER_TODAY=2026-08-20` is `BASELINE_DAY`. The trip id is resolved at runtime, never hard-coded.

**Layout shift.** Zero after the settle mark, including across a view-pill switch and across opening
the popover. An init-script `PerformanceObserver` for the `layout-shift` entry type, `hadRecentInput`
entries excluded, gated on `PerformanceObserver.supportedEntryTypes`; the WebKit reading is reported
as a skip, never as a pass.

**Console must be silent.**

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply without amendment:

1. `pnpm build` succeeds.
2. `pnpm lint` and `pnpm typecheck` are clean — no new errors, no suppressions.
3. New logic has tests; `pnpm test` passes.
4. The feature is visually verified in a real browser, light and dark, desktop and mobile.
5. No TODOs, no placeholder copy, no `console.log`, no commented-out code left behind.
6. You did not touch files outside your assigned ownership.

On top of those, for every surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state on `--color-surface-2`, a skeleton loading state and an
      error state — and the pool-empty and mine-empty messages are distinct.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop, and
      every tap target at 360px is at least 24×24 CSS pixels.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes — and every hover-revealed control is reachable by keyboard.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **`TRP-11` / `01-S6` (`docs/plans/01-trips-core.md`, wave 4) must have landed.** This stage consumes
  `listTripParticipants` as the one participant read model and writes no membership query of its own.
  Wave 4 closes before wave 5 opens, so the ordering holds; if the stage is scheduled early it is
  blocked, not adapted.
- **`05-S1` must have landed** — the item row, the toolbar and the shared types are created there.
- **The wave-5 schema stage must have landed**, carrying `packing_items.audience`,
  `packing_item_viewers` and `packing_item_helpers`. The requirement is filed above and the module is
  not edited here.
- **The guest bringer is deferred, not dropped.** One nullable `assigned_guest_id` column plus a
  repository rule, filed as a follow-up against `01-S6`'s hand-off for the reason given under
  **Reference rows**. Nothing in this stage assumes it, and the participant picker already renders
  guests from `listTripParticipants`, so landing it later changes a column and not a surface.
- **No package is missing**, and none is installed.
- **§7.2 does not apply**, on the measurement `05-S1` records. **§7.3 applies**, as everywhere.

## Cross-plan collisions

Run at the end of writing this file, over the twelve plan files present in `docs/plans/` at that
moment, pasted verbatim:

```
$ node scripts/ultrabuild/check-plan-collisions.mjs 05
plans 13 · stages 80 · owned paths 498

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (2) — legal; each plan must name the other:
  src/routes/_app/-server/trip.ts
      03-reservations-and-transport.md  03-S2  wave 2  (edit)
      05-packing-and-todos.md  05-S1  wave 3  (edit)
      05-packing-and-todos.md  05-S5  wave 5  (edit)
      07-collaboration-and-sharing.md  07-S2  wave 1  (edit)
  src/routes/_app/-lib/notifications.ts
      05-packing-and-todos.md  05-S1  wave 3  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
```

The script exits `0`.

**No same-wave exclusive collision involves this plan, and reaching that changed one stage.** The
first run of the check reported exactly one:

```
SAME-WAVE EXCLUSIVE COLLISIONS (1) — these clobber each other:
  src/routes/_app/-server/trip.ts   [wave 4]
      05-packing-and-todos.md  05-S3  (edit)
      06-documents-and-media.md  06-S6  (edit)
```

`05-S3` was extending `loadTripLists` with each item's bag; `06-S6` was extending `loadTripFiles` with
each file's links; both are wave 4 and both are in the same module. `05-S3` now takes a route-local
read path instead — `src/routes/_app/trips/$tripId/-server/bags.ts`, a `new` file nobody else claims
— and the design consequence, a second request whose space is reserved from first paint, is stated
under that stage's **Owned paths** and **UI** headings rather than buried. `06-documents-and-media.md`
was being written at the same time and backed off the same file independently, so the pair no longer
appears in the output above; the repair is recorded here because a reader who only sees the clean
output would otherwise have no way to know why `05-S3` reads its own data.

**Both cross-wave paths are named in the stages that own them**, which is the rule for a path more
than one plan touches:

- `src/routes/_app/-server/trip.ts` — four claims in four different waves: `07-S2`
  (`07-collaboration-and-sharing.md`, wave 1), `03-S2` (`03-reservations-and-transport.md`, wave 2),
  `05-S1` (wave 3) and `05-S5` (wave 5). Both of this plan's stages name all three siblings under
  **Owned paths**. Waves are sequential, so each edit starts from the landed previous one, and this
  module is the clearest case in the whole plan set for why the wave column has to be stated: it is
  one file that five stages want and that no two of them may hold at once.
- `src/routes/_app/-lib/notifications.ts` — held by `09-S7` (`09-account-and-settings.md`, wave 2) one
  wave before `05-S1`, which adds one catalogue entry beside the ones `09-S7` leaves and names it.

**Every stage of this file states its wave**, in the form the script parses. None of the five is in
the wave-less list:

| Stage   | Wave | Effort | Row      |
| ------- | ---- | ------ | -------- |
| `05-S1` | 3    | M      | `LST-01` |
| `05-S2` | 4    | S      | `LST-04` |
| `05-S3` | 4    | M      | `LST-03` |
| `05-S4` | 4    | M      | `LST-05` |
| `05-S5` | 5    | L      | `LST-02` |

The four stages the script cannot check all belong elsewhere: `11-S1`, `11-S2` and `11-S3` are the
register plan's, and that `04-S2` is not `04-budget-and-currencies.md`'s — which states `Wave 1` and
parses — but the illustrative `## Stage 04-S2` heading inside the code fence at
`12-verification-protocol.md:26`, which the script reads as a real heading because it cannot tell a
fenced example from one.

One run in between listed a fifth, `order`, which was never a stage: the script splits on `## Stage `
and a sibling plan briefly carried a `## Stage ordering` prose heading. It is worth knowing that the
parser reads a prose heading beginning with those two words as a stage with no wave, because the
symptom is an unexplained entry in that list rather than an error.

**Two things the output cannot say, said here instead.**

1. **The header counts will not reproduce.** They read `plans 8 · stages 48 · owned paths 284` when
   this file was started, `plans 12 · stages 71 · owned paths 448` twenty minutes later, and
   `plans 13 · stages 80 · owned paths 498` on the run pasted above, because five sibling plans were
   being written by other agents in the same window — `03-reservations-and-transport.md`'s claim on
   the trip loader appeared between two of those runs. The counts are a snapshot of a set several runs
   are still writing. The three findings under them are properties of **this** file's ownership and
   hold until a sibling changes what it claims.
2. **A clean result is perishable, so re-running it is part of this plan's gate.** The stage that
   executes any part of this file runs `node scripts/ultrabuild/check-plan-collisions.mjs 05` first,
   reads the same three things — no same-wave line involving `05-*`, every cross-wave path named in
   its owning stage, no `05-*` stage in the wave-less list — and treats a new same-wave line as a
   blocker rather than as a note. It is one command and it is not optional.
