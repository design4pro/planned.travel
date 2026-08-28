# 13 — Community gallery

## Area brief

A first-party, hosted community gallery: a workspace publishes one of its trips for the whole
world to browse, a curator reviews it before it goes live, an anonymous visitor reads it — hero,
searchable card grid, day-by-day itinerary, a map with a pin on every coordinate-bearing place, a
suggestions thread — and a signed-in traveller saves it into their own workspace as a read-only
copy they can later turn into a trip of their own.

The reference product delivers this value through a community-sharing plugin, studied as
`wiki: Plugins` and `wiki: Addons-Overview`. Its shape cannot ship here, and this plan's core job
is the first-party redesign of its trust model rather than a port of its mechanism:

- **No per-user tokens for an external code host.** The reference asks each sharer for a personal
  access token to a third-party code-hosting service and stores it as a plugin setting. A hosted
  multi-tenant product asking customers for credentials to someone else's service is a security and
  UX regression, and this plan stores no such token anywhere.
- **No pull-request and no discussion-thread machinery.** The reference publishes by opening a pull
  request against a fixed external repository and seeds a discussion thread beside it. Here,
  publication is a row in our own D1 through a tenant-scoped repository, review is an in-house
  curation queue, and the suggestions thread is our own table — no external write surface exists.
- **No outbound egress to any external basemap or raw-content host.** The reference fetches its
  browse index from a raw-content CDN and its map tiles from a third-party basemap service. Here,
  the browse surface is served from the `KV` binding so D1 is never in the anonymous critical path
  (`docs/ARCHITECTURE.md` §4), and every map is MapLibre over the existing `/api/tiles/*`
  `.pmtiles` pipeline against the `TILES` binding (`docs/ARCHITECTURE.md` §2.3). The Worker makes
  **zero** outbound fetches for this feature.
- **What is kept is the UX shape**, because it is the value: a browse screen with the newest
  publication as a hero over a searchable card grid, a detail screen with itinerary + map +
  suggestions, import-as-a-read-only-copy, and idempotent re-share.

The plugin **runtime** is not ported, only the feature's value. The boundary rows `EXT-01`,
`EXT-02` and `EXT-03` in `11-boundaries-and-blockers.md` remain excluded exactly as written there:
no plugin host, no provider hooks, no agent-protocol server. This plan is the hosted-equivalent
doctrine applied to one more behaviour, the same move that file makes for the ten rows it gathers.

#### Product naming, defined here and used everywhere

This feature carries its own names; none is carried from the reference.

| Thing                            | Our name                                             |
| -------------------------------- | ---------------------------------------------------- |
| The public surface               | **the Trip Gallery** ("the Gallery" in running copy) |
| The anonymous routes             | `/gallery` (browse), `/gallery/$slug` (detail)       |
| Publishing a trip                | "publish to the Gallery"                             |
| The review process               | **curation**; the reviewers are **curators**         |
| The review surface               | `/curation`, "Gallery curation"                      |
| The public comment thread        | **suggestions**                                      |
| A visitor's imported copy        | a **saved trip**                                     |
| Turning a saved trip into a trip | "start planning from this trip"                      |

#### No matrix row exists for this scope

The 89-row matrix predates this feature, and the claim rests on artifacts that exist: the matrix's
row ids survive where the sibling plans quote them, and none of those quotations names this scope —
measured at this HEAD, `grep -rn "community"` and `grep -rn "curation"` over plans `00`–`12` both
match nothing, and every `gallery` hit in a sibling is `08-product-modules.md`'s photo-journal
gallery, a different thing under the same word. The scope is minted
by this plan from the task brief, so every stage's **Reference rows** heading states that no
matrix row is closed, and the sourcing citation is `wiki: Plugins` (behaviour of the
community-sharing plugin) plus the neighbouring pages named per stage. One consequence for a
sibling plan is recorded rather than silently contradicted: `07-S10` calls itself "the second and
last unauthenticated surface in the product". That was true when `07-collaboration-and-sharing.md`
was written; this plan, which postdates it, adds a third and fourth (`/gallery` and
`/gallery/$slug`). The sentence in plan 07 is superseded by this file, not edited by it.

#### What is on disk today, measured at HEAD

- **Nothing of this feature exists.** `grep -rn "gallery\|curation" src/` finds no product code for
  this scope; `docs/plans/` has no stage naming it. Everything below is new work.
- **The tenancy machinery this plan builds on is finished.** `tenantFilter()` is
  `src/server/repos/base.ts:86`, `createTenantRepository()` is `:287`, `assertQuota()` is `:430`,
  and `createScope()` — the helper that builds a `TenantScope` from a row rather than a session —
  is `:51`. The one shipped precedent for a request that reaches tenant data without a session is
  the share-link design in `07-S6` (row `COL-10`, wave 2), whose repository half already exists:
  `src/server/repos/trips.ts:476-518` implements list/create/revoke/touch for `share_links`
  (`src/server/db/schema.ts:1028`), and the docstring above `touchShareLink` records the rule —
  the caller resolves the row first and builds a scope from the row's own organization.
- **The quota spine is finished and does not know this feature.** `resolveLimits()` is
  `src/server/billing/limits.ts:216`, `PLAN_QUOTAS` is `src/server/db/types.ts:41`, and
  `USAGE_METRICS` is `src/server/db/schema.ts:137-146` — eight metrics, none of them a gallery
  metric. The addition is a wave-0 requirement, stated under `13-S1`'s **Quota**.
- **The background spine is finished.** `TASK_KINDS` is `src/server/queue/types.ts:13`,
  `enqueueTask` lives in `src/server/queue/jobs.ts` with idempotency keys and a done-marker TTL,
  and `src/server/queue/consumer.ts:37-39` registers the three shipped handlers. Plan 06 measured
  the precedent that a kind may be declared before its handler lands
  (`06-documents-and-media.md` records kinds at `queue/types.ts:87-101` with no handler); this
  plan never relies on it — each stage that adds a kind adds its handler in the same stage.
- **The map stack is finished.** `src/components/map/` ships `MapCanvas` (with the two-sided
  `data-map-ready` settle marker at `map-canvas.tsx:756`), `PlaceMarker`, `Pins`, `FitBounds`,
  `BasemapNotice`, `MapAttribution` and friends; `src/lib/map/pmtiles.ts` registers the
  `pmtiles` protocol against `/api/tiles/*`. The gallery detail map reuses all of it and adds no
  map primitive.
- **The unauthenticated chrome is finished.** `MarketingHeader` is
  `src/components/marketing/chrome.tsx:26`, `SkipToContent` `:97`, `MarketingFooter` `:172`; the
  pricing and legal pages already mount them, and `07-S6` chose the same chrome for its guest
  viewer. The gallery's anonymous pages sit in that family.
- **Notifications are key-based and ready.** `notify()` is
  `src/server/repos/notifications.ts:129` and `notifyMany()` `:135`; both store `titleKey` +
  `bodyKey` + params (`:46-48`), never a rendered sentence, so a curation verdict can be
  announced to a publisher in the publisher's own language through the existing pipeline.
- **The i18n contract is fixed and partially populated.** The catalogue layout and the ten
  namespaces are fixed by `docs/SPEC.md` §8; at HEAD `src/lib/i18n/messages/en/` holds `atlas`,
  `auth`, `settings`, `shell` and `ui`. This plan introduces **no new namespace**: its strings go
  to `marketing` (the anonymous surface), `trips` (publish, save, notifications) and `settings`
  (the curation console), with the assignment table below.

#### Publication is a reviewed snapshot, not a live window

A published gallery trip is a **frozen, self-contained snapshot** taken at submission time, stored
as an immutable versioned object in the `FILES` R2 bucket and rendered to KV on approval. It is
not a live view of the source trip. This one decision carries most of the architecture:

