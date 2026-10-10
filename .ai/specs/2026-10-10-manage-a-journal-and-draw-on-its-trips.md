# Journal: manage a journal, and draw on its trips

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | #1095                                    |
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
| `CONTEXT.md` - **Anchor**; the **Archive** entry rewritten to state the trip meaning and the journal meaning separately; `docs/adr/<next free number>-journal-anchors-are-copies.md` (08-S3b)                                                                             |                                                                                                                                                                            |

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
  `AUTHORED_ERROR_NAMES` in `src/server/errors/public.ts`; the trip precedent, `TripRoleError`, is authored because the trip screens
  show a role's reason to a person who can see the control; here the menu is not rendered for a non-owner, so the refusal is a
  forged-request edge and the reader sees the caller's localised generic failure, `docs/SPEC.md` §9 rule 10). It is called by
  `updateJourney`, `publishJourney`, `unpublishJourney`, `deleteJourney`, the two new status verbs and `importTripPlaceAnchors`.
  Its callers outside the server functions are the dev seeder (`src/routes/api/dev/-seed/apply.ts` calls
  `deleteJourney(owner, stale.id)`; the phase verifies the stale row's owner is always that actor, else the seeder deletes as the
  owner it created the row for) and the repository suites, whose fixtures must act as the journal's owner.
- **`archived` implies no token, in the repository.** `updateJourneyInput` (repository) still accepts `status` and `visibility`
  for the seeder; so `updateJourney` writes `public_token = null` whenever the resulting `status` is `'archived'`, and
  `archiveJourney` is the same rule with the guard in front. No path leaves an archived journal with a token.
- `canManage: boolean` is computed **server-side** by the same `canManageJourney` and carried on the loaders. The client never
  compares ids and no user id is shipped. It is a rendering hint; the repository is the authority.
- **Workspace owners and admins have no override in this stage.** A journal whose owner left the workspace but which is still
  readable - one that never had a trip (readable by every member), or a trip-bound one whose trip stays readable - keeps its quota
  slot (`countedJourneyFilter` excludes only a trip-bound orphan) with nobody able to delete it. That is real and
  is named in Risks; it is a follow-up, not a reason to widen the guard here.

### The lifecycle verbs

| Verb         | Repository                | Server function (POST, `z.strictObject`)                                                                                   | Behaviour                                                                                                                                                                                                                                                 |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit details | `updateJourney` (guarded) | `updateJourneyFn { journeyId, title, subtitle, startedOn, endedOn }`                                                       | Title, subtitle, dates only. **No `status`, `visibility`, `slug`, `coverImageUrl`, `coverGradient`, `publicToken` field exists in the boundary schema** (Resolved assumption 6). Blank subtitle/date clears. End before start is refused on the boundary. |
| Archive      | `archiveJourney` (new)    | `setJourneyStatusFn { journeyId, status: 'archived' }`                                                                     | One update: `status = 'archived'` **and** `public_token = null`, so an archived journal is never reachable by a link (seeded journals are `published` with tokens). Archiving an archived journal is a no-op.                                             |
| Restore      | `restoreJourney` (new)    | `setJourneyStatusFn { journeyId, status: 'draft' }`                                                                        | `archived -> draft`, always `draft` (the previous status is not stored and there is no migration). Restoring a journal that is not archived is a no-op. The schema accepts `'archived'` and `'draft'` only.                                               |
| Delete       | `deleteJourney` (guarded) | `journalDeleteSummaryFn { journeyId }` (GET, behind `requireOwnedJourney`), `deleteJourneyFn { journeyId, confirmTitle? }` | The summary reads the journal's entries (non-place), places, photos and `requiresTitle`. The delete **re-derives** the rule from its own counts and refuses a missing or wrong `confirmTitle`, as `assertConfirmed` does for trips. Rows cascade.         |

The threshold: `requiresTitle` is true when the journal holds **at least one entry of any type (anchors included) or one
photograph**; an empty journal is a one-click confirm (Resolved assumption 8). `confirmTitle` is compared in the handler, never
with a client-known literal.

### Drawing on trips (08-S3b)

- **`listJourneyTrips(scope, journeyId)`** resolves the journal through `requireJourney`, then two indexed reads: a group-by of
  `source_trip_id` over the journal's entries on `journey_entries_org_journey_idx` with the anchor count (`type = 'place'`), and
  `readableTrips(scope).findMany` for titles. The seed `journeys.trip_id` is unioned in code. It returns
  `{ trips: [{ tripId, title, anchorCount }] }`: **a trip the viewer cannot read gets no badge, no title and no count** - not even
  "and N more" (ADR 0007: a non-member of a private trip sees no row, count or aggregate of it). A deleted trip drops out
  (`source_trip_id` is nulled; its anchors keep their text).
- **`importTripPlaceAnchors(scope, journeyId, tripId)`**: `requireOwnedJourney`, then `requireTrip` (never `getTrip`, which returns
  `null`, and never a bare `requireById`), then the **audience rule**, then the plan below. Returns
  `{ added, skipped, remaining }`.
- **The audience rule** (Resolved assumption 9). The copies are readable by the journal's readers, not the trip's. So a trip may be
  imported only when everyone who can read the journal can already read it: for a journal with no trip, the trip's
  `visibility` is **exactly** `organization` (`public` gives a signed-in reader nothing, `src/server/repos/trips.ts`, so it does not
  qualify); for a trip-bound journal, the trip is the journal's own `trip_id` or is `organization`-visible; for an orphan
  (owner-only readable, ADR 0034), any trip the owner can read. Otherwise `JourneyTripAudienceError`
  (`FORBIDDEN`-coded, same treatment as the owner error) and **no row is written**. The dialog lists only eligible trips, and says
  who will see the places (`policy.ts` exports `journalAudience(journey)` and `canImportTrip(journey, trip)`, pure and tested,
  with a `public` and a `private` case).
- **Anchors are copies, and that is a decision on record.** The audience check runs once, at import. If the trip later goes from
  `organization` to `private`, or a member loses access to it, the copied names, coordinates and dates stay readable by the
  journal's readers, and the trip's owner is not warned. That is a reader rule beyond ADR 0007, 0020 and 0034, so 08-S3b records it
  in `docs/adr/<next free number>-journal-anchors-are-copies.md` (decision, the dialog's stated audience as the mitigation, and the
  conditions the later stages inherit: see Risks). It is not hidden by a read-time check, because that would make a journal's
  text depend on a trip it no longer reads from.
