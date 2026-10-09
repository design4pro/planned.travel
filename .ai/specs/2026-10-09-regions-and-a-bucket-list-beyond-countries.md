# Atlas: regions on the record, and a bucket list that is not only countries

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S2 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S2` closes reference row `ADD-05` (the atlas, the world-map tracker). Today a traveller can mark a **country**
visited and put a **country** on their bucket list, and can do nothing finer: the repository functions for a visited
**region** and for a bucket entry of kind `region` or `place` exist and no server function reaches them. This stage adds that
write half, as **two tickets that are each a full path from repository to screen**:

1. **08-S2a - regions on the record.** A "Regions" section on the country panel: add a region by name, remove it, and
   marking one marks the country too. Includes the mechanical move of the static world SVG into `src/components/atlas/`.
2. **08-S2b - a bucket list that is not only countries.** An "Add something" dialog on the bucket tab for an entry of kind
   `country`, `region` or `place`, a remove control on every bucket row, and a per-traveller ceiling.

No schema change, no migration, no route added, no package added.

The region record is **list-shaped, not map-shaped**: the repository holds no sub-national geometry, so the map keeps painting
the parent country. That is what the plan decided and it is kept (Resolved assumption 4).

Later stages of plan 08 are named here by what they ship (the statistics stage, the journal, the module-enforcement stage),
never by id: the backlog reads any mention of a stage id in a spec as that stage being specified already.

This spec describes the work that is **left** at HEAD (`70921af7`). It departs from the plan's stage block where the code the
plan cites has changed or a specialist found the plan wrong. Every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

What exists at HEAD, measured:

- **A complete data layer with half a boundary.** `src/server/repos/atlas.ts` exports `listVisitedRegions`,
  `markRegionVisited`, `unmarkRegionVisited`, `countVisitedRegions`, `listBucketList`, `createBucketListItem`,
  `achieveBucketListItem` and `deleteBucketListItem`. `src/server/fns/atlas.ts` has exactly four write functions
  (`markCountryVisitedFn`, `unmarkCountryVisitedFn`, `addCountryToBucketListFn`, `removeCountryFromBucketListFn`); `grep` finds no
  production caller of any region function, and the only non-country `bucket_list_items` rows come from the dev seeder. The plan's
  line numbers for those functions are stale (they sit at `fns/atlas.ts:404-587`); this spec cites functions by name.
- **A bucket tab that only reads.** `atlas-panel.tsx` (`TabsContent value="bucket"`) lists name, kind, target year and a
  Done / To go badge. It has an empty state and no control: nothing adds, removes or edits an entry, so a tab whose rows can
  carry kinds `region` and `place` has no way to make one.
- **No sub-national geometry.** `public/atlas/` holds `country-outlines-50m.v1.txt` and `airports-iata.v1.txt`; the basemap's
  region boundary and label layers (`src/lib/map/style.ts`) carry no stable code a fill or a click could key on. A clickable
  region layer needs a second tileset in the `TILES` R2 bucket, which is an infrastructure and cost decision rather than a stage.
- **Region identity is not defined.** `visited_regions.region_code` is `NOT NULL` with a unique index
  `(organization_id, user_id, region_code)` that does **not** contain `country_code`; the repository validator caps it at 16
  characters. The dev seed writes ISO 3166-2 codes (`JP-13`, `US-NY`); nothing in `src/` holds a region catalogue, so a
  traveller typing "Bavaria" cannot supply a code, and a free code would collide across countries.
- **Row deletes are workspace-scoped, not traveller-scoped.** `unmarkRegionVisited` and `deleteBucketListItem` end in
  `requireRemove`, which proves the row is in the caller's workspace and nothing more. The country functions compensate in the
  handler by listing the acting traveller's own rows first; a region or bucket handler that skipped that would let a colleague
  in the same workspace delete another traveller's row by id.
- **The repository schemas accept a `userId`.** `markRegionVisitedInput` and `createBucketListItemInput` both declare
  `userId: idSchema.optional()`. Reused unchanged as a boundary validator, they would accept the field the plan says must not
  exist.
- **The country functions hold the only copy of the race-safe "record this country once" loop**
  (two attempts, `isUniqueConstraintViolation`, re-read, enqueue a `travel-stats` recompute). A region write that cascades to
  the country needs exactly that, so a second copy would be a second owner of one concept (`docs/SPEC.md` §8).
- **Two plan claims about components are wrong.** `Combobox` (`src/components/ui/combobox.tsx`) is a searchable single-select
  with no "create from typed text" mode, so it cannot "accept a typed region name". `atlas-panel.tsx` and `country-overlay.tsx`
  are not owned by this stage, while the plan has the regions section mounted in "the open country panel" (which exists in two
  hosts, both of which mount `CountryActions`).
- **A mechanical move waits in the plan:** `src/routes/_app/-ui/world-map.tsx` (a static SVG world with no data fetching and no
  route knowledge) belongs under `src/components/atlas/`. Its only importer is `atlas-screen.tsx:36`; its path is also
  hard-coded in `src/components/atlas/__tests__/copy-rules.test.ts` (lines 74 and 116), which the plan's owned paths omit.

The reader this serves: a traveller who has been to "Bavaria" and "Tuscany" and wants the atlas to say so, and who keeps a
list of things they want to see that are not countries ("the Faroe Islands", "Old town in Tallinn", "the Dolomites"). The
reference behaviour is a visited record finer than a country, a country that counts as visited once anything inside it does,
an aspiration list that holds places and regions as well as countries, and a guard that stops a derived record being deleted as
if it had been entered by hand (`wiki: Atlas-Overview`); this stage gets there in planned.travel's own vocabulary and without a
map layer.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                         | Not owned (read only, or left alone)                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/repos/atlas.ts` - edit: `regionCodeFor`, `BUCKET_LIST_MAX_PER_TRAVELLER`, `BucketListLimitError`, the ceiling in `createBucketListItem`, the region `userId`-free input schemas          | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                                                                            |
| `src/server/fns/atlas.ts` - edit: five new functions (below), the shared country-record helpers extracted from the two country functions                                                             | `src/routes/_app/atlas.tsx` - unchanged; no route is added and `pnpm generate-routes` is not run                                                                                                      |
| `src/lib/atlas/place-name.ts` (+ test) - new: `foldPlaceName`, the one definition of "the same name" for regions and bucket entries                                                                  | `src/components/atlas/atlas-panel.tsx`, `country-overlay.tsx` - **not edited for the regions section** (it hangs off `CountryActions`); `atlas-panel.tsx` is edited in 08-S2b for the bucket tab only |
| `src/components/atlas/world-map.tsx` - new (moved from `src/routes/_app/-ui/world-map.tsx`, which is deleted); `atlas-screen.tsx` - one import line and its doc comment                              | `src/routes/_app/-server/library.ts` (`ATLAS_BUCKET_LIST_LIMIT = 40`, a read cap, stays as it is)                                                                                                     |
| `src/components/atlas/region-record.tsx` (+ test) - new; `bucket-list-dialog.tsx` (+ test) - new; `country-actions.tsx` (+ test) and `atlas-panel.tsx` (bucket tab) - edit; `index.ts` - two exports | `src/server/queue/**` (the recompute producer and consumer are reused as they are)                                                                                                                    |
| `src/components/atlas/__tests__/copy-rules.test.ts` - edit: drop the explicit `world-map.tsx` path (the directory walk now covers the file)                                                          | `achieveBucketListItem` has no server function; ticking an entry off is a follow-up (Out of scope)                                                                                                    |
| `src/lib/i18n/messages/<23 locales>/atlas.ts` - the new keys; `CONTEXT.md` - **Visited region**, **Bucket list item**                                                                                | The map's region layers and any tileset (deferred, Blockers)                                                                                                                                          |
| `src/server/fns/__tests__/atlas.test.ts`, `src/server/repos/__tests__/tenant-isolation.test.ts` - append                                                                                             | `src/server/billing/**`, `PLAN_QUOTAS`, `resolveLimits()` - nothing is added                                                                                                                          |
| `e2e/product-modules.spec.ts` - created if absent, otherwise a `test.describe` is appended (the leave-planner stage creates the same file; whichever lands first creates it)                         |                                                                                                                                                                                                       |