- **Privacy is decidable at one moment.** The publish dialog shows exactly what the snapshot will
  contain before the workspace admin submits, and nothing the workspace does to the trip afterwards
  leaks. Included: a public title, an authored summary, an attribution name, the day sequence
  (dates included only when the publisher's "show dates" switch is on), each day's places — name,
  category, coordinates, in-day order — and derived counts and country codes. Excluded, always and
  without a toggle: traveller identities, notes, files, reservations, costs, packing lists and the
  whole collaboration surface. The gallery sells an itinerary, not a workspace.
- **Curation reviews a fixed artefact.** A curator approves the exact bytes a visitor will see;
  re-editing the source trip cannot change an approved publication. Updating the public copy is a
  re-share, which is a new version through the same review.
- **Saved trips survive withdrawal.** A saved trip references the immutable snapshot version it was
  saved at, so a publisher withdrawing a trip stops new readers without reaching into anyone's
  saved copy — the same promise `07-S6` makes about revoked links, and the same behaviour the
  reference gives imports. A curator takedown is the one exception and deletes everything,
  including saved references; that is what a takedown is for.
- **The anonymous read path never touches D1.** Approval renders two KV documents — the browse
  index and the trip detail payload — and the anonymous loaders read only those.
  Read-your-own-write surfaces (the publish dialog, the curation queue) read D1, per
  `docs/ARCHITECTURE.md` §4 rule 2.

#### The gallery is a deliberate cross-tenant read surface, argued once

Every domain row stays scoped by `organization_id` and every write goes through a tenant-scoped
repository. But a published trip is, by definition, readable by everyone, and a suggestion posted
by workspace A on workspace B's publication must be readable to both and to the world. The plan
therefore names its unscoped reads exactly the way `07-S6` named
`findLiveShareLinkByToken` — deliberately, in one place, with the row supplying the tenant:

- **Gallery-space readers** in `src/server/repos/community.ts` take a `Database`, not a
  `TenantScope`, filter on `status = 'published'` (rows) or `status = 'visible'` (suggestions),
  and return only what the public payload needs. They are the only unscoped queries this plan
  adds, each is named `*ForGallery` so a reviewer can find them all with one grep, and each is
  covered by a test asserting it can never return an unpublished or hidden row.
- **Every write is scoped.** Publishing writes in the publisher's scope; a suggestion writes in
  the author's scope; a curation verdict runs in the curation workspace's scope and then builds
  the publisher-org scope from the publication row via `createScope`
  (`src/server/repos/base.ts:51`) to deliver the notification — the same row-derived-scope move
  the share-link resolver made first.
- **Curation is a workspace, not a superpower.** The curators are the admins of one designated
  operations workspace, named by a `wrangler.jsonc` var (a wave-0 requirement, below). No new
  role, no platform-admin flag, no bypass of `roleSatisfies`
  (`src/server/auth/tenant.ts:65`) — the gate is "your active organization is the curation
  workspace **and** you hold the admin role in it", decided server-side in every curation
  function.

#### Wave-0 foundations requirements, rolled up

Per `README.md`'s shared-file protocol, no stage below claims `src/server/db/schema.ts`,
`src/server/worker.ts`, `wrangler.jsonc`, `src/styles/tokens.css`, `src/components/ui/**` or
`src/routeTree.gen.ts`. Everything this plan needs from those files is stated under the relevant
stage heading and filed to `00-S1`'s register in `00-foundations.md`, for the wave before the
stage that consumes it:

| Requirement                                                                                                                                                                                                                    | Stated under          | Needed before |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------- |
| Tables `community_trips`, `community_suggestions`, `community_saved_trips` (+ enums)                                                                                                                                           | `13-S1`, `13-S4` Data | wave 3        |
| Quota metric `community_trips` in `USAGE_METRICS`, `PLAN_QUOTAS`, `resolveLimits()`, plus the case in `src/server/billing/__tests__/limits.test.ts`                                                                            | `13-S1` Quota         | wave 3        |
| `wrangler.jsonc` var `COMMUNITY_REVIEW_ORG_ID` (+ `pnpm cf-typegen` regeneration)                                                                                                                                              | `13-S2` Server        | wave 4        |
| Tokens: **none** — the existing palette, spacing, radius, shadow and motion tokens cover every surface below                                                                                                                   | `13-S3` UI            | —             |
| Primitives: **none** — every screen composes shipped `src/components/ui` primitives                                                                                                                                            | each stage's UI       | —             |
| `TRIP_ENTITY_KINDS`: **no extension** — nothing here is realtime; the gallery and the thread are request/response with router invalidation, inside the existing `TripRoom` protocol untouched (`src/server/do/protocol.ts:50`) | each stage's Server   | —             |
| Bindings: **none** — `DB`, `KV`, `FILES`, `TASKS` already exist and suffice                                                                                                                                                    | each stage's Server   | —             |

#### The stages, in wave order

| Stage   | Wave | What it ships                                                      |
| ------- | ---- | ------------------------------------------------------------------ |
| `13-S1` | 3    | The publication pipeline: repository, snapshot, dialog (unmounted) |
| `13-S2` | 4    | Curation, the release path to KV, verdicts, and the dialog's mount |
| `13-S3` | 5    | The anonymous Gallery: browse and detail, the map, served from KV  |
| `13-S4` | 6    | Suggestions, saved trips, and "start planning from this trip"      |

The ordering is dependency-honest: `13-S2` edits the repository `13-S1` creates, `13-S3` renders
what `13-S2` releases, and `13-S4` decorates the screens `13-S3` builds. No two stages share a
wave, so the disjoint-ownership rule holds inside this plan trivially; the cross-plan story is
below.

#### Cross-plan collisions, measured against the sibling plans at HEAD

Checked with `node scripts/ultrabuild/check-plan-collisions.mjs` over the plan set as it stands,
plus a by-hand read of every sibling claim on each shared file. Every share this plan takes is
cross-wave, which is the documented cooperative pattern. Dispositions below are the checker's own
readings, not this plan's paraphrase:

| File this plan touches                                | This plan                                 | Other claimants (stage, wave, disposition)                                              |
| ----------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/server/queue/types.ts`                           | `13-S1` w3, `13-S4` w6 (edits)            | `00-S4` w0, `01-S1` w1, `07-S8` w4 (edits)                                              |
| `src/server/queue/consumer.ts`                        | `13-S1` w3, `13-S4` w6 (edits)            | `00-S4` w0, `01-S1` w1, `07-S8` w4 (edits)                                              |
| `src/routes/_app/trips/$tripId/collab.tsx`            | `13-S2` w4 (edit)                         | `07-S2` w1, `07-S6` w2, `07-S9` w3 (edits)                                              |
| `src/server/repos/index.ts`                           | `13-S1` w3 (append)                       | `06-S3` w2 (append), `06-S5` w3 (append), `01-S6` w4 (**edit**), `07-S10` w5 (**edit**) |
| `src/routes/_app/-server/shell.ts`                    | `13-S2` w4 (edit)                         | `02-S2` w1, `08-S10` w3 (edits)                                                         |
| `src/components/layout/user-menu.tsx`                 | `13-S2` w4 (edit)                         | `09-S6` w1 (edit)                                                                       |
| `src/components/marketing/chrome.tsx`                 | `13-S3` w5 (edit)                         | none — no sibling plan claims it                                                        |
| `src/lib/i18n/messages/en/settings.ts`                | `13-S2` w4 (append)                       | `09-S1` w1 (new), `09-S2`/`09-S3`/`09-S6` w1, `09-S7` w2, `09-S8` w3 (appends)          |
| `src/lib/i18n/messages/{en,<tag>}/trips.ts`           | `13-S1` w3 (mint), `13-S2` w4, `13-S4` w6 | none — no sibling plan names any `messages/*/trips.ts` file                             |
| `src/lib/i18n/messages/{en,<tag>}/marketing.ts`       | `13-S3` w5 (mint), `13-S4` w6             | none — no sibling plan names any `messages/*/marketing.ts` file                         |
| `src/server/repos/__tests__/tenant-isolation.test.ts` | appends                                   | appends everywhere — the documented cooperative file                                    |

`src/server/repos/index.ts` in wave 3 is an append beside `06-S5`'s wave-3 append — the
cooperative disposition, two added export lines that cannot contend in the one wave they share.
`01-S6` (wave 4) and `07-S10` (wave 5) take **edit** dispositions on that barrel, not appends —
exclusive claims, each alone in its wave, so the share stays legal cross-wave; the earlier reading
of "all appends" was this table's error, corrected against the checker. `collab.tsx` is plan 07's
file for three consecutive waves — `07-S2` recomposes the screen in wave 1, `07-S6` adds its
share trigger in wave 2, `07-S9` its widget in wave 3 — and one placement here was moved by this
very check: the publish trigger's edit cannot sit in wave 3 beside `07-S9`, so the trigger (and
the in-app mount of the publish dialog) belongs to `13-S2` in wave 4, and `13-S1` ships the
dialog as a built, tested, not-yet-mounted component. The catalogue rows carry a stated limit of
the tool: the 22 non-English entries are written with the `<tag>` placeholder, which the checker
matches as one literal path per namespace, so the sibling cross-check for those 44 real files is
the grep in the row — no sibling plan's Owned paths name any `messages/*/trips.ts` or
`messages/*/marketing.ts` path, in any locale including `en`.

Re-run at this round's HEAD after these corrections, the checker reports —

> no same-wave exclusive collisions

— and exits 0, over `plans 15 · stages 96 · owned paths 591`. Its one blind spot travels with the
quote: four stages (`11-S1`, `11-S2`, `11-S3`, `04-S2`) state no parseable wave and cannot be
checked. Measured one by one at this HEAD rather than recalled: `11-S1` owns exactly one path —
`docs/plans/11-boundaries-and-blockers.md` itself, stated in its Owned paths section as prose
rather than a bullet, which is why the checker's bullet regex parses it as zero — while `11-S2`
and `11-S3` name none; this plan never touches that document. The unparseable `04-S2` is not
plan 04's stage at all: it is the fenced example heading in
`docs/plans/12-verification-protocol.md` (the `Stage 04-S2 — Freeze the rate…` sample inside a
fenced `md` code block), which the fence-blind splitter reads as a stage, and that phantom chunk
parses zero owned paths. Plan 04's real `04-S2` states Wave 1, so it is fully checked and outside
the blind spot; for the record its fifteen parsed paths are not "all budget-module files this
plan never touches": the fifteenth is `e2e/__screenshots__/budget-and-currencies.visual.spec.ts/`
— that stage's baselines directory, an append this plan does not write — and the thirteenth is
`src/server/repos/__tests__/tenant-isolation.test.ts`, the documented cooperative file this plan
appends to as well, a shared append rather than an untouched file. The blind spot is therefore
empty for this plan. Everything
else this plan owns is newly created under paths no sibling names: `src/server/repos/community.ts`,
`src/server/fns/community.ts`, `src/server/community/`, `src/components/gallery/`,
`src/routes/gallery/`, `src/routes/_app/curation.tsx`, `src/routes/_app/-server/curation.ts`,
`src/server/queue/handlers/community-*.ts`, `e2e/community-gallery.visual.spec.ts`.

#### Where this plan's English copy lives

No new namespace — the ten of `docs/SPEC.md` §8 are a contract. The assignment, fixed here so no
stage re-decides it:

| Surface                                                        | Namespace   | Key prefix   |
| -------------------------------------------------------------- | ----------- | ------------ |
| Anonymous browse + detail, the gone state, suggestions reading | `marketing` | `gallery.*`  |
| Publish dialog, saved trips, materialise flow, notifications   | `trips`     | `gallery.*`  |
| Curation console                                               | `settings`  | `curation.*` |

The `trips` and `marketing` namespace files do not exist at HEAD **in any of the 23 locales** —
`src/lib/i18n/messages/<locale>/` holds exactly `atlas`, `auth`, `settings`, `shell` and `ui`
today — and no sibling plan claims any of them; so the first stage here that needs each file
mints it if it is still absent at execution time, and appends otherwise, for the English file and
its 22 siblings alike. `messages/en/settings.ts` is the different case: it exists at HEAD and is
plan 09's file first — minted by `09-S1` (wave 1, disposition `new`), appended by `09-S2`,
`09-S3` and `09-S6` in wave 1, `09-S7` in wave 2 and `09-S8` in wave 3 — so `13-S2`'s wave-4
append lands after every plan-09 claim, which is what makes it the cooperative disposition rather
than a contended one. And the parity suite is green at this HEAD, which turns the next sentence
from policy into a gate: a stage that adds an English key without its 22 translations goes red
the same run. Every stage ships
its keys in **all 23 locales** — the English source plus the 22 translations, each made from our
English per `docs/SPEC.md` §8.9 — and passes the parity suite
(`src/lib/i18n/__tests__/parity.test.ts`) before it closes. The 22 non-English tags are the fixed
set: `ar`, `ca`, `cs`, `de`, `el`, `es`, `fr`, `hu`, `id`, `it`, `ja`, `ko`, `nl`, `pl`, `pt-BR`,
`ru`, `sv`, `tr`, `uk`, `vi`, `zh-Hans`, `zh-Hant`.

## Stage 13-S1 — The publication pipeline: snapshot, review submission, idempotent re-share

### Stage id

`13-S1` · Wave 3 · effort **L**. The stage that mints the repository, the snapshot format and the
two background task kinds every later stage consumes.

### Reference rows

**No row of the 89-row reference matrix covers this scope.** The matrix predates the feature —
its row ids survive only where sibling plans quote them (the store behind them was never
committed; `docs/plans/README.md` records the loss), and none of the quoted ids names community
sharing; the scope is minted by this plan from the task brief. The `EXT-01`/`EXT-02`/`EXT-03`
boundary rows in `11-boundaries-and-blockers.md` remain excluded — the plugin runtime is not
ported, only the feature's value, per the hosted-equivalent doctrine.

Behaviour sourced from `wiki: Plugins`: a workspace shares one of its own trips to a public
gallery; sharing is admin-gated; a trip already shared shows its shared state instead of a second
share affordance; re-sharing the same trip updates the existing publication rather than minting a
duplicate. Described here in planned.travel's vocabulary; no text is carried across.

### Owned paths

- `src/server/repos/community.ts` — new. The publication repository: scoped writers, the
  gallery-space readers, the quota assertion.
- `src/server/repos/index.ts` — append. One export line beside the existing re-exports. Sibling
  claims, dispositions per the collision checker: `06-S3` (wave 2, append), `06-S5` (wave 3,
  append — the same-wave neighbour, cooperative beside this append), `01-S6` (wave 4, **edit**),
  `07-S10` (wave 5, **edit**). The two edits are exclusive claims in waves this stage is not in,
  so the share is the legal cross-wave pattern.
- `src/server/community/snapshot.ts` — new. The snapshot document type, its Zod schema, its
  version constant and the builder that assembles it from the repositories.
- `src/server/fns/community.ts` — new. `submitToGalleryFn`, `withdrawFromGalleryFn`,
  `loadGalleryPublicationFn`.
- `src/server/queue/types.ts` — edit. Adds the `community-snapshot` and `community-release` kinds
  and their payload schemas. **Shared across waves** with `00-S4` (wave 0), `01-S1` (wave 1) and
  `07-S8` (wave 4); this claim is wave 3 and contends with none of them.
- `src/server/queue/consumer.ts` — edit. Registers both handlers. Same cross-wave sharers as
  above.
- `src/server/queue/handlers/community-snapshot.ts` — new. Builds and stores the snapshot.
- `src/server/queue/handlers/community-release.ts` — new. The KV read-model writer (consumed in
  anger by `13-S2`; written here so kind and handler land together).
- `src/components/gallery/publish-dialog.tsx` — new. The publish/re-share/withdraw dialog.
- `src/components/gallery/publication-status.ts` — new. The status model shared by dialog and
  (later) curation copy.
- `src/lib/i18n/messages/en/trips.ts` — new if absent at execution time, append otherwise. The
  `gallery.*` keys of this stage.
- `src/lib/i18n/messages/<tag>/trips.ts` — new if absent at execution time, append otherwise,
  for each of the 22 non-English tags fixed in the area brief (`ar` … `zh-Hant`): the same keys,
  translated from our English. None of these files exists at HEAD, so the mint convention applies
  to them exactly as it does to the `en` file above.
- `src/server/repos/__tests__/community.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `src/server/community/__tests__/snapshot.test.ts` — new.
- `src/components/gallery/__tests__/publish-dialog.test.tsx` — new.

No route file is added, so `pnpm generate-routes` is not run by this stage. **No route mounts the
dialog yet, deliberately**: the natural trigger location,
`src/routes/_app/trips/$tripId/collab.tsx`, is held in this same wave by `07-S9`
(`07-collaboration-and-sharing.md`), so the mount and the trigger are `13-S2`'s wave-4 claim —
the collision the area brief's check moved. This stage is therefore a server-and-library stage:
per `docs/SPEC.md` §8's judgement rule, it is judged on code, tests and its stated contract, and
the screen-level judgement of the dialog lands with `13-S2`, which mounts it.

### Data and migration

All schema work is a **wave-0 foundations requirement** filed to `00-S1`'s register for the wave-2
schema stage, so it lands before this wave-3 stage opens. `src/server/db/schema.ts` is not an
owned path and is never edited here. The requirement, in full:

**Table `community_trips`** — one row per (workspace, trip) publication. Following the module's
conventions: `id` from `newId()` (`src/server/db/schema.ts:52`), `organization_id` via `orgRef()`,
timestamps via `timestamps()`.

| Column              | Type                       | Null | Notes                                                                                                                                            |
| ------------------- | -------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                | text pk                    | no   | `newId()`                                                                                                                                        |
| `organization_id`   | text                       | no   | the publisher workspace                                                                                                                          |
| `trip_id`           | text → `trips.id`, cascade | no   | the source trip                                                                                                                                  |
| `status`            | text, CHECK                | no   | `'in_review' \| 'changes_requested' \| 'published' \| 'withdrawn'`, default `'in_review'` — new const `COMMUNITY_TRIP_STATUSES` beside the table |
| `slug`              | text                       | yes  | minted at first approval; null until then                                                                                                        |
| `public_title`      | text                       | no   |                                                                                                                                                  |
| `summary`           | text                       | no   |                                                                                                                                                  |
| `attribution`       | text                       | no   | display name chosen at submit                                                                                                                    |
| `show_dates`        | integer boolean            | no   | default 0                                                                                                                                        |
| `version`           | integer                    | no   | default 1; incremented on every re-share                                                                                                         |
| `published_version` | integer                    | yes  | the version currently live; null before first approval                                                                                           |
| `snapshot_key`      | text                       | yes  | R2 key of the version under review; null until built                                                                                             |
| `day_count`         | integer                    | no   | default 0; stamped by the snapshot builder                                                                                                       |
| `place_count`       | integer                    | no   | default 0; stamped by the snapshot builder                                                                                                       |
| `submitted_by`      | text (`userRef`)           | no   |                                                                                                                                                  |
| `submitted_at`      | integer timestamp_ms       | no   |                                                                                                                                                  |
| `reviewed_by`       | text (`userRef`)           | yes  |                                                                                                                                                  |
| `reviewed_at`       | integer timestamp_ms       | yes  |                                                                                                                                                  |
| `review_note`       | text                       | yes  | the curator's note on `changes_requested`                                                                                                        |
| `published_at`      | integer timestamp_ms       | yes  |                                                                                                                                                  |

Indexes: `uniqueIndex('community_trips_org_trip_unq').on(organization_id, trip_id)` — **this is
the idempotent re-share**, one publication row per trip, ever; `uniqueIndex` on `slug` (SQLite
unique indexes admit multiple nulls, so pre-approval rows coexist);
`index('community_trips_org_status_idx').on(organization_id, status)` for the tenant-side reads,
`organization_id` leading; and `index('community_trips_status_submitted_idx').on(status,
submitted_at)` for the gallery-space curation queue — deliberately **not** org-led, because the
queue is the argued cross-tenant read and filters on status alone. Non-negative CHECKs on
`version`, `day_count`, `place_count` via the module's `nonNegativeCheck` helper.

The `community_suggestions` and `community_saved_trips` tables are `13-S4`'s data and are stated
there; filing them in the same wave-2 schema requirement is the register's call, not this stage's.

Migration: the wave-2 schema stage's own `pnpm db:generate` series names it (one migration for
all gallery tables); it backfills nothing — no row exists before this stage runs.

