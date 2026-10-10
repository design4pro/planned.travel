# Journal: manage a journal, and draw on its trips

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S3 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S3` closes reference row `ADD-07` (the travel journal: a journal that lists its entries, photographs and places as
counts, is created with a title and a subtitle, and draws on one or more trips whose places arrive as anchors). Today a traveller
can **list** journals and **create** one (`createJourneyFn`), and nothing else: `updateJourney`, `publishJourney`,
`unpublishJourney` and `deleteJourney` in `src/server/repos/journey.ts` have no caller, so a journal cannot be renamed, tidied
away, deleted, or tied to a trip after the fact. This stage adds that write half, as **two tickets that are each a full path from
repository to screen**:

1. **08-S3a - manage a journal.** An actions menu on the story header and on each index card: edit details (title, subtitle,
   dates), archive, restore, delete (typed confirmation when the journal holds anything). An owner guard in the repository. The
   index shelves archived journals in their own section. The mechanical move that retires `src/routes/_app/-ui/create-dialogs.tsx`
   into `src/components/journey/` and `src/components/collections/` rides with it.
2. **08-S3b - draw on trips.** The journal's trips as badges, and a dialog that imports a trip's places as `place` entries
   ("anchors"), idempotently and race-safely, with the count stated before and after. A places count beside entries and photos.

No schema change, no migration, no route added, no package added, no queue message, no realtime patch.

**Publishing is deliberately not here.** The plan lists "publish or unpublish" in the menu; at HEAD no route resolves
`journeys.public_token`, so a Publish item would promise a link that leads nowhere (Resolved assumption 1). The stage that builds
the public page owns publishing.

## 📝 Problem Statement

Verified against the repository at HEAD:

- **The journal is read-only.** `createJourneyFn` (`src/routes/_app/-server/library.ts`) is the module's only write.
  `updateJourney`, `publishJourney`, `unpublishJourney`, `deleteJourney` (`src/server/repos/journey.ts`) are reached by repository
  tests and the dev seeder only. A traveller who mistypes a title lives with it; one who wants a journal gone cannot remove it,
  and on the free plan (`PLAN_QUOTAS.free.journeys` is 1) that journal holds the only slot for good.
- **The repository has no owner check.** Each of those four functions calls the module-private `requireJourney`, which applies
  `readableJourneyFilter` (ADR 0020, narrowed by ADR 0034) and nothing else. For a journal with no trip that means _any member of
  the workspace_ could delete someone else's writing the moment a server function exposed `deleteJourney`. The plan decided the
  owner rule "in the handler" and resolved ids with `journeysRepository.requireById` / `tripsRepository.requireById`; both are
  tenant-only and skip the readable-trip rule (ADR 0007), so a member who cannot open a private trip could copy its places into a
  journal. This spec supersedes the plan on both points (Resolved assumptions 4 and 5).
- **A journal cannot draw on a trip after creation.** `journeys.trip_id` is set at creation only. `journey_entries` already carry
  `source_trip_id` and `source_place_id` (nullable FKs, `ON DELETE SET NULL`) and `type = 'place'` is an allowed entry type, so the
  relation exists one level down; nothing writes it. The plan's reading of reference row `ADD-07` ("a single nullable FK rather than
  many-to-many") is answered without a join table: a journal's trips are the distinct `source_trip_id` of its entries, plus
  `journeys.trip_id` (Resolved assumption 12).
- **The dialogs the journal and collections indexes use live in a route-local file that two modules share.**
  `src/routes/_app/-ui/create-dialogs.tsx` holds `NewJourneyDialog` and `NewCollectionDialog`; its only importers are
  `src/routes/_app/journey/index.tsx` and `src/routes/_app/collections/index.tsx`. Two non-obvious dependents the plan does not
  name: `src/components/layout/__tests__/copy-rules.test.ts` lists the file in `APP_FILES` (read with `readFileSync`, so deleting it
  fails the test) and its "has no key the shell never reads" assertion scans those files for `'shell.*'` keys (the dialogs own
  `shell.newJourney.*` and `shell.newCollection.*`); and the comment at `src/components/console/index.ts` names the file.
- **The index miscounts archived work.** `journey/index.tsx` computes `drafts = journeys - published`, so an archived journal would
  be reported as a draft. The tile is one `<Link>` over the whole card, so an actions control cannot sit inside it.
- **Archiving frees no plan slot.** `countedJourneyFilter` excludes only an orphan whose owner left; archived rows count against
  the `journeys` quota. The traveller has to be told, and has to be able to find an archived journal to delete it.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                              | Not owned (read only, or left alone)                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/repos/journey.ts` - owner guard, archive/restore, lifecycle verbs behind the guard, `listJourneyTrips`, `importTripPlaceAnchors`, the place count                                                                                                             | `createEntry`, `updateEntry`, `deleteEntry`, `addPhoto`, `attachPhotoToEntry`, `deletePhoto`: no caller, no change (writing an entry and uploading a photograph are later) |
