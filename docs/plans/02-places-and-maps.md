# 02 — Places and maps

## Area brief

This area is the product's signature screen and its largest hole at the same time. The trip planner
already draws a full-bleed MapLibre canvas with clustered category pins, dashed per-day route lines,
a category filter bar, an attribution credit and a camera that frames the trip on arrival. What it
cannot do is find a place. Every place in the product today is typed in by hand, one field at a
time, and the single largest absent feature in the 89-row matrix — search and import — is absent for
a reason no amount of engineering removes: **no geocoding or place-search provider has been chosen,
and the two the reference product offers are both unusable to a subscription-funded hosted
product.** That decision is not this plan's to take, and `02-S1` exists to say so before any stage
spends a run pretending otherwise.

### What is on disk, measured

Read `.claude/ultrabuild/recon/repo-ui.md` and `repo-data.md` for the full inventory. The parts this
plan builds on, with citations, because a plan that asserts how existing code behaves is wrong more
often than it is right:

| Capability        | Where it lives                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The map surface   | `src/components/map/` — 20 modules behind one `index.ts` barrel; pure logic in `src/lib/map/`                                                                                          |
| The canvas        | `src/components/map/map-canvas.tsx`, which owns the MapLibre instance, publishes it on a context and marks readiness with `data-map-ready` (`:754`)                                    |
| Pins and clusters | `place-marker.tsx` (exports `PlaceMarker`, `PlaceMarkers`, `ClusterMarker`) over `pins.tsx` (`PlacePin`, `DayPin`, `ClusterPin`) and `src/lib/map/cluster.ts`                          |
| Day lines         | `day-routes.tsx` over `src/lib/map/routes.ts` — one dashed line per day, casing plus core, straight between stops                                                                      |
| Camera            | `fit-bounds.tsx` (`FIT_MAX_ZOOM = 15` at `:27`, `FIT_MAX_ZOOM_UNMAPPED = 6` at `:40`) over `src/lib/map/bounds.ts` and `src/lib/atlas/layout.ts`                                       |
| Chrome            | `map-controls.tsx`, `category-filter-bar.tsx`, `map-legend.tsx`, `map-attribution.tsx`, `basemap-notice.tsx`, `coverage-notice.tsx`                                                    |
| The planner host  | `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` (1,437 lines), with its view model in `plan-model.ts` and its dialogs in `plan-actions.tsx`                                        |
| The write path    | `src/routes/_app/trips/$tripId/-server/plan.ts` — `createPlanPlaceFn` (`:456`), `updatePlanPlaceFn` (`:499`), `deletePlanPlaceFn` (`:529`), `reorderPlanFn` (`:256`)                   |
| The rows          | `places`, `place_tags`, `day_assignments`, `categories`, `tags`, `transports` in `src/server/db/schema.ts`; `src/server/repos/places.ts`, `categories.ts`, `tags.ts`, `collections.ts` |
| The ceiling       | `assertQuota(scope, 'places', …)` at `src/server/repos/places.ts:269`, inside `createPlace`, before the write                                                                          |

### Five places where this plan contradicts `gap-rows.json`, with its own evidence

`README.md` requires a plan that disagrees with a row to say so and show its work. Five readings are
stale, and a stage that believed any of them would spend a run building something that already
exists, or looking for a file that does not.

1. **MAP-07 says "no geolocation control". There is one.** `src/components/map/map-controls.tsx`
   declares `showLocate` (`:55`), defaults it to `true` (`:85`), hides itself when the browser has no
   geolocation (`:107`) and calls `navigator.geolocation.getCurrentPosition` (`:129`); the planner
   mounts `MapControls` at `plan-screen.tsx:1118`. What is genuinely missing is the _three-state_
   cycle — off, show, follow — and the denied state. That is a much smaller stage than the row
   implies, and `02-S7` is sized for the real remainder.
2. **MAP-07 cites three files that do not exist.** There is no `cluster-marker.tsx`, no
   `place-markers.tsx` and no `day-pin.tsx`. `ClusterMarker` and `PlaceMarkers` are exports of
   `place-marker.tsx`; `DayPin` is an export of `pins.tsx`. Every path in this plan is taken from
   `src/components/map/index.ts` rather than from the row.
3. **MAP-05 is scored `S`, and the work is `M`.** The row reads as "add a style grid to an existing
   select". Measured: the preference is **written and never read**. It is persisted at
   `src/routes/_app/-server/settings.ts:266` and `:274-277`, offered as two options at
   `src/routes/_app/settings/appearance.tsx:48-49`, and stored on both
   `organization_settings.map_style` (`src/server/db/schema.ts:1815`) and `user_settings.map_style`
   (`:1840`) — and `grep -rn mapStyle src/components src/lib` returns no consumer at all. The canvas
   derives its style from `useTheme()` (`map-canvas.tsx:308`, `:357`) and has never seen the setting.
   `02-S2` therefore builds the catalogue, the preview **and** the consumption seam.
4. **MAP-10 asks for per-user private tags; our `tags` table is workspace-scoped and this plan keeps
   it that way.** `tags` carries `organization_id` and no owner column, and `place_tags` carries
   `organization_id` too. That is the correct hosted shape and not an oversight: in a product where
   the workspace is the sharing boundary, a label one member can see inside a trip everyone else is
   editing is a surprise, not a feature. `02-S10` ships workspace tags and states the divergence in
   its own **Reference rows**; nothing here asks `00-foundations.md` for an owner column.
5. **The edge `MAP-07 → MAP-10` is already satisfied at HEAD, so `02-S7` does not wait for
   `02-S10`.** What a marker needs from the taxonomy is a colour and an icon, and both already reach
   it: `MapCategory` carries `colour` and `icon` (`src/components/map/types.ts`), `category-icon.tsx`
   resolves the icon name, and `place-marker.tsx` rings the pin in the category colour today. What
   MAP-10 adds is the _management_ of that vocabulary, which no marker reads. The edge set is not
   re-cut — `gap-rows.json` and `gap-cuts.json` stay exactly as they are — and `README.md`'s wave
   column is a floor rather than an assignment, so this is a scheduling statement backed by
   measurement, not a change to the graph.

### Row coverage

Every `MAP-` id is **closed by exactly one stage**. An id appearing anywhere else in this file — in
this table, in `02-S1`'s gate register, in a cross-reference — is a pointer, never a second claim of
coverage.

| Row    | Status move                                                                          | Closed by               | Also contributed to by    |
| ------ | ------------------------------------------------------------------------------------ | ----------------------- | ------------------------- |
| MAP-01 | partial → done                                                                       | `02-S4`                 | —                         |
| MAP-02 | absent → done                                                                        | `02-S13`                | `02-S5`, `02-S6`, `02-S8` |
| MAP-03 | partial → done                                                                       | `02-S11`                | —                         |
| MAP-04 | out-of-scope → excluded by `docs/plans/11-boundaries-and-blockers.md`, stage `11-S1` | **no stage — excluded** | —                         |
| MAP-05 | partial → done                                                                       | `02-S2`                 | —                         |
| MAP-06 | done → done, guarded                                                                 | `02-S3`                 | —                         |
| MAP-07 | partial → done                                                                       | `02-S7`                 | —                         |
| MAP-08 | partial → done                                                                       | `02-S9`                 | —                         |
| MAP-09 | absent → done                                                                        | `02-S12`                | —                         |
| MAP-10 | partial → done                                                                       | `02-S10`                | —                         |

**MAP-04 is not a stage.** The renderer picker is out of scope because the choice only means anything
when the operator supplies the tiles and pays that service's bill for one install; `docs/SPEC.md` §3
pins the renderer to MapLibre GL over Protomaps `.pmtiles` from our own `TILES` bucket and freezes the
dependency set, so the two alternatives are not even installable. The argument is made once, in
`docs/plans/11-boundaries-and-blockers.md` (`11-S1`), and its named hosted equivalent is MAP-05 —
which `02-S2` builds. No stage in this file plans a second renderer, a tenant-supplied map token or a
per-tenant tile account.

### The four stages that deliver MAP-02, and why it is not one stage

MAP-02 is the only `XL` row in this area, and carrying it as one stage would violate `README.md`'s
"a stage is sized to one agent and one run" outright: it spans a provider client, a file parser, a
clipboard path and a bulk write, with four different failure modes and four different screens. It is
delivered by four stages, three of which ship on their own and one of which cannot start:

| Stage    | Wave | What ships on its own                                                                          | The screen its frames prove               |
| -------- | ---- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `02-S5`  | 3    | Paste a position in any of four notations and both coordinate fields fill                      | The place dialog's coordinate pair        |
| `02-S6`  | 4    | Bring places from a saved collection into a trip, de-duplicated, with a quota preflight        | The import sheet on `/trips/$tripId/plan` |
| `02-S8`  | 5    | Drop a `.gpx`, `.kml` or `.kmz` file on the ideas rail and review what it found before writing | The drop state and the review sheet       |
| `02-S13` | 4    | Search-as-you-type and share-link resolution, against the geocoder ADR 0013 chose              | The results list on the place form        |

Each of the four has its own owned paths, its own definition of done and its own verifiable screen,
and each is releasable without the others. `02-S13` is the stage that **closes** the row, because the
row is not closed until search works; the other three declare `MAP-02 absent → absent` and name
`02-S13` as the closer, so nothing in the matrix moves on partial delivery.

**`02-S13` was BLOCKED and is not any more, and its wave moved when it was unblocked.**
`docs/adr/0013-geoapify-for-geocoding.md` closes Gate A, so the stage that was written out in full
precisely so it could be executed the day the gate closed is now scheduled. It moved from wave 6 to
**wave 4**, and the reason is the file-ownership rule rather than a change of mind about the
feature: it edits `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx`, which `01-S4` holds in
wave 2, `02-S5` in wave 3, `02-S10` in wave 5 and `02-S11` in **wave 6** — the very wave `02-S13`
used to state. Two exclusive claims on one file in one wave is a clobber, and wave 4 is the one wave
in which that file is free. Wave 4 also sits above MAP-02's floor and after `02-S4` in wave 3, whose
server function is the first caller of the geocoding proxy `src/server/geo/` that #281 minted and
that this stage calls too.

### The two gates: A is closed, B is not

`docs/plans/11-boundaries-and-blockers.md` (`11-S3`) recorded three open commercial decisions. Two of
them reach into this area, and this file resolves neither by itself — **a plan is not the place a
commercial commitment gets made.** One of the two has since been resolved where such things belong,
in an ADR:

- **Gate A — geocoding and place search. CLOSED by `docs/adr/0013-geoapify-for-geocoding.md`.**
  Reverse lookup for MAP-01, type-ahead and share-link resolution for MAP-02, address completion for
  MAP-03. The ADR carries the argument; this file carries only what follows from it, which is three
  stages that build and three constraints they inherit.
- **Gate B — routing. STILL OPEN.** Segment times and day travel totals for MAP-08, road-following
  lines for MAP-09. `11-S3` recorded Gate B as an adjacent decision taken with Gate A or immediately
  after it; it was not. ADR 0013 says so explicitly and declines to take it, because a route is
  consumed rather than stored and the retention term that decided Gate A does not obviously bite on
  it — which makes it its own decision on its own evidence, and this plan's to put to the user.

`02-S1` is the first stage of this plan and it is that gate. The rule it imposes has not changed and
is not weakened by one gate closing: **a stage whose entire outcome sits behind an open gate is
marked BLOCKED and is not scheduled; a stage with a gated behaviour inside an ungated outcome ships
the ungated outcome, records the gated behaviour under its own Blockers with the gate letter, and no
stage in this file chooses a provider, writes a client for an unnamed service, assumes a free tier,
or ships a feature degraded into uselessness in order to avoid asking.** What changed is which
stages the rule still binds.

**Behind Gate A, nothing is BLOCKED any more.** `src/server/geo/` shipped the proxy under #281, so
all three stages below are callers of it and none of them mints it. `02-S13` is scheduled, in wave 4;
`02-S4` builds the reverse-geocoded address on a dropped pin; `02-S11` builds address completion on
the form. **Behind Gate B, two stages still carry a gated behaviour inside an
ungated outcome and say so** — `02-S9` (routed segment times) and `02-S12` (road-following lines) —
and each ships the rest of its row exactly as before.

**One thing ADR 0013 adds to this plan that no stage would otherwise own: attribution.** The free
subscription plan makes the provider's credit mandatory, and OSM attribution is required regardless.
That is a surface obligation, not a server one, and this plan owns the surface. It is `02-S4`'s, on
the map, in the same attribution line the basemap already needs — one line for both sources rather
than a second badge — and every later stage that shows a geocoded result inherits it rather than
adding its own.

### `src/components/map` has one owner per wave

Ten rows converge on twenty files behind one barrel, and two agents editing `index.ts` in the same
wave lose each other's exports. So, as a rule of this plan and not a preference:

| Wave | The one stage that may own a `src/components/map` path | What it owns                                                                       |
| ---- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1    | `02-S2`                                                | `map-canvas.tsx`, `index.ts`                                                       |
| 3    | none                                                   | —                                                                                  |
| 4    | `02-S7`                                                | `place-marker.tsx`, `pins.tsx`, `types.ts`, `locate-control.tsx` (new), `index.ts` |
| 5    | `02-S9`                                                | `day-routes.tsx`, `route-pill.tsx` (new), `index.ts`                               |
| 6    | `02-S12`                                               | `transport-overlay.tsx` (new), `index.ts`                                          |

`src/lib/map/**` follows the same rule for the same reason: `02-S2` owns `basemap.ts`, `palette.ts`
and `style.ts` in wave 1, `02-S7` owns `cluster.ts` in wave 4, `02-S9` owns `routes.ts` in wave 5,
`02-S12` owns `geodesic.ts` in wave 6. The two parsers that are not map logic — coordinate notations
and waypoint files — live under `src/lib/geo/` instead, so neither competes for a wave here.

### The camera is protected, not rewritten

MAP-06 is the one row in this area already marked `done`, and it is done well: `fitMapToBounds()`
caps the fit at `FIT_MAX_ZOOM = 15` and at `FIT_MAX_ZOOM_UNMAPPED = 6` where no archive covers the
extent, `boundsForPoints()` and `expandBounds()` in `src/lib/map/bounds.ts` handle the single-place
and degenerate cases, `cameraPadding()` in `src/lib/atlas/layout.ts:220` keeps framed content clear of
overlaying chrome, and `plan-screen.tsx` shrinks that padding when a rail folds. `README.md` names
protecting what is already ahead of the reference product as a rule of this directory.

So: **no stage in this file changes `src/components/map/fit-bounds.tsx`, `src/lib/map/bounds.ts` or
the camera policy in `src/lib/atlas/layout.ts`.** `02-S3` locks the behaviour behind a spec that
fails if the framing moves, and every later stage that puts something new on the map states that it
adds a layer or a marker and does not move the camera. A stage that finds itself wanting to change
the framing has found a blocker to record, not a file to edit.

### Every selector this plan names is one it publishes, and here is the register

A stage's **Verification** block names the selector that reaches its declared state, and
`docs/plans/12-verification-protocol.md` §3 requires that selector to have been **verified to exist
against a running server**. An earlier draft of this file wrote "confirmed against a running server"
under nine stages while every selector it named existed nowhere in `src/`. That is not a small
wording problem: a selector that resolves to nothing makes `capture.mjs` throw at the shutter, and a
stage that discovers it during capture has spent a round.

**Measured at HEAD, and this is the fact the rule is built on.** `grep -rn 'data-part' src/` returns
92 lines. Every one of them is under `src/components/atlas/**` — eight in components, six in that
module's `__tests__` — plus two in `src/routes/_app/-ui/atlas-screen.tsx` (`:859`, `:869`).
**`src/components/map/**`, `src/routes/_app/trips/**`, `src/routes/_app/settings/**` and
`src/components/planner/**` publish none at all.** So every `data-part` this plan names is a hook
this plan has to add, and no stage may describe one as pre-existing.

Three rules follow, and they bind every Verification block below:

1. **A stage names a `data-part` selector only if it publishes it in a file it owns.** The stage's
   **UI (route, components)** heading says which file and which element carries the attribute, so the
   hook travels in the same diff as the thing it names. A stage that needs a hook on a file it does
   not own does not add one — it uses an attribute the product already publishes, or it names the
   stage of this plan that does own that file and consumes the hook that stage published, in a later
   wave.
2. **"Confirmed to exist" means an assertion that runs, and it runs before any frame is filed.** The
   stage's own `test.describe` in `e2e/places-and-maps.visual.spec.ts` opens with one test per
   selector asserting `await expect(page.locator(sel)).toHaveCount(1)` after the state that should
   contain it is reached. Reading the JSX and believing it is not a verification; the spec passing
   is, and it is what the stage's evidence cites.
3. **An attribute the product already publishes beats a new one.** Two exist today and neither needs
   inventing: `[data-map-ready]` on every map wrapper, which `settleMap()` already audits in both
   directions; and Radix's own `role` plus accessible name — the place form is a `Dialog.Content`
   whose `DialogTitle` reads `Add a place to this trip` in create mode and `Edit this place` in edit
   mode (`src/routes/_app/trips/$tripId/-ui/plan-actions.tsx:363-365`), and the rail's existing
   button is `getByRole('button', { name: 'Add a place' })`
   (`src/routes/_app/trips/$tripId/-ui/plan-screen.tsx:1018-1029`). Both are reachable **today**,
   with no stage of this plan having landed, which is why the two stages that share wave 3 use them
   rather than each other's hooks.

**The register.** Every `data-part` hook this plan introduces, the file that publishes it, the stage
that owns that file, and the stages that read it. A selector not in this table does not appear in a
Verification block.

| Selector                                                                                     | Published in                                              | By       | Read by                   |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- | ------------------------- |
| `[data-part="basemap-option"]` with `value="<id>"`                                           | `src/routes/_app/-ui/basemap-picker.tsx`                  | `02-S2`  | `02-S2`                   |
| `[data-part="add-place"]`                                                                    | `src/routes/_app/trips/$tripId/-ui/planner-add-place.tsx` | `02-S4`  | `02-S4`, `02-S10`         |
| `[data-part="add-place-menu"]`                                                               | same file                                                 | `02-S4`  | `02-S4`, `02-S6`, `02-S8` |
| `[data-part="add-place-option"]` with `value="<path>"`                                       | same file                                                 | `02-S4`  | `02-S4`, `02-S6`, `02-S8` |
| `[data-part="drop-overlay"]`                                                                 | same file                                                 | `02-S8`  | `02-S8`                   |
| `[data-part="planner-canvas"]`                                                               | `src/routes/_app/trips/$tripId/-ui/planner-map-layer.tsx` | `02-S4`  | `02-S4`, `02-S8`          |
| `[data-part="place-lat"]`, `[data-part="place-lng"]`                                         | `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx`      | `02-S5`  | `02-S5`                   |
| `[data-part="place-tags"]`                                                                   | same file                                                 | `02-S10` | `02-S10`                  |
| `[data-part="stop-edit"]`                                                                    | same file, on `StopMenu`'s **Edit place** item (`:175`)   | `02-S11` | `02-S11`                  |
| `[data-part="place-notes"]`, `[data-part="time-warning"]`                                    | same file                                                 | `02-S11` | `02-S11`                  |
| `[data-part="place-search"]`                                                                 | `src/components/modules/places/place-search.tsx`          | `02-S13` | `02-S13`, `02-S11`        |
| `[data-part="address-suggestions"]`                                                          | `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx`      | `02-S11` | `02-S11`                  |
| `[data-part="import-collection"]`, `[data-part="import-row"]`, `[data-part="import-commit"]` | `src/routes/_app/trips/$tripId/-ui/import-sheet.tsx`      | `02-S6`  | `02-S6`, `02-S8`          |
| `[data-part="place-pin"]` with `data-days="<count>"`, `[data-part="cluster-pin"]`            | `src/components/map/place-marker.tsx`                     | `02-S7`  | `02-S7`                   |
| `[data-part="locate-control"]`                                                               | `src/components/map/locate-control.tsx`                   | `02-S7`  | `02-S7`                   |
| `[data-part="route-pill"]`                                                                   | `src/components/map/route-pill.tsx`                       | `02-S9`  | `02-S9`                   |
| `[data-part="day-header"]`, `[data-part="stop-lock"]`                                        | `src/components/planner/day-section.tsx`                  | `02-S9`  | `02-S9`                   |
| `[data-part="day-tools"]`                                                                    | `src/routes/_app/trips/$tripId/-ui/planner-day-tools.tsx` | `02-S9`  | `02-S9`                   |
| `[data-part="taxonomy-row"]`, `[data-part="taxonomy-edit"]`, `[data-part="taxonomy-delete"]` | `src/routes/_app/-ui/taxonomy-editor.tsx`                 | `02-S10` | `02-S10`                  |
| `[data-part="transport-toggle"]`, `[data-part="transport-pill"]`                             | `src/routes/_app/trips/$tripId/-ui/planner-map-layer.tsx` | `02-S12` | `02-S12`                  |

Two consequences worth reading off the table. `[data-part="add-place"]` and
`[data-part="add-place-menu"]` are **two different controls** and not two names for one — the first
is the primary pill that opens an empty place form, the second is the menu trigger beside it whose
items are `[data-part="add-place-option"][value="map"]` (`02-S4`), `[value="collection"]` (`02-S6`)
and `[value="file"]` (`02-S8`). And three files carry hooks from more than one stage —
`planner-add-place.tsx`, `plan-actions.tsx` and `planner-map-layer.tsx` — in different waves each
time, which the **Owned paths** tables already record.

### What `capture.mjs` can reach, and what this plan's own spec reaches instead

Measured in `scripts/ultrabuild/capture.mjs`, because an earlier draft of this file wrote capture
commands that could not reach the states they labelled:

- The argument parser (`:64-80`) builds a **flat `--key value` map**. A second `--click` overwrites
  the first rather than queueing behind it, so a two-click sequence is not expressible.
- Per frame, after `settle()` and `quiesce()`, the script applies **at most one `--hover` and then at
  most one `--click`** (`:218-225`), each `.first()`, each once. There is no `--type`, no paste, no
  drag, no key press and no way to run anything between them.

So `capture.mjs` reaches exactly one class of state: **one hover and/or one click away from the route
as it loads.** Everything else in this plan — a menu item behind a menu trigger, a clipboard paste, a
`dragenter` carrying a file, a permission denial, a map zoomed before a cluster is clicked, a
workspace with different rows in it — is out of its reach, and a command that claims otherwise throws
at the shutter.

**The rule.** A stage uses `capture.mjs` for its resting set, and for a declared state only when that
state is genuinely one hover and/or one click from the loaded route. Every other declared state is
reached in this plan's own spec, `e2e/places-and-maps.visual.spec.ts`, in the `test.describe` named
for the stage, and the frames are written from there:

```ts
await page.screenshot({
  path: `.claude/ultrabuild/shots/<slug>/round-<n>/<stage-id>/<state>-<width>-<theme>-A.png`,
  fullPage: true,
  animations: 'disabled',
  caret: 'hide',
})
```

Five properties of that path, each the reason it is chosen rather than a convenience:

- **It is not a baseline and cannot become one.** `page.screenshot({ path })` outside
  `e2e/__screenshots__` compares nothing, records nothing and cannot be re-recorded by
  `--update-snapshots`. `docs/plans/12-verification-protocol.md` §5's prohibition is untouched,
  because there is no ratio here to widen.
- **The frames land in the same directory, under the same names, as `capture.mjs`'s.** The stage's
  evidence says which tool took which set; the critic sees one coherent set either way.
- **The clock and the fonts are already pinned, and better than in capture.** `playwright.config.ts`
  sends `x-pt-server-today: 2026-08-20` on both browser projects, and `visit(page, route, theme)`
  calls `unblockCrossOriginFonts(page)` first (`e2e/helpers/shoot.ts:2036`), so these frames render in
  the real faces rather than in the metric fallback.
- **The settle is the gate's own.** `visit()` and `settle()` do the nine-step wait, and `settleMap()`
  re-applies the two-sided `[data-map-ready]` predicate after every resize and every theme change —
  a bare wait on `="true"` hangs, and a theme change replaces the whole style document through
  `setStyle`.
- **The frame set is unchanged.** Light and dark at 360, 1280 and 2560, six frames per state, with
  the theme selected by `page.emulateMedia({ colorScheme })` and nothing else, the width set with
  `page.setViewportSize()` and **read back** through `window.innerWidth` before the shutter — a frame
  whose measured width is not the intended one is refused rather than filed, exactly as
  `capture.mjs` refuses it (`:229-236`).

Which stage falls on which side is not left to the reader:

| Stage    | `capture.mjs` takes                                                   | This plan's spec takes                                          |
| -------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `02-S1`  | nothing — it renders nothing                                          | —                                                               |
| `02-S2`  | resting; `basemap-charcoal` (one click)                               | —                                                               |
| `02-S3`  | resting; `single-place` and `no-coordinates` (each a second `--url`)  | —                                                               |
| `02-S4`  | resting; `menu-open` (one click)                                      | `armed`, `dropped`                                              |
| `02-S5`  | resting                                                               | `form-open`, `pasted`                                           |
| `02-S6`  | resting                                                               | `import-preview`, `import-empty`, `import-error`                |
| `02-S7`  | resting; `multi-day-badge` (one hover)                                | `spiderfied`, `locate-denied`                                   |
| `02-S8`  | resting                                                               | `drop-overlay`, `file-review`, `file-rejected`                  |
| `02-S9`  | resting                                                               | `day-focused`, `after-optimize`, `reorder-error`                |
| `02-S10` | resting; `category-editing` and `delete-confirm` (one click each)     | `tags-empty`, `tag-picker`                                      |
| `02-S11` | resting                                                               | `form-edit`, `overlap-warning`, `inline-category`, `save-error` |
| `02-S12` | resting; `overlay-on` (one click); `overlay-empty` (a second `--url`) | —                                                               |
| `02-S13` | resting                                                               | `results-open`, `no-results`                                    |

### The container rule for stage blocks, fixed here

`TEMPLATE.md` fixes eleven `###` headings and their order but does not say what delimits one stage
from the next; three separate audits of that file recorded the omission, and
`docs/plans/12-verification-protocol.md` §1 closes it. This file restates the rule because it binds
every line below:

- A stage begins at a level-two heading of the exact form `## Stage <stage-id> — <title>`, where
  `<stage-id>` is the `02-S<k>` id the stage restates under its own **Stage id** heading, character
  for character.
- The eleven template headings inside a stage stay at `###`, in the template's order, and nothing
  else inside a stage block uses `###`. Anything finer uses `####` or deeper.
- This **Area brief** sits above the first `## Stage` heading and uses `###` freely; the rule binds
  what is inside a stage block, not what is before the first one.

Two consecutive stages can therefore never run together as a flat sequence of `###` headings:
`grep -c '^## Stage ' docs/plans/02-places-and-maps.md` counts the stages, and the number of `^### `
lines between two of those headings is exactly eleven.

### Scheduling, and the measured reason six stages sit above their row's wave

`README.md`'s wave column is a **floor** — "this stage may start once every wave above it is closed"
— not an assignment. Six stages here sit above their floor, and the reason is measured rather than
preferred. `node scripts/ultrabuild/check-plan-collisions.mjs` reports that
`src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` is already claimed exclusively by `01-S2` in wave
1, `01-S4` in wave 2 and `01-S9` in wave 5; that `plan-actions.tsx` and `plan-model.ts` are claimed by
`01-S4` in wave 2 and `plan-model.ts` also by `01-S2` in wave 1; that `-server/plan.ts` is claimed by
`07-S1` in wave 1 and `01-S4` in wave 2; and that `src/routes/_app/-ui/settings-nav.tsx` is claimed by
`09-S8` in wave 3 and `10-S3` in wave 4. A stage of ours in one of those waves would clobber a
parallel builder's work in a file neither of us could merge afterwards.

| Stage    | Row floor | Scheduled | Why                                                                                 |
| -------- | --------- | --------- | ----------------------------------------------------------------------------------- |
| `02-S4`  | 1         | 3         | Owns `plan-screen.tsx`; waves 1, 2 and 5 are taken by `01-S2`, `01-S4` and `01-S9`  |
| `02-S5`  | 2         | 3         | Owns `plan-actions.tsx`; wave 2 is taken by `01-S4`                                 |
| `02-S6`  | 2         | 4         | Follows `02-S4`, which is what makes a dropped pin and an imported pin the same row |
| `02-S8`  | 2         | 5         | Needs the bulk-import write path `02-S6` lands in wave 4                            |
| `02-S9`  | 3         | 5         | MAP-08 depends on MAP-07, which `02-S7` closes in wave 4                            |
| `02-S10` | 1         | 5         | Owns `settings-nav.tsx`; waves 3 and 4 are taken by `09-S8` and `10-S3`             |
| `02-S12` | 4         | 6         | MAP-09 depends on MAP-08, which `02-S9` closes in wave 5                            |
| `02-S13` | 2         | 4         | Owns `plan-actions.tsx`; waves 2, 3, 5 and 6 are taken, and it follows `02-S4`      |