Dates inside the snapshot document follow the repo convention — `YYYY-MM-DD` text — and money does
not appear in it at all: costs are excluded from publication, which is also what keeps this plan
clear of the open FX-provider decision in `11-S3`.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/community.ts`.** Built on
  `createTenantRepository(communityTrips, 'gallery publication')`
  (`src/server/repos/base.ts:287`). Scoped functions: `getPublicationForTrip(scope, tripId)`,
  `submitPublication(scope, input)` — insert or, when the `(org, trip)` row exists, an update
  that bumps `version`, resets `status` to `'in_review'`, clears `review_note` and stamps
  `submitted_by`/`submitted_at`; on both paths it guards the live count with `assertQuota`
  exactly when the write moves the row into the live set, per this stage's **Quota** heading;
  `withdrawPublication(scope, publicationId)`;
  `markSnapshotBuilt(scope, publicationId, { snapshotKey, dayCount, placeCount })`. Every read is
  built on `tenantFilter()` (`base.ts:86`); `organization_id` is stamped, never accepted.
- **Gallery-space readers** (the argued unscoped family, named `*ForGallery`): none in this stage
  beyond `getPublicationRecordForRelease(db, publicationId)`, used by the release handler, which
  returns the row regardless of tenant because a queue handler has no session — the precedent is
  the share-link resolver argued in `07-S6`. It never returns snapshot content.
- **Snapshot builder — `src/server/community/snapshot.ts`.** A pure assembly over existing
  repositories in the **publisher's own scope**: `requireTrip` + trip fields from
  `src/server/repos/trips.ts`, days from `listTripDays` in `src/server/repos/days.ts`, places
  from `listTripPlaces` (`src/server/repos/places.ts:111`), in-day order from
  `getTripItinerary` (`src/server/repos/itinerary.ts:195`). Output: a `CommunitySnapshot`
  document — `schemaVersion` (const `COMMUNITY_SNAPSHOT_VERSION = 1`), public title, summary,
  attribution, `showDates`, country codes, days `[{ index, date?, title?, places: [{ name,
category, lat?, lng?, order }] }]`, counts. Validated by `communitySnapshotSchema`
  (`z.strictObject`) on write **and** on read, so a corrupted object can never render. Traveller
  identities, notes, files, costs and reservations are not fields of the type — exclusion by
  construction, not by filtering.
- **Server functions — `src/server/fns/community.ts`.** Each starts at `appScope()`
  (`src/server/fns/context.ts:24`).
  - `submitToGalleryFn` — `createServerFn({ method: 'POST' })`, validator
    `z.strictObject({ tripId: idSchema, publicTitle: z.string().trim().min(1).max(120),
summary: z.string().trim().min(1).max(280), attribution:
z.string().trim().min(1).max(80), showDates: z.boolean() }, { error: … })`. Authorisation:
    the scope must hold the **admin** role — `roleSatisfies(scope.ctx.role, 'admin')`
    (`src/server/auth/tenant.ts:65`) — decided here, not in the UI; `requireTrip` re-resolves the
    trip inside the scope. Writes the row, then **enqueues** `community-snapshot`
    (`enqueueTask` from `src/server/queue/jobs.ts`, idempotency key
    `community-snapshot:<publicationId>:<version>`) — the walk over every day and place of a
    large trip is exactly the slow work `docs/ARCHITECTURE.md` §2.2 sends to `TASKS`, never
    inline. Returns the new publication state.
  - `withdrawFromGalleryFn` — POST, `z.strictObject({ publicationId: idSchema })`, admin-gated
    the same way; sets `status = 'withdrawn'` and enqueues `community-release` with action
    `'retract'` so the KV read model is cleared by the handler (KV holds nothing for a
    never-published row, and the handler is a no-op then — idempotent either way).
  - `loadGalleryPublicationFn` — GET, `z.strictObject({ tripId: idSchema })`; returns the
    publication row (or null) for the dialog. **Reads D1, not KV** — this is the publisher's
    read-your-own-write surface (`docs/ARCHITECTURE.md` §4 rule 2).
- **Queue — `src/server/queue/handlers/community-snapshot.ts`.** Payload
  `{ publicationId, version }`. Builds the scope from the publication row via `createScope`
  (`src/server/repos/base.ts:51`), runs the builder, `put`s the document to `FILES` under
  `gallery/<publicationId>/v<version>.json` — a **versioned, immutable key, never overwritten**
  (`docs/ARCHITECTURE.md` §4 rule 3: publish new keys, repoint) — then `markSnapshotBuilt`. A
  redelivery re-puts identical bytes under the same key: harmless, idempotent.
- **`community-release`** — payload `{ publicationId, action: 'publish' | 'retract' }`; written
  here so the kind and handler land together, exercised by `13-S2`, which owns the approval flow
  and the KV document shapes. This stage's handler for `'publish'` is complete but unreachable
  until `13-S2` calls it.
- **Realtime: none.** No `TRIP_ENTITY_KINDS` extension, no room traffic —
  `src/server/do/protocol.ts:50` is untouched. Publication state changes reach the dialog by
  router invalidation.

### UI (route, components)

- **Route.** None added, and none edited — the natural trigger location, the Collab tab, is
  `07-S9`'s wave-3 file, so the trigger and the mount are `13-S2`'s wave-4 work. This stage
  builds the dialog finished — every face, every state, keyboard, both themes — as a component
  with a props contract (`publication`, `onSubmit`, `onWithdraw`, pending flags) so `13-S2`'s
  mount is one element, not a design pass.
- **Components.** `src/components/gallery/publish-dialog.tsx`, composed from shipped primitives
  only: `Dialog`, `Button`, `Input`, `Textarea`, `Switch`, `Badge`, `Alert`, `SectionLabel`,
  `Skeleton`, `Spinner`, `Separator` from `src/components/ui`. No primitive is added.
- **The dialog's five faces**, driven by `publication-status.ts`:
  1. **Never shared** — a short pitch of what publication means, the exact inclusion/exclusion
     list rendered as two labelled groups (what goes public, what never does), the public title
     (pre-filled from the trip), summary, attribution and show-dates fields, and a primary
     "Submit for curation" button with a loading state.
  2. **In review** — a `Badge` tone `info` with the submitted-at date, the submitted summary
     read-only, and a quiet withdraw affordance.
  3. **Changes requested** — an `Alert` tone `warning` carrying the curator's note verbatim, the
     form re-opened with previous values, and "Submit again" — the same idempotent submission.
  4. **Published** — `Badge` tone `success`, the public link (`/gallery/<slug>`) with a copy
     control and confirmed state, the live version number in `tabular-nums`, and two secondary
     actions: "Publish an update" (re-share: same row, next version, back through curation while
     the previous version **stays live** until the new one is approved) and "Withdraw" behind a
     confirm step that says exactly what withdrawal does and does not do — new readers stop,
     saved copies persist.
  5. **Withdrawn** — a neutral statement of the state with "Publish again" re-entering review.
- **States.** The dialog's loader (publication row) has a skeleton — three text-row bones inside
  the dialog body; its error state is an `Alert` tone `danger` with a retry that re-runs
  `loadGalleryPublicationFn`; submit/withdraw buttons carry loading and disabled states; the
  component exposes a `canPublish` prop so `13-S2`'s trigger can render the non-admin case as a
  disabled control with a `Tooltip` explaining that publishing is a workspace-admin action. No
  list on this surface, so no empty state beyond face 1, which is the designed "nothing yet" of
  the feature.
- **Tokens.** None missing. `--color-surface-2` for the inclusion/exclusion groups, semantic
  `success`/`warning`/`info` pairs for the status faces, `--radius-lg`, `--space-4`/`--space-6`
  rhythm, `tabular-nums` on the version number and dates. Motion: dialog enter 220ms on
  `--ease-out-quint`, exit 150ms, `prefers-reduced-motion: reduce` collapses to opacity — all via
  the shipped `Dialog`.
- **Copy.** `trips` namespace, `gallery.publish.*` keys, per the area brief's assignment table.

### Quota

This stage creates a countable row and the metric **does not yet exist**:

- **Metric: `community_trips`** — live publications per workspace, where live means
  `status != 'withdrawn'`. It exists today in neither `resolveLimits()`
  (`src/server/billing/limits.ts:216`) nor `PLAN_QUOTAS` (`src/server/db/types.ts:41`) nor
  `USAGE_METRICS` (`src/server/db/schema.ts:137-146`). Its addition — the `USAGE_METRICS` entry,
  the `PLAN_QUOTAS` numbers per tier, the `METRIC_FOR_QUOTA` pairing
  (`src/server/billing/limits.ts:75`) and **the case in
  `src/server/billing/__tests__/limits.test.ts`** — is routed to wave-0 foundations via `00-S1`'s
  register, before this wave-3 stage opens. The published number is the enforced number.
- **Call site:** inside the repository, before the write — `submitPublication` in
  `src/server/repos/community.ts` calls
  `assertQuota(scope, 'community_trips', await communityTripsRepository.count(scope, /* live statuses */))`
  (`assertQuota` at `src/server/repos/base.ts:430`) **whenever the write moves the row into the
  live set** — that is, when no `(org, trip)` row exists (the insert path) **and** when the
  existing row's `status` is `'withdrawn'` (the update path behind face 5's "Publish again",
  which re-enters review and re-joins the live count). The guard and the metric share one
  definition of live: the row being written is not in the pre-write count in either case, so the
  same call with the same live count is correct on both paths. When the existing row is already
  live (`in_review`, `changes_requested`, `published`), a re-share bumps `version` and consumes
  nothing — the row is already counted; the metric counts publications, not versions. The count
  is read live, never cached (`docs/ARCHITECTURE.md` §4 rule 1).
- R2 snapshot objects ride the publisher's existing `storage_bytes` accounting the same way other
  `FILES` writes do; object first, assert second, compensating delete on throw, mirroring
  `src/server/repos/files.ts`.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, one `describe` block, in A's
scope against B's rows: `getPublicationForTrip` with B's trip id — `NotFoundError` (via
`requireTrip`); `submitPublication` naming B's trip id — `NotFoundError`, and B's
`community_trips` rows unchanged; `withdrawPublication` with B's publication id —
`NotFoundError`, B's row byte-identical afterwards; `markSnapshotBuilt` with B's publication id —
`NotFoundError`. Functions covered: `getPublicationForTrip`, `submitPublication`,
`withdrawPublication`, `markSnapshotBuilt`.

`src/server/repos/__tests__/community.test.ts` additionally holds the non-tenant invariants: the
unique `(org, trip)` re-share semantics (second submit bumps `version`, does not insert); the
quota assertion firing on the insert path **and** on a withdrawn→`in_review` resubmission, and
not firing when an already-live row is resubmitted; a workspace at its `community_trips` ceiling
being refused when it republishes a withdrawn row (the transition that would otherwise raise the
live count past the limit); and `getPublicationRecordForRelease` returning no snapshot content.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests as named above, plus `src/server/community/__tests__/snapshot.test.ts` holding: the
  snapshot of a seeded trip contains no traveller name, no note body, no file key and no amount
  (asserted over `JSON.stringify` of the document); `showDates: false` strips every `date` field;
  the schema round-trips and rejects an unknown key.
- i18n: every `gallery.publish.*` key lands in `en` **and all 22 sibling `trips.ts` catalogues**
  in this stage; `src/lib/i18n/__tests__/parity.test.ts` passes with zero new failures. That
  budget — 23 catalogues per key — is part of this stage, not a follow-up.
- Component tests: `src/components/gallery/__tests__/publish-dialog.test.tsx` renders every face
  in jsdom and holds the state transitions, the disabled/pending logic and the accessible names.
- Browser evidence per `12-verification-protocol.md`, honest about what exists in this wave: no
  route mounts the dialog yet, so there is no in-app frame to take and this stage manufactures
  none (`docs/SPEC.md` §8 — a library item never manufactures a route to become photographable).
  The dialog is still looked at in a real browser through the scratchpad SSR-harness recipe
  (build the component against the built stylesheet, screenshot the `file://` page in
  Playwright): faces 1–5 at **360px and 2560px**, both themes, plus focus-visible and
  reduced-motion readings. No committed baseline is recorded from the harness. The in-app
  frames, the trigger, and this plan's `e2e/community-gallery.visual.spec.ts` blocks for the
  dialog all land with `13-S2`, which owns the mount — stated there under its Verification.
