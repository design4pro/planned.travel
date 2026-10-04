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

The stage is cut into three slices, each useful on its own: **Phase 1** the D1 fix (a bug slice that
makes the existing Apply work for a real template), **Phase 2** Delete (author rule, server function,
library button), **Phase 3** Save (limits, server function, dialog, list-menu entry, glossary). It
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
  `MAX_BOUND_PARAMETERS`). Measured on HEAD with a throwaway probe test (deleted):
  `createTemplateFromList` on a list of 11 items passes and on **12 items** throws `D1 refuses a
statement with 108 bound parameters`; 30 items binds 270. `applyTemplateToTrip` throws at **10
  items** (120 parameters) and passes only up to 8. Cause: both go through `insertMany`
  (`src/server/repos/base.ts:219-236`), one unchunked `insert().values(records)`. The existing tests
  use two items, so nothing catches it. The same code writes the template row and its items as two
  separate statements, so a failure between them leaves an empty template holding the name.
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
| `CONTEXT.md` — a **Template** entry (Phase 3)                                                                                         |                                                                                                                        |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, any document a phase's grep names                |                                                                                                                        |

**The plan's file-ownership reasoning no longer binds.** `05-S2` forbids any edit under
`src/server/repos` and puts its functions in a new fns file only because `05-S3` and `05-S4` hold
`lists.ts` and `src/server/fns/lists.ts` exclusively in the same wave. Tickets are now implemented one
at a time, so no two stages edit a module in parallel; the constraint cannot be kept anyway (the
D1 defect lives in `lists.ts`). The plan's `e2e/packing-and-todos.visual.spec.ts` and
`e2e/__screenshots__/` are **struck**: ADR 0016 removed screenshot baselines and the visual judgement
is the blind A/B pair (`scripts/visual/capture.mjs`).

### Dependency on plan stage `05-S1`

`05-S1` (categories become records, `list-panel.tsx`, `list-toolbar.tsx`) has **not** landed at HEAD:
there is no `packing_categories` table and no toolbar, and its own spec is not merged. It will migrate
`applyTemplateToTrip` and `createTemplateFromList` onto category records; that migration is `05-S1`'s,
not this stage's, and **this stage keeps both functions category-agnostic** (it never reads or writes
`category`/`category_id` differently from HEAD), so `05-S1` rebases cleanly in either order.

- **Phases 1 and 2 have no `05-S1` blocker.** The D1 fix touches the repository, and Delete touches
  only `TemplateDialog` and the repository, none of which `05-S1`'s list menu or toolbar hosts.
- **Phase 3 hosts "Save as template" in the list's menu**: at HEAD the `menuItems` array of
  `lists-board.tsx` (`:520-562`), rendered by the list header's `RowMenu` (`:624`; the `RowMenu` at
  `:1010` is the item row's, and is not the one meant). The rule when the slicing run files Phase 3's
  ticket: if tickets sliced from the spec whose `Plan` row is `05-S1` **exist**, Phase 3 is `Blocked
by` all of them and puts the entry in whatever menu or toolbar they left; if none exist, Phase 3 is
  blocked only by Phase 2 and adds the item to the `menuItems` array at HEAD (a later `05-S1` ticket
  carries the menu's move). The behaviour is the requirement; the host is whatever the code has when
  the ticket runs. No slicing run slices another spec to satisfy this edge: one spec a run.
- Two assertions are owed **by `05-S1`, not here**: that applying a template yields category records,
  and that saving such a list round-trips its group names. This stage's tests assert only the string
  form that exists today.

### Phase 1 — The repository: D1-safe and atomic (a bug slice)

All in `src/server/repos/lists.ts`; no new SQL outside it, every statement stamped with
`organization_id` from the scope. This slice stands on its own: `applyListTemplateFn` already reaches
`applyTemplateToTrip`, so applying a template of 10 or more items starts working.

1. **`createTemplate`** writes the template row and its items in **one `runBatch`**
   (`src/server/repos/batch.ts:35`): the template id is minted up front with `newId()`
   (`src/server/db/schema.ts:82`), then one statement for the template and one statement per chunk of
   `chunkFor(boundParametersPerRow(packingTemplateItems))` item rows (`batch.ts:27,34`) — the shape
   `transports.ts:1049-1056` already uses. Raw `scope.db.insert(...)` statements stamp
   `organizationId: scope.ctx.organizationId` explicitly, as that precedent does. The function
   re-reads the template through `packingTemplatesRepository.requireById` and returns it (same return
   type as today: callers use `.id`). A failure now leaves neither row.
2. **`applyTemplateToTrip`** does the same for its list row and its item rows (one batch, chunked by
   `boundParametersPerRow(packingItems)`, which is conservative: 5 rows a statement). It **still runs**
   `packingTemplatesRepository.requireById(template)` and `requireTrip(tripId)` before it builds the
   batch (that read-before-write order is what makes a cross-tenant apply a `NotFoundError`), and the
   raw inserts stamp `organizationId: scope.ctx.organizationId`. The change is **conditional on the
   code's state when the ticket runs**: the ticket first adds the 30-row and 500-row apply tests
   below; if they already pass (`05-S1` having batched the function), it edits nothing and keeps the
   tests, and if they fail it makes them pass without touching how `category` or `category_id` is
   written.
3. `createTemplateFromList` goes through the new `createTemplate`; `listTemplates`,
   `listTemplateItems` and the rest are unchanged.

Tests, first (`src/server/repos/__tests__/lists-templates.test.ts`, harness with the D1 ceiling on):
saving lists of 11, 12, 30 and 500 items writes a template with exactly that many items, in order;
applying a template of 8, 10, 30 and 500 items yields a list with that many items in the template's
order; a write that fails halfway leaves **no** template row. The failure is a **real failing
statement inside the real batch** (for example two item rows made to share an id through the
id-supplying hook of `newId`, `schema.ts:82`), relying on the harness's batch rollback
(`harness.ts:169`); the ticket picks the seam that exists and does **not** stub `runBatch`, because a
stub that throws proves nothing about rollback. The existing `createTemplate`, `deleteTemplate`,
`createTemplateFromList` and apply cases in `repositories.test.ts` and `tenant-isolation.test.ts`
(including the cross-tenant apply cases at `tenant-isolation.test.ts:1503-1519`) stay green unchanged.

Tenant isolation (appended to `tenant-isolation.test.ts`, `describe('template writes')`, repository
calls only): in A's scope, apply a template of **at least 12 items** (so more than one chunk is
written): every `packing_lists` and `packing_items` row it writes carries A's `organization_id`, and
reads back as zero rows from B's scope; save a list of **at least 12 items**: every
`packing_template_items` row carries A's `organization_id`, zero from B's scope; B's template is
re-read by id afterwards, unchanged.

