# Packing groups become records, and a new list stops being empty

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **Status**         | ready                                      |
| **Issue**          | none                                       |
| **Spec PR**        | #846                                       |
| **Implementation** | none                                       |
| **Plan**           | 05-S1 (docs/plans/05-packing-and-todos.md) |

## 📝 TLDR

Plan stage `05-S1` closes reference row `LST-01` (`partial` → `done`). Today the heading a packing
item sits under is a free-text column, `packing_items.category`: it has no identity, so a heading
cannot be renamed without rewriting every row that spells it, cannot be deleted as a unit, and
cannot be given to anyone. This spec turns the heading into a **group**: a row in a new table, with
a name, an order and, in the last phases, people. A list that nobody has written to keeps working
exactly as it does today (its string headings render read-only, with one button that converts them),
and a new packing list can start from a starter set instead of an empty page.

Seven phases, each one a complete path a traveller can use: split the 1 185-line board and retire
its second weight formatter (no schema); groups as records with create, rename, delete and the
item dialog's group select (the migration); "Move to" and a composer inside each group; fold, order
and tick a group; the starter set; who a group is for, with the notification; the packing trip copier.

**What a traveller calls it.** The product says **group** (a heading with its rows under it). The
engineering names are the plan's: table `packing_categories`, functions `…ListCategory…`, because
five stages in `docs/plans/05-packing-and-todos.md` and the schema of places and expenses already
use "category" for other things, and the plan's cross-stage contract is spelled with it. No
catalogue string says "category" for a packing group (`lists.item.dialog.body`, which still says "a
category groups the list", is reworded in Phase 2, see Copy).

This spec describes the work that is **left** at HEAD (`9a2f4f0e`) and departs from the stage block
in the places where the plan predates the code, an ADR or a specialist's read. Every departure is a
row of the Resolved assumptions table; the long ones are explained where they bite.

## 📝 Problem Statement

What exists (`LST-01` is `partial`):

- `packing_items.category` is `text('category')` with no table behind it. `groupByCategory`,
  `progressOf`, `selectAllState`, `matchesFilter` and `knownCategories` are in
  `src/components/modules/lists/list-utils.ts` with tests; `setListItemsDoneFn` already ticks in
  bulk and `reorderListItemsFn` reorders. The board's per-list `mode` toggle shows the string
  headings as read-only `<h3>`s (grouped) or one draggable flat order (order); the item dialog has a
  free-text "Category" input with a datalist; the inline composer adds loose rows.
- `applyTemplateToTrip` (`src/server/repos/lists.ts`) is **reachable today**: the board's
  "From a template" button opens `TemplateDialog`, which calls `applyListTemplateFn`. Its module
  docstring says the copy is "a single batch"; it is two awaited writes (a list insert, then
  `insertMany`).
- `registerTripCopier(name, fn)` exists (`src/server/repos/trips.ts`) and `copyTripContents` in the
  same file runs every registered copier, but nothing registers a packing copier, so a trip copy carries no list although
  `CONTEXT.md` ("Trip copy") says it does.
- `lists-board.tsx` declares its own `formatWeight` (`.toFixed(1)`, no locale) beside the shared
  `src/lib/format.ts` one, so the same screen prints a 2 000 g pack as `2.0 kg` in the panel and as
  `2 kg` in the card above it.

What is missing:

- A group with an identity: nothing can rename, delete, order or assign one, and a heading typo is
  fixed today only by retyping the string on every row.
- Anything to start a new list from: every packing list opens empty.
- A packing copier, and a seed that produces groups rather than strings.

Why it matters: packing is where a shared trip is used on a phone in a hallway. A group is the unit a
traveller thinks in ("Toiletries is Jonas's"), and the plan's four later stages (`05-S2`..`05-S5`)
all hang on it: templates, bags, to-dos and bringers each need a group they can name.

## 📝 Proposed Solution

### What the stage owns and what it does not

Owns: the group record and its writers; the move of every writer of `packing_items.category` onto
the record (item writers, `applyTemplateToTrip`, `createTemplateFromList`, the dev seed); the
adoption of existing string headings; the loader payload and the grouped screen; the starter set;
group assignees and their notification; the packing trip copier; the split of `lists-board.tsx` and
the retirement of its `formatWeight`.

Does not own: template naming, sharing or the library surface (`05-S2`); bags and weights per bag
(`05-S3`); to-do due dates and the to-do copier (`05-S4`); the per-item bringer and guests
(`05-S5`); realtime sync of the lists tab (the mirror stays write-only, see "Realtime"); a drag of
a row between groups (the menus are the accessible path; drag can be added later with no schema
change); a role or archive guard on the **existing** list and item writers (named as follow-up F1).

Departures from the plan's owned-path list, so a collision check does not flag them: the plan names
`src/routes/_app/-lib/notifications.ts` (does not exist; the stored copy is `shell.notification.*`
in the 23-locale catalogue, Phase 6), `e2e/packing-and-todos.visual.spec.ts` and its baseline
directory (ADR 0016 removed both, Verification), and says the stage "does not edit `schema.ts`"
and files its tables with a wave-3 schema stage in `00-foundations.md` (no such ticket exists;
recent specs own their schema, e.g. `2026-10-04-change-a-trips-accounting-currency.md`). This stage
**owns its migration**.

### The model

One generated migration (Phase 2), additive, three pieces; `pnpm db:generate` mints the file and
nobody numbers or edits it (the plan's `0003_*` is stale: HEAD is `0015`):

`packing_categories` — a group belongs to one list of one trip.

| Column                     | Type                        | Null     | Notes                                                                                            |
| -------------------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `id`                       | `text` PK                   | not null | `pk()`                                                                                           |
| `organization_id`          | `text`                      | not null | `orgRef()`, `ON DELETE CASCADE`                                                                  |
| `trip_id`                  | `text` → `trips.id`         | not null | `ON DELETE CASCADE`                                                                              |
| `list_id`                  | `text` → `packing_lists.id` | not null | `ON DELETE CASCADE`                                                                              |
| `name`                     | `text`                      | not null | trimmed; 1 to 60 on create and rename, up to 200 when adopted or applied from a template (below) |
| `sort_order`               | `real`                      | not null | `sortOrder()`                                                                                    |
| `created_at`, `updated_at` | `integer` timestamp_ms      | not null | `timestamps()`                                                                                   |

Indexes: `packing_categories_org_trip_idx (organization_id, trip_id)`,
`packing_categories_list_sort_idx (list_id, sort_order)`, and the unique
`packing_categories_list_name_unq (list_id, name)`. No `CHECK` (no enum column). The unique index
uses SQLite's default `BINARY` collation, so it distinguishes `Tech` from `tech`; the repository
therefore refuses a name that matches an existing one under `lower()` first (ASCII-only folding,
SQLite's `lower`), and the index is the backstop for an exact duplicate raced by two requests. No
`colour` column (the plan has one; nothing in any stage lets a traveller choose it, and a nullable
column is additive whenever a stage needs it), and no `is_collapsed` column (collapse is not stored,
below).

`packing_category_members` — who a group is for. Created in the same migration, **read by nothing
until Phase 6**; one migration instead of two is the architect's call, because an inert table costs
less than two reviews of `drizzle/`.

| Column            | Type                             | Null     | Notes                                            |
| ----------------- | -------------------------------- | -------- | ------------------------------------------------ |
| `id`              | `text` PK                        | not null | `pk()`                                           |
| `organization_id` | `text`                           | not null | `orgRef()`, `ON DELETE CASCADE`                  |
| `category_id`     | `text` → `packing_categories.id` | not null | `ON DELETE CASCADE`                              |
| `user_id`         | `text`                           | not null | `userRef('user_id')`, no Drizzle FK as elsewhere |
| `created_at`      | `integer` timestamp_ms           | not null | `createdAt()`                                    |

Indexes: `packing_category_members_org_idx (organization_id, category_id)` and the unique
`packing_category_members_unq (category_id, user_id)`.

`packing_items.category_id` — `text`, nullable, declared `REFERENCES packing_categories(id) ON DELETE
SET NULL`, with `packing_items_category_idx (organization_id, category_id)`. **The declared rule is
not the deployed one:** drizzle-kit's `ADD COLUMN` writes no `ON DELETE` clause, so D1 enforces `NO
ACTION` (the same gap `.ai/specs/2026-09-19-deployed-on-delete-rules.md` records, and the
`DEPLOYED_WITHOUT_ON_DELETE` register in `src/server/db/__tests__/migrations-match-schema.test.ts`
tracks). Nothing in this design relies on `SET NULL`: the delete path clears the column itself
(below). Phase 2 adds `packing_items.category_id` to that register, and the group-delete, list-delete
and trip-delete tests run on `createHarness({ ddl: 'migrations' })`, because a test built from
`schema.ts` would pass where D1 refuses. **No composite foreign key**
`(category_id, list_id)`: `SET NULL` would try to null `list_id`, which is `NOT NULL`, and adding it
would rebuild `packing_items`. That an item's group belongs to the item's list is enforced by the
repository (invariant I2) and tested.

`packing_items.category` is **not dropped, renamed or narrowed.** A rolled-back Worker reads the
string and knows nothing of the new column; keeping it populated is what makes
`docs/ARCHITECTURE.md` §9 row 12 hold. Dropping it is a later migration, after the rollback window, and
is not this spec's to schedule. `packing_template_items.category` is a string too and stays one:
a template is a recipe, and the apply and save-as paths convert (Phase 2).

No backfill, no existing row touched.

### The invariants

- **I1 — the string mirrors the record.** When `category_id` is non-null, `category` equals the
  record's `name`. When new code writes a row with no group, both are null. A row can therefore be
  in exactly three states: on a record (id and name), loose (neither), or **legacy** (a string and a
  null id) — and only a row written before this migration, or by a rolled-back Worker after it, is
  ever legacy. A new write never produces one. Rename rewrites the strings and delete nulls them,
  both in the same batch as the change (below). Without that, a deleted group would reappear as a
  legacy heading and the next adoption would resurrect it.
- **I2 — a group belongs to the item's list, a list to the trip.** Every new repository writer
  (`createListCategory`, `renameListCategory`, `deleteListCategory`, `reorderListCategories`,
  `adoptListCategories`, `assignItemToCategory`, `seedStarterCategories`, `setCategoryAssignees`, and
  and the two item writers `createListItem` and `updateListItem` **on every call, whether or not
  `categoryId` is sent**) **takes the authorised `tripId` as its parameter after `scope`**
  (`createListCategory(scope, tripId, listId, name)`, `adoptListCategories(scope, tripId, listId)`,
  `assignItemToCategory(scope, tripId, itemId, categoryId)`,
  `seedStarterCategories(scope, tripId, listId, groups)`,
  `reorderListCategories(scope, tripId, listId, orderedIds)`, and the rename, delete and assignee
  writers below),
  resolves its parent (the list, the group, the item) in the caller's scope, and raises
  `NotFoundError` when the resolved row's `trip_id` differs from it, **before any write, before any
  adoption and before any membership read**. A writer that sets `category_id` also requires
  `item.listId === category.listId`. A mismatch is `NotFoundError`, never a re-scoped write. **The check is per request, not per row:**
  `reorderListItemsFn` today calls `updateListItem` once per id (up to 500) and would pay a parent read for
  each, about 1,000 statements against the per-invocation limit the Risks section cites. In Phase 2 it
  resolves `listId` in the trip once and writes the order through one new writer,
  `reorderListItems(scope, tripId, listId, itemIds)`, which requires every id to belong to that list and
  writes `sort_order` in one `runBatch`; `updateListItem` is no longer called in a loop.
  Every `scope.db` statement in these batches puts `tenantFilter(scope, table, ...)` in its `WHERE`
  and `organizationId: scope.ctx.organizationId` in its `VALUES`; the rule is stated once here and
  holds for adoption, rename, delete, reorder, assignee replacement, the starter set, template apply
  and the copier alike.
- **I3 — no read writes.** `listListCategories`, `listTripCategories`, `loadTripLists` and every
  `GET` server function issue `SELECT` and nothing else. A write in a loader re-runs on every
  refresh, prefetch and crawl, races itself between two travellers, and would hit the unique index
  from a call site with no user to report to. A test asserts the count of group rows is unchanged
  after the reads over a list full of string headings.
- **I4 — ceilings are repository checks, not quota.** `MAX_CATEGORIES_PER_LIST = 40` and
  `MAX_ITEMS_PER_LIST = 500` are constants in `src/server/repos/lists.ts`, counted in the caller's
  scope before an insert; a breach raises `RepositoryError` with code `LIST_LIMIT`. They are soft:
  two concurrent creates can overshoot by one, and the spec says so rather than claiming the
  database enforces them. There is no `assertQuota` call: a packing row is none of `USAGE_METRICS`,
  and adding a metric rebuilds a table (`usage_records_metric_chk`). `LIST_LIMIT` is not an authored
  error (`src/server/errors/public.ts`), so it reaches the traveller as the caller's fallback; the
  UI therefore stops the action and says why in visible text at the ceiling, and the server check is
  the backstop. Two pure predicates in `list-utils.ts`: `canAddGroup(recordGroups, legacyHeadings)`
  answers "record groups plus distinct legacy headings plus one is at most 40", because
  `createListCategory` adopts first (so a new name cannot collide with a legacy heading of the same
  spelling) and can therefore hit the ceiling below 40 record groups; `canAdoptHeadings(recordGroups,
legacyHeadings)` answers "record groups plus distinct legacy headings is at most 40" and drives the
  "Make them groups" button's reason (no extra one: converting is legal at exactly 40). Both have
  boundary tests at 39, 40 and 41.
- **I5 — collapse is not stored.** It is a per-reader view preference kept in the browser (below);
  there is no column, no server function, no mirror.

### Adoption: how a string heading becomes a group

`adoptStringCategories(scope, listId): Promise<number>` in `src/server/repos/lists.ts` is the **only**
code that turns a `category` string into a `packing_categories` row. Its callers are all `POST` write
paths that resolved the list through `packingListsRepository.requireById` **and compared its
`trip_id` to the authorised trip (I2)** first: `createListCategory` and `adoptListCategories` (the
guarded wrapper behind the legacy header's "Make them groups" button, Phase 2). `assignItemToCategory`
does **not** call it: moving a row into an existing record group needs no adoption, and adopting
there would silently convert every legacy heading and could fail a plain move with `LIST_LIMIT`. It
has no caller in a read or a loader.

1. **Read**, in JS, built from `tenantFilter()`: the distinct `category` and `min(sort_order)` over
   the list's items where `category IS NOT NULL AND category_id IS NULL`, ordered by that minimum
   (so groups keep the order the traveller was already looking at). A heading that is empty or only
   whitespace after trimming is **not** a heading: the rows stay as they are (loose in the view, the
   string untouched) and no group is made for it. Every other heading is adopted **unchanged**
   (trimmed; up to the 200 characters `shortTextSchema` already allows): the 1 to 60 rule is for
   create and rename only, and a longer legacy name must not make a list un-adoptable.
2. **Check** the ceiling: existing groups plus the distinct strings must not exceed 40, otherwise
   raise `LIST_LIMIT` and write nothing (adoption is all-or-nothing: half a list on records and half
   on strings, indistinguishable on screen, is worse than none).
3. **One `runBatch`** (`src/server/repos/batch.ts`) of statements built from `scope.db`, not from the
   repository handle (a handle awaits immediately and cannot sit in a statement array):
   - the inserts, one row per name, `id` from `newId()` in JS (SQL cannot mint it), `organizationId`
     from `scope.ctx.organizationId` and `tripId` from the resolved list in the same expression that
     builds the row, `sort_order = (the list's largest existing group sort_order, or -1) + 1 + rank`
     with rank by `min(sort_order)` of the heading's rows (so a group that already exists keeps its
     place and the adopted ones follow it), `.onConflictDoNothing({ target: [listId, name] })`,
     chunked at `chunkFor(boundParametersPerRow(packingCategories))` (40 rows exceed D1's 100 bound
     parameters in one statement);
   - one correlated `UPDATE packing_items SET category_id = (SELECT c.id FROM packing_categories c
WHERE c.list_id = packing_items.list_id AND c.name = trim(packing_items.category) AND
c.organization_id = ?)` over the list's rows where `category_id IS NULL AND category IS NOT NULL`,
     under `tenantFilter()`. The tenant predicate inside the subselect is defence in depth (the
     security reviewer's condition); the update reads whichever row won the insert, so no id travels
     back to the Worker between the two writes, and `category_id IS NULL` makes a repeat call match
     nothing. An empty or whitespace-only heading matches no group and keeps a null id.

Two overlapping adoptions converge on the same rows in either order. A list with no string headings
inserts zero rows and updates zero. It returns how many groups it created.

A list nobody has written to is not a stalled migration: it renders as it does today, out of the
string, read-only, with one sentence and one button (UI below). There is no cron, no queue job and
no second repair path; rows a rolled-back Worker writes later are adopted by the same button.

### The writers of `packing_items.category`, all moved

`grep -n "category" src/server/repos/lists.ts` finds the functions below; the fifth caller is outside
the module. After this spec **no code sets the string except the writers in this table, and each
sets it as a mirror (I1).**

| Writer                                                | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createListItem` / `updateListItem`                   | `itemFields` drops `category` and gains `categoryId` (`nullish`; `undefined` leaves group and string alone, `null` clears both). The repository resolves the group (I2) and writes the id and the name together. A legacy item edited without `categoryId` stays legacy. Callers: the server functions, the seed, two test files.                                                                                                                                                                                                                                                                                               |
| `applyTemplateToTrip`                                 | Becomes what its docstring claims. After the template, trip and items are resolved: mint one group per distinct template `category` in `min(sort_order)` order and insert the items with `category_id` **and** the same `category` string, as **one `runBatch`** with the list insert (ids generated in JS). Both ceilings are checked against the template's counts before the batch is built, so a refused apply creates no list. An empty or whitespace-only template `category` makes a loose row (id and string both null); any other is used unchanged, up to 200 characters (the 1 to 60 rule is for create and rename). |
| `createTemplateFromList`                              | Reads each item's heading from its group when `category_id` is set and from the string when it is not, so saving an unadopted list keeps its headings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `seedStarterSet` (Phase 5)                            | Creates the groups, then the items on them, in one batch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| the dev seed `src/routes/api/dev/-seed/apply-trip.ts` | Calls `createListCategory` once per distinct fixture heading, then `createListItem` with the group id. Without this the demo workspace shows only the read-only legacy state, which a fresh write must never produce.                                                                                                                                                                                                                                                                                                                                                                                                           |

`applyTemplateToTrip` corrects the module docstring (`lists.ts`, top) to what it then is. `packing_items`
has 18 columns once `category_id` lands, so `chunkFor` gives 5 rows per statement and a 500-item
template is about 105 statements in one batch (100 item inserts, up to 4 group inserts, one list
insert); that is inside D1's per-invocation allowance on the paid plan, and a test asserts the
statement count at the ceiling is at most 120, so a later column cannot silently push it over.

### Renaming and deleting a group

- **Rename.** `renameListCategory(scope, tripId, categoryId, name)`: resolve (I2), trim, refuse a name
  equal to a sibling's under `lower()`, then one `runBatch`: `UPDATE packing_categories` and
  `UPDATE packing_items SET category = <new name> WHERE category_id = ?` (I1). Renaming is allowed
  whatever is ticked; the plan's "blocked while an item is ticked" is dropped: a group name is a
  heading, not part of a packing record, and the rule would freeze every group from the first tick
  (Resolved assumptions). The dialog checks the trimmed name against the payload's group names **and its legacy
  headings** (same `lower()` folding; `createListCategory` adopts first, and without the legacy check a
  duplicate of a heading would adopt the list and then refuse the name) and against 1 to 60 characters (in both its add and rename forms) **before** it submits, and shows
  `lists.group.error.name` or `.duplicate` as a `Field` error with focus kept in the field; only
  `TripArchivedError` and `TripRoleError` among the repository errors are authored sentences
  (`NotFoundError` stays a diagnostic; `src/server/errors/public.ts`), so a duplicate raced between two tabs reaches the traveller as the
  per-action failure toast, and the repository refusal is the backstop for that race only.
- **Delete.** `deleteListCategory(scope, tripId, categoryId)` returns the number of items it
  released: one `runBatch` of `UPDATE packing_items SET category_id = NULL, category = NULL WHERE
tenantFilter(...) AND category_id = ?` **then** `DELETE FROM packing_categories`. The items stay on
  the list, loose, with the same ids; no tombstone is emitted for them. The first statement is what
  makes the second legal on D1 (the column ships as `NO ACTION`, see "The model"), and clearing the
  string with it is what stops the group resurrecting as a legacy heading (I1). The list-delete and
  trip-delete paths need no change: they remove the items and the groups together through the list's
  `ON DELETE CASCADE`, which the tests prove on the migrated DDL.

### Server functions

`src/server/fns/lists.ts`, all `POST`, `z.strictObject()` inputs with ids as the module's bounded
`rowId`, names `z.string().trim().min(1).max(60)`. Each opens `appScope()` and then the **writer
guard** `writableListsTrip(scope, tripId)`: `requireWritableTrip` then
`assertTripRole(scope, tripId, ['owner', 'editor'])` (the day-notes precedent: a viewer or an
archived trip is refused with its authored sentence). Validation is shape; it decides nothing about
permission. Every repository call resolves its own parent in the caller's scope and compares
`trip_id` to the authorised trip (I2): `requireTrip` alone authorises the trip, and until now nothing
ties a list or item id to it — a member who can read one trip can address a row of a private trip in
the same organisation they cannot see (Risks).

| Function                  | Phase | Returns                    | Mirror                                          |
| ------------------------- | ----- | -------------------------- | ----------------------------------------------- |
| `createListCategoryFn`    | 2     | `{ categoryId }`           | `patch('trip', tripId, { listsChangedAt })`     |
| `renameListCategoryFn`    | 2     | `{ categoryId }`           | trip stamp                                      |
| `deleteListCategoryFn`    | 2     | `{ categoryId, released }` | trip stamp (up to 500 rows change at once)      |
| `adoptListCategoriesFn`   | 2     | `{ created }`              | trip stamp                                      |
| `moveItemToCategoryFn`    | 3     | `{ itemId, categoryId }`   | `patch('packing-item', itemId, { categoryId })` |
| `reorderListCategoriesFn` | 4     | `{ listId }`               | trip stamp                                      |
| `seedStarterSetFn`        | 5     | `{ categories, items }`    | trip stamp                                      |
| `setCategoryAssigneesFn`  | 6     | `{ categoryId, notified }` | trip stamp                                      |

`createListItemFn` and `updateListItemFn` gain `categoryId` in their input and in their existing
`packing-item` patch payload. **It is `.optional()` in both** (every other field of `itemFields` is required, and a tab
loaded before the deploy omits the new one, so a required `categoryId` would fail every item save until
the tab reloads; `BACKWARD_COMPATIBILITY.md` §2): absent leaves the item's group untouched, `''` clears it,
a group id sets it. The old `category` field is still accepted by both functions for one release and
ignored (the group is the only writer of the string, I1), so a stale tab's save neither fails nor
rewrites the heading. **They also become guarded
paths, and so does `applyListTemplateFn`** (it now creates groups, and today it checks `requireTrip`
only): `writableListsTrip` plus the same-trip and same-list checks (`createListItemFn` and
`updateListItemFn` compare the list's or item's `trip_id` to the authorised trip whether or not
`categoryId` is sent, so an editor of one trip cannot touch an item of a private trip in the same
workspace by leaving the field out), because a `category_id` must never be writable through a path that is weaker than `moveItemToCategoryFn` (the security reviewer's
condition). Viewers therefore lose item create and edit and template apply, which they were never
meant to have (`CONTEXT.md` defines a viewer as reading only); ticking, bulk ticking and
deleting stay as they are, and reordering is tied to the trip (I2) but still takes no role check (F1). The board hides those controls from a viewer through `canWrite`
(API Contracts), so a refusal is for a forged call, not for a click.

The mirror follows the plan-level convention that already holds in this module: list-shaped writes
stamp the trip, item-shaped writes address the row. Clients do not consume either yet.

### Group order, collapse and Move to

- **Order.** `sort_order` is `real`; `reorderListCategories(scope, tripId, listId, orderedIds)` requires the
  ids to be exactly the list's groups (set equality, otherwise `NotFoundError`) and rewrites
  `sort_order = index` in one `runBatch` (at most 40 statements). The UI is "Move up" and "Move down"
  in a group's overflow menu, disabled at the ends: keyboard and touch friendly, no drag across
  sections (WCAG 2.2 SC 2.5.7 would demand the non-drag path anyway).
- **Collapse** is per reader, kept in the browser (`localStorage`, keyed by group id, default
  expanded, applied in a layout effect without animation so server and client agree). A shared
  collapse would let one traveller fold another's "Clothing" on their phone, costs a `POST` and a
  rollback toast per tap over hotel wifi, and would be a role-gated write a viewer cannot make. A
  folded header still shows its `done/total`, and the chevron stays available to a viewer (collapse is
  the reader's own). On a slow connection the server-rendered list shows expanded until the script
  loads and the stored fold is then applied; that shift is accepted and recorded (Resolved
  assumptions, F4 is the cookie-read alternative). Disclosure semantics: the toggle is an
  `IconButton` (size `sm` or larger) beside the group name with `aria-expanded` and `aria-controls`
  naming the group's row container; its accessible name does not change with state (one key,
  `lists.group.toggle`, "Items in {name}"); the name stays an `<h3>` under the panel's `h2` (legacy
  headings too) with no control inside the heading element; a folded container is `hidden` (`inert`
  during the exit transition) so no row, checkbox or composer inside it is reachable by Tab or a
  screen reader's cursor; a fold raises no toast, `aria-expanded` is the announcement.
- **Move to** is a `Dialog` titled `lists.item.moveTo.title` that lists the groups and "No group" as
  buttons (one activation commits and closes; no hover submenu, up to 41 options scroll inside the
  dialog). The item's current group is marked with `aria-current="true"` and a visible check, is not
  removed, and takes the initial focus. It is reachable from the row menu, which stays visible on
  every row at every width; a long-press `ContextMenu` offering the same items is **new** in Phase 3
  and duplicates the row menu, never replaces it (neither a keyboard nor a screen reader can
  long-press).

### Who a group is for (Phase 6)

`setCategoryAssignees(scope, tripId, categoryId, userIds)`: resolve the group and its list (I2, the
trip compared **before** the membership read), take the trip from the group's row, read
`listTripMembers`, treat an empty membership as "not your
trip", **reject the whole call** if any id is not a member (a silently dropped assignee is
indistinguishable from a saved one), de-duplicate, cap at 50, replace the join rows in one batch, and
return the ids that were **added**: the caller needs to know whom to notify and re-deriving it from a
diff at the call site is how a notification goes out twice. The validation error is one generic
sentence that does not reveal whether an id exists in the organisation. Guests are not assignable
here (a guest is "a display name only, never a recipient"; `05-S5` owns them).

A traveller who leaves the trip is not cleaned out of `packing_category_members`; every read stitches
only assignees who are still `trip_members` (`removeTripMember` is not this spec's file, and a stale
row is harmless). One consequence is stated rather than hidden: a person who leaves and later rejoins
the same trip finds their old group assignments back, and any later save of that group's people
replaces every row, which clears what is stale.

`setCategoryAssigneesFn` then calls `dispatchQuietly(scope, event, notificationDeps())` once
(`src/server/notifications/dispatch.ts`, the three-argument shape `costs.ts` and `collab.ts` use),
never `notify()` and never its own recipient resolution. The event is
`{ kind: 'list.assigned', scope: 'trip', tripId, entityType: 'packing-category', entityId: categoryId,
actorUserId: scope.ctx.userId, titleKey: 'list.category_assigned', bodyKey: 'list.category_assigned',
audienceUserIds: <the added ids only>, titleParams: { categoryName }, bodyParams: { categoryName, listName,
tripTitle }, actionUrl:
`/trips/${tripId}/lists` }`. `kind` is the preference `eventType`: the settings screen already has an
"Assigned items" row, so opt-out exists with no new row. `actorName` is filled by the dispatcher's
`withActorName`, the actor is removed from the audience by `dispatch`, and the params are names and
never an email (every recipient is a trip member who can already see all three). The stored
sentences are `shell.notification.list.category_assigned.title|body` in the 23 locales, and the
event joins `STORED_EVENTS` in `src/components/layout/__tests__/copy-rules.test.ts` as
`list.category_assigned` (the `titleKey` that `storedKey` resolves; `list.assigned` is already
there). The email envelope id is `notify:<kind>:<categoryId>:<user>`, so re-adding the same person
later writes the in-app row again but does not send a second email. A dispatch failure is logged and
the assignment still succeeds. Each save is one write and one dispatch: the picker commits once when
it closes (below), never per toggle, and at most 50 people can be added, so at most 50 emails.

### The starter set (Phase 5)

`src/lib/lists/starter-set.ts` exports the set as **catalogue keys**, not English: five groups
(documents, clothing, toiletries, tech, health) and four rows each, every row quantity `1` (a count
derived from nights is wrong the moment the dates move, and a copy would carry the wrong number).
The module has no JSX and no server import. The client resolves the keys in the reader's language
(this is what keeps the preview and the insert one source, and what makes a Polish traveller's rows
Polish), previews the set in the empty-list state, and sends `{ listId, groups: [{ name, items:
[{ name, quantity }] }] }` to `seedStarterSetFn`. Zod checks shape and length only; the repository's
`seedStarterCategories` refuses a list whose kind is not `packing` (the button is the only UI guard, a
forged call is stopped here) and a list that already has a group or an item (a second press in the
same tab is a no-op because the button is gone after the first), counts the ceilings before it
starts, creates groups with `onConflictDoNothing` on `(list_id, name)` and items in one batch.
Two presses racing from two tabs can both pass the empty-list check; the loser's items then reference
ids that were not inserted and its batch rolls back atomically on the foreign key, which reaches the
traveller as the failure toast followed by a revalidation that shows the winner's set (not as a quiet
no-op). The names are ordinary user rows; the server does not claim they are canonical. Offered on
lists of kind `packing` only.

The rows: Documents (passport or ID card; tickets and booking confirmations; travel insurance
details; payment cards and some cash), Clothing (underwear; socks; tops; something warm), Toiletries
(toothbrush and toothpaste; deodorant; shampoo and shower gel; sunscreen), Tech (phone charger;
travel adapter; headphones; power bank), Health (regular medicines; pain relief; plasters; hand
sanitiser). A test asserts the five group names are distinct in every locale (the unique index would
otherwise refuse the seed).

### The packing trip copier (Phase 7)

`registerTripCopier('packing', fn)` at the top level of `src/server/repos/lists.ts` (the repository
that owns the tables; the existing test registers the same name and replaces rather than doubles).
For the source trip it copies every list **whose `kind` is not `todo`**, with its groups and items,
to the target with new ids (to-do lists are `packing_lists` rows of `kind = 'todo'`, and
`docs/plans/05-packing-and-todos.md:77` gives their copier, with due dates dropped, to `05-S4`; this
copier neither copies nor deletes one, so the two never fight over the same rows), **ticks
reset** (`is_done` false, `done_at` null), `assigned_to`, group assignees and the list's
`owner_user_id` left empty (a copy is a plan for a journey nobody has packed for, and an owner may
not be on the target trip), `category_id` remapped only through ids created in this run, legacy
string-only items copied as they are. It reads the source through `tenantFilter()` bound to the
source trip, **clears only the target's own non-`todo` list rows first** (the registry's idempotency
contract: the queue may redeliver), chunks at `floor(100 / columns)`, keeps the tenant rule of I2 on
every statement, and returns its `CopierReport`. The trip-copy dialog's sentence ("Days, places and
notes come across…", `shell.copyTrip.carries`) is updated in all 23 locales to name every list that
is copied ("lists (other than to-dos)", because shopping and document lists come across with the
packing ones); `05-S4` updates it again when it adds to-dos. A test covers the boundary: a `todo` list on the source
is not copied, and a `todo` list already on the target survives this copier.

### Alternatives considered, and why they lost

- **Convert silently when a list is first read.** Rejected: a write in an SSR `GET` loader (I3).
- **Convert only through "Add a group".** Rejected as the only path: the only way to rename
  "Clothes" would be to invent a group you do not want just to trigger the conversion. The legacy
  header gets its own button; "Add a group" still adopts.
- **Shared, stored collapse (the plan).** Rejected: see "Group order, collapse and Move to".
- **Rename blocked while an item is ticked (the plan).** Rejected: it freezes every group from the
  first tick; the name is not part of what was packed.
- **A composite foreign key to pin an item to its list's groups.** Rejected: `SET NULL` conflicts
  with `list_id NOT NULL` and it rebuilds `packing_items`; a repository check with tests is enforced
  and reversible without a migration.
- **Starter set as English data.** Rejected: `docs/SPEC.md` §9 forbids hard-coded copy and the rows
  would be English in every locale.
- **Dragging a row between groups.** Deferred: new multi-container drag, and the menus are required
  anyway.

## 📝 Architecture

| Concern                                                        | Owner module (one concept, one owner, `docs/SPEC.md` §8)                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group rows, adoption, ceilings, copier                         | `src/server/repos/lists.ts` (new `packingCategoriesRepository`, `packingCategoryMembersRepository` handles)                                                                                          |
| Table definitions                                              | `src/server/db/schema.ts`, one generated migration under `drizzle/`                                                                                                                                  |
| Write paths and the writer guard                               | `src/server/fns/lists.ts` (`writableListsTrip`)                                                                                                                                                      |
| Loader payload (`categories` per list, `categoryId` per item)  | `loadTripLists` in `src/routes/_app/-server/trip.ts`                                                                                                                                                 |
| Grouping, legacy ordering, weight sentence, ceiling predicates | `src/components/modules/lists/list-utils.ts` (pure)                                                                                                                                                  |
| Starter set (keys + quantities)                                | `src/lib/lists/starter-set.ts` (no JSX, no server import)                                                                                                                                            |
| Weight and number formatting                                   | `src/lib/format.ts`, the only `formatWeight`                                                                                                                                                         |
| Notification fan-out                                           | `src/server/notifications/dispatch.ts`, called, never reimplemented                                                                                                                                  |
| Screen                                                         | `lists-board.tsx` (grid), `list-panel.tsx`, `category-section.tsx`, `item-row.tsx`, `list-toolbar.tsx` in `src/components/modules/lists/`; `components/ui` never fetches and never imports `server/` |

Reads for the loader: `listTripCategories(scope, tripId)` returns the whole trip's groups in one
query and the members in a second (a join to the groups, `tenantFilter()` on both sides), stitched in
memory the way `listTripListsWithProgress` stitches its counts; the loader issues no query per list.
Grouping stays a pure function keyed by `categoryId` with the legacy string as fallback, so the
board renders per list from one payload (a trip-level `categories` array would split a list's data
across two owners for no gain).

## 📝 Data Model

See "The model". Summary: `packing_categories` (new), `packing_category_members` (new, read from
Phase 6), `packing_items.category_id` (new, nullable, declared `SET NULL`, deployed `NO ACTION`). One additive migration in Phase 2,
generated by `pnpm db:generate`, read before it is applied, never hand-edited. `src/routeTree.gen.ts`
is not touched: no route file is added. Rollback: the previous Worker ignores both tables and the
column and keeps reading `category`, which I1 keeps populated.

## 📝 API Contracts

Server functions as in the table above. Loader payload additions (`ListsPayload`, `ListCard` in
`src/routes/_app/-server/trip.ts`): each list gains `categories: Array<{ id, name, sortOrder,
assigneeUserIds }>` (assignees empty before Phase 6) and each item gains `categoryId: string | null`.
`ListsPayload` also gains `canWrite: boolean`, computed in `loadTripLists` as
`canWritePlan(trip, await tripRoleFor(scope, trip.id, scope.ctx.userId))` (owner or editor, trip not
archived; the day-notes loader's precedent, `trips/$tripId/-server/day-notes.ts`). `ListData` and
`ListItemData` in `src/components/modules/lists/types.ts` gain the category fields, and the board's
props gain `canWrite`, which `lists.tsx` passes from its loader data (`lists.tsx` is therefore an
owned file of Phases 1 and 2). The write guards are the enforcement; `canWrite` only draws the
affordance.

Repository exports (all through the `src/server/repos/index.ts` barrel, whose module table gets the
two new tables): `listListCategories`, `listTripCategories`, `createListCategory`,
`renameListCategory`, `deleteListCategory`, `reorderListCategories`, `adoptListCategories`,
`assignItemToCategory`, `reorderListItems`, `seedStarterCategories`, `setCategoryAssignees`, and the constants
`MAX_CATEGORIES_PER_LIST`, `MAX_ITEMS_PER_LIST`. `adoptStringCategories` is module-private.

## 📝 UI/UX

**Route.** `/trips/$tripId/lists`, unchanged, default SSR, `ListsPending` and `ErrorPanel` kept.
`lists.tsx` is edited in Phase 1 (its literal English moves into the catalogue, and its
`formatWeight(overall.weightGrams)` passes the reader's `locale`, already in scope there, so the card
and the panel agree in every language) and in Phase 2 (it passes `canWrite` to the board).

**Phase 1 also ends the hard-coded English in `lists.tsx`.** It owns the file and `docs/SPEC.md` §9
forbids literals, so every literal string in it (the header title and description, the stat-card
labels, captions and units, the `Progress` label, `pluralise(..., 'shared list')`, the `ErrorPanel`
title) moves to `modules.lists.*` keys in all 23 locales in the same ticket.

**The board splits (Phase 1)** along the seams it has: `lists-board.tsx` keeps the grid and
board-level states and drops to the module header; `list-panel.tsx` is one list (header, toolbar slot,
groups, footer totals); `item-row.tsx` takes `ItemRow`, `SortableItems`, `SortableItemRow`,
`AssigneeMenu` and `InlineItemComposer` with their `@dnd-kit` wiring intact; `list-toolbar.tsx` takes
the filter row. `category-section.tsx` arrives in Phase 2. The split moves code and rewrites no
behaviour **except one**: the private `formatWeight` (and its three call sites: the packed-of line
twice and the per-row figure) is deleted in favour of `#/lib/format`, called with `useLocale()`.
`weightSummary(weightGrams, weightLimitGrams, locale)` becomes a pure function in `list-utils.ts` returning
`{ key, params }` (the module is pure and has no `t`; the component translates, and `locale` is only for formatting the weight), and its test asserts
that for 2 000 g `params.weight` equals `formatWeight(2000, locale)` imported from `#/lib/format`, which
the deleted `.toFixed(1)` implementation fails. `grep -rn "function formatWeight" src` then returns
exactly one line, `src/lib/format.ts`.

**A group's header** (`category-section.tsx`): colour-free, the name in an `<h3>` (it wraps, with
`overflow-wrap: anywhere`, and is never truncated), `done/total` in `tabular-nums`, a collapse chevron
(Phase 4), the people chip (Phase 6), and an overflow menu (rename, delete; move up and down, tick and
untick all in Phase 4). Every icon control is an `IconButton` of size `sm` (32px) or larger. Published
`data-part` hooks, kept because a class does not survive a restyle and the blind-pair capture clicks
them: `category-collapse` on the toggle, `category-people` on the people trigger, `category-legacy` on
a legacy header's wrapper; a record header never carries the third and a legacy header neither of the
others.

**States**, each distinct from the others:

- **Board empty** (no lists): the existing empty state, unchanged.
- **List empty** (no group, no item): an inset panel on `--color-surface-2` keeping the existing
  `lists.items.empty.title|body`, with "Add a group" as the action and, on `packing` lists, "Add the
  starter set" (Phase 5) with a one-line preview of what it contains. When `canWrite` is false the
  panel shows `lists.items.empty.title` with `lists.items.empty.viewerBody` ("Nothing has been added
  to this list yet.") and no action, because the existing body points at a field a viewer does not
  have.
- **Group empty** (a group with no rows, newly made or emptied): the header **always renders in
  grouped mode**, including on a list whose other rows are loose, because grouping is built from the
  list's `categories` as well as its items (today `groupByCategory` builds groups from items, a group
  with no rows returns `null`, and a list whose only group is the loose one falls back to the flat
  view, so "Add a group" would otherwise produce a toast and nothing on screen). Under it, one muted
  row, "Nothing in this group yet", with an "Add an item to {name}" action: in Phase 2 it opens the
  existing item dialog with the group preselected; Phase 3 swaps it for the in-group composer. Not a
  card-sized empty state.
- **Legacy group** (string headings on rows nobody has converted): there is **one legacy block per
  list**, not one per heading. Order inside a list: record groups, then the legacy headings with the
  block above the first of them, then "Everything else". Legacy headings are read-only, with no
  chevron, no menu, no chip, the counts, and the block's one sentence, "These headings can't be
  renamed or deleted yet.", and the button **Make them groups** (a `POST`, with a spinner while it
  runs). When the conversion would pass the 40-group ceiling the button stays visible and its reason
  is visible text beside it, referenced by `aria-describedby` (computed on the client from the
  payload with `canAddGroup`). After it succeeds a toast says "Now you can rename them, delete them
  and move items between them." (Phases 4 and 6 reword this sentence in all 23 locales to add folding
  and people when those land; each sentence says only what the product does that day). Focus moves to
  the first converted group's heading (`tabIndex={-1}`). The word "migration" appears nowhere. This
  state is reachable only backwards in time; it must never render for something the reader just did,
  which is why every writer in the table above moves in the same spec. An empty or whitespace-only
  heading is not a legacy heading and never shows the block.
- **Filtered empty:** the existing `lists.items.doneEmpty.*` ("Nothing ticked off yet") and
  `lists.items.todoEmpty.*` ("Everything here is done") keys, kept, distinct from the list-empty and
  group-empty states.
- **Ceilings:** at 40 groups "Add a group" and at 500 items the composer stay **visible**, and the
  reason is visible text beside the control (`lists.group.error.ceiling`, `lists.group.legacy.ceiling`,
  `lists.item.error.ceiling`) referenced from its `aria-describedby`: a natively disabled control takes
  no focus and no pointer events (`src/components/ui/shared.ts`), so a tooltip on it never opens, and
  touch has no hover. A composer input that reaches 500 keeps focus and refuses the submit with that
  reason; it does not become `disabled` while the caret is in it.
- **Viewer and archived trip** (`canWrite` false): the board hides the footer composer, the group
  "+", "Edit item…", "Move to", every group overflow item, "Add a group", the legacy block's button and
  sentence, "Add the starter set", and "From a template". The collapse chevron stays.
- **Optimistic writes** (rename, move, reorder) apply at once and roll back, with the per-action
  failure toast, to the restored position (focus rules below).

**Putting a row into a group.** The item dialog's free-text category input and datalist are replaced
by a select of the list's groups plus "No group" (a dialog opened from a group preselects it); for a
legacy row the select shows a placeholder, never "No group", and the hint names the heading
(`lists.item.field.groupLegacy`, "Now under “{heading}”, which is not a group yet."); saving without
picking leaves the row untouched. The footer composer adds loose rows. In Phase 3 each group header
has one "+" (`IconButton`, named `lists.group.addItem`, with `aria-expanded` and `aria-controls` naming
its composer) that opens a composer inside that group and moves focus into its input, whose accessible
name is the same string; Escape closes it and returns focus to the "+"; one composer is open at a time
(a phone has one keyboard target instead of five) and **a composer that holds typed text is never
closed by opening another**: the other "+" moves focus to the open input and the text stays. Opening a
folded group's "+" unfolds it. "Move to" (the dialog above) is in the row menu in Phase 3.
`knownCategories` becomes unused and is deleted with its test cases (the orphan this change creates).

**Focus.** After "Make them groups" focus goes to the first converted heading; after "Delete group"
to the next group's heading (`tabIndex={-1}`), or to the list's "Add a group" when none is left; after "Move to" to the
moved row's menu trigger in its new group (when that group is folded or filtered out, to the row that
now holds the old position in the source group); after "Move up" or "Move down", and after the rename
dialog closes, to that group's menu trigger; an optimistic rollback follows the same rules against
the restored position; Escape closes the chooser, the composer and every dialog and returns focus to
the control that opened it. Component tests assert `document.activeElement` for each case.