`docs/plans/03-reservations-and-transport.md` landed while this file was being written, and takes
`plan-screen.tsx` in wave 4 (`03-S5`) and `plan-model.ts`, `-server/plan.ts` and `day-section.tsx` in
wave 6 (`03-S8`). The checker found `02-S12` colliding with `03-S8` on two of those. The fix was a
better design rather than a later wave — see that stage's **Owned paths**.

**One stage edits the planner host early, and it installs the seams the rest of this plan needs.**
`02-S4` takes the wave-3 slot on `plan-screen.tsx` and adds two route-local components it then owns
outright — `planner-map-layer.tsx` for anything drawn inside the map, and `planner-day-tools.tsx` for
anything the day rail's footer offers. Both ship carrying `02-S4`'s own content, neither is an empty
placeholder, and `02-S7`, `02-S9` and `02-S12` extend those two files instead of queueing for the
contended one. The outcome the seam was built for is that **`02-S4` is the only stage in this plan
that touches `plan-screen.tsx` at all.**

The full cross-plan consequence is listed under **Cross-plan collisions** at the end of this file,
which is the checker's own output rather than a reading of the sibling plans.

## Stage 02-S1 — The provider gate: one gate closed by an ADR, one still open

### Stage id

`02-S1` · Wave 1 · effort **S**.

The first stage of this plan is a gate rather than a build. Its effort is small and its consequence
is not: it decides which stages may ship an incomplete row honestly, and which may not start at all.

**One of the two gates has closed since this stage was written, and this stage is where that is
recorded.** `docs/adr/0013-geoapify-for-geocoding.md` chooses a geocoder. The stage's own rule — that
no stage in this file picks one — is unchanged and was not broken: the choice was made in an ADR,
which is where a hard-to-reverse commercial commitment belongs, and this register now cites it rather
than restating it. Gate B is untouched and still open.

### Reference rows

**This stage closes no row.** It is the register that five other stages cite, so none of them
re-argues the boundary or, worse, resolves it quietly by naming a service inside a feature stage.

| Row    | Gate | Behaviour that waited                                     | Owning stage | Disposition                                     |
| ------ | ---- | --------------------------------------------------------- | ------------ | ----------------------------------------------- |
| MAP-01 | A    | The address of a pin dropped on the map                   | `02-S4`      | **built** — ADR 0013; calls the proxy from #281 |
| MAP-02 | A    | Search-as-you-type, and resolving a pasted map share link | `02-S13`     | **built** — ADR 0013; scheduled, wave 4         |
| MAP-03 | A    | Address completion on the place form                      | `02-S11`     | **built** — ADR 0013                            |
| MAP-08 | B    | Routed segment times, road distance, day travel totals    | `02-S9`      | ships with great-circle distance instead        |
| MAP-09 | B    | Road-following lines for car, bus, taxi and bicycle       | `02-S12`     | ships with the geodesic arc instead             |

`docs/plans/11-boundaries-and-blockers.md` (`11-S3`) was the owner of both decisions and remains the
owner of Gate B. Gate A's owner is now `docs/adr/0013-geoapify-for-geocoding.md`, and `11-S3` records
the closure by citation. This stage does not restate either argument; it states what a stage in
_this_ file may do while a decision is open, and what the closed one obliges.

**The three obligations Gate A's closure hands to this file**, so that no stage discovers one of them
on the day it builds:

1. **One proxy, minted once.** The provider is reached through `src/server/geo/`, which #281 minted,
   and from nowhere else; `02-S4` in wave 3, `02-S11`, `02-S13` and `03-S7`
   (`03-reservations-and-transport.md`, wave 5) are all callers of what is already there. Three clients for one provider would be three places to forget the cache, the ceiling and
   the attribution.
2. **The cache is cross-tenant and does not expire.** That is the property the ADR bought and the
   reason it did not reuse the transit credential; it also means the cache key is the normalised
   query and holds no tenant identifier, which is exactly the isolation rule stated below.
3. **Attribution is a surface obligation and is `02-S4`'s.** Mandatory while we are on the free
   plan, and the OSM credit is owed regardless.

Cited as `wiki: Places-and-Search` and `wiki: Route-Optimization` for the behaviours. The licence
constraints below are our own reading of provider terms against our own business model, not anything
carried across from the reference product.

### Owned paths

**None.** This stage creates and edits no repository file. Its output is the register above, the rule
below, and the two **Blockers** entries the downstream stages copy into their own blocks.

A stage with no owned paths cannot collide with anything, which is why it is safe in wave 1 alongside
`02-S2` and `02-S3`.

### Data and migration

No schema change, and one warning that turned out to be the whole of Gate A. What a provider
licenses us to **retain** differs by provider and is usually the binding term, so a cache table
shaped before the choice is a table shaped for the wrong contract. That is not hindsight: ADR 0013
was decided on exactly this term and on nothing else, and it is why the transit provider already
under contract could not be reused. The answer it bought — permanent storage permitted — means the
cache is a KV entry with **no** TTL and still no table, and the columns that would hold a resolved
result already exist and need nothing: `places.source` carries the vocabulary
(`manual`, `search`, `import`, `collection`, `osm` at `src/server/db/schema.ts:159`) and
`places.external_id`, with its `places_external_idx` index, already holds a provider's own
identifier. So the sequence is decision, then column, then feature — and today no column is needed at
all.

### Server (repo, server function, Zod)

No repository, no server function, no Zod schema. Three contracts for whoever builds against a
provider once one exists, each a consequence of a document that already binds us:

- **The call is made from the server, never the browser.** A key in a client bundle is a key that has
  been published; `docs/SPEC.md` §6 already puts every outbound concern behind a server function.
- **The cache answers before the provider does.** `docs/ARCHITECTURE.md` §4 fixes the caching layer,
  and a per-keystroke outbound call from the request path is a cost one reader can inflict on the
  whole account.
- **The credential is a secret and is never per tenant.** A tenant-supplied third-party credential is
  precisely the shape that put BKG-09 out of scope in `11-S1`, and it does not become acceptable
  because the capability is a different one.

### UI (route, components)

No route and no component. One design consequence, stated before something gets designed around it:
a type-ahead field is not a neutral control. It is one outbound call per keystroke, and it is exactly
the usage pattern that the free tiers which look attractive forbid. Any search surface built after
the decision needs a debounce, a minimum query length, a cancel-on-supersede and a cache — and those
belong to the owning stage after the choice, not to a guess before it.

### Quota

No countable row. But every one of these providers is metered by somebody, and a metered outbound
call made on a tenant's behalf is a cost one noisy tenant imposes on every other. When a provider is
adopted, its call rate belongs in `resolveLimits()` (`src/server/billing/limits.ts`) with every other
ceiling rather than in a constant inside a feature module. The published number is the enforced
number applies to a provider call as much as to a row.

### Tenant isolation test

No case is added. One isolation rule the eventual implementation must not break, recorded here so it
is not discovered late: a cached provider answer keyed only by its query is shared across tenants,
which is correct and desirable for a public fact such as a place name or a road distance — and is a
leak the moment the key contains a trip id, a place id or a member id. A cache key carrying tenant
data is tenant data and is scoped like tenant data.

### Verification

Verified as a record. No code runs, no browser is driven and no frame is filed.

- The command gate is unchanged and untouched: `pnpm lint`, `pnpm typecheck`, `pnpm test` and
  `pnpm build` pass exactly as they did before this stage, because it changes nothing.
- **Document checks, which are this stage's real assertions.** Every row id in the register resolves
  in `.claude/ultrabuild/recon/gap-rows.json`; every owning stage id resolves to a `## Stage` heading
  in this file; and the wave in each of those headings matches the scheduling table in the Area
  brief.
- **The falsifiable condition, restated now that one gate has closed.** It was: no provider name
  appears anywhere in this file. It is now the narrower claim that still catches the failure it was
  written for — **no provider is named in this file except by citation to the ADR that chose it, and
  no Gate B provider is named at all.** A geocoder appears below because an ADR chose it; a router
  appearing anywhere in this file is this stage having failed, and both halves are one `grep` away
  from being checked.
- Console and layout shift: not applicable, because nothing renders.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged and are read as they are for any register stage:
`pnpm build` succeeds and `pnpm lint`, `pnpm typecheck` and `pnpm test` are clean because no file
changed; there is no new logic to test; there is no surface to verify in a browser; nothing is left
behind because nothing is written; and no file outside ownership is touched because ownership is
empty.

The §2 visual clauses are **not** ticked, and they are enumerated rather than omitted so that nobody
has to wonder whether they were considered. Every one of them is `n/a` for the same reason — this
stage renders nothing — and ticking a box it did not look at is precisely the failure `TEMPLATE.md`
names:

- 4px grid spacing from `--space-*` — `n/a`, no surface.
- hover, focus-visible, active, disabled and loading on every interactive element — `n/a`, no
  interactive element.
- empty, skeleton and error states on `--color-surface-2` for every list — `n/a`, no list.
- motion at 150–260ms on `--ease-out-quint`, honouring `prefers-reduced-motion` — `n/a`, no motion.
- full parity in light **and** dark theme with dark shadows re-declared — `n/a`, nothing painted.
- responsive 360px → 2560px, with frames at 360, 1280 and 2560 — `n/a`, no frames are filed.
- keyboard navigable end to end, WCAG 2.2 AA contrast — `n/a`, nothing focusable.
- zero console errors or warnings, zero layout shift after paint — `n/a`, nothing loads.

The condition specific to this stage, and the only way it fails: it is done only if every gate still
open is left **open with its constraints stated**, and none is resolved by naming a service inside
this file. Choosing a provider here would be the worst outcome available. A gate closed **elsewhere**,
in an ADR, satisfies that condition rather than breaking it — provided this register cites the ADR,
states the obligations that follow and does not re-argue the choice.

### Blockers

One closed gate and one open one, in the form the downstream stages copy into their own **Blockers**
heading.

#### Gate A — geocoding and place search. CLOSED.

**Provider chosen: `docs/adr/0013-geoapify-for-geocoding.md`.** The two conditions below are kept
rather than deleted, because they are what the choice was tested against and a later reader needs to
see that they were tested rather than waived:

- **A tier whose terms exclude a commercial, subscription-funded product is unusable to us at any
  traffic level.** We charge for subscriptions through Stripe. "Free for non-commercial use" is not a
  discount available to this product; adopting one would be a licence breach wearing a saving's
  clothes. The ADR clears this on the provider's own wording, quoted there rather than paraphrased
  here.
- **A policy that forbids automated per-keystroke querying is unusable for search.** Several open
  geocoding endpoints prohibit exactly that pattern, and several also require that a product whose
  core function is geocoding run its own instance rather than use theirs. MAP-02 is a
  search-as-you-type feature by definition, so it was the precise case those policies exclude. The
  chosen provider sells autocomplete as a product, so the policy bar is cleared — the **rate** bar is
  not, and the debounce, the minimum query length and the cancel-on-supersede that `02-S13` owes are
  now cost controls rather than politeness.

The two terms that decide the cost more than the per-call price does are both answered, and both
became obligations rather than open questions. What may be **cached and for how long**: permanently,
so the cache is cross-tenant and unexpiring, and this is the single property the choice turned on.
What **attribution** must appear on screen: the provider's credit while we are on the free plan, plus
the OSM credit always — `02-S4` owns it, on the map, in the attribution line the basemap already
carries.

One thing the closure does **not** hand out: a licence to call the provider from three places.
#281 minted the one server-side proxy, `src/server/geo/`, and `02-S4`, `02-S11`, `02-S13` and
`03-reservations-and-transport.md`'s `03-S7` call it.

#### Gate B — routing. OPEN.

**No provider chosen, no budget agreed.** Owner: `11-S3`, which recorded routing as an adjacent
decision to Gate A, "taken with it or immediately after it". It was not taken with it, and ADR 0013
says why in one line: a route is consumed rather than stored, so the retention term that decided
Gate A does not obviously bite here, and the provider already contracted for transit sells ordinary
routing under the same agreement. That makes Gate B a smaller and different question than Gate A was,
and it is still a question. The same two conditions apply unchanged, and so does the rule that this
file does not answer it.

One note for the two stages it reaches, because it is what makes both of them shippable anyway: a
router is not needed for a _distance_. Great-circle distance between two coordinates is arithmetic,
and so is the shape of an arc. What the gate withholds is specifically the claim that a number is a
**road** time or a **road** distance — and a product that prints a driving time it did not measure is
worse than one that prints none.

#### Not a blocker, and named so nobody files it as one

The `BROWSER`, `AI` and image-transformation bindings are absent from `wrangler.jsonc`, and `11-S3`
records all three. **No stage in this file needs any of them**, and no stage here asks for a binding.

## Stage 02-S2 — A basemap catalogue, and a preference that is finally read

### Stage id

`02-S2` · Wave 1 · effort **M**.

### Reference rows

`MAP-05 partial → done`.

`gap-rows.json` scores this row **S** and this stage disagrees, with the measurement in the Area
brief: the preference is persisted (`src/routes/_app/-server/settings.ts:266`, `:274-277`), stored on
two tables (`src/server/db/schema.ts:1815` and `:1840`), offered as two options
(`src/routes/_app/settings/appearance.tsx:48-49`) and **read by nothing** — `grep -rn mapStyle
src/components src/lib` returns only `basemapStyle`, an unrelated function that derives a style
document from the resolved colour scheme (`map-canvas.tsx:308`, `:357`). The row's `S` assumed the
consumption seam existed. It does not, and building it is most of this stage.

Behaviour sourced as `wiki: Map-Settings`, and deliberately not ported: the reference's picker exists
because the operator supplies the tiles. Ours picks between **cartographies we generate ourselves
from the same `.pmtiles` archive**, which is why it costs nothing per tenant and why MAP-04 is
excluded rather than reduced.

### Owned paths

- `src/lib/map/basemap.ts` — new. The catalogue, the resolver and the client preference store.
- `src/lib/map/__tests__/basemap.test.ts` — new. The catalogue's invariants.
- `src/lib/map/palette.ts` — edit. One palette variant per catalogue entry.
- `src/lib/map/style.ts` — edit. `BasemapStyleOptions` gains a `basemap` field; `basemapStyle()` and
  `mapStyleFor()` read it. No layer id changes, so `MAP_LAYER_IDS` is untouched.
- `src/lib/map/__tests__/style.test.ts` — edit. The existing suite (14.9K at HEAD) gains the
  layer-id-parity case named under **Verification**. It is an extension, never a rewrite: no existing
  assertion in that file is deleted or rephrased.
- `src/components/map/map-canvas.tsx` — edit. Reads the preference and rebuilds the style when it
  changes, on the same `setStyle` path a theme change already takes.
- `src/components/map/index.ts` — edit. Re-exports the catalogue and the hook.
- `src/routes/_app/-server/shell.ts` — edit. `ShellPayload` gains the effective basemap id.
- `src/routes/_app/route.tsx` — edit. Publishes that id into the store on mount and on change.
- `src/routes/_app/-server/settings.ts` — edit. Validates the saved id against the catalogue.
- `src/server/repos/settings.ts` — edit. `mapStyleSchema` narrows from a free 64-char string to the
  catalogue's union.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The case under **Tenant isolation
  test**, added to the existing describe block. Append is the cooperative disposition every stage in
  every plan takes on this file, so it is not a collision with any of them.
- `src/routes/_app/-ui/basemap-picker.tsx` — new. The grid, the live preview and the workspace-default
  entry.
- `src/routes/_app/settings/appearance.tsx` — edit. Replaces the two-option select with the picker.
- `e2e/places-and-maps.visual.spec.ts` — append. `02-S3` creates this file in the same wave; if it has
  not landed when this stage runs, this stage creates it carrying only its own `describe` block.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append. This stage's own frames only.

**Four of those paths are touched by other plans in other waves, and each is named here with the
sibling stage id**, per the checker's own report:

| Path                                      | Also owned by                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `src/routes/_app/-server/settings.ts`     | `00-S3` (wave 0), `09-S7` (wave 2), `09-S8` (wave 3), `03-S6` (wave 4) |
| `src/server/repos/settings.ts`            | `09-S8` (wave 3), `03-S6` (wave 4)                                     |
| `src/routes/_app/settings/appearance.tsx` | `09-S8` (wave 3), `03-S6` (wave 4)                                     |
| `src/routes/_app/-server/shell.ts`        | `08-S10` (wave 3)                                                      |

This stage is wave 1 and is the **earliest** claimant of all four, which is the useful direction: it
lands a narrower `mapStyleSchema` and one extra shell field before three other plans rework the same
files, so each of them inherits a validated union rather than a free string. Its picker is a
self-contained component, so `09-S8`'s wave-3 settings-shell rework moves a mount point rather than a
form. `src/routes/_app/-ui/settings-nav.tsx` is **not** owned here — this stage adds no nav entry —
and is claimed by `09-S8` (wave 3), `10-S3` (wave 4) and this plan's `02-S10` (wave 5).

### Data and migration

**No schema change and no migration.** Both columns exist and both already hold valid values:
`organization_settings.map_style` (`src/server/db/schema.ts:1815`, `NOT NULL DEFAULT 'planned-light'`)
and `user_settings.map_style` (`:1840`, nullable, meaning "inherit the workspace default").

The catalogue is therefore **additive over the two stored ids**, which is what makes this migration
free: `planned-light` and `planned-dark` stay valid ids with their current appearance, and the new
entries — an automatic entry that follows the colour scheme, a high-contrast entry that lifts label
contrast and mutes land fill, and a quiet entry that drops road and place labels for reading a dense
trip — are new values that no existing row holds. Nothing is backfilled and nothing is renamed, so a
rollback to the previous Worker keeps working against unchanged columns, per `ARCHITECTURE.md` §9.

The one ordering consequence to state: narrowing `mapStyleSchema` to a union means a row holding an
unknown id would fail validation on read. It cannot happen — the only two writers are the settings
form and the seeder (`src/routes/api/dev/-seed/dataset/index.ts:58`, `'planned-light'`) — but the
resolver still falls back to the automatic entry for an unrecognised id rather than throwing, because
a settings screen that 500s on a stale string is a worse product than one that shows a default.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/settings.ts` — no new function. `mapStyleSchema` (`:104`) changes
  from `z.string().trim().min(1).max(64)` to `z.enum(BASEMAP_IDS)` with an `error` message naming the
  catalogue, so an unknown id is rejected at the boundary rather than stored. Every read stays on the
  existing tenant-scoped path; `organization_settings` and `user_settings` are both scoped by
  `organization_id` through `tenantFilter()` in `src/server/repos/base.ts` and this stage adds no new
  query.
- **Server function.** No new one. `saveAppearance` in `src/routes/_app/-server/settings.ts` already
  accepts `mapStyle`; its Zod field narrows to the same union. `loadShell` in
  `src/routes/_app/-server/shell.ts` gains `mapStyle` in its returned payload, resolved the way the
  settings loader already resolves it — the member's own value, falling back to the workspace default
  (`-server/settings.ts:255`).
- **Zod.** `z.enum(BASEMAP_IDS)` in both places, with `error` set. Validation is shape: the
  authorisation for both calls is unchanged and lives where it already lives — `loadShell` resolves
  the session and `saveAppearance` writes only inside the caller's own tenant scope. A well-formed
  basemap id from the client is not permission to write anybody's settings row.
- Nothing here is slow, nothing is enqueued, nothing goes near `TripRoom`. The preference is a
  per-member display choice and is deliberately not a realtime patch.

### UI (route, components)

- **Route.** No new route file, therefore no `pnpm generate-routes`. `/settings/appearance` keeps its
  default SSR.
- **Components.** Reused from `src/components/ui`, imported through the barrel at
  `src/components/ui/index.ts` the way every screen imports primitives today
  (`src/routes/_app/settings/appearance.tsx:7`), and named here because a second implementation of an
  existing primitive is a defect. The selection control itself is **`RadioGroup` plus `RadioCard`**
  from `src/components/ui/radio-group.tsx`. Around it: `Card`, `SectionLabel`, `Field`, `Skeleton`,
  `Alert`, `Spinner`, and the `focusRing`, `transitionBase` and `disabledState` helpers from
  `src/components/ui/shared.ts`. Reused from `src/components/map`: `MapCanvas` itself, at
  `interactive={false}` with `cooperativeGestures`, is the live preview, so the product's own renderer
  previews the product's own cartography rather than a screenshot that goes stale. New:
  `src/routes/_app/-ui/basemap-picker.tsx`, which composes those primitives, supplies the five
  catalogue entries and mounts the preview. It defines no selection control of its own.
- **`RadioGroup` and `RadioCard` are the control, not a suggestion.** Measured at HEAD, because this
  is the bullet a builder is most likely to skip: `src/components/ui/radio-group.tsx` exports
  `RadioGroup` (`:20`), `Radio` (`:46`), `RadioGroupItem` (`:83`) and `RadioCard` (`:157`), all
  re-exported from `#/components/ui` (`src/components/ui/index.ts:35`), and
  `grep -rn 'RadioCard\|RadioGroupItem' src --include='*.tsx' --include='*.ts'` returns **no match
  outside that file**. The module is shipped, tokenised and unconsumed, and unconsumed is not absent:
  building a second selectable-card control here is exactly the defect the previous bullet names.
  `RadioCard` already carries what this grid needs, on the tokens this plan would otherwise re-derive:
  `label`, `description`, `icon` and `meta` slots; a checked state of `--color-brand` border,
  `--color-brand-subtle` fill and `shadow-card`; the `animate-pop-in` check badge that keeps selection
  from being colour-only; and hover, `focus-visible`, active and disabled through `transitionBase`,
  `focusRing` and `disabledState`. What this stage adds is the swatch it passes as `icon`, and nothing
  else. If the swatch genuinely wants to become a full-bleed preview tile rather than a 36px leading
  glyph, that is a prop on `RadioCard` in `src/components/ui/radio-group.tsx`, and
  `src/components/ui/**` belongs to one primitive stage per wave in `00-foundations.md`, never to a
  feature stage. The ritual that file fixes applies unchanged: state the requirement here, under this
  **UI** heading, and stop; it is minted as a primitive stage there, and the leading-glyph form ships
  meanwhile. Do not fork the primitive into `-ui/`, and do not list
  `src/components/ui/radio-group.tsx` under this stage's owned paths, which would make the stage
  malformed.
- **The nearest precedent on that screen is the wrong one, and is out of scope.** The theme picker two
  rows above lives in the same file this stage edits and is a hand-rolled `aria-pressed` `<button>`
  grid with its own focus, transition and checked classes
  (`src/routes/_app/settings/appearance.tsx:95-145`). It predates the primitive. Copying its shape is
  how this stage would end up with a hand-rolled radio group, so it is named to be avoided rather than
  imitated. It is equally **not** converted here: that would widen this stage's diff into a file
  `09-S8` reworks in wave 3, so the conversion belongs to that stage, and this stage leaves the theme
  grid byte-identical.
- **The grid.** One `RadioGroup` whose `value` is the effective basemap id and whose `onValueChange`
  saves, holding five `RadioCard` entries: workspace default, automatic, paper, charcoal, quiet. Radix
  supplies the roving tabindex, so the whole group is one tab stop and arrow keys move and select,
  which is why this is a real radio set rather than five buttons that behave like one. Each entry has
  a visible label and a one-line `description`, so selection reads without colour, and the checked
  entry additionally shows the brand border and the check badge. Every entry inherits the same hover,
  `focus-visible`, active and disabled treatment as every other `RadioCard` in the product, because it
  is the same component.
- **The hook this stage publishes**, per the Area brief's register: each entry carries
  `data-part="basemap-option"` and `value="<catalogue id>"`, both spread through `RadioCard` onto the
  element Radix renders, in `src/routes/_app/-ui/basemap-picker.tsx`, which this stage owns. Measured
  rather than assumed, because the selector in the Verification block depends on it:
  `@radix-ui/react-radio-group@1.4.7` renders a radio item as
  `<button type="button" role="radio" data-state="…" value="<value>">` (`RadioTrigger` in its
  `dist/index.mjs`), so `value` is a real attribute on the matched element and there is no `<input>`
  to target. It is a new attribute, nothing under `src/routes/_app/settings/**`
  publishes a `data-part` today, and it exists so the state frame below has a selector that survives a
  restyle.
- **The preview.** One `MapCanvas` beside the grid, framed on a fixed extent with a handful of sample
  pins, that re-styles as the selection changes. Only one canvas is mounted; the tiles in the grid are
  cheap static swatches built from the catalogue's own palette tokens, because five live WebGL
  contexts on a settings page is a way to lose the tab.
- **States.** _Empty_ — not applicable; the catalogue is a constant and is never empty, and this
  stage says so rather than inventing a state that cannot occur. _Skeleton_ — the preview reserves its
  final box and shows a `Skeleton` at the same radius until `data-map-ready` flips, so the page does
  not reflow when the canvas arrives. _Error_ — a browser with no WebGL2 context already gets
  `MapCanvas`'s designed fallback and the picker still works, because the swatches are CSS; a failed
  save shows an `Alert` on `--color-surface-2` with the reason and a retry that re-sends the same
  value, and the grid returns to the previously saved entry rather than lying about what is stored.
  _Loading_ — the whole grid is `disabled` while a save is in flight and the pressed entry carries a
  `Spinner`, which is the same pattern the appearance screen's other rows use today.
- **Tokens.** None missing. Surfaces are `--color-surface` and `--color-surface-2`, the selected
  hairline is `--color-brand`, the swatches are built from the palette module's own values, radii are
  `--radius-lg` and `--radius-xl`, the selection transition is `--duration-fast` on `--ease-out-quint`
  and is transform-and-opacity only, and `prefers-reduced-motion: reduce` collapses it to opacity.
  Dark shadows are the token set's own dark declarations, not the light ones reused. No new token is
  required, so this stage asks `00-foundations.md` for nothing.

### Quota

**This stage creates no countable row.** It writes one existing column on one existing settings row
per member and per workspace, and an `UPDATE` consumes no metric. `assertQuota` is not called and
must not be: a display preference a tenant already pays for is not a thing to run out of.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, in the existing
`a foreign parent id is rejected, never re-scoped` describe block: with organization A's scope,
reading and updating **B's** `organization_settings` and `user_settings` rows by id must raise
`NotFoundError`, and B's `map_style` must be byte-identical afterwards. Repository functions covered:
the settings repository's workspace and member settings readers and writers in
`src/server/repos/settings.ts`. Both tables carry `organization_id` and every query is built from
`tenantFilter()`, so the case is a regression guard on the narrowing rather than a new boundary — and
a narrowing that accidentally widened a query is exactly the kind of change that would pass every
other test in the suite.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds, by file and invariant:

- `src/lib/map/__tests__/basemap.test.ts` — every catalogue id is unique and resolvable; the two
  currently stored ids (`planned-light`, `planned-dark`) still resolve, which is the back-compat
  guarantee the no-migration claim rests on; the automatic entry resolves to the paper palette under
  `light` and the charcoal palette under `dark`; an unknown id resolves to the automatic entry rather
  than throwing; and the preference store notifies a subscriber exactly once per distinct change.
- `src/lib/map/__tests__/style.test.ts` — extended, not replaced: `basemapStyle()` emits the same
  layer id set for every catalogue entry, so no entry can silently drop a layer another component
  targets by id.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the case above.

