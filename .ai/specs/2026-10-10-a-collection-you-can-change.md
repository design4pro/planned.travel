# Collections: change a collection, set where each place stands, and sort places by label

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S4 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S4` is the write half of the saved-places module (reference row `ADD-09`). Today a traveller can **create** a
collection, save places into it and **read** it, and cannot do anything else: the collection cannot be renamed, re-described,
re-coloured or deleted, a saved place's status (`idea`, `shortlisted`, `planned`, `visited`, `rejected`) cannot be changed, and the
label pills the detail screen filters by cannot be created, renamed, assigned or removed. Six repository functions
(`updateCollection`, `deleteCollection`, `setCollectionPlaceStatus`, `createLabel`, `deleteLabel`, `setCollectionPlaceLabels`) exist
and no product server function calls any of them. This stage gives them a boundary and a screen, as **two tickets that are each a
full path from repository to screen**:

1. **08-S4a - change a collection and set where a place stands.** An actions menu on the detail header (edit name, description and
   colour; delete), a status picker on every place card, an owner-or-admin guard in the repository, and the localisation of the
   detail screen.
2. **08-S4b - labels.** A label manager (create, rename, recolour, delete), a labels picker on each place card, an any-of filter
   across several labels, a batched label assignment with the cap that D1 can actually take, and a ceiling on labels per collection.

No schema change, no migration, no route added, no package added, no queue message, no realtime patch.

**Reference row `ADD-09` stays `partial`.** The plan closes it "done"; this spec does not, because the reference behaviour includes a
collection cover and the cover is deferred (Resolved assumption 2). The row is closed by the stage that gives collections an upload
path.

This spec describes the work that is **left** at HEAD (`74d861d8`). It departs from the plan's stage block wherever the code the plan
cites has changed or a specialist found the plan wrong; every departure is a row of the Resolved assumptions table. Later stages are
named here by what they ship (the sharing-roles stage, the copy-a-place-into-a-trip stage, the module-enforcement stage), never by
id: the backlog reads any mention of a stage id in a spec as that stage being specified already.

## 📝 Problem Statement

Verified against the repository at HEAD:

- **A read-only screen over a complete data layer.** `src/routes/_app/collections/$collectionId.tsx` renders `loadCollectionDetail`
  (`src/routes/_app/-server/library.ts`): five status filter pills, label filter pills, place cards with a status `Badge` and
  read-only label chips, a "Labels in this collection" panel. The only collection write in the product is `createCollectionFn`
  (`library.ts`). The six repository writes above are reached by repository tests and the dev seeder
  (`src/routes/api/dev/-seed/apply.ts` calls `deleteCollection`, `createLabel` and `setCollectionPlaceLabels`) and by nothing else.
- **The status is five-valued and stays five.** The plan row calls it three-state; `COLLECTION_PLACE_STATUSES`
  (`src/server/db/schema.ts`) is `idea`, `shortlisted`, `planned`, `visited`, `rejected`, the `collection_places_status_chk` CHECK
  enforces it and the screen already filters on all five. Narrowing a column is not additive. Five values do not cycle usefully on a
  tap, so the control is a small picker, not a cycle.
- **There is no way to rename or recolour a label.** The plan's block says "no function is added" and its label manager wants inline
  rename and a colour swatch. `createLabel` and `deleteLabel` are all that exists (Resolved assumption 6).
- **The label assignment cap is a latent failure, not a cap.** `setCollectionPlaceLabels` accepts up to 50 ids and inserts them with
  one `insertMany`. A `collection_place_labels` row binds four columns (`organization_id`, `collection_place_id`, `label_id`,
  `created_at`) and D1 refuses a statement with more than 100 bound parameters (`MAX_BOUND_PARAMETERS`,
  `src/server/repos/batch.ts`): 50 rows is 200 parameters, 16 rows is 64. The plan's sixteen is right; it has to be enforced where the
  statement is built. The function is also a delete followed by an insert, two statements, so a failure between them leaves a place
  with none of its labels.
- **`runBatch` cannot take what the plan says to give it.** The plan turns "`removeWhere` then `insertMany`" into one
  `runBatch(scope, [...])`; both are `async` helpers that execute at once (`src/server/repos/base.ts`). `runBatch`
  (`src/server/repos/batch.ts`) takes un-awaited Drizzle builders, as `reorderPlaces` (`src/server/repos/places.ts`) passes them.
- **Labels have no ceiling.** The plan says labels are "bounded by the unique `(collection_id, name)` index". That index refuses a
  repeated name; it does not bound the count. The detail loader ships every label to the browser and the filter bar renders a pill for
  each.
- **A duplicate label name has no way to reach the screen as a field error.** `collection_labels_collection_name_unq` is
  case-sensitive and a repository error reaches the client as a redacted `unexpected` failure (`src/lib/errors.ts`,
  `classifyFailure`); the closed `AUTHORED_ERROR_NAMES` (`src/server/errors/public.ts`, `docs/SPEC.md` §9 rule 10) must not grow.
- **`visibility` is not enforced on any read.** `listCollections`, `getCollection`, `listCollectionsWithCounts`,
  `listCollectionPlaces` and `listLabels` apply the tenant filter and nothing else. A collection created as "Only me"
  (`shell.visibility.private`, the create dialog in `src/routes/_app/-ui/create-dialogs.tsx`) is listed on `/collections` and
  openable by id by every member of the workspace, and "Anyone with the link" has no route behind it. The plan knows `visibility`
  gates nothing and still lists it in the actions menu (Resolved assumption 3).
- **Nothing renders a collection's `icon` or `cover_image_url`.** `collections/index.tsx` paints the colour strip, name,
  description, visibility badge and place count; `$collectionId.tsx` the same. An icon or cover field would save a value nobody sees,
  and a pasted cover URL is a hotlink that sends every reader's address to a third party (the sibling journal spec dropped its cover
  field for the same reason).
- **Renaming never changed the slug, and still will not.** The plan says `updateCollection` "reserves a new slug through
  `reserveSlug` when the name changes". It reserves one only when the caller passes a `slug`
  (`src/server/repos/collections.ts`); the screens address a collection by id and the slug is read by the dev seeder alone.
- **The plan has no control to put a label on a place.** Its UI lists the actions menu, the status picker and a label manager (create
  or remove labels), and the `setPlaceLabelsFn` it names has no caller on any screen. Labels nobody can attach filter nothing.
- **The screen is English.** `$collectionId.tsx` carries its copy as literals and `humaniseToken(status)` for the status names
  (`docs/SPEC.md` §9 bans both). This stage localises everything it writes or rewrites on that screen.
- **The delete cascades.** `collection_places` and `collection_labels` reference `collections` `ON DELETE CASCADE`, so deleting a
  collection removes every saved place, label and assignment, with no archive and no undo. The trip delete already asks for the
  trip's name when the trip holds anything (`assertConfirmed`, `src/routes/_app/-server/trip-lifecycle.ts`).
- **`owner_user_id` is a plain text column with no foreign key.** A collection whose owner has left the workspace has no one to edit
  or delete it unless a workspace admin may.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                     | Not owned (read only, or left alone)                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/repos/collections.ts` - `requireOwnedCollection`, `canManageCollection`, `collectionDeleteSummary`, `updateLabel`, the label ceiling, the batched `setCollectionPlaceLabels`; `updateCollection` and `deleteCollection` gain the guard                                                                                                                               | `createCollection`, `addCollectionPlace`, `saveTripPlaceToCollection`, `updateCollectionPlace`, `deleteCollectionPlace`: no caller added, no change                               |
| `src/lib/collections/labels.ts` (+ test) - new, pure: the two label numbers, the name fold                                                                                                                                                                                                                                                                                       | `src/server/db/schema.ts`, `drizzle/`: no schema change. `src/lib/plans.ts`, `src/server/billing/**`: no quota, no `MODULE_KEYS` entry                                            |
| `src/routes/_app/-server/collections.ts` (+ `__tests__/collections.test.ts`) - new: the module's write functions                                                                                                                                                                                                                                                                 | `src/routes/_app/-server/library.ts` - edited in `loadCollectionDetail` and `CollectionDetailPayload` only (`canManage`); the journal loaders, `createCollectionFn` untouched     |
| `src/routes/_app/collections/$collectionId.tsx` - edit: mounts the controls, the multi-label search contract, all copy through the catalogue                                                                                                                                                                                                                                     | `src/routes/_app/collections/index.tsx`, `src/components/collections/index.ts`, `src/components/collections/new-collection-dialog.tsx`: **not touched** (see "Neighbouring work") |
| `src/components/collections/` - new files: `collection-actions.tsx`, `collection-edit-dialog.tsx`, `collection-delete-dialog.tsx`, `status-picker.tsx` (08-S4a); `label-manager.tsx`, `place-labels-picker.tsx`, `filters.ts` (08-S4b); `__tests__/`; `src/components/modules/shared/swatch-picker.tsx` (+ test) - edit: shows a stored off-palette colour as the current choice | `src/components/ui/*`: untouched; primitives reused as they are                                                                                                                   |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**, `modules.collections.*`                                                                                                                                                                                                                                                                                  | `src/lib/i18n/messages/en/shell.ts` (`newCollection.*`, `visibility.*`): untouched                                                                                                |
| `src/server/repos/__tests__/tenant-isolation.test.ts`, `repositories.test.ts` (collections suite) - append                                                                                                                                                                                                                                                                       | `e2e/journeys.spec.ts`: the critical-journey declarations stay as they are                                                                                                        |
| `e2e/product-modules.spec.ts` - create or append (no baselines; ADR 0016)                                                                                                                                                                                                                                                                                                        |                                                                                                                                                                                   |
| `CONTEXT.md` - **Collection**, **Saved place**, **Collection label**, **Place status** (none is in the glossary; "Collections" appears only as a module name)                                                                                                                                                                                                                    |                                                                                                                                                                                   |