| `src/lib/journal/policy.ts`, `src/lib/journal/anchors.ts` (+ tests) - new, pure                                                                                                                                                                                           | `publishJourney` / `unpublishJourney` bodies keep their behaviour; they gain the owner guard only                                                                          |
| `src/routes/_app/-server/journal.ts` (+ `__tests__/journal.test.ts`) - new: the module's write functions and the trip-link loader                                                                                                                                         | `src/routes/_app/-ui/cover-art.tsx` and `trip-card.tsx`: `CoverArt` has two importers in two modules, so it stays where it is and both import lines are untouched          |
| `src/routes/_app/-server/library.ts` - the two journal loaders only (`loadJourneys`, `loadJourneyStory`) and the entry-count split                                                                                                                                        | `src/routes/_app/-ui/world-map.tsx`, atlas files, vacay files, the other collections files, `src/components/ui/*`                                                          |
| `src/components/journey/` (`new-journey-dialog.tsx`, `journey-actions.tsx`, `journey-edit-sheet.tsx`, `journey-delete-dialog.tsx`, `trip-link-dialog.tsx`, `index.ts`, `__tests__/`); `src/components/collections/` (`new-collection-dialog.tsx`, `index.ts`)             | The public page, sharing, the entry composer, photographs and their storage                                                                                                |
| `src/routes/_app/journey/index.tsx`, `src/routes/_app/journey/$journeyId.tsx`, `src/routes/_app/collections/index.tsx` (one import line)                                                                                                                                  | `journeys.trip_id`: this stage never writes it, so it never changes who can read a journal                                                                                 |
| `src/components/layout/__tests__/copy-rules.test.ts`, the comment in `src/components/console/index.ts`, `src/lib/i18n/messages/*/journal.ts` (23 locales), `src/routes/_app/-server/__tests__/`, `src/server/repos/__tests__/` (journey suites, tenant isolation, member) | `e2e/journeys.spec.ts` (the critical-journey declarations stay as they are)                                                                                                |
| `e2e/product-modules.spec.ts` - create or append (no baselines; ADR 0016)                                                                                                                                                                                                 | `drizzle/`, `src/server/db/schema.ts`: no schema change                                                                                                                    |
| `CONTEXT.md` - **Anchor**; the **Archive** entry gains the journal case                                                                                                                                                                                                   |                                                                                                                                                                            |

### Phase boundaries (tickets)

Two tickets. Each is a full path (repository -> server function -> screen -> test); the second is `Blocked by` the first because
both edit `journey/$journeyId.tsx` and `library.ts`, and the second mounts its dialog from the menu the first creates.

| Ticket | Delivers                                                                                                                                                                                                              | Rows                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 08-S3a | Owner guard; `updateJourneyFn`, `setJourneyStatusFn` (archive, restore), `journalDeleteSummaryFn`, `deleteJourneyFn`; the menu, edit sheet, delete dialog; the archived section; the dialog move; the copy-rules edit | the lifecycle half of `ADD-07` |
| 08-S3b | `listJourneyTrips`, `importTripPlaceAnchors`, `loadJourneyTripLinks`, `importTripPlacesFn`; the trip badges and `TripLinkDialog`; the places count on card and cover; the anchor tenant cases                         | `ADD-07` closes **done**       |

### Who may do what (Resolved assumptions 3 to 5)

- **Owner only, for every journal-level change:** edit details, archive, restore, delete, and import anchors. A member who can read
  the journal and is not its owner can read and, later, contribute entries; the frame and the lifecycle are the owner's. The menu
  is **not rendered** for them (an absent control, as `trip-actions.tsx` does), and the story page offers them nothing to change.
- **The guard lives in the repository.** `requireOwnedJourney(scope, journeyId)`: `requireJourney` first (an unreadable or foreign
  id is the same `NotFoundError` a missing one is, so nothing leaks), then `canManageJourney(journey, scope.ctx.userId)` from
  `src/lib/journal/policy.ts`, else a `JourneyOwnerError` (a `RepositoryError`, code `FORBIDDEN`, deliberately **not** in
  `AUTHED_ERROR_NAMES`: a menu that hides the item makes the refusal a forged-request edge, so the reader sees the caller's
  localised generic failure, `docs/SPEC.md` §9 rule 10). It is called by `updateJourney`, `publishJourney`, `unpublishJourney`,
  `deleteJourney`, the two new status verbs and `importTripPlaceAnchors`.
- `canManage: boolean` is computed **server-side** by the same `canManageJourney` and carried on the loaders. The client never
  compares ids and no user id is shipped. It is a rendering hint; the repository is the authority.
- **Workspace owners and admins have no override in this stage.** A journal whose owner left the workspace but which is still
  readable (a trip-bound journal whose trip stays readable) keeps its quota slot with nobody able to delete it. That is real and
  is named in Risks; it is a follow-up, not a reason to widen the guard here.

### The lifecycle verbs

| Verb         | Repository                | Server function (POST, `z.strictObject`)                                                     | Behaviour                                                                                                                                                                                                                                                 |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit details | `updateJourney` (guarded) | `updateJourneyFn { journeyId, title, subtitle, startedOn, endedOn }`                         | Title, subtitle, dates only. **No `status`, `visibility`, `slug`, `coverImageUrl`, `coverGradient`, `publicToken` field exists in the boundary schema** (Resolved assumption 6). Blank subtitle/date clears. End before start is refused on the boundary. |
| Archive      | `archiveJourney` (new)    | `setJourneyStatusFn { journeyId, status: 'archived' }`                                       | One update: `status = 'archived'` **and** `public_token = null`, so an archived journal is never reachable by a link (seeded journals are `published` with tokens). Archiving an archived journal is a no-op.                                             |
| Restore      | `restoreJourney` (new)    | `setJourneyStatusFn { journeyId, status: 'draft' }`                                          | `archived -> draft`, always `draft` (the previous status is not stored and there is no migration). Restoring a journal that is not archived is a no-op. The schema accepts `'archived'` and `'draft'` only.                                               |
| Delete       | `deleteJourney` (guarded) | `journalDeleteSummaryFn { journeyId }` (GET), `deleteJourneyFn { journeyId, confirmTitle? }` | The summary reads the journal's entries (non-place), places, photos and `requiresTitle`. The delete **re-derives** the rule from its own counts and refuses a missing or wrong `confirmTitle`, as `assertConfirmed` does for trips. Rows cascade.         |

The threshold: `requiresTitle` is true when the journal holds **at least one entry of any type (anchors included) or one
photograph**; an empty journal is a one-click confirm (Resolved assumption 8). `confirmTitle` is compared in the handler, never
with a client-known literal.

### Drawing on trips (08-S3b)