- **The anchors.** One `type = 'place'` entry per place not yet anchored in this journal (any entry type with that
  `source_place_id` counts as anchored): `title` and `location_name` = the place's name, `lat`/`lng` as the place has them (both or
  neither), `source_trip_id`, `source_place_id`, `author_user_id` = the caller, `body` null. **The hand-written insert does not
  go through `createTenantRepository`**, so the tenant stamp is explicit: `organization_id` is bound from `scope.ctx`, never from
  the caller, and the tenant test asserts the organization of every written row.
- **`entry_date` (pure, `src/lib/journal/anchors.ts`, `today` injected):** the earliest non-null `days.date` among the place's
  `day_assignments`; else the trip's `start_date`; else the journal's `started_on`; else the import day. Not clamped to the journal's
  range. The inputs come from the existing readers - `listTripDays` (`src/server/repos/days.ts`) and `listTripAssignments`
  (`src/server/repos/itinerary.ts`) - so `journey.ts` hand-rolls no read of tables those repositories own; `anchors.ts` is the
  pure join. **`sort_order`:** `max(existing sort_order in this journal, 0) + 1 + k`, `k` = the anchor's index in import order
  (anchor date, `places.sort_order`, id); listing already orders by `entry_date, sort_order, id`, so the read is deterministic even
  if the base read races.
- **Idempotent under overlap** (Resolved assumption 10). There is no unique index on `(journey_id, source_place_id)` and none is
  added: a later stage may legitimately write two entries about one place. The guard is in the statement: one insert per place,
  each `INSERT ... SELECT <bound values> FROM places WHERE places.id = ? AND <tenant filter> AND NOT EXISTS (SELECT 1 FROM
journey_entries WHERE organization_id = ? AND journey_id = ? AND source_place_id = ?)`, ids from `newId()` in JS, all in one
  `runBatch` (D1 runs a batch's statements serially and atomically, so statement N sees a rival's committed rows). A place deleted
  between the read and the batch is silently skipped. Each statement binds about 25-30 parameters, under the 100 ceiling
  (`MAX_BOUND_PARAMETERS`). Drizzle's `insert().select()` emits a **full-column** insert and `$defaultFn` defaults (id, timestamps)
  do not run, so the SELECT supplies **every column in schema order**, including `created_at` and `updated_at` in the column's
  storage unit; and it carries `places.trip_id = ?` so a place moved or swapped between the read and the batch is never anchored
  under the wrong `source_trip_id`. Step 1 of the phase is a **spike** that proves this batches on D1 and on the test harness. The
  fallback is decided now, not left open: the same statement as a `sql` template inside the same `runBatch` (repository SQL is
  allowed there); **never** read-then-insert, which reopens the race. `runBatch` falls back to sequential awaits on a driver
  without `batch()`: each guarded statement stays idempotent on its own, only the all-or-nothing atomicity is lost, and the test
  harness case says so.
- **Cap:** `MAX_ANCHORS_PER_CALL = 30`. D1 counts each statement of a batch as a query, and a Worker invocation may issue 50 on the
  Workers free plan (1000 on paid). The call also spends about ten queries on reads (the session, `requireOwnedJourney`,
  `requireTrip`, the trip's places, days, assignments, the existing anchors, the max sort order) and one on the recount, about 43 in
  all, and the spike asserts that total; 30 inserts keep it under 50 on both plans; `batch.ts` asks for small batches.
  The result carries `remaining`; the dialog knows the total from the chosen trip's `toAdd` and repeats the call while
  `remaining > 0` and `added > 0`, one click, announcing the running count, so a 340-place trip is twelve calls and still one
  gesture. If a call returns `added = 0` with `remaining > 0` (a rival import anchored the whole chunk), the loop stops and the
  dialog reports the partial outcome below. A failure part-way keeps what was added; repeating is
  safe and makes progress. `added` is counted from the minted ids that now exist (chunks of 90), not assumed.
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
- Entry counts: the predicate "entry of type `place`" is defined **once** in the repository and used by `listJourneysWithCounts`,
  `getJourneyStory` and `listRecentEntries`, so the card, the cover and the "what did you last write" strip cannot disagree.
  08-S3a introduces the predicate and the delete summary (which needs it); 08-S3b changes `entryCount` to exclude anchors, adds
  `placeCount` and the Places figure, and makes the recent strip skip anchors, so no ticket ships a changed count without the
  figure that explains it. 08-S3a also makes the recent strip skip the entries of archived journals (an archived journal leaves
  the default lists). The index's own totals (entries written, journeys, photographs) and the moods tally are **not** filtered: they
  deliberately count archived work too, because archiving shelves a journal rather than erasing what was written in it. The
  predicate `type = 'place'` also matches a hand-written place entry once a composer exists; that is accepted (a deleted place
  nulls `source_place_id`, so the entry survives as text) and is a decision the composer's owner inherits.

**Backward compatibility** (`BACKWARD_COMPATIBILITY.md`): every new field and function is additive. `entryCount` changes meaning
(anchors no longer count) in 08-S3b, which ships with its only consumers (the card and the cover) in the same change. The owner guard
changes the contract of four repository functions that have no caller outside the dev seeder and the repository tests; no URL,
stored value, event or migration is touched.

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

| Function                       | Input                                                | Output                                                                                                             |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `updateJourneyFn`              | `{ journeyId, title, subtitle, startedOn, endedOn }` | `{ journeyId }`; the route invalidates                                                                             |
| `setJourneyStatusFn`           | `{ journeyId, status: 'archived' \| 'draft' }`       | `{ status }`                                                                                                       |
| `journalDeleteSummaryFn` (GET) | `{ journeyId }`                                      | `{ title, entries, places, photos, requiresTitle }`                                                                |
| `deleteJourneyFn`              | `{ journeyId, confirmTitle? }`                       | `{ ok: true }`                                                                                                     |
| `loadJourneyTripLinks` (GET)   | `{ journeyId }`                                      | `{ audience, linked: [{ tripId, title, anchorCount }], linkable: [{ tripId, title, startDate, endDate, toAdd }] }` |
| `importTripPlacesFn`           | `{ journeyId, tripId }`                              | `{ added, skipped, remaining }`                                                                                    |

`loadJourneys` and `loadJourneyStory` gain `canManage` (08-S3a) and `placeCount` (08-S3b); `entryCount` becomes the count of entries
that are **not** anchors (08-S3b; so a 14-place import does not read as "14 entries" next to "14 places"); `loadJourneyStory` also
carries `trips` for the badges (08-S3b). Errors: a refusal reaches the screen as the action's generic failure (no new class in
`AUTHORED_ERROR_NAMES`); `QuotaExceededError` is not thrown (no metered row is created).

