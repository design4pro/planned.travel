# Drop a pin on the map and it becomes a place

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | in-progress |
| **Issue**          | #554        |
| **Spec PR**        | #583        |
| **Implementation** | none        |

`02-S4` · FR #554 · Parent PRD #437 · Stage `02-S4` of `docs/plans/02-places-and-maps.md`, wave 3; PRD Implementation Decisions 2, 3, 4 and 5. First consumer of the geocoding proxy #281 (spec `.ai/specs/implemented/2026-09-09-geocoding-proxy.md`).

Where this spec and `docs/plans/02-places-and-maps.md` disagree, this spec and FR #554's **Analysis** section are the authority: the plan predates #281, ADR 0016 and 486 lines of `plan-screen.tsx`.

## 📝 TLDR

A traveller adding a place to a trip today has to type it in; the planner map can only **move** a place that already exists. This spec makes the map a way to **create** one: a context-click on the desktop, a long-press on touch, or a pointer-free arm-and-drop from the keyboard puts a provisional pin where the reader pointed and opens the existing place form with the coordinates filled and the address filled from a reverse lookup, both editable.

It also installs the three route-local seams the rest of area 02 extends — `planner-map-layer.tsx`, `planner-day-tools.tsx`, `planner-add-place.tsx` — so that `02-S6`, `02-S7`, `02-S8`, `02-S9` and `02-S12` never queue for `plan-screen.tsx` again, and it discharges ADR 0013's attribution obligation for geocoded data in the one credit line the basemap already has.

No schema change, no migration, no new binding, and no new create path: the drop ends in `createPlanPlaceFn`, exactly where the **Add a place** button ends today.

## 📝 Problem Statement

**Who has it.** Anybody adding a place to a trip, on a desktop or on a phone — most often while looking at the map, which is exactly the surface that cannot help them.

**The evidence, measured in the tree at `0009c0ed`:**

- The map's only click handler is `MapBehaviour` in `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx:300-363`. With `picking` set (`:475`, a `PlannerRow`) a click calls `savePosition` (`:1274`), which calls `updatePlanPlaceFn` for a place that **already exists**; without it a click clears the selection. Nothing on the map creates a row.
- `PlaceDialog` (`plan-actions.tsx:326`) already accepts an `initial: PlaceDraft` carrying `lat`, `lng`, `address` and `dayId` — but the screen always opens the create form with `emptyDraft` (`plan-screen.tsx:1726-1733`), because `DialogState`'s `create` variant (`:372`) carries nothing. `places.lat` / `places.lng` stay null unless a human types two decimals.
- `reverseGeocode()` (`src/server/geo/geocode.ts:513`) and `geocodeRuntime()` (`src/server/geo/bindings.ts:51`) shipped with #281 and have **no caller outside the booking import**. The module's own comment names `02-S4`'s route-local `-server/geocode.ts` as the consumer that reuses `reverseQuerySchema`.
- The geocoder's credit (`geoapifyVendor.attribution`, `src/server/geo/geoapify.ts:134`) is rendered nowhere. `MapAttribution` (`src/components/map/map-attribution.tsx`) credits OpenStreetMap and Protomaps for the tiles and nothing else. ADR 0013 makes the Geoapify credit a surface obligation on the free plan.

**Why it matters.** "Here" is the most natural answer to "where is it", and the map is the one surface in the product that can take it. A place with no coordinates is a place with no pin, no route, and no day on the atlas — the rest of area 02 is worth less for every place that was typed.

## 📝 Proposed Solution

One gesture with three entry points, one state machine behind them, and one exit — the existing create form.

```
idle ──arm (menu / keyboard)──▶ armed ──click / Enter──▶ dropping ──▶ form open ──save──▶ idle (real pin)
  │                               │                         ▲                 └─cancel──▶ idle (pin removed)
  └──context-click / long-press ──┴─────────────────────────┘
                                  └─Escape / cancel button──▶ idle
```