### Phase 2 — Delete: the author rule, one server function, the library button

**Repository.** `deleteTemplate` loads the template (`requireById`, so a foreign id is
`NotFoundError`), throws `ForbiddenError('delete another traveller’s template', ['owner', 'admin'])`
when `scope.ctx.role === 'member'` and `template.createdBy !== scope.ctx.userId`, then `requireRemove`.
This is the rule `deleteMessage` states at `src/server/repos/collab.ts:166-176`, kept in the
repository because a guard that lives only in a handler does not hold for the next caller
(`docs/SPEC.md` §6). `created_by` is a plain user id, so a template of someone who has left stays
and a workspace `owner`/`admin` can still remove it. `ForbiddenError` is not authored copy
(`src/server/errors/public.ts`), so the function layer turns it into a result (below).

**Server.** Following `stay-writes.ts`/`stays.ts` (`src/server/fns/stay-writes.ts:1-9`): the logic is
**plain functions** in `list-template-writes.ts`, taking an explicit `TenantScope`, and
`list-templates.ts` holds only the `createServerFn` wrappers. A client build of a server-function
module keeps what the module exports, so a plain function exported beside a server function would
drag `./context` and `cloudflare:workers` into the browser; and outside a Start build a server function
discards its answer, so the plain functions are what the tests drive. **Whichever of Phases 2 and 3
lands first creates** `list-template-writes.ts`, `list-templates.ts` and
`list-template-writes.test.ts`; the other appends to them. Zod v4, `z.strictObject()`
(`src/routes/_app/-server/trip-lifecycle.ts:166` is the precedent), ids as
`z.string().trim().min(1).max(64)`.

| Function               | Method | Input            | Returns                                                          |
| ---------------------- | ------ | ---------------- | ---------------------------------------------------------------- |
| `deleteListTemplateFn` | POST   | `{ templateId }` | `{ status: 'deleted', templateId }` or `{ status: 'forbidden' }` |

`deleteListTemplate(scope, { templateId })` calls `deleteTemplate`; a `ForbiddenError` becomes
`{ status: 'forbidden' }` (an expected refusal is a **result**, so the dialog can tell "you may not"
from "it failed"); every other error propagates. It takes no `tripId`: a template belongs to the
workspace.

**`loadListTemplatesFn`** gains `canDelete: boolean` per template (`createdBy === scope.ctx.userId ||
hasAtLeastRole(scope.ctx, 'admin')`, `src/server/repos/context.ts`), so the UI offers Delete only to
those the repository would allow; the server refusal is the rule and the hidden button is a courtesy.
`ListTemplateOption` carries it; `applyListTemplateFn` is not touched.

**Library UI.** `TemplateDialog` (`list-dialogs.tsx:519`) stays the library, opened by the existing
always-present button, so a brand-new workspace can reach it and read its empty state.

- Each template row keeps its select-and-footer **Apply template** model unchanged and gains a
  **Delete** `IconButton` (`size="sm"`, `variant="ghost"`, which already clears the 24px target of
  WCAG 2.5.8; no new colour) as a **sibling** of the row's select `button` (never nested inside it),
  shown only when `canDelete`, with the accessible name "Delete “{name}”".
- It opens a `ConfirmDialog` (`src/components/modules/shared/controls.tsx:178`, mounted by
  `TemplateDialog` with its own request state) whose title names the template and whose body names its
  row count and says it cannot be undone, confirm label "Delete template". Its `pending` is the delete
  action's pending state. **The confirmation closes on success and on failure**, so a failure is never
  left behind it.
- **Success.** The library re-reads (`loadListTemplatesFn`) and **replaces the rows in place**, never
  returning to the skeleton. Focus moves to the select button of the row now at the deleted row's
  position, or the previous row's if it was the last; if the library is now empty, to the footer's
  Cancel button. Selection moves with it, or to the empty state. The outcome is announced from inside
  the open library by a polite `role="status"` line in `DialogBody` ("Deleted “{name}”.", key
  `delete.done`), **not** a toast: the toaster sits outside the modal (`app-toaster.tsx:35`) and the
  page behind an open modal is hidden from assistive technology (`dialog.tsx:48-49`). The action takes
  `invalidate: false` (`useAction`) and passes no `success` toast, because the trip's loader shows no
  template.
- **Refused or failed.** The confirmation closes **first** and the primitive returns focus to the
  row's Delete button; **then** the library shows its inline `Alert tone="danger"`; an alert never
  renders under an open confirmation, where it would be hidden from assistive technology. A
  `forbidden` result says "Only the person who saved it, or a workspace admin, can delete this
  template." (`delete.forbidden`); a thrown failure says "That template was not deleted. Check your
  connection and try again." (`delete.failed`). The `useAction` failure toast gets the title
  `delete.toastFailed`, so its hardcoded English default never shows.
- No rename control, no private/shared toggle, no badge claiming either, and no **Replace** (see
  Out of scope): none has a repository write behind it.

Tests, first. `src/server/repos/__tests__/lists-templates.test.ts` (append): `deleteTemplate`: the
author deletes their own, a workspace `admin` deletes anyone's, a `member` deleting another's throws
`ForbiddenError` and the template and its rows are unchanged, a foreign tenant's id is
`NotFoundError`; deleting a template removes its `packing_template_items` through the FK cascade
(count rows for the retired id). `list-template-writes.test.ts` (plain functions with the harness,
`scopeFor(userId, role)` for second members): the same three cases through `deleteListTemplate`, the
member's refusal being `{ status: 'forbidden' }` with rows unchanged; `canDelete` is true exactly for the
author and admins. Tenant isolation (append to `describe('template writes')`): `deleteTemplate` with
B's template id from A's scope is `NotFoundError` and B's template and rows are unchanged.
`template-dialog.test.tsx` (jsdom, project `ui`): see the Implementation Plan.

### Phase 3 — Save a list as a template