**Announcements.** Every new `useAction` passes both `failure` and `fallback` from the catalogue
(without them `src/components/modules/shared/use-action.ts` falls back to hard-coded English). Success
toasts, shown through Sonner's live region, announce a move (`lists.item.toast.moved`), a group move
(`lists.group.toast.moved`) and a composer add (`lists.group.toast.itemAdded`); a fold raises none.

**People picker (Phase 6).** The trigger (`data-part="category-people"`) is one button of at least
24×24 CSS px (`AvatarStack` `size="sm"` inside padding, never a bare `xs`) that opens a `Popover`
holding the trip's members as `Checkbox` rows and a "Done" button; the selection commits **once**,
when the popover closes (not on every toggle, which is what `MultiCombobox`'s `onChange` would do;
Escape discards the pending change instead of saving it, and the popover has an accessible name
through `aria-labelledby` on "Who packs it"),
so one save is one write, one dispatch and one toast. `MultiCombobox` is not used (it owns its own
trigger). The accessible name carries the current value: `lists.group.peopleAria`, "Choose who packs
{name}, now: {people}", where `{people}` is the stack's summary or `lists.group.peopleNone`.

**The mode toggle** ("grouped" / "order") stays; its labels say "groups", not "category".

**Responsive.** At 360px a list is one full-width panel, the header wraps its counts under the name,
and the people chip collapses to one `AvatarStack` with an overflow count. Row actions stay in the
visible row menu (it exists today on every row at every width); a long-press `ContextMenu` with the
same items is new in Phase 3 and duplicates it. At 1280px two panels sit side by side (the existing
grid); the page keeps its measure at 2560px. **Tokens only** from `src/styles/tokens.css` (no token is
missing, so none is requested); `tabular-nums` on every figure that can change. **Motion** for the
fold (Phase 4) runs only on a user toggle, never on hydration or when a stored fold is applied; the
animated element carries `data-motion-transform`, so the global reduced-motion rule in
`src/styles/styles.css` strips the transform; if it is driven by `motion/react` it reads
`useReducedMotion()`, as `pill-nav.tsx` does; it is transform and opacity at `--duration` on
`--ease-out-quint`; the chevron carries `data-mirror-rtl`.

