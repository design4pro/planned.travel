# Keep a list as a template, and manage the workspace's template library

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **Status**         | ready                                      |
| **Issue**          | none                                       |
| **Spec PR**        | #847                                       |
| **Implementation** | none                                       |
| **Plan**           | 05-S2 (docs/plans/05-packing-and-todos.md) |

## 📝 TLDR

Plan stage `05-S2` closes reference row `LST-04` (templates and the template library) on the lists
tab (`/trips/$tripId/lists`). Today a traveller can apply a template but **cannot save one or delete
one**: `createTemplate` and `createTemplateFromList` in `src/server/repos/lists.ts` have no caller
outside tests, `deleteTemplate` has none at all, and the dialog's own empty state promises a way to
save that does not exist. This stage adds **Save as template** to each list's menu (with a name-clash
flow that never raises a database error and offers "Save as a copy"), **Delete** on each template of
the library, and the repository work without which neither would function on D1: saving a list of 12
or more items, and applying a template of 10 or more, **fail in production today** (measured below).

The stage is cut into three slices, in the order a traveller can use them: **Phase 1** the D1 fix (a
bug slice, verified by tests: no workspace holds a template yet), **Phase 2** Save (limits, server
function, dialog, list-menu entry, glossary), **Phase 3** Delete (author rule, server function,
library button). It describes the work **left** at HEAD (`9a2f4f0e`) and departs from the plan's stage
block in five places, each a row of the Resolved assumptions table: the plan forbade any repository
edit, left out the D1 defect, offered a `Replace it` flow, hid the library entry on an empty
workspace, and ran no authorisation beyond "can read the trip".

## 📝 Problem Statement

Today (`LST-04` is `partial`):

- `TemplateDialog` (`src/components/modules/lists/list-dialogs.tsx:519`) lists the workspace's
  templates (name, item count, first four names), applies the selected one as a **new list** on the
  trip (`applyListTemplateFn`, `src/server/fns/lists.ts`), and has loading, error and empty states.
  Its entry is the always-present "From a template" button in the board's filter row
  (`lists-board.tsx:300-310`). Its empty state says "Save a list as a template once you have one you
  would build again" (`src/lib/i18n/messages/en/modules.ts:501`) and there is nothing to press.
- `createTemplate` and `createTemplateFromList` (`src/server/repos/lists.ts:310,379`) are reached only
  from tests; `deleteTemplate` (`:332`) is reached from nothing, **tests included** (it has no case in
  `repositories.test.ts` or `tenant-isolation.test.ts`). No seed or script writes a template either, so
  every workspace, the demo one included, holds none.
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
| `src/server/repos/lists.ts` — edit: `createTemplate`, `applyTemplateToTrip` (D1-safe, atomic), limits, `deleteTemplate` (author rule) | `src/server/db/schema.ts` and `drizzle/` — **no migration**, no column, no index, no CHECK                             |
| `src/server/repos/__tests__/lists-templates.test.ts` — new; `tenant-isolation.test.ts` — append                                       | Every other function of `lists.ts` (list and item writers) and `src/server/fns/lists.ts`'s list/item writers           |
| `src/server/fns/list-template-writes.ts` — new, plain functions; `src/server/fns/list-templates.ts` — new, the two server functions   | `applyListTemplateFn` — unchanged (its guards are a follow-up, F2)                                                     |
| `src/server/fns/lists.ts` — edit: `loadListTemplatesFn` and `ListTemplateOption` gain `canDelete`, nothing else                       | `src/server/do/protocol.ts`, `src/server/worker.ts`, `wrangler.jsonc`, `src/styles/tokens.css`, `src/components/ui/**` |
| `src/server/fns/__tests__/list-template-writes.test.ts` — new                                                                         | `src/lib/format.ts`, `src/routeTree.gen.ts` (no route is added or edited; no `pnpm generate-routes`)                   |
| `src/components/modules/lists/save-template-dialog.tsx` — new; `list-dialogs.tsx`, `lists-board.tsx`, `index.ts` — edit               | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                                           |
| `src/components/modules/shared/controls.tsx` — edit: `ConfirmDialog` gains an optional `onClosed` (Phase 3)                           | `e2e/` — no declaration is added (see Verification)                                                                    |
| `src/components/modules/lists/__tests__/save-template-dialog.test.tsx`, `template-dialog.test.tsx` — new                              |                                                                                                                        |
| `src/lib/i18n/messages/<locale>/modules.ts` — edit, **all 23 locales**                                                                |                                                                                                                        |
| `CONTEXT.md` — a **Template** entry (Phase 2, extended in Phase 3)                                                                    |                                                                                                                        |
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

- **Phases 1 and 3 have no `05-S1` blocker of their own.** The D1 fix touches the repository, and
  Delete touches only `TemplateDialog` and the repository, none of which `05-S1`'s list menu or
  toolbar hosts (Phase 3 is blocked by Phase 2, which carries the edge below).
- **Phase 2 hosts "Save as template" in the list's menu**: at HEAD the `menuItems` array of
  `lists-board.tsx` (`:520-562`), rendered by the list header's `RowMenu` (`:624`; the `RowMenu` at
  `:1010` is the item row's, and is not the one meant). The rule the slicing run applies when it files
  Phase 2's ticket: it searches for a spec under `.ai/specs/` whose `Plan` row names `05-S1` and for a
  parent issue whose body starts `Spec: <that path>` (`afk-to-tickets` §1, §3). If such tickets
  **exist**, Phase 2 is `Blocked by` all of them and puts the entry in whatever menu or toolbar they
  left; if none exist (the case today: there is no `05-S1` spec), Phase 2 is blocked only by Phase 1 and
  adds the item to the `menuItems` array at HEAD. A later `05-S1` ticket then carries the menu's move,
  a hand-off **the `05-S1` spec must pick up**. The behaviour is the requirement; the host is whatever
  the code has when the ticket runs. No slicing run slices another spec to satisfy this edge: one spec
  a run.
- Two assertions are owed **by `05-S1`, not here**: that applying a template yields category records,
  and that saving such a list round-trips its group names. This stage's tests assert only the string
  form that exists today.

### Phase 1 — The repository: D1-safe and atomic (a bug slice)

All in `src/server/repos/lists.ts`; no new SQL outside it, every statement stamped with
`organization_id` from the scope. **No traveller can see this slice** (no workspace holds a template
until Phase 2 ships), so it is verified by the harness tests below, not by a demo; it stands alone
because `applyListTemplateFn` already reaches `applyTemplateToTrip`, and a template of 10 or more items
now applies.