Browser evidence, per `docs/plans/12-verification-protocol.md`:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/settings/appearance" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S2" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
```

- **Resting set:** `/settings/appearance`, light and dark, at 360, 1280 and 2560. Six frames.
- **The declared state, because a resting frame is not evidence about a picker:** the charcoal entry
  selected while the light colour scheme is emulated, which is the only frame that proves the
  preference is read rather than inferred from the theme. It is **one click from the loaded route**,
  so it is the one state in this stage `capture.mjs` can take, with a second invocation of the
  command above adding
  `--state basemap-charcoal --click '[data-part="basemap-option"][value="planned-dark"]'`.
- **The selector, and how it is verified rather than asserted.** This stage publishes
  `data-part="basemap-option"` itself, in `src/routes/_app/-ui/basemap-picker.tsx`, which it owns —
  no `data-part` exists under `src/routes/_app/settings/**` at HEAD. Its `test.describe` opens with
  a test that navigates to `/settings/appearance` and asserts
  `await expect(page.locator('[data-part="basemap-option"][value="planned-dark"]')).toHaveCount(1)`.
  **That test runs before any frame is filed**, and its passing is what the evidence cites; a
  selector that resolves to nothing makes `capture.mjs` throw at the shutter and costs a round.
- **The map route the preference actually changes:** `/trips/$tripId/plan` and `/atlas`, one frame
  each at 1280 in light with the charcoal entry saved, to show the setting reaching a real map. The
  trip id is resolved by following the trip's link from `/trips` rather than hard-coded, so the frame
  survives a re-seed.
- `/settings/appearance` gains a `[data-map-ready]` marker, so the spec's own route table declares
  `map: true` and `settleMap()` audits the declaration in both directions. Measured before claiming
  this is safe: `e2e/__screenshots__/visual.spec.ts/` holds baselines for `/settings` and **not** for
  `/settings/appearance`, and `APP_ROUTES` in `e2e/helpers/shoot.ts:355-362` does not list it — so
  adding a canvas to that page disturbs no existing baseline.
- The spec calls `auditServerClock(page, <its own route table>)` once, in a describe of its own. No
  screen this stage ships prints a clock-derived string, so no `RELATIVE_TIME_SITES` entry is added
  and `e2e/helpers/shoot.ts` is **not** claimed — `01-S5` (wave 2) and `10-S2` (wave 1) both claim it
  and this stage must not be a third.
- **Console must be silent.** `watchConsole(page, route)` is attached before every navigation and the
  report's `fatal` list is asserted empty at the end of every test, including the frame-only ones. The
  headless rasteriser's GL advisory is the one tolerated entry and it is tolerated by
  `TOLERATED_CONSOLE_WARNINGS` already; this stage adds nothing to that list.
- **Layout shift after paint** is read after the settle mark, per engine, and asserted `0` in
  Chromium. On `mobile-safari` the reading is reported as a skip with its reason —
  `PerformanceObserver.supportedEntryTypes` does not include `layout-shift` in WebKit and `observe()`
  does not throw there, so a score of `0` would mean "unsupported", never "clean".

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm lint` and
`pnpm typecheck` are clean with no suppressions; the new logic has the tests listed above and
`pnpm test` passes; the picker is verified in a real browser in both themes at both ends of the
range; no TODO, placeholder, `console.log` or commented-out code is left; and nothing outside the
owned paths above is touched.

On top of those, for every surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — here,
      each radio tile and the preview's own controls.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state — the grid
      cannot be empty and says why, the preview has a skeleton, the save has an error surface on
      `--color-surface-2`.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px: at 360 the grid is a single column above the preview, at 2560 the
      grid and the preview sit side by side and the preview grows rather than the gap.
- [ ] Keyboard navigable end to end: one tab stop for the group, arrow keys between entries, an
      accessible name on the preview region, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**None.** This stage needs no provider — every entry in the catalogue is generated from the
`.pmtiles` archive we already serve — no binding, no package outside the pinned set, and no row from
another plan.

One dependency worth stating so it is not mistaken for one: `09-S8` reworks the settings shell in
wave 3 and `10-S3` adds a console entry in wave 4. Neither touches this picker, and this stage lands
two waves before the first of them.

## Stage 02-S3 — The opening camera, locked behind a spec that fails when it moves

### Stage id

`02-S3` · Wave 1 · effort **S**.

### Reference rows

`MAP-06 done → done`, guarded.

This is the one row in this area the matrix already scores `done`, and it is done well: the fit is
capped at `FIT_MAX_ZOOM = 15` (`src/components/map/fit-bounds.tsx:27`) and at
`FIT_MAX_ZOOM_UNMAPPED = 6` where the archive does not cover the extent (`:40`), `boundsForPoints()`
and `expandBounds()` in `src/lib/map/bounds.ts` handle the single-place and zero-span cases,
`cameraPadding()` in `src/lib/atlas/layout.ts:220` keeps framed content clear of overlaying chrome,
`worldZoom()` (`:293`) and `WORLD_CENTRE` (`:263`) supply the no-coordinates fallback, and
`plan-screen.tsx` shrinks the padding when a rail folds.

`README.md` names protecting what is already ahead of the reference product as a rule of this
directory. A row that is done and unguarded is a row the next stage breaks by accident, and five
stages in this plan add things to the same map. So this stage **changes no camera code**: it locks the
seams of the current behaviour that nothing yet asserts, and it lands the plan's spec file.

**Most of the camera is already under test, and an earlier draft of this stage was wrong to imply
otherwise.** Counted rather than assumed, on this branch:

| Behaviour                                                                                                                                                                   | Already asserted at                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `boundsForPoints()` returns `null` for an empty set and for a set with no valid coordinate                                                                                  | `src/lib/map/__tests__/bounds.test.ts:68`                                   |
| an invalid point is skipped rather than poisoning the rectangle                                                                                                             | `bounds.test.ts:73`                                                         |
| a single place collapses to a zero-span box, which `expandBounds()` widens to a neighbourhood                                                                               | `bounds.test.ts:83` and `:162`                                              |
| a pair spanning the antimeridian frames as the narrow arc, and does not cross on floating-point noise                                                                       | `bounds.test.ts:94`, `:104`, `:121`, `:144`                                 |
| `resolvePadding()` fills the edges the caller omitted; `clampPadding()` scales insets down on a 360px container and survives a container with no size                       | `bounds.test.ts:244`, `:254`, `:259`, `:275`                                |
| `boundsKey()` is equal for equal values regardless of identity, and ignores differences below a metre                                                                       | `bounds.test.ts:228`, `:236`                                                |
| `cameraMotion()` collapses to a single frame under `prefers-reduced-motion`                                                                                                 | `src/lib/map/__tests__/camera.test.ts:52`                                   |
| `cameraPadding()` clears the shelf, the search pill and the zoom cluster, and leaves room to draw at 360→2560                                                               | `src/lib/atlas/__tests__/layout.test.ts:123`                                |
| `worldZoom()`/`WORLD_CENTRE` make one world span the container's longer edge                                                                                                | `layout.test.ts:159`                                                        |
| `FitBounds` frames the trip on `load`, carries a caller inset to the camera, does nothing when disabled, and does **not** re-fit when the caller rebuilds an identical list | `src/components/map/__tests__/markers.test.tsx:372`, `:396`, `:424`, `:437` |

**This stage rewrites none of those and adds no second copy of any of them.** Doing so would put
duplicate assertions into four files this stage does not own, which is the specific defect that got an
earlier draft of it rejected. What is left uncovered is narrower and entirely inside
`fitMapToBounds()` and the `FitBounds` effect — the four invariants listed under **Verification**,
each of which was confirmed absent by `grep -rnE 'FIT_MAX_ZOOM|fitMapToBounds' src`: fourteen lines
across five source files — `fit-bounds.tsx`, `map/index.ts`, `plan-screen.tsx`, `atlas-screen.tsx`
and `country-search.tsx` — and zero inside a `__tests__` directory.

Behaviour sourced as `wiki: Map-Features`. Recorded as a difference rather than a gap: the reference
has no default-centre setting either and computes its opening camera the same way; where we are ahead
is the chrome-aware padding and the unmapped-extent cap. The padding is already asserted as a pure
function (`layout.test.ts` above); what no test notices today is the cap actually reaching MapLibre,
which is the gap this stage closes.

### Owned paths

- `e2e/places-and-maps.visual.spec.ts` — new. This plan's spec file, per
  `docs/plans/12-verification-protocol.md` §4: one spec per plan file, stages told apart by their
  `test.describe` name. It never appends to `e2e/visual.spec.ts`.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — new. The baseline directory the config's
  `snapshotPathTemplate` gives it, which cannot collide with an existing one.
- `e2e/helpers/places-and-maps.ts` — new. The module-local helper: resolving the seeded trip by its
  accessible name from `/trips`, and the plan's own route table.
- `src/components/map/__tests__/fit-bounds.test.tsx` — new. The only unit-test file this stage adds,
  and it covers only the four seams the table above shows are uncovered. It carries its own hoisted
  MapLibre fake, which is this repository's established pattern rather than a duplication:
  `map-canvas.test.tsx:32`, `markers.test.tsx:19` and `visited-countries.test.tsx:90` each declare
  their own `FakeMap`, and there is no shared map harness module to import.

**Deliberately not owned, and this is the point of the stage.** Two groups.

_The camera implementation_, which no stage in this file edits: `src/components/map/fit-bounds.tsx`,
`src/lib/map/bounds.ts`, `src/lib/atlas/layout.ts`.

_The tests that already cover it_, which this stage must not duplicate and must not rewrite:
`src/lib/map/__tests__/bounds.test.ts`, `src/lib/map/__tests__/camera.test.ts`,
`src/lib/atlas/__tests__/layout.test.ts` and `src/components/map/__tests__/markers.test.tsx`. The
last of those is claimed by `02-S7` in wave 4 for marker badge and spiderfy behaviour, and by no
other stage in any plan; `02-S3` is in wave 1 and does not claim it, so it adds no second claimant
and no within-plan hand-off. If the execution of this stage finds itself wanting to touch any of
those four files, the stage is wrong and the finding belongs in `docs/plans/OPEN-FINDINGS.md`, not
in an edit.

`e2e/helpers/shoot.ts` is not claimed either — `10-S2` claims it in wave 1 and `01-S5` in wave 2, and
a third claimant in wave 1 would be a same-wave collision. Anything this plan needs from the shared
settle lives in `e2e/helpers/places-and-maps.ts` instead.

### Data and migration

**No new countable row and no schema change: this stage writes no application code at all.** The
camera reads coordinates that already exist on `places` and persists nothing — there is deliberately
no stored camera state, which is what makes the framing correct on a device that has never opened the
trip before.

### Server (repo, server function, Zod)

**No repository, no server function and no Zod schema.** The camera is a pure function of the
coordinate set and the measured container. Nothing about it crosses the network, which is why it can
be locked with unit tests rather than with fixtures.

The one server-side fact the spec depends on, and therefore states: the seeded demo trip's places
come from `src/routes/api/dev/-seed/dataset/`, and the spec resolves the trip by following its link
from `/trips` rather than hard-coding an id, so a re-seed moves nothing.

### UI (route, components)

- **Route.** No new route file and therefore no `pnpm generate-routes`. The routes the spec drives
  are the two that already carry a live map: `/atlas` and `/trips/$tripId/plan`.
- **Components.** No new component and no changed component. `FitBounds`, `MapCanvas`, `MapControls`,
  `PlaceMarkers` and `DayRoutes` are exercised exactly as they ship.
- **States.** The three states this stage photographs are the camera's own, and they are the reason
  it exists: a trip whose places span a country and frame inside the fit cap; a trip with a single
  place, which has no extent to fit and must open at a readable zoom rather than at the maximum; and
  the world fallback a trip with no coordinates gets. The empty-state case is the third of those, and
  it is reached through the product rather than mocked — a trip whose places carry no coordinates
  renders the planner's own designed empty map, and the frame proves it is designed and not blank.
- **Tokens.** None. Nothing visual changes.

### Quota

**This stage creates no countable row**, and it is worth saying why in a plan that adds a spec file:
a test run against `pnpm dev` writes rows through the seeded fixture, not through a metered path, and
no stage may call `assertQuota` from a test. If a future spec needs to create a place, it creates it
through the product's own server function so the ceiling applies exactly as it does to a reader.

### Tenant isolation test

**No case is added, and this is the one stage in the plan where that is the correct answer**: it adds
no repository function and issues no query. The isolation the spec relies on is already covered — the
demo session sees the demo workspace's trips and nothing else, which the existing cases in
`src/server/repos/__tests__/tenant-isolation.test.ts` already assert for `trips` and `places`.

A stage that adds a repository function and no isolation case is not done; a stage that adds no
repository function and invents one is padding.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds — one file, four invariants, and every one of them checked against the
coverage table under **Reference rows** so that none of it restates an assertion that already exists:

- `src/components/map/__tests__/fit-bounds.test.tsx` — **the zoom ceiling reaches MapLibre.**
  `fitMapToBounds()` passes `maxZoom: FIT_MAX_ZOOM` when the caller names none, and passes a
  caller-supplied ceiling through unchanged — which is the mechanism `plan-screen.tsx:1425` uses to
  send `FIT_MAX_ZOOM_UNMAPPED` for a trip outside the published archive. Read the value off the
  recorded `fitBounds` options, so the test fails if the default is removed or the option is dropped
  on the floor. `grep -rn 'FIT_MAX_ZOOM' src` returns eight lines across three files — `fit-bounds.tsx`,
  `map/index.ts` and `plan-screen.tsx` — and none of them is in a `__tests__` directory.
- …**the motion decision reaches MapLibre too.** `cameraMotion()` is already asserted in isolation
  (`camera.test.ts:52`); what is not asserted is that `fitMapToBounds()` forwards its `animate` and
  `duration` to `map.fitBounds`, and that an explicit `animate: false` from the caller wins over an
  unreduced preference. The existing `FitBounds` cases read only `options.padding`
  (`markers.test.tsx:396`), so this reads a different field and duplicates nothing.
- …**a canvas with no area is a deferral, not a failed fit.** `fitMapToBounds()` returns without
  calling `fitBounds` when the container measures below 1px on either axis, and calls `map.resize()`
  first when the canvas and the container disagree about their size. Both are the guards against
  MapLibre logging "Map cannot fit within canvas…" and leaving the camera where it was, and the
  existing harness deliberately gives its fake a size (`markers.test.tsx:31-42`) so that neither is
  exercised anywhere today. Record `resize()` calls on the fake to assert the second.
- …**the effect re-fits when the rectangle's value changes.** `markers.test.tsx:437` asserts the
  negative half — a rebuilt but identical list does not drag the camera back. The positive half is
  untested: a genuinely different point set, and a changed `fitKey` over an unchanged set, must each
  produce exactly one further fit. Without it, the memo that makes the negative half true could
  silently start suppressing every re-fit and no test would notice.

The stage adds **no** case to `bounds.test.ts`, `camera.test.ts`, `layout.test.ts` or
`markers.test.tsx`. If executing it produces a diff in any of those four files, the execution is
wrong.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S3" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
```

- **Resting set:** `/trips/$tripId/plan`, light and dark, at 360, 1280 and 2560. Six frames. This is
  the first time a trip tab is baselined in this repository, which has a consequence recorded under
  **Blockers**.
- **The declared states**, each with its own frame set and its own `--state` name: `single-place`,
  the trip whose places collapse to one coordinate; and `no-coordinates`, the trip that opens on the
  world fallback. Neither needs an interaction — each is **a different trip**, so each is a second
  invocation of the command above with its own `--url` and `--state single-place` or
  `--state no-coordinates` and no `--hover` or `--click` at all. That is why both stay inside
  `capture.mjs`'s reach, and it is the reason this stage names no selector: it has no state behind a
  gesture. The trips are resolved by following their links from `/trips` rather than hard-coded, and
  the spec asserts the resulting camera through the map's own reported centre and zoom, so the
  assertion survives a restyle.
- The spec declares `map: true` on both map routes; `settleMap()` fails a route that renders a
  `[data-map-ready]` marker without declaring one and a route that declares one and renders none, so
  the declaration cannot rot. It calls `auditServerClock(page, <its own route table>)` once in a
  describe of its own, and reads whatever `auditRelativeTime()` reports rather than discarding it,
  stating in the evidence which of the two things a non-empty report means.
- **Console must be silent**: `watchConsole()` before every navigation, `fatal` asserted empty at the
  end of every test. The GL advisory on a map route is the one already-tolerated entry.
- **Layout shift after paint** asserted `0` in Chromium after the settle mark, including across a
  resize and a theme change, which is where a map screen most often shifts. Reported as a skip with
  its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, and item 3 is the substance of this stage rather
than a tick: the new logic here **is** tests, and `pnpm test` passing with them is the deliverable.

The §2 visual clauses are ticked against the surfaces the stage photographs, which it does not own but
is now accountable for having looked at:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — the no-coordinates frame is the evidence for the first of those on this
      screen, and the existing surfaces it photographs are checked against the other two rather than
      assumed.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured — the camera flight is included, and the
      reduced-motion path is asserted in the unit test above rather than only looked at.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

A frame that shows the camera framing something other than the trip is this stage failing, even
though it changed no camera code — that is the whole point of writing it down.

### Blockers

Two, both inherited from `docs/plans/12-verification-protocol.md` §7 and both recorded here because
this is the stage that trips them first.

- **§7.2 — seven abbreviated-month call sites still ask the platform.** `src/lib/format.ts` answers
  `month: 'short'` from its own CLDR table, but seven call sites construct their own
  `Intl.DateTimeFormat`, and every one of them renders only under `/trips/$tripId/*`. The protocol
  records the defect as latent today and **active the moment a trip tab is baselined** — which is
  what this stage does. The consequence is concrete: a September date on that screen can differ
  between `chromium` and `mobile-safari` for a reason that is not the design. This stage records it,
  does not fix it (the files are `src/components/costs/data.ts`,
  `src/components/modules/transports/transports-timeline.tsx`,
  `src/components/modules/collab/collab-board.tsx`, `src/components/modules/collab/thread.tsx`,
  `src/components/modules/book/bookings-timeline.tsx` and
  `src/components/modules/files/file-library.tsx`, none of which it owns), and reports any
  `mobile-safari` difference it cannot attribute rather than widening a budget.
- **§7.3 — the renderer behind the `mobile-safari` baselines is not pinned.** `@playwright/test` is a
  caret range and no CI job runs Playwright at all, so the baselines this stage records are a
  single-machine regression net and not cross-machine truth. This stage may rely on them to prove
  nothing changed; it may not claim the design renders identically elsewhere. `maxDiffPixelRatio` is
  not raised, per §5, under any circumstances.

Neither blocker stops the stage. Both are stated before it is scheduled rather than discovered
mid-run, which is what the heading is for.

## Stage 02-S4 — Drop a pin on the map and it becomes a place

### Stage id

`02-S4` · Wave 3 · effort **L**. It was **M** while the address on a dropped pin was behind Gate A.
Closing that gate added a reverse-lookup server function in front of the provider proxy, the
degraded states around it and the provider's attribution to a stage that was previously one gesture
and one form, and the honest response is to re-state the effort rather than to keep the old letter
over the new work. The proxy itself, with its cache and its ceiling, is not part of that effort:
#281 minted it as `src/server/geo/` and this stage is a caller.

### Reference rows

`MAP-01 partial → done`.

What already ships, so the stage is not sized as if it were greenfield: the rail's **Add a place**
button exists (`plan-screen.tsx:1018-1029`, gated on `editable`), the place form behind it exists
(`PlaceDialog` in `plan-actions.tsx:325`), and the write path exists (`createPlanPlaceFn` at
`-server/plan.ts:456` over `createPlace` at `src/server/repos/places.ts:263`). A map-click gesture
also exists — but it **repositions an existing place and cannot create one**: `MapClickBridge`
(`plan-screen.tsx:233-310`) holds a `picking` row, and `savePosition` (`:873-912`) calls
`updatePlanPlaceFn`. So the row's remaining work is one gesture, one mode and one pre-filled form,
not a new subsystem.

Behaviour sourced as `wiki: Places-and-Search`. Two deliberate divergences, both stated rather than
inherited:

- The reference binds creation to a different mouse button per renderer because one of its renderers
  takes right-click for a camera gesture. We have one renderer, so the gesture is chosen for people
  instead of for engines: context-click on the desktop, long-press on touch, and a keyboard path that
  does not depend on a pointer at all.
- The reverse-geocoded address **was Gate A and is now built**, because
  `docs/adr/0013-geoapify-for-geocoding.md` closes that gate. The form opens with the coordinates
  filled and the address filled from a reverse lookup, both editable. **The lookup failing is not the
  drop failing**: on a timeout, a refusal or an empty result the form opens exactly as it would have
  before the gate closed — coordinates filled, address empty and editable, no apology banner and no
  disabled field. That degraded shape is not a leftover; it is the designed fallback, and it is the
  reason this stage is releasable even if the provider is down.

### Owned paths

- `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` — edit. The one host edit this plan makes
  early, described under **UI** below. It removes nothing.
- `src/routes/_app/trips/$tripId/-ui/planner-map-layer.tsx` — new. Everything this area draws inside
  the map canvas, starting with the drop gesture and its crosshair.
- `src/routes/_app/trips/$tripId/-ui/planner-day-tools.tsx` — new. Everything this area offers in a
  day's footer, starting with **Add a place**.
- `src/routes/_app/trips/$tripId/-ui/planner-add-place.tsx` — new. The rail's add control, moved
  behind a component this plan owns so that every later way of adding a place is a menu entry here
  rather than another edit to the contended host file.
- `src/components/planner/day-section.tsx` — edit. One new optional render prop, `dayTools`,
  mirroring the `rowActions` prop the component already exposes (`day-section.tsx:25`).
- `src/routes/_app/trips/$tripId/-ui/__tests__/planner-map-layer.test.tsx` — new.
- `src/server/geo/` — **not this stage's, and nothing in it is edited here.** #281 minted the
  geocoding proxy there (`geocode.ts` and its test, with `geoapify.ts` and `bindings.ts`): forward
  and reverse lookup, the normalised cache key, the KV read-through, the monthly per-tenant ceiling
  and the response validation. This stage is a caller of it, and **nothing else in any plan calls
  the provider directly.**
- `src/routes/_app/trips/$tripId/-server/geocode.ts` — new. The two server functions in front of the
  proxy. A route-local `-server/` module rather than an addition to `-server/plan.ts`, which this
  stage deliberately does not own and which four other stages queue for.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The case under **Tenant isolation
  test**.

`planner-add-place.tsx`, `planner-map-layer.tsx` and `planner-day-tools.tsx` are the three seams the
rest of this plan extends: `02-S6` and `02-S8` add menu entries to the first, `02-S7` and `02-S12`
draw into the second, and `02-S9` and `02-S12` fill the third. All three are owned by this plan, so
no later stage has to queue for `plan-screen.tsx` again.

- `e2e/places-and-maps.visual.spec.ts` — append. One `test.describe` named for this stage.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append. This stage's own frames only.

**Two of those paths are touched by other plans in other waves, and each is named here with the
sibling stage id**, per the checker's own report:

| Path                                                | Also owned by                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx` | `01-S2` (wave 1), `01-S4` (wave 2), `03-S5` (wave 4), `01-S9` (wave 5)                                   |
| `src/components/planner/day-section.tsx`            | `01-S2` (wave 1), `01-S4` (wave 2), `03-S5` (wave 4), `03-S8` (wave 6), and this plan's `02-S9` (wave 5) |

This stage is wave 3 and shares a wave with none of them. Because four stages across three plans
follow it into `plan-screen.tsx`, the edit is kept to the three additions listed under **UI** and is
described there line by line, so a later claimant can read what changed without reading a diff.

`plan-model.ts`, `plan-actions.tsx` and `-server/plan.ts` are deliberately **not** owned here: this
stage needs no view-model change, no form change and no addition to the contended server module. It
does need two new server functions, which is why it mints its own `-server/geocode.ts` instead.

**The proxy is not one of this stage's paths, and the route-local one does not collide.**
`src/server/geo/` was minted by #281, outside the wave schedule, so this stage neither waits on a
free wave for it nor claims it. `src/routes/_app/trips/$tripId/-server/geocode.ts` is the one new
path under this heading and is unclaimed by any other plan.

**The duplication this section once predicted did not happen.** It expected a geocoding counter of
some thirty lines inside `geocode.ts`, beside the one `03-S3` mints in `src/server/transit/meter.ts`
in the same wave. The counter was instead lifted into the shared rate meter,
`src/server/metering/rate.ts`, which every metered caller spends through, the proxy and transit
included, so this stage adds no counter of its own.

### Data and migration

**No schema change and no migration.** `places` already carries `lat` and `lng` with WGS-84 range
checks (`latLngChecks('places_lat_chk', …)` in `src/server/db/schema.ts`), and `places.source`
already carries the value a hand-placed pin is stamped with — `manual`, from `PLACE_SOURCES` at
`:159`. Coordinates are stored as they always have been, rounded to six decimal places at the call
site the same way `savePosition` already rounds them, which is about a tenth of a metre and far more
precision than a finger on a phone can express.

Nothing is backfilled. A rollback keeps working against unchanged columns.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/places.ts`, unchanged. `createPlace` (`:263`) is the only write
  and it is already correct: it calls `requireTrip(scope, values.tripId)`, then
  `categoriesRepository.requireById` when a category is given, then `assertQuota`, then inserts
  through `placesRepository`, which stamps `organization_id` from the `TenantScope` and omits it from
  the caller's payload type. Every query underneath is built from `tenantFilter()` in
  `src/server/repos/base.ts`, so `organization_id` is the leading predicate and cannot be omitted.
- **Server function.** `createPlanPlaceFn` (`-server/plan.ts:456`), unchanged and reused. A second
  create path would be a second place for the quota check to be forgotten.
- **Zod.** Unchanged. The existing validator already types `lat` and `lng` through `latitudeSchema`
  and `longitudeSchema` (`src/server/repos/places.ts:58-87`). The client sends a coordinate the map
  produced; the server validates it as a coordinate, which is shape and not permission.
- **Authorisation.** Decided in the handler, not in the gesture. The trip id travels from the client
  and is therefore an unauthorised id until `requireTrip` resolves it inside the caller's own tenant
  scope; the rail's `editable` flag is UX and is explicitly not the boundary. A reader with view-only
  access who calls the server function directly still gets a rejection.
- Nothing is slow, nothing is enqueued, and no `TripRoom` patch type is added: a created place is
  already a router invalidation away from every other viewer through the existing commit signal.

**The geocoding proxy — `src/server/geo/geocode.ts`, minted by #281 — and the four rules it exists
to enforce once.** This stage does not write it; it calls `reverseGeocode`, which shipped there next
to `forwardGeocode`. The module is the only one in the plan set that holds the provider's base URL.
`02-S11`, `02-S13` and `03-reservations-and-transport.md`'s `03-S7` call it too.

1. **The credential is a secret and is never per tenant**, read from the environment inside this
   module, never reaching a bundle and never supplied by a workspace — the shape that put BKG-09 out
   of scope in `11-S1`.
2. **The cache answers before the provider does, and it never expires.** KV, keyed on the normalised
   query alone — trimmed, case-folded, whitespace-collapsed, and for a reverse lookup the coordinate
   rounded to five decimal places so that two drops a metre apart are one lookup. **No TTL**, because
   ADR 0013's whole argument is the right to keep the answer permanently; a TTL here would repurchase
   a public fact we already own. The key contains no organization id, no trip id and no place id, so
   two workspaces asking the same question share one answer — which is correct, and is asserted
   below.
3. **The ceiling is per tenant, monthly, and is checked before the outbound call.** The metric is
   `geocode_lookups_per_month`, spent through the rate meter in `src/server/metering/rate.ts` as a
   KV counter keyed on the organization id and the calendar month, and capped by the figure
   `resolveLimits()` returns. It cannot be `assertQuota`, because `assertQuota` counts rows and an
   outbound call leaves no row to count. A cache hit does not spend the ceiling; only a call does.
4. **The provider's response is untrusted input.** Parsed with a `z.object` that takes the three
   fields we use and ignores the rest, with the coordinate re-checked against the same WGS-84 bounds
   `places` enforces. A malformed payload raises rather than half-filling a form.

**The two server functions — `-server/geocode.ts`.** `reverseGeocodeFn` and `searchPlacesFn`, both
`createServerFn({ method: 'POST' })`, both validating with `z.strictObject`, and both authorising the
same way: `appScope()`, then `requireTrip(scope, tripId)`. A lookup is a tenant-scoped action because
it spends a metered resource on that tenant's behalf, so an unauthorised trip id is refused **before**
the provider is called — spending money on a request we are going to reject is a defect even when the
response is discarded.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`. `/trips/$tripId/plan` keeps its
  default SSR.
- **The host edit, in full, so an auditor can diff it.** `plan-screen.tsx` gains exactly three
  things: `<PlannerMapLayer …/>` as an additional child of `MapCanvas`, receiving the trip id, the
  places it already computed and the callback it already has for opening the place dialog;
  `dayTools={(day) => <PlannerDayTools …/>}` passed to `DaySection`; and `<PlannerAddPlace …/>` in
  place of the inline `addButton` expression at `plan-screen.tsx:1018-1029`, rendering the same
  primary pill with the same props and a menu beside it. Nothing else is moved out of the file,
  nothing is deleted, and the existing `MapClickBridge`, `FitBounds`, `PlaceMarkers` and `DayRoutes`
  renders are untouched — the camera in particular is not re-armed, per the Area brief.
- **Why the add control moves and nothing else does.** Three later stages of this plan add a way to
  put places on a trip, and each of them would otherwise need one line in `plan-screen.tsx` — a file
  whose free waves this plan has already exhausted. Moving one JSX expression into a file this plan
  owns converts three future contended edits into three menu entries. It is the smallest change that
  buys that, and it is the only reason it is made.
- **Components.** Reused from `src/components/ui`: `Button`, `IconButton`, `Dialog`, `Field`,
  `Input`, `Alert`, `Spinner`, `Kbd`, `Tooltip`. Reused from `src/components/map`: `useMapContext`,
  `useMapListener` and `MapMarker` — this stage owns no file under `src/components/map`, which is
  why wave 3 has no owner there. New: the two route-local components above.
- **The gesture, and its keyboard equivalent.** Context-click on the canvas, or a 500 ms long-press
  on touch, arms the drop and opens the place form with the coordinates filled and the name field
  focused. The pointer-free path is the same mode the product already has: **Add a place → Place it
  on the map** arms a crosshair, the map region takes focus, arrow keys pan, `Enter` drops at the
  centre of the visible map and `Escape` cancels. The existing arming banner (`plan-screen.tsx:1214`)
  and crosshair cursor (`:306`) are reused rather than re-invented, so repositioning and creating
  look and feel like the same gesture, because they are.
- **States.** _Empty_ — a trip with no places already renders the planner's designed empty map, and
  this stage adds the drop hint to it so the empty state teaches the gesture instead of just
  reporting the absence. _Skeleton_ — the form's category list is the only async part and it shows
  the `Field`'s existing skeleton row. _Error_ — a rejected create shows an `Alert` on
  `--color-surface-2` inside the dialog with the reason and a retry that resubmits the same draft;
  the provisional pin is removed and the map does not keep a marker for a place that was not stored.
  A quota rejection is its own case and reads as one: the message names the ceiling and links to
  billing rather than saying the save failed. _Loading_ — the submit button carries its `loading`
  state and the dialog cannot be dismissed while a write is in flight.
- **The provisional pin.** Between the drop and the save, a marker at the dropped point in the
  accent colour with a dashed ring, so the map answers "here" while the form is open. It is removed
  on cancel and replaced by the real pin on success.
- **The address, and where it is filled from, given that this stage may not touch the form.**
  `plan-actions.tsx` belongs to `02-S5` in this same wave, so the reverse lookup cannot live in
  `PlaceDialog`. It does not need to: the drop already opens that dialog with initial values this
  stage computes, so `planner-map-layer.tsx` calls `reverseGeocodeFn` between the drop and the open
  and passes the address in the same object as the coordinates. **The form is unchanged and unaware.**
  The lookup is awaited with a short ceiling — the dialog opens either way, and it opens with the
  address field in its skeleton state for as long as the call is outstanding, then filled or left
  empty. A reader who starts typing an address while the lookup is in flight keeps what they typed:
  a late answer never overwrites a non-empty field.
- **Attribution, which is this stage's because ADR 0013 made it a surface obligation.** The map's
  existing attribution line gains the provider's credit alongside the OpenStreetMap credit the
  basemap already owes — **one line, two sources**, not a second badge and not a floating overlay.
  It is required for as long as we are on the free subscription plan and the OSM half is required
  regardless, so it is rendered unconditionally rather than behind a flag nobody will remember to
  flip. Every later stage that shows a geocoded result inherits this line and adds nothing of its
  own.
- **The hooks this stage publishes**, per the Area brief's register, because nothing under
  `src/routes/_app/trips/**` carries a `data-part` at HEAD. In `planner-add-place.tsx`:
  `data-part="add-place"` on the primary pill that opens an empty place form, and
  `data-part="add-place-menu"` on the menu trigger beside it, whose one item this stage ships is
  `data-part="add-place-option"` with `value="map"`. They are **two controls, not two names for
  one** — `02-S6` and `02-S8` each add a further `add-place-option` value to the same menu in later
  waves. In `planner-map-layer.tsx`: `data-part="planner-canvas"` on the layer's own hit surface
  inside the canvas, which `02-S8` reads in wave 5 for its drop target.
- **The place form needs no hook and does not get one.** It is a Radix `Dialog.Content` whose title
  already reads `Add a place to this trip` (`plan-actions.tsx:363-365`), so the state is reached with
  `getByRole('dialog', { name: 'Add a place to this trip' })` — an accessible name that survives a
  restyle and, unlike a hook, exists **today**. `plan-actions.tsx` is claimed by `02-S5` in this same
  wave and this stage must not write to it.
- **Tokens.** None missing. The crosshair and banner reuse what the picking mode already uses; the
  provisional pin uses `--color-accent` and `--color-accent-on`; the drop animation is a 180 ms
  scale-and-fade on `--ease-out-quint`, transform and opacity only, collapsed to opacity under
  `prefers-reduced-motion: reduce`. No token is added, so `00-foundations.md` is asked for nothing.

### Quota

**This stage creates a countable row: a place.**

- Metric: `places`. It already exists, and it is a `PLAN_QUOTAS` operational metric rather than a
  catalogue metric — `src/server/db/types.ts:43` (free 150), `:50` (starter 1,500), `:57` (pro
  20,000) and `:64` (unlimited). It is deliberately absent from `CATALOGUE_METRICS`, so nothing here
  restates a tier number.
- Call site: `assertQuota(scope, 'places', await placesRepository.count(scope))` at
  `src/server/repos/places.ts:269`, inside `createPlace`, **before** the insert. This stage adds no
  second call site and introduces no path that reaches the table without passing it — which is the
  entire reason the drop reuses `createPlanPlaceFn` instead of getting its own server function.
- No R2 object is written, so the object-first ordering does not apply.

**And it spends something no row-count metric covers: a geocoding call.** `11-S3` states the rule
and ADR 0013 makes the call a metered one, but the metric is not this stage's to add — #281 shipped
it with the proxy, so this stage adds no metric, no counter and no constant:

- Metric: `geocode_lookups_per_month`, one of `RATE_METRICS` in `src/server/billing/limits.ts`, with
  a figure per plan in `PLAN_RATE_CEILINGS` that `resolveLimits()` returns. It is **not** in
  `PLAN_QUOTAS`: `PLAN_QUOTAS` holds ceilings on rows a workspace owns, and an outbound call is
  neither a row nor something a workspace owns. The ceiling is monthly and per workspace, not daily.
- Enforcement is **not** `assertQuota`, and cannot be. `assertQuota` compares a live `COUNT(*)`
  against a limit, and an outbound call leaves nothing to count. The check is the rate meter in
  `src/server/metering/rate.ts`: a KV counter keyed on the organization id and the calendar month,
  spent by the proxy **after** a cache miss and **before** the outbound call, and refused with
  `RateCeilingError` once the ceiling is reached. A cache hit spends nothing, which is what makes an
  unexpiring shared cache a cost control and not just a latency one.
- **This stage does not own `src/server/billing/limits.ts` and does not edit it**, and it has
  nothing to file onto a foundations stage: the metric and its case in
  `src/server/billing/__tests__/limits.test.ts` landed with #281.
- The `places` metric itself is untouched: it already exists in both the resolver and `PLAN_QUOTAS`,
  so nothing about it needs a foundations stage.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, inside the existing
`a foreign parent id is rejected, never re-scoped` describe block: with organization A's scope,
`createPlace` is called with B's `tripId` and a valid coordinate pair, and must raise
`NotFoundError`; then with A's own trip and B's `categoryId`, which must raise `NotFoundError` too;
and B's place count must be unchanged afterwards. Repository functions covered: `createPlace`,
`requireTrip` and `categoriesRepository.requireById`.

If either assertion already exists for `createPlace` in that block, this stage **extends the existing
case with the coordinate payload rather than writing a second copy** — a duplicated test is a defect
in the same way a duplicated primitive is, and it hides which assertion actually failed.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds, by file and invariant:

- `src/routes/_app/trips/$tripId/-ui/__tests__/planner-map-layer.test.tsx` — a context-click on the
  canvas opens the form with the clicked coordinates, rounded to six places, and with the name field
  focused; `Escape` while armed cancels without a write; a long-press shorter than the threshold does
  not arm; and the layer registers exactly one map listener per mount and removes it on unmount,
  because a leaked MapLibre listener on a screen a reader opens ten times a day is a slow leak nobody
  attributes to this stage.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the case above.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S4" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
  --state menu-open --click '[data-part="add-place-menu"]'
```

- **Resting set:** `/trips/$tripId/plan`, light and dark, at 360, 1280 and 2560. Six frames, from the
  command above with the last line dropped.
- **The one state `capture.mjs` can reach, and it is the last line above:** `menu-open` — the add
  menu open with its entries visible, which is one click from the loaded route. It is worth a frame
  in its own right, because it is the surface `02-S6` and `02-S8` extend.
- **The two states this stage is actually about are out of `capture.mjs`'s reach, and the Area brief
  says why:** the parser is a flat key map and the script applies one hover and one click, once
  (`scripts/ultrabuild/capture.mjs:64-80`, `:218-225`). `armed` needs two clicks — the menu trigger,
  then its map entry — and `dropped` needs a context-click at a canvas offset, which no flag
  expresses. Both are therefore taken **in this plan's own spec**, in this stage's `test.describe`,
  with `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S4/`, six frames each, light and dark at 360, 1280
  and 2560, re-settling the map through `settleMap()` after every resize and every theme change. The
  resting set is still owed: an armed state is judged against the rest state it changes from.
- **Selector discipline, and every selector below is verified by an assertion that runs.** This stage
  publishes `data-part="add-place"`, `data-part="add-place-menu"` and
  `data-part="add-place-option"` in `planner-add-place.tsx` and `data-part="planner-canvas"` in
  `planner-map-layer.tsx`, both files it owns and both new — nothing under
  `src/routes/_app/trips/**` publishes a `data-part` at HEAD. The form is reached by role and
  accessible name instead, `getByRole('dialog', { name: 'Add a place to this trip' })`, because
  `plan-actions.tsx` belongs to `02-S5` in this same wave. The `test.describe` opens with one test
  asserting `toHaveCount(1)` for each of the four hooks in the state that should contain it, **and
  that test runs before any frame is filed** — reading the JSX and believing it is not a
  verification. No Tailwind class and no nth-child path is used anywhere.
- The spec declares `map: true` for this route and calls `auditServerClock(page, <its own route
table>)` once in a describe of its own. No new clock-derived string is printed, so no
  `RELATIVE_TIME_SITES` entry is added and `e2e/helpers/shoot.ts` is not claimed.
- **Console must be silent.** `watchConsole()` before every navigation, `fatal` asserted empty at the
  end of every test including the frame-only ones. The GL advisory on a map route is the one already
  tolerated entry; nothing is added to `TOLERATED_CONSOLE_WARNINGS`.
- **Layout shift after paint** asserted `0` in Chromium after the settle mark, including while the
  dialog opens over the map — a dialog that reflows the page behind it is exactly this clause's case.
  Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm lint` and
`pnpm typecheck` are clean with no suppressions; the new logic has the tests above and `pnpm test`
passes; the gesture is verified in a real browser in both themes, on desktop and on mobile, in the
armed and dropped states; no TODO, placeholder copy, `console.log` or commented-out code is left; and
nothing outside the owned paths is touched — which for this stage means the host edit stays the three
additions listed under **UI** and does not become a refactor of a file three other stages depend on.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      add control, its menu items, the arming banner's cancel, the dialog's submit.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state, on
      `--color-surface-2` — the empty map teaches the gesture, the category list has a skeleton, a
      rejected create has a retry and a quota rejection has its own copy.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused —
      including the provisional pin, which must stay legible over a dark basemap.
- [ ] Responsive 360px → 2560px: at 360 the form is a sheet over the map and the arming banner sits
      above the safe-area inset; at 2560 the dialog stays at its designed width and the map grows.
- [ ] Keyboard navigable end to end: the arm-and-drop path needs no pointer, the map region has an
      accessible name, focus moves into the dialog and returns to the add control on close, WCAG 2.2
      AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **Gate A — geocoding. CLOSED, and this is the stage that spends the closure.**
  `docs/adr/0013-geoapify-for-geocoding.md` chooses the provider; `02-S1` records the obligations
  that follow. #281 met the first two by minting the one proxy, `src/server/geo/`, with the
  cross-tenant unexpiring cache; this stage calls that proxy and renders the attribution. What was a
  blocker is now a dependency on a decision that has been taken, which is not the same thing and is
  not listed as one.
- **Two requirements met elsewhere, and neither is this stage's to add.** The provider credential
  is a **secret**, set on the account rather than declared in `wrangler.jsonc`, so this stage asks
  for no binding — but it does need one to exist before it runs, and that is an operational step the
  user takes, not a stage. And the monthly `geocode_lookups_per_month` ceiling already exists in
  `resolveLimits()`, shipped with the proxy by #281, per **Quota** above. If the secret is absent at runtime the proxy
  refuses rather than calling, and the drop degrades to the coordinates-only shape described under
  **Reference rows** — which is why a missing secret is a degraded feature and not a broken one.
- **`12-verification-protocol.md` §7.2 — the seven abbreviated-month call sites.** This stage
  baselines a trip tab, so a September date on that screen can differ between `chromium` and
  `mobile-safari` for a reason that is not the design. Inherited, not fixed here: none of the seven
  files is in this stage's ownership. A difference that cannot be attributed is reported;
  `maxDiffPixelRatio` is not raised, per §5.
- No package outside the pinned set. No binding. No unlanded row from another plan.

## Stage 02-S5 — Paste a position, and have both fields fill

### Stage id

`02-S5` · Wave 3 · effort **S**.

### Reference rows

`MAP-02 absent → absent`, 1 of 4. **The row is closed by `02-S13`**, and this stage deliberately does
not move it: three of MAP-02's four import paths can ship without a provider, and calling the row
done before search exists would be the kind of "partial → partial that nobody has to justify" that
`TEMPLATE.md` warns turns a matrix into decoration.

Behaviour sourced as `wiki: Places-and-Search`. The reference detects a comma in its latitude field
and splits the pair. We take the same idea further for a reason that costs nothing: the strings
people actually have in their clipboard come from four places, and three of the four are not a plain
decimal pair.

### Owned paths

- `src/lib/geo/position.ts` — new. The parser and its formatter. Pure, isomorphic, no dependency.
- `src/lib/geo/__tests__/position.test.ts` — new.
- `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` — edit. The coordinate pair in `PlaceDialog`
  accepts a pasted position and fills both fields.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

`src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` is touched by one other plan in another wave and
the sibling is named here: **`01-S4` (wave 2)** of `docs/plans/01-trips-core.md`. That claim is the
measured reason this stage is scheduled in wave 3 rather than at its wave-2 floor. Inside this plan
the same file is claimed by `02-S10` (wave 5) and `02-S11` (wave 6), one per wave.

`src/lib/geo/` is a new directory and deliberately not `src/lib/map/`: this is text parsing, not map
logic, and keeping it out of `src/lib/map` keeps the one-owner-per-wave rule in the Area brief
honest.

### Data and migration

**No schema change, no migration and no new countable row.** This stage writes nothing at all: it
fills two form fields that the existing save path already stores. `places.lat` and `places.lng` exist
with their WGS-84 range checks and are unchanged.

### Server (repo, server function, Zod)

**No repository, no server function and no Zod schema.** The parse happens in the browser as the
reader pastes, and the value it produces goes through the form's existing submit —
`createPlanPlaceFn` and `updatePlanPlaceFn` in `-server/plan.ts`, whose validators already reject a
coordinate outside range through `latitudeSchema` and `longitudeSchema`.

That division is the point and is stated so nobody moves it: a client-side parser is a **convenience**
and never a validation. The server re-validates the numbers it receives exactly as it does today, and
a hand-crafted request carrying a latitude of 1,000 is rejected by the same schema whether or not
anything was pasted.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`.
- **Components.** Reused from `src/components/ui`: `Field`, `Input`, and the existing inline hint and
  error slots the place form already uses. No new component: this is behaviour on two inputs that
  already exist, and adding a "coordinate widget" primitive for it would be a second implementation
  of `Input`.
- **The four notations, and what each looks like when it arrives.** A decimal pair separated by a
  comma or by whitespace; a signed pair with a hemisphere letter; a degrees-minutes-seconds pair; and
  a `geo:` URI, which is what a phone's share sheet produces. Pasting any of them into **either**
  coordinate field fills both and moves focus to the next field, so the reader is not left wondering
  which half went where.
- **The feedback, which is the whole design.** A parse that succeeds shows the normalised pair as an
  inline hint under the field in `tabular-nums`, so a mis-paste is visible before it is saved. A
  parse that fails does not clear the field, does not shout, and leaves the typed text alone — the
  reader may be halfway through typing a number, and a field that erases itself mid-keystroke is
  worse than no help at all.
- **The hooks this stage publishes**, per the Area brief's register: `data-part="place-lat"` and
  `data-part="place-lng"` on the two coordinate inputs in `plan-actions.tsx`, which this stage owns
  in wave 3. They are new — no `data-part` exists under `src/routes/_app/trips/**` at HEAD — and they
  are the only hooks this stage names. It deliberately names **none** on the add control: that
  control lives in `planner-add-place.tsx`, which `02-S4` owns **in this same wave**, so its hooks
  may not have landed when this stage runs. The form is opened instead through the button that exists
  today, `getByRole('button', { name: 'Add a place' })` (`plan-screen.tsx:1018-1029`).
- **States.** _Empty_ — the pair renders its normal placeholder; there is no list here and this stage
  says so rather than inventing one. _Skeleton_ — not applicable: nothing is fetched. _Error_ — an
  out-of-range value shows the form's existing inline error on `--color-surface-2` and disables
  submit, which is behaviour the dialog already has for a half-filled pair. _Loading_ — not
  applicable; parsing is synchronous.
- **Tokens.** None missing. `tabular-nums` on the normalised hint is mandatory, because it is a
  number that changes as the reader types.

### Quota

**This stage creates no countable row.** It fills two inputs. The save that follows goes through
`createPlace` or `updatePlace` in `src/server/repos/places.ts`, where `assertQuota(scope, 'places',
…)` at `:269` already governs creation; this stage adds no path around it and no second call site.

### Tenant isolation test

**No case is added, and that is the correct answer here**: this stage adds no repository function,
issues no query and touches no tenant-scoped row. The write it feeds is `createPlace`, whose
isolation is asserted by the case `02-S4` appends in wave 3 and by the existing cases in
`src/server/repos/__tests__/tenant-isolation.test.ts`.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds, by file and invariant:

- `src/lib/geo/__tests__/position.test.ts` — each of the four notations round-trips to the same pair;
  a hemisphere letter flips the sign and a conflicting sign-plus-letter is rejected rather than
  guessed; a longitude outside ±180 and a latitude outside ±90 are rejected; a pair whose halves are
  transposable is **not** silently swapped, because a "helpful" swap turns a valid position in the
  Southern Ocean into one in Kazakhstan; ordinary prose containing two numbers does not parse; and
  the parser allocates no regular expression that can backtrack catastrophically on a long paste,
  asserted by parsing a 100,000-character string inside the default test timeout.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S5" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
```

- **Resting set:** `/trips/$tripId/plan` as it loads, light and dark, at 360, 1280 and 2560. Six
  frames, and that is **everything `capture.mjs` takes for this stage**. It has no `--state`,
  no `--hover` and no `--click`, because neither state below is one gesture from the loaded route.
- **The two declared states are taken in this plan's own spec**, in this stage's `test.describe`,
  with `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S5/`, six frames each, light and dark at 360, 1280
  and 2560:
  - `form-open` — the place form open over the map, reached with
    `page.getByRole('button', { name: 'Add a place' }).click()`. That button exists **today** at
    `plan-screen.tsx:1018-1029` and needs nothing from `02-S4`, which shares this wave.
  - `pasted` — the same form after a real clipboard paste of a `geo:` URI onto
    `[data-part="place-lat"]`, showing both fields filled and the normalised hint. A paste is a
    `ClipboardEvent` the spec dispatches; `capture.mjs` has no flag that produces one, which is the
    measured reason this frame is not its to take.
- **Selector discipline.** `[data-part="place-lat"]` and `[data-part="place-lng"]` are published by
  this stage in `plan-actions.tsx`, which it owns. The `test.describe` opens with a test asserting
  `await expect(page.locator('[data-part="place-lat"]')).toHaveCount(1)` with the form open, and
  the same for `place-lng`; **that test runs before any frame is filed**, and its passing is what
  the evidence cites. The form itself is reached by role and accessible name, not by a hook.
- The spec's route table declares `map: true` for the planner route and calls `auditServerClock()`
  once in its own describe. `e2e/helpers/shoot.ts` is not claimed.
- **Console must be silent**, asserted with `watchConsole()` in every test. **Layout shift after
  paint** asserted `0` in Chromium after the settle mark — a hint line that appears under a field is
  the classic shift, so this stage reserves the hint's line box whether or not it has content.
  Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — this stage ships no list and says so, and its field states are enumerated
      above instead.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured — the hint fades in, it does not slide the layout.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where the small layout is designed and not a squeezed desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast —
      the normalised hint is associated with the field through `aria-describedby` so it is announced
      rather than merely visible.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**None.** No provider is involved: parsing text a reader already has is arithmetic, which is exactly
why this is the first of MAP-02's four paths to ship. No package outside the pinned set, no binding,
no unlanded row.

One inherited note rather than a blocker of this stage's own: it baselines a trip tab, so
`12-verification-protocol.md` §7.2 applies to its frames exactly as it does to `02-S3`'s.

## Stage 02-S6 — Bring a saved collection into a trip

### Stage id

`02-S6` · Wave 4 · effort **M**.

### Reference rows

`MAP-02 absent → absent`, 2 of 4. **The row is closed by `02-S13`.**

Behaviour sourced as `wiki: Places-and-Search`, and re-expressed for a hosted product rather than
ported. The reference's "import from a saved list" resolves a share URL published by an external map
service — a scrape of somebody else's page, with that service's terms attached. Ours does the same
thing for the reader without any of that: a workspace already keeps saved places in **collections**,
and the missing capability is simply the direction of travel. `saveTripPlaceToCollection` exists
(`src/server/repos/collections.ts:363`); the reverse does not exist anywhere in `src/`.

Deliberately out of this stage's scope, and named so nobody expands it mid-run: the collections
screen itself belongs to ADD-10 in `docs/plans/08-product-modules.md`. This stage touches nothing
under `src/routes/_app/collections/` and adds no way to _edit_ a collection. It reads them and writes
places onto a trip.

### Owned paths

- `src/server/repos/places.ts` — edit. One new function, `createPlaces`, described under **Server**.
- `src/routes/_app/trips/$tripId/-server/place-import.ts` — new. Two server functions, one read and
  one write. Deliberately its own file rather than an addition to `-server/plan.ts`, which `07-S1`
  claims in wave 1 and `01-S4` in wave 2.
- `src/routes/_app/trips/$tripId/-ui/import-sheet.tsx` — new. The picker, the preview and the commit.
- `src/routes/_app/trips/$tripId/-ui/planner-add-place.tsx` — edit. One menu entry, opening the
  sheet.
- `src/server/repos/__tests__/places-import.test.ts` — new. The repository half.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

`src/server/repos/collections.ts` is **not** owned and not edited: `listCollectionsWithCounts`
(`:179`) and `listCollectionPlaces` (`:214`) already return everything the sheet needs, and adding a
second reader would be a duplicate of a query that exists.

### Data and migration

**No schema change and no migration.** Every column this stage writes exists:

- `places.source` takes the value `collection`, which is already in `PLACE_SOURCES`
  (`src/server/db/schema.ts:159`) — the enum was written for exactly this and has had no writer.
- `places.external_id` takes the `collection_places` row id, so a later import of the same collection
  can recognise what it has already brought across. The `places_external_idx` index on
  `(source, external_id)` already exists.
- `places.name`, `lat`, `lng`, `address`, `city`, `country_code`, `notes` and `category_id` are all
  present on both sides.

One correctness note that decides the de-duplication rule: `external_id` is **not** unique and must
not be treated as if it were. A reader may legitimately want the same saved place on two trips, and
may even want it twice on one trip if they are visiting twice. So de-duplication is a **default the
reader can override in the preview**, never a constraint enforced by the database.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/places.ts` gains `createPlaces(scope, tripId, drafts)`, and it
  is a real function rather than a loop over `createPlace` for two reasons that matter: the quota has
  to be asserted **once, for the whole batch**, before any row is written, or a reader importing
  forty places into a plan with room for ten gets ten places and an error; and D1 gives us
  `db.batch()`, which `src/server/repos/batch.ts` already wraps as `runBatch`, so the whole import is
  one transaction that rolls back as a unit. It calls `requireTrip(scope, tripId)` first, resolves
  each draft's `categoryId` through `categoriesRepository.requireById` when one is given, asserts the
  ceiling, then writes through `placesRepository`, which stamps `organization_id` from the scope.
  Every read it makes is built on `tenantFilter()` from `src/server/repos/base.ts`, so
  `organization_id` is the leading predicate of the duplicate lookup as well as of the write.
- **Server function.** `src/routes/_app/trips/$tripId/-server/place-import.ts`:
  `loadImportSourcesFn` (`GET`) returns the workspace's collections with their place counts and, for
  a chosen collection, its places already marked with whether the trip has one that looks like each;
  `importPlacesFn` (`POST`) takes the trip id, the collection id and the explicit list of source ids
  the reader confirmed, and returns the created count plus the remaining headroom.
- **Zod.** `z.strictObject` for both inputs, with `error` set on each field. The import input caps the
  id list at the same 500 the existing `reorderPlacesInput` uses (`src/server/repos/places.ts:100`),
  so one request cannot ask for an unbounded batch. Validation is shape: a well-formed collection id
  from the client is not an authorised one.
- **Authorisation.** Decided in the handler. The trip id and the collection id both arrive from the
  client and both are resolved inside the caller's own `TenantScope` before anything is read or
  written; a collection belonging to another workspace resolves to nothing and raises
  `NotFoundError`, which is the same answer a collection that does not exist gets — a distinguishable
  answer is an enumeration oracle.
- Nothing is enqueued: a batch of at most 500 small inserts inside one `db.batch()` is not slow work,
  and putting it on `TASKS` would trade a 200 ms write for a job the reader has to wait for anyway.
  No `TripRoom` patch type is added; the existing commit signal already invalidates the router for
  every other viewer.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`. The sheet opens over
  `/trips/$tripId/plan`.
- **Components.** Reused from `src/components/ui`: `Sheet`, `Button`, `Checkbox`, `Chip`,
  `SectionLabel`, `Skeleton`, `EmptyState`, `Alert`, `Progress`, `Spinner`, `Badge`. Reused from
  `src/components/planner`: `PlaceThumb`, so an imported place looks in the preview exactly as it
  will look in the rail. New: `import-sheet.tsx`, plus one entry in `planner-add-place.tsx`.
- **The flow, in two steps and no more.** Step one lists the workspace's collections with a count
  and the countries they cover. Step two lists that collection's places, every row a checkbox, with
  rows the trip already appears to have pre-unchecked and marked **already on this trip** — the
  reader can tick them anyway, because the duplicate rule is a default and not a law. A footer states
  plainly how many will be added and how much room the plan has left, in `tabular-nums`, and the
  commit button carries the same number so nobody presses it to find out.
- **The quota preflight is part of the design, not an error path.** If the selection exceeds the
  remaining headroom, the commit button is disabled and the footer says how many the reader would
  need to deselect, with a link to billing. A reader should never discover a ceiling by hitting it.
- **States.** _Empty_ — a workspace with no collections gets a designed `EmptyState` on
  `--color-surface-2` explaining what a collection is and linking to where one is made, not a blank
  sheet; a collection with no places gets its own line rather than an empty list. _Skeleton_ — both
  steps show row skeletons at the row's real height, so the sheet does not resize when data lands.
  _Error_ — a failed load shows an `Alert` on `--color-surface-2` with a retry; a failed commit says
  that nothing was imported, which is true because the batch is one transaction, and offers the same
  retry.
- **The hooks this stage publishes**, per the Area brief's register: `data-part="import-collection"`
  on each step-one collection row, `data-part="import-row"` on each step-two place row and
  `data-part="import-commit"` on the footer's commit button, all in `import-sheet.tsx`, which this
  stage creates; plus `data-part="add-place-option"` with `value="collection"` on the one menu entry
  it adds to `planner-add-place.tsx`, extending the hook `02-S4` published in wave 3. `02-S8` reads
  `import-row` in wave 5 and adds no second copy.
- **Progress.** The commit is one request, so the button's `loading` state is the whole progress
  affordance; a determinate `Progress` bar for a single round trip would be theatre.
- **Tokens.** None missing. Surfaces `--color-surface` and `--color-surface-2`, the
  already-on-this-trip marker uses `--color-ink-3` and a `Chip`, the sheet's motion is the existing
  `--ease-drawer` at `--duration`, honouring `prefers-reduced-motion: reduce`.

### Quota

**This stage creates countable rows: places, in bulk, which is exactly the case a per-row check gets
wrong.**

- Metric: `places`, already present in `PLAN_QUOTAS` — `src/server/db/types.ts:43`, `:50`, `:57`,
  `:64` — and resolved through `resolveLimits()` in `src/server/billing/limits.ts` like every other
  ceiling. No metric is added, so no case is needed in
  `src/server/billing/__tests__/limits.test.ts` and no foundations stage is required.
- Call site: `assertQuota(scope, 'places', currentCount + drafts.length - 1)` inside the new
  `createPlaces` in `src/server/repos/places.ts`, **before** `runBatch`, so the whole import is
  refused as a unit rather than truncated. The existing per-row call at `src/server/repos/places.ts:269`
  inside `createPlace` is untouched and stays the single-create path.
- The preflight the sheet shows is advisory and is computed from the same `resolveQuotas` answer; the
  repository assertion is the enforcement. The published number is the enforced number, and a client
  that skips the sheet gets the same refusal.
- No R2 object is written, so the object-first ordering does not apply.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, in the
`a foreign parent id is rejected, never re-scoped` block: with organization A's scope, `createPlaces`
is called with B's `tripId`, and separately with A's own trip but drafts carrying B's `categoryId`,
and separately again with A's trip and a `collectionPlaceId` from B's collection as the
`external_id` source; the first two must raise `NotFoundError`, the third must not read anything of
B's, and after all three B's place count and collection contents must be unchanged. Repository
functions covered: `createPlaces`, `requireTrip`, `categoriesRepository.requireById`, and the
duplicate lookup `createPlaces` performs.

The third case is the one worth writing carefully: a bulk importer that takes ids from the client is
the classic place for a cross-tenant read to hide, because nothing about the response looks wrong.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds, by file and invariant:

- `src/server/repos/__tests__/places-import.test.ts` — importing forty drafts into a workspace with
  room for ten writes **nothing** and raises the quota error, and the trip's place count is unchanged
  afterwards, which is the single most important assertion in this stage; a draft whose coordinates
  are absent is imported as an unmapped place rather than rejected, because a saved place without a
  position is still a place; `source` is stamped `collection` and `external_id` carries the source
  row id; two imports of the same collection produce duplicates **only** for the ids the caller sent
  the second time, proving de-duplication is the caller's decision and not the repository's; and the
  batch is atomic — a draft that violates a check constraint leaves zero rows written.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the three cases above.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S6" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
```

- **Resting set:** `/trips/$tripId/plan` as it loads, light and dark, at 360, 1280 and 2560. Six
  frames, and that is everything `capture.mjs` takes here. **No state of this stage is one gesture
  from the loaded route** — reaching the preview is three clicks, the add menu, then the collection
  entry, then a collection — and the script applies one hover and one click, once
  (`scripts/ultrabuild/capture.mjs:64-80`, `:218-225`), with a second `--click` overwriting the
  first rather than queueing.
- **The three declared states are taken in this plan's own spec**, in this stage's `test.describe`,
  with `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S6/`, six frames each, light and dark at 360, 1280
  and 2560:
  - `import-preview` — the second step with a mixed selection and at least one row marked as already
    on the trip, reached by clicking `[data-part="add-place-menu"]`, then
    `[data-part="add-place-option"][value="collection"]`, then the first
    `[data-part="import-collection"]`.
  - `import-empty` — the designed empty state, reached against a workspace with no collections
    through the spec's own fixture rather than by mocking a component.
  - `import-error` — reached the way `docs/plans/12-verification-protocol.md` §3 requires, with
    `page.route()` returning a failure for the import request. Six frames like the others, because an
    error surface nobody has looked at is an error surface nobody has designed.
- **Selector discipline.** `[data-part="import-collection"]`, `[data-part="import-row"]` and
  `[data-part="import-commit"]` are published by this stage in `import-sheet.tsx`, which it creates;
  `[data-part="add-place-menu"]` and `[data-part="add-place-option"]` were published by `02-S4` in
  `planner-add-place.tsx` in wave 3, a file this stage edits only to add one menu entry. The
  `test.describe` opens with a test asserting `toHaveCount(1)` for each of the five, in the state
  that should contain it, and **that test runs before any frame is filed**.
- The spec declares `map: true` for the planner route and calls `auditServerClock()` once in its own
  describe. `e2e/helpers/shoot.ts` is not claimed.
- **Console must be silent**, `fatal` asserted empty in every test. **Layout shift after paint**
  asserted `0` in Chromium after the settle mark, including as the sheet's skeleton is replaced by
  real rows — the case this clause exists for. Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — every
      row checkbox, the select-all, the back and commit buttons.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — both steps have all three.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token (the sheet uses `--ease-drawer`),
      transform and opacity only, and `prefers-reduced-motion: reduce` is honoured. Row entrances are
      staggered by 20–30ms and the stagger is capped at eight rows.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px: at 360 the sheet is full height with the footer pinned above the
      safe-area inset; at 2560 it keeps its designed width rather than stretching to the viewport.
- [ ] Keyboard navigable end to end: the list is a real listbox of checkboxes with one tab stop and
      arrow-key movement, the footer count is announced through a polite live region as the selection
      changes, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**None.** No provider — this path reads our own rows, which is why it never depended on either gate.
No package outside the pinned set, no binding.

Two dependencies, both already landed by the time this stage runs: `02-S4` supplies
`planner-add-place.tsx` in wave 3, and `src/server/repos/collections.ts` needs nothing at all. The
`12-verification-protocol.md` §7.2 trip-tab note applies to this stage's frames as it does to every
stage here that baselines that route.

## Stage 02-S7 — Markers that say which days a place belongs to, and a locate button that follows

### Stage id

`02-S7` · Wave 4 · effort **M**.

### Reference rows

`MAP-07 partial → done`.

Three of this row's clauses are already shipped and are not rebuilt: category-coloured pins with an
icon and a hover card (`src/components/map/place-marker.tsx`, `pins.tsx`, `marker-popover.tsx`),
clustering with click-to-expand (`src/lib/map/cluster.ts`, `ClusterMarker`), and a photo marker,
which `PlaceMarker` already renders when the place has an `imageUrl` (`place-marker.tsx:60`). A
one-shot locate button is shipped too — see contradiction 1 in the Area brief.

What is genuinely missing, and is therefore the whole of this stage: a place that sits on more than
one day shows only one day numeral; a cluster at maximum zoom has no way to open; and the locate
button cannot follow, cannot say it is denied, and is a single press rather than a mode.

The Area brief records why this stage does not wait for `02-S10`: the edge `MAP-07 → MAP-10` is about
category colour and icon reaching a marker, and that already happens at HEAD.

Behaviour sourced as `wiki: Map-Features`. One divergence stated rather than inherited: the reference
puts the locate button on mobile only. Ours is on every viewport, because a laptop knows where it is
too and hiding a control by width is a guess about the device rather than about the reader.

### Owned paths

- `src/components/map/place-marker.tsx` — edit. Multi-day badges and spiderfy.
- `src/components/map/pins.tsx` — edit. `PlacePin` accepts several day numerals.
- `src/components/map/types.ts` — edit. `MapPlace.dayNumbers` beside the existing `dayNumber`.
- `src/components/map/locate-control.tsx` — new. The three-state control.
- `src/components/map/index.ts` — edit. Two exports.
- `src/lib/map/cluster.ts` — edit. The spiderfy geometry.
- `src/lib/map/__tests__/cluster.test.ts` — edit, or new if absent. The spiderfy invariants.
- `src/components/map/__tests__/markers.test.tsx` — edit. Badge and spiderfy behaviour.
- `src/routes/_app/trips/$tripId/-ui/plan-model.ts` — edit. `mapPlacesOf` (`:237`) carries every day
  a place sits on rather than one.
- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-model.test.ts` — new, and the `__tests__`
  directory with it. Measured at HEAD, because "extend" would be a false claim: `plan-model.ts` has
  **no** test file anywhere in the repo — `find src/routes/_app -type d -name __tests__` returns
  nothing and `grep -rn plan-model src --include='*.test.ts'` returns nothing — and no stage in any
  plan claims one. This stage is the first claimant and therefore creates it.
- `src/routes/_app/trips/$tripId/-server/plan.ts` — edit. The board payload carries a place's full
  set of day assignments.
- `src/routes/_app/trips/$tripId/-ui/planner-map-layer.tsx` — edit. Mounts the locate control.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

This is the wave-4 owner of `src/components/map` and of `src/lib/map`, per the Area brief's table,
and no other stage in wave 4 names a path in either directory.

**Two of its paths are touched by other plans in other waves, each named here with the sibling stage
id**, per the checker's own report:

| Path                                              | Also owned by                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/routes/_app/trips/$tripId/-ui/plan-model.ts` | `01-S2` (wave 1), `01-S4` (wave 2), `03-S8` (wave 6), and this plan's `02-S9` (wave 5) |
| `src/routes/_app/trips/$tripId/-server/plan.ts`   | `07-S1` (wave 1), `01-S4` (wave 2), `03-S8` (wave 6), and this plan's `02-S9` (wave 5) |

This stage is wave 4 and shares a wave with none of them. Its change to each is additive — a wider
projection and a wider view model — so `03-S8`, which follows it in wave 6, inherits a payload that
already carries every assignment rather than one that collapses them.

**Three of its paths are shared with other stages of _this_ plan**, which the collision checker
cannot report — a path claimed twice inside one file never reaches its cross-plan list — so all three
are named here by hand. `src/components/map/index.ts` is covered by the rule two paragraphs above:
one stage per wave owns `src/components/map`, and this is wave 4's. The second needs stating on its
own:
`src/routes/_app/trips/$tripId/-ui/__tests__/plan-model.test.ts` is created here in wave 4 and edited
by this plan's `02-S9` in wave 5 — different waves, so it is a hand-off and not a clobber, and
`02-S9` names this stage in return. If this stage has not landed when `02-S9` runs, that stage
creates the file instead; either way exactly one of them creates it and the other appends its own
`describe` block. `planner-map-layer.tsx` is the third and is already accounted for: `02-S4` creates
it in wave 3 and `02-S12` edits it in wave 6, both recorded in the Area brief's hook register.

Where the file runs, measured rather than assumed: `vitest.config.ts` puts
`src/routes/**/*.test.ts` in the **`server`** project (Node, `vitest.setup.node.ts`), not in `ui`,
whose include list is `src/components/**` and `src/lib/**` only. That is the right world for this
suite — `plan-model.ts` is a pure view-model module with no DOM and no React — but it means the file
must stay `.ts` and must not reach for `@testing-library/react`, which is the mistake a builder who
assumes "it is under `src/routes`, so it is UI" would make. The component-level assertions in this
stage belong in `src/components/map/__tests__/markers.test.tsx`, which is in `ui`.

### Data and migration

**No schema change and no migration.** The multi-day case is already expressible and already
storable: `day_assignments` has a unique index on `(day_id, place_id)` and none on `place_id` alone
(`src/server/db/schema.ts`), so one place on three days is three rows and always has been. What is
missing is only that the board payload collapses them — the planner keeps a single `dayNumberByPlace`
lookup — so this stage widens a projection, not a table.

**No new countable row:** this stage writes nothing at all. It reads what is stored and draws more of
it.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/places.ts` and `src/server/repos/itinerary.ts` are **not**
  edited. `listTripPlaces` and the itinerary reads already return every assignment row; the payload
  builder is what discards them.
- **Server function.** `loadPlanBoard` in `src/routes/_app/trips/$tripId/-server/plan.ts:174` — the
  place projection gains the ordered list of `(dayNumber, orderIndex)` pairs a place occupies. It is
  a widening of a returned shape, not a new function and not a new query: the assignment rows are
  already loaded to build the day columns.
- **Zod.** No input changes. `loadPlanBoard` is a `GET` whose only input is the trip id it already
  validates.
- **Authorisation.** Unchanged and still decided in the handler, through the same tenant-scoped
  `requireTrip` the loader already performs. Nothing about drawing more badges relaxes it.
- Nothing is slow and nothing is enqueued. The cost of the widening is bounded: it is the same rows,
  grouped differently, and the payload grows by a small integer per assignment.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`.
- **Components.** New: `locate-control.tsx`. Edited: `place-marker.tsx`, `pins.tsx`, `types.ts`,
  `cluster.ts`. Reused from `src/components/ui`: `IconButton` and `Tooltip`, which `MapControls`
  already composes, so the locate control looks like a sibling of the zoom cluster rather than a
  second design.
- **The multi-day badge.** A place on days 2 and 5 shows both numerals in one badge at the pin's
  lower edge, separated by a thin divider, in `tabular-nums` at the pin's own scale. Beyond three
  days the badge shows the first two and a count, because a badge wider than its pin stops being a
  badge. The pin's accessible name carries the full list regardless of what is drawn, so the visual
  truncation is never an information loss.
- **Spiderfy.** At maximum zoom a cluster cannot be opened by zooming further, which today leaves its
  members unreachable — a real dead end, not a polish item. Clicking such a cluster fans its members
  onto a spiral around the cluster centre with a leader line to each, at 200 ms on `--ease-out-quint`
  and transform-only; clicking the map, pressing `Escape` or moving the camera collapses it. The
  spiral geometry lives in `src/lib/map/cluster.ts` as a pure function so it is unit-testable without
  a map. Keyboard: the fanned members become a roving-focus group through the existing
  `useRovingFocus` hook, so a cluster is openable and traversable without a pointer.
- **The locate control, as a mode.** Three states — off, showing, following — cycled by press and by
  `Enter`/`Space`, with `aria-pressed` and an accessible name that names the _next_ state as well as
  the current one. Showing draws an accuracy disc and a dot; following additionally re-centres as the
  position changes and drops back to showing the moment the reader pans, because a camera that fights
  the hand is the most common way this control is got wrong. Denied or unavailable is its own visible
  state in `--color-danger` with a tooltip saying what to do, not a silent no-op.
- **States.** _Empty_ — a trip with no mapped places draws no markers and the planner's existing
  empty map already speaks; this stage adds nothing there and says so. _Skeleton_ — markers appear
  with the payload the route already awaits, so there is no separate loading state to invent; the
  locate control shows a `Spinner` in place of its icon while a fix is pending, which is a real wait
  and can take seconds. _Error_ — the denied state above, plus a position fix that times out, which
  returns the control to off and says so through a toast rather than a modal.
- **The hooks this stage publishes**, per the Area brief's register, and this is the first
  `data-part` anywhere under `src/components/map` — the directory publishes none at HEAD. In
  `place-marker.tsx`: `data-part="place-pin"` on each pin, carrying `data-days="<count>"` with the
  number of days that place sits on, and `data-part="cluster-pin"` on each cluster. In
  `locate-control.tsx`: `data-part="locate-control"`. The `data-days` attribute is not decoration —
  it is what lets a frame target the multi-day pin specifically instead of whichever pin happens to
  be first in the DOM, which is the difference between evidence about this stage and a picture of an
  ordinary marker.
- **Tokens.** None missing. The accuracy disc uses `--color-brand` at low alpha over
  `--color-brand-subtle`; the denied state uses `--color-danger`; the spiderfy leader lines use
  `--color-edge`. Dark values come from the token set's own dark declarations. Every motion is
  transform and opacity only and collapses under `prefers-reduced-motion: reduce` — the spiral
  appears without travelling.

### Quota

**This stage creates no countable row.** It reads and draws. `assertQuota` is not called and must not
be: rendering a marker for a row that already passed the ceiling is not a second consumption.

### Tenant isolation test

**No case is added, and the reason is specific rather than a shrug**: this stage adds no repository
function and no query. The one server-side change is a wider projection inside `loadPlanBoard`, which
reads assignment rows the same tenant-scoped loader already read; the isolation of that loader is
covered by the existing itinerary cases in
`src/server/repos/__tests__/tenant-isolation.test.ts` (`rejects a foreign day, place or assignment on
the itinerary`).

What this stage does owe, and puts in its unit tests instead, is proof that the widening does not
leak _between trips_ inside one tenant: a place assigned on two trips must show only the current
trip's days.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds or extends, by file and invariant:

- `src/lib/map/__tests__/cluster.test.ts` — the spiral places `n` members at strictly increasing
  radius with no two members closer than the pin diameter, for `n` from 2 to 40; it is deterministic,
  so two renders of the same cluster do not reshuffle; and it degrades to a ring for small `n` rather
  than a one-turn spiral that reads as an accident.
- `src/components/map/__tests__/markers.test.tsx` — a place on one day renders one numeral and on
  three renders the truncated form, while the accessible name lists all three in both cases; clicking
  a cluster below maximum zoom zooms and does not spiderfy, and at maximum zoom spiderfies and does
  not zoom; `Escape` collapses a fanned cluster and returns focus to it.
- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-model.test.ts` — **created by this stage**, as
  the Owned paths block records: `mapPlacesOf` carries every day a place occupies, in ascending day
  order, and a place assigned on another trip contributes none of its days to this one. It runs in
  vitest's `server` project, so it imports the view model and plain fixtures and nothing else.
- A `locate-control` test asserting the three-state cycle, the denied state, and that following stops
  on a user-initiated pan.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S7" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
  --state multi-day-badge --hover '[data-part="place-pin"][data-days="3"]'
```

- **Resting set:** `/trips/$tripId/plan`, light and dark, at 360, 1280 and 2560. Six frames, from the
  command above with the last line dropped.
- **The one state `capture.mjs` can reach, and it is the last line above:** `multi-day-badge`, a pin
  that sits on three days with its badge and hover card open. It is **one hover** from the loaded
  route, and the `data-days="3"` qualifier is what makes `.first()` land on the right pin — an
  unqualified `[data-part="place-pin"]` would photograph whichever marker MapLibre mounted first and
  prove nothing.
- **The two states this stage is actually about are out of `capture.mjs`'s reach**, and the Area
  brief gives the measurement: one hover and one click, once, per frame
  (`scripts/ultrabuild/capture.mjs:218-225`). Both are taken **in this plan's own spec**, in this
  stage's `test.describe`, with
  `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S7/`, six frames each, light and dark at 360, 1280
  and 2560:
  - `spiderfied` — a cluster fanned at maximum zoom. The zoom is a step in itself: this stage's own
    unit test asserts that a cluster clicked **below** maximum zoom zooms rather than fans, so a bare
    `--click` on a cluster from the opening camera would photograph a zoom, not a spiral. The spec
    drives the map to maximum zoom, re-settles through `settleMap()`, then clicks
    `[data-part="cluster-pin"]`.
  - `locate-denied` — the control's denied state, reached with
    `context.clearPermissions()` and a denial of `geolocation` through the browser context rather
    than by mocking the component. No `capture.mjs` flag can deny a permission.
- **Selector discipline.** `[data-part="place-pin"]` with `data-days`, `[data-part="cluster-pin"]`
  and `[data-part="locate-control"]` are all published by this stage, in `place-marker.tsx` and
  `locate-control.tsx`, both of which it owns as the wave-4 owner of `src/components/map`. All three
  are new: `grep -rn 'data-part' src/components/map` returns nothing at HEAD. The `test.describe`
  opens with a test asserting `toHaveCount(1)` for `[data-part="place-pin"][data-days="3"]` and
  `[data-part="locate-control"]`, and at least one for `[data-part="cluster-pin"]` at the zoom where
  a cluster exists; **that test runs before any frame is filed**, and reading the JSX and believing
  it is not a verification.
- The spec declares `map: true` and re-settles the map after every resize and every theme change,
  through the two-sided `[data-map-ready]` predicate rather than a bare wait on `="true"`, which
  hangs. `auditServerClock()` is called once in its own describe.
- **Console must be silent** in every test. The headless rasteriser's GL advisory is the one
  tolerated entry on a map route and nothing is added to the tolerance list. **Layout shift after
  paint** asserted `0` in Chromium after the settle mark — markers are absolutely positioned in
  MapLibre's own pane and must not reflow the page when they mount. Reported as a skip with its
  reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — pins,
      clusters, fanned members and the locate control, which additionally has a pending and a denied
      state.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — stated above, including the one case where the honest answer is that the
      host screen already owns it.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured — the spiral appears rather than travels.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused — a
      pin's ring and its badge must both hold contrast over a dark basemap, which is the harder half.
- [ ] Responsive 360px → 2560px: at 360 the pin and badge stay at a tappable 44px target and the
      locate control clears the safe-area inset; at 2560 the spiral scales with the pin rather than
      staying at a phone's radius.
- [ ] Keyboard navigable end to end: pins are focusable, a fanned cluster is a roving-focus group,
      the locate control announces its next state, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**None of this stage's own.** No provider is needed: a day numeral comes from our own rows, a spiral
is geometry, and geolocation is a browser API with no third party in it. No package outside the
pinned set — `maplibre-gl` is the renderer and nothing here reaches for a clustering library. No
binding.

Two notes rather than blockers. The photo half of this row is already satisfied by
`places.image_url`, and this stage adds **no image proxy route**: proxying a third party's photo is a
separate concern from geocoding, and Gate A's closure does not license it — the geocoder returns
coordinates and addresses, not photographs, so there is still no third party in this picture. And
`12-verification-protocol.md` §7.2 applies to this stage's trip-tab frames.

## Stage 02-S8 — Drop a track or a waypoint file on the planner

### Stage id

`02-S8` · Wave 5 · effort **L**.

### Reference rows

`MAP-02 absent → absent`, 3 of 4. **The row is closed by `02-S13`.**

Behaviour sourced as `wiki: Places-and-Search`. The reference accepts three file kinds dropped onto
its places sidebar and writes every waypoint or feature it finds as a place, in one action. Ours
accepts the same three kinds and adds the thing that makes the feature usable by everybody: a menu
entry that opens a file picker, because drag-and-drop is not a keyboard-reachable gesture and a
feature only reachable by pointer fails `docs/SPEC.md` §2 on its own.

One divergence stated rather than inherited: the reference imports the whole file. Ours previews
what it found and lets the reader choose, through the same review sheet `02-S6` built — a `.gpx`
export from a watch can carry hundreds of points, and importing all of them without asking is a way
to spend somebody's quota for them.

### Owned paths

- `src/lib/geo/waypoints.ts` — new. The parsers, and the archive reader described under **Blockers**.
- `src/lib/geo/__tests__/waypoints.test.ts` — new.
- `src/routes/_app/trips/$tripId/-ui/planner-add-place.tsx` — edit. One menu entry, the window-level
  drop target and its overlay.
- `src/routes/_app/trips/$tripId/-ui/import-sheet.tsx` — edit. A second source feeding the review
  surface `02-S6` created; deliberately not a second sheet.
- `src/routes/_app/trips/$tripId/-server/place-import.ts` — edit. One more server function.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

`src/server/repos/places.ts` is **not** owned here: `createPlaces` landed with `02-S6` in wave 4 and
this stage calls it unchanged, which is also why the quota story below needs no new call site.
`02-S9` and `02-S10` are the other wave-5 stages and share no path with this one.

### Data and migration

**No schema change and no migration.** `places.source` takes `import`, which is already in
`PLACE_SOURCES` (`src/server/db/schema.ts:159`); `places.external_id` takes the waypoint's own
identifier from the file when it has one, and is left null when it does not, which is the honest
answer rather than a synthesised id that would defeat the de-duplication rule `02-S6` established.
Elevation, timestamps and track geometry are **not** stored: we import places, not tracks, and
inventing columns for data no screen reads would be a schema change with no reader.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/places.ts`, unchanged, through `createPlaces` — one batch, one
  quota assertion, one transaction, `organization_id` stamped from the `TenantScope` on every row.
- **Server function.** `importWaypointsFn` (`POST`) in
  `src/routes/_app/trips/$tripId/-server/place-import.ts`. It takes the trip id and the **parsed
  waypoints**, not the file: parsing happens in the browser, where a DOM parser exists, and the
  Worker never sees the bytes. That is a deliberate boundary and it is stated here because it looks
  like a shortcut and is not one — it keeps an untrusted XML document out of a runtime with no
  hardened parser, and it costs nothing, because the server validates the _values_ either way.
- **Zod.** `z.strictObject` with the waypoint array capped at 500 entries — the same ceiling
  `reorderPlacesInput` uses (`src/server/repos/places.ts:100`) — each entry a strict object of name,
  latitude, longitude and optional note, every field on the existing shared schemas
  (`titleSchema`, `latitudeSchema`, `longitudeSchema`, `longTextSchema`) with `error` set. **The
  client parser is a convenience and the server schema is the validation**; a request that skips the
  browser entirely gets exactly the same treatment.
- **Authorisation.** Decided in the handler, through `requireTrip` inside the caller's own tenant
  scope. A file the reader is holding says nothing about which trip they may write to.
- Nothing is enqueued. A capped batch of small inserts is not slow work, and a queue job would make
  the reader wait for a result they are watching for.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`.
- **Components.** Reused: the review sheet from `02-S6`, `Button`, `Alert`, `Progress`, `Skeleton`,
  `EmptyState`, `Chip` from `src/components/ui`, and `PlaceThumb` from `src/components/planner`.
  New: none — this stage adds behaviour and a parser, and a second import sheet would be a duplicate
  of a surface that exists.
- **Two entry points, one destination.** Dragging a file anywhere over the planner raises a
  full-surface drop overlay naming the three kinds it accepts; dropping parses and opens the review
  sheet. **Import from a file…** in the add menu opens the system file picker and lands in the same
  sheet, which is the keyboard and screen-reader path and is not a lesser one.
- **The overlay is designed, not a dashed rectangle.** A translucent panel over the map on
  `--color-overlay` with the accepted extensions listed, appearing at `--duration-fast` on
  `--ease-out-quint`, transform and opacity only. It appears on `dragenter` with a file payload and
  is dismissed on `dragleave` and on `drop`, with the leave debounced across child elements so it
  does not flicker as the pointer crosses the rail.
- **States.** _Empty_ — a file that parses to zero waypoints gets a designed empty state inside the
  sheet naming the file and saying what was looked for, never a silent close. _Skeleton_ — parsing a
  large archive is measurable, so the sheet opens immediately with a skeleton list and a determinate
  `Progress` when the file is big enough to justify one. _Error_ — an unsupported extension, a file
  that is not the archive it claims to be, or a document with no recognisable geometry each get their
  own sentence on `--color-surface-2` with a retry, because "import failed" tells the reader nothing
  about which of the three happened. _Loading_ — the commit button's `loading` state, as in `02-S6`.
- **The file-size guard is a designed state too.** Above a stated size the reader is told the file is
  too large before anything is parsed, rather than the tab freezing while a parser walks it.
- **The hooks this stage publishes**, per the Area brief's register: `data-part="drop-overlay"` on
  the overlay panel and `data-part="add-place-option"` with `value="file"` on the menu entry, both in
  `planner-add-place.tsx`, which this stage edits in wave 5 and `02-S4` created in wave 3. It
  publishes **no others**: `[data-part="planner-canvas"]` is `02-S4`'s, in `planner-map-layer.tsx`, a
  file this stage does not own and does not edit; `[data-part="import-row"]` is `02-S6`'s, in
  `import-sheet.tsx`, which this stage edits to add a second source and where it adds no second copy
  of the hook.
- **Tokens.** None missing. Overlay on `--color-overlay` at `--z-overlay`, panel on
  `--color-surface`, counts in `tabular-nums`.

### Quota

**This stage creates countable rows: places, in bulk.**

- Metric: `places`, already in `PLAN_QUOTAS` (`src/server/db/types.ts:43`, `:50`, `:57`, `:64`) and
  resolved through `resolveLimits()`. No metric is added and no case is needed in
  `src/server/billing/__tests__/limits.test.ts`.
- Call site: the one `02-S6` established — `assertQuota(scope, 'places', …)` inside `createPlaces`
  in `src/server/repos/places.ts`, before the batch, beside the single-create assertion at
  `src/server/repos/places.ts:269`. This stage adds **no** second call site, which is the whole
  reason it reuses that function rather than writing its own bulk insert.
- The sheet shows the same advisory preflight, and a selection larger than the remaining headroom
  disables the commit with a count of how many to deselect.
- No R2 object is written. The dropped file is never uploaded: it is read in the browser and
  discarded, so there is no storage metric and nothing to compensate on failure.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`: with organization A's scope,
`importWaypointsFn`'s repository path (`createPlaces`) is called with B's `tripId` and a valid
waypoint list and must raise `NotFoundError`, and B's place count must be unchanged. Repository
functions covered: `createPlaces` and `requireTrip`.

If `02-S6`'s case already covers `createPlaces` with a foreign trip, this stage **extends it with the
waypoint payload rather than adding a second copy** — the assertion is about the repository boundary,
not about which caller reached it.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds, by file and invariant:

- `src/lib/geo/__tests__/waypoints.test.ts` — a waypoint document yields one place per point with
  name, coordinates and description carried across; a document whose features are lines and polygons
  rather than points yields the named points only and reports the rest as skipped rather than
  inventing centroids; a coordinate outside WGS-84 range is dropped with a reason instead of failing
  the whole file, because one bad point in three hundred should not lose the import; a compressed
  archive containing the document is read and its entry located by the archive's own directory rather
  than by scanning for a magic string; an archive containing no such document reports it; a file that
  is not the archive it claims to be is rejected without throwing; and parsing is bounded — a
  ten-megabyte document is refused by the size guard before a parser is constructed.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the case above.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S8" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
```

- **Resting set:** `/trips/$tripId/plan` as it loads, light and dark, at 360, 1280 and 2560. Six
  frames, and that is everything `capture.mjs` takes here. It carries **no `--state`, no `--hover`
  and no `--click`**, and the reason is the one an earlier draft of this stage got wrong: a drop
  overlay is raised by a `dragenter` carrying a file payload, and `--hover` dispatches a pointer
  move. A hover over the canvas raises nothing, so a frame labelled `drop-overlay` and reached by
  `--hover` would have been a picture of the resting screen under a name that says otherwise. The
  script has no drag flag at all (`scripts/ultrabuild/capture.mjs:64-80`, `:218-225`).
- **All three declared states are taken in this plan's own spec**, in this stage's `test.describe`,
  with `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S8/`, six frames each, light and dark at 360, 1280
  and 2560:
  - `drop-overlay` — the overlay raised by a synthetic `dragenter` carrying a file payload, which the
    spec dispatches with `page.dispatchEvent()` and a `DataTransfer` built in the page.
  - `file-review` — the review sheet listing what a fixture file parsed to, reached through the menu
    entry `[data-part="add-place-option"][value="file"]` and
    `page.setInputFiles()`. The fixture lives beside the spec, is a handful of points, and is this
    stage's own — it is not added to the seed dataset, which this stage does not own.
  - `file-rejected` — a fixture with no recognisable geometry, which is the third of the three
    distinct failures this stage designs and the one most likely to be shipped as a generic message.
- **Selector discipline.** `[data-part="drop-overlay"]` and
  `[data-part="add-place-option"][value="file"]` are published by this stage in
  `planner-add-place.tsx`, which it owns in wave 5. `[data-part="import-row"]` was published by
  `02-S6` in `import-sheet.tsx` in wave 4 and is read unchanged. The `test.describe` opens with a
  test asserting `toHaveCount(1)` for the first two in the state that should contain them and at
  least one `import-row` in the review state; **that test runs before any frame is filed**.
- The spec declares `map: true` and calls `auditServerClock()` once in its own describe.
- **Console must be silent**, `fatal` asserted empty in every test — including the drag path, where a
  browser warning about a rejected data transfer is the kind that only appears under the gesture.
  **Layout shift after paint** asserted `0` in Chromium after the settle mark; the overlay is
  positioned and must not push the page. Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — including the three distinct failures named above rather than one generic
      message.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused — the
      overlay's translucency has to hold contrast over both a pale and a dark basemap.
- [ ] Responsive 360px → 2560px: at 360 the review sheet is full height and the drop overlay is
      replaced by the menu entry, since a touch device has no drag-from-desktop gesture and an
      overlay that can never appear is dead UI.
- [ ] Keyboard navigable end to end: the menu entry is the pointer-free path to every capability the
      drop offers, and it is not a reduced version of it.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **A compressed archive has to be read without a package, and the disposition is hand-roll.** The
  frozen dependency set in `docs/SPEC.md` §3 contains no archive library, and `pnpm add` is
  forbidden absolutely. The scope of hand-rolling it is small and bounded and is stated here so
  nobody discovers it mid-run: read the archive's end-of-directory record from the tail of the
  buffer, walk the central directory to find the one entry that is the document, and inflate it with
  the platform's own decompression stream, which every browser in `docs/SPEC.md`'s support floor
  provides. The risks are equally bounded and are the ones the tests above assert: a spanned or
  encrypted archive is refused rather than mis-read, a stored (uncompressed) entry is handled without
  a decompressor, and a truncated file produces a designed error rather than an exception. **If the
  archive path cannot be made to work within this stage, it is dropped to the two uncompressed
  formats and the third is recorded as a new row — it is never replaced by a package.**
- **`12-verification-protocol.md` §7.2** applies to this stage's trip-tab frames.
- No provider, no binding, no unlanded row: `02-S6` landed `createPlaces` and the review sheet in
  wave 4.

## Stage 02-S9 — The shape of a day: what it costs to walk, and a shorter order

### Stage id

`02-S9` · Wave 5 · effort **L**.

### Reference rows

`MAP-08 partial → done`.

What ships today: one dashed line per day in visiting order (`src/components/map/day-routes.tsx` over
`src/lib/map/routes.ts`), and a trip-level distance in the rail footer built from `tripLengthMetres`
(`plan-screen.tsx:1032-1038`). What does not: anything per day, any way to shorten a day, any way to
lock a stop against being moved. Getting a day out of the product and into whatever the reader
navigates with is not this stage's: issue #663 owns it (third divergence below).

Behaviour sourced as `wiki: Route-Optimization` and `wiki: Map-Features`. Two divergences, each
stated with its reason rather than carried across, and a third that is superseded:

- **The reference's segment pills claim a walking and a driving time.** Both come from a routing
  service, which is **Gate B**. Ours show a **distance** — great-circle, computed here, claimed as
  nothing more — and the stage ships with no time on the map at all. A product that prints a driving
  time it did not measure is worse than one that prints none, and the moment Gate B closes the pill
  gains a time without changing shape.
- **The reference's optimizer uses straight-line distance while its display uses road distance**, so
  the "optimal" order is not optimal by the number shown next to it. Ours uses one metric for both,
  which removes the contradiction rather than reproducing it.
- **The reference hands the day to one named external map service through that service's URL
  scheme.** This stage first chose the opposite, a provider-neutral hand-off: the day's stops copied
  as an ordered coordinate list and each stop offering a `geo:` URI for the reader's device to
  resolve. **Superseded by issue #663**, because a `geo:` URI resolves on Android and not on iOS
  Safari or in desktop browsers, so it would have been a dead control for most readers, and the
  copied list has no `href` to carry. What replaces it: named links built from documented public URL
  formats by one pure builder (`src/lib/geo/handoff.ts`) — a stop offers "Google Maps" and
  "OpenStreetMap", a day offers one Google Maps directions link through its placed stops in visiting
  order, carrying at most the first five and saying so when it carries fewer. The day hand-off
  ("Take this day with you") is now owned by #663, not by this stage (`docs/SPEC.md` §8, one concept
  one owner); the cost accepted is the one this bullet used to avoid — two companies' URL formats
  must keep existing — and it is bounded to the one file.

### Owned paths

- `src/lib/map/routes.ts` — edit. Per-day length and per-segment geometry beside the existing
  collection builder.
- `src/lib/map/__tests__/routes.test.ts` — edit, or new if absent.
- `src/components/map/day-routes.tsx` — edit. Emits the segment pills it already has the geometry
  for.
- `src/components/map/route-pill.tsx` — new. One pill, drawn through `MapMarker`.
- `src/components/map/index.ts` — edit. Two exports.
- `src/routes/_app/trips/$tripId/-ui/plan-model.ts` — edit. `routeDaysOf` (`:300`) also returns each
  day's length and each segment's.
- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-model.test.ts` — edit. This plan's `02-S7`
  creates the file in wave 4; this stage appends its own `describe` block to it. If `02-S7` has not
  landed when this stage runs, this stage creates the file and the `__tests__` directory instead — it
  exists at neither HEAD nor in any other plan's owned paths.
- `src/routes/_app/trips/$tripId/-ui/planner-day-tools.tsx` — edit. The day footer: the total, the
  optimize action and the undo that follows it. The map hand-off control in the same footer is
  #663's (`src/lib/geo/handoff.ts`), landed before this stage.
- `src/components/planner/day-section.tsx` — edit. The lock affordance on a stop row's existing
  action slot.
- `src/routes/_app/trips/$tripId/-server/plan.ts` — edit. One server function for the lock.
- `src/server/repos/itinerary.ts` — edit. One repository function for the lock.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

This is the wave-5 owner of `src/components/map` and `src/lib/map`.

**Four of its paths are touched by other plans in other waves, each named here with the sibling stage
id**, per the checker's own report:

| Path                                              | Also owned by                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/components/planner/day-section.tsx`          | `01-S2` (wave 1), `01-S4` (wave 2), `03-S5` (wave 4), `03-S8` (wave 6), and this plan's `02-S4` (wave 3) |
| `src/routes/_app/trips/$tripId/-ui/plan-model.ts` | `01-S2` (wave 1), `01-S4` (wave 2), `03-S8` (wave 6), and this plan's `02-S7` (wave 4)                   |
| `src/routes/_app/trips/$tripId/-server/plan.ts`   | `07-S1` (wave 1), `01-S4` (wave 2), `03-S8` (wave 6), and this plan's `02-S7` (wave 4)                   |
| `src/server/repos/itinerary.ts`                   | `01-S4` (wave 2), `07-S9` (wave 3)                                                                       |

**One further path is shared inside this plan and is not covered by any rule above**, which the
collision checker cannot report because a path claimed twice inside one file never reaches its
cross-plan list: `src/routes/_app/trips/$tripId/-ui/__tests__/plan-model.test.ts`, created by `02-S7`
in wave 4 and edited here in wave 5. Different waves, so it is a hand-off rather than a clobber, and
`02-S7` names this stage in return. The file runs in vitest's **`server`** project —
`vitest.config.ts` includes `src/routes/**/*.test.ts` there and not in `ui` — so this stage's block
stays plain Node with no DOM; the pill's rendering assertions belong in
`src/components/map/__tests__/` instead. This stage's other within-plan shares are already accounted
for: `src/components/map/index.ts` by the one-owner-per-wave rule for `src/components/map`, of which
this is wave 5's owner, and `planner-day-tools.tsx` by `02-S4`, which creates it in wave 3, and
`02-S12`, which edits it in wave 6. `src/lib/map/routes.ts`, `day-routes.tsx` and `route-pill.tsx`
are claimed by no other stage in any plan.

This stage is wave 5 and shares a wave with none of them. `03-S8` follows it into three of the four
in wave 6, so the lock affordance this stage puts on a stop row must be additive rather than a
rearrangement of the row — a stage that reshapes a row two other plans are about to edit has
converted a merge into a rewrite.

### Data and migration

**One additive column is required, and it is a `00-foundations.md` requirement rather than something
this stage writes.** `src/server/db/schema.ts` is one of the six shared paths in `README.md` and no
feature stage may claim it.

- Table: `day_assignments`. Column: `is_locked`, `integer` in boolean mode, `NOT NULL DEFAULT 0`,
  with the same non-negative style check the neighbouring boolean columns carry. It belongs on the
  assignment rather than on the place, because locking is a statement about a stop's position in one
  day, and the same place can legitimately be locked on Tuesday and free on Friday.
- No index is needed: every read of the flag is already inside a query filtered by
  `(organization_id, day_id)`, which `day_assignments_day_order_idx` already serves.
- The migration `pnpm db:generate` produces is a single `ALTER TABLE … ADD COLUMN` and **backfills
  nothing** — the default is the correct value for every existing row, which is what makes it
  additive. A rollback to the previous Worker keeps working: nothing reads the column, and nothing
  stops writing one.

Everything else this stage needs exists: `day_assignments.order_index` is a `real`, so a reorder is a
fractional rewrite rather than a renumbering, and `places.lat`/`lng` carry the coordinates the
distance is computed from.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/itinerary.ts` gains `setAssignmentLock(scope, assignmentId,
locked)`, built on the repository's existing tenant-scoped update path so `organization_id` is the
  leading predicate and a foreign assignment id resolves to `NotFoundError`. **No new reorder
  function is written**: the optimizer produces an order and the existing reorder path stores it,
  because two ways to write an order is how two screens come to disagree about one.