`loadJourneyTripLinks` is owner-only (`requireOwnedJourney`). `linkable` is the trips the caller can read **and** the audience rule
admits, newest first by start date (undated last), at most 50, not archived; `toAdd` is one grouped query (`places` of those trips
with no anchor in this journal). It replaces the past-trips-only, 30-row `loadJourneyTripOptions` for this dialog; that loader is
still the new-journey dialog's.

## 📝 UI/UX

### Actions menu (`JourneyActions`)

A `DropdownMenu` (the primitive has no bottom-sheet mode; `trip-actions.tsx` uses a plain menu at every width, and so does this)
with: **Edit details**, **Archive** (hint: "Tucks it away. It still counts toward your plan's journal limit.") or **Restore** on an
archived journal, **Delete...** (danger tone). Rendered only when `canManage`. The way into the trip dialog is the one **Import a
trip's places** button in the story aside (08-S3b); there is no second entry in the menu.

- **Story header** (`$journeyId.tsx`): in the cover card's top row, beside the status `Badge`. The cover is an inverse surface, so
  the trigger is `IconButton size="lg" variant="inverse"`.
- **Index card** (`JourneyTile`): the `<li>` becomes `relative`; the `Card asChild interactive` + `Link` stay byte-identical; the
  menu is a **sibling** of the link, absolutely positioned at the top-end (`end-3 top-3`, logical properties), accessible name
  "Actions for {title}". The trigger is an `IconButton` at `size="lg"` (48 px, above the 44 px target), `variant="inverse"` because it sits on the cover, and is **always visible at
  every width** - it is not hidden until hover, so a keyboard or touch user never meets an invisible control (2.4.7). The
  photo-count chip moves to the bottom-end of the cover so the corner is free. Focus order: link, then menu.
- The 44 px claim covers triggers and buttons. Menu items keep the shared primitive's row height (`components/ui` is not touched
  here), which still meets WCAG 2.5.8 (24 px).
- **Edit details** opens a `Sheet` (the trip edit sheet's pattern): title, subtitle, started on, ended on (existing field
  labels), a **Cancel** and a submit button; an error keeps the sheet open with its values and a retry; a save in flight owns the
  sheet.
- **Archive** is one click (reversible, no confirmation) with a toast; **Restore** returns it to `draft`.
- **Delete** opens a `Dialog`. It reads `journalDeleteSummaryFn` on open: four `Skeleton` rows with `role="status"` and a label
  while loading; if the read fails, an `Alert` with its own error title and a retry, and no delete button. Loaded, it names the
  journal and its entries, places and photographs as counts, says it cannot be undone and points to Archive. When `requiresTitle`,
  it follows the trip delete dialog's pattern (3.3.2, 3.3.1): a labelled field with the expected title as the Field `hint` (wired
  through `aria-describedby`), and the delete button **disabled until the text matches** exactly; there is no per-keystroke
  announcement. **Cancel** and `Escape` close it. A failed delete keeps the dialog open and never navigates away.
- **Where focus goes** (2.4.3), by case:
  - Edit saved or cancelled, delete cancelled or `Escape` (the menu item that opened the dialog unmounts, so the target is set
    explicitly): the menu trigger. A failed save or failed delete: focus returns to the submit button or moves to the error
    `Alert` (`tabIndex={-1}`) when the request ends. The import dialog's `Cancel` and `Escape`: the **Import a trip's places** button.
  - Archive or Restore on the **story page**: the trigger, which stays.
  - Archive or Restore on an **index card**: the tile moves between the grid and the archived section, so focus goes to the moved
    tile's menu trigger when it is rendered (the section opens to show a just-archived tile only if the user opened it; otherwise to
    the `<summary>` of "Archived"), and restoring moves focus to the restored tile's trigger in the grid.
  - Delete from the **index**: the next tile's link, else the previous, else the page `h1` (`tabIndex={-1}`).
  - Delete from the **story page**: after navigating to `/journey`, the `h1` (`tabIndex={-1}`).

### Index

Archived journals leave the main grid for one **collapsed "Archived (N)" section** after it (a native `<details>`, so it is keyboard
and screen-reader complete), keeping the status badge and the actions menu. The `<summary>` carries the `focusRing` token, is at
least 44 px tall and holds text only (no heading inside it); the section is **not rendered when N is 0**. `drafts` becomes
`journeys - published - archived`. The page description and the "published / in draft" caption stop counting archived journals as
drafts.

### Trips (08-S3b)

- Story page: a **Trips** panel in the aside lists the journal's readable trips as `Badge`s (nothing at all about a trip the viewer
  cannot read) and, for the owner, an **Import a trip's places** button that opens `TripLinkDialog`. Empty state on
  `--color-surface-2`: "This journal is not tied to a trip yet" with the button and one line saying what an anchor is.
- `TripLinkDialog`: a trip `Select` over `linkable` (four `Skeleton` rows with `role="status"` and a label while loading; a load
  failure is an `Alert` with its own title and a retry; an empty `linkable` list says "No trips to import" and why - private trips
  cannot be added to a journal other people can read). After a choice: "Adds {count} places as anchors; ones already here are
  skipped" and the audience sentence ("Everyone in this workspace will see these places" / "Everyone who can open {trip} will see
  them" / "Only you will see them", plus "The copies stay if the trip is later changed or deleted"), **Cancel** and an import
  button with `loadingLabel` "Importing" and the running count in a polite live region.
- Outcomes (4.1.3). Every outcome except full success renders as an `Alert` (`role="status"`) inside the dialog. `Button` with
  `loading` is natively `disabled` and drops focus, so when a request ends focus **returns to the import button** (or, after a
  failure, moves to the `Alert`, which has `tabIndex={-1}`); the running-count live region is in the page before the import starts
  and announces only the count, not what the `Alert` says. **Full success** shows the count in a toast and closes the dialog,
  returning focus to the **Import a trip's places** button;
  **zero new** is an informational `Alert` ("Every place from that trip is already here"), not an error, and the dialog stays
  open; **partial** (the loop stopped on an error after some calls) says "Added {added} of {total}. Import again for the rest."
  and the dialog stays open; a **failure** keeps the dialog open with a retry.