- **`listJourneyTrips(scope, journeyId)`** resolves the journal through `requireJourney`, then two indexed reads: a group-by of
  `source_trip_id` over the journal's entries on `journey_entries_org_journey_idx` with the anchor count (`type = 'place'`), and
  `readableTrips(scope).findMany` for titles. The seed `journeys.trip_id` is unioned in code. It returns
  `{ trips: [{ tripId, title, anchorCount }], otherTripCount }`: **a trip the viewer cannot read gets no badge and no title**
  (a title is data, ADR 0007); the viewer is told only "and N more". A deleted trip drops out (`source_trip_id` is nulled; its
  anchors keep their text).
- **`importTripPlaceAnchors(scope, journeyId, tripId)`**: `requireOwnedJourney`, then `requireTrip` (never `getTrip`, which returns
  `null`, and never a bare `requireById`), then the **audience rule**, then the plan below. Returns
  `{ added, skipped, remaining }`.
- **The audience rule** (Resolved assumption 9). The copies are readable by the journal's readers, not the trip's. So a trip may be
  imported only when everyone who can read the journal can already read it: for a journal with no trip, the trip's
  `visibility` is `organization`; for a trip-bound journal, the trip is the journal's own `trip_id` or is `organization`-visible;
  for an orphan (owner-only readable, ADR 0034), any trip the owner can read. Otherwise `JourneyTripAudienceError`
  (`FORBIDDEN`-coded, same treatment as the owner error) and **no row is written**. The dialog lists only eligible trips, and says
  who will see the places (`policy.ts` exports `journalAudience(journey)` and `canImportTrip(journey, trip)`, pure and tested).