### Phase boundaries (tickets)

| Phase | Ticket | Slice a person can see work                                                                                            |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1     | 08-S2a | A traveller records "Bavaria" inside Germany from the country panel, sees a removable chip, and Germany is now visited |
| 2     | 08-S2b | A traveller adds "Old town" (place) and "Dolomites" (region) from the bucket tab, and removes any entry from the list  |

08-S2b is blocked by 08-S2a: both edit `country-actions.tsx`, `index.ts`, the atlas locale files and
`e2e/product-modules.spec.ts`. If 08-S2a does not fit one context window, the `world-map` move stands alone as a third,
first ticket (`08-S2a0`), still blocked-by-ordered and never cut by layer.

### Region identity (decided here, Resolved assumptions 1 and 2)

A traveller types a **name**; the client never sends a code. The server derives it:

- `foldPlaceName(name)` in `src/lib/atlas/place-name.ts`: NFKC, trim, collapse runs of whitespace, remove combining marks after NFKD,
  lower-case, and refuse (empty result, or a Unicode `Cc` / `Cf` character such as a control or bidi override, in the _raw_ input)
  with a validation error. It is pure and isomorphic; the folded form is the identity of a name, so "Bavaria", " bavaria " and
  "BAVARIA" are one region and "Sao Paulo" matches "São Paulo".
- `regionCodeFor(countryCode, name)` in `src/server/repos/atlas.ts` (the owner of the unique key): the country's two letters, a
  hyphen, and the first 12 hex characters of SHA-256 over `"<CC>|<folded name>"` - 15 characters, so the repository's 16-character
  validator is untouched. The country prefix is inside the hash input and the code's prefix, so the same name in two countries
  never collides although the unique index omits `country_code`.
- **Resolve by name before deriving.** The handler lists the acting traveller's own regions for that country
  (`listVisitedRegions(scope, ctx.userId)` filtered in memory - bounded by the world times one traveller) and, when a recorded
  `regionName` folds to the same string, **that existing row is the answer** (including seeded ISO rows such as `JP-13`
  "Tokyo": typing "Tokyo" must not create a second `JP-<hash>`). Only when none matches is a code derived and a row written.