**Repository.** `MAX_TEMPLATES_PER_WORKSPACE = 100` and `MAX_TEMPLATE_ITEMS = 500` (the latter replaces
the literal `500` in `createTemplateInput.items`, `lists.ts:112`) are exported constants.
`createTemplate` counts the workspace's templates (`packingTemplatesRepository.count(scope)`) and
throws `TemplateLimitError` (`extends RepositoryError`, code `'TEMPLATE_LIMIT'`, fields
`limit: 'templates' | 'items'` and `max`) at 100, and throws it with `limit: 'items'` when
`items.length > MAX_TEMPLATE_ITEMS`, **before** Zod's own `.max()` would. There is no quota metric:
`USAGE_METRICS` is CHECK-constrained on a shipped table (`schema.ts:672`,
`enumCheck('usage_records_metric_chk', …)`), and adding a metric is a non-additive table rebuild,
which `docs/DEPLOY.md` ("Migration policy: migrations are additive") allows only on stated conditions
that are disproportionate for a count cap. The bound is a repository ceiling; the count-then-insert
is not serialised, so simultaneous saves can exceed it by the number of those saves. That is
acceptable for a soft ceiling and is stated here rather than discovered.

**Server.** `saveListAsTemplateFn`, in the files Phase 2 describes (created here if Phase 3 lands
first). `name` is `z.string().trim().min(1).max(120)`; `mode` is `z.enum(['new', 'copy'])` defaulting
to `'new'`.

| Function               | Method | Input                            | Returns                                                                                                                                                 |
| ---------------------- | ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveListAsTemplateFn` | POST   | `{ tripId, listId, name, mode }` | `{ status: 'saved', templateId, name }`, `{ status: 'conflict', name, suggestedName }`, `{ status: 'limit', limit, max }`, or `{ status: 'forbidden' }` |

**`saveListAsTemplate(scope, data)`**:

1. `requireTrip(scope, tripId)`, then `assertTripRole(scope, tripId, ['owner', 'editor'])`
   (`src/server/repos/trips.ts:389,496`): publishing a trip's content to the whole workspace is a
   write, so a viewer is refused. `TripRoleError` is caught and becomes `{ status: 'forbidden' }`:
   its English sentence ("A viewer may not change this trip; requires one of: owner, editor.") is
   neither localised nor true of this action, so the dialog renders its own key (`save.forbidden`).
2. **The list must be on this trip**: `listId` must be among `listTripLists(scope, tripId)`, else
   `NotFoundError`, with nothing written. `createTemplateFromList` re-reads the list with a
   workspace-only check, so without this step a member who can open trip T1 could pass T1's id with a
   list id from a `private` trip T2 they cannot open and publish that list's contents to the library.
3. Read `listTemplates(scope)`. A name clashes when its trimmed, lower-cased form equals another
   template's (SQLite's unique index is case-sensitive, so "Ski kit" and "ski kit" would otherwise
   both pass this check and sit side by side as near-duplicates).
4. `mode: 'new'` with a clash returns `{ status: 'conflict', name, suggestedName }` and **writes
   nothing**; `suggestedName` is the first free `<name> <n>` for `n ≥ 2` against the names just read
   (the name is cut to leave room for the suffix within 120 characters). `mode: 'copy'` writes under
   `suggestedName` when there is a clash and under `name` when there is none.
5. `createTemplateFromList(scope, listId, resolvedName)`. `TemplateLimitError` becomes
   `{ status: 'limit', limit, max }`. A `UNIQUE` violation (a concurrent save of the same name,
   `isUniqueConstraintViolation`, `src/server/repos/context.ts:212`) becomes `conflict` with a freshly
   computed `suggestedName`, never a thrown error.
6. **No `mirrorToRoom`.** A template is workspace state read when the library opens, not trip state a
   peer renders, so waking the trip's Durable Object (`patch('trip', …, { listsChangedAt })`, which the
   plan asked for here) would tell no one anything. The delete mirrors nothing for the same reason.

**Dialog.** A new item **Save as template** in the list's menu (see "Dependency on plan stage `05-S1`"
for which menu), disabled while the list has no items (the way "Tick all" is disabled at
`lists-board.tsx:529`). It opens `SaveTemplateDialog` (`save-template-dialog.tsx`, new), a
`Dialog size="sm"` with:

- a `Field`/`Input` "Template name", prefilled with the list's name **cut to 120 characters** (the
  list's own title allows 200), `maxLength={120}`, selected on open, Enter submits;
- a visible disclosure sentence above the actions — "Everyone in your workspace will be able to see
  this template, including what is in it, and start a list from it." — rendered as the dialog's
  `DialogDescription` (or the target of its `aria-describedby`), so a screen reader reads it on open and
  Radix logs no missing-description warning (`people-screen.tsx:1160` is the precedent). Disclosure is
  the whole of the privacy answer here (Resolved assumption 7): no people, dates or weights are
  copied, and only a trip owner or editor can save;
- **Save template**, disabled while the trimmed name is empty (the `canSave` pattern at
  `list-dialogs.tsx:118`).

States:

- **idle**.
- **saving**: the button holds a `Spinner` and `loadingLabel`; the buttons are disabled and the input is
  `readOnly` (not `disabled`, which would drop focus); a second press cannot start a second write.
  Escape, a tap outside and the close button do nothing while the save is pending, so a phone user
  never loses the result.
- **conflict**: an inline `Alert tone="warning"` with `role="alert"` passed explicitly (the primitive
  applies passed props after its default `role="status"`, `alert.tsx:92-99`; a status region inserted
  together with its text is often missed) reading "Your workspace already has a template called
  “Ski kit”"; the input is `aria-invalid` and its `aria-describedby` includes the alert's id; two
  actions: **Save as “Ski kit 2”** (the primary: it cannot lose anything and shows the resolved name
  before it is committed; sends `mode: 'copy'`) and editing the name (any keystroke clears the
  conflict and the primary returns to **Save template**). A long suggested name wraps inside the
  button at 360px with no horizontal scroll.
- **limit**: `Alert tone="danger"` ("Your workspace keeps at most 100 templates. Delete one you no
  longer use, then save this one." or "A template holds at most 500 items, and this list has more.").
- **forbidden**: `Alert tone="danger"` with `save.forbidden` ("Only the trip’s owner and editors can
  save its lists as templates.").
- **failed** (a thrown error): `Alert tone="danger"` "The template was not saved. Check your connection
  and try again."; the dialog stays open so the typed name is not lost; the `useAction` failure toast
  takes the title `save.toastFailed`.
- **saved**: closes; the dialog (not a static `useAction` `success`) fires a toast "Template saved" with
  the body "Saved as “{name}”. Start a list from it with “From a template” on any trip." **only** on
  `status: 'saved'`, so a `conflict`, `limit` or `forbidden` result is never announced as saved.
- After `conflict`, `limit`, `forbidden` or `failed` the dialog moves focus to the name input with an
  explicit `inputRef.focus()` and does not rely on focus staying there. Closing returns focus to the
  menu trigger (the `Dialog` primitive remembers what had focus, `dialog.tsx:73-82`; the stage does
  not re-implement it).
- The saved template is visible in the library at its next open (it is read on open); no router
  invalidation is needed (`invalidate: false`).
- **Entry visibility.** The menu item is shown to everyone who can see the list: the lists screen has
  no role gating on any control today (`lists-board.tsx`), so a viewer sees "Save as template" and is
  answered with `save.forbidden`. Gating the whole lists screen by role is follow-up F2's, not a
  one-control special case here.

**Library copy and glossary.** The library's empty body now says where templates come from (`empty.body`,
below), and `lists.template.dialogBody` ("A template is a list you have saved before…",
`en/modules.ts:606-607`), which becomes wrong once a member sees a colleague's template, is reworded to
the workspace-wide meaning, in all 23 locales. `CONTEXT.md` gains a **Template** entry next to **Pack**:
a named, reusable copy of a packing list's items, held by the workspace and visible to every member of
it; applying one adds a new list to a trip; only the person who saved it, or a workspace owner or
admin, removes it.

Tests, first: see the Implementation Plan.

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
  `TemplateDialog` where it already is; the glossary term — `CONTEXT.md`. No new directory, no new
  primitive.
- **Seams.** `components/modules/lists` calls only `#/server/fns/*` (the existing pattern in
  `list-dialogs.tsx`); it imports nothing from `src/server/repos`. `list-templates.ts` is imported by
  components and so exports only server functions and types; `list-template-writes.ts` is imported by
  `list-templates.ts` handlers and by tests only.