- A repo-gate Playwright pass still runs for regression cover:
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test` must stay green — this
  stage adds server code and a component nothing mounts, so any red here is a break this stage
  caused elsewhere.
- Console silent in the harness in both themes; a warning is this stage's bug.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active, disabled and loading on every field, the switch, submit,
      withdraw and the copy control (the trigger is `13-S2`'s, ticked there).
- [ ] The dialog's five faces all designed; skeleton and error states on the dialog's loader.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity, dark shadows re-declared rather than reused.
- [ ] 360px → 2560px, with the dialog a full-height sheet-like layout at 360.
- [ ] Keyboard reachable end to end, focus trapped in the dialog, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **Wave-0 prerequisites**: the `community_trips` table and the `community_trips` quota metric,
  filed above to `00-S1`'s register. This stage cannot start until that wave-2 schema stage
  lands.
- **`07-S9`** (`07-collaboration-and-sharing.md`, wave 3) holds `collab.tsx` this wave, which is
  why the dialog's mount and trigger are `13-S2`'s — a constraint recorded in the area brief's
  collision table, not a dependency of this stage's own work.
- No package is required — the snapshot is plain JSON assembled in the Worker; the digest-free
  design needs no crypto. No binding is required beyond the existing `DB`, `FILES`, `TASKS`.

## Stage 13-S2 — Curation: the review queue, the verdicts and the release to KV

### Stage id

`13-S2` · Wave 4 · effort **L**. The human gate between a submission and the public internet, the
stage that writes the anonymous read model — and the stage that mounts `13-S1`'s publish dialog,
because the Collab tab was wave-3-contended (area brief, collision table).

### Reference rows

**No row of the 89-row reference matrix covers this scope** — the matrix predates it, and its
row ids survive only where sibling plans quote them; the scope is minted by this plan from the
task brief. `EXT-01`/`EXT-02`/`EXT-03` in `11-boundaries-and-blockers.md`
remain excluded: the reference's review mechanism (a pull request reviewed on an external code
host) is precisely the machinery this plan replaces with a first-party queue, per the
hosted-equivalent doctrine.

Behaviour sourced from `wiki: Plugins`: submissions are reviewed by a human before appearing;
a rejected submission returns to its author with a reason; an approved one becomes publicly
listed. Everything else on this surface — the queue screen, the verdict vocabulary, the release
mechanics — is our own design.

### Owned paths

- `src/routes/_app/curation.tsx` — new. The curation console route. **A new route file, so this
  stage runs `pnpm generate-routes`**; the regenerated tree travels in the diff and is never
  hand-edited or listed here.
- `src/routes/_app/-server/curation.ts` — new. Loader and verdict server functions, following the
  `-server/administration.ts` precedent from `10-S1`.
- `src/components/gallery/curation-screen.tsx` — new. The queue and the review panel.
- `src/server/repos/community.ts` — edit. The verdict writers and the queue readers. Created by
  `13-S1` in wave 3; `13-S4` edits it again in wave 6 — cross-wave, no contention.
- `src/server/community/read-model.ts` — new. The KV document shapes (`GalleryIndex`,
  `GalleryTripPayload`), their Zod schemas, their key helpers and the render functions the
  release handler calls.
- `src/server/queue/handlers/community-release.ts` — edit. Created by `13-S1` in wave 3; this
  stage completes the `'publish'` action against the read-model module and adds slug minting.
- `src/routes/_app/-server/shell.ts` — edit. `ShellPayload` gains `isCurator`, derived
  server-side beside `isAdmin` (`src/routes/_app/-server/shell.ts:149`) as "active organization
  is `COMMUNITY_REVIEW_ORG_ID` **and** `roleSatisfies(role, 'admin')`". **Shared across waves**
  with `02-S2` (wave 1) and `08-S10` (wave 3); this claim is wave 4.
- `src/components/layout/user-menu.tsx` — edit. One `MenuItem` linking `/curation`, rendered only
  when `isCurator`, beside the admin entry at `user-menu.tsx:98`. **Shared across waves** with
  `09-S6` (wave 1).
- `src/routes/_app/trips/$tripId/collab.tsx` — edit. Mounts `13-S1`'s publish dialog and its
  "Publish to the Gallery" trigger beside the share-link trigger `07-S6` (wave 2) placed there,
  because "share with a link" and "share with the world" are one mental shelf. The trigger
  carries `data-part="gallery-publish-trigger"` for the capture harness. **Shared across waves**
  with `07-S2` (wave 1, the recomposition that owns the screen's shape), `07-S6` (wave 2) and
  `07-S9` (wave 3) — the file is plan 07's for three consecutive waves; this claim is wave 4,
  alone in it, which the collision checker confirms: its run at this HEAD reports
  `no same-wave exclusive collisions` and exits 0.
- `src/lib/i18n/messages/en/settings.ts` — append. The `curation.*` keys and nothing else.
  Plan 09's file first: minted by `09-S1` (wave 1, `new`), appended by `09-S2`/`09-S3`/`09-S6`
  (wave 1), `09-S7` (wave 2) and `09-S8` (wave 3); this wave-4 append lands after all of them.
- `src/lib/i18n/messages/<tag>/settings.ts` — append, for each of the 22 non-English tags fixed
  in the area brief: the same keys, translated from our English.
- `src/lib/i18n/messages/en/trips.ts` — append. The two verdict notification key pairs.
- `src/lib/i18n/messages/<tag>/trips.ts` — append, all 22 tags, the same two pairs.
- `src/server/repos/__tests__/community.test.ts` — append. The verdict and release invariants.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `src/server/community/__tests__/read-model.test.ts` — new.
- `e2e/community-gallery.visual.spec.ts` — new. This plan's spec file, minted here — the first
  stage with a mounted screen; later stages append their own `test.describe` blocks.
- `e2e/__screenshots__/community-gallery.visual.spec.ts/` — new. This stage's baselines only.

### Data and migration

**No new table and no new column.** Every verdict is an update of `community_trips` columns
`13-S1`'s wave-0 requirement already specified (`status`, `reviewed_by`, `reviewed_at`,
`review_note`, `published_at`, `published_version`, `slug`).

One non-schema foundations requirement, filed to `00-S1`'s register for the wave before this
stage: **`wrangler.jsonc` gains the var `COMMUNITY_REVIEW_ORG_ID`** — the organization id of the
designated curation workspace — followed by `pnpm cf-typegen` so `worker-configuration.d.ts`
carries the type. It is configuration, not a secret: an organization id grants nothing by itself,
because every curation function still demands an admin session **in** that workspace. Locally,
`.dev.vars` points it at the seeded demo workspace so the console is exercisable.

Slugs are data minted here: kebab-case of the public title, ASCII-folded, truncated to 48
characters, suffixed with the first 6 characters of the publication id — collision-free by
construction, stable across re-publications (the slug is minted once, at first approval, and
never changes; the unique index was specified in `13-S1`).

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/community.ts` gains:**
  - `listCurationQueueForGallery(db, { status })` — a gallery-space reader (argued in the area
    brief): the queue is by definition cross-tenant, filters on
    `community_trips_status_submitted_idx`, oldest first, and returns row metadata plus the
    publisher workspace's display name — never snapshot content, which the panel loads
    separately from R2 by key.
  - `recordVerdict(db, publicationId, verdict)` — gallery-space writer used only by the two
    verdict functions below; sets the review columns in one statement, and on approval stamps
    `published_version = version`, `published_at`, and the slug if null.
