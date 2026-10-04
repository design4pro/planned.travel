# Keep a list as a template, and manage the workspace's template library

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **Status**         | ready                                      |
| **Issue**          | none                                       |
| **Spec PR**        | none                                       |
| **Implementation** | none                                       |
| **Plan**           | 05-S2 (docs/plans/05-packing-and-todos.md) |

## 📝 TLDR

Plan stage `05-S2` closes reference row `LST-04` (templates and the template library) on the lists
tab (`/trips/$tripId/lists`). Today a traveller can apply a template but **cannot save one or delete
one**: `createTemplate`, `deleteTemplate` and `createTemplateFromList` in `src/server/repos/lists.ts`
have no caller, and the dialog's own empty state promises a way to save that does not exist. This
stage adds **Save as template** to each list's menu (with a name-clash flow that never raises a
database error and offers "Save as a copy"), **Delete** on each template of the library, and the
repository work without which neither would function on D1: saving a list of 12 or more items, and
applying a template of 10 or more, **fail in production today** (measured below).

The stage is cut into four slices: the repository (Phase 1), two server functions (Phase 2), then the
library's Delete (Phase 3) and the Save dialog (Phase 4), which are independent of each other. It
describes the work **left** at HEAD (`9a2f4f0e`) and departs from the plan's stage block in five
places, each a row of the Resolved assumptions table: the plan forbade any repository edit, left out
the D1 defect, offered a `Replace it` flow, hid the library entry on an empty workspace, and ran no
authorisation beyond "can read the trip".

## 📝 Problem Statement

Today (`LST-04` is `partial`):

- `TemplateDialog` (`src/components/modules/lists/list-dialogs.tsx:519`) lists the workspace's
  templates (name, item count, first four names), applies the selected one as a **new list** on the
  trip (`applyListTemplateFn`, `src/server/fns/lists.ts`), and has loading, error and empty states.
  Its entry is the always-present "From a template" button in the board's filter row
  (`lists-board.tsx:300-310`). Its empty state says "Save a list as a template once you have one you
  would build again" (`src/lib/i18n/messages/en/modules.ts:501`) and there is nothing to press.
- `createTemplate`, `deleteTemplate`, `createTemplateFromList` (`src/server/repos/lists.ts:310,332,379`)
  are reached only from tests. The database always holds zero templates unless a test or a seed put
  them there.
- **The repository half the plan calls "already written" does not work for a real list.** The test
  harness enforces D1's 100-bound-parameter ceiling (`src/server/repos/__tests__/harness.ts:82`,
  `MAX_BOUND_PARAMETERS`). Measured on HEAD with a throwaway probe test (deleted): `createTemplateFromList`
  on a list of 11 items passes and on **12 items** throws `D1 refuses a statement with 108 bound
parameters`; 30 items binds 270. `applyTemplateToTrip` throws at **10 items** (120 parameters) and
  passes only up to 8. Cause: both go through `insertMany` (`src/server/repos/base.ts:219-236`), one
  unchunked `insert().values(records)`. The existing tests use two items, so nothing catches it. The
  same code writes the template row and its items as two separate statements, so a failure between
  them leaves an empty template holding the name.
- Saving the same list twice raises a raw `UNIQUE` violation (`packing_templates_org_name_unq` on
  `(organization_id, name)`, case-sensitive, `src/server/db/schema.ts:1670`), because
  `createTemplateFromList` defaults the template's name to the list's name. Probe-confirmed; it would
  reach the reader as a generic failure.
- No role or authorship rule exists anywhere on a template: `deleteTemplate` is `requireRemove` (the
  row is in the tenant) and nothing else.