- **Server function.** `setStopLockFn` (`POST`) in `src/routes/_app/trips/$tripId/-server/plan.ts`,
  returning the updated assignment. The optimize action calls the existing `reorderPlanFn` (`:256`)
  with the new order and nothing else.
- **Zod.** `z.strictObject({ tripId, assignmentId, locked: z.boolean() })` on the shared id schema,
  with `error` set.
- **Authorisation.** Decided in the handler. The assignment id arrives from the client and is
  resolved inside the caller's own `TenantScope`; the rail's `editable` flag is UX.
- **The optimizer runs in the browser, and that is a deliberate placement.** It is a nearest-neighbour
  walk over at most a few dozen coordinates the client already has, it produces a _proposal_ the
  reader can undo, and the only thing that is authoritative is the reorder write that follows — which
  is validated and tenant-scoped exactly as a drag is. Putting it on the server would add a round
  trip to a computation that takes under a millisecond.
- Nothing is enqueued and no `TripRoom` patch type is added; a reorder already reaches other viewers
  through the existing commit signal.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`.
- **Components.** New: `route-pill.tsx`. Edited: `day-routes.tsx`, `plan-model.ts`,
  `planner-day-tools.tsx`, `day-section.tsx`. Reused from `src/components/ui`: `Button`,
  `IconButton`, `Tooltip`, `Toast` (through the existing `sonner`-backed helper), `Kbd`, `Chip`.
  Reused from `src/components/map`: `MapMarker`, so a pill pans and zooms with the world instead of
  being re-projected every frame.
- **The pill.** Between consecutive stops of the day being read, from zoom 12 up, a small pill
  carrying the segment's distance in `tabular-nums` — hidden below zoom 12, where pills would crowd
  the line into illegibility, and hidden entirely for days that are not the one in focus. It sits on
  the segment's midpoint in the map's own glass treatment, so it reads as chrome over the map rather
  than as a label the basemap owns.
- **The day footer.** Under each day: the day's own total distance and stop count in `tabular-nums`;
  **Shorten this day**, which reorders unlocked stops by nearest neighbour from the first stop and
  leaves locked stops exactly where they are. The day's way out to a map application is not here:
  #663 owns it, so this stage's footer controls are laid out beside it, not in place of it.
- **Undo is part of the action, not a separate feature.** After a reorder the footer shows **Undo**
  for as long as the toast lives, restoring the previous order through the same reorder call. The
  previous order is held in component state; it is not persisted, and the affordance disappears on
  navigation rather than pretending it can still be honoured.
- **The lock.** A small toggle on the stop row's existing action slot, `aria-pressed`, with a locked
  stop showing a filled indicator and a tooltip saying it will not be moved. A day where every stop
  is locked disables **Shorten this day** with a tooltip saying why, rather than doing nothing.
- **States.** _Empty_ — a day with no stops shows no footer total and no optimize action, only the
  existing empty-day drop target; a day with one stop shows the stop count and no distance, because
  the distance of one stop is not zero, it is undefined. _Skeleton_ — the footer's numbers arrive with
  the board payload the route already awaits; while it is pending the footer reserves its line box at
  its final height so nothing shifts. _Error_ — a failed reorder restores the previous order visibly
  and shows an `Alert` on `--color-surface-2` with a retry; a failed lock returns the toggle to its
  previous state, because a toggle that stays flipped after a failed write is a lie.
- **The optimistic-order seam, stated because it is the one risk in this stage.** The rail's order is
  derived from the board payload through `orderFromPayload` (`plan-model.ts:50`) and held as
  optimistic state in `plan-screen.tsx`, which this stage does **not** own in wave 5. The optimize
  write therefore goes through the same `reorderPlanFn` a drag uses and then invalidates the router,
  so the rail re-derives from the reloaded payload exactly as it does after a drag. **If that
  re-derivation does not happen, this stage stops and records it** rather than editing a file it does
  not own; the check is one of its unit tests and one of its browser assertions, not an assumption.
- **The hooks this stage publishes**, per the Area brief's register: `data-part="route-pill"` on the
  segment pill in `route-pill.tsx`, which it creates; `data-part="day-tools"` on the day footer in
  `planner-day-tools.tsx`, which `02-S4` created in wave 3 and this stage extends;
  `data-part="day-header"` on the day heading and `data-part="stop-lock"` on the lock toggle, both in
  `src/components/planner/day-section.tsx`, which this stage owns in wave 5. All four are new —
  neither `src/components/map` nor `src/components/planner` publishes a `data-part` at HEAD — and the
  two on `day-section.tsx` are attributes on elements that already exist rather than new elements, so
  the additive-edit promise this stage makes to `03-S8` in wave 6 is kept.
- **Tokens.** None missing. The pill uses the existing glass panel treatment and `--color-ink-2` on
  `--color-surface`; the locked indicator uses `--color-ink-3`; the reorder animates rows by
  transform at `--duration` on `--ease-out-quint`, capped at eight staggered rows and collapsed to
  opacity under `prefers-reduced-motion: reduce`.

### Quota

**This stage creates no countable row.** It updates `order_index` and `is_locked` on rows that
already exist and already passed the ceiling when their places were created. `assertQuota` is not
called and must not be: re-ordering a plan is not consuming more of it.

The related metric, named so the boundary is explicit: `places` is asserted at
`src/server/repos/places.ts:269` inside `createPlace`, and nothing in this stage reaches it.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, in the
`rejects a foreign day, place or assignment on the itinerary` block: with organization A's scope,
`setAssignmentLock` is called with B's `assignmentId` and must raise `NotFoundError`; the same call
with A's own assignment must succeed; and afterwards B's assignment must have its original
`is_locked` value and its original `order_index`. Repository functions covered: `setAssignmentLock`
and the existing reorder function the optimizer calls, which is asserted in the same block for a
foreign assignment id in the order payload — a bulk reorder that accepts a list of ids from the
client is the classic place for one foreign id to slip through a loop.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds or extends, by file and invariant:

- `src/lib/map/__tests__/routes.test.ts` — a day's length is the sum of its segments and is
  invariant under reversing the day; two stops at the same coordinate contribute a zero-length
  segment that is excluded rather than drawn; a day crossing the antimeridian measures the short way
  round, not the long way, which is the one case a naive difference of longitudes gets wrong by
  twenty thousand kilometres.
- A nearest-neighbour test — the walk starts at the first stop, never revisits, is deterministic for
  a tie, returns the input unchanged when every stop is locked, keeps every locked stop at its
  original index while reordering only the free ones, and never produces a longer total than the
  input for a day of three stops, where nearest-neighbour is provably optimal.
- `src/routes/_app/trips/$tripId/-ui/__tests__/plan-model.test.ts` — a `describe` block appended to
  the file `02-S7` creates in wave 4, as the Owned paths block records: `routeDaysOf` returns a
  per-day and per-segment length, and re-derives a changed order from a reloaded payload, which is
  the seam named under **UI**.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the cases above.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S9" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
```