### Neighbouring work

A spec for the journal module is in flight at the time of writing. It moves the new-collection dialog out of
`src/routes/_app/-ui/create-dialogs.tsx` into `src/components/collections/new-collection-dialog.tsx`, creates
`src/components/collections/index.ts` and changes one import line in `collections/index.tsx`. This stage owns none of those three
files and imports its own components **by path**, so it merges in either order: whichever lands first creates the directory, and the
other adds files to it. Folding the new components into the barrel is a later stage's one-line edit.

### Phase boundaries (tickets)

Two tickets. Each is a full path (repository -> server function -> screen -> test). The second is `Blocked by` the first: both edit
`$collectionId.tsx`, `loadCollectionDetail`, `-server/collections.ts` and the 23 `modules.ts` files, and the second mounts its
controls on the card and the header the first creates.

| Ticket | Delivers                                                                                                                                                                                                                                                          | Rows                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 08-S4a | `requireOwnedCollection`, `canManageCollection`, `collectionDeleteSummary`; `updateCollectionFn`, `collectionDeleteSummaryFn`, `deleteCollectionFn`, `setPlaceStatusFn`; the actions menu, edit dialog, delete dialog, status picker; the localised detail screen | the identity and status half of `ADD-09` |
| 08-S4b | `updateLabel`, the label ceiling, the batched assignment; `createLabelFn`, `updateLabelFn`, `deleteLabelFn`, `setPlaceLabelsFn`; the label manager, the labels picker, the any-of filter; the multi-label search contract                                         | the label half; `ADD-09` stays `partial` |

### Who may do what (Resolved assumptions 3 and 4)

| Verb                                                                                     | Who                                                      | Where it is enforced                                                                       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Set a place's status; create, rename, recolour, delete a label; assign labels to a place | any member of the workspace that can read the collection | tenant scope only (the collection is shared work; this is what makes a list worth sharing) |
| Edit the collection's name, description, colour                                          | the collection's owner, or a workspace `admin` or above  | `requireOwnedCollection` in the repository, called by `updateCollection`                   |
| Delete the collection                                                                    | the same                                                 | `requireOwnedCollection`, called by `deleteCollection`                                     |

- `requireOwnedCollection(scope, collectionId)` resolves the collection with `collectionsRepository.requireById` **first**, so a foreign
  or missing id is the same `NotFoundError` and nothing leaks, and only then checks `canManageCollection(scope, collection)`:
  `collection.ownerUserId === scope.ctx.userId || hasAtLeastRole(scope.ctx, 'admin')`. A refusal is the existing `ForbiddenError`
  (`src/server/repos/context.ts`, code `FORBIDDEN`, called with `['owner', 'admin']`; no new class), which is **not** in
  `AUTHORED_ERROR_NAMES`: the menu is not rendered for a member who cannot use it, so a refusal is a forged-request edge and the
  reader sees the caller's localised generic failure (`docs/SPEC.md` §9 rule 10). The pattern is `requireOwnedTrip`
  (`src/server/repos/trips.ts`).
- `canManage: boolean` is computed **server-side** by `canManageCollection` and carried on `loadCollectionDetail`'s payload. The
  client never compares ids and no user id is shipped. It is a rendering hint; the repository is the authority.
- The guard lives in the repository, not in the handler as the plan says: a handler check protects one caller, and the repository
  functions have a second one already (the dev seeder). The seeder acts as the collection's owner, so it passes.
- **An admin may manage a collection whose owner has left.** `owner_user_id` has no foreign key, so without this a departed member's
  collection is un-editable and un-deletable for good and holds a `collections` quota slot.
- Status, label and assignment writes do not check ownership, so they inherit whatever read access the collection has - which, today,
  is the whole workspace (see Risks). This stage adds no read rule and says so in place.

### Server functions (`src/routes/_app/-server/collections.ts`)

All `POST` except the summary (`GET`), all `z.strictObject()` with the `error` parameter, all resolved through `appScope()`, all
returning what the screen re-reads (the screen calls `router.invalidate()` on success). Ids are `idSchema`. Server functions are
passed to the components **as props** by the route file: a component directory importing a route's `-server/` folder would invert the
layering (`src/components/console/index.ts` states the seam).

| Function                    | Input                                                  | Behaviour                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateCollectionFn`        | `{ collectionId, name, description, colour }`          | Name trimmed, bounded by `titleSchema` (1 to 200), as at creation. Blank description clears it. Colour `#rrggbb`. **No `slug`, `icon`, `coverImageUrl`, `visibility`, `sortOrder`, `ownerUserId` field exists in the boundary schema** - a strict object refuses them. Guarded. |
| `collectionDeleteSummaryFn` | `{ collectionId }`                                     | `{ name, places, labels, requiresName }`; `requiresName` is `places > 0`. Guarded (a member who may not delete is not told what the collection holds beyond what they can already read).                                                                                        |
| `deleteCollectionFn`        | `{ collectionId, confirmName? }`                       | Re-reads the summary itself. When `requiresName`, `confirmName` must equal the collection's name exactly, as a **Zod** failure (a validation message passes through; a `RepositoryError` would be redacted), the shape of `assertConfirmed`. Guarded.                           |
| `setPlaceStatusFn`          | `{ collectionPlaceId, status }`                        | `status` is `z.enum(COLLECTION_PLACE_STATUSES)`. Calls `setCollectionPlaceStatus`. A foreign or missing place is a `NotFoundError`.                                                                                                                                             |
| `createLabelFn` (08-S4b)    | `{ collectionId, name, colour }`                       | Name trimmed, 1 to 40. Returns `{ ok: true, label }` or `{ ok: false, reason: 'duplicate' \| 'limit' }`.                                                                                                                                                                        |
| `updateLabelFn` (08-S4b)    | `{ collectionId, labelId, name?, colour? }`            | Same result shape; a rename's duplicate check excludes the label itself. At least one of the two fields.                                                                                                                                                                        |
| `deleteLabelFn` (08-S4b)    | `{ collectionId, labelId }`                            | Removes the label and, by cascade, its assignments.                                                                                                                                                                                                                             |
| `setPlaceLabelsFn` (08-S4b) | `{ collectionPlaceId, labelIds: idSchema[] (max 16) }` | Returns the ids that were kept: a foreign or other-collection label id is dropped and the call resolves (the shipped contract).                                                                                                                                                 |

**A duplicate label is a returned result, not a thrown error** (Resolved assumption 7). The function compares the folded name
(`foldLabelName`: Unicode NFC, lower-cased, trimmed) against the collection's labels, and **also** catches a unique-index violation
(`isUniqueConstraintViolation`, `src/server/repos/context.ts`) from a concurrent create, because the database index is case-sensitive
and the pre-check is deliberately stricter. A limit refusal is `{ ok: false, reason: 'limit' }` the same way. Every other failure still
throws. `AUTHORED_ERROR_NAMES` does not change.

### Repository (`src/server/repos/collections.ts`)

All SQL stays here; every statement is a `tenantFilter()`-bound call or goes through the tenant repositories, which stamp
`organization_id` from `scope.ctx` on insert and omit it from the caller's payload type - a row cannot be written into another
workspace by a handler that forgot to check, because the handler has no way to say it.

- `requireOwnedCollection`, `canManageCollection` (above); `updateCollection` and `deleteCollection` call the guard first. Signatures
  do not change.
- `collectionDeleteSummary(scope, collectionId)` - calls `requireOwnedCollection` first (so the guard sits in the repository for all three guarded verbs, and a foreign id is `NotFoundError`, never zero counts), then two `count(*)` statements, tenant-bound: saved places and labels.
- `updateLabel(scope, { collectionId, labelId, name?, colour? })` - resolves the label with `collectionLabelsRepository.findOne` on
  `id` **and** `collection_id`, so a label of another collection of the same workspace is a `NotFoundError`, then
  `requireUpdate`. `deleteLabel` gains the same `collectionId` parameter and resolution (it has no caller outside the repository).