### Server functions (`src/server/fns/atlas.ts`)

All inputs are `z.strictObject({...})` with the `error` parameter (unknown keys such as `userId` and `organizationId` are
**rejected, not stripped**); a country code must be a key of `COUNTRY_NAMES`. The boundary validators are written out per
function; they **do not** reuse `markRegionVisitedInput` / `createBucketListItemInput` unchanged (both carry `userId`); the
repository still parses its own input again. The plan's "four new functions" is five:

| Function                 | Method | Input                                                                                                                                  | Behaviour                                                                                                                                                                                                                      |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loadCountryRegionsFn`   | GET    | `{ countryCode }`                                                                                                                      | The acting traveller's own regions for that country, `{ id, name }[]`, ordered by name. No suggestions list (Resolved assumption 3).                                                                                           |
| `markRegionVisitedFn`    | POST   | `{ countryCode, regionName }` (1-120 characters after folding rules; no date)                                                          | Resolve-by-name, else derive and insert; **then** ensure the country is recorded (also when the region already existed, so re-adding heals a country that was since unmarked). Returns the regions list and the country state. |
| `unmarkRegionVisitedFn`  | POST   | `{ regionId }` (1-64)                                                                                                                  | Proves the row is the acting traveller's (own-row list, `NotFoundError` for unknown **and** foreign ids alike), then `alreadyGone(unmarkRegionVisited)`. Never unmarks the country.                                            |
| `addBucketListItemFn`    | POST   | `{ kind, name?, countryCode?, targetYear? }` (name <= 200; target year 1900-2200; **no** note, sort order, coordinates or region code) | Per-kind rules below. Idempotent, race-safe. Returns the entry and the country state if it is a country entry.                                                                                                                 |
| `removeBucketListItemFn` | POST   | `{ itemId }` (1-64)                                                                                                                    | Own-row proof first (any kind, not the country-only guard of `removeCountryFromBucketListFn`), then `alreadyGone(deleteBucketListItem)`.                                                                                       |

**Per-kind bucket rules.** `country`: `countryCode` required, the name is `countryName(code)` and any client name is ignored; the
handler delegates to the same helper `addCountryToBucketListFn` uses, so there is one implementation of the country entry.
`region`: `countryCode` and `name` required. `place`: `name` required, `countryCode` optional. For `region` and `place` the
duplicate key is _(traveller, kind, country or null, `foldPlaceName(name)`)_ over **non-achieved** entries only (an achieved
"Old town" does not block adding it again). After the insert the handler re-reads and keeps the lowest id, exactly as the
country path does, by generalising `collapseRivalGoals` to take a key predicate rather than copying it. There is still no unique
index (a unique index over free text would reject a second "Old town" in another country, and drizzle-kit rebuilds a SQLite
table for an index change).

**Extracted helpers (module-private, one owner).** The country functions' race-safe loop becomes
`recordCountryVisit(scope, code, visitedOn)` and the undo becomes `unrecordCountryVisit(scope, visit)`; both country
functions call them and so does the region cascade. Their existing tests must stay green with no edits (that is the proof of the
extraction). Neither helper is exported from the module.

**Authorisation, decided in the handler.** Both tables are per-traveller inside a workspace. Every handler passes
`scope.ctx.userId` and no input carries a user id. An id the traveller does not own, a colleague's id and an id from another
workspace throw the **same** `NotFoundError`. A unique-index refusal on a region is read as "somebody already did it"
(re-read, answer); a second consecutive refusal becomes a 409 `AtlasConflictError`-style error that carries no driver text,
statement, organisation id or user id.

**The statistics recompute.** The all-time `travel_stats` row stores `regionCount`; the atlas loader reads it live but the
statistics stage prints the stored figure. So `markRegionVisitedFn` and `unmarkRegionVisitedFn` enqueue the recompute (the
deterministic `travel-stats` envelope: all-time year `0`, acting traveller only, `route: 'atlas'`) on every write **that changed a
row**, never on an idempotent no-op, and **at most once per call**: when the cascade recorded the country, the helper's enqueue
(which carries the all-time year) is the call's only one. The bucket-list functions enqueue nothing: `bucket_list_items` feeds no
`travel_stats` column. A refused queue never fails the write (the producer already logs and returns).

**The ceiling.** `createBucketListItem` counts the traveller's rows (`bucketListRepository.count(scope, eq(userId, ctx.userId))`)
and refuses past `BUCKET_LIST_MAX_PER_TRAVELLER = 500` (achieved entries included) with `BucketListLimitError`
(`status = 422`, a message naming the limit; not the 402 of `AtlasQuotaError`, which is reserved for a plan, and not the 409 of a
race). It is a noisy-neighbour guard, not a plan quota: the count-then-insert is not atomic and may overshoot by the requests in
flight, which is stated in the code. Both `addBucketListItemFn` and `addCountryToBucketListFn` translate it (the latter through a
second branch next to `withQuotaBoundary`, which handles only `QuotaExceededError`). Nothing is added to `resolveLimits()`,
`PLAN_QUOTAS` or `limits.test.ts`. `ATLAS_BUCKET_LIST_LIMIT = 40` stays: it caps the SSR payload, is a different control for a
different reason, and both constants carry a comment saying so.

### Entitlement

`atlas` is a key of `MODULE_KEYS` (`src/lib/plans.ts`), gated by the module-enforcement stage through `assertModule`. No second
check is invented here; until that stage lands the module behaves as it does today.

### Decisions on the screen

- **The regions section hangs off `CountryActions`** (`RegionRecord` renders inside it, below the two rows), so both hosts - the
  map-anchored `CountryOverlay` panel and the `AtlasPanel` country pane, each already a scrolling column - gain it without a host
  edit. `data-part="country-panel-regions"` is on `RegionRecord`'s own root. `CountryActions` stays keyed by `countryCode`, so a
  section loaded for one country is never shown for another.
- **Removing the last region does not unmark the country.** A country with a trip behind it stays visited; the section says so in
  place ("Removing a region does not remove {country} from your atlas").
- **The reverse case.** Unmarking a country leaves its regions in place (nothing is cascade-deleted; keeping them can always be
  undone). `RegionRecord` reports its count to `CountryActions` through an `onCountChange` callback; when the traveller has one
  or more regions in the country, the unmark press goes through the existing `ConfirmDialog` and its body says the regions stay.
  The panel then lists them under the unvisited country with the in-place line, and re-adding a region (or marking the country)
  heals the pair.
- **Plain text input, not `Combobox`.** `RegionRecord` is an `Input` labelled "Add a region in {country}" with an "Add region"
  `Button`; `Enter` submits. Because suggestions are the traveller's own regions _in this country_, which are already the chips
  above the input, a suggestion list would add nothing and is not built (Resolved assumption 3). Duplicates are absorbed by the
  server's fold, not refused.
- **No date, no rename.** A region is added by name; `first_visited_on` stays null. An optional date is additive later.
- **The bucket tab gains "Add something" and a per-row remove** (an `IconButton` named "Remove {name} from your bucket list"). Only
  an achieved entry asks for confirmation (the existing `atlas.actions.confirm.goal.*` pattern). The empty state keeps its
  place and gains the same primary action.

### Alternatives considered, and why they lost

- _Ship a region catalogue (ISO 3166-2) and let the traveller pick._ A data decision with 23-locale names and thousands of rows,
  outside this stage; the free-name path does not prevent adding a catalogue later (the code is internal, the name is the record).
- _A readable code (`DE-BAVARIA`)._ Needs Unicode folding to survive non-Latin names, a raised validator cap and an opaque length
  bound; the 15-character hash fits the existing validator and has no edge cases. Rejected on reversibility.
- _Workspace-wide region suggestions._ They would show colleagues' travel history, including members who have left (their rows stay
  in the workspace). Narrowing later is a regression nobody can undo; widening later is a one-line change.
- _A `userId` guard inside the repository functions._ Stronger, but it changes functions `tenant-isolation.test.ts` pins and the plan
  freezes; the handler-side own-row proof is the reviewed pattern. Recorded as a follow-up.
- _Enqueueing only when the country cascades_ (the plan). Leaves `travel_stats.region_count` stale until an unrelated country write.

## 📝 Architecture

- Owner modules: region identity `regionCodeFor` and the ceiling in `src/server/repos/atlas.ts` (the owner of the unique key and of
  every insert into `bucket_list_items`); "the same name" in `src/lib/atlas/place-name.ts` (isomorphic, used by the handler and
  unit-testable without a database); the country-record loop in one module-private helper in `src/server/fns/atlas.ts`.
- `components/ui` is untouched and never fetches. `RegionRecord` and `BucketListDialog` live in `components/atlas`, which already
  imports server functions (`country-actions.tsx` does).
- No Durable Object, no realtime patch (the atlas is per-traveller and has no room), no KV, no R2, no new queue envelope.
- The `world-map` move: `WorldCoverageMap` is a static SVG world; it moves to `src/components/atlas/world-map.tsx` verbatim
  (path in its doc comment excepted). `atlas-screen.tsx` stays in `-ui/`: it is the composition of one route.

## 📝 Data Model

**No schema change and none is filed.** `visited_regions` (`country_code`, `region_code`, `region_name`, `first_visited_on`;
unique `(organization_id, user_id, region_code)`; `visited_regions_org_country_idx`) and `bucket_list_items` (`kind`, `name`,
`country_code`, `region_code`, `target_year`, `is_achieved`; no unique index) exist as they are. The one validator change is in the
repository's _function_ inputs, never the table: nothing here raises the 16-character `regionCode` cap.

## 📝 API Contracts

The five functions of "Server functions" above, with these response shapes (types exported from `src/server/fns/atlas.ts`):

- `AtlasRegion = { id: string; name: string }`; `loadCountryRegionsFn` returns `{ countryCode, regions: AtlasRegion[] }`, and the two
  region writes return the same plus `country: AtlasCountryState` (the existing type).
- `addBucketListItemFn` returns `{ item: AtlasBucketGoal & { kind, countryCode }, country: AtlasCountryState | null }`;
  `removeBucketListItemFn` returns `{ removedId }`.
- Errors a caller may see: validation (400, with the field named), `NotFoundError` (404), `BucketListLimitError` (422), conflict
  (409). Nothing else is forwarded.

## 📝 UI/UX

### The regions section (`RegionRecord`)

- A `SectionLabel` "Regions", a one-line hint ("Marking a region marks {country} too"), the removable `Chip`s, and the input row.
- **Empty** (`--color-surface-2`): "No regions recorded here yet" and one line on what a region is for; the input is the next tab
  stop, so the empty state is the input and not a dead end.
- **Loading:** three `Skeleton` chips at the settled chip height while `loadCountryRegionsFn` resolves.
- **Error:** a failed write keeps the chip and shows a `danger` `Alert` under the section naming what failed with "Try again"; a
  failed load shows the same alert with a reload action and never blanks the panel around it.
- **Pending:** the Add button and each chip's remove control take `loading`/`disabled`; an optimistic chip renders at 60% opacity
  until the server answers and rolls back on failure. Focus returns to the input after an add and to the nearest remaining chip's
  remove control (or the input) after a remove; a rolled-back add keeps the typed text and returns focus to the input.
- **Motion:** a chip enters on 180 ms opacity and scale from 0.96 on `--ease-out-quint`, leaves on 150 ms; stagger 20 ms, capped at
  eight; `prefers-reduced-motion: reduce` collapses to opacity. The map is never animated by this stage.
- **Height discipline.** The overlay sizes its surface with `placeCountrySurface` / `PANEL_MIN_HEIGHT` (288) and places the actions
  in a scrolling column. The section must not move the controls above it when it loads (skeleton at the settled height) and the
  implementer verifies, at 360x800 and 1280x900, that the panel still places and the regions scroll inside the column rather than
  pushing the two action rows off screen.
- 360 px: the section scrolls inside the existing column; touch targets are at least 44 px under `pointer: coarse`.

### The bucket tab and `BucketListDialog`

- "Add something" (primary) in the tab header and in the empty state opens a `Dialog`: **Name** `Input` (required, except for a
  country entry, whose name is the country's), **Kind** `Select` over the schema's kinds (default `place`), **Country**
  `Combobox` over the existing country search data (required for `country` and `region`, optional for `place`), **Target year** (optional). The dialog opens
  from the bucket tab only; a country-panel entry point (the plan's pre-filled country) is out of scope.
- Focus enters the dialog on the first invalid or first field, returns to its trigger on close, and moves to the alert on a failed
  save with the typed values kept. `BucketListLimitError` shows "Your bucket list is full ({limit} entries). Remove one to add another."
- Each row gains a remove `IconButton` (a rolled-back optimistic removal restores the row in place).

## 📝 Visual change expected

`/atlas`, light and dark, desktop (1280x900, 2560x1440) and mobile (360x800):

- the country panel (map-anchored overlay and shelf country pane) with the new **Regions** section: empty, with chips, loading, error;
- the bucket tab with the **Add something** action, a remove control on each row, and the open dialog (empty, invalid, limit reached);
- the **confirmation** raised by unmarking a country that has regions.

The resting `/atlas` screen changes only by the bucket tab's header action. The `world-map` move changes no pixel.

## 📝 Copy

All keys are added to `src/lib/i18n/messages/en/atlas.ts` and land in all 23 locales in the same change (`i18n-messages` skill; plural
keys carry every category each locale needs, and `{count}` keeps its name). `{country}` is `countryName(code)`.

| Key (en)                                              | Text                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `regions.label`                                       | Regions                                                                      |
| `regions.hint`                                        | Marking a region marks {country} too.                                        |
| `regions.keeps`                                       | Removing a region does not remove {country} from your atlas.                 |
| `regions.empty.title`                                 | No regions recorded here yet                                                 |
| `regions.empty.body`                                  | Add a state, province or area you have visited in {country}.                 |
| `regions.input.label`                                 | Add a region in {country}                                                    |
| `regions.input.placeholder`                           | For example, Bavaria                                                         |
| `regions.add` / `regions.adding`                      | Add region / Adding {region}                                                 |
| `regions.remove` / `regions.removing`                 | Remove {region} / Removing {region}                                          |
| `regions.loading`                                     | Loading your regions                                                         |
| `regions.error.invalid`                               | Enter a region name.                                                         |
| `regions.error.load`                                  | We could not load your regions for {country}.                                |
| `regions.error.add`                                   | We could not add {region}. Try again.                                        |
| `regions.error.remove`                                | We could not remove {region}. Try again.                                     |
| `regions.error.conflict`                              | {region} was being changed somewhere else at the same moment. Try again.     |
| `regions.retry` / `regions.reload`                    | Try again / Reload regions                                                   |
| `actions.confirm.regions.body` (plural)               | {count} regions you recorded in {country} stay on your record.               |
| `panel.bucket.add`                                    | Add something                                                                |
| `bucket.dialog.title`                                 | Add to your bucket list                                                      |
| `bucket.dialog.name` / `.kind` / `.country` / `.year` | Name / Kind / Country / Target year (optional)                               |
| `bucket.dialog.save` / `.cancel`                      | Add to list / Cancel                                                         |
| `bucket.error.name` / `.country`                      | Enter a name. / Choose a country.                                            |
| `bucket.error.limit`                                  | Your bucket list is full ({limit} entries). Remove one to add another.       |
| `bucket.error.add` / `.remove`                        | We could not add {name}. Try again. / We could not remove {name}. Try again. |
| `panel.bucket.remove`                                 | Remove {name} from your bucket list                                          |

The kind labels reuse the existing `atlas.panel.bucket.kind.*`; the achieved-entry confirmation reuses
`atlas.actions.confirm.goal.*`. Glossary: `CONTEXT.md` gains **Visited region** (a named area inside a country a traveller has
recorded; it never replaces the country) and **Bucket list item** (an aspiration of kind country, region or place; per traveller).

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                 | Expected                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| "Bavaria", " bavaria ", "BAVARIA" typed in turn                                      | One row, one chip; later submits are idempotent successes                                       |
| "Tokyo" typed in Japan when the seed holds `JP-13` "Tokyo"                           | Resolves to the existing row; no second row                                                     |
| Same name in two countries                                                           | Two rows (the country is in the code)                                                           |
| Name whose folded form is empty, or contains a control / bidi character              | Validation error, nothing written                                                               |
| Non-Latin name ("東京都")                                                            | Accepted; identity is the hash of the folded name                                               |
| Two overlapping adds of the same new region                                          | The loser's unique refusal is read as "already done"; one row; no driver text leaves the module |
| Region added in a country the traveller has not visited                              | Region written, then country recorded once; one recompute enqueue                               |
| Region re-added after the country was unmarked                                       | Country re-recorded (heal), no duplicate region                                                 |
| Last region removed                                                                  | Country stays visited; the in-place line says so                                                |
| Unmark a country that has regions                                                    | Confirmation names the count and that they stay; regions remain                                 |
| `unmarkRegionVisitedFn` with a colleague's id, another workspace's id, an unknown id | The same `NotFoundError`; the row survives                                                      |
| Input carrying `userId` / `organizationId` / an unknown key                          | Rejected by the strict validator                                                                |
| Country code outside `COUNTRY_NAMES`                                                 | Validation error                                                                                |
| Queue binding refuses the recompute                                                  | The write succeeds; the failure is logged once                                                  |
| Adding a bucket `country` entry twice, or overlapping                                | One entry (lowest id kept)                                                                      |
| Adding "Old town" (`place`, Estonia) while an achieved "Old town" exists             | A new entry (achieved entries do not count as duplicates)                                       |
| 501st bucket entry (through either add function)                                     | `BucketListLimitError` (422) with the limit in the message; nothing written                     |
| Removing a bucket entry twice                                                        | The second is a success (`alreadyGone`)                                                         |
| An entry beyond the 40 rows the loader shows                                         | Added and counted; the existing "N more" line covers it                                         |
| Offline / failed write                                                               | Optimistic row or chip rolls back where the reader can see it; the message says what failed     |

## ✅ Acceptance criteria

1. `markRegionVisitedFn` records a region by name, and records the parent country exactly once when it was unrecorded and not at all
   when it already was (visit count unchanged).
2. Two casings / spacings / diacritic variants of one name are one row; the same name in two countries is two rows; a name matching
   an existing (seeded) row returns that row.
3. `unmarkRegionVisitedFn` and `removeBucketListItemFn` refuse a colleague's id, a foreign-workspace id and an unknown id with the
   same `NotFoundError`, and delete nothing.
4. No input of any new function accepts `userId`, `organizationId`, `regionCode` or `sortOrder`; the strict validators reject them.
5. `unmarkCountryVisitedFn` leaves regions in place; its confirmation fires when regions exist and says they stay.
6. A region write that changed a row enqueues one all-time `travel-stats` envelope; an idempotent no-op enqueues none; a cascade
   plus a new region enqueues one, not two; the bucket-list functions enqueue none.
7. A bucket entry of each kind round-trips; `country` ignores a client name; the 501st entry is refused with `BucketListLimitError`
   through both add functions and nothing is written.
8. The extracted country helpers leave the existing tests of the four country functions green without edits.
9. `RegionRecord`: `Enter` submits; an optimistic chip rolls back on rejection and keeps the typed text; every chip's remove control
   is keyboard-reachable with an accessible name that includes the region; focus lands as stated under "Pending".
10. `BucketListDialog`: name required (except country), country required for `country` and `region`, kind defaults to `place`,
    focus returns to the trigger on close, the limit error is announced.
11. The panel's tab order runs actions -> regions -> input in both hosts; `[data-part="country-panel-regions"]` resolves to exactly
    one element in each.
12. `world-map.tsx` lives under `src/components/atlas/`, `copy-rules.test.ts` still reads it, and no file imports the old path.
13. All new copy exists in 23 locales (parity test) and no component carries an English literal (`copy-rules.test.ts`).
14. Tenant isolation: the new `describe` (below) passes.
15. The browser journey passes with an empty console (`watchConsole`) in both themes and on `mobile-safari` for read-only checks.

## 📝 Risks & Impact Review

| Risk                                                    | Severity | Mitigation                                                                                                                        |
| ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A colleague deletes another traveller's row by id       | High     | Handler-side own-row proof, one error for every refusal, a same-workspace test (AC 3)                                             |
| The cascade writes a country row across workspaces      | High     | Same scope as the region; the cross-workspace cascade test                                                                        |
| Overlay surface no longer fits with the extra section   | Medium   | Skeleton at settled height, scroll inside the existing column, 360x800 and 1280x900 frames, `country-overlay.test.tsx` kept green |
| Refactor of the country functions regresses idempotence | Medium   | The existing tests are the guard; no edits to them in the same commit                                                             |
| A seeded ISO row and a typed name diverge               | Low      | Resolve-by-name before deriving                                                                                                   |
| Overshoot of the 500-row ceiling under a race           | Low      | A noisy-neighbour guard, documented as non-atomic                                                                                 |
| Stored `regionCount` lags if the queue is down          | Low      | Producer logs and the next recompute heals; the atlas reads it live                                                               |

### Out of scope

A clickable or painted region layer and its tileset; editing or renaming a region; a visited date on a region; ticking a bucket
entry off or editing it (`achieveBucketListItem` has no server function and the row does not ask for one); a repository-level
`userId` guard on `unmarkRegionVisited` / `deleteBucketListItem`; workspace-wide suggestions.

### Blockers

- **No sub-national geometry, so no region layer.** Disposition: **defer**, and record it, because the plan's pointer to a
  boundaries-and-blockers entry does not exist today (`docs/plans/11-boundaries-and-blockers.md` never mentions a region tileset).
  08-S2a files a tracker issue "Decide: a region tileset in the TILES bucket for the atlas" (infrastructure and cost) and cites
  it in its PR. The rows this stage writes are exactly the rows a layer would paint from.
- Nothing else. No package, no binding, no third-party service.

### Reference-row disposition

`ADD-05` closes as **done** with 08-S2b: the plan's own closing rule counts a path that works and says it is degraded as done, and
names this stage's list-shaped region record as its example.

## 📋 Phasing

See "Phase boundaries (tickets)": 08-S2a then 08-S2b.

## 📋 Implementation Plan

### Phase 1 - regions on the record (08-S2a)

1. `src/lib/atlas/place-name.ts` and its test, test first (the Edge Cases rows on folding).
2. `regionCodeFor` and the region input schemas in `src/server/repos/atlas.ts`; repository cases.
3. Extract `recordCountryVisit` / `unrecordCountryVisit` from the country functions with their tests unchanged; then
   `loadCountryRegionsFn`, `markRegionVisitedFn`, `unmarkRegionVisitedFn` and their cases in `atlas.test.ts`; the tenant-isolation `describe`.
4. Move `world-map.tsx`; fix `atlas-screen.tsx` and `copy-rules.test.ts`.
5. `region-record.tsx`, the `CountryActions` edit (mount, `onCountChange`, the unmark confirmation), `index.ts`; the region keys in
   23 locales; `CONTEXT.md` **Visited region**; the issue for the region tileset; the e2e `describe`.

### Phase 2 - the bucket list (08-S2b)

1. `BucketListLimitError`, `BUCKET_LIST_MAX_PER_TRAVELLER` and the count in `createBucketListItem`; generalise `collapseRivalGoals`; repository cases.
2. `addBucketListItemFn`, `removeBucketListItemFn`, the second error translation in `addCountryToBucketListFn`; their cases.
3. `bucket-list-dialog.tsx`, the `atlas-panel.tsx` bucket-tab edit (action, row remove, empty state), `index.ts`; the bucket keys in
   23 locales; `CONTEXT.md` **Bucket list item**; the e2e `describe`.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/atlas/__tests__/place-name.test.ts`; `src/server/fns/__tests__/atlas.test.ts` (cascade once / not at all, heal after
  unmark, folded duplicates, seeded-row match, colleague and cross-workspace refusals, strict-input refusals, ceiling through both
  add functions, enqueue counts, race refusal read as success); `region-record.test.tsx`; `bucket-list-dialog.test.tsx`;
  `country-actions.test.tsx` (existing cases hold with the section mounted; the confirmation with regions).