- **Resting set:** `/trips/$tripId/plan` as it loads, light and dark, at 360, 1280 and 2560. Six
  frames, and that is everything `capture.mjs` takes here. It carries no `--state`, no `--hover` and
  no `--click`: none of the three states below is one gesture from the loaded route.
- **All three declared states are taken in this plan's own spec**, in this stage's `test.describe`,
  with `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S9/`, six frames each, light and dark at 360, 1280
  and 2560:
  - `day-focused` — one day in focus **at a zoom above 12**, so the segment pills are legible along
    its line. Two steps, not one: the spec clicks `[data-part="day-header"]`, then drives the map to
    that zoom and re-settles through `settleMap()`. A single `--click` would have photographed the
    pills at the opening fit zoom, where they are the size the camera chose rather than the size this
    stage designed.
  - `after-optimize` — the moment after a reorder, with the undo affordance present. Reached by
    clicking the day tools' **Shorten this day**, which is itself behind the day footer.
  - `reorder-error` — `page.route()` failing the reorder request. The frame must show the rail back
    in its **previous** order with the alert; a frame showing the new order under an error message
    would be the bug this assertion exists to catch.
- **Selector discipline.** `[data-part="day-header"]`, `[data-part="stop-lock"]`,
  `[data-part="day-tools"]` and `[data-part="route-pill"]` are all published by this stage, in
  `day-section.tsx`, `planner-day-tools.tsx` and `route-pill.tsx`, every one of them a file it owns
  in wave 5. All four are new. The `test.describe` opens with a test asserting `toHaveCount(1)` for
  each in the state that should contain it, and **that test runs before any frame is filed**.