- **Server functions — `src/routes/_app/-server/curation.ts`.** Every one begins with the same
  two-line gate, decided server-side per call: `appScope()`
  (`src/server/fns/context.ts:24`), then reject unless
  `scope.ctx.organizationId === env.COMMUNITY_REVIEW_ORG_ID` (via `env` from
  `cloudflare:workers`, the import pattern at `src/server/fns/context.ts:11`) **and**
  `roleSatisfies(scope.ctx.role, 'admin')` (`src/server/auth/tenant.ts:65`). A server function is
  a public endpoint; `beforeLoad` is UX, never the boundary.
  - `loadCurationQueue` — GET, no input. Returns the `in_review` list plus decided-this-month
    counts. Reads D1 — curation is a read-your-own-write surface.
  - `loadCurationDetail` — GET, `z.strictObject({ publicationId: idSchema })`. Returns the row
    and the snapshot document fetched from `FILES` by `snapshot_key` and re-validated through
    `communitySnapshotSchema` — the read-side validation is what makes a hand-edited R2 object
    inert.
  - `approveSubmissionFn` — POST, `z.strictObject({ publicationId: idSchema })`. Records the
    verdict, then **enqueues** `community-release` `{ publicationId, action: 'publish' }`
    (idempotency key `community-release:<publicationId>:<version>`) — rendering and writing the
    public documents is the slow work and runs on `TASKS`, never inline. Then notifies (below).
  - `declineSubmissionFn` — POST,
    `z.strictObject({ publicationId: idSchema, note: z.string().trim().min(1).max(500) })` with
    the `error` parameter naming the note as required — a decline without a reason is not a
    verdict. Sets `changes_requested`, notifies.
  - `takedownPublicationFn` — POST, `z.strictObject({ publicationId: idSchema, note: … })`. The
    hard remove for policy violations: sets `withdrawn`, enqueues `community-release` with
    action `'retract'`, and additionally enqueues deletion of the R2 snapshot objects and the
    saved-trip references (`13-S4`'s table) — the one path that reaches into saved copies,
    because a takedown that leaves the content in circulation is not a takedown.
- **Notifications.** The verdict functions build the **publisher-org scope from the publication
  row** — `createScope(getDb(), { organizationId: row.organizationId, userId: row.submittedBy,
role: 'member' })` (`src/server/repos/base.ts:51`), the row-derived-scope pattern the
  share-link resolver established — and call `notifyMany`
  (`src/server/repos/notifications.ts:135`) to the publisher workspace's admins (from
  `listMembers`, `src/server/repos/members.ts:99`, filtered by role) with key pairs
  `gallery.notifications.approved` / `gallery.notifications.changesRequested` in the `trips`
  namespace plus params (trip title, slug). Keys, never sentences (`notifications.ts:46-48`), so
  the verdict renders in each reader's language.
- **The read model — `src/server/community/read-model.ts`.** Two KV documents, both written by
  the release handler, both validated on write:
  - `gallery:v1:index` — the browse index: an array ordered `published_at` descending of
    `{ slug, title, summary, attribution, dayCount, placeCount, countryCodes, publishedAt }`.
    At first-release scale this is one small document (a few hundred bytes per entry against
    KV's 25 MiB value ceiling); the named scaling lever is sharding the index by page, a key
    scheme change behind one helper, pulled when the entry count nears four digits.
  - `gallery:v1:trip:<slug>` — the full detail payload: the snapshot document plus attribution
    and `publishedAt`.
  - **Invalidation is on the write path**: `'publish'` writes the trip document then rewrites
    the index in the same handler run; `'retract'` deletes the trip document then rewrites the
    index. No TTL is load-bearing — the keys are correct because every state change rewrites
    them (`docs/ARCHITECTURE.md` §4 rule 2), and the handler is idempotent because it renders
    from D1 + R2 state, not from deltas.
- **Realtime: none.** No `TRIP_ENTITY_KINDS` change; the queue refreshes by router invalidation.

### UI (route, components)

- **Route.** `/curation`, SSR default, inside `_app` so the authenticated shell guards it; the
  loader additionally returns the locked state for a non-curator (the same pattern the admin
  console uses rather than a redirect), so the URL is shareable inside the operations workspace
  without ever leaking a queue to a non-curator — the data never leaves the server for one.
- **The publish trigger and mount.** On the Collab tab, beside `07-S6`'s share trigger: a
  secondary `Button` opening `13-S1`'s finished dialog, wired to `loadGalleryPublicationFn`,
  `submitToGalleryFn` and `withdrawFromGalleryFn`. A non-admin member gets the disabled trigger
  with its explanatory `Tooltip` via the dialog's `canPublish` contract. This is a mount, not a
  design pass — the dialog's states were built and verified in `13-S1`.
- **Components.** `curation-screen.tsx` composed from `Card`, `Table`, `Badge`, `SectionLabel`,
  `Button`, `Textarea` (the decline note), `Dialog` (the decline and takedown confirms),
  `EmptyState`, `Skeleton`, `Alert`, `Separator`, `Tooltip` — all shipped primitives. The review
  panel renders the snapshot as a structured itinerary read-out — day chips, place rows with
  coordinate presence marked, the exact public title/summary/attribution — deliberately **not**
  the public page's own components, which do not exist until `13-S3`; what a curator needs is
  the content, and the full-fidelity public preview link is added by `13-S3` once the public
  route exists.
- **States.**
  - Queue **empty**: `EmptyState` on `--color-surface-2` — copy "The queue is clear" with the
    line "New submissions from every workspace land here for review", illustration: the
    module's inline-SVG stamped-passport motif (drawn for this screen, our own art).
  - Queue **skeleton**: six table-row bones with a leading badge bone.
  - Queue **error**: `Alert` tone `danger` with a retry re-running the loader.
  - Review panel: skeleton (title bone + day-list bones), error with retry, verdict buttons with
    loading and disabled states; decline confirm disables its submit until the note is non-empty.
  - **Locked** (non-curator who somehow holds the URL): the explanatory locked panel, no data.
- **Tokens.** None missing. Status colours from the semantic `info`/`warning`/`success`/`danger`
  pairs; counts in `tabular-nums`; `--space-6` section rhythm. Motion: row hover is a background
  step; panel transitions 220ms `--ease-out-quint`, opacity+transform, reduced-motion honoured.
- **Copy.** `settings` namespace, `curation.*` keys — the same namespace the admin console
  renders from, per the area brief's table.

### Quota

**This stage creates no countable row** — every write is a status transition on a row `13-S1`
already counted, and KV documents are a read model, not a metered resource; so nothing is added
to `resolveLimits()` or `PLAN_QUOTAS` and no `assertQuota` call is added.

### Tenant isolation test

Appended block, in A's scope (A not the curation workspace): every function in
`src/routes/_app/-server/curation.ts` refuses A's admin — the gate is org identity, not role
alone — and `recordVerdict` is unreachable through any scoped repository path. In the curation
workspace's scope: `loadCurationDetail` with a publication id that does not exist —
`NotFoundError`; approving twice is idempotent (second approval re-enqueues a release whose
render is byte-identical). And the standard cross-tenant sweep: B's publication ids passed to
A's scoped functions from `13-S1` still raise `NotFoundError`, B's rows untouched — re-asserted
here because this stage widened the repository. Functions covered:
`listCurationQueueForGallery`, `recordVerdict`, plus the gates of all five curation functions.

`read-model.test.ts` holds: a render of seeded state produces an index ordered by
`published_at` descending; `'retract'` removes the trip key and the index entry in one run; a
handler re-run changes nothing (idempotency); no document ever contains a field outside its
schema.

### Verification

- Gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; `pnpm generate-routes` runs
  because a route file is added, and the regenerated tree is inspected in the diff.
- i18n: `curation.*` and the two notification pairs land in all 23 catalogues in this stage; the
  parity suite passes with zero new failures.
- Playwright: `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test -g '13-S2'`.
  Browser evidence at **360px and 2560px**, both themes: the queue with seeded submissions, the
  queue's empty state (seed cleared through the route's own test hooks), the review panel, the
  decline dialog with its note validation state, and the locked state under a non-curator
  session. Frames via `scripts/visual/capture.mjs` under
  `.claude/ultrabuild/shots/<slug>/round-<n>/13-S2/`. The verdict buttons' loading states are
  photographed with a delayed `page.route` on the serverFn URL.