- Tenant isolation, appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe`: in A's scope,
  `markRegionVisited` for a region whose country only B has visited writes A's row and leaves B's; `unmarkRegionVisited(scopeA, bRegionId)`,
  `deleteBucketListItem(scopeA, bItemId)` and `achieveBucketListItem(scopeA, bItemId)` are `NotFoundError` with B's rows intact; reversed,
  `listVisitedRegions(scopeB, aUserId)` is `[]` and `visitedRegionsRepository.requireById(scopeB, aRowId)` is the `NotFoundError`
  (both asserted); the cascade writes A's `visited_countries` row and leaves B's count unchanged. The same-workspace colleague cases live
  in `atlas.test.ts` (the repository functions are workspace-scoped by design).
- Browser, per `docs/plans/12-verification-protocol.md` and ADR 0016 (no baselines, no pixel comparison, no `e2e/__screenshots__`):
  `e2e/product-modules.spec.ts` asserts `/atlas` (declared with `map: true` in `e2e/helpers/routes.ts`, already so) answers, hydrates,
  says nothing in the console, adds and removes a region and a bucket entry and restores what it changed. The writing describes are
  `test.describe.configure({ mode: 'serial' })` and run on `chromium` only (`test.skip` on `mobile-safari`), and are named among the
  fixture writers in `playwright.config.ts`'s `workers` comment. Run
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup` then
  `... pnpm exec playwright test e2e/product-modules.spec.ts`, with the port from `bash .ai/scripts/e2e.sh`.