- The spec declares `map: true` and re-settles after every resize and theme change. `auditServerClock()`
  is called once in its own describe.
- **Console must be silent** in every test. **Layout shift after paint** asserted `0` in Chromium
  after the settle mark, including through a reorder — a list that reflows its container when rows
  move is exactly this clause's case. Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      optimize action, the undo, and every stop's lock toggle.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — including the one-stop day, which has a designed answer rather than a
      zero.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured — a reorder under reduced motion re-renders in
      place instead of animating rows past each other.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused — the
      pill is glass over a map and is the hardest element in this stage to keep legible in both.
- [ ] Responsive 360px → 2560px: at 360 the day footer's actions collapse into a single menu and the
      pills are suppressed, because a 360px map with six pills on it is unreadable; at 2560 the pills
      keep their type size rather than scaling with the canvas.
- [ ] Keyboard navigable end to end: every footer action is a real button in the day's own focus
      order, the lock toggle announces its state, the undo is reachable before the toast expires, and
      WCAG 2.2 AA contrast holds in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **Gate B — routing.** No routed segment time, no road distance, and therefore no claim that any
  number on this screen is a travel time. Recorded in `02-S1`, owned by
  `docs/plans/11-boundaries-and-blockers.md` (`11-S3`). Disposition: **defer**. The stage ships
  great-circle distance, which is arithmetic and needs nobody's permission, and the pill is shaped so
  a time can be added beside the distance later without a redesign. No provider is named and no
  client is written for one.
- **A `00-foundations.md` requirement: `day_assignments.is_locked`.** Stated in full under **Data and
  migration**. It is additive, it backfills nothing, and it must land in wave 0. This stage cannot
  start without it, and it must not write `src/server/db/schema.ts` itself.
- **`12-verification-protocol.md` §7.2** applies to this stage's trip-tab frames.
- No package outside the pinned set. No binding.

## Stage 02-S10 — Categories you can manage, and tags you can actually apply

### Stage id

`02-S10` · Wave 5 · effort **M**.

### Reference rows

`MAP-10 partial → done`.

The read half already works and is not rebuilt: `listCategories` feeds the planner, `CategoryIcon`
resolves the icon, `place-marker.tsx` rings a pin in the category colour, `CategoryFilterBar` filters
the map, `MapLegend` names the colours, and `MarkerPopover` shows the category on hover. What is
missing is every write and one whole surface: `createCategory` is reachable only from the seeder,
`updateCategory` and `deleteCategory` have no caller at all, and of `src/server/repos/tags.ts` only
`resolveTags` is ever called — again by the seeder. There is no screen anywhere in the product where
a workspace can name its own vocabulary, and a place cannot be tagged at all.

Behaviour sourced as `wiki: Tags-and-Categories`. Two divergences, both stated rather than inherited,
and the first is the one the Area brief flags as a contradiction of the row's own wording:

- **Tags are workspace-scoped here, not per user.** `tags` carries `organization_id` and no owner
  column, and `place_tags` carries `organization_id` too (`src/server/db/schema.ts`). In a product
  where the workspace is the sharing boundary, a private label inside a trip that three people are
  editing is a surprise rather than a feature — and one member's invisible "skip this" is exactly the
  kind of thing the other two need to see. Nothing here asks `00-foundations.md` for an owner column.
- **Categories are managed by the workspace, not by an instance operator.** The reference reserves
  them for an instance administrator because one deployment serves one customer. One deployment
  serving every customer cannot have that shape at all; the permission that replaces it is the role
  already on the `TenantScope`.

### Owned paths

- `src/routes/_app/settings/places.tsx` — new route file. **Adding it means running
  `pnpm generate-routes`**; `src/routeTree.gen.ts` is generated, travels with this stage's diff, and
  is never hand-edited and never listed here.
- `src/routes/_app/-ui/taxonomy-editor.tsx` — new. The two lists, their editors and their delete
  confirmations.
- `src/routes/_app/-ui/settings-nav.tsx` — edit. One entry.
- `src/server/fns/taxonomy.ts` — new. The read and the six writes.
- `src/server/repos/categories.ts` — edit. The quota assertion described under **Quota**, and a
  delete that reports what it will orphan.
- `src/server/repos/tags.ts` — edit. The same quota assertion.
- `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` — edit. The tag picker on the place form.
- `src/server/repos/__tests__/taxonomy.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

**Two of its paths are touched by other plans in other waves, each named here with the sibling stage
id**, per the checker's own report:

| Path                                                 | Also owned by                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/routes/_app/-ui/settings-nav.tsx`               | `09-S8` (wave 3), `10-S3` (wave 4)                                       |
| `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` | `01-S4` (wave 2), and this plan's `02-S5` (wave 3) and `02-S11` (wave 6) |

The first is the measured reason this stage sits in wave 5 rather than at its wave-1 floor, and the
order is the right one: the nav entry is added to the shell `09-S8` and `10-S3` have already
reworked, rather than to one they are about to replace.

`src/server/repos/places.ts` is **not** owned: `setPlaceTags` (`:346`) and `listPlaceTagIds` (`:372`)
already exist and this stage calls them unchanged.

### Data and migration

**No schema change and no migration.** Everything exists: `categories` with `name`, `slug`, `colour`,
`icon`, `is_system` and `sort_order`; `tags` with `name`, `slug` and `colour`; `place_tags` as the
many-to-many join with `organization_id` and a composite primary key; and `places.category_id`
declared `ON DELETE SET NULL`, which is what makes deleting a category safe.

Two consequences of the existing foreign keys that the screen must tell the truth about, rather than
schema changes to avoid them:

- Deleting a **category** sets `category_id` to null on every place that carried it. Those places
  keep existing and become uncategorised, so the confirmation names the count and says exactly that.
