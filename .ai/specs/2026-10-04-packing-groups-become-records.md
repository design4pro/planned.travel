# Packing groups become records, and a new list stops being empty

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **Status**         | ready                                      |
| **Issue**          | none                                       |
| **Spec PR**        | #TBD                                       |
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
item dialog's group select (the migration); "Move to" and a composer inside each group; collapse
and group order; the starter set; who a group is for, with the notification; the packing trip copier.

**What a traveller calls it.** The product says **group** (a heading with its rows under it). The
engineering names are the plan's: table `packing_categories`, functions `…ListCategory…`, because
five stages in `docs/plans/05-packing-and-todos.md` and the schema of places and expenses already
use "category" for other things, and the plan's cross-stage contract is spelled with it. No
catalogue string says "category" for a packing group.

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
- `registerTripCopier(name, fn)` exists (`src/server/repos/trips.ts`) and `trip-copy.ts` runs every
  registered copier, but nothing registers a packing copier, so a trip copy carries no list although
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

| Column                     | Type                        | Null     | Notes                                        |
| -------------------------- | --------------------------- | -------- | -------------------------------------------- |
| `id`                       | `text` PK                   | not null | `pk()`                                       |
| `organization_id`          | `text`                      | not null | `orgRef()`, `ON DELETE CASCADE`              |
| `trip_id`                  | `text` → `trips.id`         | not null | `ON DELETE CASCADE`                          |
| `list_id`                  | `text` → `packing_lists.id` | not null | `ON DELETE CASCADE`                          |
| `name`                     | `text`                      | not null | trimmed, 1 to 60 characters (repository Zod) |
| `sort_order`               | `real`                      | not null | `sortOrder()`                                |
| `created_at`, `updated_at` | `integer` timestamp_ms      | not null | `timestamps()`                               |

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

`packing_items.category_id` — `text`, nullable, `REFERENCES packing_categories(id) ON DELETE SET
NULL`, with `packing_items_category_idx (organization_id, category_id)`. **No composite foreign key**
`(category_id, list_id)`: `SET NULL` would try to null `list_id`, which is `NOT NULL`, and adding it
would rebuild `packing_items`. That an item's group belongs to the item's list is enforced by the
repository (invariant I2) and tested.

`packing_items.category` is **not dropped, renamed or narrowed.** A rolled-back Worker reads the
string and knows nothing of the new column; keeping it populated is what makes
`ARCHITECTURE.md` §9 row 12 hold. Dropping it is a later migration, after the rollback window, and
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
- **I2 — a group belongs to the item's list, a list to the trip.** Every writer that sets
  `category_id` resolves the item and the group in the caller's scope and requires
  `item.listId === category.listId` and the list's `tripId` to equal the trip the handler authorised.
  A mismatch is `NotFoundError`, never a re-scoped write.
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
  UI therefore disables the action and says why at the ceiling, and the server check is the backstop.
- **I5 — collapse is not stored.** It is a per-reader view preference kept in the browser (below);
  there is no column, no server function, no mirror.

### Adoption: how a string heading becomes a group