- **Tenant isolation.** Every repository call goes through the tenant-scoped handles
  (`createTenantRepository`) or, for the raw batch inserts, stamps `organizationId` from the scope
  explicitly. The repository cases are **appended** to `src/server/repos/__tests__/tenant-isolation.test.ts`
  as a `describe('template writes')` block and call **repository functions only** (no test under
  `src/server/repos/__tests__` imports from `src/server/fns` today): Phase 1 — apply and save of 12 or
  more items write only rows carrying the writer's `organization_id`, zero from the other scope;
  Phase 2 — `deleteTemplate` with B's id from A's scope is `NotFoundError` and B's rows are unchanged;
  Phase 3 — `createTemplateFromList` with B's list id is `NotFoundError`, and `listTemplates` in A's
  scope never returns a row `createTemplate` wrote for B. The function-layer case — `saveListAsTemplate`
  naming B's trip, or naming a list of another trip — is `NotFoundError` with the template count
  unchanged — lives in `src/server/fns/__tests__/list-template-writes.test.ts`.
- **Quota.** None: see Phase 3.
- **Realtime.** None: Phase 3, server item 6.
- **Observability.** None added; a `TemplateLimitError` or `ForbiddenError` is an expected refusal and
  not an incident. No audit event: `AUDIT_ACTIONS` is deliberately narrow (`src/server/audit/trail.ts:40-48`).

## 📝 Data Model

None. No column, no index, no CHECK, no migration. `packing_templates.is_shared` (default `true`) is
neither read nor written by this stage; every template it writes is a workspace template, which is what
the default already says, and `listTemplates` returns every template of the workspace regardless of the
column.

## 📝 API Contracts

`deleteListTemplateFn` (Phase 2) and `saveListAsTemplateFn` (Phase 3) as tabled; `loadListTemplatesFn`
gains `canDelete`. Errors: `NotFoundError` (foreign or off-trip id) propagates. `ForbiddenError` and
`TripRoleError` become `{ status: 'forbidden' }`. Expected refusals of a save (`conflict`, `limit`,
`forbidden`) are **results, not exceptions**, so the dialog branches on `status` and an exception always
means a failure.

## 📝 UI/UX

- The library dialog keeps its size (`DialogContent size="md"`), rows and selection model. A row is an
  `li` holding the select `button` (as today) and, beside it, the Delete `IconButton`. At 360px the
  `Dialog` primitive already pins to the bottom of the screen and stacks its footer
  (`src/components/ui/dialog.tsx:52,91,213`): the plan's separate `Sheet` is not needed. At 1280px and
  2560px the dialog's own `max-w` caps the measure.
- The Save dialog is `size="sm"`; its disclosure sentence is body text above the actions (and the
  dialog's description), not a tooltip.
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
  one seeded template); the conflict (also with a long name at 360px), limit, forbidden and failed
  states and the refused delete are proved by the jsdom tests, and the PR body says "not captured" for
  each rather than claiming it.

## 📝 Copy

`en` keys in `src/lib/i18n/messages/en/modules.ts`, rendered as `modules.lists.template.…`; each lands in
all 23 locales in the same change (the `i18n-messages` skill; `pl`/`ru`/`uk`/`ar`/`cs` need the plural
branches `en` lacks for the counted keys, and the `{max}` and `{count}` keys are marked counted so
translators write the right case form). Phase in brackets.