- `createLabel` refuses with `CollectionLabelLimitError` (`RepositoryError`, code `LIMIT`) when the collection already holds
  `MAX_LABELS_PER_COLLECTION` labels. The count and the insert are two statements, so the ceiling is a guard rather than an invariant;
  the screen prevents it first, and a race can overshoot by the number of concurrent creates.
- `setCollectionPlaceLabels` keeps its contract (resolve the place, drop ids that are not labels of the place's collection, return the
  kept ids) and changes its body in two ways: the input cap is `MAX_LABELS_PER_PLACE` (16) at the repository, and the delete and the
  insert are **one `runBatch`** of un-awaited builders -
  `scope.db.delete(collectionPlaceLabels).where(tenantFilter(scope, collectionPlaceLabels, eq(...collectionPlaceId, id)))` and
  `scope.db.insert(collectionPlaceLabels).values(rows)` with `organizationId: scope.ctx.organizationId` stamped on each row. The rows
  are built from the label rows the existing query returned, **not** from the raw input, so a repeated id cannot break the
  `(collection_place_id, label_id)` primary key; the insert is added to the batch only when at least one id was kept (Drizzle refuses
  an empty `values()`). A failure now leaves the previous assignment intact (D1 batches are atomic). A label deleted between the read
  and the batch makes the insert violate the foreign key; the whole batch fails and a retry works.
- `src/lib/collections/labels.ts` is the **one owner of the numbers** the repository, the server functions and the components share:
  `MAX_LABELS_PER_PLACE = 16`, `MAX_LABELS_PER_COLLECTION = 30`, `foldLabelName`. A test pins
  `MAX_LABELS_PER_PLACE * boundParametersPerRow(collectionPlaceLabels) <= MAX_BOUND_PARAMETERS`.

### Alternatives considered, and why they lost

