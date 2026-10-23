# Collections: put places into a list, read one closely, and decide who else may

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | #1123                                    |
| **Implementation** | none                                     |
| **Plan**           | 08-S9 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S9` is the part of the saved-places module (reference row `ADD-10`) that **fills a list**. Today a traveller can create
a collection and read what is in it, and nothing in the product can put a place into one: `addCollectionPlace`,
`saveTripPlaceToCollection`, `updateCollectionPlace` and `deleteCollectionPlace` (`src/server/repos/collections.ts`) have no caller
but tests and the dev seeder, the detail screen shows a place as a card and nothing more, and the empty state promises three ways to
save a place of which none exists. The same repository also reads every collection to every member of the workspace whatever its
`visibility` says. This stage ships, as **five tickets that are each a full path from the repository to the screen**:

1. **08-S9a - who may read and write a list.** One read rule in the repository (a `private` list is the owner's and nobody else's), the
   sharing dialog with its two enforceable choices, the quota count that leaves a stranded private list out, and the aggregates that
   must stop counting what the caller cannot read, and the audit entry for a change of sharing. `risk-high`, `security`.
2. **08-S9b - add a place by hand and read it closely.** The `places` ceiling asserted on every collection write for the first time,
   the admin `places` meter reading the same number, the add form with an optional map position, the place sheet (read, edit, remove, provenance) and the rewritten empty state.
3. **08-S9c - add from a trip, and save to several lists.** Pick a trip you can read and copy places from it into the list; copy a
   saved place into other lists; one de-duplication rule and one writer for both. `risk-high`, `security`.
4. **08-S9d - narrow the list and the map together.** A paged list, a pin read built on the same predicate, and a map that shows
   exactly the places the list matches.
5. **08-S9e - act on a selection.** Select places, then set a status, add a label, copy to other lists or remove them, all-or-nothing. `risk-high`, `security`.

No schema change, no migration, no route file added (so no `pnpm generate-routes`), no package added, no queue message, no realtime
patch.

**Reference row `ADD-10` stays `partial`**, and two ways of getting a place into a list are deliberately not here: search-and-add (no
search component exists; the geocoder it needs is decided - `docs/adr/0013-geoapify-for-geocoding.md` - but the place-search stage of the
places-and-maps plan is later in the same plan's schedule) and copying a list's places **into a trip**, which that same plan's import
stage owns together with the bulk `createPlaces` writer it needs (Resolved assumptions 2 and 3).

This spec describes the work that is **left** at HEAD (`ec5182b2`). It departs from the plan's stage block wherever the code the block
cites has changed or a specialist found the block wrong; every departure is a row of the Resolved assumptions table. Other stages are
named here by what they ship, never by id: the backlog reads any mention of a stage id in a spec as that stage being specified already.

## 📝 Problem Statement

Verified against the repository at HEAD:

- **A read-only screen over writers nobody calls.** `src/routes/_app/collections/$collectionId.tsx` renders `loadCollectionDetail`
  (`src/routes/_app/-server/library.ts`): a place card with its status badge and label chips, and a "Website" link. The only collection
  write in the product is `createCollectionFn`. The four place writers above are reached by repository tests and the dev seeder
  (`src/routes/api/dev/-seed/apply.ts`).
- **The empty state promises what does not exist.** "Save a place from the map, from another trip, or straight from a recommendation,
  and it lands in this collection" (hard-coded English at `$collectionId.tsx`). There is no save from a map, no copy from a trip and no
  recommendation.
- **A saved place has no ceiling.** `createPlace` asserts the `places` quota per row (`src/server/repos/places.ts:287`; the plan's
  `:269` is `countTripPlaces`). `addCollectionPlace` and `saveTripPlaceToCollection` assert nothing, and `places` is the
  workspace's limit (an operational ceiling the catalogue does not model, `src/server/billing/limits.ts:26-27`). Making them writable without a count would let a free workspace (150 places) store thousands.
- **A quota refusal cannot name the ceiling or the plan on screen.** The plan asks for "a designed panel naming the ceiling and the
  plan". `QuotaExceededError` carries the metric, limit and usage, but the boundary strips them by design: a quota failure crosses as
  `{ kind: 'unexpected', code: 'QUOTA_EXCEEDED' }` only (`src/server/errors/public.ts`, `src/lib/errors.ts`, whose closed code list is
  a contract), and the planner already resolves that code to one localised sentence plus a "see plans" link
  (`src/routes/_app/trips/$tripId/-ui/planner-add-place.tsx`, `reportPlaceWriteFailure`).
- **`visibility` is enforced on no read, and this stage is where it is meant to be.** `listCollections`, `getCollection`,
  `getCollectionBySlug`, `listCollectionsWithCounts`, `listCollectionPlaces`, `listLabels` and `countCollectionPlacesByCountry`
  apply the tenant filter and nothing else, so a list created as "Only me" is opened by every member, and "Anyone with the link" has no
  page behind it. The change-a-collection spec (`.ai/specs/2026-10-10-a-collection-you-can-change.md`, Risks) left the owner-only rule
  to this stage; ticket #1106 retires the two options at creation without adding a read filter and says enforcement belongs here.
  Stored `private` and `public` rows exist and keep their values. `createCollectionInput` and `updateCollectionInput` also still carry
  `visibility` (`collections.ts:68`, `:80`), so an admin can rewrite it through the update path, and `loadCollectionDetail` answers an
  unknown collection with a plain `Error` (`library.ts`) that would reach the error panel as `unexpected`.
- **`saveTripPlaceToCollection` can read a private trip.** It resolves the place with `placesRepository.requireById`, a tenant filter
  only, and never `requireTrip` (`collections.ts`), so a member could copy a place out of a private trip they are not on, by id. It is
  harmless while nothing calls it; this stage gives it callers.
- **The detail loader breaks past 99 saved places.** `listCollectionPlacesWithLabels` reads the label links with
  `inArray(collectionPlaceId, <every place id>)` under a tenant filter, one bound parameter per id plus the organisation, and D1 refuses
  a statement with more than 100 (`MAX_BOUND_PARAMETERS`, `src/server/repos/batch.ts`). Nothing could create 100 places in a list
  until now. `listCollectionPlaces` has the same shape for a label filter (it materialises the matching ids into `inArray`).
- **The bulk ceiling in the plan is unsound as written.** The plan caps bulk actions at 100 ids and says they run "through `runBatch`,
  which is one D1 batch and therefore one transaction". That holds, but a `collection_places` row binds 26 columns, so
  `chunkFor(26)` is 3 rows per statement and 100 inserted rows are 34 statements; and every `IN` read, update or delete over 100 ids
  binds 101 parameters (`findByIds`, `src/server/repos/base.ts`). The tenant helpers (`insertMany`, `removeWhere`) execute at once and
  cannot go in a batch, so bulk writes use un-awaited Drizzle builders with `organization_id` stamped by hand (as `reorderPlaces` and
  the change-a-collection spec's label batch do).
- **The plan's partial-success error is incompatible with its own atomic batch.** "A failed bulk action names how many succeeded and
  how many did not, and offers a retry over the failures only" describes client-side chunking. One batch either writes everything or
  nothing, so the honest result is `{ added, skipped }` (skipped = already there) and a failure means nothing changed.
- **Two plans claim the same copy.** The plan's `copyPlacesToTrip` writes collection places into a trip through a loop over `createPlace`.
  The places-and-maps plan's import stage ("Bring a saved collection into a trip", later in the schedule) owns that direction, its
  `createPlaces` writer in `src/server/repos/places.ts`, a quota asserted once for the whole batch and an import sheet on the planner,
  and explicitly touches nothing under `src/routes/_app/collections/`. A loop over `createPlace` is the per-row quota that plan rejects
  by name. `createPlace` now enforces owner/editor access in the repository (#928, PR #1299); the planner additionally checks
  archive state with `requireEditablePlan` (`plan.ts`). The repository still has no archive check. One concept, one owner
  (`docs/SPEC.md` §8): this stage does not build it.
- **The plan's stale citations.** `hasAtLeastRole(scope.ctx.role, 'admin')` - the function takes the context
  (`hasAtLeastRole(scope.ctx, 'admin')`, `src/server/repos/context.ts`); the schema line numbers it cites for `collections` have
  moved (`src/server/db/schema.ts`, `collections` near line 1952); the "MAP-02 is BLOCKED" premise is stale (above). None changes the
  design; they are corrected here so an implementer does not chase them. `createLabel` and `deleteLabel` already exist at HEAD
  (`collections.ts`); only `updateLabel` comes from the change-a-collection spec.
- **`addCollectionPlaceInput` and `updateCollectionPlaceInput` are not strict objects** and expose `source`, `externalId` and
  `sortOrder` (`collections.ts`); the boundary of this stage must not.
- **The admin meter reads a different number from the one the quota enforces.** `loadAdmin` shows `collections: listCollectionsWithCounts(scope).length`
  and `places: summary.counts.places` (`src/routes/_app/-server/overview.ts`), the second counting trip places only
  (`placesRepository.count` in `dashboard.ts`); 08-S9b makes the second read `countSavedPlaces`.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                                                       | Not owned (read only, or left alone)                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/repos/collections.ts` - the read rule, `setCollectionSharing`, every writer keyed by a place or label id, the new writers and readers (`listTripOptions`, `listTripPlacesForSaving`, `listPlaceLists`, `collectionPlaceFilter`, `listCollectionPlacesFiltered`, `listCollectionPins`), and `visibility` removed from `updateCollectionInput` and narrowed to `organization` in `createCollectionInput` | `src/server/repos/places.ts`: not edited. `createPlace` stays the single-create path; nothing here writes `places`                         |