- Frames, the blind A/B pair a person reads at review, from `scripts/visual/capture.mjs` (the plan's `scripts/ultrabuild` path does not exist):
  `PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs --url "http://localhost:$PORT/atlas" --out "<scratchpad>/shots/08-S2" --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map`,
  plus `--state regions --click '[data-part="country-panel-regions"]'` after selecting a country, and `--state bucket-dialog` on the dialog's trigger. The selectors are
  verified to resolve by the spec run reaching the same state.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                           | Applied default                                                                                                                                                                          | Why                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How does a typed region name become `region_code`?                 | Server-derived: `<CC>-` + 12 hex of SHA-256 over `<CC>\|<folded name>`; resolve by folded name against the traveller's own rows first; the client never sends a code                     | Decided by software architect (high) and security and tenancy (medium) sub-agents; they differed on a readable code vs a hash; the hash was taken: fits the 16-character validator, no Unicode edge cases, more reversible      |
| 2   | Raise the repository's `regionCode` cap?                           | No; the cap stays at 16                                                                                                                                                                  | Consequence of row 1                                                                                                                                                                                                            |
| 3   | Region-name suggestions, and whose?                                | None: the input is plain text; the traveller's own regions in the country are already the chips                                                                                          | Security and tenancy sub-agent (high): own rows only; applied default: `Combobox` is single-select with no create mode, so the plan's "combobox that accepts a typed name" does not exist, and own-only suggestions add nothing |
| 4   | Region layer on the map?                                           | Deferred; list-shaped record; a tracker issue for the tileset decision is filed by 08-S2a                                                                                                | Plan decision verified (`public/atlas/`, `style.ts`); product owner sub-agent (medium): the plan's pointer into the blockers plan is dangling                                                                                   |
| 5   | Which region writes enqueue a recompute?                           | Every write that changed a row, all-time year, at most once per call; none for no-ops or bucket writes                                                                                   | Decided by software architect sub-agent (medium): `regionCount` is a stored column the statistics stage prints                                                                                                                  |
| 6   | Where does the country loop live, and who proves ownership?        | Module-private helpers extracted in `fns/atlas.ts`; each id-addressed handler lists the traveller's own rows first                                                                       | Decided by software architect (high) and security and tenancy (high) sub-agents                                                                                                                                                 |
| 7   | Bucket kinds and duplicates                                        | `country` delegates to the country path; `region` needs a country; `place` does not; duplicates keyed on (traveller, kind, country, folded name) over non-achieved entries               | Decided by software architect sub-agent (medium)                                                                                                                                                                                |
| 8   | The ceiling                                                        | 500 per traveller, achieved included, `BucketListLimitError` (422), non-atomic and said so; both add paths translate it                                                                  | Architect proposed 200, security and tenancy 500; the larger was taken (a limit is easy to lower later and never evicts); security and tenancy sub-agent (medium)                                                               |
| 9   | Where does the regions section mount?                              | Inside `CountryActions`, so both hosts get it without editing files the stage does not own                                                                                               | Decided by software architect sub-agent (high)                                                                                                                                                                                  |
| 10  | Is "remove" part of the slice?                                     | Yes: a remove control on every bucket row (confirmation for an achieved entry only); no tick-off, no edit                                                                                | Decided by product owner sub-agent (high)                                                                                                                                                                                       |
| 11  | A date or a rename on a region?                                    | No                                                                                                                                                                                       | Decided by product owner sub-agent (high): additive later                                                                                                                                                                       |
| 12  | Ticket cut                                                         | Two tickets, each a full path; the `world-map` move rides with the first (a third only if the first does not fit)                                                                        | Decided by product owner sub-agent (medium)                                                                                                                                                                                     |
| 13  | Close `ADD-05` as done or partial?                                 | Done, with 08-S2b                                                                                                                                                                        | Decided by product owner sub-agent (medium): the plan's closing rule names this case                                                                                                                                            |
| 14  | Removing the last region, and unmarking a country that has regions | The country stays visited; unmarking keeps regions, behind a confirmation that says so                                                                                                   | Decided by product owner (medium) and security and tenancy (high) sub-agents                                                                                                                                                    |
| 15  | The plan's strict-object and validator-reuse wording               | `z.strictObject` per function, no `userId`; repository inputs are not reused as boundary validators                                                                                      | Security and tenancy sub-agent (high): the repository schemas declare `userId`                                                                                                                                                  |
| 16  | Plan paths that no longer exist                                    | `e2e/product-modules.spec.ts` (no snapshots, created by whichever stage lands first), `scripts/visual/capture.mjs`, no `e2e/__screenshots__`; `copy-rules.test.ts` joins the owned paths | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md`; verified by `ls`                                                                                                                                        |
| 17  | Name later stages by id in this spec?                              | No                                                                                                                                                                                       | Applied default, verified in `.ai/scripts/backlog-status.mjs`                                                                                                                                                                   |