| Key (`lists.template.…`)   | `en` text                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [3] `save.menu`            | Save as template                                                                                                                                                                 |
| [3] `save.title`           | Save as a template                                                                                                                                                               |
| [3] `save.disclosure`      | Everyone in your workspace will be able to see this template, including what is in it, and start a list from it.                                                                 |
| [3] `save.nameLabel`       | Template name                                                                                                                                                                    |
| [3] `save.submit`          | Save template                                                                                                                                                                    |
| [3] `save.saving`          | Saving the template                                                                                                                                                              |
| [3] `save.toast`           | Template saved                                                                                                                                                                   |
| [3] `save.toastBody`       | Saved as “{name}”. Start a list from it with “From a template” on any trip.                                                                                                      |
| [3] `save.toastFailed`     | The template was not saved                                                                                                                                                       |
| [3] `save.failed`          | The template was not saved. Check your connection and try again.                                                                                                                 |
| [3] `save.forbidden`       | Only the trip’s owner and editors can save its lists as templates.                                                                                                               |
| [3] `save.conflict.title`  | Your workspace already has a template called “{name}”                                                                                                                            |
| [3] `save.conflict.body`   | Choose another name, or keep both by saving this one as “{suggested}”.                                                                                                           |
| [3] `save.conflict.copy`   | Save as “{suggested}”                                                                                                                                                            |
| [3] `save.limit.templates` | Your workspace keeps at most {max} templates. Delete one you no longer use, then save this one. (counted)                                                                        |
| [3] `save.limit.items`     | A template holds at most {max} items, and this list has more. (counted)                                                                                                          |
| [3] `empty.body` (changed) | Open a list’s menu and choose “Save as template”. It will be here for every future trip.                                                                                         |
| [3] `dialogBody` (changed) | A template is a list your workspace has kept. Applying one copies it in as a new list on this trip — the original is left alone.                                                 |
| [2] `delete.label`         | Delete “{name}”                                                                                                                                                                  |
| [2] `delete.title`         | Delete “{name}”?                                                                                                                                                                 |
| [2] `delete.body` (plural) | one: The template and its {count} item are removed for everyone in your workspace. Lists already made from it are untouched. This cannot be undone. / other: …its {count} items… |
| [2] `delete.confirm`       | Delete template                                                                                                                                                                  |
| [2] `delete.done`          | Deleted “{name}”.                                                                                                                                                                |
| [2] `delete.toastFailed`   | The template was not deleted                                                                                                                                                     |
| [2] `delete.failed`        | That template was not deleted. Check your connection and try again.                                                                                                              |
| [2] `delete.forbidden`     | Only the person who saved it, or a workspace admin, can delete this template.                                                                                                    |

## 📝 Edge Cases & Failure Scenarios