1. **`createTemplate`** writes the template row and its items in **one `runBatch`**
   (`src/server/repos/batch.ts:69`): the template id is minted up front with `newId()`
   (`src/server/db/schema.ts:82`), then one statement for the template and one statement per chunk of
   `chunkFor(boundParametersPerRow(packingTemplateItems))` item rows (`batch.ts:27,34`) — the shape
   `transports.ts:1049-1056` already uses. Raw `scope.db.insert(...)` statements stamp
   `organizationId: scope.ctx.organizationId` explicitly, as that precedent does, **on the template row
   too**. The function re-reads the template through `packingTemplatesRepository.requireById` and
   returns it (same return type as today: callers use `.id`). A failure now leaves neither row.
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
statement inside the real batch**: a SQLite trigger created through `harness.sqlite`
(`harness.ts:119,250`) that does `RAISE(ABORT)` on an insert into `packing_template_items` with a
sentinel name (and, for the apply case, one on `packing_items`), so the batch fails on a later
statement and the harness rolls the earlier ones back (`harness.ts:169-181`). The ticket does **not**
stub `runBatch` (a stub that throws proves nothing about rollback) and does **not** use
`withSuppliedRowDefaults` (`schema.ts`), which the fixture-rows guard
(`src/routes/api/dev/-seed/__tests__/fixture-rows.test.ts:65-75`) permits no other caller of. The
existing `createTemplate`, `createTemplateFromList` and apply cases in `repositories.test.ts` and
`tenant-isolation.test.ts` (including the cross-tenant apply cases at
`tenant-isolation.test.ts:1503-1519`) stay green unchanged.

Tenant isolation (appended to `tenant-isolation.test.ts`, `describe('template writes')`, repository
calls only): in A's scope, apply a template of **at least 12 items** (so more than one chunk is
written): every `packing_lists` and `packing_items` row it writes carries A's `organization_id`, and
reads back as zero rows from B's scope; save a list of **at least 12 items**: the `packing_templates`
row **and** every `packing_template_items` row carry A's `organization_id` and none is readable from B's
scope (`packingTemplatesRepository.findById`, `listTemplates`); B's template is re-read by id
afterwards, unchanged.

### Phase 2 — Save a list as a template

**Repository.** `MAX_TEMPLATES_PER_WORKSPACE = 100` and `MAX_TEMPLATE_ITEMS = 500` (the latter replaces
the literal `500` in `createTemplateInput.items`, `lists.ts:112`) are exported constants.
`createTemplate` counts the workspace's templates (`packingTemplatesRepository.count(scope)`, the
tenant-scoped handle) and throws `TemplateLimitError` (`extends RepositoryError`, code
`'TEMPLATE_LIMIT'`, fields `limit: 'templates' | 'items'` and `max`) at 100, and throws it with
`limit: 'items'` when `items.length > MAX_TEMPLATE_ITEMS`, **before** Zod's own `.max()` would. There is
no quota metric: `USAGE_METRICS` is CHECK-constrained on a shipped table (`schema.ts:672`,
`enumCheck('usage_records_metric_chk', …)`), and adding a metric is a non-additive table rebuild, which
`docs/DEPLOY.md` ("Migration policy: migrations are additive") allows only on stated conditions that
are disproportionate for a count cap. The bound is a repository ceiling; the count-then-insert is not
serialised, so simultaneous saves can exceed it by the number of those saves. That is acceptable for a
soft ceiling and is stated here rather than discovered.

**Server.** Following `stay-writes.ts`/`stays.ts` (`src/server/fns/stay-writes.ts:1-9`): the logic is
**plain functions** in `list-template-writes.ts`, taking an explicit `TenantScope`, and
`list-templates.ts` holds only the `createServerFn` wrappers. A client build of a server-function
module keeps what the module exports, so a plain function exported beside a server function would
drag `./context` and `cloudflare:workers` into the browser; and outside a Start build a server function
discards its answer, so the plain functions are what the tests drive. **Phase 2 creates**
`list-template-writes.ts`, `list-templates.ts` and `list-template-writes.test.ts`; Phase 3 appends to
them. Zod v4, `z.strictObject()` (`src/routes/_app/-server/trip-lifecycle.ts:166` is the precedent), ids
as `z.string().trim().min(1).max(64)`, `name` as `z.string().trim().min(1).max(120)`, `mode` as
`z.enum(['new', 'copy'])` defaulting to `'new'`.

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
3. Read `listTemplates(scope)` (tenant-scoped: another workspace's template of the same name is not a
   clash). A name clashes when its trimmed, lower-cased form equals another template's (SQLite's unique
   index is case-sensitive, so "Ski kit" and "ski kit" would otherwise both pass this check and sit side
   by side as near-duplicates).
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
  `DialogDescription` (`list-dialogs.tsx:587-589` and `controls.tsx:198` are the precedents), so a
  screen reader reads it on open and Radix logs no missing-description warning. Disclosure is the whole
  of the privacy answer here (Resolved assumption 7): no people, dates or weights are copied, and only a
  trip owner or editor can save;
- a footer **Cancel** (`modules.action.cancel`, as every other list dialog has one:
  `list-dialogs.tsx:245,496,676`), disabled while saving, and **Save template**, disabled while the
  trimmed name is empty (the `canSave` pattern at `list-dialogs.tsx:118`).

States:

- **idle**.
- **saving**: the **Save template** button holds a `Spinner` and `loadingLabel`; both buttons are
  disabled and the input is `readOnly` (not `disabled`, which would drop focus); a second press cannot
  start a second write. Escape, a tap outside, the close button and Cancel do nothing while the save is
  pending, so a phone user never loses the result.
- **conflict**: an inline `Alert tone="warning"` with **`role="alert"` and `aria-live="assertive"`**
  passed explicitly (the primitive sets `role="status"` and a polite live region and then applies the
  caller's props, `alert.tsx:92-99`; a status region inserted together with its text is often missed)
  reading "Your workspace already has a template called “Ski kit”"; the input is `aria-invalid` and its
  `aria-describedby` includes the alert's id; two actions: **Save as “Ski kit 2”** (the primary: it
  cannot lose anything and shows the resolved name before it is committed; sends `mode: 'copy'`) and
  editing the name (any keystroke clears the conflict and the primary returns to **Save template**).
- **Long names wrap, they are not clipped.** `Button` is `whitespace-nowrap` with a fixed `h-10`
  (`button.tsx:14,68`) and `DialogContent` is `overflow-hidden` (`dialog.tsx:96`), so the copy button
  takes `className="h-auto min-h-10 whitespace-normal py-2 [overflow-wrap:anywhere]"`, and the conflict
  alert's title allows wrapping anywhere. The same rule applies to the Delete confirmation's title in
  Phase 3.