- Cards and the cover add a **Places** figure (`tabular-nums`); `Entries` counts entries that are not anchors.
- Imported anchors enter the story list on a 200 ms opacity and 4 px translate on `--ease-out-quint`, staggered 24 ms and capped at
  eight; `prefers-reduced-motion: reduce` collapses to opacity.

Accessibility: every item and button has a visible focus ring and an accessible name; the dialog and sheet trap focus and return
it as the cases above say; `Escape` cancels; counts are not colour only; 360 px to 2560 px, light and dark.

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

| Key (en)                                                      | Text                                                                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `actions.trigger`                                             | Actions for {title}                                                                                                                       |
| `actions.edit`                                                | Edit details                                                                                                                              |
| `actions.archive`                                             | Archive                                                                                                                                   |
| `actions.archiveHint`                                         | Tucks it away. It still counts toward your plan's journal limit.                                                                          |
| `actions.restore`                                             | Restore                                                                                                                                   |
| `actions.delete`                                              | Delete...                                                                                                                                 |
| `edit.title`                                                  | Edit journal                                                                                                                              |
| `edit.submit` / `edit.saving`                                 | Save changes / Saving                                                                                                                     |
| `edit.saved`                                                  | Journal updated                                                                                                                           |
| `edit.errorTitle` / `edit.error` / `edit.retry`               | Could not save / That did not save. Nothing was changed. / Try again                                                                      |
| `status.archived`                                             | Archived                                                                                                                                  |
| `status.archivedBody`                                         | It still counts toward your plan's journal limit.                                                                                         |
| `status.restored`                                             | Restored as a draft                                                                                                                       |
| `status.error`                                                | That did not change. Try again.                                                                                                           |
| `delete.title`                                                | Delete {title}?                                                                                                                           |
| `delete.entries` (plural)                                     | {count} entries / 1 entry                                                                                                                 |
| `delete.places` (plural)                                      | {count} places / 1 place                                                                                                                  |
| `delete.photos` (plural)                                      | {count} photographs / 1 photograph                                                                                                        |
| `delete.irreversible`                                         | This cannot be undone. Archive it instead if you might want it back.                                                                      |
| `delete.typeTitle`                                            | Type {title} to delete it.                                                                                                                |
| `delete.confirm` / `delete.deleting`                          | Delete journal / Deleting                                                                                                                 |
| `delete.deleted`                                              | Journal deleted                                                                                                                           |
| `delete.error`                                                | The journal was not deleted. Nothing was removed.                                                                                         |
| `index.archived` (plural)                                     | Archived ({count})                                                                                                                        |
| `figure.places`                                               | Places                                                                                                                                    |
| `trips.label`                                                 | Trips                                                                                                                                     |
| `trips.empty.title` / `trips.empty.body`                      | This journal is not tied to a trip yet / An anchor is a place from a trip that you can write against.                                     |
| `trips.import`                                                | Import a trip's places                                                                                                                    |
| `trips.dialog.title` / `trips.dialog.description`             | Import a trip's places / Each place becomes an anchor in this journal. Places already here are skipped.                                   |
| `trips.pick`                                                  | Trip                                                                                                                                      |
| `trips.willAdd` (plural)                                      | Adds {count} places as anchors; ones already here are skipped                                                                             |
| `trips.audience.workspace` / `.trip` / `.owner`               | Everyone in this workspace will see these places. / Everyone who can open {trip} will see these places. / Only you will see these places. |
| `trips.audience.stays`                                        | The copies stay if the trip is later changed or deleted.                                                                                  |
| `trips.importing`                                             | Importing                                                                                                                                 |
| `trips.added` (plural)                                        | Added {count} places                                                                                                                      |
| `trips.partial`                                               | Added {added} of {total}. Import again for the rest.                                                                                      |
| `trips.none`                                                  | Every place from that trip is already here                                                                                                |
| `trips.error`                                                 | The places were not imported. Nothing was added twice.                                                                                    |
| `edit.cancel` / `delete.cancel` / `trips.cancel`              | Cancel                                                                                                                                    |
| `delete.loading`                                              | Loading what this journal holds                                                                                                           |
| `delete.loadErrorTitle` / `delete.loadError` / `delete.retry` | Could not check the journal / Nothing was deleted. Try again. / Try again                                                                 |
| `delete.titleLabel`                                           | Journal title                                                                                                                             |
| `delete.summary`                                              | This journal holds {entries}, {places} and {photos}. (the three values come from the plural keys above)                                   |
| `trips.submit` / `trips.pickPlaceholder`                      | Import places / Choose a trip                                                                                                             |
| `trips.loading`                                               | Loading your trips                                                                                                                        |
| `trips.loadErrorTitle` / `trips.loadError` / `trips.retry`    | Could not load your trips / Nothing was imported. Try again. / Try again                                                                  |
| `trips.noneToImport.title` / `trips.noneToImport.body`        | No trips to import / Private trips can't be added to a journal other people can read.                                                     |
| `trips.progress` (plural)                                     | Added {count} places so far                                                                                                               |

## 📝 Edge Cases & Failure Scenarios