| Case                                                               | Behaviour                                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Save a list of 12-500 items                                        | Works (chunked batch); before this stage it threw a D1 parameter error.                                                      |
| Save a list of 501+ items                                          | `limit: 'items'` result and the "holds at most 500" alert; nothing written.                                                  |
| Save the same list twice, same name                                | `conflict` with `suggestedName`; nothing written; the first template's rows are unchanged.                                   |
| Name differs only by case or surrounding space                     | Treated as a clash (compared trimmed and lower-cased).                                                                       |
| The list's name is 121-200 characters                              | The prefill is cut to 120; the input's `maxLength` is 120; no Zod error reaches the traveller.                               |
| Name cleared or whitespace-only                                    | **Save template** is disabled; Zod's message never shows.                                                                    |
| Two people save the same name at once                              | The loser's `UNIQUE` violation becomes `conflict`, not an error.                                                             |
| A write fails halfway                                              | One batch: neither the template nor any item exists afterwards; a retry is clean.                                            |
| The workspace holds 100 templates                                  | `limit: 'templates'`; delete one first. Simultaneous saves may overshoot 100 by the number of those saves.                   |
| A viewer chooses "Save as template"                                | `forbidden` result and the localised `save.forbidden` sentence; nothing written.                                             |
| A list id from another trip (private to the caller's eyes) is sent | `NotFoundError`; nothing written.                                                                                            |
| A member deletes another member's template (hand-made request)     | `forbidden` result; the button was never shown (`canDelete` false); the dialog shows `delete.forbidden`.                     |
| The author has left the workspace                                  | Their templates stay; an `owner` or `admin` can delete them.                                                                 |
| Deleting the last template                                         | The library re-reads in place and shows the empty state; focus goes to Cancel; the dialog stays open.                        |
| A delete fails (offline)                                           | The confirmation closes, then the library shows `delete.failed`; focus is on the row's Delete button.                        |
| Library load fails or is slow                                      | Unchanged: skeleton rows, then the dialog's error `Alert`.                                                                   |
| Applying a template of 8-500 items                                 | Works (chunked batch); before, 10 or more threw.                                                                             |
| Name of 120 characters saved as a copy                             | Cut to leave room for the ordinal; never over 120.                                                                           |
| The trip is archived                                               | Saving reads the trip and writes only to the workspace, so it is allowed; archived-write refusal remains the applier's (F2). |

## ✅ Acceptance criteria

Phase in brackets.

1. [1] A template of 12, 30 and 500 items is written, and a template of 8, 10, 30 and 500 items is
   applied, under the harness's D1 ceiling; each yields exactly that many items in order.
2. [1] A failing write inside the real batch leaves no template row (no stubbed `runBatch`); the
   existing template cases stay green unchanged.
3. [1] Apply and save of 12 or more items write only rows carrying the writer's `organization_id`;
   none is readable from another tenant's scope.
4. [2] `deleteTemplate`: author and workspace `admin`/`owner` may delete; a `member` deleting another's
   template is `ForbiddenError` with the rows unchanged; a foreign tenant's id is `NotFoundError`;
   the FK cascade removes the template's items.
5. [2] `deleteListTemplateFn` returns `{ status: 'forbidden' }` for a refused delete, a thrown failure
   for anything else; `canDelete` is true only for the author and admins; `applyListTemplateFn` is
   byte-identical.
6. [2] A Delete button appears exactly on rows with `canDelete`, as a sibling of the select button, with
   the accessible name "Delete “{name}”" and a target of at least 24px; confirming deletes, re-reads the
   library in place (no skeleton) and keeps the dialog open; focus lands on the row now in that
   position, the previous row, or Cancel when empty; a polite status line announces the deletion;
   cancelling deletes nothing; a refusal or failure closes the confirmation first, returns focus to the
   row's Delete button, and only then shows the matching alert (`delete.forbidden` or `delete.failed`).
7. [3] The 101st template and a list of 501 items are refused: `TemplateLimitError` in the repository,
   `{ status: 'limit' }` from the function; the 100th is accepted; nothing is written on a refusal.
8. [3] Saving twice with `mode: 'new'` returns `conflict` and writes nothing; `copy` writes `<name> 2`,
   `<name> 3`; case and surrounding space do not evade a clash; a 120-character name stays ≤ 120 with
   its suffix; a list named with 150 characters prefills and saves; a concurrent same-name save is a
   `conflict`, never a thrown `UNIQUE` error.
9. [3] A trip viewer gets `{ status: 'forbidden' }`; a list id from another trip, or a foreign tenant's
   trip or list, is `NotFoundError` and the template count is unchanged; neither function calls
   `mirrorToRoom`.
10. [3] "Save as template" is in the list's menu, disabled while the list is empty; the dialog shows the
    disclosure as its description, the prefilled name, and the idle/saving/conflict/limit/forbidden/failed
    states described; **Save template** is disabled on an empty name; the conflict alert has role `alert`
    and the input's `aria-describedby` includes its id; the conflict's primary action reads
    "Save as “{suggested}”"; typing clears the conflict; the saving state blocks a second press and
    every way of closing the dialog; focus is on the name input after every non-saved result; the
    "Template saved" toast fires only on `saved`.
11. [3] The empty library body names the list menu; `dialogBody` is reworded; the saved template is in
    the library at its next open; `CONTEXT.md` has the **Template** entry.
12. [2, 3] Every new key exists in all 23 locales and `pnpm test` (parity) is green; the changed
    `empty.body` and `dialogBody` are changed in all 23.
13. [3] The cross-tenant function-layer case (`saveListAsTemplate` naming another tenant's trip or list)
    is `NotFoundError`, and the repository cases in the isolation block pass.
14. [all] `capture.mjs` of the lists route reports no console error or warning (Radix's missing
    description warning included); opening either dialog moves nothing behind it; nothing outside the
    owned paths and the documents a phase's grep names changed; `package.json` and `pnpm-lock.yaml` are
    untouched.

## 📝 Risks & Impact Review

| Risk                                                                                                                                                                                    | Severity               | Mitigation                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `05-S1` rewrites `applyTemplateToTrip`/`createTemplateFromList` after (or before) this stage                                                                                            | Medium                 | Category-agnostic edits; Phase 1 item 2 is conditional on the code's state; Phase 3's menu host follows the stated rule. |
| A 500-item template applied is ~100 statements in one D1 batch                                                                                                                          | Low                    | `chunkFor(boundParametersPerRow(…))` is a conservative 5 rows/statement; the 500-row test runs it; no other path does.   |
| The count-then-insert ceiling is not serialised                                                                                                                                         | Low                    | Stated; a soft bound, not a quota; no metric (non-additive table rebuild, `docs/DEPLOY.md`).                             |
| A trip owner publishes a private trip's list contents to the whole workspace                                                                                                            | Low                    | Owner/editor only; list bound to trip; visible disclosure sentence; no people, dates or weights are copied.              |
| `loadListTemplatesFn` reads every item of every template to show four sample names: at 100 templates of 500 items that is 101 queries and up to 50,000 rows each time the library opens | Low                    | Accepted for this stage (real templates are tens of items); follow-up F3 (a count plus a four-row sample per template).  |
| Existing list writers have no role check and do not tie `listId`/`itemId` to `tripId` (private-trip access)                                                                             | **High, pre-existing** | Not touched here; follow-up F2, written up as access to private trips inside the workspace.                              |
| `ForbiddenError` is not authored copy                                                                                                                                                   | Low                    | Both new functions turn it into a `forbidden` result with localised copy; `canDelete` hides the button.                  |
| The dialog's select-and-footer model stays while a Delete sits on each row                                                                                                              | Low                    | Delete is a sibling control with its own focus stop and name; selection is unaffected.                                   |

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
- **F3 — a cheaper library read.** `loadListTemplatesFn` returns a count and a four-row sample per
  template from the database instead of reading every item row.

## 📋 Phasing

| Phase | Slice                                                  | Blocked by                                                                                          | Demoable on its own                                                                        |
| ----- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1     | The D1 fix: chunked, atomic `createTemplate` and apply | none                                                                                                | Applying a template of 30 items works through the existing "From a template" dialog        |
| 2     | Delete: author rule, function, library button          | none (Phase 1 is not required: the files it touches do not overlap)                                 | A template can be deleted from the library, with a confirmation, by its author or an admin |
| 3     | Save: limits, function, dialog, menu entry, glossary   | Phases 1 and 2 (a 30-item save needs the fix; Phase 2 creates or extends the shared files); every `05-S1` ticket **if** any exist when sliced | A list can be saved, copied under a new name, and found in the library                     |

Three tickets for `afk-to-tickets`, each a vertical slice a person can use: Phase 1 repairs a feature that
exists, Phase 2 and Phase 3 each add one traveller-visible capability. Phase 3's block on Phase 1 is
implicit through its tests (a 30-item save needs the fix), so its ticket lists **Phase 1 and Phase 2**.
"Every `05-S1` ticket" means the tickets sliced from the spec whose `Plan` row is `05-S1`.

## 📋 Implementation Plan

### Phase 1 — The D1 fix

1. Write `src/server/repos/__tests__/lists-templates.test.ts` first, with the cases under Phase 1 (harness,
   D1 ceiling). Watch the 12-item save and the 10-item apply fail.
2. `lists.ts`: rewrite `createTemplate` as one `runBatch` of a template insert and chunked item inserts;
   point `createTemplateFromList` at it.
3. `applyTemplateToTrip`: add the 8/10/30/500-row apply cases; edit the function only if they fail,
   keeping `requireById`/`requireTrip` before the batch.
4. Append the Phase 1 isolation cases to `tenant-isolation.test.ts`.
5. Docs grep (the rule in `AGENTS.md`, recorded in the PR template): `createTemplate`,
   `createTemplateFromList`, `applyTemplateToTrip`, `MAX_BOUND_PARAMETERS`, `LST-04` across `docs/`,
   `.ai/`, `src/`, `CONTEXT.md`; update what states what this phase changes.

### Phase 2 — Delete

1. Tests first: the repository delete cases (append to `lists-templates.test.ts`), `list-template-writes.test.ts`
   (`deleteListTemplate`, `canDelete`), the isolation case, and `template-dialog.test.tsx` (jsdom, project
   `ui`): Delete only on `canDelete` rows, as a sibling of the select button, accessible name, `size="sm"`;
   confirm deletes and re-reads **in place** (the skeleton never reappears); focus targets (the row now in
   the position, the previous row, Cancel when empty); the polite status line reads `delete.done`; cancel
   deletes nothing; `forbidden` and a thrown failure each close the confirmation first, return focus to
   the row's Delete button and then show their own alert; `useAction` takes `invalidate: false`, no
   `success` toast.
2. `lists.ts` `deleteTemplate` rule; `list-template-writes.ts` (`deleteListTemplate`), `list-templates.ts`
   (`deleteListTemplateFn`), `canDelete` on `loadListTemplatesFn` and `ListTemplateOption`.
3. `list-dialogs.tsx`: the Delete `IconButton`, the `ConfirmDialog`, the in-place re-read, the status
   line; add `data-part` attributes `template-library` (the existing "From a template" button,
   `lists-board.tsx`) and `template-delete` (per row) for the capture.
4. Add the Phase 2 keys to all 23 locales (the `delete.body` plural with every branch each locale needs).
5. Docs grep: `deleteTemplate`, `TemplateDialog`, `canDelete`, `From a template`.

### Phase 3 — Save

1. Tests first: repository limit cases (the 101st template, 501 items, the 100th accepted, nothing written
   on a refusal); `list-template-writes.test.ts` (conflict, `copy` ordinals, case-only clash, 120-character
   suffix, 150-character list name, limit, viewer `forbidden`, off-trip list id, foreign trip,
   concurrent-save `UNIQUE` becomes `conflict`); the Phase 3 isolation cases; `save-template-dialog.test.tsx`
   (jsdom): disclosure as description, prefilled and cut name, `maxLength`, empty name disables the button,
   Enter submits, saving blocks a second press and every way of closing and keeps the input `readOnly`,
   `conflict` shows a `role="alert"` warning with `aria-invalid`, `aria-describedby` and the primary
   "Save as “{suggested}”" sending `mode: 'copy'`, typing clears the conflict, `limit`/`forbidden`/`failed`
   states, focus on the input after each, the toast only on `saved`.
2. `lists.ts`: export `MAX_TEMPLATES_PER_WORKSPACE`, `MAX_TEMPLATE_ITEMS`, `TemplateLimitError`; the count
   and item checks in `createTemplate`. `list-template-writes.ts` (`saveListAsTemplate`), `list-templates.ts`
   (`saveListAsTemplateFn`).
3. `save-template-dialog.tsx`; the "Save as template" menu item (disabled with no items), per the rule in
   "Dependency on plan stage `05-S1`"; the dialog mounted by the board; export through `index.ts`;
   `data-part="template-save"` on the menu item and `template-save-submit` on the button.
4. Change `lists.template.empty.body` and `dialogBody`, and add the Phase 3 keys, in all 23 locales; add the
   **Template** entry to `CONTEXT.md`.
5. Docs grep: `LST-04`, `lists.template.`, `Save a list as a template`, `packing_templates`,
   `createTemplateFromList`, `CONTEXT.md` **Pack**/**Template**.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every
ticket's PR. No screenshot is compared anywhere (ADR 0016) and no `e2e/` declaration is added: every
failure mode here — the D1 ceiling, the clash, the rules, the states — is reproduced by a harness or
jsdom test, and the existing journeys already open the lists tab under `watchConsole`.

The visual judgement is the **blind A/B pair** (`docs/SPEC.md` §7 item 4, `verifying-changes`
skill), captured with `scripts/visual/capture.mjs` against a demo trip with at least one list with
items, `--auth`, viewports `360x800,1280x900,2560x1440`, themes `light,dark`: the library
(`--click '[data-part="template-library"]'`), the list menu then the Save dialog (`--click` takes one
selector, so the menu is opened by the capture's first click and the dialog by a second capture; where
the demo cannot reach a state, the jsdom test proves it), and the delete confirmation where the demo
workspace shows a template. The script presses no keys, so the keyboard path (focus on open, focus
return, the conflict announcement) is proved by the jsdom tests. Each selector is verified to resolve to
exactly one element against a running server before the capture runs. The capture's `console` and
`warnings` output goes into the PR body; frames stay out of the repository.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                                   | Applied default                                                                                                                                                                                                                                                                                                                                                                     | Why                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does the stage edit `src/server/repos/lists.ts`, which the plan forbids?                                                                   | Yes: `createTemplate` and `applyTemplateToTrip` become D1-safe chunked atomic batches (architect verdict A2 on a measured defect: saving 12+ items and applying 10+ fail under D1's 100-parameter ceiling).                                                                                                                                                                         | The plan's only reason was wave-parallel file ownership; tickets now run one at a time, and the plan's "no repo edit" cannot be kept without shipping a feature that errors on every real list.                                                       |
| 2   | How does the stage relate to the unmet `05-S1`?                                                                                            | Phases 1-2 have no `05-S1` blocker and stay category-agnostic; Phase 3's menu entry is `Blocked by` the `05-S1` tickets **if** any exist when the spec is sliced, otherwise it builds on the `menuItems` array at HEAD (architect B3, then the panel's round-1 condition that an unattended slicing run cannot name tickets that do not exist).                                     | `05-S1` owns the category migration of apply/save and the list actions' new home; a conditional edge keeps the pipeline unblocked and loses no work.                                                                                                  |
| 3   | Atomic `replaceTemplateFromList`, `updateTemplateMeta`, the Replace flow, rename and private/shared toggle?                                | Deferred to follow-up F1; the stage ships `new` and `copy` plus Delete (product owner P2b against architect A3, resolved to the more reversible option).                                                                                                                                                                                                                            | Save-as-a-copy plus Delete refreshes a template with no destructive button and no window in which the workspace holds neither; nothing in the stage lacks a repository write.                                                                         |
| 4   | Where do the entry points live?                                                                                                            | One always-present library entry (the existing "From a template" button), plus a per-list "Save as template" in the list's menu, disabled with no items; Save is its own small dialog, not a tab (product owner P1c).                                                                                                                                                               | A brand-new workspace needs an entry that explains where templates come from, which resolves the plan's contradiction between hiding Apply and drawing an empty state.                                                                                |
| 5   | How much of the plan's UI motion ships?                                                                                                    | Every reachable state, the responsive, keyboard and focus behaviour; not the 24 ms entrance stagger, the tab-pill slide, the `package` glyph or a separate Sheet (product owner P3b).                                                                                                                                                                                               | The `Dialog` primitive already pins to the bottom on narrow viewports; nothing reachable depends on the dropped motion.                                                                                                                               |
| 6   | Who may delete a template?                                                                                                                 | The author, or a workspace `owner`/`admin`, enforced in the repository `deleteTemplate` with a `ForbiddenError` (security S1b, the `collab.ts:166-176` precedent). `canDelete` is computed server-side for the button.                                                                                                                                                              | A guard that lives only in a handler does not hold for the next caller (`docs/SPEC.md` §6); a template of someone who left must stay removable.                                                                                                       |
| 7   | Who may save, and what protects a private trip's list?                                                                                     | Trip `owner`/`editor` only (`assertTripRole`, security S2b); the list is bound to the trip through `listTripLists`; a visible disclosure sentence is the privacy answer, `is_shared` stays unused (S3a).                                                                                                                                                                            | `createTemplateFromList` re-reads the list workspace-wide, so without the binding a member could publish a list of a private trip they cannot open; a template carries no people, dates or weights.                                                   |
| 8   | The existing list writers have no role or archived guard (security S4).                                                                    | Left alone and filed as follow-up F2 (S4a, with `applyListTemplateFn` untouched); the new functions are guarded. F2 is written up as private-trip access, not cosmetics.                                                                                                                                                                                                            | Guarding every writer is a separate, larger and riskier change to code this stage does not own; the new surface adds no new exposure.                                                                                                                 |
| 9   | Where does the 100-template cap live and is there a quota metric?                                                                          | In the repository as `TemplateLimitError` (`limit: 'templates' \| 'items'`, `max`), mapped by the fns layer to a typed `limit` result; `MAX_TEMPLATES_PER_WORKSPACE = 100`, `MAX_TEMPLATE_ITEMS = 500`. No `usage_records` metric.                                                                                                                                                  | `USAGE_METRICS` is CHECK-constrained on a shipped table, so a new metric is a non-additive rebuild (`docs/DEPLOY.md`); the count-then-insert is not serialised and may overshoot by the number of simultaneous saves, which a soft ceiling tolerates. |
| 10  | Does saving stamp the trip, mirror to the room or write an audit event?                                                                    | No to all three.                                                                                                                                                                                                                                                                                                                                                                    | A template is workspace state read when the library opens, not trip state a peer renders; the plan itself says delete mirrors nothing, and `AUDIT_ACTIONS` is deliberately narrow.                                                                    |
| 11  | How is a name clash detected and resolved?                                                                                                 | Trimmed, case-insensitive comparison in the fns layer; `new` returns `conflict` with `suggestedName` (`<name> <n>`, n ≥ 2, cut to stay ≤ 120) and writes nothing; `copy` writes the suggestion; a concurrent `UNIQUE` violation becomes `conflict`. Expected refusals are results, not exceptions.                                                                                  | The unique index is case-sensitive, so near-duplicates would otherwise coexist; the dialog branches on `status`, and an exception always means failure.                                                                                               |
| 12  | Is the plan's e2e visual declaration kept?                                                                                                 | No: struck. The visual judgement is the blind A/B pair via `scripts/visual/capture.mjs`; no `e2e/` declaration is added.                                                                                                                                                                                                                                                            | ADR 0016 removed screenshot baselines; the failure modes are reproduced by harness and jsdom tests.                                                                                                                                                   |
| 13  | Does the stage add a new role gate for the Save menu item in the UI?                                                                       | No: the item is shown to everyone who can see the list and a viewer is answered with the localised `save.forbidden` sentence.                                                                                                                                                                                                                                                       | The lists screen has no role gating on any control; gating one control would be a special case, and the whole screen's gating belongs to F2.                                                                                                          |
| 14  | Plan inaccuracies (schema and `reserveTripSlug` line references, "three" versus "two" server functions, trip stamp on save versus delete). | Read as history; the spec states the code's truth at HEAD `9a2f4f0e` and ships two server functions.                                                                                                                                                                                                                                                                                | The spec describes the work left in today's terms.                                                                                                                                                                                                    |
| 15  | Are the phases slices or layers (panel round 1, product owner; `SDLC.md` SLC rule)?                                                        | Re-cut into three: Phase 1 the D1 fix (bug slice), Phase 2 Delete end to end, Phase 3 Save end to end. The server functions and limits travel with the slice that calls them.                                                                                                                                                                                                       | A change that works only once a later ticket lands is a layer, not a slice; the earlier cut left Phases 1-2 unreached until the `05-S1`-blocked UI landed.                                                                                            |
| 16  | How does a refusal reach the reader (panel round 1, traveller)?                                                                            | `ForbiddenError` and `TripRoleError` become `{ status: 'forbidden' }` results with localised keys (`delete.forbidden`, `save.forbidden`); every thrown failure shows a "check your connection" sentence; the `useAction` failure toast titles are `save.toastFailed` and `delete.toastFailed`; the saved toast fires only on `saved`.                                               | Neither error is localised authored copy, and the client could not tell "you may not" from a dropped connection; a static success toast would announce "saved" on a conflict.                                                                         |
| 17  | How are focus and announcements handled (panel round 1, accessibility)?                                                                    | Conflict alert gets an explicit `role="alert"` and is the input's `aria-describedby`; the input is `readOnly` while saving and focus is re-set after each non-saved result; disclosure is the dialog description; after a delete the rows are replaced in place with a defined focus target and a polite in-dialog status line, and the confirmation closes before any alert shows. | `Alert tone="warning"` is `role="status"` by default; a disabled focused control drops focus; the toaster is behind the modal and hidden from assistive technology.                                                                                   |
| 18  | Glossary and read cost (panel round 1, product owner and security).                                                                        | `CONTEXT.md` gains a **Template** entry and `dialogBody` is reworded, both in Phase 3; the library's read cost is written down as accepted, with follow-up F3.                                                                                                                                                                                                                      | The concept now has a visibility and a deletion rule that no document owns; 100 templates of 500 items would read 50,000 rows per library open, which no real template approaches.                                                                    |

## Panel verdicts

Round 1 (this commit's parent): product owner, software architect, security and tenancy, accessibility and
UX (traveller) each answered **approve with conditions**; every condition is applied in this revision
(rows 2, 15-18 above, and the sections they name). Round 2 verdicts are recorded below once given.