- **limit**: `Alert tone="danger"` ("Your workspace keeps at most 100 templates." or "A template holds at
  most 500 items, and this list has more."). The first sentence **carries no advice to delete** in this
  phase, because Delete ships in Phase 3, which appends "Delete one you no longer use, then save this
  one." to it in all 23 locales.
- **forbidden**: `Alert tone="danger"` with `save.forbidden` ("Only the trip’s owner and editors can
  save its lists as templates.").
- **failed** (a thrown error): `Alert tone="danger"` "The template was not saved. Check your connection
  and try again."; the dialog stays open so the typed name is not lost. The action is a `useAction`
  with `invalidate: false`, `failure: save.toastFailed` **and** `fallback: save.failed`, so neither the
  toast's title nor its body is the hardcoded English default (`use-action.ts:117,121`; a redacted
  `NotFoundError` would otherwise show "Try again in a moment.").
- **saved**: the dialog closes. The "Template saved" toast (body: "Saved as “{name}”. Start a list from
  it with “{from}” on any trip.", `{from}` interpolated from `lists.template.from`) is **not** a static
  `useAction` `success`: it fires **only on `status: 'saved'`**, and only **after the dialog has fully
  closed** (from `DialogContent`'s `onCloseAutoFocus`, which Radix fires once the exit animation ends and
  the content unmounts), because until then the page behind is hidden from assistive technology and a
  toast shown earlier may never be read out (WCAG 4.1.3). `components/ui` is not edited.
- **Focus.** After `conflict`, `limit`, `forbidden` or `failed` the dialog moves focus to the name input
  with an explicit `inputRef.focus()` and does not rely on focus staying there. On close (Cancel,
  Escape or saved) focus must be on the list menu's trigger button (the `RowMenu` at
  `lists-board.tsx:624`): the primitive returns focus to whatever had it at open (`dialog.tsx:103-117`),
  which here is the menu **item**, and that no longer exists when the dialog closes (the primitive then
  gives up, `:115`). The board therefore passes `SaveTemplateDialog` a ref to the menu trigger and the
  dialog's `onCloseAutoFocus` focuses it (`event.preventDefault()` first). A test asserts it.
- The saved template is visible in the library at its next open (it is read on open); no router
  invalidation is needed.
- **Entry visibility.** The menu item is shown to everyone who can see the list: the lists screen has
  no role gating on any control today (`lists-board.tsx`), so a viewer sees "Save as template" and is
  answered with `save.forbidden`. Gating the whole lists screen by role is follow-up F2's, not a
  one-control special case here.

**Library copy and glossary.** The library's empty body now says where templates come from
(`empty.body`, below), worded from the label of the control it names (`{menu}` is `save.menu`'s text)
rather than from a place ("Open a list's menu" would be false if the `05-S1` toolbar hosts the entry).
`lists.template.dialogBody` ("A template is a list you have saved before…", `en/modules.ts:606-607`),
which becomes wrong once a member sees a colleague's template, is reworded to the workspace-wide meaning,
in all 23 locales. `CONTEXT.md` gains a **Template** entry next to **Pack**: a named, reusable copy of a
packing list's items, held by the workspace and visible to every member of it; applying one adds a new
list to a trip. (Phase 3 appends who may remove one.)

Tests, first: see the Implementation Plan.

### Phase 3 — Delete: the author rule, one server function, the library button

**Repository.** `deleteTemplate` loads the template (`requireById`, so a foreign id is
`NotFoundError`), throws `ForbiddenError('delete another traveller’s template', ['owner', 'admin'])`
when `scope.ctx.role === 'member'` and `template.createdBy !== scope.ctx.userId`, then `requireRemove`.
This is the rule `deleteMessage` states at `src/server/repos/collab.ts:166-176`, kept in the
repository because a guard that lives only in a handler does not hold for the next caller
(`docs/SPEC.md` §6). `created_by` is a plain user id, so a template of someone who has left stays
and a workspace `owner`/`admin` can still remove it. `ForbiddenError` is not authored copy
(`src/server/errors/public.ts`), so the function layer turns it into a result (below).

**Server.** `deleteListTemplateFn`, appended to the files Phase 2 created.

| Function               | Method | Input            | Returns                                                          |
| ---------------------- | ------ | ---------------- | ---------------------------------------------------------------- |
| `deleteListTemplateFn` | POST   | `{ templateId }` | `{ status: 'deleted', templateId }` or `{ status: 'forbidden' }` |

`deleteListTemplate(scope, { templateId })` calls `deleteTemplate`. A `ForbiddenError` becomes
`{ status: 'forbidden' }` (an expected refusal is a **result**, so the dialog can tell "you may not"
from "it failed"). A **`NotFoundError` becomes `{ status: 'deleted', templateId }`**: the delete is
idempotent, because a template a colleague already removed, or a retry after a lost response, must not
tell the traveller "check your connection" about a template that is gone; and one answer for "absent"
and "another workspace's" leaks nothing (the repository still deletes nothing). Every other error
propagates. It takes no `tripId`: a template belongs to the workspace.

**`loadListTemplatesFn`** gains `canDelete: boolean` per template (`createdBy === scope.ctx.userId ||
hasAtLeastRole(scope.ctx, 'admin')`, `src/server/repos/context.ts`), so the UI offers Delete only to
those the repository would allow; the server refusal is the rule and the hidden button is a courtesy.
`ListTemplateOption` carries it; `applyListTemplateFn` is not touched.

**`ConfirmDialog`** (`src/components/modules/shared/controls.tsx:178-225`) gains an optional
`onClosed?: () => void`, wired to its `DialogContent`'s `onCloseAutoFocus` (fired once the exit
animation ends). It has no other change and every existing caller is untouched.

**Library UI.** `TemplateDialog` (`list-dialogs.tsx:519`) stays the library, opened by the existing
always-present button, so a brand-new workspace can reach it and read its empty state.

- Each template row keeps its select-and-footer **Apply template** model unchanged and gains a
  **Delete** `IconButton` (`size="sm"`, `variant="ghost"`: 32px, which clears WCAG 2.5.8; no new colour)
  as a **sibling** of the row's select `button` (never nested inside it), shown only when `canDelete`,
  with the accessible name "Delete “{name}”".
- It opens a `ConfirmDialog` mounted by `TemplateDialog` with its own request state, whose title names
  the template (a long name wraps: `[overflow-wrap:anywhere]` on the title), whose body names its row
  count and says it cannot be undone, confirm label "Delete template". Its `pending` is the delete
  action's pending state. **The confirmation closes on success and on failure**, so a failure is never
  left behind it.
- **Order of effects (WCAG 4.1.3).** The `role="status"` line is in `DialogBody` from the moment the
  rows render, **empty**. Until the confirmation has fully closed (its `onClosed`), its exit animation
  runs and the library behind it is hidden from assistive technology, so **nothing is announced and
  focus does not move until `onClosed`**: only then does the status line get its text, the alert render,
  or focus move. A test asserts that neither the alert nor the status text exists while the confirmation
  is still in the DOM.
- **Success.** On `deleted`, the row is **removed from local state at once** (a slow re-read never leaves
  a deleted template on screen with Apply available), and the library then re-reads
  (`loadListTemplatesFn`) and **replaces the rows in place**, never returning to the skeleton. If that
  re-read fails, the rows stay as they are minus the deleted one and the full-dialog load error is **not**
  shown (the delete succeeded). After `onClosed`, focus moves to the select button of the row now at the
  deleted row's position, or the previous row's if it was the last; if the library is now empty, to the
  footer's Cancel button. Selection moves with it, or to the empty state. The status line then reads
  "Deleted “{name}”." (`delete.done`): **not** a toast, because the toaster
  (`src/components/layout/app-toaster.tsx`, mounted in `src/routes/__root.tsx`) sits outside the modal and
  the page behind an open modal is hidden from assistive technology (`dialog.tsx:48-49`). The action takes
  `invalidate: false` and passes no `success` toast, because the trip's loader shows no template.
- **Refused or failed.** After `onClosed`, the primitive returns focus to the row's Delete button and
  **then** the library shows its inline `Alert tone="danger"`; an alert never renders under an open
  confirmation. A `forbidden` result says "Only the person who saved it, or a workspace admin, can delete
  this template." (`delete.forbidden`); a thrown failure says "That template was not deleted. Check your
  connection and try again." (`delete.failed`). The action passes `failure: delete.toastFailed` **and**
  `fallback: delete.failed`, so no hardcoded English default reaches the toast.
- `save.limit.templates` gains its advice here: "Your workspace keeps at most {max} templates. Delete
  one you no longer use, then save this one." (changed in all 23 locales), and the `CONTEXT.md`
  **Template** entry gains "Only the person who saved it, or a workspace owner or admin, removes it."
- No rename control, no private/shared toggle, no badge claiming either, and no **Replace** (see
  Out of scope): none has a repository write behind it.

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
- **Delete before Save.** Delete would ship with nothing to act on in any workspace (no seed writes a
  template), a layer rather than a slice (`SDLC.md`); Save first makes every ticket usable when it
  merges, at the price of a limit sentence that gains its advice one phase later.

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
  `src/server/repos/__tests__` imports from `src/server/fns` today):
  - Phase 1 — apply and save of 12 or more items write only rows (the template row included) carrying
    the writer's `organization_id`, none readable from the other scope.
  - Phase 2 — `createTemplateFromList` with B's list id from A's scope is `NotFoundError`;
    `listTemplates` in A's scope never returns a row `createTemplate` wrote for B; **with B's workspace
    already at `MAX_TEMPLATES_PER_WORKSPACE` templates, `createTemplate` in A's scope succeeds and A's
    count goes up by one** (B's templates never count against A's limit).
  - Phase 3 — `deleteTemplate` with B's id from A's scope is `NotFoundError` and B's rows are unchanged.

  The function-layer cases live in `src/server/fns/__tests__/list-template-writes.test.ts`:
  `saveListAsTemplate` naming B's trip, or naming a list of another trip, is `NotFoundError` with the
  template count unchanged; **B holding a template of the same name does not make A's
  `saveListAsTemplate` (`mode: 'new'`) a `conflict`**; `deleteListTemplate` with B's id from A's scope
  answers `deleted` and B's template and rows are unchanged.

