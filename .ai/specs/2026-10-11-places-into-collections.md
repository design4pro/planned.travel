# Collections: put places into a list, read one closely, and decide who else may

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
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
   must stop counting what the caller cannot read. `risk-high`, `security`.
2. **08-S9b - add a place by hand and read it closely.** The `places` ceiling asserted on every collection write for the first time,
   the add form with an optional map position, the place sheet (read, edit, remove, provenance) and the rewritten empty state.
3. **08-S9c - add from a trip, and save to several lists.** Pick a trip you can read and copy places from it into the list; copy a
   saved place into other lists; one de-duplication rule and one writer for both.
4. **08-S9d - narrow the list and the map together.** A paged list, a pin read built on the same predicate, and a map that shows
   exactly the places the list matches.
5. **08-S9e - act on a selection.** Select places, then set a status, add a label, copy to other lists or remove them, all-or-nothing.

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
  `:269` is `countTripPlaces`). `addCollectionPlace` and `saveTripPlaceToCollection` assert nothing, and the published number is
  "places". Making them writable without a count would let a free workspace (150 places) store thousands.
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
  Stored `private` and `public` rows exist and keep their values.
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
  by name, and `createPlace` has no role or archive check (the planner adds `requireEditablePlan` itself, `plan.ts`), so a trip viewer
  could write through it. One concept, one owner (`docs/SPEC.md` §8): this stage does not build it.
- **The plan's stale citations.** `hasAtLeastRole(scope.ctx.role, 'admin')` - the function takes the context
  (`hasAtLeastRole(scope.ctx, 'admin')`, `src/server/repos/context.ts`); the schema line numbers it cites for `collections` have
  moved (`src/server/db/schema.ts`, `collections` near line 1952); the "MAP-02 is BLOCKED" premise is stale (above). None changes the
  design; they are corrected here so an implementer does not chase them.
- **`addCollectionPlaceInput` and `updateCollectionPlaceInput` are not strict objects** and expose `source`, `externalId` and
  `sortOrder` (`collections.ts`); the boundary of this stage must not.
