# Atlas: regions on the record, and a bucket list that is not only countries

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | #1071                                    |
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

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Not owned (read only, or left alone)                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/repos/atlas.ts` - edit: new, exported `regionCodeFor` (async; re-exported through `src/server/repos/index.ts`, called by the handler, which passes the derived `regionCode` to `markRegionVisited` - that function's input shape is unchanged), and the two ceilings in `createBucketListItem` / `markRegionVisited`, which throw the existing `QuotaExceededError` (`src/server/repos/context.ts`) with the metrics `bucket_list_items_per_traveller` and `visited_regions_per_traveller`. The repository inputs keep their optional `userId` (the dev seeder and `travel-stats.test.ts` pass it); the `userId`-free schemas are new boundary schemas in `fns/atlas.ts` | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                                                                                                                       |
| `src/server/fns/atlas.ts` - edit: five new functions (below), the shared country-record helpers extracted from the two country functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `src/routes/_app/atlas.tsx` - unchanged; no route is added and `pnpm generate-routes` is not run                                                                                                                                                 |
| `src/lib/atlas/place-name.ts` (+ test) - new: `foldPlaceName`, the one definition of "the same name" for regions and bucket entries; `src/lib/atlas/limits.ts` - new: the two ceilings as isomorphic constants (the dialog and the section need them on the client)                                                                                                                                                                                                                                                                                                                                                                                                                  | `src/components/atlas/atlas-panel.tsx`, `country-overlay.tsx` - **not edited for the regions section** (it hangs off `CountryActions`); `atlas-panel.tsx` is edited in 08-S2b for the bucket tab only. Their tests are another matter (next row) |
| `src/components/atlas/world-map.tsx` - new (moved from `src/routes/_app/-ui/world-map.tsx`, which is deleted); `atlas-screen.tsx` - one import line and its doc comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `src/routes/_app/-server/library.ts` (`ATLAS_BUCKET_LIST_LIMIT = 40`, a read cap, stays as it is)                                                                                                                                                |
| `src/components/atlas/region-record.tsx` (+ test) - new; `bucket-list-dialog.tsx` (+ test) - new; `country-actions.tsx` (+ test) and `atlas-panel.tsx` (bucket tab) - edit; `index.ts` - two exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `src/server/queue/**` (the recompute producer and consumer are reused as they are)                                                                                                                                                               |
| `src/components/atlas/__tests__/atlas-panel.test.tsx`, `country-overlay.test.tsx`, `trip-scope.test.tsx` - edit: each stands in for `#/server/fns/atlas` with a factory of exactly the four country functions, so a factory without the new exports throws once `CountryActions` imports them. 08-S2a adds the three region functions to every factory (and `country-actions.test.tsx`, below, the same); 08-S2b adds `removeBucketListItemFn` to `atlas-panel.test.tsx`, with the new empty-state text and row-remove assertions                                                                                                                                                    |                                                                                                                                                                                                                                                  |
| `src/components/atlas/__tests__/copy-rules.test.ts` - edit: drop the explicit `world-map.tsx` path (the directory walk now covers the file)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `achieveBucketListItem` has no server function; ticking an entry off is a follow-up (Out of scope)                                                                                                                                               |
| `src/lib/i18n/messages/<23 locales>/atlas.ts` - the new keys; `CONTEXT.md` - **Visited region**, **Bucket list item**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | The map's region layers and any tileset (deferred, Blockers)                                                                                                                                                                                     |
| `src/server/fns/__tests__/atlas.test.ts`, `src/server/repos/__tests__/tenant-isolation.test.ts` - append                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `src/server/billing/**`, `PLAN_QUOTAS`, `resolveLimits()` - nothing is added                                                                                                                                                                     |
| `e2e/product-modules.spec.ts` - created if absent, otherwise a `test.describe` is appended (the leave-planner stage creates the same file; whichever lands first creates it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                                                                                                                                                                                  |

### Phase boundaries (tickets)

| Phase | Ticket | Slice a person can see work                                                                                           |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| 1     | 08-S2a | A traveller records "Bavaria" inside Germany from the country panel, sees a removable row, and Germany is now visited |
| 2     | 08-S2b | A traveller adds "Old town" (place) and "Dolomites" (region) from the bucket tab, and removes any entry from the list |

08-S2b is blocked by 08-S2a: its duplicate key uses `foldPlaceName` (08-S2a, step 1) and `src/lib/atlas/limits.ts`, and both tickets edit
`src/server/fns/atlas.ts`, `src/server/repos/atlas.ts`, `index.ts`, the atlas locale files and `e2e/product-modules.spec.ts`. If 08-S2a
does not fit one context window, the `world-map` move stands alone as a third, first ticket (`08-S2a0`), still ordered and never cut
by layer.

### Region identity (decided here, Resolved assumptions 1 and 2)

A traveller types a **name**; the client never sends a code. The server derives it:

- `foldPlaceName(name)` in `src/lib/atlas/place-name.ts`: NFKC, trim, collapse runs of whitespace (spaces, tabs and newlines are
  whitespace, not rejected controls), the locale-independent `toLowerCase()` (never `toLocaleLowerCase`: the client and the server
  must hash the same bytes), and remove **only** the combining diacritics U+0300 to U+036F after NFKD (never all of `\p{M}`: Indic
  vowel signs, the virama and Thai marks are marks and are part of the name, so stripping them would merge distinct names). It
  refuses, with a validation error naming the cause, an empty result and any character in Unicode category `Cc` other than
  whitespace, `Cf` other than U+200C and U+200D, `Cs` or `Co` (this covers the bidi controls U+061C, U+200E, U+200F, U+202A to
  U+202E and U+2066 to U+2069, the zero-width space U+200B, the word joiner U+2060, the byte-order mark U+FEFF, the soft hyphen
  U+00AD and the tag characters, so "Bavaria" with a zero-width space inside cannot become a visually identical second row). ZWNJ and ZWJ are
  allowed: Persian and Indic names need them. The **length bound applies to the NFKC-normalised, trimmed form** (region 1-120,
  bucket name 1-200, so a compatibility character that expands, such as U+FDFA, cannot slip past the repository's `titleSchema`
  and surface as a raw validation message). It is pure and isomorphic; "Bavaria", " bavaria " and "BAVARIA" are one region and
  "Sao Paulo" matches "São Paulo". The **stored `regionName` is the NFKC-trimmed, whitespace-collapsed input in its own case**, not
  the folded form. `place-name.test.ts` covers U+200B, U+2060, U+FEFF, U+00AD, `İ` (the same result under any runtime locale) and
  U+FDFA.
- `regionCodeFor(countryCode, name)` in `src/server/repos/atlas.ts` (the owner of the unique key) is **async** (`crypto.subtle`, the Web Crypto API that `src/server/billing/polar.ts` and the passkey helpers already use; `node:crypto` would also run, under `nodejs_compat`, but would tie the helper to Node): the country's two letters, a hyphen, and the first 12 hex characters of SHA-256 over
  `"<CC>|<folded name>"` (`<CC>` is the canonical upper-case `COUNTRY_NAMES` key) - 15 characters, so the repository's 16-character validator is untouched. The country prefix is inside the
  hash input and the code's prefix, so the same name in two countries never collides although the unique index omits `country_code`.
  A 12-hex (48-bit) hash is a negligible collision risk at 1000 rows per traveller, and a collision would be read as "already done". The code is internal: any future export or share uses `region_name` plus the country, never the hash.
- **Resolve by name before deriving.** The handler lists the acting traveller's own regions (`listVisitedRegions(scope, ctx.userId)`,
  filtered by country in memory; bounded by the region ceiling below) and, when a recorded `regionName` folds to the same string,
  **that existing row is the answer** (including seeded ISO rows such as `JP-13` "Tokyo": typing "Tokyo" must not create a second
  `JP-<hash>`). Only when none matches is a code derived and a row written.

### Server functions (`src/server/fns/atlas.ts`)

All inputs are `z.strictObject({...})` with the `error` parameter (unknown keys such as `userId` and `organizationId` are
**rejected, not stripped**); a country code must be a key of `COUNTRY_NAMES`. The boundary validators are new and written out per
function; they **do not** reuse `markRegionVisitedInput` / `createBucketListItemInput` (both carry `userId`, and both stay as they are
for the seeder and the repository suites); the repository still parses its own input again. The plan's "four new functions" is five:

| Function                 | Method | Input                                                                                                                                  | Behaviour                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loadCountryRegionsFn`   | GET    | `{ countryCode }`                                                                                                                      | The acting traveller's own regions for that country, `{ id, name }[]`, ordered by name. No suggestions list (Resolved assumption 3).                                                                                                                                                                         |
| `markRegionVisitedFn`    | POST   | `{ countryCode, regionName }` (1-120 characters; no date)                                                                              | Resolve-by-name, else derive and insert (refused past the region ceiling); **then** ensure the country is recorded (also when the region already existed, so re-adding heals a country that was since unmarked). Returns the regions list and the country state, and whether the country was newly recorded. |
| `unmarkRegionVisitedFn`  | POST   | `{ regionId }` (1-64)                                                                                                                  | Proves the row is the acting traveller's (own-row list, `NotFoundError` for unknown **and** foreign ids alike), then `alreadyGone(unmarkRegionVisited)`. Never unmarks the country.                                                                                                                          |
| `addBucketListItemFn`    | POST   | `{ kind, name?, countryCode?, targetYear? }` (name <= 200; target year 1900-2200; **no** note, sort order, coordinates or region code) | Per-kind rules below. Idempotent, race-safe. Returns the entry and the country state if it is a country entry.                                                                                                                                                                                               |
| `removeBucketListItemFn` | POST   | `{ itemId }` (1-64)                                                                                                                    | Own-row proof first (any kind), then `alreadyGone(deleteBucketListItem)`; one module-private `removeOwnGoal(scope, id)` helper is shared with `removeCountryFromBucketListFn`, which adds its country-kind check on top (one owner of the proof).                                                            |

**Per-kind bucket rules.** `country`: `countryCode` required, the name is `countryName(code)` and any client name is ignored; the
handler calls a new module-private helper `addCountryGoal(scope, code, targetYear, note)` that is **extracted from the inline body of
`addCountryToBucketListFn`** (which then calls it too), so there is one implementation of the country entry. `region`: `countryCode`
and `name` required. `place`: `name` required, `countryCode` optional. For `region` and `place` the duplicate key is _(traveller,
kind, country or null, `foldPlaceName(name)`)_ over **non-achieved** entries only (an achieved "Old town" does not block adding it
again). After the insert the handler re-reads and keeps the lowest id, exactly as the country path does, by generalising
`collapseRivalGoals` to take a key predicate rather than copying it. There is still no unique index (a unique index over free text
would reject a second "Old town" in another country, and drizzle-kit rebuilds a SQLite table for an index change).

**Extracted helpers (module-private, one owner).** The race-safe loop of `markCountryVisitedFn` becomes
`recordCountryVisit(scope, code, { visitedOn, note }) -> { state, created }` (`created` is false when the row already existed, which the
"enqueue at most once" rule needs); `markCountryVisitedFn`, and the region cascade, call it. The undo is **not** extracted:
`unmarkRegionVisitedFn` never unmarks a country, so `unmarkCountryVisitedFn` keeps its body. The extractions (`recordCountryVisit`,
`addCountryGoal`, `removeOwnGoal`) leave the existing tests of the four country functions green with no edits, which is their proof. None of the helpers is
exported from the module.

**Authorisation, decided in the handler.** Both tables are per-traveller inside a workspace. Every handler passes
`scope.ctx.userId` and no input carries a user id. An id the traveller does not own, a colleague's id and an id from another
workspace throw the **same** `NotFoundError`. A unique-index refusal on a region is read as "somebody already did it"
(re-read **by the derived `regionCode` and country**, never by name, and answer with that row); a second consecutive refusal becomes a conflict error that carries no driver text, statement, organisation id or
user id.

**The statistics recompute.** The all-time `travel_stats` row stores `regionCount`; the atlas loader reads it live but the
statistics stage prints the stored figure. So `markRegionVisitedFn` and `unmarkRegionVisitedFn` enqueue the recompute (the
deterministic `travel-stats` envelope: all-time year `0`, acting traveller only, `route: 'atlas'`) on every write **that changed a
row**, never on an idempotent no-op, and **at most once per call**: when `recordCountryVisit` reports `created`, its enqueue (which
carries the all-time year) is the call's only one. The bucket-list functions enqueue nothing: `bucket_list_items` feeds no
`travel_stats` column. A refused queue never fails the write (the producer already logs and returns).

**The ceilings (noisy-neighbour guards, not plan quotas).** `src/lib/atlas/limits.ts` exports `BUCKET_LIST_MAX_PER_TRAVELLER = 500`
(achieved entries included) and `VISITED_REGIONS_MAX_PER_TRAVELLER = 1000`; the file ships with the first ticket and the bucket
constant stays unused until the second (it is not dead code). Free-text names make both tables unbounded otherwise, and every region
write can enqueue a queue message. `createBucketListItem` and `markRegionVisited` count the rows of the id they write for
(`values.userId ?? scope.ctx.userId`, through the tenant-scoped `count`; the count never reads an input-supplied user, and a test
asserts it) and refuse past the constant by throwing the existing `QuotaExceededError` - **not** two new classes, which would be a
second owner of "a countable limit was refused" (`docs/SPEC.md` §8). `withQuotaBoundary` already wraps `createBucketListItem` in
`addCountryToBucketListFn` and now wraps both new write paths, so the refusal becomes the existing `AtlasQuotaError`. `classifyFailure`
(`src/server/errors/public.ts`) matches the class name `QuotaExceededError` only, so the wrapped refusal crosses as plain `unexpected`
with no code - the same as the existing country add today, and the screen shows the action's own failure message either way. No entry joins `AUTHORED_ERROR_NAMES`. In
`markRegionVisited` the region check runs **only on the insert path**, after the existing-row lookup: an idempotent re-add at the
1000 line still succeeds. The count-then-insert is not atomic and may overshoot by the requests in flight; the code comment says so.
The **dialog** prevents the bucket refusal first (it reads the `bucketTotal` it already receives and shows `bucket.error.limit`
when it opens, instead of a form that cannot be saved); the country panel's add-to-list path shows the generic add failure, and
`CountryActions` gets no pre-check. `RegionRecord` knows only the regions of one country, not the traveller's total across
countries, so it cannot count the 1000 line itself: `loadCountryRegionsFn` and the region writes additionally return
`total` (the traveller's count), `RegionRecord` shows `regions.error.full` from it before an add is sent, and a refused add that
slips through a stale screen shows the generic failure. Nothing is added to `resolveLimits()`, `PLAN_QUOTAS` or `limits.test.ts`. `ATLAS_BUCKET_LIST_LIMIT = 40` stays: it
caps the SSR payload, is a different control for a different reason, and the constants carry a comment saying so.

**The error channel (`docs/SPEC.md` §9 rule 10).** A server function's failure crosses to the client as `unexpected` plus a reference,
except the classes in `AUTHORED_ERROR_NAMES` (`src/server/errors/public.ts`); statuses and messages do not cross, and that set is closed
and pinned by `public.test.ts`. This stage adds **no** public failure code. So no 422 or 409 is promised to a caller (an earlier draft listed them): every refusal
reaches the screen as the action's own failure message (`failure` / `fallback` keys on `useAction`), and the conditions the screen can
know in advance (full list, empty name, hidden characters) are checked in the browser with `foldPlaceName` and `limits.ts`. The
quota refusal crosses as plain `unexpected`: wrapped by `withQuotaBoundary` it is an `AtlasQuotaError`, which `classifyFailure` does not
map to the `QUOTA_EXCEEDED` code (that code is for a bare `QuotaExceededError`), and its message never crosses.

**Statement budget.** A region add runs about ten or eleven D1 statements (own-regions read, count, insert, the read-back, then the
country half: `atlasCountryState` is itself two statements, plus the country read and insert and the returned list and `total`);
`docs/ARCHITECTURE.md` §2.2 asks for one to four. Assembling `AtlasCountryState` also reads the traveller's bucket list (at most
500 rows) on every region write. The excess is accepted and bounded: every statement is indexed on `(organization_id, user_id)`,
none holds a lock across an await, and the country half is the existing loop; the implementation PR measures the count and records it.

### Entitlement

`atlas` is a key of `MODULE_KEYS` (`src/lib/plans.ts`), gated by the module-enforcement stage through `assertModule`. No second
check is invented here; until that stage lands the module behaves as it does today.

### Decisions on the screen

- **The regions section hangs off `CountryActions`** (`RegionRecord` renders inside it, after the two rows and their message strip,
  and receives the same `headingLevel` as its `SectionLabel`), so both hosts - the map-anchored `CountryOverlay` panel and the
  `AtlasPanel` country pane, each already a scrolling column - gain it without a host edit. `data-part="country-panel-regions"` is on
  `RegionRecord`'s own root. `RegionRecord` is **keyed by `countryCode` inside `CountryActions`**, loads with an effect and local state (`src/components/` has no
  query layer), and ignores a late answer through an ignore flag set in the effect's cleanup. (`CountryActions` itself is keyed by country only in the overlay; in the shelf it carries a fixed `key="actions"` on
  purpose, to avoid remounts - so the key has to live one level down.)
- **Writes coordinate.** A pending region write disables the two action rows and a pending row write disables the region controls,
  the same rule the two rows already follow (`RegionRecord` reports `onPendingChange` to `CountryActions`). Region writes refresh the
  route data (`useAction` invalidates the router), which is intended: when adding a region records the country, the visit row, the
  map and the statistics must change with it. The section's own list is driven by the write's returned list, not the loader.
- **Removing the last region does not unmark the country.** A country with a trip behind it stays visited; the section says so in
  place ("Removing a region does not remove {country} from your atlas"). Where the country is _not_ visited and regions exist, a
  different line is shown (the regions stay, and re-adding one or marking the country heals the pair).
- **The reverse case.** Unmarking a country leaves its regions in place (nothing is cascade-deleted; keeping them can always be
  undone). `RegionRecord` reports its count to `CountryActions` through `onCountChange`; when the traveller has one or more regions in
  the country, the unmark press goes through the existing `ConfirmDialog`, whose body says the regions stay. `ConfirmRequest.description`
  is one string, so when the visit also has history the two sentences come from **one** plural key (`actions.confirm.visitRegions.body`
  takes the already-resolved history sentence as its `{history}` parameter) rather than two pasted together. While the count is still loading the press behaves
  as it does today: nothing is lost either way. This confirmation is this product's form of the reference row's "guard on a derived
  record": a country the traveller built up by hand is not unmarked in one stray press.
- **A list, not `Chip`.** The regions are a `<ul>` labelled by the "Regions" heading; each `<li>` holds the name as text and an
  `IconButton size="sm"` named "Remove {region}" (`loading` / `disabled` supported). `Chip` is not used: its body is always an
  `aria-pressed` toggle and its remove button is a fixed 20 px with no pending state (WCAG 4.1.2, 2.5.8).
- **Plain text input, not `Combobox`.** `RegionRecord` is a `Field` + `Input` whose visible label is "Add a region in {country}" (the
  placeholder is only an example) with an "Add region" `Button`; `Enter` submits. Because suggestions are the traveller's own regions
  _in this country_, which are already the list above the input, a suggestion list would add nothing and is not built (Resolved
  assumption 3). A duplicate is absorbed by the server's fold and answered with "already on your record", not refused.
- **No date, no rename.** A region is added by name; `first_visited_on` stays null. An optional date is additive later.
- **The bucket tab gains "Add something" and a per-row remove** (an `IconButton` named by the existing
  `atlas.actions.goal.remove.name` key). Only an achieved entry asks for confirmation (the existing `atlas.actions.confirm.goal.*`
  pattern); the tab's rows carry no note, so no other entry has anything hidden to lose. The empty state keeps its place and gains the
  same primary action.
- **A new entry can land past the 40 rows the tab shows.** Rows are ordered by `(isAchieved, sortOrder, id)` and new entries are
  written with sort order 0, so where one lands among equals is not promised. When the new item's id is missing from the refreshed rows, the success toast says the list shows its first entries and where the new one is ("{name} is on your list;
  the list shows its first {shown} entries"), so nothing is added invisibly. A "show all" list is out of scope (Out of scope).

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

- Owner modules: region identity `regionCodeFor` and the two ceilings' enforcement in `src/server/repos/atlas.ts` (the owner of the unique key and of
  every insert into `bucket_list_items`); "the same name" in `src/lib/atlas/place-name.ts` (isomorphic, used by the handler and
  unit-testable without a database); the country-record loop (`recordCountryVisit`) and the country goal (`addCountryGoal`) in two module-private helpers in `src/server/fns/atlas.ts`; the two ceilings as constants in `src/lib/atlas/limits.ts`.
- `components/ui` is untouched and never fetches. `RegionRecord` and `BucketListDialog` live in `components/atlas`, which already
  imports server functions (`country-actions.tsx` does).
- No Durable Object, no realtime patch (the atlas is per-traveller and has no room), no KV, no R2, no new queue envelope.
- The `world-map` move: `WorldCoverageMap` is a static SVG world; it moves to `src/components/atlas/world-map.tsx` verbatim
  (path in its doc comment excepted). `atlas-screen.tsx` stays in `-ui/`: it is the composition of one route.

## 📝 Data Model

**No schema change and none is filed.** `visited_regions` (`country_code`, `region_code`, `region_name`, `first_visited_on`;
unique `(organization_id, user_id, region_code)`; `visited_regions_org_country_idx`) and `bucket_list_items` (`kind`, `name`,
`country_code`, `region_code`, `target_year`, `is_achieved`; no unique index) exist as they are. Nothing here raises the 16-character `regionCode` cap, and the repository's function inputs keep their
shape (they still accept an optional `userId` for the seeder).

## 📝 API Contracts

The five functions of "Server functions" above, with these response shapes (types exported from `src/server/fns/atlas.ts`):

- `AtlasRegion = { id: string; name: string }`; `loadCountryRegionsFn` returns `{ countryCode, regions: AtlasRegion[], total: number }` (`total` is the traveller's regions across all
  countries), and the two region writes return the same plus `country: AtlasCountryState` (the existing type) and, for the add,
  `status: 'added' | 'exists'` and `countryRecorded: boolean`.
- `addBucketListItemFn` returns `{ item: AtlasBucketGoal & { kind, countryCode }, country: AtlasCountryState | null }`;
  `removeBucketListItemFn` returns `{ removedId }`.
- Failures: a validation failure names the field (in English only; every custom Zod `error` is a fixed sentence and never interpolates the submitted value); `NotFoundError` is the one refusal for an id the traveller does not own. Nothing
  else is promised to a caller: the ceilings and a lost race reach the screen as the action's generic failure (see "The error
  channel"), and no new class joins `AUTHORED_ERROR_NAMES`.

## 📝 UI/UX

### The regions section (`RegionRecord`)

- A `SectionLabel` "Regions" (its `headingLevel` passed down from the host, so the outline stays valid in both), a one-line hint
  ("Adding a region marks {country} as visited too."), the `<ul>` of regions, and the input row.
- **Empty** (`--color-surface-2`): "No regions recorded here yet" and one line on what a region is for; the input is the next tab
  stop, so the empty state is the input and not a dead end.
- **Loading:** three `Skeleton` rows at the settled row height while `loadCountryRegionsFn` resolves, with "Loading your regions" in the status region.
- **Messages and one status region.** The section has one polite status region, **mounted empty from the first render** (the
  section remounts per country) and filled afterwards; it carries loading ("Loading your regions"), "Adding {region}", the outcomes
  and a failed load. Region writes pass no `success` to `useAction`, so each success is spoken once, by this region and not also by a
  toast. The cascade outcome is one string (`regions.status.addedCountry`). A failed write is spoken by the toast the action raises
  (`useAction` `failure` / `fallback` keys); the section's fixed-height message strip repeats it for a reader who looks again and is
  **not** live. A failed load puts `regions.error.load` in the status region with a "Reload regions" button; when the reload
  succeeds the button unmounts, so focus moves to the input. Conditions the browser catches before submitting (`regions.error.invalid`,
  `.hidden`, `.full`) are the input `Field`'s `error` (`aria-invalid`, `aria-describedby`, announced through `FieldError`), so Enter on
  an empty input is never silent.
- **Pending.** Adds are **not** optimistic: the typed name is not a known row until the server derives the identity, so a pending add
  lives in local state (the Add button shows `loading`, Enter does nothing while it is pending, and the input is read-only so text
  typed meanwhile is not lost or wiped by the success). A failed add keeps the typed text and returns focus to the input. Removals use
  `useOptimistic` (the row leaves at once, comes back in place on failure, and a failed remove keeps the item). Pending is shown
  through the spinner and the busy label, never through reduced opacity (contrast).
- **Focus.** After an add, focus stays on the input (cleared on success). After a remove it moves to the next remaining row's remove
  control, else the previous one, else the input.
- **Motion:** a row enters on 180 ms opacity and a 4 px rise on `--ease-out-quint`, leaves on 150 ms on the same easing and is `inert` while it leaves, so Tab cannot land on a control that is disappearing; `prefers-reduced-motion: reduce`
  collapses to opacity. The map is never animated by this stage.
- **Height discipline.** The overlay sizes its surface with `placeCountrySurface` / `PANEL_MIN_HEIGHT` (288) and places the actions
  in a scrolling column. The section must not move the controls above it when it loads (skeleton at the settled height) and the
  implementer verifies, at 360x800 and 1280x900, that the panel still places and the regions scroll inside the column rather than
  pushing the two action rows off screen; and that the on-screen keyboard open on the input at 360x800 leaves the input visible.
- **Targets.** The remove `IconButton size="sm"` meets WCAG 2.5.8 (24 px minimum) and the row is at least 44 px tall under
  `pointer: coarse`.

### The bucket tab and `BucketListDialog`

- "Add something" (primary) in the tab header and in the empty state opens a `Dialog`. Field order: **Kind** `Select` over the schema's
  kinds (default `place`) first, because it decides the rest; **Country** `Combobox` over the existing country search data (required for
  `country` and `region`, optional for `place`, reusing `atlas.search.placeholder` / `atlas.search.results.none`); **Name** `Input`
  (required for `region` and `place`, **hidden** for `country`, whose name is the country's); **Target year** (optional, 1900-2200,
  with its own error `bucket.error.year`). Each is a `Field`; required ones carry `required`; the "optional" suffix appears only on the
  fields that are optional for the chosen kind (`place` country, and target year).
- The dialog opens from the bucket tab only; a country-panel entry point (the plan's pre-filled country) is out of scope.
- Focus enters the dialog on the Kind field and returns to its trigger on close; after a **successful save opened from the empty
  state** (whose trigger no longer exists) it goes to the header's "Add something". A failed save moves focus to the failure alert
  (`tabIndex={-1}`) with the typed values kept. Escape and a backdrop click **close** the dialog (never suppressed) and keep the
  draft: reopening restores it, Cancel discards it, a successful save clears it. The Save button shows a busy label while pending
  ("Adding to your list").
- **Full list:** when `bucketTotal` already reaches `BUCKET_LIST_MAX_PER_TRAVELLER` the dialog shows `bucket.error.limit` at the top
  **when it opens**, through the same focusable alert, and does not offer a form that cannot be saved. A server-side refusal (a race
  past the line) shows the generic add failure.
- **Duplicate:** adding an entry that already exists is an idempotent success; the toast says "{name} is already on your list".
- Each row gains a remove `IconButton`, 44 px tall under `pointer: coarse` like the region rows (a rolled-back optimistic removal restores the row in place). After a removal - also one confirmed through `ConfirmDialog` - focus goes to the next row's remove control, else the previous one, else "Add something". Offline, the controls reuse
  `atlas.actions.offline` as the two action rows do.
- `bucket.added.hidden` replaces the success toast **only when the returned item's id is missing from the refreshed rows** (see "Decisions on the screen").

## 📝 Visual change expected

`/atlas`, light and dark, desktop (1280x900, 2560x1440) and mobile (360x800):

- the country panel (map-anchored overlay and shelf country pane) with the new **Regions** section: empty, with rows, loading, error;
- the bucket tab with the **Add something** action, a remove control on each row, and the open dialog (empty, invalid, limit reached);
- the **confirmation** raised by unmarking a country that has regions.

The resting `/atlas` screen changes only by the bucket tab's header action. The `world-map` move changes no pixel.

## 📝 Copy

All keys are added to `src/lib/i18n/messages/en/atlas.ts` and land in all 23 locales in the same change (`i18n-messages` skill; plural
keys carry every category each locale needs, and `{count}` keeps its name). `{country}` is `countryName(code)`.

| Key (en)                                                                   | Text                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regions.label`                                                            | Regions                                                                                                                                                                                                                      |
| `regions.hint`                                                             | Adding a region marks {country} as visited too.                                                                                                                                                                              |
| `regions.keeps`                                                            | Removing a region does not remove {country} from your atlas.                                                                                                                                                                 |
| `regions.keeps.unvisited`                                                  | These regions stay on your record. Mark {country} as visited, or add a region, to put it back on your map.                                                                                                                   |
| `regions.empty.title`                                                      | No regions recorded here yet                                                                                                                                                                                                 |
| `regions.empty.body`                                                       | Add a state, province or area you have visited in {country}.                                                                                                                                                                 |
| `regions.input.label`                                                      | Add a region in {country}                                                                                                                                                                                                    |
| `regions.input.placeholder`                                                | For example, Bavaria                                                                                                                                                                                                         |
| `regions.add` / `regions.adding`                                           | Add region / Adding {region}                                                                                                                                                                                                 |
| `regions.remove`                                                           | Remove {region} (a removal is optimistic, so there is no busy label)                                                                                                                                                         |
| `regions.loading`                                                          | Loading your regions                                                                                                                                                                                                         |
| `regions.status.added` / `.exists` / `.removed`                            | Added {region} / {region} is already on your record / Removed {region}                                                                                                                                                       |
| `regions.status.addedCountry`                                              | Added {region}. {country} is now marked as visited. (one string; two messages in a row would clobber each other in one polite region)                                                                                        |
| `regions.error.invalid`                                                    | Enter a region name.                                                                                                                                                                                                         |
| `regions.error.hidden`                                                     | That name contains characters we cannot keep. Remove them and try again.                                                                                                                                                     |
| `regions.error.load`                                                       | We could not load your regions for {country}. (spoken through the section's status region, not a toast)                                                                                                                      |
| `regions.error.add` / `.remove`                                            | We could not add {region}. Try again. / We could not remove {region}. Try again.                                                                                                                                             |
| `regions.error.full`                                                       | You have recorded {limit} regions. Remove one to add another.                                                                                                                                                                |
| `regions.reload`                                                           | Reload regions                                                                                                                                                                                                               |
| `actions.confirm.visitRegions.body` (plural on `{count}`)                  | {history}{count} regions you recorded in {country} stay on your record. (`{history}` is the existing visit-loss sentence already resolved by `visitLossLine`, with a trailing space, or empty; `{count}` is shown formatted) |
| `panel.bucket.add`                                                         | Add something                                                                                                                                                                                                                |
| `bucket.dialog.title`                                                      | Add to your bucket list                                                                                                                                                                                                      |
| `bucket.dialog.name` / `.kind` / `.country` / `.countryOptional` / `.year` | Name / Kind / Country / Country (optional) / Target year (optional)                                                                                                                                                          |
| `bucket.dialog.save` / `.saving` / `.cancel`                               | Add to list / Adding to your list / Cancel                                                                                                                                                                                   |
| `bucket.error.name` / `.country` / `.year`                                 | Enter a name. / Choose a country. / Enter a year between 1900 and 2200.                                                                                                                                                      |
| `bucket.error.hidden`                                                      | That name contains characters we cannot keep. Remove them and try again.                                                                                                                                                     |
| `bucket.error.limit`                                                       | Your bucket list is full ({limit} entries). Remove one to add another.                                                                                                                                                       |
| `bucket.error.add` / `.remove`                                             | We could not add {name}. Try again. / We could not remove {name}. Try again.                                                                                                                                                 |
| `bucket.added` / `bucket.added.exists`                                     | {name} is on your list. / {name} is already on your list.                                                                                                                                                                    |
| `bucket.added.hidden`                                                      | {name} is on your list; the list shows its first {shown} entries.                                                                                                                                                            |
| `panel.bucket.empty.body` (rewritten)                                      | Somewhere you have always meant to go. Add it here to keep it on your list. (today's text promises a tick-off this stage does not build)                                                                                     |

Reused as they are: `atlas.actions.goal.remove.name` / `.remove.busy` (the bucket row's remove control and busy label), `atlas.actions.offline`, `atlas.actions.toast.listed` / `unlisted`,
`atlas.search.placeholder` / `atlas.search.results.none`, `atlas.panel.bucket.kind.*`, `atlas.actions.confirm.goal.*`.
Plural keys carry every category each locale needs; `{count}` keeps its name; `{limit}` and `{shown}` are formatted numbers.
The unmark confirmation is **one** string from the single plural key `actions.confirm.visitRegions.body`, whose `{history}` parameter
carries the already-resolved visit-loss sentence (itself plural on visits, so the two plurals never meet in one message); the
translator controls where it sits and nothing is concatenated at runtime.

The kind labels reuse the existing `atlas.panel.bucket.kind.*`; the achieved-entry confirmation reuses
`atlas.actions.confirm.goal.*`. Glossary: `CONTEXT.md` gains **Visited region** (a named area inside a country a traveller has
recorded; it never replaces the country) and **Bucket list item** (an aspiration of kind country, region or place; per traveller;
its `place` kind is a free-text aspiration and is **not** a **Place**, the location attached to a trip).

## 📝 Edge Cases & Failure Scenarios

| Case                                                                                 | Expected                                                                                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| "Bavaria", " bavaria ", "BAVARIA" typed in turn                                      | One row; later submits are idempotent successes                                                                            |
| "Tokyo" typed in Japan when the seed holds `JP-13` "Tokyo"                           | Resolves to the existing row; no second row                                                                                |
| Same name in two countries                                                           | Two rows (the country is in the code)                                                                                      |
| Name whose folded form is empty, or contains a control / bidi character              | Validation error, nothing written                                                                                          |
| Non-Latin name ("東京都")                                                            | Accepted; identity is the hash of the folded name                                                                          |
| Two overlapping adds of the same new region                                          | The loser's unique refusal is read as "already done"; one row; no driver text leaves the module                            |
| A name with a bidi or invisible control character                                    | Refused in the browser (`regions.error.hidden`) and again by the server                                                    |
| The 1001st region, or the 501st bucket entry typed past a stale screen               | Refused by the repository; the screen shows the generic add failure; nothing is written                                    |
| A region add that races with unmarking the country from another tab                  | The country is recorded after the region; an unmark committed after the cascade leaves a region under an unvisited country | The panel shows it (`regions.keeps.unvisited`); re-adding a region or marking the country heals the pair |
| A region is saved and the country cascade then fails (not a unique refusal)          | Failure toast; the region is saved but the on-screen list lacks it; a retry reads `exists` and records the country         |
| Region added in a country the traveller has not visited                              | Region written, then country recorded once; one recompute enqueue                                                          |
| Region re-added after the country was unmarked                                       | Country re-recorded (heal), no duplicate region                                                                            |
| Last region removed                                                                  | Country stays visited; the in-place line says so (a different line if the country is unvisited)                            |
| Unmark a country that has regions                                                    | Confirmation names the count and that they stay; regions remain                                                            |
| `unmarkRegionVisitedFn` with a colleague's id, another workspace's id, an unknown id | The same `NotFoundError`; the row survives                                                                                 |
| Input carrying `userId` / `organizationId` / an unknown key                          | Rejected by the strict validator                                                                                           |
| Country code outside `COUNTRY_NAMES`                                                 | Validation error                                                                                                           |
| Queue binding refuses the recompute                                                  | The write succeeds; the failure is logged once                                                                             |
| Adding a bucket `country` entry twice, or overlapping                                | One entry (lowest id kept)                                                                                                 |
| Adding "Old town" (`place`, Estonia) while an achieved "Old town" exists             | A new entry (achieved entries do not count as duplicates)                                                                  |
| 501st bucket entry (through either add function)                                     | `QuotaExceededError` in the repository; the screen shows the full-list message first                                       |
| Removing a bucket entry twice                                                        | The second is a success (`alreadyGone`)                                                                                    |
| An entry beyond the 40 rows the loader shows                                         | Added and counted; the toast says the list shows its first entries; the "N more" line stays                                |
| Offline / failed write                                                               | A removed row comes back in place; a failed add keeps the typed text; the message says what failed                         |

## ✅ Acceptance criteria

1. `markRegionVisitedFn` records a region by name, and records the parent country exactly once when it was unrecorded and not at all
   when it already was (visit count unchanged).
2. Two casings / spacings / diacritic variants of one name are one row; the same name in two countries is two rows; a name matching
   an existing (seeded) row returns that row.
3. `unmarkRegionVisitedFn` and `removeBucketListItemFn` refuse a colleague's id, a foreign-workspace id and an unknown id with the
   same `NotFoundError`, and delete nothing.
4. No input of any new function accepts `userId`, `organizationId`, `regionCode` or `sortOrder`; the strict validators reject them.
5. `unmarkCountryVisitedFn` leaves regions in place; its confirmation fires when regions exist, says they stay, and is one string
   (with the history line when the visit has one).
6. A region write that changed a row enqueues one all-time `travel-stats` envelope; an idempotent no-op enqueues none; a cascade
   plus a new region enqueues one, not two; the bucket-list functions enqueue none.
7. A bucket entry of each kind round-trips; `country` ignores a client name; the 501st entry is refused with `QuotaExceededError`
   (metric `bucket_list_items_per_traveller`, becoming `AtlasQuotaError`, plain `unexpected` with no code) through both add functions and nothing is written; the dialog shows the
   full-list message when it opens; the country panel's add path shows the generic failure.
8. The extracted country helpers leave the existing tests of the four country functions green without edits.
9. `RegionRecord`: `Enter` submits and does nothing while an add is pending (the input is read-only then); a failed add keeps the typed
   text and focus on the input; a failed remove keeps the row; every row's remove control is keyboard-reachable with an accessible
   name that includes the region; focus lands as stated; the invalid / hidden / full messages are the input's `Field` error; a failed
   load is spoken by the status region and the reload moves focus to the input; a pending write and the two action rows disable each
   other; a late answer for another country is ignored.
10. `BucketListDialog`: Kind first and defaulting to `place`; name hidden for `country`, required otherwise; country required for
    `country` and `region`; focus enters on Kind and returns to the trigger on close; the failure alert takes focus; the draft survives
    Escape; the full-list message is shown instead of submitting.
11. The panel's tab order runs actions -> regions list -> input -> Add in both hosts; `[data-part="country-panel-regions"]` resolves to exactly
    one element in each.
12. `world-map.tsx` lives under `src/components/atlas/`, `copy-rules.test.ts` still reads it, and no file imports the old path.
13. All new copy exists in 23 locales (parity test) and no component carries an English literal (`copy-rules.test.ts`).
14. Tenant isolation: the new `describe` (below) passes, including the cross-workspace ceiling case.
15. The browser journey passes with an empty console (`watchConsole`) in both themes and on `mobile-safari` for read-only checks.

## 📝 Risks & Impact Review

| Risk                                                    | Severity | Mitigation                                                                                                                                                                                             |
| ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A colleague deletes another traveller's row by id       | High     | Handler-side own-row proof, one error for every refusal, a same-workspace test (AC 3)                                                                                                                  |
| The cascade writes a country row across workspaces      | High     | Same scope as the region; the cross-workspace cascade test                                                                                                                                             |
| Overlay surface no longer fits with the extra section   | Medium   | Skeleton at settled height, scroll inside the existing column, 360x800 and 1280x900 frames, `country-overlay.test.tsx` kept green by the one-line mock additions of the scope table, no case rewritten |
| Refactor of the country functions regresses idempotence | Medium   | The existing tests are the guard; no edits to them in the same commit                                                                                                                                  |
| A seeded ISO row and a typed name diverge               | Low      | Resolve-by-name before deriving                                                                                                                                                                        |
| A region add costs 8-9 D1 statements                    | Low      | Recorded against `docs/ARCHITECTURE.md` §2.2; all indexed on `(organization_id, user_id)`; the ceiling bounds the list read                                                                            |
| Hashed codes leak into a future export                  | Low      | The share/export rule is written into the spec: use `region_name` plus the country, never the code                                                                                                     |
| Overshoot of the 500-row ceiling under a race           | Low      | A noisy-neighbour guard, documented as non-atomic                                                                                                                                                      |
| Stored `regionCount` lags if the queue is down          | Low      | Producer logs and the next recompute heals; the atlas reads it live                                                                                                                                    |

**Backward compatibility** (`BACKWARD_COMPATIBILITY.md`). Everything is additive: five new server functions (the three region functions, `addBucketListItemFn` and
`removeBucketListItemFn`), no schema change, no migration, no route, no queue message shape change, and no change to the four existing
server functions' inputs or outputs. One stored string changes: the copy of the existing key `panel.bucket.empty.body` is rewritten,
which obliges a fresh translation in all 23 locales in the same change (the parity test only checks that the key exists, so the
implementation PR names it for the translators).

### Out of scope

A clickable or painted region layer and its tileset; editing or renaming a region; a visited date on a region; ticking a bucket
entry off or editing it (`achieveBucketListItem` has no server function and the row does not ask for one); a repository-level
`userId` guard on `unmarkRegionVisited` / `deleteBucketListItem`; workspace-wide suggestions; a "show all" bucket list beyond the 40 rows; an undo toast for a removed entry.

### Blockers

- **No sub-national geometry, so no region layer.** Disposition: **defer**, and record it, because the plan's pointer to a
  boundaries-and-blockers entry does not exist today (`docs/plans/11-boundaries-and-blockers.md` never mentions a region tileset).
  08-S2a files a tracker issue "Decide: a region tileset in the TILES bucket for the atlas" (infrastructure and cost) and cites
  it in its PR. The issue body opens with `🤖 HUMAN-ONLY: ` and names the one decision a person owes, because the backlog planner
  (`.ai/scripts/backlog-status.mjs`) starts no run on an issue whose body opens with that marker; without it triage could hand a
  "Decide" issue to `implement-ticket`. The rows this stage writes are exactly the rows a layer would paint from.
- Nothing else. No package, no binding, no third-party service.

### Reference-row disposition

`ADD-05` closes as **done** with 08-S2b: the plan's own closing rule counts a path that works and says it is degraded as done, and
names this stage's list-shaped region record as its example.

## 📋 Phasing

See "Phase boundaries (tickets)": 08-S2a then 08-S2b.

## 📋 Implementation Plan

### Phase 1 - regions on the record (08-S2a)

1. `src/lib/atlas/place-name.ts` and its test, test first (the Edge Cases rows on folding).
2. Async `regionCodeFor` in `src/server/repos/atlas.ts`; the boundary schemas in `fns/atlas.ts`; repository cases.
3. Extract `recordCountryVisit` from `markCountryVisitedFn` with its tests unchanged; add `src/lib/atlas/limits.ts` and the region ceiling in `markRegionVisited` (`QuotaExceededError`, insert path only); then
   `loadCountryRegionsFn`, `markRegionVisitedFn`, `unmarkRegionVisitedFn` and their cases in `atlas.test.ts`; the tenant-isolation `describe`.
4. Move `world-map.tsx`; fix `atlas-screen.tsx` and `copy-rules.test.ts`; add the three region functions to the `#/server/fns/atlas` mock factories of the four host tests (`atlas-panel`, `country-overlay`, `trip-scope`, `country-actions`).
5. `region-record.tsx`, the `CountryActions` edit (mount, `onCountChange`, the unmark confirmation), `index.ts`; the region keys in
   23 locales; `CONTEXT.md` **Visited region**; the issue for the region tileset; the e2e `describe`.

### Phase 2 - the bucket list (08-S2b)

1. The count and `QuotaExceededError` in `createBucketListItem` (the constant is already in `limits.ts`); generalise `collapseRivalGoals`; repository cases.
2. Extract `addCountryGoal` from `addCountryToBucketListFn`; `addBucketListItemFn`, `removeBucketListItemFn`; their cases (the ceiling through both add functions).
3. `bucket-list-dialog.tsx`, the `atlas-panel.tsx` bucket-tab edit (action, row remove, empty state) with `atlas-panel.test.tsx` (the `removeBucketListItemFn` mock, the new empty-state and row-remove assertions), `index.ts`; the bucket keys in
   23 locales; `CONTEXT.md` **Bucket list item**; the e2e `describe`.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/atlas/__tests__/place-name.test.ts`; `src/server/fns/__tests__/atlas.test.ts` (cascade once / not at all, heal after
  unmark, folded duplicates, seeded-row match, colleague and cross-workspace refusals, strict-input refusals, ceiling through both
  add functions, enqueue counts, race refusal read as success); `region-record.test.tsx`; `bucket-list-dialog.test.tsx`;
  `country-actions.test.tsx` (existing cases hold with the section mounted; the confirmation with regions); the `#/server/fns/atlas` factories of `atlas-panel.test.tsx`, `country-overlay.test.tsx` and `trip-scope.test.tsx` gain the new exports (08-S2a: the three region functions; 08-S2b: `removeBucketListItemFn`, and the panel's new empty-state and row-remove assertions).
- Definition of done: the `docs/SPEC.md` §7 checklist, item by item, in each PR body.
- Tenant isolation, appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one `describe`: in A's scope,
  `markRegionVisited` for a region whose country only B has visited writes A's row and leaves B's; `unmarkRegionVisited(scopeA, bRegionId)`,
  `deleteBucketListItem(scopeA, bItemId)` and `achieveBucketListItem(scopeA, bItemId)` are `NotFoundError` with B's rows intact; reversed,
  `listVisitedRegions(scopeB, aUserId)` is `[]` and `visitedRegionsRepository.requireById(scopeB, aRowId)` is the `NotFoundError`
  (both asserted); the cascade writes A's `visited_countries` row and leaves B's count unchanged. The cross-workspace ceiling case: the ceiling in A's scope counts A's rows only (a full list in B does not refuse A's add, and the reverse).
  The same-workspace colleague cases live in `atlas.test.ts` and are four: a colleague's `unmarkRegionVisitedFn`, a colleague's
  `removeBucketListItemFn`, a colleague's rows absent from `loadCountryRegionsFn`, and a colleague's rows not counted against the ceiling
  (the repository functions are workspace-scoped by design).
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
  verified to resolve by the spec run reaching the same state. The spec run also asserts layout shift 0 when the regions load
  (chromium; a `test.skip` on `mobile-safari`), and a 360x800 frame is taken with the on-screen keyboard open on the region input.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                              | Applied default                                                                                                                                                                                                                                    | Why                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How does a typed region name become `region_code`?                    | Server-derived: `<CC>-` + 12 hex of SHA-256 over `<CC>\|<folded name>`; resolve by folded name against the traveller's own rows first; the client never sends a code                                                                               | Decided by software architect (high) and security and tenancy (medium) sub-agents; they differed on a readable code vs a hash; the hash was taken: fits the 16-character validator, no Unicode edge cases, more reversible      |
| 2   | Raise the repository's `regionCode` cap?                              | No; the cap stays at 16                                                                                                                                                                                                                            | Consequence of row 1                                                                                                                                                                                                            |
| 3   | Region-name suggestions, and whose?                                   | None: the input is plain text; the traveller's own regions in the country are already the chips                                                                                                                                                    | Security and tenancy sub-agent (high): own rows only; applied default: `Combobox` is single-select with no create mode, so the plan's "combobox that accepts a typed name" does not exist, and own-only suggestions add nothing |
| 4   | Region layer on the map?                                              | Deferred; list-shaped record; a tracker issue for the tileset decision is filed by 08-S2a                                                                                                                                                          | Plan decision verified (`public/atlas/`, `style.ts`); product owner sub-agent (medium): the plan's pointer into the blockers plan is dangling                                                                                   |
| 5   | Which region writes enqueue a recompute?                              | Every write that changed a row, all-time year, at most once per call; none for no-ops or bucket writes                                                                                                                                             | Decided by software architect sub-agent (medium): `regionCount` is a stored column the statistics stage prints                                                                                                                  |
| 6   | Where does the country loop live, and who proves ownership?           | Module-private helpers extracted in `fns/atlas.ts`; each id-addressed handler lists the traveller's own rows first                                                                                                                                 | Decided by software architect (high) and security and tenancy (high) sub-agents                                                                                                                                                 |
| 7   | Bucket kinds and duplicates                                           | `country` delegates to the country path; `region` needs a country; `place` does not; duplicates keyed on (traveller, kind, country, folded name) over non-achieved entries                                                                         | Decided by software architect sub-agent (medium)                                                                                                                                                                                |
| 8   | The bucket ceiling                                                    | 500 per traveller, achieved included, the existing `QuotaExceededError` (metric `bucket_list_items_per_traveller`) in the repository, non-atomic and said so; the screen prevents it first                                                         | Architect proposed 200, security and tenancy 500; the larger was taken (a limit is easy to lower later and never evicts); security and tenancy sub-agent (medium)                                                               |
| 9   | Where does the regions section mount?                                 | Inside `CountryActions`, so both hosts get it without editing files the stage does not own                                                                                                                                                         | Decided by software architect sub-agent (high)                                                                                                                                                                                  |
| 10  | Is "remove" part of the slice?                                        | Yes: a remove control on every bucket row (confirmation for an achieved entry only); no tick-off, no edit                                                                                                                                          | Decided by product owner sub-agent (high)                                                                                                                                                                                       |
| 11  | A date or a rename on a region?                                       | No                                                                                                                                                                                                                                                 | Decided by product owner sub-agent (high): additive later                                                                                                                                                                       |
| 12  | Ticket cut                                                            | Two tickets, each a full path; the `world-map` move rides with the first (a third only if the first does not fit)                                                                                                                                  | Decided by product owner sub-agent (medium)                                                                                                                                                                                     |
| 13  | Close `ADD-05` as done or partial?                                    | Done, with 08-S2b                                                                                                                                                                                                                                  | Decided by product owner sub-agent (medium): the plan's closing rule names this case                                                                                                                                            |
| 14  | Removing the last region, and unmarking a country that has regions    | The country stays visited; unmarking keeps regions, behind a confirmation that says so                                                                                                                                                             | Decided by product owner (medium) and security and tenancy (high) sub-agents                                                                                                                                                    |
| 15  | The plan's strict-object and validator-reuse wording                  | `z.strictObject` per function, no `userId`; repository inputs are not reused as boundary validators                                                                                                                                                | Security and tenancy sub-agent (high): the repository schemas declare `userId`                                                                                                                                                  |
| 16  | Plan paths that no longer exist                                       | `e2e/product-modules.spec.ts` (no snapshots, created by whichever stage lands first), `scripts/visual/capture.mjs`, no `e2e/__screenshots__`; `copy-rules.test.ts` joins the owned paths                                                           | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md`; verified by `ls`                                                                                                                                        |
| 17  | Name later stages by id in this spec?                                 | No                                                                                                                                                                                                                                                 | Applied default, verified in `.ai/scripts/backlog-status.mjs`                                                                                                                                                                   |
| 18  | A ceiling on `visited_regions` too?                                   | Yes: 1000 per traveller, the existing `QuotaExceededError` (metric `visited_regions_per_traveller`, insert path only), constants in `src/lib/atlas/limits.ts`, screen pre-check                                                                    | Security and tenancy panel (round 1): free-text names make the table unbounded and each write can enqueue a message                                                                                                             |
| 19  | How does a refusal reach the screen?                                  | As the action's generic failure; no new class in `AUTHORED_ERROR_NAMES`; ceilings reuse `QuotaExceededError` and `withQuotaBoundary` (becoming `AtlasQuotaError`; plain `unexpected`, no code); what the screen can know is checked in the browser | Architect panel (round 1): `docs/SPEC.md` §9 rule 10 and `public.test.ts` pin a closed set; security and tenancy panel (round 2): a second class would be a second owner of "a countable limit was refused"                     |
| 20  | `Chip` for the regions?                                               | No: a `<ul>` with text and an `IconButton size="sm"`                                                                                                                                                                                               | Accessibility panel (round 1): `Chip` is an `aria-pressed` toggle with a fixed 20 px remove button and no pending state                                                                                                         |
| 21  | Optimistic adds?                                                      | No for adds (identity is server-derived), yes for removals                                                                                                                                                                                         | Architect and UX panel (round 1): `useOptimistic` cannot show a row whose id does not exist yet                                                                                                                                 |
| 22  | Confirm before removing a bucket entry?                               | Only an achieved one; no undo toast                                                                                                                                                                                                                | Product owner panel (round 1): the tab's rows hold no note, so nothing hidden is lost                                                                                                                                           |
| 23  | Entries beyond the 40 visible rows                                    | Added and counted; the toast says the list shows its first entries; a "show all" list is out of scope                                                                                                                                              | UX panel (round 1): nothing may be added invisibly                                                                                                                                                                              |
| 24  | A country-panel entry point to the dialog, and the dialog's tab order | Out of scope; Kind first, Name hidden for `country`                                                                                                                                                                                                | Product owner and UX panel (round 1)                                                                                                                                                                                            |
| 25  | Statement budget of a region add                                      | 8-9 D1 statements accepted against `docs/ARCHITECTURE.md` §2.2 and recorded                                                                                                                                                                        | Architect panel (round 1)                                                                                                                                                                                                       |
| 26  | Panel, round 1                                                        | Product owner, software architect, security and tenancy, accessibility, UX: all five **approve with conditions**; every condition applied in the revision commit                                                                                   | Panel round 1                                                                                                                                                                                                                   |
| 27  | Does the region ceiling reach the screen?                             | `loadCountryRegionsFn` and the region writes also return the traveller's `total`; `RegionRecord` shows `regions.error.full` from it; a slipped refusal shows the generic failure                                                                   | UX panel (round 2): the per-country list cannot know the cross-country total                                                                                                                                                    |
| 28  | One key or two for the unmark confirmation?                           | One plural key on `{count}` with a `{history}` parameter holding the already-resolved visit sentence                                                                                                                                               | UX and product owner panels (round 2) differed on the shape; one key keeps the two plurals apart and the translator in control of order                                                                                         |
| 29  | Panel, round 2 (final)                                                | Product owner, software architect, security and tenancy, accessibility, UX: all five **approve with conditions**; every condition applied in the following commit, no third round                                                                  | Panel round 2                                                                                                                                                                                                                   |