- **The anchors.** One `type = 'place'` entry per place not yet anchored in this journal (any entry type with that
  `source_place_id` counts as anchored): `title` and `location_name` = the place's name, `lat`/`lng` as the place has them (both or
  neither), `source_trip_id`, `source_place_id`, `author_user_id` = the caller, `body` null. Organization and ids are stamped by the
  repository (`createTenantRepository` omits the tenant column from the caller's payload, `src/server/repos/base.ts`).
- **`entry_date` (pure, `src/lib/journal/anchors.ts`, `today` injected):** the earliest non-null `days.date` among the place's
  `day_assignments`; else the trip's `start_date`; else the journal's `started_on`; else the import day. Not clamped to the journal's
  range. **`sort_order`:** `max(existing sort_order in this journal, 0) + 1 + k`, `k` = the anchor's index in import order
  (anchor date, `places.sort_order`, id); listing already orders by `entry_date, sort_order, id`, so the read is deterministic even
  if the base read races.
- **Idempotent under overlap** (Resolved assumption 10). There is no unique index on `(journey_id, source_place_id)` and none is
  added: a later stage may legitimately write two entries about one place. The guard is in the statement: one insert per place,
  each `INSERT ... SELECT <bound values> FROM places WHERE places.id = ? AND <tenant filter> AND NOT EXISTS (SELECT 1 FROM
journey_entries WHERE organization_id = ? AND journey_id = ? AND source_place_id = ?)`, ids from `newId()` in JS, all in one
  `runBatch` (D1 runs a batch's statements serially and atomically, so statement N sees a rival's committed rows). A place deleted
  between the read and the batch is silently skipped. Each statement binds about 25-30 parameters, under the 100 ceiling
  (`MAX_BOUND_PARAMETERS`). Step 1 of the phase is a **spike** that proves Drizzle 0.45's `insert().select()` (or a `sql` select)
  batches on D1 and on the test harness; if neither does, the fallback is read-then-insert in `runBatch` with the overlap race
  stated in the code and in the dialog's copy-free behaviour (the owner can delete a duplicate once entries can be deleted).
- **Cap:** `MAX_ANCHORS_PER_CALL = 200` (one batch, D1's per-invocation query budget). `remaining > 0` tells the dialog "Added 200 of
  340; import again for the rest"; repeating is safe and makes progress. `added` is counted from the minted ids that now exist
  (chunks of 90), not assumed.
- **No ceiling on `journey_entries` in this stage.** Anchors are bounded by metered places, one per place per journal; the unmetered
  growth is writing entries, which the stage that adds it owns.

### Server-function home, layering and tests

- Write functions live in `src/routes/_app/-server/journal.ts` (the plan's path; the later stages that grow it name it, and the
  leave planner uses the same shape). Reads stay in `library.ts`.
- **Components receive their server calls as props**, not by importing a route's `-server/` folder: `src/components/console/index.ts`
  states that seam ("a component directory reaching into a route's `-server/` folder would invert the layering"), and no component
  imports from `routes/_app/-server/` today. `NewJourneyDialog` takes `create`, `NewCollectionDialog` takes `create`,
  `JourneyActions` takes `{ update, setStatus, remove, summary }`, `TripLinkDialog` takes `{ load, importPlaces }`. The route files
  import the functions and pass them; `journey/index.tsx` binds `createJourneyFn` once in a local wrapper so the four use sites
  are unchanged. The console comment is edited to name the new seam.
- **Tests:** `journal.test.ts` is `.test.ts` (the `server` project collects `src/routes/**/*.test.ts`); it mocks `../context` to
  return the harness scope, as `src/server/fns/__tests__/atlas.test.ts` does, and installs the Start `AsyncLocalStorage` before a
  dynamic import. A handler's return value is not observable outside a Start build, so assertions read back through the
  repository and the boundary schemas are exercised through `__executeServer`. Pure logic (`policy.ts`, `anchors.ts`) is plain
  TypeScript under `src/lib/**`.

### Alternatives considered, and why they lost

- **A `journey_trips` join table (the reference row's reading).** A second authority for the question `source_trip_id` already
  answers, and it needs a migration this wave cannot file.
- **Publish and unpublish in the menu.** No route reads `public_token`; the `journal.published` notification already tells a reader
  "Anyone with the link can now read the journey". Two modules would also own "publish" (Resolved assumption 1).
- **A unique partial index for idempotence.** Forbids the legitimate second entry about a place and, narrowed by a discriminator
  column, costs a second migration.
- **A cover image URL field.** A pasted URL is a hotlink that sends every reader's address to a third party; uploads do not exist
  yet (Resolved assumption 7).
- **Soft delete with an undo window.** Needs a column; out of reach without a migration. Archive is the reversible path and the
  delete dialog says so.

## 📝 Architecture

- **Owner module of each new concept (`docs/SPEC.md` §8):** the journal lifecycle and the anchors -> `src/server/repos/journey.ts`
  (all SQL); who may manage / which trips may be imported / the date chain -> `src/lib/journal/` (pure, no I/O, imported by the
  repository, the loaders and the components); the write boundary and its Zod -> `src/routes/_app/-server/journal.ts`; the
  presentation -> `src/components/journey/`; the new-collection dialog -> `src/components/collections/`.
- `components/ui` is untouched and still never fetches. Nothing enqueues; no Durable Object, no KV.
- Entry counts: the predicate "entry of type `place`" is defined **once** in the repository and used by `listJourneysWithCounts`
  and `getJourneyStory`, so the card and the cover cannot disagree.

## 📝 Data Model

No change. `journeys`, `journey_entries` (`source_trip_id`, `source_place_id`, `type`, `entry_date`, `sort_order`, lat/lng with
its CHECK) and `journey_photos` are used as they are. Dates stay `YYYY-MM-DD` text; ids come from `newId()`. No migration, no
backfill, no index. Deleting a journal cascades `journey_entries` and `journey_photos` rows (`ON DELETE CASCADE`). **No R2 object
belongs to a journal at HEAD** (the only `addPhoto` caller is the dev seeder, whose keys are dataset paths): the stage that adds
photograph uploads owns purging a journal's objects on delete, in the same batch, with an organization-namespace check, and must
carry that as a condition. Nothing to purge here.

## 📝 API Contracts

All POST unless noted; every input `z.strictObject` with the `error` parameter; ids `idSchema`; none accepts a `userId`,
`organizationId`, `status` (except the two-value `setJourneyStatusFn`), `visibility`, `publicToken` or `slug`.

| Function                       | Input                                                | Output                                                                                                                             |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `updateJourneyFn`              | `{ journeyId, title, subtitle, startedOn, endedOn }` | `{ journeyId }`; the route invalidates                                                                                             |
| `setJourneyStatusFn`           | `{ journeyId, status: 'archived' \| 'draft' }`       | `{ status }`                                                                                                                       |
| `journalDeleteSummaryFn` (GET) | `{ journeyId }`                                      | `{ title, entries, places, photos, requiresTitle }`                                                                                |
| `deleteJourneyFn`              | `{ journeyId, confirmTitle? }`                       | `{ ok: true }`                                                                                                                     |
| `loadJourneyTripLinks` (GET)   | `{ journeyId }`                                      | `{ audience, linked: [{ tripId, title, anchorCount }], otherTripCount, linkable: [{ tripId, title, startDate, endDate, toAdd }] }` |
| `importTripPlacesFn`           | `{ journeyId, tripId }`                              | `{ added, skipped, remaining }`                                                                                                    |

`loadJourneys` and `loadJourneyStory` gain `canManage` and `placeCount`; `entryCount` becomes the count of entries that are **not**
anchors (so a 14-place import does not read as "14 entries" next to "14 places"); `loadJourneyStory` also carries
`trips` and `otherTripCount` for the badges. Errors: a refusal reaches the screen as the action's generic failure (no new class in
`AUTHORED_ERROR_NAMES`); `QuotaExceededError` is not thrown (no metered row is created).

`loadJourneyTripLinks` is owner-only (`requireOwnedJourney`). `linkable` is the trips the caller can read **and** the audience rule
admits, newest first by start date (undated last), at most 50, not archived; `toAdd` is one grouped query (`places` of those trips
with no anchor in this journal). It replaces the past-trips-only, 30-row `loadJourneyTripOptions` for this dialog; that loader is
still the new-journey dialog's.

## 📝 UI/UX

### Actions menu (`JourneyActions`)

A `DropdownMenu` (the primitive has no bottom-sheet mode; `trip-actions.tsx` uses a plain menu at every width, and so does this)
with: **Edit details**, **Archive** (hint: "Tucks it away. It still counts toward your plan's journal limit.") or **Restore** on an
archived journal, **Delete...** (danger tone), and on the story header only **Trips...** (08-S3b). Rendered only when `canManage`.

- **Story header** (`$journeyId.tsx`): in the cover card's top row, beside the status `Badge`.
- **Index card** (`JourneyTile`): the `<li>` becomes `relative`; the `Card asChild interactive` + `Link` stay byte-identical; the
  menu is a **sibling** of the link, absolutely positioned at the top-end (`end-3 top-3`, logical properties), 44 px hit area,
  accessible name "Actions for {title}". The photo-count chip moves to the bottom-end of the cover so the corner is free. Focus
  order: link, then menu.
- **Edit details** opens a `Sheet` (the trip edit sheet's pattern): title, subtitle, started on, ended on (existing field
  labels); an error keeps the sheet open with its values and a retry; a save in flight owns the sheet.
- **Archive** is one click (reversible, no confirmation) with a toast; **Restore** returns it to `draft`.
- **Delete** opens a `Dialog` that names the journal and its entries, places and photographs as counts, says it cannot be undone and
  points to Archive; when `requiresTitle`, a field that must match the title character for character. A failed delete keeps the
  dialog open and never navigates away; success from the story page navigates to `/journey`.

### Index

Archived journals leave the main grid for one **collapsed "Archived (N)" section** after it (a native `<details>`, so it is keyboard
and screen-reader complete), keeping the status badge and the actions menu. `drafts` becomes `journeys - published - archived`.
The page description and the "published / in draft" caption stop counting archived journals as drafts.

### Trips (08-S3b)

- Story page: a **Trips** panel in the aside lists the journal's trips as `Badge`s (readable ones only, plus "and N more trip you
  can't open") and, for the owner, an **Import a trip's places** button that opens `TripLinkDialog`. Empty state on
  `--color-surface-2`: "This journal is not tied to a trip yet" with the button and one line saying what an anchor is.
- `TripLinkDialog`: a trip `Select` over `linkable` (four `Skeleton` rows while loading); after a choice, "Adds {count} places as
  anchors; ones already here are skipped" and the audience sentence ("Everyone in this workspace will see these places" / "Everyone
  who can open {trip} will see them" / "Only you will see them", plus "The copies stay if the trip is later changed or deleted").
  The import button reports progress as a count. Outcomes: success toast with the count; **zero new** is an informational `Alert`
  ("Every place from that trip is already here"), not an error; `remaining > 0` says "Added {added} of {total}; import again for the
  rest"; a failure keeps the dialog open with a retry. A trip that the audience rule excludes is not offered, with one line saying
  private trips cannot be added to a journal other people can read.
- Cards and the cover add a **Places** figure (`tabular-nums`); `Entries` counts entries that are not anchors.
- Imported anchors enter the story list on a 200 ms opacity and 4 px translate on `--ease-out-quint`, staggered 24 ms and capped at
  eight; `prefers-reduced-motion: reduce` collapses to opacity.

Accessibility: every item and button has a visible focus ring and an accessible name; the dialog and sheet trap and return focus to
the trigger; `Escape` cancels; the delete confirmation's field has a label and its mismatch is announced; counts are not colour
only; the archived `<details>` has a text summary; touch targets 44 px; 360 px to 2560 px, light and dark.

## 📝 Visual change expected

`/journey` and `/journey/$journeyId`, light and dark, 360x800, 1280x900 and 2560x1440:

- the index card with the actions trigger at its top-end corner (closed, and the open menu), an archived journal in the collapsed
  section (closed and open), the Places figure;
- the story header with the menu, the edit sheet, the delete dialog (empty journal; journal that requires the title), the Trips
  panel (empty, with badges), the trip dialog (loading, a trip chosen, zero-new, error);
- `/collections` changes by one import line and no pixel.

## 📝 Copy

All new keys go to `src/lib/i18n/messages/en/journal.ts` (`journal.*`) and land in all 23 locales in the same change (`i18n-messages`
skill; plural keys carry every category each locale needs and `{count}` keeps its name). **The moved dialogs keep their
`shell.newJourney.*` and `shell.newCollection.*` keys unchanged** (no 23-locale churn); the copy-rules test reads the moved files
from a second list. Field labels reuse existing keys.

| Key (en)                                          | Text                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `actions.trigger`                                 | Actions for {title}                                                                                                                       |
| `actions.edit`                                    | Edit details                                                                                                                              |
| `actions.archive`                                 | Archive                                                                                                                                   |
| `actions.archiveHint`                             | Tucks it away. It still counts toward your plan's journal limit.                                                                          |
| `actions.restore`                                 | Restore                                                                                                                                   |
| `actions.delete`                                  | Delete...                                                                                                                                 |
| `actions.trips`                                   | Trips...                                                                                                                                  |
| `edit.title`                                      | Edit journal                                                                                                                              |
| `edit.submit` / `edit.saving`                     | Save changes / Saving                                                                                                                     |
| `edit.saved`                                      | Journal updated                                                                                                                           |
| `edit.errorTitle` / `edit.error` / `edit.retry`   | Could not save / That did not save. Nothing was changed. / Try again                                                                      |
| `status.archived`                                 | Archived                                                                                                                                  |
| `status.archivedBody`                             | It still counts toward your plan's journal limit.                                                                                         |
| `status.restored`                                 | Restored as a draft                                                                                                                       |
| `status.error`                                    | That did not change. Try again.                                                                                                           |
| `delete.title`                                    | Delete {title}?                                                                                                                           |
| `delete.entries` (plural)                         | {count} entries / 1 entry                                                                                                                 |
| `delete.places` (plural)                          | {count} places / 1 place                                                                                                                  |
| `delete.photos` (plural)                          | {count} photographs / 1 photograph                                                                                                        |
| `delete.irreversible`                             | This cannot be undone. Archive it instead if you might want it back.                                                                      |
| `delete.typeTitle`                                | Type {title} to delete it.                                                                                                                |
| `delete.confirm` / `delete.deleting`              | Delete journal / Deleting                                                                                                                 |
| `delete.deleted`                                  | Journal deleted                                                                                                                           |
| `delete.error`                                    | The journal was not deleted. Nothing was removed.                                                                                         |
| `index.archived` (plural)                         | Archived ({count})                                                                                                                        |
| `figure.places`                                   | Places                                                                                                                                    |
| `trips.label`                                     | Trips                                                                                                                                     |
| `trips.more` (plural)                             | and {count} more trip you can't open / ...trips...                                                                                        |
| `trips.empty.title` / `trips.empty.body`          | This journal is not tied to a trip yet / An anchor is a place from a trip that you can write against.                                     |
| `trips.import`                                    | Import a trip's places                                                                                                                    |
| `trips.dialog.title` / `trips.dialog.description` | Import a trip's places / Each place becomes an anchor in this journal. Places already here are skipped.                                   |
| `trips.pick`                                      | Trip                                                                                                                                      |
| `trips.privateNote`                               | Private trips can't be added to a journal other people can read.                                                                          |
| `trips.willAdd` (plural)                          | Adds {count} places as anchors; ones already here are skipped                                                                             |
| `trips.audience.workspace` / `.trip` / `.owner`   | Everyone in this workspace will see these places. / Everyone who can open {trip} will see these places. / Only you will see these places. |
| `trips.audience.stays`                            | The copies stay if the trip is later changed or deleted.                                                                                  |
| `trips.importing`                                 | Importing                                                                                                                                 |
| `trips.added` (plural)                            | Added {count} places                                                                                                                      |
| `trips.partial`                                   | Added {added} of {total}. Import again for the rest.                                                                                      |
| `trips.none`                                      | Every place from that trip is already here                                                                                                |
| `trips.error`                                     | The places were not imported. Nothing was added twice.                                                                                    |

## 📝 Edge Cases & Failure Scenarios

| Case                                                              | Behaviour                                                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A member who is not the owner forges `deleteJourneyFn`            | `JourneyOwnerError` (FORBIDDEN, generic failure on screen); a non-reader of a trip-bound journal gets `NotFoundError` |
| A foreign workspace's journal or trip id                          | `NotFoundError`; nothing written                                                                                      |
| Owner imports a private trip into a workspace-readable journal    | `JourneyTripAudienceError`; no row written; the trip is not offered                                                   |
| Orphaned journal (ADR 0034), the owner reads it                   | Owner keeps every action; anyone else gets `NotFoundError`; any trip the owner can read is importable                 |
| Orphan whose owner left, journal still readable (not orphan)      | Cannot be edited or deleted by anyone; keeps its slot. Follow-up, see Risks                                           |
| Archive a published (seeded) journal                              | Status `archived` and `public_token` null in one update; restore gives `draft`                                        |
| Archive when it is the only slot on the free plan                 | Allowed; the toast and the hint say it still counts; the section keeps it findable so it can be deleted               |
| Delete a journal with entries, no `confirmTitle` (forged)         | Refused by the handler's own count; nothing removed                                                                   |
| Delete during a navigation / second tab already deleted it        | `NotFoundError` -> generic failure; the dialog closes on refresh                                                      |
| End date before start date                                        | Refused on the boundary (and on the form); nothing saved                                                              |
| Rename to a title whose slug clashes                              | `updateJourney` reserves a unique slug as it does today; the title wins, the slug gets a suffix                       |
| Import the same trip twice, or two overlapping requests           | Each place is anchored once; the second reports `skipped` (and `added: 0`)                                            |
| A trip with 340 places                                            | 200 added, `remaining: 140`, the dialog says to import again; the rest follow                                         |
| A place deleted between the read and the batch                    | Skipped silently; the others are added                                                                                |
| A place on several days, an undated trip, a journal with no dates | `entry_date` from the chain; deterministic; the import day only as the last resort                                    |
| A place with no coordinates                                       | Anchored with `location_name` and null lat/lng                                                                        |
| A trip deleted after import                                       | `source_trip_id`/`source_place_id` nulled; the anchors keep their text; the badge disappears                          |
| The viewer can read the journal but not an imported trip          | No badge, no title; "and N more trip you can't open"                                                                  |
| Double-tap on any button                                          | Disabled while pending; the server operations are idempotent or refused the second time                               |
| Dropped connection mid-save or mid-import                         | The dialog stays open with its values and a retry; an import retried adds only what is missing                        |
| RTL locales, 23 locales                                           | Logical properties only; the plural keys carry every category; counts use `tabular-nums`                              |

## ✅ Acceptance criteria

1. Only the owner can edit, archive, restore, delete or import: every guarded repository function and server function refuses a
   reader who is not the owner (`FORBIDDEN`), and an unreadable or foreign id is `NotFoundError`, with nothing changed.
2. `updateJourneyFn` cannot change `status`, `visibility`, `slug`, a cover or a token; renaming keeps the slug rule.
3. Archiving clears `public_token`; restoring yields `draft`; both are idempotent; the index shelves archived journals in their own
   disclosure and `drafts` excludes them.
4. A journal with any entry or photograph cannot be deleted without its exact title, enforced by the server from its own counts; an
   empty journal deletes with one confirmation; the dialog names the counts and offers Archive.
5. `listJourneyTrips` returns the distinct source trips plus the seed trip, readable ones only, with the count of the rest; a member
   who cannot read trip B never receives B's title.
6. `importTripPlaceAnchors` writes one anchor per not-yet-anchored place with the date and order rules above, stamped with the
   caller's organization and user, in one batch; importing again adds nothing; an overlapping request (a rival anchor committed
   between the read and the batch) leaves exactly one entry per place; 150 places import in one call, 340 import 200 with
   `remaining: 140` and a second call completes them.
7. The audience rule refuses a trip the journal's readers could not already read, writing nothing; the dialog lists only eligible
   trips and states the audience.
8. A foreign trip into the caller's journal, and the caller's trip into a foreign journal, are `NotFoundError` with the entry
   counts unchanged.
9. `entryCount` excludes anchors and `placeCount` counts them, from one predicate, on the card and the cover.
10. `create-dialogs.tsx` is gone; both dialogs behave as before; the copy-rules test still passes and still checks the moved files'
    literals, directional icons and key reads; `grep -rn create-dialogs src` finds nothing.
11. All new keys exist in all 23 locales; the parity test passes; no hard-coded literal is added (the index route's existing English
    literals are not touched).
12. Light/dark, 360 px to 2560 px, keyboard-complete, focus returns to the trigger; console silent; no layout shift after the dialog
    loads.

## 📝 Risks & Impact Review

| Risk                                                                                        | Severity | Mitigation / residual                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A guard added to existing repository functions changes their contract                       | medium   | They have no production caller; run the journey, member-isolation and tenant suites and fix any test that mutated as a non-owner by making the fixture's actor the owner |
| Disclosure by import (names, coordinates, dates of a trip copied where its readers are not) | high     | The audience rule refuses it; the dialog states the audience; the copies outlive the trip and the dialog says so                                                         |
| Idempotence under overlap depends on Drizzle expressing a guarded insert                    | medium   | The spike is step 1; the harness refuses > 100 parameters; the fallback and its stated race are decided above                                                            |
| Parenting attack: own journal + foreign trip, foreign journal + own trip                    | high     | `requireOwnedJourney` + `requireTrip`, both tenant-and-readability aware; tested with unchanged entry counts                                                             |
| A departed owner's still-readable journal holds a quota slot nobody can free                | medium   | Out of scope and named; follow-up for a narrow workspace-admin path (archive/restore/delete only)                                                                        |
| Journal delete will orphan R2 objects once uploads exist                                    | medium   | None exist now; the uploads change owns the purge (Data Model)                                                                                                           |
| `journey_entries` is unmetered                                                              | low      | Anchors are one per place per journal and bounded by the metered places; the entry-writing change owns a ceiling                                                         |
| The index route still ships English literals                                                | low      | Pre-existing; this stage adds none and does not touch them; named in Out of scope                                                                                        |
| `humaniseToken(status)` labels are English-derived                                          | low      | Pre-existing (documented in `en/journal.ts`); the archived section title is a catalogue key                                                                              |

### Out of scope

Publishing, unpublishing and the public page; the cover (image or gradient); the entry composer, photographs and their storage and
purge; a ceiling on entries; workspace-admin override for a departed owner's journal; a localisation pass over `journey/index.tsx`'s
existing literals; promoting `cover-art.tsx` to a shared home; soft delete.

### Blockers

None. Every table, column and repository function this stage needs exists; no package is added; no binding is added; no other stage's
work is required. The markdown renderer is not needed (a journal's description is plain text).

### Reference-row disposition

`ADD-07` partial -> **done** with 08-S3b. The row's behaviour set (counts of entries, photographs and places; title and subtitle;
drawing on trips whose places become anchors) is complete after both tickets.

## 📋 Phasing

08-S3a, then 08-S3b (`Blocked by` 08-S3a).

## 📋 Implementation Plan

### Phase 1 - manage a journal (08-S3a)

1. `src/lib/journal/policy.ts` (`canManageJourney`, `journalAudience`, `canImportTrip`) and its test, test first.
2. Repository: `JourneyOwnerError`, `requireOwnedJourney`, the guard inside `updateJourney`, `publishJourney`, `unpublishJourney`,
   `deleteJourney`; `archiveJourney`, `restoreJourney`; the delete summary read; the single place-count predicate. Repository, member
   and tenant-isolation cases (owner, non-owner reader, non-reader, foreign, orphan).
3. `src/routes/_app/-server/journal.ts`: the four functions with strict schemas and `journal.test.ts` (non-owner refused, forged
   delete without title refused, archive clears the token).
4. Move the dialogs into `src/components/journey/` and `src/components/collections/` with `create` props and a local wrapper in
   `journey/index.tsx`; update both route imports; `copy-rules.test.ts` (`APP_FILES` loses the entry, a `MODULE_FILES` list reads
   the moved files); the `console/index.ts` comment; `grep -rn create-dialogs src` is empty.
5. `JourneyActions`, `JourneyEditSheet`, `JourneyDeleteDialog`, the tile restructure, the archived disclosure, `canManage` on the
   loaders; component tests; the `journal.*` keys in 23 locales; `CONTEXT.md` **Archive** (a journal's archive is a status, it
   unpublishes, restore returns to draft).
6. The e2e `describe`.

### Phase 2 - draw on trips (08-S3b)

1. The insert-select spike in the harness (parameters, batching, overlap).
2. `src/lib/journal/anchors.ts` (+ test, table-driven), `importTripPlaceAnchors`, `listJourneyTrips`; repository cases incl. the
   overlap wrapper, the 150/340 cases and the tenant parenting cases.
3. `loadJourneyTripLinks`, `importTripPlacesFn` and cases; `trips`/`otherTripCount`/`placeCount` on `loadJourneyStory`.
4. `TripLinkDialog`, the Trips panel, the Places figure, the motion; component tests; keys in 23 locales; `CONTEXT.md` **Anchor**.
5. The e2e `describe`.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on each phase's last commit.
- Unit: `src/lib/journal/__tests__/policy.test.ts`, `anchors.test.ts`; `src/routes/_app/-server/__tests__/journal.test.ts`;
  `journey-actions.test.tsx` (the destructive item opens the confirmation, the counts are named, `Escape` cancels, focus returns,
  the typed title gates the button); `trip-link-dialog.test.tsx` (count before and after; zero-new renders as information; only
  eligible trips are offered); the moved dialogs keep their existing behaviour.
- Tenant isolation, appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe`: in A's scope against B's
  ids, `updateJourney`, `archiveJourney`, `restoreJourney`, `publishJourney`, `unpublishJourney`, `deleteJourney` and
  `listJourneyTrips` are `NotFoundError` (not `[]`) with B's rows intact; `importTripPlaceAnchors(scopeA, aJourney, bTrip)` and
  `(scopeA, bJourney, aTrip)` are `NotFoundError` and **A's and B's entry counts are unchanged** (asserted, not only the throw).
  Same-workspace cases in `member-isolation`: non-owner reader `FORBIDDEN` for each verb, non-reader of a trip-bound journal
  `NotFoundError`, non-owner on an orphan `NotFoundError`, a member never receives a title of a trip they cannot read.
- Browser, per `docs/plans/12-verification-protocol.md` and ADR 0016 (no baselines, no `e2e/__screenshots__`):
  `e2e/product-modules.spec.ts` (create or append; `/journey` is already declared in `e2e/helpers/routes.ts`) reaches the story by
  clicking the first card, edits and restores a title, archives and restores a journal, creates then deletes a throwaway journal,
  imports a trip twice (second reports zero), asserts the console is silent; serial, `chromium` only (`test.skip` on
  `mobile-safari`), named among the fixture writers in `playwright.config.ts`. Port from `bash .ai/scripts/e2e.sh`:
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup` then
  `... pnpm exec playwright test e2e/product-modules.spec.ts`.
- Frames, the blind A/B pair a person reads at review, from `scripts/visual/capture.mjs`:
  `PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs --url "http://localhost:$PORT/journey" --out "<scratchpad>/shots/08-S3" --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth`,
  plus `--state actions --click '[data-part="journey-actions"]'` and, on the story route, `--state trips --click '[data-part="journey-trip-link"]'`.
  The selectors are `data-part` attributes this stage publishes; the spec run reaching the same state proves they resolve.
- Definition of done: the `docs/SPEC.md` §7 checklist, item by item, in each PR body; the grep for terms a change must update
  (`create-dialogs`, `NewJourneyDialog`, `NewCollectionDialog`, `entryCount`, `loadJourneyTripOptions`, `journal.published`)
  recorded in the PR template box.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                               | Applied default                                                                                                                                                              | Why                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Publish and unpublish in this stage's menu?                            | No. The menu has edit, archive, restore, delete (and trips). `publishJourney`/`unpublishJourney` stay, gain the owner guard                                                  | Decided by product owner sub-agent (high): no route resolves `public_token`; a Publish item promises a dead link; one owner per concept (`docs/SPEC.md` §8). `ADD-07` still closes: publishing is not in its behaviour set          |
| 2   | Where do archived journals go, what does restore do, is the cost said? | A collapsed "Archived (N)" section; `drafts` excludes them; restore -> `draft`; the hint and the toast say it still counts toward the journal limit                          | Decided by product owner sub-agent (medium): an archive that stays in the grid contradicts `CONTEXT.md` "leaves the default lists"; the quota counts archived rows. The glossary entry is amended in the same change                |
| 3   | Who may rename and edit?                                               | The owner alone, with every other journal-level change                                                                                                                       | Decided by product owner (medium-high) and security and tenancy (medium) sub-agents: title, cover and dates frame the whole journal; narrowest and easiest to widen later                                                           |
| 4   | Where does the owner guard live, and what does a refusal look like?    | In the repository (`requireOwnedJourney`); `NotFoundError` for an unreadable id, `FORBIDDEN` class not in `AUTHORED_ERROR_NAMES` otherwise; `canManage` computed server-side | Decided by security and tenancy (medium) and software architect sub-agents; `requireOwnedTrip` is the pattern; SPEC §9 rule 10 closes the authored set                                                                              |
| 5   | The plan's `requireById` for journal and trip?                         | Superseded: `requireJourney`/`requireOwnedJourney` and `requireTrip`                                                                                                         | Security and tenancy and architect sub-agents (both high): `requireById` is tenant-only and skips ADR 0007/0020/0034                                                                                                                |
| 6   | Which fields may an edit change?                                       | Title, subtitle, started on, ended on; no status, visibility, slug, cover or token field in the schema                                                                       | Security and tenancy sub-agent (high): reusing `updateJourneyInput` would let an edit publish or archive past `setJourneyStatusFn`                                                                                                  |
| 7   | The plan's "edit the cover"?                                           | Left out; out of scope                                                                                                                                                       | Applied default: a pasted image URL is a hotlink that sends every reader's address to a third party and uploads do not exist yet; reversible. Re-review as a condition                                                              |
| 8   | How hard does delete ask?                                              | Typed title when the journal holds any entry (anchors included) or photograph; one confirmation when empty; the server re-derives the rule; Archive offered                  | Decided by product owner sub-agent (medium-high): mirrors the trip rule (PRD #104 decision 10); a later change makes journals hold prose and should not have to change the ceremony                                                 |
| 9   | May the copies reach people who cannot read the trip?                  | No. The audience rule refuses it and the dialog states the audience; only eligible trips are offered                                                                         | Security and tenancy (medium: import owner-only, dialog names the audience) and software architect (high: enforce the rule) sub-agents; the stricter, more reversible union taken                                                   |
| 10  | How is the import idempotent under overlap, and how big is a call?     | One guarded insert per place in one `runBatch`, spike first, stated fallback; cap 200 per call with `remaining`                                                              | Decided by software architect sub-agent (medium-high); security and tenancy sub-agent proposed 500 and best-effort idempotence; the architect's 200 and the in-statement guard taken (D1 per-invocation query budget; no new index) |
| 11  | `entry_date` and `sort_order` of an anchor?                            | Earliest dated assigned day, else trip start, else journal start, else the import day; `max + 1 + k`                                                                         | Decided by software architect sub-agent (medium-high); pure and injectable `today`                                                                                                                                                  |
| 12  | A `journey_trips` table?                                               | No: derive from `source_trip_id` plus `journeys.trip_id`; never write `trip_id`                                                                                              | Plan decision verified in the schema; software architect sub-agent (high): sound given `ON DELETE SET NULL`; readable trips only for titles                                                                                         |
| 13  | The places count?                                                      | Added to the card and the cover; `entryCount` excludes anchors, from one predicate                                                                                           | Decided by product owner sub-agent (high): the reference behaviour names places as a count; without the split an import reads as "14 entries"                                                                                       |
| 14  | Ticket cut and where the dialog move rides                             | Two tickets; the move rides with 08-S3a; 08-S3b is `Blocked by` 08-S3a                                                                                                       | Decided by product owner sub-agent (high): a move-only ticket is not a tracer bullet                                                                                                                                                |
| 15  | Server home and layering                                               | `src/routes/_app/-server/journal.ts`; components receive server calls as props                                                                                               | Decided by software architect sub-agent (high, medium on props): `console/index.ts` states the seam; no component imports a route's `-server/` today                                                                                |
| 16  | The menu as a bottom sheet at 360 px (plan)?                           | A plain `DropdownMenu` at every width; the edit form is a `Sheet`                                                                                                            | Applied default: the primitive has no bottom-sheet mode and `trip-actions.tsx` does the same                                                                                                                                        |
| 17  | Admin override for a departed owner's journal?                         | Not in this stage; named in Risks                                                                                                                                            | Product owner sub-agent: follow-up. Security and tenancy sub-agent (medium) proposed a narrow admin path; the more reversible option (do less now) taken                                                                            |
| 18  | R2 purge on delete                                                     | None now; the photograph-upload change owns it                                                                                                                               | Decided by security and tenancy sub-agent (high): nothing belongs to a journal at HEAD                                                                                                                                              |
| 19  | Plan paths that no longer exist                                        | `e2e/product-modules.spec.ts` (no baselines), `scripts/visual/capture.mjs`, no `e2e/__screenshots__`; `copy-rules.test.ts` joins the owned paths                             | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md`; verified by `ls`                                                                                                                                            |
| 20  | Name other plan stages by id in this spec?                             | No                                                                                                                                                                           | Applied default, verified in `.ai/scripts/backlog-status.mjs`: an id in a spec marks that stage covered                                                                                                                             |