- **Pointer, desktop.** A `contextmenu` on the map canvas drops at the pointed coordinate. No arming step: the context-click _is_ the intent.
- **Pointer, touch.** A single-finger press held **500 ms** without moving more than **10 px** drops at the pressed coordinate. A second finger, a pan, or a lift before the threshold cancels the recogniser.
- **Keyboard (and anyone who prefers a mode).** **Add a place ▾ → Place it on the map** arms the drop: the crosshair cursor and an arming banner appear, the map region takes focus, arrow keys pan (MapLibre's own keyboard handler), `Enter` drops at the centre of the visible map, a click drops at the clicked point, and `Escape` or the banner's close button cancels.

**Dropping** rounds the coordinate to six decimal places, puts a provisional pin there, asks `reverseGeocodeFn` for an address with a **1,500 ms budget**, and then opens `PlaceDialog` in create mode with `{ ...emptyDraft, lat, lng, address }`. The form is unchanged and unaware: it receives a draft, exactly as the edit path already hands it one.

**The lookup failing is not the drop failing.** A timeout, a refusal (no key, ceiling spent, provider down) or an empty result all open the same form with the coordinates filled and the address empty and editable — no apology banner, no disabled field. An unauthorised trip is not a failed lookup: `reverseGeocodeFn` throws it (see `-server/geocode.ts` below), so the client degrades only the budget running out and never swallows a thrown error — the provisional pin is withdrawn, the form does not open, and the error's sentence reaches the reader verbatim. An answer arriving after the budget is discarded, never patched into an open form: `PlaceDialog` resets its draft whenever `initial` changes (`plan-actions.tsx:343-348`), so a late patch would overwrite what the reader typed, and teaching the form to merge is `02-S5`'s file, not this stage's.

**Alternatives that lost.**

- _Open the form at once and fill the address when it arrives._ Faster to a visible form, but it needs `PlaceDialog` to merge a late value into a draft the reader is editing — an edit to `plan-actions.tsx`, which `02-S5` owns this wave. The 1,500 ms budget keeps the wait short, the provisional pin answers "here" during it, and the cache answers a repeated point without a provider call.
- _A second `PlaceDialog` instance owned by the map layer._ It would keep `plan-screen.tsx` untouched and give the product two create forms, two submit paths and two quota-error treatments. Rejected on "one concept, one owner" (docs/SPEC.md §8).
- _Build the long-press on MapLibre's `touchstart`/`touchend` map events._ `useMapListener`'s `MapEventName` (`map-context.tsx:178`) does not carry them, extending it is a `src/components/map` edit this stage may not make (Decision 3), and pointer events on the canvas element give one recogniser for every input type.

## 📝 Architecture

### Owner modules (docs/SPEC.md §8)

| Concept                                      | Owner                                                     | New / edit |
| -------------------------------------------- | --------------------------------------------------------- | ---------- |
| Reverse lookup on a tenant's trip            | `src/routes/_app/trips/$tripId/-server/geocode.ts`        | new        |
| The drop gesture, its state, provisional pin | `src/routes/_app/trips/$tripId/-ui/planner-map-layer.tsx` | new        |
| The rail's add control and its menu          | `src/routes/_app/trips/$tripId/-ui/planner-add-place.tsx` | new        |
| What a day's footer offers                   | `src/routes/_app/trips/$tripId/-ui/planner-day-tools.tsx` | new        |
| The day footer's render slot                 | `src/components/planner/day-section.tsx`                  | edit       |
| The geocoder's credit, as data               | `src/lib/geo/credits.ts`                                  | new        |
| The one credit line on the map               | `src/components/map/map-attribution.tsx`                  | edit       |
| Mounting the seams                           | `src/routes/_app/trips/$tripId/-ui/plan-screen.tsx`       | edit       |

Unchanged and reused: `createPlanPlaceFn` (`-server/plan.ts:640`), `createPlace` (`src/server/repos/places.ts:263`) with its `assertQuota(scope, 'places', …)`, `reverseGeocode` / `geocodeRuntime`, `PlaceDialog`, `MapMarker`, `useMapInstance`. Untouched by rule: `plan-actions.tsx` and `plan-model.ts` (`02-S5`), `-server/plan.ts`, `src/components/map/index.ts`, `fit-bounds.tsx`, `src/lib/map/**`, `src/lib/atlas/layout.ts`, `FitBounds`, `PlaceMarkers`, `DayRoutes`, `MapBehaviour` and the existing reposition flow.

### `-server/geocode.ts`

One server function, `reverseGeocodeFn`. It authorises **before** it spends:

1. `appScope()`.
2. `requireWritableTrip(scope, tripId)` then `assertTripRole(scope, trip.id, ['owner', 'editor'])` — the same pair `requireEditablePlan` composes in `-server/plan.ts:270`. The lookup exists only to feed a place write, so it is refused on exactly the trips where that write would be refused: a foreign or invisible trip (`NotFoundError`), an archived one, or one the caller only views. A metered call spent on a request we are about to reject is the failure this ordering prevents.
3. `getSubscription(scope)` → `resolveLimitsFromRow(row).rates.geocode_lookups_per_month` — the pair `src/server/fns/booking-import.ts:608` already uses.
4. `reverseGeocode(geocodeRuntime({ organizationId: scope.ctx.organizationId, ceiling }), { lat, lng, language })`.

It maps the proxy's refusals to a **result**, not an error: `GeoProviderError`, `RateCeilingError` and `ProviderBlockedError` become `{ address: null }`. The drop never needs to know _why_ there is no address, and an error crossing the wire would be one more thing a client could render as an apology. Authorisation failures (`NotFoundError`, `TripArchivedError`, `TripRoleError`) still throw — those are not degraded lookups, they are refused requests.

`searchPlacesFn` is **not** added (Resolved assumption 4).

### `planner-map-layer.tsx`

Rendered as a child of `MapCanvas`, so it only mounts once the map instance exists (`map-canvas.tsx:855`). Exports:

- `usePlannerDrop({ tripId, editable, onDropped })` — the state machine above, called **once** in `PlanScreen`. Returns `{ state, arm, cancel }`, where `state` is `'idle' | 'armed' | 'dropping'`. `onDropped(draft: PlaceDraft)` is how the screen opens its form. Arming while the reposition flow's `picking` is set is refused by the screen passing `editable && picking === null`.
- `PlannerMapLayer({ drop, empty })` — the gesture listeners, the arming banner, the provisional pin, and the empty-map hint.

Listener discipline, which the unit test pins:

- **Exactly one MapLibre listener per mount**: `map.on('contextmenu', …)`, removed on unmount. `contextmenu` carries `lngLat`; `useMapListener` cannot be used because its listener takes no event.
- The long-press recogniser and the keyboard handler are DOM listeners on `map.getCanvasContainer()` (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `keydown`), added in one effect and removed in its cleanup. `map.unproject([x, y])` turns the press into a coordinate.
- The hit surface is the canvas container, which carries `data-part="planner-canvas"` for as long as the layer is mounted.
- `Escape` while armed calls `preventDefault()` so the screen's window-level Escape handler (`plan-screen.tsx:1024-1041`) leaves the selection alone, as it already does for a keyboard drag.
- A second trigger while `dropping` is ignored: on Android a long-press fires both the recogniser and `contextmenu`, and the state machine, not a timing guard, is what makes that one drop.
- The crosshair cursor is set on the canvas while `armed`, exactly as `MapBehaviour` sets it for `picking` (`:358`), and cleared on every exit.

The **provisional pin** is a `MapMarker` at the dropped coordinate: a dot in `--color-accent` with a 3 px `--color-accent-on` halo, inside a dashed outer ring drawn in `--color-accent`, `aria-label` from `trips.plan.drop.pin`. While `dropping` it also carries a visually hidden `role="status"` reading `trips.plan.drop.lookingUp`. It is removed on cancel and on successful save — `router.invalidate()` then brings the real pin through `PlaceMarkers`.

The **arming banner** reuses the existing picking banner's recipe (`plan-screen.tsx:1641-1668`: `GlassPanel radius="full"`, `Crosshair` icon, ghost `IconButton` to stop) with the drop's own copy. It is drawn by the layer rather than by the screen because the screen may gain no new state for it; converging the two banners into one component is a follow-up for the stage that next owns the reposition flow.

### `planner-add-place.tsx`

`PlannerAddPlace({ onCreate, onArmMap })` renders the same primary pill `plan-screen.tsx:1428-1440` renders today (`variant="primary" shape="pill" size="sm" block`, `Plus` icon), with a menu trigger beside it. It publishes `data-part="add-place"` on the pill, `data-part="add-place-menu"` on the menu, and one `data-part="add-place-option"` with `value="map"`. `02-S6` and `02-S8` add `value="collection"` and their own paths to the same menu later; `02-S10` extends the pill. `addButton` is used twice in the screen — the desktop rail toolbar (`:1593`) and the mobile places sheet (`:1703`) — so replacing its one definition covers both. On a phone, choosing **Place it on the map** closes the sheet before arming, so the map is visible.

### `planner-day-tools.tsx`

`PlannerDayTools({ day, onAddPlace })` renders one footer control, **Add a place** (named **Add a place to {day}**, so its visible label opens its accessible name — WCAG 2.5.3), which opens the create form with `dayId` preset. `PlaceDialog` already offers the day select only when creating (`PlaceDraft.dayId`), so this is a draft, not a form change. `02-S7`, `02-S9` and `02-S12` add their controls here.

### `day-section.tsx`

One optional render prop, `dayTools?: (day: PlannerDay) => React.ReactNode`, rendered in the footer area after the note control, mirroring `rowActions` (`:45`, `:83`, `:255`). Absent → nothing renders, so every other consumer of `DaySection` is unaffected.

### `plan-screen.tsx` — the complete list of edits

FR #554 asks for "exactly three additions". Three mount points are not enough to open the existing form with a draft, so the list below is the whole budget and is reviewed as such (Resolved assumption 2). Nothing is deleted, nothing moves, and the camera, `FitBounds`, `PlaceMarkers`, `DayRoutes`, `MapBehaviour` and the picking flow are untouched.

1. `DialogState`'s `create` variant gains an optional draft: `{ readonly kind: 'create'; readonly draft?: PlaceDraft }`, and `PlaceDialog`'s `initial` reads `dialog.draft ?? emptyDraft` for it.
2. One call: `const drop = usePlannerDrop({ tripId, editable: editable && picking === null, onDropped: (draft) => setDialog({ kind: 'create', draft }) })`.
3. `<PlannerMapLayer drop={drop} empty={…} />` as an additional child of `MapCanvas`.
4. `dayTools={(day) => <PlannerDayTools … />}` on `DaySection`, only when `editable`.
5. `const addButton = editable ? <PlannerAddPlace … /> : null` replacing the inline `Button` expression.
6. `runWrite`'s catch hands the error to `placeWriteMessage(cause, fallback, t)` from `planner-add-place.tsx` instead of `messageOf` directly, so a quota refusal reads as the plan limit it is (see **Edge Cases**). Every other error keeps today's text.

### Attribution — one line, two sources

`src/lib/geo/credits.ts` (new, client-safe, no server imports) exports `GEOAPIFY_CREDITS: ReadonlyArray<{ name: string; url: string }>` — the two entries `geoapifyVendor.attribution` declares today. `geoapify.ts` imports it in place of its inline array (a one-line change; the proxy's behaviour and cache key do not change), so the server and the surface cannot drift.

`MapAttribution` then renders one pill:

- basemap available: `MapCreditList(MAP_ATTRIBUTION)` as today, then the geocoder credits whose `url` is not already credited — today that is `Geoapify` alone, since OpenStreetMap is already on the line. Visible: `OpenStreetMap · Protomaps · Geoapify`.
- basemap unavailable: the pill no longer stands down entirely; it carries the geocoder credits alone (`OpenStreetMap · Geoapify`), because stored coordinates drawn over the bundled outlines still came from the geocoder. The Natural Earth credit stays in `BasemapNotice` as today.

Each segment carries its own visually hidden sentence from the catalogue (`atlas.map.attribution.label` "Map data from", new `atlas.map.attribution.geocoder` "Places located with"). Rendered unconditionally — on the planner and on the atlas alike, since both draw stored coordinates — rather than behind a prop a later screen must remember. No second badge, no floating overlay; every later stage that shows a geocoded result inherits this line. `src/components/map/index.ts` is not touched.

## 📝 Data Model

No change. `places.lat` / `places.lng` already carry their WGS-84 `CHECK`s, `places.address` is free text, `places.source` defaults to `manual` — which is right: a person chose this point, and the address is a suggestion they accepted or edited. Nothing records that the address came from a reverse lookup; the credit line is the attribution ADR 0013 asks for, and a provenance column would be a Decision 7 request to `00-foundations.md`, not something this stage writes.

## 📝 API Contracts

### `reverseGeocodeFn` — new, `createServerFn({ method: 'POST' })`

```ts
// input
z.strictObject({
  tripId: id,                       // the same `id` schema -server/plan.ts uses
  ...reverseQuerySchema.shape,      // lat [-90, 90], lng [-180, 180], language: LOCALE_TAGS
})

// output
{ readonly address: string | null }
```

- `address` is the first candidate's formatted address, trimmed; `null` when there is no candidate or the proxy refused.
- Throws `NotFoundError` for a trip the caller cannot see, `TripArchivedError` for an archived one, and `TripRoleError` for one they cannot edit — **before** `getSubscription`, before the cache and before the meter. Both trip errors are in `AUTHORED_ERROR_NAMES`, so their sentence reaches the reader verbatim.
- `language` is the reader's active locale, so the cached answer is keyed on it by the proxy.
- The client sends the coordinate rounded to six places; `reverseCacheKey` keys on four (`toFixed(4)`, an ~11 m bucket, intentionally coarser — `geocode.test.ts` pins it). The server key does the deduping, so a pin dropped twice within the same bucket is one provider call, provided the first answer had a candidate (an empty answer is not cached).

### `createPlanPlaceFn` — unchanged

The drop's form submits through `submitPlace` → `createPlanPlaceFn` with `{ tripId, ...PlaceFormValues }`, as the **Add a place** button already does. `BACKWARD_COMPATIBILITY.md` §2 is not crossed.

## 📝 UI/UX

**States of the planner route** (`/trips/$tripId`), each in light and dark, desktop and mobile:

| State     | What is on screen                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| resting   | **Add a place** pill with a menu trigger beside it; each day footer offers **Add a place**; credit line gains `Geoapify`             |
| menu-open | One option, **Place it on the map**                                                                                                  |
| armed     | Crosshair cursor, arming banner at the top of the map with a stop button, map region focused                                         |
| dropped   | Provisional pin at the point; after ≤ 1.5 s the **Add a place to this trip** dialog, name focused, latitude/longitude/address filled |
| empty map | When the trip has no mapped place and the reader can edit: a one-line hint over the map naming the gesture                           |

**Focus and keyboard.** Arming moves focus to the map region (MapLibre's canvas container carries `role="region"` and the map's label). Arrow keys pan, `+`/`-` zoom (MapLibre defaults), `Enter` drops at the centre, `Escape` cancels and returns focus to the menu trigger. The dialog focuses its first field, **Name**, on open — `DialogContent` renders its close button after the body (`src/components/ui/dialog.tsx:122`), so Radix's first-tabbable rule lands on the name input with no change to the form — and on close returns focus to the element that held it when it opened (`dialog.tsx:103-117`): the map region for a keyboard drop, the canvas for a pointer drop.

**Screen readers.** The arming banner is `role="status"` `aria-live="polite"` like the picking banner. The provisional pin is named. The dialog's own title (`Add a place to this trip`) announces the open form; the coordinates are in labelled fields.

**Motion.** The provisional pin appears without a drop animation when the reader prefers reduced motion; otherwise it takes the product's standard `duration-fast ease-out-quint` scale-in. No layout shift: the banner, the pin and the hint are absolutely positioned over the map, and the dialog is a portal.

**Contrast.** The accent token flips with the theme (ink `#16150f` in light, paper `#f8f7f4` in dark), so a dot and a dashed ring both in `--color-accent` read against either basemap's land fill, and the `--color-accent-on` halo separates the dot from a road or label passing under it. The ring must **not** be drawn in `--color-accent-on`: in the dark theme that is `#16150f` on a `#262624`-ish land fill and disappears — the rendered mockup showed exactly that. Non-text contrast ≥ 3:1 against both basemap themes (WCAG 2.2 SC 1.4.11), measured on the blind A/B frames.

**Touch.** The long-press does not fight MapLibre: a pan moves more than 10 px and cancels the recogniser before 500 ms; a pinch adds a second pointer and cancels it.

## 📋 Visual change expected

Route `/trips/$tripId`, light and dark, desktop (≥ `lg`) and mobile:

- **resting** — the **Add a place** pill in the right rail (desktop) and the places sheet (mobile) gains a menu trigger at its end; the pill itself keeps its variant, size and label.
- **menu-open** — a menu under the trigger with one option, **Place it on the map**.
- **armed** — the arming banner (same glass pill as today's reposition banner) with the drop copy; crosshair cursor on desktop.
- **dropped** — the provisional pin with its dashed ring; then the existing **Add a place to this trip** dialog, prefilled.
- **day footer** — each day gains an **Add a place** control below **Add a note**, in the same dashed style.
- **empty map** — a one-line hint pill over an empty map, for editors only.
- **credit line** — on the planner and on `/atlas`, `Geoapify` appended to the existing pill; with no basemap archive, a pill carrying `OpenStreetMap · Geoapify` where none showed before.

Proposed-state mockups: `.ai/specs/assets/drop-a-pin-becomes-a-place/mockup-01-armed.html` and `mockup-02-dropped.html` (static, illustrative; rendered frames are attached to the spec PR, never committed).

## 📋 Copy

Every key lands in all 23 locales in the same change (`i18n-messages` skill). `en`:

| Key                               | Text                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `trips.plan.addPlace.label`       | Add a place                                                                            |
| `trips.plan.addPlace.more`        | More ways to add a place                                                               |
| `trips.plan.addPlace.option.map`  | Place it on the map                                                                    |
| `trips.plan.addPlace.forDayNamed` | Add a place to {day}                                                                   |
| `trips.plan.addPlace.quota`       | This workspace has used every place its plan includes.                                 |
| `trips.plan.addPlace.quotaAction` | See plans                                                                              |
| `trips.plan.drop.hint`            | Right-click the map, or press and hold, to add a place right there.                    |
| `trips.plan.drop.armed`           | Click the map where it goes, or move the map and press Enter to drop it in the middle. |
| `trips.plan.drop.stop`            | Stop placing a new pin                                                                 |
| `trips.plan.drop.pin`             | New place                                                                              |
| `trips.plan.drop.lookingUp`       | Finding the address…                                                                   |
| `atlas.map.attribution.geocoder`  | Places located with                                                                    |

`trips.plan.addPlace.label` replaces the hardcoded `Add a place` the pill carries today; `forDayNamed` is the accessible name of the day-footer control, so ten days on one screen are ten distinguishable buttons (the pattern `trips.plan.note.addForDay` set).

## 📝 Edge Cases & Failure Scenarios

| Situation                                                             | What the reader sees                                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lookup exceeds 1,500 ms                                               | Form opens with coordinates, address empty. The late answer is dropped (the request is aborted where the client supports it).                                                         |
| No `GEOAPIFY_API_KEY`, provider blocked, or provider down             | Same as a timeout. Only a missing `GEOAPIFY_API_KEY` is refused before the meter; a blocked or down provider fails after `spend`, so the lookup is charged.                           |
| Workspace's `geocode_lookups_per_month` spent                         | Same as a timeout. The drop is a degraded feature, not a broken one; the ceiling is the billing page's story, not the form's.                                                         |
| Point in the sea / no candidate                                       | Same as a timeout. The lookup is charged, and the empty answer is not cached, so a second drop on the same point is charged again.                                                    |
| Viewer, archived trip, or foreign `tripId`                            | No gesture is offered (`editable` is false); a crafted call is refused by `reverseGeocodeFn` before any spend.                                                                        |
| Places quota spent                                                    | The save is refused by `createPlace` as today; the form stays open with the draft, the error reads `trips.plan.addPlace.quota`, and a toast offers `See plans` → `/settings/billing`. |
| Reader cancels the form                                               | Provisional pin removed, no write, focus returns.                                                                                                                                     |
| Reader drops twice quickly / Android fires long-press and contextmenu | The second trigger is ignored while `dropping`; one pin, one lookup.                                                                                                                  |
| Reader drops while repositioning (`picking` set)                      | Not possible: the drop is disabled while picking, and picking owns the click.                                                                                                         |
| Map instance not ready                                                | The layer is not mounted (children render only once the map exists); the menu option is disabled until it is.                                                                         |
| Screen unmounts mid-lookup                                            | The pending promise resolves into an unmounted hook and is ignored; listeners are already removed.                                                                                    |
| Coordinate at the antimeridian or poles                               | `map.unproject` can return `lng` outside ±180 after wrapping; the layer normalises with `LngLat.wrap()` before rounding.                                                              |

## 📝 Risks & Impact Review

- **Money (risk-high trigger).** A lookup spends a metered, per-tenant allowance. Mitigated by authorising before the meter (tested) and by the permanent KV cache, keyed on an ~11 m bucket (`reverseCacheKey`, four decimal places). Not mitigated: a blocked or down provider, and an answer with no candidate, are charged after `spend` — and an empty answer is not cached, so repeat drops on it are charged each time. The residual is bounded by the workspace's `geocode_lookups_per_month` ceiling and the 1,500 ms client budget, and is accepted for this stage. The gesture is only offered to editors of an unarchived trip.
- **Tenant scoping (risk-high trigger).** `reverseGeocodeFn` scopes through `requireWritableTrip`; the write path is `createPlace`, whose foreign-trip and foreign-category refusals gain coordinate-carrying cases in `tenant-isolation.test.ts`.
- **Shared surface (risk-high trigger).** `plan-screen.tsx` and `day-section.tsx` are contended. The six-item edit list above is the whole change to the former; the latter gains one optional prop. After this stage `02-S6`, `02-S7`, `02-S8`, `02-S9` and `02-S12` extend the three route-local files instead.
- **Plan ownership.** `docs/plans/02-places-and-maps.md` gives wave 3 no owner in `src/components/map`. This stage edits one file there, `map-attribution.tsx`, because FR #554 step 10 and PRD Decision 5 assign it the credit line; it does not touch `index.ts`, the barrel the rule protects (Resolved assumption 6).
- **Compatibility.** `BACKWARD_COMPATIBILITY.md` §1, §2, §4 and §7 are not crossed; §5 (locale catalogue) is, and the parity test enforces it.
- **Rollback.** Revert the implementation PR(s). No data is written that the product did not already accept: a dropped place is an ordinary `manual` place with coordinates, identical to one typed in.

## 📋 Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                   | Applied default                                                                                                                                                                        | Why                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The stage bundles the seams, **Add a place to this day**, and the drop. Split into separate specs?         | One spec, three independently shippable phases (seams + day tools, attribution, drop).                                                                                                 | The seams are this stage's scheduling reason and the ticket is one FR; phasing gives the independent-ship property without a second design review.                                       |
| 2   | FR #554 says `plan-screen.tsx` gets "exactly three additions". Is that achievable?                         | No — six bounded edits: the three mounts, one hook call, the `create` dialog variant gaining an optional draft, and the write-error message helper. Nothing moves or is deleted.       | The form can only be prefilled through `DialogState`, which carries no draft today, and a second form instance would duplicate the create path. The list is closed and reviewed as such. |
| 3   | Authorise the lookup with `requireTrip` (ticket) or with the write's own guard?                            | `requireWritableTrip` + `assertTripRole(['owner', 'editor'])`.                                                                                                                         | Stricter and safer: a lookup exists only to feed a write, so it should never be spent where the write would be refused (viewer, archived trip).                                          |
| 4   | Ship `searchPlacesFn` now with no UI, as the ticket suggests?                                              | No — defer it to `02-S13`, its first consumer; `-server/geocode.ts` is the module it lands in.                                                                                         | An endpoint with no caller is a metered surface nobody exercises; deferring is fully reversible and costs `02-S13` one function.                                                         |
| 5   | Open the form at once and patch the address in, or wait for the lookup?                                    | Wait up to 1,500 ms with a provisional pin, then open; a later answer is discarded.                                                                                                    | Patching needs `PlaceDialog` to merge values (its reset-on-`initial` would clobber typing) and `plan-actions.tsx` is `02-S5`'s this wave.                                                |
| 6   | Decision 3 gives wave 3 no owner in `src/components/map`; step 10 edits `map-attribution.tsx`. Which wins? | Edit `map-attribution.tsx` only; never `index.ts`. The credit data lives in the new `src/lib/geo/credits.ts`.                                                                          | Decision 5 assigns the credit line to `02-S4` explicitly, no other wave-3 stage owns that file, and the rule exists to protect the barrel, which stays untouched.                        |
| 7   | Long-press threshold and tolerance (the ticket leaves it to the spec)?                                     | 500 ms, 10 px, single pointer.                                                                                                                                                         | The platform long-press norm (Android's default is 400–500 ms); 10 px absorbs finger jitter while any real pan exceeds it.                                                               |
| 8   | Where does the quota-rejection message with a billing link live, given the form is `02-S5`'s?              | The form's existing error slot gets the catalogue sentence; a toast carries the `See plans` link to `/settings/billing`. Detection is `code === 'QUOTA_EXCEEDED'` on the thrown error. | `PlaceDialog.error` is a string and cannot hold a link; the toast is the surface the screen already uses for write outcomes.                                                             |
| 9   | Show the geocoder credit when the basemap archive is unavailable?                                          | Yes — the pill carries the geocoder credits alone then.                                                                                                                                | Stored coordinates are still drawn over the outlines; "rendered unconditionally" is the ticket's own requirement.                                                                        |

## 📋 Phasing

1. **Seams and the day's add control** — `planner-add-place.tsx`, `planner-day-tools.tsx`, `day-section.tsx`'s `dayTools`, the `create` variant's draft, the write-error helper. Ships the pill through `PlannerAddPlace` with **no menu trigger** — the trigger renders only when the menu has at least one option, so an empty menu is never shown — and a working **Add a place to this day**.
2. **Attribution** — `src/lib/geo/credits.ts`, `geoapify.ts` importing it, `MapAttribution`'s second segment. Ships alone; the obligation is met before the first geocoded address appears.
3. **The drop** — `-server/geocode.ts`, `planner-map-layer.tsx`, the menu's `map` option, the remaining copy, the e2e journey.

## 📋 Implementation Plan

### Phase 1 — seams

1. `day-section.tsx`: add `dayTools`; test that it renders once per day when given and not at all when absent. _App works: prop unused._
2. `planner-day-tools.tsx` + copy keys `addPlace.forDay`, `addPlace.forDayNamed` in 23 locales; unit test that clicking it calls `onAddPlace(day.id)`.
3. `planner-add-place.tsx` (pill + an options-driven menu that renders no trigger while it has no option) + `addPlace.label`, `addPlace.more`; test that `data-part="add-place"` is present with the pill's props unchanged, and that `add-place-menu` is absent with zero options and present with one.
4. `placeWriteMessage` in the same file + `addPlace.quota`, `addPlace.quotaAction`; unit test: a `QUOTA_EXCEEDED` error maps to the catalogue sentence and requests the billing toast; any other error keeps `messageOf`'s answer. First assert, in a server-function test, that the code survives serialisation to the client, as `impersonation-bar.tsx:222` relies on.
5. `plan-screen.tsx` edits 1, 4, 5, 6: widen `create`, mount `PlannerDayTools`, replace `addButton`, route `runWrite`'s message through the helper. Existing `plan-screen` tests and `02-S3`'s camera journey stay green.

### Phase 2 — attribution

6. `src/lib/geo/credits.ts`; `geoapify.ts` imports it; the proxy's tests stay green unchanged.
7. `MapAttribution`: second segment, dedupe by `url`, the unavailable-basemap case, `atlas.map.attribution.geocoder` in 23 locales. Tests: `Geoapify` appears once with the basemap, OpenStreetMap is not doubled, and with no archive the pill carries the geocoder credits.

### Phase 3 — the drop

8. `-server/geocode.ts` `reverseGeocodeFn`. `-server/__tests__/geocode.test.ts`: an unauthorised `tripId` (foreign, viewer-only, archived) is refused **before** the provider is called and before `getSubscription` (the provider port is a spy that must have zero calls); a provider refusal returns `{ address: null }`; a hit returns the first candidate's address.
9. `planner-map-layer.tsx` state machine and listeners, test first — `-ui/__tests__/planner-map-layer.test.tsx`: a context-click calls `onDropped` with the coordinates rounded to six places and the dialog's name field focused; `Escape` while armed cancels without a write and calls `preventDefault`; a long-press shorter than 500 ms does not drop, one of 500 ms does, one that moves 11 px does not; exactly one `map.on` per mount and a matching `map.off` on unmount, and every DOM listener removed; a lookup slower than the budget opens the form with an empty address and a later resolution changes nothing; a second trigger while `dropping` is ignored.
10. Provisional pin, arming banner, empty-map hint + the `drop.*` keys and `addPlace.option.map` in 23 locales; register the menu's `map` option, which makes the trigger appear.
11. `plan-screen.tsx` edits 2 and 3: `usePlannerDrop` and `<PlannerMapLayer>`.
12. `src/server/repos/__tests__/tenant-isolation.test.ts`: extend the existing `createPlace` cases inside `a foreign parent id is rejected, never re-scoped` (`:1251` foreign trip, `:1403` foreign category) with a valid `lat`/`lng` pair, and assert B's place count is unchanged afterwards. No second copy of either case.
13. `e2e/places-and-maps.spec.ts`: append `test.describe('02-S4 — drop a pin', …)`. First test: each published `data-part` (`add-place`, `add-place-menu`, `add-place-option[value="map"]`, `planner-canvas`) has `toHaveCount(1)` in the state that should contain it. Then: context-click → `getByRole('dialog', { name: 'Add a place to this trip' })` with latitude/longitude filled; keyboard arm → `Enter` → same dialog; save → a new marker, and a reload keeps it. `watchConsole()` before every navigation, `fatal` empty at the end (the GL advisory on a map route is the one tolerated entry), and zero layout shift after paint in Chromium including while the dialog opens. The journey asserts the coordinates and that the address field is editable, never its content, so it passes whether or not the environment holds a geocoder key and never depends on a vendor.
14. Blind A/B pair (`scripts/visual/capture.mjs`) for resting, armed and dropped, light and dark, for the human reviewer; QA evidence on the implementation PR (`needs-qa`).

## Amendment

What ships in #619 differs from the design above in these places. All three phases ship on that one pull request.

1. **A places-quota refusal does not reach the client as `QUOTA_EXCEEDED` (Resolved assumption 8).** `QuotaExceededError` is not in `AUTHORED_ERROR_NAMES`, so `failureRedactionMiddleware` sends `{ kind: 'unexpected', reference }` with no code, and `code === 'QUOTA_EXCEEDED'` can never match in production. Carrying it would change the global failure envelope (`src/lib/errors.ts`, `src/server/errors/`), which is outside this stage. `placeWriteMessage(cause, fallback)` therefore decodes the envelope: an authored refusal reads as written, and anything else gets the caller's fallback. It takes no `t`. The `addPlace.quota` / `addPlace.quotaAction` keys and the billing toast are not added. Carrying the quota refusal across the envelope is a follow-up issue. A side effect: a failed place write no longer shows the raw envelope string in the form.
2. **No geocoder credit without a basemap archive (Resolved assumption 9).** `map-canvas.test.tsx` pins that the no-archive notice names Natural Earth alone and that no credit pill stands behind the notice. The geocoder segment follows the same rule: it is appended only while the basemap is available, with OpenStreetMap deduplicated by link. The line reads `OpenStreetMap · Protomaps · Geoapify`, and the no-archive state is unchanged.
3. **The map option publishes `data-value="map"`, not `value="map"`.** A menu item is a `div`, which carries no `value`. The journey addresses `[data-part="add-place-option"][data-value="map"]`.
4. **`usePlannerDrop` takes a fourth option, `formOpen`.** The provisional pin stands until the form it opened closes, and the hook has no other way to see the screen's dialog state. It returns `{ state, editable, ready, pin, arm, cancel, drop, attach }`. `ready` keeps the menu option disabled until the map exists. `arm(returnFocusTo)` is handed the menu trigger, and `Escape` returns focus to it. The screen names the hook's result `mapDrop`, because `drop` is already a parameter inside `runMove`.
5. **The map option arms from the menu's `onCloseAutoFocus`, not from `onSelect`.** The dropdown traps focus until it has closed. A map focused from `onSelect` had focus pulled back into the menu, and then focus fell to `body`.
6. **A mouse press held still does not drop; a finger or a pen does.** A held mouse button is the start of a pan. When the map is armed, any short press that does not move past the tolerance is the click that drops.
7. **One more key, `trips.plan.drop.error`.** When a lookup is refused for authorisation, the pin is withdrawn and a toast shows the refusal's own sentence. This key is the fallback when the failure carries no sentence.
8. **The journey does not submit the form.** A created place is an additive write to the workspace both browser projects share, and `trips-core.spec.ts` declines such writes for the same reason. The save path is the unchanged `createPlanPlaceFn`. The journey runs on the unmapped trip, whose empty map also shows the hint. It runs in Chromium only, because the add control is in the desktop rail. It asserts the coordinates, the focused name field and the withdrawn pin rather than a reload.
9. **The isolation cases gain coordinates in place.** The foreign-trip attempt and the foreign-category attempt in `a foreign parent id is rejected, never re-scoped` carry `lat`/`lng`. The category case now also asserts both tenants' place counts.