**Primitives reused from `src/components/ui`, none re-implemented:** `Card`, `Checkbox`, `Chip`,
`Badge`, `IconButton`, `DropdownMenu`, `ContextMenu`, `Popover`, `AvatarStack`, `Progress`, `Input`,
`Field`, `Select` (the dialog's group select), `SectionLabel`, `EmptyState`, `Skeleton`, `Alert`, `Button`, `Dialog`, `toast`. No new
primitive.

## 📝 Visual change expected

Route `/trips/$tripId/lists`, light and dark, 360 / 1280 / 2560:

- Phase 1: none, except one figure (a 2 000 g pack reads `2 kg`, not `2.0 kg`, and a fractional
  kilogram takes the locale's separator) and the page's own labels, which are now catalogue strings
  (English reads the same).
- Phase 2: a group header (name, `done/total`, overflow menu) replaces the read-only `<h3>`, and a
  group with no rows still shows its header and one muted row; a toolbar "Add a group"; the legacy
  block and its button on lists not yet converted; the item dialog's group select; a viewer sees none
  of the write controls.
- Phase 3: a "+" on each group header and its composer; "Move to" in the row menu.
- Phase 4: the collapse chevron and a folded header; "Move up / Move down"; "Tick / Untick everything
  in this group".
- Phase 5: the list-empty state with the starter-set preview and button.
- Phase 6: the people chip on a header and its picker.
- Phase 7: no screen of its own (the copy dialog's sentence changes).

Judged as the **blind A/B pair** (`scripts/visual/capture.mjs`, `--auth`, `--click
'[data-part="category-collapse"]'`, `--click '[data-part="category-people"]'`) against a demo trip
whose "Group kit" list has groups (the seed now produces them, and it writes **no** legacy list: the
legacy block is covered by component tests over a fixture payload, not by the demo).

## 📝 Copy

Every string below is an `en` key in the `modules` namespace (rendered as `modules.lists.*`) unless
noted, and lands in all 23 locales in the same change (`i18n-messages` skill; the parity test
enforces it; Polish, Russian, Ukrainian, Czech and Arabic need their plural branches). **Retired**
(removed from all 23 files): `lists.item.field.categoryHint` and `lists.item.field.categoryPlaceholder`
(replaced by the group keys). **Reworded in place** (the key keeps its name, the value says "group"):
`lists.menu.groupByCategory` ("Show in groups"), `lists.menu.groupAgain` ("Show in groups again"),
`lists.quickAdd.detailsHint` ("Add with a weight, a group or an owner") and `lists.item.dialog.body`
("Everything except the name is optional — a weight makes the pack total real, and a group puts it
under a heading."). `lists.menu.dragOrder` and `lists.menu.dragOrderLong` stay (the order mode stays).
`lists.item.field.categoryHint`'s replacement is `lists.item.field.groupHint`.

Numbers that can change are parameters, never literals in a sentence: a ceiling is `{max}`, the
starter count is `{count}`, so the digits follow the locale and the copy cannot drift from
`MAX_CATEGORIES_PER_LIST` or the starter set.

| Key                                                      | English                                                                                                                           | Phase           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `lists.*` for every literal now in `lists.tsx`           | the existing English, one key each (header, stat cards, captions, units, progress label, `shared list` plural, error panel title) | 1               |
| `lists.group.add`                                        | Add a group                                                                                                                       | 2               |
| `lists.group.addAria`                                    | Add a group to {list}                                                                                                             | 2               |
| `lists.group.dialog.addTitle`                            | Add a group                                                                                                                       | 2               |
| `lists.group.dialog.renameTitle`                         | Rename this group                                                                                                                 | 2               |
| `lists.group.field.name`, `.namePlaceholder`             | Group name / Clothing                                                                                                             | 2               |
| `lists.group.error.name`                                 | A group name is 1 to 60 characters.                                                                                               | 2               |
| `lists.group.error.duplicate`                            | This list already has a group with that name.                                                                                     | 2               |
| `lists.group.error.ceiling`                              | A list holds up to {max} groups.                                                                                                  | 2               |
| `lists.item.error.ceiling`                               | A list holds up to {max} items.                                                                                                   | 2               |
| `lists.group.menu.rename`, `.delete`                     | Rename group… / Delete group                                                                                                      | 2               |
| `lists.group.remove.title`, `.confirm`                   | Delete “{name}”? / Delete group                                                                                                   | 2               |
| `lists.group.remove.body` (plural)                       | The {count} item in it stays on the list, without a group. / The {count} items in it stay on the list, without a group.           | 2               |
| `lists.group.remove.bodyEmpty`                           | It has nothing in it.                                                                                                             | 2               |
| `lists.group.toast.added`, `.renamed`, `.removed`        | Group added / Group renamed / Group deleted                                                                                       | 2               |
| `lists.group.toast.addFailed`                            | The group was not added.                                                                                                          | 2               |
| `lists.group.toast.renameFailed`                         | The new name did not save. The group keeps its old name.                                                                          | 2               |
| `lists.group.toast.removeFailed`                         | The group was not deleted. Its items are where they were.                                                                         | 2               |
| `lists.group.legacy.body`                                | These headings can't be renamed or deleted yet.                                                                                   | 2               |
| `lists.group.legacy.action`, `.actionAria`               | Make them groups / Make the headings in {list} groups                                                                             | 2               |
| `lists.group.legacy.done`                                | Now you can rename them, delete them and move items between them.                                                                 | 2 (4, 6 reword) |
| `lists.group.legacy.ceiling`                             | Together with the groups already here these would pass the limit of {max} groups.                                                 | 2               |
| `lists.group.legacy.failed`                              | The headings were not converted. Nothing changed.                                                                                 | 2               |
| `lists.item.field.group`, `.groupHint`                   | Group / Optional. Items without one sit under “Everything else”.                                                                  | 2               |
| `lists.item.field.groupNone`                             | No group                                                                                                                          | 2               |
| `lists.item.field.groupLegacy`                           | Now under “{heading}”, which is not a group yet.                                                                                  | 2               |
| `lists.group.empty`                                      | Nothing in this group yet                                                                                                         | 2               |
| `lists.group.addItem`                                    | Add an item to {name}                                                                                                             | 2               |
| `lists.items.empty.viewerBody`                           | Nothing has been added to this list yet.                                                                                          | 2               |
| `lists.group.toast.itemAdded`                            | Added {name}                                                                                                                      | 3               |
| `lists.item.toast.movedOut`                              | Moved “{item}” to “Everything else” (used instead of `.moved` when the target is "No group")                                      | 3               |
| `lists.item.menu.moveTo`, `lists.item.moveTo.title`      | Move to… / Move “{name}” to                                                                                                       | 3               |
| `lists.item.toast.moved`, `.moveFailed`                  | Moved “{item}” to {group} / That move did not save. The item is back where it was.                                                | 3               |
| `lists.group.menu.up`, `.down`                           | Move up / Move down                                                                                                               | 4               |
| `lists.group.toast.moved`, `.reorderFailed`              | {name} is now {position} of {total} / That order did not save. The groups are as they were.                                       | 4               |
| `lists.group.toggle`                                     | Items in {name}                                                                                                                   | 4               |
| `lists.group.menu.tickAll`, `.untickAll`                 | Tick everything in this group / Untick everything in this group                                                                   | 4               |
| `lists.starter.action`                                   | Add the starter set                                                                                                               | 5               |
| `lists.starter.preview` (plural)                         | Documents, clothing, toiletries, tech and health: {count} thing to start from. / … {count} things to start from.                  | 5               |
| `lists.starter.toast`, `lists.starter.failed`            | Starter set added / The starter set was not added. Nothing changed.                                                               | 5               |
| `lists.starter.group.*` (5), `lists.starter.item.*` (20) | the group and row names in "The starter set", one key each                                                                        | 5               |
| `lists.group.people`                                     | Who packs it                                                                                                                      | 6               |
| `lists.group.peopleAria`                                 | Choose who packs {name}, now: {people}                                                                                            | 6               |
| `lists.group.peopleNone`, `.peopleDone`                  | Nobody yet / Done                                                                                                                 | 6               |
| `lists.group.toast.assigned`                             | Saved                                                                                                                             | 6               |
| `lists.group.toast.assignedAdded` (plural)               | Saved. {count} person added. / Saved. {count} people added.                                                                       | 6               |
| `lists.group.toast.assignFailed`                         | The people did not save. The group is as it was.                                                                                  | 6               |
| `shell.notification.list.category_assigned.title`        | {actorName} put you down for “{categoryName}”                                                                                     | 6               |
| `shell.notification.list.category_assigned.body`         | On {listName}, {tripTitle}.                                                                                                       | 6               |
| `shell.copyTrip.carries`                                 | Days, places, notes and lists (other than to-dos) come across. Bookings, money, files and people do not.                          | 7               |

The assignee toast never says anyone was "told": a recipient may have notifications turned off.
`lists.group.toast.assignedAdded` has `one`, `few`, `many` and `other` branches in Polish, Russian,
Ukrainian and Czech and the full Arabic set. The chip says "Who packs it" and the notification is
routed through the settings screen's "Assigned items" row, which is the same people: `CONTEXT.md` gets one line under **Packing
group** saying a group's people are the ones packing it, which keeps the chip apart from the list's
"Belongs to" and the item's "Whose job is this".

## 📝 Edge Cases & Failure Scenarios

- **Two travellers adopt the same list** at once: the second `onConflictDoNothing` insert writes
  nothing and its update matches nothing; both see the same groups.
- **A rolled-back Worker writes a string row after the migration:** the row is legacy; the legacy
  block and button handle it, the next adoption converts it.
- **A heading collides case-insensitively with a group** (`Tech` / `tech`): adoption maps by exact
  string (the correlated update compares `name = trim(category)`), and the case-insensitive refusal applies
  to **create and rename**, not to adoption; two headings differing only in case adopt as two groups,
  which the traveller can then rename. Stated, not hidden. SQL `trim` strips spaces only, so an old
  heading with a trailing tab or newline stays legacy (app writes are trimmed in JS, so only old data is
  at risk).
- **Delete a group with 500 items:** one batch, released count returned, no per-row event.
- **A stale tab renames a group deleted elsewhere:** `NotFoundError` reaches the caller as the
  `lists.group.toast.renameFailed` toast and the board then revalidates.
- **A viewer or an archived trip opens the board:** sees groups and `done/total` and can fold them;
  every write affordance is absent, not just disabled (`canWrite`, see States); a forged call is
  refused with the authored role or archived sentence.
- **A slow connection:** the server-rendered list shows every group expanded until the script loads
  and the stored folds are applied; accepted (Resolved assumptions).
- **Two tabs press "Add the starter set" together:** the loser's batch rolls back; it shows the
  failure toast and the board revalidates to the winner's set.
- **A legacy or template heading that is empty or longer than 60 characters:** empty becomes a loose
  row, a long one is adopted unchanged (the 1 to 60 rule is for create and rename only).
- **Someone leaves a trip and rejoins:** their old group assignments return until the group's people
  are next saved (stated under "Who a group is for").
- **A person types in a group composer and opens another group's "+":** the typed text stays and focus
  moves to the open input.
- **A template whose groups pass the ceiling:** the apply is refused as a whole and creates no list;
  the dialog shows the failure fallback (the ceiling is not authored copy, I4).
- **Assigning a person who left the trip:** the whole call is rejected with one generic sentence; the
  stored row of someone who left is never shown.
- **A name of 60 characters with no spaces at 360px:** wraps by character, no horizontal scroll.
- **The 23 locales:** the five starter group names are distinct in each; Arabic mirrors.
- **Notification fails to enqueue:** logged, assignment stands.

## 📝 Observability

No new instrumentation. `LIST_LIMIT` and `NotFoundError` from the new writers are ordinary
repository errors; an adoption that creates groups logs its count at `info` through `createLogger`
(`src/server/observability`), the only place a conversion is visible.

## ✅ Acceptance criteria

**Phase 1.** `lists-board.tsx` is reduced to the grid and board-level states; `list-panel.tsx`,
`item-row.tsx`, `list-toolbar.tsx` exist and render the same screen; `grep -rn "function formatWeight"
src` returns one line; the panel, the row figure and the stat card print `2 kg` for 2 000 g in `en`
and the locale's separator in `de`; `weightSummary` has the test described above (it asserts `params.weight`); `lists.tsx` has no literal
English string left, every one is a key in all 23 locales.

**Phase 2.** The migration creates the two tables and the column and touches no row. A group can be
created, renamed and deleted from the board; deleting leaves the items on the list, loose, with
their string nulled; a renamed group's items' strings equal the new name. Create and rename refuse a
case-insensitive duplicate. The item dialog sets a group by id; no caller sets `category` by string.
`applyTemplateToTrip` over a template with three heading names yields three groups in
`min(sort_order)` order and `items.every(i => i.categoryId !== null)`, every `category` still set,
all in one batch; a template that would pass either ceiling creates no list. `createTemplateFromList`
reproduces group names for adopted rows and strings for legacy rows. Adoption: one group per distinct
string in `min(sort_order)` order; a second call creates nothing and leaves every group's `updated_at`
unchanged; two overlapping calls leave one group per name and no item on a null id; a list with none
performs no insert; a list that would pass 40 raises `LIST_LIMIT` and adopts nothing; calling the three
read functions over a list full of strings leaves `packingCategoriesRepository.count` at zero. The
legacy block renders after the record groups, read-only, once per list, with the button; the button
converts. The seed produces groups. The tenant-isolation suite has cases for both new tables. A
group just created, with no rows, is visible on the board with its empty row and its add action,
including on a list whose other rows are loose. A viewer and an archived trip see no group or item
write affordance, and `applyListTemplateFn`, `createListItemFn` and `updateListItemFn` refuse them
server-side. Deleting a group, a list and a trip is exercised on `createHarness({ ddl: 'migrations' })`
and `packing_items.category_id` is in `DEPLOYED_WITHOUT_ON_DELETE`. A heading that is empty after
trimming makes no group; one of 61 to 200 characters is adopted unchanged; adopted groups get
`sort_order` after the largest existing one. A 500-item template applies in at most 120 statements.
Component tests assert `document.activeElement` for each focus rule in UI/UX.

**Phase 3.** "Move to" and the group "+" composer put a row into a group in one tap/enter; moving to
"No group" nulls the id and the string; a group in another list or another trip is refused (I2) before
any write; moving into an existing group adopts nothing and cannot fail with `LIST_LIMIT`; the patch
carries `categoryId`; the "Move to" dialog marks the current group with `aria-current`; typed text in
a composer survives opening another group's "+".

**Phase 4.** Collapse persists per reader across reloads and is never sent to the server, uses
`aria-expanded` / `aria-controls`, hides folded rows from Tab and the screen reader, and animates only
on a user toggle; reorder applies in one batch and the end items of the menu are disabled; both survive
a failed write by reverting; "Tick everything in this group" and "Untick everything in this group"
call the existing `setListItemsDoneFn` with that group's item ids (no new server function; the
function validates at most 200 ids and a group can hold 500, so the client sends the ids in
sequential slices of at most 200, with a test over 201 or more items) and are
disabled by `selectAllState` over the group's items; `lists.group.legacy.done` is reworded to add
folding in all 23 locales.

**Phase 5.** The set is offered on empty `packing` lists only; pressing it creates five groups and
twenty unticked rows in the reader's language; a second press changes nothing; the names are distinct
in all 23 locales; the repository refuses a list that already has a group or an item.

**Phase 6.** Assigning replaces the join rows in one batch, returns only the added ids, notifies
exactly those (not the actor, not a non-member), and rejects the whole call when any id is not a member
of the group's trip, with the trip compared before the membership read; the picker commits once, on
close; the trigger's name carries the current people; the chip shows only current members;
`list.category_assigned` is in `STORED_EVENTS` and in 23 locales, and the event carries
`titleParams: { categoryName }` so a test that renders the stored title for a recipient finds no `{`
token left; `lists.group.legacy.done` is reworded again to add people in all 23 locales.

**Phase 7.** Copying a trip copies the non-`todo` lists, with their groups and items, with ticks reset
and no assignees or list owner, remaps group ids, is idempotent on redelivery, and leaves the source
byte-for-byte unchanged; a `todo` list on the source is not copied and one already on the target
survives; a copy of a trip from another organisation is refused.

**Throughout.** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh` and
`pnpm build` pass on the last commit of each ticket's PR; zero console warnings on the lists tab;
every new control has hover, `focus-visible`, active, disabled and loading states; WCAG 2.2 AA in both
themes; every new string is in all 23 locales.

## 📝 Risks & Impact Review

- **Tenancy and the migration (risk-high by `SDLC.md`: the diff touches `schema.ts` and
  `drizzle/`).** Three tenant-scoped tables' worth of surface; raw `scope.db` builders in adoption and
  template apply (a precedent exists in `transports.ts`); each stamps `organization_id` from
  `scope.ctx.organizationId` and carries a tenant predicate inside the correlated subselect. The
  isolation suite gains cases for both tables, for adoption and template apply with a foreign id, and
  for the copier from another organisation. The security and tenancy reviewer's round-1 conditions (the
  deployed `NO ACTION`, the trip carried into every writer, the guard on `applyListTemplateFn`, the tenant
  rule on every statement) are in this spec; its final verdict is a row of Resolved assumptions.
- **Cross-trip addressing inside one tenant** (pre-existing): a list or item id is used without being
  tied to the authorised trip, so a member who can read trip A can address a row of a private trip B
  in the same organisation. The new writers close it for themselves (I2); F1 closes it for the old
  ones. The tenant-isolation suite cannot see it (both trips are in one tenant), so each new writer
  gets a same-organisation, other-trip case.
- **Rollback:** additive; the previous Worker keeps reading `category` (I1).
- **Rows written by the previous Worker after the migration** are legacy until the button converts
  them; documented, not repaired automatically.
- **Batch size:** a 500-item template is about 105 statements; asserted at most 120 in a test. The
  reorder is one `runBatch` of at most 500 updates in chunks (I2). The copier writes per list and the
  same test asserts at most 120 statements for one 500-item list; the total for a whole trip is bounded
  only by I4 (40 groups, 500 items per list), so a trip of many full lists can exceed one invocation's
  allowance. Phase 7 measures ten full lists and, if it breaks the limit, splits the copier per list
  across queue messages (a follow-up, not designed here).
- **Cost:** a trip copy now copies every non-`todo` list and group with no quota (I4); one save can
  send up to 50 emails (the dispatcher's default channels). Neither is counted against a plan limit;
  that is a product call for a person if it ever matters.
- **Notification volume:** one dispatch per save, to the added people only.

### Out of scope, noticed on the way (follow-up issues, not built here)

- **F1 (`security`):** the existing list and item writers (`createListFn`, `updateListFn`,
  `deleteListFn`, `resetListFn`, `deleteListItemFn`, `setListItemsDoneFn`, `reorderListItemsFn`)
  check `requireTrip` only: no role, no archived check, and (all but reorder, which Phase 2 ties to the
  trip) the child id is not tied to the trip. Add
  `requireWritableTrip`, the role and the same-trip check (decide first whether a viewer may tick).
- **F3:** drop `packing_items.category` after the rollback window.
- **F4:** a shared (stored) collapse, or the per-reader fold kept in a cookie the loader reads (which
  removes the post-hydration shift): an additive column or one loader read.
- **F5:** the flat order mode reorders rows by drag only, by pointer or keyboard
  (`lists-board.tsx`); WCAG 2.2 SC 2.5.7 asks for a single-pointer path. Add "Move up" / "Move down"
  to the row menu in order mode. It predates this spec.

## 📋 Phasing

| #   | Phase                                                                                                        | Blocked by | Risk          | Ticket-sized because                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------- | ------------- | --------------------------------------------------------------------------------------- |
| 1   | Split the board; one weight formatter                                                                        | none       | `risk-low`    | no schema, no server                                                                    |
| 2   | Groups are records (migration, create / rename / delete / adopt, writers, seed, dialog select, legacy block) | 1          | `risk-high`   | the migration and the writer move cannot be separated, or a fresh write would be legacy |
| 3   | Move a row; a composer inside each group                                                                     | 2          | `risk-medium` | one server function and two UI paths                                                    |
| 4   | Fold, order and tick a group                                                                                 | 2          | `risk-low`    | local state + one server function + one menu wiring of an existing function             |
| 5   | The starter set                                                                                              | 2          | `risk-low`    | one server function, one module, 29 keys × 23 locales                                   |
| 6   | Who a group is for                                                                                           | 2          | `risk-medium` | membership validation and the notification                                              |
| 7   | The packing trip copier                                                                                      | 2          | `risk-medium` | a registered copier and its sentence                                                    |

Phases 3 to 7 are independent of each other; each is `Blocked by` Phase 2 only. `00-S2` (the
dispatcher, Phase 6's prerequisite) has landed at HEAD (`src/server/notifications/dispatch.ts`).
Priority for every ticket: `priority-medium`.

## 📋 Implementation Plan

### Phase 1 — Split the board; one weight formatter

Owned: `lists-board.tsx`, new `list-panel.tsx`, `item-row.tsx`, `list-toolbar.tsx`, `list-utils.ts`
(`weightSummary`), `index.ts`, `__tests__/list-utils.test.ts`, `lists.tsx` (the `locale` argument and
every literal string, moved to the catalogue in 23 locales). Move code, rewrite no behaviour, delete
the private `formatWeight`, add `weightSummary` (returns `{ key, params }`) and its test.
Done when the Phase 1 criteria hold and the existing board tests are green.

### Phase 2 — Groups are records

Owned: `src/server/db/schema.ts` + the generated migration; `src/server/repos/lists.ts` (handles,
create / rename / delete / adopt, ceilings, `listListCategories`, `listTripCategories`, writers moved,
docstring corrected); `src/server/repos/index.ts` barrel table; `src/server/fns/lists.ts`
(`writableListsTrip`, four functions, `categoryId` on the two item functions, guards on them and on
`applyListTemplateFn`); `src/routes/_app/-server/trip.ts` (`loadTripLists`, `canWrite`);
`src/routes/_app/trips/$tripId/lists.tsx` (passes `canWrite`);
`src/server/db/__tests__/migrations-match-schema.test.ts` (`DEPLOYED_WITHOUT_ON_DELETE`); `types.ts`, `list-utils.ts` (grouping with legacy
fallback and from `categories` so an empty group renders; `canAddGroup`; delete `knownCategories`), new `category-section.tsx`, `list-panel.tsx`, `list-dialogs.tsx`
(group select, group dialog), the legacy block; `src/routes/api/dev/-seed/apply-trip.ts`; CONTEXT.md
(one glossary entry: **Packing group**, with the line that a group's people are the ones packing it);
catalogue keys. Tests: new
`src/server/repos/__tests__/lists-categories.test.ts` (adoption's six cases, the writer-migration five,
rename / delete / duplicate, ceilings at the ceiling and not one row before, reads never write),
`list-utils.test.ts` (grouping by id then string, legacy after record groups), cases appended to
`tenant-isolation.test.ts` (`isolationCase` for both repositories, `seedWorld` gains a group; foreign
`listId`, `categoryId`, item with another trip's group in the same org, `createListItem` and `updateListItem` against another trip's list or item in the same org (with and without `categoryId`), adoption and `applyTemplateToTrip`
both directions with counts unchanged), component tests for the header and legacy block asserting the
`data-part` hooks. Read the generated SQL before applying it.

### Phase 3 — Move a row; a composer inside each group

`assignItemToCategory` (I2 first; it never adopts), `moveItemToCategoryFn`, the "Move to" dialog (row
menu, plus the new long-press menu), the per-group "+" composer replacing Phase 2's dialog action
in the group-empty row; the `packing-item` patch carries `categoryId`. Isolation cases for item↔group
pairs across tenants, across lists and across trips of one organisation.

### Phase 4 — Fold, order and tick a group

Per-reader collapse hook (browser storage keyed by group id, hydration-safe, disclosure semantics),
`reorderListCategories` and its function, "Move up / Move down", "Tick / Untick everything in this
group" (the existing `setListItemsDoneFn`), motion at `--duration`, `legacy.done` reworded. Tests: the hook's SSR/hydration
behaviour, reorder set-equality and one-batch property.

### Phase 5 — The starter set

`src/lib/lists/starter-set.ts` and its test (every group has rows, quantities positive integers,
unique keys, total below 500), `seedStarterCategories`, `seedStarterSetFn`, the list-empty state with
preview and button (packing lists only), 29 keys in 23 locales, a catalogue test that the five group
names are distinct per locale.

### Phase 6 — Who a group is for

`setCategoryAssignees`, `setCategoryAssigneesFn`, the `Popover` picker (commit on close) and
`AvatarStack` chip (`category-people`), `dispatchQuietly(scope, event, notificationDeps())`,
`list.category_assigned` stored copy in 23 locales and in `STORED_EVENTS`, the loader stitching
current members only, `legacy.done` reworded. Isolation: a member of another trip's id is rejected, not
dropped; a foreign group.

### Phase 7 — The packing trip copier

`registerTripCopier('packing', …)` in `lists.ts` (non-`todo` lists only), its tests
(`src/server/repos/__tests__/lists-copier.test.ts`: ticks reset, no assignees or owner, id remap,
idempotent twice, source unchanged, cross-organisation refused, a `todo` list neither copied nor
cleared) and the `shell.copyTrip.carries` sentence in 23 locales; the queue consumer is shown to load
the module through the barrel.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every
ticket's PR; `pnpm generate-spec-index` and the `drizzle/` read-through for Phase 2. No screenshot is
compared anywhere (ADR 0016) and no new `e2e/` declaration is added: nothing here fails in a browser
that a vitest or jsdom test cannot reproduce (the plan's two "never legacy" Playwright assertions
become the repository `every(i => i.categoryId !== null)` assertion and a component test on the
`data-part` hooks). The visual judgement is the **blind A/B pair** from
`scripts/visual/capture.mjs` (`docs/SPEC.md` §7 item 4, `verifying-changes`), `--auth`, viewports
`360x800,1280x900,2560x1440`, themes `light,dark`, the resting frame and `--click` on the two
`data-part` selectors; the executing ticket checks each selector with `await page.locator(sel).count()`
against a running server before the capture (1 for the two clicked ones, 0 for `category-legacy` on a
list it just wrote to). Frames stay out of the repository; the capture's `console` and `warnings`
output goes into the PR body. `docs/plans/12-verification-protocol.md` §7.2 does not apply:
`grep -rn "Intl\." src/components/modules/lists/ "src/routes/_app/trips/\$tripId/lists.tsx"` returns
nothing, and nothing added here constructs an `Intl` formatter.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                             | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Why                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is "rename blocked while an item is ticked" kept?                    | No. A group can always be renamed; a duplicate name in the same list is refused.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by the product owner sub-agent (confidence high): a group name is a heading, not a packing record; the rule freezes every group from the first tick.                                                                                                                                                                                       |
| 2   | Starter set: when and for which lists?                               | An explicit button on empty lists of kind `packing` only, with a preview; never automatic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Decided by the product owner sub-agent (confidence high): the content is packing content, and an automatic apply puts rows in a list nobody asked to fill.                                                                                                                                                                                         |
| 3   | Moving rows and ordering groups?                                     | Row "Move to" (flat chooser) and group "Move up / Move down" in menus; no cross-group drag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Decided by the product owner sub-agent (confidence high): the drag exists only in the flat order mode, SC 2.5.7 requires the non-drag path, and one function serves both gestures later.                                                                                                                                                           |
| 4   | Is the packing copier in this stage, and does the seed move?         | Yes to both (Phase 7 and Phase 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by the product owner sub-agent (confidence high): the plan's preamble gives 05-S1 the copier, `CONTEXT.md` already promises it, and the seed calls the writer that loses its string input.                                                                                                                                                 |
| 5   | Slicing.                                                             | Seven phases; rename, delete and the dialog's select ship with Phase 2, "Move to" and the group composer with Phase 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided by the product owner sub-agent (confidence medium): Phase 2 removes the free-text field, so without rename, delete and a select a traveller is worse off on `develop`.                                                                                                                                                                     |
| 6   | Who owns the migration?                                              | This spec, one migration in Phase 2 with all three pieces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Decided by the software architect sub-agent (confidence high): the foundations schema stage is not a ticket; two migrations double the `drizzle/` review for an inert table.                                                                                                                                                                       |
| 7   | What do writers do with the legacy string?                           | Invariant I1: the string mirrors the record; rename rewrites it, delete nulls it, item writers take `categoryId` only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided by the software architect sub-agent (confidence high): one owner and one testable invariant keep the rollback guarantee and stop a deleted group resurrecting.                                                                                                                                                                             |
| 8   | Guards on the new writers?                                           | `requireWritableTrip` + `assertTripRole(['owner','editor'])`, child resolved and its trip compared; the two item writers become guarded too; the rest of the old writers go to F1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by the software architect (confidence medium) and security and tenancy (confidence high) sub-agents: no new verb weaker than day-notes, and `categoryId` must not be writable by a weaker path.                                                                                                                                            |
| 9   | Starter set copy source?                                             | Catalogue keys resolved on the client; `seedStarterSetFn` takes names and quantities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided by the software architect sub-agent (confidence medium): §9 forbids hard-coded copy, and a server-side catalogue load couples a repo write to locale negotiation.                                                                                                                                                                          |
| 10  | Notification identity?                                               | `kind: 'list.assigned'` with `list.category_assigned` keys, `STORED_EVENTS` entry, `dispatchQuietly`, added ids only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided by the software architect sub-agent (confidence high): the preference row exists, so opt-out exists with no new settings row.                                                                                                                                                                                                              |
| 11  | Loader seam and adoption shape?                                      | `categories` per list in `loadTripLists`; adoption reads in JS, mints ids in JS, one `runBatch` of chunked `onConflictDoNothing` inserts and a correlated update.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Decided by the software architect sub-agent (confidence medium): SQL cannot mint ids (`$defaultFn`), 40 rows exceed 100 bound parameters, and the ceiling is soft under concurrency.                                                                                                                                                               |
| 12  | Collapse: shared or per reader?                                      | Per reader, browser storage, no column, no function.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by the traveller sub-agent (confidence medium): a shared fold hides one traveller's items on another's phone and costs a `POST` per tap; adding a shared column later is additive.                                                                                                                                                         |
| 13  | Legacy conversion path?                                              | A dedicated "Make them groups" button (`adoptListCategoriesFn`) besides "Add a group"; the label "Ungrouped heading" is dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by the traveller sub-agent (confidence medium): otherwise the only way to rename a heading is to invent a group; still no write in a loader.                                                                                                                                                                                               |
| 14  | How does a row get into a group?                                     | Dialog select, loose footer composer, a "+" composer inside each group (one open at a time), "Move to".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Decided by the traveller sub-agent (confidence high): packing is done by group on a phone; a free-text field would mint duplicate groups past the ceiling.                                                                                                                                                                                         |
| 15  | Starter set contents and quantities?                                 | The five groups and twenty rows above, every quantity 1, in the reader's language.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by the traveller sub-agent (confidence high): a count from nights is wrong once the dates move and a copy would carry it.                                                                                                                                                                                                                  |
| 16  | The `colour` column on groups?                                       | Dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Default applied: no stage lets a traveller choose one; a nullable column is additive later.                                                                                                                                                                                                                                                        |
| 17  | Same tenant, other trip?                                             | Every new writer compares the child's `trip_id` and `list_id` to the authorised trip; F1 files the old writers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by the security and tenancy sub-agent (confidence high): `requireTrip` hides private trips from non-members but nothing ties a child id to it; a composite FK is impossible (`SET NULL` vs `NOT NULL`).                                                                                                                                    |
| 18  | Assignees who leave the trip?                                        | Stored rows stay; reads show current members only; an unknown id rejects the whole call with one generic sentence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by the security and tenancy sub-agent (confidence medium): `removeTripMember` is not this spec's file and a stale row discloses nothing.                                                                                                                                                                                                   |
| 19  | Risk label?                                                          | The spec PR is `risk-low` (its diff is documentation, which is how `SDLC.md` defines risk); the Phase 2 ticket is `risk-high` (it touches `schema.ts` and `drizzle/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided by the security and tenancy sub-agent (confidence high) for the implementation; the PR's own label follows the diff.                                                                                                                                                                                                                       |
| 20  | Verification in place of the plan's baselines?                       | Vitest and jsdom plus the blind pair; no `e2e/` file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ADR 0016 removed the visual gate and `e2e/__screenshots__`; one defensible answer in the repository.                                                                                                                                                                                                                                               |
| 21  | `LIST_LIMIT` reaching the traveller?                                 | The action stays visible at the ceiling with its reason as visible text (`aria-describedby`), never a tooltip on a disabled control; the server check is a backstop whose failure is the caller's fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Default applied: `LIST_LIMIT` is not an authored error (`src/server/errors/public.ts`), and a new authored class does not join that closed list; the accessibility specialist (round 1) showed a disabled control cannot show its reason.                                                                                                          |
| 22  | The plan's `src/routes/_app/-lib/notifications.ts`?                  | Does not exist; the copy is `shell.notification.list.category_assigned.*`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | One defensible answer in the code.                                                                                                                                                                                                                                                                                                                 |
| 23  | Panel verdicts, round 1                                              | Product owner: approve with conditions (medium). Software architect: approve with conditions (medium). Security and tenancy: approve with conditions (high), approving the `risk-high` Phase 2 for unattended implementation. UX (traveller): approve with conditions (medium). Accessibility: approve with conditions (high). Every condition applied in the second commit; round 2 verdicts are recorded in row 33.                                                                                                                                                                                                                                                                                          | Decided by the five specialist sub-agents; none answered `revise` and none escalated. The conflicts between them are rows 24 and 27.                                                                                                                                                                                                               |
| 24  | To-do lists and the packing copier?                                  | Copy every list whose `kind` is not `todo`; clear only those on the target; `05-S4` keeps its own to-do copier (due dates dropped).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The product owner sub-agent wanted one copier over `packing_lists` and the software architect and the UX specialist wanted the boundary stated; `docs/plans/05-packing-and-todos.md:77` already gives the to-do copier to `05-S4`, and the narrower copier is the more reversible one (05-S4 can widen it, a wrong wide copier would double-copy). |
| 25  | How does the board know the reader may write?                        | `canWrite` on `ListsPayload` from `canWritePlan(trip, tripRoleFor(...))`; the board hides write controls (the collapse chevron stays).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided by the product owner, architect and UX sub-agents (all round 1): the board has no role today, so "`canWrite` removes the affordance" had no source; the day-notes loader is the precedent.                                                                                                                                                 |
| 26  | Hard-coded English in `lists.tsx`?                                   | Phase 1 moves every literal in the file to the catalogue in 23 locales; follow-up F2 is dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by the UX specialist sub-agent (confidence medium): Phase 1 already owns the file and `docs/SPEC.md` §9 forbids literals.                                                                                                                                                                                                                  |
| 27  | Stored folds applied after hydration shift the page?                 | Accepted: a layout effect applies the fold, and the list is expanded in the server HTML; F4 names the cookie-read alternative.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Decided by the accessibility and UX sub-agents (round 1): the plan wants a shared fold, a per-reader fold is the cheaper, rollback-free option, and a cookie read in the loader is more code than the stage warrants; recorded because `docs/SPEC.md` §2 asks for zero shift after paint.                                                          |
| 28  | Delete on a column that ships as `NO ACTION`?                        | The delete batch clears `category_id` and `category` itself first; the register and the tests use the migrated DDL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Decided by the security and tenancy sub-agent (confidence high): drizzle-kit `ADD COLUMN` writes no `ON DELETE`, so D1 would refuse the delete (`drizzle/0006_*.sql`, `migrations-match-schema.test.ts`).                                                                                                                                          |
| 29  | Does moving a row adopt headings?                                    | No: `assignItemToCategory` never adopts; adoption callers are `createListCategory` and `adoptListCategories`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Decided by the software architect sub-agent (confidence medium): adopting on a plain move would convert every heading and could fail the move with `LIST_LIMIT`.                                                                                                                                                                                   |
| 30  | Adopted names and order?                                             | Empty heading means loose; 61 to 200 characters adopted unchanged; `sort_order` follows the largest existing group; the update trims the string it compares.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided by the software architect and security sub-agents (confidence medium): adoption and template apply bypass Zod, and `shortTextSchema` already allows 200.                                                                                                                                                                                   |
| 31  | Who picks the people, and how?                                       | A `Popover` of `Checkbox` rows that commits once on close; the chip is named "Who packs it" and the notification reads "put you down for".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Decided by the accessibility and UX sub-agents (confidence high and medium): `MultiCombobox` commits per toggle and owns its trigger, and "group" already means people elsewhere in the catalogue.                                                                                                                                                 |
| 32  | Does the stage build the group-header bulk tick the plan sources?    | Yes, in Phase 4: "Tick / Untick everything in this group" through the existing `setListItemsDoneFn`, no new server function.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided by the product owner sub-agent (confidence medium): the plan cites it as a source of `LST-01 → done`, and the board already ticks in bulk per list.                                                                                                                                                                                        |
| 33  | Panel verdicts, round 2                                              | Product owner: approve, no conditions (high). Accessibility: approve, no conditions (high). Software architect: approve with conditions (medium). Security and tenancy: approve with conditions (high), and approves the `risk-high` Phase 2 for unattended implementation once its two edits are in. UX (traveller): approve with conditions (high). Every round-2 condition applied in the third commit (the `tripId` on `reorderListCategories` and on every item writer call, `titleParams`, `weightSummary(..., locale)`, `canAdoptHeadings`, the 200-id slices for the group tick, the copy sentence, the `movedOut` and `viewerBody` keys, the authored-error wording, the statement and trim wording). | Decided by the five specialist sub-agents: none answered `revise`, none escalated. The two-round limit of `afk-plan-to-spec` § 5 is spent; every remaining item was a wording or signature fix with no design change, so no third round was run.                                                                                                   |
| 34  | Independent specification review of the PR (`om-pr-autopilot` row 3) | Two majors and five minors, none about the codebase, all applied: `categoryId` is `.optional()` in both item functions with `category` accepted and ignored for one release (`BACKWARD_COMPATIBILITY.md` §2); the same-trip check is per request through a new `reorderListItems`, not per row; the dialog duplicate check includes legacy headings; `seedStarterCategories` refuses non-packing lists; the copier's whole-trip batch size is a stated risk; `docs/ARCHITECTURE.md` path; 29 starter keys.                                                                                                                                                                                                     |