| `src/server/repos/saved-places.ts` - new, neutral: `countSavedPlaces`, `assertSavedPlaceQuota` (reads both tables, imports no repository)                                                                                                                                                                                                                                                                          | `src/server/db/schema.ts`, `drizzle/`: no schema change. `src/lib/plans.ts`, `src/server/billing/**`: no quota key, no `MODULE_KEYS` entry |
| `src/server/repos/index.ts` - the `export *` and the module-map entry for `saved-places.ts`                                                                                                                                                                                                                                                                                                                        |
| `src/lib/collections/dedupe.ts` (+ test) - new, pure: the fold and the duplicate key                                                                                                                                                                                                                                                                                                                               | `src/lib/errors.ts`, `src/server/errors/public.ts`: the closed code and name lists do not change                                           |
| `src/routes/_app/-server/collections.ts` (+ `__tests__/collections.test.ts`) - edit; created by the change-a-collection spec, grown here                                                                                                                                                                                                                                                                           | `src/routes/_app/-server/library.ts`: `createCollectionFn` and the journal loaders untouched                                               |
| `src/routes/_app/-server/library.ts` - `loadCollectionDetail` (the readable lookup, `notFound()`, the payload types, the owner's name); `src/routes/_app/-server/overview.ts` - the `collections` and `places` meters of `loadAdmin`                                                                                                                                                                               |                                                                                                                                            |
| `src/server/audit/trail.ts` (+ `__tests__/trail.test.ts`) - `collection.sharing_changed`, `collection.places_removed` and `collection.deleted` join `AUDIT_ACTIONS`                                                                                                                                                                                                                                                |                                                                                                                                            |
| `src/routes/api/dev/-seed/apply.ts` - a `private` fixture is created and then switched with `setCollectionSharing` as the owner; a `public` fixture seeds as `organization`, so `setCollectionSharing` is the only writer of `visibility` here too                                                                                                                                                                 |
| `src/components/map/pins.tsx` (+ test) - `PlacePin` gains a status-glyph prop                                                                                                                                                                                                                                                                                                                                      |
| `src/routes/_app/collections/$collectionId.tsx` - edit: loader deps, page, pins, mounts                                                                                                                                                                                                                                                                                                                            | `src/routes/_app/trips/**`: no trip screen is touched (the planner's place card does not gain a "save to list" control)                    |
| `src/routes/_app/collections/index.tsx` - edit: an "Only you" chip on a private list's card (the index is otherwise unchanged)                                                                                                                                                                                                                                                                                     | `src/components/ui/*`: untouched; primitives reused as they are                                                                            |
| `src/components/collections/` - new: `place-sheet.tsx`, `place-form.tsx`, `add-place-dialog.tsx`, `from-trip-dialog.tsx`, `save-to-collection.tsx`, `sharing-dialog.tsx` (08-S9a/b/c); `collection-map.tsx`, `load-more.tsx` (08-S9d); `bulk-bar.tsx`, `selection.ts` (08-S9e); `__tests__/`; `index.ts` - edit (see "Neighbouring work")                                                                          | `scripts/seed/seed.mjs`: acts as the owner; unchanged                                                                                      |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**, `modules.collections.*`                                                                                                                                                                                                                                                                                                                    | `src/lib/i18n/messages/en/shell.ts` (`newCollection.*`): untouched; #1106 removed `visibility.*`                                           |
| `src/server/repos/__tests__/tenant-isolation.test.ts`, `member-isolation.test.ts`, `repositories.test.ts` (collections suite) - append                                                                                                                                                                                                                                                                             | `e2e/journeys.spec.ts`: untouched                                                                                                          |
| `e2e/product-modules.spec.ts` - created if absent, otherwise a `test.describe` is appended (the sibling module specs create the same file; whichever lands first creates it). No baselines (ADR 0016)                                                                                                                                                                                                              |                                                                                                                                            |
| `CONTEXT.md` - **Collection**, **Saved place**, **Collection sharing**, **Stranded collection** (the first two are also asked for by the change-a-collection spec; whichever lands first writes them)                                                                                                                                                                                                              |                                                                                                                                            |

### Neighbouring work

Three pieces of work touch the same files and none of them is implemented at the time of writing; this stage merges after them.

- **The change-a-collection spec** (#1103; tickets #1104, #1105, #1106) creates `src/routes/_app/-server/collections.ts`,
  `requireOwnedCollection`, `canManageCollection`, `canManage` on the detail payload, the actions menu, the status picker, the labels
  and the client-side `filters.ts` predicate. 08-S9a is `Blocked by` #1104 (it edits the guard and the header menu), #1106 (it removes the visibility choice from the create dialog and the create function's input; this ticket narrows `createCollectionInput` itself, with the seeder change) and #1105 (which brings `updateLabel`, the label ceiling and the
  batched label writer, so the read rule routes every label writer in one ticket; `createLabel` and `deleteLabel` exist at HEAD). 08-S9d
  and 08-S9e wait for #1105 through 08-S9a (they move the label predicate to the server and add a label to a selection).
- **Ticket #1106** retires the visibility choice at creation: a new collection is always `organization`. This stage does **not** put the
  choice back on the create dialog. It adds a sharing dialog on an _existing_ list, offered to its owner, after the rule that makes
  "Only you" true exists (08-S9a). That reverses #1106's "no collections screen renders a visibility badge" on purpose and only for the
  true cases: the header shows the list's real audience and the index card shows an "Only you" chip on a private list. The ticket must
  say so in its PR body so a reviewer does not read it as drift.
- **The journal spec** moves the new-collection dialog into `src/components/collections/new-collection-dialog.tsx` and creates
  `src/components/collections/index.ts`. This stage imports its components by path and adds its exports to the barrel when the barrel
  exists, and creates it when it does not.

### Phase boundaries (tickets)

Five tickets, in order. Each is a full path (repository -> server function -> screen -> test); none is a horizontal layer.

| Ticket | Delivers                                                                                                                                                                                                                                                                                                                                                           | Blocked by          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 08-S9a | `readableCollectionFilter`, `inReadableCollection`, `requireReadableCollection`; every reader and writer routed through them; `visibility` written only by `setCollectionSharing`; `countCollectionsAgainstPlan` and the meter; `loadSharingFn`, `setCollectionSharingFn`; the audit names; `SharingDialog`; the header audience and owner; the index chip         | #1104, #1105, #1106 |
| 08-S9b | `saved-places.ts`; the quota on `addCollectionPlace`; the admin `places` meter; a strict `addPlaceFn`, `updatePlaceFn`, `deletePlaceFn` (guard inside the repository, audit entry); `PlaceForm`, `AddPlaceDialog`, `PlaceSheet`; the position pair; the rewritten empty state; the chunked label and provenance reads                                              | 08-S9a              |
| 08-S9c | `dedupe.ts`; the shared insert builder and copy mapping; `saveTripPlacesToCollection` (with `requireTrip`); `copyPlacesToCollections`; `listTripOptions`, `listTripPlacesForSaving`, `listPlaceLists`; `loadTripOptionsFn`, `loadTripPlacesFn`, `addFromTripFn`, `loadPlaceListsFn`, `savePlaceToCollectionsFn`; `FromTripDialog`, `SaveToCollection` on the sheet | 08-S9b              |
| 08-S9d | `collectionPlaceFilter`, `listCollectionPlacesFiltered`, `listCollectionPins`; loader deps and the keyset page; `LoadMore`; `CollectionMap`; the empty-map state; the client predicate removed                                                                                                                                                                     | 08-S9b, #1105       |
| 08-S9e | `selection.ts`, `BulkBar`; `setPlacesStatusFn`, `addLabelToPlacesFn`, `copyPlacesFn`, `deletePlacesFn` and their repository writers (tenant and readable predicates in every WHERE; the removal guard inside `deleteCollectionPlaces`; the audit entry is written by the server function)                                                                          | 08-S9c, 08-S9d      |

The order is a dependency, not a preference: every write in tickets b to e asks "who may write this list" and 08-S9a answers it; b
introduces the quota helper and the sheet that c and e use; c's writer is the one e's "copy to other lists" calls.

### Who may do what (Resolved assumptions 4 to 9)

| Verb                                                                                              | Who                                                                                | Where it is enforced                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Read a list, its places, its labels, its counts                                                   | any member for `organization` (and stored `public`); the owner alone for `private` | `readableCollectionFilter` / `inReadableCollection` in the repository                                                        |
| Add a place, edit it, set its status, label it, copy places into the list, copy a place out of it | any member who can read the list                                                   | the same predicate; no role check                                                                                            |
| Remove a place (one or a selection)                                                               | the list's owner, or a workspace `admin` or above                                  | `requireOwnedCollection` (the change-a-collection guard), called inside `deleteCollectionPlace(s)` after the readable lookup |
| Delete the list, edit its name, description and colour                                            | the same                                                                           | the same (change-a-collection spec)                                                                                          |
| Change who can see the list                                                                       | **the owner only**                                                                 | `setCollectionSharing`, after the readable lookup                                                                            |

- **A list the caller cannot read raises the same `NotFoundError` as a foreign id**, for every verb above, admins included. A forbidden
  answer would tell a member that a private list exists. `canManageCollection` runs only after the readable lookup, so an admin cannot
  edit, delete or summarise a private list they cannot read.
- **A stored `public` row reads as `organization`.** Its creator asked for something wider than the workspace, so showing it to the
  workspace hides nothing they meant to share. This differs from trips, where a signed-in reader ignores `public` because a share token
  could silently publish a private trip (ADR 0007): collections have no token column, so that reason does not apply, and the code
  comment says so. The sharing dialog shows such a list as "Everyone in this workspace" and rewrites the value only when it is saved.
- **Switching `organization` -> `private` is allowed with a warning.** Places other members saved stay in the table (`saved_by`) and
  become invisible to them. The dialog says how many (a count from the server, from the same predicate as the rule) and the switch is
  undone by switching back; nothing is deleted.
- **A stranded private list** (private, its owner no longer holds a `member` row) is readable by nobody and is left out of the
  `collections` quota count, and out of the admin meter, the way a stranded trip and an orphaned journey are (ADR 0007 and the trips
  rule `strandedTripFilter`, ADR 0034 and `countedJourneyFilter`); it counts again if the owner returns. Its saved places keep counting
  against `places`, as the places on a stranded trip do. Whether an admin should be able to reach such a list is the open question
  already filed for trips and journals (#807), which gains collections in its text; this stage widens no reader set.
- **Why owner-only sharing departs from the plan's "owner or admin".** Under the read rule an admin can reach only lists shared with
  the workspace. An admin who could switch a departed owner's list to private would make it unreadable by everyone with no way back.
- **Removal is stricter than editing on purpose** (Resolved assumption 8). A member's remedy for a place they added by mistake is the
  status `rejected` or asking the owner. Loosening it later is an additive change; tightening it is not.

### The read rule (`src/server/repos/collections.ts`)

Modelled on `readableJourneyFilter`, `inReadableJourney` and `countedJourneyFilter` (`src/server/repos/journey.ts`), and written once:

- `readableCollectionFilter(scope)`: `visibility IN ('organization', 'public') OR owner_user_id = scope.ctx.userId`. It fails closed: a
  value added to the CHECK later is denied until someone widens the rule on purpose.
- `inReadableCollection(scope, column)`: a correlated `EXISTS` over `collections` bound with `tenantFilter(scope, collections, ...)` **and**
  `readableCollectionFilter`, for every row that names its collection by id (`collection_places.collection_id`,
  `collection_labels.collection_id`). Both sides are tenant-bound.
- `requireReadableCollection(scope, collectionId)`: the readable lookup that raises `NotFoundError('collection', id)`. S4's
  `requireOwnedCollection` and `collectionDeleteSummary` start from it instead of `requireById`.
- Every reader goes through the predicate: `listCollections`, `getCollection`, `getCollectionBySlug`, `listCollectionsWithCounts`,
  `listCollectionPlaces`, `listCollectionPlacesWithLabels`, `listLabels`, `countCollectionPlacesByCountry` (the "Where they are" panel
  must not count a private list's places for a non-owner), `nextCollectionPlaceSortOrder` and `collectionDeleteSummary`; every reader this
  spec adds (`listCollectionPlacesFiltered`, `listCollectionPins`, the duplicate lookups, `listTripPlacesForSaving`, `listPlaceLists`, the
  sharing summary) joins the list when it is written. `loadCollectionDetail` starts from `requireReadableCollection` and
  reports a `NotFoundError` as the plain `{ found: false }` result (`OrAbsent`, `src/lib/absence.ts`, #953), which the route loader turns into the
  router's `notFound()`, so the existing `notFoundComponent` renders instead of the error panel.
- Every writer keyed by a **collection id, a place id or a label id** goes through it too (`addCollectionPlace` resolves its collection with `requireById` today, a workspace check only; the others never resolve one): `addCollectionPlace`, `updateCollectionPlace`, `setCollectionPlaceStatus`, `deleteCollectionPlace`, `setCollectionPlaceLabels`, and the label writers
  (`createLabel` and `deleteLabel`, which exist at HEAD, and `updateLabel` from the change-a-collection spec). A member must not be able to write into a private list by passing a place id.
- `countCollectionsAgainstPlan(scope)`: `collectionsRepository.count(scope, not(strandedCollectionFilter(scope)))`, where a stranded collection is the exact negation of the read rule's workspace half - `NOT (visibility IN ('organization', 'public'))` and `NOT stillInWorkspace(scope, collections.ownerUserId)`, never `visibility = 'private'` - so the quota exemption and the read rule cannot drift apart (`strandedTripFilter` uses `ne(visibility, 'organization')` for the same reason) (`src/server/repos/members.ts`).
  `createCollection` and the collections meter of `loadAdmin` both use it, so the enforced number and the displayed number are one.
  This changes the plan's "`collections` is unchanged": it is the same ceiling counted the way trips and journals count theirs.
- A dev-seeder or console actor that passes the owner's scope passes unchanged.
- **`setCollectionSharing` is the only writer of `visibility`.** `visibility` leaves `updateCollectionInput`, and
  `createCollectionInput.visibility` is `organization` (this stage does it together with the seeder change, since the dev seeder creates its `private` and `public` fixtures through that input; ticket #1106 only removes the choice from the dialog and the server function; the test asserts it).
  Otherwise an admin could rewrite a collection's audience through the update path.
- **The removal guard lives in the repository.** `deleteCollectionPlace` and the new `deleteCollectionPlaces` call
  `requireOwnedCollection` themselves, so no caller can skip it; the dev seeder acts as the owner and is unaffected.
- **`deleteCollectionPlaces` returns what it deleted**, `ReadonlyArray<{ collectionId, count }>` counted from the readable rows it resolved before the batch (`runBatch` returns nothing and the batch is all-or-nothing, so those rows are the rows removed), not from the input ids; `deleteCollectionFn` takes the `collection.deleted` count from `collectionDeleteSummary`, read before the delete, so `deletePlacesFn` writes each audit entry from real counts.
- **Audit.** `collection.sharing_changed` (`metadata: { from, to }`, the stored value before the change), `collection.places_removed` (`metadata: { count }`) and `collection.deleted` (`metadata: { places }`) join `AUDIT_ACTIONS`
  (`src/server/audit/trail.ts`: tenant-security events gain their names in the stage that ships their write paths). `trail()` imports the
  repositories, so the server functions (`setCollectionSharingFn`, `deletePlaceFn`, `deletePlacesFn`) call it after the repository call
  returns, with `entityType: 'collection'`, the collection id and, for removals, `metadata: { count }`; a bulk remove across several
  collections writes one entry per collection from the counts `deleteCollectionPlaces` returns. Repositories never call it. No collection audit entry puts a collection or place name in `metadata` - only ids, counts and enum values - because an admin reads the trail and cannot read a private collection. `deleteCollectionFn` (the change-a-collection spec's) writes `collection.deleted` after `deleteCollection` returns; 08-S9a edits that one call site, because deleting a collection cascades every member's saved places (`onDelete: 'cascade'`) and would otherwise leave no record. Copies are not audited: they write the caller's own readable content into a list the caller can read.

### The saved-place quota (`src/server/repos/saved-places.ts`, Resolved assumption 11)

A neutral module, so the places-and-maps plan's later writer can import it without a cycle (`collections.ts` already imports
`places.ts`). It reads the two tables directly with `tenantFilter` and imports no repository:

- `countSavedPlaces(scope)` = rows of `collection_places` + rows of `places`, both tenant-wide. A saved place is a saved place: one metric, one
  count, so two independent ceilings under one name cannot drift apart. (`places` is an operational ceiling, not a catalogue figure,
  `limits.ts:26-27`; counting both tables is the plan's own term, stated outright there; see Risks.)
- `assertSavedPlaceQuota(scope, additional)` = `assertQuota(scope, 'places', await countSavedPlaces(scope), additional)`, called **once**
  per write, before the batch, with `additional` equal to the number of rows actually going to be inserted after de-duplication (when that is 0, the assertion and the batch are skipped, so a workspace over its
  ceiling can still copy only duplicates and get `{ added: 0 }`). A
  rejected bulk write guarantees `QuotaExceededError` and zero rows written. The count-then-write race is the one `createPlace` already accepts.
- Called by `addCollectionPlace`, `saveTripPlacesToCollection` (and the single-place `saveTripPlaceToCollection`, which becomes a call
  to it with one id) and `copyPlacesToCollections`.
- **The asymmetry is stated, not hidden.** After this stage a collection write counts both tables and an itinerary write
  (`createPlace`, `src/server/repos/places.ts:287`, and the trip-copy preflights at `src/server/repos/trips.ts:1231-1234` and `:1522-1525`)
  still count `places` alone. The safe direction holds: nobody can exceed the
  ceiling by saving into collections. Making those three call sites symmetric is a small change in files this stage does not edit; a follow-up
  issue is filed (Risks). The admin "places used" meter would otherwise show room while a collection write is refused, so 08-S9b makes
  `loadAdmin` report `countSavedPlaces` (`overview.ts`).

### One copy rule (`src/lib/collections/dedupe.ts`, Resolved assumption 12)

`foldPlaceName` (NFC, lower-case, trim, collapse inner whitespace) and `placeDuplicateKey`. SQLite's `lower()` is ASCII-only and cannot do
NFC, so the comparison is made in application code, not in SQL. Two saved places are the same place when:

1. both have a non-null `source_place_id` and the ids are equal; or
2. `foldPlaceName(a.name) === foldPlaceName(b.name)` **and** their coordinates agree: both have a position and
   `round(lat, 4)` and `round(lng, 4)` are equal (about 11 m), or neither has one and their folded `city` and `country_code` agree too (a null equals a null). A place without a position never matches one with a position, so a "Cafe" in Paris and a "Cafe" in Tokyo are two places.

Four decimals can miss a pair that straddles a rounding boundary; that adds a harmless duplicate, the reversible failure.

- **The lookup is a SQL prefilter plus a JavaScript fold, never a read of a whole collection.** For a chunk of at most 25 candidates (the position statement binds 2 x 25 `IN` values plus about 9 fixed parameters - tenant, collection, the readable `EXISTS` and `LIMIT` - 59 in all; the `source_place_id` statement binds 25 plus the fixed ones; each stays under 100) the
  target is read as a projection (`id, name, lat, lng, city, country_code, source_place_id`) filtered by `round(lat, 4)` and
  `round(lng, 4)` `IN (...)`, and by `lat IS NULL` when a candidate has no position; the name fold and the final decision are JavaScript.
  The chunk counts the tenant and readable-predicate parameters, a test pins `params.length <= 100` (`ID_FILTER_CHUNK` in
  `src/server/repos/trips.ts` is the precedent), and the position and name prefilter is `ORDER BY id LIMIT 500`, so the cut is the same in every chunk - the miss is a harmless duplicate. The `source_place_id IN (...)` match is its own statement with no `LIMIT`, so a copy of the same place is always recognised, whatever else the collection holds (acceptance criterion 16 depends on it). For `listPlaceLists` the one place's `source_place_id` and rounded position are the whole filter, grouped by
  collection, over at most 50 readable collections; no collection's places are read in full.
- A seen-set inside the call makes two overlapping source lists add each place once.
- **A private trip's free text does not reach a shared list by the direct copy** (the rule covers trip-to-collection only; a second, deliberate copy or a later switch of the collection to a wider audience is an action of someone who could already read the trip). When the source trip is not visible to the whole workspace and the target collection is (`organization` or `public`), the copy omits the source place's `notes` and `description`; name, position, address and the rest are copied. "Not visible to the whole workspace" counts a stored `public` trip as not visible, as `readableTripFilter` does. `loadTripOptionsFn` therefore returns each trip's `visibleToWorkspace` flag and `FromTripDialog` takes the target collection's `sharing`; the dialog says so (`fromTrip.privateNote`) before the add. A test copies from a private trip into a shared and into a private collection and asserts the columns (acceptance criterion 16a).
- **What a copy carries.** A collection-to-collection copy carries every descriptive column (`name`, `description`, `notes`, `lat`,
  `lng`, `address`, `city`, `country_code`, `website`, `phone`, `image_url`, `price_minor`, `currency`, `category_id`), `status`,
  `source`, `external_id`, `source_trip_id` and `source_place_id` unchanged, which is what makes rule 1 work across copies;
  `saved_by` is the caller, labels are not carried, `sort_order` is `next + i`, and `id` and the timestamps are new. A trip-sourced
  copy writes the columns `saveTripPlaceToCollection` writes today (`source: 'collection'` is its existing value for a hand add; the
  trip path keeps its existing mapping), with `source_trip_id` and `source_place_id` set from the trip place. The repository
  resolves each place's `tripId` itself and calls `requireTrip` for it.
- `saveTripPlacesToCollection` uses the same rule: a trip place already in the list is reported as `already saved`, not inserted.
- A place typed by hand (`addCollectionPlace`) is **not** de-duplicated: the traveller asked for that row.
- `selection.ts` calls the same function for the count the bar promises; the server's `{ added, skipped }` is authoritative.

### The batched writers (Resolved assumption 10)

Bulk writes build their statements in the repository and submit them in one `runBatch` of un-awaited builders:
`scope.db.insert(collectionPlaces).values(chunk)` with `organizationId: scope.ctx.organizationId` stamped on each row, chunked with
`chunkFor(boundParametersPerRow(collectionPlaces))` (3 rows a statement, 34 statements for 100 rows); the label join
(`collection_place_labels`, 4 columns) is 25 rows a statement. Updates and deletes by id are chunked at 80, and **each carries `tenantFilter(scope, collectionPlaces, inArray(id, chunk))` and
`inReadableCollection` in its own WHERE** (the tenant helpers are bypassed, and a collection that went private between the lookup and
the write must not take the write, as `reorderPlaces` puts the tenant filter in every batched WHERE); the chunk counts the organisation,
the patched value, `updated_at` and the readable predicate's own parameters. `MAX_BULK_PLACES = 100` and the arithmetic are pinned by a test
in the repository suite, as the change-a-collection spec pins its label numbers, together with `builder.toSQL().params.length <= 100`
for every bulk builder at its cap. The all-or-nothing tests run on a batch-capable
driver: `runBatch` falls back to sequential execution on one without `batch`, and that path is not atomic.

- A bulk copy appends: `sort_order` is `next + i` in source order.
- Unknown, foreign or unreadable ids make the whole call a `NotFoundError`; they are not skipped silently.
- **A copy is capped at `ids x targets <= 100`** (`MAX_COPY_ROWS`, a Zod `superRefine` at the boundary and a check inside `copyPlacesToCollections` itself, so no caller can exceed it), so no call exceeds 34 insert
  statements. Inserts check the target with `requireReadableCollection` before the batch; the window between that check and the batch is
  the same count-then-write race `createPlace` accepts.
- Every read keyed by an id list is chunked the same way (source rows, the label-ownership check, the trip-place membership check, the
  provenance trip-name lookup, `loadPlaceListsFn`); place counts per trip are a grouped aggregate, not an `IN`.
- `addLabelToPlaces` first reads each selected place's label count and refuses the whole call when any place would pass `MAX_LABELS_PER_PLACE` (16, imported from `src/lib/collections/labels.ts`, the change-a-collection spec's constant; closed message `bulk.labelFull`), then inserts with `onConflictDoNothing` (the primary key is `(collection_place_id, label_id)`) and checks that the label
  belongs to the collection of **every** selected place.

### Server functions (`src/routes/_app/-server/collections.ts`)

All `z.strictObject()` with the `error` parameter, all resolved through `appScope()`, all `POST` except the loads. Ids are `idSchema`.
Every bulk array is bounded (`.max(MAX_BULK_PLACES)`); copy targets at `MAX_COPY_TARGETS = 10`. Components receive the functions as
**props from the route file**; a component directory never imports a route's `-server/` folder (`src/components/console/index.ts`
states the seam). The boundary schemas are not `addCollectionPlaceInput` and `updateCollectionPlaceInput`: they omit `source`,
`externalId` and `sortOrder`, so provenance cannot be forged.

| Function (ticket)                   | Input                                                                                                                 | Behaviour                                                                                                                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadSharingFn` (a, `GET`)          | `{ collectionId }`                                                                                                    | `{ visibility: 'private' \| 'organization', isOwner, othersPlaces }`; `othersPlaces` counts places whose `saved_by` is not the owner. A stored `public` returns `organization`.                                                                                              |
| `setCollectionSharingFn` (a)        | `{ collectionId, visibility: 'private' \| 'organization' }`                                                           | Owner only. The schema accepts nothing else.                                                                                                                                                                                                                                 |
| `addPlaceFn` (b)                    | `{ collectionId, name, city?, countryCode?, address?, website?, phone?, notes?, priceMinor?, currency?, lat?, lng? }` | Position is both or neither (a Zod `superRefine`, the planner's rule). Quota asserted for one row. Returns the created `SavedPlaceRow` (the sheet opens from it).                                                                                                            |
| `updatePlaceFn` (b)                 | the same fields plus `collectionPlaceId`, all optional but the id                                                     | Same pair rule; a blank string clears an optional field. Status stays on the change-a-collection function.                                                                                                                                                                   |
| `deletePlaceFn` (b)                 | `{ collectionPlaceId }`                                                                                               | The guard lives in `deleteCollectionPlace` itself (`requireOwnedCollection`); writes `collection.places_removed` (count 1).                                                                                                                                                  |
| `loadTripOptionsFn` (c, `GET`)      | `{}`                                                                                                                  | The trips the caller may read (`readableTrips`), newest first, each with its place count (a grouped aggregate, not an `IN`; `listTripOptions`); bounded at 100.                                                                                                              |
| `loadTripPlacesFn` (c, `GET`)       | `{ tripId, collectionId }`                                                                                            | Delegates to `listTripPlacesForSaving`, which resolves `requireReadableCollection` and then `requireTrip` itself, before any lookup. The trip's places (bounded at 500, `listTripPlacesForSaving`) each marked `alreadySaved` by the duplicate rule against the collection.  |
| `addFromTripFn` (c)                 | `{ collectionId, tripId, placeIds: idSchema[] (max 100) }`                                                            | `requireReadableCollection`, `requireTrip(tripId)`, then every place must belong to that trip; one batch; returns `{ added, skipped }`.                                                                                                                                      |
| `loadPlaceListsFn` (c, `GET`)       | `{ collectionPlaceId }`                                                                                               | `listPlaceLists` resolves the source place through `inReadableCollection` itself; the collections the caller can read (bounded at 50, `listPlaceLists`), each with `alreadyIn` by the duplicate rule via the prefilter on the one place, and the collection the place is in. |
| `savePlaceToCollectionsFn` (c)      | `{ collectionPlaceId, collectionIds: idSchema[] (max 10) }`                                                           | Calls `copyPlacesToCollections` with one source id; returns `{ added, skipped }`.                                                                                                                                                                                            |
| `loadCollectionPlacesFn` (d, `GET`) | `{ collectionId, status?, labels?, cursor? }`                                                                         | `requireReadableCollection` first, then one page of 48 and the next cursor, same predicate as the loader; `labels` is `.max(MAX_LABELS_PER_COLLECTION)` (30); returns `people` beside `places`. Called by "Show more".                                                       |
| `setPlacesStatusFn` (e)             | `{ collectionPlaceIds: idSchema[] (max 100), status }`                                                                | One chunked `UPDATE ... WHERE id IN (...)` batch.                                                                                                                                                                                                                            |
| `addLabelToPlacesFn` (e)            | `{ collectionPlaceIds: idSchema[] (max 100), labelId }`                                                               | See above.                                                                                                                                                                                                                                                                   |
| `copyPlacesFn` (e)                  | `{ collectionPlaceIds: idSchema[] (max 100), collectionIds: idSchema[] (max 10) }`                                    | `copyPlacesToCollections`; returns `{ added, skipped }` summed over the collections. A Zod `superRefine` refuses `ids x targets > 100`.                                                                                                                                      |
| `deletePlacesFn` (e)                | `{ collectionPlaceIds: idSchema[] (max 100) }`                                                                        | Every distinct collection of the ids is resolved with `requireOwnedCollection` before any row is removed, inside `deleteCollectionPlaces`; the function then calls `trail()` once per distinct collection with `collection.places_removed` and `metadata: { count }`.        |

**Resolution order for every two-sided call** (a source and a target): read the source rows by id inside the tenant, resolve each
distinct source collection with `requireReadableCollection`, resolve the target collection, and for a trip source `requireTrip(place.tripId)`;
only then count, check the quota and write. A trip place from a private trip the caller cannot read is a `NotFoundError`.

Money stays integer minor units plus a `text(3)` currency; no float amount appears anywhere in this stage.

### Paging, pins and one predicate (ticket 08-S9d, Resolved assumption 13)

- `collectionPlaceFilter(scope, { collectionId, status?, labelIds? })` is the **one exported predicate**, and it contains `inReadableCollection(scope, collectionPlaces.collectionId)` beside the tenant and collection bindings. Statuses are one value (the screen
  keeps the single `status` of the change-a-collection spec; Resolved assumption 5). Labels are any-of as a correlated `EXISTS` over
  `collection_place_labels` (the `memberTripIds` sub-select is the precedent), **not** a materialised id list, so the filter has no
  parameter ceiling beyond its own input, which is `.max(MAX_LABELS_PER_COLLECTION)` (30, from `labels.ts`).
- `listCollectionPlacesFiltered(scope, input)` resolves `requireReadableCollection` first - unlike its sibling `listCollectionPlaces`,
  which answers a foreign or unreadable id with `[]` - because a paged read must be able to say "no such list" rather than "this list is
  empty", the caller pages until told to stop. Order is `sort_order asc, id desc` (unchanged, so no existing list reorders; ids are
  time-sortable, so ties on the default `0` are newest first); the keyset condition is
  `sort_order >= s AND (sort_order > s OR id < i)`; the `sort_order` range is served by `collection_places_collection_sort_idx` `(collection_id, sort_order)`; the `id` tie-break is a filter
  and partial sort inside one collection, which the realistic size accepts, so no index is added. Page size 48.
- `listCollectionPins(scope, input)` calls `requireReadableCollection` first, uses the same predicate and returns `{ pins, total, unmapped }`: `pins` is `id, name, lat, lng,
status` for matches **with** a position, in list order, capped at `MAX_PINS = 1000`; `total` is the match count; `unmapped` is how many
  matches have no position. When `pins.length < total - unmapped` the map says so ("Showing the first {count} pins").
- The route's `loaderDeps` takes `status` and `labels`; the loader returns the first page, the pins and `canManage`. A filter change
  re-runs it, so the list and the map cannot disagree. The cursor stays out of the URL; "Show more" appends to client state.
- Label links for a page are read for **at most 48 ids** in one statement; the whole-list read in `listCollectionPlacesWithLabels` is
  replaced (this ticket) or, where another caller remains, chunked at 80 (08-S9b).
- The client-side narrowing predicate of the change-a-collection spec (`filters.ts`) is deleted, or reduced to the thin parse of the
  search; one implementation of the predicate may exist.

### Alternatives considered, and why they lost

- **A per-list member table with viewer, editor and admin roles (the reference row's reading).** No entity exists, no migration is
  planned, and the workspace already administers roles; a second rank system nobody administers is the wrong answer even with a migration.
  The row's three roles map onto the list's owner and the caller's workspace role (Resolved assumption 4).
- **Offering `public`.** It needs a token column and a route that serves it without a session. Deferred (Blockers); the picker offers
  the two values that are enforceable.
- **A client-side filter only (as the change-a-collection spec has).** Fine for a short list; this stage lets a list grow to the plan's
  ceiling, and a map that must show all pins needs a second read anyway.
- **One read returning the whole filtered list.** Simple, but a pro workspace may hold 20000 saved places.
- **A paged list with a map of the loaded page only.** The map would change as the traveller scrolls and could not show where the
  places are.
- **A shared `Collection` handle like `readableTrips`.** A set of filter functions is what the journal module already does for the same
  problem; a handle is a larger surface than five call sites need.
- **A `copyPlacesToTrip` in the bulk bar.** Another plan owns the direction (Problem Statement, Resolved assumption 3).
- **Optimistic bulk writes with rollback.** The loader re-read after a write is one cheap round trip; a bulk write is all-or-nothing, so
  there is no partial state to roll back to.
- **Letting any member remove a place.** A removal cannot be undone; `rejected` is the reversible equivalent.

## 📝 Architecture

- **Owner module of each new concept (`docs/SPEC.md` §8):** who may read, manage and share a collection, the stranded count, the
  duplicate lookup and the bulk writers -> `src/server/repos/collections.ts` (all SQL); the saved-place count and quota assertion ->
  `src/server/repos/saved-places.ts`; the fold and the duplicate key -> `src/lib/collections/dedupe.ts` (pure, no I/O); the write
  boundary and its Zod -> `src/routes/_app/-server/collections.ts`; the filter predicate -> `collectionPlaceFilter` in the repository;
  presentation -> `src/components/collections/`; selection state -> `src/components/collections/selection.ts` (pure).
- `components/ui` is untouched and still never fetches or imports from `server/`. Nothing enqueues; no Durable Object, no KV, no realtime
  patch (a collection has no room; the list screen re-reads through the router after a write).
- **Status names keep exactly one list** (`COLLECTION_PLACE_STATUSES`); the bulk status control reads it and the existing status
  message keys, not a third copy.
- **`src/server/repos/places.ts` is imported, never edited.** `saved-places.ts` reads the `places` table directly with `tenantFilter`
  for the count, imports no repository, and so introduces no import cycle.
- Tests: server-function tests are `.test.ts` under `src/routes/**` (the `server` project) on the pattern the change-a-collection spec
  records: everything that returns a result is an exported plain function the test calls, the `createServerFn` wrappers stay thin, the
  test installs the Start `AsyncLocalStorage` and mocks `../context`. A server module that reaches `cloudflare:workers` cannot load in
  that project; this one does not.

## 📝 Data Model

**No schema change, and none is filed.** `collection_places` already carries the full denormalised place - `name`, `description`,
`notes`, `lat`/`lng` with their CHECK, `address`, `city`, `country_code`, `website`, `phone`, `image_url`, `price_minor` with a
`text(3)` currency, `category_id`, `status` behind `collection_places_status_chk`, `source`, `external_id`, `source_trip_id`,
`source_place_id`, `saved_by` and a `real` `sort_order`. The denormalisation is the feature: a saved place survives the trip it came
from being deleted. `collection_place_labels` is the join. `collections.visibility` keeps its three-value CHECK; the stage writes only
two of them.

Index honesty, so nothing is read as a safety argument: `collection_places` is led by `organization_id` in
`collection_places_org_collection_idx`, but `collection_places_collection_sort_idx` leads with `collection_id` (the keyset page uses
it), and `collection_place_labels` carries `organization_id` as a single-column index while its own composite is the primary key
`(collection_place_id, label_id)`, which carries no tenant column. The safety argument is the tenant filter and the insert stamp (and, in
the bulk builders, the hand-stamped `organization_id`), never an index. This stage adds none.

## 📝 API Contracts

The server functions of the table above, and these shapes:

```ts
type Sharing = 'private' | 'organization'

interface SharingSummary {
  readonly visibility: Sharing
  readonly isOwner: boolean
  /** Places in the list saved by somebody other than its owner. */
  readonly othersPlaces: number
}

/** Returned by every function that writes places in bulk. */
interface CopyResult {
  readonly added: number
  /** Already in the target (the duplicate rule), not an error. */
  readonly skipped: number
}

interface SavedPlaceRow {
  // existing fields unchanged, plus:
  readonly lat: number | null
  readonly lng: number | null
  readonly notes: string | null
  readonly phone: string | null
  readonly provenance: {
    readonly tripName: string | null
    readonly tripStartDate: string | null
  } | null // null when the place was not saved from a trip
}

interface CollectionDetailPayload {
  // existing fields unchanged, plus:
  readonly canManage: boolean // from the change-a-collection spec
  readonly sharing: Sharing
  readonly isOwner: boolean
  readonly ownerName: string | null
  readonly page: {
    readonly places: ReadonlyArray<SavedPlaceRow>
    readonly next: string | null
  }
  readonly pins: {
    readonly items: ReadonlyArray<{
      id: string
      name: string
      lat: number
      lng: number
      status: string
    }>
    readonly total: number
    readonly unmapped: number
  }
}

// search of /collections/$collectionId: `status?` (one of the five) and `labels?` (the change-a-collection contract); no cursor.
```

**Counts, people and the old `places` field.** The loader stops returning the full `places` array: `page.places` replaces it, and the only consumer is the route, an internal server-function result that ships in the same deploy as the route (a browser tab that loaded the previous bundle still calls the new Worker, which BACKWARD_COMPATIBILITY.md surface 2 treats as a caller, so the payload keeps `places` equal to `page.places` for one release as a deprecated alias and a follow-up removes it; the route and its test move to `page` in 08-S9d). `collection.placeCount` and `byStatus` stay on the payload, computed by one unfiltered `GROUP BY status` aggregate whose sum is the total, so the header, the "All" chip and the status chips show the collection's true size at any page or filter. `people` (the savers' names) is derived from the `saved_by` ids of the page's rows and `loadCollectionPlacesFn` returns it beside `places`, so "Show more" merges new savers into the list. Between 08-S9b and 08-S9d the loader still returns every place as it does today (08-S9d is ordered right after 08-S9c to bound it).

`provenance.tripName` is the name of the source trip **only when the caller may read that trip** (`readableTrips`); a deleted trip
(`source_trip_id` is `NULL` after `ON DELETE SET NULL`) or one the caller cannot read gives `{ tripName: null }` and the sheet says
"Saved from a trip". A private trip's name never reaches a member who is not on it. `tripStartDate` follows the same rule and is `null` for an undated trip (`sheet.provenance.noDate`).

## 📝 UI/UX

Reused, not rebuilt: `Sheet`, `Dialog`, `Popover`, `DropdownMenu`, `Checkbox`, `Combobox`, `Button`, `IconButton`, `Chip`, `Badge`, `Card`,
`EmptyState`, `Skeleton`, `Alert`, `Toast`, `ScrollArea`, `Field`, `Input`, `Textarea`, the map setup in `src/components/map` and
`src/lib/map`, the `FilterBar` from `-ui/scaffold.tsx`, the change-a-collection spec's status picker and label controls, and
`parsePosition` / `formatCoordinate` from `src/lib/geo/position.ts` (the planner's place form pastes a position into either field and
fills both; this form does the same and copies no parser) and `parseMoney` (`src/lib/money.ts`) for the price, so "12,50" works in
every locale. `Pagination` is a numbered control and is **not** used; paging is "Show more". User-facing text calls the thing a
**collection**, as every existing surface does (`newCollection.*`, "Delete collection", "Labels in this collection"); "list" appears
in this spec's prose only.

### Rules every control in this stage follows

1. **A control that is writing keeps focus.** It renders `aria-disabled="true"` and `aria-busy="true"`, ignores activation in its
   handler and shows a `Spinner` through `icon` with an `sr-only` `common.saving`, as `Button`'s loading branch does (`button.tsx:214-233`). This stage keeps its explicit spinner recipe; `Button`'s `loading` prop now also retains focus and blocks activation (#938). This covers the sharing Save, the add and
   edit Save, "Add {count} places", `SaveToCollection` Save, every bulk action and "Show more".
2. **One polite live region** (`role="status"` with an explicit `aria-live="polite"`, `sr-only`; Radix's `hideOthers` leaves only `[aria-live]` elements uncovered, so without it the region is hidden whenever a sheet or dialog is open) is mounted with the page, outside every dialog, sheet and the bar, so
   unmounting a surface never swallows its announcement. It carries every success sentence: place added, changes saved, place removed,
   sharing updated, the save-to-collections result, the from-a-trip result, the bulk result, "Show more", and the new count when a filter
   change prunes the selection. Repeated identical text uses the two-slot pattern of
   `src/components/atlas/countries-list.tsx:786-796`, so copying the same set twice is heard twice. Failures are `Alert tone="danger"`
   (`role="alert"`). The quota alert renders `role="alert"` with `aria-live="assertive"` (`Alert` writes `aria-live="polite"` for the non-danger tones, which would override the role; the neutral tone is `role="status"` by default; `Alert` lets a caller
   override the role).
3. **Where focus goes when its opener is gone** (the `Sheet` restore does nothing when the opener has left the DOM,
   `src/components/ui/sheet.tsx:186`):
   - after removing a place from the sheet, and after a successful bulk remove: the open button of the next card, else the previous
     card, else the "Add a place" header action;
   - edit: the Name field; Save or Cancel: the Edit button;
   - `FromTripDialog` step two: its heading (`tabIndex={-1}`); Back: the chosen trip's row;
   - "Show more": the open button of the first appended card;
   - after an add: the new place's sheet opens (see below) and closing it returns to the "Add a place" trigger;
   - a bulk-bar `Escape` clears the selection only when focus is inside the bar and no menu, popover or dialog opened from it is
     open; focus then goes to the checkbox toggled last.
     The browser spec asserts that `document.activeElement` is never `<body>` after any write, close, step change or "Show more".
4. **Rows that cannot be chosen are `aria-disabled`, not `disabled`.** Trips with no places, "Already in this collection", "Already
   saved" and unchecked boxes at a cap stay focusable, carry their reason in `aria-describedby`, ignore activation in
   `onCheckedChange` (Radix `Checkbox` does not honour `aria-disabled`), and have a visible inactive style keyed on `aria-disabled`
   (`Checkbox` styles only `:disabled`, `checkbox.tsx:41`).
5. **Targets.** Every checkbox has a hit area of at least 24x24 CSS px (the `md` box is 20px, `checkbox.tsx:9`), using a wrapping label
   as `CheckboxField` does; a card's select checkbox has no visible text, so its label is itself at least 24x24 CSS px (`min-size-6`) (WCAG 2.5.8).
6. **Failed is not the same as unconfirmed.** A failure the server reported (an envelope came back) says "Nothing was changed". A
   transport failure with no envelope cannot say that: the surface re-reads the collection first and then shows its `*.unconfirmed`
   sentence ("We could not confirm this was saved. Check the collection before trying again."), and never claims nothing changed.
   Retrying a bulk remove whose rows are already gone ends in a re-read and the removed sentence, not a second failure.
7. **Unsaved work is guarded.** While the add form or the sheet's edit mode is dirty, `Escape`, the close button and a tap outside ask (`discard.title`, `discard.confirm`, `discard.keep`) and close at once when nothing changed; the sheet is `dismissible={false}` while dirty, so a drag cannot close it; a route `useBlocker` with `enableBeforeUnload` asks the same way for the browser or Android back gesture, a navigation and a refresh. `FromTripDialog` does the same once anything is ticked, and Back keeps each trip's ticks until the dialog closes. A failed save keeps the values, and so does an unconfirmed one: the surface stays open with the entries while it re-reads.
8. **Reads in dialogs have designed states.** `loadSharingFn`, `loadTripOptionsFn`, `loadTripPlacesFn` and `loadPlaceListsFn` each show a
   `Skeleton` while loading and an `Alert` with "Try again" on failure (`sharing.loadFailed`; `fromTrip.loadFailed` for the trips and `fromTrip.placesLoadFailed` for one trip's places; `saveTo.loadFailed`); the dialog stays open.
9. **Phones.** `AddPlaceDialog` is full height below 640px like the sheet; its footer stays above the on-screen keyboard and the
   focused field scrolls into view. The bulk bar sits above the mobile tab bar (offset `BOTTOM_CLEARANCE_CSS`), and while it is shown
   its height is added to the document `scroll-padding-bottom` (`src/styles/styles.css:1046`) so a focused card is never scrolled
   under it (WCAG 2.4.11); cards carry the `scroll-mt-*` the sticky top navigation needs.

### Sharing (08-S9a)

- The header shows the owner's name ("Owner: {name}", or "Owner: a former member" once they have left the workspace, `page.ownerLeft`) and the collection's audience: a button for the owner, plain text for everyone
  else - "Everyone in this workspace" or "Only you". The button is named by its visible text (WCAG 2.5.3); `sharing.button` is its
  `aria-describedby`, never its `aria-label`. For a member there is no disabled control: nothing is offered.
- The button opens the **sharing dialog**: two radios, each with its consequence written out ("Only you - nobody else in this
  workspace can see this collection or its places", "Everyone in this workspace - members can view the collection and add, edit and
  label places; the owner or an admin can remove them"), the current setting, and one line naming who may remove places. A stored
  `public` collection is shown as "Everyone in this workspace".
- Choosing "Only you" on a collection that holds places saved by others shows a `warning` `Alert` with the count ("{count} places saved
  by other people will stop being visible to them. Switching back shows them again.") before the Save button; while it is shown it is
  in the Save button's `aria-describedby`. The warning is a `role="status"` element mounted when needed, and Tab from the radios to
  Save would otherwise skip it.
- The dialog uses an explicit **Save** (a write on choosing would save on every arrow press, WCAG 3.2.2). A failed save keeps the
  dialog open with the old selection and an inline alert; success closes it, announces `sharing.saved` and updates the header through
  the router.
- No third option, for the reason under Alternatives. The index card shows an "Only you" `Badge` (outline) on a private collection and
  nothing on a shared one; its text is `sharing.onlyYou`, and a contrast check of the outline badge in both themes is part of the
  evidence.

### Add and read a place (08-S9b)

- **Empty state.** Its body names only the paths that exist when the ticket merges: ticket b says "Add a place yourself." (`empty.body`);
  ticket c rewrites the value of the same key to "Add a place yourself, or add places from one of your trips." in all 23 locales, so the b text is never a promise c has not kept and no key is left unread (`coverage.test.ts`). The map and recommendation promises are **removed**. No control is stubbed for search;
  a disabled control with no explanation is worse than none. An "Add a place" `Button` is in the page header actions for anyone who
  can write, and in the empty state.
- **`AddPlaceDialog` / `PlaceForm`.** Fields: name (required), city, country (`Combobox` of country names, stored as the ISO code;
  matching also accepts the ISO code, because the frozen name table is English only - `src/lib/atlas/country-names.ts`), address,
  website, phone, notes, price and currency, and **latitude and longitude**. The position pair is labelled as the fallback it is
  ("Position (optional)" with "Paste a position from a map: both fields fill"), validated as a pair (both or neither) in the form and
  again in the server function. Every field error has its own message (required name, name too long, invalid price, a price without
  a currency, invalid website, latitude or longitude out of range, the pair rule); none degrades to "We could not save this place".
- **After an add** the dialog closes, `add.saved` is announced and the **new place's sheet opens** from the row the server returned
  (a new place sorts to the end and is often not on the first page of 48, so without this the traveller sees nothing and adds it
  twice). A failed save keeps the values.
- **`PlaceSheet`** (`Sheet`): the place's name in the card's `h2` is the `button` that opens it (`data-part="collection-place-open"`). The card has no click handler of its own: the button's hit area is stretched over the whole card with a pseudo-element (`after:absolute after:inset-0`), and the checkbox and the website link sit above it (`relative z-*`), never inside it, so a tap on the photo, the location or the price opens the sheet. The sheet reads the place closely - image,
  address, city and country with the flag the screen already renders, price with `tabular-nums`, website and phone as real links,
  notes, labels, the status picker (the change-a-collection control, one write path), who saved it, and the provenance line ("Saved
  from Kyoto, March 2026" - the trip's start month through the frozen locale month table, `docs/SPEC.md` §9 rule 5; "Saved from
  Kyoto" for a trip without dates; "Saved from a trip" when the source trip is deleted or not readable). Editing happens in the
  sheet ("Edit" turns the body into the `PlaceForm`). "Save to other collections" is the `SaveToCollection` control (08-S9c).
  "Remove" is shown only when `canManage`, confirms and names the place; anyone else sees a line explaining the missing button
  ("Only {owner} or an admin can remove places.", or "Only an admin can remove places." once the owner has left, `sheet.removeHintAdminOnly`). `Escape` closes the sheet (subject to the discard guard) and returns focus to the
  card that opened it.
- **Quota refusal.** A designed `Alert` (`role="alert"`) inside the dialog or sheet showing the planner's existing sentence and "See
  plans" link (`trips.plan.addPlace.quota` and `trips.plan.addPlace.quotaAction`, read from the trips catalogue - one refusal from
  the same ceiling, one wording). The link opens in a new tab so the draft survives and says so to a screen reader (`quota.newTab`, hidden text after the link). It does not name
  the ceiling or the plan (Resolved assumption 14). In the `SaveToCollection` popover the alert sits above its footer; in the bulk bar
  it opens as a dialog-level `Alert` above the bar, never inside the sticky strip.

### From a trip, and save to several collections (08-S9c)

- **`FromTripDialog`** (`Dialog`, two steps): step one lists the trips the caller can read with their place counts (a trip with no
  places is listed, `aria-disabled`, with its reason). Step two ("Choose places from {trip}") lists that trip's places, each a
  `Checkbox`; the ones already in the collection are unchecked and `aria-disabled` with "Already in this collection". At 100 ticked,
  the remaining boxes become `aria-disabled` described by "{count} selected - the most you can add at once"; with none ticked the add
  button is `aria-disabled`. The footer states how many will be added (`fromTrip.footer`) and the button carries the same number (`tabular-nums`); with none ticked the button reads "Add places" (`fromTrip.addNone`) and is `aria-disabled`, described by `fromTrip.noneTicked`. The
  result is announced ("{count} places added" and, when some were skipped, "{count} were already there"). Back returns to step one.
- **`SaveToCollection`**: a list of the collections the caller can read (the one the place is in is excluded), each a `Checkbox`; one
  that already holds the place is checked and `aria-disabled` with "Already saved" rather than offered twice. At most
  `min(10, floor(100 / n))` can be chosen for `n` places (the server enforces `ids x targets <= 100`, below); beyond that the rest
  are `aria-disabled` described by "You can choose up to {count} collections." It takes the collections and an
  `onSave(collectionIds)` callback and knows nothing about where it was rendered, so a trip screen can mount it later without
  rework; **nothing else is built for that case now** (a follow-up is filed, Risks). The result is announced ("Saved to {count}
  collections").

### Narrow and map (08-S9d)

- **Layout.** At 1280px and above the list and the map sit side by side with the list holding its measure; at 360px the map is a
  collapsible strip above the list (a `Button` named "Map" with `aria-expanded`, collapsed by default on small screens) and the sheet
  is full height.
- **`CollectionMap`.** The pins of `listCollectionPins`, through `MapCanvas` and the existing marker components. Pins stay `PlacePin`
  buttons with `tabIndex={-1}`: the list is the keyboard path, because each card's open button does what its pin does, and the list
  is also the single-pointer alternative to panning (WCAG 2.5.7). The map region is named `map.label`. Selecting a pin opens the
  sheet, selecting a card highlights the pin, from one reducer; it publishes the `[data-map-ready]` marker every map wrapper
  publishes. A pin's accessible name is `map.pin` ("{name}, {status}"); the status is also a cue that is not colour (a status-glyph prop that `PlacePin` gains in `src/components/map/pins.tsx`, positioned with logical inset classes; it draws only a day badge and a `visited` check today), because ring colour alone never carries status (WCAG 1.4.1).
- **States.** _Empty map:_ when no match has a position the map is not rendered and a line says how many places have none, with a
  link that opens the first one's sheet in edit mode ("Add a position to {name}"). _Some unmapped:_ "{count} places are not on the
  map." _Skeleton:_ `CardsSkeleton` for the list and a placeholder at the settled map height so the two columns do not resize each
  other. _Filtered to nothing:_ the existing state with its reset action and the hidden count. _Truncated pins:_ the "Showing the
  first {count} pins" note. _Error:_ the pins arrive with the loader, so a failed pins read is the route's `errorComponent` (there is
  no separate pins function); a failed "Show more" is an inline `Alert` with "Try again" that keeps what is on screen. After a write
  the router re-runs the loader: the appended pages reset to the fresh first page and the selection is pruned to what is still there.
- **Show more** is a `Button` below the list; while it loads it is `aria-disabled` and `aria-busy` (rule 1); it appends and announces
  "{count} more places loaded".

### Act on a selection (08-S9e)

- **Selection.** Each card has a `Checkbox` named after the place (`bulk.select`, `data-part="collection-place-select"`) beside the
  open button. Selection is an id set over the loaded places, capped at `MAX_BULK_PLACES`; at the cap the unchecked boxes are
  `aria-disabled` and described by "{count} selected - the most you can act on at once". A filter change prunes the selection to what
  is still visible, and a destructive action acts only on rows currently visible **and** selected.
- **`BulkBar`.** A region named "Selected places" that appears when the selection is not empty: the count, then four actions - set
  status (menu of the five), add label (menu of the collection's labels; `bulk.noLabels` when there are none), copy to other collections (the `SaveToCollection` control in
  a popover) and remove (only when `canManage`). Remove confirms and names the count. The bar is `position: sticky` at the bottom on
  small screens (above the tab bar, rule 9) and inline on large, reserves its own height, and never covers the last row.
- **Outcome.** Every bulk action is all-or-nothing. Success announces its own sentence ("{count} places removed", "{count} places set
  to {status}", "{label} added to {count} places", or the copy result); a status change that takes selected rows out of the active
  filter also says so ("{count} places no longer match this filter"). A server-reported failure names the action and says **nothing was changed** (`bulk.removeFailed`, `bulk.statusFailed`, `bulk.labelFailed`; a copy uses `copy.failed`, and its transport failure `copy.unconfirmed`) and
  offers "Try again" for the whole action; a transport failure follows rule 6. The selection is kept on a failure and on a status or
  label change; **removed ids leave the selection**. While a write is in flight the button follows rule 1 and the selected rows are
  `aria-busy`.

### Motion and tokens

The place sheet's transition is at most 260ms on `--ease-drawer`: `vaul` defaults to 500ms (`node_modules/vaul/dist/index.mjs:438`),
over the product's 400ms ceiling (`docs/SPEC.md` §2). If `Sheet` cannot be overridden without editing `src/components/ui`, which this
stage does not touch, the ticket records the gap and files one follow-up for every `Sheet`. The bulk bar enters on 200ms opacity and
8px translate on `--ease-out-quint`; cards stagger 20ms, capped at eight. `prefers-reduced-motion: reduce` collapses all of it to
opacity (the global rule at `src/styles/styles.css:1213`). Spacing from `--space-*`; every price and every count carries
`tabular-nums`. **No token is missing.** Logical properties throughout (right-to-left).

## 📝 Visual change expected

`/collections/$collectionId`, light and dark, 360x800, 1280x900 and 2560x1440:

- 08-S9a: the header audience and owner (owner and member), the sharing dialog (both choices, the warning with a count, loading, saving,
  failed), the screen as a member who cannot read a private collection (the not-found panel).
- 08-S9b: the empty state with its one new action, the add dialog (empty, with a position, each field error, the quota alert, the
  discard prompt), the place sheet (full, sparse, provenance readable, undated and unreadable, editing, remove confirmation, the
  "only the owner or an admin can remove" line for a member).
- 08-S9c: the from-a-trip dialog (both steps, loading and error, an already-saved row, the cap, the footer count), the
  save-to-collections popover (including the cap line and the quota alert).
- 08-S9d: the side-by-side list and map, the map strip collapsed and open at 360px, the empty-map line, the unmapped note, the
  truncated-pins note, the list with "Show more" and with its inline error, filtered to nothing.
- 08-S9e: two cards selected with the bar, the cap message, the remove confirmation, a failed action, and 360px with a focused card
  scrolled to the bar's edge.
- `/collections` (the index): an "Only you" chip on a private collection's card; nothing else changes.

## 📝 Copy

All new keys go to `src/lib/i18n/messages/en/modules.ts`, written **without** the `modules.` prefix and read as `modules.collections.*`,
and land in all 23 locales in the same change (`i18n-messages` skill). Every plural key (p) varies on `{count}` only (`resolveMessage`
picks a plural form from `count` alone; other placeholders such as `{status}` are plain), carries every category each locale needs and
writes its `one` form with `{count}` too. The keys below are the **full set**; each is read by a component of this stage, and a key
lands with the first component that reads it. No string is hard-coded: the parity test, `coverage.test.ts` and
`src/components/collections/__tests__/copy-rules.test.ts` (created by the change-a-collection spec; its file list gains every new
component) stay green. Keys the change-a-collection spec defines (`status.*`, `filtered.*`, `card.*`, `statusPicker.*`, `labels.*`,
`edit.*`, `delete.*`) are reused, not redefined (`empty.body` apart: this stage rewrites its value). The quota alert reads the planner's `trips.plan.addPlace.quota` and
`trips.plan.addPlace.quotaAction`, not new keys. Ticket b rewrites the value of `empty.body`, which the change-a-collection spec moves into the catalogue with the old map-and-recommendation promise, in all 23 locales; ticket c rewrites it again.

| Key (en)                                                                                            | Text                                                                                                            | Ticket |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| `common.retry`                                                                                      | Try again                                                                                                       | a      |
| `common.cancel`                                                                                     | Cancel                                                                                                          | a      |
| `common.back`                                                                                       | Back                                                                                                            | a      |
| `common.saving`                                                                                     | Saving                                                                                                          | a      |
| `discard.title`                                                                                     | Discard your changes?                                                                                           | b      |
| `discard.confirm`                                                                                   | Discard                                                                                                         | b      |
| `discard.keep`                                                                                      | Keep editing                                                                                                    | b      |
| `sharing.everyone`                                                                                  | Everyone in this workspace                                                                                      | a      |
| `sharing.onlyYou`                                                                                   | Only you                                                                                                        | a      |
| `sharing.button`                                                                                    | Change who can see this collection                                                                              | a      |
| `sharing.title`                                                                                     | Who can see this collection                                                                                     | a      |
| `sharing.everyone.body`                                                                             | Members can view the collection and add, edit and label places. The owner or an admin can remove them.          | a      |
| `sharing.onlyYou.body`                                                                              | Nobody else in this workspace can see this collection or its places.                                            | a      |
| `sharing.removers`                                                                                  | Only the owner or an admin can remove places or delete the collection.                                          | a      |
| `sharing.warning` (p)                                                                               | {count} places saved by other people will stop being visible to them. Switching back shows them again.          | a      |
| `sharing.save`                                                                                      | Save                                                                                                            | a      |
| `sharing.saved`                                                                                     | Sharing updated.                                                                                                | a      |
| `sharing.failed`                                                                                    | We could not change who can see this collection. Nothing was changed.                                           | a      |
| `sharing.unconfirmed`                                                                               | We could not confirm this was saved. Check the collection before trying again.                                  | a      |
| `sharing.loadFailed`                                                                                | We could not load the sharing settings.                                                                         | a      |
| `page.owner`                                                                                        | Owner: {name}                                                                                                   | a      |
| `page.ownerLeft`                                                                                    | Owner: a former member                                                                                          | a      |
| `add.button`                                                                                        | Add a place                                                                                                     | b      |
| `add.title`                                                                                         | Add a place                                                                                                     | b      |
| `add.name` / `add.city` / `add.country` / `add.address` / `add.website` / `add.phone` / `add.notes` | Name / City / Country / Address / Website / Phone / Notes                                                       | b      |
| `add.price` / `add.currency`                                                                        | Price / Currency                                                                                                | b      |
| `add.position`                                                                                      | Position (optional)                                                                                             | b      |
| `add.position.hint`                                                                                 | Paste a position from a map: both fields fill.                                                                  | b      |
| `add.latitude` / `add.longitude`                                                                    | Latitude / Longitude                                                                                            | b      |
| `add.position.pair`                                                                                 | Enter both latitude and longitude, or leave both empty.                                                         | b      |
| `add.name.required`                                                                                 | Enter a name.                                                                                                   | b      |
| `add.name.tooLong` (p)                                                                              | Use {count} characters or fewer.                                                                                | b      |
| `add.price.invalid`                                                                                 | Enter a valid price.                                                                                            | b      |
| `add.currency.required`                                                                             | Choose a currency for this price.                                                                               | b      |
| `add.website.invalid`                                                                               | Enter a web address that starts with https://.                                                                  | b      |
| `add.latitude.range`                                                                                | Latitude must be between -90 and 90.                                                                            | b      |
| `add.longitude.range`                                                                               | Longitude must be between -180 and 180.                                                                         | b      |
| `add.save`                                                                                          | Save place                                                                                                      | b      |
| `add.saved`                                                                                         | {name} added to this collection.                                                                                | b      |
| `add.failed`                                                                                        | We could not save this place. Your entries are still here.                                                      | b      |
| `add.unconfirmed`                                                                                   | We could not confirm this place was saved. Check the collection before adding it again.                         | b      |
| `quota.newTab`                                                                                      | opens in a new tab                                                                                              | b      |
| `empty.body`                                                                                        | Add a place yourself. (b); "Add a place yourself, or add places from one of your trips." (c rewrites the value) | b / c  |
| `sheet.close`                                                                                       | Close                                                                                                           | b      |
| `sheet.edit`                                                                                        | Edit                                                                                                            | b      |
| `sheet.cancelEdit`                                                                                  | Cancel editing                                                                                                  | b      |
| `sheet.remove`                                                                                      | Remove place                                                                                                    | b      |
| `sheet.removeHint`                                                                                  | Only {owner} or an admin can remove places.                                                                     | b      |
| `sheet.removeHintAdminOnly`                                                                         | Only an admin can remove places.                                                                                | b      |
| `sheet.save`                                                                                        | Save changes                                                                                                    | b      |
| `sheet.notes`                                                                                       | Notes                                                                                                           | b      |
| `sheet.noNotes`                                                                                     | No notes yet                                                                                                    | b      |
| `sheet.phone` / `sheet.website`                                                                     | Phone / Website                                                                                                 | b      |
| `sheet.savedBy`                                                                                     | Saved by {name}                                                                                                 | b      |
| `sheet.provenance`                                                                                  | Saved from {trip}, {month}                                                                                      | b      |
| `sheet.provenance.noDate`                                                                           | Saved from {trip}                                                                                               | b      |
| `sheet.provenance.unknown`                                                                          | Saved from a trip                                                                                               | b      |
| `sheet.saved`                                                                                       | Changes saved.                                                                                                  | b      |
| `sheet.failed`                                                                                      | We could not save your changes. Your entries are still here.                                                    | b      |
| `sheet.unconfirmed`                                                                                 | We could not confirm your changes were saved. Check the place before trying again.                              | b      |
| `sheet.removeConfirm`                                                                               | Remove {name} from this collection? This cannot be undone.                                                      | b      |
| `sheet.removeConfirmButton`                                                                         | Remove                                                                                                          | b      |
| `sheet.removed`                                                                                     | {name} removed from this collection.                                                                            | b      |
| `sheet.removeFailed`                                                                                | We could not remove this place. Nothing was changed.                                                            | b      |
| `sheet.removeUnconfirmed`                                                                           | We could not confirm this place was removed. Check the collection.                                              | b      |
| `fromTrip.button`                                                                                   | Add from a trip                                                                                                 | c      |
| `fromTrip.title`                                                                                    | Add places from a trip                                                                                          | c      |
| `fromTrip.pickTrip`                                                                                 | Choose a trip                                                                                                   | c      |
| `fromTrip.pickPlaces`                                                                               | Choose places from {trip}                                                                                       | c      |
| `fromTrip.placeCount` (p)                                                                           | {count} places                                                                                                  | c      |
| `fromTrip.noPlaces`                                                                                 | This trip has no places yet.                                                                                    | c      |
| `fromTrip.noTrips`                                                                                  | You have no trips to copy from yet.                                                                             | c      |
| `fromTrip.already`                                                                                  | Already in this collection                                                                                      | c      |
| `fromTrip.cap` (p)                                                                                  | {count} selected - the most you can add at once.                                                                | c      |
| `fromTrip.add` (p)                                                                                  | Add {count} places                                                                                              | c      |
| `fromTrip.addNone`                                                                                  | Add places                                                                                                      | c      |
| `fromTrip.noneTicked`                                                                               | Tick at least one place to add.                                                                                 | c      |
| `fromTrip.truncated` (p)                                                                            | Showing the first {count}.                                                                                      | c      |
| `fromTrip.privateNote`                                                                              | {trip} is not visible to everyone in this workspace, so its notes and descriptions are not copied.              | c      |
| `fromTrip.footer` (p)                                                                               | {count} places will be added.                                                                                   | c      |
| `fromTrip.placesLoadFailed`                                                                         | We could not load the places in {trip}.                                                                         | c      |
| `fromTrip.loadFailed`                                                                               | We could not load your trips.                                                                                   | c      |
| `copy.added` (p)                                                                                    | {count} places added.                                                                                           | c      |
| `copy.skipped` (p)                                                                                  | {count} were already there.                                                                                     | c      |
| `copy.failed`                                                                                       | We could not copy these places. Nothing was changed.                                                            | c      |
| `copy.unconfirmed`                                                                                  | We could not confirm the places were copied. Check the collection before trying again.                          | c      |
| `saveTo.button`                                                                                     | Save to other collections                                                                                       | c      |
| `saveTo.title`                                                                                      | Save {name} to other collections                                                                                | c      |
| `saveTo.truncated` (p)                                                                              | Showing the first {count} collections.                                                                          | c      |
| `saveTo.titleMany` (p)                                                                              | Save {count} places to                                                                                          | c / e  |
| `saveTo.already`                                                                                    | Already saved                                                                                                   | c      |
| `saveTo.save`                                                                                       | Save                                                                                                            | c      |
| `saveTo.empty`                                                                                      | You have no other collections to save to.                                                                       | c      |
| `saveTo.cap` (p)                                                                                    | You can choose up to {count} collections.                                                                       | c      |
| `saveTo.result` (p)                                                                                 | Saved to {count} collections.                                                                                   | c      |
| `saveTo.loadFailed`                                                                                 | We could not load your collections.                                                                             | c      |
| `map.label`                                                                                         | Map of the places in this collection                                                                            | d      |
| `map.toggle`                                                                                        | Map                                                                                                             | d      |
| `map.pin`                                                                                           | {name}, {status}                                                                                                | d      |
| `map.empty` (p)                                                                                     | None of these {count} places has a position yet.                                                                | d      |
| `map.partial` (p)                                                                                   | {count} places are not on the map.                                                                              | d      |
| `map.fixFirst`                                                                                      | Add a position to {name}                                                                                        | d      |
| `map.truncated` (p)                                                                                 | Showing the first {count} pins.                                                                                 | d      |
| `list.showMore`                                                                                     | Show more                                                                                                       | d      |
| `list.loaded` (p)                                                                                   | {count} more places loaded.                                                                                     | d      |
| `list.loadFailed`                                                                                   | We could not load more places.                                                                                  | d      |
| `bulk.region`                                                                                       | Selected places                                                                                                 | e      |
| `bulk.selected` (p)                                                                                 | {count} selected                                                                                                | e      |
| `bulk.select`                                                                                       | Select {name}                                                                                                   | e      |
| `bulk.cap` (p)                                                                                      | {count} selected - the most you can act on at once.                                                             | e      |
| `bulk.status`                                                                                       | Set status                                                                                                      | e      |
| `bulk.label`                                                                                        | Add label                                                                                                       | e      |
| `bulk.noLabels`                                                                                     | No labels yet                                                                                                   | e      |
| `bulk.labelFull` (p)                                                                                | {count} places already have the most labels. Nothing was changed.                                               | e      |
| `bulk.copy`                                                                                         | Copy to other collections                                                                                       | e      |
| `bulk.remove`                                                                                       | Remove                                                                                                          | e      |
| `bulk.clear`                                                                                        | Clear selection                                                                                                 | e      |
| `bulk.removeConfirm` (p)                                                                            | Remove {count} places from this collection? This cannot be undone.                                              | e      |
| `bulk.removeConfirmButton`                                                                          | Remove                                                                                                          | e      |
| `bulk.removed` (p)                                                                                  | {count} places removed.                                                                                         | e      |
| `bulk.statusSet` (p)                                                                                | {count} places set to {status}.                                                                                 | e      |
| `bulk.labelAdded` (p)                                                                               | {label} added to {count} places.                                                                                | e      |
| `bulk.hiddenNow` (p)                                                                                | {count} places no longer match this filter.                                                                     | e      |
| `bulk.removeFailed`                                                                                 | We could not remove these places. Nothing was changed. You can try again.                                       | e      |
| `bulk.statusFailed`                                                                                 | We could not change the status. Nothing was changed. You can try again.                                         | e      |
| `bulk.labelFailed`                                                                                  | We could not add the label. Nothing was changed. You can try again.                                             | e      |
| `bulk.unconfirmed`                                                                                  | We could not confirm the result. Check the collection before trying again.                                      | e      |

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                                                               | Behaviour                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A member opens, lists, counts, pins or writes into another member's `private` list by id                                           | `NotFoundError` from every reader and every writer, admins included; the country aggregate, the duplicate lookups and the index counts leave the list out                                              |
| A stored `public` row                                                                                                              | Reads and writes as `organization`; the dialog shows "Everyone in this workspace"                                                                                                                      |
| An unknown `visibility` value                                                                                                      | Denied: the predicate is `visibility IN ('organization','public') OR owner = me`, so a value added later fails closed                                                                                  |
| The owner leaves the workspace holding a private list                                                                              | Readable by nobody; not counted against `collections` or the admin meter; counts again if the owner returns; its places keep counting against `places`                                                 |
| The owner of a shared collection has left the workspace                                                                            | The header says "Owner: a former member"; only an admin can remove places and the sheet says so                                                                                                        |
| An admin tries to change a collection's sharing                                                                                    | `ForbiddenError` for a collection they can read (the header offers no button); `NotFoundError` for a private one                                                                                       |
| An admin writes `visibility` through the update path                                                                               | Refused: the field is no longer in `updateCollectionInput`, and `setCollectionSharing` is the only writer                                                                                              |
| Switch to "Only you" with other people's places in the collection                                                                  | The dialog shows the count; allowed; nothing deleted; switching back restores their view                                                                                                               |
| A member forges `deletePlaceFn` / `deletePlacesFn`                                                                                 | `ForbiddenError` from the repository itself (the guard lives in `deleteCollectionPlace(s)`, not only the handler); nothing removed                                                                     |
| `addFromTripFn` or `loadTripPlacesFn` with a private trip the caller is not on                                                     | `NotFoundError` from `requireTrip`; zero rows written; no `alreadySaved` marks are computed                                                                                                            |
| `loadTripPlacesFn` with a collection the caller cannot read                                                                        | `NotFoundError` from `requireReadableCollection`, so `alreadySaved` never reveals what a private collection holds                                                                                      |
| `addFromTripFn` with ids that belong to another trip, or are foreign                                                               | `NotFoundError`; zero rows written                                                                                                                                                                     |
| A bulk copy over the `places` ceiling                                                                                              | `QuotaExceededError`, zero rows written (no prefix); the quota alert shows and nothing changed                                                                                                         |
| A copy that would insert nothing (all duplicates) in a workspace over its ceiling                                                  | `additional` is 0: the quota assertion and the batch are skipped; `{ added: 0, skipped: n }`, not an error                                                                                             |
| Copying a set into a collection that already holds some of it                                                                      | Those are skipped, not an error; the result is announced; copying the same set twice adds nothing                                                                                                      |
| Two overlapping source sets copied in one call                                                                                     | The seen-set adds each place once                                                                                                                                                                      |
| `ids x targets` over 100 in one copy call                                                                                          | Zod refusal at the boundary; nothing written; the control stops offering targets beyond the cap                                                                                                        |
| A place typed twice by hand                                                                                                        | Allowed (the traveller asked for it)                                                                                                                                                                   |
| A new place sorts to the end, off the first page                                                                                   | The sheet opens from the row the server returned, so the traveller sees it at once                                                                                                                     |
| A latitude without a longitude (or the reverse), by form or by a forged request                                                    | A named field error in the form; a Zod refusal on the server; nothing written                                                                                                                          |
| A latitude out of range                                                                                                            | Its own field error (`add.latitude.range`); the existing `lat`/`lng` bounds refuse a forged one                                                                                                        |
| A forged `source`, `externalId` or `sortOrder`                                                                                     | Refused by the strict boundary schema                                                                                                                                                                  |
| 101 ids in a bulk call                                                                                                             | Zod refusal at the boundary; nothing written                                                                                                                                                           |
| An id in a bulk call that was removed by someone else a moment ago                                                                 | `NotFoundError`; nothing changed; the screen re-reads                                                                                                                                                  |
| A bulk write fails midway (driver error)                                                                                           | One batch: it changes nothing; the bar says so and offers "Try again" for the whole action                                                                                                             |
| A dropped connection after a write may have committed                                                                              | No envelope came back, so no surface claims "Nothing was changed": it re-reads, then shows its `*.unconfirmed` sentence; retrying a removal already done ends in a re-read                             |
| The collection has more than 99 saved places                                                                                       | The loader reads label links for a page of 48; no statement binds more than 100 parameters                                                                                                             |
| A collection with more than 1000 mapped matches                                                                                    | The first 1000 pins in list order and the "Showing the first {count} pins" note                                                                                                                        |
| A filter change while places are selected                                                                                          | The selection is pruned to what is still visible and the new count is announced; a destructive action acts only on visible, selected rows                                                              |
| A write re-runs the loader while "Show more" pages are appended                                                                    | The appended pages reset to the fresh first page; the selection is pruned to what remains                                                                                                              |
| "Show more" after another tab removed the cursor row                                                                               | The keyset condition still resumes after the cursor position; no row repeats                                                                                                                           |
| The source trip was deleted, or is private to the caller                                                                           | `source_trip_id` is null or unreadable; the sheet says "Saved from a trip" and never names the trip                                                                                                    |
| A place with no position                                                                                                           | Listed, no pin; counted in `unmapped`; the empty-map line links to it                                                                                                                                  |
| A name that collides with a private collection's slug                                                                              | The slug gets a suffix (`paris-2`), which hints that a collection called "Paris" exists; accepted, as trips and journals accept it                                                                     |
| WebGL unavailable                                                                                                                  | The map's own engine notice; the list works                                                                                                                                                            |
| Double-tap on any control                                                                                                          | A focused control is never given `disabled` (focus would be lost): it is `aria-disabled="true"` and ignores activations while its write is in flight; writes are idempotent or refused the second time |
| Escape, the close button or a tap outside while editing or with a filled add form, or with places ticked in the from-a-trip dialog | Asks to discard (nothing changed: closes at once); the back gesture, a refresh and a sheet drag are guarded the same way; a failed or unconfirmed save keeps the values                                |
| Right-to-left, 23 locales                                                                                                          | Logical properties; directional icons mirror; the parity test covers the keys                                                                                                                          |

## ✅ Acceptance criteria

08-S9a:

1. `readableCollectionFilter`, `inReadableCollection` and `requireReadableCollection` exist once; the predicate fails closed
   (`visibility IN ('organization','public') OR owner_user_id = me`). `listCollections`, `getCollection`, `getCollectionBySlug`,
   `listCollectionsWithCounts` (rows and totals), `listCollectionPlaces`, `listCollectionPlacesWithLabels`, `listLabels`,
   `countCollectionPlacesByCountry`, `nextCollectionPlaceSortOrder`, `collectionDeleteSummary`, `addCollectionPlace`, `updateCollectionPlace`,
   `setCollectionPlaceStatus`, `deleteCollectionPlace`, `setCollectionPlaceLabels` and the label writers that exist at the ticket's
   merge (`createLabel`, `deleteLabel`, and `updateLabel` from the change-a-collection spec) all go through them.
2. For a non-owner, a `private` list is invisible to every reader above (including the country aggregate and the counts) and raises
   `NotFoundError` on every writer, a workspace admin included; a stored `public` row behaves as `organization`.
3. `setCollectionSharing` is the **only** writer of `visibility` (`updateCollectionInput` no longer carries the field,
   `createCollectionInput.visibility` is `organization`); it is owner-only (`ForbiddenError` otherwise, after the readable lookup)
   and its input accepts `private` and `organization` only; `loadSharingFn` reports `othersPlaces`.
4. `countCollectionsAgainstPlan` leaves out a private list whose owner has left; `createCollection` and `loadAdmin` use it; it counts
   again if the owner returns. For everyone else the admin meter counts another member's private list.
5. `loadCollectionDetail` starts from `requireReadableCollection` and turns `NotFoundError` into the route's `notFound()`.
6. The header shows the real audience and owner; the sharing dialog saves with an explicit button and warns with the count; the index
   shows the "Only you" chip; the audience button's accessible name contains its visible text.
7. Changing sharing writes a `collection.sharing_changed` entry (`from`, `to`) and deleting a collection a `collection.deleted` entry (`places`) to the audit trail, neither carrying a name; no closed error or failure-code list changes
   (`AUTHORED_ERROR_NAMES` and the public failure codes are as before).
8. The tenant-isolation and member-isolation blocks below pass; the ticket carries `risk-high` and `security` and merges on a security
   and tenancy specialist's approving verdict on its diff.

08-S9b:

9. `assertSavedPlaceQuota` runs once before the write in `addCollectionPlace`; a workspace at its `places` ceiling gets
   `QuotaExceededError` and no row, while an identical workspace under its own ceiling succeeds. The admin `places` meter shows the
   same number `assertSavedPlaceQuota` enforces.
10. `addPlaceFn` and `updatePlaceFn` are strict objects with no `source`, `externalId` or `sortOrder`; a lone latitude or longitude is
    refused on the server and in the form; `addPlaceFn` returns the created row.
11. The add dialog, the place sheet (read, edit, remove with `canManage`) and the provenance rule work as specified; a private trip's
    name never appears for a member who is not on it; `deleteCollectionPlace` carries the owner-or-admin guard itself and a repository
    test covers owner, admin and member.
12. The empty state offers only paths that exist when the ticket merges; the quota alert reuses the planner's sentence and link.
13. A collection of 150 saved places loads (no statement binds more than 100 parameters), including its provenance lookup.
14. Removing a place writes a `collection.places_removed` entry (count 1).

08-S9c:

15. `saveTripPlacesToCollection` resolves each place's trip and calls `requireTrip`; a place of an unreadable trip is `NotFoundError`;
    the single-place function delegates to it.
    16a. A copy from a trip not visible to the whole workspace into an `organization` or `public` collection omits `notes` and `description`; into a private collection it keeps them.
16. The duplicate rule matches on `source_place_id` first and on the normalised name, position and (for a place without one) city and country second, through a SQL prefilter and a
    JavaScript fold; copying the same set twice adds nothing (guaranteed for places that carry a `source_place_id`; for hand-typed places the name rule is cut at 500 candidates, the harmless-duplicate direction); two overlapping sets add each place once; the count the dialog promises
    equals the server's for the same input.
17. `copyPlacesToCollections` resolves every source and target in the caller's scope before any write, skips the quota and the batch
    when nothing will be inserted, otherwise asserts the quota once with the post-de-duplication count, and writes in one batch;
    `ids x targets <= 100` is a Zod refusal.
18. `listTripPlacesForSaving` calls `requireReadableCollection` and `requireTrip` itself and `listPlaceLists` resolves its source place through `inReadableCollection` itself; the server functions delegate to them.
19. The ticket carries `risk-high` and `security` (it adds writers that cross a trip and collection boundary).

08-S9d:

20. `collectionPlaceFilter` contains `inReadableCollection`, and `listCollectionPlacesFiltered`, `listCollectionPins` and
    `loadCollectionPlacesFn` all call `requireReadableCollection` first; the list and the pins read the same predicate.
21. `listCollectionPlacesFiltered` raises `NotFoundError` for a foreign or unreadable collection where `listCollectionPlaces` returns
    `[]`; both are asserted.
22. Paging is by keyset on `(sort_order asc, id desc)` at 48; the cursor is not in the URL; label filtering is an `EXISTS` and the label
    input is `.max(MAX_LABELS_PER_COLLECTION)`.
23. The client-side predicate no longer exists beside the server one.

08-S9e:

24. Each bulk function is bounded at 100 ids, resolves every id inside the caller's scope first, and is all-or-nothing; removal calls
    `requireOwnedCollection` of every distinct collection inside the repository writer.
25. Every batched UPDATE and DELETE carries `tenantFilter` and `inReadableCollection` in its own WHERE; a test asserts
    `builder.toSQL().params.length <= 100` for each bulk insert, update and delete at its cap, and for the `listCollectionPlacesFiltered` page query at its widest (cursor, status, 30 labels, the readable `EXISTS`, `LIMIT`).
26. A bulk copy that would exceed the ceiling writes nothing; the arithmetic (`chunkFor(boundParametersPerRow(collectionPlaces))`, 34
    statements for 100 rows) is pinned by a test.
27. The bar appears only with a selection, states the count, confirms before removing, is reachable by keyboard, prunes on filter
    change and never covers the last row; a bulk remove writes a `collection.places_removed` entry with the count.
28. The ticket carries `risk-high` and `security` (id-keyed bulk writers).

All tickets:

29. Every new user-facing string is in the 23-locale catalogue (`coverage.test.ts`, the parity test and the collections
    `copy-rules.test.ts`, whose file list gains the new components, stay green).
30. Light and dark, 360px to 2560px, WCAG 2.2 AA, a silent console, no layout shift after the settle mark; Playwright asserts that
    `document.activeElement` is never `<body>` after any write, close, step change or "Show more", and that the page live region
    receives each announcement of the UI/UX rules, including one made while the sheet is open (it reaches an element with no `aria-hidden` ancestor).
31. `CONTEXT.md` gains the terms above in the ticket that first uses them, and its **Collection** entry says the UI calls it a
    collection ("_Avoid_: list").

## 📝 Risks & Impact Review

| Risk                                                                                                                          | Severity | Mitigation / disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turning the read rule on hides collections that members could open yesterday: stored `private` rows become the owner's alone  | high     | That is the rule the product has always promised. Stored `public` rows keep working as workspace collections. Stated in the PR body of 08-S9a; reversible by switching the collection to "Everyone in this workspace"                                                                                                                                                                                                                                                                                                                 |
| A writer keyed by a place or label id, or a new reader, that is missed lets a member reach a private collection               | high     | The lists in "The read rule" and the acceptance criteria are enumerated; the member-isolation block asserts `NotFoundError` on every one; a future reader or writer fails review if it resolves a collection without the predicate                                                                                                                                                                                                                                                                                                    |
| A stranded private collection is unreachable, together with other members' places in it                                       | medium   | Same as trips and journals; out of the quota count; whether an admin may reach it is the open question already filed (#807). **The slicer adds a comment there** naming collections and other members' saved places; this spec files no issue itself                                                                                                                                                                                                                                                                                  |
| Collection writes count `collection_places` + `places`, while `createPlace` and the trip-copy preflights count `places` alone | medium   | The safe direction holds (nobody exceeds the ceiling by saving into collections). The admin meter is fixed in 08-S9b. **The slicer files one follow-up issue**: make `createPlace` (`places.ts:287`) and the preflights at `trips.ts:1231-1234` and `:1522-1525` use `countSavedPlaces`; `Blocked by` nothing                                                                                                                                                                                                                         |
| The collection -> trip import needs the same role guard `requireEditablePlan` gives the planner                               | medium   | Not this stage's code. `createPlace` already enforces owner/editor access (#928, PR #1299). **The slicer files one follow-up issue** naming the places-and-maps plan's import stage: its future bulk writer must preserve that role guard and add the archive check (`requireWritableTrip`) inside the repository                                                                                                                                                                                                                     |
| Nothing mounts `SaveToCollection` on a trip screen, so a place cannot yet be saved from the planner into a collection         | medium   | No plan stage owns it. **The slicer files one follow-up issue**: mount `SaveToCollection` on the planner's place card (the control is built here for it); `Blocked by` 08-S9c                                                                                                                                                                                                                                                                                                                                                         |
| Counting both tables against `places` changes what the `places` limit buys                                                    | medium   | The term is the plan's own, stated outright (`docs/plans/08-product-modules.md` § 08-S9 Quota: "a saved place is a saved place, the catalogue sells one number for them"), so no person's decision stands in front of 08-S9b; `places` is an operational ceiling the catalogue does not model (`src/server/billing/limits.ts:26-27`), not a published figure. The safe direction holds: nobody exceeds the ceiling by saving into collections. The slicer files the one follow-up issue above so `createPlace` counts the same number |
| Removal needs the owner or an admin; a member who adds a place by mistake cannot remove it                                    | low      | `rejected` is the reversible remedy, and the sheet names the owner and explains the missing button; loosening later is additive (Resolved assumption 8)                                                                                                                                                                                                                                                                                                                                                                               |
| A 100-place bulk insert is 34 statements in one batch; a 100 x 10 copy would be 334                                           | low      | The copy fan-out is capped at `ids x targets <= 100`, so no call exceeds 34 insert statements; tested for atomicity and the statement count                                                                                                                                                                                                                                                                                                                                                                                           |
| The trip list (100), a trip's places (500) and `SaveToCollection` (50 collections) are bounded                                | low      | Accepted: each dialog says "Showing the first {n}" (`fromTrip.truncated`, `saveTo.truncated`) when a cap cuts its list, and the list is sorted by name so the cut is predictable                                                                                                                                                                                                                                                                                                                                                      |
| The duplicate key's 4-decimal rounding misses a boundary-straddling pair; the SQL prefilter truncates beyond 500 rows         | low      | A harmless extra row; the failure is the reversible one                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Pins are capped at 1000 per collection                                                                                        | low      | Noted on screen; a pro workspace may hold 20000 in total, not in one collection in practice                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Reversing #1106's "no visibility badge"                                                                                       | low      | Deliberate and only for true states (Neighbouring work)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A tenant at its ceiling is refused with a sentence and a link, not the ceiling and plan                                       | low      | The closed failure-code contract (Problem Statement, Resolved assumption 14)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| The country `Combobox` matches English names only (the frozen name table is `en-GB`)                                          | low      | Inherited; matching also accepts the ISO code. A localised country table is a separate concern                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `vaul`'s 500ms drawer transition is over the 400ms ceiling                                                                    | low      | The place sheet overrides it, or the gap is recorded and one follow-up filed for every `Sheet` (UI/UX, Motion)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Slug reservation counts private collections, hinting that one exists                                                          | low      | Accepted, as trips and journals accept it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Out of scope

Search-and-add (no search component yet); copying a collection's places into a trip (another plan's import stage); a "save to
collection" control on the planner's place card (trip screens; a follow-up is filed); `public` collections and a share token;
per-collection member roles; reassigning a collection's owner; reordering places; a collection cover; per-card actions on the
collections index (the plan block names none beyond the sharing state); text and country filters on the detail screen; multi-status
filtering; a "select all matches" action; soft delete; making `createPlace` and the trip-copy preflights count both tables.

### Blockers

- **Search-and-add is absent, not blocked.** ADR 0013 closed the geocoding decision, and the place-search stage of the places-and-maps
  plan is scheduled after this stage. Disposition: **scope** - every path into a collection that does not need a search component
  ships here; the entry point is absent rather than disabled; that stage closes `ADD-10`. Nothing shipped here waits for it.
- **A public collection is not offered.** `collections.visibility` allows `public` and nothing can serve it: no `public_token`
  column and no unauthenticated route. Disposition: **defer** - it needs a column and a route; the picker offers the two enforceable values.
- No package outside the `docs/SPEC.md` §3 pinned set, no binding, no third-party service, no schema change.

### Reference-row disposition

`ADD-10` stays `partial` (the plan closes it `absent -> partial` as well): the leftovers are search-and-add (the place-search stage) and
collection -> trip (the places-and-maps plan's import stage).

## 📋 Phasing

Five tickets, in order. None is a horizontal layer: each ships a repository change, its server functions, the screen and its tests.

## 📋 Implementation Plan

### Phase 1 - who may read and write a collection (08-S9a)

1. Repository: the three read-rule functions; route every reader and id-keyed writer through them (list in "The read rule");
   `strandedCollectionFilter`, `countCollectionsAgainstPlan`; `setCollectionSharing` as the only writer of `visibility`;
   `requireOwnedCollection` and `collectionDeleteSummary` start from `requireReadableCollection`.
2. Audit: `collection.sharing_changed`, `collection.places_removed` and `collection.deleted` join `AUDIT_ACTIONS` in `src/server/audit/trail.ts` (with its
   test); the sharing call site is recorded here.
3. `-server/collections.ts`: `loadSharingFn`, `setCollectionSharingFn`. `library.ts`: `loadCollectionDetail` starts from
   `requireReadableCollection` and gains `sharing`, `isOwner`, the owner's name. `overview.ts`: `loadAdmin` uses
   `countCollectionsAgainstPlan`.
4. `sharing-dialog.tsx`, the header audience, the index chip; the copy keys of ticket a in 23 locales.
5. Tests: the member-isolation and tenant-isolation blocks; the stranded-count test; the dialog; `CONTEXT.md` entries.

### Phase 2 - add a place by hand and read it closely (08-S9b)

1. `saved-places.ts` and its test; `addCollectionPlace` asserts the quota; `listCollectionPlacesWithLabels` and the provenance trip-name
   lookup read in chunks; `deleteCollectionPlace` carries its own guard.
2. `-server/collections.ts`: `addPlaceFn`, `updatePlaceFn`, `deletePlaceFn` (writes the audit entry); `library.ts`: the loader's
   `SavedPlaceRow` gains the fields and the readable provenance. `overview.ts`: `loadAdmin` reports `used: countSavedPlaces(scope)`
   for `places`; the dashboard's "Places mapped" stat is unchanged.
3. `place-form.tsx`, `add-place-dialog.tsx`, `place-sheet.tsx`; the rewritten empty state; ticket b's keys in 23 locales.
4. Tests: quota isolation case, strict schemas, the pair rule, the sheet, focus return, the meter.

### Phase 3 - add from a trip, and save to several collections (08-S9c)

1. `dedupe.ts` and its test; the shared insert builder; `saveTripPlacesToCollection` (with `requireTrip`), `copyPlacesToCollections`,
   `listTripOptions`, `listTripPlacesForSaving`, `listPlaceLists`.
2. `-server/collections.ts`: the five functions of ticket c.
3. `from-trip-dialog.tsx` mounted on the empty state and the header; `save-to-collection.tsx` mounted in the place sheet; the empty state's `empty.body` value rewritten in 23 locales; ticket c's keys.
4. Tests: three isolation cases (below), the duplicate rule, atomicity, the SQL prefilter's parameter count.

### Phase 4 - narrow the collection and the map together (08-S9d)

1. `collectionPlaceFilter`, `listCollectionPlacesFiltered`, `listCollectionPins`; the pin and page arithmetic tests.
2. Loader deps, `loadCollectionPlacesFn`, the payload; delete the client predicate.
3. `collection-map.tsx`, `load-more.tsx`, the layout, the empty-map line; the route declared `map: true` in the spec's route case.
4. Ticket d's keys; the browser spec for filters and the map.

### Phase 5 - act on a selection (08-S9e)

1. `selection.ts` and its test; the four bulk functions and repository writers (chunked, one batch, tenant and readable predicates in
   every WHERE); `deleteCollectionPlaces` carries its own guard; `deletePlacesFn` writes the audit entries.
2. `bulk-bar.tsx`; ticket e's keys.
3. Tests: all-or-nothing, the 101-id refusal, the ceiling case, the parameter-count test, the bar, the browser journey.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Tenant isolation, `src/server/repos/__tests__/tenant-isolation.test.ts` (one `describe`): in A's scope against B's ids,
  `addCollectionPlace` parented on B's collection, `updateCollectionPlace`, `deleteCollectionPlace`, `setCollectionPlaceLabels`,
  `listCollectionPlacesFiltered` and `listCollectionPins` on B's collection, `setPlacesStatus`, `deletePlaces`, and `addLabelToPlaces`
  (B's label on A's places, and A's label on B's places) each reject with `NotFoundError` and B's rows are unchanged; beside it,
  `listCollectionPlaces(scopeA, { collectionId: bId })` returns `[]` (it does not throw), asserted so the new read's refusal is not
  read as a property the whole module had. Three two-id cases are the point of the block:
  1. `saveTripPlaceToCollection(scopeA, { collectionId: aList, placeId: bPlace })` - A's list, B's place: rejects, writes nothing;
  2. `copyPlacesToCollections(scopeA, { fromIds: [bCollectionPlaceId], toCollectionIds: [aList] })` and the same with a B target -
     A's and B's counts unchanged, not merely a throw;
  3. `saveTripPlacesToCollection(scopeA, { collectionId: aList, tripId: bTripId, placeIds })` and `listTripPlacesForSaving` with B's collection (the `*Fn` cases live in `src/routes/_app/-server/__tests__/collections.test.ts`)
     - `NotFoundError`, A's count unchanged.
       Plus the quota case: with the `places` ceiling reached by A's own rows (collections and trips together), `saveTripPlaceToCollection` in
       A's scope throws `QuotaExceededError` and writes nothing, while B's identical call under B's own ceiling succeeds. A bulk update or
       delete with a foreign id changes no row of the other tenant. `setCollectionSharing(scopeA, bCollectionId, 'private')`, `listPlaceLists` with B's `collectionPlaceId` and the sharing-summary reader on B's collection each reject with `NotFoundError`, and B's `visibility` is unchanged.
- Member isolation, `src/server/repos/__tests__/member-isolation.test.ts` (a collections block): for a non-owner a private list is
  invisible to **every** reader of the acceptance criteria - `listCollectionPlacesFiltered`, `listCollectionPins`, the duplicate
  lookup, `listTripPlacesForSaving`, `listPlaceLists`, the sharing-summary reader, `collectionDeleteSummary`, the index totals - and raises
  `NotFoundError` on every id-keyed writer and every bulk writer of ticket e, admin included; `loadAdmin` counts another member's
  private list and leaves out only a stranded one; a stored `public` row reads as `organization`; an unknown `visibility` is denied; a non-owner's `addCollectionPlace` on a private list is `NotFoundError` and writes no row;
  an admin cannot change sharing and cannot write `visibility` through the update path; `saveTripPlaceToCollection` with a place of a
  private trip the caller cannot read is `NotFoundError`; a stranded private list is out of `countCollectionsAgainstPlan` and counts
  again when the owner returns; a `member` gets `ForbiddenError` from `deleteCollectionPlace` and `deleteCollectionPlaces` themselves.
- Repository suite (`repositories.test.ts`, the `server` project, a batch-capable driver): `MAX_BULK_PLACES * boundParametersPerRow(collectionPlaces)`
  is chunked to 34 statements for 100 rows; `builder.toSQL().params.length <= 100` for every bulk insert, update, delete and every
  prefilter chunk and the filtered page query at its cap (the chunk size counts the tenant and readable-predicate parameters: 80 ids for a statement that adds the
  readable `EXISTS`); every inserted row carries the caller's `organizationId`; every batched update and delete carries the tenant and
  readable predicates; a bulk copy over the ceiling writes nothing; a copy of only duplicates over the ceiling returns `{ added: 0 }`;
  a failed batch changes nothing; the duplicate rule on `source_place_id` first and on the normalised triple second; a collection of
  150 places loads with provenance; keyset paging neither skips nor repeats a row across ties.
- Server-function tests (`src/routes/_app/-server/__tests__/collections.test.ts`): `private` is `NotFoundError` for a non-owner and not
  a forbidden; a `member` may add a place to an `organization` list and may not remove it or delete the list; a 101-id bulk input and
  an `ids x targets > 100` copy are refused; the strict schemas refuse `source`, `externalId`, `sortOrder` and a lone coordinate; the
  label input refuses more than 50.
- Audit: `trail.test.ts` covers the three new action names; the sharing, single-remove, bulk-remove and `deleteCollectionFn` call sites write one entry each.
- Component tests (`src/components/collections/__tests__/`): `selection.test.ts`, `place-sheet.test.tsx` (provenance renders only when
  the trip is readable; `Escape` asks to discard in edit mode and returns focus to the opener), `bulk-bar.test.tsx` (appears only with
  a selection; confirms; reachable by keyboard; prunes on filter change; a writing control keeps focus), `save-to-collection.test.tsx`
  (several collections in one call; an already-saved collection is shown as such; the cap), `sharing-dialog.test.tsx` (warning with the
  count; explicit save), `dedupe.test.ts`.
- Browser: `e2e/product-modules.spec.ts`, a `test.describe('08-S9 ...')` on the seeded workspace: add a place by hand, see its sheet
  open, filter, select two cards and copy them, the map latches `[data-map-ready]` (the spec builds a `collectionRoute(collectionId)`
  `RouteCase` with `map: true`, as `planRoute` does for the planner, so `settleMap()` audits the declaration both ways), the console
  silent, `document.activeElement` never `<body>`. No baselines (ADR 0016). Evidence for review is the blind A/B pair from
  `scripts/visual/capture.mjs`, e.g.
  `node scripts/visual/capture.mjs --url "http://localhost:$PORT/collections/<id>" --out <dir> --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map --state sheet --click '[data-part="collection-place-open"]'`
  and `--state bulk` with two cards selected via `--click '[data-part="collection-place-select"]'`. Every selector is a `data-part`
  attribute this stage publishes.
- Layout shift after the settle mark is asserted at 0 on `chromium` (the bulk bar is `sticky` and reserves its own height, the map
  strip reserves its settled height) and stated as a skip on `mobile-safari`.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                 | Applied default                                                                                                                                                                                                                                                                                                                      | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Which ways into a collection ship?                       | Add by hand, add from a trip (a picker on the collection screen), collection-to-collection copy; `SaveToCollection` built as the multi-collection control on the sheet; nothing edited in trip screens (a follow-up mounts it on the planner's place card)                                                                           | Decided by product owner sub-agent (confidence medium): the block's own empty state promises "Copy from a trip"; a component mounted nowhere leaves "saving them" unmet; editing the planner's place card edits files other stages claim. Panel round 1 added the follow-up, since no plan stage owns the mount                                                                                                                                                                            |
| 2   | Is search-and-add in this stage?                         | No; absent rather than stubbed; `ADD-10` stays `partial`. The block's "MAP-02 is BLOCKED" premise is stale (ADR 0013), which changes the reason, not the outcome                                                                                                                                                                     | Decided by product owner sub-agent (medium): no search component exists and the place-search stage is later in the schedule                                                                                                                                                                                                                                                                                                                                                                |
| 3   | Is `copyPlacesToTrip` built here?                        | No; the bulk bar has four actions. The collection -> trip direction belongs to the places-and-maps plan's import stage with its `createPlaces`; no `dayId` crosses this stage                                                                                                                                                        | Decided by product owner (medium) and software architect (medium-high) sub-agents: one concept, one owner (`docs/SPEC.md` §8); a loop over `createPlace` asserts the quota per row and has no role or archive check; a second writer of `places` rows is forbidden                                                                                                                                                                                                                         |
| 4   | The reference row's viewer / editor / admin roles        | Mapped onto the two authorities that exist: the collection's owner and the caller's workspace role; no member table, no migration                                                                                                                                                                                                    | Plan decision, verified (`collections.visibility` is the only column; `hasAtLeastRole`, `src/server/repos/context.ts`): a second rank system nobody administers is the wrong answer even with a migration                                                                                                                                                                                                                                                                                  |
| 5   | Status filter: one status or several?                    | One: `status?` as the change-a-collection spec has it; labels any-of                                                                                                                                                                                                                                                                 | Decided by product owner sub-agent (medium): that spec published the contract; no user need asks for several statuses and adding them later is additive                                                                                                                                                                                                                                                                                                                                    |
| 6   | Read rule per `visibility`, and admins                   | `private` is the owner's alone, no admin exception, `NotFoundError` for everyone else; the predicate fails closed on an unknown value; a stranded private collection is readable by nobody and out of the quota count; whether an admin may reach it stays with the open question for trips and journals                             | Decided by security and tenancy sub-agent (medium): ADR 0007 / `strandedTripFilter` and ADR 0034 / `countedJourneyFilter` are the precedent; the narrowest read is the most reversible; an admin reading others' private content is a new policy. Panel round 1 added the fail-closed form                                                                                                                                                                                                 |
| 7   | Stored `public` rows                                     | Read and write as `organization`; the dialog shows "Everyone in this workspace" and rewrites the value only on save                                                                                                                                                                                                                  | Decided by security and tenancy sub-agent (medium): the creator asked for something wider than the workspace; trips ignore `public` because a share token could publish a private trip, and collections have no token column; hiding them would silently take away other members' places                                                                                                                                                                                                   |
| 8   | Who may remove a place, and change sharing?              | Remove (one or many): the collection's owner or a workspace admin, enforced inside the repository writer. Change sharing: **the owner only**. Any member who can read the collection may add, edit, status, label and copy into it                                                                                                   | Sharing: security and tenancy sub-agent (medium) - an admin switching a departed owner's collection to private makes it unreadable with no way back; this departs from the plan's "owner or admin". Removal: the security sub-agent recommended also admitting the saver; the software architect sub-agent recommended owner or admin only; the architect's option is applied as the more reversible one (`afk-decide` step 4), with `rejected` as the member's remedy                     |
| 9   | Switching a collection with others' places to "Only you" | Allowed, with a warning that counts them; nothing is deleted                                                                                                                                                                                                                                                                         | Decided by security and tenancy sub-agent (medium): reversible; blocking would make "Only you" useless on any collection that has been shared                                                                                                                                                                                                                                                                                                                                              |
| 10  | Bulk size and atomicity                                  | 100 ids, every statement chunked inside one `runBatch`, all-or-nothing, result `{ added, skipped }`; the plan's partial-success copy is rewritten; every batched update and delete carries the tenant and readable predicates; a copy is capped at `ids x targets <= 100`                                                            | Decided by software architect sub-agent (high): 26 columns => 3 rows a statement, 34 statements; the real constraint is the 100-parameter ceiling on `IN` reads and writes, which chunking fixes at any cap. Panel round 1 (security and architect) added the in-WHERE predicates and the fan-out cap                                                                                                                                                                                      |
| 11  | The saved-place quota                                    | `places`, counting `collection_places` + `places`, one helper in a neutral `saved-places.ts`, asserted once with the post-de-duplication count (skipped when nothing will be inserted); the admin `places` meter reads the same number (08-S9b); `createPlace` and the trip-copy preflights stay asymmetric and a follow-up is filed | Decided by software architect sub-agent (medium): the plan's commercial term, inherited. `places` is an operational metric, not a catalogue figure (`src/server/billing/limits.ts:26-27`); the plan states it outright (`docs/plans/08-product-modules.md` § 08-S9 Quota: a saved place is a saved place, one number), so no person's gate stands in front of 08-S9b. The helper cannot live in `collections.ts` because `places.ts` will need it and `collections.ts` imports `places.ts` |
| 12  | The duplicate rule                                       | `source_place_id` first, then folded name + coordinates rounded to 4 decimals (a place without a position matches by city and country), compared in JavaScript against a SQL-prefiltered projection; hand-typed adds are not de-duplicated                                                                                           | Decided by software architect sub-agent (high): SQLite `lower()` is ASCII-only and cannot NFC; a boundary miss adds a harmless duplicate. Panel round 1 replaced "read the whole target projection" with a prefilter, so a popover does not read every saved place in the workspace                                                                                                                                                                                                        |
| 13  | List, pins and paging                                    | One exported predicate that contains the readable check, a keyset page of 48 on `(sort_order asc, id desc)`, a pins read capped at 1000 with a note, loader deps and no cursor in the URL, "Show more" appends; selection is an id set over loaded rows capped at 100                                                                | Decided by software architect sub-agent (medium): pro allows 20000 places; `id desc` is kept so no existing collection reorders; the list and the map read one predicate and cannot disagree                                                                                                                                                                                                                                                                                               |
| 14  | The quota panel "naming the ceiling and the plan"        | The planner's localised sentence for `QUOTA_EXCEEDED` plus its "See plans" link, read from the trips catalogue                                                                                                                                                                                                                       | Decided by product owner sub-agent (medium): the boundary strips the metric, limit and plan by contract (`src/lib/errors.ts` `PublicFailureCode`); widening it is a closed-list change this stage does not own                                                                                                                                                                                                                                                                             |
| 15  | Coordinates for hand-added places                        | Optional latitude / longitude pair, both or neither, enforced in the form and the server; `parsePosition` reused                                                                                                                                                                                                                     | Decided by product owner sub-agent (medium): without it, hand-added places stay off the map and the empty-map line has nothing to fix; the planner already owns the pair rule                                                                                                                                                                                                                                                                                                              |
| 16  | Corrections to the block's citations                     | `places.ts:287`, `hasAtLeastRole(scope.ctx, 'admin')`, the schema lines, strict boundary schemas; `createLabel` and `deleteLabel` already exist at HEAD, only `updateLabel` comes from the change-a-collection spec                                                                                                                  | Applied default after verification at HEAD; none changes the design                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 17  | `saveTripPlaceToCollection` reads a private trip         | It reads the place's trip id, calls `requireTrip` on it and only then uses the place; every trip-sourced path does                                                                                                                                                                                                                   | Decided by security and tenancy (medium) and software architect (medium) sub-agents: ADR 0007; harmless today only because nothing calls it                                                                                                                                                                                                                                                                                                                                                |
| 18  | #1106 retires the visibility choice at creation          | This stage does not restore it on the create dialog; it adds the sharing dialog on an existing collection, after the rule exists, and a true audience indicator; `setCollectionSharing` becomes the only writer of `visibility`                                                                                                      | Applied default: #1106 explicitly leaves enforcement to this stage; reversing its "no badge" only for true states is named in the ticket. Panel round 1 (security): an admin must not be able to write `visibility` through the update path                                                                                                                                                                                                                                                |
| 19  | Slicing                                                  | Five full-path tickets in the order a, b, c, d, e; 08-S9a also waits for #1105 and #1106 so the label writers exist when the read rule routes them                                                                                                                                                                                   | Decided by product owner sub-agent (medium): a first, because every write asks who may write the collection; a mixed security-and-UI ticket would hide the access rule; five stays under the cap of eight. Panel round 1 (product owner, architect) added #1105                                                                                                                                                                                                                            |
| 20  | Labels and risk                                          | 08-S9a, 08-S9c and 08-S9e `risk-high` and `security`; 08-S9b and 08-S9d `risk-medium`; unattended implementation approved on the security reviewer's verdict with the conditions in the acceptance criteria                                                                                                                          | Decided by security and tenancy sub-agent (medium): the stage changes who may read and write tenant data. Panel round 1: c and e add id-keyed writers that cross a trip or collection boundary and merge on a specialist's verdict on their diff                                                                                                                                                                                                                                           |
| 21  | Per-card actions on the collections index; baselines     | Not built; only the "Only you" chip is added. The plan's `e2e/product-modules.visual.spec.ts` and screenshot baselines are replaced by `e2e/product-modules.spec.ts` with none                                                                                                                                                       | Applied default (product owner, panel round 1): the block never describes the per-card actions; ADR 0016 retires pixel baselines                                                                                                                                                                                                                                                                                                                                                           |
| 22  | Audit trail                                              | `collection.sharing_changed` (`metadata: { from, to }`, the stored value before the change), `collection.places_removed` (`metadata: { count }`) and `collection.deleted` (`metadata: { places }`) join `AUDIT_ACTIONS`                                                                                                              | Applied default (security reviewer, panel round 1): changing who can see a collection and removing up to 100 places at once otherwise leave no record; `trail.ts` says tenant-security events gain their names in the stage that ships their write paths                                                                                                                                                                                                                                   |
| 23  | User-facing word for the thing                           | "Collection" everywhere a traveller reads, "list" only in this spec's prose                                                                                                                                                                                                                                                          | Applied default (product owner and UX, panel round 1): every existing surface says collection                                                                                                                                                                                                                                                                                                                                                                                              |
| 24  | Copy fan-out and one write of two outcomes               | `ids x targets <= 100`; "failed" (an envelope came back: nothing changed) is distinguished from "unconfirmed" (a transport failure: re-read first)                                                                                                                                                                                   | Applied defaults (security reviewer and UX, panel round 1): one click must not write ten times the rows the spec tested; a dropped response after a committed write cannot say nothing changed                                                                                                                                                                                                                                                                                             |
| 25  | Focus, announcements and disabled controls               | A writing control keeps focus (`aria-disabled`, never `Button`'s `loading`); one page-level live region; destinations for focus when the opener is gone; `aria-disabled` rows with reasons; map pins are not tab stops                                                                                                               | Applied default (accessibility specialist, panel round 1): the explicit spinner recipe remains this stage's choice; `Button` loading now also retains focus (#938); `Sheet` restore does nothing when the opener left the DOM (`sheet.tsx:186`); the list is the keyboard path                                                                                                                                                                                                                                                        |
| 26  | Where the audit entry is written                         | By the server functions, after the repository call; repositories never call `trail()`                                                                                                                                                                                                                                                | Decided by software architect sub-agent (panel round 2): `trail()` imports the repositories, so a repository calling it is a cycle                                                                                                                                                                                                                                                                                                                                                         |
| 27  | The dev seeder and `visibility`                          | A `private` fixture is created, then switched with `setCollectionSharing` as the owner; a `public` fixture seeds as `organization`                                                                                                                                                                                                   | Applied default (security reviewer, panel round 2): keeps `setCollectionSharing` the only writer of `visibility`                                                                                                                                                                                                                                                                                                                                                                           |
| 28  | Who confirms the `places` counting term                  | Nobody: it is the plan's own term (`docs/plans/08-product-modules.md` § 08-S9 Quota), inherited unchanged                                                                                                                                                                                                                            | Applied default (panel round 2 asked for a gate; pull-request review found the plan already decides it): changing what a paid plan buys is a decision the plan took, and this spec only implements it                                                                                                                                                                                                                                                                                      |
| 29  | Unsaved work and the back gesture                        | Dirty forms guard `Escape`, outside tap, drag, the back gesture and refresh (`useBlocker` with `enableBeforeUnload`; `dismissible={false}` while dirty)                                                                                                                                                                              | Applied default (UX specialist, panel round 2): the usual phone way to close a sheet is a drag or the back gesture                                                                                                                                                                                                                                                                                                                                                                         |

## Panel review

Round 1 (before the PR): product owner, software architect, security and tenancy reviewer, accessibility specialist and UX specialist
each answered **approve with conditions**; every condition is applied in this document (the rows above marked "panel round 1", the
UI/UX rules, the Copy set, the acceptance criteria and the Verification block). Round 2 (before the PR): product owner, software architect, security and tenancy reviewer, accessibility specialist and UX specialist
each answered **approve with conditions** (none answered revise; the security and tenancy reviewer approved unattended implementation as
`risk-high` + `security` once its conditions were in the text). Every round-2 condition is applied in the commit that follows round 1; the
panel is capped at two rounds. The pull-request review that followed (an independent specification review and the security and tenancy reviewer on head 9b3177c1) asked for changes; they are applied in the commit after it: the detail payload's counts and `people`, the label cap in the bulk writer, the `collection.deleted` audit and its metadata rules, the stranded filter, the copy cap and the private-trip free text, the duplicate rule's city and country, the unlimited `source_place_id` match, #1106 as a blocker, the provenance date and the truncation notes. The final verdicts, by specialist:

| Specialist           | Round 1                 | Round 2                                                                | Conditions applied                                                                                                     |
| -------------------- | ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Product owner        | approve with conditions | approve with conditions                                                | `empty.body` ownership and the dead key, the `places` term gate                                                        |
| Software architect   | approve with conditions | approve with conditions                                                | audit written by server functions, 25-candidate prefilter and `ORDER BY id`, keyset condition                          |
| Security and tenancy | approve with conditions | approve with conditions (approves unattended `risk-high` + `security`) | `addCollectionPlace` in the writer list, three isolation cases, repository-level dialog guards, seeder, term gate      |
| Accessibility        | approve with conditions | approve with conditions                                                | explicit `aria-live`, pin glyph prop, assertive quota alert, busy-control spinner, 24px label, `collection-place-open` |
| UX                   | approve with conditions | approve with conditions                                                | five missing keys, back/refresh/drag guard, per-action failures, whole-card target, departed owner, nits               |

## Amendment - place writer authorization (PR #1299)

Issue #928 adds owner/editor checks to all six place repository writers, including `createPlace`.
The role-gap premise recorded in Resolved assumptions row 3 describes the earlier review state;
it no longer applies. Archive checks remain in the planner, and the import stage still owns the
bulk writer and its single quota assertion. This amendment does not change that scope decision.