| Case                                                                              | Behaviour                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A member who is not the owner forges `deleteJourneyFn`                            | `JourneyOwnerError` (FORBIDDEN, generic failure on screen); a non-reader of a trip-bound journal gets `NotFoundError`                                                                   |
| A foreign workspace's journal or trip id                                          | `NotFoundError`; nothing written                                                                                                                                                        |
| Owner imports a private trip into a workspace-readable journal                    | `JourneyTripAudienceError`; no row written; the trip is not offered                                                                                                                     |
| Orphaned journal (ADR 0034), the owner reads it                                   | Owner keeps every action; anyone else gets `NotFoundError`; any trip the owner can read is importable                                                                                   |
| Owner left, journal still readable (never had a trip, or its trip stays readable) | Cannot be edited or deleted by anyone; keeps its slot. Follow-up, see Risks                                                                                                             |
| Archive a published (seeded) journal                                              | Status `archived` and `public_token` null in one update; restore gives `draft`                                                                                                          |
| Archive when it is the only slot on the free plan                                 | Allowed; the toast and the hint say it still counts; the section keeps it findable so it can be deleted                                                                                 |
| Delete a journal with entries, no `confirmTitle` (forged)                         | Refused by the handler's own count; nothing removed                                                                                                                                     |
| Delete during a navigation / second tab already deleted it                        | `NotFoundError` -> generic failure; the dialog closes on refresh                                                                                                                        |
| End date before start date                                                        | Refused on the boundary (and on the form); nothing saved                                                                                                                                |
| Rename a journal                                                                  | The slug stays as it is: `updateJourneyFn` has no slug field and `updateJourney` reserves a slug only when one is passed; journal routes use the id, so nothing resolves the slug today |
| Import the same trip twice, or two overlapping requests                           | Each place is anchored once; the second reports `skipped` (and `added: 0`)                                                                                                              |
| A trip with 340 places                                                            | The dialog calls the import twelve times (30 per call) while `remaining > 0`, announcing the running count; a failure part-way keeps what was added and a retry continues from there    |
| A place deleted between the read and the batch                                    | Skipped silently; the others are added                                                                                                                                                  |
| A place on several days, an undated trip, a journal with no dates                 | `entry_date` from the chain; deterministic; the import day only as the last resort                                                                                                      |
| A place with no coordinates                                                       | Anchored with `location_name` and null lat/lng                                                                                                                                          |
| A trip deleted after import                                                       | `source_trip_id`/`source_place_id` nulled; the anchors keep their text; the badge disappears                                                                                            |
| The viewer can read the journal but not an imported trip                          | No badge, no title, no count of hidden trips; the anchors themselves are copies and read like any entry                                                                                 |
| Double-tap on any button                                                          | Disabled while pending; the server operations are idempotent or refused the second time                                                                                                 |
| Dropped connection mid-save or mid-import                                         | The dialog stays open with its values and a retry; an import retried adds only what is missing                                                                                          |
| RTL locales, 23 locales                                                           | Logical properties only; the plural keys carry every category; counts use `tabular-nums`                                                                                                |

## ✅ Acceptance criteria

1. Only the owner can edit, archive, restore, delete or import: every guarded repository function and server function refuses a
   reader who is not the owner (`FORBIDDEN`), and an unreadable or foreign id is `NotFoundError`, with nothing changed.
2. `updateJourneyFn` cannot change `status`, `visibility`, `slug`, a cover or a token; a rename leaves the slug unchanged.
3. Archiving clears `public_token`; restoring yields `draft`; both are idempotent; the index shelves archived journals in their own
   disclosure and `drafts` excludes them.
4. A journal with any entry or photograph cannot be deleted without its exact title, enforced by the server from its own counts; an
   empty journal deletes with one confirmation; the dialog names the counts and offers Archive.
5. `listJourneyTrips` returns the distinct source trips plus the seed trip, readable ones only and no count of the rest; a member
   who cannot read trip B never receives B's title or a hint that it exists.
6. `importTripPlaceAnchors` writes one anchor per not-yet-anchored place with the date and order rules above, stamped with the
   caller's organization and user, in one batch; importing again adds nothing; an overlapping request (a rival anchor committed
   between the read and the batch) leaves exactly one entry per place; 120 places import as
   30 + 30 + 30 + 30, each call reporting `remaining`, and the dialog completes them from one click.
7. The audience rule refuses a trip the journal's readers could not already read, writing nothing; the dialog lists only eligible
   trips and states the audience.
8. A foreign trip into the caller's journal, and the caller's trip into a foreign journal, are `NotFoundError` with the entry
   counts unchanged.
9. `entryCount` excludes anchors and `placeCount` counts them, from one predicate, on the card, the cover and the recent-entries strip (which also skips the entries of archived journals).
10. `create-dialogs.tsx` is gone; both dialogs behave as before; the copy-rules test still passes and still checks the moved files'
    literals, directional icons and key reads; `grep -rn create-dialogs src` finds nothing.
11. All new keys exist in all 23 locales; the parity test passes; no hard-coded literal is added (the index route's existing English
    literals are not touched).
12. Light/dark, 360 px to 2560 px, keyboard-complete, focus returns to the trigger; console silent; no layout shift after the dialog
    loads.

## 📝 Risks & Impact Review

| Risk                                                                                                                                                                                                                                                                                                            | Severity | Mitigation / residual                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A guard added to existing repository functions changes their contract                                                                                                                                                                                                                                           | medium   | They have no production caller; run the journey, member-isolation and tenant suites and fix any test that mutated as a non-owner by making the fixture's actor the owner                                                                                                                                                                          |
| Disclosure by import (names, coordinates, dates of a trip copied where its readers are not)                                                                                                                                                                                                                     | high     | The audience rule refuses it; the dialog states the audience; the copies outlive the trip and the dialog says so                                                                                                                                                                                                                                  |
| Idempotence under overlap depends on Drizzle expressing a guarded insert                                                                                                                                                                                                                                        | medium   | The spike is step 1 and the fallback is decided (the same statement as a `sql` template in the same `runBatch`; never read-then-insert); the harness refuses > 100 parameters; the sequential-await driver fallback loses only atomicity                                                                                                          |
| Parenting attack: own journal + foreign trip, foreign journal + own trip                                                                                                                                                                                                                                        | high     | `requireOwnedJourney` + `requireTrip`, both tenant-and-readability aware; tested with unchanged entry counts                                                                                                                                                                                                                                      |
| A departed owner's journal stays readable and counted - one that never had a trip is readable by every member (ADR 0034 hides only a trip-bound orphan), a trip-bound one while its trip is readable - and under this spec nobody can delete it; on the free plan that blocks the workspace's only journal slot | medium   | Out of scope for the guard here. A human decides the admin path, because it touches the plan quota: the slicing step files a follow-up issue for a narrow workspace-owner path (archive, restore, delete only) and links it from the tickets                                                                                                      |
| Journal delete will orphan R2 objects once uploads exist                                                                                                                                                                                                                                                        | medium   | None exist now; the uploads change owns the purge (Data Model)                                                                                                                                                                                                                                                                                    |
| Anchors outlive the trip's visibility (the trip goes private, a member loses access; the copies stay readable by the journal's readers and the trip's owner is not warned)                                                                                                                                      | medium   | Recorded as a decision in the ADR 08-S3b adds; the dialog states the audience and that the copies stay; later stages inherit the conditions below                                                                                                                                                                                                 |
| Later stages that touch the same rows                                                                                                                                                                                                                                                                           | medium   | Conditions carried to them: the stage that publishes a journal **re-checks the audience rule** (anchors become public through the token); the stage that lets other members write entries **warns before a journal delete cascades away their entries**; the stage that uploads photographs **purges R2 objects in the same batch as the delete** |
| Archived journals keep a quota slot                                                                                                                                                                                                                                                                             | low      | The hint and the toast say so; the archived section keeps them findable so they can be deleted                                                                                                                                                                                                                                                    |
| `journey_entries` is unmetered                                                                                                                                                                                                                                                                                  | low      | Anchors are one per place per journal and bounded by the metered places; the entry-writing change owns a ceiling                                                                                                                                                                                                                                  |
| The index route still ships English literals                                                                                                                                                                                                                                                                    | low      | Pre-existing; this stage adds none and does not touch them; named in Out of scope                                                                                                                                                                                                                                                                 |
| `humaniseToken(status)` labels are English-derived                                                                                                                                                                                                                                                              | low      | Pre-existing (documented in `en/journal.ts`); the archived section title is a catalogue key                                                                                                                                                                                                                                                       |