`adoptStringCategories(scope, listId): Promise<number>` in `src/server/repos/lists.ts` is the **only**
code that turns a `category` string into a `packing_categories` row. Its callers are all `POST` write
paths that resolved the list through `packingListsRepository.requireById` first:
`createListCategory`, `assignItemToCategory`, and `adoptListCategories` (the guarded wrapper behind
the legacy header's "Make them groups" button, Phase 2). It has no caller in a read or a loader.

1. **Read**, in JS, built from `tenantFilter()`: the distinct `category` and `min(sort_order)` over
   the list's items where `category IS NOT NULL AND category_id IS NULL`, ordered by that minimum
   (so groups keep the order the traveller was already looking at).
2. **Check** the ceiling: existing groups plus the distinct strings must not exceed 40, otherwise
   raise `LIST_LIMIT` and write nothing (adoption is all-or-nothing: half a list on records and half
   on strings, indistinguishable on screen, is worse than none).
3. **One `runBatch`** (`src/server/repos/batch.ts`) of statements built from `scope.db`, not from the
   repository handle (a handle awaits immediately and cannot sit in a statement array):
   - the inserts, one row per name, `id` from `newId()` in JS (SQL cannot mint it), `organizationId`
     from `scope.ctx.organizationId` and `tripId` from the resolved list in the same expression that
     builds the row, `.onConflictDoNothing({ target: [listId, name] })`, chunked at
     `chunkFor(boundParametersPerRow(packingCategories))` (40 rows exceed D1's 100 bound parameters
     in one statement);
   - one correlated `UPDATE packing_items SET category_id = (SELECT c.id FROM packing_categories c
WHERE c.list_id = packing_items.list_id AND c.name = packing_items.category AND
c.organization_id = ?)` over the list's rows where `category_id IS NULL AND category IS NOT NULL`,
     under `tenantFilter()`. The tenant predicate inside the subselect is defence in depth (the
     security reviewer's condition); the update reads whichever row won the insert, so no id travels
     back to the Worker between the two writes, and `category_id IS NULL` makes a repeat call match
     nothing.

Two overlapping adoptions converge on the same rows in either order. A list with no string headings
inserts zero rows and updates zero. It returns how many groups it created.

A list nobody has written to is not a stalled migration: it renders as it does today, out of the
string, read-only, with one sentence and one button (UI below). There is no cron, no queue job and
no second repair path; rows a rolled-back Worker writes later are adopted by the same button.

### The writers of `packing_items.category`, all moved

`grep -n "category" src/server/repos/lists.ts` finds the functions below; the fifth caller is outside
the module. After this spec **no code sets the string except the writers in this table, and each
sets it as a mirror (I1).**

| Writer                                                | What changes                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createListItem` / `updateListItem`                   | `itemFields` drops `category` and gains `categoryId` (`nullish`; `undefined` leaves group and string alone, `null` clears both). The repository resolves the group (I2) and writes the id and the name together. A legacy item edited without `categoryId` stays legacy. Callers: the server functions, the seed, two test files.                                                                                                   |
| `applyTemplateToTrip`                                 | Becomes what its docstring claims. After the template, trip and items are resolved: mint one group per distinct template `category` in `min(sort_order)` order and insert the items with `category_id` **and** the same `category` string, as **one `runBatch`** with the list insert (ids generated in JS). Both ceilings are checked against the template's counts before the batch is built, so a refused apply creates no list. |
| `createTemplateFromList`                              | Reads each item's heading from its group when `category_id` is set and from the string when it is not, so saving an unadopted list keeps its headings.                                                                                                                                                                                                                                                                              |
| `seedStarterSet` (Phase 5)                            | Creates the groups, then the items on them, in one batch.                                                                                                                                                                                                                                                                                                                                                                           |
| the dev seed `src/routes/api/dev/-seed/apply-trip.ts` | Calls `createListCategory` once per distinct fixture heading, then `createListItem` with the group id. Without this the demo workspace shows only the read-only legacy state, which a fresh write must never produce.                                                                                                                                                                                                               |

`applyTemplateToTrip` corrects the module docstring (`lists.ts`, top) to what it then is. A 500-item
template is about ninety statements in one batch (`chunkFor` over `packing_items`' columns); that is
inside D1's per-invocation allowance on the paid plan and a test asserts the statement count at the
ceiling so a later column cannot silently push it over.

### Renaming and deleting a group

- **Rename.** `renameListCategory(scope, categoryId, name)`: resolve (I2), trim, refuse a name equal
  to a sibling's under `lower()`, then one `runBatch`: `UPDATE packing_categories` and
  `UPDATE packing_items SET category = <new name> WHERE category_id = ?` (I1). Renaming is allowed
  whatever is ticked; the plan's "blocked while an item is ticked" is dropped: a group name is a
  heading, not part of a packing record, and the rule would freeze every group from the first tick
  (Resolved assumptions).
- **Delete.** `deleteListCategory(scope, categoryId)` returns the number of items it released: one
  `runBatch` of `UPDATE packing_items SET category = NULL WHERE category_id = ?` **then**
  `DELETE FROM packing_categories`. The items stay on the list, loose, with the same ids; no
  tombstone is emitted for them. (The plan relies on `ON DELETE SET NULL` alone and so leaves the
  string behind, which resurrects the group; I1 closes that.)

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

`createListItemFn` and `updateListItemFn` gain `categoryId` in their input (`''` means none, the
module's idiom) and in their existing `packing-item` patch payload. **They also become guarded
paths:** `writableListsTrip` plus the same-trip and same-list checks, because a `category_id` must
never be writable through a path that is weaker than `moveItemToCategoryFn` (the security reviewer's
condition). Viewers therefore lose item create and edit, which they were never meant to have; ticking,
bulk ticking, reordering and deleting stay as they are (F1).

The mirror follows the plan-level convention that already holds in this module: list-shaped writes
stamp the trip, item-shaped writes address the row. Clients do not consume either yet.

### Group order, collapse and Move to

- **Order.** `sort_order` is `real`; `reorderListCategories(scope, listId, orderedIds)` requires the
  ids to be exactly the list's groups (set equality, otherwise `NotFoundError`) and rewrites
  `sort_order = index` in one `runBatch` (at most 40 statements). The UI is "Move up" and "Move down"
  in a group's overflow menu, disabled at the ends: keyboard and touch friendly, no drag across
  sections (WCAG 2.2 SC 2.5.7 would demand the non-drag path anyway).
- **Collapse** is per reader, kept in the browser (`localStorage`, keyed by group id, default
  expanded, applied after hydration without animation so server and client agree). A shared collapse
  would let one traveller fold another's "Clothing" on their phone, costs a `POST` and a rollback
  toast per tap over hotel wifi, and would be a role-gated write a viewer cannot make. A folded
  header still shows its `done/total`.
- **Move to** opens a flat chooser of the list's groups and "No group" (one tap commits; no hover
  submenu), reachable from the row menu and from the long-press menu at 360px.

### Who a group is for (Phase 6)

`setCategoryAssignees(scope, categoryId, userIds)`: resolve the group (I2), take the trip **from the
group** (never from a request value), read `listTripMembers`, treat an empty membership as "not your
trip", **reject the whole call** if any id is not a member (a silently dropped assignee is
indistinguishable from a saved one), de-duplicate, cap at 50, replace the join rows in one batch, and
return the ids that were **added**: the caller needs to know whom to notify and re-deriving it from a
diff at the call site is how a notification goes out twice. The validation error is one generic
sentence that does not reveal whether an id exists in the organisation. Guests are not assignable
here (a guest is "a display name only, never a recipient"; `05-S5` owns them).

A traveller who leaves the trip is not cleaned out of `packing_category_members`; every read stitches
only assignees who are still `trip_members` (`removeTripMember` is not this spec's file, and a stale
row is harmless).

`setCategoryAssigneesFn` then calls `dispatchQuietly(scope, event)` once
(`src/server/notifications/dispatch.ts`), never `notify()` and never its own recipient resolution:
`kind: 'list.assigned'` (the preference `eventType`: the settings screen already has an "Assigned
items" row, so opt-out exists with no new row), `titleKey` and `bodyKey` `list.category_assigned`,
`audienceUserIds` the **added** ids only (the actor is removed by `dispatch`), params
`{ actorName, categoryName, listName, tripTitle }` (names, never emails; every recipient is a trip
member who can already see all four). The stored sentences are
`shell.notification.list.category_assigned.title|body` in the 23 locales and the event joins
`STORED_EVENTS` in `src/components/layout/__tests__/copy-rules.test.ts`. A dispatch failure is
logged and the assignment still succeeds.

### The starter set (Phase 5)

`src/lib/lists/starter-set.ts` exports the set as **catalogue keys**, not English: five groups
(documents, clothing, toiletries, tech, health) and four rows each, every row quantity `1` (a count
derived from nights is wrong the moment the dates move, and a copy would carry the wrong number).
The module has no JSX and no server import. The client resolves the keys in the reader's language
(this is what keeps the preview and the insert one source, and what makes a Polish traveller's rows
Polish), previews the set in the empty-list state, and sends `{ listId, groups: [{ name, items:
[{ name, quantity }] }] }` to `seedStarterSetFn`. Zod checks shape and length only; the repository's
`seedStarterCategories` refuses a list that already has a group or an item (a second press, or a
second tab, is a quiet no-op for the traveller and a refusal for the repository), counts the ceilings
before it starts, creates groups with `onConflictDoNothing` on `(list_id, name)` and items in one
batch. The names are ordinary user rows; the server does not claim they are canonical. Offered on
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
For the source trip it copies every list, group and item to the target with new ids, **ticks
reset** (`is_done` false, `done_at` null), `assigned_to`, group assignees and the list's
`owner_user_id` left empty (a copy is a plan for a journey nobody has packed for, and an owner may
not be on the target trip), `category_id` remapped only through ids created in this run, legacy
string-only items copied as they are. It reads the source through `tenantFilter()` bound to the
source trip, **clears only the target's own list rows first** (the registry's idempotency contract:
the queue may redeliver), chunks at `floor(100 / columns)` and returns its `CopierReport`. The
trip-copy dialog's sentence ("Days, places and notes come across…", `shell.copyTrip.carries`) is
updated to name packing lists in all 23 locales. To-dos are `05-S4`'s copier.

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
Phase 6), `packing_items.category_id` (new, nullable, `SET NULL`). One additive migration in Phase 2,
generated by `pnpm db:generate`, read before it is applied, never hand-edited. `src/routeTree.gen.ts`
is not touched: no route file is added. Rollback: the previous Worker ignores both tables and the
column and keeps reading `category`, which I1 keeps populated.

## 📝 API Contracts

Server functions as in the table above. Loader payload additions (`ListsPayload`, `ListCard` in
`src/routes/_app/-server/trip.ts`): each list gains `categories: Array<{ id, name, sortOrder,
assigneeUserIds }>` (assignees empty before Phase 6) and each item gains `categoryId: string | null`.
`ListData` and `ListItemData` in `src/components/modules/lists/types.ts` gain the same fields, so the
route (`lists.tsx`) passes its loader data straight in and needs no edit for them.

Repository exports (all through the `src/server/repos/index.ts` barrel, whose module table gets the
two new tables): `listListCategories`, `listTripCategories`, `createListCategory`,
`renameListCategory`, `deleteListCategory`, `reorderListCategories`, `adoptListCategories`,
`assignItemToCategory`, `seedStarterCategories`, `setCategoryAssignees`, and the constants
`MAX_CATEGORIES_PER_LIST`, `MAX_ITEMS_PER_LIST`. `adoptStringCategories` is module-private.

## 📝 UI/UX

**Route.** `/trips/$tripId/lists`, unchanged, default SSR, `ListsPending` and `ErrorPanel` kept.
`lists.tsx` has one edit, in Phase 1: its `formatWeight(overall.weightGrams)` passes the reader's
`locale` (already in scope there), so the card and the panel agree in every language.

**The board splits (Phase 1)** along the seams it has: `lists-board.tsx` keeps the grid and
board-level states and drops to the module header; `list-panel.tsx` is one list (header, toolbar slot,
groups, footer totals); `item-row.tsx` takes `ItemRow`, `SortableItems`, `SortableItemRow`,
`AssigneeMenu` and `InlineItemComposer` with their `@dnd-kit` wiring intact; `list-toolbar.tsx` takes
the filter row. `category-section.tsx` arrives in Phase 2. The split moves code and rewrites no
behaviour **except one**: the private `formatWeight` (and its three call sites: the packed-of line
twice and the per-row figure) is deleted in favour of `#/lib/format`, called with `useLocale()`.
`weightSummary(weightGrams, weightLimitGrams, locale)` becomes a pure function in `list-utils.ts`
(a sentence assembled inline in a component is a sentence no test reaches), and its test asserts that
for 2 000 g the sentence contains `formatWeight(2000)` imported from `#/lib/format`, which the deleted
`.toFixed(1)` implementation fails. `grep -rn "function formatWeight" src` then returns exactly one
line, `src/lib/format.ts`.

**A group's header** (`category-section.tsx`): colour-free, name (truncated, wrapping at 360px under
its counts), `done/total` in `tabular-nums`, a collapse chevron (Phase 4), the people chip (Phase 6),
and an overflow menu (rename, delete; move up and down in Phase 4). Published `data-part` hooks, kept
because a class does not survive a restyle and the blind-pair capture clicks them:
`category-collapse` on the toggle, `category-people` on the people trigger, `category-legacy` on a
legacy header's wrapper; a record header never carries the third and a legacy header neither of the
others.

**States**, each distinct from the others:

- **Board empty** (no lists): the existing empty state, unchanged.
- **List empty** (no group, no item): an inset panel on `--color-surface-2` with "Add a group" as the
  action and, on `packing` lists, "Add the starter set" (Phase 5) with a one-line preview of what it
  contains.
- **Group empty** (every row moved out): one muted row, "Nothing in this group yet", with its own
  composer open behind it (Phase 3); not a card-sized empty state.
- **Legacy group** (string headings on rows nobody has converted): rendered **read-only after every
  record group**, with no chevron, no menu, no chip, the counts, and one block: "These headings can't
  be renamed or folded yet." and the button **Make them groups** (a `POST`, disabled with a spinner
  while it runs, disabled with its reason when the conversion would pass the 40-group ceiling —
  computed on the client from the payload). After it succeeds a toast says "Now you can rename them,
  fold them away and give each one to someone." The word "migration" appears nowhere. This state is
  reachable only backwards in time; it must never render for something the reader just did, which is
  why every writer in the table above moves in the same spec.