- **The admin meter reads a different number from the one the quota enforces.** `loadAdmin` shows `collections: listCollectionsWithCounts(scope).length`
  and `places: summary.counts.places` (`src/routes/_app/-server/overview.ts`), the second counting trip places only
  (`placesRepository.count` in `dashboard.ts`).

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                              | Not owned (read only, or left alone)                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/repos/collections.ts` - the read rule, every writer keyed by a place or label id, the new writers and readers below                                                                                                                                                                                                           | `src/server/repos/places.ts`: not edited. `createPlace` stays the single-create path; nothing here writes `places`                                                                                                      |
| `src/server/repos/saved-places.ts` - new, neutral: `countSavedPlaces`, `assertSavedPlaceQuota` (reads both tables, imports no repository)                                                                                                                                                                                                 | `src/server/db/schema.ts`, `drizzle/`: no schema change. `src/lib/plans.ts`, `src/server/billing/**`: no quota key, no `MODULE_KEYS` entry                                                                              |
| `src/lib/collections/dedupe.ts` (+ test) - new, pure: the fold and the duplicate key                                                                                                                                                                                                                                                      | `src/lib/errors.ts`, `src/server/errors/public.ts`: the closed code and name lists do not change                                                                                                                        |
| `src/routes/_app/-server/collections.ts` (+ `__tests__/collections.test.ts`) - edit; created by the change-a-collection spec, grown here                                                                                                                                                                                                  | `src/routes/_app/-server/library.ts` - edited in `loadCollectionDetail`, its payload types and the collections meter of `loadAdmin` only (`overview.ts`: one line); `createCollectionFn`, the journal loaders untouched |
| `src/routes/_app/collections/$collectionId.tsx` - edit: loader deps, page, pins, mounts                                                                                                                                                                                                                                                   | `src/routes/_app/trips/**`: no trip screen is touched (the planner's place card does not gain a "save to list" control)                                                                                                 |
| `src/routes/_app/collections/index.tsx` - edit: an "Only you" chip on a private list's card (the index is otherwise unchanged)                                                                                                                                                                                                            | `src/components/ui/*`: untouched; primitives reused as they are                                                                                                                                                         |
| `src/components/collections/` - new: `place-sheet.tsx`, `place-form.tsx`, `add-place-dialog.tsx`, `from-trip-dialog.tsx`, `save-to-collection.tsx`, `sharing-dialog.tsx` (08-S9a/b/c); `collection-map.tsx`, `load-more.tsx` (08-S9d); `bulk-bar.tsx`, `selection.ts` (08-S9e); `__tests__/`; `index.ts` - edit (see "Neighbouring work") | `src/routes/api/dev/-seed/apply.ts`, `scripts/seed/seed.mjs`: act as the owner; unchanged                                                                                                                               |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**, `modules.collections.*`                                                                                                                                                                                                                                           | `src/lib/i18n/messages/en/shell.ts` (`newCollection.*`, `visibility.*`): untouched                                                                                                                                      |
| `src/server/repos/__tests__/tenant-isolation.test.ts`, `member-isolation.test.ts`, `repositories.test.ts` (collections suite) - append                                                                                                                                                                                                    | `e2e/journeys.spec.ts`: untouched                                                                                                                                                                                       |
| `e2e/product-modules.spec.ts` - created if absent, otherwise a `test.describe` is appended (the sibling module specs create the same file; whichever lands first creates it). No baselines (ADR 0016)                                                                                                                                     |                                                                                                                                                                                                                         |
| `CONTEXT.md` - **Collection**, **Saved place**, **Collection sharing**, **Stranded collection** (the first two are also asked for by the change-a-collection spec; whichever lands first writes them)                                                                                                                                     |                                                                                                                                                                                                                         |

### Neighbouring work

Three pieces of work touch the same files and none of them is implemented at the time of writing; this stage merges after them and
holds in either order where it can.

- **The change-a-collection spec** (#1103; tickets #1104, #1105, #1106) creates `src/routes/_app/-server/collections.ts`,
  `requireOwnedCollection`, `canManageCollection`, `canManage` on the detail payload, the actions menu, the status picker, the labels
  and the client-side `filters.ts` predicate. 08-S9a is `Blocked by` #1104 (it edits the guard and the header menu), and 08-S9d and
  08-S9e are `Blocked by` #1105 (they move the label predicate to the server and add a label to a selection).
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

| Ticket | Delivers                                                                                                                                                                                                                                                                                           | Blocked by     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 08-S9a | `readableCollectionFilter`, `inReadableCollection`, `requireReadableCollection`; every reader and writer routed through them; `countCollectionsAgainstPlan` and the meter; `setCollectionSharing`, `loadSharingFn`, `setCollectionSharingFn`; `SharingDialog`; the header audience; the index chip | #1104          |
| 08-S9b | `saved-places.ts`; the quota on `addCollectionPlace`; a strict `addPlaceFn`, `updatePlaceFn`, `deletePlaceFn`; `PlaceForm`, `AddPlaceDialog`, `PlaceSheet`; the position pair; the rewritten empty state; the chunked label read                                                                   | 08-S9a         |
| 08-S9c | `dedupe.ts`; the shared insert builder; `saveTripPlacesToCollection` (with `requireTrip`); `copyPlacesToCollections`; `loadTripOptionsFn`, `loadTripPlacesFn`, `addFromTripFn`, `loadPlaceListsFn`, `savePlaceToCollectionsFn`; `FromTripDialog`, `SaveToCollection` on the sheet                  | 08-S9b         |
| 08-S9d | `collectionPlaceFilter`, `listCollectionPlacesFiltered`, `listCollectionPins`; loader deps and the keyset page; `LoadMore`; `CollectionMap`; the empty-map state; the client predicate removed                                                                                                     | 08-S9b, #1105  |
| 08-S9e | `selection.ts`, `BulkBar`; `setPlacesStatusFn`, `addLabelToPlacesFn`, `copyPlacesFn`, `deletePlacesFn` and their repository writers                                                                                                                                                                | 08-S9c, 08-S9d |

The order is a dependency, not a preference: every write in tickets b to e asks "who may write this list" and 08-S9a answers it; b
introduces the quota helper and the sheet that c and e use; c's writer is the one e's "copy to other lists" calls.

### Who may do what (Resolved assumptions 4 to 9)

| Verb                                                                                              | Who                                                                                | Where it is enforced                                                                |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Read a list, its places, its labels, its counts                                                   | any member for `organization` (and stored `public`); the owner alone for `private` | `readableCollectionFilter` / `inReadableCollection` in the repository               |
| Add a place, edit it, set its status, label it, copy places into the list, copy a place out of it | any member who can read the list                                                   | the same predicate; no role check                                                   |
| Remove a place (one or a selection)                                                               | the list's owner, or a workspace `admin` or above                                  | `requireOwnedCollection` (the change-a-collection guard), after the readable lookup |
| Delete the list, edit its name, description and colour                                            | the same                                                                           | the same (change-a-collection spec)                                                 |
| Change who can see the list                                                                       | **the owner only**                                                                 | `setCollectionSharing`, after the readable lookup                                   |

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

- `readableCollectionFilter(scope)`: `visibility <> 'private' OR owner_user_id = scope.ctx.userId`.
- `inReadableCollection(scope, column)`: a correlated `EXISTS` over `collections` bound with `tenantFilter(scope, collections, ...)` **and**
  `readableCollectionFilter`, for every row that names its collection by id (`collection_places.collection_id`,
  `collection_labels.collection_id`). Both sides are tenant-bound.
- `requireReadableCollection(scope, collectionId)`: the readable lookup that raises `NotFoundError('collection', id)`. S4's
  `requireOwnedCollection` and `collectionDeleteSummary` start from it instead of `requireById`.
- Every reader goes through the predicate: `listCollections`, `getCollection`, `getCollectionBySlug`, `listCollectionsWithCounts`,
  `listCollectionPlaces`, `listCollectionPlacesWithLabels`, `listLabels`, `countCollectionPlacesByCountry` (the "Where they are" panel
  must not count a private list's places for a non-owner) and `nextCollectionPlaceSortOrder`.
- Every writer keyed by a **place id or a label id** goes through it too, because they never resolve a collection today:
  `updateCollectionPlace`, `setCollectionPlaceStatus`, `deleteCollectionPlace`, `setCollectionPlaceLabels`, and the change-a-collection
  spec's `createLabel`, `updateLabel`, `deleteLabel`. A member must not be able to write into a private list by passing a place id.
- `countCollectionsAgainstPlan(scope)`: `collectionsRepository.count(scope, not(strandedCollectionFilter(scope)))`, where a stranded
  collection is `visibility = 'private'` and `NOT stillInWorkspace(scope, collections.ownerUserId)` (`src/server/repos/members.ts`).
  `createCollection` and the collections meter of `loadAdmin` both use it, so the enforced number and the displayed number are one.
  This changes the plan's "`collections` is unchanged": it is the same ceiling counted the way trips and journals count theirs.
- A dev-seeder or console actor that passes the owner's scope passes unchanged.

### The saved-place quota (`src/server/repos/saved-places.ts`, Resolved assumption 11)

A neutral module, so the places-and-maps plan's later writer can import it without a cycle (`collections.ts` already imports
`places.ts`). It reads the two tables directly with `tenantFilter` and imports no repository:

- `countSavedPlaces(scope)` = rows of `collection_places` + rows of `places`, both tenant-wide. A saved place is a saved place: the
  catalogue sells one number, and two independent ceilings under one published figure is how a published number stops being the enforced one.
- `assertSavedPlaceQuota(scope, additional)` = `assertQuota(scope, 'places', await countSavedPlaces(scope), additional)`, called **once**
  per write, before the batch, with `additional` equal to the number of rows actually going to be inserted after de-duplication. A
  rejected bulk write guarantees `QuotaExceededError` and zero rows written. The count-then-write race is the one `createPlace` already accepts.
- Called by `addCollectionPlace`, `saveTripPlacesToCollection` (and the single-place `saveTripPlaceToCollection`, which becomes a call
  to it with one id) and `copyPlacesToCollections`.
- **The asymmetry is stated, not hidden.** After this stage a collection write counts both tables and an itinerary write
  (`createPlace`, `src/server/repos/places.ts:287`) still counts `places` alone. The safe direction holds: nobody can exceed the
  published number by saving into collections. Making `createPlace` symmetric is a one-line change in `places.ts`, which another
  plan stage owns later, and it is recorded here as a requirement for that stage. The admin "places used" meter has the same gap
  (`summary.counts.places` counts trip places only) and a tenant can be refused while the meter shows room; a follow-up is filed (Risks).

### One copy rule (`src/lib/collections/dedupe.ts`, Resolved assumption 12)

`foldPlaceName` (NFC, lower-case, trim, collapse inner whitespace) and `placeDuplicateKey`. SQLite's `lower()` is ASCII-only and cannot do
NFC, so the comparison is made in application code, not in SQL. Two saved places are the same place when:

1. both have a non-null `source_place_id` and the ids are equal; or
2. `foldPlaceName(a.name) === foldPlaceName(b.name)` **and** their coordinates agree: both have a position and
   `round(lat, 4)` and `round(lng, 4)` are equal (about 11 m), or neither has one. A place without a position never matches one with a
   position.

Four decimals can miss a pair that straddles a rounding boundary; that adds a harmless duplicate, the reversible failure.

- The target list is read **once** as a projection - `id, name, lat, lng, source_place_id` where `organization_id = ? AND collection_id = ?`,
  two bound parameters - and compared in JavaScript, so the 100-parameter ceiling never meets it. A source set larger than 90 ids is read
  in chunks of at most 90 (`ID_FILTER_CHUNK` in `src/server/repos/trips.ts` is the precedent; the organisation takes one parameter).
- A seen-set inside the call makes two overlapping source lists add each place once.
- `saveTripPlacesToCollection` uses the same rule: a trip place already in the list is reported as `already saved`, not inserted.
- A place typed by hand (`addCollectionPlace`) is **not** de-duplicated: the traveller asked for that row.
- `selection.ts` calls the same function for the count the bar promises; the server's `{ added, skipped }` is authoritative.

### The batched writers (Resolved assumption 10)

Bulk writes build their statements in the repository and submit them in one `runBatch` of un-awaited builders:
`scope.db.insert(collectionPlaces).values(chunk)` with `organizationId: scope.ctx.organizationId` stamped on each row, chunked with
`chunkFor(boundParametersPerRow(collectionPlaces))` (3 rows a statement, 34 statements for 100 rows); the label join
(`collection_place_labels`, 4 columns) is 25 rows a statement. Updates and deletes by id are chunked at 90 (the organisation, plus the
patched value and `updated_at` for an update, take the other parameters). `MAX_BULK_PLACES = 100` and the arithmetic are pinned by a test
in the repository suite, as the change-a-collection spec pins its label numbers. The all-or-nothing tests run on a batch-capable
driver: `runBatch` falls back to sequential execution on one without `batch`, and that path is not atomic.

- A bulk copy appends: `sort_order` is `next + i` in source order.
- Unknown, foreign or unreadable ids make the whole call a `NotFoundError`; they are not skipped silently.
- `addLabelToPlaces` inserts with `onConflictDoNothing` (the primary key is `(collection_place_id, label_id)`) and checks that the label
  belongs to the collection of **every** selected place.

### Server functions (`src/routes/_app/-server/collections.ts`)

All `z.strictObject()` with the `error` parameter, all resolved through `appScope()`, all `POST` except the loads. Ids are `idSchema`.
Every bulk array is bounded (`.max(MAX_BULK_PLACES)`); copy targets at `MAX_COPY_TARGETS = 10`. Components receive the functions as
**props from the route file**; a component directory never imports a route's `-server/` folder (`src/components/console/index.ts`
states the seam). The boundary schemas are not `addCollectionPlaceInput` and `updateCollectionPlaceInput`: they omit `source`,
`externalId` and `sortOrder`, so provenance cannot be forged.

| Function (ticket)                   | Input                                                                                                                 | Behaviour                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadSharingFn` (a, `GET`)          | `{ collectionId }`                                                                                                    | `{ visibility: 'private' \| 'organization', isOwner, othersPlaces }`; `othersPlaces` counts places whose `saved_by` is not the owner. A stored `public` returns `organization`. |
| `setCollectionSharingFn` (a)        | `{ collectionId, visibility: 'private' \| 'organization' }`                                                           | Owner only. The schema accepts nothing else.                                                                                                                                    |
| `addPlaceFn` (b)                    | `{ collectionId, name, city?, countryCode?, address?, website?, phone?, notes?, priceMinor?, currency?, lat?, lng? }` | Position is both or neither (a Zod `superRefine`, the planner's rule). Quota asserted for one row. Returns `{ placeId }`.                                                       |
| `updatePlaceFn` (b)                 | the same fields plus `collectionPlaceId`, all optional but the id                                                     | Same pair rule; a blank string clears an optional field. Status stays on the change-a-collection function.                                                                      |
| `deletePlaceFn` (b)                 | `{ collectionPlaceId }`                                                                                               | Guarded by `requireOwnedCollection` of the place's collection.                                                                                                                  |
| `loadTripOptionsFn` (c, `GET`)      | `{}`                                                                                                                  | The trips the caller may read (`readableTrips`), newest first, each with its place count; bounded at 100.                                                                       |
| `loadTripPlacesFn` (c, `GET`)       | `{ tripId, collectionId }`                                                                                            | `requireTrip` first. The trip's places (bounded at 500) each marked `alreadySaved` by the duplicate rule against the list.                                                      |
| `addFromTripFn` (c)                 | `{ collectionId, tripId, placeIds: idSchema[] (max 100) }`                                                            | `requireReadableCollection`, `requireTrip(tripId)`, then every place must belong to that trip; one batch; returns `{ added, skipped }`.                                         |
| `loadPlaceListsFn` (c, `GET`)       | `{ collectionPlaceId }`                                                                                               | The lists the caller can read, each with `alreadyIn` by the duplicate rule, and the list the place is in.                                                                       |
| `savePlaceToCollectionsFn` (c)      | `{ collectionPlaceId, collectionIds: idSchema[] (max 10) }`                                                           | Calls `copyPlacesToCollections` with one source id; returns `{ added, skipped }`.                                                                                               |
| `loadCollectionPlacesFn` (d, `GET`) | `{ collectionId, status?, labels?, cursor? }`                                                                         | One page of 48 and the next cursor, same predicate as the loader. Called by "Show more".                                                                                        |
| `setPlacesStatusFn` (e)             | `{ collectionPlaceIds: idSchema[] (max 100), status }`                                                                | One chunked `UPDATE ... WHERE id IN (...)` batch.                                                                                                                               |
| `addLabelToPlacesFn` (e)            | `{ collectionPlaceIds: idSchema[] (max 100), labelId }`                                                               | See above.                                                                                                                                                                      |
| `copyPlacesFn` (e)                  | `{ collectionPlaceIds: idSchema[] (max 100), collectionIds: idSchema[] (max 10) }`                                    | `copyPlacesToCollections`; returns `{ added, skipped }` summed over the lists.                                                                                                  |
| `deletePlacesFn` (e)                | `{ collectionPlaceIds: idSchema[] (max 100) }`                                                                        | Every distinct collection of the ids is resolved with `requireOwnedCollection` before any row is removed.                                                                       |

**Resolution order for every two-sided call** (a source and a target): read the source rows by id inside the tenant, resolve each
distinct source collection with `requireReadableCollection`, resolve the target collection, and for a trip source `requireTrip(place.tripId)`;
only then count, check the quota and write. A trip place from a private trip the caller cannot read is a `NotFoundError`.

Money stays integer minor units plus a `text(3)` currency; no float amount appears anywhere in this stage.

### Paging, pins and one predicate (ticket 08-S9d, Resolved assumption 13)

- `collectionPlaceFilter(scope, { collectionId, status?, labelIds? })` is the **one exported predicate**. Statuses are one value (the screen
  keeps the single `status` of the change-a-collection spec; Resolved assumption 5). Labels are any-of as a correlated `EXISTS` over
  `collection_place_labels` (the `memberTripIds` sub-select is the precedent), **not** a materialised id list, so the filter has no
  parameter ceiling.
- `listCollectionPlacesFiltered(scope, input)` resolves `requireReadableCollection` first - unlike its sibling `listCollectionPlaces`,
  which answers a foreign or unreadable id with `[]` - because a paged read must be able to say "no such list" rather than "this list is
  empty", the caller pages until told to stop. Order is `sort_order asc, id desc` (unchanged, so no existing list reorders; ids are
  time-sortable, so ties on the default `0` are newest first); the keyset condition is
  `sort_order > s OR (sort_order = s AND id < i)`, served by `collection_places_collection_sort_idx`. Page size 48.
- `listCollectionPins(scope, input)` uses the same predicate and returns `{ pins, total, unmapped }`: `pins` is `id, name, lat, lng,
status` for matches **with** a position, in list order, capped at `MAX_PINS = 1000`; `total` is the match count; `unmapped` is how many
  matches have no position. When `pins.length < total - unmapped` the map says so ("Showing the first {count} pins").
- The route's `loaderDeps` takes `status` and `labels`; the loader returns the first page, the pins and `canManage`. A filter change
  re-runs it, so the list and the map cannot disagree. The cursor stays out of the URL; "Show more" appends to client state.
- Label links for a page are read for **at most 48 ids** in one statement; the whole-list read in `listCollectionPlacesWithLabels` is
  replaced (this ticket) or, where another caller remains, chunked at 90 (08-S9b).
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
  readonly provenance: { readonly tripName: string | null } | null // null when the place was not saved from a trip
}

interface CollectionDetailPayload {
  // existing fields unchanged, plus:
  readonly canManage: boolean // from the change-a-collection spec
  readonly sharing: Sharing
  readonly isOwner: boolean
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

`provenance.tripName` is the name of the source trip **only when the caller may read that trip** (`readableTrips`); a deleted trip
(`source_trip_id` is `NULL` after `ON DELETE SET NULL`) or one the caller cannot read gives `{ tripName: null }` and the sheet says
"Saved from a trip". A private trip's name never reaches a member who is not on it.

## 📝 UI/UX

Reused, not rebuilt: `Sheet`, `Dialog`, `Popover`, `DropdownMenu`, `Checkbox`, `Combobox`, `Button`, `IconButton`, `Chip`, `Badge`, `Card`,
`EmptyState`, `Skeleton`, `Alert`, `Toast`, `ScrollArea`, `Field`, `Input`, `Textarea`, the map setup in `src/components/map` and
`src/lib/map`, the `FilterBar` from `-ui/scaffold.tsx`, the change-a-collection spec's status picker and label controls, and
`parsePosition` / `formatCoordinate` from `src/lib/geo/position.ts` (the planner's place form pastes a position into either field and
fills both; this form does the same and copies no parser). `Pagination` is a numbered control and is **not** used; paging is "Show more".

### Sharing (08-S9a)

- The header shows the list's audience as a button for the owner and plain text for everyone else: "Everyone in this workspace" or
  "Only you". For the owner it opens the **sharing dialog**: two radios, each with its consequence written out ("Only you - nobody else
  in this workspace can see this list or its places", "Everyone in this workspace - members can view the list and add, edit and label
  places; the owner or an admin can remove them"), the current setting, and one line naming who may remove places.
- Choosing "Only you" on a list that holds places saved by others shows a `warning` `Alert` with the count ("{count} places saved by
  other people will stop being visible to them. Switching back shows them again.") before the save button.
- No third option, for the reason under Alternatives. The index card shows an "Only you" `Badge` (outline) on a private list and nothing
  on a shared one.
- The dialog is the radio pattern with an explicit **Save** (a write on choosing would save on every arrow press, WCAG 3.2.2). A failed
  save keeps the dialog open with the old selection and an inline alert; success closes it and the header updates through the router.

### Add and read a place (08-S9b)

- **Empty state.** The existing "Nothing saved here yet" copy is rewritten: it states the two ways that exist at this ticket ("Add a
  place yourself") and the third from ticket 08-S9c ("add places from one of your trips"), and **removes** the map and recommendation
  promises. No control is stubbed for search; a disabled control with no explanation is worse than none. An "Add a place" `Button` is
  in the page header actions for anyone who can write, and in the empty state.
- **`AddPlaceDialog` / `PlaceForm`.** Fields: name (required), city, country (`Combobox` of country names, stored as the ISO code),
  address, website, phone, notes, price and currency, and **latitude and longitude**. The position pair is labelled as the fallback it
  is ("Position - optional. Paste it from a map: both fields fill"), validated as a pair (both or neither) in the form and again in the
  server function. On save the dialog closes and focus returns to the "Add a place" trigger; a failed save keeps the values.
- **`PlaceSheet`** (`Sheet`, `--ease-drawer`): opens from a card. It reads the place closely - image, address, city and country with the
  flag the screen already renders, price with `tabular-nums`, website and phone as real links, notes, labels, the status picker (the
  change-a-collection control, one write path), who saved it, and the provenance line ("Saved from Kyoto, March 2026" only when the
  source trip is readable; otherwise "Saved from a trip"). Editing happens in the sheet, not on the card ("Edit" turns the body into the
  `PlaceForm`). "Save to other lists" is the `SaveToCollection` control (08-S9c). "Remove" is shown only when `canManage`, confirms and
  names the place. `Escape` closes and returns focus to the card that opened it.
- **Quota refusal.** A designed `Alert` on `--color-surface-2` inside the dialog or sheet: the planner's localised sentence for
  `QUOTA_EXCEEDED` and its "See plans" link, opening in a new tab so the draft survives. It does not name the ceiling or the plan
  (Resolved assumption 14). A quota refusal is the one error here a traveller can act on by upgrading.

### From a trip, and save to several lists (08-S9c)

- **`FromTripDialog`** (`Dialog`, two steps): step one lists the trips the caller can read with their place counts (a trip with no
  places is listed, disabled, with its reason); step two lists that trip's places, each a `Checkbox`, with the ones already in the list
  pre-unchecked and marked "Already in this list". The footer states how many will be added and the button carries the same number
  (`tabular-nums`). The result is announced ("{added} added, {skipped} already there") and focus returns to the trigger.
- **`SaveToCollection`**: a list of the lists the caller can read, each a `Checkbox`; a list the place is already in is shown checked and
  `aria-disabled` with "Already saved" rather than offered twice. It takes the lists and an `onSave(collectionIds)` callback and knows
  nothing about where it was rendered, so a trip screen can mount it later without rework; **nothing else is built for that case now**.

### Narrow and map (08-S9d)

- **Layout.** At 1280px and above the list and the map sit side by side with the list holding its measure; at 360px the map is a
  collapsible strip above the list (a `Button` with `aria-expanded`, collapsed by default on small screens) and the sheet is full height.
- **`CollectionMap`.** The pins of `listCollectionPins`, through `MapCanvas` and the existing marker components, with the map's keyboard
  support (`useRovingFocus`); selecting a pin opens the sheet, selecting a card highlights the pin, from one reducer; it publishes the
  `[data-map-ready]` marker every map wrapper publishes. The status colours follow the badge tones.
- **States.** _Empty map:_ when no match has a position the map is not rendered and a line says how many places have none, with a link
  that opens the first one's sheet in edit mode. _Skeleton:_ `CardsSkeleton` for the list and a placeholder at the settled map height so
  the two columns do not resize each other. _Filtered to nothing:_ the existing state with its reset action and the hidden count.
  _Truncated pins:_ the "Showing the first {count} pins" note. _Error:_ a failed page or pins read is an `Alert` with a retry that keeps
  what is already on screen.
- **Show more** is a `Button` below the list (`aria-busy` while it loads); it appends and announces "{count} more places loaded".

### Act on a selection (08-S9e)

- **Selection.** Each card has a `Checkbox` named after the place (`data-part="collection-place-select"`). Selection is an id set over
  the loaded places, capped at `MAX_BULK_PLACES`; at the cap the unchecked boxes are `aria-disabled` and described by "{count} of
  {max} selected - most you can act on at once". A filter change prunes the selection to what is still visible, and a destructive
  action acts only on rows currently visible **and** selected.
- **`BulkBar`.** Appears when the selection is not empty: the count, then four actions - set status (menu of the five), add label
  (menu of the collection's labels), copy to other lists (the `SaveToCollection` list in a popover, up to ten), remove (only when
  `canManage`). Remove confirms and names the count. The bar is `position: sticky` at the bottom on small screens and inline on large,
  reserves its own height, and never covers the last row. `Escape` clears the selection and returns focus to the first card.
- **Outcome.** Every bulk action is all-or-nothing. Success announces the result (for a copy, "{added} added, {skipped} already there");
  a failure says **nothing was changed** and offers retry of the whole action; the selection is kept either way. While a bulk write
  is in flight the bar's button takes `loading` and the selected rows are `aria-busy`.

### Motion and tokens

The sheet uses `--ease-drawer`; the bulk bar enters on 200ms opacity and 8px translate on `--ease-out-quint`; cards stagger 20ms,
capped at eight. `prefers-reduced-motion: reduce` collapses all of it to opacity. Spacing from `--space-*`; every price and every count
carries `tabular-nums`. **No token is missing.** Logical properties throughout (right-to-left).

## 📝 Visual change expected

`/collections/$collectionId`, light and dark, 360x800, 1280x900 and 2560x1440:

- 08-S9a: the header audience (owner and member), the sharing dialog (both choices, the warning with a count, saving, failed), the
  screen as a member who cannot read a private list (the not-found panel).
- 08-S9b: the empty state with its one new action, the add dialog (empty, with a position, a field error, the quota alert), the place
  sheet (full, sparse, provenance readable and not, editing, remove confirmation).
- 08-S9c: the from-a-trip dialog (both steps, an already-saved row, the footer count), the save-to-lists popover.
- 08-S9d: the side-by-side list and map, the map strip collapsed and open at 360px, the empty-map line, the truncated-pins note, the
  list with "Show more", filtered to nothing.
- 08-S9e: two cards selected with the bar, the cap message, the remove confirmation, a failed action.
- `/collections` (the index): an "Only you" chip on a private list's card; nothing else changes.

## 📝 Copy

All new keys go to `src/lib/i18n/messages/en/modules.ts`, written **without** the `modules.` prefix and read as `modules.collections.*`,
and land in all 23 locales in the same change (`i18n-messages` skill). Every plural key varies on `{count}` only (`resolveMessage`
picks a plural form from `count` alone), carries every category each locale needs and writes its `one` form with `{count}` too. The keys
below are the **full set**; each is read by a component of this stage, and a key lands with the first component that reads it. Keys the
change-a-collection spec defines (`status.*`, `filtered.*`, `card.*`, `statusPicker.*`, `labels.*`) are reused, not redefined; its
`empty.body` is **rewritten** in all locales (same key, new text) when that spec has landed, and replaces the hard-coded English at
`$collectionId.tsx` when it has not.

| Key (en)                                                                                            | Text                                                                                                            | Ticket |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| `sharing.everyone`                                                                                  | Everyone in this workspace                                                                                      | a      |
| `sharing.onlyYou`                                                                                   | Only you                                                                                                        | a      |
| `sharing.button`                                                                                    | Change who can see this list                                                                                    | a      |
| `sharing.title`                                                                                     | Who can see this list                                                                                           | a      |
| `sharing.everyone.body`                                                                             | Members can view the list and add, edit and label places. The owner or an admin can remove them.                | a      |
| `sharing.onlyYou.body`                                                                              | Nobody else in this workspace can see this list or its places.                                                  | a      |
| `sharing.removers`                                                                                  | Only the owner or a workspace admin can remove places or delete the list.                                       | a      |
| `sharing.warning`                                                                                   | {count} places saved by other people will stop being visible to them. Switching back shows them again. (plural) | a      |
| `sharing.save` / `sharing.cancel`                                                                   | Save / Cancel                                                                                                   | a      |
| `sharing.failed`                                                                                    | We could not change who can see this list. Nothing was changed.                                                 | a      |
| `sharing.ownerOnly`                                                                                 | Only the owner can change this.                                                                                 | a      |
| `card.onlyYou`                                                                                      | Only you                                                                                                        | a      |
| `add.button`                                                                                        | Add a place                                                                                                     | b      |
| `add.title` / `add.edit`                                                                            | Add a place / Edit place                                                                                        | b      |
| `add.name` / `add.city` / `add.country` / `add.address` / `add.website` / `add.phone` / `add.notes` | Name / City / Country / Address / Website / Phone / Notes                                                       | b      |
| `add.price` / `add.currency`                                                                        | Price / Currency                                                                                                | b      |
| `add.position`                                                                                      | Position (optional)                                                                                             | b      |
| `add.position.hint`                                                                                 | Paste a position from a map: both fields fill.                                                                  | b      |
| `add.latitude` / `add.longitude`                                                                    | Latitude / Longitude                                                                                            | b      |
| `add.position.pair`                                                                                 | Enter both latitude and longitude, or leave both empty.                                                         | b      |
| `add.save` / `add.saving`                                                                           | Save place / Saving...                                                                                          | b      |
| `add.failed`                                                                                        | We could not save this place. Your entries are still here.                                                      | b      |
| `quota.reached`                                                                                     | Your workspace has reached the number of places its plan includes.                                              | b      |
| `quota.seePlans`                                                                                    | See plans                                                                                                       | b      |
| `empty.add`                                                                                         | Add a place                                                                                                     | b      |
| `empty.body`                                                                                        | Add a place yourself, or add places from one of your trips. (rewritten)                                         | b / c  |
| `sheet.title`                                                                                       | {name}                                                                                                          | b      |
| `sheet.close`                                                                                       | Close                                                                                                           | b      |
| `sheet.edit` / `sheet.remove`                                                                       | Edit / Remove place                                                                                             | b      |
| `sheet.notes` / `sheet.noNotes`                                                                     | Notes / No notes yet                                                                                            | b      |
| `sheet.phone` / `sheet.website`                                                                     | Phone / Website                                                                                                 | b      |
| `sheet.savedBy`                                                                                     | Saved by {name}                                                                                                 | b      |
| `sheet.provenance`                                                                                  | Saved from {trip}, {month}                                                                                      | b      |
| `sheet.provenance.unknown`                                                                          | Saved from a trip                                                                                               | b      |
| `sheet.removeConfirm`                                                                               | Remove {name} from this list? This cannot be undone.                                                            | b      |
| `sheet.removeFailed`                                                                                | We could not remove this place. Nothing was changed.                                                            | b      |
| `fromTrip.button`                                                                                   | Add from a trip                                                                                                 | c      |
| `fromTrip.title`                                                                                    | Add places from a trip                                                                                          | c      |
| `fromTrip.pickTrip`                                                                                 | Choose a trip                                                                                                   | c      |
| `fromTrip.noPlaces`                                                                                 | This trip has no places yet.                                                                                    | c      |
| `fromTrip.noTrips`                                                                                  | You have no trips to copy from yet.                                                                             | c      |
| `fromTrip.already`                                                                                  | Already in this list                                                                                            | c      |
| `fromTrip.add`                                                                                      | Add {count} places (plural)                                                                                     | c      |
| `fromTrip.result`                                                                                   | {count} places added. (plural; the skipped part is `copy.skipped`)                                              | c      |
| `copy.skipped`                                                                                      | {count} were already there. (plural)                                                                            | c      |
| `copy.failed`                                                                                       | We could not copy these places. Nothing was changed.                                                            | c      |
| `saveTo.button`                                                                                     | Save to other lists                                                                                             | c      |
| `saveTo.title`                                                                                      | Save {name} to                                                                                                  | c      |
| `saveTo.already`                                                                                    | Already saved                                                                                                   | c      |
| `saveTo.save`                                                                                       | Save                                                                                                            | c      |
| `saveTo.empty`                                                                                      | You have no other lists to save to.                                                                             | c      |
| `map.label`                                                                                         | Map of the places in this list                                                                                  | d      |
| `map.toggle`                                                                                        | Show map / Hide map                                                                                             | d      |
| `map.empty`                                                                                         | None of these {count} places has a position yet. (plural)                                                       | d      |
| `map.fixFirst`                                                                                      | Add a position to the first one                                                                                 | d      |
| `map.truncated`                                                                                     | Showing the first {count} pins. (plural)                                                                        | d      |
| `list.showMore`                                                                                     | Show more                                                                                                       | d      |
| `list.loaded`                                                                                       | {count} more places loaded (plural)                                                                             | d      |
| `list.loadFailed`                                                                                   | We could not load more places.                                                                                  | d      |
| `bulk.selected`                                                                                     | {count} selected (plural)                                                                                       | e      |
| `bulk.select`                                                                                       | Select {name}                                                                                                   | e      |
| `bulk.cap`                                                                                          | {count} selected - the most you can act on at once. (plural)                                                    | e      |
| `bulk.status` / `bulk.label` / `bulk.copy` / `bulk.remove`                                          | Set status / Add label / Copy to other lists / Remove                                                           | e      |
| `bulk.removeConfirm`                                                                                | Remove {count} places from this list? This cannot be undone. (plural)                                           | e      |
| `bulk.failed`                                                                                       | Nothing was changed. You can try again.                                                                         | e      |
| `bulk.done`                                                                                         | Done. (live-region text for a status or label change; copy and remove use `fromTrip.result`/`copy.skipped`)     | e      |
| `bulk.clear`                                                                                        | Clear selection                                                                                                 | e      |

## 📝 Edge Cases & Failure Scenarios

| Case                                                                               | Behaviour                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A member opens, lists, counts or writes into another member's `private` list by id | `NotFoundError` from every reader and every writer keyed by a place or label id, admins included; the country aggregate and the index counts leave the list out                                            |
| A stored `public` row                                                              | Reads and writes as `organization`; the dialog shows "Everyone in this workspace"                                                                                                                          |
| The owner leaves the workspace holding a private list                              | Readable by nobody; not counted against `collections` or the admin meter; counts again if the owner returns; its places keep counting against `places`                                                     |
| An admin tries to change a list's sharing                                          | `ForbiddenError` for a list they can read (the menu does not offer it); `NotFoundError` for a private one                                                                                                  |
| Switch to "Only you" with other people's places in the list                        | The dialog shows the count; allowed; nothing deleted; switching back restores their view                                                                                                                   |
| A member forges `deletePlaceFn` / `deletePlacesFn`                                 | `ForbiddenError` after the readable lookup; nothing removed                                                                                                                                                |
| `addFromTripFn` with a place of a private trip the caller is not on                | `NotFoundError` from `requireTrip`; zero rows written                                                                                                                                                      |
| `addFromTripFn` with ids that belong to another trip, or are foreign               | `NotFoundError`; zero rows written                                                                                                                                                                         |
| A bulk copy over the `places` ceiling                                              | `QuotaExceededError`, zero rows written (no prefix); the dialog or bar shows the quota alert and nothing changed                                                                                           |
| Copying a set into a list that already holds some of it                            | Those are skipped, not an error; `{ added, skipped }` is announced; copying the same set twice adds nothing                                                                                                |
| Two overlapping source lists copied in one call                                    | The seen-set adds each place once                                                                                                                                                                          |
| A place typed twice by hand                                                        | Allowed (the traveller asked for it)                                                                                                                                                                       |
| A latitude without a longitude (or the reverse), by form or by a forged request    | Field error in the form; a Zod refusal on the server; nothing written                                                                                                                                      |
| A latitude out of range                                                            | The existing `lat`/`lng` bounds refuse it                                                                                                                                                                  |
| A forged `source`, `externalId` or `sortOrder`                                     | Refused by the strict boundary schema                                                                                                                                                                      |
| 101 ids in a bulk call                                                             | Zod refusal at the boundary; nothing written                                                                                                                                                               |
| An id in a bulk call that was removed by someone else a moment ago                 | `NotFoundError`; nothing changed; the screen re-reads                                                                                                                                                      |
| A bulk write fails midway (driver error)                                           | One batch: it changes nothing; the bar says so and offers a retry of the whole action                                                                                                                      |
| The list has more than 99 saved places                                             | The loader reads label links for a page of 48; no statement binds more than 100 parameters                                                                                                                 |
| A list with more than 1000 mapped matches                                          | The first 1000 pins in list order and the "Showing the first {count} pins" note                                                                                                                            |
| A filter change while places are selected                                          | The selection is pruned to what is still visible; a destructive action acts only on visible, selected rows                                                                                                 |
| "Show more" while another tab removed the cursor row                               | The keyset condition still resumes after the cursor position; no row repeats                                                                                                                               |
| The source trip was deleted, or is private to the caller                           | `source_trip_id` is null or unreadable; the sheet says "Saved from a trip" and never names the trip                                                                                                        |
| A place with no position                                                           | Listed, no pin; counted in `unmapped`; the empty-map line links to it                                                                                                                                      |
| WebGL unavailable                                                                  | The map's own engine notice; the list works                                                                                                                                                                |
| Double-tap on any control                                                          | A focused control is never given `disabled` (focus would be lost): it is `aria-disabled="true"` and ignores activations while its write is in flight; the writes are idempotent or refused the second time |
| Dropped connection mid-save                                                        | The dialog or sheet stays open with its values and a retry                                                                                                                                                 |
| Right-to-left, 23 locales                                                          | Logical properties; directional icons mirror; the parity test covers the keys                                                                                                                              |

## ✅ Acceptance criteria

08-S9a:

1. `readableCollectionFilter`, `inReadableCollection` and `requireReadableCollection` exist once; `listCollections`, `getCollection`,
   `getCollectionBySlug`, `listCollectionsWithCounts`, `listCollectionPlaces`, `listCollectionPlacesWithLabels`, `listLabels`,
   `countCollectionPlacesByCountry`, `nextCollectionPlaceSortOrder`, `updateCollectionPlace`, `setCollectionPlaceStatus`,
   `deleteCollectionPlace`, `setCollectionPlaceLabels` and the label writers all go through them.
2. For a non-owner, a `private` list is invisible to every reader above (including the country aggregate and the counts) and raises
   `NotFoundError` on every writer, a workspace admin included; a stored `public` row behaves as `organization`.
3. `setCollectionSharing` is owner-only (`ForbiddenError` otherwise, after the readable lookup) and its input accepts `private` and
   `organization` only; `loadSharingFn` reports `othersPlaces`.
4. `countCollectionsAgainstPlan` leaves out a private list whose owner has left; `createCollection` and `loadAdmin` use it; it counts again if the owner returns.
5. The header shows the real audience; the sharing dialog saves with an explicit button and warns with the count; the index shows the "Only you" chip.
6. No closed list changes: `AUTHORED_ERROR_NAMES` and the public failure codes are as before.
7. The tenant-isolation and member-isolation blocks below pass; the ticket carries `risk-high` and `security` and merges on a security and tenancy specialist's approving verdict on its diff.

08-S9b:

8. `assertSavedPlaceQuota` runs once before the write in `addCollectionPlace`; a workspace at its `places` ceiling gets `QuotaExceededError` and no row, while an identical workspace under its own ceiling succeeds.
9. `addPlaceFn` and `updatePlaceFn` are strict objects with no `source`, `externalId` or `sortOrder`; a lone latitude or longitude is refused on the server and in the form.
10. The add dialog, the place sheet (read, edit, remove with `canManage`) and the provenance rule work as specified; a private trip's name never appears for a member who is not on it.
11. The empty state offers only paths that exist, in the catalogue, in 23 locales; the quota alert uses the localised sentence and the "See plans" link.
12. A list of 150 saved places loads (no statement binds more than 100 parameters).

08-S9c:

13. `saveTripPlacesToCollection` calls `requireTrip`; a place of an unreadable trip is `NotFoundError`; the single-place function delegates to it.
14. The duplicate rule matches on `source_place_id` first and on the normalised name-and-position second; copying the same set twice adds nothing; copying two overlapping lists adds each place once; the count the dialog promises equals the server's for the same input.
15. `copyPlacesToCollections` resolves every source and target in the caller's scope before any write, asserts the quota once with the post-de-duplication count, and writes in one batch.

08-S9d:

16. The list and the pins read the same `collectionPlaceFilter`; a list and its map never disagree about which places match.
17. `listCollectionPlacesFiltered` raises `NotFoundError` for a foreign or unreadable collection where `listCollectionPlaces` returns `[]`; both are asserted.
18. Paging is by keyset on `(sort_order asc, id desc)` at 48; the cursor is not in the URL; label filtering is an `EXISTS`.
19. The client-side predicate no longer exists beside the server one.

08-S9e:

20. Each bulk function is bounded at 100 ids, resolves every id inside the caller's scope first, and is all-or-nothing; removal requires `requireOwnedCollection` of every distinct collection.
21. A bulk copy that would exceed the ceiling writes nothing; the arithmetic (`MAX_BULK_PLACES * boundParametersPerRow`, 34 statements for 100 places) is pinned by a test.
22. The bar appears only with a selection, states the count, confirms before removing, is reachable by keyboard, prunes on filter change and never covers the last row.

All tickets:

23. Every new user-facing string is in the 23-locale catalogue (`coverage.test.ts`, the parity test and `copy-rules.test.ts` stay green).
24. Light and dark, 360px to 2560px, WCAG 2.2 AA, a silent console, no layout shift after the settle mark.
25. `CONTEXT.md` gains the terms above in the ticket that first uses them.

## 📝 Risks & Impact Review

| Risk                                                                                                                   | Severity | Mitigation / disposition                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turning the read rule on hides lists that members could open yesterday: stored `private` rows become the owner's alone | high     | That is the rule the product has always promised. Stored `public` rows keep working as workspace lists. Stated in the PR body of 08-S9a; reversible by switching the list to "Everyone in this workspace"             |
| A writer keyed by a place or label id that is missed lets a member write into a private list                           | high     | The list in "The read rule" is enumerated; the member-isolation block asserts `NotFoundError` on every one; a future writer fails review if it resolves a collection without the predicate                            |
| A stranded private list is unreachable                                                                                 | medium   | Same as trips and journals; out of the quota count; whether an admin may reach it is the open question already filed (#807), widened to collections. The slicer adds a comment there; this spec files none itself     |
| The admin "places used" meter counts trip places only while collection writes now count both tables                    | medium   | A tenant can be refused while the meter shows room. **The slicer files one follow-up issue** (make the meter and `createPlace` use `countSavedPlaces`); `Blocked by` nothing                                          |
| The collection -> trip import needs the same role guard `requireEditablePlan` gives the planner                        | medium   | Not this stage's code. **The slicer files one follow-up issue** naming the places-and-maps plan's import stage: its writer needs `requireWritableTrip` and `assertTripRole(['owner','editor'])` inside the repository |
| Counting both tables against `places` changes what the published number buys                                           | medium   | The plan's commercial term, inherited and recorded (Resolved assumption 11); changing it is a person's call                                                                                                           |
| Removal needs the owner or an admin; a member who adds a place by mistake cannot remove it                             | low      | `rejected` is the reversible remedy; loosening later is additive (Resolved assumption 8)                                                                                                                              |
| A 100-place bulk insert is 34 statements in one batch                                                                  | low      | Within D1's batch; tested for atomicity and the statement count                                                                                                                                                       |
| The duplicate key's 4-decimal rounding misses a boundary-straddling pair                                               | low      | A harmless extra row; the failure is the reversible one                                                                                                                                                               |
| Pins are capped at 1000 per list                                                                                       | low      | Noted on screen; a pro workspace may hold 20000 in total, not in one list in practice                                                                                                                                 |
| Reversing #1106's "no visibility badge"                                                                                | low      | Deliberate and only for true states (Neighbouring work)                                                                                                                                                               |
| A tenant at its ceiling is refused with a sentence and a link, not the ceiling and plan                                | low      | The closed failure-code contract (Problem Statement, Resolved assumption 14)                                                                                                                                          |

### Out of scope

Search-and-add (no search component yet); copying a list's places into a trip (another plan's import stage); a "save to list" control on
the planner's place card (trip screens); `public` collections and a share token; per-list member roles; reassigning a collection's owner;
reordering places; a collection cover; text and country filters on the detail screen; multi-status filtering; a "select all matches"
action; soft delete; the `places` meter fix in `overview.ts` and `dashboard.ts`; making `createPlace` count both tables.

### Blockers

- **Search-and-add is absent, not blocked.** ADR 0013 closed the geocoding decision, and the place-search stage of the places-and-maps
  plan is scheduled after this stage. Disposition: **scope** - every path into a list that does not need a search component ships here;
  the entry point is absent rather than disabled; that stage closes `ADD-10`. Nothing shipped here waits for it.
- **A public collection is not offered.** `collections.visibility` allows `public` and nothing can serve it: no `public_token`
  column and no unauthenticated route. Disposition: **defer** - it needs a column and a route; the picker offers the two enforceable values.
- No package outside the `docs/SPEC.md` §3 pinned set, no binding, no third-party service, no schema change.

### Reference-row disposition

`ADD-10` stays `partial` (the plan closes it `absent -> partial` as well): the leftovers are search-and-add (the place-search stage) and
collection -> trip (the places-and-maps plan's import stage).

## 📋 Phasing

Five tickets, in order. None is a horizontal layer: each ships a repository change, its server functions, the screen and its tests.

## 📋 Implementation Plan

### Phase 1 - who may read and write a list (08-S9a)

1. Repository: the three read-rule functions; route every reader and id-keyed writer through them (list in "The read rule");
   `strandedCollectionFilter`, `countCollectionsAgainstPlan`; `setCollectionSharing`; `requireOwnedCollection` and
   `collectionDeleteSummary` start from `requireReadableCollection`.
2. `-server/collections.ts`: `loadSharingFn`, `setCollectionSharingFn`; `loadCollectionDetail` gains `sharing`, `isOwner`; `loadAdmin`
   uses the count.
3. `sharing-dialog.tsx`, the header audience, the index chip; the copy keys of ticket a in 23 locales.
4. Tests: the member-isolation and tenant-isolation blocks; the stranded-count test; the dialog; `CONTEXT.md` entries.

### Phase 2 - add a place by hand and read it closely (08-S9b)

1. `saved-places.ts` and its test; `addCollectionPlace` asserts the quota; `listCollectionPlacesWithLabels` reads label links in chunks of 90.
2. `-server/collections.ts`: `addPlaceFn`, `updatePlaceFn`, `deletePlaceFn`; the loader's `SavedPlaceRow` gains the fields and the readable provenance.
3. `place-form.tsx`, `add-place-dialog.tsx`, `place-sheet.tsx`; the rewritten empty state; ticket b's keys in 23 locales.
4. Tests: quota isolation case, strict schemas, the pair rule, the sheet, focus return.

### Phase 3 - add from a trip, and save to several lists (08-S9c)

1. `dedupe.ts` and its test; the shared insert builder; `saveTripPlacesToCollection` (with `requireTrip`) and `copyPlacesToCollections`.
2. `-server/collections.ts`: the five functions of ticket c.
3. `from-trip-dialog.tsx`, `save-to-collection.tsx`, mounted on the empty state, the header and the sheet; ticket c's keys.
4. Tests: three isolation cases (below), the duplicate rule, atomicity.

### Phase 4 - narrow the list and the map together (08-S9d)

1. `collectionPlaceFilter`, `listCollectionPlacesFiltered`, `listCollectionPins`; the pin and page arithmetic tests.
2. Loader deps, `loadCollectionPlacesFn`, the payload; delete the client predicate.
3. `collection-map.tsx`, `load-more.tsx`, the layout, the empty-map line; the route declared `map: true` in the spec's route case.
4. Ticket d's keys; the browser spec for filters and the map.

### Phase 5 - act on a selection (08-S9e)

1. `selection.ts` and its test; the four bulk functions and repository writers (chunked, one batch).
2. `bulk-bar.tsx`; ticket e's keys.
3. Tests: all-or-nothing, the 101-id refusal, the ceiling case, the bar, the browser journey.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Tenant isolation, `src/server/repos/__tests__/tenant-isolation.test.ts` (one `describe`): in A's scope against B's ids,
  `addCollectionPlace` parented on B's collection, `updateCollectionPlace`, `deleteCollectionPlace`, `setCollectionPlaceLabels`,
  `listCollectionPlacesFiltered` on B's collection each reject with `NotFoundError` and B's `collection_places` count is unchanged;
  beside it, `listCollectionPlaces(scopeA, { collectionId: bId })` returns `[]` (it does not throw), asserted so the new read's refusal
  is not read as a property the whole module had. Three two-id cases are the point of the block:
  1. `saveTripPlaceToCollection(scopeA, { collectionId: aList, placeId: bPlace })` - A's list, B's place: rejects, writes nothing;
  2. `copyPlacesToCollections(scopeA, { fromIds: [bCollectionPlaceId], toCollectionIds: [aList] })` - A's count unchanged, not merely a throw;
  3. `saveTripPlacesToCollection(scopeA, { collectionId: aList, tripId: bTripId, placeIds })` - `NotFoundError`, A's count unchanged.
     Plus the quota case: with the `places` ceiling reached by A's own rows (collections and trips together), `saveTripPlaceToCollection` in
     A's scope throws `QuotaExceededError` and writes nothing, while B's identical call under B's own ceiling succeeds.
- Member isolation, `src/server/repos/__tests__/member-isolation.test.ts` (a collections block): for a non-owner a private list is
  invisible to every reader of 08-S9a and raises `NotFoundError` on every id-keyed writer, admin included; `loadAdmin`'s list and counts
  leave it out; a stored `public` row reads as `organization`; an admin cannot change sharing; `saveTripPlaceToCollection` with a place
  of a private trip the caller cannot read is `NotFoundError`; a stranded private list is out of `countCollectionsAgainstPlan` and counts again when the owner returns.
- Repository suite (`repositories.test.ts`, the `server` project, a batch-capable driver): `MAX_BULK_PLACES * boundParametersPerRow(collectionPlaces)`
  is chunked to 34 statements for 100 rows and no statement binds over 100 parameters; every inserted row carries the caller's
  `organizationId`; a bulk copy over the ceiling writes nothing; a failed batch changes nothing; the duplicate rule on `source_place_id`
  first and on the normalised triple second; a list of 150 places loads; keyset paging neither skips nor repeats a row across ties.
- Server-function tests (`src/routes/_app/-server/__tests__/collections.test.ts`): `private` is `NotFoundError` for a non-owner and not
  a forbidden; a `member` may add a place to an `organization` list and may not remove it or delete the list; a 101-id bulk input is
  refused; the strict schemas refuse `source`, `externalId`, `sortOrder` and a lone coordinate.
- Component tests (`src/components/collections/__tests__/`): `selection.test.ts`, `place-sheet.test.tsx` (provenance renders only when
  the trip is readable; `Escape` closes and returns focus to the opener), `bulk-bar.test.tsx` (appears only with a selection; confirms;
  reachable by keyboard; prunes on filter change), `save-to-collection.test.tsx` (several lists in one call; an already-saved list is
  shown as such), `sharing-dialog.test.tsx` (warning with the count; explicit save), `dedupe.test.ts`.
- Browser: `e2e/product-modules.spec.ts`, a `test.describe('08-S9 ...')` on the seeded workspace: add a place by hand, open its sheet,
  filter, select two cards and copy them, the map latches `[data-map-ready]` (the spec builds a `collectionRoute(collectionId)`
  `RouteCase` with `map: true`, as `planRoute` does for the planner, so `settleMap()` audits the declaration both ways), the console
  silent. No baselines (ADR 0016). Evidence for review is the blind A/B pair from `scripts/visual/capture.mjs`, e.g.
  `node scripts/visual/capture.mjs --url "http://localhost:$PORT/collections/<id>" --out <dir> --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map --state sheet --click '[data-part="collection-place-card"]'`
  and `--state bulk` with two cards selected via `--click '[data-part="collection-place-select"]'`. Every selector is a `data-part`
  attribute this stage publishes.
- Layout shift after the settle mark is asserted at 0 on `chromium` (the bulk bar is `sticky` and reserves its own height, the map
  strip reserves its settled height) and stated as a skip on `mobile-safari`.

## Resolved assumptions (autonomous defaults)

| #   | Question                                           | Applied default                                                                                                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which ways into a list ship?                       | Add by hand, add from a trip (a picker on the collection screen), list-to-list copy; `SaveToCollection` rebuilt as the multi-list control on the sheet; nothing edited in trip screens                                                             | Decided by product owner sub-agent (confidence medium): the block's own empty state promises "Copy from a trip"; a component mounted nowhere leaves "saving them" unmet; editing the planner's place card edits files other stages claim                                                                                                                                                                                                                                                                                          |
| 2   | Is search-and-add in this stage?                   | No; absent rather than stubbed; `ADD-10` stays `partial`. The block's "MAP-02 is BLOCKED" premise is stale (ADR 0013), which changes the reason, not the outcome                                                                                   | Decided by product owner sub-agent (medium): no search component exists and the place-search stage is later in the schedule                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | Is `copyPlacesToTrip` built here?                  | No; the bulk bar has four actions. The collection -> trip direction belongs to the places-and-maps plan's import stage with its `createPlaces`; no `dayId` crosses this stage                                                                      | Decided by product owner (medium) and software architect (medium-high) sub-agents: one concept, one owner (`docs/SPEC.md` §8); a loop over `createPlace` asserts the quota per row and has no role or archive check; a second writer of `places` rows is forbidden                                                                                                                                                                                                                                                                |
| 4   | The reference row's viewer / editor / admin roles  | Mapped onto the two authorities that exist: the list's owner and the caller's workspace role; no member table, no migration                                                                                                                        | Plan decision, verified (`collections.visibility` is the only column; `hasAtLeastRole`, `src/server/repos/context.ts`): a second rank system nobody administers is the wrong answer even with a migration                                                                                                                                                                                                                                                                                                                         |
| 5   | Status filter: one status or several?              | One: `status?` as the change-a-collection spec has it; labels any-of                                                                                                                                                                               | Decided by product owner sub-agent (medium): that spec published the contract; no user need asks for several statuses and adding them later is additive                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | Read rule per `visibility`, and admins             | `private` is the owner's alone, no admin exception, `NotFoundError` for everyone else; a stranded private list is readable by nobody and out of the quota count; whether an admin may reach it stays with the open question for trips and journals | Decided by security and tenancy sub-agent (confidence medium): ADR 0007 / `strandedTripFilter` and ADR 0034 / `countedJourneyFilter` are the precedent; the narrowest read is the most reversible (ADR 0034: the reader set can be widened later); an admin reading others' private content is a new policy                                                                                                                                                                                                                       |
| 7   | Stored `public` rows                               | Read and write as `organization`; the dialog shows "Everyone in this workspace" and rewrites the value only on save                                                                                                                                | Decided by security and tenancy sub-agent (medium): the creator asked for something wider than the workspace; trips ignore `public` because a share token could publish a private trip, and collections have no token column; hiding them would silently take away other members' places                                                                                                                                                                                                                                          |
| 8   | Who may remove a place, and change sharing?        | Remove (one or many): the list's owner or a workspace admin. Change sharing: **the owner only**. Any member who can read the list may add, edit, status, label and copy into it                                                                    | Sharing: decided by security and tenancy sub-agent (medium) - an admin switching a departed owner's list to private makes it unreadable with no way back; this departs from the plan's "owner or admin". Removal: the security sub-agent recommended also admitting the saver; the software architect sub-agent recommended owner or admin only; the architect's option is applied as the more reversible one (loosening is additive), as `afk-decide` requires when specialists disagree, with `rejected` as the member's remedy |
| 9   | Switching a list with others' places to "Only you" | Allowed, with a warning that counts them; nothing is deleted                                                                                                                                                                                       | Decided by security and tenancy sub-agent (medium): reversible; blocking would make "Only you" useless on any list that has been shared                                                                                                                                                                                                                                                                                                                                                                                           |
| 10  | Bulk size and atomicity                            | 100 ids, every statement chunked inside one `runBatch`, all-or-nothing, result `{ added, skipped }`; the plan's partial-success copy is rewritten                                                                                                  | Decided by software architect sub-agent (high): 26 columns => 3 rows a statement, 34 statements; the real constraint is the 100-parameter ceiling on `IN` reads and writes, which chunking fixes at any cap; a lower cap helps nothing                                                                                                                                                                                                                                                                                            |
| 11  | The saved-place quota                              | `places`, counting `collection_places` + `places`, one helper in a neutral `saved-places.ts`, asserted once with the post-de-duplication count; `createPlace` and the admin meter left asymmetric and recorded                                     | Decided by software architect sub-agent (medium): the plan's commercial term, inherited (product owner: a person's call to change); the helper cannot live in `collections.ts` because `places.ts` will need it and `collections.ts` imports `places.ts`                                                                                                                                                                                                                                                                          |
| 12  | The duplicate rule                                 | `source_place_id` first, then folded name + coordinates rounded to 4 decimals (both-null matches), compared in JavaScript against one projection of the target list; hand-typed adds are not de-duplicated                                         | Decided by software architect sub-agent (high): SQLite `lower()` is ASCII-only and cannot NFC; the projection binds two parameters; a boundary miss adds a harmless duplicate                                                                                                                                                                                                                                                                                                                                                     |
| 13  | List, pins and paging                              | One exported predicate, a keyset page of 48 on `(sort_order asc, id desc)`, a pins read capped at 1000 with a note, loader deps and no cursor in the URL, "Show more" appends; selection is an id set over loaded rows capped at 100               | Decided by software architect sub-agent (medium): pro allows 20000 places; `id desc` is kept so no existing list reorders; the list and the map read one predicate and cannot disagree                                                                                                                                                                                                                                                                                                                                            |
| 14  | The quota panel "naming the ceiling and the plan"  | The planner's localised sentence for `QUOTA_EXCEEDED` plus its "See plans" link                                                                                                                                                                    | Decided by product owner sub-agent (medium): the boundary strips the metric, limit and plan by contract (`src/lib/errors.ts` `PublicFailureCode`); widening it is a closed-list change this stage does not own                                                                                                                                                                                                                                                                                                                    |
| 15  | Coordinates for hand-added places                  | Optional latitude / longitude pair, both or neither, enforced in the form and the server; `parsePosition` reused                                                                                                                                   | Decided by product owner sub-agent (medium): without it, hand-added places stay off the map and the empty-map line has nothing to fix; the planner already owns the pair rule                                                                                                                                                                                                                                                                                                                                                     |
| 16  | Corrections to the block's citations               | `places.ts:287`, `hasAtLeastRole(scope.ctx, 'admin')`, the schema lines, strict boundary schemas                                                                                                                                                   | Applied default after verification at HEAD; none changes the design                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 17  | `saveTripPlaceToCollection` reads a private trip   | It calls `requireTrip` before reading the place; every trip-sourced path does                                                                                                                                                                      | Decided by security and tenancy (medium) and software architect (medium) sub-agents: ADR 0007; harmless today only because nothing calls it                                                                                                                                                                                                                                                                                                                                                                                       |
| 18  | #1106 retires the visibility choice at creation    | This stage does not restore it on the create dialog; it adds the sharing dialog on an existing list, after the rule exists, and a true audience indicator                                                                                          | Applied default: #1106 explicitly leaves enforcement to this stage; reversing its "no badge" only for true states is named in the ticket                                                                                                                                                                                                                                                                                                                                                                                          |
| 19  | Slicing                                            | Five full-path tickets in the order a, b, c, d, e                                                                                                                                                                                                  | Decided by product owner sub-agent (medium): a first, because every write asks who may write the list; a mixed security-and-UI ticket would hide the access rule; five stays under the cap of eight                                                                                                                                                                                                                                                                                                                               |
| 20  | Labels and risk                                    | 08-S9a `risk-high` and `security`; the others `risk-medium`; unattended implementation approved on the security reviewer's verdict with the conditions in the acceptance criteria                                                                  | Decided by security and tenancy sub-agent (medium): the stage changes who may read and write tenant data                                                                                                                                                                                                                                                                                                                                                                                                                          |