- Deleting a **tag** cascades through `place_tags` and removes it from every place. Same treatment:
  the count is named before the reader confirms.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/categories.ts` and `src/server/repos/tags.ts`. Every function
  this stage needs already exists — `listCategoriesWithUsage` (`:78`), `createCategory` (`:116`),
  `updateCategory` (`:125`), `deleteCategory` (`:138`), `listTagsWithUsage` (`tags.ts:55`),
  `createTag` (`:93`), `updateTag` (`:99`), `deleteTag` (`:107`) — and all of them are built on
  `createTenantRepository`, so `organization_id` is stamped on insert and is the leading predicate of
  every read. What this stage adds to each repository is the quota assertion under **Quota** and a
  delete that returns the affected count so the confirmation is not a guess.
- **Server function.** `src/server/fns/taxonomy.ts`: `loadTaxonomy` (`GET`), returning both lists
  with usage counts; `createCategoryFn`, `updateCategoryFn`, `deleteCategoryFn`, `createTagFn`,
  `updateTagFn`, `deleteTagFn` (all `POST`); and `setPlaceTagsFn` (`POST`) over the existing
  `setPlaceTags`. It is a `src/server/fns/` module rather than a route-local one because the place
  form and the settings screen are two different routes reading the same vocabulary.
- **Zod.** `z.strictObject` on each input with `error` set; `titleSchema` for a name; a hex colour on
  the existing shared colour schema; the icon as `z.enum` over the icon names the product actually
  renders, so an arbitrary string cannot reach `CategoryIcon` and produce a hole where a pin should
  be. Validation is shape.
- **Authorisation.** Decided in each handler, from the role on the `TenantScope` that
  `requireTenantContext()` builds — a workspace's vocabulary is not something any member may
  redefine mid-trip for everybody else, so the six writes require the workspace's own write role and
  the read does not. `beforeLoad` on the settings route is UX; the server function is the boundary,
  and a viewer calling it directly is refused.
- Nothing is slow, nothing is enqueued, no realtime patch type is added.

### UI (route, components)

- **Route.** `/settings/places`, a new file at `src/routes/_app/settings/places.tsx`, default SSR
  like its sibling settings routes. `pnpm generate-routes` is a step of this stage.
- **Components.** Reused from `src/components/ui`: `Card`, `SectionLabel`, `Table`, `Button`,
  `IconButton`, `Dialog`, `Field`, `Input`, `Chip`, `Badge`, `Skeleton`, `EmptyState`, `Alert`,
  `Spinner`, `Tooltip`, and — for the place form — `MultiCombobox` from `combobox.tsx`, which is
  **defined, tested and imported by no screen today**. Using it here is the point: a second tag
  picker would be a duplicate of a primitive that already exists. Reused from `src/components/map`:
  `CategoryIcon`, so the icon in the editor is the icon on the pin, resolved by one function.
- **The screen.** Two sections on one page. Each row shows the colour swatch, the icon, the name and
  the usage count in `tabular-nums`, with rename, recolour and delete on the row; categories add
  drag-free reordering through explicit move controls, because the order is what the filter bar and
  the legend show. Creating is one inline row at the top of each list rather than a modal, so naming
  five categories is five keystrokes-and-enter rather than five dialogs.
- **The tag picker on the place form.** A `MultiCombobox` under the category field: type to filter,
  `Enter` to attach, and typing a name that does not exist offers to create it — the same inline
  creation the category field gets, subject to the same role check on the server, so a viewer sees
  the option absent rather than sees it fail.
- **States.** _Empty_ — a workspace with no tags gets a designed `EmptyState` on `--color-surface-2`
  that explains what a tag is for and puts the create field in it, not an empty table; categories are
  never empty because `ensureDefaultCategories` (`categories.ts:167`) seeds them, and this stage says
  so rather than designing a state that cannot occur. _Skeleton_ — both tables show row skeletons at
  the row's real height. _Error_ — a failed write shows an `Alert` on `--color-surface-2` with the
  reason and a retry, and the row reverts; a delete that would orphan places says how many before it
  is confirmed, and the confirmation names the consequence in the button rather than saying "OK".
  _Loading_ — the acting row is disabled with a `Spinner` in place of its action icon; the rest of
  the table stays usable, because a whole table going grey for one rename is a worse answer than a
  single row doing so.
- **The hooks this stage publishes**, per the Area brief's register: `data-part="taxonomy-row"` on
  each row, `data-part="taxonomy-edit"` on its rename control and `data-part="taxonomy-delete"` on
  its delete control, all in `taxonomy-editor.tsx`, which this stage creates; and
  `data-part="place-tags"` on the `MultiCombobox` trigger in `plan-actions.tsx`, which this stage
  owns in wave 5. All four are new — nothing under `src/routes/_app/settings/**` or
  `src/routes/_app/trips/**` publishes a `data-part` at HEAD.
- **Tokens.** None missing. Swatches carry the stored hex as a CSS custom property, which is data and
  not a hard-coded colour; every surface, radius, shadow and easing comes from the token set, and the
  contrast of a stored swatch against both themes is handled by pairing it with a token-driven
  border rather than by trusting the reader's choice of colour.

### Quota

**This stage creates countable rows: categories and tags — and neither is metered today.** Measured:
`grep -n assertQuota src/server/repos/categories.ts src/server/repos/tags.ts` returns nothing, so
both writes are currently unbounded. They were reachable only from the seeder, which is why it has
not mattered; giving a workspace a screen for them changes that.

- **A `00-foundations.md` requirement.** One operational metric, `taxonomy`, counting categories plus
  tags per workspace, added to `PLAN_QUOTAS` in `src/server/db/types.ts` and resolved through
  `resolveLimits()` in `src/server/billing/limits.ts`, with its case in
  `src/server/billing/__tests__/limits.test.ts`. It is an operational metric rather than a catalogue
  one because the plan catalogue does not sell it — the same reasoning that puts `places` in
  `PLAN_QUOTAS` and keeps it out of `CATALOGUE_METRICS`. Neither file is claimed here; both are wave-0
  work, and this stage is wave 5, so the dependency is satisfiable by construction.
- **Call sites, both in this stage's own repositories, both before the write:**
  `assertQuota(scope, 'taxonomy', currentCategoryCount + currentTagCount)` at the top of
  `createCategory` in `src/server/repos/categories.ts` and of `createTag` in
  `src/server/repos/tags.ts`. The published number is the enforced number.
- No R2 object is written, so the object-first ordering does not apply.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`: with organization A's scope,
reading, updating and deleting B's categories and B's tags by id must each raise `NotFoundError`;
`setPlaceTags` on A's own place with B's `tagId` must not create a link — the existing case
`drops a foreign tag id instead of linking it` already asserts that shape and this stage extends it
rather than duplicating it; creating a category whose slug collides with B's must succeed, because
the unique index is `(organization_id, slug)` and two workspaces naming a category the same thing is
normal; and after all of it B's categories, tags and `place_tags` rows must be unchanged. Repository
functions covered: `listCategoriesWithUsage`, `createCategory`, `updateCategory`, `deleteCategory`,
`listTagsWithUsage`, `createTag`, `updateTag`, `deleteTag` and `setPlaceTags`.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. `pnpm
generate-routes` runs before the gate, because the new route file must be in the tree the typecheck
reads.

Unit tests this stage adds, by file and invariant:

- `src/server/repos/__tests__/taxonomy.test.ts` — a category's slug is derived from its name and
  stays unique within the workspace, with a numeric suffix rather than an error on collision;
  renaming a category does not re-slug it, because the slug is an identity other rows point at;
  deleting a category returns the number of places it orphaned and leaves every one of them existing
  with a null `category_id`; deleting a tag removes its `place_tags` rows and no others; a system
  category cannot be deleted; and the quota assertion counts categories and tags together and refuses
  the write that would cross the ceiling, leaving nothing written.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the cases above.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/settings/places" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S10" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth
```

- **Resting set:** `/settings/places`, light and dark, at 360, 1280 and 2560. Six frames. The route
  carries no map, so no `--map` and no `map: true` declaration — and `settleMap()` audits that in
  both directions, so a wrong declaration here fails rather than passes quietly.
- **Two states are one click from that route, so `capture.mjs` takes both**, as two further
  invocations of the command above:
  `--state category-editing --click '[data-part="taxonomy-edit"]'`, a row in its rename-and-recolour
  state; and `--state delete-confirm --click '[data-part="taxonomy-delete"]'`, the confirmation
  naming how many places it will orphan, which is the copy most likely to be got wrong and is
  therefore the frame worth having. Two invocations, not one command: a second `--click` on the same
  line would overwrite the first, because the script's argument parser is a flat key map
  (`scripts/ultrabuild/capture.mjs:64-80`).
- **Two states are not, and are taken in this plan's own spec**, in this stage's `test.describe`,
  with `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S10/`, six frames each, light and dark at 360, 1280
  and 2560:
  - `tags-empty` — the designed empty state, which needs a workspace with no tags rather than a
    gesture.
  - `tag-picker` — **a second surface, and it owes its own six frames**: the place form's tag picker
    on `/trips/$tripId/plan`, open with two tags attached. Three steps from that route — click
    `[data-part="add-place"]`, which `02-S4` published in wave 3 and which has therefore landed by
    wave 5, then `[data-part="place-tags"]`, then attach — so it is out of `capture.mjs`'s reach.
    That route's frames inherit `12-verification-protocol.md` §7.2.
- **Selector discipline.** `[data-part="taxonomy-row"]`, `[data-part="taxonomy-edit"]` and
  `[data-part="taxonomy-delete"]` are published by this stage in `taxonomy-editor.tsx`, and
  `[data-part="place-tags"]` in `plan-actions.tsx`; it owns both files in wave 5. All four are new.
  The `test.describe` opens with a test asserting `toHaveCount(1)` for each in the state that should
  contain it — for `taxonomy-row`, at least one — and **that test runs before any frame is filed**.
- The spec calls `auditServerClock(page, <its own route table>)` once in its own describe. The new
  settings route prints no clock-derived string, so no `RELATIVE_TIME_SITES` entry is added and
  `e2e/helpers/shoot.ts` is not claimed.
- **Console must be silent** in every test. **Layout shift after paint** asserted `0` in Chromium
  after the settle mark, including as a row enters its editing state — an inline editor that is
  taller than the row it replaces is the classic shift here, so the row reserves the taller height.
  Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — every
      row action, the inline create field, the colour and icon pickers, the confirm button.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — both tables, plus the picker's no-match state.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused — a
      stored swatch must stay distinguishable on both canvases, which is why it is paired with a
      token-driven border rather than trusted on its own.
- [ ] Responsive 360px → 2560px: at 360 each row is a two-line card with its actions in a menu; at
      2560 the two sections sit side by side rather than as one column in the middle of a field.
- [ ] Keyboard navigable end to end: the tables are real tables with a sensible focus order, the
      picker is a combobox with the expected key handling, delete confirmations trap focus and return
      it, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **A `00-foundations.md` requirement: the `taxonomy` quota metric**, stated in full under **Quota**.
  It must land in wave 0. This stage does not write `src/server/db/types.ts`,
  `src/server/billing/limits.ts` or their test, and it does not invent a ceiling of its own inside a
  feature module.
- No provider, no binding, no package outside the pinned set.
- One scheduling note rather than a blocker: `09-S8` reworks the settings shell in wave 3 and
  `10-S3` adds a console entry in wave 4, both in `settings-nav.tsx`. This stage is wave 5 and adds
  its entry to whatever that file has become, which is the correct order — a nav entry added before
  the shell rework would be rewritten by it.

## Stage 02-S11 — The place form, as a contract rather than a set of inputs

### Stage id

`02-S11` · Wave 6 · effort **M**.

### Reference rows

`MAP-03 partial → done`.

What ships today: `PlaceDialog` (`plan-actions.tsx:325`) edits name, city, address, category,
duration, rating, coordinates and a visited flag, and `TimingDialog` (`:625`) edits a stop's start
and end time on the assignment. The `places` table already carries `description`, `notes`, `website`,
`phone`, `opening_hours`, `price_minor`, `currency` and `duration_minutes`, and the form reaches only
a subset of them.

What is missing: description and notes as two distinct fields rather than one; creating a category
without leaving the form; attachments; any warning when the times a reader types make no sense —
neither an end before a start nor an overlap with another stop on the same day; and **address
completion**, which was the half of this row behind Gate A and is in scope now that
`docs/adr/0013-geoapify-for-geocoding.md` has closed it.

Behaviour sourced as `wiki: Places-and-Search`. Two divergences stated rather than inherited:

- **The notes cap.** The reference caps notes at two thousand characters. Ours is already twenty
  thousand — `longTextSchema` at `src/server/repos/validation.ts:21` — and narrowing a validator is
  not an additive change: an existing row could exceed the new limit and become unsavable. So the
  form keeps our cap, shows a counter only as the text approaches it, and the divergence is recorded
  here rather than discovered by whoever tries to save a long note.
- **The warnings are warnings.** An end before a start and an overlap with another stop are both
  shown inline and neither blocks the save, because a reader mid-edit routinely passes through an
  invalid pair on the way to a valid one, and a form that refuses to save a plan the reader knows is
  provisional is a form they will fight.

### Owned paths

- `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` — edit. Both dialogs.
- `src/routes/_app/trips/$tripId/-ui/__tests__/place-form.test.tsx` — new.
- `src/server/repos/places.ts` — edit. `updatePlace` and `createPlace` accept the fields the form now
  reaches; no new function.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

`src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` is touched by one other plan in another wave and
the sibling is named here: **`01-S4` (wave 2)** of `docs/plans/01-trips-core.md`. Inside this plan it
is claimed by `02-S5` (wave 3) and `02-S10` (wave 5); this stage is wave 6 and is the last of the
three, so it builds on both rather than racing them. `02-S12` is the other wave-6 stage in this plan
and shares no path with this one. `src/server/repos/itinerary.ts` is **not**
owned: the overlap check reads the day's rows the screen already has, and adding a server round trip
to warn about two times the reader can see would be slower and no more correct.

### Data and migration

**No schema change and no migration.** Every field this stage surfaces already exists on `places`
(`src/server/db/schema.ts`), and the times already exist on `day_assignments` as `start_time` and
`end_time`, `HH:MM` text, which is the convention `TEMPLATE.md` fixes and this stage does not
re-invent.

**Attachments are the one exception, and they are not this stage's to design.** A place-level
attachment is a file link, and multi-target file links are DOC-04 in
`docs/plans/06-documents-and-media.md`, wave 4. This stage renders the attachment surface **only if**
that row has landed, and otherwise ships without it and records the deferral — it does not build a
second file-linking model, which would be exactly the duplicate `README.md` calls a defect.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/places.ts`. `placeFields` (`:57-80`) already types `description`,
  `notes`, `website`, `phone`, `openingHours`, `priceMinor`, `currency` and `rating`; this stage adds
  no field to the schema and no function to the module. The one change is that `updatePlace` and
  `createPlace` are now _called_ with fields that were previously never sent — which is a client
  change, and the reason this heading is short is that the server was ready.
- **Server function.** `createPlanPlaceFn` and `updatePlanPlaceFn` in `-server/plan.ts` are **not**
  owned by this stage and are not edited: their validators already forward the full `placeFields`
  set. If a field turns out to be filtered on the way through, this stage reports it as a finding and
  stops, rather than editing a file `07-S1` and `01-S4` both claim in earlier waves.
- **Zod.** Unchanged, and this is the substance of the authorisation answer too: the client sends
  more fields, the same schema validates them, and nothing about a richer form relaxes
  `requireTrip`. The category created inline goes through `createCategoryFn` from `02-S10`, with the
  same role check and the same quota.
- Nothing is slow and nothing is enqueued.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`.
- **Components.** Reused from `src/components/ui`: `Dialog`, `Field`, `Input`, `Textarea`, `Select`,
  `Combobox`, `Switch`, `Slider`, `Alert`, `Button`, `Chip`, `Tooltip`. Reused from this plan:
  `02-S5`'s coordinate parsing and `02-S10`'s tag picker. New: none — every part of this stage is a
  field arrangement over primitives that exist.
- **Description and notes are two fields because they answer two questions.** Description is what
  the place is, one or two lines, and it is what a shared trip shows a guest. Notes are what the
  reader has to remember about it, they are long, and they are the field a counter belongs on. The
  form labels them so the difference is legible without a tooltip.
- **Inline category creation.** Typing a name the workspace does not have offers **Create "<name>"**
  as the last option in the category combobox; accepting it creates the category with the default
  colour and pin icon and selects it, without closing the form. For a member without the role, the
  option is not offered — an affordance that fails is worse than one that is absent.
- **Address completion, and why it is not a second search box.** `02-S13` puts a **place search**
  field at the top of this form in wave 4: the reader types _what_ they are looking for and choosing
  a result fills the whole form. This stage adds something narrower and lower down — the existing
  **address** input gains suggestions as it is typed, and choosing one replaces the address text and
  fills the coordinates if they are still empty. One is "find me this place", the other is "finish
  this line". They are two controls on purpose, they call the same `searchPlacesFn`, and **this stage
  builds no second client, no second debounce policy and no second results component**: it reuses the
  list `02-S13` owns, which is two waves earlier and therefore already there. The keyboard contract
  is that list's — up, down, `Enter`, `Escape` — and the suggestions never overwrite a coordinate the
  reader has already set.
- **Times, and when they appear.** Start and end are offered only where they mean something: on a
  stop assigned to a day. An unscheduled idea has no times, and showing empty time fields on it would
  invite a reader to fill in something that cannot be stored. Two warnings appear inline as the times
  change: an end at or before the start, and an overlap with another stop on the same day, the second
  naming the stop it collides with. Both are `warning`-toned, both live in a reserved line box so
  their appearance shifts nothing, and both leave the save enabled.
- **States.** _Empty_ — the form's own empty is its create mode, which opens with only the name
  required and everything else optional, and this stage keeps it that way rather than growing a wall
  of fields. _Skeleton_ — the category list is the only async part; the tag picker shows its own
  loading row from `02-S10`. _Error_ — a rejected save shows an `Alert` on `--color-surface-2` with
  the reason and a retry that resubmits the draft; a field-level rejection marks the field and moves
  focus to it. _Loading_ — the submit carries its `loading` state and the dialog cannot be dismissed
  mid-write.
- **The hooks this stage publishes**, per the Area brief's register, all four in `plan-actions.tsx`,
  which it owns in wave 6: `data-part="stop-edit"` on `StopMenu`'s **Edit place** item (`:175`),
  `data-part="place-notes"` on the notes textarea, `data-part="time-warning"` on each of the two
  inline warnings, and `data-part="address-suggestions"` on the completion list under the address
  input. All four are new, and the last is distinct from `02-S13`'s `data-part="place-search"` — two
  controls, two hooks, no shared name. `StopMenu` is the right home for the first: the menu already
  lives in this file, so the hook that opens the form and the form itself travel in one diff.
- **Tokens.** None missing. The counter and both warnings use existing tone tokens; the counter is
  `tabular-nums` because it changes on every keystroke, which is exactly the case
  `DESIGN.md` names.

### Quota

**This stage creates countable rows in two ways, and names both.**

- A place, when the form is used to create one: metric `places`, in `PLAN_QUOTAS`
  (`src/server/db/types.ts:43`, `:50`, `:57`, `:64`), asserted by
  `assertQuota(scope, 'places', …)` at `src/server/repos/places.ts:269` inside `createPlace`, before
  the insert. Unchanged by this stage. Both writes go through `placesRepository`, which stamps
  `organization_id` from the `TenantScope` and builds every read from `tenantFilter()`, so the wider
  field set cannot widen the tenant boundary.
- A category, when one is created inline: metric `taxonomy`, the wave-0 metric `02-S10` requires,
  asserted inside `createCategory` in `src/server/repos/categories.ts`. This stage adds no second
  call site and reuses `02-S10`'s server function precisely so there is only one.
- Editing an existing place consumes nothing, and `assertQuota` is correctly absent from
  `updatePlace`.

**And address completion spends a ceiling this stage neither owns nor files.**
`geocode_lookups_per_month` is in `resolveLimits()` and is spent through the rate meter by
`src/server/geo/geocode.ts`, both shipped by #281. This stage adds no metric, no call site and no
counter of its own — it calls `searchPlacesFn` and renders the refusal when the ceiling answers. That
refusal is a designed state, worded as what it is: this workspace has used its lookups for the
month, and the address can still be typed.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`: with organization A's scope,
`updatePlace` on B's place id must raise `NotFoundError` for every one of the newly reachable fields
— including `notes` and `website`, because a partial update path that filters its payload can
accidentally take a different code path from the one the existing case covers — and B's row must be
byte-identical afterwards. The existing `cannot be updated across the boundary` case is extended with
the wider payload rather than copied. Repository functions covered: `updatePlace`, `createPlace` and
`categoriesRepository.requireById`.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds, by file and invariant:

- `src/routes/_app/trips/$tripId/-ui/__tests__/place-form.test.tsx` — an end time at or before the
  start raises the warning and leaves the submit enabled; an overlap with a sibling stop on the same
  day raises the second warning and names that stop, and a stop overlapping one on a _different_ day
  does not; time fields are absent in create mode and present for a scheduled stop; the notes counter
  appears only near the cap and reports the cap the server actually enforces; and creating a category
  inline selects it without closing the dialog and without losing any other field the reader had
  already filled — the failure that makes an inline create worse than no inline create.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — the extended case above.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S11" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map
```

- **Resting set:** `/trips/$tripId/plan` as it loads, light and dark, at 360, 1280 and 2560. Six
  frames, and that is everything `capture.mjs` takes here. It carries no `--state`, no `--hover` and
  no `--click`: **reaching the form in edit mode is two clicks** — the stop row's
  `Actions for <name>` trigger, then `[data-part="stop-edit"]` inside the menu it opens — and the
  script applies one click, once, with a second `--click` overwriting the first
  (`scripts/ultrabuild/capture.mjs:64-80`, `:218-225`).
- **All four declared states are taken in this plan's own spec**, in this stage's `test.describe`,
  with `page.screenshot({ path, fullPage: true, animations: 'disabled', caret: 'hide' })` into
  `.claude/ultrabuild/shots/<slug>/round-<n>/02-S11/`, six frames each, light and dark at 360, 1280
  and 2560:
  - `form-edit` — the form open in edit mode over the map, reached with
    `page.getByRole('button', { name: /^Actions for / }).first().click()` then
    `[data-part="stop-edit"]`. The first of those is an accessible name that exists **today**
    (`plan-actions.tsx:168`), so the path does not depend on a hook this stage has not yet added.
  - `overlap-warning` — both time warnings visible at once, after the spec fills two overlapping
    times.
  - `inline-category` — the combobox showing the create option for a name the workspace does not
    have.
  - `save-error` — `page.route()` failing the save request. The frame must still show every field the
    reader had filled, which is the assertion this state exists for.
- **Selector discipline.** `[data-part="stop-edit"]`, `[data-part="place-notes"]` and
  `[data-part="time-warning"]` are published by this stage in `plan-actions.tsx`, which it owns in
  wave 6, and all three are new. The row's menu trigger is reached by accessible name rather than by
  a hook, because it is rendered from `plan-screen.tsx`, which this stage does not own. The
  `test.describe` opens with a test asserting `toHaveCount(1)` for the first two and `toHaveCount(2)`
  for `time-warning` in the overlap state, and **that test runs before any frame is filed**.
- The spec declares `map: true` for the planner route and calls `auditServerClock()` once in its own
  describe.
- **Console must be silent** in every test. **Layout shift after paint** asserted `0` in Chromium
  after the settle mark, which is why both warnings and the counter live in reserved line boxes.
  Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — the category combobox and the tag picker each have all three.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured — a warning fades in, it never slides the form.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px: at 360 the form is a full-height sheet with a sticky action bar
      above the safe-area inset and the fields in one column; at 2560 it keeps its designed width.
- [ ] Keyboard navigable end to end: a sensible field order, both warnings associated with their
      fields through `aria-describedby` and announced politely, the inline create reachable by
      keyboard alone, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **Gate A — geocoding. CLOSED.** `docs/adr/0013-geoapify-for-geocoding.md` chooses the provider,
  and address completion on the form is therefore **built** rather than deferred. This stage writes
  no client and names no provider: it calls `searchPlacesFn`
  (`src/routes/_app/trips/$tripId/-server/geocode.ts`), which `02-S4` creates in wave 3 over the
  single proxy in `src/server/geo/geocode.ts` that #281 minted. Three obligations travel with the
  call and are met here — the debounce, the minimum query length and the cancel-on-supersede that
  keep a per-keystroke field from spending the monthly ceiling; the ceiling itself, which is the
  proxy's to enforce and this stage's to surface as a designed refusal rather than a generic error;
  and the attribution, which is already on the map from `02-S4` and is **not** repeated on the
  form.
  **A failed or refused lookup leaves the address typed**, which is exactly the shape this stage
  would have shipped had the gate stayed open — so the degraded path is designed rather than
  hypothetical.
- **DOC-04, `docs/plans/06-documents-and-media.md`, wave 4 — multi-target file links.** Attachments
  on a place depend on it. If it has landed, this stage renders the attachment surface using its
  model; if it has not, this stage ships without attachments and the behaviour is recorded against
  DOC-04 rather than reimplemented here. **It does not build a second file-linking model under any
  circumstances.**
- **`12-verification-protocol.md` §7.2** applies to this stage's trip-tab frames.
- No package outside the pinned set. No binding.

## Stage 02-S12 — Transport drawn on the map, and only when it is asked for

### Stage id

`02-S12` · Wave 6 · effort **L**.

### Reference rows

`MAP-09 absent → done`.

Nothing draws transport on any map today: there is no overlay layer in `src/components/map/`, and
`transports` carries `departure_lat`, `departure_lng`, `arrival_lat`, `arrival_lng`, `mode`, `status`
and both endpoint codes in `src/server/db/schema.ts` with nothing reading them for the map. The
records exist and the geometry does not.

Behaviour sourced as `wiki: Map-Features`. Three divergences stated rather than inherited:

- **Road-following lines are Gate B and are not built.** Every leg draws as a great-circle arc, which
  is exactly right for a flight or a ferry and is an honest approximation for a road leg that says
  "from here to there" rather than claiming a route. The layer is shaped so a routed geometry can
  replace an arc's coordinates later without touching the styling, which is what makes the deferral
  cheap.
- **Overlay visibility is remembered per trip in the browser, and this plan keeps it there** rather
  than storing it. It is a view preference about a screen, not a fact about a trip, and syncing it
  would mean one member turning a layer off for everybody. It is stated plainly in the UI so nobody
  is surprised that a second device starts fresh.
- **Per-leg toggles on inline transport rows in the day timeline belong to BKG-10**
  (`docs/plans/03-reservations-and-transport.md`, wave 3), which is what puts a transport row in a
  day at all. This stage ships trip-level and per-day toggles, which need no such row, and states the
  seam rather than building a second transport row of its own.

### Owned paths

- `src/lib/map/geodesic.ts` — new. Great-circle interpolation, antimeridian handling and distance.
- `src/lib/map/__tests__/geodesic.test.ts` — new.
- `src/components/map/transport-overlay.tsx` — new. One GeoJSON source, two line layers, the endpoint
  pills and the flight label.
- `src/components/map/index.ts` — edit. Two exports.
- `src/routes/_app/trips/$tripId/-server/transport-overlay.ts` — new. One `GET` server function
  returning the trip's routable legs, projected to what a map needs.
- `src/routes/_app/trips/$tripId/-ui/planner-map-layer.tsx` — edit. Mounts the overlay, its
  trip-level toggle, and the on-demand load described under **Server**.
- `src/routes/_app/trips/$tripId/-ui/planner-day-tools.tsx` — edit. The per-day toggle.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/places-and-maps.visual.spec.ts` — append.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append.

This is the wave-6 owner of `src/components/map` and `src/lib/map`, and it owns **no contended
file at all** — which is deliberate and was arrived at by measurement rather than by preference.
`node scripts/ultrabuild/check-plan-collisions.mjs 02` reported this stage colliding in wave 6 with
`03-S8` of `docs/plans/03-reservations-and-transport.md` on both
`src/routes/_app/trips/$tripId/-ui/plan-model.ts` and
`src/routes/_app/trips/$tripId/-server/plan.ts`. Rather than move the stage — `plan-screen.tsx` has
no free wave left once `01-S2`, `01-S4`, `01-S9`, `02-S4` and `03-S5` have taken theirs — the design
changed, and for the better: the overlay is **off by default**, so loading its legs into the board
payload every reader waits for was always the wrong place for them. They are fetched when the reader
turns the layer on, from this stage's own server function, and the three contended files are not
touched.

`02-S11` and `02-S9` are this plan's other late stages and share no path with this one.
`planner-map-layer.tsx` and `planner-day-tools.tsx` are owned by this plan throughout, created by
`02-S4` in wave 3.

### Data and migration

**No schema change and no migration**, and no new countable row: this stage writes nothing. It reads
`transports` rows that already exist and draws them.

Two facts the layer depends on, both already true: a leg's endpoints are nullable, so the overlay
must draw only legs where all four coordinates are present and must say how many it skipped rather
than silently drawing fewer lines than the reader has bookings; and `transports.status` carries the
confirmed-or-pending distinction the line style encodes, already constrained by
`enumCheck('transports_status_chk', …)`.

Overlay visibility is stored in the browser under a key scoped by trip id. It is not a row, it is not
tenant data, and it is never sent to the server.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/transports.ts`, **unchanged and not owned**. Its existing
  tenant-scoped list function returns the rows this stage needs; adding a second reader would
  duplicate a query that exists.
- **Server function.** `loadTransportOverlayFn` (`GET`) in
  `src/routes/_app/trips/$tripId/-server/transport-overlay.ts`, returning the trip's legs projected
  to what a map needs — id, mode, status, both endpoint names and codes, both coordinate pairs and
  both times — and nothing else. A booking reference and a seat number have no business travelling to
  a map layer, and a projection is the cheapest place to make that true.
- **It is fetched on demand, not eagerly.** The layer is off by default, so the legs are requested
  the first time a reader turns it on and are then held for the life of the screen. That is why this
  stage needs no change to `loadPlanBoard` and no change to the planner's view model — a design
  consequence of the default, not a workaround.
- **Zod.** `z.strictObject({ tripId })` on the shared id schema, with `error` set.
- **Authorisation.** Decided in the handler, through the same tenant-scoped `requireTrip` the board
  loader performs. The trip id arrives from the client and is unauthorised until it resolves inside
  the caller's own scope.
- Nothing is slow and nothing is enqueued. Arc geometry is computed in the browser from two
  coordinate pairs, which costs microseconds and keeps the payload to eight numbers per leg instead
  of a hundred interpolated points.

### UI (route, components)

- **Route.** No new route file, so no `pnpm generate-routes`. No route change at all: everything
  this stage adds hangs off components this plan already owns.
- **Components.** New: `transport-overlay.tsx`, which renders no DOM of its own for the lines —
  MapLibre draws a GeoJSON line layer pin-sharp at every zoom, where an SVG overlay would need
  re-projecting every frame — and uses `MapMarker` for the endpoint pills and the flight label.
  Reused from `src/components/map`: `useMapContext`, `MapMarker`, `useMapZoom`. Reused from
  `src/components/ui`: `IconButton`, `Tooltip`, `Chip`, `Switch`.
- **Geometry by mode.** A great-circle arc for anything that flies or sails, interpolated densely
  enough that it reads as a curve at any zoom; a straight line for a rail or road leg, drawn as an
  arc of the same construction so the two never look like different products; and a leg crossing the
  antimeridian drawn as **one continuous line** rather than two stubs at the map's edges, which is
  the case a naive longitude interpolation always gets wrong and which the unit tests below pin.
- **Styling.** Confirmed legs solid, pending legs dashed, both in the map's own casing-plus-core
  treatment so a line stays legible over land, sea and a city. The overlay's layers go **below** the
  place-label anchor and above the basemap, so a transport line never buries a place name — the same
  ordering rule `day-routes.tsx` already follows and this stage reuses rather than re-deciding.
- **Decoration.** Each endpoint carries a pill with the mode icon and the endpoint code, or the
  endpoint name when there is no code. A flight additionally carries one label at the arc's apex with
  its two codes, the great-circle distance and, when both times are present, the duration — all in
  `tabular-nums`. Labels are suppressed below a zoom where they would collide, and the suppression is
  by zoom rather than by collision detection, because a label that flickers as the reader pans is
  worse than one that is absent.
- **The toggles.** Off by default, because a trip with eight flights drawn on top of its walking days
  is unreadable. One trip-level control in the map's chrome turns every routable leg on or off; each
  day's footer has its own; and the choice is remembered per trip in the browser. The control states
  how many legs it will draw and how many were skipped for missing coordinates, so "why is my train
  not there" has an answer on the screen.
- **States.** _Empty_ — a trip with no routable transports shows the control disabled with a tooltip
  saying so, not an enabled control that does nothing. _Skeleton_ — the first toggle triggers a real
  fetch, so the control shows a `Spinner` in place of its icon and the map shows nothing until the
  legs arrive; a skeleton line drawn on a map would be a lie about geography. _Error_ — a failed
  fetch returns the toggle to off and shows the reason in a toast with a retry, because a switch that
  stays on with nothing drawn is the worst of both. A leg whose coordinates fail validation
  is skipped and counted in the control's summary rather than breaking the layer; the layer never
  throws a whole map away for one bad row. _Loading_ — the toggle is disabled while its own fetch is
  in flight and while the board payload is pending.
- **The hooks this stage publishes**, per the Area brief's register: `data-part="transport-toggle"`
  on the trip-level control and `data-part="transport-pill"` on each endpoint pill, both in
  `planner-map-layer.tsx`, which `02-S4` created in wave 3 and this stage extends in wave 6. Both are
  new. The overlay component itself, `transport-overlay.tsx`, publishes neither: the toggle is chrome
  and the pills are mounted through `MapMarker` from the layer, so both hooks sit in the file that
  renders them.
- **Tokens.** None missing. Lines use the map palette's own transport ramp derived from existing
  colour tokens, pills use the glass panel treatment on `--color-surface`, and every appearance is a
  180–220 ms opacity transition on `--ease-out-quint`, collapsed under
  `prefers-reduced-motion: reduce`. Nothing about a map layer is a hard-coded hex.

### Quota

**This stage creates no countable row.** It draws rows that already exist and whose creation is
metered where transports are created, in `docs/plans/03-reservations-and-transport.md`. `assertQuota`
is not called and must not be. The rows it reads are scoped the way every other read in the product
is: `transports.organization_id` is the leading column of `transports_org_trip_idx`, and the
repository builds the query from `tenantFilter()` in `src/server/repos/base.ts`, so the projection
cannot reach another workspace's legs even if a client supplies its trip id.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`: with organization A's scope, the
transport list this stage's server function calls must return nothing for B's `tripId` and must raise
`NotFoundError` from `requireTrip` before a single transport row is read — a new `GET` endpoint that
takes a trip id from the client is exactly where a cross-tenant read hides, because the response
looks entirely normal. B's transports must be untouched. Repository functions covered: the transports
repository's tenant-scoped list and `requireTrip`.

This stage adds `src/server/repos/__tests__/tenant-isolation.test.ts` to its **Owned paths** as an
append for that case, and adds no repository function of its own.

It also owes one assertion that is not about tenancy and goes in its unit tests: proof that the
projection carries only the fields listed under **Server**, so a later addition to the `transports`
row does not silently start travelling to the browser.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Unit tests this stage adds, by file and invariant:

- `src/lib/map/__tests__/geodesic.test.ts` — an arc between two points contains both endpoints and
  never leaves the latitude range; an arc between antipodal points does not produce `NaN`; an arc
  crossing the antimeridian is emitted as one continuous coordinate sequence with longitudes carried
  past ±180 rather than wrapped, which is what MapLibre needs to draw it as one line; great-circle
  distance matches a known reference pair to within a metre; and a zero-length leg produces no
  geometry rather than a degenerate one.
- A `transport-overlay` test — a leg missing any of its four coordinates is skipped and counted; a
  confirmed leg and a pending leg produce different line styling; and the projection asserted above
  carries exactly the listed fields and no others.

Browser evidence:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/places-and-maps.visual.spec.ts
PT_SERVER_TODAY=2026-08-20 node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/trips/<resolved-id>/plan" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/02-S12" \
  --label A --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth --map \
  --state overlay-on --click '[data-part="transport-toggle"]'
```

- **Resting set:** `/trips/$tripId/plan` with the overlay off, light and dark, at 360, 1280 and 2560.
  Six frames, from the command above with the last line dropped. The resting set matters here more
  than usual: off is the default, and the frame proves the map is not cluttered before anyone asks.
- **Both declared states stay inside `capture.mjs`'s reach, and this is the one stage in the plan
  where that is true of everything it ships.** `overlay-on` — the trip's legs drawn with their
  endpoint pills and a flight label — is **one click** on the map's own chrome, which is the last
  line of the command above. `overlay-empty` — the disabled control on a trip with no routable
  transport — needs no gesture at all: it is a **different trip**, so it is a second invocation with
  its own `--url` and `--state overlay-empty` and no `--click`.
- **Selector discipline.** `[data-part="transport-toggle"]` and `[data-part="transport-pill"]` are
  published by this stage in `planner-map-layer.tsx`, which this plan owns throughout and this stage
  edits in wave 6. Both are new. Its `test.describe` opens with a test asserting `toHaveCount(1)` for
  the toggle on the loaded route and at least one `transport-pill` once the overlay is on, and **that
  test runs before any frame is filed** — a `--click` on a selector that resolves to nothing makes
  `capture.mjs` throw at the shutter.
- The spec declares `map: true` and re-settles the map after every resize and every theme change,
  through the two-sided `[data-map-ready]` predicate — a theme change replaces the whole style
  document through `setStyle` and drops every runtime-added source, so this stage's own layer must be
  re-added on that signal and the frame after a theme change is the assertion that it is.
  `auditServerClock()` is called once in its own describe.
- **Console must be silent** in every test. **Layout shift after paint** asserted `0` in Chromium
  after the settle mark, including as the overlay is toggled on — the pills are in MapLibre's marker
  pane and must not touch document layout. Reported as a skip with its reason on `mobile-safari`.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, and item 6 has a specific meaning for this
stage: it owns no contended file, so an edit to `plan-screen.tsx`, `plan-model.ts` or
`-server/plan.ts` appearing in its diff is a failure of item 6 even if the code is right.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      trip-level toggle, every day toggle, and every endpoint pill, which is focusable and opens the
      booking it belongs to.
- [ ] Every list has a designed empty state, a skeleton loading state, and an error state on
      `--color-surface-2` — including the disabled-with-a-reason case, which is this stage's empty.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured — lines fade in, they do not draw themselves.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused. The
      line ramp is re-derived for dark rather than reused, because a colour that reads over a pale
      basemap disappears over a charcoal one.
- [ ] Responsive 360px → 2560px: at 360 endpoint pills collapse to their icon and the flight label is
      suppressed; at 2560 labels keep their type size instead of scaling with the canvas.
- [ ] Keyboard navigable end to end: the toggles are real switches with accessible names carrying the
      leg count, the pills are in a roving-focus group, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

- **Gate B — routing.** No road-following geometry; every leg is an arc, and nothing claims
  otherwise. Recorded in `02-S1`, owned by `docs/plans/11-boundaries-and-blockers.md` (`11-S3`).
  Disposition: **defer**. No provider is named and no client is written for one.
- **BKG-06, `docs/plans/03-reservations-and-transport.md`, wave 1 — the transport record.** Its rows
  are what this stage draws. The table and its repository already exist at HEAD, so the risk is that
  BKG-06 changes the shape rather than that it is absent; this stage reads through the existing
  repository and projection and does not depend on any column BKG-06 might add.
- **BKG-10, wave 3 of the same plan — inline transport rows in the day timeline.** Per-leg toggles
  live on those rows and are not built here. Recorded, not reimplemented.
- **`12-verification-protocol.md` §7.2** applies to this stage's trip-tab frames.
- No package outside the pinned set — arcs are trigonometry and `maplibre-gl` draws them. No binding.

## Stage 02-S13 — Search as you type, and a link somebody pasted

### Stage id

`02-S13` · Wave 4 · effort **L**.

**This stage was BLOCKED and is not any more.** It was written out in full, with its paths named and
a definition of done, so that the day Gate A closed it could be executed rather than designed.
`docs/adr/0013-geoapify-for-geocoding.md` closed it, so this stage is scheduled and every "will owe"
below has become an "owes".

**Its wave moved from 6 to 4, and the reason is ownership rather than scope.** This stage edits
`src/routes/_app/trips/$tripId/-ui/plan-actions.tsx`. That file is held by `01-S4` in wave 2, `02-S5`
in wave 3, `02-S10` in wave 5 and `02-S11` in **wave 6** — the wave this stage used to state. Two
exclusive claims on one file in one wave is a clobber, and wave 4 is the only wave in which it is
free. Wave 4 also sits above MAP-02's floor and one wave after `02-S4`, whose server function is
the first caller of the geocoding proxy that #281 minted and this stage calls, so the move satisfies
the dependency instead of straining it. `02-S11` in
wave 6 then builds address completion **on top of** this stage's results list rather than beside it,
and says so under its own **UI**.

### Reference rows

`MAP-02 absent → done`, 4 of 4. **This is the stage that closes the row**, and the row does not close
until search works. `02-S5`, `02-S6` and `02-S8` each ship one of MAP-02's other import paths and
each declares `absent → absent`, naming this stage as the closer, so the matrix never records
progress the reader cannot see.

Behaviour sourced as `wiki: Places-and-Search`. What the row asks for, in our own vocabulary:

- **Search as you type**, from a field on the place form, biased towards where the trip already is —
  the centroid of its existing places, skipped entirely when they are spread too far for a centre to
  mean anything.
- **Resolving a link somebody pasted** from a map application into a name, an address and a
  coordinate pair, server-side, because the short links involved have to be followed.
- **Choosing a result fills the form** rather than creating a row behind the reader's back, so the
  same review the other three paths get applies here too.

### Owned paths

The list this stage carried while it was blocked has become its claim, and it is **shorter** than
that list, because two of the paths it expected to need are `02-S4`'s:

- `src/components/modules/places/place-search.tsx` — new. The search field, its results list and its
  keyboard contract. A module component rather than a route-local one, because `02-S11` reuses it in
  wave 6 for address completion and a route-local file is the wrong home for something two stages
  render.
- `src/components/modules/places/__tests__/place-search.test.tsx` — new. The debounce, the
  cancel-on-supersede, the centroid bias and its skip threshold.
- `src/components/modules/places/index.ts` — new. The barrel, created by this stage.
- `src/routes/_app/trips/$tripId/-server/geocode.ts` — edit. One added server function,
  `resolveShareLinkFn`, beside the two `02-S4` creates in wave 3. Same plan, one wave later, and no
  other stage in any plan claims the file.
- `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` — edit. The field goes at the top of
  `PlaceDialog`. `01-S4` (wave 2), `02-S5` (wave 3), `02-S10` (wave 5) and `02-S11` (wave 6) hold
  this file in other waves; **wave 4 is the one wave in which it is free**, which is why this stage
  states wave 4.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/places-and-maps.visual.spec.ts` — append, one `test.describe` named for this stage.
- `e2e/__screenshots__/places-and-maps.visual.spec.ts/` — append, this stage's frames only.

**No provider client module of its own.** The list written while this stage was blocked expected one
under `src/server/`; #281 minted `src/server/geo/geocode.ts` and this stage calls it. A second
client for one provider would be a second place to forget the cache, the ceiling and the
attribution, which is the whole reason `02-S1` names the single-proxy obligation.

**It needs none of the shared paths** — not `src/server/db/schema.ts`, not `wrangler.jsonc`, not any
of the other four — on the evidence in **Data and migration** below. Nor
`src/server/billing/limits.ts`: the one ceiling it spends is the monthly `geocode_lookups_per_month`
metric that #281 shipped.

### Data and migration

**No schema change and no migration**, and the question that could not be answered while the gate
was open now has an answer.

What exists and is enough for the result itself: `places.source` already carries `search`
(`src/server/db/schema.ts:159`) and `places.external_id` already holds a provider's own identifier,
indexed by `places_external_idx`. A place created from a search result is stamped `search` and
carries the provider's id, which is what that column was for.

The open question was the **cache**: a provider's terms fix what may be retained and for how long,
and that answer differs enough between providers to change whether the cache is a KV entry with a
TTL, a table, or nothing at all. ADR 0013 answers it — storage is permitted without a time limit —
and the shape that follows is a **KV entry with no TTL**, built by #281 in
`src/server/geo/geocode.ts`. So no column is needed after all, and `11-S3`'s sequence held: decision,
then column, then feature, with the column turning out to be none.

### Server (repo, server function, Zod)

**No repository and no new provider client.** Four of the five constraints written here while the
stage was blocked are met by the proxy #281 minted rather than by this stage, and they are restated as
inherited so nobody re-implements one:

- The provider is called **from the server only**, inside `src/server/geo/geocode.ts`, never from the
  browser, so no credential reaches a bundle.
- The credential is a secret and is never per tenant — the shape that put BKG-09 out of scope.
- The cache answers before the provider does, per `docs/ARCHITECTURE.md` §4, keyed on the normalised
  query alone. A key containing a trip id, a place id or a member id would be tenant data and would
  be scoped like tenant data; this one contains none.
- The provider's response is validated on the way back: it is untrusted input exactly as a browser's
  request is.

**One server function is this stage's own: `resolveShareLinkFn`**, added to
`src/routes/_app/trips/$tripId/-server/geocode.ts`. It takes a pasted URL, validated with
`z.strictObject` against an allow-list of map hosts, follows a short link **server-side** because
that is the only place it can be followed, and returns a name, an address and a coordinate pair for
the form to fill. Two refusals rather than one, both stated because a URL from a reader is the most
attacker-shaped input in this plan: a host not on the list is refused without a request being made,
and a redirect chain longer than three hops is abandoned. It reaches the provider only to resolve a
place the link names, through the same proxy as everything else.

**Authorisation** is decided in the handler for both functions: `appScope()`, then
`requireTrip(scope, tripId)`. A search is a tenant-scoped action because it spends a metered resource
on that tenant's behalf, so an unauthorised trip id is refused before anything outbound happens.

### UI (route, components)

**Route.** No new route file, so no `pnpm generate-routes`.

**Components.** Reused from `src/components/ui`: `Field`, `Input`, `Spinner`, `Alert`, `Kbd`,
`Badge`. New: `PlaceSearch` in `src/components/modules/places/place-search.tsx` — one component, and
the reason it is a module component rather than a route-local one is that `02-S11` renders it again
in wave 6.

- A field at the top of the place form, with a **300 ms debounce**, a **minimum of three characters**
  and cancellation of a superseded request, and a keyboard contract — up and down through results,
  `Enter` to take the highlighted one, `Escape` to dismiss — because a search field that cannot be
  driven from the keyboard is not a search field. Those three numbers are cost controls as much as
  design ones now: every keystroke that gets past them spends the monthly ceiling, the
  `geocode_lookups_per_month` metric #281 shipped.
- Results are **biased towards where the trip already is** — the centroid of its existing places,
  passed as `near` — and the bias is skipped entirely when the places are spread more than a
  thousand kilometres apart, because a centre between two continents is a worse hint than none.
- Choosing a result fills the form's fields and leaves the reader in the form. Nothing is written
  until they save, which is the same review the other three MAP-02 paths get.
- **A pasted link is recognised in the same field.** When what the reader typed parses as a URL, the
  field stops searching and offers to resolve it instead, through `resolveShareLinkFn`. One field,
  two behaviours, because a reader who pastes a link into a search box has done the obvious thing.
- **Attribution is not repeated here.** ADR 0013's obligation is met by the map's attribution line,
  which `02-S4` renders. A second credit on the form would be noise, and the requirement is that it
  appears, not that it appears twice.
- Empty, skeleton and error states on `--color-surface-2` as for every other list in this plan, plus
  two this stage owns: a query that returned nothing, which offers the reader the manual and paste
  paths rather than being a dead end; and the **ceiling refusal**, worded as what it is — this
  workspace has used its lookups for the month — with the manual path still open beside it.
- **The hook this stage publishes:** `data-part="place-search"` on the field, in the component it
  owns. It is distinct from `02-S11`'s `data-part="address-suggestions"`, which is a different
  control on the same form.
- **Tokens.** None missing. The results list uses `--color-surface-2` and the existing focus ring;
  the list fades in at `--duration-fast` on `--ease-out-quint`, opacity and transform only, collapsed
  under `prefers-reduced-motion: reduce`.

### Quota

**It creates countable rows: places, metric `places`**, already in `PLAN_QUOTAS`
(`src/server/db/types.ts:43`, `:50`, `:57`, `:64`) and asserted by
`assertQuota(scope, 'places', …)` at `src/server/repos/places.ts:269` inside `createPlace`. Choosing a
search result fills a form, and the form's existing save path consumes the ceiling exactly as it does
today; no second call site is added.

**And it spends a provider call, against a ceiling this stage neither adds nor enforces.**
`11-S3` recorded the rule — a metered outbound call made on one tenant's behalf is a cost every other
tenant helps pay, so its rate belongs in `resolveLimits()` and never in a constant inside a search
module. #281 shipped the monthly `geocode_lookups_per_month` metric in `resolveLimits()` and spends
it in `src/server/geo/geocode.ts`. This stage therefore adds **no** metric, **no** counter
and **no** constant; what it owns is the three numbers that keep a per-keystroke field from reaching
the ceiling in the first place — the debounce, the minimum length and the cancel-on-supersede — and
the designed refusal for when it does.

### Tenant isolation test

Appended as one `describe` block, and it asserts the two halves that pull in opposite directions.
**Sharing is correct here and is asserted as such:** organization A and organization B issue the same
query and must produce the **same** cache key, because an address resolving to a point is a public
fact and the unexpiring shared cache is the thing ADR 0013 bought. **Scoping is still absolute:** a
search made in A's scope for a trip belonging to B raises `NotFoundError` **before** any provider
call is made — spending money on a request we are going to reject is a defect even when the response
is discarded — and `resolveShareLinkFn` is asserted the same way. Repository functions covered:
`requireTrip`, and `createPlace` when a chosen result is saved.

### Verification

The command gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests**, in `src/components/modules/places/__tests__/place-search.test.tsx`: the debounce
fires once for a burst of keystrokes; a superseded request is cancelled and its late response is
discarded rather than rendered; the centroid bias is computed from the trip's places and **skipped**
above the spread threshold; a URL in the field switches the control to its resolve behaviour; and a
host outside the allow-list is refused without a request. The provider response validator is
`02-S4`'s and is tested there, not twice.

**Browser evidence.** The resting set and two declared states, at 360, 1280 and 2560 in both themes,
under `.claude/ultrabuild/shots/<slug>/round-<n>/02-S13/`. **The results list is not one gesture from
a loaded route** — it needs a field focused and a query typed, and `capture.mjs` has no `--type` flag
(`scripts/ultrabuild/capture.mjs:64-80`, `:218-225`) — so `results-open` and `no-results` are taken
in this plan's own spec with `page.screenshot({ path, … })`, exactly as `02-S5` and `02-S11` take
theirs, and `capture.mjs` takes the resting set and nothing else. The provider is **not** called from
a test: the two states are driven against a stubbed `searchPlacesFn`, because a baseline that depends
on a third party's data is a baseline that changes when they reindex.

**Console** silent and **layout shift** `0` after the settle mark — which a results list that pushes
the form down would fail, and is the reason the list is an overlay rather than a block in flow.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged, and so does every §2 visual clause. They were
listed **unticked and deferred** while this stage was blocked; now that it is scheduled they are its
checklist like any other stage's, clause by clause:

- 4px grid spacing from `--space-*`, with no eyeballed one-off margins.
- hover, focus-visible, active, disabled and loading on the search field, every result row and the
  attribution the provider requires.
- a designed empty state, a skeleton and an error state on `--color-surface-2`, plus the
  no-results state the other three import paths do not have.
- motion at 150–260ms on `--ease-out-quint`, transform and opacity only, honouring
  `prefers-reduced-motion: reduce`.
- full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- responsive 360px → 2560px, with the frame set at 360, 1280 and 2560 in both themes.
- keyboard navigable end to end — up, down, `Enter`, `Escape` — with WCAG 2.2 AA contrast in both
  themes.
- zero console errors or warnings, and zero layout shift after paint.

**And the row moves only here.** `02-S5`, `02-S6` and `02-S8` each ship one of MAP-02's other import
paths and each declares `absent → absent`; this stage is the one that writes `absent → done`, because
the row is not closed until search works.

### Blockers

**Gate A — geocoding and place search. CLOSED**, by `docs/adr/0013-geoapify-for-geocoding.md`. This
stage was the one wholly behind it, and it is the reason both of that gate's conditions mattered:

- A tier whose terms exclude a commercial, subscription-funded product is unusable to us at any
  traffic level, and we charge for subscriptions through Stripe. The ADR clears this on the
  provider's own wording.
- A policy that forbids automated per-keystroke querying is unusable for search. **This stage is
  search-as-you-type by definition**, so it was the precise case such policies exclude; the chosen
  provider sells autocomplete as a product, so what remains is a **rate** limit rather than a
  prohibition — which is why the debounce, the minimum length and the cancel-on-supersede above are
  this stage's obligations and not its manners.

Both of the terms that decide cost more than the per-call price are answered and neither lands here:
what may be cached and for how long is permanent, so this stage needs no schema change at all; and
the attribution is on the map, rendered by `02-S4`.

**One real dependency, and it is inside this plan.** `02-S4` creates `-server/geocode.ts` in wave 3,
over the proxy `src/server/geo/geocode.ts` that #281 minted. This stage is wave 4 and adds one
function to the first of those. If `02-S4` has not landed, this stage does not start — that is an ordinary wave dependency, not a
gate, and it is satisfied by the schedule rather than by a decision.

No package outside the pinned set. No binding — the provider credential is a secret, not a
`wrangler.jsonc` entry. `12-verification-protocol.md` §7.2 applies to this stage's trip-tab frames as
it does to every stage here that baselines that route.

## Cross-plan collisions

Two stages in the same wave that both take an exclusive disposition on one file clobber each other,
because the runs that execute them go in parallel. That judgement is not made by reading the sibling
plans — round 8 produced two real collisions that way, with every plan carrying an acceptance
criterion about it — it is measured.

```sh
node scripts/ultrabuild/check-plan-collisions.mjs 02
node scripts/ultrabuild/check-plan-refs.mjs 02
```

**Neither script exists at `HEAD`.** There is no `scripts/ultrabuild/` directory and `package.json`
declares nothing that would run one, so the two blocks below are a **record of a past measurement,
not a reproducible one**. They are kept because their findings are the argument for how this plan's
ownership is arranged; nobody should read them as a check they can re-run. Where a claim in this file
says "wave _n_ is the first wave in which this file is free", it now means a reading of the sibling
stages' own **Owned paths** lists, and that is how the claims added when Gate A closed were
established.

**Four claims post-date the output below**, all from closing Gate A, and each was verified that way.
`src/server/geo/geocode.ts` and its test, which #281 has since minted outside the wave schedule, and
`src/routes/_app/trips/$tripId/-server/geocode.ts` are new files that **no stage in the set claims**
— `grep -rn "server/geo\|-server/geocode" docs/plans/` returns only this file. `src/components/modules/places/**` is likewise unclaimed. And `02-S13`'s
wave-4 claim on `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` is the reason that stage moved
from wave 6: `01-S4` holds wave 2, `02-S5` wave 3, `02-S10` wave 5 and `02-S11` wave 6, so wave 4 is
the only free one. None of the four adds a same-wave exclusive collision.

Both outputs, pasted in full, at the point this plan was finished. First the collision report:

```
plans 13 · stages 91 · owned paths 543

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (11) — legal; each plan must name the other:
  src/routes/_app/-server/settings.ts
      00-foundations.md  00-S3  wave 0  (edit)
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/trips/$tripId/-ui/plan-model.ts
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S7  wave 4  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
  src/routes/_app/trips/$tripId/-ui/plan-screen.tsx
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      01-trips-core.md  01-S9  wave 5  (edit)
      02-places-and-maps.md  02-S4  wave 3  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
  src/components/planner/day-section.tsx
      01-trips-core.md  01-S2  wave 1  (edit)
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S4  wave 3  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S5  wave 4  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
  src/server/repos/itinerary.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
      07-collaboration-and-sharing.md  07-S9  wave 3  (edit)
  src/routes/_app/trips/$tripId/-server/plan.ts
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S7  wave 4  (edit)
      02-places-and-maps.md  02-S9  wave 5  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
      07-collaboration-and-sharing.md  07-S1  wave 1  (edit)
  src/routes/_app/trips/$tripId/-ui/plan-actions.tsx
      01-trips-core.md  01-S4  wave 2  (edit)
      02-places-and-maps.md  02-S5  wave 3  (edit)
      02-places-and-maps.md  02-S10  wave 5  (edit)
      02-places-and-maps.md  02-S11  wave 6  (edit)
  src/routes/_app/-server/shell.ts
      02-places-and-maps.md  02-S2  wave 1  (edit)
      08-product-modules.md  08-S10  wave 3  (edit)
  src/server/repos/settings.ts
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/settings/appearance.tsx
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/-ui/settings-nav.tsx
      02-places-and-maps.md  02-S10  wave 5  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
      10-administration.md  10-S3  wave 4  (edit)
```

Then the reference report, which is what replaces reading the sibling plans by hand for the second
kind of defect — a `NN-Sn` token cited by a stage that no `## Stage` heading in that plan defines:

```
plan 02: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
```

**No same-wave exclusive collision involves this plan, zero stage references dangle, and this plan
carries a Playwright invocation.** Both commands exit `0`.

Two of those rows were collisions when this file was first drafted, and are recorded here rather
than quietly fixed, because the fix is a design decision a later reader should be able to question:

- `02-S12` collided with `03-S8` in wave 6 on `plan-model.ts` and on `-server/plan.ts`, because the
  transport overlay originally rode into the browser on the planner's board payload.
  `plan-screen.tsx` had no free wave left, so moving the stage was not available. The overlay is off
  by default, so eager loading was the wrong shape anyway: `02-S12` now fetches its legs from its own
  server function the first time a reader turns the layer on, and owns none of the three contended
  files. The collision is gone and the payload every reader waits for got smaller.
- `02-S10` would have collided with `09-S8` in wave 3 on `settings-nav.tsx`. It is scheduled in wave
  5 instead, which is also the correct order: its entry is added to the settings shell that `09-S8`
  and `10-S3` have already reworked rather than to one they are about to replace.

Every path the report lists under **touched by more than one plan in different waves** is named in
the stage of this plan that owns it, together with the sibling stage ids — `02-S2` for the four
settings and shell paths, `02-S4` for `plan-screen.tsx` and `day-section.tsx`, `02-S5`, `02-S10` and
`02-S11` for `plan-actions.tsx`, `02-S7` and `02-S9` for `plan-model.ts` and `-server/plan.ts`,
`02-S9` for `itinerary.ts` and `day-section.tsx`, and `02-S10` for `settings-nav.tsx`.

Four notes on reading the report:

- **`append` is not a collision**, and several stages here deliberately append: to
  `src/server/repos/__tests__/tenant-isolation.test.ts`, and to this plan's own
  `e2e/places-and-maps.visual.spec.ts` and its baseline directory, which `02-S3` creates in wave 1.
- **The report is silent about a path two stages of the _same_ plan claim**, which is a gap in the
  measurement and not a licence. Read from the script: `shared` only collects a path whose owners
  span more than one file (`new Set(owners.map((o) => o.file)).size > 1`), so a within-plan hand-off
  never reaches the cross-plan list; only a same-**wave** within-plan pair is caught, and then as a
  collision. Counted rather than guessed, this plan has **eight** paths claimed exclusively by more
  than one of its own stages and by no other plan, and every one of the eight is claimed in a
  different wave each time: `src/components/map/index.ts` (`02-S2` w1, `02-S7` w4, `02-S9` w5,
  `02-S12` w6), `planner-map-layer.tsx` (`02-S4` w3, `02-S7` w4, `02-S12` w6), `planner-day-tools.tsx`
  (`02-S4` w3, `02-S9` w5, `02-S12` w6), `planner-add-place.tsx` (`02-S4` w3, `02-S6` w4, `02-S8` w5),
  `import-sheet.tsx` (`02-S6` w4, `02-S8` w5), `-server/place-import.ts` (`02-S6` w4, `02-S8` w5),
  `src/server/repos/places.ts` (`02-S6` w4, `02-S11` w6) and
  `-ui/__tests__/plan-model.test.ts` (`02-S7` w4, `02-S9` w5). The first seven are named in their
  stages' prose and in the Area brief's hook register. The eighth was the one omission and is the
  reason this note exists: it exists at neither HEAD nor in any other plan —
  `find src/routes/_app -type d -name __tests__` returns nothing — so "extend" would have been a
  false claim about the repo, which is the specific defect a plan is least able to afford.
- **The four stages the report cannot check** — `11-S1`, `11-S2`, `11-S3` and one stage of
  `04-budget-and-currencies.md` — state no parseable wave in their `### Stage id` line. None of them
  is in this plan; every one of this plan's thirteen stages states its wave in the form the checker
  reads, `` `<id>` · Wave <n> · effort **S|M|L**. ``
- **The report is a measurement of a moving target.** `03-reservations-and-transport.md`,
  `05-packing-and-todos.md`, `06-documents-and-media.md` and `08-product-modules.md` all landed while
  this file was being written, and the first of them turned two of this plan's paths into
  collisions. Re-run **both** commands before executing any stage here; a green result from the day
  a plan was written is not a green result today.