### Out of scope

Publishing, unpublishing and the public page; re-covering a journal (an image URL is a hotlink, and a gradient-only picker has no home until a cover can be uploaded - a deviation from the plan, whose owner is the stage that adds photograph uploads); the entry composer, photographs and their storage and
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
   `deleteJourney`; `archiveJourney`, `restoreJourney`; `updateJourney` nulls the token whenever the status becomes `archived`; the delete
   summary read; the single place-count predicate; the recent strip skips the entries of archived journals. Repository, member and
   tenant-isolation cases (owner, non-owner reader, non-reader, foreign, orphan). Verify `src/routes/api/dev/-seed/apply.ts` (its
   `deleteJourney(owner, stale.id)`) still acts as the stale row's owner, and fix the repository fixtures that mutated as a non-owner.
3. `src/routes/_app/-server/journal.ts`: the four functions with strict schemas and `journal.test.ts` (non-owner refused, forged
   delete without title refused, archive clears the token).
4. Move the dialogs into `src/components/journey/` and `src/components/collections/` with `create` props and a local wrapper in
   `journey/index.tsx`; update both route imports; `copy-rules.test.ts` (`APP_FILES` loses the entry, a `MODULE_FILES` list reads
   the moved files); the `console/index.ts` comment; `grep -rn create-dialogs src` is empty. This is the plan's consolidated move table for
   `create-dialogs.tsx` (one source file -> `new-journey-dialog.tsx` and `new-collection-dialog.tsx`, one owner); the table's other
   row, the atlas map, belongs to the atlas tracker's own spec and is not repeated here.
5. `JourneyActions`, `JourneyEditSheet`, `JourneyDeleteDialog`, the tile restructure, the archived disclosure, `canManage` on the
   loaders; component tests; the `journal.*` keys in 23 locales; `CONTEXT.md` **Archive** rewritten as two stated meanings (a trip's
   archive is not a status and restore brings the lifecycle status back; a journal's archive is a status, it unpublishes, and
   restore returns to draft).
6. The e2e `describe`.

### Phase 2 - draw on trips (08-S3b)

1. The insert-select spike in the harness (full-column insert with explicit timestamps, `places.trip_id` guard, batching, overlap,
   the 30-statement cap and the per-call query count).
2. `src/lib/journal/anchors.ts` (+ test, table-driven), `importTripPlaceAnchors`, `listJourneyTrips`; repository cases incl. the
   overlap wrapper, the 120-place (four calls of 30) case and the tenant parenting cases.
3. `loadJourneyTripLinks`, `importTripPlacesFn` and cases; `entryCount` excludes anchors, `placeCount` and `trips` on
   `loadJourneyStory`; the recent strip skips anchors.
4. `TripLinkDialog` (with the repeat-while-`remaining` loop), the Trips panel, the Places figure, the motion; component tests; keys
   in 23 locales; `CONTEXT.md` **Anchor**; the ADR `journal-anchors-are-copies` (next free number).
5. The e2e `describe`.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on each phase's last commit.
- Unit: `src/lib/journal/__tests__/policy.test.ts`, `anchors.test.ts`; `src/routes/_app/-server/__tests__/journal.test.ts`;
  `journey-actions.test.tsx` (the destructive item opens the confirmation, the counts are named, `Escape` cancels, focus returns,
  the typed title gates the button); `trip-link-dialog.test.tsx` (count before and after; zero-new renders as information; only
  eligible trips are offered); the moved dialogs keep their existing behaviour.