- **Quota.** None: see Phase 2.
- **Realtime.** None: Phase 2, server item 6.
- **Observability.** None added; a `TemplateLimitError` or `ForbiddenError` is an expected refusal and
  not an incident. No audit event: `AUDIT_ACTIONS` is deliberately narrow (`src/server/audit/trail.ts:40-48`).

## 📝 Data Model

None. No column, no index, no CHECK, no migration. `packing_templates.is_shared` (default `true`) is
neither read nor written by this stage; every template it writes is a workspace template, which is what
the default already says, and `listTemplates` returns every template of the workspace regardless of the
column.

## 📝 API Contracts

`saveListAsTemplateFn` (Phase 2) and `deleteListTemplateFn` (Phase 3) as tabled; `loadListTemplatesFn`
gains `canDelete`. `ForbiddenError` and `TripRoleError` become `{ status: 'forbidden' }`; a
`NotFoundError` on a **save** propagates (a foreign or off-trip id), on a **delete** it is `deleted`.
Expected refusals of a save (`conflict`, `limit`, `forbidden`) are **results, not exceptions**, so the
dialog branches on `status` and an exception always means a failure.

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
  button, the menu item, the Save/copy/Cancel buttons and the delete confirmation. Logical properties
  only (`ms-`/`me-`), so `ar` mirrors.

## 📝 Visual change expected

- Route `/trips/$tripId/lists`: **list menu** gains "Save as template" (enabled with items, disabled
  without) and the **Save dialog** in idle, saving and conflict states (Phase 2); the **library dialog**
  gains a Delete button per deletable row and a new empty-state sentence, and the **delete
  confirmation** (Phase 3). Phase 1 changes nothing a traveller sees.
- Light and dark, at 360, 1280 and 2560 px. No other route changes.
- **The demo workspace holds no template** (no seed writes one). The Phase 2 capture shows the Save
  dialog and the library's empty state; the library with rows and the delete confirmation are captured
  in Phase 3 only after the capture run **saves a template through the Save dialog first**, else the PR
  body says "not captured". The conflict with a long name, and the limit, forbidden and failed states
  and the refused delete, are proved by jsdom assertions (the long-name wrapping by an assertion on the
  classes above) and the PR body says "not captured" for each rather than claiming it.

## 📝 Copy

`en` keys in `src/lib/i18n/messages/en/modules.ts`, rendered as `modules.lists.template.…`; each lands in
all 23 locales in the same change (the `i18n-messages` skill; `pl`/`ru`/`uk`/`ar`/`cs` need the plural
branches `en` lacks for the counted keys, and the `{max}` and `{count}` keys are marked counted so
translators write the right case form). `{from}` and `{menu}` are interpolated from the existing
`lists.template.from` ("From a template") and `lists.template.save.menu`, so no locale can point at a
button name that does not exist in that language. Phase in brackets.

| Key (`lists.template.…`)             | `en` text                                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [2] `save.menu`                      | Save as template                                                                                                                                                                 |
| [2] `save.title`                     | Save as a template                                                                                                                                                               |
| [2] `save.disclosure`                | Everyone in your workspace will be able to see this template, including what is in it, and start a list from it.                                                                 |
| [2] `save.nameLabel`                 | Template name                                                                                                                                                                    |
| [2] `save.submit`                    | Save template                                                                                                                                                                    |
| [2] `save.saving`                    | Saving the template                                                                                                                                                              |
| [2] `save.toast`                     | Template saved                                                                                                                                                                   |
| [2] `save.toastBody`                 | Saved as “{name}”. Start a list from it with “{from}” on any trip.                                                                                                               |
| [2] `save.toastFailed`               | The template was not saved                                                                                                                                                       |
| [2] `save.failed`                    | The template was not saved. Check your connection and try again.                                                                                                                 |
| [2] `save.forbidden`                 | Only the trip’s owner and editors can save its lists as templates.                                                                                                               |
| [2] `save.conflict.title`            | Your workspace already has a template called “{name}”                                                                                                                            |
| [2] `save.conflict.body`             | Choose another name, or keep both by saving this one as “{suggested}”.                                                                                                           |
| [2] `save.conflict.copy`             | Save as “{suggested}”                                                                                                                                                            |
| [2] `save.limit.templates`           | Your workspace keeps at most {max} templates. (counted; [3] changes it, below)                                                                                                   |
| [2] `save.limit.items`               | A template holds at most {max} items, and this list has more. (counted)                                                                                                          |
| [2] `empty.body` (changed)           | Choose “{menu}” on a list and it will be here for every future trip.                                                                                                             |
| [2] `dialogBody` (changed)           | A template is a list your workspace has kept. Applying one copies it in as a new list on this trip — the original is left alone.                                                 |
| [3] `delete.label`                   | Delete “{name}”                                                                                                                                                                  |
| [3] `delete.title`                   | Delete “{name}”?                                                                                                                                                                 |
| [3] `delete.body` (plural)           | one: The template and its {count} item are removed for everyone in your workspace. Lists already made from it are untouched. This cannot be undone. / other: …its {count} items… |
| [3] `delete.confirm`                 | Delete template                                                                                                                                                                  |
| [3] `delete.done`                    | Deleted “{name}”.                                                                                                                                                                |
| [3] `delete.toastFailed`             | The template was not deleted                                                                                                                                                     |
| [3] `delete.failed`                  | That template was not deleted. Check your connection and try again.                                                                                                              |
| [3] `delete.forbidden`               | Only the person who saved it, or a workspace admin, can delete this template.                                                                                                    |
| [3] `save.limit.templates` (changed) | Your workspace keeps at most {max} templates. Delete one you no longer use, then save this one. (counted)                                                                        |