- **Filtered empty:** "Everything here is packed" / "Nothing has been ticked yet", distinct from the
  list-empty and group-empty states (the existing `lists.items.*Empty` keys, kept).
- **Ceilings:** "Add a group" is disabled at 40 groups and the composer at 500 items, each with a
  tooltip naming the ceiling.
- **Optimistic writes** (rename, move) apply at once and roll back with a toast naming the reason.

**Putting a row into a group.** The item dialog's free-text category input and datalist are replaced
by a select of the list's groups plus "No group" (a dialog opened from a group preselects it); the
footer composer adds loose rows; each group header has one "+" that opens a composer inside that
group, one open at a time, so a phone has one keyboard target instead of five; "Move to" is in the row
menu and the long-press menu (Phase 3). A legacy row's dialog opens with no group selected and saves
without touching it unless the traveller picks one. `knownCategories` becomes unused and is deleted
with its test cases (the orphan this change creates).

**The mode toggle** ("grouped" / "order") stays; its labels say "groups", not "category".

**Responsive.** At 360px a list is one full-width panel, the header wraps its counts under the name,
the chips collapse to one `AvatarStack` with an overflow count, row actions are the long-press
`ContextMenu`; at 1280px two panels sit side by side (the existing grid); the page keeps its measure
at 2560px. **Tokens only** from `src/styles/tokens.css` (no token is missing, so none is requested);
`tabular-nums` on every figure that can change. **Motion** for the collapse (Phase 4) is transform and
opacity at `--duration` on `--ease-out-quint`, and `prefers-reduced-motion: reduce` makes it an
opacity change.