- Tenant isolation, appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe`: in A's scope against B's
  ids, `updateJourney`, `archiveJourney`, `restoreJourney`, `publishJourney`, `unpublishJourney`, `deleteJourney` and
  `listJourneyTrips` and the delete-summary read are `NotFoundError` (not `[]`) with B's rows intact; `importTripPlaceAnchors(scopeA, aJourney, bTrip)` and
  `(scopeA, bJourney, aTrip)` are `NotFoundError` and **A's and B's entry counts are unchanged** (asserted, not only the throw); a
  successful import asserts the `organization_id` of **every written row** is the caller's.
  Same-workspace cases in `member-isolation`: the owner importing a `private` trip and a `public` trip into a journal the whole workspace can read is refused (`FORBIDDEN`) with the entry counts unchanged; non-owner reader `FORBIDDEN` for each verb, non-reader of a trip-bound journal
  `NotFoundError`, non-owner on an orphan `NotFoundError`, a member never receives a title of a trip they cannot read.
- Browser, per `docs/plans/12-verification-protocol.md` and ADR 0016 (no baselines, no `e2e/__screenshots__`):
  `e2e/product-modules.spec.ts` (create or append; `/journey` is already declared in `e2e/helpers/routes.ts`) reaches the story by
  clicking the first card, edits and restores a title, archives and restores a journal, creates then deletes a throwaway journal,
  imports an `organization`-visibility trip twice into the throwaway journal before deleting it (second reports zero), so a rerun on the same database drifts nothing, asserts the console is silent; serial, `chromium` only (`test.skip` on
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

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Applied default                                                                                                                                                                           | Why                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Publish and unpublish in this stage's menu?                                                                                                                                                                                                                                                                                                                                                                                                                    | No. The menu has edit, archive, restore, delete. `publishJourney`/`unpublishJourney` stay, gain the owner guard                                                                           | Decided by product owner sub-agent (high): no route resolves `public_token`; a Publish item promises a dead link; one owner per concept (`docs/SPEC.md` §8). `ADD-07` still closes: publishing is not in its behaviour set                                                                                                                                                                                       |
| 2   | Where do archived journals go, what does restore do, is the cost said?                                                                                                                                                                                                                                                                                                                                                                                         | A collapsed "Archived (N)" section; `drafts` excludes them; restore -> `draft`; the hint and the toast say it still counts toward the journal limit                                       | Decided by product owner sub-agent (medium): an archive that stays in the grid contradicts `CONTEXT.md` "leaves the default lists"; the quota counts archived rows. The glossary entry is amended in the same change                                                                                                                                                                                             |
| 3   | Who may rename and edit?                                                                                                                                                                                                                                                                                                                                                                                                                                       | The owner alone, with every other journal-level change                                                                                                                                    | Decided by product owner (medium-high) and security and tenancy (medium) sub-agents: title, cover and dates frame the whole journal; narrowest and easiest to widen later                                                                                                                                                                                                                                        |
| 4   | Where does the owner guard live, and what does a refusal look like?                                                                                                                                                                                                                                                                                                                                                                                            | In the repository (`requireOwnedJourney`); `NotFoundError` for an unreadable id, `FORBIDDEN` class not in `AUTHORED_ERROR_NAMES` otherwise; `canManage` computed server-side              | Decided by security and tenancy (medium) and software architect sub-agents; `requireOwnedTrip` is the pattern; SPEC §9 rule 10 closes the authored set                                                                                                                                                                                                                                                           |
| 5   | The plan's `requireById` for journal and trip?                                                                                                                                                                                                                                                                                                                                                                                                                 | Superseded: `requireJourney`/`requireOwnedJourney` and `requireTrip`                                                                                                                      | Security and tenancy and architect sub-agents (both high): `requireById` is tenant-only and skips ADR 0007/0020/0034                                                                                                                                                                                                                                                                                             |
| 6   | Which fields may an edit change?                                                                                                                                                                                                                                                                                                                                                                                                                               | Title, subtitle, started on, ended on; no status, visibility, slug, cover or token field in the schema                                                                                    | Security and tenancy sub-agent (high): reusing `updateJourneyInput` would let an edit publish or archive past `setJourneyStatusFn`                                                                                                                                                                                                                                                                               |
| 7   | The plan's "edit the cover"?                                                                                                                                                                                                                                                                                                                                                                                                                                   | Left out entirely, image URL and gradient; a deviation from the plan, owned by the stage that adds photograph uploads                                                                     | Applied default: a pasted image URL is a hotlink that sends every reader's address to a third party and uploads do not exist yet; a gradient-only picker has no home without an image cover; reversible. Product owner sub-agent asked that the deviation be recorded                                                                                                                                            |
| 8   | How hard does delete ask?                                                                                                                                                                                                                                                                                                                                                                                                                                      | Typed title when the journal holds any entry (anchors included) or photograph; one confirmation when empty; the server re-derives the rule; Archive offered                               | Decided by product owner sub-agent (medium-high): mirrors the trip rule (PRD #104 decision 10); a later change makes journals hold prose and should not have to change the ceremony                                                                                                                                                                                                                              |
| 9   | May the copies reach people who cannot read the trip?                                                                                                                                                                                                                                                                                                                                                                                                          | No. The audience rule refuses it and the dialog states the audience; only eligible trips are offered                                                                                      | Security and tenancy (medium: import owner-only, dialog names the audience) and software architect (high: enforce the rule) sub-agents; the stricter, more reversible union taken                                                                                                                                                                                                                                |
| 10  | How is the import idempotent under overlap, and how big is a call?                                                                                                                                                                                                                                                                                                                                                                                             | One guarded insert per place in one `runBatch`, spike first, stated fallback; cap 30 per call with `remaining`, the dialog repeating                                                      | Decided by software architect sub-agent (medium-high); security and tenancy sub-agent proposed 500 and best-effort idempotence; the architect's in-statement guard taken, and the cap lowered to 50 after the architect's second look: D1 counts each batch statement as a query and a free-plan Worker invocation may issue 50, and the call's reads count too (no new index); the cap settled at 30 in round 2 |
| 11  | `entry_date` and `sort_order` of an anchor?                                                                                                                                                                                                                                                                                                                                                                                                                    | Earliest dated assigned day, else trip start, else journal start, else the import day; `max + 1 + k`                                                                                      | Decided by software architect sub-agent (medium-high); pure and injectable `today`                                                                                                                                                                                                                                                                                                                               |
| 12  | A `journey_trips` table?                                                                                                                                                                                                                                                                                                                                                                                                                                       | No: derive from `source_trip_id` plus `journeys.trip_id`; never write `trip_id`                                                                                                           | Plan decision verified in the schema; software architect sub-agent (high): sound given `ON DELETE SET NULL`; readable trips only for titles                                                                                                                                                                                                                                                                      |
| 13  | The places count?                                                                                                                                                                                                                                                                                                                                                                                                                                              | Added to the card and the cover; `entryCount` excludes anchors, from one predicate                                                                                                        | Decided by product owner sub-agent (high): the reference behaviour names places as a count; without the split an import reads as "14 entries"                                                                                                                                                                                                                                                                    |
| 14  | Ticket cut and where the dialog move rides                                                                                                                                                                                                                                                                                                                                                                                                                     | Two tickets; the move rides with 08-S3a; 08-S3b is `Blocked by` 08-S3a                                                                                                                    | Decided by product owner sub-agent (high): a move-only ticket is not a tracer bullet                                                                                                                                                                                                                                                                                                                             |
| 15  | Server home and layering                                                                                                                                                                                                                                                                                                                                                                                                                                       | `src/routes/_app/-server/journal.ts`; components receive server calls as props                                                                                                            | Decided by software architect sub-agent (high, medium on props): `console/index.ts` states the seam; no component imports a route's `-server/` today                                                                                                                                                                                                                                                             |
| 16  | The menu as a bottom sheet at 360 px (plan)?                                                                                                                                                                                                                                                                                                                                                                                                                   | A plain `DropdownMenu` at every width; the edit form is a `Sheet`                                                                                                                         | Applied default: the primitive has no bottom-sheet mode and `trip-actions.tsx` does the same                                                                                                                                                                                                                                                                                                                     |
| 17  | Admin override for a departed owner's journal?                                                                                                                                                                                                                                                                                                                                                                                                                 | Not in this stage; named in Risks                                                                                                                                                         | Product owner sub-agent: follow-up. Security and tenancy sub-agent (medium) proposed a narrow admin path; the more reversible option (do less now) taken                                                                                                                                                                                                                                                         |
| 18  | R2 purge on delete                                                                                                                                                                                                                                                                                                                                                                                                                                             | None now; the photograph-upload change owns it                                                                                                                                            | Decided by security and tenancy sub-agent (high): nothing belongs to a journal at HEAD                                                                                                                                                                                                                                                                                                                           |
| 19  | Plan paths that no longer exist                                                                                                                                                                                                                                                                                                                                                                                                                                | `e2e/product-modules.spec.ts` (no baselines), `scripts/visual/capture.mjs`, no `e2e/__screenshots__`; `copy-rules.test.ts` joins the owned paths                                          | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md`; verified by `ls`                                                                                                                                                                                                                                                                                                                         |
| 20  | Name other plan stages by id in this spec?                                                                                                                                                                                                                                                                                                                                                                                                                     | No                                                                                                                                                                                        | Applied default, verified in `.ai/scripts/backlog-status.mjs`: an id in a spec marks that stage covered                                                                                                                                                                                                                                                                                                          |
| 21  | Do anchors keep following the trip's visibility?                                                                                                                                                                                                                                                                                                                                                                                                               | No: they are copies, recorded as a decision (ADR in 08-S3b); the dialog states the audience; later stages inherit conditions                                                              | Security and tenancy sub-agent (round 1): a new reader rule beyond ADR 0007, 0020 and 0034 needs a record; hiding anchors at read time would make a journal's text depend on a trip it no longer reads from                                                                                                                                                                                                      |
| 22  | Does the story tell a viewer how many trips they cannot read?                                                                                                                                                                                                                                                                                                                                                                                                  | No: nothing about an unreadable trip, not even a count                                                                                                                                    | Security and tenancy sub-agent (round 1): ADR 0007 allows no row, count or aggregate of a trip a viewer cannot read                                                                                                                                                                                                                                                                                              |
| 23  | Where does "archived implies no token" live?                                                                                                                                                                                                                                                                                                                                                                                                                   | In the repository (`updateJourney` nulls the token when the status becomes `archived`; `archiveJourney` is the same rule behind the guard)                                                | Security and tenancy sub-agent (round 1): the repository `updateJourneyInput` still accepts `status` for the seeder                                                                                                                                                                                                                                                                                              |
| 24  | How big is one import call?                                                                                                                                                                                                                                                                                                                                                                                                                                    | 30 anchors per call; the dialog repeats while `remaining > 0` and `added > 0`                                                                                                             | Software architect sub-agent (round 1): a batch statement counts as a D1 query and a free-plan invocation may issue 50; supersedes the original cap of 200; round 2 lowered 50 to 30 once the reads were counted                                                                                                                                                                                                 |
| 25  | Who reads `days` and `day_assignments` for the date chain?                                                                                                                                                                                                                                                                                                                                                                                                     | The existing `listTripDays` and `listTripAssignments`; `anchors.ts` joins them purely                                                                                                     | Software architect sub-agent (round 1): `journey.ts` must not hand-roll reads of tables other repositories own                                                                                                                                                                                                                                                                                                   |
| 26  | Does a rename change the slug?                                                                                                                                                                                                                                                                                                                                                                                                                                 | No: the slug stays                                                                                                                                                                        | Product owner sub-agent (round 1): `updateJourney` reserves a slug only when one is passed and the boundary schema has none                                                                                                                                                                                                                                                                                      |
| 27  | Do anchors and archived journals appear in the "what did you last write" strip?                                                                                                                                                                                                                                                                                                                                                                                | Anchors no (08-S3b); entries of archived journals no (08-S3a), from the same predicate                                                                                                    | Product owner sub-agent (round 1): the strip is about writing, and archived leaves the default lists                                                                                                                                                                                                                                                                                                             |
| 28  | How many ways into the trip dialog?                                                                                                                                                                                                                                                                                                                                                                                                                            | One: the **Import a trip's places** button in the aside; no menu item                                                                                                                     | Product owner sub-agent (round 1, nit)                                                                                                                                                                                                                                                                                                                                                                           |
| 29  | Hover-revealed card trigger?                                                                                                                                                                                                                                                                                                                                                                                                                                   | No: always visible; 48 px `IconButton`; `variant="inverse"` on the cover                                                                                                                  | Accessibility auditor sub-agent (round 1): 2.4.7 and 2.5.8; the menu items' row height is the shared primitive's                                                                                                                                                                                                                                                                                                 |
| 30  | How does the import loop end when a rival import anchors a whole chunk?                                                                                                                                                                                                                                                                                                                                                                                        | It stops on `added = 0` with `remaining > 0` and reports the partial outcome ("Added {added} of {total}. Import again for the rest."); `total` is the chosen trip's `toAdd`               | Software architect sub-agent (round 2): the stop condition had no outcome                                                                                                                                                                                                                                                                                                                                        |
| 31  | Where does focus go when a request ends or a dialog is cancelled?                                                                                                                                                                                                                                                                                                                                                                                              | Back to the submit/import button, or to the error `Alert` (`tabIndex={-1}`) after a failure; Cancel/Escape return to the explicit trigger; headings used as targets carry `tabIndex={-1}` | Accessibility auditor sub-agent (round 2): a `loading` button is natively disabled and drops focus (2.4.3)                                                                                                                                                                                                                                                                                                       |
| 32  | Do the delete-summary read and the private/`public` import refusal get their own tests?                                                                                                                                                                                                                                                                                                                                                                        | Yes: the summary is behind `requireOwnedJourney` and in the tenant-isolation list; `member-isolation` asserts a `private` and a `public` trip are refused with the entry counts unchanged | Security and tenancy sub-agent (round 2)                                                                                                                                                                                                                                                                                                                                                                         |
| 33  | **Panel verdicts, final.** Round 1: product owner approve with conditions (medium); software architect approve with conditions; security and tenancy revise (high); accessibility approve with conditions (medium). Round 2: product owner ship with fixes (high); software architect approve with conditions; security and tenancy approve with conditions - "security approves once the two changes are made" (high); accessibility ship with fixes (medium) | Every condition of both rounds is applied in this spec as new commits; no specialist is asked a third time                                                                                | Two rounds is the limit (`afk-plan-to-spec`). Security's round 2 conditions are the two test additions in row 32, now in the spec; the others are wording and numbers, applied                                                                                                                                                                                                                                   |