Missing, and what a traveller who plans trips more than once asks of this screen: _I built a good
list. Can I keep it, and start the next trip from it?_

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                          | Not owned (read only, or left alone)                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/server/repos/lists.ts` — edit: `createTemplate`, `applyTemplateToTrip` (D1-safe, atomic), `deleteTemplate` (author rule), limits | `src/server/db/schema.ts` and `drizzle/` — **no migration**, no column, no index, no CHECK                             |
| `src/server/repos/__tests__/lists-templates.test.ts` — new; `tenant-isolation.test.ts` — append                                       | Every other function of `lists.ts` (list and item writers) and `src/server/fns/lists.ts`'s list/item writers           |
| `src/server/fns/list-template-writes.ts` — new, plain functions; `src/server/fns/list-templates.ts` — new, the two server functions   | `applyListTemplateFn` — unchanged (its guards are a follow-up, F2)                                                     |
| `src/server/fns/lists.ts` — edit: `loadListTemplatesFn` and `ListTemplateOption` gain `canDelete`, nothing else                       | `src/server/do/protocol.ts`, `src/server/worker.ts`, `wrangler.jsonc`, `src/styles/tokens.css`, `src/components/ui/**` |
| `src/server/fns/__tests__/list-template-writes.test.ts` — new                                                                         | `src/lib/format.ts`, `src/routeTree.gen.ts` (no route is added or edited; no `pnpm generate-routes`)                   |
| `src/components/modules/lists/save-template-dialog.tsx` — new; `list-dialogs.tsx`, `lists-board.tsx`, `index.ts` — edit               | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                                           |
| `src/components/modules/lists/__tests__/save-template-dialog.test.tsx`, `template-dialog.test.tsx` — new                              | `e2e/` — no declaration is added (see Verification)                                                                    |
| `src/lib/i18n/messages/<locale>/modules.ts` — edit, **all 23 locales**                                                                |                                                                                                                        |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, any document the Phase 1 grep names              |                                                                                                                        |

**The plan's file-ownership reasoning no longer binds.** `05-S2` forbids any edit under
`src/server/repos` and puts its functions in a new fns file only because `05-S3` and `05-S4` hold
`lists.ts` and `src/server/fns/lists.ts` exclusively in the same wave. Tickets are now implemented one
at a time, so no two stages edit a module in parallel; the constraint cannot be kept anyway (the
D1 defect lives in `lists.ts`). The plan's `e2e/packing-and-todos.visual.spec.ts` and
`e2e/__screenshots__/` are **struck**: ADR 0016 removed screenshot baselines and the visual judgement
is the blind A/B pair (`scripts/visual/capture.mjs`).

### Dependency on plan stage `05-S1`

`05-S1` (categories become records, `list-panel.tsx`, `list-toolbar.tsx`) has **not** landed at HEAD:
there is no `packing_categories` table and no toolbar, and its own spec is being written
concurrently. It will migrate `applyTemplateToTrip` and `createTemplateFromList` onto category
records; that migration is `05-S1`'s, not this stage's, and **this stage keeps both functions
category-agnostic** (it never reads or writes `category`/`category_id` differently from HEAD), so
`05-S1` rebases cleanly in either order. The consequences, per slice:

- **Phases 1 and 2 have no blocker.** The repository fix and the server functions work at HEAD and
  after `05-S1`.
- **Phases 3 and 4 are `Blocked by` every ticket sliced from the spec whose `Plan` row is `05-S1`**, so
  they are built on the list actions `05-S1` leaves (a `list-toolbar.tsx`, per the plan). Where this
  spec says "the list's menu" it means that menu: at HEAD the header `RowMenu` of `lists-board.tsx`
  (`:520-562`); if `05-S1` relocated it, the same action in its new home. The behaviour is the
  requirement; the host is whatever the code has when the ticket runs. A slicing run that finds the
  `05-S1` spec unsliced slices that (older) spec first.
- Two assertions are therefore owed **by `05-S1`, not here**: that applying a template yields category
  records, and that saving such a list round-trips its group names. Phase 1's tests assert only the
  string form that exists today.

### Phase 1 — The repository: D1-safe, atomic, with the rules a template needs

All in `src/server/repos/lists.ts`; no new SQL outside it, every statement stamped with
`organization_id` from the scope.

1. **`createTemplate`** writes the template row and its items in **one `runBatch`**
   (`src/server/repos/batch.ts:35`): the template id is minted up front with `newId()`
   (`src/server/db/schema.ts:82`), then one statement for the template and one statement per chunk of
   `chunkFor(boundParametersPerRow(packingTemplateItems))` item rows
   (`batch.ts:27,34`) — the shape `transports.ts:1049-1056` already uses. Raw `scope.db.insert(...)`
   statements stamp `organizationId: scope.ctx.organizationId` explicitly, as that precedent does.
   The function re-reads the template through `packingTemplatesRepository.requireById` and returns it
   (same return type as today: callers use `.id`). A failure now leaves neither row.
2. **`applyTemplateToTrip`** does the same for its list row and its item rows (one batch, chunked by
   `boundParametersPerRow(packingItems)`, which is conservative: 5 rows a statement). The change is
   **conditional on the code's state when the ticket runs**: the ticket first adds the 30-row and
   500-row apply tests below; if they already pass (`05-S1` having batched the function), it edits
   nothing and keeps the tests, and if they fail it makes them pass without touching how `category` or
   `category_id` is written.
3. **Limits.** `MAX_TEMPLATES_PER_WORKSPACE = 100` and `MAX_TEMPLATE_ITEMS = 500` (the latter replaces
   the literal `500` in `createTemplateInput.items`, `lists.ts:112`) are exported constants.
   `createTemplate` counts the workspace's templates (`packingTemplatesRepository.count(scope)`) and
   throws `TemplateLimitError` (`extends RepositoryError`, code `'TEMPLATE_LIMIT'`, fields
   `limit: 'templates' | 'items'` and `max`) at 100, and throws it with `limit: 'items'` when
   `items.length > MAX_TEMPLATE_ITEMS`, **before** Zod's own `.max()` would. There is no quota metric:
   `USAGE_METRICS` is CHECK-constrained on a shipped table (`schema.ts:672`, `enumCheck('usage_records_metric_chk', …)`)
   and adding a metric is a non-additive table rebuild, which `ARCHITECTURE.md` §9 forbids. The
   bound is a repository ceiling; the count-then-insert is not serialised, so simultaneous saves can
   exceed it by the number of those saves. That is acceptable for a soft ceiling and is stated here
   rather than discovered.
4. **`deleteTemplate`** loads the template (`requireById`, so a foreign id is `NotFoundError`), and
   throws `ForbiddenError('delete another traveller’s template', ['owner', 'admin'])` when
   `scope.ctx.role === 'member'` and `template.createdBy !== scope.ctx.userId`, then `requireRemove`.
   This is the rule `deleteMessage` states at `src/server/repos/collab.ts:166-176`, kept in the
   repository because a guard that lives only in a handler does not hold for the next caller
   (`docs/SPEC.md` §6). `created_by` is a plain user id, so a template of someone who has left stays
   and a workspace `owner`/`admin` can still remove it. `ForbiddenError` is not authored copy
   (`src/server/errors/public.ts`): the reader gets the dialog's localised fallback (Phase 3).
5. `createTemplateFromList` and `listTemplates`/`listTemplateItems` are unchanged except that
   `createTemplateFromList` goes through the new `createTemplate`.

Tests, first (`src/server/repos/__tests__/lists-templates.test.ts`, harness with the D1 ceiling on):
saving lists of 11, 12, 30 and 500 items writes a template with exactly that many items; 501 items
throws `TemplateLimitError('items')` and writes nothing; the 101st template throws
`TemplateLimitError('templates')` and the 100th is accepted; a failing item statement (forced through a
stubbed `runBatch` on the harness's batch-capable driver) leaves **no** template row; applying a
template of 8, 10, 30 and 500 items yields a list with that many items in the template's order;
`deleteTemplate`: the author deletes their own, a workspace `admin` deletes anyone's, a `member`
deleting another's throws `ForbiddenError` and the template and its rows are unchanged, a foreign
tenant's id is `NotFoundError`; deleting a template removes its `packing_template_items` through the FK
cascade (count rows for the retired id).

### Phase 2 — Two server functions

Following `stay-writes.ts`/`stays.ts` (`src/server/fns/stay-writes.ts:1-9`): the logic is **plain
functions** in `list-template-writes.ts`, taking an explicit `TenantScope`, and `list-templates.ts`
holds only the `createServerFn` wrappers. A client build of a server-function module keeps what the
module exports, so a plain function exported beside a server function would drag
`./context` and `cloudflare:workers` into the browser; and outside a Start build a server function
discards its answer, so the plain functions are what the tests drive. Zod v4, `z.strictObject()`
(`src/routes/_app/-server/trip-lifecycle.ts:166` is the precedent), ids as `z.string().trim().min(1).max(64)`,
`name` as `z.string().trim().min(1).max(120)`.

| Function               | Method | Input                            | Returns                                                                                                                         |
| ---------------------- | ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `saveListAsTemplateFn` | POST   | `{ tripId, listId, name, mode }` | `{ status: 'saved', templateId, name }`, or `{ status: 'conflict', name, suggestedName }`, or `{ status: 'limit', limit, max }` |
| `deleteListTemplateFn` | POST   | `{ templateId }`                 | `{ templateId }`                                                                                                                |

`mode` is `z.enum(['new', 'copy'])` defaulting to `'new'`. **`saveListAsTemplate(scope, data)`**:

1. `requireTrip(scope, tripId)`, then `assertTripRole(scope, tripId, ['owner', 'editor'])`
   (`src/server/repos/trips.ts:389,496`): publishing a trip's content to the whole workspace is a
   write, so a viewer is refused with `TripRoleError` (authored copy, reaches the reader).
2. **The list must be on this trip**: `listId` must be among `listTripLists(scope, tripId)`, else
   `NotFoundError`, with nothing written. `createTemplateFromList` re-reads the list with a
   workspace-only check, so without this step a member who can open trip T1 could pass T1's id with a
   list id from a `private` trip T2 they cannot open and publish that list's contents to the library.
3. Read `listTemplates(scope)`. A name clashes when `name.toLowerCase()` equals another template's
   (SQLite's unique index is case-sensitive, so "Ski kit" and "ski kit" would otherwise both pass
   this check and collide inside the insert — or worse, sit side by side as near-duplicates).
4. `mode: 'new'` with a clash returns `{ status: 'conflict', name, suggestedName }` and **writes
   nothing**; `suggestedName` is the first free `<name> <n>` for `n ≥ 2` against the names just read
   (the name is cut to leave room for the suffix within 120 characters). `mode: 'copy'` writes under
   `suggestedName` when there is a clash and under `name` when there is none.
5. `createTemplateFromList(scope, listId, resolvedName)`. `TemplateLimitError` becomes
   `{ status: 'limit', limit, max }`. A `UNIQUE` violation (a concurrent save of the same name)
   (`isUniqueConstraintViolation`, `src/server/repos/context.ts:212`) becomes `conflict` with a
   freshly computed `suggestedName`, never a thrown error.
6. **No `mirrorToRoom`.** A template is workspace state read when the library opens, not trip state a
   peer renders, so waking the trip's Durable Object (`patch('trip', …, { listsChangedAt })`, which the
   plan asked for here) would tell no one anything. The delete mirrors nothing for the same reason.

**`deleteListTemplate(scope, { templateId })`** calls `deleteTemplate(scope, templateId)` (Phase 1's rule
decides) and returns `{ templateId }`. It takes no `tripId`: a template belongs to the workspace, and
the function cannot name one.

**`loadListTemplatesFn`** gains `canDelete: boolean` per template (`createdBy === scope.ctx.userId ||
hasAtLeastRole(scope.ctx, 'admin')`, `src/server/repos/context.ts`), so the UI offers Delete only to
those the repository would allow; the server refusal is the rule and the hidden button is a courtesy.
`ListTemplateOption` carries it; `applyListTemplateFn` is not touched.

Tests (`src/server/fns/__tests__/list-template-writes.test.ts`, the plain functions with the harness,
`scopeFor(userId, role)` for second members): save then re-save with `mode: 'new'` returns `conflict`
and leaves one template whose rows are unchanged; `copy` yields `Ski kit 2`, then `Ski kit 3`, and
two templates; a case-only difference is a clash; a 120-character name gets a suffix and stays ≤ 120;
the 101st returns `limit`; a list of 501 items returns `limit: 'items'`; a trip **viewer** is refused
with `TripRoleError`; `{ tripId: T1, listId: <list of T2> }` where the caller cannot open T2 is
`NotFoundError` and the template count is unchanged; a `member` cannot delete another member's template
(`ForbiddenError`, rows unchanged), an `admin` can, the author can; `canDelete` is true exactly in those
cases.

### Phase 3 — The library: Delete

`TemplateDialog` (`list-dialogs.tsx:519`) stays the library, opened by the existing always-present
button, so a brand-new workspace can reach it and read its empty state. Changes:

- Each template row keeps its select-and-footer **Apply template** model unchanged and gains a
  **Delete** `IconButton` as a **sibling** of the row's select `button` (never nested inside it), shown
  only when `canDelete`. It opens a `ConfirmDialog` (`src/components/modules/shared/controls.tsx:178`,
  mounted by `TemplateDialog` with its own request state) whose title names the template and whose
  body names its row count ("…and its 3 items are removed for everyone in your workspace. Lists already
  made from it are untouched."), confirm label "Delete template".
- After a delete the dialog **re-reads the library** (`loadListTemplatesFn`) and keeps the dialog open;
  it does not invalidate the router (`useAction`'s `invalidate: false`), because the trip's loader
  shows no template. Selection moves to the first remaining row, or to the empty state.
- A refused or failed delete shows the dialog's inline `Alert` with the localised fallback "That
  template was not deleted. Only the person who saved it, or a workspace admin, can delete it." and
  the dialog stays open (`ForbiddenError`'s own message is not shown: it is not authored copy).
- The empty state's body now says where templates come from: "Open a list's menu and choose “Save as
  template”. It will be here for every future trip." (replaces `lists.template.empty.body`). It is
  updated in Phase 4, the phase that makes it true.
- No rename control, no private/shared toggle, no badge claiming either, and no **Replace** (see
  Out of scope): none has a repository write behind it.

### Phase 4 — Save a list as a template

- A new item **Save as template** in the list's menu (`RowMenu`), disabled while the list has no
  items (the way "Tick all" is disabled at `lists-board.tsx:529`). It opens
  `SaveTemplateDialog` (`save-template-dialog.tsx`, new): a `Dialog` with a `Field`/`Input` "Template
  name" prefilled with the list's name, selected on open, a visible disclosure sentence above the
  button — "Everyone in your workspace will be able to see this template, including what is in it, and
  start a list from it." — and **Save template**. Disclosure is the whole of the privacy answer here
  (Resolved assumption 7): no people, dates or weights are copied, and only a trip owner or editor can
  save.
- States: **idle**; **saving** (the button holds a `Spinner` and `loadingLabel`; the input and
  buttons are disabled so a second press cannot start a second write); **conflict** — an inline
  `Alert tone="warning"` "You already have a template called “Ski kit”", the input marked
  `aria-invalid` and described by it, and two actions: **Save as “Ski kit 2”** (the primary: it cannot
  lose anything, and it shows the resolved name before it is committed; sends `mode: 'copy'`) and
  editing the name (any keystroke clears the conflict and the primary returns to **Save template**);
  **limit** — `Alert tone="danger"` ("Your workspace keeps at most 100 templates. Delete one you no
  longer use, then save this one." or "A template holds at most 500 items, and this list has more.");
  **failed** — `Alert tone="danger"` with the server's authored message when there is one (a viewer's
  `TripRoleError`) and "The template was not saved. Try again." otherwise; the dialog stays open
  so the typed name is not lost; **saved** — closes, and a toast "Template saved" naming the template.
- Focus: opening lands on the name input; on a conflict focus stays on the input (the warning is in a
  `role="alert"` region, so it is announced without moving focus); closing returns focus to the menu
  trigger (the `Dialog` primitive does this and the stage does not re-implement it).
- The saved template is visible in the library at its next open (it is read on open); no router
  invalidation is needed (`invalidate: false`).
- **Entry visibility.** The menu item is shown to everyone who can see the list: the lists screen has no
  role gating on any control today (`lists-board.tsx`), so a viewer sees "Save as template" and is
  answered with the authored `TripRoleError` sentence. Gating the whole lists screen by role is
  follow-up F2's, not a one-control special case here.

### Alternatives considered, and why they lost

- **Compose the three existing repository functions with no repository edit (the plan).** Fails on
  D1 for a list of 12 items (measured), so it ships a feature that errors on every real list.
- **`Replace it` (delete then create, or an atomic `replaceTemplateFromList`).** Two specialists
  disagreed on the order of work, so the reversible half ships: save-as-a-copy and delete together let
  a traveller refresh a template (save under a new name, delete the old one) with no destructive
  button and no window in which the workspace holds neither. The atomic function and the Replace UI are
  follow-up F1 (Resolved assumption 3).
- **Conditional toolbar controls (the plan): "Apply" only when a template exists.** A new workspace
  would have no entry that explains where templates come from, and the plan's own empty state would be
  reachable only by deleting the last template while the dialog is open.
- **A Save tab inside the library.** The board has no "current list" when the library opens from the
  filter row, so the tab would have nothing to pre-select; a separate dialog opened from the list does.
- **`is_shared` semantics (private by default).** Needs repository reads and writes that do not exist
  and is cheap to add later with `updateTemplateMeta` (F1); nothing in this stage reads or writes the
  column.

## 📝 Architecture

- **Owner of each new concept** (`docs/SPEC.md` §8): template writes, limits and the author rule —
  `src/server/repos/lists.ts` (the existing owner of templates); the save/clash/ordinal logic —
  `src/server/fns/list-template-writes.ts`; the server-function surface —
  `src/server/fns/list-templates.ts`; the Save dialog — `save-template-dialog.tsx`; the library —
  `TemplateDialog` where it already is. No new directory, no new primitive.
- **Seams.** `components/modules/lists` calls only `#/server/fns/*` (the existing pattern in
  `list-dialogs.tsx`); it imports nothing from `src/server/repos`. `list-templates.ts` is imported by
  components and so exports only server functions and types; `list-template-writes.ts` is imported by
  `list-templates.ts` handlers and by tests only.
- **Tenant isolation.** Every repository call goes through the tenant-scoped handles
  (`createTenantRepository`) or, for the two raw batch inserts, stamps `organizationId` from the scope
  explicitly. New cases are **appended** to `src/server/repos/__tests__/tenant-isolation.test.ts` as a
  `describe('template writes')` block: in A's scope, `createTemplateFromList` with B's list id,
  `deleteTemplate` with B's template id and a `saveListAsTemplate` naming B's trip are all
  `NotFoundError`; `listTemplates` in A's scope never returns a row `createTemplate` wrote for B; every
  `packing_template_items` row written by a chunked batch carries the writer's `organization_id`
  (read back in the other scope: zero). B's template is re-read by id afterwards, unchanged.
- **Quota.** None: see Phase 1 item 3.
- **Realtime.** None: Phase 2 item 6.
- **Observability.** None added; a `TemplateLimitError` or `ForbiddenError` is an expected refusal and
  not an incident. No audit event: `AUDIT_ACTIONS` is deliberately narrow (`src/server/audit/trail.ts:40-48`).

## 📝 Data Model

None. No column, no index, no CHECK, no migration. `packing_templates.is_shared` (default `true`) is
neither read nor written by this stage; every template it writes is a workspace template, which is what
the default already says, and `listTemplates` returns every template of the workspace regardless of the
column.

## 📝 API Contracts

`saveListAsTemplateFn` and `deleteListTemplateFn` as tabled in Phase 2; `loadListTemplatesFn` gains
`canDelete`. Errors: `NotFoundError` (foreign or off-trip id), `TripRoleError` (authored),
`ForbiddenError` (not authored; the dialog supplies the sentence). Expected refusals of a save
(`conflict`, `limit`) are **results, not exceptions**, so the dialog branches on `status` and an
exception always means a failure.

## 📝 UI/UX

- The library dialog keeps its size (`DialogContent size="md"`), rows and selection model. A row is an
  `li` holding the select `button` (as today) and, beside it, the Delete `IconButton` with an accessible
  name "Delete “{name}”". At 360px the `Dialog` primitive already pins to the bottom of the screen and
  stacks its footer (`src/components/ui/dialog.tsx:52,91,213`): the plan's separate `Sheet` is not
  needed. At 1280px and 2560px the dialog's own `max-w` caps the measure.
- The Save dialog is `size="sm"`; its disclosure sentence is body text above the actions, not a tooltip.
- Counts and the template's row total carry `tabular-nums`; spacing from `--space-*`; no hex, no
  one-off radius, no hand-written shadow. Motion is the primitives' own (the plan's 24 ms-staggered row
  entrance, tab-pill slide and `package` glyph are dropped: nothing reachable depends on them).
- Row and button states: resting, hover, `:focus-visible`, pressed, disabled, loading — on the Delete
  button, the menu item, the Save/copy buttons and both confirmations. Logical properties only
  (`ms-`/`me-`), so `ar` mirrors.

## 📝 Visual change expected

- Route `/trips/$tripId/lists`: **list menu** gains "Save as template" (enabled with items, disabled
  without); **library dialog** gains a Delete button per deletable row and a new empty-state sentence;
  **delete confirmation**; **Save dialog** in idle, saving, conflict and limit states.
- Light and dark, at 360, 1280 and 2560 px. No other route changes.
- A state is captured only when the demo workspace shows it (the demo has lists with items and may have
  one seeded template); the conflict, limit and failed states and the refused delete are proved by the
  jsdom tests, and the PR body says "not captured" for each rather than claiming it.

## 📝 Copy

`en` keys in `src/lib/i18n/messages/en/modules.ts`, rendered as `modules.lists.template.…`; each lands in
all 23 locales in the same change (the `i18n-messages` skill; `pl`/`ru`/`uk`/`ar`/`cs` need the plural
branches `en` lacks for the counted keys). Phase in brackets.

| Key (`lists.template.…`)   | `en` text                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [4] `save.menu`            | Save as template                                                                                                                                          |
| [4] `save.title`           | Save as a template                                                                                                                                        |
| [4] `save.disclosure`      | Everyone in your workspace will be able to see this template, including what is in it, and start a list from it.                                          |
| [4] `save.nameLabel`       | Template name                                                                                                                                             |
| [4] `save.submit`          | Save template                                                                                                                                             |
| [4] `save.saving`          | Saving the template                                                                                                                                       |
| [4] `save.toast`           | Template saved                                                                                                                                            |
| [4] `save.toastBody`       | Saved as “{name}”.                                                                                                                                        |
| [4] `save.failed`          | The template was not saved. Try again.                                                                                                                    |
| [4] `save.conflict.title`  | You already have a template called “{name}”                                                                                                               |
| [4] `save.conflict.body`   | Choose another name, or keep both by saving this one as “{suggested}”.                                                                                    |
| [4] `save.conflict.copy`   | Save as “{suggested}”                                                                                                                                     |
| [4] `save.limit.templates` | Your workspace keeps at most {max} templates. Delete one you no longer use, then save this one.                                                           |
| [4] `save.limit.items`     | A template holds at most {max} items, and this list has more.                                                                                             |
| [4] `empty.body` (changed) | Open a list’s menu and choose “Save as template”. It will be here for every future trip.                                                                  |
| [3] `delete.label`         | Delete “{name}”                                                                                                                                           |
| [3] `delete.title`         | Delete “{name}”?                                                                                                                                          |
| [3] `delete.body` (plural) | one: The template and its {count} item are removed for everyone in your workspace. Lists already made from it are untouched. / other: …its {count} items… |
| [3] `delete.confirm`       | Delete template                                                                                                                                           |
| [3] `delete.toast`         | Template deleted                                                                                                                                          |
| [3] `delete.failed`        | That template was not deleted. Only the person who saved it, or a workspace admin, can delete it.                                                         |

## 📝 Edge Cases & Failure Scenarios

| Case                                                               | Behaviour                                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Save a list of 12-500 items                                        | Works (chunked batch); before this stage it threw a D1 parameter error.                                                      |
| Save a list of 501+ items                                          | `limit: 'items'` result and the "holds at most 500" alert; nothing written.                                                  |
| Save the same list twice, same name                                | `conflict` with `suggestedName`; nothing written; the first template's rows are unchanged.                                   |
| Name differs only by case or surrounding space                     | Treated as a clash (compared trimmed and lower-cased).                                                                       |
| Two people save the same name at once                              | The loser's `UNIQUE` violation becomes `conflict`, not an error.                                                             |
| A write fails halfway                                              | One batch: neither the template nor any item exists afterwards; a retry is clean.                                            |
| The workspace holds 100 templates                                  | `limit: 'templates'`; delete one first. Simultaneous saves may overshoot 100 by the number of those saves.                   |
| A viewer chooses "Save as template"                                | The authored `TripRoleError` sentence in the dialog's alert; nothing written.                                                |
| A list id from another trip (private to the caller's eyes) is sent | `NotFoundError`; nothing written.                                                                                            |
| A member deletes another member's template (hand-made request)     | `ForbiddenError`; the button was never shown (`canDelete` false); the dialog's fallback sentence if it happens.              |
| The author has left the workspace                                  | Their templates stay; an `owner` or `admin` can delete them.                                                                 |
| Deleting the last template                                         | The library re-reads and shows the empty state; the dialog stays open.                                                       |
| Library load fails or is slow                                      | Unchanged: skeleton rows, then the dialog's error `Alert`.                                                                   |
| Applying a template of 8-500 items                                 | Works (chunked batch); before, 10 or more threw.                                                                             |
| Name of 120 characters saved as a copy                             | Cut to leave room for the ordinal; never over 120.                                                                           |
| The trip is archived                                               | Saving reads the trip and writes only to the workspace, so it is allowed; archived-write refusal remains the applier's (F2). |

## ✅ Acceptance criteria

Phase in brackets.

1. [1] A template of 12, 30 and 500 items is written, and a template of 8, 10, 30 and 500 items is
   applied, under the harness's D1 ceiling; each yields exactly that many items in order.
2. [1] A failing write leaves no template row; 501 items and the 101st template raise
   `TemplateLimitError`; the 100th is accepted.
3. [1] `deleteTemplate`: author and workspace `admin`/`owner` may delete; a `member` deleting another's
   template is `ForbiddenError` with the rows unchanged; a foreign tenant's id is `NotFoundError`.
4. [2] Saving twice with `mode: 'new'` returns `conflict` and writes nothing; `copy` writes `<name> 2`,
   `<name> 3`; case and surrounding space do not evade a clash; a concurrent same-name save is a
   `conflict`, never a thrown `UNIQUE` error.
5. [2] A viewer is refused (`TripRoleError`); a list id from another trip is `NotFoundError` and the
   template count is unchanged; `canDelete` is true only for the author and admins.
6. [2] No `mirrorToRoom` call is made by either function; `applyListTemplateFn` is byte-identical.
7. [3] A Delete button appears exactly on rows with `canDelete`, as a sibling of the select button, with
   the accessible name "Delete “{name}”"; confirming deletes, re-reads the library and keeps the dialog
   open; cancelling deletes nothing; a refusal shows the localised fallback.
8. [4] "Save as template" is in the list's menu, disabled while the list is empty; the dialog shows the
   disclosure sentence, the prefilled name, and the idle/saving/conflict/limit/failed states described;
   the conflict's primary action reads "Save as “{suggested}”"; typing clears the conflict; a second
   press while saving does nothing.
9. [4] The empty library body names the list menu; the saved template is in the library at its next
   open.
10. [3, 4] Every new key exists in all 23 locales and `pnpm test` (parity) is green; the changed
    `empty.body` is changed in all 23.
11. [2, 4] The tenant-isolation block passes: a cross-tenant list id, template id and trip id are
    `NotFoundError`; no row written for one tenant is visible or removable from the other.
12. [all] `capture.mjs` of the lists route reports no console error or warning; opening either dialog
    moves nothing behind it; nothing outside the owned paths and the documents the Phase 1 grep names
    changed; `package.json` and `pnpm-lock.yaml` are untouched.

## 📝 Risks & Impact Review

| Risk                                                                                                        | Severity               | Mitigation                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `05-S1` rewrites `applyTemplateToTrip`/`createTemplateFromList` after (or before) this stage                | Medium                 | Category-agnostic edits; Phase 1 item 2 is conditional on the code's state; Phases 3–4 wait on `05-S1`'s tickets.      |
| A 500-item template applied is ~100 statements in one D1 batch                                              | Low                    | `chunkFor(boundParametersPerRow(…))` is a conservative 5 rows/statement; the 500-row test runs it; no other path does. |
| The count-then-insert ceiling is not serialised                                                             | Low                    | Stated; a soft bound, not a quota; no metric (non-additive table rebuild).                                             |
| A trip owner publishes a private trip's list contents to the whole workspace                                | Low                    | Owner/editor only; list bound to trip; visible disclosure sentence; no people, dates or weights are copied.            |
| Existing list writers have no role check and do not tie `listId`/`itemId` to `tripId` (private-trip access) | **High, pre-existing** | Not touched here; follow-up F2, written up as access to private trips inside the workspace.                            |
| `ForbiddenError` is not authored copy, so a refused delete shows the fallback sentence                      | Low                    | `canDelete` hides the button; the fallback names both who may delete.                                                  |
| The dialog's select-and-footer model stays while a Delete sits on each row                                  | Low                    | Delete is a sibling control with its own focus stop and name; selection is unaffected.                                 |

### Out of scope

A **Replace it** flow, a rename control, a private/shared toggle and any badge asserting one: none has a
repository write behind it. Merging a template into an existing list. Role gating of the lists screen.
A quota metric. Audit events.

**Follow-ups — extra tickets the slicing run files, not blocked by anything and not part of this stage's
acceptance:**

- **F1 — atomic `replaceTemplateFromList` and `updateTemplateMeta`.** One repository function whose
  delete, template insert and chunked item inserts are a single `runBatch` (no window in which the
  workspace holds neither template), the **Replace it** conflict action with its confirmation, and
  `updateTemplateMeta(scope, id, { name?, isShared? })` with a rename control and a private/shared
  toggle. The two specialists' split is Resolved assumption 3.
- **F2 — guard every writer of `src/server/fns/lists.ts`.** No `assertTripRole`/`requireWritableTrip`
  (a viewer can create lists and items and apply a template today, and write into an archived trip), and
  `listId`/`itemId` are never tied to `data.tripId`: `requireTrip(tripId)` is followed by an action on
  an id any workspace member can send, so a member can edit or delete a list on a **private** trip they
  cannot open. Write it up as private-trip access, not cosmetics; role-gate the lists screen's controls
  with it.

## 📋 Phasing

| Phase | Slice                                                | Blocked by                    | Demoable on its own                                                                        |
| ----- | ---------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| 1     | The repository: D1-safe, atomic, limits, delete rule | none                          | A 30-item template saves and applies in the test harness; a member cannot delete another's |
| 2     | The two server functions and `canDelete`             | Phase 1                       | Save/clash/copy/limit and delete through the plain functions, with the isolation block     |
| 3     | The library's Delete                                 | Phase 2, every `05-S1` ticket | A template can be deleted from the library, with a confirmation                            |
| 4     | The Save dialog and the list-menu entry              | Phase 2, every `05-S1` ticket | A list can be saved, copied under a new name, and found in the library                     |

Four tickets for `afk-to-tickets`, each a vertical slice. Phases 3 and 4 are independent of each other
(Phase 4 owns the copy of the empty state, Phase 3 never needs it). "Every `05-S1` ticket" means the
tickets sliced from the spec whose `Plan` row is `05-S1`.

## 📋 Implementation Plan

### Phase 1 — The repository

1. Write `src/server/repos/__tests__/lists-templates.test.ts` first, with the cases under Phase 1
   (harness, D1 ceiling). Watch the 12-item save, the 10-item apply and the author-rule cases fail.
2. `lists.ts`: export `MAX_TEMPLATES_PER_WORKSPACE`, `MAX_TEMPLATE_ITEMS` and `TemplateLimitError`;
   rewrite `createTemplate` as one `runBatch` of a template insert and chunked item inserts; point
   `createTemplateFromList` at it.
3. `applyTemplateToTrip`: add the 8/10/30/500-row apply cases; edit the function only if they fail.
4. `deleteTemplate`: load, author-or-admin rule, `requireRemove`.
5. Docs grep (the rule in `AGENTS.md`, recorded in the PR template): `createTemplate`,
   `createTemplateFromList`, `deleteTemplate`, `TemplateDialog`, `LST-04`, `MAX_BOUND_PARAMETERS`
   across `docs/`, `.ai/`, `src/`, `CONTEXT.md`; update what states what this phase changes.

### Phase 2 — The server functions

1. `src/server/fns/__tests__/list-template-writes.test.ts` first (cases under Phase 2).
2. `list-template-writes.ts` (`saveListAsTemplate`, `deleteListTemplate`) and `list-templates.ts` (the
   two `createServerFn`s with their Zod inputs); `canDelete` on `loadListTemplatesFn` and
   `ListTemplateOption`.
3. Append `describe('template writes')` to `tenant-isolation.test.ts`.

### Phase 3 — The library's Delete

1. `template-dialog.test.tsx` first (jsdom, project `ui`): Delete only on `canDelete` rows, sibling of
   the select button, accessible name; confirm deletes and re-reads; cancel deletes nothing; refusal
   shows the fallback; deleting the last row shows the empty state; no router invalidation.
2. `list-dialogs.tsx`: the Delete `IconButton`, the `ConfirmDialog`, the re-read; add `data-part`
   attributes `template-library` (the existing "From a template" button, `lists-board.tsx`) and
   `template-delete` (per row) for the capture.
3. Add the Phase 3 keys to all 23 locales (the `delete.body` plural with every branch each locale needs).

### Phase 4 — The Save dialog

1. `save-template-dialog.test.tsx` first (jsdom): disclosure and prefilled name; saving state blocks a
   second press; `conflict` shows the warning, `aria-invalid`, and the primary "Save as “{suggested}”"
   which sends `mode: 'copy'`; typing clears the conflict; `limit` and `failed` states; the authored
   error message is shown as is; a saved result closes the dialog.
2. `save-template-dialog.tsx`; the "Save as template" menu item in the list's menu (disabled with no
   items) and the dialog mounted by the board; export through `index.ts`; `data-part="template-save"`
   on the menu item and `template-save-submit` on the button.
3. Change `lists.template.empty.body` and add the Phase 4 keys in all 23 locales.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every
ticket's PR. No screenshot is compared anywhere (ADR 0016) and no `e2e/` declaration is added: every
failure mode here — the D1 ceiling, the clash, the rules, the states — is reproduced by a harness or
jsdom test, and the existing journeys already open the lists tab under `watchConsole`.

The visual judgement is the **blind A/B pair** (`docs/SPEC.md` §7 item 4, `verifying-changes`
skill), captured with `scripts/visual/capture.mjs` against a demo trip with at least one list with
items, `--auth`, viewports `360x800,1280x900,2560x1440`, themes `light,dark`: the library
(`--click '[data-part="template-library"]'`), the list menu then the Save dialog
(`--click` takes one selector, so the menu is opened by the capture's first click and the dialog by a
second capture with the dialog reached through the spec's own test where the demo cannot), and the
delete confirmation where the demo workspace shows a template. The script presses no keys, so the
keyboard path (focus on open, focus return, the conflict announcement) is proved by the jsdom tests.
Each selector is verified to resolve to exactly one element against a running server before the
capture runs. The capture's `console` and `warnings` output goes into the PR body; frames stay out of
the repository.

## Resolved assumptions (autonomous defaults)

| #   | Question | Applied default | Why |
| --- | -------- | --------------- | --- |
| 1 | Does the stage edit `src/server/repos/lists.ts`, which the plan forbids? | Yes: `createTemplate` and `applyTemplateToTrip` become D1-safe chunked atomic batches (architect verdict A2 on a measured defect: saving 12+ items and applying 10+ fail under D1's 100-parameter ceiling). | The plan's only reason was wave-parallel file ownership; tickets now run one at a time, and the plan's "no repo edit" cannot be kept without shipping a feature that errors on every real list. |
| 2 | How does the stage relate to the unmet `05-S1`? | Phases 1-2 have no blocker and stay category-agnostic; Phases 3-4 are `Blocked by` every `05-S1` ticket and are described behaviourally ("the list's menu"). Architect verdict B3, reconciled with HEAD-first by taking the more reversible one. | `05-S1` owns the category migration of apply/save and the list actions' new home; a hard block on the UI only loses no work and avoids building a menu item that is moved at once. |
| 3 | Atomic `replaceTemplateFromList`, `updateTemplateMeta`, the Replace flow, rename and private/shared toggle? | Deferred to follow-up F1; the stage ships `new` and `copy` plus Delete (product owner P2b against architect A3, resolved to the more reversible option). | Save-as-a-copy plus Delete refreshes a template with no destructive button and no window in which the workspace holds neither; nothing in the stage lacks a repository write. |
| 4 | Where do the entry points live? | One always-present library entry (the existing "From a template" button), plus a per-list "Save as template" in the list's menu, disabled with no items; Save is its own small dialog, not a tab (product owner P1c). | A brand-new workspace needs an entry that explains where templates come from, which resolves the plan's contradiction between hiding Apply and drawing an empty state. |
| 5 | How much of the plan's UI motion ships? | Every reachable state, the responsive, keyboard and focus behaviour; not the 24 ms entrance stagger, the tab-pill slide, the `package` glyph or a separate Sheet (product owner P3b). | The `Dialog` primitive already pins to the bottom on narrow viewports; nothing reachable depends on the dropped motion. |
| 6 | Who may delete a template? | The author, or a workspace `owner`/`admin`, enforced in the repository `deleteTemplate` with a `ForbiddenError` (security S1b, the `collab.ts:166-176` precedent). `canDelete` is computed server-side for the button. | A guard that lives only in a handler does not hold for the next caller (`docs/SPEC.md` §6); a template of someone who left must stay removable. |
| 7 | Who may save, and what protects a private trip's list? | Trip `owner`/`editor` only (`assertTripRole`, security S2b); the list is bound to the trip through `listTripLists`; a visible disclosure sentence is the privacy answer, `is_shared` stays unused (S3a). | `createTemplateFromList` re-reads the list workspace-wide, so without the binding a member could publish a list of a private trip they cannot open; a template carries no people, dates or weights. |
| 8 | The existing list writers have no role or archived guard (security S4). | Left alone and filed as follow-up F2 (S4a, with `applyListTemplateFn` untouched); the new functions are guarded. F2 is written up as private-trip access, not cosmetics. | Guarding every writer is a separate, larger and riskier change to code this stage does not own; the new surface adds no new exposure. |
| 9 | Where does the 100-template cap live and is there a quota metric? | In the repository as `TemplateLimitError` (`limit: 'templates' \| 'items'`, `max`), mapped by the fns layer to a typed `limit` result; `MAX_TEMPLATES_PER_WORKSPACE = 100`, `MAX_TEMPLATE_ITEMS = 500`. No `usage_records` metric. | `USAGE_METRICS` is CHECK-constrained on a shipped table, so a new metric is a non-additive rebuild; the count-then-insert is not serialised and may overshoot by the number of simultaneous saves, which a soft ceiling tolerates. |
| 10 | Does saving stamp the trip, mirror to the room or write an audit event? | No to all three. | A template is workspace state read when the library opens, not trip state a peer renders; the plan itself says delete mirrors nothing, and `AUDIT_ACTIONS` is deliberately narrow. |
| 11 | How is a name clash detected and resolved? | Trimmed, case-insensitive comparison in the fns layer; `new` returns `conflict` with `suggestedName` (`<name> <n>`, n ≥ 2, cut to stay ≤ 120) and writes nothing; `copy` writes the suggestion; a concurrent `UNIQUE` violation becomes `conflict`. Expected refusals are results, not exceptions. | The unique index is case-sensitive, so near-duplicates would otherwise coexist; the dialog branches on `status`, and an exception always means failure. |
| 12 | Is the plan's e2e visual declaration kept? | No: struck. The visual judgement is the blind A/B pair via `scripts/visual/capture.mjs`; no `e2e/` declaration is added. | ADR 0016 removed screenshot baselines; the failure modes are reproduced by harness and jsdom tests. |
| 13 | Does the stage add a new role gate for the Save menu item in the UI? | No: the item is shown to everyone who can see the list and a viewer is answered with the authored `TripRoleError` sentence. | The lists screen has no role gating on any control; gating one control would be a special case, and the whole screen's gating belongs to F2. |
| 14 | Plan inaccuracies (schema and `reserveTripSlug` line references, "three" versus "two" server functions, trip stamp on save versus delete). | Read as history; the spec states the code's truth at HEAD `9a2f4f0e` and ships two server functions. | The spec describes the work left in today's terms. |