- The mounted publish dialog — the in-app evidence `13-S1` deferred here: the Collab tab with
  the trigger, then the dialog in faces 1, 2 and 4 (face 2 by submitting against the seeded
  trip; face 4 by approving it through this stage's own queue), reached with
  `scripts/visual/capture.mjs --click '[data-part="gallery-publish-trigger"]'`, at 360px
  and 2560px in both themes; the submit button's loading state via a delayed `page.route`,
  because the local round trip is otherwise too fast to photograph.
- The notification lands: a unit test on the verdict function asserts a `notifications` row per
  publisher admin with the right keys and params; the bell renders it through the existing
  pipeline, which `00-S2` owns and this stage only feeds.
- Console silent in both themes.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every row action, verdict button,
      the dialogs, and the newly mounted publish trigger.
- [ ] Queue empty, skeleton and error states designed; panel skeleton and error designed; locked
      state designed.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, reduced-motion
      honoured.
- [ ] Light and dark parity, dark shadows re-declared.
- [ ] 360px → 2560px; at 360 the queue is a card list, not a squeezed table.
- [ ] Keyboard end to end — the queue rows are real links, the verdicts reachable and confirmable
      without a pointer; WCAG 2.2 AA both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint.

### Blockers

- **`13-S1`** (wave 3) supplies the repository, the snapshot and both task kinds.
- **Wave-0 prerequisite**: the `COMMUNITY_REVIEW_ORG_ID` var, filed above; without it every
  curation gate fails closed, which is the correct failure mode but not a shippable stage.
- **`02-S2`** (`02-places-and-maps.md`, wave 1), **`08-S10`** (`08-product-modules.md`, wave 3)
  and **`09-S6`** (`09-account-and-settings.md`, wave 1) precede the cross-wave edits to
  `shell.ts` and `user-menu.tsx` this stage makes; **`07-S2`** (wave 1), **`07-S6`** (wave 2) and
  **`07-S9`** (wave 3) precede the `collab.tsx` edit that mounts the publish trigger beside their
  work; plan 09's six claims on `messages/en/settings.ts` (waves 1–3) precede this stage's
  append.
- No package, no new binding.

## Stage 13-S3 — The public Gallery: browse and detail, served from KV

### Stage id

`13-S3` · Wave 5 · effort **L**. The third and fourth unauthenticated surfaces in the product,
and the screens the blind critic will judge this feature by.

### Reference rows

**No row of the 89-row reference matrix covers this scope** — the matrix predates it, and its
row ids survive only where sibling plans quote them; the scope is minted by this plan from the
task brief. `EXT-01`/`EXT-02`/`EXT-03` in `11-boundaries-and-blockers.md`
remain excluded — only the browsing value crosses, none of the plugin machinery.

Behaviour sourced from `wiki: Plugins`: the browse page leads with the newest publication as a
hero and lists the rest as a searchable card grid with location, author and count facts; the
detail page shows the day-by-day itinerary beside an interactive map with a pin for every place
that carries coordinates. The visual weaknesses the reference product's own screens carry —
observed while studying `wiki: Plugins` and its neighbouring pages: cold grey cards, dead
horizontal space, no motion, no designed empty states — are the bar this stage is designed to
beat, with our own warmth, art and states.

### Owned paths

- `src/routes/gallery/index.tsx` — new. Browse. **New route files, so this stage runs
  `pnpm generate-routes`**; the tree travels in the diff, never hand-edited, never listed.
- `src/routes/gallery/$slug.tsx` — new. Detail.
- `src/routes/gallery/-server/gallery.ts` — new. The two anonymous loaders and the per-IP
  ceiling.
- `src/routes/gallery/-ui/browse-screen.tsx` — new. Hero, search, grid, states.
- `src/routes/gallery/-ui/detail-screen.tsx` — new. Itinerary, map, states. (The suggestions
  thread and the save affordance are `13-S4`'s edits to these files, one wave later.)
- `src/components/gallery/trip-art.tsx` — new. The generated cover art (below), shared by hero,
  cards and detail.
- `src/components/marketing/chrome.tsx` — edit. A "Gallery" entry in the marketing header nav
  and footer, linking `/gallery`. No sibling plan claims this file in any wave.
- `src/lib/i18n/messages/en/marketing.ts` — new if absent at execution time, append otherwise.
  The `gallery.*` keys of the anonymous surface.
- `src/lib/i18n/messages/<tag>/marketing.ts` — new if absent at execution time, append
  otherwise, for each of the 22 non-English tags fixed in the area brief: the same keys,
  translated from our English. None of these files exists at HEAD, so this stage mints them
  exactly as it mints the `en` file above.
- `src/components/gallery/__tests__/trip-art.test.tsx` — new.
- `src/routes/gallery/-server/__tests__/gallery.test.ts` — new.
- `e2e/community-gallery.visual.spec.ts` — append. This stage's `test.describe`.
- `e2e/__screenshots__/community-gallery.visual.spec.ts/` — this stage's own baselines only.

### Data and migration

**None.** This stage reads the two KV documents `13-S2` writes and touches no table, so there is
no migration to name and nothing to backfill, and it files nothing to `00-S1`'s register.

### Server (repo, server function, Zod)

- **The anonymous read path is KV-only, by construction.** Both loaders in
  `src/routes/gallery/-server/gallery.ts` read the `KV` binding and **import no repository** —
  the module's imports are the read-model schemas and the KV helpers, so the "D1 never in the
  anonymous critical path" rule (`docs/ARCHITECTURE.md` §4, `SPEC` §5) is checkable by reading
  one import list.
  - `loadGalleryIndex` — GET, no input. Returns the parsed `gallery:v1:index` document, schema-
    validated. A missing index (fresh deploy, KV eventual consistency) returns the empty shape —
    the browse page then renders its designed empty state; nothing throws and nothing falls back
    to D1.
  - `loadGalleryTrip` — GET, `z.strictObject({ slug: z.string().trim().min(1).max(64) })`.
    Returns the parsed `gallery:v1:trip:<slug>` document or null; null renders the designed gone
    state — one state for "never existed", "not yet released" and "withdrawn", exactly as the
    share-link viewer refuses to distinguish revoked from unknown.
  - Suggestions for the detail page are read from `gallery:v1:comments:<slug>` when present —
    the key `13-S4` starts writing; until then the loader returns the empty thread and the
    detail page renders the thread's empty state. Forward-compatible by shape, not by branching.
- **Rate limiting.** The gallery routes are unauthenticated data surfaces, so they carry the
  same per-IP token bucket in `KV` that `07-S6` specified for the share viewer: a named constant
  beside the code, a short-TTL counter key, 429 above the ceiling, covered by a unit test. An
  anonymous surface is the one place a tenant-free caller can drive our KV read bill; the bucket
  is the cap.
- **Zod.** The slug input above; both KV documents re-validated on read with their
  `read-model.ts` schemas so a stale or hand-written KV value renders the error state rather
  than corrupt HTML.
- **Authorisation.** None to decide — the surface is public by design and holds only published
  documents; the tenant question was answered at release time by `13-S2`. No session is read.
- Nothing slow, nothing enqueued. **Realtime: none**; `src/server/do/protocol.ts:50` untouched.

### UI (route, components)

- **Routes.** `/gallery` and `/gallery/$slug`, top-level outside `_app` so no auth guard runs —
  the `07-S6` precedent. SSR default, kept deliberately: both pages must render fully for a
  reader with no session and no JavaScript. Chrome is `SkipToContent`, `MarketingHeader`,
  `MarketingFooter` (`src/components/marketing/chrome.tsx:97,26,172`) — the product's public
  face, so a visitor lands somewhere that is unmistakably planned.travel.
- **Generated cover art — `trip-art.tsx`.** Every publication gets a deterministic, original
  cover drawn from its own data: an inline SVG plotting the snapshot's coordinate set as a
  brand-tinted route sketch — points scaled into the card, joined day by day, on a warm
  `--color-brand-subtle` wash with the day count as an oversized display numeral. No photo
  pipeline, no external image host, no egress; every card is distinct because every itinerary
  is. This is the deliberate answer to the reference's flat grey cards.
- **Browse.** A `SectionLabel` eyebrow, a display-type headline, then the **hero**: the newest
  publication full-width — art, title, summary, attribution, day/place counts as `StatCard`-style
  facts, one primary "Read the itinerary" affordance. Below, the **search field** (shipped
  `Input` with a leading search icon, filtering client-side over title, summary, attribution and
  country names — the whole index is already in the payload, so search costs zero requests) and
  the **card grid**: `Card` per publication with art, title, one-line summary, attribution and
  counts, 1 column at 360, 2 from `sm`, 3 from `lg`, 4 at `2xl`, capped to a measured max-width
  so 2560 is a composed spread, not a stretch. Cards are single `<a>` surfaces with hover lift
  (1px translate + shadow step) and a visible focus ring.
- **Detail.** A header band — art as a backdrop strip, title, attribution, published date,
  counts, country chips — then a two-column composition from `lg`: the **itinerary** left (day
  sections: day chip, optional date, place rows with category icon and name; `showDates` off
  renders "Day 1, Day 2…" only) and the **map** right, sticky within the viewport: `MapCanvas`
  over `/api/tiles/*` with a `PlaceMarker`-derived pin for **every coordinate-bearing place**,
  `FitBounds` to the pin set, `MapAttribution`, and `BasemapNotice` when no archive is
  published. At 360 the map renders as a fixed-ratio band above the itinerary — a designed
  small-screen order, not a squeeze. Selecting a place row flies the map to its pin; selecting
  a pin scrolls its row into view — request/response, no realtime.
- **States**, named per surface:
  - Browse **empty** (no publications yet): `EmptyState` on `--color-surface-2`, copy "The
    Gallery is waiting for its first trip", supporting line "Publish one of yours from a trip's
    Collab tab", illustration: the trip-art component in its zero-data variant — a dotted route
    to nowhere. No CTA button for anonymous visitors beyond sign-in, which the chrome carries.
  - Browse **no-results** (search miss): a quieter inline empty state naming the query, with a
    one-click clear.
  - Browse **skeleton**: hero bone + six card bones (art block, two text lines).
  - Browse **error** (KV unreachable / document invalid): full-surface `Alert` tone `danger`
    with a retry re-running the loader.
  - Detail **gone**: designed page — "This trip left the Gallery", one line, a link back to
    `/gallery`. One state for unknown, unreleased and withdrawn.
  - Detail **skeleton**: header bones, three day-section bones, a map-shaped `Skeleton`.
  - Detail **error**: `Alert` with retry.
  - Detail **no-coordinates** (a trip whose places carry none): the map column is replaced by a
    designed card explaining the itinerary has no mapped places yet — never an empty map.
  - Suggestions render `13-S4`'s thread; until it lands the loader's empty thread shows the
    thread's empty state — "No suggestions yet".
- **Tokens.** None missing — this is a stated wave-0 answer: canvas/surface pairs, brand and
  accent, `--radius-xl` cards, `--shadow-card` with its dark re-declaration, `--space-6`/
  `--space-8` rhythm, `tabular-nums` on every count and date. Motion: cards enter 220ms
  `--ease-out-quint` with a 6px rise, staggered 24ms, capped at eight; hero art path draws in
  once on load (`transform`/`opacity` only); `prefers-reduced-motion: reduce` collapses
  everything to opacity, including the map's fly-to, which becomes a jump.
- **Copy.** `marketing` namespace, `gallery.*` keys. RTL: the whole surface uses logical
  properties; the detail's two-column order mirrors under `ar`; directional affordances mirror.

### Quota

**This stage creates no countable row** — it is a read-only surface over the KV read model; no
metric, no `assertQuota`. The cost control on this surface is the per-IP bucket named under
**Server**, which caps what an anonymous caller can spend, and that is deliberately a ceiling
per caller, not a tenant quota.

### Tenant isolation test

**No repository function is added or changed by this stage**, so no case is added to
`src/server/repos/__tests__/tenant-isolation.test.ts` — stated per the template rather than
skipped silently. The isolation property this surface depends on — only released documents ever
reach KV — is `13-S2`'s release-path invariant and is held by its tests; this stage adds the
complementary guard in `src/routes/gallery/-server/__tests__/gallery.test.ts`: the loaders
import no repository module (asserted over the module graph), an invalid KV document renders the
error shape, a missing document renders empty/gone shapes, and the rate bucket refuses above its
ceiling.

### Verification

- Gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; `pnpm generate-routes` runs
  because two route files are added.
- i18n: every `gallery.*` marketing key lands in all 23 catalogues in this stage; parity passes.
- Playwright: `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test -g '13-S3'`,
  in a **fresh context without the cached session** — the strongest available assertion that the
  pages need no account. Seeded state: two released publications (one with coordinates and
  dates, one with neither) plus the empty state exercised against a cleared index.
- Browser evidence at **360px and 2560px**, both themes, per `12-verification-protocol.md`:
  browse with hero + grid, browse empty, browse no-results (via `--click` on the search field
  and typed query), detail with the map settled — the two-sided `[data-map-ready]` predicate
  (`src/components/map/map-canvas.tsx:756`), re-waited after every resize and theme change —
  detail gone state, detail no-coordinates state, and the card **hover** state captured
  explicitly (a resting frame is not evidence about a hover affordance). Frames via
  `scripts/visual/capture.mjs` under `.claude/ultrabuild/shots/<slug>/round-<n>/13-S3/`,
  captured **without** `--auth`.
- RTL: one detail frame under `ar` at 1440 confirming the mirrored composition.
- Console silent; the map route's tolerated rasteriser advisory is the single named exception,
  under the same rule the atlas suite applies.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible and active on every card, link, pin and the search field; loading on
      both loaders.
- [ ] Browse empty, no-results, skeleton and error; detail gone, skeleton, error and
      no-coordinates — all designed on token surfaces.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, stagger capped,
      reduced-motion honoured including the map fly-to.
- [ ] Light and dark parity — the map style follows the theme, dark shadows re-declared.
- [ ] 360px → 2560px, with the 360 order (art, facts, map band, itinerary) a designed layout and
      2560 held to a measure.
- [ ] Keyboard end to end: skip link, cards as real links, place rows and pins reachable, WCAG
      2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint — the art and map reserve
      their boxes before paint.

### Blockers

- **`13-S2`** (wave 4) supplies the release path; without released documents this stage can only
  photograph its empty states — which are still built first, not skipped.
- **Tile availability is a deployment state, not a blocker**: an absent `.pmtiles` archive
  renders `BasemapNotice` by design (`docs/ARCHITECTURE.md` §2.3), and the stage's
  no-coordinates state covers the content side.
- No package — the art is hand-drawn SVG, the search is an in-memory filter. No new binding.

## Stage 13-S4 — Suggestions, saved trips, and "start planning from this trip"

### Stage id

`13-S4` · Wave 6 · effort **L**. The conversational and import half of the Gallery: the thread
under every published trip, the saved copy in a visitor's own workspace, and the path from a
saved copy to a real, editable trip.

### Reference rows

**No row of the 89-row reference matrix covers this scope** — the matrix predates it, and its
row ids survive only where sibling plans quote them; the scope is minted by this plan from the
task brief. `EXT-01`/`EXT-02`/`EXT-03` in `11-boundaries-and-blockers.md`
remain excluded: the reference hosts its per-trip conversation on an external discussion-thread
service and its imports through the same third-party machinery; both are replaced first-party
here, per the hosted-equivalent doctrine.

Behaviour sourced from `wiki: Plugins`: a published trip carries a public conversation readable
by everyone and postable by signed-in members; importing pulls a trip into the visitor's own
space as a read-only copy; removing an import deletes only the local copy; re-import is
idempotent.

### Owned paths

- `src/server/repos/community.ts` — edit. The suggestion and saved-trip functions. Created by
  `13-S1` (wave 3), last edited by `13-S2` (wave 4); this claim is wave 6.
- `src/server/fns/community.ts` — edit. The suggestion, save and materialise functions beside
  `13-S1`'s publish functions — cross-wave, waves 3 → 6.
- `src/server/community/read-model.ts` — edit. The `gallery:v1:comments:<slug>` document shape
  and its writer. Created by `13-S2` (wave 4).
- `src/server/queue/types.ts` — edit. Adds the `community-materialise` kind and payload schema.
  **Shared across waves** with `00-S4` (wave 0), `01-S1` (wave 1), `13-S1` (wave 3), `07-S8`
  (wave 4); this claim is wave 6, alone in it.
- `src/server/queue/consumer.ts` — edit. Registers the handler. Same sharers, same wave-6 claim.
- `src/server/queue/handlers/community-materialise.ts` — new.
- `src/routes/gallery/-ui/detail-screen.tsx` — edit. Mounts the thread and the save affordance.
  Created by `13-S3` in wave 5 — cross-wave.
- `src/routes/gallery/-ui/browse-screen.tsx` — edit. The signed-in saved-trips rail. Same
  cross-wave note.
- `src/routes/gallery/-server/gallery.ts` — edit. The comments key joins the detail loader
  (KV-only, unchanged discipline). Created by `13-S3` in wave 5.
- `src/components/gallery/suggestions-thread.tsx` — new.
- `src/components/gallery/saved-rail.tsx` — new.
- `src/lib/i18n/messages/en/marketing.ts` — append. The thread's public-surface keys.
- `src/lib/i18n/messages/<tag>/marketing.ts` — append, all 22 non-English tags.
- `src/lib/i18n/messages/en/trips.ts` — append. The save/materialise keys.
- `src/lib/i18n/messages/<tag>/trips.ts` — append, all 22 non-English tags.
- `src/server/repos/__tests__/community.test.ts` — append.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `e2e/community-gallery.visual.spec.ts` — append. This stage's `test.describe`.
- `e2e/__screenshots__/community-gallery.visual.spec.ts/` — this stage's own baselines only.

No route file is added — the thread and the rail live on `13-S3`'s routes — so
`pnpm generate-routes` is not run.

### Data and migration

Two tables, **wave-0 foundations requirements** filed with `13-S1`'s to `00-S1`'s register (the
register decides which per-wave schema stage carries them; they must exist before this wave-6
stage, and landing them with `13-S1`'s table in one migration is the economical call):

**Table `community_suggestions`** — one row per posted suggestion.

| Column              | Type                                 | Null | Notes                                                                                             |
| ------------------- | ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------- |
| `id`                | text pk                              | no   | `newId()`                                                                                         |
| `organization_id`   | text                                 | no   | the **author's** workspace                                                                        |
| `community_trip_id` | text → `community_trips.id`, cascade | no   |                                                                                                   |
| `author_user_id`    | text (`userRef`)                     | no   |                                                                                                   |
| `author_name`       | text                                 | no   | display-name snapshot at post time                                                                |
| `body`              | text                                 | no   | bounded by Zod at 1000                                                                            |
| `status`            | text, CHECK                          | no   | `'visible' \| 'hidden' \| 'removed'`, default `'visible'` — const `COMMUNITY_SUGGESTION_STATUSES` |

Plus `timestamps()`. Indexes:
`index('community_suggestions_org_author_idx').on(organization_id, author_user_id)` — org-led,
for the author's scoped lifecycle — and
`index('community_suggestions_trip_status_idx').on(community_trip_id, status, created_at)` for
the gallery-space thread read, deliberately not org-led for the argued reason in the area brief.

**Table `community_saved_trips`** — one row per (workspace, publication) save.

| Column              | Type    | Null | Notes                                                                                                                      |
| ------------------- | ------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`                | text pk | no   | `newId()`                                                                                                                  |
| `organization_id`   | text    | no   | the **saver's** workspace                                                                                                  |
| `community_trip_id` | text    | no   | plain reference, **no FK** — a saved trip must survive the publication row's lifecycle; only a curator takedown removes it |
| `saved_version`     | integer | no   | pins the immutable snapshot version saved                                                                                  |
| `snapshot_key`      | text    | no   | the R2 key of that version                                                                                                 |
| `title`             | text    | no   | denormalised for the rail                                                                                                  |
| `created_trip_id`   | text    | yes  | set once materialised into a real trip                                                                                     |

Plus `timestamps()`. Indexes:
`uniqueIndex('community_saved_trips_org_pub_unq').on(organization_id, community_trip_id)` —
**idempotent save**, org-led — and a non-negative CHECK on `saved_version`.

Migration: named by the carrying schema stage's `pnpm db:generate`; backfills nothing.

### Server (repo, server function, Zod)

- **Repository — `src/server/repos/community.ts` gains:**
  - Scoped, author-side: `postSuggestion(scope, input)` (insert, author stamped from scope),
    `deleteOwnSuggestion(scope, suggestionId)` — the row must match the caller's
    `organization_id` **and** `author_user_id`, or `NotFoundError`; saved trips:
    `saveGalleryTrip(scope, input)` (insert-or-return under the unique index — idempotent),
    `removeSavedTrip(scope, savedTripId)`, `listSavedTrips(scope)`,
    `markSavedTripMaterialised(scope, savedTripId, tripId)`.
  - Gallery-space (argued, `*ForGallery`): `listSuggestionsForGallery(db, communityTripId)` —
    `status = 'visible'` only, oldest first, returns author name, body, timestamp and nothing
    else; `setSuggestionStatusForGallery(db, suggestionId, status)` — reachable only from the
    two moderation paths below, never exported through the barrel.
  - Moderation paths, authorised then delegated: `hideSuggestionAsPublisher(scope,
suggestionId)` — loads the suggestion's publication and requires it to belong to the
    caller's org with admin role (the publisher curates their own thread). A per-suggestion
    curator removal is **deliberately not built**: the curation module is `13-S2`'s ownership,
    a curator already holds `takedownPublicationFn` for the abuse cases that matter, and a
    finer-grained tool is deferred until real traffic argues for it. The publisher hide plus
    the takedown cover the abuse cases this stage can honestly test.
  - Every write invalidates on the write path: after a post, delete-own or hide, the same
    request re-renders `gallery:v1:comments:<slug>` through `read-model.ts` — a single KV put,
    fast, in-request, per `docs/ARCHITECTURE.md` §4 rule 2. The thread document caps at the 200
    most recent visible suggestions with a stated "older suggestions" count.
- **Server functions — `src/server/fns/community.ts` gains**, each starting at `appScope()`:
  - `postSuggestionFn` — POST, `z.strictObject({ communityTripId: idSchema, body:
z.string().trim().min(1).max(1000) }, { error: … })`. Any signed-in member of any workspace
    may post; the author's display name is resolved server-side. A per-user-per-trip KV cadence
    bucket (the `07-S6` bucket pattern, named constant, unit-tested) caps posting speed —
    Zod is shape, the bucket is abuse control.
  - `deleteOwnSuggestionFn`, `hideSuggestionFn` — POST, id inputs, authorisation exactly as the
    repository functions above decide it.
  - `saveGalleryTripFn` — POST, `z.strictObject({ slug: z.string().trim().min(1).max(64) })`.
    Resolves the slug through the gallery-space published-row reader; refuses to save an
    unpublished trip; writes the saved row pinning `published_version` and its `snapshot_key`.
    Saving your own publication is refused with a designed message — the copy is for visitors.
  - `removeSavedTripFn` — POST; deletes only the local row, exactly as promised on screen.
  - `materialiseSavedTripFn` — POST, `z.strictObject({ savedTripId: idSchema })`. Asserts the
    caller may create trips by running the existing quota path first (below), then **enqueues**
    `community-materialise` — a large itinerary is hundreds of inserts, which is queue work,
    never inline — and returns a pending marker the UI polls by router invalidation.
  - `loadSavedTripsFn` — GET; the signed-in rail's read, D1 through the scoped repository —
    an authenticated surface, so the KV-only rule of the anonymous loaders does not apply, and
    read-your-own-write correctness does.
- **Queue — `community-materialise`.** Payload `{ savedTripId, orgId, userId }`; the handler
  builds the saver's scope via `createScope`, reads the pinned snapshot from `FILES`,
  re-validates it, and creates the copy **through the existing repositories and their own
  quotas**: `createTrip` (`src/server/repos/trips.ts:311`, which asserts the `trips` metric at
  `:315`), `createDay` (`src/server/repos/days.ts:116`), `createPlace`
  (`src/server/repos/places.ts:263`, which asserts `places`), `createAssignment`
  (`src/server/repos/itinerary.ts:278`). The new trip is an ordinary draft owned by the saver's
  workspace — fully editable, deliberately: the **saved trip** is the read-only artefact,
  pinned and un-editable by construction; materialising is the explicit step out of read-only
  into "yours now", which is more honest than a trip that refuses edits. Idempotency:
  `community-materialise:<savedTripId>`, and the handler no-ops when `created_trip_id` is
  already set. A quota failure mid-run notifies the saver through `notify()`
  (`src/server/repos/notifications.ts:129`) with a key naming the metric, and the partial trip
  is deleted by the handler's compensating cleanup — a half-imported itinerary is worse than
  none.
- **Realtime: none.** The thread is request/response with KV re-render and router invalidation;
  `TRIP_ENTITY_KINDS` (`src/server/do/protocol.ts:50`) is untouched, and the existing `TripRoom`
  limits are never approached because no gallery surface opens a socket.

### UI (route, components)

- **Route.** None added; this stage decorates `13-S3`'s two screens and the publish dialog's
  ecosystem.
- **Suggestions thread — `suggestions-thread.tsx`** on the detail screen, below the itinerary:
  `SectionLabel` header with a `tabular-nums` count, the visible suggestions as quiet rows —
  `Avatar` initial, author name, relative time, body — and the composer. Anonymous readers see
  the thread and, in place of the composer, a single sign-in affordance linking
  `/login?redirect=/gallery/<slug>`. Signed-in visitors get a `Textarea` composer with a
  character counter (`tabular-nums`), a posting state, and their own rows carry a delete
  affordance behind a confirm `Popover`. The publisher, viewing their own publication signed
  in, additionally sees a hide affordance per row with a `Tooltip` explaining hidden means
  hidden for everyone.
- **Save affordance** in the detail header: anonymous → "Sign in to save this trip"; signed in →
  "Save to your workspace" with loading and saved states; saved → a `Badge`-marked saved state
  with "Start planning from this trip" (primary) and remove (quiet, confirm step naming exactly
  what is removed — "your saved copy, nothing in the Gallery"). Materialising shows a pending
  state until invalidation reports `created_trip_id`, then swaps to "Open your trip" linking
  `/trips/$tripId`.
- **Saved rail — `saved-rail.tsx`** on the browse screen, signed-in only, above the grid: a
  horizontal row of compact cards (art, title, saved date) linking each detail page. The rail
  loads **deferred after mount** through `loadSavedTripsFn`, so the anonymous SSR path stays
  KV-only and the signed-out page ships zero dead bytes; while loading it renders nothing —
  reserving no space and shifting no layout when absent — and when present it enters at 220ms
  opacity-only. A saved trip whose publication was withdrawn still opens: the detail loader
  falls back, **for the owner of a saved row only**, to the pinned snapshot via an
  authenticated server fn — the KV-only rule governs the anonymous path, and this read is
  authenticated by definition.
- **States.** Thread empty: "No suggestions yet — travelled this route? Say so." on
  `--color-surface-2`, illustration: an inline-SVG speech-bubble-over-dotted-route motif — a
  quiet bubble hovering above a short dashed path, drawn for this surface in the same hand as
  `13-S2`'s stamped-passport art and `13-S3`'s zero-data trip-art variant, our own art — with
  the composer directly beneath (the empty state invites, never dead-ends). Thread skeleton: three row bones. Thread error: inline `Alert` with retry.
  Composer: disabled while posting, error state on refusal (rate bucket) naming the wait.
  Saved rail: absent when empty (the browse page is complete without it — stated as the
  designed empty state of an optional rail), skeleton none (deferred, reserved-space-free),
  error collapses to absent with a console-silent retry on next navigation. Save button: all
  five interactive states. Materialise: pending, success, and the quota-refusal state
  surfacing the notification's message inline.
- **Tokens.** None missing; the thread reuses the collab surface's row rhythm on `--space-4`,
  `--radius-lg`, semantic tones for states, `tabular-nums` on counts and times. Motion: new
  suggestion rows enter 220ms `--ease-out-quint` rise+fade; reduced motion collapses to
  opacity.
- **Copy.** Thread and public affordances in `marketing` (`gallery.thread.*`,
  `gallery.save.*` for the anonymous-visible strings); saved rail, materialise flow and
  notifications in `trips` (`gallery.saved.*`). No new namespace.

### Quota

Three row kinds, answered separately and honestly:

- **Suggestions are deliberately unmetered** — a bounded-text row with cadence control (the
  per-user bucket) and publisher/curation moderation; metering conversation would sell the
  wrong unit, the same reasoning `07-S6` recorded for share links. Nothing is added to
  `resolveLimits()` or `PLAN_QUOTAS` for them.
- **Saved trips are deliberately unmetered** — a bookmark-weight row, bounded above by the
  number of published gallery trips via the unique `(org, publication)` index; a repository
  bound of at most one row per publication per workspace is structural, not a quota.
- **Materialisation consumes the existing metrics at their existing call sites** — `trips` at
  `src/server/repos/trips.ts:315` and `places` inside `createPlace`
  (`src/server/repos/places.ts:263`) — because the copy is created through the same
  repositories every other trip goes through. This stage adds **no metric and no `assertQuota`
  call of its own**, and that is the designed answer: the quota system cannot be bypassed by
  this feature precisely because the feature never writes around it.

### Tenant isolation test

Appended block, in A's scope against B's rows: `deleteOwnSuggestion` on B's suggestion id —
`NotFoundError`, B's row untouched; `hideSuggestionAsPublisher` on a suggestion under B's
publication — `NotFoundError` (the publication is not A's); `removeSavedTrip` and
`markSavedTripMaterialised` on B's saved-trip ids — `NotFoundError`; `listSavedTrips` in A
returns none of B's rows; `saveGalleryTrip` cannot parent a saved row onto an unpublished
publication (refused before any write). Gallery-space readers:
`listSuggestionsForGallery` never returns a `hidden` or `removed` row (asserted with rows in
all three states), and `setSuggestionStatusForGallery` is not exported from
`src/server/repos/index.ts` (asserted over the barrel's exports). Functions covered:
`postSuggestion`, `deleteOwnSuggestion`, `hideSuggestionAsPublisher`, `saveGalleryTrip`,
`removeSavedTrip`, `listSavedTrips`, `markSavedTripMaterialised`,
`listSuggestionsForGallery`.

The materialise handler's own tests hold: a snapshot round-trips into trip+days+places+
assignments with counts equal to the snapshot's; a mid-run quota throw leaves zero orphan rows;
a re-delivery after success no-ops.

### Verification

- Gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- i18n: every new key in all 23 catalogues in this stage; parity passes with zero new failures.
- Playwright: `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test -g '13-S4'`.
  Two contexts: the fresh anonymous context (thread readable, composer replaced by sign-in,
  save affordance in its signed-out form) and the cached session (posting a suggestion and
  watching it appear; the delete confirm; save → saved → materialise pending → "Open your
  trip", with the queue consumer driven by the dev runtime). The materialised trip is opened
  once to confirm it is an ordinary editable draft.
- Browser evidence at **360px and 2560px**, both themes: the thread with seeded suggestions,
  the thread empty state, the composer's posting and refused states (rate bucket forced by the
  test), the saved rail with two entries, and the save affordance in all three phases. The
  interaction states are the point of this stage, so each is photographed in the state itself
  via `scripts/visual/capture.mjs --click` sequences, not at rest. Frames under
  `.claude/ultrabuild/shots/<slug>/round-<n>/13-S4/`.
- One `ar` frame of the thread at 1440 confirming mirrored rows and logical-property layout.
- Console silent in both contexts and both themes.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on the composer, every row affordance,
      save, remove and materialise.
- [ ] Thread empty, skeleton and error designed; save/materialise states complete; the absent
      rail is a designed absence, not a hole.
- [ ] Motion 150–260ms on `--ease-out-quint`, transform and opacity only, reduced-motion
      honoured.
- [ ] Light and dark parity, dark shadows re-declared.
- [ ] 360px → 2560px, thread and composer composed for 360, not squeezed.
- [ ] Keyboard end to end — composer, confirms and affordances all reachable; WCAG 2.2 AA both
      themes.
- [ ] Zero console errors or warnings, zero layout shift after paint — the deferred rail
      reserves nothing and shifts nothing.

### Blockers

- **`13-S3`** (wave 5) owns the screens this stage decorates; **`13-S2`** (wave 4) owns the
  release path a save resolves against; **`13-S1`** (wave 3) owns the repository and snapshot.
- **Wave-0 prerequisites**: the `community_suggestions` and `community_saved_trips` tables,
  filed under **Data and migration** to `00-S1`'s register.
- **`01-S1`** (`01-trips-core.md`, wave 1) precedes the cross-wave queue-file edits, and the
  existing create paths this stage's materialise handler calls are at HEAD already
  (`createTrip`, `createDay`, `createPlace`, `createAssignment` — measured under **Server**).
- No package, no new binding, no third-party service — the whole stage is D1 + KV + R2 + the
  queue that already exist.