- **A three-value status with a tap-to-cycle control (the reference row's reading).** Needs a column narrowed in a migration and
  throws away a distinction the screen already makes; five values cycle badly.
- **`visibility` in the edit form.** The plan lists it. Offering "Only me" on a second screen repeats a promise nothing keeps
  (Resolved assumption 3).
- **Icon and cover URL in the edit form.** Nothing renders either (Resolved assumption 2).
- **Optimistic status writes with rollback (the plan).** The loader already holds every place, so `router.invalidate()` after the
  write is one cheap re-read; rollback logic and its tests are more code than one slice needs. The picker shows a busy state instead
  and can gain optimism later behind the same props (Resolved assumption 9).
- **Server-side narrowing of the places by label.** `loadCollectionDetail` already ships the whole list; narrowing there adds a round
  trip per pill click. The predicate is a pure function precisely so a later move to the loader is a call-site change.
- **Delete-and-recreate for a label rename.** Drops the assignments and the id every `?labels=` link carries.
- **Widening `AUTHORED_ERROR_NAMES` for a duplicate label.** Changes a closed rule (`docs/SPEC.md` §9 rule 10) for a case a returned
  result handles.
- **A soft delete or an archive for collections.** Needs a column; out of reach without a migration. The typed-name confirmation is
  the cheaper guard against the one action that cannot be undone.

## 📝 Architecture

- **Owner module of each new concept (`docs/SPEC.md` §8):** who may manage a collection, the delete summary, label update and the
  ceiling, the batched assignment -> `src/server/repos/collections.ts` (all SQL); the label numbers and the name fold ->
  `src/lib/collections/labels.ts` (pure, no I/O); the write boundary and its Zod -> `src/routes/_app/-server/collections.ts`;
  presentation -> `src/components/collections/`; the any-of predicate -> `src/components/collections/filters.ts`; the status tones
  stay in `src/routes/_app/-lib/tone.ts` (`COLLECTION_STATUS_TONE`).
- `components/ui` is untouched and still never fetches or imports from `server/`. Nothing enqueues; no Durable Object, no KV.
- **Status names have exactly one set of message keys and one list** (`COLLECTION_PLACE_STATUSES`), read by the filter pills, the picker and `setPlaceStatusFn` alike (`docs/SPEC.md` §8); no third copy next to `STATUSES` in the route and `COLLECTION_STATUSES` in `library.ts`.
- **`inkOn()` is not used.** The plan reaches for it to pick text colour on a label's stored colour; no text sits on a label colour
  here - the chip is neutral `--color-surface-2` with a colour dot, as it is today. The dot is a non-text indicator that every
  palette hue clears at better than 3:1 (`src/lib/swatches.ts`).
- Tests: server-function tests are `.test.ts` under `src/routes/**` (the `server` project) on the pattern of
  `src/server/fns/__tests__/atlas.test.ts`: everything that returns a result is an exported plain function the test calls directly,
  the `createServerFn` wrappers stay thin (a server function call discards its handler's return there), and the test installs the
  Start `AsyncLocalStorage`, imports the module dynamically and mocks `../context` to return the harness scope. A server module that
  reaches `cloudflare:workers` cannot load in that project: this one does not.

## 📝 Data Model

**No schema change, and none is filed.** `collections` already carries `name`, `slug`, `description`, `colour`, `icon`,
`cover_image_url`, `visibility`, `owner_user_id`, `sort_order`. `collection_labels` carries `name`, `colour`, `sort_order` and the
unique `(collection_id, name)` index. `collection_place_labels` is the join, reached through `collectionPlaceLabelsAccess`.

Index honesty, so nothing here is read as a safety argument: `collections` is led by `organization_id` in
`collections_org_owner_idx`; `collection_labels` in `collection_labels_org_collection_idx`; but `collection_labels_collection_sort_idx`
leads with `collection_id`, and `collection_place_labels` indexes `organization_id` and `label_id` (`collection_place_labels_label_idx`)
under a composite primary key `(collection_place_id, label_id)`. The safety argument is the tenant filter and the stamped insert
above, never an index. This stage adds none; the statements are bounded by the 30-label and 16-label numbers.

## 📝 API Contracts

The server functions of the table above, and these shapes:

```ts
type LabelResult =
  | {
      readonly ok: true
      readonly label: { id: string; name: string; colour: string }
    }
  | { readonly ok: false; readonly reason: 'duplicate' | 'limit' }

interface CollectionDetailPayload {
  // existing fields unchanged, plus:
  readonly canManage: boolean
}

// search of /collections/$collectionId (08-S4b): `label?: string` becomes
// { status?: <one of the five>, labels?: Array<string> }   // labels bounded: max MAX_LABELS_PER_COLLECTION (30) entries, each 1..64 chars
```

`?label=` is dropped without a redirect: the only definition and the only producers were the page's own pill links, no stored or
external link carries it, and Zod's default object parsing ignores the unknown key, so an old link shows an unfiltered list.

## 📝 UI/UX

### Actions menu and the edit and delete dialogs (08-S4a)

- `CollectionActions` is a `DropdownMenu` in the `PageHeader` actions, **rendered only when `canManage`**: _Edit details_,
  _Delete collection…_. Its trigger is an `IconButton` with the accessible name "Actions for {name}". Both dialogs open from a menu
  item and must return focus to this trigger.
- _Edit details_ opens one `Dialog` (the fields are one object): name, description, colour (the existing `SwatchPicker` with
  `REQUIRED_SWATCHES`, legend from the catalogue). `src/components/modules/shared/swatch-picker.tsx` marks only an exact palette match as
  pressed, so a stored colour outside the palette (the database default `#2F6F5E` is not in it) would read as "no choice": this stage
  changes the picker to render such a value as a leading swatch with `aria-pressed="true"` and the name `edit.currentColour`, and it
  is **not** changed unless the traveller picks another. An empty name and a name over 200 characters are caught in the dialog with
  `edit.nameRequired` and `edit.nameTooLong` before anything is sent, so a server sentence never reaches the screen. A save in flight
  owns the dialog; an error keeps it open with its values and a retry. The dialog is the primitive's bottom sheet at 360 px
  (`max-h-[92dvh]`).
- _Delete collection…_ opens a `Dialog` that reads `collectionDeleteSummaryFn` on open: a wrapper with `role="status"` around the
  skeleton rows holds visually hidden `delete.loading` text (a `Skeleton` is `aria-hidden`, so the role goes on the wrapper) and the
  dialog body is `aria-busy`; a load error keeps the dialog open with a retry. It lists what goes - one line per non-zero count
  (`delete.places`, `delete.labels`) - and says it cannot be undone and that places in the traveller's trips are not touched. **A
  collection with saved places asks for its name**: the input's label is `delete.nameLabel`, `delete.typeName` is its hint linked by
  `aria-describedby`, the collection's name is shown set apart and isolated for right-to-left, the input has `autocomplete="off"`,
  `autocapitalize="off"`, `autocorrect="off"`, `spellcheck={false}` and allows paste, and the submit is disabled until the text
  matches; an empty collection is a plain confirm. If the server refuses because a place was added meanwhile, the dialog re-reads the
  summary and shows `delete.nameNeeded` with the name field. `Escape` cancels. After a delete the screen navigates to `/collections`
  and a toast confirms.

### Status picker (08-S4a)

- `StatusPicker` is a `DropdownMenu` (`src/components/ui/dropdown-menu.tsx`) whose **trigger is the status badge itself**, so the card
  gains a control without gaining a row. The trigger is a native `<button>` (the menu trigger with `asChild`) styled with
  `badgeVariants` - the `Badge` primitive is documented as never clickable and is not reused as a control - with `focusRing`, hover,
  active and loading states, and a hit area of at least 24 x 24 CSS px (a padded `::before` or `min-h-6`, not the spacing exception)
  that does not make the card taller. Its accessible name is "{place}: status {status}. Change status"; `{status}` is a placeholder in
  every locale, so the visible word stays inside the name. The menu holds a `DropdownMenuRadioGroup` of the five statuses, labelled by
  a `DropdownMenuLabel` (`statusPicker.legend`), with their existing tones (`COLLECTION_STATUS_TONE`): the arrow keys only move, and
  Enter, Space or a click commits and closes. Radix supplies `aria-haspopup="menu"`, `Escape` and focus return.
- Shown to every member (the status is shared work). While the write is in flight the trigger is `aria-busy` and
  `aria-disabled="true"` (never `disabled`: focus stays), ignores activations, keeps its label and the previous status; on success
  `router.invalidate()` brings the new one and the live region announces `statusPicker.saved`. A failed write leaves the old status in
  place and shows a `danger` `Alert` **inside the card**, naming the place, with a retry (an alert above the list is off-screen at
  360 px).
- A change that takes the card out of the current filter: see Edge Cases (`statusPicker.hiddenNow`, focus to the next card).
- The filter pills and the picker read the same five status message keys (`modules.collections.status.*`), from a literal table typed
  `Record<Status, MessageKey>`.
- **One persistent polite live region** (`role="status"`, mounted empty from the first render of the route) carries every
  announcement of this screen: a saved status, a saved label set (`placeLabels.saved`), and the visible count after each filter change
  (`filtered.showing`).

### Label manager, labels picker and the any-of filter (08-S4b)

- `LabelManager` is a `Dialog` opened from the _Manage labels_ button in the labels panel header (`data-part="label-manager"`), listing
  the collection's labels with inline rename, a colour swatch (the same `SwatchPicker`, with the current-colour change above) and a
  delete that **names how many places carry the label** (counted from the payload the screen already has) in an inline confirmation
  before removing it. A new label has a name field and a swatch. A duplicate name or an empty or over-long one is a **field error**
  rendered through `<Field error=…>` (`aria-invalid`, `aria-describedby`; the `FieldError` live region is only mounted with its text),
  from the returned result, never a toast, and focus moves back to the name input when the result arrives. At the ceiling the add form
  is replaced by a line saying so. Empty: on `--color-surface-2`, "No labels yet" with one line on what a label is for and the name
  field focused behind it. There is no loading state: the labels are already in the page's payload.
  - Focus: opening the inline delete confirmation moves focus to _Delete label_; _Keep label_ returns it to that row's delete button;
    after a delete it goes to the next row's control, or to the add-label input when there is none. `Escape` inside an inline rename
    cancels the rename only (the event is stopped) and does not close the dialog.
  - With no labels the labels panel stays as one line holding the _Manage labels_ button; only the filter group is absent.
- `PlaceLabelsPicker` is a `Popover` on a button on each place card ("Labels", `data-part="place-labels"`), named by `aria-labelledby`
  pointing at a `PopoverHeader` that holds `placeLabels.trigger`. Inside, a `role="group"` list of the collection's labels as
  `CheckboxField` rows (the whole row is the target; a bare `Checkbox` is 20 px) - a checked label is on the place - and a link into
  the manager when there are none. Choosing writes `setPlaceLabelsFn` with the full set. While a write is in flight every checkbox is
  `aria-disabled` (a second write would send a stale set); after a failure they return to the last saved set and the popover shows
  `placeLabels.error` with a retry. Once a place carries 16 labels, `placeLabels.full` is shown once at the top of the list, every
  unchecked box points at it with `aria-describedby` and is `aria-disabled` rather than `disabled`, so keyboard users can still reach
  the reason. Every member sees the picker.
- **Filter.** Each label pill toggles membership of `labels` in the URL; each status pill sets the single `status`. A place matches when
  **any** selected label is on it (not all of them) **and** its status is the selected status. Selecting no label does not narrow by
  label (it is not "no results"). Ids in the URL that are not labels of this collection are pruned before filtering; if nothing is
  left the label narrowing is off, so a stale link or a just-deleted label never hides places. The pills are `button`s with
  `aria-pressed` that navigate with `replace`, in two `role="group"` containers named `filters.statusGroup` and `labels.filterGroup`.
  The pills keep a fixed order and stable keys and never remount, so the toggled pill keeps focus and does not move under the
  traveller's thumb; at 360 px the bar scrolls horizontally and scrolls the selected pill into view.
- _Filtered to nothing_ keeps the existing "Nothing matches that filter" empty state and its reset action and gains the count of what
  is hidden (`filtered.hidden`), so the traveller knows the list is not empty.
- Filtering stays client-side: `filters.ts` is a pure function `matchesFilter(place, { status, labelIds }, knownLabelIds)`.

### Motion and tokens

Popovers and dialogs use the primitives' existing enter and exit. A card whose status changed flashes its badge on a 180ms opacity
ramp on `--ease-out-quint` - no colour animation, no layout property; `prefers-reduced-motion: reduce` removes the flash. No token is
missing. Logical properties throughout (the document turns right-to-left in Arabic); directional icons carry `data-mirror-rtl`.

## 📝 Visual change expected

`/collections/$collectionId`, light and dark, 360x800, 1280x900 and 2560x1440:

- 08-S4a: the header with the actions trigger (closed and open), the edit dialog, the delete dialog (empty collection; collection that
  requires its name; loading; error), the status picker open on a card, the busy and failed states, the screen in a non-English
  locale and in Arabic (right-to-left), the screen as a plain member (no trigger).
- 08-S4b: the labels panel with its manage button, the manager (empty, with labels, a duplicate-name error, at the ceiling, a delete
  confirmation), the labels picker open on a card, two label pills selected, the filtered-to-nothing state with the hidden count.
- `/collections` (the index) does not change by a pixel.

## 📝 Copy

All new keys go to `src/lib/i18n/messages/en/modules.ts`, where they are written **without** the `modules.` prefix (as
`form.saveError` is) and read as `modules.collections.*`, and land in all 23 locales in the same change (`i18n-messages` skill). Every
plural key varies on `{count}` only (`resolveMessage` in `src/lib/i18n/interpolate.ts` picks a form from `count` alone), carries every
category each locale needs and writes its `one` form with `{count}` too ("{count} saved place": in Russian and Ukrainian `one` also
covers 21 and 31). The keys below are the **full set**; every one is read by a component of this stage (`coverage.test.ts` fails on
a key nothing reads). Field labels already in the catalogue are reused.

**Which ticket lands which key.** 08-S4a: `page.*`, `status.*`, `empty.*`, `filtered.title`, `filtered.body`, `filtered.reset`,
`filtered.showing`, `filters.statusGroup`, `card.*`, `actions.*`, `edit.*`, `delete.*`, `statusPicker.*`, `labels.panel`,
`labels.filterGroup`. 08-S4b: `filtered.hidden`, `labels.manage`, `labels.count`, `manager.*`, `placeLabels.*`. A key lands with the
first component that reads it.

| Key (en)                                                           | Text                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `page.eyebrow`                                                     | Collection                                                                                                                                 |
| `page.all` / `page.back`                                           | All / All collections                                                                                                                      |
| `page.savedPlaces` (plural)                                        | {count} saved places ({count} saved place)                                                                                                 |
| `page.loadErrorTitle`                                              | This collection did not load                                                                                                               |
| `status.idea` / `shortlisted` / `planned` / `visited` / `rejected` | Idea / Shortlisted / Planned / Visited / Rejected                                                                                          |
| `empty.title` / `empty.body`                                       | Nothing saved here yet / Save a place from the map, from another trip, or straight from a recommendation, and it lands in this collection. |
| `filtered.title` / `filtered.body`                                 | Nothing matches that filter / Try another status, or clear the labels you are filtering by.                                                |
| `filtered.hidden` (plural)                                         | {count} saved places are hidden by the filter ({count} saved place is hidden by the filter)                                                |
| `filtered.reset`                                                   | Reset filters                                                                                                                              |
| `card.noLocation` / `card.noPrice` / `card.website`                | Location not recorded / No price noted / Website                                                                                           |
| `actions.trigger`                                                  | Actions for {name}                                                                                                                         |
| `actions.edit` / `actions.delete`                                  | Edit details / Delete collection…                                                                                                          |
| `edit.title`                                                       | Edit collection                                                                                                                            |
| `edit.name` / `edit.description` / `edit.colour`                   | Name / Description / Colour                                                                                                                |
| `edit.submit` / `edit.saving` / `edit.cancel`                      | Save changes / Saving / Cancel                                                                                                             |
| `edit.saved`                                                       | Collection updated                                                                                                                         |
| `edit.errorTitle` / `edit.error` / `edit.retry`                    | Could not save / That did not save. Nothing was changed. / Try again                                                                       |
| `edit.nameRequired` / `edit.nameTooLong`                           | Give the collection a name. / A collection name can have at most {count} characters. (plural over `{count}`)                               |
| `edit.currentColour`                                               | Current colour                                                                                                                             |
| `delete.title`                                                     | Delete {name}?                                                                                                                             |
| `delete.loading`                                                   | Loading what this collection holds                                                                                                         |
| `delete.loadErrorTitle` / `delete.loadError` / `delete.retry`      | Could not check the collection / Nothing was deleted. Try again. / Try again                                                               |
| `delete.places` (plural)                                           | {count} saved places ({count} saved place)                                                                                                 |
| `delete.labels` (plural)                                           | {count} labels ({count} label)                                                                                                             |
| `delete.irreversible`                                              | This cannot be undone. The saved places and labels in this collection are removed with it. Places in your trips are not touched.           |
| `delete.typeName` / `delete.nameLabel`                             | Type the collection's name to delete it. / Collection name (the name itself is set apart in the dialog body, isolated for right-to-left)   |
| `delete.nameNeeded`                                                | This collection now holds saved places. Type its name to delete it.                                                                        |
| `delete.confirm` / `delete.deleting` / `delete.cancel`             | Delete collection / Deleting / Cancel                                                                                                      |
| `delete.deleted`                                                   | Collection deleted                                                                                                                         |
| `delete.error`                                                     | The collection was not deleted. Nothing was removed.                                                                                       |
| `statusPicker.trigger`                                             | {place}: status {status}. Change status                                                                                                    |
| `statusPicker.legend`                                              | Status of {place}                                                                                                                          |
| `statusPicker.saved` / `statusPicker.hiddenNow`                    | {place}: status set to {status} / {place} is now {status} and hidden by the filter                                                         |
| `statusPicker.error` / `statusPicker.retry`                        | The status of {place} did not change. / Try again                                                                                          |
| `filters.statusGroup` / `filtered.showing` (plural)                | Filter by status / Showing {count} saved places ({count} saved place)                                                                      |
| `labels.panel` / `labels.manage`                                   | Labels in this collection / Manage labels                                                                                                  |
| `labels.filterGroup`                                               | Filter by label                                                                                                                            |
| `labels.count` (plural)                                            | {count} labels / {count} label                                                                                                             |
| `manager.title` / `manager.description` (plural over `{count}`)    | Labels / Group the places in this collection. Each place can carry up to {count} labels.                                                   |
| `manager.empty.title` / `manager.empty.body`                       | No labels yet / A label is a word of your own, like "brunch" or "rainy day", that you can put on any place.                                |
| `manager.name` / `manager.colour` / `manager.add`                  | Label name / Colour / Add label                                                                                                            |
| `manager.rename` / `manager.save` / `manager.cancel`               | Rename {name} / Save / Cancel                                                                                                              |
| `manager.duplicate`                                                | A label with that name already exists in this collection.                                                                                  |
| `manager.limit` (plural)                                           | This collection already has {count} labels, the most it can hold.                                                                          |
| `manager.deleteLabel`                                              | Delete {name}                                                                                                                              |
| `manager.deleteBody` (plural)                                      | {name} is on {count} saved places. Deleting it removes it from them; the places stay. (`one`: {name} is on {count} saved place.)           |
| `manager.deleteConfirm` / `manager.deleteCancel`                   | Delete label / Keep label                                                                                                                  |
| `manager.saved` / `manager.deleted`                                | Label saved / Label deleted                                                                                                                |
| `manager.error` / `manager.retry`                                  | The label was not saved. Nothing was changed. / Try again                                                                                  |
| `manager.nameRequired` / `manager.nameTooLong`                     | Give the label a name. / A label name can have at most {count} characters. (plural over `{count}`)                                         |
| `placeLabels.trigger`                                              | Labels for {place}                                                                                                                         |
| `placeLabels.none`                                                 | No labels yet. Create one in Manage labels.                                                                                                |
| `placeLabels.full` (plural)                                        | A place can carry up to {count} labels.                                                                                                    |
| `placeLabels.saved`                                                | Labels of {place} updated                                                                                                                  |
| `placeLabels.error` / `placeLabels.retry`                          | The labels of {place} did not change. / Try again                                                                                          |

## 📝 Edge Cases & Failure Scenarios

| Case                                                                           | Behaviour                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A plain member forges `updateCollectionFn` or `deleteCollectionFn`             | `ForbiddenError` (FORBIDDEN): the generic failure on screen; nothing written. A foreign-workspace id is `NotFoundError` first                                                                                            |
| A workspace admin edits or deletes a collection whose owner left the workspace | Allowed; the menu is rendered because `canManage` is true                                                                                                                                                                |
| A foreign workspace's collection, place, label or label id                     | `NotFoundError` for ids addressed directly; a foreign label inside `labelIds` is dropped and the call resolves without it                                                                                                |
| A label of another collection in the same workspace                            | `updateLabel`, `deleteLabel` -> `NotFoundError`; inside `labelIds` it is dropped                                                                                                                                         |
| Delete a collection that holds places, no `confirmName` (forged)               | Refused by the function's own count (a validation message that names what to type); nothing removed                                                                                                                      |
| A place is added between the summary read and the confirm                      | The server refuses with its validation message; the dialog re-reads the summary and shows the localised name field                                                                                                       |
| Delete a collection that is empty                                              | Plain confirm; no name asked                                                                                                                                                                                             |
| Delete during a navigation / a second tab already deleted it                   | `NotFoundError` -> generic failure; the dialog closes on refresh; the router leaves a screen whose loader says the collection no longer exists                                                                           |
| Rename to a name another collection has                                        | Allowed: collection names are not unique; the slug is untouched                                                                                                                                                          |
| Create or rename a label to a name that differs only by case or Unicode form   | Refused as `duplicate` by the folded pre-check                                                                                                                                                                           |
| Two tabs create the same label at once                                         | The loser gets the unique-index violation, caught and returned as `duplicate`                                                                                                                                            |
| The 31st label                                                                 | The form is replaced by the limit line; a forged call returns `{ ok: false, reason: 'limit' }`                                                                                                                           |
| Assign 17 labels to one place                                                  | Once a place carries 16, every unchecked box is `aria-disabled` and described by `placeLabels.full`; a forged call is a Zod refusal; nothing written                                                                     |
| A label deleted by someone else while the picker is open                       | The batch fails on the foreign key and changes nothing; the picker shows its error and a retry; a refresh drops the label                                                                                                |
| The assignment fails between delete and insert                                 | Cannot leave a place bare: they are one batch                                                                                                                                                                            |
| `?labels=` carries a deleted, foreign or repeated id                           | Pruned before filtering; if nothing valid is left no label narrowing applies                                                                                                                                             |
| `?labels=` has more than `MAX_LABELS_PER_COLLECTION` (30) entries              | The search validator refuses it and the screen falls back to the unfiltered list; a collection can never hold more labels than that, so a real selection always fits                                                     |
| Old `?label=` link                                                             | Ignored; the list is unfiltered                                                                                                                                                                                          |
| A stored label colour that is not in the palette (the database default)        | Shown as the current choice in the manager; saved unchanged unless another swatch is picked                                                                                                                              |
| Status write fails, or is slow                                                 | The old status stays visible, the trigger is `aria-busy`; a `danger` alert **inside the card**, naming the place, offers a retry                                                                                         |
| A status or label change takes the card out of the current filter              | The card leaves the list on the next render; focus moves to the next card's status trigger, or to the list heading when it was the last; the live region announces it with `statusPicker.hiddenNow`                      |
| Two travellers set different statuses on one place                             | Last write wins; the loser sees the winner's value on the next invalidate                                                                                                                                                |
| Double-tap on any control                                                      | A focused control is never given the `disabled` attribute (focus would be lost): it is `aria-disabled="true"` and ignores activations while its write is in flight; the writes are idempotent or refused the second time |
| Dropped connection mid-save                                                    | The dialog stays open with its values and a retry                                                                                                                                                                        |
| A collection with zero places or zero labels                                   | Designed empty states; with no labels the filter group is absent and the labels panel stays as one line holding the _Manage labels_ button                                                                               |
| A very long name or label                                                      | Truncated with the full text in the accessible name; the dialogs wrap                                                                                                                                                    |
| Right-to-left, 23 locales                                                      | Logical properties; directional icons mirror; the parity test covers the keys                                                                                                                                            |

## ✅ Acceptance criteria

08-S4a:

1. `updateCollectionFn`, `collectionDeleteSummaryFn`, `deleteCollectionFn` and `setPlaceStatusFn` exist as `POST` (summary `GET`) strict
   objects; the boundary of `updateCollectionFn` accepts name, description and colour and nothing else.
2. `updateCollection`, `deleteCollection` and `collectionDeleteSummary` call `requireOwnedCollection`: the owner and a workspace
   `admin` or above pass, a plain member gets `ForbiddenError`, a foreign id gets `NotFoundError` before any role check; no class is
   added to `AUTHORED_ERROR_NAMES` and that set is unchanged.
3. `loadCollectionDetail` carries `canManage`; the actions menu is absent for a plain member who is not the owner.
4. The delete dialog reads the summary, states places and labels, asks for the collection's name when it holds a saved place and the
   server refuses a delete without it; an empty collection deletes on a plain confirm.
5. The status picker is a menu of radio items on a native button that looks like the badge; the button is reachable and operable by
   keyboard, has an accessible name containing the place and the current status, a hit area of at least 24 x 24 CSS px, and writes
   through `setPlaceStatusFn` only on Enter, Space or a click (never on an arrow key); it shows a busy state without losing focus, and
   on failure keeps the old status and shows an alert inside the card with a retry.
6. `$collectionId.tsx` has no hard-coded user-facing literal left (the visibility badge reads the existing `shell.visibility.*` keys
   instead of `humaniseToken`, and `shell.ts` is untouched); every 08-S4a key exists in all 23 locales; the status names have one set
   of keys and one list (`COLLECTION_PLACE_STATUSES`, not a third copy next to `STATUSES` in the route and `COLLECTION_STATUSES` in
   `library.ts`). `collections/index.tsx`, `src/components/collections/index.ts` and `new-collection-dialog.tsx` are not in the diff.
7. Renaming leaves the slug untouched.

08-S4b:

8. `updateLabel` exists, resolves the label by id **and** collection, and `deleteLabel` takes the collection id; a label of another
   collection is `NotFoundError`.
9. `createLabelFn` and `updateLabelFn` return a `duplicate` result for a case- or form-variant of an existing name, also when the
   unique index fires; the manager shows it as a field error; `AUTHORED_ERROR_NAMES` is unchanged.
10. A collection holds at most `MAX_LABELS_PER_COLLECTION` (30) labels; the repository refuses the next, the function returns `limit`,
    the screen prevents it first.
11. `setCollectionPlaceLabels` accepts at most 16 ids at the repository, runs as one `runBatch` of builders with the tenant column
    stamped, returns the kept ids, and a failure leaves the previous assignment intact.
12. The labels picker puts labels on a place and takes them off; the manager creates, renames, recolours and deletes; deleting a
    label names the number of places it is on first; `Escape` cancels; focus returns to the trigger.
13. The filter matches **any** selected label and the selected status; no selection means no label narrowing; ids that are not labels
    of the collection are pruned; `?label=` is gone from the search contract; `labels` is bounded by `MAX_LABELS_PER_COLLECTION`.
14. Filtered-to-nothing says how many places are hidden.

Both:

15. Light and dark, 360 px to 2560 px, keyboard-complete, WCAG 2.2 AA; a stored colour is never the only carrier of a label's meaning
    (the name is always beside the dot); one persistent polite live region announces a saved status, a saved label set and the visible
    count after a filter change; the console is silent; no layout shift after the dialogs load.
16. `CONTEXT.md` defines Collection, Saved place, Collection label and Place status.

## 📝 Risks & Impact Review

| Risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Severity | Mitigation / disposition                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Only me" and "Anyone with the link" are not kept today, and this stage turns "any member can read a private collection" into "any member can write to it".** Every member can list and open a private collection; with this stage they can also set statuses on it and create, rename, recolour and delete its labels, and deleting a label removes it from every place that carried it, with no undo. "Public" has no page. The create dialog and the visibility badge already say otherwise | high     | Left out of the edit form on purpose, and any-member writes recorded as a choice (Resolved assumption 20). **When it slices this spec, the slicer files one follow-up issue** (enforce the read filter and the write rule for `visibility`, or retire the two options), `Blocked by` nothing; this spec files none itself                                                                                               |
| A guard added to `updateCollection` and `deleteCollection` changes their contract for any later caller                                                                                                                                                                                                                                                                                                                                                                                           | low      | Their signatures do not change; the only other caller (the seeder) acts as the owner; `requireOwnedCollection` is tested for owner, admin, member                                                                                                                                                                                                                                                                       |
| Owner-or-admin is broader than "owner only"                                                                                                                                                                                                                                                                                                                                                                                                                                                      | low      | Needed because `owner_user_id` has no foreign key; the sharing-roles stage decides the final model and can narrow it                                                                                                                                                                                                                                                                                                    |
| The label ceiling is a count then an insert, not an invariant                                                                                                                                                                                                                                                                                                                                                                                                                                    | low      | The screen prevents it first; a race overshoots by the number of concurrent creates; unlike a plan quota, no billing consequence                                                                                                                                                                                                                                                                                        |
| The typed-name check on the server answers in English (a Zod message passes through, as for trips)                                                                                                                                                                                                                                                                                                                                                                                               | low      | Reachable only by a forged request, or when a place is added between the summary and the confirm; the dialog catches that refusal, re-reads the summary and shows the localised name field (Resolved assumption 26). A place saved between the summary read and the delete is deleted without the name being asked: `deleteCollection` re-counts and deletes in two statements; the window is accepted and written down |
| Removing the single `?label=` key breaks old bookmarks                                                                                                                                                                                                                                                                                                                                                                                                                                           | low      | None existed outside the page's own links; an old link shows the full list                                                                                                                                                                                                                                                                                                                                              |
| The index route and the "Where they are" panel keep their English literals                                                                                                                                                                                                                                                                                                                                                                                                                       | low      | `collections/index.tsx` is another work item's file; named here so the gap is known                                                                                                                                                                                                                                                                                                                                     |
| Deleting a collection is not recoverable                                                                                                                                                                                                                                                                                                                                                                                                                                                         | medium   | Typed-name confirmation when it holds places, the summary of what goes, an owner-or-admin guard; an archive needs a column and is out of reach without a migration                                                                                                                                                                                                                                                      |
| `owner_user_id` of a deleted user's collection                                                                                                                                                                                                                                                                                                                                                                                                                                                   | low      | An admin can manage it; reassigning ownership is the sharing-roles stage's                                                                                                                                                                                                                                                                                                                                              |
| Later stages that touch the same rows (a place copied into a trip; paging the list; sharing roles)                                                                                                                                                                                                                                                                                                                                                                                               | low      | They add to `-server/collections.ts` and move `filters.ts` to the loader; `matchesFilter` is pure for that reason                                                                                                                                                                                                                                                                                                       |

### Out of scope

Reading a collection's `visibility` as a permission; the visibility control; icon and cover (and any upload path for covers);
reassigning a collection's owner; copying a saved place into a trip and what that does to its status; reordering places or
collections; a collection's public page; paging the place list; localising `collections/index.tsx`; the `collection_labels`
`sort_order` (labels list by `sort_order`, then name); soft delete.

### Blockers

None for either ticket. No package outside the pinned set, no binding, no third-party service, no schema change. The sharing roles
stage is a named later stage of the same plan, not another plan and not a package.

### Reference-row disposition

`ADD-09` stays `partial`: the status, the labels and the filter are delivered; the cover is not (Resolved assumption 2).

## 📋 Phasing

Two tickets, in order. Neither is a horizontal layer: each ships a repository change, its server functions, the screen and its tests.

## 📋 Implementation Plan

### Phase 1 - change a collection and set where a place stands (08-S4a)

1. Repository: `canManageCollection`, `requireOwnedCollection` (throwing the existing `ForbiddenError`), `collectionDeleteSummary`
   (guarded); the two guarded functions; tests (owner, admin, member, foreign id, departed owner).
2. `-server/collections.ts`: the four functions with their strict schemas; `loadCollectionDetail` gains `canManage`.
3. `status-picker.tsx`, `collection-actions.tsx`, `collection-edit-dialog.tsx`, `collection-delete-dialog.tsx`, the swatch-picker
   change, the live region, and their tests.
4. Localise `$collectionId.tsx`: the 08-S4a keys of the Copy section in the 23 `modules.ts` files, the status keys read by pills and
   picker; `coverage.test.ts` and the new `copy-rules.test.ts` stay green.
5. `CONTEXT.md` entries; the tenant-isolation block for the functions this ticket adds; the browser spec for the menu, the dialog and
   the status.

### Phase 2 - labels (08-S4b)

1. `src/lib/collections/labels.ts` and its test (the numbers, the fold, the parameter-budget assertion).
2. Repository: `updateLabel`, `deleteLabel` with the collection id, the ceiling, the batched `setCollectionPlaceLabels`; tests
   (including one batch carrying both statements and 16 rows in one statement).
3. `-server/collections.ts`: the four label functions with the returned result.
4. `label-manager.tsx`, `place-labels-picker.tsx`, `filters.ts`, the search contract, the hidden count; tests.
5. The 08-S4b keys of the Copy section in the 23 locales; the tenant-isolation cases for labels; the browser spec for create, rename,
   assign, filter.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit:
  - `src/lib/collections/__tests__/labels.test.ts` - the fold treats case and Unicode form as the same;
    `MAX_LABELS_PER_PLACE * boundParametersPerRow(collectionPlaceLabels) <= MAX_BOUND_PARAMETERS` (`src/server/repos/batch.ts`), so a
    fifth column on the join table fails the test instead of passing quietly.
  - `src/components/collections/__tests__/filters.test.ts` - any-of, not all-of; no selection means no label narrowing; status and
    labels narrow together; unknown ids pruned; an empty pruned selection narrows nothing.
  - `src/routes/_app/-server/__tests__/collections.test.ts` - written on the pattern of `src/server/fns/__tests__/atlas.test.ts`: a
    server function call discards its handler's return there, so everything that returns a result lives in **exported plain functions**
    that the tests call directly (the label create and update result with `duplicate` and `limit`, the delete confirmation check, the
    kept ids), and the `createServerFn` wrappers stay thin. The test installs the Start `AsyncLocalStorage` and imports the module
    dynamically, as `atlas.test.ts` does, mocks `../context` to return the harness scope, tests the strict-schema refusals through the
    schema, and reads wrapper side effects back through the repository. Cases: a duplicate label name (a case variant, a rename that
    keeps its own name, and the unique-index race) returns `duplicate`, never a throw; the 31st label is `limit`; a plain member cannot
    edit or delete but can set a status and a label; an admin can; a forged delete without the name is refused; a foreign
    `collectionId` or `collectionPlaceId` is `NotFoundError` while a foreign `labelId` inside `labelIds` is dropped; the seventeenth
    label id is refused.
  - `src/components/collections/__tests__/copy-rules.test.ts`, modelled on `src/components/atlas/__tests__/copy-rules.test.ts`, over
    the new components and `$collectionId.tsx` (no literal props or JSX text, logical properties, `data-mirror-rtl`). The test that
    fails on a key nothing reads is `src/lib/i18n/__tests__/coverage.test.ts`, and it only sees keys written as whole string literals:
    the status names come from a literal table typed `Record<Status, MessageKey>`, never from a template key such as
    `` `modules.collections.status.${s}` ``.
  - `status-picker.test.tsx` (trigger is a keyboard-reachable native button named with place and status, arrow keys move without
    writing, Enter commits, busy state keeps focus, failure keeps the old value and shows the error inside the card),
    `collection-actions.test.tsx` (absent without `canManage`; focus returns to the trigger after the edit dialog and after the delete
    dialog, both of which open from a menu item), `collection-delete-dialog.test.tsx` (names the counts, asks for the name only when
    places exist, `Escape` cancels, focus returns, a server refusal re-reads the summary and shows the localised name field),
    `label-manager.test.tsx` (duplicate is a field error and focus returns to the name input, delete names the place count and moves
    focus as specified, `Escape` in a rename cancels the rename only, the ceiling replaces the form), `place-labels-picker.test.tsx`
    (once a place has 16 labels every unchecked box is `aria-disabled` and described by the reason; a pending write blocks a second).
- Tenant isolation, appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe`: in A's scope, against B's
  ids, `updateCollection`, `deleteCollection`, `collectionDeleteSummary` (rejects with `NotFoundError`; it does not return zero counts),
  `setCollectionPlaceStatus`, `createLabel` (parented on B's collection), `updateLabel`, `deleteLabel` and `setCollectionPlaceLabels`
  (B's `collectionPlaceId`) each reject with `NotFoundError`, and B's `collections`, `collection_places`, `collection_labels` and
  `collection_place_labels` rows are byte-identical afterwards. The reverse reads are **not** the same shape:
  `getCollection(scopeB, aCollectionId)` resolves to `null`, `listLabels(scopeB, aCollectionId)` and
  `listCollectionPlaces(scopeB, { collectionId: aCollectionId })` return `[]`, and
  `collectionsRepository.requireById(scopeB, aCollectionId)` throws `NotFoundError`; all four are asserted so no test expects a throw
  from a read built to return a nullable. The point of the block: `setCollectionPlaceLabels(scopeA, aPlaceId, [bLabelId])` **resolves**,
  returns `[]`, and writes no join row naming `bLabelId`; with `[aLabelId, bLabelId]` it returns exactly `[aLabelId]` (a drop that also
  dropped the caller's own label would pass a test that only looked for the absence of `bLabelId`). Plus, within one workspace,
  `updateLabel` and `deleteLabel` on a label of a different collection -> `NotFoundError`. Functions covered: `getCollection`,
  `listCollectionPlaces`, `listLabels`, `updateCollection`, `deleteCollection`, `setCollectionPlaceStatus`, `createLabel`, `updateLabel`,
  `deleteLabel`, `setCollectionPlaceLabels`, `collectionDeleteSummary`.
- Repository (`repositories.test.ts`, collections suite): the guard for owner, admin above, member below, a departed owner;
  `setCollectionPlaceLabels` issues one batch holding both statements (spy on `scope.db.batch`), a 16-id assignment inserts in one
  statement, a failing insert leaves the previous assignment in place, `[aLabelId, aLabelId]` returns and stores `[aLabelId]` (rows are
  built from the label rows the query returned, not from the raw input, so a repeated id cannot break the
  `(collection_place_id, label_id)` primary key), an assignment where nothing is kept issues only the delete (Drizzle refuses an empty
  `values()`), and a label of another collection of the same workspace inside `labelIds` is dropped.
- Browser, per `docs/plans/12-verification-protocol.md` and ADR 0016 (no baselines, no pixel comparison, no `e2e/__screenshots__`; the
  plan's Verification block predates both): `e2e/product-modules.spec.ts` asserts `/collections` and a collection detail page answer,
  hydrate and say nothing in the console, then edits a collection's name and restores it, changes a status and restores it, creates,
  assigns, filters by two labels and removes a label. The writing describes are `test.describe.configure({ mode: 'serial' })`, run on
  `chromium` only (`test.skip` on `mobile-safari`), and are named among the fixture writers in `playwright.config.ts`'s `workers`
  comment. The detail page is reached by clicking the first card. Run
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup` then
  `... pnpm exec playwright test e2e/product-modules.spec.ts`, with the port from `bash .ai/scripts/e2e.sh`. The shared route tables in
  `e2e/helpers/routes.ts` are not edited.
- Frames, the blind A/B pair a person reads at review, from `scripts/visual/capture.mjs` (the plan's `scripts/ultrabuild` path does not
  exist): `PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs --url "http://localhost:$PORT/collections" --out "<scratchpad>/shots/08-S4" --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth`
  and, on the detail route, `--state status --click '[data-part="place-status"]'`, `--state labels --click '[data-part="label-manager"]'` and
  `--state place-labels --click '[data-part="place-labels"]'`. The three selectors are `data-part` attributes this stage publishes,
  verified to resolve by the spec run reaching the same state. The spec run also asserts layout shift 0 after the dialogs load
  (`chromium`; a `test.skip` on `mobile-safari`).
- Definition of done: the `docs/SPEC.md` §7 checklist, item by item, in each PR body, and the §2 quality clauses against the picker,
  the dialogs and the manager (4px grid; hover, focus-visible, active, disabled and loading states; designed empty, loading and error
  states; motion 150 to 260 ms on `--ease-out-quint`, transform and opacity only, reduced motion honoured; light and dark parity; 360 to
  2560 px with the dialogs as the primitive's bottom sheet; keyboard end to end; zero console errors; `tabular-nums` on counts).
- Documentation: the implementer greps `three-state`, `setCollectionPlaceLabels`, `deleteLabel`, `collection_labels`, `ADD-09`,
  `inkOn` and `create-dialogs` across `docs/` and `.ai/` and updates every document that states what this stage changes (the plan's own
  08-S4 block gets a one-line pointer to this spec's departures), and names the terms searched in the PR template's last box.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                              | Applied default                                                                                                                                                                                        | Why                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Three-state or five-state status, cycle or picker?                                    | Five states, a menu picker (Resolved assumption 19)                                                                                                                                                    | Plan decision, verified (`collection_places_status_chk`, the five pills already on the screen); a narrowing migration is not additive                                                                                                                                                         |
| 2   | Which fields does the edit form carry; is `ADD-09` "done"?                            | Name, description, colour only. No icon, no cover URL. `ADD-09` stays `partial`                                                                                                                        | Decided by product owner sub-agent (medium): nothing renders `icon` or `cover_image_url`; a cover URL is a hotlink and covers have no upload path; claiming "done" without the cover would be half a promise                                                                                  |
| 3   | What does the stage do with `visibility`?                                             | Leave it out of the edit form; add no read rule; record the false promise in Risks and ask for a follow-up issue in the PR body                                                                        | Decided by security and tenancy sub-agent (medium) and agreed by the product owner sub-agent: reads are tenant-only, "Only me" is not kept, enforcing it ships the sharing model early without its tests; the option is the most reversible                                                   |
| 4   | Who may do what, and where is it enforced?                                            | Status and labels: any member. Edit details and delete: owner or workspace admin, in a repository guard `requireOwnedCollection` (not-found first, then forbidden), `canManage` computed on the loader | Decided by security and tenancy sub-agent (medium) and software architect sub-agent (high): the plan's own sharing section already says "owner or a workspace admin"; `owner_user_id` has no FK so a departed owner needs an admin; a repository guard protects the seeder too                |
| 5   | Slicing                                                                               | Two full-path tickets: change + status, then labels                                                                                                                                                    | Decided by product owner sub-agent (medium): three tickets would split one actions-menu path for no reason; the second ticket mounts controls on the first's screen                                                                                                                           |
| 6   | Label rename and recolour have no function                                            | New `updateLabel`; `updateLabel` and `deleteLabel` take the collection id; this contradicts the plan's "no function is added" and says so                                                              | Decided by software architect sub-agent (high): delete-and-recreate drops assignments and the id that `?labels=` carries; dropping rename leaves the manager incomplete                                                                                                                       |
| 7   | How does a duplicate label name become a field error?                                 | The function returns `{ ok: false, reason: 'duplicate' }`, from a folded pre-check and the unique-index violation; `AUTHORED_ERROR_NAMES` unchanged                                                    | Decided by software architect sub-agent (high): a new authored class changes a closed rule (`docs/SPEC.md` §9 rule 10); the generic failure breaks the plan's "field error, not a toast"                                                                                                      |
| 8   | The label assignment batch and its cap                                                | One `runBatch` of builders inside the repository, tenant column stamped, cap 16 at the repository, one exported constant; plus a 30-label ceiling per collection                                       | Decided by software architect sub-agent (high): the helpers cannot be batched; 50 rows is 200 bound parameters against D1's 100; the plan's "bounded by the unique index" bounds nothing (applied default for the 30)                                                                         |
| 9   | Optimistic status writes?                                                             | No: a busy trigger, the old value stays, `router.invalidate()` after success                                                                                                                           | Decided by software architect sub-agent (medium): the loader holds every place, so a re-read is cheap; rollback plus its tests are more than one slice needs                                                                                                                                  |
| 10  | Delete confirmation                                                                   | Typed name when the collection holds a saved place, a plain confirm when empty, checked on the server as a Zod failure; the dialog states the counts                                                   | Decided by product owner sub-agent (medium) and software architect sub-agent (high): the trip delete's rule (`assertConfirmed`); the cascade has no undo                                                                                                                                      |
| 11  | Localisation scope                                                                    | Everything on `$collectionId.tsx` the stage writes or rewrites, `modules.collections.*`, 23 locales; the index route is left and named in Risks                                                        | Decided by product owner sub-agent (medium): the sibling leave-planner spec's precedent and `docs/SPEC.md` §9 rule 6; pulling in untouched literals is scope creep                                                                                                                            |
| 12  | Components and the server                                                             | Server functions are passed in as props; the route file imports them                                                                                                                                   | Decided by software architect sub-agent (high): `src/components/console/index.ts` states the layering                                                                                                                                                                                         |
| 13  | `inkOn()` for label text                                                              | Not used: no text sits on a label colour                                                                                                                                                               | Applied default: the chip is neutral with a colour dot; the dot clears 3:1 (`src/lib/swatches.ts`)                                                                                                                                                                                            |
| 14  | Search contract                                                                       | `labels?: Array<string>`, max 30 (`MAX_LABELS_PER_COLLECTION`); `?label=` dropped without a redirect                                                                                                   | Decided by software architect sub-agent (medium-high): `label` is defined once and produced only by the page's own links                                                                                                                                                                      |
| 15  | A control to put a label on a place                                                   | `PlaceLabelsPicker` on each card, in the labels ticket                                                                                                                                                 | Applied default: the plan names `setPlaceLabelsFn` and no control calls it; labels nobody can attach filter nothing                                                                                                                                                                           |
| 16  | Does renaming change the slug?                                                        | No                                                                                                                                                                                                     | Verified: `updateCollection` reserves a slug only when one is passed; the screens address a collection by id                                                                                                                                                                                  |
| 17  | Colour of a stored value outside the palette                                          | Shown as the current choice and kept unless another swatch is picked                                                                                                                                   | Decided by product owner sub-agent (medium): the database default `#2F6F5E` is not a palette value; opening the editor must not recolour                                                                                                                                                      |
| 18  | Where does the spec's glossary change land?                                           | `CONTEXT.md` gains Collection, Saved place, Collection label, Place status                                                                                                                             | Decided by product owner sub-agent (medium): none is defined today                                                                                                                                                                                                                            |
| 19  | What control changes a status?                                                        | A `DropdownMenu` with radio items on the badge-shaped trigger, not a `Popover` with a `RadioGroup`                                                                                                     | Decided by accessibility specialist sub-agent (medium): `RadioGroup` selects as the arrow keys move, so a write on choosing would save on every arrow press (WCAG 3.2.2); menu radio items move on arrows and commit on Enter, Space or a click                                               |
| 20  | May any member write to a collection set to "Only me"?                                | Yes: status, labels and assignments stay any-member, as reads are; Risks says so plainly, and the slicer files the follow-up issue                                                                     | Applied default after the security and tenancy sub-agent's condition (high), which allowed either limiting those writes or recording the choice: limiting writes while every read stays open protects nothing, and the visibility model is the sharing-roles stage's                          |
| 21  | New error class for a refused edit?                                                   | No: `ForbiddenError` (code `FORBIDDEN`, `src/server/repos/context.ts`) with `['owner', 'admin']`                                                                                                       | Decided by software architect sub-agent (medium): DRY; the message never reaches the reader (`docs/SPEC.md` §9 rule 10)                                                                                                                                                                       |
| 22  | Name limits                                                                           | A collection name is bounded by `titleSchema` (200), as at creation; a label name by 40 at the function boundary                                                                                       | Decided by software architect sub-agent (medium): a tighter bound on edit than on create would make a long existing name un-editable; labels are short by nature and a stored label longer than 40 can still be deleted and renamed to a shorter name                                         |
| 23  | The plan's "ordering rule for a new label"                                            | Not built: `listLabels` orders by `sort_order`, then name, and a new label takes the repository default                                                                                                | Applied default after the product owner sub-agent's condition: reordering labels is out of scope, so a rule that places a new one has nothing to order                                                                                                                                        |
| 24  | The plan's `auditServerClock` call and `e2e/product-modules.visual.spec.ts` baselines | Not built                                                                                                                                                                                              | Applied default after the product owner sub-agent's condition: `auditServerClock` is not an e2e helper (it lives in `src/server/fns/console/providers.ts`) and neither screen prints a clock-derived string; baselines are replaced by the frames and spec run of Verification under ADR 0016 |
| 25  | Status filter: one status or several?                                                 | One: `status?` stays a single value, as the screen has it                                                                                                                                              | Applied default after the product owner sub-agent's condition: the plan's "selected statuses" has no control behind it; labels are the multi-select                                                                                                                                           |
| 26  | Typed-name race: a place is added after the summary was read                          | The server re-checks and refuses with its validation message; the dialog catches that refusal, re-reads the summary and shows the localised name field                                                 | Decided by UX sub-agent (high) and security and tenancy sub-agent (high): an English server sentence must not reach the reader on a normal path; the remaining window is two statements in `deleteCollection`, accepted and written down                                                      |
| 27  | Plurals with two numbers or a fixed number                                            | Every plural key varies on `{count}` only; the delete summary is two keys; no `{max}` placeholder                                                                                                      | Decided by UX sub-agent (high): `resolveMessage` (`src/lib/i18n/interpolate.ts`) picks a plural form from `count` alone                                                                                                                                                                       |