**Primitives reused from `src/components/ui`, none re-implemented:** `Card`, `Checkbox`, `Chip`,
`Badge`, `IconButton`, `DropdownMenu`, `ContextMenu`, `Combobox`/`MultiCombobox`, `AvatarStack`,
`Progress`, `Input`, `Field`, `Tooltip`, `SectionLabel`, `EmptyState`, `Skeleton`, `Alert`, `Button`,
`Dialog`, `toast`. No new primitive.

## 📝 Visual change expected

Route `/trips/$tripId/lists`, light and dark, 360 / 1280 / 2560:

- Phase 1: none, except one figure (a 2 000 g pack reads `2 kg`, not `2.0 kg`, and a fractional
  kilogram takes the locale's separator).
- Phase 2: a group header (name, `done/total`, overflow menu) replaces the read-only `<h3>`; a toolbar
  "Add a group"; the legacy block and its button on lists not yet converted; the item dialog's group
  select.
- Phase 3: a "+" on each group header and its composer; "Move to" in the row menu.
- Phase 4: the collapse chevron and a folded header; "Move up / Move down".
- Phase 5: the list-empty state with the starter-set preview and button.
- Phase 6: the people chip on a header and its picker.
- Phase 7: no screen of its own (the copy dialog's sentence changes).

Judged as the **blind A/B pair** (`scripts/visual/capture.mjs`, `--auth`, `--click
'[data-part="category-collapse"]'`, `--click '[data-part="category-people"]'`) against a demo trip
whose "Group kit" list has groups (the seed now produces them); a second demo list left on string
headings, if the fixture keeps one, shows the legacy block.

## 📝 Copy

Every string below is an `en` key in the `modules` namespace (rendered as `modules.lists.*`) unless
noted, and lands in all 23 locales in the same change (`i18n-messages` skill; the parity test enforces
it; Polish, Russian, Ukrainian, Czech and Arabic need their plural branches). **Retired** (removed
from all 23 files): `lists.item.field.categoryHint`, `lists.item.field.categoryPlaceholder`,
`lists.menu.groupAgain`, `lists.menu.groupByCategory` (reworded below) and `lists.quickAdd.detailsHint`
(reworded to "group").

| Key                                                      | English                                                                                      | Phase |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----- |
| `lists.group.add`                                        | Add a group                                                                                  | 2     |
| `lists.group.dialog.addTitle`                            | Add a group                                                                                  | 2     |
| `lists.group.dialog.renameTitle`                         | Rename this group                                                                            | 2     |
| `lists.group.field.name`                                 | Group name                                                                                   | 2     |
| `lists.group.field.namePlaceholder`                      | Clothing                                                                                     | 2     |
| `lists.group.error.name`                                 | A group name is 1 to 60 characters.                                                          | 2     |
| `lists.group.error.duplicate`                            | This list already has a group with that name.                                                | 2     |
| `lists.group.error.ceiling`                              | A list holds up to 40 groups.                                                                | 2     |
| `lists.group.menu.rename`                                | Rename group…                                                                                | 2     |
| `lists.group.menu.delete`                                | Delete group                                                                                 | 2     |
| `lists.group.remove.body` (plural)                       | The {count} item in it stays on the list, without a group. / The {count} items in it stay…   | 2     |
| `lists.group.toast.added`, `.renamed`, `.removed`        | Group added / Group renamed / Group deleted                                                  | 2     |
| `lists.group.toast.failed`                               | That did not save. The group is as it was.                                                   | 2     |
| `lists.group.legacy.body`                                | These headings can't be renamed or folded yet.                                               | 2     |
| `lists.group.legacy.action`                              | Make them groups                                                                             | 2     |
| `lists.group.legacy.done`                                | Now you can rename them, fold them away and give each one to someone.                        | 2     |
| `lists.group.legacy.ceiling`                             | Together with the groups already here these would pass the 40-group limit.                   | 2     |
| `lists.item.field.group`, `.groupHint`                   | Group / Optional. Items without one sit under "Everything else".                             | 2     |
| `lists.item.field.groupNone`                             | No group                                                                                     | 2     |
| `lists.menu.showGroups`, `lists.menu.showOrder`          | Show in groups / Show as one list you can reorder (and their long forms)                     | 2     |
| `lists.quickAdd.detailsHint`                             | Add with a weight, a group or an owner                                                       | 2     |
| `lists.group.addItem`                                    | Add an item to {name}                                                                        | 3     |
| `lists.group.empty`                                      | Nothing in this group yet                                                                    | 3     |
| `lists.item.menu.moveTo`, `lists.item.moveTo.title`      | Move to… / Move “{name}” to                                                                  | 3     |
| `lists.group.menu.up`, `.down`                           | Move up / Move down                                                                          | 4     |
| `lists.group.collapse`, `lists.group.expand`             | Fold {name} / Open {name}                                                                    | 4     |
| `lists.starter.action`, `lists.starter.preview`          | Add the starter set / Documents, clothing, toiletries, tech and health — about 20 things.    | 5     |
| `lists.starter.toast`                                    | Starter set added                                                                            | 5     |
| `lists.starter.group.*` (5), `lists.starter.item.*` (20) | the group and row names above, one key each                                                  | 5     |
| `lists.group.people`, `.peopleAria`, `.peopleNone`       | Who it is for / Choose who {name} is for / Nobody yet                                        | 6     |
| `lists.group.toast.assigned`                             | Saved. {count} told.                                                                         | 6     |
| `shell.notification.list.category_assigned.title`        | {actorName} gave you a group                                                                 | 6     |
| `shell.notification.list.category_assigned.body`         | “{categoryName}” in {listName}, {tripTitle}.                                                 | 6     |
| `shell.copyTrip.carries`                                 | Days, places, notes and packing lists come across. Bookings, money, files and people do not. | 7     |

## 📝 Edge Cases & Failure Scenarios

- **Two travellers adopt the same list** at once: the second `onConflictDoNothing` insert writes
  nothing and its update matches nothing; both see the same groups.
- **A rolled-back Worker writes a string row after the migration:** the row is legacy; the legacy
  block and button handle it, the next adoption converts it.
- **A heading collides case-insensitively with a group** (`Tech` / `tech`): adoption maps by exact
  string (the correlated update compares `name = category`), and the case-insensitive refusal applies
  to **create and rename**, not to adoption; two headings differing only in case adopt as two groups,
  which the traveller can then rename. Stated, not hidden.
- **Delete a group with 500 items:** one batch, released count returned, no per-row event.
- **A stale tab renames a group deleted elsewhere:** `NotFoundError`, the caller's fallback toast, the
  board revalidates.
- **A viewer opens the board:** sees groups and `done/total`; every group action is absent, not just
  disabled (`canWrite` removes the affordance); a forged call is refused with the authored role
  sentence. An archived trip is refused with the archived sentence.
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
and the locale's separator in `de`; `weightSummary` has the test described above.

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
legacy block renders after the record groups, read-only, with the button; the button converts.
The seed produces groups. The tenant-isolation suite has cases for both new tables.

**Phase 3.** "Move to" and the group "+" composer put a row into a group in one tap/enter; moving to
"No group" nulls the id and the string; a group in another list is refused (I2); the patch carries
`categoryId`.

**Phase 4.** Collapse persists per reader across reloads and is never sent to the server; reorder
applies in one batch and the end items of the menu are disabled; both survive a failed write by
reverting.

**Phase 5.** The set is offered on empty `packing` lists only; pressing it creates five groups and
twenty unticked rows in the reader's language; a second press changes nothing; the names are distinct
in all 23 locales; the repository refuses a list that already has a group or an item.

**Phase 6.** Assigning replaces the join rows in one batch, returns only the added ids, notifies
exactly those (not the actor, not a non-member), and rejects the whole call when any id is not a member
of the group's trip; the chip shows only current members.

**Phase 7.** Copying a trip copies lists, groups and items with ticks reset and no assignees or list
owner, remaps group ids, is idempotent on redelivery, and leaves the source byte-for-byte unchanged; a
copy of a trip from another organisation is refused.

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
  for the copier from another organisation. The security and tenancy reviewer approved this design
  (Resolved assumptions) and its conditions are in the acceptance criteria.
- **Cross-trip addressing inside one tenant** (pre-existing): a list or item id is used without being
  tied to the authorised trip, so a member who can read trip A can address a row of a private trip B
  in the same organisation. The new writers close it for themselves (I2); F1 closes it for the old
  ones. The tenant-isolation suite cannot see it (both trips are in one tenant), so each new writer
  gets a same-organisation, other-trip case.
- **Rollback:** additive; the previous Worker keeps reading `category` (I1).
- **Rows written by the previous Worker after the migration** are legacy until the button converts
  them; documented, not repaired automatically.
- **Batch size:** a 500-item template is about ninety statements; asserted in a test.
- **Notification volume:** one dispatch per save, to the added people only.

### Out of scope, noticed on the way (follow-up issues, not built here)

- **F1 (`security`):** the existing list and item writers (`createListFn`, `updateListFn`,
  `deleteListFn`, `resetListFn`, `deleteListItemFn`, `setListItemsDoneFn`, `reorderListItemsFn`)
  check `requireTrip` only: no role, no archived check, and the child id is not tied to the trip. Add
  `requireWritableTrip`, the role and the same-trip check (decide first whether a viewer may tick).
- **F2:** `lists.tsx` hard-codes English in its stat cards and caption (`'Pack weight'`, `'shared
list'`); move to the catalogue.
- **F3:** drop `packing_items.category` after the rollback window.
- **F4:** a shared (stored) collapse, if travellers ask for it: an additive column and one function.

## 📋 Phasing

| #   | Phase                                                                                                        | Blocked by | Risk          | Ticket-sized because                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------- | ------------- | --------------------------------------------------------------------------------------- |
| 1   | Split the board; one weight formatter                                                                        | none       | `risk-low`    | no schema, no server                                                                    |
| 2   | Groups are records (migration, create / rename / delete / adopt, writers, seed, dialog select, legacy block) | 1          | `risk-high`   | the migration and the writer move cannot be separated, or a fresh write would be legacy |
| 3   | Move a row; a composer inside each group                                                                     | 2          | `risk-medium` | one server function and two UI paths                                                    |
| 4   | Fold a group; order the groups                                                                               | 2          | `risk-low`    | local state + one server function                                                       |
| 5   | The starter set                                                                                              | 2          | `risk-low`    | one server function, one module, 25 keys × 23 locales                                   |
| 6   | Who a group is for                                                                                           | 2          | `risk-medium` | membership validation and the notification                                              |
| 7   | The packing trip copier                                                                                      | 2          | `risk-medium` | a registered copier and its sentence                                                    |

Phases 3 to 7 are independent of each other; each is `Blocked by` Phase 2 only. `00-S2` (the
dispatcher, Phase 6's prerequisite) has landed at HEAD (`src/server/notifications/dispatch.ts`).
Priority for every ticket: `priority-medium`.

## 📋 Implementation Plan

### Phase 1 — Split the board; one weight formatter

Owned: `lists-board.tsx`, new `list-panel.tsx`, `item-row.tsx`, `list-toolbar.tsx`, `list-utils.ts`
(`weightSummary`), `index.ts`, `__tests__/list-utils.test.ts`, `lists.tsx` (the `locale` argument).
Move code, rewrite no behaviour, delete the private `formatWeight`, add `weightSummary` and its test.
Done when the Phase 1 criteria hold and the existing board tests are green.

### Phase 2 — Groups are records

Owned: `src/server/db/schema.ts` + the generated migration; `src/server/repos/lists.ts` (handles,
create / rename / delete / adopt, ceilings, `listListCategories`, `listTripCategories`, writers moved,
docstring corrected); `src/server/repos/index.ts` barrel table; `src/server/fns/lists.ts`
(`writableListsTrip`, four functions, `categoryId` on the two item functions, guards on them);
`src/routes/_app/-server/trip.ts` (`loadTripLists`); `types.ts`, `list-utils.ts` (grouping with legacy
fallback; delete `knownCategories`), new `category-section.tsx`, `list-panel.tsx`, `list-dialogs.tsx`
(group select, group dialog), the legacy block; `src/routes/api/dev/-seed/apply-trip.ts`; CONTEXT.md
(one glossary entry: **Packing group**); catalogue keys. Tests: new
`src/server/repos/__tests__/lists-categories.test.ts` (adoption's six cases, the writer-migration five,
rename / delete / duplicate, ceilings at the ceiling and not one row before, reads never write),
`list-utils.test.ts` (grouping by id then string, legacy after record groups), cases appended to
`tenant-isolation.test.ts` (`isolationCase` for both repositories, `seedWorld` gains a group; foreign
`listId`, `categoryId`, item with another trip's group in the same org, adoption and `applyTemplateToTrip`
both directions with counts unchanged), component tests for the header and legacy block asserting the
`data-part` hooks. Read the generated SQL before applying it.

### Phase 3 — Move a row; a composer inside each group

`assignItemToCategory` (adopts first, then I2), `moveItemToCategoryFn`, "Move to" chooser (row and
long-press menus), the per-group "+" composer, the group-empty state; the `packing-item` patch
carries `categoryId`. Isolation cases for item↔group pairs across tenants and across lists.

### Phase 4 — Fold a group; order the groups

Per-reader collapse hook (browser storage keyed by group id, hydration-safe), `reorderListCategories`
and its function, "Move up / Move down", motion at `--duration`. Tests: the hook's SSR/hydration
behaviour, reorder set-equality and one-batch property.

### Phase 5 — The starter set

`src/lib/lists/starter-set.ts` and its test (every group has rows, quantities positive integers,
unique keys, total below 500), `seedStarterCategories`, `seedStarterSetFn`, the list-empty state with
preview and button (packing lists only), 25 keys in 23 locales, a catalogue test that the five group
names are distinct per locale.

### Phase 6 — Who a group is for

`setCategoryAssignees`, `setCategoryAssigneesFn`, the picker (`MultiCombobox`) and `AvatarStack` chip
(`category-people`), `list.category_assigned` stored copy in 23 locales and in `STORED_EVENTS`, the
loader stitching current members only. Isolation: a member of another trip's id is rejected, not
dropped; a foreign group.

### Phase 7 — The packing trip copier

`registerTripCopier('packing', …)` in `lists.ts`, its tests (`src/server/repos/__tests__/lists-copier.test.ts`:
ticks reset, no assignees or owner, id remap, idempotent twice, source unchanged, cross-organisation
refused) and the `shell.copyTrip.carries` sentence in 23 locales; the queue consumer is shown to load
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

| #   | Question                                                     | Applied default                                                                                                                                                                    | Why                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is "rename blocked while an item is ticked" kept?            | No. A group can always be renamed; a duplicate name in the same list is refused.                                                                                                   | Decided by the product owner sub-agent (confidence high): a group name is a heading, not a packing record; the rule freezes every group from the first tick.                                                    |
| 2   | Starter set: when and for which lists?                       | An explicit button on empty lists of kind `packing` only, with a preview; never automatic.                                                                                         | Decided by the product owner sub-agent (confidence high): the content is packing content, and an automatic apply puts rows in a list nobody asked to fill.                                                      |
| 3   | Moving rows and ordering groups?                             | Row "Move to" (flat chooser) and group "Move up / Move down" in menus; no cross-group drag.                                                                                        | Decided by the product owner sub-agent (confidence high): the drag exists only in the flat order mode, SC 2.5.7 requires the non-drag path, and one function serves both gestures later.                        |
| 4   | Is the packing copier in this stage, and does the seed move? | Yes to both (Phase 7 and Phase 2).                                                                                                                                                 | Decided by the product owner sub-agent (confidence high): the plan's preamble gives 05-S1 the copier, `CONTEXT.md` already promises it, and the seed calls the writer that loses its string input.              |
| 5   | Slicing.                                                     | Seven phases; rename, delete and the dialog's select ship with Phase 2, "Move to" and the group composer with Phase 3.                                                             | Decided by the product owner sub-agent (confidence medium): Phase 2 removes the free-text field, so without rename, delete and a select a traveller is worse off on `develop`.                                  |
| 6   | Who owns the migration?                                      | This spec, one migration in Phase 2 with all three pieces.                                                                                                                         | Decided by the software architect sub-agent (confidence high): the foundations schema stage is not a ticket; two migrations double the `drizzle/` review for an inert table.                                    |
| 7   | What do writers do with the legacy string?                   | Invariant I1: the string mirrors the record; rename rewrites it, delete nulls it, item writers take `categoryId` only.                                                             | Decided by the software architect sub-agent (confidence high): one owner and one testable invariant keep the rollback guarantee and stop a deleted group resurrecting.                                          |
| 8   | Guards on the new writers?                                   | `requireWritableTrip` + `assertTripRole(['owner','editor'])`, child resolved and its trip compared; the two item writers become guarded too; the rest of the old writers go to F1. | Decided by the software architect (confidence medium) and security and tenancy (confidence high) sub-agents: no new verb weaker than day-notes, and `categoryId` must not be writable by a weaker path.         |
| 9   | Starter set copy source?                                     | Catalogue keys resolved on the client; `seedStarterSetFn` takes names and quantities.                                                                                              | Decided by the software architect sub-agent (confidence medium): §9 forbids hard-coded copy, and a server-side catalogue load couples a repo write to locale negotiation.                                       |
| 10  | Notification identity?                                       | `kind: 'list.assigned'` with `list.category_assigned` keys, `STORED_EVENTS` entry, `dispatchQuietly`, added ids only.                                                              | Decided by the software architect sub-agent (confidence high): the preference row exists, so opt-out exists with no new settings row.                                                                           |
| 11  | Loader seam and adoption shape?                              | `categories` per list in `loadTripLists`; adoption reads in JS, mints ids in JS, one `runBatch` of chunked `onConflictDoNothing` inserts and a correlated update.                  | Decided by the software architect sub-agent (confidence medium): SQL cannot mint ids (`$defaultFn`), 40 rows exceed 100 bound parameters, and the ceiling is soft under concurrency.                            |
| 12  | Collapse: shared or per reader?                              | Per reader, browser storage, no column, no function.                                                                                                                               | Decided by the traveller sub-agent (confidence medium): a shared fold hides one traveller's items on another's phone and costs a `POST` per tap; adding a shared column later is additive.                      |
| 13  | Legacy conversion path?                                      | A dedicated "Make them groups" button (`adoptListCategoriesFn`) besides "Add a group"; the label "Ungrouped heading" is dropped.                                                   | Decided by the traveller sub-agent (confidence medium): otherwise the only way to rename a heading is to invent a group; still no write in a loader.                                                            |
| 14  | How does a row get into a group?                             | Dialog select, loose footer composer, a "+" composer inside each group (one open at a time), "Move to".                                                                            | Decided by the traveller sub-agent (confidence high): packing is done by group on a phone; a free-text field would mint duplicate groups past the ceiling.                                                      |
| 15  | Starter set contents and quantities?                         | The five groups and twenty rows above, every quantity 1, in the reader's language.                                                                                                 | Decided by the traveller sub-agent (confidence high): a count from nights is wrong once the dates move and a copy would carry it.                                                                               |
| 16  | The `colour` column on groups?                               | Dropped.                                                                                                                                                                           | Default applied: no stage lets a traveller choose one; a nullable column is additive later.                                                                                                                     |
| 17  | Same tenant, other trip?                                     | Every new writer compares the child's `trip_id` and `list_id` to the authorised trip; F1 files the old writers.                                                                    | Decided by the security and tenancy sub-agent (confidence high): `requireTrip` hides private trips from non-members but nothing ties a child id to it; a composite FK is impossible (`SET NULL` vs `NOT NULL`). |
| 18  | Assignees who leave the trip?                                | Stored rows stay; reads show current members only; an unknown id rejects the whole call with one generic sentence.                                                                 | Decided by the security and tenancy sub-agent (confidence medium): `removeTripMember` is not this spec's file and a stale row discloses nothing.                                                                |
| 19  | Risk label?                                                  | The spec PR is `risk-low` (its diff is documentation, which is how `SDLC.md` defines risk); the Phase 2 ticket is `risk-high` (it touches `schema.ts` and `drizzle/`).             | Decided by the security and tenancy sub-agent (confidence high) for the implementation; the PR's own label follows the diff.                                                                                    |
| 20  | Verification in place of the plan's baselines?               | Vitest and jsdom plus the blind pair; no `e2e/` file.                                                                                                                              | ADR 0016 removed the visual gate and `e2e/__screenshots__`; one defensible answer in the repository.                                                                                                            |
| 21  | `LIST_LIMIT` reaching the traveller?                         | The UI disables the action at the ceiling and names it; the server check is a backstop whose failure is the caller's fallback.                                                     | Default applied: `LIST_LIMIT` is not an authored error (`src/server/errors/public.ts`), and a new authored class does not join that closed list.                                                                |
| 22  | The plan's `src/routes/_app/-lib/notifications.ts`?          | Does not exist; the copy is `shell.notification.list.category_assigned.*`.                                                                                                         | One defensible answer in the code.                                                                                                                                                                              |
| 23  | Panel verdicts (rounds 1 and 2)?                             | _filled in step 5_                                                                                                                                                                 | _filled in step 5_                                                                                                                                                                                              |