## 📝 Edge Cases & Failure Scenarios

| Case                                                               | Behaviour                                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Save a list of 12-500 items                                        | Works (chunked batch); before this stage it threw a D1 parameter error.                                                      |
| Save a list of 501+ items                                          | `limit: 'items'` result and the "holds at most 500" alert; nothing written.                                                  |
| Save the same list twice, same name                                | `conflict` with `suggestedName`; nothing written; the first template's rows are unchanged.                                   |
| Name differs only by case or surrounding space                     | Treated as a clash (compared trimmed and lower-cased).                                                                       |
| Another workspace has a template of the same name                  | Not a clash: the read is tenant-scoped.                                                                                      |
| The list's name is 121-200 characters                              | The prefill is cut to 120; the input's `maxLength` is 120; no Zod error reaches the traveller.                               |
| A very long name in the conflict button or a confirmation title    | Wraps (`[overflow-wrap:anywhere]`, `whitespace-normal`); never clipped at 360px.                                             |
| Name cleared or whitespace-only                                    | **Save template** is disabled; Zod's message never shows.                                                                    |
| Two people save the same name at once                              | The loser's `UNIQUE` violation becomes `conflict`, not an error.                                                             |
| A write fails halfway                                              | One batch: neither the template nor any item exists afterwards; a retry is clean.                                            |
| The workspace holds 100 templates                                  | `limit: 'templates'`; delete one first (Phase 3). Simultaneous saves may overshoot 100 by the number of those saves.         |
| A viewer chooses "Save as template"                                | `forbidden` result and the localised `save.forbidden` sentence; nothing written.                                             |
| A list id from another trip (private to the caller's eyes) is sent | `NotFoundError`; nothing written.                                                                                            |
| A member deletes another member's template (hand-made request)     | `forbidden` result; the button was never shown (`canDelete` false); the dialog shows `delete.forbidden`.                     |
| A template a colleague already deleted, or a retried delete        | `deleted` (idempotent): the row leaves the dialog and `delete.failed` never shows.                                           |
| The author has left the workspace                                  | Their templates stay; an `owner` or `admin` can delete them.                                                                 |
| Deleting the last template                                         | The library shows the empty state; focus goes to Cancel; the dialog stays open.                                              |
| A delete fails (offline)                                           | The confirmation closes, then the library shows `delete.failed`; focus is on the row's Delete button.                        |
| The re-read after a successful delete fails                        | The rows stay minus the deleted one; the load error is not shown.                                                            |
| Library load fails or is slow                                      | Unchanged: skeleton rows, then the dialog's error `Alert`.                                                                   |
| Applying a template of 8-500 items                                 | Works (chunked batch); before, 10 or more threw.                                                                             |
| Name of 120 characters saved as a copy                             | Cut to leave room for the ordinal; never over 120.                                                                           |
| The trip is archived                                               | Saving reads the trip and writes only to the workspace, so it is allowed; archived-write refusal remains the applier's (F2). |

## ✅ Acceptance criteria

Phase in brackets.

1. [1] A template of 12, 30 and 500 items is written, and a template of 8, 10, 30 and 500 items is
   applied, under the harness's D1 ceiling; each yields exactly that many items in order.
2. [1] A failing write inside the real batch (a `RAISE(ABORT)` trigger, no stubbed `runBatch`, no
   `withSuppliedRowDefaults`) leaves no template row; the existing template cases stay green unchanged.
3. [1] Apply and save of 12 or more items write only rows (the template row included) carrying the
   writer's `organization_id`; none is readable from another tenant's scope.
4. [2] The 101st template and a list of 501 items are refused: `TemplateLimitError` in the repository,
   `{ status: 'limit' }` from the function; the 100th is accepted; nothing is written on a refusal;
   another workspace's templates never count against the limit.
5. [2] Saving twice with `mode: 'new'` returns `conflict` and writes nothing; `copy` writes `<name> 2`,
   `<name> 3`; case and surrounding space do not evade a clash; another workspace's template of the same
   name is not a clash; a 120-character name stays ≤ 120 with its suffix; a list named with 150
   characters prefills and saves; a concurrent same-name save is a `conflict`, never a thrown `UNIQUE`
   error.
6. [2] A trip viewer gets `{ status: 'forbidden' }`; a list id from another trip, or a foreign tenant's
   trip or list, is `NotFoundError` and the template count is unchanged; neither function calls
   `mirrorToRoom`.
7. [2] "Save as template" is in the list's menu, disabled while the list is empty; the dialog shows the
   disclosure as its description, the prefilled name, a Cancel and the idle/saving/conflict/limit/
   forbidden/failed states described; **Save template** is disabled on an empty name; the conflict
   alert has `role="alert"` and `aria-live="assertive"` and the input's `aria-describedby` includes its
   id; the conflict's primary action reads "Save as “{suggested}”" and wraps a long name; typing clears
   the conflict; the saving state blocks a second press and every way of closing (Cancel, Escape,
   outside tap, the close button); focus is on the name input after every non-saved result; after
   Cancel, Escape and a successful save, focus is on the list menu's trigger; the "Template saved" toast
   fires only on `saved`, after the dialog has closed; the failure toast's title and body are
   `save.toastFailed` and `save.failed`.
8. [2] The empty library body names the entry by its label; `dialogBody` is reworded; the saved template
   is in the library at its next open; `CONTEXT.md` has the **Template** entry.
9. [3] `deleteTemplate`: author and workspace `admin`/`owner` may delete; a `member` deleting another's
   template is `ForbiddenError` with the rows unchanged; a foreign tenant's id is `NotFoundError`;
   the FK cascade removes the template's items. (`deleteTemplate` has no test today: these are its first.)
10. [3] `deleteListTemplateFn` returns `{ status: 'forbidden' }` for a refused delete, `deleted` for a
    template that is already gone or belongs to another workspace (nothing deleted), a thrown failure for
    anything else; `canDelete` is true only for the author and admins; `applyListTemplateFn` is
    byte-identical.
11. [3] A Delete button appears exactly on rows with `canDelete`, as a sibling of the select button, with
    the accessible name "Delete “{name}”" and a target of at least 24px; confirming removes the row at
    once, re-reads the library in place (no skeleton, and a failed re-read shows no load error) and keeps
    the dialog open; while the confirmation is still in the DOM neither the alert nor the status text
    exists; after it has closed focus lands on the row now in that position, the previous row, or Cancel
    when empty, and a polite status line announces the deletion; cancelling deletes nothing; a refusal or
    failure closes the confirmation first, returns focus to the row's Delete button, and only then shows
    the matching alert (`delete.forbidden` or `delete.failed`); the failure toast's title and body are
    `delete.toastFailed` and `delete.failed`; `ConfirmDialog`'s other callers are unchanged.
12. [2] Every Phase 2 key exists in all 23 locales, and the changed `empty.body` and `dialogBody` are
    changed in all 23; `pnpm test` (parity) is green.
13. [3] Every Phase 3 key exists in all 23 locales, and the changed `save.limit.templates` is changed in
    all 23; `pnpm test` (parity) is green; `CONTEXT.md`'s **Template** entry names who may remove one.
14. [2, 3] The cross-tenant function-layer cases pass (`saveListAsTemplate` naming another tenant's trip
    or list is `NotFoundError`; another workspace's same-named template is not a conflict; a foreign
    template id answers `deleted` without effect) and the repository cases in the isolation block pass.
15. [2, 3] `capture.mjs` of the lists route reports no console error or warning (Radix's missing
    description warning included); opening a dialog moves nothing behind it.
16. [all] Nothing outside the owned paths and the documents a phase's grep names changed;
    `package.json` and `pnpm-lock.yaml` are untouched.

## 📝 Risks & Impact Review

| Risk                                                                                                                                                                                    | Severity               | Mitigation                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `05-S1` rewrites `applyTemplateToTrip`/`createTemplateFromList` after (or before) this stage                                                                                            | Medium                 | Category-agnostic edits; Phase 1 item 2 is conditional on the code's state; Phase 2's menu host follows the stated rule.                                           |
| A 500-item template applied is ~100 statements in one D1 batch                                                                                                                          | Low                    | `chunkFor(boundParametersPerRow(…))` is a conservative 5 rows/statement; the 500-row test runs it; no other path does.                                             |
| The count-then-insert ceiling is not serialised                                                                                                                                         | Low                    | Stated; a soft bound, not a quota; no metric (non-additive table rebuild, `docs/DEPLOY.md`).                                                                       |
| A trip owner publishes a private trip's list contents to the whole workspace                                                                                                            | Low                    | Owner/editor only; list bound to trip; visible disclosure sentence; no people, dates or weights are copied.                                                        |
| `loadListTemplatesFn` reads every item of every template to show four sample names: at 100 templates of 500 items that is 101 queries and up to 50,000 rows each time the library opens | Low                    | Accepted for this stage (real templates are tens of items); follow-up F3 (a count plus a four-row sample per template).                                            |
| Existing list writers have no role check and do not tie `listId`/`itemId` to `tripId` (private-trip access)                                                                             | **High, pre-existing** | Not touched here; follow-up F2, written up as access to private trips inside the workspace.                                                                        |
| `ForbiddenError` is not authored copy                                                                                                                                                   | Low                    | Both new functions turn it into a `forbidden` result with localised copy; `canDelete` hides the button.                                                            |
| Announcements and focus depend on the exit animation having ended                                                                                                                       | Low                    | `onCloseAutoFocus` / `ConfirmDialog.onClosed` (fired after unmount) is the seam; jsdom has no animation, so the tests assert the order of effects, not the timing. |
| The dialog's select-and-footer model stays while a Delete sits on each row                                                                                                              | Low                    | Delete is a sibling control with its own focus stop and name; selection is unaffected.                                                                             |

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

| Phase | Slice                                                  | Blocked by                                                                                          | Usable when it merges                                                                                              |
| ----- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1     | The D1 fix: chunked, atomic `createTemplate` and apply | none                                                                                                | Verified by the harness tests only: no workspace, the demo included, holds a template, so a traveller sees nothing |
| 2     | Save: limits, function, dialog, menu entry, glossary   | Phase 1; every `05-S1` ticket **if** any exist when sliced (see "Dependency on plan stage `05-S1`") | A list can be saved, copied under a new name, found in the library and applied on another trip                     |
| 3     | Delete: author rule, function, library button          | Phase 2                                                                                             | A template can be deleted from the library, with a confirmation, by its author or an admin                         |

Three tickets for `afk-to-tickets`, each a slice that works when it merges: Phase 1 repairs a feature that
exists, Phase 2 and Phase 3 each add one traveller-visible capability, in the order that gives Delete
something to act on. "Every `05-S1` ticket" means the tickets sliced from the spec whose `Plan` row is
`05-S1`.

## 📋 Implementation Plan

### Phase 1 — The D1 fix

1. Write `src/server/repos/__tests__/lists-templates.test.ts` first, with the cases under Phase 1 (harness,
   D1 ceiling, the trigger seam). Watch the 12-item save and the 10-item apply fail.
2. `lists.ts`: rewrite `createTemplate` as one `runBatch` of a template insert and chunked item inserts;
   point `createTemplateFromList` at it.
3. `applyTemplateToTrip`: add the 8/10/30/500-row apply cases; edit the function only if they fail,
   keeping `requireById`/`requireTrip` before the batch.
4. Append the Phase 1 isolation cases to `tenant-isolation.test.ts`.
5. Docs grep (the rule in `AGENTS.md`, recorded in the PR template): `createTemplate`,
   `createTemplateFromList`, `applyTemplateToTrip`, `MAX_BOUND_PARAMETERS`, `LST-04` across `docs/`,
   `.ai/`, `src/`, `CONTEXT.md`; update what states what this phase changes.

### Phase 2 — Save

1. Tests first: repository limit cases (the 101st template, 501 items, the 100th accepted, nothing written
   on a refusal, B at the cap does not block A); `list-template-writes.test.ts` (conflict, `copy`
   ordinals, case-only clash, B's same-named template is no clash, 120-character suffix, 150-character
   list name, limit, viewer `forbidden`, off-trip list id, foreign trip, concurrent-save `UNIQUE` becomes
   `conflict`); the Phase 2 isolation cases; `save-template-dialog.test.tsx` (jsdom): disclosure as
   description, prefilled and cut name, `maxLength`, Cancel, empty name disables the button, Enter submits,
   saving blocks a second press and every way of closing and keeps the input `readOnly`, `conflict` shows
   a warning with `role="alert"`, `aria-live="assertive"`, `aria-invalid`, `aria-describedby` and the
   primary "Save as “{suggested}”" (with the wrapping classes) sending `mode: 'copy'`, typing clears the
   conflict, `limit`/`forbidden`/`failed` states and the failure toast's title and body, focus on the
   input after each, the toast only on `saved` and only after close, focus on the menu trigger after
   Cancel, Escape and saved.
2. `lists.ts`: export `MAX_TEMPLATES_PER_WORKSPACE`, `MAX_TEMPLATE_ITEMS`, `TemplateLimitError`; the count
   and item checks in `createTemplate`. `list-template-writes.ts` (`saveListAsTemplate`),
   `list-templates.ts` (`saveListAsTemplateFn`).
3. `save-template-dialog.tsx`; the "Save as template" menu item (disabled with no items), per the rule in
   "Dependency on plan stage `05-S1`"; the dialog mounted by the board with the menu trigger's ref;
   export through `index.ts`; `data-part="template-library"` on the existing "From a template" button,
   `template-save` on the menu item and `template-save-submit` on the button.
4. Change `lists.template.empty.body` and `dialogBody`, and add the Phase 2 keys, in all 23 locales; add the
   **Template** entry to `CONTEXT.md`.
5. Docs grep: `LST-04`, `lists.template.`, `Save a list as a template`, `packing_templates`,
   `createTemplateFromList`, `CONTEXT.md` **Pack**/**Template**.

### Phase 3 — Delete

1. Tests first: the repository delete cases (append to `lists-templates.test.ts`),
   `list-template-writes.test.ts` (`deleteListTemplate`: author, admin, member refused as `forbidden`, a
   gone or foreign id answers `deleted`, `canDelete`), the isolation case, and `template-dialog.test.tsx`
   (jsdom, project `ui`): Delete only on `canDelete` rows, as a sibling of the select button, accessible
   name, `size="sm"`; confirming removes the row at once and re-reads **in place** (the skeleton never
   reappears; a failed re-read shows no load error); neither alert nor status text exists while the
   confirmation is in the DOM (`ConfirmDialog.onClosed`); then the focus targets (the row now in the
   position, the previous row, Cancel when empty) and the status line reads `delete.done`; cancel deletes
   nothing; `forbidden` and a thrown failure each close the confirmation first, return focus to the row's
   Delete button and then show their own alert; the failure toast's title and body; `invalidate: false`,
   no `success` toast; a long template name wraps.
2. `lists.ts` `deleteTemplate` rule; `list-template-writes.ts` (`deleteListTemplate`), `list-templates.ts`
   (`deleteListTemplateFn`), `canDelete` on `loadListTemplatesFn` and `ListTemplateOption`;
   `controls.tsx` `ConfirmDialog.onClosed`.
3. `list-dialogs.tsx`: the Delete `IconButton`, the `ConfirmDialog`, the local removal and in-place
   re-read, the status line; `data-part="template-delete"` per row for the capture.
4. Add the Phase 3 keys and the changed `save.limit.templates` to all 23 locales (the `delete.body` plural
   with every branch each locale needs); append the removal sentence to the `CONTEXT.md` entry.
5. Docs grep: `deleteTemplate`, `TemplateDialog`, `canDelete`, `From a template`, `ConfirmDialog`.

## Verification

The gate is `validation.commands` in `.ai/agentic.config.json` (`pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`), run on the last commit of every
ticket's PR. No screenshot is compared anywhere (ADR 0016) and no `e2e/` declaration is added: every
failure mode here — the D1 ceiling, the clash, the rules, the states — is reproduced by a harness or
jsdom test, and the existing journeys already open the lists tab under `watchConsole`.

The visual judgement of Phases 2 and 3 is the **blind A/B pair** (`docs/SPEC.md` §7 item 4,
`verifying-changes` skill), captured with `scripts/visual/capture.mjs` against a demo trip with at least
one list with items, `--auth`, viewports `360x800,1280x900,2560x1440`, themes `light,dark`: the library
(`--click '[data-part="template-library"]'`), the list menu then the Save dialog (`--click` takes one
selector, so the menu is opened by the capture's first click and the dialog by a second capture; where
the demo cannot reach a state, the jsdom test proves it), and, in Phase 3, the library with rows and the
delete confirmation once a template has been saved through the Save dialog. The script presses no keys,
so the keyboard path (focus on open, focus return, the conflict announcement) is proved by the jsdom
tests. Each selector is verified to resolve to exactly one element against a running server before the
capture runs. The capture's `console` and `warnings` output goes into the PR body; frames stay out of
the repository.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                                   | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Why                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does the stage edit `src/server/repos/lists.ts`, which the plan forbids?                                                                   | Yes: `createTemplate` and `applyTemplateToTrip` become D1-safe chunked atomic batches (architect verdict A2 on a measured defect: saving 12+ items and applying 10+ fail under D1's 100-parameter ceiling).                                                                                                                                                                                                                                                                                                                                                                         | The plan's only reason was wave-parallel file ownership; tickets now run one at a time, and the plan's "no repo edit" cannot be kept without shipping a feature that errors on every real list.                                                         |
| 2   | How does the stage relate to the unmet `05-S1`?                                                                                            | Phase 1 has no `05-S1` blocker and everything stays category-agnostic; Phase 2's menu entry is `Blocked by` the `05-S1` tickets **if** any exist when the spec is sliced (found by a spec whose `Plan` row is `05-S1` and a parent issue whose body starts `Spec: <path>`), otherwise it builds on the `menuItems` array at HEAD; Phase 3 follows Phase 2 (architect B3, then the panel's condition that an unattended slicing run cannot name tickets that do not exist).                                                                                                          | `05-S1` owns the category migration of apply/save and the list actions' new home; a conditional edge keeps the pipeline unblocked and loses no work.                                                                                                    |
| 3   | Atomic `replaceTemplateFromList`, `updateTemplateMeta`, the Replace flow, rename and private/shared toggle?                                | Deferred to follow-up F1; the stage ships `new` and `copy` plus Delete (product owner P2b against architect A3, resolved to the more reversible option).                                                                                                                                                                                                                                                                                                                                                                                                                            | Save-as-a-copy plus Delete refreshes a template with no destructive button and no window in which the workspace holds neither; nothing in the stage lacks a repository write.                                                                           |
| 4   | Where do the entry points live?                                                                                                            | One always-present library entry (the existing "From a template" button), plus a per-list "Save as template" in the list's menu, disabled with no items; Save is its own small dialog, not a tab (product owner P1c).                                                                                                                                                                                                                                                                                                                                                               | A brand-new workspace needs an entry that explains where templates come from, which resolves the plan's contradiction between hiding Apply and drawing an empty state.                                                                                  |
| 5   | How much of the plan's UI motion ships?                                                                                                    | Every reachable state, the responsive, keyboard and focus behaviour; not the 24 ms entrance stagger, the tab-pill slide, the `package` glyph or a separate Sheet (product owner P3b).                                                                                                                                                                                                                                                                                                                                                                                               | The `Dialog` primitive already pins to the bottom on narrow viewports; nothing reachable depends on the dropped motion.                                                                                                                                 |
| 6   | Who may delete a template?                                                                                                                 | The author, or a workspace `owner`/`admin`, enforced in the repository `deleteTemplate` with a `ForbiddenError` (security S1b, the `collab.ts:166-176` precedent). `canDelete` is computed server-side for the button.                                                                                                                                                                                                                                                                                                                                                              | A guard that lives only in a handler does not hold for the next caller (`docs/SPEC.md` §6); a template of someone who left must stay removable.                                                                                                         |
| 7   | Who may save, and what protects a private trip's list?                                                                                     | Trip `owner`/`editor` only (`assertTripRole`, security S2b); the list is bound to the trip through `listTripLists`; a visible disclosure sentence is the privacy answer, `is_shared` stays unused (S3a).                                                                                                                                                                                                                                                                                                                                                                            | `createTemplateFromList` re-reads the list workspace-wide, so without the binding a member could publish a list of a private trip they cannot open; a template carries no people, dates or weights.                                                     |
| 8   | The existing list writers have no role or archived guard (security S4).                                                                    | Left alone and filed as follow-up F2 (S4a, with `applyListTemplateFn` untouched); the new functions are guarded. F2 is written up as private-trip access, not cosmetics.                                                                                                                                                                                                                                                                                                                                                                                                            | Guarding every writer is a separate, larger and riskier change to code this stage does not own; the new surface adds no new exposure.                                                                                                                   |
| 9   | Where does the 100-template cap live and is there a quota metric?                                                                          | In the repository as `TemplateLimitError` (`limit: 'templates' \| 'items'`, `max`), mapped by the fns layer to a typed `limit` result; `MAX_TEMPLATES_PER_WORKSPACE = 100`, `MAX_TEMPLATE_ITEMS = 500`. No `usage_records` metric.                                                                                                                                                                                                                                                                                                                                                  | `USAGE_METRICS` is CHECK-constrained on a shipped table, so a new metric is a non-additive rebuild (`docs/DEPLOY.md`); the count-then-insert is not serialised and may overshoot by the number of simultaneous saves, which a soft ceiling tolerates.   |
| 10  | Does saving stamp the trip, mirror to the room or write an audit event?                                                                    | No to all three.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | A template is workspace state read when the library opens, not trip state a peer renders; the plan itself says delete mirrors nothing, and `AUDIT_ACTIONS` is deliberately narrow.                                                                      |
| 11  | How is a name clash detected and resolved?                                                                                                 | Trimmed, case-insensitive comparison in the fns layer; `new` returns `conflict` with `suggestedName` (`<name> <n>`, n ≥ 2, cut to stay ≤ 120) and writes nothing; `copy` writes the suggestion; a concurrent `UNIQUE` violation becomes `conflict`. Expected refusals are results, not exceptions.                                                                                                                                                                                                                                                                                  | The unique index is case-sensitive, so near-duplicates would otherwise coexist; the dialog branches on `status`, and an exception always means failure.                                                                                                 |
| 12  | Is the plan's e2e visual declaration kept?                                                                                                 | No: struck. The visual judgement is the blind A/B pair via `scripts/visual/capture.mjs`; no `e2e/` declaration is added.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR 0016 removed screenshot baselines; the failure modes are reproduced by harness and jsdom tests.                                                                                                                                                     |
| 13  | Does the stage add a new role gate for the Save menu item in the UI?                                                                       | No: the item is shown to everyone who can see the list and a viewer is answered with the localised `save.forbidden` sentence.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | The lists screen has no role gating on any control; gating one control would be a special case, and the whole screen's gating belongs to F2.                                                                                                            |
| 14  | Plan inaccuracies (schema and `reserveTripSlug` line references, "three" versus "two" server functions, trip stamp on save versus delete). | Read as history; the spec states the code's truth at HEAD `9a2f4f0e` and ships two server functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | The spec describes the work left in today's terms.                                                                                                                                                                                                      |
| 15  | Are the phases slices or layers, and in what order (panel: product owner, round 1 and 2; traveller)?                                       | Three: Phase 1 the D1 fix (a bug slice, verified by tests only: no template exists in any workspace), Phase 2 Save end to end, Phase 3 Delete end to end. Save before Delete, resolving the product owner's "Delete has nothing to act on" against the traveller's "the limit sentence advises deleting" in favour of the slice rule: the limit sentence ships without the advice and Phase 3 adds it in all 23 locales.                                                                                                                                                            | A change that works only once a later ticket lands is a layer, not a slice (`SDLC.md`); the cost of the order is one changed copy key.                                                                                                                  |
| 16  | How does a refusal or a failure reach the reader (panel: traveller)?                                                                       | `ForbiddenError` and `TripRoleError` become `{ status: 'forbidden' }` results with localised keys (`delete.forbidden`, `save.forbidden`); a `NotFoundError` on delete is `deleted` (idempotent); every thrown failure shows a "check your connection" sentence; both `useAction` calls pass `failure` **and** `fallback` keys so no English default reaches a toast; the saved toast fires only on `saved`.                                                                                                                                                                         | Neither error is localised authored copy, and the client could not tell "you may not" from a dropped connection; a retried delete must not claim a connection problem; a static success toast would announce "saved" on a conflict.                     |
| 17  | How are focus and announcements handled (panel: accessibility)?                                                                            | Conflict alert gets an explicit `role="alert"` and `aria-live="assertive"` and is the input's `aria-describedby`; the input is `readOnly` while saving and focus is re-set after each non-saved result; focus returns to the list menu's trigger (the opener item is gone); disclosure is the dialog description; after a delete the rows are replaced in place with a defined focus target and a polite in-dialog status line, and nothing is announced or moved until the confirmation (`ConfirmDialog.onClosed`) has fully closed; the saved toast waits for `onCloseAutoFocus`. | `Alert tone="warning"` is `role="status"` by default; a disabled focused control drops focus; the toaster and the page behind a modal are hidden from assistive technology until the exit animation ends.                                               |
| 18  | Glossary, copy and read cost (panel: product owner, security, traveller).                                                                  | `CONTEXT.md` gains a **Template** entry in Phase 2 (the removal sentence in Phase 3) and `dialogBody` is reworded; `empty.body` and `save.toastBody` interpolate the labels of the controls they name from `lists.template.save.menu` and `lists.template.from`; the library's read cost is written down as accepted, with follow-up F3.                                                                                                                                                                                                                                            | The concept now has a visibility and a deletion rule no document owns; a locale cannot quote a button name that does not exist in that language; 100 templates of 500 items would read 50,000 rows per library open, which no real template approaches. |
| 19  | How does a long name behave and how are the name field and dialog guarded (panel: traveller)?                                              | Prefill cut to 120, `maxLength={120}`, Save disabled on an empty trimmed name, Enter submits, a footer Cancel, no way to close while saving; long names wrap (`whitespace-normal`, `[overflow-wrap:anywhere]`) in the conflict button and the confirmation title, asserted by class in jsdom.                                                                                                                                                                                                                                                                                       | The list title allows 200 characters and Zod's English message must never reach a traveller; `Button` is `whitespace-nowrap` and the dialog `overflow-hidden`, so a long name would be clipped at 360px.                                                |

## Panel verdicts

- **Round 1** (spec at `c4dd00b0`): product owner, software architect, security and tenancy, accessibility
  and traveller UX each answered **approve with conditions**; every condition was applied (rows 2 and
  15-18).
- **Round 2** (spec at `124bdb7e`): the same five answered **approve with conditions**, none **revise**.
  Every condition is applied in this revision (rows 15-19 and the sections they name): Save before
  Delete; the trigger-based atomicity seam and corrected citations; the template-row and cap isolation
  cases; `onClosed`/`onCloseAutoFocus` for the order of effects; `fallback` keys; wrapping classes;
  idempotent delete; a Cancel; labels interpolated in copy. The skill allows at most two rounds, so the
  revision is not put to a third.
